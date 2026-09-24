import type { Express, RequestHandler } from "express";
import multer from "multer";
import { isAuthenticated } from "./auth";
import { pool } from "./db";
import {
  applyBrokerPromotionPlan,
  buildPromotionPlan,
  issuePreviewToken,
  parseBrokerWorkbookBuffer,
  summarizePromotionResult,
  verifyPreviewToken,
} from "./brokerWorkbookPromotion";
import { isPlatformAdminEmail } from "@shared/admin-auth";

const confirmationText = "IMPORT NC AND TN BROKERS";
const maxWorkbookBytes = 20 * 1024 * 1024;
const approvedWorkbookHashes = {
  NC: "534b052222787fb3edb682a2c7b6a97f04450fd13688028a2d9d0173a3b13523",
  TN: "5593640aa08bc99b8950d4e8d6ffe8bef95f9983c52f812a08615c1da6dd1cfd",
} as const;

const workbookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxWorkbookBytes, files: 2, fields: 2 },
});

const workbookFields: RequestHandler = (req, res, next) => {
  workbookUpload.fields([
    { name: "ncWorkbook", maxCount: 1 },
    { name: "tnWorkbook", maxCount: 1 },
  ])(req, res, (error: any) => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Each workbook must be smaller than 20 MB"
        : "Upload exactly one NC workbook and one TN workbook";
      return res.status(400).json({ error: message });
    }
    next();
  });
};

const productionOnly: RequestHandler = (_req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    return res.status(409).json({ error: "This broker import can only run in the published production app." });
  }
  next();
};

const requirePlatformAdmin: RequestHandler = (req: any, res, next) => {
  const email = String(req.user?.email || req.user?.claims?.email || "").trim().toLowerCase();
  if (!isPlatformAdminEmail(email)) {
    return res.status(403).json({ error: "Platform administrator access required." });
  }
  next();
};

function getAdminEmail(req: any): string {
  return String(req.user?.email || req.user?.claims?.email || "").trim().toLowerCase();
}

function uploadedWorkbooks(req: any) {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const nc = files?.ncWorkbook?.[0];
  const tn = files?.tnWorkbook?.[0];
  if (!nc || !tn) {
    throw new Error("Upload both the NC and TN workbooks.");
  }
  const workbooks = [
    parseBrokerWorkbookBuffer(nc.originalname, nc.buffer, "NC"),
    parseBrokerWorkbookBuffer(tn.originalname, tn.buffer, "TN"),
  ];
  for (const workbook of workbooks) {
    if (workbook.fileHash !== approvedWorkbookHashes[workbook.state]) {
      throw new Error(`Only the approved September 2026 ${workbook.state} workbook is accepted.`);
    }
  }
  return workbooks;
}

function hasImportedStates(plan: Awaited<ReturnType<typeof buildPromotionPlan>>): boolean {
  return plan.preview.sharedStateRowsAlreadyPresent.length > 0;
}

export function registerBrokerStateImportRoutes(app: Express): void {
  app.post(
    "/api/admin/broker-state-import/preview",
    productionOnly,
    isAuthenticated,
    requirePlatformAdmin,
    workbookFields,
    async (req: any, res) => {
      let workbooks;
      try {
        workbooks = uploadedWorkbooks(req);
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid workbook upload." });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const plan = await buildPromotionPlan(client, workbooks);
        await client.query("COMMIT");
        if (hasImportedStates(plan)) {
          return res.status(409).json({
            error: "NC or TN shared broker rows already exist. This one-time import path is disabled to prevent a second promotion.",
            preview: plan.preview,
          });
        }
        const sessionSecret = process.env.SESSION_SECRET;
        if (!sessionSecret) throw new Error("Session signing is not configured.");
        return res.json({
          preview: plan.preview,
          previewToken: issuePreviewToken(getAdminEmail(req), plan, sessionSecret),
          expiresInMinutes: 30,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[broker state import preview]", message);
        if (message.startsWith("Import preview blocked:")) {
          return res.status(409).json({ error: message });
        }
        return res.status(500).json({ error: "Could not build a production import preview." });
      } finally {
        client.release();
      }
    },
  );

  app.post(
    "/api/admin/broker-state-import/apply",
    productionOnly,
    isAuthenticated,
    requirePlatformAdmin,
    workbookFields,
    async (req: any, res) => {
      let workbooks;
      try {
        workbooks = uploadedWorkbooks(req);
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid workbook upload." });
      }
      if (String(req.body?.confirmation || "") !== confirmationText) {
        return res.status(400).json({ error: `Type "${confirmationText}" to authorize this import.` });
      }
      const sessionSecret = process.env.SESSION_SECRET;
      if (!sessionSecret) return res.status(500).json({ error: "Session signing is not configured." });

      const client = await pool.connect();
      let transactionOpen = false;
      try {
        await client.query("BEGIN");
        transactionOpen = true;
        // Block concurrent broker edits during the short planning-and-write
        // window so the preview's broker snapshot cannot change under us.
        await client.query("LOCK TABLE brokers IN SHARE ROW EXCLUSIVE MODE");
        const plan = await buildPromotionPlan(client, workbooks);
        if (hasImportedStates(plan)) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(409).json({
            error: "NC or TN shared broker rows already exist. This one-time import path is disabled.",
            preview: plan.preview,
          });
        }
        if (!verifyPreviewToken(
          String(req.body?.previewToken || ""),
          getAdminEmail(req),
          plan,
          sessionSecret,
        )) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(409).json({
            error: "The preview expired or production broker data changed. Run a new preview before applying.",
          });
        }

        const result = await applyBrokerPromotionPlan(client, plan);
        await client.query("COMMIT");
        transactionOpen = false;
        return res.json({
          success: true,
          message: "Broker data imported; NC and TN state options were verified.",
          result: summarizePromotionResult(plan, result),
        });
      } catch (error) {
        if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[broker state import apply]", message);
        if (message.startsWith("Import preview blocked:")) {
          return res.status(409).json({ error: message });
        }
        return res.status(500).json({
          error: "The import was rolled back. No partial broker changes were committed.",
        });
      } finally {
        client.release();
      }
    },
  );
}
import { randomBytes } from "node:crypto";
import type { Express, RequestHandler } from "express";
import multer from "multer";
import { isAuthenticated } from "./auth";
import { generalApiLimiter } from "./rateLimiter";
import { pool } from "./db";
import { isPlatformAdminEmail } from "@shared/admin-auth";
import { isUsStateCode, normalizeUsStateCode } from "@shared/us-states";
import {
  applySharedImportPlan,
  buildSharedImportPlan,
  hashSharedBrokerSnapshot,
  parseSharedBrokerWorkbook,
  readSharedBrokers,
  SHARED_IMPORT_FIELDS,
  type SharedImportMapping,
  type SharedImportPlan,
} from "./sharedBrokerStateImport";

const maxFileBytes = 10 * 1024 * 1024;
const previewLifetimeMs = 30 * 60 * 1000;
const previews = new Map<string, {
  email: string;
  expiresAt: number;
  plan: SharedImportPlan;
}>();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileBytes, files: 1, fields: 2 },
});

const singleWorkbook: RequestHandler = (req, res, next) => {
  upload.single("workbook")(req, res, (error: any) => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "The file must be 10 MB or smaller."
        : "Upload one CSV or Excel workbook.";
      return res.status(400).json({ error: message });
    }
    next();
  });
};

const requirePlatformAdmin: RequestHandler = (req: any, res, next) => {
  const email = String(req.user?.email || req.user?.claims?.email || "").trim().toLowerCase();
  if (!isPlatformAdminEmail(email)) {
    return res.status(403).json({ error: "Platform administrator access required." });
  }
  next();
};

function adminEmail(req: any): string {
  return String(req.user?.email || req.user?.claims?.email || "").trim().toLowerCase();
}

function removeExpiredPreviews() {
  const now = Date.now();
  for (const [token, preview] of Array.from(previews.entries())) {
    if (preview.expiresAt <= now) previews.delete(token);
  }
  while (previews.size >= 20) {
    const oldest = previews.keys().next().value;
    if (!oldest) break;
    previews.delete(oldest);
  }
}

function parseMapping(value: unknown): SharedImportMapping {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value || ""));
  } catch {
    throw new Error("Column mapping is missing or invalid.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Column mapping is missing or invalid.");
  }
  const mapping: SharedImportMapping = {};
  for (const [field, header] of Object.entries(parsed as Record<string, unknown>)) {
    if (!(SHARED_IMPORT_FIELDS as readonly string[]).includes(field)) continue;
    if (typeof header === "string" && header.length <= 250) {
      mapping[field as keyof SharedImportMapping] = header;
    }
  }
  return mapping;
}

export function registerSharedBrokerStateImportRoutes(app: Express): void {
  app.post(
    "/api/admin/shared-broker-import/preview",
    isAuthenticated,
    requirePlatformAdmin,
    generalApiLimiter,
    singleWorkbook,
    async (req: any, res) => {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: "Choose a CSV or Excel workbook." });
      if (!/\.(csv|xlsx)$/i.test(file.originalname)) {
        return res.status(400).json({ error: "Only CSV and .xlsx files are supported." });
      }
      const state = normalizeUsStateCode(req.body?.state);
      if (!isUsStateCode(state)) return res.status(400).json({ error: "Choose a valid U.S. state." });

      let parsed;
      try {
        parsed = parseSharedBrokerWorkbook(file.buffer, state, parseMapping(req.body?.mapping));
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : "The workbook could not be read." });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const existingRows = await readSharedBrokers(client);
        const plan = buildSharedImportPlan(state, parsed, existingRows);
        await client.query("COMMIT");
        removeExpiredPreviews();
        const token = randomBytes(32).toString("base64url");
        previews.set(token, {
          email: adminEmail(req),
          expiresAt: Date.now() + previewLifetimeMs,
          plan,
        });
        return res.json({
          preview: plan.preview,
          previewToken: token,
          expiresInMinutes: 30,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if (error instanceof Error && error.message.startsWith("Import preview blocked:")) {
          return res.status(409).json({ error: error.message });
        }
        console.error("[shared broker import preview] Failed to build preview.");
        return res.status(500).json({ error: "Could not build a shared broker import preview." });
      } finally {
        client.release();
      }
    },
  );

  app.post(
    "/api/admin/shared-broker-import/apply",
    isAuthenticated,
    requirePlatformAdmin,
    generalApiLimiter,
    async (req: any, res) => {
      const token = String(req.body?.previewToken || "");
      const preview = previews.get(token);
      if (!preview || preview.expiresAt <= Date.now()) {
        previews.delete(token);
        return res.status(409).json({ error: "The preview expired. Upload the file and preview it again." });
      }
      if (preview.email !== adminEmail(req)) {
        return res.status(403).json({ error: "This preview belongs to another administrator." });
      }
      const confirmation = `IMPORT ${preview.plan.state} BROKERS`;
      if (String(req.body?.confirmation || "") !== confirmation) {
        return res.status(400).json({ error: `Type "${confirmation}" to authorize this shared import.` });
      }

      const client = await pool.connect();
      let transactionOpen = false;
      try {
        await client.query("BEGIN");
        transactionOpen = true;
        await client.query("LOCK TABLE brokers IN SHARE ROW EXCLUSIVE MODE");
        const currentRows = await readSharedBrokers(client);
        if (hashSharedBrokerSnapshot(currentRows) !== preview.plan.snapshotHash) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          previews.delete(token);
          return res.status(409).json({
            error: "Shared broker data changed after the preview. Run a new preview before applying.",
          });
        }
        const result = await applySharedImportPlan(client, preview.plan);
        await client.query("COMMIT");
        transactionOpen = false;
        previews.delete(token);
        return res.json({
          success: true,
          state: preview.plan.state,
          inserted: result.inserted,
          updated: result.updated,
          stateBrokersVerified: result.stateBrokersVerified,
        });
      } catch (error) {
        if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
        console.error("[shared broker import apply] Transaction rolled back.");
        return res.status(500).json({ error: "The import was rolled back. No partial changes were committed." });
      } finally {
        client.release();
      }
    },
  );
}
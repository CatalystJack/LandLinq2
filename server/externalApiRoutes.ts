/**
 * LandLinq External API — v1
 *
 * Authenticated with X-API-Key header.
 * Keys are stored as SHA-256 hashes; the plaintext is only shown once at creation.
 *
 * POST /api/v1/leads           — create a lead (deal)
 * POST /api/v1/leads/:id/attachments — upload a file attachment
 * GET  /api/v1/leads/:id       — fetch lead status + basic info
 * GET  /api/v1/ping            — health check (no auth required)
 *
 * Admin (internal auth):
 * GET  /api/admin/api-keys          — list keys
 * POST /api/admin/api-keys          — generate new key
 * PATCH /api/admin/api-keys/:id/revoke — revoke key
 * DELETE /api/admin/api-keys/:id    — delete key
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db, pool } from "./db";
import { isAuthenticated } from "./auth";
import { apiKeys, leadAttachments, deals, brokers, developerProfiles, emailIntakeQueue } from "@shared/schema";
import { isPlatformAdminEmail } from "@shared/admin-auth";
import { eq, desc, and, isNull, or, sql } from "drizzle-orm";
import crypto from "crypto";
import multer from "multer";
import { createRateLimit } from "./rateLimiter";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const parsedDealApiLimiter = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: "Too many parsed-deal submissions. Please retry shortly.",
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function generateKey(env: "live" | "test"): { key: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(24).toString("hex"); // 48 hex chars
  const key = `llq_${env}_${random}`;
  const prefix = `llq_${env}_${random.slice(0, 6)}...`;
  const hash = sha256(key);
  return { key, prefix, hash };
}

// ── API Key middleware ────────────────────────────────────────────────────────

async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const rawKey = (req.headers["x-api-key"] as string) || (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  if (!rawKey) {
    return res.status(401).json({ error: "Missing API key. Send X-API-Key header." });
  }

  const hash = sha256(rawKey);
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1);
  if (!rows.length || !rows[0].isActive) {
    return res.status(401).json({ error: "Invalid or revoked API key." });
  }

  // Update usage stats (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date(), totalCalls: (rows[0].totalCalls ?? 0) + 1 })
    .where(eq(apiKeys.id, rows[0].id))
    .catch(() => {});

  (req as any).apiKeyRow = rows[0];
  (req as any).isSandbox = rows[0].environment === "test";
  next();
}

function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  const email = user?.claims?.email || user?.email;
  if (!isPlatformAdminEmail(email)) {
    return res.status(403).json({ message: "Platform administrator access required" });
  }
  next();
}

// ── Upsert broker by email ────────────────────────────────────────────────────

async function upsertBrokerByEmail(opts: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}, executor: any = db): Promise<string> {
  const existing = await executor
    .select({ id: brokers.id })
    .from(brokers)
    .where(and(
      eq(brokers.email, opts.email.toLowerCase()),
      isNull(brokers.ownerDeveloperProfileId),
    ))
    .limit(1);

  if (existing.length) return existing[0].id;

  const [row] = await executor
    .insert(brokers)
    .values({
      firstName: opts.firstName || "Unknown",
      lastName: opts.lastName || "Sender",
      email: opts.email.toLowerCase(),
      phone: opts.phone || null,
      isActive: true,
    } as any)
    .returning({ id: brokers.id });

  return row.id;
}

// ── Register routes ────────────────────────────────────────────────────────────

export function registerExternalApiRoutes(app: Express) {

  // ── Public health check ──────────────────────────────────────────────────────
  app.get("/api/v1/ping", (_req, res) => {
    res.json({ ok: true, version: "v1", service: "LandLinq API" });
  });

  // List active tenant workspaces available for explicit external routing.
  app.get("/api/v1/investment-companies", requireApiKey, async (_req, res) => {
    try {
      const companies = await db.select({
        id: developerProfiles.id,
        companyName: developerProfiles.companyName,
        knownEmailDomains: developerProfiles.knownEmailDomains,
      }).from(developerProfiles).where(and(
        eq(developerProfiles.isActive, true),
        or(eq(developerProfiles.isInternal, false), isNull(developerProfiles.isInternal)),
      ))
        .orderBy(developerProfiles.companyName);
      return res.json({ companies });
    } catch (error) {
      console.error("[ExternalAPI] Unable to list active Investment Companies");
      return res.status(500).json({ error: "Unable to list Investment Companies." });
    }
  });

  // Accept already-parsed email data and hand it to the normal automated intake
  // pipeline. This intentionally does not call the email parser or auto-send.
  app.post("/api/v1/deals/parsed-email", requireApiKey, parsedDealApiLimiter, async (req, res) => {
    const body = req.body || {};
    const sourceEmailMessageId = typeof body.sourceEmailMessageId === "string"
      ? body.sourceEmailMessageId.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const dryRun = body.dryRun === true;
    const inputFields = [
      "propertyName", "address", "city", "county", "state", "zip", "parcelId",
      "acreage", "askingPrice", "unitCount", "vintage", "zoning", "propertyType",
      "brokerName", "brokerEmail", "brokerPhone", "notes",
    ];
    const strings: Record<string, string> = {};
    for (const field of inputFields) {
      const value = body[field];
      if (value !== undefined && value !== null && typeof value !== "string" && field !== "acreage" && field !== "askingPrice" && field !== "unitCount" && field !== "vintage") {
        return res.status(400).json({ error: `${field} must be a string.` });
      }
      if (typeof value === "string") {
        if (value.length > (field === "notes" ? 10000 : 500)) {
          return res.status(400).json({ error: `${field} exceeds the allowed length.` });
        }
        strings[field] = value.trim();
      }
    }
    const numeric: Record<string, number | null> = {};
    for (const field of ["acreage", "askingPrice", "unitCount", "vintage"]) {
      const value = body[field];
      if (value === undefined || value === null || value === "") {
        numeric[field] = null;
      } else {
        const parsed = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(parsed) || parsed < 0 || (["unitCount", "vintage", "askingPrice"].includes(field) && !Number.isInteger(parsed))) {
          return res.status(400).json({ error: `${field} must be a valid non-negative ${["unitCount", "vintage", "askingPrice"].includes(field) ? "integer" : "number"}.` });
        }
        numeric[field] = parsed;
      }
    }
    if (!sourceEmailMessageId || sourceEmailMessageId.length > 500) {
      return res.status(400).json({ error: "sourceEmailMessageId is required and must be 500 characters or fewer." });
    }
    if (!address) return res.status(400).json({ error: "address is required." });
    const brokerEmail = (strings.brokerEmail || "").toLowerCase();
    if (brokerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brokerEmail)) {
      return res.status(400).json({ error: "brokerEmail must be a valid email address." });
    }
    const targetProfileId = typeof body.targetProfileId === "string" ? body.targetProfileId.trim() : "";
    const targetSenderEmail = typeof body.targetSenderEmail === "string" ? body.targetSenderEmail.trim().toLowerCase() : "";
    const targetSenderDomain = typeof body.targetSenderDomain === "string" ? body.targetSenderDomain.trim().toLowerCase().replace(/^@/, "") : "";
    if ([targetProfileId, targetSenderEmail, targetSenderDomain].filter(Boolean).length !== 1) {
      return res.status(400).json({ error: "Provide exactly one of targetProfileId, targetSenderEmail, or targetSenderDomain." });
    }
    const senderDomain = targetSenderEmail ? targetSenderEmail.split("@").at(-1) || "" : targetSenderDomain;
    if (targetSenderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetSenderEmail)) {
      return res.status(400).json({ error: "targetSenderEmail must be a valid email address." });
    }
    if ((targetSenderDomain || targetSenderEmail) && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(senderDomain)) {
      return res.status(400).json({ error: "A valid target sender email or domain is required." });
    }

    try {
      const activeCompanies = await db.select({
        id: developerProfiles.id,
        companyName: developerProfiles.companyName,
        knownEmailDomains: developerProfiles.knownEmailDomains,
      }).from(developerProfiles).where(and(
        eq(developerProfiles.isActive, true),
        or(eq(developerProfiles.isInternal, false), isNull(developerProfiles.isInternal)),
      ));
      let matches = activeCompanies;
      if (targetProfileId) matches = matches.filter(company => company.id === targetProfileId);
      else {
        const normalizedDomain = senderDomain.replace(/\.$/, "");
        matches = matches.filter(company => (company.knownEmailDomains || []).some(domain =>
          String(domain).trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "") === normalizedDomain,
        ));
      }
      if (matches.length !== 1) {
        return res.status(matches.length ? 409 : 404).json({
          error: matches.length ? "Target sender domain matches multiple active companies." : "No matching active Investment Company was found.",
        });
      }
      const company = matches[0];
      const isSandbox = Boolean((req as any).isSandbox);
      const storedAddress = isSandbox ? `[SANDBOX TEST] ${address}` : address;
      const propertyType = (strings.propertyType || "").toLowerCase();
      const parsedDealType = ["multifamily", "existing_multifamily", "acquisition"].includes(propertyType)
        ? "existing_multifamily" : "land_development";
      const preview = {
        company: { id: company.id, companyName: company.companyName },
        deal: {
          propertyName: strings.propertyName || null,
          address: storedAddress,
          city: strings.city || null,
          county: strings.county || null,
          state: strings.state || null,
          zip: strings.zip || null,
          parcelId: strings.parcelId || null,
          acreage: numeric.acreage,
          askingPrice: numeric.askingPrice,
          unitCount: numeric.unitCount,
          vintage: numeric.vintage,
          zoning: strings.zoning || null,
          propertyType: strings.propertyType || "land",
          broker: { name: strings.brokerName || null, email: brokerEmail || null, phone: strings.brokerPhone || null },
          notes: strings.notes || null,
        },
      };
      if (dryRun) return res.json({ ok: true, dryRun: true, wouldCreate: preview });

      const scopedSourceMessageId = isSandbox ? `test:${sourceEmailMessageId}` : sourceEmailMessageId;
      const messageHash = crypto.createHash("sha256").update(`external-parsed-email:${scopedSourceMessageId}`).digest("hex");
      // Serialize retries, including across app instances, while the normal
      // intake pipeline creates the deal and partner-developer visibility row.
      const lockClient = await pool.connect();
      try {
        await lockClient.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [scopedSourceMessageId]);
        let [intake] = await db.select().from(emailIntakeQueue)
          .where(eq(emailIntakeQueue.emailHash, messageHash)).limit(1);
        if (!intake) {
          [intake] = await db.insert(emailIntakeQueue).values({
            fromEmail: brokerEmail || "external-api@landlinq.invalid",
            fromName: strings.brokerName || null,
            subject: "Externally parsed deal submission",
            emailBody: "",
            emailHash: messageHash,
            parsedDealType,
            parsedPropertyType: strings.propertyType || "land",
            parsedPropertyName: strings.propertyName || null,
            parsedAddress: storedAddress,
            parsedCity: strings.city || null,
            parsedCounty: strings.county || null,
            parsedState: strings.state || null,
            parsedZip: strings.zip || null,
            parsedParcelId: strings.parcelId || null,
            parsedAcres: numeric.acreage === null ? null : String(numeric.acreage),
            parsedPrice: numeric.askingPrice,
            parsedUnitCount: numeric.unitCount,
            parsedVintage: numeric.vintage,
            parsedBrokerName: strings.brokerName || null,
            parsedBrokerEmail: brokerEmail || null,
            parsedBrokerPhone: strings.brokerPhone || null,
            parsedNotes: strings.notes || null,
            parsedZoning: strings.zoning || null,
            overallConfidence: "100",
            targetDeveloperProfileId: company.id,
            sourceEmailMessageId: scopedSourceMessageId,
            status: "processing",
          }).returning();
        }
        if (intake.dealId) {
          const [existing] = await db.select({
            id: deals.id, dealNumber: deals.dealNumber, address: deals.address,
          }).from(deals).where(eq(deals.id, intake.dealId)).limit(1);
          if (existing) {
            return res.json({
              ok: true,
              duplicate: true,
              sandbox: isSandbox,
              sourceEmailMessageId,
              deal: existing,
              company: preview.company,
            });
          }
        }
        await db.update(emailIntakeQueue).set({ status: "processing" }).where(eq(emailIntakeQueue.id, intake.id));
        try {
          const { processAutomatedDealEmailIntake } = await import("./automatedDealEmailPipeline.js");
          const result = await processAutomatedDealEmailIntake(intake.id);
          if (!result.dealId) {
            return res.status(422).json({ ok: false, outcome: result.outcome, reason: result.reason, intakeId: intake.id });
          }
          const [deal] = await db.select({
            id: deals.id, dealNumber: deals.dealNumber, address: deals.address,
          }).from(deals).where(eq(deals.id, result.dealId)).limit(1);
          return res.status(result.outcome === "duplicate" ? 200 : 201).json({
            ok: true,
            duplicate: result.outcome === "duplicate",
            sandbox: isSandbox,
            sourceEmailMessageId,
            company: preview.company,
            deal,
          });
        } catch (error) {
          await db.update(emailIntakeQueue).set({ status: "pending" }).where(eq(emailIntakeQueue.id, intake.id)).catch(() => {});
          console.error("[ExternalAPI] Parsed deal intake failed", { intakeId: intake.id });
          return res.status(500).json({ error: "Deal intake failed. Retry the same sourceEmailMessageId to resume." });
        }
      } finally {
        await lockClient.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [scopedSourceMessageId]).catch(() => {});
        lockClient.release();
      }
    } catch (error) {
      console.error("[ExternalAPI] Parsed deal request failed");
      return res.status(500).json({ error: "Unable to process parsed deal." });
    }
  });

  // ── POST /api/v1/leads ───────────────────────────────────────────────────────
  app.post("/api/v1/leads", requireApiKey, async (req, res) => {
    try {
      const {
        sender_name,
        sender_email,
        sender_phone,
        property_address,
        property_type,    // "land" | "commercial"
        size_acres,
        zoning_notes,
        notes,            // raw full email body
        asking_price,
      } = req.body;

      const normalizedPropertyAddress = typeof property_address === "string" ? property_address.trim() : "";
      if (!normalizedPropertyAddress) {
        return res.status(400).json({ error: "property_address is required." });
      }
      if (!sender_email && !sender_phone) {
        return res.status(400).json({ error: "sender_email or sender_phone is required." });
      }

      const isSandbox = (req as any).isSandbox;

      // Parse sender name
      const nameParts = (sender_name || "API Submission").trim().split(/\s+/);
      const firstName = nameParts[0] || "API";
      const lastName = nameParts.slice(1).join(" ") || "Submission";

      // Compose combined notes (notes field + zoning_notes)
      const combinedNotes = [
        notes ? `--- Original Email Body ---\n${notes}` : null,
        zoning_notes ? `--- Zoning / Ordinance Notes ---\n${zoning_notes}` : null,
      ]
        .filter(Boolean)
        .join("\n\n") || null;

      // Sandbox: prefix address so it's obvious in the UI
      const finalAddress = isSandbox
        ? `[SANDBOX TEST] ${normalizedPropertyAddress}`
        : normalizedPropertyAddress;

      const submission = await db.transaction(async (tx) => {
        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(hashtext(LOWER(TRIM(${finalAddress})))::bigint)
        `);
        const [existingDeal] = await tx.select({
          id: deals.id,
          dealNumber: deals.dealNumber,
          status: deals.status,
          address: deals.address,
          createdAt: deals.createdAt,
        }).from(deals)
          .where(sql`lower(trim(${deals.address})) = lower(trim(${finalAddress}))`)
          .limit(1);
        if (existingDeal) {
          return { deal: existingDeal, reusedExistingLead: true };
        }

        let brokerId: string | null = null;
        if (sender_email) {
          brokerId = await upsertBrokerByEmail({
            email: sender_email,
            firstName,
            lastName,
            phone: sender_phone,
          }, tx);
        }

        const [deal] = await tx
          .insert(deals)
          .values({
            brokerId,
            address: finalAddress,
            dealType: property_type === "commercial" ? "commercial" : "land",
            sizeAcres: size_acres ? String(size_acres) : null,
            askingPrice: asking_price ? String(asking_price) : null,
            zoning: zoning_notes ? zoning_notes.slice(0, 100) : null,
            apexNotes: combinedNotes,
            status: "pending_review",
            submissionMethod: "api",
            brokerPhone: sender_phone || null,
          } as any)
          .returning({
            id: deals.id,
            dealNumber: deals.dealNumber,
            status: deals.status,
            address: deals.address,
            createdAt: deals.createdAt,
          });
        return { deal, reusedExistingLead: false };
      });

      return res.status(submission.reusedExistingLead ? 200 : 201).json({
        ok: true,
        reused_existing_lead: submission.reusedExistingLead,
        lead: {
          id: submission.deal.id,
          deal_number: submission.deal.dealNumber,
          status: submission.deal.status,
          address: submission.deal.address,
          created_at: submission.deal.createdAt,
          sandbox: isSandbox,
        },
        _links: {
          self: `/api/v1/leads/${submission.deal.id}`,
          attachments: `/api/v1/leads/${submission.deal.id}/attachments`,
        },
      });
    } catch (err: any) {
      console.error("[ExternalAPI] POST /api/v1/leads error:", err.message);
      return res.status(500).json({ error: "Internal server error.", detail: err.message });
    }
  });

  // ── GET /api/v1/leads/:id ────────────────────────────────────────────────────
  app.get("/api/v1/leads/:id", requireApiKey, async (req, res) => {
    try {
      const rows = await db
        .select({
          id: deals.id,
          dealNumber: deals.dealNumber,
          address: deals.address,
          status: deals.status,
          dealType: deals.dealType,
          sizeAcres: deals.sizeAcres,
          askingPrice: deals.askingPrice,
          classification: deals.classification,
          createdAt: deals.createdAt,
        })
        .from(deals)
        .where(eq(deals.id, req.params.id))
        .limit(1);

      if (!rows.length) return res.status(404).json({ error: "Lead not found." });

      const attachments = await db
        .select()
        .from(leadAttachments)
        .where(eq(leadAttachments.dealId, req.params.id))
        .orderBy(desc(leadAttachments.uploadedAt));

      const d = rows[0];
      return res.json({
        ok: true,
        lead: {
          id: d.id,
          deal_number: d.dealNumber,
          address: d.address,
          status: d.status,
          deal_type: d.dealType,
          size_acres: d.sizeAcres ? parseFloat(d.sizeAcres) : null,
          asking_price: d.askingPrice ? parseFloat(d.askingPrice) : null,
          classification: d.classification,
          created_at: d.createdAt,
          attachment_count: attachments.length,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: "Internal server error.", detail: err.message });
    }
  });

  // ── POST /api/v1/leads/:id/attachments ───────────────────────────────────────
  app.post("/api/v1/leads/:id/attachments", requireApiKey, upload.array("files", 10), async (req, res) => {
    try {
      // Verify deal exists
      const dealRows = await db
        .select({ id: deals.id })
        .from(deals)
        .where(eq(deals.id, req.params.id))
        .limit(1);

      if (!dealRows.length) return res.status(404).json({ error: "Lead not found." });

      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length) {
        return res.status(400).json({ error: "No files received. Send multipart/form-data with field name 'files'." });
      }

      // Try to use object storage if available; fall back to metadata-only record
      let ObjectStorage: any = null;
      try {
        const osModule = await import("@replit/object-storage");
        ObjectStorage = osModule.Client;
      } catch { /* object storage not available */ }

      const saved: { id: string; filename: string; size_bytes: number; stored: boolean; url: string | null }[] = [];
      const newPublicUrls: string[] = [];

      // Derive base URL for building public document URLs
      const proto = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "";
      const baseUrl = host ? `${proto}://${host}` : "";

      for (const file of files) {
        let storageUrl: string | null = null;
        let storageKey: string | null = null;
        let publicUrl: string | null = null;

        if (ObjectStorage) {
          try {
            const client = new ObjectStorage();
            const key = `lead-attachments/${req.params.id}/${Date.now()}-${file.originalname}`;
            await client.uploadFromBytes(key, file.buffer);
            storageKey = key;
            storageUrl = key;
            publicUrl = `${baseUrl}/api/public/storage/${key}`;
          } catch (e: any) {
            console.warn("[ExternalAPI] Object storage upload failed:", e.message);
          }
        }

        const [row] = await db
          .insert(leadAttachments)
          .values({
            dealId: req.params.id,
            filename: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            storageUrl: publicUrl || storageUrl,
            storageKey,
            source: "api",
          })
          .returning({ id: leadAttachments.id });

        if (publicUrl) newPublicUrls.push(publicUrl);

        saved.push({
          id: row.id,
          filename: file.originalname,
          size_bytes: file.size,
          stored: !!storageUrl,
          url: publicUrl,
        });
      }

      // Append new URLs to deals.documentUrls so they appear in the Broker Docs column
      if (newPublicUrls.length > 0) {
        const [currentDeal] = await db
          .select({ documentUrls: deals.documentUrls })
          .from(deals)
          .where(eq(deals.id, req.params.id))
          .limit(1);
        const existing: string[] = Array.isArray(currentDeal?.documentUrls) ? (currentDeal.documentUrls as string[]) : [];
        await db
          .update(deals)
          .set({ documentUrls: [...existing, ...newPublicUrls] })
          .where(eq(deals.id, req.params.id));
      }

      return res.status(201).json({ ok: true, attachments: saved });
    } catch (err: any) {
      console.error("[ExternalAPI] POST attachments error:", err.message);
      return res.status(500).json({ error: "Internal server error.", detail: err.message });
    }
  });

  // ── ADMIN: list keys ─────────────────────────────────────────────────────────
  app.get("/api/admin/api-keys", isAuthenticated, requirePlatformAdmin, async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          environment: apiKeys.environment,
          isActive: apiKeys.isActive,
          createdBy: apiKeys.createdBy,
          lastUsedAt: apiKeys.lastUsedAt,
          totalCalls: apiKeys.totalCalls,
          createdAt: apiKeys.createdAt,
          revokedAt: apiKeys.revokedAt,
          notes: apiKeys.notes,
        })
        .from(apiKeys)
        .orderBy(desc(apiKeys.createdAt));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ADMIN: generate key ──────────────────────────────────────────────────────
  app.post("/api/admin/api-keys", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      const { name, environment = "live", notes } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      if (!["live", "test"].includes(environment)) {
        return res.status(400).json({ error: "environment must be 'live' or 'test'" });
      }

      const { key, prefix, hash } = generateKey(environment as "live" | "test");

      const [row] = await db
        .insert(apiKeys)
        .values({
          name,
          keyHash: hash,
          keyPrefix: prefix,
          environment,
          notes: notes || null,
          createdBy: String((req.user as any)?.id || "").slice(0, 255) || null,
          isActive: true,
        } as any)
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          environment: apiKeys.environment,
          createdAt: apiKeys.createdAt,
        });

      return res.status(201).json({ ...row, key });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ADMIN: revoke ────────────────────────────────────────────────────────────
  app.patch("/api/admin/api-keys/:id/revoke", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      await db
        .update(apiKeys)
        .set({ isActive: false, revokedAt: new Date() })
        .where(eq(apiKeys.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ADMIN: re-activate ───────────────────────────────────────────────────────
  app.patch("/api/admin/api-keys/:id/activate", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      await db
        .update(apiKeys)
        .set({ isActive: true, revokedAt: null })
        .where(eq(apiKeys.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ADMIN: delete ────────────────────────────────────────────────────────────
  app.delete("/api/admin/api-keys/:id", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      await db.delete(apiKeys).where(eq(apiKeys.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

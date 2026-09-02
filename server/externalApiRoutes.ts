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
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { apiKeys, leadAttachments, deals, brokers } from "@shared/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import crypto from "crypto";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

// ── Upsert broker by email ────────────────────────────────────────────────────

async function upsertBrokerByEmail(opts: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<string> {
  const existing = await db
    .select({ id: brokers.id })
    .from(brokers)
    .where(and(
      eq(brokers.email, opts.email.toLowerCase()),
      isNull(brokers.ownerDeveloperProfileId),
    ))
    .limit(1);

  if (existing.length) return existing[0].id;

  const [row] = await db
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

      if (!property_address) {
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

      // Find or create broker
      let brokerId: string | null = null;
      if (sender_email) {
        brokerId = await upsertBrokerByEmail({
          email: sender_email,
          firstName,
          lastName,
          phone: sender_phone,
        });
      }

      // Compose combined notes (notes field + zoning_notes)
      const combinedNotes = [
        notes ? `--- Original Email Body ---\n${notes}` : null,
        zoning_notes ? `--- Zoning / Ordinance Notes ---\n${zoning_notes}` : null,
      ]
        .filter(Boolean)
        .join("\n\n") || null;

      // Sandbox: prefix address so it's obvious in the UI
      const finalAddress = isSandbox
        ? `[SANDBOX TEST] ${property_address}`
        : property_address;

      const [deal] = await db
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

      return res.status(201).json({
        ok: true,
        lead: {
          id: deal.id,
          deal_number: deal.dealNumber,
          status: deal.status,
          address: deal.address,
          created_at: deal.createdAt,
          sandbox: isSandbox,
        },
        _links: {
          self: `/api/v1/leads/${deal.id}`,
          attachments: `/api/v1/leads/${deal.id}/attachments`,
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
  app.get("/api/admin/api-keys", isAuthenticated, async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          keyPlaintext: apiKeys.keyPlaintext,
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
  app.post("/api/admin/api-keys", isAuthenticated, async (req, res) => {
    try {
      const { name, environment = "live", notes, createdBy } = req.body;
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
          keyPlaintext: key,
          environment,
          notes: notes || null,
          createdBy: createdBy || null,
          isActive: true,
        } as any)
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          keyPlaintext: apiKeys.keyPlaintext,
          environment: apiKeys.environment,
          createdAt: apiKeys.createdAt,
        });

      return res.status(201).json({ ...row, key: row.keyPlaintext });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── ADMIN: revoke ────────────────────────────────────────────────────────────
  app.patch("/api/admin/api-keys/:id/revoke", isAuthenticated, async (req, res) => {
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
  app.patch("/api/admin/api-keys/:id/activate", isAuthenticated, async (req, res) => {
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
  app.delete("/api/admin/api-keys/:id", isAuthenticated, async (req, res) => {
    try {
      await db.delete(apiKeys).where(eq(apiKeys.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

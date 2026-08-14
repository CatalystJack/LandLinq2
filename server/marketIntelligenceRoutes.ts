import type { Express } from "express";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import {
  zoningAgendaItems,
  marketListings,
  permitSignals,
  marketNewsItems,
  marketOpportunities,
} from "@shared/schema";
import { eq, desc, and, isNull, or } from "drizzle-orm";
import {
  NC_MARKETS,
  fetchAndParseZoningPage,
  parseZoningText,
  fetchLoopNetListings,
  processPermitRows,
  fetchAndScoreMarketNews,
  type MarketKey,
} from "./marketIntelligenceService";
import {
  searchCountyParcels,
  screenAddressBatch,
  type OpportunitySearchFilters,
} from "./marketOpportunitiesService";
import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const VALID_MARKETS = Object.keys(NC_MARKETS) as MarketKey[];

function marketFilter(market?: string) {
  if (!market || market === "all") return undefined;
  return eq(zoningAgendaItems.market, market);
}

export function registerMarketIntelligenceRoutes(app: Express) {

  // ── Summary counts per market ──────────────────────────────────────────────
  app.get("/api/market-intelligence/summary", isAuthenticated, async (req, res) => {
    try {
      const summary: Record<string, any> = {};
      for (const market of VALID_MARKETS) {
        const [zoning, listings, permits, news] = await Promise.all([
          db.select().from(zoningAgendaItems).where(eq(zoningAgendaItems.market, market)),
          db.select().from(marketListings).where(eq(marketListings.market, market)),
          db.select().from(permitSignals).where(eq(permitSignals.market, market)),
          db.select().from(marketNewsItems).where(eq(marketNewsItems.market, market)),
        ]);
        summary[market] = {
          zoningCount: zoning.length,
          listingsCount: listings.length,
          permitsCount: permits.length,
          newsCount: news.length,
          unreadNews: news.filter((n) => !n.isRead).length,
        };
      }
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Market config (zoning URLs, permit portals) ────────────────────────────
  app.get("/api/market-intelligence/config", isAuthenticated, async (_req, res) => {
    res.json(NC_MARKETS);
  });

  // ── ZONING AGENDAS ─────────────────────────────────────────────────────────

  app.get("/api/market-intelligence/zoning", isAuthenticated, async (req, res) => {
    try {
      const { market } = req.query as { market?: string };
      const items = await db
        .select()
        .from(zoningAgendaItems)
        .where(market && market !== "all" ? eq(zoningAgendaItems.market, market) : undefined)
        .orderBy(desc(zoningAgendaItems.createdAt))
        .limit(200);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger AI fetch from municipal URLs for a market
  app.post("/api/market-intelligence/zoning/fetch", isAuthenticated, async (req, res) => {
    try {
      const { market } = req.body as { market: MarketKey };
      if (!VALID_MARKETS.includes(market)) return res.status(400).json({ error: "Invalid market" });

      const result = await fetchAndParseZoningPage(market);
      const message = result.saved > 0
        ? `Found ${result.saved} zoning case${result.saved !== 1 ? "s" : ""} from news sources`
        : result.errors.length > 0
          ? result.errors[0]
          : "No zoning cases found — try pasting an agenda directly";
      res.json({ saved: result.saved, message, errors: result.errors });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Upload + AI-parse a zoning agenda PDF text
  app.post(
    "/api/market-intelligence/zoning/upload",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const { market, rawText } = req.body;
        if (!VALID_MARKETS.includes(market)) return res.status(400).json({ error: "Invalid market" });

        let textToProcess = rawText || "";

        if (req.file) {
          if (req.file.mimetype === "application/pdf") {
            const pdfParse = (await import("pdf-parse")).default;
            const data = await pdfParse(req.file.buffer);
            textToProcess = data.text;
          } else if (req.file.mimetype.includes("text")) {
            textToProcess = req.file.buffer.toString("utf-8");
          }
        }

        if (!textToProcess || textToProcess.length < 50) {
          return res.status(400).json({ error: "No text content to process" });
        }

        const saved = await parseZoningText(market as MarketKey, textToProcess, req.body.sourceUrl);
        res.json({ saved, message: `Extracted ${saved} agenda items from uploaded content` });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete("/api/market-intelligence/zoning/:id", isAuthenticated, async (req, res) => {
    try {
      await db.delete(zoningAgendaItems).where(eq(zoningAgendaItems.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── LISTINGS ───────────────────────────────────────────────────────────────

  app.get("/api/market-intelligence/listings", isAuthenticated, async (req, res) => {
    try {
      const { market } = req.query as { market?: string };
      const items = await db
        .select()
        .from(marketListings)
        .where(market && market !== "all" ? eq(marketListings.market, market) : undefined)
        .orderBy(desc(marketListings.fetchedAt))
        .limit(200);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/market-intelligence/listings/refresh", isAuthenticated, async (req, res) => {
    try {
      const { market } = req.body as { market: MarketKey };
      if (!VALID_MARKETS.includes(market)) return res.status(400).json({ error: "Invalid market" });
      const result = await fetchLoopNetListings(market);
      const message = result.saved > 0
        ? `Found ${result.saved} land listing${result.saved !== 1 ? "s" : ""} for ${NC_MARKETS[market].displayName}`
        : result.error || "No listings returned from LoopNet for this market";
      res.json({ saved: result.saved, message });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/market-intelligence/listings/:id", isAuthenticated, async (req, res) => {
    try {
      await db.delete(marketListings).where(eq(marketListings.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PERMITS ────────────────────────────────────────────────────────────────

  app.get("/api/market-intelligence/permits", isAuthenticated, async (req, res) => {
    try {
      const { market } = req.query as { market?: string };
      const items = await db
        .select()
        .from(permitSignals)
        .where(market && market !== "all" ? eq(permitSignals.market, market) : undefined)
        .orderBy(desc(permitSignals.flaggedAt))
        .limit(200);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Upload permit CSV/Excel
  app.post(
    "/api/market-intelligence/permits/upload",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const { market } = req.body;
        if (!VALID_MARKETS.includes(market)) return res.status(400).json({ error: "Invalid market" });
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        let rows: any[] = [];

        if (req.file.originalname?.endsWith(".csv") || req.file.mimetype === "text/csv") {
          const text = req.file.buffer.toString("utf-8");
          const lines = text.split("\n").filter((l) => l.trim());
          if (lines.length < 2) return res.status(400).json({ error: "CSV has no data rows" });
          const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
          rows = lines.slice(1).map((line) => {
            const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
            const obj: any = {};
            headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
            return obj;
          });
        } else {
          const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(sheet);
        }

        const saved = await processPermitRows(market as MarketKey, rows, req.file.originalname);
        res.json({ saved, message: `Flagged ${saved} permit signals from ${rows.length} rows` });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  app.delete("/api/market-intelligence/permits/:id", isAuthenticated, async (req, res) => {
    try {
      await db.delete(permitSignals).where(eq(permitSignals.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── NEWS ───────────────────────────────────────────────────────────────────

  app.get("/api/market-intelligence/news", isAuthenticated, async (req, res) => {
    try {
      const { market } = req.query as { market?: string };
      const items = await db
        .select()
        .from(marketNewsItems)
        .where(market && market !== "all" ? eq(marketNewsItems.market, market) : undefined)
        .orderBy(desc(marketNewsItems.fetchedAt))
        .limit(200);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/market-intelligence/news/refresh", isAuthenticated, async (req, res) => {
    try {
      const { market } = req.body as { market: MarketKey };
      if (!VALID_MARKETS.includes(market)) return res.status(400).json({ error: "Invalid market" });
      const result = await fetchAndScoreMarketNews(market);
      const message = result.saved > 0
        ? `Found ${result.saved} relevant news item${result.saved !== 1 ? "s" : ""} for ${NC_MARKETS[market].displayName}`
        : result.error || "No relevant news found for this market right now";
      res.json({ saved: result.saved, message });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/market-intelligence/news/:id/read", isAuthenticated, async (req, res) => {
    try {
      await db
        .update(marketNewsItems)
        .set({ isRead: true })
        .where(eq(marketNewsItems.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/market-intelligence/news/:id", isAuthenticated, async (req, res) => {
    try {
      await db.delete(marketNewsItems).where(eq(marketNewsItems.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── OPPORTUNITY FINDER ──────────────────────────────────────────────────────

  // GET saved opportunities
  app.get("/api/market-intelligence/opportunities", isAuthenticated, async (req, res) => {
    try {
      const { market } = req.query;
      const conditions = [eq(marketOpportunities.isArchived, false)];
      if (market && market !== "all") {
        conditions.push(eq(marketOpportunities.market, market as string));
      }
      const rows = await db
        .select()
        .from(marketOpportunities)
        .where(and(...conditions))
        .orderBy(desc(marketOpportunities.addedAt))
        .limit(200);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST search county GIS for long-held non-developer parcels
  app.post("/api/market-intelligence/opportunities/search", isAuthenticated, async (req, res) => {
    try {
      const { market, minAcres, maxAcres, minYears, onlyTargetOwners, save } = req.body;
      if (!market || !VALID_MARKETS.includes(market)) {
        return res.status(400).json({ error: "Valid market required" });
      }

      const filters: OpportunitySearchFilters = {
        minAcres: parseFloat(minAcres) || 2,
        maxAcres: maxAcres ? parseFloat(maxAcres) : undefined,
        minYears: parseFloat(minYears) || 5,
        onlyTargetOwners: onlyTargetOwners !== false,
        limit: 75,
      };

      const result = await searchCountyParcels(market as MarketKey, filters);

      if (result.error) {
        return res.json({ results: [], total: 0, warning: result.error });
      }

      // Optionally save to DB
      if (save && result.results.length > 0) {
        for (const p of result.results) {
          try {
            await db.insert(marketOpportunities).values({
              market,
              address: p.address || null,
              latitude: p.latitude ? String(p.latitude) : null,
              longitude: p.longitude ? String(p.longitude) : null,
              parcelId: p.parcelId || null,
              ownerName: p.ownerName || null,
              ownerType: p.ownerType || null,
              lastSaleDate: p.lastSaleDate || null,
              yearsHeld: p.yearsHeld ? String(p.yearsHeld) : null,
              acreage: p.acreage ? String(p.acreage) : null,
              currentZoning: p.currentZoning || null,
              landUse: p.landUse || null,
              assessedValue: p.assessedValue || null,
              source: p.source || "county_gis",
            }).onConflictDoNothing();
          } catch { /* skip duplicates */ }
        }
      }

      res.json({
        results: result.results,
        total: result.total,
        warning: result.warning,
        message: result.total > 0
          ? `Found ${result.total} qualifying parcels`
          : (result.warning || "No parcels matched the criteria"),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST batch screen a list of addresses
  app.post("/api/market-intelligence/opportunities/screen", isAuthenticated, async (req, res) => {
    try {
      const { market, addresses, minYears } = req.body;
      if (!market || !VALID_MARKETS.includes(market)) {
        return res.status(400).json({ error: "Valid market required" });
      }
      if (!Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({ error: "addresses array required" });
      }

      const result = await screenAddressBatch(market as MarketKey, addresses, parseFloat(minYears) || 5);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST save a single opportunity (from search results)
  app.post("/api/market-intelligence/opportunities", isAuthenticated, async (req, res) => {
    try {
      const { market, address, ownerName, ownerType, lastSaleDate, yearsHeld,
        acreage, currentZoning, assessedValue, parcelId, latitude, longitude,
        landUse, notes, source } = req.body;
      if (!market) return res.status(400).json({ error: "market required" });

      const [row] = await db.insert(marketOpportunities).values({
        market,
        address: address || null,
        parcelId: parcelId || null,
        ownerName: ownerName || null,
        ownerType: ownerType || null,
        lastSaleDate: lastSaleDate || null,
        yearsHeld: yearsHeld ? String(yearsHeld) : null,
        acreage: acreage ? String(acreage) : null,
        currentZoning: currentZoning || null,
        landUse: landUse || null,
        assessedValue: assessedValue || null,
        latitude: latitude ? String(latitude) : null,
        longitude: longitude ? String(longitude) : null,
        notes: notes || null,
        source: source || "manual",
      }).returning();

      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH archive/unarchive
  app.patch("/api/market-intelligence/opportunities/:id/archive", isAuthenticated, async (req, res) => {
    try {
      const { archived } = req.body;
      await db
        .update(marketOpportunities)
        .set({ isArchived: archived !== false })
        .where(eq(marketOpportunities.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  app.delete("/api/market-intelligence/opportunities/:id", isAuthenticated, async (req, res) => {
    try {
      await db.delete(marketOpportunities).where(eq(marketOpportunities.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

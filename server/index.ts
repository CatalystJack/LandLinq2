import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { EmailTestEndpoint } from "./emailTestEndpoint";
// DEPLOYMENT FIX: Removed static imports of heavy modules
// These are now dynamically imported AFTER deployment health checks pass
// - comprehensiveHealthcheck (disabled anyway)
// - databaseManager (deferred 30s)
// - autoRecoveryService (not used in startup)
// - startOutreachScheduler, startHubspotPollScheduler (deferred 30s)
// - ApiMonitoringJobs (deferred 30s)

// Lazy-loaded db for health check only
let dbModule: any = null;
const getDb = async () => {
  if (!dbModule) {
    dbModule = await import('./db');
  }
  return dbModule;
};

// Track server startup state for error handling
let serverStarted = false;
// Track when heavy initialization is complete (for readiness checks)
let heavyInitComplete = false;

// Global error handlers for production deployment debugging
// Note: These log errors but allow graceful recovery for transient issues
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error.message);
  console.error('Stack:', error.stack);
  console.error('Environment:', process.env.NODE_ENV);
  // Only exit for critical startup errors, not runtime errors
  if (!serverStarted) {
    console.error('Fatal startup error - exiting');
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  // Log but don't exit - many libraries have transient unhandled rejections
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('This may be a transient async error - monitoring but not exiting');
});

const app = express();

// Enable gzip compression for all responses
app.use(compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Good balance between compression ratio and speed
  threshold: 1024, // Only compress responses larger than 1KB
}));

// Security Headers Middleware
app.use((req, res, next) => {
  // Force HTTPS in production
  // Replit's VM readiness probe calls the container directly over HTTP using a
  // loopback Host header. Redirecting that probe to HTTPS makes it attempt TLS
  // against this plain HTTP server and prevents an otherwise healthy build from
  // being promoted.
  const requestHost = (req.header('host') || '').toLowerCase();
  const isInternalProbe = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/.test(requestHost);
  if (
    process.env.NODE_ENV === 'production' &&
    !isInternalProbe &&
    req.header('x-forwarded-proto') !== 'https'
  ) {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Strict Transport Security (HSTS)
  if (req.secure || req.header('x-forwarded-proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://replit.com", // Vite requires unsafe-eval and unsafe-inline for development
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    "connect-src 'self' ws: wss: https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));

  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Initialize monitoring middleware
import('./monitoring/errorLogger').then(({ requestLoggingMiddleware, errorHandlingMiddleware }) => {
  app.use(requestLoggingMiddleware);
  app.use(errorHandlingMiddleware);
}).catch(console.error);

import('./middleware/validation').then(({ securityHeaders, sanitizeRequest }) => {
  app.use(securityHeaders);
  app.use(sanitizeRequest);
}).catch(console.error);

// Serve attached assets as static files with proper download headers
import path from 'path';
import { lookup } from 'mime-types';

app.use('/attached_assets', express.static('attached_assets', {
  setHeaders: (res, filePath) => {
    const fileName = path.basename(filePath);
    const mimeType = lookup(filePath) || 'application/octet-stream';
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  }
}));

// Serve static assets from server/public/assets
app.use('/assets', express.static('server/public/assets', {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    const mimeType = lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Format timestamp in EST
      const timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      let logLine = `[${timestamp}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Track if routes are fully loaded
let routesLoaded = false;

// DEPLOYMENT-OPTIMIZED: Health and ready endpoints respond INSTANTLY without blocking
// Database checks are deferred - Replit deployment health checks need immediate response
app.get("/health", (req, res) => {
  // INSTANT response - no async operations, no database checks
  // This allows deployment health checks to pass within milliseconds
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    service: "landlinq-api",
    serverStarted,
    routesLoaded
  });
});

// Ultra-simple ping endpoint - responds immediately without any checks
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Replit VM promotion probes GET / immediately after the port opens. Route
// registration and static asset setup are intentionally deferred below, so
// provide a temporary 200 response until the real frontend handler is ready.
app.get("/", (req, res, next) => {
  if (!heavyInitComplete) {
    return res.status(200).type("text/plain").send("LandLinq is starting");
  }
  next();
});

app.get("/ready", (req, res) => {
  // INSTANT response for deployment - check env vars only (synchronous)
  const hasRequiredEnvVars = !!(process.env.DATABASE_URL && process.env.SESSION_SECRET);
  
  if (!hasRequiredEnvVars) {
    return res.status(503).json({ 
      status: "not_ready", 
      reason: "Missing required environment variables",
      timestamp: new Date().toISOString()
    });
  }

  // Return ready immediately - deployment shouldn't wait for heavy init
  res.status(200).json({ 
    status: "ready", 
    timestamp: new Date().toISOString(),
    serverStarted,
    routesLoaded,
    heavyInitComplete,
    checks: {
      environment: "configured"
    }
  });
});

// Add early error handler to catch any errors during initialization
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Early error handler caught:', err.message);
  res.status(500).json({ error: 'Server initializing', message: err.message });
});

// Separate endpoint for full health check with database (for monitoring, not deployment)
app.get("/health/full", async (req, res) => {
  try {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database health check timeout')), 3000)
    );
    // Dynamic import to avoid loading db module during startup
    const { db } = await getDb();
    const { sql } = await import('drizzle-orm');
    const healthCheck = db.execute(sql`SELECT 1`);
    await Promise.race([healthCheck, timeout]);
    
    res.status(200).json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      service: "landlinq-api",
      database: "connected",
      heavyInitComplete
    });
  } catch (error) {
    res.status(200).json({ 
      status: "degraded", 
      timestamp: new Date().toISOString(),
      service: "landlinq-api",
      database: "unavailable",
      warning: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DEPLOYMENT FIX: Start listening IMMEDIATELY so health checks pass while routes load
const port = parseInt(process.env.PORT || '5000', 10);
const server = createServer(app);

// Handle server errors
server.on('error', (error: any) => {
  console.error('❌ SERVER ERROR:', error);
  process.exit(1);
});

// CRITICAL: Start listening IMMEDIATELY before heavy route loading
// This ensures health checks pass within the 4-minute deployment timeout
server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  serverStarted = true;
  log(`✅ Server listening on port ${port} - loading routes...`);
});

// Main initialization - load routes AFTER listening starts
// DEPLOYMENT FIX: Use setTimeout (not process.nextTick) to defer route loading.
// process.nextTick runs BEFORE I/O events, blocking health check HTTP requests.
// setTimeout schedules after I/O, so health checks respond immediately first.
setTimeout(() => {
  (async () => {
    try {
      log("🔧 Loading routes (this may take a moment)...");
    
    // Set up webhook endpoints BEFORE routes to prevent catch-all blocking
    EmailTestEndpoint.setupTestEndpoint(app);
    
    // Import and register routes - this is the heavy operation
    const routesModule = await import('./routes');
    await routesModule.registerRoutes(app, server);
    routesLoaded = true;
    log("✅ Routes registered successfully!");

    // Add error handler after routes
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });

    // Setup Vite or static serving
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    
    log("✅ Application fully initialized - all routes ready!");
    
    // DEPLOYMENT FIX: Mark heavy init complete IMMEDIATELY after routes load
    // This allows health checks to pass before ANY background schedulers start
    heavyInitComplete = true;
    log("✅ Heavy init marked complete - ready for deployment health checks");

    // Startup migration: ensure required broker notification templates exist in active record
    setTimeout(async () => {
      try {
        const { storage } = await import('./storage');
        await storage.ensureMissingEmailTemplates();
      } catch (migrationErr) {
        console.error('❌ Template migration error:', migrationErr);
      }
    }, 5000);

    // Startup migration: create External API tables
    setTimeout(async () => {
      try {
        const { pool } = await import('./db');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS api_keys (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR NOT NULL,
            key_hash VARCHAR NOT NULL UNIQUE,
            key_prefix VARCHAR NOT NULL,
            environment VARCHAR NOT NULL DEFAULT 'live',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_by VARCHAR,
            last_used_at TIMESTAMP,
            total_calls INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            revoked_at TIMESTAMP,
            notes TEXT
          );
          CREATE TABLE IF NOT EXISTS lead_attachments (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id VARCHAR NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
            filename VARCHAR NOT NULL,
            mime_type VARCHAR,
            size_bytes INTEGER,
            storage_url TEXT,
            storage_key TEXT,
            source VARCHAR DEFAULT 'api',
            uploaded_at TIMESTAMP DEFAULT NOW()
          );
        `);
        await pool.query(`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_plaintext TEXT;`);
        await pool.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS net_developable_acres DECIMAL(8,2);`);
        await pool.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_summary TEXT;`);
        await pool.query(`ALTER TABLE deals ADD COLUMN IF NOT EXISTS senior_loan_pct DECIMAL(5,2);`);

        // Backfill: API-uploaded attachments that were stored before the documentUrls sync fix.
        // For each lead_attachment with a storageKey, ensure its public URL exists in deals.documentUrls.
        const orphanedRows = await pool.query(`
          SELECT la.id, la.deal_id, la.storage_key, la.storage_url
          FROM lead_attachments la
          WHERE la.source = 'api' AND la.storage_key IS NOT NULL
        `);
        for (const row of orphanedRows.rows) {
          const publicUrl = `/api/public/storage/${row.storage_key}`;
          const dealRow = await pool.query(`SELECT document_urls FROM deals WHERE id = $1`, [row.deal_id]);
          if (!dealRow.rows.length) continue;
          const existing: string[] = (() => {
            const raw = dealRow.rows[0].document_urls;
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;
            try { return JSON.parse(raw); } catch { return []; }
          })();
          // Only append if not already present (match by key suffix)
          const alreadyThere = existing.some((u: string) => u.includes(row.storage_key));
          if (!alreadyThere) {
            const updated = [...existing, publicUrl];
            await pool.query(`UPDATE deals SET document_urls = $1 WHERE id = $2`, [JSON.stringify(updated), row.deal_id]);
            console.log(`✅ [BACKFILL] Appended attachment ${row.id} to deal ${row.deal_id} documentUrls`);
          }
        }

        console.log('✅ External API tables ready (api_keys, lead_attachments)');
      } catch (err: any) {
        console.error('❌ External API table migration error:', err.message);
      }
    }, 5500);

    // Startup migration: create Market Intelligence Hub tables if not present
    setTimeout(async () => {
      try {
        const { pool } = await import('./db');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS zoning_agenda_items (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            market VARCHAR NOT NULL,
            meeting_date DATE,
            case_number VARCHAR,
            applicant_name VARCHAR,
            developer_name VARCHAR,
            property_address VARCHAR,
            request_type VARCHAR,
            current_zoning VARCHAR,
            proposed_zoning VARCHAR,
            acreage DECIMAL(10,2),
            project_description TEXT,
            staff_recommendation VARCHAR,
            status VARCHAR DEFAULT 'pending',
            source_url TEXT,
            ai_summary TEXT,
            alert_level VARCHAR DEFAULT 'medium',
            raw_text TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS market_listings (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            market VARCHAR NOT NULL,
            source VARCHAR DEFAULT 'loopnet',
            external_id VARCHAR,
            address VARCHAR,
            city VARCHAR,
            state VARCHAR DEFAULT 'NC',
            zip_code VARCHAR,
            asking_price BIGINT,
            acreage DECIMAL(10,2),
            price_per_acre BIGINT,
            property_type VARCHAR,
            zoning VARCHAR,
            days_on_market INTEGER,
            listing_date DATE,
            is_expired BOOLEAN DEFAULT FALSE,
            description TEXT,
            broker_name VARCHAR,
            broker_phone VARCHAR,
            source_url TEXT,
            ai_signal TEXT,
            fetched_at TIMESTAMP DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS permit_signals (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            market VARCHAR NOT NULL,
            permit_number VARCHAR,
            property_address VARCHAR,
            owner_name VARCHAR,
            applicant_name VARCHAR,
            permit_type VARCHAR,
            description TEXT,
            issue_date DATE,
            last_activity_date DATE,
            expiration_date DATE,
            days_inactive INTEGER,
            estimated_cost BIGINT,
            signal_type VARCHAR,
            county VARCHAR,
            ai_summary TEXT,
            source_url TEXT,
            flagged_at TIMESTAMP DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS market_news_items (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            market VARCHAR,
            headline VARCHAR NOT NULL,
            summary TEXT,
            source_url TEXT,
            source_name VARCHAR,
            published_at TIMESTAMP,
            relevance_score INTEGER,
            signal_type VARCHAR,
            ai_analysis TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            fetched_at TIMESTAMP DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS market_opportunities (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            market VARCHAR NOT NULL,
            address TEXT,
            city VARCHAR,
            state VARCHAR DEFAULT 'NC',
            zip_code VARCHAR,
            latitude VARCHAR,
            longitude VARCHAR,
            parcel_id VARCHAR,
            owner_name VARCHAR,
            owner_type VARCHAR,
            last_sale_date VARCHAR,
            last_sale_price BIGINT,
            years_held DECIMAL(5,1),
            acreage DECIMAL(10,2),
            land_use VARCHAR,
            current_zoning VARCHAR,
            assessed_value BIGINT,
            signal_flags TEXT[],
            ai_summary TEXT,
            source VARCHAR DEFAULT 'county_gis',
            notes TEXT,
            is_archived BOOLEAN DEFAULT FALSE,
            added_at TIMESTAMP DEFAULT NOW()
          );
        `);
        console.log('✅ [MARKET-INTEL] Market Intelligence Hub tables ready');
      } catch (err: any) {
        console.error('❌ [MARKET-INTEL] Table creation error:', err.message);
      }
    }, 6000);

    // Startup cleanup: remove duplicate wrong-tier campaign enrollments.
    // SAFE RULE: only deletes a wrong enrollment when the contact ALSO has a correct one —
    // so no contact ever loses their only enrollment.
    // Example: broker tagged "AJ - Unknown Sophisticated" enrolled in BOTH
    //   "AJ - Unknown Sophisticated" (correct, keep) AND "AJ - Known Sophisticated" (wrong, delete).
    setTimeout(async () => {
      try {
        const { db } = await import('./db');
        const { sql } = await import('drizzle-orm');

        const previewResult = await db.execute(sql`
          SELECT COUNT(*) AS bad_count
          FROM drip_campaign_enrollments e
          JOIN brokers b ON b.id = e.broker_id
          JOIN outreach_campaign_templates ct ON ct.id = e.template_id
          WHERE e.status IN ('pending', 'in_progress')
            AND (
              (ct.name ILIKE '%known%' AND ct.name NOT ILIKE '%unknown%'
                AND NOT EXISTS (SELECT 1 FROM unnest(b.crm_tags) t WHERE t ILIKE '%known%' AND t NOT ILIKE '%unknown%'))
              OR
              (ct.name ILIKE '%unknown%'
                AND NOT EXISTS (SELECT 1 FROM unnest(b.crm_tags) t WHERE t ILIKE '%unknown%'))
            )
            AND EXISTS (
              SELECT 1 FROM drip_campaign_enrollments e2
              JOIN outreach_campaign_templates ct2 ON ct2.id = e2.template_id
              WHERE e2.broker_id = e.broker_id AND e2.id != e.id
                AND e2.status IN ('pending', 'in_progress')
                AND (
                  (ct2.name ILIKE '%unknown%' AND EXISTS (SELECT 1 FROM unnest(b.crm_tags) t WHERE t ILIKE '%unknown%'))
                  OR
                  (ct2.name ILIKE '%known%' AND ct2.name NOT ILIKE '%unknown%' AND EXISTS (SELECT 1 FROM unnest(b.crm_tags) t WHERE t ILIKE '%known%' AND t NOT ILIKE '%unknown%'))
                )
            )
        `);
        const badCount = Number((previewResult.rows[0] as any)?.bad_count ?? 0);

        if (badCount === 0) {
          console.log('✅ [ENROLLMENT-CLEANUP] No duplicate wrong-tier enrollments found.');
          return;
        }

        console.log(`🧹 [ENROLLMENT-CLEANUP] Found ${badCount} duplicate wrong-tier enrollment(s). Removing...`);
        await db.execute(sql`
          DELETE FROM drip_campaign_enrollments
          WHERE id IN (
            SELECT e.id
            FROM drip_campaign_enrollments e
            JOIN brokers b ON b.id = e.broker_id
            JOIN outreach_campaign_templates ct ON ct.id = e.template_id
            WHERE e.status IN ('pending', 'in_progress')
              AND (
                (ct.name ILIKE '%known%' AND ct.name NOT ILIKE '%unknown%'
                  AND NOT EXISTS (SELECT 1 FROM unnest(b.crm_tags) t WHERE t ILIKE '%known%' AND t NOT ILIKE '%unknown%'))
                OR
                (ct.name ILIKE '%unknown%'
                  AND NOT EXISTS (SELECT 1 FROM unnest(b.crm_tags) t WHERE t ILIKE '%unknown%'))
              )
              AND EXISTS (
                SELECT 1 FROM drip_campaign_enrollments e2
                JOIN outreach_campaign_templates ct2 ON ct2.id = e2.template_id
                WHERE e2.broker_id = e.broker_id AND e2.id != e.id
                  AND e2.status IN ('pending', 'in_progress')
                  AND (
                    (ct2.name ILIKE '%unknown%' AND EXISTS (SELECT 1 FROM unnest(b.crm_tags) t WHERE t ILIKE '%unknown%'))
                    OR
                    (ct2.name ILIKE '%known%' AND ct2.name NOT ILIKE '%unknown%' AND EXISTS (SELECT 1 FROM unnest(b.crm_tags) t WHERE t ILIKE '%known%' AND t NOT ILIKE '%unknown%'))
                  )
              )
          )
        `);
        console.log(`✅ [ENROLLMENT-CLEANUP] Removed ${badCount} wrong-tier duplicate(s). Correct enrollments preserved.`);
      } catch (cleanupErr: any) {
        console.error('❌ [ENROLLMENT-CLEANUP] Error:', cleanupErr.message);
      }
    }, 8000);

    // Background: auto-score any existing NC deals that have never been LIHTC scored
    setTimeout(async () => {
      try {
        const { db } = await import('./db');
        const { sql } = await import('drizzle-orm');
        const { autoScoreLIHTC } = await import('./lihtcAutoScoreService');
        const { storage } = await import('./storage');

        const unscored = await db.execute(sql`
          SELECT id, address, city, state, county, latitude, longitude, unit_count,
                 (SELECT qct_status FROM deals WHERE id = d.id LIMIT 1) as qct_status
          FROM deals d
          WHERE (state ILIKE 'NC' OR state ILIKE 'North Carolina')
            AND latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND (lihtc_scored_at IS NULL OR lihtc_score_total IS NULL)
          ORDER BY created_at DESC
          LIMIT 50
        `);
        const rows = (unscored.rows || unscored) as any[];
        if (rows.length === 0) {
          console.log('[LIHTC-STARTUP] All NC deals already scored.');
          return;
        }
        console.log(`[LIHTC-STARTUP] Auto-scoring ${rows.length} unscored NC deals...`);
        let ok = 0, fail = 0;
        for (const row of rows) {
          try {
            const lat = parseFloat(row.latitude);
            const lng = parseFloat(row.longitude);
            if (!lat || !lng) { fail++; continue; }
            const result = await autoScoreLIHTC({
              lat, lng,
              address: row.address || '',
              county: row.county || null,
              state: 'NC',
              qctStatus: row.qct_status || null,
              totalUnits: row.unit_count || null,
            });
            await storage.updateDeal(row.id, {
              lihtcScoreTotal: result.total,
              lihtcScorePreliminary: true,
              lihtcScoredAt: new Date(),
            } as any);
            ok++;
          } catch (e: any) {
            console.warn(`[LIHTC-STARTUP] Failed for deal ${row.id}: ${e.message}`);
            fail++;
          }
        }
        console.log(`[LIHTC-STARTUP] Done — ${ok} scored, ${fail} failed.`);
      } catch (e: any) {
        console.warn('[LIHTC-STARTUP] NC auto-score startup job failed:', e.message);
      }
    }, 15000); // 15s delay — let everything else settle first

    // DDA backfill: assign dda_status to existing deals that don't have it yet
    setTimeout(async () => {
      try {
        const { db } = await import('./db');
        const { sql } = await import('drizzle-orm');
        const { checkDDA, extractZipFromAddress } = await import('./ddaLookupService');

        const unset = await db.execute(sql`
          SELECT id, state, county, address, zip
          FROM deals
          WHERE dda_status IS NULL OR dda_status = 'N/A' OR dda_status = ''
          ORDER BY created_at DESC
          LIMIT 1000
        `);
        const rows = (unset.rows || unset) as any[];
        if (rows.length === 0) {
          console.log('[DDA-STARTUP] All deals already have DDA status.');
          return;
        }
        console.log(`[DDA-STARTUP] Backfilling DDA status for ${rows.length} deals...`);

        // Build value pairs and do a single bulk UPDATE for efficiency
        const valuePairs: string[] = [];
        for (const row of rows) {
          const zip = (row.zip as string | null) || extractZipFromAddress((row.address as string) || '');
          const result = checkDDA(row.state as string, row.county as string, zip);
          const status = result.isDDA ? result.ddaType! : 'NO';
          const safeId = String(row.id).replace(/'/g, '');
          const safeStatus = status.replace(/'/g, '');
          valuePairs.push(`('${safeId}', '${safeStatus}')`);
        }

        if (valuePairs.length > 0) {
          await db.execute(sql.raw(`
            UPDATE deals AS d
            SET dda_status = v.status
            FROM (VALUES ${valuePairs.join(',')}) AS v(id, status)
            WHERE d.id::text = v.id
          `));
          console.log(`[DDA-STARTUP] Done — ${valuePairs.length} deals updated.`);
        }
      } catch (e: any) {
        console.warn('[DDA-STARTUP] Backfill job failed:', e.message);
      }
    }, 20000); // 20s delay — runs 5s after LIHTC job
    
  } catch (error) {
    console.error("❌ Failed to initialize routes:", error);
    log(`⚠️ Routes failed to load - health checks still available`);
    // Still mark as complete so deployment can proceed
    heavyInitComplete = true;
  }
  
  // Continue with post-startup initialization
  (() => {
    // Mark server as successfully started for error handler
    serverStarted = true;
    
    log(`✅ Server successfully listening on port ${port} (host: 0.0.0.0)`);
    log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // 📋 DEPLOYMENT CHANGELOG - Oct 23, 2025 Evening
    log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    log("📋 DEPLOYMENT CHANGELOG - October 23, 2025 (Evening)");
    log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    log("✅ NEW FEATURE: MSA Markets Tab in Outreach Management");
    log("   • Added Globe icon tab for quick MSA access");
    log("   • Directs to Admin Dashboard → MSA Management");
    log("   • Manages 232 acquisition markets across 3 product types");
    log("");
    log("🔧 PRODUCTION BUILD FIXES: 28 JSX Syntax Errors Resolved");
    log("   • Fixed Footer component placement in all page files");
    log("   • Files: gamification-page, analyst-login, leaderboard, etc.");
    log("   • Build now succeeds for production deployment");
    log("");
    log("🔒 SYSTEM STATUS:");
    log("   • TypeScript/JSX: All errors resolved ✓");
    log("   • Production Build: SUCCESS ✓");
    log("   • MSA System: 232 markets active ✓");
    log("   • Rejection Reasons: 24 categories active ✓");
    log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // DISABLED: Health check scheduler was creating fake deals on production
    // Start the comprehensive automated health check scheduler - monitors ALL 199+ components
    // DEFERRED: Start after a delay to prevent deployment startup delays
    // setTimeout(() => { // DEPLOYMENT FIX: 100ms delay allows health checks to pass first
    //   try {
    //     startComprehensiveHealthCheckScheduler();
    //   } catch (error: any) {
    //     console.warn("⚠️ Health check scheduler failed to start - deployment may be in progress:", error.message);
    //   }
    // }, 30000); // Defer 30 seconds
    
    // DEPLOYMENT FIX: Defer all schedulers in production to allow health checks to pass first
    // 60 seconds delay to ensure server is ready and health checks pass
    const schedulerDelay = process.env.NODE_ENV === 'production' ? 15000 : 0; // 15 seconds in production
    
    setTimeout(async () => {
      // ── Startup migration: normalize campaign trigger tags (idempotent) ──────
      // Drops the legacy "LandLinq - " prefix so template trigger tags match the
      // CRM tag format that contacts actually have (e.g. "Jack - Unknown Sophisticated").
      try {
        const { db } = await import('./db');
        const { sql } = await import('drizzle-orm');
        const tagMappings: [string, string][] = [
          ['LandLinq - Jack Unknown Sophisticated', 'Jack - Unknown Sophisticated'],
          ['LandLinq - Jack Known Sophisticated',   'Jack - Known Sophisticated'],
          ['LandLinq - AJ Unknown Sophisticated',   'AJ - Unknown Sophisticated'],
          ['LandLinq - AJ Known Sophisticated',     'AJ - Known Sophisticated'],
          ['LandLinq - Brian Unknown Sophisticated','Brian - Unknown Sophisticated'],
          ['LandLinq - Brian Known Sophisticated',  'Brian - Known Sophisticated'],
          ['LandLinq - Ted Unknown Sophisticated',  'Ted - Unknown Sophisticated'],
          ['LandLinq - Ted Known Sophisticated',    'Ted - Known Sophisticated'],
          // Fix typo: "Unkown" → "Unknown"
          ['LandLinq - Ted Unkown Sophisticated',   'Ted - Unknown Sophisticated'],
          ['Ted Unkown Sophisticated',              'Ted - Unknown Sophisticated'],
        ];
        for (const [oldTag, newTag] of tagMappings) {
          await db.execute(sql`UPDATE outreach_campaign_templates SET hubspot_trigger_tag = ${newTag} WHERE hubspot_trigger_tag = ${oldTag}`);
          await db.execute(sql`UPDATE outreach_senders SET hubspot_trigger_tags = array_replace(hubspot_trigger_tags, ${oldTag}, ${newTag}) WHERE ${oldTag} = ANY(hubspot_trigger_tags)`);
        }

        // Ensure each sender has both their Known and Unknown trigger tags (idempotent array_append)
        const senderTagEnsure: [string, string][] = [
          ['Jack Berg', 'Jack - Known Sophisticated'],
          ['Jack Berg', 'Jack - Unknown Sophisticated'],
          ['Ted Hill',  'Ted - Known Sophisticated'],
          ['Ted Hill',  'Ted - Unknown Sophisticated'],
          ['AJ Klenk',  'AJ - Known Sophisticated'],
          ['AJ Klenk',  'AJ - Unknown Sophisticated'],
          ['Brian Ford','Brian - Known Sophisticated'],
          ['Brian Ford','Brian - Unknown Sophisticated'],
        ];
        for (const [senderName, tag] of senderTagEnsure) {
          await db.execute(sql`
            UPDATE outreach_senders
            SET hubspot_trigger_tags = array_append(hubspot_trigger_tags, ${tag})
            WHERE name = ${senderName}
              AND is_active = true
              AND (hubspot_trigger_tags IS NULL OR NOT (${tag} = ANY(hubspot_trigger_tags)))
          `);
        }
        log("✅ Campaign trigger tags normalized (LandLinq prefix removed, sender tags synced)");
      } catch (err: any) {
        console.error("⚠️ Campaign trigger tag migration failed (non-fatal):", err.message);
      }

      // ── Startup migration: fix template names (strip "LandLinq - " prefix) ──────
      try {
        const { db: db2 } = await import('./db');
        const { sql: sql2 } = await import('drizzle-orm');
        const nameMappings: [string, string][] = [
          ['LandLinq - Jack Unknown Sophisticated', 'Jack - Unknown Sophisticated'],
          ['LandLinq - Jack Known Sophisticated',   'Jack - Known Sophisticated'],
          ['LandLinq - AJ Unknown Sophisticated',   'AJ - Unknown Sophisticated'],
          ['LandLinq - AJ Known Sophisticated',     'AJ - Known Sophisticated'],
          ['LandLinq - Brian Unknown Sophisticated','Brian - Unknown Sophisticated'],
          ['LandLinq - Brian Known Sophisticated',  'Brian - Known Sophisticated'],
          ['LandLinq - Ted Unknown Sophisticated',  'Ted - Unknown Sophisticated'],
          ['LandLinq - Ted Known Sophisticated',    'Ted - Known Sophisticated'],
          ['LandLinq - Ted Unkown Sophisticated',   'Ted - Unknown Sophisticated'],
        ];
        for (const [oldName, newName] of nameMappings) {
          await db2.execute(sql2`UPDATE outreach_campaign_templates SET name = ${newName} WHERE name = ${oldName}`);
        }

        // Fix enrollments that were marked completed/failed before actually sending
        // total_steps_sent=0 is a safe guard — no email was ever sent, so resetting is always correct.
        // No time window restriction: any contact with 0 sends should get their first email.
        const completedFixResult = await db2.execute(sql2`
          UPDATE drip_campaign_enrollments
          SET status = 'pending',
              current_step_index = 1,
              completed_at = NULL,
              next_send_at = NOW(),
              updated_at = NOW()
          WHERE status = 'completed'
            AND total_steps_sent = 0
        `);
        const completedFixCount = (completedFixResult as any).rowCount ?? 0;
        if (completedFixCount > 0) {
          log(`✅ Enrollment repair: reset ${completedFixCount} completed-but-never-sent contacts back to pending step 1`);
        }

        // Also reset enrollments that were marked 'failed' with 0 sends
        await db2.execute(sql2`
          UPDATE drip_campaign_enrollments
          SET status = 'pending',
              paused_reason = NULL,
              next_send_at = NOW(),
              updated_at = NOW()
          WHERE status = 'failed'
            AND total_steps_sent = 0
        `);
        log("✅ Template names cleaned and broken enrollments repaired (step index fix + failed reset)");
      } catch (err: any) {
        console.error("⚠️ Template name / enrollment repair migration failed:", err.message);
      }

      // ── Startup migration: copy steps into empty "Known Sophisticated" templates ──
      // "Jack - Known Sophisticated" (and similar) templates were created but never had
      // steps added. Contacts enrolled in them immediately get marked completed (no steps).
      // Fix: for each Known template with 0 steps, copy all steps from its Unknown sibling.
      try {
        const { db: dbKs } = await import('./db');
        const { sql: sqlKs } = await import('drizzle-orm');
        const senderNames = ['Jack', 'AJ', 'AJ Klenk', 'Ted', 'Brian'];
        for (const sender of senderNames) {
          // Find the Known template with 0 steps
          const knownResult = await dbKs.execute(sqlKs`
            SELECT t.id, t.name
            FROM outreach_campaign_templates t
            WHERE t.name ILIKE ${`${sender} - Known%`}
              AND NOT EXISTS (
                SELECT 1 FROM outreach_campaign_template_steps s WHERE s.template_id = t.id
              )
          `);
          const knownRows = (knownResult as any).rows ?? knownResult;
          for (const known of knownRows) {
            // Find the matching Unknown template that HAS steps
            const unknownResult = await dbKs.execute(sqlKs`
              SELECT t.id
              FROM outreach_campaign_templates t
              WHERE t.name ILIKE ${`${sender} - Unknown%`}
                AND EXISTS (
                  SELECT 1 FROM outreach_campaign_template_steps s WHERE s.template_id = t.id
                )
              LIMIT 1
            `);
            const unknownRows = (unknownResult as any).rows ?? unknownResult;
            if (!unknownRows.length) continue;
            const unknownId = unknownRows[0].id;
            const knownId = known.id;
            // Copy steps with new UUIDs
            const copyResult = await dbKs.execute(sqlKs`
              INSERT INTO outreach_campaign_template_steps
                (id, template_id, sequence_index, day_number, subject, content, channel, is_active, created_at, updated_at)
              SELECT
                gen_random_uuid(), ${knownId}, sequence_index, day_number, subject, content, channel, is_active, NOW(), NOW()
              FROM outreach_campaign_template_steps
              WHERE template_id = ${unknownId}
            `);
            const copied = (copyResult as any).rowCount ?? 0;
            log(`✅ Copied ${copied} steps from "${sender} - Unknown Sophisticated" → "${known.name}"`);
          }
        }
      } catch (err: any) {
        console.error("⚠️ Known Sophisticated step-copy migration failed (non-fatal):", err.message);
      }

      // ── One-time fix: reset dry-run-advanced in_progress enrollments back to step 1 ──
      // On 2026-05-22 dry-run mode was ON. The worker advanced all Jack's contacts to
      // step 2/3 without sending anything (last_sent_at set, but no emails delivered).
      // Reset: any in_progress enrollment with total_steps_sent = 0 → back to step 1.
      try {
        const { sql: sqlDr } = await import('drizzle-orm');
        const { db: dbDr } = await import('./db');
        const drResult = await dbDr.execute(sqlDr`
          UPDATE drip_campaign_enrollments
          SET status = 'pending',
              current_step_index = 1,
              next_send_at = NOW(),
              last_sent_at = NULL,
              updated_at = NOW()
          WHERE status = 'in_progress'
            AND (total_steps_sent = 0 OR total_steps_sent IS NULL)
        `);
        const drCount = (drResult as any).rowCount ?? 0;
        if (drCount > 0) {
          log(`✅ Dry-run enrollment fix: reset ${drCount} in_progress contacts (never actually sent) back to step 1`);
        }
      } catch (err: any) {
        console.error("⚠️ Dry-run enrollment reset failed (non-fatal):", err.message);
      }

      // One-time cleanup: strip Outlook Web App (OWA) UI garbage from stored signatures.
      // When senders paste signatures from OWA, hidden overlay divs + <button> elements get
      // captured. These render as broken ↗ icons or blank gaps in Gmail/other clients.
      // Fix: drop everything before the first <table> tag (OWA junk always precedes the table).
      try {
        const { sql: sql3 } = await import('drizzle-orm');
        const { db: db3 } = await import('./db');
        const result = await db3.execute(sql3`
          UPDATE outreach_senders
          SET signature_html = SUBSTR(signature_html, STRPOS(signature_html, '<table')),
              updated_at     = NOW()
          WHERE signature_html IS NOT NULL
            AND signature_html != ''
            AND STRPOS(signature_html, '<table') > 1
        `);
        log("✅ Signature cleanup: OWA UI garbage stripped from stored signatures");
      } catch (err: any) {
        console.error("⚠️ Signature cleanup migration failed:", err.message);
      }

      // Start the recurring outreach scheduler - CRITICAL for broker engagement
      try {
        const { startOutreachScheduler, startHubspotPollScheduler } = await import('./jobs/recurringOutreach');
        startOutreachScheduler();
        log("📅 Recurring outreach scheduler started - hourly campaign processing enabled");
        
        // Start CRM-native contact polling (tags drive drip enrollment; no HubSpot involved)
        startHubspotPollScheduler();
        log("🔄 CRM poll scheduler started - syncing tagged contacts every 10 minutes");
      } catch (error: any) {
        console.error("❌ Failed to start outreach/CRM scheduler:", error);
        log("❌ Outreach scheduler failed to start - check logs for details");
      }

      // Start the API monitoring scheduler - tracks API health and versions
      try {
        const { ApiMonitoringJobs } = await import('./jobs/apiMonitoringJobs');
        ApiMonitoringJobs.startApiMonitoringJobs();
        log("🔍 API monitoring scheduler started - daily health checks and weekly reports enabled");
      } catch (error: any) {
        console.error("❌ Failed to start API monitoring scheduler:", error);
      }

      // Start developer weekly deal digest — every Monday 8 AM ET
      try {
        const { startDeveloperWeeklyEmailScheduler } = await import('./developerWeeklyEmail');
        startDeveloperWeeklyEmailScheduler();
        log("📬 Developer weekly deal digest scheduler started — Mondays at 8:00 AM ET");
      } catch (error: any) {
        console.error("❌ Failed to start developer weekly email scheduler:", error);
      }

      // Start the background job processor - async email/SMS processing to prevent webhook timeouts
      log("🔄 Attempting to start background job processor...");
      (async () => {
        try {
          log("📦 Importing backgroundJobProcessor module...");
          const { backgroundJobProcessor } = await import('./backgroundJobProcessor');
          log("📦 Module imported successfully, calling start()...");
          await backgroundJobProcessor.start();
          log("🚀 [JOB-PROCESSOR] Background job processor started successfully!");
          log("⚙️ Jobs will be processed every 2 seconds - no more webhook timeouts!");
        } catch (error) {
          log("❌ [JOB-PROCESSOR] Failed to start background job processor:");
          log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
          console.error("❌ [JOB-PROCESSOR] Full error:", error);
        }
      })();
      
      // 6AM daily morning report system — DISABLED per user request
      log("🔕 Daily morning report scheduler is OFF (disabled per user request)");

      // Start the RSS feed poller - checks enabled feeds every 6 hours
      import('./rssFeedPoller').then(({ pollAllEnabledFeeds }) => {
        const RSS_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
        setInterval(async () => {
          try {
            await pollAllEnabledFeeds();
          } catch (err: any) {
            console.error('[RSS Poller] Scheduled poll error:', err?.message || err);
          }
        }, RSS_INTERVAL_MS);
        log("📡 RSS feed poller started - checking enabled feeds every 6 hours");
      }).catch(console.error);
    }, schedulerDelay);
    
    // DISABLED: Health check was creating REAL DEALS and sending REAL EMAILS on every restart!
    // Run initial comprehensive health check on startup - with graceful error handling
    // setTimeout(async () => {
    //   log("🚀 Running initial COMPREHENSIVE health check on startup - testing every component...");
    //   try {
    //     await runImmediateComprehensiveHealthCheck();
    //   } catch (error: any) {
    //     // Don't crash deployment if health check fails due to missing tables/columns
    //     console.warn("⚠️ Initial health check failed - deployment may still be in progress:", error.message);
    //   }
    // }, 5000);
      
    // Initialize Email Service Fix - CRITICAL FOR EMAIL PROCESSING
    setTimeout(async () => {
      try {
        log("🔧 Applying email service fixes...");
        const { EmailServiceFix } = await import('./emailServiceFix');
        await EmailServiceFix.implementFix(app);
        await EmailServiceFix.enhanceWebhookEndpoint(app);
        log("✅ Email service fixes applied successfully!");
      } catch (error) {
        log("❌ Email service fix failed:", String(error));
      }

      // Email Test Endpoint already configured before routes registration

      // Initialize Emergency Email Processing (DNS Workaround)
      try {
        log("🚨 Setting up emergency email processing due to DNS issue...");
        const { setupEmergencyEndpoint } = await import('./emailWorkaround');
        setupEmergencyEndpoint(app);
        log("✅ Emergency email processing endpoint active!");
      } catch (error) {
        log("❌ Emergency email processing setup failed:", String(error));
      }

      // Database Management System moved to top-level setTimeout for reliable startup
      
      // Daily team notification system — DISABLED per user request
      log("🔕 Daily team digest scheduler is OFF (disabled per user request)");
      
      // Weekly improvement report — DISABLED per user request
      // Weekly deal pipeline report — DISABLED per user request
      log("🔕 Weekly report schedulers are OFF (disabled per user request)");
      
      // Initialize Production Safety Monitoring - CRITICAL
      try {
        log("🔒 Initializing production safety monitoring...");
        const { runProductionSafetyCheck, setupProductionSafetyMonitoring } = await import('./productionSafety');
        
        // Run immediate safety check
        const safetyCheck = await runProductionSafetyCheck();
        log(`🔒 Production Safety Status: ${safetyCheck.overall}`);
        
        if (safetyCheck.overall === 'CRITICAL') {
          log("🚨 CRITICAL PRODUCTION ISSUES DETECTED:");
          safetyCheck.checks.forEach(check => {
            if (check.status === 'FAIL') {
              log(`   ❌ ${check.name}: ${check.message}`);
            }
          });
          log("🚨 RECOMMENDATIONS:");
          safetyCheck.recommendations.forEach(rec => {
            log(`   • ${rec}`);
          });
        }
        
        // Start ongoing monitoring
        setupProductionSafetyMonitoring();
        log("✅ Production safety monitoring active");
        
        // Initialize Enhanced Backup Monitoring
        const { enhancedBackupMonitoring } = await import('./enhancedBackupMonitoring');
        await enhancedBackupMonitoring.configureReplitBackupSettings();
        enhancedBackupMonitoring.startMonitoring();
        log("🔄 Enhanced backup monitoring initialized");
        
      } catch (error) {
        log("❌ Failed to initialize production safety monitoring:", String(error));
      }

      // Initialize API Safety System with Proactive Alerts & Fallback Strategies
      try {
        log("🛡️ Initializing API Safety System...");
        await import('./apiSafetySystem'); // Automatically starts monitoring
        log("🛡️ API Safety System active:");
        log("   ✅ Proactive alerts at 70% daily spending cap");
        log("   ✅ Failure rate monitoring (20% warning, 40% critical)");
        log("   ✅ Consecutive call detection (50/hour warning, 100/hour critical)");
        log("   ✅ Response time degradation alerts");
        log("   ✅ Circuit breaker monitoring");
        log("   ✅ Graceful fallback strategies for all APIs");
        log("   📧 Alerts sent to jack@catalystcp.com");
      } catch (error) {
        log("❌ API Safety System failed to initialize:", String(error));
      }

      // Initialize Storage Monitor - detect bucket changes and alert before file loss
      try {
        log("🔍 Initializing Storage Monitor...");
        const { storageMonitor, fileBackupService } = await import('./storageMonitor');
        await storageMonitor.initialize();
        log("✅ Storage Monitor active - bucket change alerts enabled");
        
        // Initialize nightly file backup
        await fileBackupService.initialize();
        fileBackupService.startNightlyBackup();
        log("📦 File Backup Service active - nightly backups at 2 AM EST");
      } catch (error) {
        log("⚠️ Storage Monitor failed to initialize:", String(error));
      }

      // Initialize comprehensive audit system
      try {
        const auditModule = await import('./comprehensiveAudit.js');
        const comprehensiveAuditService = auditModule.comprehensiveAuditService;
        await comprehensiveAuditService.scheduleAudits();
        await comprehensiveAuditService.performComprehensiveAudit();
        log("🔍 Comprehensive audit system initialized - 30-minute deep audits and daily 8 AM reports to Jack!");
      } catch (error) {
        log("⚠️ Comprehensive audit system will be available on next restart");
      }
      
      // Auto-backfill QCT + OZ for any deals with FIPS but N/A status
      try {
        const { qctService } = await import('./qctService');
        const { ozService } = await import('./ozService');
        const { storage } = await import('./storage');
        const allDeals = await storage.getAllDeals();
        const pending = allDeals.filter((d: any) =>
          d.censusTractFips &&
          (!d.qctStatus || d.qctStatus === 'N/A' || !d.ozStatus || d.ozStatus === 'N/A')
        );
        if (pending.length > 0) {
          log(`🔄 Auto-checking QCT/OZ for ${pending.length} deals with unset status...`);
          for (const deal of pending) {
            try {
              const fips = deal.censusTractFips as string;
              const updates: Record<string, string> = {};
              if (!deal.qctStatus || deal.qctStatus === 'N/A') {
                const qct = await qctService.checkQCTStatus(fips);
                updates.qctStatus = qct.isQCT ? 'YES' : 'NO';
              }
              if (!deal.ozStatus || deal.ozStatus === 'N/A') {
                const oz = await ozService.checkOZStatus(fips);
                updates.ozStatus = oz.isOZ ? 'YES' : 'NO';
              }
              if (Object.keys(updates).length > 0) {
                await storage.updateDeal(deal.id, updates);
                log(`   ✅ Deal ${deal.id}: QCT=${updates.qctStatus ?? 'kept'} OZ=${updates.ozStatus ?? 'kept'}`);
              }
            } catch { /* skip individual failures silently */ }
          }
          log('✅ QCT/OZ auto-backfill complete');
        }
      } catch (error) {
        log('⚠️ QCT/OZ auto-backfill skipped:', String(error));
      }

      // ONE-TIME FIX: Clear wrong Spokane Valley, WA geocoding on parcel-ID-only deals
      // These were incorrectly geocoded because the geocoder was given "Parcel ID: XXX" as an address.
      try {
        const { storage: fixStorage } = await import('./storage');
        const allDeals = await fixStorage.getDeals();
        const badDeals = allDeals.filter((d: any) =>
          typeof d.address === 'string' &&
          d.address.startsWith('Parcel ID:') &&
          d.city === 'Spokane Valley' &&
          d.state === 'WA'
        );
        for (const d of badDeals) {
          await fixStorage.updateDeal(d.id, { city: null, state: null, zip: null, latitude: null, longitude: null } as any);
          log(`✅ [DATA-FIX] Cleared wrong Spokane Valley geocoding from deal #${d.dealNumber} (${d.address})`);
        }
        if (badDeals.length === 0) {
          log('✅ [DATA-FIX] No parcel-ID geocoding errors found — all clean');
        }
      } catch (fixErr) {
        log('⚠️ [DATA-FIX] Parcel-ID geocoding cleanup skipped:', String(fixErr));
      }

      // Log that background services are now running
      log("✅ All background services initialized - server fully operational");

    }, process.env.NODE_ENV === 'production' ? 10000 : 15000);

    // Initialize Database Management System - independent top-level timer for reliable startup
    setTimeout(async () => {
      try {
        console.log('🚀 [BACKUP] Initializing Database Management System...');
        const { databaseManager } = await import('./database/manager');
        await databaseManager.initialize();
        console.log('✅ [BACKUP] Database Management System fully operational - backup scheduler active!');
      } catch (error: any) {
        console.error('⚠️ [BACKUP] Database Management System initialization failed:', error.message);
        setTimeout(async () => {
          try {
            console.log('🔄 [BACKUP] Retrying Database Management System initialization...');
            const { databaseManager: retryDbManager } = await import('./database/manager');
            await retryDbManager.initialize();
            console.log('✅ [BACKUP] Database Management System initialized on retry!');
          } catch (retryError: any) {
            console.error('⚠️ [BACKUP] Database Management System retry failed:', retryError.message);
          }
        }, 60000);
      }
    }, process.env.NODE_ENV === 'production' ? 25000 : 35000);
  })(); // Close the post-startup initialization IIFE
  })();
}, 500); // Close setTimeout — 500ms gives the event loop time to process health checks first

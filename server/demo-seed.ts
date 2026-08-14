/**
 * Demo data seed.
 *
 * Exports `ensureDemoData()` — idempotent, safe to call on every demo login.
 * Also runnable as a standalone script: npx tsx server/demo-seed.ts
 */

import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Ensure all demo data exists. Safe to call multiple times — uses
 * ON CONFLICT / existence checks to avoid duplicates.
 *
 * @param client - a node-postgres Client or PoolClient
 */
export async function ensureDemoData(client: any): Promise<string> {
  // ── Schema prep ──────────────────────────────────────────────────────────
  await client.query(`
    ALTER TABLE outreach_campaigns
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE
  `);

  // ── Demo user ────────────────────────────────────────────────────────────
  const pwHash = await hashPassword("demo-access-2026");
  const { rows: uRows } = await client.query(
    `INSERT INTO users (email, password, role, first_name, last_name, deal_role, created_at, updated_at)
     VALUES ($1, $2, 'user', 'Demo', 'User', 'analyst', NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
     RETURNING id`,
    ["demo@catalystcp.com", pwHash]
  );
  const demoUserId = uRows[0].id as string;

  // ── Check if data already exists (idempotent guard) ──────────────────────
  const { rows: existingBrokers } = await client.query(
    `SELECT id FROM brokers WHERE user_id = $1 LIMIT 1`,
    [demoUserId]
  );
  if (existingBrokers.length > 0) {
    // Data already seeded — just return the user ID
    return demoUserId;
  }

  console.log("🌱 Seeding demo data for first-time demo login…");

  // ── Clear any leftover demo campaigns/runs ───────────────────────────────
  await client.query(`
    DELETE FROM outreach_runs
     WHERE campaign_id IN (
       SELECT id FROM outreach_campaigns WHERE is_demo = true
     )
  `);
  await client.query(`DELETE FROM outreach_campaigns WHERE is_demo = true`);

  // ── Demo brokers ─────────────────────────────────────────────────────────
  const brokerRows = [
    {
      first: "Marcus", last: "Webb", email: "mwebb@trianglere.com",
      phone: "(919) 555-0142", brokerage: "Triangle Real Estate Group",
      markets: ["Raleigh", "Durham"], sms: true,
      tags: ["Top Producer", "Multifamily"], assigned: "Sarah K.",
      notes: "Prefers early morning calls. Focus on affordable multifamily. Has a pipeline of 3-4 deals expected Q3.",
    },
    {
      first: "Tamara", last: "Okafor", email: "tokafor@cltsouth.com",
      phone: "(704) 555-0287", brokerage: "CLT South Advisors",
      markets: ["Charlotte", "Concord"], sms: true,
      tags: ["High Volume", "QCT Specialist"], assigned: "James L.",
      notes: "Sends 2-3 deals per month. Very responsive via SMS. Best source for South End and NoDa properties.",
    },
    {
      first: "Derek", last: "Pham", email: "dpham@apexcre.com",
      phone: "(919) 555-0364", brokerage: "Apex Commercial RE",
      markets: ["Apex", "Cary"], sms: false,
      tags: ["Affordable Housing"], assigned: "Sarah K.",
      notes: "Only responds to email. Specializes in affordable / LIHTC plays in western Wake County.",
    },
    {
      first: "Brittany", last: "Simmons", email: "bsimmons@asheville-prop.com",
      phone: "(828) 555-0511", brokerage: "Asheville Property Partners",
      markets: ["Asheville"], sms: true,
      tags: ["OZ Deals", "Mountain Markets"], assigned: "James L.",
      notes: "OZ-focused. Strong relationships with Mountain market landowners. Reliable and quick to respond.",
    },
    {
      first: "James", last: "Holloway", email: "jholloway@piedmont-land.com",
      phone: "(336) 555-0198", brokerage: "Piedmont Land & Dev",
      markets: ["Winston-Salem", "High Point"], sms: true,
      tags: ["New Broker"], assigned: "Sarah K.",
      notes: "Referred by Marcus Webb. First deal submitted. Very eager. Send deal criteria PDF.",
    },
    {
      first: "Carla", last: "Nguyen", email: "cnguyen@wilm-commercial.com",
      phone: "(910) 555-0322", brokerage: "Wilmington Commercial",
      markets: ["Wilmington"], sms: false,
      tags: ["Coastal Markets"], assigned: "James L.",
      notes: "Coastal market specialist. Submitted Port City deal. Follow up on OZ equity interest.",
    },
    {
      first: "Robert", last: "Eaton", email: "reaton@durhamland.com",
      phone: "(919) 555-0477", brokerage: "Durham Land Co.",
      markets: ["Durham"], sms: true,
      tags: ["BTR", "Multifamily"], assigned: "Sarah K.",
      notes: "BTR SFR specialist in Durham. Knows every large-lot owner in the county.",
    },
    {
      first: "Yvonne", last: "Castillo", email: "ycastillo@concord-re.com",
      phone: "(704) 555-0633", brokerage: "Concord Realty Group",
      markets: ["Concord", "Charlotte"], sms: true,
      tags: ["High Volume", "Affordable Housing"], assigned: "James L.",
      notes: "One of our most active brokers. Fast turnaround. Strong affordable pipeline from Cabarrus County.",
    },
    {
      first: "Paul", last: "Merritt", email: "pmerritt@nclandbrokers.com",
      phone: "(919) 555-0819", brokerage: "NC Land Brokers",
      markets: ["Raleigh", "Durham", "Chapel Hill"], sms: false,
      tags: ["Land Only"], assigned: "Sarah K.",
      notes: "Primarily land disposition. Not focused on multifamily but has a few sites that could work.",
    },
    {
      first: "Gwendolyn", last: "Marsh", email: "gmarsh@trianglere.com",
      phone: "(919) 555-0256", brokerage: "Triangle Real Estate Group",
      markets: ["Raleigh"], sms: true,
      tags: ["Inactive"], assigned: "James L.",
      notes: "No response in 90+ days. Keep on monthly email; remove from SMS if no response after next send.",
    },
  ];

  const brokerIds: string[] = [];
  for (const b of brokerRows) {
    const { rows } = await client.query(
      `INSERT INTO brokers
         (user_id, first_name, last_name, email, phone, brokerage,
          markets_covered, sms_opt_in, is_active, crm_tags, crm_notes,
          assigned_to, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
       RETURNING id`,
      [
        demoUserId, b.first, b.last, b.email, b.phone, b.brokerage,
        b.markets.join(", "), b.sms, b.first !== "Gwendolyn",
        b.tags,
        b.notes, b.assigned,
      ]
    );
    brokerIds.push(rows[0].id);
  }

  const [marcus, tamara, derek, brittany, james, carla, robert, yvonne, , ] = brokerIds;

  // ── Demo deals ───────────────────────────────────────────────────────────
  const dealRows = [
    {
      brokerId: tamara, address: "1847 Parkway Dr", city: "Charlotte", state: "NC",
      acres: "12.4", price: "2800000", units: 85, yoc: "9.1%",
      products: ["3-Story Surface Park"],
      qct: "YES", dda: "MDDA", oz: "NO", lihtc: 72,
      status: "accepted", classification: "high_priority", priority: "high",
      step: "Letter of Intent",
      reason: "Strong QCT/DDA overlap with 9.1% YOC exceeds our 8.5% floor. Comparable rents in South End support $1.42/PSF. 85-unit count hits 80-unit minimum. LIHTC score of 72 is competitive for the 2026 QAP. Recommend proceeding to LOI.",
      comps: [
        { propertyName: "Parkway Commons", city: "Charlotte", unitCount: 96, yearBuilt: 2021, rentPerUnit: 1180, rentPSF: 1.44, distance: "0.4 mi" },
        { propertyName: "South End Flats", city: "Charlotte", unitCount: 72, yearBuilt: 2019, rentPerUnit: 1145, rentPSF: 1.39, distance: "0.9 mi" },
      ],
    },
    {
      brokerId: marcus, address: "324 Commerce Blvd", city: "Raleigh", state: "NC",
      acres: "6.8", price: "1900000", units: 72, yoc: "8.7%",
      products: ["Affordable"],
      qct: "YES", dda: "MDDA", oz: "YES", lihtc: 81,
      status: "accepted", classification: "high_priority", priority: "high",
      step: "Due Diligence",
      reason: "Triple-overlay (QCT + DDA + OZ) site with 81 LIHTC points — highest scored deal this quarter. 8.7% YOC at current rents with upside as area median income grows. OZ deferral adds meaningful equity yield. Accelerate to due diligence.",
      comps: [
        { propertyName: "Midtown Affordable", city: "Raleigh", unitCount: 80, yearBuilt: 2020, rentPerUnit: 1090, rentPSF: 1.31, distance: "0.6 mi" },
        { propertyName: "Commerce Place", city: "Raleigh", unitCount: 64, yearBuilt: 2018, rentPerUnit: 1060, rentPSF: 1.28, distance: "1.2 mi" },
      ],
    },
    {
      brokerId: robert, address: "5012 Industrial Way", city: "Durham", state: "NC",
      acres: "18.3", price: "4200000", units: 96, yoc: "7.8%",
      products: ["BTR SFR Detached"],
      qct: "NO", dda: "NO", oz: "NO", lihtc: null,
      status: "pending_review", classification: "potential", priority: "medium",
      step: "Initial Review",
      reason: "BTR SFR at 7.8% YOC falls below our 8.5% threshold on a non-QCT/DDA site. Lot premium is high for Durham submarket. Comparable detached SFR rents suggest limited upside. Flagged for senior review before passing — site has good bones if seller adjusts to $3.7M.",
      comps: [
        { propertyName: "Durham BTR Phase I", city: "Durham", unitCount: 88, yearBuilt: 2022, rentPerUnit: 1620, rentPSF: 1.08, distance: "1.1 mi" },
      ],
    },
    {
      brokerId: brittany, address: "881 Mountain View Rd", city: "Asheville", state: "NC",
      acres: "9.2", price: "1500000", units: 60, yoc: "9.8%",
      products: ["Garden Style"],
      qct: "YES", dda: "NO", oz: "YES", lihtc: 68,
      status: "accepted", classification: "high_priority", priority: "high",
      step: "Term Sheet",
      reason: "QCT + OZ combination with best-in-class 9.8% YOC. Mountain View micro-market has <3% rental vacancy. 60 units is on the smaller side but the OZ equity story more than compensates. LIHTC at 68 is borderline — recommend QAP consultant review before finalizing.",
      comps: [
        { propertyName: "Asheville Gardens", city: "Asheville", unitCount: 68, yearBuilt: 2020, rentPerUnit: 1240, rentPSF: 1.55, distance: "0.7 mi" },
        { propertyName: "Blue Ridge Flats", city: "Asheville", unitCount: 54, yearBuilt: 2021, rentPerUnit: 1265, rentPSF: 1.58, distance: "1.3 mi" },
      ],
    },
    {
      brokerId: derek, address: "2200 Cary Pkwy", city: "Cary", state: "NC",
      acres: "7.6", price: "2100000", units: 78, yoc: "8.2%",
      products: ["Mixed-Income"],
      qct: "NO", dda: "YES", oz: "NO", lihtc: 59,
      status: "rejected", classification: "clear_no", priority: "low",
      step: "Closed",
      reason: "DDA-only site with 8.2% YOC misses our combined 8.5% floor for non-QCT properties. Cary submarket rents have plateaued post-2024. LIHTC score of 59 is too low to be competitive in the 9% credit round. Clear pass unless seller drops to $1.75M.",
      rejection: "YOC below threshold on non-QCT site",
      comps: [
        { propertyName: "Cary Town Center Apts", city: "Cary", unitCount: 90, yearBuilt: 2021, rentPerUnit: 1380, rentPSF: 1.38, distance: "0.5 mi" },
      ],
    },
    {
      brokerId: yvonne, address: "710 Concord Mills Blvd", city: "Concord", state: "NC",
      acres: "14.1", price: "3000000", units: 110, yoc: "8.9%",
      products: ["Affordable"],
      qct: "YES", dda: "NO", oz: "NO", lihtc: 74,
      status: "accepted", classification: "high_priority", priority: "high",
      step: "Closing",
      reason: "110-unit QCT affordable deal at 8.9% YOC with strong LIHTC score. Concord is a growing submarket with tight affordable supply. This one checks every box — recommend expediting closing timeline.",
      comps: [
        { propertyName: "Concord Affordable Hsg", city: "Concord", unitCount: 120, yearBuilt: 2019, rentPerUnit: 985, rentPSF: 1.23, distance: "0.8 mi" },
        { propertyName: "Mills Park Residences", city: "Concord", unitCount: 96, yearBuilt: 2020, rentPerUnit: 1010, rentPSF: 1.26, distance: "1.0 mi" },
      ],
    },
    {
      brokerId: carla, address: "390 Port City Blvd", city: "Wilmington", state: "NC",
      acres: "11.0", price: "2400000", units: 80, yoc: "8.6%",
      products: ["3-Story Surface Park"],
      qct: "NO", dda: "NO", oz: "YES", lihtc: null,
      status: "pending_review", classification: "unclassified", priority: "medium",
      step: "Initial Review",
      reason: "OZ-only deal with solid 8.6% YOC. Wilmington coastal market is high-demand but non-QCT/DDA limits LIHTC competitiveness. Worth underwriting at current ask if OZ equity investors are in the capital stack. Waiting on market comp pull from HelloData.",
      comps: [],
    },
    {
      brokerId: derek, address: "1555 Apex Peakway", city: "Apex", state: "NC",
      acres: "5.4", price: "1200000", units: 52, yoc: "11.2%",
      products: ["Garden Style"],
      qct: "YES", dda: "YES", oz: "NO", lihtc: 77,
      status: "accepted", classification: "high_priority", priority: "high",
      step: "Due Diligence",
      reason: "Exceptional 11.2% YOC on a QCT+DDA site — highest YOC in current pipeline. Small at 52 units but the economics are outstanding. LIHTC 77 is strong. Apex submarket vacancy is sub-2%. Fast-track due diligence.",
      comps: [
        { propertyName: "Apex Commons", city: "Apex", unitCount: 60, yearBuilt: 2022, rentPerUnit: 1310, rentPSF: 1.64, distance: "0.3 mi" },
      ],
    },
    {
      brokerId: marcus, address: "2900 Western Blvd", city: "Raleigh", state: "NC",
      acres: "8.8", price: "1800000", units: 68, yoc: "7.2%",
      products: ["Affordable"],
      qct: "YES", dda: "NO", oz: "NO", lihtc: 55,
      status: "rejected", classification: "clear_no", priority: "low",
      step: "Closed",
      reason: "7.2% YOC is well below our 8.5% floor even with QCT status. LIHTC score of 55 would not be competitive in 4% or 9% round. Western Blvd corridor has seen cap rate compression — seller pricing reflects market froth. Hard pass.",
      rejection: "YOC too low; LIHTC score not competitive",
      comps: [
        { propertyName: "Western Village Apts", city: "Raleigh", unitCount: 76, yearBuilt: 2018, rentPerUnit: 1020, rentPSF: 1.28, distance: "0.9 mi" },
      ],
    },
    {
      brokerId: james, address: "4401 Liberty St", city: "Winston-Salem", state: "NC",
      acres: "10.5", price: "2000000", units: 76, yoc: null,
      products: ["Mixed-Income"],
      qct: null, dda: null, oz: null, lihtc: null,
      status: "pending_review", classification: "unclassified", priority: "medium",
      step: "Pending Classification",
      reason: null,
      comps: [],
    },
  ];

  for (const d of dealRows) {
    await client.query(
      `INSERT INTO deals
         (broker_id, address, city, state, size_acres, asking_price,
          unit_count, yield_on_cost, product_types,
          qct_status, dda_status, oz_status, lihtc_score_total,
          status, classification, priority, deal_step,
          analyst_notes, rejection_reason,
          comparables_json, submission_method,
          created_at, updated_at)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,
          $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,
          'form', NOW(), NOW())`,
      [
        d.brokerId, d.address, d.city, d.state,
        d.acres, d.price, d.units,
        d.yoc, JSON.stringify(d.products),
        d.qct, d.dda === true ? "MDDA" : d.dda === false ? "NO" : d.dda,
        d.oz, d.lihtc,
        d.status, d.classification, d.priority, d.step,
        d.reason, (d as any).rejection ?? null,
        JSON.stringify(d.comps),
      ]
    );
  }

  // ── Demo outreach campaigns ───────────────────────────────────────────────
  const campaignDefs = [
    {
      name: "Monthly Email Outreach",
      status: "active", schedule_week: "1st_monday", send_hour_utc: 14,
      channels: ["email"], email_template_key: "monthlyOutreachReminder",
      sms_template_key: "monthlyOutreachReminder",
      last_run_at: "2026-07-07 09:04:00",
      next_run_at: "2026-08-04 09:00:00",
    },
    {
      name: "Deal Opportunities Blast",
      status: "active", schedule_week: "3rd_monday", send_hour_utc: 15,
      channels: ["email", "sms"], email_template_key: "dealOpportunities",
      sms_template_key: "quickDealAlert",
      last_run_at: "2026-07-21 10:02:00",
      next_run_at: "2026-08-18 10:00:00",
    },
    {
      name: "SMS Quick Deal Alert",
      status: "active", schedule_week: "3rd_monday", send_hour_utc: 16,
      channels: ["sms"], email_template_key: "monthlyOutreachReminder",
      sms_template_key: "quickDealAlert",
      last_run_at: "2026-07-21 11:05:00",
      next_run_at: "2026-08-18 11:00:00",
    },
    {
      name: "Market Updates Newsletter",
      status: "paused", schedule_week: "1st_monday", send_hour_utc: 13,
      channels: ["email"], email_template_key: "marketUpdates",
      sms_template_key: "marketBrief",
      last_run_at: "2026-04-01 08:01:00",
      next_run_at: null,
    },
  ];

  const campaignIds: string[] = [];
  for (const c of campaignDefs) {
    const { rows } = await client.query(
      `INSERT INTO outreach_campaigns
         (name, status, cadence, schedule_week, send_hour_utc, channels,
          email_template_key, sms_template_key, broker_filter,
          is_demo, last_run_at, next_run_at, created_at, updated_at)
       VALUES ($1,$2,'monthly',$3,$4,$5::jsonb,$6,$7,'{}',true,$8,$9,NOW(),NOW())
       RETURNING id`,
      [
        c.name, c.status, c.schedule_week, c.send_hour_utc,
        JSON.stringify(c.channels), c.email_template_key, c.sms_template_key,
        c.last_run_at, c.next_run_at,
      ]
    );
    campaignIds.push(rows[0].id);
  }

  // ── Demo outreach runs ────────────────────────────────────────────────────
  const runDefs = [
    { cIdx: 0, started: "2026-07-07 09:04:00", completed: "2026-07-07 09:11:00", email: 201, sms: 0, fail: 3 },
    { cIdx: 1, started: "2026-07-21 10:02:00", completed: "2026-07-21 10:09:00", email: 118, sms: 61, fail: 1 },
    { cIdx: 2, started: "2026-07-21 11:05:00", completed: "2026-07-21 11:10:00", email: 0, sms: 160, fail: 4 },
    { cIdx: 0, started: "2026-06-02 09:01:00", completed: "2026-06-02 09:08:00", email: 198, sms: 0, fail: 2 },
    { cIdx: 1, started: "2026-06-16 10:00:00", completed: "2026-06-16 10:07:00", email: 114, sms: 58, fail: 0 },
  ];

  for (const r of runDefs) {
    await client.query(
      `INSERT INTO outreach_runs
         (campaign_id, started_at, completed_at, status,
          sent_email_count, sent_sms_count, failures_count, total_targets,
          created_at, updated_at)
       VALUES ($1,$2,$3,'completed',$4,$5,$6,$7,NOW(),NOW())`,
      [
        campaignIds[r.cIdx], r.started, r.completed,
        r.email, r.sms, r.fail, r.email + r.sms + r.fail,
      ]
    );
  }

  console.log(`✅ Demo seed complete — user ID: ${demoUserId}`);
  return demoUserId;
}

// ── Standalone script entry point ─────────────────────────────────────────────
if (process.argv[1] && process.argv[1].includes("demo-seed")) {
  import("pg").then(({ default: pg }) => {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    pool.connect().then(async (client) => {
      try {
        // Force re-seed by clearing brokers first
        const { rows } = await client.query(
          `SELECT id FROM users WHERE email = 'demo@catalystcp.com' LIMIT 1`
        );
        if (rows.length > 0) {
          const uid = rows[0].id;
          const { rows: bs } = await client.query(`SELECT id FROM brokers WHERE user_id = $1`, [uid]);
          if (bs.length > 0) {
            await client.query(`DELETE FROM deals WHERE broker_id = ANY($1::text[])`, [bs.map((b: any) => b.id)]);
            await client.query(`DELETE FROM brokers WHERE user_id = $1`, [uid]);
          }
          await client.query(`DELETE FROM outreach_runs WHERE campaign_id IN (SELECT id FROM outreach_campaigns WHERE is_demo = true)`);
          await client.query(`DELETE FROM outreach_campaigns WHERE is_demo = true`);
        }
        await ensureDemoData(client);
        console.log("🎉 Done");
      } finally {
        client.release();
        await pool.end();
      }
    });
  });
}

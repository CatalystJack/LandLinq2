import { neon } from "@neondatabase/serverless";

async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);
  const queries = [
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS score_neighborhood integer DEFAULT 0",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS score_primary_amenities integer DEFAULT 0",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS score_secondary_amenities integer DEFAULT 0",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS score_site_suitability integer DEFAULT 0",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS score_negative_points integer DEFAULT 0",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS score_income_rpp integer DEFAULT 0",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS score_transit integer DEFAULT 0",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS flood_zone_data jsonb",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS hazards_data jsonb",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS slope_data jsonb",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS transit_data jsonb",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS incompatible_uses_data jsonb",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS amenity_details jsonb",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS census_data jsonb",
    "ALTER TABLE site_evaluations ADD COLUMN IF NOT EXISTS market_insights jsonb",
  ];
  for (const q of queries) {
    await sql(q);
    console.log("✓", q.slice(0, 70));
  }
  console.log("Migration complete!");
}

migrate().catch(e => { console.error(e.message); process.exit(1); });

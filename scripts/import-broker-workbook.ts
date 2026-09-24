import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { parseBrokerWorkbookBuffer } from "../server/brokerWorkbookPromotion";

const { Pool } = pg;

const workbookPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve("attached_assets/NC_Active_Brokers_Tagged_Sep2026_(1)_1790108883653.xlsx");

async function main(): Promise<void> {
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Workbook not found: ${workbookPath}`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const workbook = parseBrokerWorkbookBuffer(workbookPath, fs.readFileSync(workbookPath));
  const rows = workbook.rows;
  if (rows.length === 0) throw new Error("No broker rows found in workbook");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE broker_workbook_import (
        source_license_number TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        brokerage TEXT,
        company TEXT,
        license_number TEXT NOT NULL,
        contact_county TEXT,
        contact_sector TEXT NOT NULL,
        contact_specialty TEXT,
        contact_confidence TEXT,
        state_region TEXT NOT NULL,
        markets_covered TEXT,
        source_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
      ) ON COMMIT DROP
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS brokers_shared_source_license_idx
      ON brokers(source_license_number)
      WHERE owner_developer_profile_id IS NULL AND source_license_number IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX broker_workbook_import_email_idx
      ON broker_workbook_import(email)
    `);

    // PostgreSQL limits a statement to 65,535 bind parameters. Keep each
    // insert below that ceiling while still avoiding one query per contact.
    for (let start = 0; start < rows.length; start += 3000) {
      const batch = rows.slice(start, start + 3000);
      const values: unknown[] = [];
      const placeholders = batch.map((row, index) => {
        const base = index * 15;
        values.push(
          row.sourceLicenseNumber,
          row.firstName,
          row.lastName,
          row.email,
          row.phone,
          row.brokerage,
          row.company,
          row.licenseNumber,
          row.county,
          row.sector,
          row.specialty,
          row.confidence,
          row.stateRegion,
          row.marketsCovered,
          row.sourceTags,
        );
        return `(${Array.from({ length: 15 }, (_, offset) => `$${base + offset + 1}`).join(",")})`;
      }).join(",");
      await client.query(`
        INSERT INTO broker_workbook_import
        (source_license_number, first_name, last_name, email, phone, brokerage, company,
         license_number, contact_county, contact_sector, contact_specialty,
         contact_confidence, state_region, markets_covered, source_tags)
        VALUES ${placeholders}
      `, values);
    }

    const updateByLicense = await client.query(`
      UPDATE brokers AS b
      SET first_name = i.first_name,
          last_name = i.last_name,
          email = COALESCE(i.email, b.email),
          phone = COALESCE(i.phone, b.phone),
          brokerage = COALESCE(i.brokerage, b.brokerage),
          company = COALESCE(i.company, b.company),
          license_number = i.license_number,
          contact_county = i.contact_county,
          contact_sector = i.contact_sector,
          contact_specialty = i.contact_specialty,
          contact_confidence = i.contact_confidence,
          source_license_number = i.source_license_number,
          state_region = i.state_region,
          markets_covered = COALESCE(i.markets_covered, b.markets_covered),
           source_tags = i.source_tags,
          updated_at = NOW()
      FROM broker_workbook_import AS i
      WHERE b.owner_developer_profile_id IS NULL
        AND b.source_license_number = i.source_license_number
        AND UPPER(i.state_region) = ANY(string_to_array(UPPER(COALESCE(b.state_region, '')), ', '))
    `);

    const updateByEmail = await client.query(`
      UPDATE brokers AS b
      SET first_name = i.first_name,
          last_name = i.last_name,
          email = COALESCE(i.email, b.email),
          phone = COALESCE(i.phone, b.phone),
          brokerage = COALESCE(i.brokerage, b.brokerage),
          company = COALESCE(i.company, b.company),
          license_number = i.license_number,
          contact_county = i.contact_county,
          contact_sector = i.contact_sector,
          contact_specialty = i.contact_specialty,
          contact_confidence = i.contact_confidence,
          source_license_number = COALESCE(b.source_license_number, i.source_license_number),
          state_region = CASE
            WHEN b.state_region IS NULL OR b.state_region = '' THEN i.state_region
            WHEN UPPER(i.state_region) = ANY(string_to_array(UPPER(b.state_region), ', ')) THEN b.state_region
            ELSE b.state_region || ', ' || i.state_region
          END,
          markets_covered = CASE
            WHEN b.markets_covered IS NULL OR b.markets_covered = '' THEN i.markets_covered
            WHEN i.markets_covered IS NULL OR i.markets_covered = '' THEN b.markets_covered
            ELSE b.markets_covered || ', ' || i.markets_covered
          END,
           source_tags = ARRAY(
             SELECT DISTINCT tag
             FROM unnest(COALESCE(b.source_tags, ARRAY[]::TEXT[]) || COALESCE(i.source_tags, ARRAY[]::TEXT[])) AS tag
             WHERE btrim(tag) <> ''
             ORDER BY tag
           ),
          updated_at = NOW()
      FROM broker_workbook_import AS i
      WHERE b.owner_developer_profile_id IS NULL
        AND b.email IS NOT NULL
        AND i.email IS NOT NULL
        AND LOWER(b.email) = LOWER(i.email)
        AND NOT EXISTS (
          SELECT 1
          FROM brokers AS same_license
          WHERE same_license.owner_developer_profile_id IS NULL
            AND same_license.source_license_number = i.source_license_number
            AND UPPER(i.state_region) = ANY(string_to_array(UPPER(COALESCE(same_license.state_region, '')), ', '))
        )
    `);

    const insertResult = await client.query(`
      INSERT INTO brokers (
        id, first_name, last_name, email, phone, brokerage, company, license_number,
        contact_county, contact_sector, contact_specialty, contact_confidence,
         source_license_number, state_region, markets_covered, source_tags, owner_developer_profile_id,
        is_active, created_at, updated_at
      )
      SELECT gen_random_uuid(), i.first_name, i.last_name, i.email, i.phone, i.brokerage, i.company,
             i.license_number, i.contact_county, i.contact_sector, i.contact_specialty,
             i.contact_confidence, i.source_license_number, i.state_region, i.markets_covered, i.source_tags,
             NULL, TRUE, NOW(), NOW()
      FROM broker_workbook_import AS i
      WHERE NOT EXISTS (
        SELECT 1 FROM brokers AS b
        WHERE b.owner_developer_profile_id IS NULL
          AND b.source_license_number = i.source_license_number
          AND UPPER(i.state_region) = ANY(string_to_array(UPPER(COALESCE(b.state_region, '')), ', '))
      )
      AND NOT EXISTS (
        SELECT 1 FROM brokers AS b
        WHERE b.owner_developer_profile_id IS NULL
          AND b.email IS NOT NULL
          AND i.email IS NOT NULL
          AND LOWER(b.email) = LOWER(i.email)
      )
    `);

    await client.query("COMMIT");
    console.log(JSON.stringify({
      workbook: workbookPath,
      workbookRows: rows.length,
      updatedByLicense: updateByLicense.rowCount ?? 0,
      updatedByEmail: updateByEmail.rowCount ?? 0,
      updated: (updateByLicense.rowCount ?? 0) + (updateByEmail.rowCount ?? 0),
      inserted: insertResult.rowCount ?? 0,
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
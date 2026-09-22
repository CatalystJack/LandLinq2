import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import XLSX from "xlsx";

const { Pool } = pg;

const workbookPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve("attached_assets/NC_Active_Brokers_Tagged_Sep2026_1790102977895.xlsx");

type ImportRow = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  company: string | null;
  licenseNumber: string;
  county: string | null;
  sector: "commercial" | "residential";
  specialty: string | null;
  confidence: string | null;
  sourceLicenseNumber: string;
  stateRegion: "NC";
  marketsCovered: string | null;
};

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result ? result : null;
}

function licenseValue(value: unknown): string | null {
  const result = clean(value);
  if (!result) return null;
  return result.replace(/\.0$/, "");
}

function normalizeEmail(value: unknown): string | null {
  const result = clean(value)?.toLowerCase() ?? null;
  return result && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : null;
}

function normalizePhone(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw;
}

function splitName(name: string | null, first: string | null, last: string | null): {
  firstName: string;
  lastName: string;
} {
  if (first && last) return { firstName: first, lastName: last };
  if (name?.includes(",")) {
    const [lastPart, firstPart] = name.split(",", 2).map((part) => part.trim());
    return {
      firstName: firstPart || "Unknown",
      lastName: lastPart || "Unknown",
    };
  }
  const parts = (name || "").split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || "Unknown",
    lastName: parts.join(" ") || "Unknown",
  };
}

function rowsFromSheet(sheet: XLSX.WorkSheet, sector: "commercial" | "residential"): ImportRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const imported: ImportRow[] = [];
  for (const row of rows) {
    const sourceLicenseNumber = licenseValue(row["License #"]);
    if (!sourceLicenseNumber) continue;
    const name = clean(row.Name);
    const { firstName, lastName } = splitName(name, clean(row["First Name"]), clean(row["Last Name"]));
    const firm = clean(row.Firm);
    const county = clean(row.County)?.toLowerCase() ?? null;
    imported.push({
      firstName,
      lastName,
      email: normalizeEmail(row.Email),
      phone: normalizePhone(row.Phone),
      brokerage: firm,
      company: firm,
      licenseNumber: sourceLicenseNumber,
      county,
      sector,
      specialty: clean(row.Specialty),
      confidence: clean(row.Confidence)?.toLowerCase() ?? null,
      sourceLicenseNumber,
      stateRegion: "NC",
      marketsCovered: county,
    });
  }
  return imported;
}

function dedupeRows(rows: ImportRow[]): ImportRow[] {
  const byLicense = new Map<string, ImportRow>();
  for (const row of rows) {
    const existing = byLicense.get(row.sourceLicenseNumber);
    if (!existing) {
      byLicense.set(row.sourceLicenseNumber, row);
      continue;
    }
    byLicense.set(row.sourceLicenseNumber, {
      ...existing,
      email: existing.email ?? row.email,
      phone: existing.phone ?? row.phone,
      brokerage: existing.brokerage ?? row.brokerage,
      company: existing.company ?? row.company,
      county: existing.county ?? row.county,
      marketsCovered: existing.marketsCovered ?? row.marketsCovered,
      specialty: existing.specialty ?? row.specialty,
      confidence: existing.confidence ?? row.confidence,
      sector: existing.sector === "commercial" || row.sector === "commercial"
        ? "commercial"
        : "residential",
    });
  }
  const byEmail = new Map<string, ImportRow>();
  const withoutEmail: ImportRow[] = [];
  for (const row of byLicense.values()) {
    if (!row.email) {
      withoutEmail.push(row);
      continue;
    }
    const existing = byEmail.get(row.email);
    if (!existing) {
      byEmail.set(row.email, row);
      continue;
    }
    const counties = new Set(
      [existing.marketsCovered, row.marketsCovered]
        .filter(Boolean)
        .flatMap((value) => String(value).split(",").map((item) => item.trim()))
        .filter(Boolean),
    );
    byEmail.set(row.email, {
      ...existing,
      sector: existing.sector === "commercial" || row.sector === "commercial"
        ? "commercial"
        : "residential",
      specialty: existing.specialty ?? row.specialty,
      confidence: existing.confidence ?? row.confidence,
      brokerage: existing.brokerage ?? row.brokerage,
      company: existing.company ?? row.company,
      phone: existing.phone ?? row.phone,
      county: existing.county ?? row.county,
      marketsCovered: counties.size ? [...counties].join(", ") : existing.marketsCovered,
    });
  }
  return [...withoutEmail, ...byEmail.values()];
}

async function main(): Promise<void> {
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Workbook not found: ${workbookPath}`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const workbook = XLSX.readFile(workbookPath, { cellDates: false, dense: true });
  const rows = dedupeRows([
    ...rowsFromSheet(workbook.Sheets.Commercial, "commercial"),
    ...rowsFromSheet(workbook.Sheets.Residential, "residential"),
    ...rowsFromSheet(workbook.Sheets["Firm Licenses"], "commercial"),
  ]);
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
        markets_covered TEXT
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
        const base = index * 14;
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
        );
        return `(${Array.from({ length: 14 }, (_, offset) => `$${base + offset + 1}`).join(",")})`;
      }).join(",");
      await client.query(`
        INSERT INTO broker_workbook_import
        (source_license_number, first_name, last_name, email, phone, brokerage, company,
         license_number, contact_county, contact_sector, contact_specialty,
         contact_confidence, state_region, markets_covered)
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
          updated_at = NOW()
      FROM broker_workbook_import AS i
      WHERE b.owner_developer_profile_id IS NULL
        AND b.source_license_number = i.source_license_number
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
          source_license_number = i.source_license_number,
          state_region = i.state_region,
          markets_covered = COALESCE(i.markets_covered, b.markets_covered),
          updated_at = NOW()
      FROM broker_workbook_import AS i
      WHERE b.owner_developer_profile_id IS NULL
        AND b.source_license_number IS NULL
        AND b.email IS NOT NULL
        AND i.email IS NOT NULL
        AND LOWER(b.email) = LOWER(i.email)
    `);

    const insertResult = await client.query(`
      INSERT INTO brokers (
        id, first_name, last_name, email, phone, brokerage, company, license_number,
        contact_county, contact_sector, contact_specialty, contact_confidence,
        source_license_number, state_region, markets_covered, owner_developer_profile_id,
        is_active, created_at, updated_at
      )
      SELECT gen_random_uuid(), i.first_name, i.last_name, i.email, i.phone, i.brokerage, i.company,
             i.license_number, i.contact_county, i.contact_sector, i.contact_specialty,
             i.contact_confidence, i.source_license_number, i.state_region, i.markets_covered,
             NULL, TRUE, NOW(), NOW()
      FROM broker_workbook_import AS i
      WHERE NOT EXISTS (
        SELECT 1 FROM brokers AS b
        WHERE b.owner_developer_profile_id IS NULL
          AND b.source_license_number = i.source_license_number
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
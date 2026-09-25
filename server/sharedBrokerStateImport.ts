import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import XLSX from "xlsx";
import { isUsStateCode, normalizeUsStateCode } from "@shared/us-states";

export const SHARED_IMPORT_MAX_ROWS = 20_000;

export const SHARED_IMPORT_FIELDS = [
  "fullName", "firstName", "lastName", "email", "phone", "brokerage",
  "licenseNumber", "stateRegion", "county", "marketsCovered", "sector",
  "specialty", "confidence", "sourceTags",
] as const;

export type SharedImportField = typeof SHARED_IMPORT_FIELDS[number];
export type SharedImportMapping = Partial<Record<SharedImportField, string>>;
export type SharedImportContact = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  licenseNumber: string | null;
  contactCounty: string | null;
  contactSector: string | null;
  contactSpecialty: string | null;
  contactConfidence: string | null;
  sourceLicenseNumber: string | null;
  stateRegion: string;
  marketsCovered: string | null;
  sourceTags: string[];
};

type SharedBrokerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  company: string | null;
  license_number: string | null;
  contact_county: string | null;
  contact_sector: string | null;
  contact_specialty: string | null;
  contact_confidence: string | null;
  source_license_number: string | null;
  state_region: string | null;
  markets_covered: string | null;
  source_tags: string[] | null;
};

export type PlannedSharedBroker = Omit<SharedBrokerRow, "source_tags"> & {
  source_tags: string[];
};

export type SharedImportPlan = {
  state: string;
  updates: PlannedSharedBroker[];
  inserts: PlannedSharedBroker[];
  snapshotHash: string;
  preview: {
    state: string;
    sourceRows: number;
    processedRows: number;
    skippedRows: number;
    duplicateRows: number;
    skippedReasons: Record<string, number>;
    updatedByLicense: number;
    updatedByEmail: number;
    inserted: number;
    sharedBrokersBefore: number;
    sharedBrokersAfter: number;
    stateBrokersBefore: number;
    stateBrokersAfter: number;
  };
};

function clean(value: unknown, maxLength = 500): string {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, maxLength);
}

function splitFullName(value: string): { firstName: string; lastName: string } {
  if (value.includes(",")) {
    const [lastName, firstName] = value.split(",", 2).map((part) => part.trim());
    return { firstName: firstName || "", lastName: lastName || "" };
  }
  const parts = value.split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || "", lastName: parts.join(" ") };
}

function normalizeEmail(value: string): string | null {
  if (!value) return null;
  const email = value.toLowerCase();
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizePhone(value: string): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.slice(0, 80);
}

function splitTags(value: string): string[] {
  const tags = new Map<string, string>();
  for (const tag of value.split(/[;,|]/).map((item) => item.trim().slice(0, 100)).filter(Boolean)) {
    if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
  }
  return Array.from(tags.values());
}

function mergeTags(...lists: string[][]): string[] {
  const tags = new Map<string, string>();
  for (const tag of lists.flat()) {
    if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
  }
  return Array.from(tags.values());
}

function normalizedSector(value: string): string | null {
  const lower = value.toLowerCase();
  if (/\bcommercial\b/.test(lower)) return "commercial";
  if (/\bresidential\b/.test(lower)) return "residential";
  return null;
}

export function parseSharedBrokerWorkbook(
  buffer: Buffer,
  stateValue: string,
  mapping: SharedImportMapping,
): {
  rows: SharedImportContact[];
  sourceRows: number;
  skippedRows: number;
  duplicateRows: number;
  skippedReasons: Record<string, number>;
} {
  const state = normalizeUsStateCode(stateValue);
  if (!isUsStateCode(state)) throw new Error("Choose a valid U.S. state.");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, dense: true, raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.["!ref"]) throw new Error("The first worksheet is empty.");
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  if (range.e.r - range.s.r > SHARED_IMPORT_MAX_ROWS) {
    throw new Error(`The first worksheet exceeds the ${SHARED_IMPORT_MAX_ROWS.toLocaleString()}-row limit.`);
  }
  const source = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  if (!source.length) throw new Error("The first worksheet needs a header row and at least one contact.");
  const headers = Object.keys(source[0]);
  if (!headers.length || headers.length > 100) throw new Error("The worksheet headers are missing or exceed the 100-column limit.");
  for (const field of SHARED_IMPORT_FIELDS) {
    const header = mapping[field];
    if (header && !headers.includes(header)) throw new Error("The column mapping no longer matches the uploaded file.");
  }
  if (!mapping.firstName && !mapping.lastName && !mapping.fullName &&
      !mapping.email && !mapping.phone && !mapping.licenseNumber) {
    throw new Error("Map a name, email, phone, or license number before previewing.");
  }

  const value = (row: Record<string, unknown>, field: SharedImportField, limit = 500) =>
    mapping[field] ? clean(row[mapping[field]!], limit) : "";
  const rows: SharedImportContact[] = [];
  const skippedReasons: Record<string, number> = {};
  let skippedRows = 0;
  const skip = (reason: string) => {
    skippedRows++;
    skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
  };

  for (const sourceRow of source) {
    const rawState = value(sourceRow, "stateRegion", 80);
    if (rawState && normalizeUsStateCode(rawState) !== state) {
      skip("State did not match the selected import state");
      continue;
    }
    const rawEmail = value(sourceRow, "email", 320);
    const email = normalizeEmail(rawEmail);
    if (rawEmail && !email) {
      skip("Invalid email address");
      continue;
    }
    const fullName = splitFullName(value(sourceRow, "fullName", 200));
    const firstName = value(sourceRow, "firstName", 100) || fullName.firstName;
    const lastName = value(sourceRow, "lastName", 100) || fullName.lastName;
    const phone = normalizePhone(value(sourceRow, "phone", 80));
    const licenseNumber = value(sourceRow, "licenseNumber", 100).replace(/\.0$/, "") || null;
    if (!firstName && !lastName && !email && !phone && !licenseNumber) {
      skip("No name, email, phone, or license number");
      continue;
    }
    const county = value(sourceRow, "county", 120).toLowerCase() || null;
    rows.push({
      firstName: firstName || "Unknown",
      lastName,
      email,
      phone,
      brokerage: value(sourceRow, "brokerage", 250) || null,
      licenseNumber,
      contactCounty: county,
      contactSector: normalizedSector(value(sourceRow, "sector", 80)),
      contactSpecialty: value(sourceRow, "specialty", 250) || null,
      contactConfidence: value(sourceRow, "confidence", 40).toLowerCase() || null,
      sourceLicenseNumber: licenseNumber,
      stateRegion: state,
      marketsCovered: value(sourceRow, "marketsCovered", 250) || county,
      sourceTags: splitTags(value(sourceRow, "sourceTags", 500)),
    });
  }

  const beforeDeduplication = rows.length;
  const byLicense = new Map<string, SharedImportContact>();
  const withoutLicense: SharedImportContact[] = [];
  for (const row of rows) {
    if (!row.sourceLicenseNumber) {
      withoutLicense.push(row);
      continue;
    }
    const key = `${state}:${row.sourceLicenseNumber.toLowerCase()}`;
    const existing = byLicense.get(key);
    byLicense.set(key, existing ? mergeImportContacts(existing, row, true) : row);
  }
  const byEmail = new Map<string, SharedImportContact>();
  const withoutEmail: SharedImportContact[] = [];
  for (const row of [...withoutLicense, ...Array.from(byLicense.values())]) {
    if (!row.email) {
      withoutEmail.push(row);
      continue;
    }
    const existing = byEmail.get(row.email);
    byEmail.set(row.email, existing ? mergeImportContacts(existing, row, false) : row);
  }
  const deduped = [...withoutEmail, ...Array.from(byEmail.values())];
  if (!deduped.length) throw new Error("No usable broker rows were found. Check the selected state and field mappings.");
  return {
    rows: deduped,
    sourceRows: source.length,
    skippedRows,
    duplicateRows: beforeDeduplication - deduped.length,
    skippedReasons,
  };
}

function mergeImportContacts(a: SharedImportContact, b: SharedImportContact, byLicense: boolean): SharedImportContact {
  const union = (left: string | null, right: string | null) =>
    Array.from(new Map([left, right].filter(Boolean).flatMap((item) => String(item).split(",").map((part) => part.trim())).filter(Boolean)
      .map((item) => [item.toLowerCase(), item])).values()).join(", ") || null;
  return {
    ...a,
    firstName: a.firstName === "Unknown" ? b.firstName : a.firstName,
    lastName: a.lastName || b.lastName,
    email: a.email || b.email,
    phone: a.phone || b.phone,
    brokerage: a.brokerage || b.brokerage,
    licenseNumber: a.licenseNumber || b.licenseNumber,
    contactCounty: byLicense ? (a.contactCounty || b.contactCounty) : union(a.contactCounty, b.contactCounty),
    contactSector: a.contactSector === "commercial" || b.contactSector === "commercial"
      ? "commercial" : a.contactSector || b.contactSector,
    contactSpecialty: a.contactSpecialty || b.contactSpecialty,
    contactConfidence: a.contactConfidence || b.contactConfidence,
    sourceLicenseNumber: a.sourceLicenseNumber || b.sourceLicenseNumber,
    marketsCovered: byLicense ? (a.marketsCovered || b.marketsCovered) : union(a.marketsCovered, b.marketsCovered),
    sourceTags: mergeTags(a.sourceTags, b.sourceTags),
  };
}

export async function readSharedBrokers(client: PoolClient): Promise<SharedBrokerRow[]> {
  const result = await client.query<SharedBrokerRow>(`
    SELECT id, first_name, last_name, email, phone, brokerage, company, license_number,
           contact_county, contact_sector, contact_specialty, contact_confidence,
           source_license_number, state_region, markets_covered, source_tags
    FROM brokers
    WHERE owner_developer_profile_id IS NULL
    ORDER BY id
  `);
  return result.rows;
}

function splitStates(value: string | null): string[] {
  return Array.from(new Set(String(value || "").split(",").map((part) => part.trim().toUpperCase()).filter(Boolean)));
}

function unionText(a: string | null, b: string | null): string | null {
  const items = [a, b].flatMap((value) => String(value || "").split(",").map((part) => part.trim())).filter(Boolean);
  return Array.from(new Map(items.map((item) => [item.toLowerCase(), item])).values()).join(", ") || null;
}

export function hashSharedBrokerSnapshot(rows: SharedBrokerRow[]): string {
  const projection = rows.map((row) => [
    row.id, row.first_name, row.last_name, row.email?.toLowerCase() || null, row.phone,
    row.brokerage, row.company, row.license_number, row.contact_county, row.contact_sector,
    row.contact_specialty, row.contact_confidence, row.source_license_number, row.state_region,
    row.markets_covered, row.source_tags || [],
  ]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256").update(JSON.stringify(projection)).digest("hex");
}

export function buildSharedImportPlan(
  state: string,
  parsed: ReturnType<typeof parseSharedBrokerWorkbook>,
  existingRows: SharedBrokerRow[],
): SharedImportPlan {
  const initialById = new Map(existingRows.map((row) => [row.id, row]));
  const byEmail = new Map<string, string>();
  const byLicense = new Map<string, SharedBrokerRow[]>();
  for (const row of existingRows) {
    if (row.email) byEmail.set(row.email.toLowerCase(), row.id);
    const states = splitStates(row.state_region);
    if (row.source_license_number && states.length === 1) {
      const key = `${states[0]}:${row.source_license_number.toLowerCase()}`;
      byLicense.set(key, [...(byLicense.get(key) || []), row]);
    }
  }

  const planned = new Map<string, PlannedSharedBroker>();
  const insertedIds = new Set<string>();
  const stagedEmails = new Map<string, string>();
  const licenseIds = new Set<string>();
  const emailIds = new Set<string>();
  for (const contact of parsed.rows) {
    const licenseMatches = contact.sourceLicenseNumber
      ? byLicense.get(`${state}:${contact.sourceLicenseNumber.toLowerCase()}`) || []
      : [];
    if (licenseMatches.length > 1) throw new Error("Import preview blocked: duplicate shared state-license matches need review.");
    const licenseTarget = licenseMatches[0];
    const emailId = contact.email ? byEmail.get(contact.email) || stagedEmails.get(contact.email) : undefined;
    if (licenseTarget && emailId && licenseTarget.id !== emailId) {
      throw new Error("Import preview blocked: a state-license match and email match point to different shared contacts.");
    }
    const targetId = licenseTarget?.id || emailId;
    if (!targetId) {
      const id = randomUUID();
      planned.set(id, {
        id,
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        brokerage: contact.brokerage,
        company: contact.brokerage,
        license_number: contact.licenseNumber,
        contact_county: contact.contactCounty,
        contact_sector: contact.contactSector,
        contact_specialty: contact.contactSpecialty,
        contact_confidence: contact.contactConfidence,
        source_license_number: contact.sourceLicenseNumber,
        state_region: state,
        markets_covered: contact.marketsCovered,
        source_tags: contact.sourceTags,
      });
      insertedIds.add(id);
      if (contact.email) stagedEmails.set(contact.email, id);
      continue;
    }

    const original = licenseTarget || initialById.get(targetId);
    const current = planned.get(targetId) || (original && {
      ...original,
      source_tags: [...(original.source_tags || [])],
    });
    if (!current) throw new Error("Import preview blocked: a shared contact could not be resolved.");
    current.first_name = contact.firstName === "Unknown" ? current.first_name : contact.firstName;
    current.last_name = contact.lastName || current.last_name;
    current.email = contact.email || current.email;
    current.phone = contact.phone || current.phone;
    current.brokerage = contact.brokerage || current.brokerage;
    current.company = contact.brokerage || current.company;
    current.license_number = contact.licenseNumber || current.license_number;
    current.contact_county = licenseTarget
      ? (contact.contactCounty || current.contact_county)
      : unionText(current.contact_county, contact.contactCounty);
    current.contact_sector = contact.contactSector || current.contact_sector;
    current.contact_specialty = contact.contactSpecialty || current.contact_specialty;
    current.contact_confidence = contact.contactConfidence || current.contact_confidence;
    current.source_license_number = licenseTarget
      ? contact.sourceLicenseNumber
      : current.source_license_number || contact.sourceLicenseNumber;
    current.state_region = unionText(current.state_region, state) || state;
    current.markets_covered = licenseTarget
      ? (contact.marketsCovered || current.markets_covered)
      : unionText(current.markets_covered, contact.marketsCovered);
    if (contact.sourceTags.length) {
      current.source_tags = licenseTarget
        ? [...contact.sourceTags]
        : mergeTags(current.source_tags, contact.sourceTags);
    }
    planned.set(targetId, current);
    if (contact.email) stagedEmails.set(contact.email, targetId);
    if (licenseTarget) licenseIds.add(targetId);
    else if (!insertedIds.has(targetId)) emailIds.add(targetId);
  }

  const updates = Array.from(planned.values()).filter((row) => !insertedIds.has(row.id));
  const inserts = Array.from(planned.values()).filter((row) => insertedIds.has(row.id));
  const afterRows = existingRows.map((row) => planned.get(row.id) || row).concat(inserts);
  const stateCount = (rows: Array<{ state_region: string | null }>) =>
    rows.filter((row) => splitStates(row.state_region).includes(state)).length;
  return {
    state,
    updates,
    inserts,
    snapshotHash: hashSharedBrokerSnapshot(existingRows),
    preview: {
      state,
      sourceRows: parsed.sourceRows,
      processedRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      duplicateRows: parsed.duplicateRows,
      skippedReasons: parsed.skippedReasons,
      updatedByLicense: licenseIds.size,
      updatedByEmail: emailIds.size,
      inserted: inserts.length,
      sharedBrokersBefore: existingRows.length,
      sharedBrokersAfter: existingRows.length + inserts.length,
      stateBrokersBefore: stateCount(existingRows),
      stateBrokersAfter: stateCount(afterRows),
    },
  };
}

function jsonRows(rows: PlannedSharedBroker[]): string {
  return JSON.stringify(rows);
}

export async function applySharedImportPlan(
  client: PoolClient,
  plan: SharedImportPlan,
): Promise<{ updated: number; inserted: number; stateBrokersVerified: number }> {
  const recordShape = `
    id text, first_name text, last_name text, email text, phone text, brokerage text, company text,
    license_number text, contact_county text, contact_sector text, contact_specialty text,
    contact_confidence text, source_license_number text, state_region text, markets_covered text,
    source_tags text[]
  `;
  let updated = 0;
  for (let start = 0; start < plan.updates.length; start += 3000) {
    const result = await client.query(`
      UPDATE brokers AS b SET
        first_name=i.first_name, last_name=i.last_name, email=i.email, phone=i.phone,
        brokerage=i.brokerage, company=i.company, license_number=i.license_number,
        contact_county=i.contact_county, contact_sector=i.contact_sector,
        contact_specialty=i.contact_specialty, contact_confidence=i.contact_confidence,
        source_license_number=i.source_license_number, state_region=i.state_region,
        markets_covered=i.markets_covered, source_tags=i.source_tags, updated_at=NOW()
      FROM jsonb_to_recordset($1::jsonb) AS i(${recordShape})
      WHERE b.id=i.id AND b.owner_developer_profile_id IS NULL
      RETURNING b.id
    `, [jsonRows(plan.updates.slice(start, start + 3000))]);
    updated += result.rowCount || 0;
  }
  if (updated !== plan.updates.length) throw new Error("The shared broker update count changed; transaction rolled back.");

  let inserted = 0;
  for (let start = 0; start < plan.inserts.length; start += 3000) {
    const result = await client.query(`
      INSERT INTO brokers (
        id, first_name, last_name, email, phone, brokerage, company, license_number,
        contact_county, contact_sector, contact_specialty, contact_confidence,
        source_license_number, state_region, markets_covered, source_tags,
        owner_developer_profile_id, is_active, created_at, updated_at
      )
      SELECT i.id, i.first_name, i.last_name, i.email, i.phone, i.brokerage, i.company,
        i.license_number, i.contact_county, i.contact_sector, i.contact_specialty,
        i.contact_confidence, i.source_license_number, i.state_region, i.markets_covered,
        i.source_tags, NULL, TRUE, NOW(), NOW()
      FROM jsonb_to_recordset($1::jsonb) AS i(${recordShape})
      RETURNING id
    `, [jsonRows(plan.inserts.slice(start, start + 3000))]);
    inserted += result.rowCount || 0;
  }
  if (inserted !== plan.inserts.length) throw new Error("The shared broker insert count changed; transaction rolled back.");

  const stateResult = await client.query<{ count: number }>(`
    SELECT COUNT(*)::int AS count FROM brokers b
    WHERE b.owner_developer_profile_id IS NULL
      AND EXISTS (
        SELECT 1 FROM unnest(string_to_array(COALESCE(b.state_region, ''), ',')) AS s
        WHERE UPPER(BTRIM(s)) = $1
      )
  `, [plan.state]);
  const stateBrokersVerified = Number(stateResult.rows[0]?.count || 0);
  if (stateBrokersVerified !== plan.preview.stateBrokersAfter) {
    throw new Error("The post-import state count did not match the preview; transaction rolled back.");
  }
  return { updated, inserted, stateBrokersVerified };
}
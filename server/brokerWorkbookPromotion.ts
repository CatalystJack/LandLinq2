import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import XLSX from "xlsx";
import type { PoolClient } from "pg";

export type BrokerImportRow = {
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
  sourceLicenseState: "NC" | "TN";
  stateRegion: string;
  marketsCovered: string | null;
  sourceTags: string[];
};

export type ApprovedWorkbook = {
  state: "NC" | "TN";
  fileName: string;
  fileHash: string;
  rows: BrokerImportRow[];
};

type BrokerRecord = {
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

export type PlannedBroker = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  company: string | null;
  license_number: string;
  contact_county: string | null;
  contact_sector: string;
  contact_specialty: string | null;
  contact_confidence: string | null;
  source_license_number: string;
  state_region: string;
  markets_covered: string | null;
  source_tags: string[];
};

export type BrokerPromotionPlan = {
  updates: PlannedBroker[];
  inserts: PlannedBroker[];
  preview: {
    workbooks: Array<{ state: "NC" | "TN"; fileName: string; sourceRows: number }>;
    dedupedRowsBeforeCrossStateEmailMatch: number;
    crossStateEmailDuplicates: number;
    sharedBrokersBefore: number;
    sharedBrokersAfter: number;
    updatedByLicense: number;
    updatedByEmail: number;
    inserted: number;
    companyCrmRowsPreserved: number;
    usersUnchanged: number;
    dealsUnchanged: number;
    companyCrmRowsUnchanged: number;
    stateOptionsBefore: Array<{ state: "NC" | "TN"; brokers: number }>;
    stateOptionsAfter: Array<{ state: "NC" | "TN"; brokers: number }>;
    sharedStateRowsAlreadyPresent: Array<{ state: "NC" | "TN"; brokers: number }>;
  };
  snapshotHash: string;
  inputHash: string;
};

const sheetNames = ["Commercial", "Residential", "Needs Review", "Firm Licenses"];

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result ? result : null;
}

function licenseValue(value: unknown): string | null {
  const result = clean(value);
  return result?.replace(/\.0$/, "") ?? null;
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

function normalizeTags(value: unknown): string[] {
  const raw = clean(value);
  if (!raw) return [];
  return Array.from(new Set(
    raw.split(/[;,|]/).map((tag) => tag.trim()).filter(Boolean),
  ));
}

function splitName(name: string | null, first: string | null, last: string | null) {
  if (first && last) return { firstName: first, lastName: last };
  if (name?.includes(",")) {
    const [lastPart, firstPart] = name.split(",", 2).map((part) => part.trim());
    return { firstName: firstPart || "Unknown", lastName: lastPart || "Unknown" };
  }
  const parts = (name || "").split(/\s+/).filter(Boolean);
  return { firstName: parts.shift() || "Unknown", lastName: parts.join(" ") || "Unknown" };
}

function resolveSector(
  row: Record<string, unknown>,
  fallback: "commercial" | "residential",
): "commercial" | "residential" {
  const raw = clean(row.Sector)?.toLowerCase();
  if (raw === "commercial" || raw === "residential") return raw;
  if (raw === "needs review") {
    const productType = clean(row["Product Type"])?.toLowerCase() ?? "";
    if (/(residential|timeshare|apartment)/.test(productType)) return "residential";
  }
  return fallback;
}

function dedupeRows(rows: BrokerImportRow[]): BrokerImportRow[] {
  const byLicense = new Map<string, BrokerImportRow>();
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
      sourceTags: Array.from(new Set([...existing.sourceTags, ...row.sourceTags])),
      sector: existing.sector === "commercial" || row.sector === "commercial"
        ? "commercial"
        : "residential",
    });
  }

  const byEmail = new Map<string, BrokerImportRow>();
  const withoutEmail: BrokerImportRow[] = [];
  for (const row of Array.from(byLicense.values())) {
    if (!row.email) {
      withoutEmail.push(row);
      continue;
    }
    const existing = byEmail.get(row.email);
    if (!existing) {
      byEmail.set(row.email, row);
      continue;
    }
    byEmail.set(row.email, mergeEmailRows(existing, row));
  }
  return withoutEmail.concat(Array.from(byEmail.values()));
}

function mergeEmailRows(existing: BrokerImportRow, row: BrokerImportRow): BrokerImportRow {
  const counties = new Set(
    [existing.marketsCovered, row.marketsCovered]
      .filter(Boolean)
      .flatMap((value) => String(value).split(",").map((item) => item.trim()))
      .filter(Boolean),
  );
  const states = new Set(
    [existing.stateRegion, row.stateRegion]
      .flatMap((value) => String(value).split(",").map((item) => item.trim().toUpperCase()))
      .filter(Boolean),
  );
  return {
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
    sourceTags: Array.from(new Set([...existing.sourceTags, ...row.sourceTags])),
    stateRegion: Array.from(states).join(", "),
    marketsCovered: counties.size ? Array.from(counties).join(", ") : existing.marketsCovered,
  };
}

function rowsFromSheet(
  sheet: XLSX.WorkSheet | undefined,
  stateRegion: "NC" | "TN",
  fallbackSector: "commercial" | "residential",
): BrokerImportRow[] {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const imported: BrokerImportRow[] = [];
  for (const row of rows) {
    const sourceLicenseNumber = licenseValue(row["License #"]);
    if (!sourceLicenseNumber) continue;
    const { firstName, lastName } = splitName(
      clean(row.Name),
      clean(row["First Name"]),
      clean(row["Last Name"]),
    );
    const firm = clean(row.Firm)
      ?? clean(row["Firm Holding License"])
      ?? clean(row["Firm (linked)"]);
    const county = clean(row.County)?.toLowerCase() ?? null;
    const rawState = clean(row.State) ?? clean(row["Mailing State"]) ?? stateRegion;
    const normalizedState = rawState.trim().toUpperCase();
    if (normalizedState !== stateRegion) {
      throw new Error(`${stateRegion} workbook contains a row labeled ${normalizedState}`);
    }
    const specialty = clean(row.Specialty) ?? clean(row["Product Type"]);
    const sourceTags = normalizeTags(row["DB Tags"] ?? row["Database Tags"] ?? row.Tags);
    imported.push({
      firstName,
      lastName,
      email: normalizeEmail(row.Email),
      phone: normalizePhone(row.Phone),
      brokerage: firm,
      company: firm,
      licenseNumber: sourceLicenseNumber,
      county,
      sector: resolveSector(row, fallbackSector),
      specialty,
      confidence: clean(row.Confidence)?.toLowerCase() ?? null,
      sourceLicenseNumber,
      sourceLicenseState: stateRegion,
      stateRegion,
      marketsCovered: county,
      sourceTags,
    });
  }
  return imported;
}

function inferWorkbookState(
  fileName: string,
  workbook: XLSX.WorkBook,
): "NC" | "TN" {
  const fromName = path.basename(fileName).match(/(?:^|_)(NC|TN)(?:_|\.|$)/i)?.[1];
  if (fromName) return fromName.toUpperCase() as "NC" | "TN";
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === "Summary") continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: null,
      raw: false,
    });
    const state = clean(rows[0]?.State) ?? clean(rows[0]?.["Mailing State"]);
    if (state === "NC" || state === "TN") return state;
  }
  throw new Error(`Could not infer NC or TN from workbook ${path.basename(fileName)}`);
}

export function parseBrokerWorkbookBuffer(
  fileName: string,
  buffer: Buffer,
  expectedState?: "NC" | "TN",
): ApprovedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, dense: true });
  const inferredState = inferWorkbookState(fileName, workbook);
  const state = expectedState ?? inferredState;
  if (inferredState !== state) {
    throw new Error(`The ${expectedState} upload contains a ${inferredState} workbook`);
  }
  const rows = dedupeRows([
    ...rowsFromSheet(workbook.Sheets.Commercial, state, "commercial"),
    ...rowsFromSheet(workbook.Sheets.Residential, state, "residential"),
    ...rowsFromSheet(workbook.Sheets["Needs Review"], state, "commercial"),
    ...rowsFromSheet(workbook.Sheets["Firm Licenses"], state, "commercial"),
  ]);
  if (rows.length === 0) throw new Error(`No licensed broker rows found in ${state} workbook`);
  return {
    state,
    fileName: path.basename(fileName),
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    rows,
  };
}

export function mergeAcrossStates(workbooks: ApprovedWorkbook[]): BrokerImportRow[] {
  const byEmail = new Map<string, BrokerImportRow>();
  const withoutEmail: BrokerImportRow[] = [];
  for (const workbook of workbooks) {
    for (const row of workbook.rows) {
      if (!row.email) {
        withoutEmail.push(row);
        continue;
      }
      const existing = byEmail.get(row.email);
      byEmail.set(row.email, existing ? mergeEmailRows(existing, row) : row);
    }
  }
  return withoutEmail.concat(Array.from(byEmail.values()));
}

function splitStates(value: string | null | undefined): string[] {
  return Array.from(new Set(
    String(value || "")
      .split(",")
      .map((part) => part.trim().toUpperCase())
      .filter(Boolean),
  ));
}

function unionText(existing: string | null, incoming: string | null): string | null {
  const values = [existing, incoming]
    .flatMap((value) => String(value || "").split(",").map((part) => part.trim()))
    .filter(Boolean);
  const deduped = Array.from(new Map(values.map((value) => [value.toLowerCase(), value])).values());
  return deduped.length ? deduped.join(", ") : null;
}

function snapshotProjection(row: BrokerRecord): unknown[] {
  return [
    row.id,
    row.first_name,
    row.last_name,
    row.email?.toLowerCase() ?? null,
    row.phone,
    row.brokerage,
    row.company,
    row.license_number,
    row.contact_county,
    row.contact_sector,
    row.contact_specialty,
    row.contact_confidence,
    row.source_license_number,
    row.state_region,
    row.markets_covered,
    row.source_tags ?? [],
  ];
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildBrokerPromotionPlan(
  workbooks: ApprovedWorkbook[],
  existingRows: BrokerRecord[],
  relatedCounts: { users: number; deals: number; companyCrmRows: number; updatedBrokerCrmRows: number },
): BrokerPromotionPlan {
  const orderedWorkbooks = [...workbooks].sort((a, b) => a.state.localeCompare(b.state));
  const importedRows = mergeAcrossStates(orderedWorkbooks);
  const sourceRows = orderedWorkbooks.reduce((sum, workbook) => sum + workbook.rows.length, 0);
  const byId = new Map<string, PlannedBroker>();
  const insertedIds = new Set<string>();
  const licenseMatched = new Set<string>();
  const emailMatched = new Set<string>();
  const initialById = new Map(existingRows.map((row) => [row.id, row]));
  const initialByLicenseAndState = new Map<string, BrokerRecord[]>();
  const initialByEmail = new Map<string, string>();
  for (const row of existingRows) {
    const license = row.source_license_number;
    const states = splitStates(row.state_region);
    // A shared row with multiple states has no persisted license-state
    // provenance, so using its single source license for either state is
    // ambiguous. Email dedupe remains available as the safe fallback.
    if (license && states.length === 1) {
      const key = `${states[0]}:${license}`;
      initialByLicenseAndState.set(key, [...(initialByLicenseAndState.get(key) || []), row]);
    }
    if (row.email) initialByEmail.set(row.email.toLowerCase(), row.id);
  }

  const stagedByEmail = new Map<string, string>();
  const conflicts: string[] = [];
  for (const imported of importedRows) {
    const licenseState = imported.sourceLicenseState || splitStates(imported.stateRegion)[0];
    const licenseMatches = new Map<string, BrokerRecord>(
      (initialByLicenseAndState.get(`${licenseState}:${imported.sourceLicenseNumber}`) || [])
        .map((match) => [match.id, match]),
    );
    if (licenseMatches.size > 1) {
      conflicts.push(`More than one shared broker has the ${imported.stateRegion} source license ${imported.sourceLicenseNumber}`);
      continue;
    }

    const licenseTarget = licenseMatches.values().next().value as BrokerRecord | undefined;
    const emailTargetId = imported.email
      ? initialByEmail.get(imported.email) ?? stagedByEmail.get(imported.email)
      : undefined;
    if (licenseTarget && emailTargetId && emailTargetId !== licenseTarget.id) {
      conflicts.push(`Source license ${imported.sourceLicenseNumber} and email ${imported.email} resolve to different existing brokers`);
      continue;
    }

    let targetId = licenseTarget?.id ?? emailTargetId;
    let matchType: "license" | "email" = licenseTarget ? "license" : "email";
    if (!targetId) {
      targetId = randomUUID();
      insertedIds.add(targetId);
      byId.set(targetId, {
        id: targetId,
        first_name: imported.firstName,
        last_name: imported.lastName,
        email: imported.email,
        phone: imported.phone,
        brokerage: imported.brokerage,
        company: imported.company,
        license_number: imported.licenseNumber,
        contact_county: imported.county,
        contact_sector: imported.sector,
        contact_specialty: imported.specialty,
        contact_confidence: imported.confidence,
        source_license_number: imported.sourceLicenseNumber,
        state_region: imported.stateRegion,
        markets_covered: imported.marketsCovered,
        source_tags: [...imported.sourceTags],
      });
      if (imported.email) stagedByEmail.set(imported.email, targetId);
      continue;
    }

    const initial = licenseTarget ?? initialById.get(targetId);
    const current = byId.get(targetId) ?? (initial
      ? {
          id: initial.id,
          first_name: initial.first_name,
          last_name: initial.last_name,
          email: initial.email,
          phone: initial.phone,
          brokerage: initial.brokerage,
          company: initial.company,
          license_number: initial.license_number || imported.licenseNumber,
          contact_county: initial.contact_county,
          contact_sector: initial.contact_sector || imported.sector,
          contact_specialty: initial.contact_specialty,
          contact_confidence: initial.contact_confidence,
          source_license_number: initial.source_license_number || imported.sourceLicenseNumber,
          state_region: initial.state_region || "",
          markets_covered: initial.markets_covered,
          source_tags: [...(initial.source_tags || [])],
        }
      : undefined);
    if (!current) {
      conflicts.push(`Could not resolve planned shared broker ${targetId}`);
      continue;
    }

    matchType = licenseTarget ? "license" : "email";
    current.first_name = imported.firstName;
    current.last_name = imported.lastName;
    current.email = imported.email ?? current.email;
    current.phone = imported.phone ?? current.phone;
    current.brokerage = imported.brokerage ?? current.brokerage;
    current.company = imported.company ?? current.company;
    current.license_number = imported.licenseNumber;
    current.contact_county = imported.county;
    current.contact_sector = imported.sector;
    current.contact_specialty = imported.specialty;
    current.contact_confidence = imported.confidence;
    current.source_license_number = matchType === "license"
      ? imported.sourceLicenseNumber
      : current.source_license_number || imported.sourceLicenseNumber;
    current.state_region = unionText(current.state_region, imported.stateRegion) || imported.stateRegion;
    current.markets_covered = matchType === "license"
      ? imported.marketsCovered ?? current.markets_covered
      : unionText(current.markets_covered, imported.marketsCovered);
    current.source_tags = matchType === "license"
      ? [...imported.sourceTags]
      : Array.from(new Set([...current.source_tags, ...imported.sourceTags]));
    byId.set(targetId, current);
    if (imported.email) stagedByEmail.set(imported.email, targetId);
    if (licenseTarget) licenseMatched.add(targetId);
    else if (!insertedIds.has(targetId)) emailMatched.add(targetId);
  }
  if (conflicts.length) throw new Error(`Import preview blocked: ${conflicts.slice(0, 5).join("; ")}`);

  const allActions = Array.from(byId.values());
  const updates = allActions.filter((row) => !insertedIds.has(row.id));
  const inserts = allActions.filter((row) => insertedIds.has(row.id));
  const afterRows = existingRows.map((row) => byId.get(row.id) ?? {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    brokerage: row.brokerage,
    company: row.company,
    license_number: row.license_number || "",
    contact_county: row.contact_county,
    contact_sector: row.contact_sector || "",
    contact_specialty: row.contact_specialty,
    contact_confidence: row.contact_confidence,
    source_license_number: row.source_license_number || "",
    state_region: row.state_region || "",
    markets_covered: row.markets_covered,
    source_tags: row.source_tags || [],
  }).concat(inserts);
  const stateOptionsAfter = (["NC", "TN"] as const).map((state) => ({
    state,
    brokers: afterRows.filter((row) => splitStates(row.state_region).includes(state)).length,
  }));
  const sharedStateRowsAlreadyPresent = (["NC", "TN"] as const)
    .map((state) => ({
      state,
      brokers: existingRows.filter((row) => splitStates(row.state_region).includes(state)).length,
    }))
    .filter((entry) => entry.brokers > 0);
  const updatedIds = updates.map((row) => row.id);

  return {
    updates,
    inserts,
    snapshotHash: hashJson(existingRows.map(snapshotProjection).sort((a, b) => String(a[0]).localeCompare(String(b[0])))),
    inputHash: hashJson(orderedWorkbooks.map((workbook) => [workbook.state, workbook.fileHash])),
    preview: {
      workbooks: orderedWorkbooks.map((workbook) => ({
        state: workbook.state,
        fileName: workbook.fileName,
        sourceRows: workbook.rows.length,
      })),
      dedupedRowsBeforeCrossStateEmailMatch: sourceRows,
      crossStateEmailDuplicates: sourceRows - importedRows.length,
      sharedBrokersBefore: existingRows.length,
      sharedBrokersAfter: existingRows.length + inserts.length,
      updatedByLicense: licenseMatched.size,
      updatedByEmail: emailMatched.size,
      inserted: inserts.length,
      companyCrmRowsPreserved: relatedCounts.updatedBrokerCrmRows,
      usersUnchanged: relatedCounts.users,
      dealsUnchanged: relatedCounts.deals,
      companyCrmRowsUnchanged: relatedCounts.companyCrmRows,
      stateOptionsBefore: (["NC", "TN"] as const).map((state) => ({
        state,
        brokers: existingRows.filter((row) => splitStates(row.state_region).includes(state)).length,
      })),
      stateOptionsAfter,
      sharedStateRowsAlreadyPresent,
    },
  };
}

export async function readSharedBrokerRows(client: PoolClient): Promise<BrokerRecord[]> {
  const result = await client.query<BrokerRecord>(`
    SELECT id, first_name, last_name, email, phone, brokerage, company, license_number,
           contact_county, contact_sector, contact_specialty, contact_confidence,
           source_license_number, state_region, markets_covered, source_tags
    FROM brokers
    WHERE owner_developer_profile_id IS NULL
    ORDER BY id
  `);
  return result.rows;
}

export async function readRelatedCounts(client: PoolClient, brokerIds: string[]) {
  const totals = await client.query<{
    users: string;
    deals: string;
    company_crm_rows: string;
  }>(`
    SELECT
      (SELECT COUNT(*)::text FROM users) AS users,
      (SELECT COUNT(*)::text FROM deals) AS deals,
      (SELECT COUNT(*)::text FROM developer_broker_crm) AS company_crm_rows
  `);
  const linked = brokerIds.length
    ? await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM developer_broker_crm WHERE broker_id = ANY($1::varchar[])",
        [brokerIds],
      )
    : { rows: [{ count: "0" }] };
  return {
    users: Number(totals.rows[0]?.users || 0),
    deals: Number(totals.rows[0]?.deals || 0),
    companyCrmRows: Number(totals.rows[0]?.company_crm_rows || 0),
    updatedBrokerCrmRows: Number(linked.rows[0]?.count || 0),
  };
}

async function readBrokerStateCounts(
  client: PoolClient,
  sharedOnly = false,
): Promise<Array<{ state: "NC" | "TN"; brokers: number }>> {
  const sharedFilter = sharedOnly ? "AND owner_developer_profile_id IS NULL" : "";
  const result = await client.query<{ state: "NC" | "TN"; brokers: number }>(`
    SELECT UPPER(BTRIM(state_value)) AS state, COUNT(*)::int AS brokers
    FROM brokers
    CROSS JOIN LATERAL unnest(string_to_array(COALESCE(state_region, ''), ',')) AS state_value
    WHERE UPPER(BTRIM(state_value)) IN ('NC', 'TN')
      ${sharedFilter}
    GROUP BY UPPER(BTRIM(state_value))
    ORDER BY state
  `);
  return result.rows;
}

export async function buildPromotionPlan(
  client: PoolClient,
  workbooks: ApprovedWorkbook[],
): Promise<BrokerPromotionPlan> {
  const existingRows = await readSharedBrokerRows(client);
  const baseCounts = await readRelatedCounts(client, []);
  const plan = buildBrokerPromotionPlan(workbooks, existingRows, baseCounts);
  const updatedIds = plan.updates.map((row) => row.id);
  const linkedRows = await readRelatedCounts(client, updatedIds);
  plan.preview.companyCrmRowsPreserved = linkedRows.updatedBrokerCrmRows;
  plan.preview.usersUnchanged = linkedRows.users;
  plan.preview.dealsUnchanged = linkedRows.deals;
  plan.preview.companyCrmRowsUnchanged = linkedRows.companyCrmRows;
  const stateOptionsBefore = await readBrokerStateCounts(client);
  const sharedStateOptionsBefore = await readBrokerStateCounts(client, true);
  plan.preview.stateOptionsBefore = (["NC", "TN"] as const).map((state) => ({
    state,
    brokers: stateOptionsBefore.find((item) => item.state === state)?.brokers || 0,
  }));
  plan.preview.stateOptionsAfter = (["NC", "TN"] as const).map((state) => {
    const allBefore = stateOptionsBefore.find((item) => item.state === state)?.brokers || 0;
    const sharedBefore = sharedStateOptionsBefore.find((item) => item.state === state)?.brokers || 0;
    const sharedAfter = plan.preview.stateOptionsAfter.find((item) => item.state === state)?.brokers || 0;
    return { state, brokers: Math.max(0, allBefore - sharedBefore + sharedAfter) };
  });
  plan.snapshotHash = hashJson([
    plan.snapshotHash,
    plan.preview.stateOptionsBefore,
    plan.preview.stateOptionsAfter,
    linkedRows.users,
    linkedRows.deals,
    linkedRows.companyCrmRows,
    linkedRows.updatedBrokerCrmRows,
  ]);
  return plan;
}

export function issuePreviewToken(
  email: string,
  plan: BrokerPromotionPlan,
  sessionSecret: string,
  now = Date.now(),
): string {
  const claims = {
    email: email.toLowerCase(),
    inputHash: plan.inputHash,
    snapshotHash: plan.snapshotHash,
    issuedAt: now,
  };
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyPreviewToken(
  token: string,
  email: string,
  plan: BrokerPromotionPlan,
  sessionSecret: string,
  now = Date.now(),
): boolean {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return false;
  const expected = createHmac("sha256", sessionSecret).update(encoded).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      email?: string;
      inputHash?: string;
      snapshotHash?: string;
      issuedAt?: number;
    };
    return claims.email === email.toLowerCase()
      && claims.inputHash === plan.inputHash
      && claims.snapshotHash === plan.snapshotHash
      && Number.isFinite(claims.issuedAt)
      && now - Number(claims.issuedAt) >= 0
      && now - Number(claims.issuedAt) <= 30 * 60 * 1000;
  } catch {
    return false;
  }
}

function jsonRows(rows: PlannedBroker[]): string {
  return JSON.stringify(rows.map((row) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    brokerage: row.brokerage,
    company: row.company,
    license_number: row.license_number,
    contact_county: row.contact_county,
    contact_sector: row.contact_sector,
    contact_specialty: row.contact_specialty,
    contact_confidence: row.contact_confidence,
    source_license_number: row.source_license_number,
    state_region: row.state_region,
    markets_covered: row.markets_covered,
    source_tags: row.source_tags,
  })));
}

export async function applyBrokerPromotionPlan(
  client: PoolClient,
  plan: BrokerPromotionPlan,
): Promise<{ updated: number; inserted: number; stateOptions: Array<{ state: string; brokers: number }> }> {
  const recordShape = `
    id text, first_name text, last_name text, email text, phone text, brokerage text, company text,
    license_number text, contact_county text, contact_sector text, contact_specialty text,
    contact_confidence text, source_license_number text, state_region text, markets_covered text,
    source_tags text[]
  `;

  let updated = 0;
  if (plan.updates.length) {
    const result = await client.query(`
      UPDATE brokers AS b
      SET first_name = i.first_name,
          last_name = i.last_name,
          email = i.email,
          phone = i.phone,
          brokerage = i.brokerage,
          company = i.company,
          license_number = i.license_number,
          contact_county = i.contact_county,
          contact_sector = i.contact_sector,
          contact_specialty = i.contact_specialty,
          contact_confidence = i.contact_confidence,
          source_license_number = i.source_license_number,
          state_region = i.state_region,
          markets_covered = i.markets_covered,
          source_tags = i.source_tags,
          updated_at = NOW()
      FROM jsonb_to_recordset($1::jsonb) AS i(${recordShape})
      WHERE b.id = i.id
        AND b.owner_developer_profile_id IS NULL
      RETURNING b.id
    `, [jsonRows(plan.updates)]);
    updated = result.rowCount || 0;
    if (updated !== plan.updates.length) {
      throw new Error(`Expected to update ${plan.updates.length} shared brokers but updated ${updated}`);
    }
  }

  let inserted = 0;
  for (let start = 0; start < plan.inserts.length; start += 5000) {
    const batch = plan.inserts.slice(start, start + 5000);
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
    `, [jsonRows(batch)]);
    inserted += result.rowCount || 0;
    if ((result.rowCount || 0) !== batch.length) {
      throw new Error(`Expected to insert ${batch.length} shared brokers but inserted ${result.rowCount || 0}`);
    }
  }

  const states = await client.query<{ state: string; brokers: number }>(`
    SELECT UPPER(BTRIM(state_value)) AS state, COUNT(*)::int AS brokers
    FROM brokers
    CROSS JOIN LATERAL unnest(string_to_array(COALESCE(state_region, ''), ',')) AS state_value
    WHERE UPPER(BTRIM(state_value)) IN ('NC', 'TN')
    GROUP BY UPPER(BTRIM(state_value))
    ORDER BY state
  `);
  for (const expected of plan.preview.stateOptionsAfter) {
    const actual = states.rows.find((state) => state.state === expected.state)?.brokers || 0;
    if (actual !== expected.brokers) {
      throw new Error(`Post-import ${expected.state} state count mismatch: expected ${expected.brokers}, found ${actual}`);
    }
  }
  return { updated, inserted, stateOptions: states.rows };
}

export function summarizePromotionResult(
  plan: BrokerPromotionPlan,
  result: { updated: number; inserted: number; stateOptions: Array<{ state: string; brokers: number }> },
) {
  return {
    ...plan.preview,
    updated: result.updated,
    inserted: result.inserted,
    stateOptionsVerified: result.stateOptions,
  };
}
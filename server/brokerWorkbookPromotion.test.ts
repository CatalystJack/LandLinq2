import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrokerPromotionPlan,
  mergeAcrossStates,
  type ApprovedWorkbook,
  type BrokerImportRow,
} from "./brokerWorkbookPromotion";

function importRow(overrides: Partial<BrokerImportRow> = {}): BrokerImportRow {
  return {
    firstName: "Alex",
    lastName: "Broker",
    email: "alex@example.com",
    phone: null,
    brokerage: "Example Realty",
    company: "Example Realty",
    licenseNumber: "12345",
    county: "wake",
    sector: "commercial",
    specialty: "Commercial",
    confidence: "high",
    sourceLicenseNumber: "12345",
    sourceLicenseState: "NC",
    stateRegion: "NC",
    marketsCovered: "wake",
    sourceTags: ["Commercial"],
    ...overrides,
  };
}

function workbook(state: "NC" | "TN", rows: BrokerImportRow[]): ApprovedWorkbook {
  return {
    state,
    fileName: `${state}_approved.xlsx`,
    fileHash: `${state}-hash`,
    rows,
  };
}

const emptyRelatedCounts = {
  users: 0,
  deals: 0,
  companyCrmRows: 0,
  updatedBrokerCrmRows: 0,
};

test("cross-state email dedupe merges state coverage but preserves license-only distinct contacts", () => {
  const merged = mergeAcrossStates([
    workbook("NC", [importRow()]),
    workbook("TN", [
      importRow({ firstName: "Alex", sourceLicenseNumber: "98765", licenseNumber: "98765", stateRegion: "TN" }),
      importRow({ email: "different@example.com", sourceLicenseNumber: "12345", licenseNumber: "12345", stateRegion: "TN" }),
    ]),
  ]);

  assert.equal(merged.length, 2);
  const sharedEmail = merged.find((row) => row.email === "alex@example.com");
  assert.ok(sharedEmail);
  assert.equal(sharedEmail.stateRegion, "NC, TN");
  assert.equal(sharedEmail.sourceLicenseNumber, "12345");
  assert.equal(merged.find((row) => row.email === "different@example.com")?.stateRegion, "TN");
});

test("same license number in different states does not match a broker from the wrong state", () => {
  const plan = buildBrokerPromotionPlan(
    [
      workbook("NC", [importRow({ email: "nc@example.com", sourceLicenseNumber: "555", licenseNumber: "555" })]),
      workbook("TN", [importRow({ email: "tn@example.com", sourceLicenseNumber: "555", licenseNumber: "555", stateRegion: "TN" })]),
    ],
    [],
    emptyRelatedCounts,
  );

  assert.equal(plan.updates.length, 0);
  assert.equal(plan.inserts.length, 2);
  assert.deepEqual(plan.preview.stateOptionsAfter, [
    { state: "NC", brokers: 1 },
    { state: "TN", brokers: 1 },
  ]);
});

test("cross-state email merge uses its source license only for the source state", () => {
  const existingTennesseeBroker = {
    id: "tn-license-collision",
    first_name: "Taylor",
    last_name: "Different",
    email: "different@example.com",
    phone: null,
    brokerage: null,
    company: null,
    license_number: "12345",
    contact_county: null,
    contact_sector: null,
    contact_specialty: null,
    contact_confidence: null,
    source_license_number: "12345",
    state_region: "TN",
    markets_covered: null,
    source_tags: [],
  };
  const ncRow = importRow({ sourceLicenseNumber: "12345", licenseNumber: "12345" });
  const tnRow = importRow({
    email: "alex@example.com",
    sourceLicenseNumber: "98765",
    licenseNumber: "98765",
    sourceLicenseState: "TN",
    stateRegion: "TN",
  });
  const plan = buildBrokerPromotionPlan(
    [workbook("NC", [ncRow]), workbook("TN", [tnRow])],
    [existingTennesseeBroker],
    emptyRelatedCounts,
  );

  assert.equal(plan.updates.length, 0);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0].state_region, "NC, TN");
  assert.equal(plan.inserts[0].source_license_number, "12345");
  assert.equal(plan.preview.stateOptionsAfter.find((state) => state.state === "TN")?.brokers, 2);
});

test("shared email matches the original shared broker and preserves its existing state", () => {
  const existing = {
    id: "existing-broker",
    first_name: "A",
    last_name: "Broker",
    email: "alex@example.com",
    phone: null,
    brokerage: null,
    company: null,
    license_number: null,
    contact_county: null,
    contact_sector: null,
    contact_specialty: null,
    contact_confidence: null,
    source_license_number: null,
    state_region: "CA",
    markets_covered: null,
    source_tags: [],
  };
  const plan = buildBrokerPromotionPlan(
    [workbook("NC", [importRow()])],
    [existing],
    { ...emptyRelatedCounts, updatedBrokerCrmRows: 1, companyCrmRows: 4 },
  );

  assert.equal(plan.updates.length, 1);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.updates[0].state_region, "CA, NC");
  assert.equal(plan.preview.updatedByEmail, 1);
  assert.equal(plan.preview.companyCrmRowsPreserved, 1);
  assert.equal(plan.preview.companyCrmRowsUnchanged, 4);
});
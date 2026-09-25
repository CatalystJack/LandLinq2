import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSharedImportPlan,
  parseSharedBrokerWorkbook,
  type SharedImportMapping,
} from "./sharedBrokerStateImport";

const mapping: SharedImportMapping = {
  fullName: "Name",
  email: "Email",
  licenseNumber: "License #",
  stateRegion: "State",
  county: "County",
  sourceTags: "Tags",
};

test("parses a state list, skips invalid rows, and merges duplicate licenses", () => {
  const csv = [
    "Name,Email,License #,State,County,Tags",
    'Riley Gray,riley@example.com,SC-12,SC,Charleston,"multifamily; retail"',
    'Riley Gray,riley@example.com,SC-12,SC,Charleston,Multifamily',
    "Morgan Reed,not-an-email,SC-44,SC,Beaufort,retail",
    "Jamie Lee,jamie@example.com,KY-22,KY,Jefferson,retail",
  ].join("\n");
  const parsed = parseSharedBrokerWorkbook(Buffer.from(csv), "SC", mapping);

  assert.equal(parsed.sourceRows, 4);
  assert.equal(parsed.skippedRows, 2);
  assert.equal(parsed.duplicateRows, 1);
  assert.equal(parsed.rows.length, 1);
  assert.deepEqual(parsed.rows[0].sourceTags, ["multifamily", "retail"]);
  assert.equal(parsed.rows[0].contactCounty, "charleston");
});

test("plans shared-only license and email matches without overwriting private CRM fields", () => {
  const parsed = parseSharedBrokerWorkbook(Buffer.from([
    "Name,Email,License #,State,County,Tags",
    "Taylor North,taylor@example.com,SC-12,SC,Charleston,new tag",
    "Jordan South,jordan@example.com,KY-98,SC,Greenville,retail",
    "Avery West,avery@example.com,SC-71,SC,Beaufort,multifamily",
  ].join("\n")), "SC", mapping);
  const existing = [
    {
      id: "license-match",
      first_name: "Taylor",
      last_name: "North",
      email: "taylor@example.com",
      phone: null,
      brokerage: null,
      company: null,
      license_number: "old",
      contact_county: "charleston",
      contact_sector: "commercial",
      contact_specialty: null,
      contact_confidence: null,
      source_license_number: "SC-12",
      state_region: "SC",
      markets_covered: "Charleston",
      source_tags: ["existing"],
    },
    {
      id: "email-match",
      first_name: "Jordan",
      last_name: "South",
      email: "jordan@example.com",
      phone: null,
      brokerage: null,
      company: null,
      license_number: "KY-98",
      contact_county: "jefferson",
      contact_sector: "residential",
      contact_specialty: null,
      contact_confidence: null,
      source_license_number: "KY-98",
      state_region: "KY",
      markets_covered: "Jefferson",
      source_tags: ["existing tag"],
    },
  ];

  const plan = buildSharedImportPlan("SC", parsed, existing);
  assert.equal(plan.preview.updatedByLicense, 1);
  assert.equal(plan.preview.updatedByEmail, 1);
  assert.equal(plan.preview.inserted, 1);
  assert.equal(plan.preview.stateBrokersAfter, 3);
  const emailMerge = plan.updates.find((row) => row.id === "email-match");
  assert.equal(emailMerge?.state_region, "KY, SC");
  assert.equal(emailMerge?.contact_county, "jefferson, greenville");
  assert.deepEqual(emailMerge?.source_tags, ["existing tag", "retail"]);
  assert.equal(plan.inserts[0].id !== "email-match", true);
});

test("does not use a multi-state row's ambiguous source license as a state match", () => {
  const parsed = parseSharedBrokerWorkbook(Buffer.from([
    "Name,Email,License #,State,County,Tags",
    "Casey Example,,SC-88,SC,Charleston,",
  ].join("\n")), "SC", mapping);
  const existing = [{
    id: "multi-state",
    first_name: "Casey",
    last_name: "Example",
    email: null,
    phone: null,
    brokerage: null,
    company: null,
    license_number: "SC-88",
    contact_county: "charleston",
    contact_sector: null,
    contact_specialty: null,
    contact_confidence: null,
    source_license_number: "SC-88",
    state_region: "SC, KY",
    markets_covered: "Charleston",
    source_tags: [],
  }];

  const plan = buildSharedImportPlan("SC", parsed, existing);
  assert.equal(plan.preview.updatedByLicense, 0);
  assert.equal(plan.preview.inserted, 1);
});
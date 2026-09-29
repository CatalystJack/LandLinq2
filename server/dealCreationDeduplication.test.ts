import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("admin Investment Company deal creation reuses normalized-address matches", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const start = routes.indexOf('app.post("/api/admin/investment-companies/:profileId/deals"');
  const end = routes.indexOf('app.post("/api/admin/investment-companies/:profileId/pipeline/opportunities"', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const route = routes.slice(start, end);

  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /lower\(trim\(\$\{deals\.address\}\)\) = lower\(trim\(\$\{address\}\)\)/);
  assert.match(route, /reusedExistingDeal: Boolean\(existingDeal\)/);
  assert.match(route, /res\.status\(result\.reusedExistingDeal \? 200 : 201\)/);
});

test("external lead creation serializes and reuses normalized-address matches", () => {
  const routes = readFileSync(new URL("./externalApiRoutes.ts", import.meta.url), "utf8");
  const start = routes.indexOf('app.post("/api/v1/leads"');
  const end = routes.indexOf('// ── GET /api/v1/leads/:id', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const route = routes.slice(start, end);

  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /lower\(trim\(\$\{deals\.address\}\)\) = lower\(trim\(\$\{finalAddress\}\)\)/);
  assert.match(route, /reused_existing_lead: submission\.reusedExistingLead/);
  assert.match(route, /res\.status\(submission\.reusedExistingLead \? 200 : 201\)/);
});
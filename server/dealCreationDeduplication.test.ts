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

test("parsed-email external API uses explicit tenant routing and the existing intake processor", () => {
  const routes = readFileSync(new URL("./externalApiRoutes.ts", import.meta.url), "utf8");
  const pipeline = readFileSync(new URL("./automatedDealEmailPipeline.ts", import.meta.url), "utf8");
  assert.match(routes, /app\.get\("\/api\/v1\/investment-companies", requireApiKey/);
  assert.match(routes, /app\.post\("\/api\/v1\/deals\/parsed-email", requireApiKey, parsedDealApiLimiter/);
  assert.match(routes, /sourceEmailMessageId/);
  assert.match(routes, /pg_advisory_lock/);
  assert.match(routes, /processAutomatedDealEmailIntake\(intake\.id\)/);
  assert.match(pipeline, /intake\.targetDeveloperProfileId/);
  assert.match(pipeline, /externalSourceMessageId: intake\.sourceEmailMessageId/);
  assert.match(pipeline, /partnerDeveloperSends/);
});
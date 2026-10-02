import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("only inactive legacy Jack campaign templates are hidden from the template list", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const routeStart = routes.indexOf("app.get('/api/outreach/campaign-templates'");
  assert.notEqual(routeStart, -1);
  const nextRouteStart = routes.indexOf("\n  app.", routeStart + 1);
  const routeBody = routes.slice(routeStart, nextRouteStart === -1 ? undefined : nextRouteStart);

  assert.match(routeBody, /is_active = false/);
  assert.match(routeBody, /jack - known sophisticated/);
  assert.match(routeBody, /jack - unknown sophisticated/);
  assert.match(routeBody, /WHERE \$\{hideRetiredJackCampaigns\}/);
  assert.doesNotMatch(routeBody, /DELETE\s+FROM\s+drip_campaign_enrollments/i);
});

test("startup retirement disables exact legacy templates and removes their sender tags without deleting history", () => {
  const startup = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  const retirementStart = startup.indexOf("Retire only the two legacy Jack campaigns");
  assert.notEqual(retirementStart, -1);
  const retirementEnd = startup.indexOf("// Fix enrollments that were marked", retirementStart);
  assert.notEqual(retirementEnd, -1);
  const migration = startup.slice(retirementStart, retirementEnd);

  assert.match(migration, /UPDATE outreach_campaign_templates[\s\S]*?SET is_active = false/i);
  assert.match(migration, /UPDATE outreach_senders[\s\S]*?hubspot_trigger_tags = ARRAY/i);
  assert.match(migration, /jack - known sophisticated/);
  assert.match(migration, /jack - unknown sophisticated/);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});
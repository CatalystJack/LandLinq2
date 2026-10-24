import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCountyCoverage } from "../shared/outreach-county-coverage";

test("county coverage counts blank and missing counties without exposing recipient fields", () => {
  const summary = summarizeCountyCoverage([
    { county: "Wake", email: "private@example.invalid" } as any,
    { county: " " },
    {},
    { county: null },
  ]);
  assert.deepEqual(summary, {
    totalRecipients: 4,
    recipientsWithCounty: 1,
    recipientsMissingCounty: 3,
  });
  assert.equal("email" in summary, false);
});

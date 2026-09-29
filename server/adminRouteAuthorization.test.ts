import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { requirePlatformAdmin } from "./requirePlatformAdmin";

test("platform-admin middleware rejects a logged-in non-admin with 403", () => {
  let statusCode = 200;
  let responseBody: unknown;
  let continued = false;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  };

  requirePlatformAdmin(
    { user: { email: "broker@example.test", role: "BROKER" } },
    response,
    () => { continued = true; },
  );

  assert.equal(statusCode, 403);
  assert.deepEqual(responseBody, { error: "Apex Resi administrator access required" });
  assert.equal(continued, false);
});

test("each requested admin-only route is registered behind platform-admin middleware", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const protectedPaths = [
    "/api/crm/import-contacts",
    "/api/crm/import-assignments",
    "/api/crm/normalize-names",
    "/api/crm/contacts/strip-middle-names",
    "/api/crm/backfill-assigned-to",
    "/api/crm/bulk-tag",
    "/api/admin/backfill-qct-status",
    "/api/admin/backfill-oz-status",
    "/api/admin/backfill-dda-status",
    "/api/admin/backfill-government-data",
    "/api/admin/broker-portal/debug",
    "/api/admin/broker-portal/deal-queue",
  ];

  for (const routePath of protectedPaths) {
    const escapedPath = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const route = new RegExp(
      `app\\.(?:get|post)\\(\\s*['"]${escapedPath}['"]\\s*,\\s*isAuthenticated\\s*,\\s*requirePlatformAdmin\\s*,`,
    );
    assert.match(routes, route, `${routePath} must enforce login and platform-admin authorization`);
  }
});
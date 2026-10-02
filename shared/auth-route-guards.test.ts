import assert from "node:assert/strict";
import test from "node:test";
import { isProtectedWorkspacePath } from "./auth-route-guards";

test("developer workspace URLs require authentication without blocking branded login", () => {
  for (const path of [
    "/developer/home",
    "/developer/dashboard",
    "/developer/crm",
    "/developer/settings",
    "/dashboard",
    "/analytics",
    "/outreach-analytics",
    "/outreach-onboarding",
    "/dashboard/",
  ]) {
    assert.equal(isProtectedWorkspacePath(path), true, `${path} is an authenticated workspace`);
  }

  assert.equal(isProtectedWorkspacePath("/developer/acme/login"), false);
  assert.equal(isProtectedWorkspacePath("/developer/acme/login/"), false);
  assert.equal(isProtectedWorkspacePath("/privacy"), false);
  assert.equal(isProtectedWorkspacePath("/"), false);
});
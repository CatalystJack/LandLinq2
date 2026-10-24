import assert from "node:assert/strict";
import test from "node:test";
import { hasBotApiScope, isBotProfileAuthorized } from "./bot-api";

test("bot scopes deny operations not explicitly granted", () => {
  assert.equal(hasBotApiScope(["deals:read"], "deals:read"), true);
  assert.equal(hasBotApiScope(["deals:read"], "deals:upload"), false);
  assert.equal(hasBotApiScope(undefined, "developer_profiles:read"), false);
});

test("bot keys are bound to exactly one developer profile", () => {
  assert.equal(isBotProfileAuthorized("profile-a", "profile-a"), true);
  assert.equal(isBotProfileAuthorized("profile-a", "profile-b"), false);
  assert.equal(isBotProfileAuthorized(null, "profile-a"), false);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("authenticated temporary-password users are redirected to a valid one-time reset URL", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const pageGateStart = routes.indexOf("// Login-only page gate.");
  assert.notEqual(pageGateStart, -1);
  const gateStart = routes.indexOf("if (req.user?.mustResetPassword === true) {", pageGateStart);
  assert.notEqual(gateStart, -1);
  const gateEnd = routes.indexOf("if (role === 'DEVELOPER'", gateStart);
  const gate = routes.slice(gateStart, gateEnd === -1 ? undefined : gateEnd);

  assert.match(gate, /req\.user\?\.mustResetPassword === true/);
  assert.match(gate, /generateForcedResetToken\(req\.user\.email\)/);
  assert.match(gate, /requestedToken !== token/);
  assert.match(gate, /res\.redirect\(`\/reset-password\?token=/);
  assert.match(gate, /return res\.status\(503\)/);
});

test("temporary-password accounts cannot use application APIs before completing reset", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const gateStart = routes.indexOf("Temporary-password accounts may only");
  assert.notEqual(gateStart, -1);
  const gateEnd = routes.indexOf("setupGlobalRateLimit(app);", gateStart);
  assert.notEqual(gateEnd, -1);
  const gate = routes.slice(gateStart, gateEnd);

  assert.match(gate, /req\.user\?\.mustResetPassword !== true/);
  assert.match(gate, /req\.path === '\/api\/user'/);
  assert.match(gate, /req\.path === '\/api\/logout'/);
  assert.match(gate, /req\.path\.startsWith\('\/api\/password-reset\/'\)/);
  assert.match(gate, /resetRequired:\s*true/);
});

test("unauthenticated workspace URLs reach the client sign-in guard instead of the public home redirect", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const gateStart = routes.indexOf("// Login-only page gate.");
  assert.notEqual(gateStart, -1);
  const gateEnd = routes.indexOf("  });\n\n  // Investment Company deal isolation", gateStart);
  assert.notEqual(gateEnd, -1);
  const gate = routes.slice(gateStart, gateEnd);

  assert.match(routes, /import \{ isProtectedWorkspacePath \} from "@shared\/auth-route-guards"/);
  assert.match(gate, /if \(isPublicPath\) return next\(\);[\s\S]*?if \(isProtectedWorkspacePath\(req\.path\)\) return next\(\);[\s\S]*?if \(isDocumentRequest\) return res\.redirect\('\/'\);/);
});
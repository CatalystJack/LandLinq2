---
name: VM HTTPS readiness probes
description: How public HTTPS enforcement must coexist with Replit Reserved VM readiness checks.
---

Production HTTPS redirects must exempt direct loopback-host requests while still redirecting public HTTP hosts.

**Why:** Replit's Reserved VM readiness checker requests the container root over plain HTTP with a loopback Host header. Redirecting it to HTTPS makes the checker attempt TLS against the app's plain HTTP port, so a successful build waits for readiness and eventually fails promotion.

**How to apply:** When changing security middleware, retain the loopback exemption and verify both sides in production mode: a loopback-host request to `/` returns 200, while a public host without an HTTPS forwarded protocol returns a redirect.
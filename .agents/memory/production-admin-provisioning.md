---
name: Production admin provisioning
description: Why an Apex administrator in development may still be absent from an existing production database.
---

Do not assume that creating a user in development will add that user to an already-provisioned production database. The initial Apex administrator is provisioned during login only when the exact account is absent and the submitted password matches the dedicated bootstrap password secret.

**Why:** Development and production data are isolated. Startup-time provisioning must not be awaited before static serving: a slow production database query left Express reachable but without its root-page handler, producing "Cannot GET /".

**How to apply:** For first production access, confirm the account separately in both environments. Keep the bootstrap password in Replit Secrets, never logs or source, provision only the exact authorized email during login, and store only its scrypt hash.
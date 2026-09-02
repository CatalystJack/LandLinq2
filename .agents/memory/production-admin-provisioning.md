---
name: Production admin provisioning
description: Why an Apex administrator in development may still be absent from an existing production database.
---

Do not assume that creating a user in development will add that user to an already-provisioned production database. The initial Apex administrator is provisioned on production startup only when the exact account is absent and the dedicated bootstrap password secret is configured.

**Why:** Development and production data are isolated. A valid development administrator still produced "Invalid email or password" in the published app because production had no matching user row.

**How to apply:** For first production access, confirm the account separately in both environments. Keep the bootstrap password in Replit Secrets, never logs or source, and store only its scrypt hash in the user record.
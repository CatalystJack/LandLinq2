---
name: Publishing schema drift
description: Replit publishing can detect additive production schema drift even when runtime startup paths create the missing objects.
---

A successful application build does not guarantee a successful publish: Replit may separately compare development and production database schemas and require additive changes to be applied. Treat a failed republish with no failed build record as a publish/schema-sync issue first.

**Why:** This project intentionally keeps the general migration runner disabled and uses narrow idempotent startup schema paths, so runtime and publishing schema state can diverge.

**How to apply:** Check deployment build history and explainSchemaDiff before changing application code. If the diff has no removals or destructive operations, approve the additive schema changes in the Publishing UI; do not assume the broker import or frontend build caused the failure.
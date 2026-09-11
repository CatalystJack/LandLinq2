---
name: Runtime schema migrations
description: The general migration manager is intentionally disabled during startup, so required schema changes need an idempotent runtime setup path.
---

The project's general migration runner is disabled to avoid startup migration warnings. New runtime tables cannot rely on `migrationManager.migrate()` alone; they need an idempotent startup schema statement or an explicitly executed migration path.

**Why:** A migration can be present in `server/database/migrations.ts` yet never run in the deployed process, causing the first request that uses the new table to fail.

**How to apply:** For required application tables, keep the migration definition for documentation/rollback and also ensure the live startup initialization creates the table and indexes safely with `IF NOT EXISTS`.
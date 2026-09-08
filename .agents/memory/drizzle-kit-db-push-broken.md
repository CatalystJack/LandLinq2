---
name: drizzle-kit db:push broken in this repo
description: This repo's Drizzle CLI rejects unsupported extension filters and can pause on data-preserving constraint prompts in noninteractive setup.
---

This repo uses Drizzle Kit 0.31.4. Its `extensionsFilters` config only accepts supported filters such as `postgis`; listing `pg_stat_statements` causes `drizzle-kit push` to fail with “Please provide required params” even when `DATABASE_URL` is set. After that is removed, `push` can still present per-table truncate-choice prompts while adding unique constraints, which do not behave reliably with closed stdin.

**Why:** The installed CLI validates extension filters more narrowly than the project config expected, and its interactive selector is not safe to depend on inside post-merge automation.

**How to apply:** Keep `drizzle.config.ts` limited to filters supported by the installed CLI. Treat post-merge `db:push` as a development-only best effort when it encounters interactive constraint prompts; for deliberate schema changes, update `shared/schema.ts` and apply reviewed development DDL directly, then verify the schema before relying on the ORM.

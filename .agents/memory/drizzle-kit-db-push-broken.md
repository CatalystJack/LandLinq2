---
name: drizzle-kit db:push broken in this repo
description: db:push fails with "Please provide required params" even with correct drizzle config; use raw SQL instead for schema changes.
---

Running `drizzle-kit push` (or the npm script wrapping it) in this repo fails with an error like "Please provide required params", even when `drizzle.config.ts` looks correctly configured and `DATABASE_URL` is set.

**Why:** Root cause not fully diagnosed (likely a drizzle-kit CLI/env-detection quirk in this project's setup); not worth re-investigating each time since raw SQL is fast and reliable.

**How to apply:** When you need to add/alter columns or tables, skip `db:push` and run the DDL directly, e.g.:
`psql "$DATABASE_URL" -c "ALTER TABLE some_table ADD COLUMN IF NOT EXISTS new_col text;"`
Still update `shared/schema.ts` (Drizzle table definitions) to match, so the ORM/type layer stays in sync — just don't rely on `db:push` to apply it.

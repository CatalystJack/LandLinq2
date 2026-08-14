---
  name: Drizzle select field must belong to referenced table
  description: A .select({...}) field referencing a same-named column from the wrong pgTable object crashes drizzle-orm at runtime with "Cannot convert undefined or null to object", not a TypeScript error.
  ---

  When building a drizzle .select({ alias: table.column }) object, if `column` doesn't
  actually exist on `table` (e.g. copy-pasted from a similarly-named column on a
  different table), the reference evaluates to `undefined` at runtime.

  TypeScript often does NOT catch this if the table's inferred type is loose/wide
  (e.g. many optional/loosely-typed columns), so `npx tsc --noEmit` can pass clean.

  At runtime, drizzle-orm's internal `orderSelectedFields` tries to recurse into the
  undefined value as if it were a nested selection object, throwing:
    TypeError: Cannot convert undefined or null to object
    at .../drizzle-orm/utils.js orderSelectedFields

  **Why this matters:** this class of bug is silent in dev if the affected code path
  isn't exercised, and can ship to production creating a completely broken endpoint
  (e.g. an admin inbox/outbox screen appearing "empty" because the API 500s and the
  frontend falls back to an empty array) even though the underlying DB data is fine.

  **How to apply:** when an endpoint that assembles a wide multi-table select() result
  returns empty/missing data despite confirmed rows in the DB, check server logs for
  "Cannot convert undefined or null to object" from drizzle-orm — it means one of the
  select fields references a column that doesn't belong to that table. Verify each
  field's source column actually falls within that table's own `pgTable(...)` block
  in shared/schema.ts (many tables reuse common column names like imageUrls,
  productTypes, email, etc. across different tables).
  
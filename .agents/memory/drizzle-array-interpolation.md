---
name: Drizzle array interpolation
description: Safe construction of PostgreSQL IN lists and array parameters in Drizzle SQL fragments.
---

Do not interpolate a JavaScript array into a Drizzle tagged SQL fragment and cast it as a PostgreSQL array. In this project that produced a record value and failed with “cannot cast type record to text[].” Use `inArray` for ORM predicates, or `sql.join(items.map((item) => sql\`${item}\`), sql`, `)` when raw SQL needs an `IN (...)` list.

**Why:** Exact synthetic-fixture cleanup must be atomic and count-checked; the failed array cast rolled the transaction back and left the fixture behind.

**How to apply:** Prefer `inArray` for table columns. For raw SQL membership lists, bind each value separately with `sql.join`; do not substitute a JavaScript array into `ANY(...::text[])`.
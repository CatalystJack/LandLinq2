---
name: Production fake-data cleanup
description: Safety rules for removing demo, test, or seeded records from production.
---

Delete production demo/test data only from an audited set anchored to immutable owner or record identities. Remove known dependent rows before parents in a single transaction, and make the operation idempotent.

**Why:** Broad address/note matching can delete legitimate customer records, while unordered foreign-key traversal can fail midway. A rollback-only rehearsal exposed schema and dependency assumptions before production.

**How to apply:** Audit production read-only first, use exact identities or exact demo ownership, enumerate non-cascading dependencies, validate the full transaction with rollback, and verify zero remaining records after execution.
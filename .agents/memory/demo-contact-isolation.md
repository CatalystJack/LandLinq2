---
name: Demo contact isolation
description: Preventing standalone demo records from leaking into real company tenant views.
---

Demo-seeded brokers use the same null-owner shape as legitimate shared-network contacts, but they must always be excluded from real Investment Company CRM and Pipeline queries.

**Why:** Null ownership alone does not distinguish real shared contacts from contacts seeded for the standalone demo account, so a new tenant can otherwise appear to contain fake CRM data.

**How to apply:** Any tenant feature that permits null-owner/shared brokers must also exclude brokers owned by the demo account. Preserve legitimate shared-network contacts and tenant-owned contacts.
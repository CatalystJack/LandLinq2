---
name: Broker import promotion
description: Replit's publish-time development-data initialization replaces the whole production database and cannot safely promote only broker rows.
---

Bulk broker imports run against the development database unless they are intentionally executed against the production target. The Publish option to initialize production from current development data copies the whole database and overwrites existing production records; it is not a targeted broker promotion.

**Why:** Replit's publishing guidance confirms that initialization overwrites existing production data. Using it for a broker-only update could replace tenant CRM data and violate the shared-broker-only boundary.

**How to apply:** After a development import, inspect production read-only counts and source-option data. If production has existing data, do not use the whole-database initialization option. Promote only through an explicitly targeted path that preserves the importer’s matching logic and restricts writes to shared rows (`owner_developer_profile_id IS NULL`), then verify `/api/crm/source-tags` with authentication. If no such path exists, leave production unchanged and ask before adding one.
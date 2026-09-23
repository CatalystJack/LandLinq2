---
name: Broker import promotion
description: The production CRM database is separate from development and needs explicit publish-time data initialization after bulk broker imports.
---

Bulk broker imports run against the development database unless they are intentionally executed against the production target. The published CRM can therefore return empty source tags and sectors even when development contains the imported directory. During publishing, use the production database option to initialize production with the current development data, then verify the live options endpoint.

**Why:** A post-import endpoint check showed the deployed app querying an older production snapshot while the development database contained the new broker directory.

**How to apply:** After any live-directory import, compare development and production broker counts/timestamps before changing endpoint or UI code. If production is stale, promote the current development data through the supported publishing flow and confirm the published endpoint afterward.
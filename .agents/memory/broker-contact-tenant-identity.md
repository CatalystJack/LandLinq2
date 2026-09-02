---
name: Broker contact tenant identity
description: Ownership and lookup boundaries after broker emails became reusable across developer profiles.
---

Developer-owned broker contacts are identified by owner profile plus email, not email globally. Shared LandLinq contacts remain NULL-owner records.

**Why:** Investment Companies must be able to import an email that already exists in the shared network or another company without overwriting that record. Once emails are reusable, unscoped legacy email or phone matching could otherwise select and mutate a private tenant contact.

**How to apply:** Enforce uniqueness for non-NULL owner/email pairs. Developer reads and writes must use the session profile. Any legacy/global intake, account-linking, email, or phone lookup must explicitly restrict matching to NULL-owner brokers.
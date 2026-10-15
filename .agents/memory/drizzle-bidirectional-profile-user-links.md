---
name: Bidirectional Drizzle profile-user links
description: Avoid TypeScript inference cycles when adding reverse references between profiles and users.
---

When a profile table already points to the user table through a user-owned profile field, do not add a Drizzle `.references(() => users.id)` on the profile's account-manager field. Keep the Drizzle column scalar and create its foreign-key constraint in the idempotent startup SQL migration.

**Why:** The mutual table-reference callbacks can make TypeScript infer the profile table through its own initializer. The database still needs referential integrity, but that does not require both references in the Drizzle table declarations.

**How to apply:** Use this when adding a profile-to-user assignment in a schema where `users` already references the profile table. Keep the nullable `ON DELETE SET NULL` constraint in the runtime schema migration.

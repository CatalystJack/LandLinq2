---
name: Apex email authorization migration
description: Boundary between migrated Apex access checks and intentionally preserved legacy Catalyst references.
---

Internal team authorization and classification must use strict email-suffix matching for `@apexresi.com`. Person-specific Jack gates use `jack@apexresi.com`.

**Why:** Catalyst-domain access was migrated to Apex, but old Catalyst addresses still serve legitimate demo accounts, historical identity maps, notification recipients, inbound-email routing, and test fixtures. Replacing those indiscriminately would change data and delivery behavior rather than authorization.

**How to apply:** For access-control work, reject substring matching and use a strict Apex suffix. Preserve `DEVELOPER` role and `developerProfileId` scoping. Treat remaining Catalyst addresses as non-auth references requiring a separate audit before changing them.
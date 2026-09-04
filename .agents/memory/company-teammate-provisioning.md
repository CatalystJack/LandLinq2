---
name: Company teammate provisioning
description: Authorization policy for adding and managing Investment Company and General Sales portal users.
---

Investment Company and General Sales users may view their company roster and request teammate additions, but they must never create, invite, edit, or remove company accounts themselves. LandLinq/Apex staff review requests and perform account management through the internal administration surface.

**Why:** The user requires centralized approval and manual control over every company portal account.

**How to apply:** Any current or future tenant-facing team UI must remain read-only except for a request action. Enforce the restriction on backend account-management routes as well as in the interface; do not rely on hidden buttons.
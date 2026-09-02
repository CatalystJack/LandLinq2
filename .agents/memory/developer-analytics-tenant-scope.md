---
name: Developer analytics tenant scope
description: Tenant-isolation rules for Investment Company deal and outreach analytics.
---

Investment Company analytics must derive classification and pursuing state from the profile-specific partner send. A legacy developer association may be used only when that send has no explicit profile owner.

Outreach totals must be linked to both a sender and a campaign owned by the authenticated developer profile; sender ownership alone is not sufficient.

**Why:** Legacy associations and shared outreach records can otherwise mix another Investment Company's status or engagement data into the current tenant's dashboard.

**How to apply:** For developer analytics and reporting, resolve the profile from the session, prefer explicit profile ownership over legacy associations, and require both sender and campaign ownership when aggregating events.
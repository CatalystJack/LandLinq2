---
name: Shared broker CRM boundary
description: Shared LandLinq broker identity is visible by company settings, while CRM state is stored per developer profile.
---

Shared broker records must be filtered by each Investment Company's sector and county settings. Tags, notes, assignments, last-contacted state, and outreach state must be read and written through a company-scoped relationship rather than the global broker identity row.

**Why:** Multiple companies are intentionally allowed to work from the same LandLinq broker directory, but a company's private CRM context must not become visible to another company or be overwritten by another company's edits.

**How to apply:** For new broker CRM reads and writes, derive the developer profile from the authenticated session, apply the persisted visibility filters to shared records, and use the per-profile CRM state for private fields.
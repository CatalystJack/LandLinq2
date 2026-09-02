---
name: Developer import address dedup
description: Tenant-isolation rule for Investment Company spreadsheet imports that match an existing address.
---

When a developer import matches an existing global deal by normalized address, reuse the canonical deal but do not overwrite its fields unless the authenticated developer profile already owns the corresponding send relationship.

**Why:** Deals are shared canonical records. Global address dedup combined with unconditional updates would let one Investment Company alter deal data seen by another tenant.

**How to apply:** Derive the profile only from the authenticated session. Check profile/deal ownership before updating an address match; otherwise link the existing deal to the importing profile and compute that profile's classification without mutating canonical fields.
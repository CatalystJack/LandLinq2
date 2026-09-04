---
name: Company removal policy
description: The agreed lifecycle behavior when an admin removes an Investment, Development, or General Sales company.
---

Company removal is reversible deactivation, not hard deletion. Deactivation must block new logins, invalidate active developer access, and prevent new team invitations while preserving all company records and accounts.

**Why:** The chosen policy prioritizes preserving CRM, Pipeline, deal, campaign, analytics, settings, and account history so the company can be reactivated safely.

**How to apply:** Use the profile active state as the access gate across generic login, branded login, authenticated developer APIs, and invitation creation. Apex admins must retain visibility and a Reactivate action.
---
name: Organization unsubscribe policy
description: Scope for organization-level one-click unsubscribe links and contact safety behavior.
---

Organization-level unsubscribe links belong on recipient-facing mail sent through a developer company’s connected sender, not on LandLinq platform account, password-reset, or internal transactional mail.

**Why:** The setting controls a company’s outreach consent boundary. Adding it to platform administrative messages would make unrelated mail appear to be company marketing, while omitting it from developer-routed recipient mail would make the setting unreliable.

**How to apply:** Keep the setting off by default, require a signed broker-scoped token for one-click links, mark the broker inactive, disable SMS opt-in, add a clear unsubscribe tag, and cancel pending or in-progress outreach without deleting CRM history.
---
name: Outreach trigger-tag tenant boundary
description: Tenant-isolation rules for CRM tag-based campaign enrollment.
---

Investment Company trigger-tag enrollment must resolve the campaign, campaign template, sender, and broker through the same developer profile. Only brokers owned by that profile are eligible; shared contacts are not part of developer tag enrollment.

Catalyst tag and assigned-sender enrollment must only consider shared contacts and must exclude templates linked to developer-owned campaigns.

**Why:** Trigger-tag strings are contact data, not tenant identifiers. Matching on the tag alone can enroll another company’s contacts or route Catalyst contacts through an Investment Company campaign.

**How to apply:** Any new enrollment query or scheduler path must enforce the ownership relationship on every participating record, not just filter the final broker list.
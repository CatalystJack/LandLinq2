---
name: Shared automated YOC baseline
description: Automated YOC, IRR, and projected underwriting fields live on the shared deals row and must not be overwritten by a tenant's private assumptions.
---

The shared automated underwriting columns represent a deterministic platform-default baseline. A developer profile may be passed explicitly to calculate a company-specific view, but that calculation must be returned to the caller without persisting its private preset values to the shared deals row.

**Why:** A deal can be sent to multiple Investment Companies with different product-type presets, while the persisted automated fields are single-valued. Inferring a profile from an unordered send relationship makes the visible result depend on query order and leaks one company's assumptions into another company's view.

**How to apply:** Background and canonical deal updates should recompute without a developer profile. Add or use a separate profile-scoped response/view when a tenant needs its private underwriting assumptions; never use a profile-specific calculation as the shared persisted baseline.
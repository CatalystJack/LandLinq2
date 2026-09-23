---
name: Industrial asset-class onboarding
description: Industrial partners use a separate asset class and configurable screening criteria while multifamily keeps rent and automatic YOC underwriting.
---

Industrial Investment Company profiles must remain distinct from multifamily profiles: store site-screening criteria independently, keep unresolved geometry, entitlement, labor, wetland, and utility checks as manual/unknown, and do not run automatic YOC underwriting.

**Why:** Industrial underwriting methodology is not yet defined, and presenting multifamily rent/YOC outputs would create unsupported investment conclusions.

**How to apply:** Extend the industrial criteria model and screening evidence independently; preserve the multifamily product-type and YOC path unchanged unless the partner explicitly defines industrial underwriting rules.

Industrial acreage screening uses a nested default plus target-state overrides; multifamily product types use the same state-aware fallback pattern for acreage and rent. The retired profile-level acreage override field is not part of the active API or classification model.

**Why:** Screening thresholds vary by market, while the old profile-level field was unused and could not represent product-type-plus-state criteria safely.

**How to apply:** Resolve an override for the deal state first, fall back field-by-field to the flat/default criteria, and restrict saved override states to the company’s configured target states.
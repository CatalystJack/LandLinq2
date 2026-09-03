---
name: General Sales profile criteria
description: How General Sales profiles coexist with legacy non-null real-estate criteria columns.
---

General Sales profiles must behave as though they have no acquisition criteria: no product types, geographic targeting, rent thresholds, deal dashboard, classification, or deal routing.

**Why:** Legacy profile columns for rent metric and minimum acreage are non-null and are still read by older real-estate paths. Making those columns nullable would create a much broader migration and compatibility risk.

**How to apply:** Store harmless compatibility values (`psf` and `0`) for those legacy columns, but never expose or interpret them as General Sales criteria. Branch on `profileType` before validation, classification, routing, navigation, and settings rendering.
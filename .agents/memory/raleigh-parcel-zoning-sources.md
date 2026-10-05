---
name: Raleigh parcel and zoning source behavior
description: Verified query and freshness limits for Wake County parcels and Raleigh zoning GIS.
---

For Wake County parcels, a point-geometry ArcGIS query returned no features at a tested Raleigh coordinate, while a small WGS84 envelope query returned the intersecting parcel. Do not select the first envelope-intersecting parcel: require the submitted point to lie inside exactly one returned polygon, and treat boundaries or multiple matches as unknown.

The Wake County parcel layer does not expose a per-record update date. A live lookup timestamp is not the parcel record's vintage. Raleigh zoning is published as a MapServer layer; its FeatureServer path was unavailable in verification. Zoning features include an effective date that must remain separate from the lookup timestamp.

**Why:** Nearby parcel polygons can share an envelope with a deal coordinate, and lookup recency does not prove that the underlying parcel record is current.

**How to apply:** Keep coordinate-only queries bounded; verify parcel containment before saving a PIN; preserve ambiguous, boundary, and no-coverage states; show the lookup time separately from parcel vintage and zoning effective date. Never turn a mapped zoning code into an entitlement decision.

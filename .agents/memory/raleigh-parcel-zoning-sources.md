---
name: Raleigh parcel and zoning source behavior
description: Verified query and freshness limits for Wake County parcels and Raleigh zoning GIS.
---

The active Wake County pilot uses the county's ArcGIS FeatureServer parcel layer and its Planning/Zoning FeatureServer layer named Raleigh Zoning. These are distinct from the similarly named City of Raleigh MapServer. Verify the host and layer metadata before switching providers.

Match a parcel only by exact PIN or one unique exact structured situs-address match. Query zoning against the matched parcel polygon, not a geocoded point. Multiple parcel or zoning matches remain ambiguous.

The Wake County parcel layer does not expose a per-record update date. A live lookup timestamp is not the parcel record's vintage. Raleigh zoning features include an effective date that must remain separate from the lookup timestamp.

**Why:** Similar service names across separate county and city GIS hosts led to conflicting endpoint assumptions. Nearby parcel polygons can also share an envelope with a deal coordinate, while lookup recency does not prove that a source record is current.

**How to apply:** Confirm the live service host, layer name, fields, and query behavior before relying on an ArcGIS endpoint. Preserve ambiguous, no-coverage, and failed-source states; show lookup time separately from parcel vintage and zoning effective date. Never turn a mapped zoning code into an entitlement decision.

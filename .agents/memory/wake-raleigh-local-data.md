---
name: Wake/Raleigh parcel pilot
description: The verified pilot geography and source boundaries for local parcel and zoning screening.
---

Use Wake County, North Carolina parcels as the initial countywide parcel source, with zoning checks limited to Raleigh's zoning jurisdiction. Match only an exact PIN or a unique exact structured situs address. Query zoning against the matched parcel polygon; do not use a geocoded point as the parcel join. Keep multiple parcel or zoning matches ambiguous.

Wake County GIS documents daily end-of-business-day parcel updates but does not provide per-record edit timestamps, so display the app's retrieval time. Raleigh zoning features carry effective dates, but no regular refresh interval is published; display the effective date and retrieval time separately. Raleigh Water's mapped sewer assets are discovery references only and do not establish parcel connection, water service, capacity, or availability.

**Why:** Exact parcel identity and polygon intersection were verified against the authoritative GIS sources. Point-only matching can miss a parcel, and mapped utility proximity is not service evidence.

**How to apply:** Keep this pilot's coverage and match rules visible in Data Hub and deal screening. Do not extend zoning or utility claims beyond verified source coverage, and never convert a missing local result into a pass.
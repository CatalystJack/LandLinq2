---
name: Industrial site scoring data boundaries
description: Industrial green/yellow/red screening needs parcel geometry, route-based catchments, authoritative entitlement, and utility evidence; point and tract proxies are not sufficient.
---

Industrial site screening must keep pass, fail, and unknown separate. Parcel acreage, centroid distance, tract population, point slope samples, generic zoning text, or simulated GIS booleans cannot establish geometry fit, drive-time labor thresholds, stream crossings, utility capacity, or legal entitlement.

**Why:** Those proxies can produce a confident-looking color while missing a hard constraint such as an unusable parcel shape, a route barrier, or unavailable power.

**How to apply:** Require source geometry and provenance for parcel/site tests, route-based aggregation for travel-time tests, authoritative local zoning/plan evidence for entitlement, and utility-provider or interconnection evidence for power. Treat unresolved mandatory inputs as yellow/manual verification rather than red unless the business rule explicitly defines unknown as failure.
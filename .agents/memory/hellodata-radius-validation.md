---
name: HelloData radius validation
description: Why comparable distance must be recomputed against the current subject for live and cached searches.
---

For HelloData comparable searches, validate every returned property's coordinates against the current subject with Haversine distance. Require valid coordinates, use the recomputed distance in results, and reject a cached result if any comparable is missing coordinates or outside the requested radius. Do not partially filter a cached result because its summary and metrics describe the full list.

**Why:** Provider-reported distances may be unreliable or relative to a previous search center. A cache-center check only proves the old search was nearby; it does not prove each property is within radius of the current subject.

**How to apply:** Enforce coordinate-based distance validation on warehouse cache hits and all live comparable paths, including details failures and map fallbacks. Keep provider distance values informational only.
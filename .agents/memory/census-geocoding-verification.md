---
name: Census geocoding verification
description: Safeguards for turning Census address matches into deal coordinates.
---

Only accept a Census geocoder match when its returned state, supplied county, and supplied ZIP agree with the submitted location. Reject multiple distinct coordinate matches rather than choosing one.

**Why:** The geocoder can return a plausible nearby match with a different ZIP, which would silently assign the wrong tract and county context.

**How to apply:** Reuse the verified matcher for address-to-coordinate lookups and preserve an unresolved status instead of falling back to a nearby candidate.
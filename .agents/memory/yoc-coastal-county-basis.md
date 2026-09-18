---
name: YOC coastal county basis
description: Authoritative county coverage and the unresolved South Carolina statewide treatment for YOC coastal pricing.
---

The YOC automatic coastal helper uses the NOAA ENOW county footprint for North Carolina, South Carolina, and Georgia, including NOAA's marked inland watershed rows. Florida and South Carolina remain statewide coastal for now.

**Why:** The county designation is intentionally broad enough to create parcel-level false positives, which is why analyst overrides are required. South Carolina's existing statewide behavior was retained because changing it would alter established underwriting results without team confirmation.

**How to apply:** Keep the county list synchronized between server calculations and the analyst hint. If the team chooses county-only South Carolina treatment, remove the statewide shortcut deliberately and validate the resulting YOC changes.
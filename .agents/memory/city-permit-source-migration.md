---
name: City permit source migration
description: Public building-permit data sources and their current limitations for nearby-permit enrichment.
---

Use the current official ArcGIS layers for Nashville and Raleigh. The older Socrata resource URLs return an ArcGIS Hub unsupported page rather than JSON. Atlanta's referenced official item is a CSV published through ArcGIS and must be filtered locally; its current data is historical and may produce zero records for a modern trailing-12-month window.

**Why:** Public-city data portals can migrate without preserving the old API hostname, and silently treating an HTML migration page as permit data would create false counts.

**How to apply:** Verify the live metadata/fields before changing adapters. Return an explicit unavailable/error status when a city source is not verified instead of fabricating a fallback or displaying a blank count.
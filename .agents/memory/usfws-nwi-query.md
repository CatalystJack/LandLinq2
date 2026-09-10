---
name: USFWS NWI query behavior
description: Operational behavior of the public USFWS National Wetlands Inventory ArcGIS service used for enrichment.
---

The USFWS National Wetlands Inventory public ArcGIS layer can be slow or return provider timeouts/503 responses for point and near-site queries, so enrichment must treat it as an optional source.

**Why:** Live checks showed FEMA and EPA responding while the NWI service exceeded the request timeout or returned a wait-timeout response.

**How to apply:** Keep NWI calls bounded by an explicit timeout, persist successful results independently, and never let NWI failure block deal creation or classification.
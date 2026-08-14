---
name: deals.comparables_json field shape
description: Actual camelCase key names stored inside deals.comparables_json array entries, needed when rendering or reading individual comps.
---

`deals.comparables_json` (jsonb array) entries use camelCase keys, not the snake_case names you'd guess from column naming conventions elsewhere in the schema:

`propertyName`, `address`, `yearBuilt`, `unitCount`, `distance` (miles, float), `rentPSF`, `rentPerUnit`, `latitude`, `longitude`, `isQualifying`.

**Why:** This structure is written by the HelloData comparable-search integration, which uses its own camelCase convention, independent of the mostly snake_case-ish naming used for top-level deal columns. Guessing snake_case keys (e.g. `property_name`, `year_built`, `rent_psf`) silently renders nothing since the fields don't exist.

**How to apply:** When adding UI or backend code that reads individual comps from `comparables_json` (as opposed to the aggregate `comparable_count`/`comparable_notes`/`top_rent_psf` fields), use the exact camelCase keys above.

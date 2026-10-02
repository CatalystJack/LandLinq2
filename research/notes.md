# Research Notes: Free APIs for Industrial Site Screening

**Status:** complete  
**Depth:** Quick

## Plan

- **Question:** Which no-cost APIs and public GIS sources can screen the supplied industrial parcel, environmental, access, utility, entitlement, and labor criteria?
- **Scope:** U.S. sources; distinguish API availability, free-tier limits, geographic coverage, and checks that still need authoritative local confirmation.
- **Audience:** LandLinq product and engineering team.
- **Deliverable:** A sourced recommendation for a practical free screening stack and its reliability limits.

## Focus Areas

| # | Area | Status | Sources |
|---|---|---|---|
| 1 | Parcel geometry, terrain, streams/wetlands, and interstate access | done | 14 |
| 2 | Entitlement and electric utility capacity | done | 8 |
| 3 | Drive-time population, unemployment, and technical/community colleges | done | 15 |

## Coverage Checklist

- [x] Free parcel polygons are fragmented by state/county; Regrid's nationwide free offer is a tile layer, not a full free analysis API [@regrid-parcel-tile].
- [x] USGS 3DEP, 3DHP, and FWS NWI provide free screening layers; footprint fit and crossings still require GIS analysis [@usgs-3dep] [@usgs-3dhp] [@fws-nwi-rest].
- [x] Census TIGER/Line Roads includes ramps; distance must be measured to a ramp/access point, not the interstate centerline [@census-tiger-roads].
- [x] ORS free Standard supports 30/45-minute driving isochrones within its daily and per-request limits; Census ACS supplies block-group population estimates for overlay [@ors-free-plan] [@ors-restrictions] [@census-acs-2024].
- [x] BLS LAUS offers county/metro/city unemployment, not a custom isochrone rate; NCES/College Scorecard supplies institution records for routed proximity screening [@bls-laus] [@college-scorecard].
- [x] No free national API was found for authoritative plan/zoning entitlement or site-specific industrial power capacity; NZA data requires licensing and DOE maps are incomplete and non-site-specific [@nza-terms] [@nza-data-access] [@doe-hosting-capacity] [@eia-electricity-data].
- [x] Physical/labor checks can be preliminary automated screens; missing parcel, regulatory, or utility evidence must remain unknown/manual [@usgs-3dep] [@fws-nwi-rest] [@doe-hosting-capacity].

## Findings Log

### Physical site and access

- Use local assessor parcel polygons for area and box-fit tests; the free Regrid layer is for map display, not a substitute for an analysis-ready parcel API [@regrid-parcel-tile].
- 3DEP elevation is free; 1 m availability is incomplete. Derive slope from DEM cells and test the actual candidate box [@usgs-3dep].
- Use current 3DHP hydrography plus FWS NWI REST/download layers for stream/wetland screening; neither replaces a field delineation or regulatory decision [@usgs-3dhp] [@fws-nwi-rest] [@fws-nwi-download].
- Census TIGER/Line Roads includes ramps and supports first-pass access distance; use the ramp geometry and separately validate legal truck access [@census-tiger-roads].

### Entitlement and power

- NZA offers a public map, but its terms restrict reuse/scraping and its FAQ directs dataset access to a licensing arm; use local adopted zoning and comprehensive-plan data unless a license is approved [@nza-terms] [@nza-data-access].
- DOE's hosting-capacity atlas is partial and explicitly not a site-specific interconnection answer. EIA is useful for grid context, not a parcel's available MW [@doe-hosting-capacity] [@eia-electricity-data].

### Labor and colleges

- ORS Standard provides 500 isochrone calls/day and 20/minute; driving contours allow up to 60 minutes. Overlay 30/45-minute polygons with ACS 2024 5-year block-group estimates [@ors-free-plan] [@ors-restrictions] [@census-acs-2024].
- BLS LAUS unemployment is published for states, counties, metros, and many cities, not custom drive-time geographies. Use BLS as an area proxy or derive a clearly labeled ACS catchment estimate [@bls-laus] [@bls-api-v2] [@census-acs-2024].
- College Scorecard requires an API key and exposes institution location; verify qualifying technical/community college type and campus before routing [@college-scorecard].

## Conflicts & Open Questions

- ORS's service-plan page verifies the 500/day free isochrone quota; its restrictions page separately states per-request geometry limits.
- The deprecated ORS endpoint was reduced to 10% of standard quota on 2026-08-27 and is scheduled to shut down 2026-11-02 to 2026-11-06; new integrations should use api.heigit.org [@ors-deprecation-announcement].
- A recent-news search did not confirm a September 2026 USGS 3DHP announcement; the fetched USGS news page's related item was dated 2026-04-27 [@usgs-3dhp-news].
- NZA's jurisdiction universe is not the same as jurisdictions already published; data reuse is licensed, and its site terms prohibit scraping.
- The DOE hosting-capacity coverage count is a May 2024 snapshot; check each utility's current map and instructions.
- Define whether the 8% criterion means maximum slope, average slope, or share of the footprint exceeding 8%.
- Define whether stream crossings are counted across the building box, site access roads, or the parcel as a whole.

## Gaps

- No target state/county was supplied, so assessor GIS endpoints, zoning layers, and serving utility maps cannot yet be selected.
- Parcel extent convention, setbacks/easements, industrial-plan adjacency distance, unemployment period, and qualifying college types need business-rule definitions before automated status colors are assigned.
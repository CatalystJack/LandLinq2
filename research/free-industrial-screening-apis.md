# Free APIs and Public GIS for U.S. Industrial Site Screening

**Research Date:** October 2, 2026  
**Depth:** Quick  
**Sources Consulted:** 34

## Executive Summary

There is no single no-cost API that can verify every industrial site criterion. A practical first-pass stack can combine local assessor parcel geometry, USGS elevation and hydrography, Fish and Wildlife Service wetlands, Census road ramps, openrouteservice driving isochrones, Census population estimates, BLS unemployment, and NCES/College Scorecard institution records. These sources provide inputs, not a final site verdict. Regrid's free nationwide parcel offer is a map tile, while its API provides a 30-day trial rather than ongoing free analysis access; even New York's state parcel service depends on county submissions and reports geometry inconsistencies. [[1]](https://www.arcgis.com/home/item.html?id=a2050b09baff493aa4ad7848ba2fac00) [[2]](https://regrid.com/api) [[3]](https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer)

The strongest free automation is for terrain, mapped water features, road proximity, drive-time polygons, population estimates, and nearby colleges. Zoning remains jurisdiction-specific, and public power maps cannot confirm available industrial load at a parcel. Keep missing parcel, zoning, or utility evidence as **unknown/manual review**, not a green pass. For routing, use openrouteservice's current `api.heigit.org` endpoint: its older `api.openrouteservice.org` endpoint has a reduced quota and is scheduled to shut down in November 2026. [[4]](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services) [[5]](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products) [[6]](https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services) [[7]](https://catalog.data.gov/dataset/census-tiger-line-roads) [[8]](https://openrouteservice.org/plans/) [[9]](https://ask.openrouteservice.org/t/reducing-the-quota-of-deprecated-api-api-openrouteservice-org/8013) [[10]](https://www.zoningatlas.org/faqs) [[11]](https://www.energy.gov/cmei/vehicles/us-atlas-electric-distribution-system-hosting-capacity-maps)

## Background

The requested screen combines parcel size and building fit, an 8% slope threshold, no more than two stream crossings, interstate access within three miles, industrial zoning or plan designation, utility capacity, population and unemployment catchments, and a technical/community college within a 30-minute drive. This review treats “free” as one of three different things: public data with no charge, a provider's free API quota, or a free map display that does not grant bulk or analytical data rights.

No pilot state or county was specified. Therefore, this report identifies national or broadly available inputs, but does not validate a local assessor endpoint, current zoning code, serving utility, or local power map. Some inputs are REST services; others are downloads that need a GIS pipeline. In every case, the application must compute the requested result from geometry or tabular data rather than expect a provider to return the final green/yellow decision.

## Key Findings

### 1. Parcel polygons and building fit require local data

The sources reviewed did not establish a uniform, authoritative, free nationwide parcel-vector API for site analysis. Regrid's nationwide tile is useful for map display, but its API page offers a 30-day sandbox rather than a continuing free plan. New York's public parcel service illustrates why state and county data still need local checks: its records are supplied by counties, not all counties are included, and the state reports that parcel geometry can vary and county edges are not matched. For a pilot, use the assessor or state GIS service that is authoritative for the target county; do not derive a pass from a visual tile. [[1]](https://www.arcgis.com/home/item.html?id=a2050b09baff493aa4ad7848ba2fac00) [[2]](https://regrid.com/api) [[3]](https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer)

Using the supplied dimensions, the 620 ft by 720 ft single-load box is 446,400 square feet, or about 10.25 acres. A 1,000 ft by 1,200 ft cross-dock box is 1,200,000 square feet, or about 27.55 acres. The 15-acre and 30-acre minimums leave about 4.75 and 2.45 gross acres outside those rectangles, respectively, before setbacks, truck courts, parking, drainage, access, or easements. Parcel acreage alone therefore cannot establish that the requested building and site program fit. The system needs parcel geometry, a test across possible box orientations, and a separately defined usable-area rule.

### 2. Free terrain, hydrography, wetland, and road layers support screening

USGS 3DEP elevation products are free. A 1-meter DEM exists, but project coverage is incomplete; the 1/3-arc-second product has much broader coverage. Slope must be derived from the elevation raster and evaluated over candidate building geometry. The screen must define whether “at most 8%” means maximum cell slope, average slope, or the share of the footprint above 8%; the DEM does not supply that verdict as a parcel attribute. [[4]](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services) [[12]](https://data.usgs.gov/datacatalog/data/USGS%3A77ae0551-c61e-4979-aedd-d797abdcde0e) [[13]](https://data.usgs.gov/datacatalog/data/USGS%3A3a81321b-c153-416f-98b7-cc8e5f0e17c3)

USGS 3DHP provides web services and downloadable hydrography, while FWS NWI provides REST/web-mapping services and downloads. Intersections can flag mapped streams and wetlands, but a mapped-layer result is not a jurisdictional wetland determination or permit decision. The requested crossing count also needs a rule: count crossings by the building box, the overall development footprint, or proposed access roads, and specify whether buffers apply. [[5]](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products) [[14]](https://catalog.data.gov/dataset/usgs-3d-hydrography-program-3dhp-downloadable-data-collection) [[6]](https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services) [[15]](https://www.fws.gov/program/national-wetlands-inventory/data-download) [[16]](https://www.fws.gov/program/national-wetlands-inventory/wetlands-data)

Census TIGER/Line Roads includes ramp features, which is a better starting point for the three-mile test than measuring to an interstate centerline. FHWA defines interstate access points at the entrance and exit breaks in controlled access, so a nearby road or ramp line does not by itself prove legal or truck-suitable access. Measure distance to a mapped interchange/access point, then verify the route and access restrictions for shortlisted sites. [[7]](https://catalog.data.gov/dataset/census-tiger-line-roads) [[17]](https://www.fhwa.dot.gov/design/interstate/170522.cfm)

### 3. Population is modelable; unemployment and college criteria need careful definitions

Openrouteservice Standard currently lists 500 isochrone requests per day and 20 per minute. Its driving limits allow 30- and 45-minute contours, within a 60-minute maximum. However, as of this report date the deprecated `api.openrouteservice.org` endpoint is limited to 10% of standard quota and is scheduled to shut down November 2-6, 2026; new integrations should use `api.heigit.org`. [[8]](https://openrouteservice.org/plans/) [[18]](https://openrouteservice.org/restrictions/) [[9]](https://ask.openrouteservice.org/t/reducing-the-quota-of-deprecated-api-api-openrouteservice-org/8013)

The 2024 ACS 5-year API supports block-group population estimates, which can be intersected with each isochrone to estimate the requested 250,000- and 500,000-person totals. Partial block groups require an allocation method; simple area weighting is only an approximation because people are not evenly distributed across land. Store the ACS vintage and method with the result, and show uncertainty rather than treating the sum as an exact count. [[19]](https://api.census.gov/data/2024/acs/acs5.html) [[20]](https://api.census.gov/data/2024/acs/acs5/geography.html) [[21]](https://www.census.gov/programs-surveys/acs/data/data-via-api.html)

BLS LAUS publishes unemployment for states, counties, metropolitan areas, and many cities, not custom drive-time catchments. A county or metro rate can be shown as a labeled proxy. If a custom catchment rate is essential, aggregate unemployed people and labor force from small-area estimates and calculate the ratio; do not average county percentages. Specify the reference period and seasonal adjustment before applying the 3.5% threshold. [[22]](https://www.bls.gov/lau/home.htm) [[23]](https://www.bls.gov/developers/api_faqs.htm) [[24]](https://www.bls.gov/news.release/metro.htm) [[19]](https://api.census.gov/data/2024/acs/acs5.html)

College Scorecard and NCES/IPEDS provide institution records, locations, and downloadable data suitable for finding campus candidates. Route to the campus rather than using straight-line distance. A two-year institution or a broad institution label does not always mean it is a qualifying community or technical college, so confirm institution type and branch-campus location before marking the 30-minute criterion as met. [[25]](https://collegescorecard.ed.gov/data/api-documentation) [[26]](https://nces.ed.gov/ipeds/datacenter/InstitutionList.aspx) [[27]](https://nces.ed.gov/arcgis/rest/services/IPEDS)

### 4. Zoning and site-specific power should not be auto-approved from national maps

The National Zoning Atlas has a public map, but its terms prohibit scraping and restrict reuse without permission; its FAQ directs data access to a licensing arm. Its methodology draws on local zoning maps and codes, which are the right place to verify current parcel entitlement. A comprehensive-plan designation is different from current zoning. For the requested colors, use green only when the parcel's current official zoning or adopted plan supports the requirement, yellow only for a measured adjacency condition, and unknown when local evidence is missing. [[28]](https://www.zoningatlas.org/atlas) [[29]](https://www.zoningatlas.org/terms) [[10]](https://www.zoningatlas.org/faqs) [[30]](https://www.zoningatlas.org/how)

DOE's hosting-capacity atlas is a useful lead to public utility maps, but its published coverage snapshot is from May 2024 and is partial. DOE cautions that these maps do not answer site-specific interconnection questions. EIA electricity data and Form EIA-861 provide useful system and utility context through public data and a free API key, but they do not establish spare feeder or substation capacity for an industrial customer. Obtain written utility confirmation or a formal service/interconnection study for a power pass. [[11]](https://www.energy.gov/cmei/vehicles/us-atlas-electric-distribution-system-hosting-capacity-maps) [[31]](https://www.eia.gov/electricity/data.php) [[32]](https://www.eia.gov/electricity/data/eia861) [[33]](https://www.eia.gov/opendata/documentation.php)

## Analysis

The data divides into two groups. Public terrain, hydrography, road, Census, labor, and education sources can support a repeatable first-pass pipeline. Their weakness is not price but fitness for purpose: DEM resolution varies, mapped waters are inventories, population inside partial geographies is estimated, and routing quotas and assumptions need to be recorded. A useful result should preserve source, vintage, geometry, and method alongside each calculated metric.

Parcel identity, entitlement, and power are the gating evidence. There is no national free parcel service verified here that can replace local assessor geometry. The National Zoning Atlas is not an unrestricted bulk data source, and broad electricity statistics are not a utility commitment. The product should therefore keep a criterion-level evidence state such as pass, fail, or unknown. Missing evidence should not silently become either a pass or a fail. A yellow adjacency result should be computed from the local zoning layer and kept distinct from the parcel's legal zoning status.

The building arithmetic is especially important for the cross-dock threshold. A 27.55-acre rectangle inside a 30-acre parcel leaves only about 2.45 acres outside the building footprint. That does not prove the design cannot fit, but it means the 30-acre rule is only an initial filter. The actual screen should test an oriented rectangle inside the parcel and then account for site circulation, easements, setbacks, grading, stormwater, and other constraints before calling a site feasible.

## Limitations

This is a U.S.-wide source assessment, not a parcel review. Local parcel, zoning, utility, and 1-meter elevation availability were not tested because no state or county was supplied. The exact slope statistic, stream-crossing geometry, water buffers, definition of industrial-plan adjacency, population allocation method, unemployment period, and qualifying college types remain business rules to define. DOE's cited map coverage snapshot is more than 18 months old, so recheck current utility links before relying on its coverage count.

## Recommendations

1. Select a pilot county and use its assessor parcel polygons as the authoritative geometry source. Keep Regrid's free tile for visual context only.
2. For each parcel, derive area and box fit; then calculate slope from the best available 3DEP DEM and intersect 3DHP/NWI layers. Store raster resolution and source dates, and return unknown where coverage is missing.
3. Use Census TIGER ramps for initial access distance. Generate 30/45-minute drive-time polygons with the current openrouteservice endpoint, intersect them with ACS block groups, and disclose the allocation method. Use BLS county/metro unemployment as a clearly labeled proxy unless the business explicitly approves a modeled catchment rate.
4. Build the college candidate list from College Scorecard/IPEDS, confirm campus type, and route each campus. Require local zoning/plan evidence for entitlement and utility confirmation for power before assigning green.
5. If the hosted routing quota is too low, evaluate self-hosted Valhalla. The software is open source, but the hosting and road-data operations are not cost-free. [[34]](https://valhalla.github.io/valhalla/api/isochrone/)

## Sources

1. [Regrid USA Nationwide Parcel Boundaries](https://www.arcgis.com/home/item.html?id=a2050b09baff493aa4ad7848ba2fac00) -- Published: Updated 2026-07-28; Tier 3
2. [Regrid Property API](https://regrid.com/api) -- Published: Not stated; accessed 2026-10-02; Tier 3
3. [NYS Tax Parcels Public FeatureServer](https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer) -- Published: Data vintage varies by county; accessed 2026-10-02; Tier 1
4. [About 3DEP Products & Services](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services) -- Published: Not stated; accessed 2026-10-02; Tier 1
5. [Access 3DHP Data Products](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products) -- Published: Product update July 2026; Tier 1
6. [Wetland Web Mapping Services](https://www.fws.gov/program/national-wetlands-inventory/web-mapping-services) -- Published: Not stated; accessed 2026-10-02; Tier 1
7. [Census TIGER/Line Roads](https://catalog.data.gov/dataset/census-tiger-line-roads) -- Published: Released 2026-05-28; Tier 1
8. [openrouteservice Plans](https://openrouteservice.org/plans/) -- Published: Not stated; accessed 2026-10-02; Tier 3
9. [openrouteservice Deprecated API Quota and Migration Notice](https://ask.openrouteservice.org/t/reducing-the-quota-of-deprecated-api-api-openrouteservice-org/8013) -- Published: 2026-08-27 quota change; accessed 2026-10-02; Tier 3
10. [National Zoning Atlas Frequently Asked Questions](https://www.zoningatlas.org/faqs) -- Published: Current FAQ; licensing announced for 2026; Tier 3
11. [U.S. Atlas of Electric Distribution System Hosting Capacity Maps](https://www.energy.gov/cmei/vehicles/us-atlas-electric-distribution-system-hosting-capacity-maps) -- Published: Coverage snapshot dated 2024-05; Tier 1
12. [USGS 1-Meter 3DEP DEM Collection](https://data.usgs.gov/datacatalog/data/USGS%3A77ae0551-c61e-4979-aedd-d797abdcde0e) -- Published: Collection; accessed 2026-10-02; Tier 1
13. [USGS 1/3 Arc-Second 3DEP DEM](https://data.usgs.gov/datacatalog/data/USGS%3A3a81321b-c153-416f-98b7-cc8e5f0e17c3) -- Published: Collection; accessed 2026-10-02; Tier 1
14. [USGS 3DHP Downloadable Data Collection](https://catalog.data.gov/dataset/usgs-3d-hydrography-program-3dhp-downloadable-data-collection) -- Published: Collection record; accessed 2026-10-02; Tier 1
15. [Download Seamless Wetlands Data](https://www.fws.gov/program/national-wetlands-inventory/data-download) -- Published: Not stated; accessed 2026-10-02; Tier 1
16. [National Wetlands Inventory Wetlands Data](https://www.fws.gov/program/national-wetlands-inventory/wetlands-data) -- Published: Not stated; accessed 2026-10-02; Tier 1
17. [FHWA Interstate System Access Policy](https://www.fhwa.dot.gov/design/interstate/170522.cfm) -- Published: Policy page; accessed 2026-10-02; Tier 1
18. [openrouteservice API Restrictions](https://openrouteservice.org/restrictions/) -- Published: Not stated; accessed 2026-10-02; Tier 3
19. [ACS 2024 5-Year API Dataset](https://api.census.gov/data/2024/acs/acs5.html) -- Published: 2024 data vintage; Tier 1
20. [ACS 2024 5-Year API Geography List](https://api.census.gov/data/2024/acs/acs5/geography.html) -- Published: 2024 data vintage; Tier 1
21. [ACS Data via API](https://www.census.gov/programs-surveys/acs/data/data-via-api.html) -- Published: Current guidance; accessed 2026-10-02; Tier 1
22. [Local Area Unemployment Statistics](https://www.bls.gov/lau/home.htm) -- Published: Current program page; accessed 2026-10-02; Tier 1
23. [BLS Public Data API FAQs](https://www.bls.gov/developers/api_faqs.htm) -- Published: Not stated; accessed 2026-10-02; Tier 1
24. [BLS Metropolitan Area Employment and Unemployment](https://www.bls.gov/news.release/metro.htm) -- Published: Monthly; accessed 2026-10-02; Tier 1
25. [College Scorecard API Documentation](https://collegescorecard.ed.gov/data/api-documentation) -- Published: Not stated; accessed 2026-10-02; Tier 1
26. [IPEDS Data Center Institution List](https://nces.ed.gov/ipeds/datacenter/InstitutionList.aspx) -- Published: Data vintages vary; accessed 2026-10-02; Tier 1
27. [IPEDS ArcGIS REST MapServer](https://nces.ed.gov/arcgis/rest/services/IPEDS) -- Published: Current service; accessed 2026-10-02; Tier 1
28. [National Zoning Atlas Public Map](https://www.zoningatlas.org/atlas) -- Published: Current page; accessed 2026-10-02; Tier 3
29. [National Zoning Atlas Terms of Use](https://www.zoningatlas.org/terms) -- Published: Current terms; accessed 2026-10-02; Tier 3
30. [How the National Zoning Atlas Is Made](https://www.zoningatlas.org/how) -- Published: Current page; accessed 2026-10-02; Tier 3
31. [EIA Electricity Data](https://www.eia.gov/electricity/data.php) -- Published: Monthly data page showed release 2026-09-24; accessed 2026-10-02; Tier 1
32. [EIA Form 861 Detailed Data Files](https://www.eia.gov/electricity/data/eia861) -- Published: Annual; release varies by data year; Tier 1
33. [EIA Open Data API Documentation](https://www.eia.gov/opendata/documentation.php) -- Published: Current documentation; accessed 2026-10-02; Tier 1
34. [Valhalla Isochrone API Reference](https://valhalla.github.io/valhalla/api/isochrone/) -- Published: Current documentation; accessed 2026-10-02; Tier 3

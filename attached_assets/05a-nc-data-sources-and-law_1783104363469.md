# North Carolina Data Sources and Law (annex to 05-county-data-and-the-law.md)

North Carolina has an unusually good statewide backbone for this system,
because the state itself aggregates what would otherwise be 100 separate county
pulls. Use the statewide layer to sequence your counties, then drop into each
county's own portal for the fields the statewide layer doesn't carry (tax
delinquency, mortgage/lien detail, sale history depth).

---

## The statewide backbone (Tier A, use first)

**NC OneMap** (nconemap.gov) is the state's authoritative GIS clearinghouse and
carries a **standardized statewide parcels layer** aggregating all 100 counties
plus the Eastern Band of the Cherokee Indians into one dataset with common
attributes — owner name, mailing address, acreage, land-use code. It was generated to publish an aggregated set of parcel polygons for as many North Carolina counties as practical, to serve business needs that require information from multiple counties, which is exactly this use case. Free, no login, downloadable as a file geodatabase or through GeoServices/WMS/WFS. This is your Stage 1 FIND starting point for any multi-county wave: pull the standardized layer, filter by county and land-use code, then go to the individual county for the fields it lacks.

Treat the NC OneMap layer as **Tier A for discovery, Tier B for freshness** —
some counties update on their own schedule and the aggregation lags. Cross-check
your top-scored parcels against the county's own portal before Stage 3.

---

## County-by-county notes (the counties worth naming)

These are the counties where Apex Residential / Catalyst Capital Partners
already has activity or broker-outreach infrastructure. Treat every other NC
county as Tier B by default (free per-county GIS or tax portal, verify before
you build a connector) until you've confirmed otherwise.

| County | Portal | Tier | Notes |
|---|---|---|---|
| Mecklenburg | Polaris 3G (polaris3g.mecklenburgcountync.gov) + GIS Open Mapping (gis.mecknc.gov) | A | POLARIS is the county's property ownership and mapping system, with over 80 mapping overlays; GIS data is directly downloadable from the Open Mapping site, no login |
| Wake | iMAPS (imaps.wakegov.com) + bulk data files (wake.gov Tax Administration) | A | Wake County publishes a full ownership, sale-information, and property-detail file for every parcel, refreshed daily — the best bulk pull in the state. Register of Deeds runs its own Consolidated Real Property Index for deed history |
| Guilford | Guilford County GIS / tax portal | B | Per-county pull, standard assessor fields |
| Forsyth | Forsyth County GIS / tax portal | B | Per-county pull |
| Durham | Durham County GIS / tax portal | B | Per-county pull |
| Buncombe | Buncombe County GIS / tax portal | B | Per-county pull |
| Henderson | Henderson County GIS / tax portal | B | Relevant to the Hendersonville feasibility work already on file |
| Chatham | Chatham County GIS / tax portal | B | Relevant to the Womble Farms / Pittsboro area |
| Cabarrus, Union, Gaston | County GIS / tax portals | B | Charlotte-adjacent growth counties, standard per-county pull |
| Cumberland, New Hanover | County GIS / tax portals | B | Fayetteville and Wilmington metros, standard per-county pull |

For any county not listed, start at the NC OneMap statewide layer, then search
"[county name] NC GIS" or "[county name] NC tax assessor real property search"
for the county-specific portal to fill gaps (tax status, lien detail).

---

## Stage 3 (RESOLVE) sources, statewide

- **Entity filings.** NC Secretary of State Business Registration
  (sosnc.gov/online_services/search/by_title/_Business_Registration). Free,
  searchable by entity name, SOSID, or registered agent/official name. The online search tools are designed for interactive, real-time use; automated or scripted searches are not permitted, and bulk access runs through the Secretary of State's Data Subscription Services instead. For a conversation-mode run, look entities up one at a time or in small batches by hand; if you wire this into agent mode later, use the subscription data product rather than scripting the public search page.
- **Deed history and liens.** County Register of Deeds (Wake's is the
  Consolidated Real Property Index above; most other counties run an
  equivalent recorder search). Free in essentially every NC county.
- **UCC filings.** NC Secretary of State also runs a UCC search — useful for
  spotting existing security interests against an entity before you assume it's
  unencumbered.

---

## The NC law layer (adds to file 05's general legal posture)

North Carolina has its **own telemarketing statute** on top of the federal
TCPA and National Do Not Call Registry, and it is stricter in one important
way: private right of action with fixed statutory damages.

- North Carolina's telephone-solicitation act bans calls or texts soliciting the purchase, rental, or investment in property, goods, or services to any number on the "Do Not Call" Registry or belonging to a person who has told the solicitor not to call again. Buying or selling real estate ("soliciting or encouraging the purchase... of... property") falls squarely inside this definition — this is not a carve-out for real estate investors.
- Solicitors must state their identity and the identity of the individual making the call at the start of every solicitation call — build this into the call script's OPEN line, which file 08's template already does by using the sender's real name and firm.
- A violation carries a private right of action for actual damages, treble or punitive damages, and attorneys' fees, and separately North Carolina sets civil penalties of $500 for a first violation, $1,000 for a second, and $5,000 for every violation after that — materially steeper than the federal $500/$1,500 TCPA figures, so scrubbing the state registry isn't optional paperwork here.
- Consumers register on the National Do Not Call Registry, which is what NC's statute incorporates by reference; there is no separate standalone NC number-list to scrub in addition to the national registry — the state layer is enforcement and penalty structure, not a second list. Confirm current mechanics at ncdoj.gov before your first calling wave, since procedures do change.
- Emails still need CAN-SPAM's truthful sender identity and working opt-out, per file 05 and the template in file 08.

None of this is legal advice. The scrub-before-you-dial step in file 07's
pre-outreach checklist is where this gets operationalized; run it every time,
and loop in NC counsel before your first outreach wave to confirm current
mechanics.

---

*Sourced against public NC government and legal-reference sites as of July
2026. County portal names and URLs change; verify before wiring an automated
pull, and re-check this annex if you're reading it much later than that date.*

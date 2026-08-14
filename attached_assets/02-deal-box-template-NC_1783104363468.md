# Deal Box — North Carolina, Multifamily + Land (Statewide)

Fill-in of `02-deal-box-template.md` for a statewide North Carolina mandate
across two asset classes. Add this file to your Claude Project alongside the
core system prompt from `01-claude-project-setup.md`.

Two asset classes share one deal box because they share an owner profile
(long-hold individuals, family entities, no institutional sellers) and a
resolution chain (NC Secretary of State + county recorder). What differs is the
signal block you paste into Stage 2 — see the note at the bottom.

---

## Mandate

- **Asset class:** Multifamily (garden-style, low-rise) **and** infill /
  entitlable land. Run these as two passes of the engine, not one merged pass —
  they have different size bands, different hard no's, and different comps.
- **Size band:**
  - Multifamily: 20–120 units
  - Land: 1–40 acres, zoned or realistically rezonable for multifamily,
    mixed-use, or residential density
- **Vintage or condition band:** Multifamily 1970–2010, value-add tolerant
  (deferred maintenance okay, functional obsolescence okay). Land: raw or
  underutilized, not a completed pad-ready site (those trade on-market)
- **Deal size:** $2M–$20M total capitalization per asset
- **Target geography:** Statewide North Carolina, sequenced by county wave —
  see `10-nc-county-rollout-plan.md`. Do not run all 100 counties in one Stage 1
  pass. Work one wave (3–6 counties) at a time, per the kit's own guidance in
  file 00 and file 05.
- **Return target:** Multifamily — 6.5%+ in-place or stabilized yield, or
  value-add to a low-teens IRR. Land — basis low enough to underwrite a 3–5 year
  hold to entitlement or a builder takeout.

## Owner profile

- **Keep:** LLCs, trusts, family partnerships, long-hold individuals (10y+),
  single-asset or two-asset operators, out-of-state owners of NC property
- **Drop:** REITs, institutional funds, national multifamily operators
  (Greystar, MAA, Camden, etc. as owner of record), merchant land developers
  with active platted subdivisions, publicly traded homebuilders
- **Signals worth ranking up:**
  - Multifamily: long tenure (10y+), absentee/out-of-state owner, tax
    delinquency, aging mortgage near term, individual/family ownership,
    single-asset operator, recorded liens — full weights in file 04
  - Land: long-hold individual owners, no development activity on the parcel,
    tax delinquency or holding-cost pressure, adjacency to recent rezonings or
    assembled parcels nearby — file 04, "Land and infill" block

## Hard no's

- Flood zone (FEMA AE/VE) covering more than 25% of the parcel
- Ground lease or split estate
- Pre-1960 unreinforced masonry (multifamily)
- Known environmental flags (open UST, Brownfields program listing)
- HOA-controlled parcels with restrictive covenants blocking multifamily or
  assemblage
- Land with an active, recorded subdivision plat (already on-market by nature)
- Anything requiring a rezoning the local jurisdiction has publicly opposed in
  the last 24 months (check planning board minutes before committing hours)

## Sponsor fit

Apex Residential and Catalyst Capital Partners are a Charlotte-based
multifamily and commercial real estate platform active across the Southeast,
with a brokerage arm (Apex Residential) and an investment/development arm
(Catalyst Capital Partners) working the same deal flow from both sides. The
platform underwrites and closes value-add multifamily and land positioned for
multifamily or mixed-use entitlement, with in-house underwriting, LIHTC and
affordable-housing structuring experience, and an active broker network across
NC, SC, GA, and TN. *(Edit this paragraph with your specific closed-deal proof
before it goes into outreach — the templates in file 08 use it verbatim.)*

---

## Note on running two asset classes from one deal box

Keep FIND, SCORE, and RESOLVE as separate stage-runs per asset class, even
though both live in this one deal box file. A single county pull from the
assessor or NC OneMap contains both multifamily parcels and vacant land
parcels in the same extract — filter to one asset class per Stage 1 message so
the classification prompt in file 01 isn't asked to hold two different keep/drop
logics at once. Multifamily and land can share Stage 3 RESOLVE work when the
same owner holds both (a family that owns an apartment property and an
adjacent land parcel is exactly the kind of assemblage signal worth flagging).

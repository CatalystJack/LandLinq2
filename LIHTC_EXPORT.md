# LIHTC Scoring System — Full Export
## NC QAP 2026 Aligned Site Suitability Scoring

---

## WHAT'S IN HERE

This is the complete, self-contained LIHTC scoring system extracted from LandLinq.
Copy these files into your new app:

| File | Purpose |
|------|---------|
| `server/lihtcAutoScoreService.ts` | Core scoring logic (Census, AMI, neighborhood quality) |
| `server/siteEvaluationService.ts` | Site analysis (FEMA floods, EPA hazards, USGS slope, Google transit/amenities) |
| `client/src/components/lihtc-score-modal.tsx` | Full React UI modal with edit, auto-detect, PDF export |
| DB Schema (below) | Drizzle/PostgreSQL tables needed |
| API Routes (below) | Express endpoints to wire up |

---

## ENVIRONMENT VARIABLES NEEDED

```
CENSUS_API_KEY=           # US Census Bureau — free at api.census.gov/data/key_signup.html
VITE_GOOGLE_MAPS_API_KEY= # Google Maps Platform — Places API + Geocoding API
GEOCODIO_API_KEY=         # Geocodio — for geocoding addresses to lat/lng (optional fallback)
```

---

## SCORING SUMMARY (NC 2026 QAP)

| Category | Max Points |
|----------|-----------|
| Neighborhood Character (Good=10, Fair=5, Poor=0) | 10 pts |
| Primary Amenities (Grocery/Shopping/Pharmacy) | 26 pts |
| Secondary Amenities (Healthcare/School/Service/etc) | 20 pts |
| Transit Access (≤0.5mi=6pts, ≤1mi=2pts) | 6 pts |
| Site Suitability (flood/slope/hazards/visibility/traffic) | 12 pts |
| Income/RPP (AMI unit targeting by county tier) | 2 pts |
| Negative Points (flood zone, steep slope) | up to -5 |
| **TOTAL POSSIBLE** | **~68 pts** |
| **THRESHOLD TO PASS** | **50 pts** |

---

## FILE 1: server/lihtcAutoScoreService.ts

Copy this file as-is. It exports `autoScoreLIHTC()`.

```typescript
/**
 * LIHTC Auto-Score Service — NC QAP 2026
 * Infers scoring inputs from: Census API, QCT status, site evaluation, Google Places
 */

const NC_STATE_MEDIAN_FALLBACK = 66186;

export interface LIHTCAutoScoreResult {
  totalScore: number;
  isPreliminary: boolean;
  breakdown: {
    neighborhoodCharacter: number;
    primaryAmenities: number;
    secondaryAmenities: number;
    siteSuitability: number;
    transit: number;
    negativePoints: number;
    incomeRPP: number;
  };
  assumptions: {
    countyIncomeTier: 'High' | 'Moderate' | 'Low';
    neighborhoodQuality: 'Good' | 'Fair' | 'Poor';
    units30AMI: number;
    units40AMI: number;
    units50AMI: number;
    countyMedianIncome: number | null;
    stateMedianIncome: number | null;
    povertyRate: number | null;
    inferredFrom: string[];
  };
  amenityDetails?: { name: string; distance: number | null; points: number }[];
  siteEvaluation?: any;
}

// ... (full source: server/lihtcAutoScoreService.ts — 417 lines)
// Key functions:
//   getCountyFips(county, state)         → Census FIPS lookup
//   fetchCountyIncomeData(state, county) → median income + poverty rate
//   classifyCountyIncomeTier(county, state median) → 'High'|'Moderate'|'Low'
//   inferNeighborhoodQuality(isQCT, povertyRate)   → 'Good'|'Fair'|'Poor'
//   scoreAmenities(lat, lng, googleApiKey)          → primary + secondary scores
//   autoScoreLIHTC(params)               → full scoring entry point
```

---

## FILE 2: server/siteEvaluationService.ts

Copy this file as-is. It exports `evaluateSite()`.

Uses these **free** government APIs (no key needed except Google for transit/amenities):
- **FEMA NFHL** — `hazards.fema.gov` — flood zone check
- **EPA Envirofacts TRI** — `data.epa.gov/efservice/TRI_FACILITY` — toxic release sites
- **EPA RCRA** — `data.epa.gov/efservice/RCRAINFO_FACILITY_SITE` — hazardous waste sites
- **USGS Elevation** — `epqs.nationalmap.gov/v1/json` — slope analysis (7-point grid)
- **Google Places** — transit stops, bus stops, incompatible uses (airports, industrial)

```typescript
// Key exports:
export async function evaluateSite(lat: number, lng: number, googleApiKey?: string): Promise<SiteEvaluationResult>

// Returns:
// {
//   floodZone: { isInFloodZone, floodZone, floodZoneDescription },
//   hazardousSites: { hasNearbyHazards, hazardCount, nearestHazard, hazards[] },
//   slope: { hasSteepSlope, avgSlope, maxSlope },
//   transit: { hasNearbyTransit, nearestStopDistance, transitScore, stops[] },
//   incompatibleUses: { hasIncompatibleUses, issues[], nearbyAirports[], nearbyIndustrial[] },
//   siteScore: { noIncompatibleUses, noNegativeFeatures, visibility, trafficSafety, transitPoints, total }
// }
```

---

## FILE 3: client/src/components/lihtc-score-modal.tsx

Copy this file as-is. Requires shadcn/ui components.

Exports two components:

### `<LIHTCScoreModal>` — Full modal dialog
```tsx
<LIHTCScoreModal
  dealId="uuid-string"
  isOpen={true}
  onClose={() => setOpen(false)}
  onRefresh={() => queryClient.invalidateQueries()}  // optional
/>
```
Features:
- Score breakdown with colored badges per category
- Edit panel: override neighborhood quality, income tier, AMI unit counts
- "Auto-detect" button: hits `/api/deals/:dealId/lihtc-auto-detect` → fills form from Census data
- Re-run button: hits `/api/site-evaluations/score-deal/:dealId`
- PDF export (downloads as .txt score sheet)

### `<LIHTCScoreBadge>` — Mini badge for table/list views
```tsx
<LIHTCScoreBadge
  dealId="uuid-string"
  score={72}           // null = "not scored yet"
  onClick={() => setModalOpen(true)}
/>
```
Colors: green ≥50, yellow ≥40, red <40. Tooltip shows pass/fail status.

---

## DATABASE SCHEMA

### Add these fields to your `deals` table:

```typescript
// Paste inside your deals pgTable({ ... }) definition:
lihtcScoreTotal:        integer("lihtc_score_total"),
lihtcScorePreliminary:  boolean("lihtc_score_preliminary").default(true),
lihtcCountyIncomeTier:  varchar("lihtc_county_income_tier"),   // 'High'|'Moderate'|'Low'
lihtcUnits30AMI:        integer("lihtc_units_30ami"),
lihtcUnits40AMI:        integer("lihtc_units_40ami"),
lihtcUnits50AMI:        integer("lihtc_units_50ami"),
lihtcNeighborhoodQuality: varchar("lihtc_neighborhood_quality"), // 'Good'|'Fair'|'Poor'
lihtcIsRedevelopment:   boolean("lihtc_is_redevelopment").default(false),
lihtcAmenityOverrides:  jsonb("lihtc_amenity_overrides"),       // {grocery:{name,distance},...}
lihtcCostPerUnit:       integer("lihtc_cost_per_unit"),         // $ construction cost/unit
lihtcScoreBreakdown:    jsonb("lihtc_score_breakdown"),         // full breakdown JSON
lihtcScoredAt:          timestamp("lihtc_scored_at"),
```

### New `site_evaluations` table (full):

```typescript
import { pgTable, varchar, text, integer, boolean, decimal, jsonb, timestamp, index, sql } from 'drizzle-orm/pg-core';

export const siteEvaluations = pgTable("site_evaluations", {
  id:         varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address:    text("address").notNull(),
  city:       varchar("city"),
  state:      varchar("state", { length: 2 }),
  zip:        varchar("zip", { length: 10 }),
  county:     varchar("county"),
  latitude:   decimal("latitude",  { precision: 10, scale: 7 }).notNull(),
  longitude:  decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  dealId:     varchar("deal_id").references(() => deals.id, { onDelete: "set null" }),

  // FEMA flood zone
  floodZoneIsInFloodZone: boolean("flood_zone_is_in_flood_zone").default(false),
  floodZoneCode:          varchar("flood_zone_code"),
  floodZoneDescription:   text("flood_zone_description"),

  // EPA hazardous sites
  hazardsHasNearby:       boolean("hazards_has_nearby").default(false),
  hazardsCount:           integer("hazards_count").default(0),
  hazardsNearestName:     varchar("hazards_nearest_name"),
  hazardsNearestDistance: decimal("hazards_nearest_distance", { precision: 6, scale: 3 }),
  hazardsDetails:         jsonb("hazards_details"),

  // USGS slope
  slopeHasSteep:          boolean("slope_has_steep").default(false),
  slopeAvg:               decimal("slope_avg", { precision: 5, scale: 2 }),
  slopeMax:               decimal("slope_max", { precision: 5, scale: 2 }),

  // Transit (Google Places)
  transitHasNearby:       boolean("transit_has_nearby").default(false),
  transitNearestDistance: decimal("transit_nearest_distance", { precision: 6, scale: 3 }),
  transitScore:           integer("transit_score").default(0),    // 0, 2, or 6
  transitStops:           jsonb("transit_stops"),

  // Incompatible uses
  incompatibleHasIssues:  boolean("incompatible_has_issues").default(false),
  incompatibleIssues:     jsonb("incompatible_issues"),

  // QAP sub-scores (NC 2026)
  scoreNeighborhood:       integer("score_neighborhood").default(0),
  scorePrimaryAmenities:   integer("score_primary_amenities").default(0),
  scoreSecondaryAmenities: integer("score_secondary_amenities").default(0),
  scoreSiteSuitability:    integer("score_site_suitability").default(0),
  scoreNegativePoints:     integer("score_negative_points").default(0),
  scoreIncomeRPP:          integer("score_income_rpp").default(0),
  scoreTransit:            integer("score_transit").default(0),
  scoreTotal:              integer("score_total").default(0),

  // Raw JSON payloads (for modal display)
  floodZoneData:        jsonb("flood_zone_data"),
  hazardsData:          jsonb("hazards_data"),
  slopeData:            jsonb("slope_data"),
  transitData:          jsonb("transit_data"),
  incompatibleUsesData: jsonb("incompatible_uses_data"),
  amenityDetails:       jsonb("amenity_details"),
  censusData:           jsonb("census_data"),
  scoringResult:        jsonb("scoring_result"),

  evaluatedBy:  varchar("evaluated_by"),
  evaluatedAt:  timestamp("evaluated_at").defaultNow(),
  createdAt:    timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_site_eval_deal").on(table.dealId),
  index("idx_site_eval_state").on(table.state),
  index("idx_site_eval_score").on(table.scoreTotal),
]);
```

---

## API ROUTES SUMMARY

Add these 5 routes to your Express server. Full implementations are in `server/routes.ts`.

```
GET  /api/site-evaluations/deal/:dealId
     → Returns cached site evaluation for a deal
     → Storage: storage.getSiteEvaluationByDealId(dealId)

POST /api/site-evaluations/score-deal/:dealId  { forceRefresh?: boolean }
     → Runs full site evaluation (geocodes if needed, calls evaluateSite() + autoScoreLIHTC())
     → Saves result to site_evaluations table
     → Updates deal.lihtcScoreTotal + lihtcScorePreliminary

GET  /api/deals/:dealId/lihtc-auto-detect
     → Uses Census geocoder to find county FIPS from deal coordinates
     → Fetches ACS 5-year county median income + poverty rate
     → Returns suggestions: { countyIncomeTier, neighborhoodQuality, units30AMI, ... }

PATCH /api/deals/:dealId/lihtc-overrides
      { neighborhoodQuality, countyIncomeTier, units30AMI, units40AMI, units50AMI,
        amenityOverrides, costPerUnit, isRedevelopment }
      → Saves analyst overrides to deal record
      → Frontend then calls score-deal to recalculate with overrides

GET  /api/site-evaluations
     → Returns all evaluations (for admin dashboard)
```

---

## QUICK START CHECKLIST

- [ ] Copy `server/lihtcAutoScoreService.ts`
- [ ] Copy `server/siteEvaluationService.ts`
- [ ] Copy `client/src/components/lihtc-score-modal.tsx`
- [ ] Add LIHTC fields to deals table in schema
- [ ] Create `site_evaluations` table in schema
- [ ] Run `npm run db:push` to sync
- [ ] Add 5 API routes to Express server
- [ ] Set `CENSUS_API_KEY` env var (free)
- [ ] Set `VITE_GOOGLE_MAPS_API_KEY` env var (paid, but existing key works)
- [ ] Use `<LIHTCScoreModal>` in your deal detail view
- [ ] Use `<LIHTCScoreBadge>` in your deal table/list

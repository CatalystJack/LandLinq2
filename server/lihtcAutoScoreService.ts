/**
 * LIHTC Auto-Score Service (legacy — main scoring is in routes.ts score-deal endpoint)
 * NC QAP 2026 Scoring Reference:
 * - Neighborhood Character: up to 10 pts (Well Maintained=10, Deteriorating=5, Blighted=0)
 * - Primary Amenities (Grocery/Shopping/Pharmacy): up to 26 pts
 * - Secondary Amenities: up to 20 pts
 * - Site Suitability: up to 12 pts
 * - Transit: up to 6 pts
 * - Olmstead: up to 4 pts
 * - Income RPP: up to 2 pts
 * - Negative Points: up to -53 (PDC -10, Section 1602 -40, Agency discretion -3)
 * Auto-scoreable max: 80 pts. Total possible: 111 pts (+ Design Standards 30 + Applicant Bonus 1).
 */

const NC_STATE_FIPS = '37';
// NC 2022 ACS5 state median household income — used as baseline for tier classification
// We fetch this live but fall back to this if Census API is unavailable
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

/** Convert county name + state abbreviation to Census FIPS codes */
async function getCountyFips(county: string, state: string): Promise<{ stateFips: string; countyFips: string } | null> {
  // Map state abbreviation → FIPS
  const stateFipsMap: Record<string, string> = {
    AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',FL:'12',GA:'13',
    HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',
    MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',
    NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',
    SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56',
    DC:'11'
  };
  const stateFips = stateFipsMap[state?.toUpperCase()];
  if (!stateFips) return null;

  // Fetch county FIPS from Census
  try {
    const censusKey = process.env.CENSUS_API_KEY;
    const url = `https://api.census.gov/data/2022/acs/acs5?get=NAME&for=county:*&in=state:${stateFips}&key=${censusKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const rows: string[][] = await res.json();
    // rows[0] = headers, rows[1..] = data: [NAME, state, county]
    const countyLower = county.toLowerCase().replace(' county', '').trim();
    const match = rows.slice(1).find(r => r[0].toLowerCase().includes(countyLower));
    if (!match) return null;
    return { stateFips, countyFips: match[2] };
  } catch {
    return null;
  }
}

/** Fetch county income data from Census ACS5 */
async function fetchCountyIncomeData(stateFips: string, countyFips: string): Promise<{
  medianIncome: number | null;
  povertyCount: number | null;
  totalPop: number | null;
  povertyRate: number | null;
}> {
  try {
    const censusKey = process.env.CENSUS_API_KEY;
    // B19013_001E = median household income, B17001_002E = people below poverty, B01003_001E = total pop
    const url = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B17001_002E,B01003_001E&for=county:${countyFips}&in=state:${stateFips}&key=${censusKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Census API ${res.status}`);
    const rows: string[][] = await res.json();
    const data = rows[1];
    const medianIncome = data[0] && data[0] !== '-666666666' ? parseInt(data[0]) : null;
    const povertyCount = data[1] ? parseInt(data[1]) : null;
    const totalPop = data[2] ? parseInt(data[2]) : null;
    const povertyRate = povertyCount && totalPop ? Math.round((povertyCount / totalPop) * 100) : null;
    return { medianIncome, povertyCount, totalPop, povertyRate };
  } catch (e) {
    console.error('[LIHTC] Census county income fetch failed:', e);
    return { medianIncome: null, povertyCount: null, totalPop: null, povertyRate: null };
  }
}

/** Fetch NC (or any state) median income from Census */
async function fetchStateMedianIncome(stateFips: string): Promise<number | null> {
  try {
    const censusKey = process.env.CENSUS_API_KEY;
    const url = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E&for=state:${stateFips}&key=${censusKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Census API ${res.status}`);
    const rows: string[][] = await res.json();
    const val = rows[1]?.[0];
    return val && val !== '-666666666' ? parseInt(val) : null;
  } catch {
    return null;
  }
}

/** Classify county income tier based on comparison to state median */
function classifyCountyIncomeTier(countyMedian: number, stateMedian: number): 'High' | 'Moderate' | 'Low' {
  const ratio = countyMedian / stateMedian;
  if (ratio >= 1.10) return 'High';
  if (ratio >= 0.85) return 'Moderate';
  return 'Low';
}

/**
 * NOTE: Neighborhood quality CANNOT be auto-scored per NC QAP 2026.
 * It requires physical inspection within 0.5 miles. This function is kept
 * for backward compatibility only but should NOT be used in production scoring.
 * Poverty rate may be displayed as reference data only.
 */
function inferNeighborhoodQuality(
  _isQCT: boolean,
  _povertyRate: number | null
): 'Good' | 'Fair' | 'Poor' {
  return 'Fair'; // conservative placeholder — analyst must assess physically
}

/** Score amenities against NC QAP distance thresholds using Google Places */
async function scoreAmenities(
  lat: number,
  lng: number,
  googleApiKey: string | undefined
): Promise<{
  primaryScore: number;
  secondaryScore: number;
  details: { name: string; distance: number | null; points: number }[];
}> {
  if (!googleApiKey) return { primaryScore: 0, secondaryScore: 0, details: [] };

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return 3956 * 2 * Math.asin(Math.sqrt(a));
  };

  const scoreByDistance = (dist: number | null, pts: number[], thresholds: number[]): number => {
    if (dist === null) return 0;
    for (let i = 0; i < thresholds.length; i++) if (dist <= thresholds[i]) return pts[i];
    return 0;
  };

  const PRIMARY: Record<string, { type: string; points: number[]; distances: number[] }> = {
    Grocery:  { type: 'supermarket',   points: [12, 10, 8, 6], distances: [2, 2.5, 3, 4] },
    Shopping: { type: 'shopping_mall', points: [7, 6, 5, 4],   distances: [2, 2.5, 3, 4] },
    Pharmacy: { type: 'pharmacy',      points: [7, 6, 5, 4],   distances: [2, 2.5, 3, 4] },
  };

  const SECONDARY: Record<string, { type: string; points: number[]; distances: number[] }> = {
    Healthcare:        { type: 'hospital',     points: [3, 2, 1], distances: [2, 2.5, 3] },
    'Public Facility': { type: 'city_hall',    points: [3, 2, 1], distances: [2, 2.5, 3] },
    School:            { type: 'school',       points: [3, 2, 1], distances: [2, 2.5, 3] },
    Service:           { type: 'laundry',      points: [3, 2, 1], distances: [2, 2.5, 3] },
    Restaurant:        { type: 'restaurant',   points: [3, 2, 1], distances: [2, 2.5, 3] },
    Bank:              { type: 'bank',         points: [3, 2, 1], distances: [2, 2.5, 3] },
  };

  const details: { name: string; distance: number | null; points: number }[] = [];
  let primaryScore = 0;
  let secondaryScore = 0;

  const searchRadius = 6437; // 4 miles in meters
  const allAmenities = { ...PRIMARY, ...SECONDARY };
  const isPrimary = (name: string) => name in PRIMARY;

  await Promise.allSettled(
    Object.entries(allAmenities).map(async ([label, cfg]) => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${searchRadius}&type=${cfg.type}&key=${googleApiKey}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const data = await r.json();
        const place = data.results?.[0];
        if (!place) { details.push({ name: label, distance: null, points: 0 }); return; }
        const pLat = place.geometry.location.lat;
        const pLng = place.geometry.location.lng;
        const dist = haversine(lat, lng, pLat, pLng);
        const pts = scoreByDistance(dist, cfg.points, cfg.distances);
        details.push({ name: label, distance: Math.round(dist * 100) / 100, points: pts });
        if (isPrimary(label)) primaryScore += pts;
        else secondaryScore += pts;
      } catch {
        details.push({ name: label, distance: null, points: 0 });
      }
    })
  );

  return { primaryScore, secondaryScore, details };
}

/**
 * Run a fully-automatic preliminary LIHTC QAP score for a deal.
 * Uses analyst overrides when provided, otherwise infers from Census + QCT data.
 */
export async function autoScoreLIHTC(params: {
  lat: number;
  lng: number;
  address: string;
  county: string | null;
  state: string | null;
  qctStatus: string | null;
  censusMedianIncome?: number | null;
  // Analyst overrides (null = use auto-inference)
  overrideCountyIncomeTier?: 'High' | 'Moderate' | 'Low' | null;
  overrideNeighborhoodQuality?: 'Good' | 'Fair' | 'Poor' | null;
  overrideUnits30AMI?: number | null;
  overrideUnits40AMI?: number | null;
  overrideUnits50AMI?: number | null;
  totalUnits?: number | null;
}): Promise<LIHTCAutoScoreResult> {
  const {
    lat, lng, county, state, qctStatus,
    overrideCountyIncomeTier, overrideNeighborhoodQuality,
    overrideUnits30AMI, overrideUnits40AMI, overrideUnits50AMI,
    totalUnits,
  } = params;

  const inferredFrom: string[] = [];
  let countyMedianIncome: number | null = null;
  let stateMedianIncome: number | null = null;
  let povertyRate: number | null = null;

  // 1. Fetch Census income data (unless all overrides provided)
  const needCensus = !overrideCountyIncomeTier || !overrideNeighborhoodQuality;
  if (needCensus && county && state) {
    try {
      const fips = await getCountyFips(county, state);
      if (fips) {
        const [countyData, stateMed] = await Promise.all([
          fetchCountyIncomeData(fips.stateFips, fips.countyFips),
          fetchStateMedianIncome(fips.stateFips),
        ]);
        countyMedianIncome = countyData.medianIncome;
        povertyRate = countyData.povertyRate;
        stateMedianIncome = stateMed;
      }
    } catch (e) {
      console.error('[LIHTC] Census lookup failed:', e);
    }
  }

  // 2. Determine county income tier
  let countyIncomeTier: 'High' | 'Moderate' | 'Low';
  if (overrideCountyIncomeTier) {
    countyIncomeTier = overrideCountyIncomeTier;
  } else if (countyMedianIncome) {
    const baseMed = stateMedianIncome || NC_STATE_MEDIAN_FALLBACK;
    countyIncomeTier = classifyCountyIncomeTier(countyMedianIncome, baseMed);
    inferredFrom.push(`County income tier: ${countyIncomeTier} (county median $${countyMedianIncome.toLocaleString()} vs state median $${baseMed.toLocaleString()})`);
  } else {
    countyIncomeTier = 'Moderate';
    inferredFrom.push('County income tier: Moderate (default — Census data unavailable)');
  }

  // 3. Determine neighborhood quality
  const isQCT = qctStatus === 'YES';
  let neighborhoodQuality: 'Good' | 'Fair' | 'Poor';
  if (overrideNeighborhoodQuality) {
    neighborhoodQuality = overrideNeighborhoodQuality;
  } else {
    neighborhoodQuality = inferNeighborhoodQuality(isQCT, povertyRate);
    const qctNote = isQCT ? ' (QCT)' : '';
    const povNote = povertyRate !== null ? `, poverty rate ${povertyRate}%` : '';
    inferredFrom.push(`Neighborhood quality: ${neighborhoodQuality}${qctNote}${povNote}`);
  }

  // 4. Determine AMI mix (default: 20% at 30 AMI, 30% at 50 AMI)
  const units = totalUnits || 100;
  const units30AMI = overrideUnits30AMI ?? Math.round(units * 0.20);
  const units40AMI = overrideUnits40AMI ?? 0;
  const units50AMI = overrideUnits50AMI ?? Math.round(units * 0.30);
  const usedDefaults = !overrideUnits30AMI && !overrideUnits40AMI && !overrideUnits50AMI;
  if (usedDefaults) {
    inferredFrom.push(`AMI mix: 20% at 30 AMI, 30% at 50 AMI (standard 9% LIHTC default)`);
  }

  // 5. Run site evaluation (flood/hazards/slope/transit)
  let siteEval: any = null;
  let transitPoints = 0;
  let siteSuitability = 12; // Default full score
  let negativePoints = 0;

  try {
    const { evaluateSite } = await import('./siteEvaluationService.js');
    siteEval = await evaluateSite(lat, lng, undefined); // Google Places disabled

    const hasIncompat = siteEval.incompatibleUses.hasIncompatibleUses || siteEval.hazardousSites.hasNearbyHazards;
    const hasNegative = siteEval.floodZone.isInFloodZone || siteEval.slope.hasSteepSlope;

    siteSuitability = 0;
    if (!hasIncompat) siteSuitability += 3;  // no incompatible uses
    if (!hasNegative) siteSuitability += 3;  // no negative features
    siteSuitability += 3; // visibility (assume ok)
    siteSuitability += 3; // traffic safety (assume ok)

    negativePoints = hasNegative ? -3 : 0;
    transitPoints = siteEval.transit.transitScore;
  } catch (e) {
    console.error('[LIHTC] Site evaluation failed:', e);
    inferredFrom.push('Site evaluation: defaulted (API unavailable)');
  }

  // 6. Score amenities
  let primaryAmenities = 0;
  let secondaryAmenities = 0;
  let amenityDetails: { name: string; distance: number | null; points: number }[] = [];

  try {
    const amenityResult = await scoreAmenities(lat, lng, undefined); // Google Places disabled
    primaryAmenities = amenityResult.primaryScore;
    secondaryAmenities = amenityResult.secondaryScore;
    amenityDetails = amenityResult.details;
  } catch (e) {
    console.error('[LIHTC] Amenity scoring failed:', e);
    inferredFrom.push('Amenities: defaulted to 0 (Google Places unavailable)');
  }

  // 7. Neighborhood character score — hardcoded to 10 (Well Maintained) per team standard.
  // NC QAP 2026 §IV(A)(1)(b)(i) requires physical inspection; we default to full points.
  const neighborhoodCharacter = 10;

  // 8. Income RPP score (NC QAP income targeting)
  const totalTargeted = units30AMI + units40AMI + units50AMI;
  const totalWithTargets = totalTargeted > 0 ? totalTargeted : units;
  let incomeRPP = 0;

  // NC QAP 2026 Income/RPP: max 2 pts per tier
  if (countyIncomeTier === 'High') {
    const pct30 = units30AMI / totalWithTargets;
    if (pct30 >= 0.25) incomeRPP = 2;
    else if (pct30 >= 0.15) incomeRPP = 1;
  } else if (countyIncomeTier === 'Moderate') {
    const pct40 = units40AMI / totalWithTargets;
    if (pct40 >= 0.25) incomeRPP = 2;
    else if (pct40 >= 0.15) incomeRPP = 1;
  } else {
    // Low income county
    const pct50 = units50AMI / totalWithTargets;
    if (pct50 >= 0.25) incomeRPP = 2;
    else if (pct50 >= 0.15) incomeRPP = 1;
  }

  const totalScore =
    neighborhoodCharacter +
    primaryAmenities +
    secondaryAmenities +
    siteSuitability +
    transitPoints +
    negativePoints +
    incomeRPP;

  const isPreliminary = inferredFrom.length > 0;

  return {
    totalScore,
    isPreliminary,
    breakdown: {
      neighborhoodCharacter,
      primaryAmenities,
      secondaryAmenities,
      siteSuitability,
      transit: transitPoints,
      negativePoints,
      incomeRPP,
    },
    assumptions: {
      countyIncomeTier,
      neighborhoodQuality,
      units30AMI,
      units40AMI,
      units50AMI,
      countyMedianIncome,
      stateMedianIncome,
      povertyRate,
      inferredFrom,
    },
    amenityDetails,
    siteEvaluation: siteEval,
  };
}

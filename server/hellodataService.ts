/**
 * HelloData API Service for Property Comparables
 * Uses correct API workflow: Geocode -> Search -> Validate -> Get Property -> Find Comparables
 */

import { GeocodioService } from './geocodioService.js';
import { apiCallTracker } from './apiCallTracker.js';
import { apiSafetyGuards } from './apiSafetyGuards.js';

/**
 * Product-type-specific comparable search criteria
 * Jan 12, 2026: Added custom criteria for BTR, Lot, Townhome, Single Family deals
 */
interface ComparableFilterCriteria {
  minVintage: number;      // Minimum year built
  minUnits: number;        // Minimum unit count
  minGrossRent?: number;   // Minimum gross rent per unit ($)
  minRentPSF?: number;     // Minimum rent per square foot ($)
}

/**
 * Get filter criteria based on product type
 * BTR, Lot Development, Townhome, Single Family: 2015+, 25+ units, $2,000+ gross rent
 * Conventional Apartments, Active Adult: 2020+, 150+ units, $1.75+/sqft (original criteria)
 */
function getFilterCriteria(productType?: string): ComparableFilterCriteria {
  const normalizedType = (productType || '').toLowerCase().trim();
  
  // BTR, Lot Development, Townhome, Single Family get relaxed criteria with gross rent filter
  const relaxedCriteriaTypes = ['btr', 'lot', 'lot development', 'townhome', 'single family', 'single-family', 'singlefamily'];
  
  const isRelaxedType = relaxedCriteriaTypes.some(t => normalizedType.includes(t));
  
  if (isRelaxedType) {
    console.log(`📊 [HELLODATA-FILTER] Using BTR/Lot/Townhome/SF criteria for "${productType}": 2015+, 25+ units, $2,000+ gross rent`);
    return {
      minVintage: 2015,
      minUnits: 25,
      minGrossRent: 2000,  // $2,000 minimum gross rent per unit
      minRentPSF: undefined // Don't use PSF for these types
    };
  }
  
  // Default: Conventional Apartments, Active Adult - original strict criteria
  console.log(`📊 [HELLODATA-FILTER] Using standard criteria for "${productType || 'default'}": 2020+, 150+ units, $1.75+/sqft`);
  return {
    minVintage: 2020,
    minUnits: 150,
    minGrossRent: undefined,
    minRentPSF: 1.75  // $1.75/sqft minimum
  };
}

/**
 * Fetch with timeout - prevents hanging forever if API doesn't respond
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`HelloData request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

interface UnitMixEntry {
  unitType: string; // 'Studio', '1 BR', '2 BR', '3 BR', etc.
  avgRent: number;
  avgSqft: number;
  rentPSF: number;
  count: number;
}

interface HelloDataComparable {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  buildingSize: number; // Square feet
  salePrice: number;
  saleDate: string;
  yearBuilt: number;
  pricePerSqFt: number;
  distance: number; // Miles from subject property
  latitude: number;
  longitude: number;
  unitCount?: number; // Number of units in the property
  propertyName?: string; // Name of the property (e.g., "The Residences at...")
  avgRent?: number; // Average monthly rent per unit
  vacancyRate?: number | null; // Current vacancy rate (0-100%)
  developer?: string | null; // Developer / builder name
  owner?: string | null; // Current owner name
  stories?: number | null; // Number of stories/floors
  unitMix?: UnitMixEntry[] | null; // Per-bedroom-type breakdown
  leasedPct?: number | null; // Leased/occupancy percentage (0-100)
  leasedPctChange?: number | null; // 30-day change in leased % (e.g. +1.7 = improved)
  exposure?: number | null; // Market exposure — % of units available in next 6 months
  exposureChange?: number | null; // 30-day change in exposure
  unitsVacant?: number | null; // Units currently listed as available for move-in
  unitsExposed?: number | null; // Units available within next 6 months
  websiteUrl?: string | null; // Property or management company website
}

/** Extract occupancy trend / exposure metrics from a HelloData property details object.
 * Per API docs, `occupancy_over_time` is the authoritative source:
 *   - Each entry: { as_of: DateStr, leased: number (0-1), exposure: number (0-1) }
 *   - Most recent entry = current metrics; compare with prior entry for 30-day change.
 */
function extractTrendFields(details: any): {
  leasedPctChange: number | null;
  exposure: number | null;
  exposureChange: number | null;
  unitsVacant: number | null;
  unitsExposed: number | null;
} {
  const parseInt2 = (v: any) => {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(v);
    return isNaN(n) ? null : n;
  };

  let leasedPctChange: number | null = null;
  let exposure: number | null = null;
  let exposureChange: number | null = null;

  const occupancyHistory: any[] = Array.isArray(details.occupancy_over_time) ? details.occupancy_over_time : [];
  if (occupancyHistory.length > 0) {
    const sorted = [...occupancyHistory].sort((a: any, b: any) =>
      new Date(b.as_of || 0).getTime() - new Date(a.as_of || 0).getTime()
    );
    const current = sorted[0];
    const previous = sorted[1];

    // exposure is a decimal (0-1) → convert to percentage
    if (current.exposure !== null && current.exposure !== undefined) {
      exposure = parseFloat((parseFloat(current.exposure) * 100).toFixed(1));
    }

    // leasedPctChange: difference between most recent and prior leased values (in percentage points)
    if (previous && current.leased !== null && current.leased !== undefined &&
        previous.leased !== null && previous.leased !== undefined) {
      leasedPctChange = parseFloat(((parseFloat(current.leased) - parseFloat(previous.leased)) * 100).toFixed(1));
    }

    // exposureChange: difference between most recent and prior exposure values (in percentage points)
    if (previous && current.exposure !== null && current.exposure !== undefined &&
        previous.exposure !== null && previous.exposure !== undefined) {
      exposureChange = parseFloat(((parseFloat(current.exposure) - parseFloat(previous.exposure)) * 100).toFixed(1));
    }
  }

  // unitsVacant / unitsExposed: count from building_availability
  const totalUnits = parseInt(details.number_units ?? 0) || 0;
  const availability: any[] = Array.isArray(details.building_availability) ? details.building_availability : [];
  const vacantUnitsCount = availability.filter((u: any) => u.exit_market === null || u.exit_market === undefined).length;

  return {
    leasedPctChange,
    exposure,
    exposureChange,
    unitsVacant: vacantUnitsCount > 0 ? vacantUnitsCount : null,
    unitsExposed: exposure !== null && totalUnits > 0
      ? Math.round((exposure / 100) * totalUnits)
      : parseInt2(null),
  };
}

/** Extract per-bedroom-type unit mix from a HelloData pricing response array */
function extractUnitMix(pricingItems: any[]): UnitMixEntry[] {
  const groups: Record<string, { totalRent: number; totalSqft: number; count: number }> = {};

  for (const item of pricingItems) {
    const sqft = item.unit?.sqft || item.sqft || 0;
    const price = item.unit?.price || item.price || item.effective_rent || item.rent || 0;
    if (sqft <= 0 || price <= 0) continue;

    const rawBed = item.unit?.bedrooms ?? item.unit?.beds ?? item.unit?.bed_rooms ??
                   item.bedrooms ?? item.beds ?? item.bed_rooms ?? item.bedroom_count ?? null;
    const rawType = item.unit?.unit_type || item.unit?.type || item.unit_type || item.type ||
                    item.floorplan || item.floor_plan || item.unit?.floorplan || '';

    let label: string;
    if (rawType && /studio/i.test(String(rawType))) {
      label = 'Studio';
    } else if (rawType) {
      const brMatch = String(rawType).match(/^(\d+)\s*(?:BR|BD|BED|B\b)/i);
      if (brMatch) {
        const n = parseInt(brMatch[1]);
        label = n === 0 ? 'Studio' : `${n} BR`;
      } else if (rawBed !== null && rawBed !== undefined) {
        const n = parseInt(String(rawBed));
        label = n === 0 ? 'Studio' : `${n} BR`;
      } else {
        continue;
      }
    } else if (rawBed !== null && rawBed !== undefined) {
      const n = parseInt(String(rawBed));
      label = n === 0 ? 'Studio' : `${n} BR`;
    } else {
      continue;
    }

    if (!groups[label]) groups[label] = { totalRent: 0, totalSqft: 0, count: 0 };
    groups[label].totalRent += price;
    groups[label].totalSqft += sqft;
    groups[label].count++;
  }

  return groupsToMix(groups);
}

/**
 * Extract unit mix from the property details response.
 * HelloData's /property/{id} returns building_availability with per-unit sqft/price.
 *
 * Strategy:
 *   - Bedroom type DISCOVERY uses ALL units (rented + vacant) so types at 100%
 *     occupancy still appear in the mix.
 *   - Rent VALUES use only active/vacant units (exit_market == null, asking price)
 *     per bedroom type, matching HelloData's own UI which shows asking rents.
 *   - If a bedroom type has zero active units, rent falls back to all units of
 *     that type (best available data for fully-occupied floor plans).
 */
function extractUnitMixFromDetails(details: any): UnitMixEntry[] {
  const rawItems: any[] = Array.isArray(details.building_availability) ? details.building_availability : [];
  if (rawItems.length === 0) return [];

  // Pass 1: count totals and sqft from ALL units (for unit count and avg sqft)
  const allGroups: Record<string, { totalRent: number; totalSqft: number; count: number }> = {};
  // Pass 2: sum rents from ACTIVE units only (exit_market == null) for asking-price average
  const activeGroups: Record<string, { totalRent: number; totalSqft: number; count: number }> = {};

  for (const item of rawItems) {
    const sqft = item.sqft || item.square_footage || 0;
    const price = item.price || item.effective_price || 0;
    const bedrooms = item.bed ?? item.beds ?? item.bedrooms ?? null;
    if (sqft <= 0 || price <= 0 || bedrooms === null) continue;
    const n = parseInt(String(bedrooms));
    if (isNaN(n)) continue;
    const label = n === 0 ? 'Studio' : `${n} BR`;

    if (!allGroups[label]) allGroups[label] = { totalRent: 0, totalSqft: 0, count: 0 };
    allGroups[label].totalRent += price;
    allGroups[label].totalSqft += sqft;
    allGroups[label].count++;

    const isActive = item.exit_market === null || item.exit_market === undefined;
    if (isActive) {
      if (!activeGroups[label]) activeGroups[label] = { totalRent: 0, totalSqft: 0, count: 0 };
      activeGroups[label].totalRent += price;
      activeGroups[label].totalSqft += sqft;
      activeGroups[label].count++;
    }
  }

  // Merge: for each bedroom type, use active-unit asking rents if available, else all-unit rents.
  // Normalize totalRent so groupsToMix's (totalRent / count) = correct avgRent.
  // If active units exist: avg = active.totalRent / active.count → store that × all.count
  // If no active units: avg = all.totalRent / all.count → store as-is
  const mergedGroups: Record<string, { totalRent: number; totalSqft: number; count: number }> = {};
  for (const label of Object.keys(allGroups)) {
    const all = allGroups[label];
    const active = activeGroups[label];
    const normalizedRent = active
      ? (active.totalRent / active.count) * all.count   // active avg × all count
      : all.totalRent;                                    // fallback: all-units average
    mergedGroups[label] = {
      totalRent: normalizedRent,
      totalSqft: all.totalSqft,
      count: all.count,
    };
  }

  return groupsToMix(mergedGroups);
}

function groupsToMix(groups: Record<string, { totalRent: number; totalSqft: number; count: number }>): UnitMixEntry[] {
  return Object.entries(groups)
    .map(([unitType, g]) => ({
      unitType,
      avgRent: Math.round(g.totalRent / g.count),
      avgSqft: Math.round(g.totalSqft / g.count),
      rentPSF: g.totalSqft > 0 ? parseFloat((g.totalRent / g.totalSqft).toFixed(2)) : 0,
      count: g.count,
    }))
    .sort((a, b) => {
      if (a.unitType === 'Studio') return -1;
      if (b.unitType === 'Studio') return 1;
      return parseInt(a.unitType) - parseInt(b.unitType);
    });
}

/**
 * Primary extraction from HelloData's building_availability array.
 * Per API docs: building_availability is the authoritative source for
 * unit mix, rent, vacancy/leased, and stories (via floors field on each unit).
 *
 * Priority order for leased %:
 *   1. HelloData's own adv_leased_pct (most accurate, matches their UI)
 *   2. Other top-level occupancy fields
 *   3. Derived from building_availability.length / total_units (last resort)
 * Unit mix and stories also extracted here.
 */
function extractFromBuildingAvailability(data: any): {
  unitMix: UnitMixEntry[];
  vacancyRate: number | null;
  leasedPct: number | null;
  rentPSF: number | null;
  avgRentPerUnit: number | null;
  stories: number | null;
} {
  const availability: any[] = data.building_availability || [];

  // Total units comes from top-level property field (not building_availability length)
  const totalUnits = parseInt(
    data.total_units ?? data.units ?? data.unit_count ?? data.num_units ??
    data.number_units ?? data.number_of_units ?? 0
  );

  const hasAvailability = Array.isArray(availability) && availability.length > 0;

  // Stories: API docs confirm the exact field name is `number_stories`.
  // Fallback to max unit floor number only as last resort.
  let stories: number | null = null;
  const topLevelStories = parseInt(data.number_stories ?? 0);
  if (topLevelStories > 0) {
    stories = topLevelStories;
    console.log(`      🏢 [BLDG-AVAIL] Stories from number_stories: ${stories}`);
  } else if (hasAvailability) {
    const floorVals = availability
      .map((u: any) => parseInt(u.floor ?? u.floors ?? u.floor_number ?? 0))
      .filter((f: number) => f > 0 && f < 200);
    if (floorVals.length > 0) {
      stories = Math.max(...floorVals);
      console.log(`      🏢 [BLDG-AVAIL] Stories from max unit floor (fallback): ${stories}`);
    }
  }

  // PRIMARY: Use occupancy_over_time — this is exactly what HelloData's UI shows.
  // The most recent entry's `leased` field is a decimal (0-1) representing leased %.
  // The most recent entry's `exposure` field is also a decimal (0-1).
  const parseF = (v: any) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  let leasedPct: number | null = null;
  let vacancyRate: number | null = null;

  // In HelloData's API:
  //   occupancy_over_time.leased   = ADVANCED leased % (signed leases incl. future move-ins = "Leased % (Adv)")
  //   occupancy_over_time.exposure = ACTUAL vacancy % (units available now    = "Vacancy" in Hello Data popup)
  //   physical leased              = 100 - exposure  (= "Leased" in Hello Data popup)
  // We store adv leased in leasedPct and exposure-derived vacancy in vacancyRate.
  const occupancyHistory: any[] = Array.isArray(data.occupancy_over_time) ? data.occupancy_over_time : [];
  if (occupancyHistory.length > 0) {
    const sorted = [...occupancyHistory].sort((a: any, b: any) => {
      const dateA = new Date(a.as_of || 0).getTime();
      const dateB = new Date(b.as_of || 0).getTime();
      return dateB - dateA;
    });
    const mostRecent = sorted[0];
    const rawLeased   = parseF(mostRecent.leased);    // advanced leased (decimal 0-1)
    const rawExposure = parseF(mostRecent.exposure);  // true vacancy    (decimal 0-1)
    if (rawLeased !== null) {
      leasedPct = parseFloat((rawLeased * 100).toFixed(1));
    }
    if (rawExposure !== null) {
      // exposure IS the true vacancy — use it directly for vacancyRate
      vacancyRate = parseFloat((rawExposure * 100).toFixed(1));
      console.log(`      📊 [BLDG-AVAIL] occupancy_over_time[${mostRecent.as_of}]: adv_leased=${leasedPct}%, exposure(vacancy)=${vacancyRate}%`);
    } else if (rawLeased !== null && leasedPct !== null) {
      // No exposure field — fall back to deriving vacancy from advanced leased
      vacancyRate = parseFloat((100 - leasedPct).toFixed(1));
      console.log(`      📊 [BLDG-AVAIL] occupancy_over_time[${mostRecent.as_of}]: adv_leased=${leasedPct}% (no exposure; vacancy derived=${vacancyRate}%)`);
    }
  }

  // FALLBACK: derive vacancy from building_availability when occupancy_over_time is absent.
  if (leasedPct === null && hasAvailability && totalUnits > 0) {
    const vacantUnits = availability.filter((u: any) => u.exit_market === null || u.exit_market === undefined).length;
    vacancyRate = parseFloat(((vacantUnits / totalUnits) * 100).toFixed(1));
    leasedPct = parseFloat((100 - vacancyRate).toFixed(1));
    console.log(`      📊 [BLDG-AVAIL] ${vacantUnits} vacant / ${totalUnits} total → vacancy=${vacancyRate}%, adv_leased=${leasedPct}% (fallback from building_availability)`);
  }

  // Only use currently active listings (exit_market == null) for rent/unit mix.
  // Per API docs: exit_market == null means the unit is still being marketed (available/vacant).
  // Using asking price (price field) per API docs; effective_price is discounted and lower.
  const activeUnits = availability.filter((u: any) => u.exit_market === null || u.exit_market === undefined);

  let rentPSF: number | null = null;
  let avgRentPerUnit: number | null = null;
  if (activeUnits.length > 0) {
    let totalPrice = 0, totalSqft = 0, rentCount = 0;
    for (const unit of activeUnits) {
      const price = unit.price || unit.effective_price || 0;
      const sqft = unit.sqft || 0;
      if (price > 0 && sqft > 0) { totalPrice += price; totalSqft += sqft; rentCount++; }
    }
    if (totalSqft > 0) rentPSF = parseFloat((totalPrice / totalSqft).toFixed(2));
    if (rentCount > 0) avgRentPerUnit = parseFloat((totalPrice / rentCount).toFixed(0));
  }

  // Unit mix: discover ALL bedroom types (rented + vacant) so fully-occupied types appear.
  // Rent values come from ACTIVE units only (asking price, matching HelloData UI).
  // If a type has zero active units, rent falls back to all units of that type.
  const allMixGroups: Record<string, { totalRent: number; totalSqft: number; count: number }> = {};
  const activeMixGroups: Record<string, { totalRent: number; totalSqft: number; count: number }> = {};
  for (const unit of availability) {
    const bed = unit.bed ?? unit.beds ?? unit.bedrooms ?? null;
    const sqft = unit.sqft || 0;
    const price = unit.price || unit.effective_price || 0;
    if (sqft <= 0 || price <= 0 || bed === null) continue;
    const bedNum = parseInt(String(bed));
    if (isNaN(bedNum)) continue;
    const label = bedNum === 0 ? 'Studio' : `${bedNum} BR`;
    if (!allMixGroups[label]) allMixGroups[label] = { totalRent: 0, totalSqft: 0, count: 0 };
    allMixGroups[label].totalRent += price;
    allMixGroups[label].totalSqft += sqft;
    allMixGroups[label].count++;
    const isActive = unit.exit_market === null || unit.exit_market === undefined;
    if (isActive) {
      if (!activeMixGroups[label]) activeMixGroups[label] = { totalRent: 0, totalSqft: 0, count: 0 };
      activeMixGroups[label].totalRent += price;
      activeMixGroups[label].totalSqft += sqft;
      activeMixGroups[label].count++;
    }
  }
  // Normalize: totalRent / count = asking avgRent (active) or fallback to all-units avgRent
  const groups: Record<string, { totalRent: number; totalSqft: number; count: number }> = {};
  for (const label of Object.keys(allMixGroups)) {
    const all = allMixGroups[label];
    const active = activeMixGroups[label];
    groups[label] = {
      totalRent: active ? (active.totalRent / active.count) * all.count : all.totalRent,
      totalSqft: all.totalSqft,
      count: all.count,
    };
  }

  return {
    unitMix: groupsToMix(groups),
    vacancyRate,
    leasedPct,
    rentPSF,
    avgRentPerUnit,
    stories,
  };
}

interface HelloDataProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  units?: number;
  yearBuilt?: number;
  stories?: number;
}

interface ComparableSearchParams {
  address: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  radiusMiles: number;
  yearBuiltMin: number;
  limit: number;
}

interface ComparableSearchResult {
  success: boolean;
  comparables: HelloDataComparable[];
  averagePricePerSqFt: number;
  medianPricePerSqFt: number;
  comparableCount: number;
  searchRadius: number;
  error?: string;
  suggestedAddress?: string; // Dec 11, 2025: Closest address from HelloData when exact match not found
}

// Internal result type for searchPropertyWithSuggestions
interface SearchPropertyResult {
  property: HelloDataProperty | null;
  suggestedAddresses: string[]; // Alternative addresses found in HelloData
}

export class HelloDataService {
  private apiKey: string;
  private baseUrl: string = 'https://api.hellodata.ai';
  private geocodioService: GeocodioService;

  constructor() {
    this.apiKey = process.env.HELLODATA_API_KEY || '';
    this.geocodioService = new GeocodioService();
    if (!this.apiKey) {
      console.warn('⚠️ HELLODATA_API_KEY not configured');
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in miles
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Step 1: Search for property by address with location validation
   * Uses provided city/state if available, otherwise geocodes to get normalized location
   * CRITICAL FIX: Accept pre-geocoded city/state to avoid misinterpretation of street names
   * (e.g., "0 Monroe Road, Clayton, NC" was being geocoded as "Monroe, LA")
   * @param address - Full address string to search
   * @param expectedCityInput - Pre-geocoded city name (optional, skips redundant geocoding)
   * @param expectedStateInput - Pre-geocoded state abbreviation (optional, skips redundant geocoding)
   */
  private async searchProperty(
    address: string,
    expectedCityInput?: string,
    expectedStateInput?: string,
    originalLat?: number,
    originalLng?: number
  ): Promise<{ property: HelloDataProperty | null; suggestedAddress?: string; suggestedDistance?: number }> {
    if (!this.apiKey) {
      console.error('❌ [HELLODATA] API key not configured - cannot search property');
      throw new Error('HelloData API key not configured');
    }

    try {
      console.log(`🔍 [HELLODATA] Step 1: Searching for property "${address}"`);
      
      let expectedCity: string;
      let expectedState: string;
      
      // CRITICAL FIX: Use pre-geocoded city/state if provided to avoid misinterpretation
      // This prevents addresses like "0 Monroe Road, Clayton, NC" from being geocoded as "Monroe, LA"
      if (expectedCityInput && expectedStateInput) {
        expectedCity = expectedCityInput.toLowerCase();
        expectedState = expectedStateInput.toLowerCase();
        console.log(`📍 [HELLODATA] Using PRE-GEOCODED expected location: ${expectedCityInput}, ${expectedStateInput}`);
      } else {
        // Fallback: Geocode the input address to get normalized city/state/ZIP
        console.log(`📍 [HELLODATA] Step 1a: Geocoding address for location validation (no pre-geocoded data)`);
        const geocoded = await this.geocodioService.getAddressComponents(address);
        
        if (!geocoded.success || !geocoded.city || !geocoded.state) {
          console.log(`⚠️ [HELLODATA] Failed to geocode address - cannot validate location`);
          return { property: null };
        }
        
        expectedCity = geocoded.city.toLowerCase();
        expectedState = geocoded.state.toLowerCase();
        console.log(`📍 [HELLODATA] Expected location from geocode: ${geocoded.city}, ${geocoded.state} ${geocoded.zip || ''}`);
      }
      
      // Step 1b: Search HelloData with retry logic and 30s timeout
      const startTime = Date.now();
      const data = await retryWithBackoff(async () => {
        const response = await fetchWithTimeout(`${this.baseUrl}/property/search?q=${encodeURIComponent(address)}`, {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }, 30000);

        if (!response.ok) {
          const errorText = await response.text();
          const responseTime = Date.now() - startTime;
          apiCallTracker.logCall('HelloData', 'property/search', false, responseTime, {
            errorMessage: `${response.status} ${response.statusText} - ${errorText}`
          });
          throw new Error(`Property search failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
      });
      
      // Log successful API call
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('HelloData', 'property/search', true, responseTime);
      
      // Response is an array directly, not {properties: [...]}
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`⚠️ [HELLODATA] No properties found for "${address}"`);
        return { property: null };
      }

      // Step 1c: Validate location match - find first property that matches city/state
      console.log(`🔍 [HELLODATA] Validating ${data.length} search results against expected location`);
      
      for (let i = 0; i < data.length; i++) {
        const property = data[i];
        const propertyCity = (property.city || '').toLowerCase();
        const propertyState = (property.state || '').toLowerCase();
        
        console.log(`   ${i + 1}. ${property.street_address}, ${property.city}, ${property.state}`);
        
        // Check if city and state match
        if (propertyCity === expectedCity && propertyState === expectedState) {
          console.log(`✅ [HELLODATA] MATCH FOUND: ${property.street_address}, ${property.city}, ${property.state} (ID: ${property.id})`);
          
          return {
            property: {
              id: property.id,
              address: property.street_address || '',
              city: property.city || '',
              state: property.state || '',
              zipCode: property.zip_code || '',
              latitude: property.lat,
              longitude: property.lon,
              units: property.number_units,
              yearBuilt: property.year_built,
              stories: property.stories
            }
          };
        } else {
          console.log(`      ❌ Location mismatch: expected ${expectedCity}, ${expectedState} but got ${propertyCity}, ${propertyState}`);
        }
      }
      
      // No matching property found - but collect suggestions from returned results (Dec 11, 2025)
      console.log(`[HELLODATA] No properties matched the expected location ${expectedCity}, ${expectedState}`);
      console.log(`   HelloData returned ${data.length} results but none in the correct city/state`);
      
      // Collect the first result as a suggestion for the user to try
      let suggestedAddress: string | undefined;
      let suggestedDistance: number | undefined;
      if (data.length > 0) {
        const firstResult = data[0];
        suggestedAddress = `${firstResult.street_address}, ${firstResult.city}, ${firstResult.state}`;
        
        // Calculate distance if we have coordinates for both original and suggested
        if (originalLat && originalLng && firstResult.lat && firstResult.lon) {
          suggestedDistance = this.calculateDistance(originalLat, originalLng, firstResult.lat, firstResult.lon);
          console.log(`[HELLODATA] Suggested closest address: ${suggestedAddress} (${suggestedDistance.toFixed(2)} miles from original)`);
        } else {
          console.log(`[HELLODATA] Suggested closest address: ${suggestedAddress}`);
        }
      }
      
      return { property: null, suggestedAddress, suggestedDistance };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [HELLODATA] Property search error:`, errorMsg);
      
      // Re-throw authentication/configuration errors so they can be properly handled upstream
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Bad credentials') || 
          errorMsg.includes('key not configured') || errorMsg.includes('authentication')) {
        throw error;
      }
      
      // For other errors (network, timeout, etc.), return null to allow graceful degradation
      return { property: null };
    }
  }

  /**
   * Step 2: Get full property details for comparables
   */
  private async getPropertyDetails(propertyId: string): Promise<any | null> {
    try {
      console.log(`📋 [HELLODATA] Step 2b: Fetching full property details for ${propertyId}`);
      
      // Use retry logic with 30s timeout for reliability
      const startTime = Date.now();
      const data = await retryWithBackoff(async () => {
        const response = await fetchWithTimeout(`${this.baseUrl}/property/${propertyId}`, {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey
          }
        }, 30000);

        if (!response.ok) {
          const errorText = await response.text();
          const responseTime = Date.now() - startTime;
          apiCallTracker.logCall('HelloData', 'property/{id}', false, responseTime, {
            errorMessage: `${response.status} - ${errorText}`
          });
          console.error(`❌ [HELLODATA] Property details fetch failed:`, errorText);
          throw new Error(`Property details fetch failed: ${response.status}`);
        }

        return await response.json();
      });
      
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('HelloData', 'property/{id}', true, responseTime);
      
      console.log(`✅ [HELLODATA] Got full property details for ${propertyId}`);

      // Dump ALL top-level keys so we can discover correct field names for extraction
      const allKeys = Object.keys(data);
      console.log(`🔍 [HELLODATA-FIELDS] ALL keys in property details response (${allKeys.length} total):`);
      console.log(`   ${allKeys.join(', ')}`);

      // Log occupancy/leased candidate fields
      const occupancyFields = ['leased_percentage','percent_leased','leased','occupancy_rate','occupancy','percent_occupied',
        'adv_leased_pct','adv_leased','adv_leased_percentage','adv_occupancy','leased_pct','leasing_percentage',
        'physical_occupancy','economic_occupancy','leased_units_pct','leased_rate','adv_leased_rate'];
      console.log(`📊 [HELLODATA-FIELDS] Occupancy/leased fields:`);
      occupancyFields.forEach(f => { if (data[f] !== undefined) console.log(`   ${f}: ${data[f]}`); });

      // Log stories/floors candidate fields (number_stories is the correct API field per docs)
      const storiesFields = ['number_stories','stories','num_floors','floors','number_of_stories','num_stories','story_count','building_stories','num_levels','floor_count','total_floors'];
      console.log(`🏢 [HELLODATA-FIELDS] Stories/floors fields:`);
      storiesFields.forEach(f => { if (data[f] !== undefined) console.log(`   ${f}: ${data[f]}`); });

      // Log sqft/building-size candidate fields
      const sqftFields = ['sqft','building_size','buildingSize','total_sqft','gross_sqft','building_sqft','gross_square_feet','total_square_feet','rentable_sqft','net_sqft'];
      console.log(`📐 [HELLODATA-FIELDS] Building size/sqft fields:`);
      sqftFields.forEach(f => { if (data[f] !== undefined) console.log(`   ${f}: ${data[f]}`); });

      // Log vacancy candidate fields
      const vacancyFields = ['vacancy_rate','vacancy','current_vacancy','vacant_pct','physical_vacancy','economic_vacancy','vacant_percentage'];
      console.log(`🏠 [HELLODATA-FIELDS] Vacancy fields:`);
      vacancyFields.forEach(f => { if (data[f] !== undefined) console.log(`   ${f}: ${data[f]}`); });

      // Log exposure and trend candidate fields
      const trendFields = ['exposure','adv_exposure','market_exposure','exposure_rate','exposure_pct','exposure_percentage',
        'leased_percentage_change','leased_pct_change','adv_leased_change','exposure_change','adv_exposure_change'];
      console.log(`📈 [HELLODATA-FIELDS] Exposure/trend fields:`);
      trendFields.forEach(f => { if (data[f] !== undefined) console.log(`   ${f}: ${data[f]}`); });

      // Log building_availability (PRIMARY source per API docs)
      if (data.building_availability !== undefined) {
        const ba = data.building_availability;
        console.log(`🏠 [HELLODATA-FIELDS] building_availability: ${Array.isArray(ba) ? `[${ba.length} items]` : ba}`);
        if (Array.isArray(ba) && ba.length > 0) {
          console.log(`   First unit keys: ${Object.keys(ba[0]).join(', ')}`);
          console.log(`   First unit sample: ${JSON.stringify(ba[0])}`);
        }
      } else {
        console.log(`🏠 [HELLODATA-FIELDS] building_availability: NOT PRESENT in response`);
      }
      // Log total_units / units field  
      console.log(`🏠 [HELLODATA-FIELDS] unit count fields: total_units=${data.total_units ?? 'n/a'}, units=${data.units ?? 'n/a'}, unit_count=${data.unit_count ?? 'n/a'}, num_units=${data.num_units ?? 'n/a'}, number_units=${data.number_units ?? 'n/a'}`);
      // Log other unit mix candidate array fields
      const unitFields = ['units','unit_availabilities','availabilities','unit_list','floorplans','unit_types',
        'unit_mix','floor_plans','floor_plan_list','unit_breakdown','apartment_units','rental_units','units_available'];
      console.log(`🏠 [HELLODATA-FIELDS] Other unit mix array fields:`);
      unitFields.forEach(f => { if (data[f] !== undefined) console.log(`   ${f}: ${Array.isArray(data[f]) ? `[${data[f].length} items] first: ${JSON.stringify(data[f][0])}` : data[f]}`); });

      // Property name fields
      console.log(`🏷️ [HELLODATA-FIELDS] Name fields: building_name="${data.building_name||'null'}" property_name="${data.property_name||'null'}" name="${data.name||'null'}"`);
      
      return data;
    } catch (error) {
      console.error(`❌ [HELLODATA] Property details error:`, error);
      return null;
    }
  }

  /**
   * Find comparables using simple_subject format with coordinates and ZIP code
   * This works even if the property doesn't exist in HelloData's database
   */
  private async findComparablesWithCoordinates(
    latitude: number,
    longitude: number,
    zipCode: string | undefined,
    topN: number = 10,
    maxRadius?: number
  ): Promise<any[]> {
    try {
      console.log(`🔎 [HELLODATA] Finding ${topN} comparables using coordinates: ${latitude}, ${longitude}`);
      if (zipCode) {
        console.log(`   ZIP Code: ${zipCode}`);
      }
      if (maxRadius) {
        console.log(`   Max radius: ${maxRadius} miles`);
      }
      
      // Build query parameters (topN and maxDistance are query params, NOT body properties)
      const params = new URLSearchParams();
      // Dec 30, 2025: Request 50 properties (HelloData max) to ensure we find all apartments in area
      // Then filter by our criteria (2020+, 150+ units, $1.75+/sqft) and distance
      params.append('topN', '50');  // HelloData max is 50
      
      // Dec 30, 2025: RESPECT the caller's radius - use 3 miles as default
      // The caller determines the search radius, not a hardcoded minimum
      const searchRadius = maxRadius || 3;  // Default 3 miles per user requirement
      params.append('maxDistance', searchRadius.toString());
      console.log(`   Search radius: ${searchRadius} miles`);
      console.log(`   Requesting up to 50 properties from HelloData`);
      console.log(`   (Will filter by: 2020+, 150+ units, $1.75+/sqft after retrieval)`)
      
      // CRITICAL FIX (Dec 19, 2025): HelloData API REQUIRES property type flags in simple_subject
      // Without them, the API returns 422 "Validation Failed - Could not match the union"
      // Dec 30, 2025: Simple approach - just get ALL apartment properties in radius
      // We do our own filtering by criteria (2020+, 150+ units, $1.75+/sqft) after
      const requestBody = {
        simple_subject: {
          lat: latitude,
          lon: longitude,
          is_single_family: false,
          is_apartment: true,
          is_condo: false
        }
      };
      
      console.log(`📤 [HELLODATA] Sending request:`);
      console.log(`   URL: ${this.baseUrl}/property/comparables?${params.toString()}`);
      console.log(`   Body:`, JSON.stringify(requestBody, null, 2));

      // Retry comparables search with exponential backoff and 30s timeout
      const startTime = Date.now();
      const data = await retryWithBackoff(async () => {
        const response = await fetchWithTimeout(`${this.baseUrl}/property/comparables?${params.toString()}`, {
          method: 'POST',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }, 30000);

        if (!response.ok) {
          const errorText = await response.text();
          const responseTime = Date.now() - startTime;
          apiCallTracker.logCall('HelloData', 'property/comparables', false, responseTime, {
            errorMessage: `${response.status} ${response.statusText} - ${errorText}`
          });
          console.error(`❌ [HELLODATA] API Error Response:`, errorText);
          throw new Error(`Comparables search failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
      });
      
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('HelloData', 'property/comparables', true, responseTime);
      
      // ENHANCED LOGGING (Dec 19, 2025): Log full API response for debugging
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📥 [HELLODATA API RESPONSE] Response Time: ${responseTime}ms`);
      console.log(`${'='.repeat(80)}`);
      
      if (!data || !data.comparables || data.comparables.length === 0) {
        console.log(`⚠️ [HELLODATA] API returned ZERO comparables`);
        console.log(`   Full response: ${JSON.stringify(data, null, 2)}`);
        console.log(`${'='.repeat(80)}\n`);
        return [];
      }

      console.log(`✅ [HELLODATA] API returned ${data.comparables.length} raw comparables`);
      
      // DEBUG: Log raw field names from first comparable to identify correct field names
      if (data.comparables.length > 0) {
        console.log(`\n🔍 [HELLODATA DEBUG] RAW FIELD NAMES in first comparable:`);
        console.log(JSON.stringify(Object.keys(data.comparables[0]), null, 2));
        console.log(`\n🔍 [HELLODATA DEBUG] FIRST 3 RAW COMPARABLES (full objects):`);
        data.comparables.slice(0, 3).forEach((comp: any, idx: number) => {
          console.log(`\n--- Comparable ${idx + 1} ---`);
          console.log(JSON.stringify(comp, null, 2));
        });
      }
      
      console.log(`\n📋 [HELLODATA] FULL COMPARABLE LIST FROM API:`);
      data.comparables.forEach((comp: any, idx: number) => {
        const name = comp.building_name || comp.property_name || comp.name || 'Unknown';
        const addr = comp.street_address || comp.address || 'No address';
        const units = comp.number_units || comp.units || comp.unitCount || comp.total_units || 'N/A';
        const yearBuilt = comp.year_built || comp.yearBuilt || comp.vintage || 'N/A';
        const distance = comp.distance_miles || comp.distance || 'N/A';
        console.log(`   ${idx + 1}. "${name}" - ${addr}`);
        console.log(`      Units: ${units}, Year Built: ${yearBuilt}, Distance: ${distance} miles`);
        console.log(`      is_single_family: ${comp.is_single_family}, property_type: ${comp.property_type || 'N/A'}`);
      });
      console.log(`${'='.repeat(80)}\n`);
      
      // Filter to only apartments and townhomes (exclude single-family residential)
      const filteredComparables = data.comparables.filter((comp: any) => {
        const isSingleFamily = comp.is_single_family === true;
        const isApartment = comp.is_apartment === true;
        const units = parseInt(comp.number_units || comp.units || comp.unitCount || 0);
        const propertyType = (comp.property_type || comp.propertyType || '').toLowerCase();
        
        // Exclude only single-family residential
        const isSFR = propertyType.includes('single') || 
                      propertyType.includes('sfr') || 
                      (propertyType.includes('residential') && !propertyType.includes('multi'));
        
        // Include: apartments, townhomes, multifamily (5+ units)
        const isTownhome = propertyType.includes('townhome') || propertyType.includes('townhouse');
        const isMultifamily = units >= 5 || isApartment || propertyType.includes('apartment') || propertyType.includes('multifamily');
        
        const include = (isMultifamily || isTownhome) && !isSingleFamily && !isSFR;
        
        if (include) {
          console.log(`🏢 [HELLODATA] Including: ${comp.street_address || comp.address}, units=${units}, type=${propertyType}`);
        } else {
          console.log(`🏠 [HELLODATA] Excluding single-family: ${comp.street_address || comp.address}, units=${units}, is_single_family=${isSingleFamily}, type=${propertyType}`);
        }
        
        return include;
      });
      
      console.log(`🏢 [HELLODATA] After filtering: ${filteredComparables.length}/${data.comparables.length} are apartments/townhomes`);
      return filteredComparables;
    } catch (error) {
      console.error(`❌ [HELLODATA] Comparables search error:`, error);
      return [];
    }
  }

  /**
   * Step 3: Find comparables using POST /comparables with full property details
   * (Legacy method - kept for backward compatibility)
   */
  private async findComparables(
    subjectProperty: HelloDataProperty,
    topN: number = 5,
    maxRadius?: number
  ): Promise<any[]> {
    try {
      console.log(`🔎 [HELLODATA] Step 3: Finding ${topN} comparables for ${subjectProperty.address}`);
      if (maxRadius) {
        console.log(`   Max radius: ${maxRadius} miles`);
      }
      
      // First, get the complete property details
      const fullPropertyDetails = await this.getPropertyDetails(subjectProperty.id);
      if (!fullPropertyDetails) {
        console.log(`⚠️ [HELLODATA] Could not get full property details for comparables search`);
        return [];
      }
      
      // Use the complete property object as subject (required by API)
      const requestBody: any = {
        subject: fullPropertyDetails
      };
      
      // CRITICAL FIX (Dec 18, 2025): Pass topN and maxDistance as query parameters
      // Dec 30, 2025: Request 50 properties (HelloData max), respect caller's radius
      const params = new URLSearchParams();
      params.append('topN', '50');  // HelloData max is 50
      const searchRadius = maxRadius || 3;  // Default 3 miles per user requirement
      params.append('maxDistance', searchRadius.toString());
      console.log(`   Search radius: ${searchRadius} miles, topN: 50`);
      
      const apiUrl = `${this.baseUrl}/property/comparables?${params.toString()}`;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📤 [HELLODATA findComparables] Sending request with full property details`);
      console.log(`${'='.repeat(80)}`);
      console.log(`   URL: ${apiUrl}`);
      console.log(`   Subject Property: ${subjectProperty.address}`);
      console.log(`   Subject ID: ${subjectProperty.id}`);

      // Wrap in retry logic with 30s timeout for reliability
      const startTime = Date.now();
      const data = await retryWithBackoff(async () => {
        const response = await fetchWithTimeout(apiUrl, {
          method: 'POST',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }, 30000);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [HELLODATA] API Error Response:`, errorText);
          throw new Error(`Comparables search failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📥 [HELLODATA findComparables RESPONSE] Response Time: ${responseTime}ms`);
      console.log(`${'='.repeat(80)}`);
      
      if (!data || !data.comparables || data.comparables.length === 0) {
        console.log(`⚠️ [HELLODATA] API returned ZERO comparables`);
        console.log(`   Full response: ${JSON.stringify(data, null, 2)}`);
        console.log(`${'='.repeat(80)}\n`);
        return [];
      }

      console.log(`✅ [HELLODATA] API returned ${data.comparables.length} raw comparables`);
      console.log(`\n📋 [HELLODATA findComparables] FULL COMPARABLE LIST FROM API:`);
      data.comparables.forEach((comp: any, idx: number) => {
        const name = comp.building_name || comp.property_name || comp.name || 'Unknown';
        const addr = comp.street_address || comp.address || 'No address';
        const units = comp.number_units || comp.units || comp.unitCount || 'N/A';
        const yearBuilt = comp.year_built || comp.yearBuilt || 'N/A';
        const distance = comp.distance_miles || comp.distance || 'N/A';
        console.log(`   ${idx + 1}. "${name}" - ${addr}`);
        console.log(`      Units: ${units}, Year Built: ${yearBuilt}, Distance: ${distance} miles`);
        console.log(`      is_single_family: ${comp.is_single_family}, property_type: ${comp.property_type || 'N/A'}`);
      });
      console.log(`${'='.repeat(80)}\n`);
      
      return data.comparables;
    } catch (error) {
      console.error(`❌ [HELLODATA] Comparables search error:`, error);
      return [];
    }
  }

  /**
   * Search for comparable properties using correct API workflow
   */
  async searchComparables(params: ComparableSearchParams): Promise<ComparableSearchResult> {
    try {
      console.log(`🔍 HelloData: Searching comparables for ${params.address}`);
      console.log(`   Parameters:`, {
        radius: params.radiusMiles,
        yearBuiltMin: params.yearBuiltMin,
        propertyType: params.propertyType,
        latitude: params.latitude,
        longitude: params.longitude,
        limit: params.limit
      });

      if (!this.apiKey) {
        throw new Error('HelloData API key not configured');
      }

      // CRITICAL FIX (Dec 4, 2025): Geocode address first to get city/state
      // This prevents addresses like "10333 Robinson church rd" from being geocoded as "Robinson, TX"
      // when the intended location is "Charlotte, NC"
      console.log(`📍 [HELLODATA] Geocoding address for location validation...`);
      const geocoded = await this.geocodioService.geocodeAddress(params.address);
      const geocodedCity = geocoded.success ? geocoded.city : undefined;
      const geocodedState = geocoded.success ? geocoded.state : undefined;
      
      if (geocoded.success) {
        console.log(`✅ [HELLODATA] Geocoded to: ${geocoded.latitude}, ${geocoded.longitude}`);
        console.log(`   City: ${geocodedCity}, State: ${geocodedState}, ZIP: ${geocoded.zipCode}`);
      }

      // CRITICAL FIX (Dec 29, 2025): Always use Geocodio coordinates for comparable search
      // HelloData's searchProperty often returns wrong properties (e.g., "500 Ceret Alley" for "6260 Nolensville Pike")
      // Trust Geocodio's coordinates which are accurate, not HelloData's property search
      let searchLat = params.latitude || (geocoded.success ? geocoded.latitude : undefined);
      let searchLng = params.longitude || (geocoded.success ? geocoded.longitude : undefined);
      const searchZip = geocoded.success ? geocoded.zipCode : undefined;
      
      // Log which coordinates we're using
      console.log(`📍 [HELLODATA] Using coordinates for search:`);
      console.log(`   Latitude: ${searchLat}, Longitude: ${searchLng}`);
      console.log(`   Source: ${params.latitude ? 'caller-provided' : (geocoded.success ? 'Geocodio' : 'none')}`);
      
      if (!searchLat || !searchLng) {
        console.log(`⚠️ [HELLODATA] No valid coordinates available for comparable search`);
        return {
          success: false,
          comparables: [],
          averagePricePerSqFt: 0,
          medianPricePerSqFt: 0,
          comparableCount: 0,
          searchRadius: params.radiusMiles,
          error: `Could not geocode address: ${params.address}`
        };
      }

      // Step 3: Find comparables using coordinates-based search with apartment filters
      // CRITICAL FIX (Dec 29, 2025): Use Geocodio coordinates directly, skip HelloData's searchProperty
      // which was returning incorrect subject properties
      let rawComparables: any[] = [];
      
      // Use coordinates-based search with proper apartment filters
      rawComparables = await this.findComparablesWithCoordinates(
        searchLat,
        searchLng,
        searchZip,
        params.limit,
        params.radiusMiles
      );
      
      if (rawComparables.length === 0) {
        return {
          success: false,
          comparables: [],
          averagePricePerSqFt: 0,
          medianPricePerSqFt: 0,
          comparableCount: 0,
          searchRadius: params.radiusMiles,
          error: `No multifamily comparables found within ${params.radiusMiles || 3}-mile radius. The area may lack qualifying rental properties.`
        };
      }

      // Parse comparables
      const comparables = this.parseComparables(rawComparables);
      
      // Filter comparables that have required data (price and sqft)
      const validComparables = comparables.filter(comp => 
        comp.salePrice > 0 && comp.buildingSize > 0 && comp.pricePerSqFt > 0
      );

      // Apply filters
      let filteredComparables = validComparables;
      
      // Apply year built filter if specified
      if (params.yearBuiltMin) {
        filteredComparables = filteredComparables.filter(comp => comp.yearBuilt >= params.yearBuiltMin);
      }
      
      // Apply property type filter if specified
      if (params.propertyType) {
        const targetType = params.propertyType.toLowerCase();
        filteredComparables = filteredComparables.filter(comp => 
          comp.propertyType.toLowerCase().includes(targetType) || 
          targetType.includes(comp.propertyType.toLowerCase())
        );
      }

      if (filteredComparables.length === 0) {
        console.log(`⚠️ No valid comparables found with price/sqft data`);
        return {
          success: false,
          comparables: [],
          averagePricePerSqFt: 0,
          medianPricePerSqFt: 0,
          comparableCount: 0,
          searchRadius: params.radiusMiles,
          error: `Found comparables but none had complete pricing data. Unable to calculate market rent estimates.`
        };
      }

      // Calculate metrics - MUST sort for accurate median
      const pricesPerSqFt = filteredComparables.map(c => c.pricePerSqFt).sort((a, b) => a - b);
      const averagePricePerSqFt = pricesPerSqFt.reduce((sum, p) => sum + p, 0) / pricesPerSqFt.length;
      const medianPricePerSqFt = pricesPerSqFt[Math.floor(pricesPerSqFt.length / 2)];

      console.log(`✅ Found ${filteredComparables.length} valid comparables`);
      console.log(`   Average price/sqft: $${averagePricePerSqFt.toFixed(2)}`);
      console.log(`   Median price/sqft: $${medianPricePerSqFt.toFixed(2)}`);

      return {
        success: true,
        comparables: filteredComparables,
        averagePricePerSqFt,
        medianPricePerSqFt,
        comparableCount: filteredComparables.length,
        searchRadius: params.radiusMiles
      };
    } catch (error) {
      console.error('❌ HelloData comparable search failed:', error);
      return {
        success: false,
        comparables: [],
        averagePricePerSqFt: 0,
        medianPricePerSqFt: 0,
        comparableCount: 0,
        searchRadius: params.radiusMiles,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search with expanding radius (3 miles -> 5 miles if needed)
   */
  async searchComparablesWithExpanding(
    address: string,
    propertyType: string | null,
    latitude?: number,
    longitude?: number
  ): Promise<ComparableSearchResult> {
    const currentYear = new Date().getFullYear();
    const yearBuiltMin = currentYear - 5; // Built in last 5 years

    // Try 3 miles first
    console.log(`🎯 Attempting comparable search at 3 miles radius`);
    let result = await this.searchComparables({
      address,
      latitude,
      longitude,
      propertyType: propertyType || undefined,
      radiusMiles: 3,
      yearBuiltMin,
      limit: 5
    });

    // If we found at least 1 comparable, we're done
    if (result.success && result.comparableCount >= 1) {
      console.log(`✅ Found ${result.comparableCount} comparables within 3 miles`);
      return result;
    }

    // Expand to 5 miles
    console.log(`🔄 Expanding search to 5 miles radius (found only ${result.comparableCount} at 3 miles)`);
    result = await this.searchComparables({
      address,
      latitude,
      longitude,
      propertyType: propertyType || undefined,
      radiusMiles: 5,
      yearBuiltMin,
      limit: 5
    });

    if (result.success && result.comparableCount >= 1) {
      console.log(`✅ Found ${result.comparableCount} comparables within 5 miles`);
    } else {
      console.log(`⚠️ Only found ${result.comparableCount} comparables even at 5 miles`);
    }

    return result;
  }

  /**
   * NEW CLASSIFICATION WORKFLOW: Search for multifamily properties meeting specific criteria
   * - Rent per sqft >= $1.75  (REQUIRES property details API call)
   * - Vintage year >= 2020
   * - Units >= 150
   * - Within 3-mile radius
   * 
   * Smart API usage: Filter by vintage/units first, then fetch property details only for candidates
   */
  async searchQualifyingComparables(address: string, options?: {
    latitude?: number;
    longitude?: number;
    productType?: string;  // Jan 12, 2026: Product type for custom filter criteria
  }): Promise<{
    success: boolean;
    qualifyingCount: number;
    comparables: HelloDataComparable[];
    summary: string;
    topRentPSF?: number;
    avgRentPSF?: number;
    topRentPerUnit?: number;
    avgRentPerUnit?: number;
    error?: string;
    // ENHANCEMENT (Dec 9, 2025): Raw counts for educational rejection reasons
    totalComparables?: number;    // All properties within 3 miles
    candidateCount?: number;      // Properties meeting vintage/units criteria
    candidatesWithPricing?: number; // Candidates that had valid pricing data
    // Dec 11, 2025: Suggested address when exact match not found
    suggestedAddress?: string;
    suggestedDistance?: number;   // Distance in miles from original address
    // Dec 15, 2025: Flag indicating coordinate fallback was used (not an error)
    usedCoordinateFallback?: boolean;
  }> {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔍 [HELLODATA] Starting Qualifying Comparable Search`);
      console.log(`${'='.repeat(80)}`);
      console.log(`📍 Address Input: "${address}"`);
      
      if (!this.apiKey) {
        console.error(`❌ [HELLODATA] API key not configured!`);
        throw new Error('HelloData API key not configured');
      }

      // Dec 17, 2025: If coordinates are provided directly, skip geocoding entirely
      let geocoded: {
        success: boolean;
        lat?: number;
        lng?: number;
        city?: string;
        state?: string;
        county?: string;
        zipCode?: string;
      };
      let isAreaFallback = false;
      let fallbackLocation = '';
      
      if (options?.latitude && options?.longitude) {
        console.log(`📍 [HELLODATA] Step 1: Using provided coordinates (${options.latitude}, ${options.longitude}) - skipping geocoding`);
        
        // Use reverse geocoding to get city/state/county for validation
        const reverseResult = await this.geocodioService.reverseGeocode(options.latitude, options.longitude);
        
        geocoded = {
          success: true,
          lat: options.latitude,
          lng: options.longitude,
          city: reverseResult.success ? reverseResult.city : undefined,
          state: reverseResult.success ? reverseResult.state : undefined,
          county: reverseResult.success ? reverseResult.county : undefined,
          zipCode: reverseResult.success ? reverseResult.zipCode : undefined
        };
        console.log(`✅ [HELLODATA] Using direct coordinates with reverse geocode: ${geocoded.city || 'N/A'}, ${geocoded.state || 'N/A'}`);
      } else {
        // Step 1: Geocode address to get coordinates and ZIP code
        console.log(`📍 [HELLODATA] Step 1: Geocoding address for coordinates`);
        geocoded = await this.geocodioService.geocodeAddress(address);
        
        if (!geocoded.success || !geocoded.lat || !geocoded.lng) {
          console.log(`⚠️ [HELLODATA] Exact address geocoding failed - trying city/ZIP fallback`);
          
          // CREATIVE FALLBACK (Dec 11, 2025): Try to extract city/state/ZIP and geocode the area centroid
          // This ensures we can always get SOME comparables even when exact address fails
          const addressParts = address.split(',').map(p => p.trim());
          let fallbackAddress = '';
          
          // Try to extract city, state, ZIP from address
          if (addressParts.length >= 2) {
            // Remove street address, keep city, state, ZIP
            fallbackAddress = addressParts.slice(1).join(', ');
            console.log(`📍 [HELLODATA] Trying area fallback with: "${fallbackAddress}"`);
            
            geocoded = await this.geocodioService.geocodeAddress(fallbackAddress);
            
            if (geocoded.success && geocoded.lat && geocoded.lng) {
              isAreaFallback = true;
              fallbackLocation = fallbackAddress;
              console.log(`✅ [HELLODATA] Area fallback successful! Using ${fallbackAddress} centroid`);
            }
          }
          
          // If area fallback also failed, try ZIP-center geocoding as last resort
          // Jan 13, 2026: Extract ZIP code from address and geocode just the ZIP center
          if (!geocoded.success || !geocoded.lat || !geocoded.lng) {
            console.log(`⚠️ [HELLODATA] Area fallback failed - trying ZIP-center geocoding`);
            
            // Extract ZIP code from address using regex (5 digits or 5-4 format)
            const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
            // Extract state from address (2-letter state code)
            const stateMatch = address.match(/\b([A-Z]{2})\b/);
            // Extract city - usually the first part before comma
            const cityMatch = address.match(/^([^,]+)/);
            
            if (zipMatch) {
              const extractedZip = zipMatch[1];
              const extractedState = stateMatch ? stateMatch[1] : undefined;
              const extractedCity = cityMatch ? cityMatch[1].trim() : undefined;
              
              console.log(`📍 [ZIP-FALLBACK] Extracted ZIP: ${extractedZip}, State: ${extractedState || 'N/A'}, City: ${extractedCity || 'N/A'}`);
              
              // Use geocodeZipOrCityLevel for approximate coordinates
              const zipGeocode = await this.geocodioService.geocodeZipOrCityLevel(
                extractedCity || '',
                extractedState || '',
                extractedZip
              );
              
              if (zipGeocode.success && zipGeocode.lat && zipGeocode.lng) {
                geocoded = {
                  success: true,
                  lat: zipGeocode.lat,
                  lng: zipGeocode.lng,
                  city: zipGeocode.city,
                  state: zipGeocode.state,
                  county: zipGeocode.county,
                  zipCode: zipGeocode.zipCode
                };
                isAreaFallback = true;
                fallbackLocation = `ZIP ${extractedZip} center`;
                console.log(`✅ [ZIP-FALLBACK] ZIP-center geocoding successful: ${geocoded.lat}, ${geocoded.lng}`);
              }
            }
          }
          
          // If all fallbacks failed, return error
          if (!geocoded.success || !geocoded.lat || !geocoded.lng) {
            console.log(`❌ [HELLODATA] All geocoding attempts failed (exact, area, and ZIP)`);
            return {
              success: false,
              qualifyingCount: 0,
              comparables: [],
              summary: '',
              error: `Geocoding failed for address: "${address}". Address may be incomplete or invalid. Manual review required.`
            };
          }
        }
      }
      
      console.log(`✅ [HELLODATA] Geocoded to: ${geocoded.lat}, ${geocoded.lng}${isAreaFallback ? ' (AREA FALLBACK)' : ''}`);
      console.log(`📍 [HELLODATA] Geocoded city/state: ${geocoded.city || 'N/A'}, ${geocoded.state || 'N/A'}`);

      // CRITICAL FIX (Dec 29, 2025): Always use Geocodio coordinates for comparable search
      // HelloData's searchProperty often returns wrong properties (e.g., "500 Ceret Alley" for "6260 Nolensville Pike")
      // The old code was: search HelloData for subject property → use that property's coords → wrong comparables
      // The new code is: trust Geocodio coordinates → search comparables directly → correct comparables
      console.log(`\n📍 [HELLODATA] Step 2: Using Geocodio coordinates for comparable search`);
      console.log(`   Latitude: ${geocoded.lat}, Longitude: ${geocoded.lng}`);
      console.log(`   ZIP: ${geocoded.zipCode || 'N/A'}`);
      console.log(`   Source: ${options?.latitude ? 'caller-provided' : 'Geocodio (trusted)'}`);
      
      let rawComparables: any[] = [];
      let usedCoordinateFallback = false;
      
      // Always use coordinate-based search with Geocodio's accurate coordinates
      // CRITICAL FIX (Dec 18, 2025): Increased radius to 5 miles and topN to 20 to find more comparables
      console.log(`📍 [HELLODATA] Searching for comparables at ${geocoded.lat}, ${geocoded.lng} (ZIP: ${geocoded.zipCode || 'N/A'})`);
      rawComparables = await this.findComparablesWithCoordinates(
        geocoded.lat!, 
        geocoded.lng!, 
        geocoded.zipCode || undefined,
        20, 
        5
      );
      
      if (rawComparables.length === 0) {
        // Dec 15, 2025: If we used coordinate fallback, don't treat as error - it's a valid search that found nothing
        if (usedCoordinateFallback || isAreaFallback) {
          const locationUsed = isAreaFallback ? fallbackLocation : `ZIP ${geocoded.zipCode || 'center'}`;
          console.log(`⚠️ [COORDINATE-FALLBACK] No comparables found using ${locationUsed} - marking as successful coordinate search`);
          return {
            success: true, // Not an error - coordinate search completed successfully
            qualifyingCount: 0,
            comparables: [],
            summary: `[ZIP CENTER] Searched using ${locationUsed} coordinates. No qualifying comparables found within 3 miles.`,
            usedCoordinateFallback: true,
            totalComparables: 0,
            candidateCount: 0,
            candidatesWithPricing: 0
          };
        }
        // Get the correct criteria for this product type
        const filterCriteria = getFilterCriteria(options?.productType);
        const criteriaText = filterCriteria.minGrossRent 
          ? `${filterCriteria.minVintage}+ vintage, ${filterCriteria.minUnits}+ units, $${filterCriteria.minGrossRent.toLocaleString()}+ gross rent`
          : `${filterCriteria.minVintage}+ vintage, ${filterCriteria.minUnits}+ units, $${filterCriteria.minRentPSF?.toFixed(2)}/sqft+`;
        return {
          success: false,
          qualifyingCount: 0,
          comparables: [],
          summary: 'No qualifying multifamily comparables found within 3-mile radius. Property may be in an area without similar rental developments.',
          error: `No qualifying comparables found within 3-mile radius (${criteriaText} required)`
        };
      }

      console.log(`✅ [HELLODATA] Found ${rawComparables.length} raw comparables from API`);
      
      // Dec 19, 2025: Filter to only apartments and townhomes (exclude single-family)
      const originalCount = rawComparables.length;
      rawComparables = rawComparables.filter((comp: any) => {
        const units = parseInt(comp.number_units || comp.units || comp.unit_count || comp.unitCount || 0);
        const isSingleFamily = comp.is_single_family === true;
        const isApartment = comp.is_apartment === true;
        const propertyType = (comp.property_type || comp.propertyType || '').toLowerCase();
        
        // Exclude only single-family residential
        const isSFR = propertyType.includes('single') || 
                      propertyType.includes('sfr') || 
                      (propertyType.includes('residential') && !propertyType.includes('multi'));
        
        // Include: apartments, townhomes, multifamily (5+ units)
        const isTownhome = propertyType.includes('townhome') || propertyType.includes('townhouse');
        const isMultifamily = units >= 5 || isApartment || propertyType.includes('apartment') || propertyType.includes('multifamily');
        
        const include = (isMultifamily || isTownhome) && !isSingleFamily && !isSFR;
        
        if (include) {
          console.log(`🏢 [HELLODATA] Including: ${comp.street_address || comp.address}, units=${units}, type=${propertyType}`);
        } else {
          console.log(`🏠 [HELLODATA] Excluding single-family: ${comp.street_address || comp.address}, units=${units}, is_single_family=${isSingleFamily}, type=${propertyType}`);
        }
        return include;
      });
      
      console.log(`🏢 [HELLODATA] After filtering: ${rawComparables.length}/${originalCount} are apartments/townhomes`);
      
      if (rawComparables.length === 0) {
        return {
          success: true,
          qualifyingCount: 0,
          comparables: [],
          summary: `No apartment buildings or townhomes found in this area. HelloData returned ${originalCount} single-family residential properties which have been filtered out.`,
          totalComparables: 0,
          candidateCount: 0,
          candidatesWithPricing: 0
        };
      }

      // Jan 12, 2026: Get product-type-specific filter criteria
      const filterCriteria = getFilterCriteria(options?.productType);
      
      // Step 3: SMART FILTERING - First filter by vintage and units (no API calls needed)
      console.log(`\n🎯 [HELLODATA] Step 3: Pre-filtering by vintage >= ${filterCriteria.minVintage} and units >= ${filterCriteria.minUnits}`);
      
      // DEBUG: Log each comparable before filtering
      console.log(`\n📊 [DEBUG] Examining all ${rawComparables.length} comparables:`);
      rawComparables.forEach((comp, idx) => {
        // Try multiple possible field names (robust parsing)
        const yearBuilt = parseInt(comp.year_built || comp.vintage || comp.yearBuilt || comp.year || 0);
        const units = parseInt(comp.number_units || comp.units || comp.unitCount || comp.unit_count || comp.num_units || 0);
        const passes = yearBuilt >= filterCriteria.minVintage && units >= filterCriteria.minUnits;
        console.log(`   ${idx + 1}. ${comp.street_address || comp.address || 'Unknown'}`);
        console.log(`      Raw data: year_built="${comp.year_built}", vintage="${comp.vintage}", yearBuilt="${comp.yearBuilt}"`);
        console.log(`      Raw data: number_units="${comp.number_units}", units="${comp.units}", unitCount="${comp.unitCount}"`);
        console.log(`      🏷️ Name fields: building_name="${comp.building_name}", property_name="${comp.property_name}", name="${comp.name}"`);
        console.log(`      Parsed: Vintage=${yearBuilt}, Units=${units}`);
        console.log(`      ${passes ? '✅ PASSES' : '❌ FAILS'} (needs vintage >= ${filterCriteria.minVintage} AND units >= ${filterCriteria.minUnits})`);
      });
      
      const candidates = rawComparables.filter(comp => {
        // Try multiple possible field names for year built (robust parsing)
        const yearBuilt = parseInt(comp.year_built || comp.vintage || comp.yearBuilt || comp.year || 0);
        // Try multiple possible field names for units (robust parsing)
        const units = parseInt(comp.number_units || comp.units || comp.unitCount || comp.unit_count || comp.num_units || 0);
        return yearBuilt >= filterCriteria.minVintage && units >= filterCriteria.minUnits;
      });

      console.log(`\n   Total comparables: ${rawComparables.length}`);
      console.log(`   Candidates (vintage >= ${filterCriteria.minVintage}, units >= ${filterCriteria.minUnits}): ${candidates.length}`);
      console.log(`   Filtered out: ${rawComparables.length - candidates.length}`);

      // Dec 19, 2025: NEW APPROACH - Show ALL apartments but only mark qualifying ones
      // Don't filter out apartments that don't meet criteria - just tag them
      console.log(`\n📋 [HELLODATA] Showing all ${rawComparables.length} apartments/townhomes`);
      console.log(`   ${candidates.length} meet vintage/units criteria (${filterCriteria.minVintage}+, ${filterCriteria.minUnits}+ units)`);
      
      if (candidates.length === 0) {
        console.log(`\n⚠️ [HELLODATA] No candidates meet vintage/units criteria - but showing all apartments`);
        
        // Calculate typical vintage and unit count in the area
        const sampleProps = rawComparables.slice(0, 10).map(comp => {
          const yearBuilt = parseInt(comp.year_built || comp.vintage || comp.yearBuilt || comp.year || 0);
          const units = parseInt(comp.number_units || comp.units || comp.unitCount || comp.unit_count || comp.num_units || 0);
          return { yearBuilt, units };
        });
        
        const propsWithVintage = sampleProps.filter(p => p.yearBuilt > 1900);
        const propsWithUnits = sampleProps.filter(p => p.units > 0);
        
        const avgVintage = propsWithVintage.length > 0 
          ? Math.round(propsWithVintage.reduce((sum, p) => sum + p.yearBuilt, 0) / propsWithVintage.length)
          : 0;
        const avgUnits = propsWithUnits.length > 0
          ? Math.round(propsWithUnits.reduce((sum, p) => sum + p.units, 0) / propsWithUnits.length)
          : 0;
        
        // Build summary showing ALL apartments with criteria breakdown
        let summary = `Found ${rawComparables.length} total comparables within 3 miles\n`;
        summary += `0 met vintage/units criteria (>=${filterCriteria.minVintage}, >=${filterCriteria.minUnits} units)\n`;
        const rentCriteriaText = filterCriteria.minGrossRent 
          ? `rent >= $${filterCriteria.minGrossRent.toLocaleString()}/unit` 
          : `rent >= $${filterCriteria.minRentPSF}/sqft`;
        summary += `0 qualify with ${rentCriteriaText}\n\n`;
        
        if (avgVintage > 0 || avgUnits > 0) {
          summary += `Typical properties in area: ~${avgVintage} vintage, ~${avgUnits} units.\n`;
        }
        
        // Dec 19, 2025: Show ALL apartments (don't filter by multifamily criteria)
        // User wants to see all apartments/townhomes regardless of vintage/units
        const multifamilyComps = rawComparables; // Show all apartments
        
        console.log(`\n📍 [HELLODATA] Showing all ${multifamilyComps.length} apartments/townhomes`);
        
        // If all properties are residential, return early with clear message
        if (multifamilyComps.length === 0) {
          console.log(`⚠️ [HELLODATA] No apartment buildings found - HelloData only returned residential properties`);
          return {
            success: true,
            qualifyingCount: 0,
            comparables: [],
            summary: `No apartment buildings found in this area. HelloData returned ${rawComparables.length} residential properties which have been filtered out. Only multifamily/apartment buildings are shown.`,
            totalComparables: 0,
            candidateCount: 0,
            candidatesWithPricing: 0
          };
        }
        
        // Dec 22, 2025: Fetch pricing for ALL properties, not just candidates
        console.log(`💰 [HELLODATA] Fetching pricing for up to 10 multifamily comparables`);
        
        const allRawForMap: HelloDataComparable[] = [];
        const maxToFetch = Math.min(multifamilyComps.length, 10); // Limit API calls but fetch more
        
        for (let idx = 0; idx < maxToFetch; idx++) {
          const comp = multifamilyComps[idx];
          console.log(`   ${idx + 1}/${maxToFetch}. ${comp.street_address || comp.address || 'Unknown'} (ID: ${comp.id})`);
          
          let lat: number | undefined;
          let lng: number | undefined;
          let rentPsf = 0;
          let avgRentPerUnit: number | undefined;
          let propertyName: string | undefined;
          let fetchedUnitCount: number = 0; // populated from property details, more reliable than comp.number_units
          let fetchedVacancyRate: number | null = null;
          let fetchedDeveloper: string | null = null;
          let fetchedOwner: string | null = null;
          let fetchedPropertyType: string = comp.property_type || comp.propertyType || 'Multifamily';
          let fetchedStories: number | null = null;
          let fetchedLeasedPct: number | null = null;
          let fetchedUnitMix: UnitMixEntry[] | null = null;
          let fetchedWebsiteUrl: string | null = null;
          let fetchedLeasedPctChange: number | null = null;
          let fetchedExposure: number | null = null;
          let fetchedExposureChange: number | null = null;
          let fetchedUnitsVacant: number | null = null;
          let fetchedUnitsExposed: number | null = null;
          
          // Fetch property details to get coordinates AND pricing
          if (comp.id) {
            try {
              const details = await this.getPropertyDetails(comp.id);
              if (details) {
                // Get coordinates
                if (details.lat || details.latitude) {
                  lat = parseFloat(details.lat || details.latitude || 0);
                  lng = parseFloat(details.lon || details.lng || details.longitude || 0);
                  if (lat && lng && lat !== 0 && lng !== 0) {
                    console.log(`      ✅ Got coordinates: ${lat}, ${lng}`);
                  } else {
                    lat = undefined;
                    lng = undefined;
                  }
                }
                
                // Get unit count from property details (more reliable than comparables API response)
                const detailsUnitCount = parseInt(details.number_units || details.units || details.unit_count || details.num_units || 0);
                if (detailsUnitCount > 0) {
                  fetchedUnitCount = detailsUnitCount;
                  console.log(`      🏢 Unit count from property details: ${fetchedUnitCount}`);
                }
                
                // Get property name
                propertyName = details.building_name || details.property_name || details.name || 
                              details.community_name || comp.building_name || comp.property_name || comp.name;

                // PRIMARY: Extract vacancy, leased, stories from building_availability (per API docs)
                const bldgAvail = extractFromBuildingAvailability(details);
                if (bldgAvail.vacancyRate !== null) fetchedVacancyRate = bldgAvail.vacancyRate;
                if (bldgAvail.leasedPct !== null) fetchedLeasedPct = bldgAvail.leasedPct;
                if (bldgAvail.stories !== null) fetchedStories = bldgAvail.stories;
                if (bldgAvail.unitMix.length > 0 && !fetchedUnitMix) fetchedUnitMix = bldgAvail.unitMix;

                // FALLBACK: field-level extraction if building_availability didn't have data
                if (fetchedVacancyRate === null) {
                  const rawV = details.vacancy_rate ?? details.vacancy ?? details.current_vacancy ??
                              details.vacant_pct ?? details.physical_vacancy ?? details.economic_vacancy ??
                              details.vacant_percentage ?? null;
                  fetchedVacancyRate = rawV !== null ? parseFloat(rawV) : null;
                  if (isNaN(fetchedVacancyRate as number)) fetchedVacancyRate = null;
                }
                if (fetchedLeasedPct === null) {
                  const rawLP = details.leased_percentage ?? details.percent_leased ?? details.leased ??
                                details.adv_leased_pct ?? details.adv_leased ?? details.adv_leased_percentage ??
                                details.leased_pct ?? details.leasing_percentage ?? details.adv_occupancy ??
                                details.occupancy_rate ?? details.occupancy ?? details.percent_occupied ??
                                details.physical_occupancy ?? details.economic_occupancy ??
                                details.leased_units_pct ?? details.adv_leased_rate ?? null;
                  fetchedLeasedPct = rawLP !== null ? parseFloat(rawLP) : null;
                  if (isNaN(fetchedLeasedPct as number)) fetchedLeasedPct = null;
                }
                if (fetchedStories === null) {
                  fetchedStories = details.number_stories || comp.number_stories || null;
                }

                fetchedDeveloper = details.developer || details.developer_name || details.builder || details.builder_name || null;
                // Per API docs: management_company is the correct field name for the managing entity
                fetchedOwner = details.management_company || details.owner || details.owner_name || details.current_owner || details.property_management || null;
                if (details.property_type) fetchedPropertyType = details.property_type;

                // Per API docs: building_website is the correct field name for the property website URL
                fetchedWebsiteUrl = details.building_website || details.website || details.website_url || details.property_url || null;

                // Extract occupancy trend & exposure fields
                const trend1 = extractTrendFields(details);
                fetchedLeasedPctChange = trend1.leasedPctChange;
                fetchedExposure = trend1.exposure;
                fetchedExposureChange = trend1.exposureChange;
                fetchedUnitsVacant = trend1.unitsVacant;
                fetchedUnitsExposed = trend1.unitsExposed;

                // exposure = true vacancy rate (what Hello Data popup shows as "Vacancy")
                // Always override vacancyRate with exposure when available — it's the authoritative source.
                if (fetchedExposure !== null) {
                  fetchedVacancyRate = fetchedExposure;
                }

                // Extract unit mix from property details (primary source — has floorplan names)
                const detailsMix = extractUnitMixFromDetails(details);
                if (detailsMix.length > 0) {
                  fetchedUnitMix = detailsMix;
                  console.log(`      🏠 Unit mix (from details): ${detailsMix.map(m => `${m.unitType}=$${m.avgRent}`).join(', ')}`);
                } else {
                  const topKeys = Object.keys(details).slice(0, 20).join(', ');
                  console.log(`      🏠 Unit mix: not in details (keys: ${topKeys})`);
                }
                
                // Fetch pricing data
                try {
                  const pricingStartTime = Date.now();
                  const pricingResponse = await retryWithBackoff(async () => {
                    const response = await fetchWithTimeout(`${this.baseUrl}/property/pricing`, {
                      method: 'POST',
                      headers: {
                        'X-API-Key': this.apiKey,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ subject: details })
                    }, 30000);

                    if (!response.ok) {
                      throw new Error(`Pricing fetch failed: ${response.status}`);
                    }
                    return await response.json();
                  });
                  
                  const pricingResponseTime = Date.now() - pricingStartTime;
                  apiCallTracker.logCall('HelloData', 'property/pricing', true, pricingResponseTime);
                  
                  // Calculate weighted rent PSF from unit data
                  // Handle multiple response formats from HelloData pricing API:
                  // Format A: [{ unit: { sqft, price } }]
                  // Format B: [{ sqft, price }]
                  // Format C: [{ sqft, effective_rent }]
                  const extractUnit = (item: any) => {
                    const sqft = item.unit?.sqft || item.sqft || 0;
                    const price = item.unit?.price || item.price || item.effective_rent || item.rent || 0;
                    return { sqft, price };
                  };
                  const validUnits = (Array.isArray(pricingResponse) ? pricingResponse : [])
                    .map(extractUnit)
                    .filter(u => u.sqft > 0 && u.price > 0);

                  if (validUnits.length > 0) {
                    const totalPrice = validUnits.reduce((sum: number, u: any) => sum + u.price, 0);
                    const totalSqft = validUnits.reduce((sum: number, u: any) => sum + u.sqft, 0);
                    rentPsf = totalPrice / totalSqft;
                    avgRentPerUnit = totalPrice / validUnits.length;
                    console.log(`      💰 Rent PSF: $${rentPsf.toFixed(2)} (${validUnits.length} units)`);
                  } else {
                    console.log(`      ⚠️ No valid pricing data. Response sample: ${JSON.stringify(Array.isArray(pricingResponse) ? pricingResponse.slice(0, 2) : pricingResponse)}`);
                  }
                  // Unit mix is sourced from building_availability (extractUnitMixFromDetails / extractFromBuildingAvailability)
                  // which now uses active-unit asking prices for rent values, matching HelloData's UI.
                  // The pricing API response covers all units (including historical/contract rents) and
                  // produces averages that diverge from HelloData's displayed asking prices, so we
                  // intentionally do NOT override unit mix from the pricing endpoint here.
                } catch (pricingErr) {
                  console.log(`      ⚠️ Failed to fetch pricing: ${pricingErr}`);
                }
              }
            } catch (err) {
              console.log(`      ⚠️ Failed to fetch property details`);
            }
          }
          
          allRawForMap.push({
            address: comp.street_address || comp.address || '',
            city: comp.city || '',
            state: comp.state || '',
            zipCode: comp.zip_code || comp.zipCode || comp.zip || '',
            propertyType: fetchedPropertyType,
            buildingSize: parseInt(comp.building_size || comp.buildingSize || comp.sqft || 0),
            salePrice: 0,
            saleDate: '',
            yearBuilt: parseInt(comp.year_built || comp.vintage || comp.yearBuilt || 0),
            pricePerSqFt: rentPsf,
            distance: parseFloat(comp.distance_miles || comp.distance || 0),
            latitude: lat as any,
            longitude: lng as any,
            unitCount: fetchedUnitCount || parseInt(comp.number_units || comp.units || comp.unit_count || 0),
            propertyName: propertyName || comp.building_name || comp.property_name || comp.name,
            avgRent: avgRentPerUnit,
            vacancyRate: fetchedVacancyRate,
            developer: fetchedDeveloper,
            owner: fetchedOwner,
            stories: fetchedStories,
            leasedPct: fetchedLeasedPct,
            leasedPctChange: fetchedLeasedPctChange,
            exposure: fetchedExposure,
            exposureChange: fetchedExposureChange,
            unitsVacant: fetchedUnitsVacant,
            unitsExposed: fetchedUnitsExposed,
            unitMix: fetchedUnitMix,
            websiteUrl: fetchedWebsiteUrl
          });
        }
        
        const withCoords = allRawForMap.filter(c => c.latitude && c.longitude);
        console.log(`📍 [HELLODATA] ${withCoords.length}/${allRawForMap.length} comparables have coordinates for map`);
        
        // Calculate rent metrics from all properties with pricing
        const propsWithRent = allRawForMap.filter(c => c.pricePerSqFt > 0);
        const topRentPSF = propsWithRent.length > 0 ? Math.max(...propsWithRent.map(c => c.pricePerSqFt)) : 0;
        const avgRentPSF = propsWithRent.length > 0 
          ? propsWithRent.reduce((sum, c) => sum + c.pricePerSqFt, 0) / propsWithRent.length 
          : 0;
        const topRentPerUnit = propsWithRent.length > 0 
          ? Math.max(...propsWithRent.filter(c => c.avgRent).map(c => c.avgRent!)) 
          : 0;
        const avgRentPerUnit = propsWithRent.length > 0 
          ? propsWithRent.filter(c => c.avgRent).reduce((sum, c) => sum + (c.avgRent || 0), 0) / propsWithRent.filter(c => c.avgRent).length 
          : 0;
        
        console.log(`📊 [HELLODATA] Rent metrics from ${propsWithRent.length} properties with pricing:`);
        if (propsWithRent.length > 0) {
          console.log(`   Top Rent PSF: $${topRentPSF.toFixed(2)}`);
          console.log(`   Avg Rent PSF: $${avgRentPSF.toFixed(2)}`);
        }
        
        // Build detailed summary in consistent format for frontend parsing
        let detailedSummary = `Found ${multifamilyComps.length} total comparables within 3 miles\n`;
        detailedSummary += `0 met vintage/units criteria (>=${filterCriteria.minVintage}, >=${filterCriteria.minUnits} units)\n`;
        const rentCriteriaMsg = filterCriteria.minGrossRent 
          ? `rent >= $${filterCriteria.minGrossRent.toLocaleString()}/unit`
          : `rent >= $${filterCriteria.minRentPSF}/sqft`;
        detailedSummary += `0 qualify with ${rentCriteriaMsg}\n\n`;
        
        // Dec 22, 2025: Add rent metrics to summary for ALL candidates
        if (propsWithRent.length > 0) {
          detailedSummary += `ALL CANDIDATES RENT METRICS (${propsWithRent.length} with pricing):\n`;
          detailedSummary += `   Top Rent PSF: $${topRentPSF.toFixed(2)}\n`;
          detailedSummary += `   Avg Rent PSF: $${avgRentPSF.toFixed(2)}\n`;
          if (topRentPerUnit > 0) {
            detailedSummary += `   Top Rent/Unit: $${topRentPerUnit.toFixed(0)}/month\n`;
            detailedSummary += `   Avg Rent/Unit: $${avgRentPerUnit.toFixed(0)}/month\n`;
          }
          detailedSummary += `\n`;
        }
        
        detailedSummary += `Note: Filtered ${rawComparables.length - multifamilyComps.length} residential properties - showing only multifamily.\n`;
        if (allRawForMap.length > 0) {
          detailedSummary += `\nMULTIFAMILY PROPERTIES IN AREA (showing ${allRawForMap.length} of ${multifamilyComps.length}):\n\n`;
          allRawForMap.forEach((comp, idx) => {
            detailedSummary += `${idx + 1}. ${comp.propertyName || 'Property'}\n`;
            detailedSummary += `   Address: ${comp.address}, ${comp.city}, ${comp.state} ${comp.zipCode}\n`;
            detailedSummary += `   Vintage: ${comp.yearBuilt}, Units: ${comp.unitCount}`;
            if (comp.pricePerSqFt > 0) {
              detailedSummary += `, Rent: $${comp.pricePerSqFt.toFixed(2)}/sqft`;
            }
            detailedSummary += `\n`;
            detailedSummary += `   Distance: ${comp.distance?.toFixed(2) || 'N/A'} miles\n\n`;
          });
          if (multifamilyComps.length > 10) {
            detailedSummary += `   ...and ${multifamilyComps.length - 10} more multifamily properties in the area\n`;
          }
        }
        
        return {
          success: true,
          qualifyingCount: 0,
          comparables: allRawForMap,
          summary: detailedSummary,
          totalComparables: multifamilyComps.length,
          candidateCount: 0,
          candidatesWithPricing: propsWithRent.length,
          topRentPSF,
          avgRentPSF,
          topRentPerUnit: topRentPerUnit || 0,
          avgRentPerUnit: avgRentPerUnit || 0
        };
      }

      // Step 4: Fetch property details + pricing for candidates to get rent_psf
      console.log(`\n💰 [HELLODATA] Step 4: Fetching property pricing for ${candidates.length} candidates to get rent_psf`);
      const qualifyingComparables: HelloDataComparable[] = [];
      const allComparables: HelloDataComparable[] = []; // 🆕 Track ALL comparables (qualifying + non-qualifying)
      
      for (let i = 0; i < candidates.length; i++) {
        const comp = candidates[i];
        console.log(`\n   ${i + 1}/${candidates.length}. ${comp.street_address}, ${comp.city}, ${comp.state}`);
        console.log(`      ID: ${comp.id}`);
        console.log(`      Vintage: ${comp.year_built}, Units: ${comp.number_units}`);
        
        try {
          // Step 4a: Fetch full property details (required for pricing API)
          const propertyDetails = await this.getPropertyDetails(comp.id);
          
          if (!propertyDetails) {
            console.warn(`      ⚠️ [DATA GAP] Property details unavailable for ID ${comp.id} — including comparable with basic data so nothing is dropped`);
            // Never drop a comparable just because details failed — push with raw comp data
            allComparables.push({
              address: comp.street_address || '',
              city: comp.city || '',
              state: comp.state || '',
              zipCode: comp.zip_code || '',
              propertyType: comp.property_type || 'Multifamily',
              buildingSize: 0,
              salePrice: 0,
              saleDate: new Date().toISOString(),
              yearBuilt: parseInt(comp.year_built || comp.vintage || 0),
              pricePerSqFt: 0,
              distance: parseFloat(comp.distance_miles || comp.distance || 0),
              latitude: parseFloat(comp.lat || 0) || undefined,
              longitude: parseFloat(comp.lon || 0) || undefined,
              unitCount: parseInt(comp.number_units || comp.units || comp.unit_count || 0),
              propertyName: comp.building_name || comp.property_name || comp.name || null,
              avgRent: undefined,
              vacancyRate: null,
              developer: null,
              owner: null,
              stories: null,
              leasedPct: null,
              leasedPctChange: null,
              exposure: null,
              exposureChange: null,
              unitsVacant: null,
              unitsExposed: null,
              unitMix: null,
              websiteUrl: null,
            } as any);
            continue;
          }

          // Extract unit mix from property details NOW (before pricing) — required so unitMix2 is in scope for the pricing fallback below
          const detailsMix2 = extractUnitMixFromDetails(propertyDetails);
          let unitMix2: UnitMixEntry[] | null = detailsMix2.length > 0 ? detailsMix2 : null;
          if (detailsMix2.length > 0) {
            console.log(`      🏠 Unit mix (from details): ${detailsMix2.map(m => `${m.unitType}=$${m.avgRent}`).join(', ')}`);
          }

          // Step 4b: Fetch pricing data with 30s timeout to get rent_psf
          const pricingStartTime = Date.now();
          const pricingResponse = await retryWithBackoff(async () => {
            const response = await fetchWithTimeout(`${this.baseUrl}/property/pricing`, {
              method: 'POST',
              headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ subject: propertyDetails })
            }, 30000);

            if (!response.ok) {
              const pricingResponseTime = Date.now() - pricingStartTime;
              apiCallTracker.logCall('HelloData', 'property/pricing', false, pricingResponseTime, {
                errorMessage: `${response.status}`
              });
              throw new Error(`Pricing fetch failed: ${response.status}`);
            }

            return await response.json();
          });
          
          const pricingResponseTime = Date.now() - pricingStartTime;
          apiCallTracker.logCall('HelloData', 'property/pricing', true, pricingResponseTime);

          // Calculate WEIGHTED rent_psf from unit data (total price ÷ total sqft)
          // Handle multiple HelloData pricing response formats:
          // Format A: [{ unit: { sqft, price } }]
          // Format B: [{ sqft, price }]
          // Format C: [{ sqft, effective_rent }]
          const extractPricingUnit = (item: any) => ({
            sqft: item.unit?.sqft || item.sqft || 0,
            price: item.unit?.price || item.price || item.effective_rent || item.rent || 0,
          });
          const validUnits = (Array.isArray(pricingResponse) ? pricingResponse : [])
            .map(extractPricingUnit)
            .filter(u => u.sqft > 0 && u.price > 0);

          // Calculate rent — never skip if pricing is missing, include with null rent fields instead
          let weightedRentPsf = 0;
          let avgRentPerUnit: number | undefined = undefined;

          if (validUnits.length === 0) {
            console.warn(`      ⚠️ [DATA GAP] No valid pricing for ID ${comp.id} — including comparable with null rent fields so nothing is dropped. Response sample: ${JSON.stringify(Array.isArray(pricingResponse) ? pricingResponse.slice(0, 2) : pricingResponse)}`);
          } else {
            // Weighted calculation: sum of all prices ÷ sum of all sqft
            const totalPrice = validUnits.reduce((sum: number, unit: any) => sum + unit.price, 0);
            const totalSqft = validUnits.reduce((sum: number, unit: any) => sum + unit.sqft, 0);
            weightedRentPsf = totalPrice / totalSqft;
            avgRentPerUnit = totalPrice / validUnits.length;
            console.log(`      Rent PSF: $${weightedRentPsf.toFixed(2)} (weighted avg across ${validUnits.length} units)`);
            console.log(`      Avg Rent/Unit: $${avgRentPerUnit.toFixed(2)}/month`);
          }
          
          // Unit mix stays as set by extractUnitMixFromDetails (active-unit asking prices).
          // The pricing API covers all units including historical/contract rents which
          // diverge from HelloData's displayed asking prices — do NOT override unit mix here.
          // Log what we have for diagnostics:
          if (unitMix2 && unitMix2.length > 0) {
            console.log(`      🏠 Unit mix (asking rents from active units): ${unitMix2.map(m => `${m.unitType}=$${m.avgRent}`).join(', ')}`);
          }
          
          // Extract property name - prioritize building_name (HelloData's actual field name)
          // Dec 16, 2025: Fixed order - building_name should be first, not last
          const propertyName = propertyDetails.building_name || propertyDetails.property_name || propertyDetails.name || 
                              propertyDetails.community_name || propertyDetails.apartment_name ||
                              comp.building_name || comp.property_name || comp.name || comp.community_name || comp.apartment_name || undefined;
          
          // Debug: Log what we found
          console.log(`      🏷️ Property name extraction: building_name="${propertyDetails.building_name || comp.building_name || 'null'}", extracted="${propertyName || 'null'}"`);
          
          if (propertyName) {
            console.log(`      Property Name: ${propertyName}`);
          } else {
            console.log(`      Property Name: (not available in API response)`);
          }
          
          // 🆕 Create comparable object (used for BOTH qualifying and all lists)
          // CRITICAL: Extract coordinates from propertyDetails, not from comp (API response doesn't always include them)
          const latitude = parseFloat(propertyDetails.lat || propertyDetails.latitude || comp.lat || 0);
          const longitude = parseFloat(propertyDetails.lon || propertyDetails.lng || propertyDetails.longitude || comp.lon || 0);
          
          if (latitude === 0 || longitude === 0) {
            console.log(`      ⚠️ No valid coordinates found - skipping from map display`);
            console.log(`         propertyDetails: lat=${propertyDetails.lat}, lon=${propertyDetails.lon}`);
            console.log(`         comp: lat=${comp.lat}, lon=${comp.lon}`);
          }
          
          // PRIMARY: Extract vacancy, leased, stories, unit mix from building_availability (per API docs)
          const bldgAvail2 = extractFromBuildingAvailability(propertyDetails);
          if (bldgAvail2.unitMix.length > 0 && !unitMix2) {
            unitMix2 = bldgAvail2.unitMix;
            console.log(`      🏠 Unit mix (from building_availability): ${bldgAvail2.unitMix.map((m: any) => `${m.unitType}=$${m.avgRent}`).join(', ')}`);
          }

          // FALLBACK: field-level extraction if building_availability didn't have data
          let vacancyRate: number | null = bldgAvail2.vacancyRate;
          let leasedPct: number | null = bldgAvail2.leasedPct;
          let stories: any = bldgAvail2.stories;

          if (vacancyRate === null) {
            const rawVacancy = propertyDetails.vacancy_rate ?? propertyDetails.vacancy ?? propertyDetails.current_vacancy ??
                              propertyDetails.vacant_pct ?? propertyDetails.physical_vacancy ?? propertyDetails.economic_vacancy ??
                              propertyDetails.vacant_percentage ?? comp.vacancy_rate ?? comp.vacancy ?? null;
            vacancyRate = rawVacancy !== null && rawVacancy !== undefined ? parseFloat(rawVacancy) : null;
          }
          if (leasedPct === null) {
            const rawLP2 = propertyDetails.leased_percentage ?? propertyDetails.percent_leased ?? propertyDetails.leased ??
                           propertyDetails.adv_leased_pct ?? propertyDetails.adv_leased ?? propertyDetails.adv_leased_percentage ??
                           propertyDetails.leased_pct ?? propertyDetails.leasing_percentage ?? propertyDetails.adv_occupancy ??
                           propertyDetails.occupancy_rate ?? propertyDetails.occupancy ?? propertyDetails.percent_occupied ??
                           propertyDetails.physical_occupancy ?? propertyDetails.economic_occupancy ??
                           propertyDetails.leased_units_pct ?? propertyDetails.adv_leased_rate ?? null;
            leasedPct = (rawLP2 !== null && !isNaN(parseFloat(rawLP2))) ? parseFloat(rawLP2) : null;
          }
          if (stories === null) {
            stories = propertyDetails.number_stories || comp.number_stories || null;
          }

          const developer = propertyDetails.developer || propertyDetails.developer_name || propertyDetails.builder || propertyDetails.builder_name || comp.developer || comp.developer_name || null;
          // Per API docs: management_company is the correct field name for the managing entity
          const owner = propertyDetails.management_company || propertyDetails.owner || propertyDetails.owner_name || propertyDetails.current_owner || propertyDetails.property_management || comp.management_company || comp.owner || null;
          const buildingSize = parseInt(propertyDetails.sqft || propertyDetails.building_size || propertyDetails.total_sqft ||
                               propertyDetails.gross_sqft || propertyDetails.building_sqft || propertyDetails.gross_square_feet ||
                               propertyDetails.total_square_feet || comp.sqft || 0);

          // Per API docs: building_website is the correct field name for the property website URL
          const websiteUrl2: string | null = propertyDetails.building_website || propertyDetails.website || propertyDetails.website_url || propertyDetails.property_url || null;

          // Extract occupancy trend & exposure fields
          const trend2 = extractTrendFields(propertyDetails);

          const comparableData = {
            address: comp.street_address || '',
            city: comp.city || '',
            state: comp.state || '',
            zipCode: comp.zip_code || '',
            propertyType: propertyDetails.property_type || comp.property_type || 'multifamily',
            buildingSize,
            salePrice: 0,
            saleDate: new Date().toISOString(),
            yearBuilt: parseInt(comp.year_built || 0),
            pricePerSqFt: weightedRentPsf,
            distance: parseFloat(comp.distance_miles || 0),
            latitude,
            longitude,
            unitCount: parseInt(propertyDetails.number_units || propertyDetails.units || propertyDetails.unit_count || comp.number_units || 0),
            propertyName: propertyName,
            avgRent: avgRentPerUnit,
            vacancyRate: isNaN(vacancyRate as number) ? null : vacancyRate,
            developer: developer || null,
            owner: owner || null,
            stories: stories ? parseInt(stories) : null,
            leasedPct: leasedPct,
            leasedPctChange: trend2.leasedPctChange,
            exposure: trend2.exposure,
            exposureChange: trend2.exposureChange,
            unitsVacant: trend2.unitsVacant,
            unitsExposed: trend2.unitsExposed,
            unitMix: unitMix2,
            websiteUrl: websiteUrl2
          };
          
          // 🆕 ALWAYS add to allComparables (regardless of rent qualification)
          allComparables.push(comparableData);
          
          // Check if qualifies based on product-type-specific criteria
          // BTR/Lot/Townhome/SF: Check gross rent >= $2,000/unit
          // Conventional/Active Adult: Check rent PSF >= $1.75/sqft
          // Jan 12, 2026: Properties with NO rent data still qualify (yellow) for manual review
          let qualifies = false;
          let qualificationMessage = '';
          
          if (filterCriteria.minGrossRent) {
            // Use gross rent per unit for BTR/Lot/Townhome/SF
            if (avgRentPerUnit && avgRentPerUnit > 0) {
              // Has rent data - check against threshold
              qualifies = avgRentPerUnit >= filterCriteria.minGrossRent;
              qualificationMessage = qualifies 
                ? `✅ QUALIFIES (rent $${avgRentPerUnit.toFixed(0)}/unit >= $${filterCriteria.minGrossRent}/unit)`
                : `❌ Does not qualify (rent $${avgRentPerUnit.toFixed(0)}/unit < $${filterCriteria.minGrossRent}/unit)`;
            } else {
              // NO rent data available - still qualifies for manual review
              qualifies = true;
              qualificationMessage = `✅ QUALIFIES [NO RENT DATA - needs manual review] (vintage/units met criteria)`;
            }
          } else if (filterCriteria.minRentPSF) {
            // Use rent per sqft for Conventional/Active Adult
            if (weightedRentPsf && weightedRentPsf > 0) {
              qualifies = weightedRentPsf >= filterCriteria.minRentPSF;
              qualificationMessage = qualifies 
                ? `✅ QUALIFIES (rent >= $${filterCriteria.minRentPSF}/sqft)`
                : `❌ Does not qualify (rent $${weightedRentPsf.toFixed(2)} < $${filterCriteria.minRentPSF}/sqft)`;
            } else {
              // NO rent data available - still qualifies for manual review
              qualifies = true;
              qualificationMessage = `✅ QUALIFIES [NO RENT DATA - needs manual review] (vintage/units met criteria)`;
            }
          }
          
          console.log(`      ${qualificationMessage}`);
          if (qualifies) {
            qualifyingComparables.push(comparableData);
          }
        } catch (error) {
          console.warn(`      ⚠️ [DATA GAP] Unexpected error processing comparable ID ${comp.id}: ${error} — including with basic data so nothing is dropped`);
          // Never silently drop a comparable due to an unexpected error — push basic data
          allComparables.push({
            address: comp.street_address || '',
            city: comp.city || '',
            state: comp.state || '',
            zipCode: comp.zip_code || '',
            propertyType: comp.property_type || 'Multifamily',
            buildingSize: 0,
            salePrice: 0,
            saleDate: new Date().toISOString(),
            yearBuilt: parseInt(comp.year_built || comp.vintage || 0),
            pricePerSqFt: 0,
            distance: parseFloat(comp.distance_miles || comp.distance || 0),
            latitude: parseFloat(comp.lat || 0) || undefined,
            longitude: parseFloat(comp.lon || 0) || undefined,
            unitCount: parseInt(comp.number_units || comp.units || comp.unit_count || 0),
            propertyName: comp.building_name || comp.property_name || comp.name || null,
            avgRent: undefined,
            vacancyRate: null,
            developer: null,
            owner: null,
            stories: null,
            leasedPct: null,
            leasedPctChange: null,
            exposure: null,
            exposureChange: null,
            unitsVacant: null,
            unitsExposed: null,
            unitMix: null,
            websiteUrl: null,
          } as any);
        }
      }

      const qualifyingCount = qualifyingComparables.length;

      // Calculate rent metrics from ALL candidates (not just qualifying)
      const allCandidatesTopRentPSF = allComparables.length > 0
        ? Math.max(...allComparables.map(comp => comp.pricePerSqFt))
        : 0;
      
      const allCandidatesAvgRentPSF = allComparables.length > 0
        ? allComparables.reduce((sum, comp) => sum + comp.pricePerSqFt, 0) / allComparables.length
        : 0;
      
      const allCandidatesTopRentPerUnit = allComparables.length > 0
        ? Math.max(...allComparables.map(comp => comp.avgRent || 0))
        : 0;
      
      const allCandidatesAvgRentPerUnit = allComparables.length > 0
        ? allComparables.reduce((sum, comp) => sum + (comp.avgRent || 0), 0) / allComparables.length
        : 0;

      // Calculate metrics for qualifying comparables only
      const topRentPSF = qualifyingCount > 0
        ? Math.max(...qualifyingComparables.map(comp => comp.pricePerSqFt))
        : 0;
      
      const avgRentPSF = qualifyingCount > 0
        ? qualifyingComparables.reduce((sum, comp) => sum + comp.pricePerSqFt, 0) / qualifyingCount
        : 0;
      
      const topRentPerUnit = qualifyingCount > 0
        ? Math.max(...qualifyingComparables.map(comp => comp.avgRent || 0))
        : 0;
      
      const avgRentPerUnit = qualifyingCount > 0
        ? qualifyingComparables.reduce((sum, comp) => sum + (comp.avgRent || 0), 0) / qualifyingCount
        : 0;

      // Build summary
      let summary = '';
      
      // Add area fallback notice if applicable
      if (isAreaFallback) {
        summary += `[AREA COMPARABLES]\n`;
        summary += `Note: Exact address could not be geocoded.\n`;
        summary += `Using ${fallbackLocation} area centroid for nearby comparables.\n`;
        summary += `These are properties in the general area, not address-specific.\n\n`;
      }
      
      summary += `Found ${rawComparables.length} total comparables within 3 miles\n`;
      summary += `${candidates.length} met vintage/units criteria (>=${filterCriteria.minVintage}, >=${filterCriteria.minUnits} units)\n`;
      const rentCriteriaDisplay = filterCriteria.minGrossRent 
        ? `rent >= $${filterCriteria.minGrossRent.toLocaleString()}/unit`
        : `rent >= $${filterCriteria.minRentPSF}/sqft`;
      summary += `${qualifyingCount} qualify with ${rentCriteriaDisplay}\n\n`;
      
      // Always show ALL CANDIDATES metrics (even if they don't qualify)
      if (allComparables.length > 0) {
        summary += `ALL CANDIDATES RENT METRICS:\n`;
        summary += `   Top Rent PSF: $${allCandidatesTopRentPSF.toFixed(2)}\n`;
        summary += `   Avg Rent PSF: $${allCandidatesAvgRentPSF.toFixed(2)}\n`;
        summary += `   Top Rent/Unit: $${allCandidatesTopRentPerUnit.toFixed(0)}/month\n`;
        summary += `   Avg Rent/Unit: $${allCandidatesAvgRentPerUnit.toFixed(0)}/month\n\n`;
      }
      
      // Show qualifying comparables first
      if (qualifyingCount > 0) {
        summary += `QUALIFYING COMPARABLES METRICS:\n`;
        summary += `   Top Rent PSF: $${topRentPSF.toFixed(2)}\n`;
        summary += `   Avg Rent PSF: $${avgRentPSF.toFixed(2)}\n`;
        summary += `   Top Rent/Unit: $${topRentPerUnit.toFixed(0)}/month\n`;
        summary += `   Avg Rent/Unit: $${avgRentPerUnit.toFixed(0)}/month\n\n`;
        
        qualifyingComparables.forEach((comp, idx) => {
          const isTopRent = comp.pricePerSqFt === topRentPSF;
          summary += `${idx + 1}. QUALIFIES${isTopRent ? ' [TOP RENT]' : ''}\n`;
          if (comp.propertyName) {
            summary += `   Property: ${comp.propertyName}\n`;
          }
          summary += `   Address: ${comp.address}, ${comp.city}, ${comp.state} ${comp.zipCode}\n`;
          summary += `   Rent/sqft: $${comp.pricePerSqFt.toFixed(2)}\n`;
          summary += `   Vintage: ${comp.yearBuilt}\n`;
          summary += `   Units: ${comp.unitCount}\n`;
          summary += `   Distance: ${comp.distance.toFixed(2)} miles\n\n`;
        });
      }
      
      // Show non-qualifying candidates (those meeting vintage/units but not rent)
      // Jan 12, 2026: Use product-type-specific rent criteria
      const nonQualifyingComparables = allComparables.filter(comp => {
        if (filterCriteria.minGrossRent) {
          return (comp.avgRent || 0) < filterCriteria.minGrossRent;
        }
        return comp.pricePerSqFt < (filterCriteria.minRentPSF || 1.75);
      });
      if (nonQualifyingComparables.length > 0) {
        summary += `NON-QUALIFYING CANDIDATES (${nonQualifyingComparables.length}):\n\n`;
        nonQualifyingComparables.forEach((comp, idx) => {
          summary += `${idx + 1}. DOES NOT QUALIFY\n`;
          if (comp.propertyName) {
            summary += `   Property: ${comp.propertyName}\n`;
          }
          summary += `   Address: ${comp.address}, ${comp.city}, ${comp.state} ${comp.zipCode}\n`;
          if (filterCriteria.minGrossRent) {
            summary += `   Rent/unit: $${(comp.avgRent || 0).toFixed(0)} (< $${filterCriteria.minGrossRent.toLocaleString()} minimum)\n`;
          } else {
            summary += `   Rent/sqft: $${comp.pricePerSqFt.toFixed(2)} (< $${filterCriteria.minRentPSF} minimum)\n`;
          }
          summary += `   Vintage: ${comp.yearBuilt}\n`;
          summary += `   Units: ${comp.unitCount}\n`;
          summary += `   Distance: ${comp.distance.toFixed(2)} miles\n\n`;
        });
      }
      
      // Dec 19, 2025: Show ALL apartments (even those not meeting vintage/units criteria)
      // User wants to see all apartments in the area, not just candidates
      // Jan 12, 2026: Use product-type-specific criteria
      const otherApartments = rawComparables.filter(comp => {
        const yearBuilt = parseInt(comp.year_built || comp.vintage || comp.yearBuilt || comp.year || 0);
        const units = parseInt(comp.number_units || comp.units || comp.unitCount || comp.unit_count || comp.num_units || 0);
        return !(yearBuilt >= filterCriteria.minVintage && units >= filterCriteria.minUnits); // Exclude candidates (already shown above)
      });
      
      if (otherApartments.length > 0) {
        summary += `\nOTHER APARTMENTS IN AREA (${otherApartments.length}):\n`;
        summary += `(Below ${filterCriteria.minVintage} vintage or under ${filterCriteria.minUnits} units)\n\n`;
        const maxToShow = Math.min(otherApartments.length, 10);
        otherApartments.slice(0, maxToShow).forEach((comp, idx) => {
          const name = comp.building_name || comp.property_name || comp.name || 'Unknown';
          const addr = comp.street_address || comp.address || '';
          const yearBuilt = parseInt(comp.year_built || comp.vintage || comp.yearBuilt || 0);
          const units = parseInt(comp.number_units || comp.units || comp.unitCount || 0);
          const distance = parseFloat(comp.distance_miles || comp.distance || 0);
          summary += `${idx + 1}. ${name}\n`;
          summary += `   Address: ${addr}\n`;
          summary += `   Vintage: ${yearBuilt}, Units: ${units}\n`;
          summary += `   Distance: ${distance.toFixed(2)} miles\n\n`;
        });
        if (otherApartments.length > 10) {
          summary += `   ...and ${otherApartments.length - 10} more apartments in the area\n`;
        }
      }
      
      // Generate CONCISE explanatory notes for AI Analysis column (not the full list)
      let aiExplanatoryNotes = '';
      if (qualifyingCount === 0) {
        summary += `\nClassification: CLEAR NO (RED) - No qualifying comparables found`;
        aiExplanatoryNotes = `RED: No qualifying comparables found within 3 miles. ${rawComparables.length} total properties checked, ${candidates.length} met vintage/units criteria but none met rent requirements.`;
      } else {
        summary += `\nClassification: REVIEWING (YELLOW) - Found ${qualifyingCount} qualifying comparable${qualifyingCount > 1 ? 's' : ''}`;
        const rentDisplay = filterCriteria.minGrossRent 
          ? `$${avgRentPerUnit.toFixed(0)}/unit avg`
          : `$${avgRentPSF.toFixed(2)}/sqft avg`;
        aiExplanatoryNotes = `YELLOW: ${qualifyingCount} qualifying comparable${qualifyingCount > 1 ? 's' : ''} found (${rentDisplay}). Meets vintage ≥${filterCriteria.minVintage} and units ≥${filterCriteria.minUnits} criteria. Needs senior analyst review.`;
      }

      console.log(`\n✅ [HELLODATA] Search Complete: ${qualifyingCount} qualifying comparables found`);
      console.log(`💰 [HELLODATA] Rent Metrics (All Candidates):`);
      console.log(`   Top Rent PSF: $${allCandidatesTopRentPSF.toFixed(2)}`);
      console.log(`   Avg Rent PSF: $${allCandidatesAvgRentPSF.toFixed(2)}`);
      console.log(`   Top Rent/Unit: $${allCandidatesTopRentPerUnit.toFixed(0)}/month`);
      console.log(`   Avg Rent/Unit: $${allCandidatesAvgRentPerUnit.toFixed(0)}/month`);
      if (qualifyingCount > 0) {
        console.log(`💰 [HELLODATA] Rent Metrics (Qualifying Only):`);
        console.log(`   Top Rent PSF: $${topRentPSF.toFixed(2)}`);
        console.log(`   Avg Rent PSF: $${avgRentPSF.toFixed(2)}`);
        console.log(`   Top Rent/Unit: $${topRentPerUnit.toFixed(0)}/month`);
        console.log(`   Avg Rent/Unit: $${avgRentPerUnit.toFixed(0)}/month`);
      }
      console.log(`${'='.repeat(80)}\n`);

      // 🆕 ALWAYS return metrics from ALL candidates (not just qualifying)
      // This ensures Top Rent PSF and Top Rent/Unit columns are populated even when 0 qualify
      return {
        success: true,
        qualifyingCount,
        comparables: allComparables, // Return ALL comparables (not just qualifying) so UI always shows property details
        summary,
        aiExplanatoryNotes, // CONCISE explanation for AI Analysis column (Jan 28, 2026)
        topRentPSF: allCandidatesTopRentPSF,        // Use ALL candidates top rent
        avgRentPSF: allCandidatesAvgRentPSF,        // Use ALL candidates average rent
        topRentPerUnit: allCandidatesTopRentPerUnit, // Use ALL candidates top rent/unit
        avgRentPerUnit: allCandidatesAvgRentPerUnit, // Use ALL candidates avg rent/unit
        // ENHANCEMENT (Dec 9, 2025): Return raw counts for educational rejection reasons
        totalComparables: rawComparables.length,     // All properties within 3 miles
        candidateCount: candidates.length,           // Properties meeting vintage/units criteria
        candidatesWithPricing: allComparables.length // Candidates that had valid pricing data
      };

    } catch (error) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`❌ [HELLODATA] Search Failed!`);
      console.error(`${'='.repeat(80)}`);
      console.error(`Error Type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`Error Message: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`Stack Trace:\n${error.stack}`);
      }
      console.error(`${'='.repeat(80)}\n`);
      
      return {
        success: false,
        qualifyingCount: 0,
        comparables: [],
        summary: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse raw API comparables into our format
   */
  private parseComparables(rawComparables: any[]): HelloDataComparable[] {
    return rawComparables.map((comp: any) => {
      // Log raw comparable data for debugging
      console.log(`📊 [HELLODATA] Raw comparable data:`, JSON.stringify(comp, null, 2));
      
      // Extract average rent - check multiple field variations including nested paths
      const avgRent = comp.avg_rent || comp.market_rent || comp.effective_rent || 
                      comp.avgRent || comp.rent || 
                      comp.average_rent || comp.monthly_rent ||
                      comp.price_recommendation?.effective_rent ||
                      comp.price_recommendation?.avg_rent || 0;
      
      // HelloData API shows multiple possible rent PSF fields
      let pricePerSqFt = comp.rent_psf || comp.price_per_sqft || comp.pricePerSqFt || 
                         comp.rentPerSqFt || comp.psf || 
                         comp.effective_rent_psf || comp.rent_per_sqft ||
                         comp.price_recommendation?.effective_rent_psf ||
                         comp.price_recommendation?.rent_psf || 0;
      
      // HelloData API spec uses 'number_units'
      const units = comp.number_units || comp.units || comp.unitCount || 
                    comp.unit_count || comp.num_units || 0;
      
      // HelloData API spec uses 'sqft' for square footage
      const buildingSize = comp.sqft || comp.building_size || comp.buildingSize || 
                           comp.square_feet || comp.total_sqft || comp.size ||
                           (units * 850); // Estimate if not provided
      
      // Calculate price per sqft if not provided directly
      if (!pricePerSqFt && avgRent > 0 && buildingSize > 0) {
        pricePerSqFt = (avgRent * units) / buildingSize;
      }
      
      // Log all checked fields for debugging
      console.log(`🔍 [HELLODATA] Field check:`, {
        rent_psf: comp.rent_psf,
        effective_rent_psf: comp.effective_rent_psf,
        price_per_sqft: comp.price_per_sqft,
        avg_rent: comp.avg_rent,
        market_rent: comp.market_rent,
        effective_rent: comp.effective_rent,
        number_units: comp.number_units,
        sqft: comp.sqft,
        nested_rent_psf: comp.price_recommendation?.rent_psf,
        nested_effective_rent_psf: comp.price_recommendation?.effective_rent_psf
      });
      
      console.log(`💰 [HELLODATA] Parsed values - avgRent: $${avgRent}, units: ${units}, buildingSize: ${buildingSize} sqft, pricePerSqFt: $${pricePerSqFt.toFixed(2)}`);

      // Extract property name - prioritize building_name (HelloData's actual field name)
      // Dec 16, 2025: Fixed order - building_name should be first, not last
      const propertyName = comp.building_name || comp.property_name || comp.name || 
                          comp.community_name || comp.propertyName || comp.communityName || '';
      
      const rawVac = comp.vacancy_rate ?? comp.vacancy ?? comp.current_vacancy ?? null;
      const parsedVacancy = rawVac !== null ? parseFloat(rawVac) : null;

      return {
        propertyName, // Dec 16, 2025: Added property name to comparables display
        address: comp.address || comp.street_address || '',
        city: comp.city || '',
        state: comp.state || '',
        zipCode: comp.zipCode || comp.zip_code || comp.zip || '',
        propertyType: comp.property_type || comp.propertyType || 'multifamily',
        buildingSize,
        salePrice: avgRent * 12 * units || 0, // Annual rent as proxy
        saleDate: new Date().toISOString(),
        yearBuilt: parseInt(comp.year_built || comp.vintage || comp.yearBuilt || 0),
        pricePerSqFt,
        distance: parseFloat(comp.distance_miles || comp.distance || 0),
        latitude: parseFloat(comp.latitude || comp.lat || 0),
        longitude: parseFloat(comp.longitude || comp.lng || comp.lon || 0),
        unitCount: units,
        vacancyRate: isNaN(parsedVacancy as number) ? null : parsedVacancy,
        developer: comp.developer || comp.developer_name || comp.builder || null,
        owner: comp.owner || comp.owner_name || comp.current_owner || comp.management_company || null
      };
    });
  }

  /**
   * Get lot size (acreage) for a property by address
   * Used to auto-populate missing acreage data when brokers don't provide it
   * CRITICAL FIX (Dec 4, 2025): Added city/state parameters to prevent geocoding misinterpretation
   * Without city/state, addresses like "10333 Robinson church rd" get geocoded to "Robinson, TX" 
   * instead of the intended "Charlotte, NC"
   */
  async getLotSize(address: string, city?: string, state?: string): Promise<{
    success: boolean;
    acres?: number;
    source: string;
    error?: string;
  }> {
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📏 [HELLODATA-LOTSIZE] Getting lot size for address`);
      console.log(`${'='.repeat(80)}`);
      console.log(`📍 Address: "${address}"${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}`);

      if (!this.apiKey) {
        console.error(`❌ [HELLODATA-LOTSIZE] API key not configured!`);
        return {
          success: false,
          source: 'hellodata',
          error: 'HelloData API key not configured'
        };
      }

      // Step 1: Search for the property - pass city/state to prevent geocoding errors
      console.log(`🔍 [HELLODATA-LOTSIZE] Step 1: Searching for property in database`);
      const searchResult = await this.searchProperty(address, city, state);
      const property = searchResult.property;

      if (!property) {
        console.log(`⚠️ [HELLODATA-LOTSIZE] Property not found in database`);
        return {
          success: false,
          source: 'hellodata',
          error: 'Property not found in HelloData database'
        };
      }

      console.log(`✅ [HELLODATA-LOTSIZE] Found property ID: ${property.id}`);

      // Step 2: Get full property details
      console.log(`📋 [HELLODATA-LOTSIZE] Step 2: Fetching full property details`);
      const details = await this.getPropertyDetails(property.id);

      if (!details) {
        console.log(`⚠️ [HELLODATA-LOTSIZE] Could not fetch property details`);
        return {
          success: false,
          source: 'hellodata',
          error: 'Could not retrieve property details'
        };
      }

      // Step 3: Extract lot size - check multiple possible field names
      let acres: number | undefined;
      
      // Check common field names for lot size in acres
      if (details.lot_size_acres !== undefined && details.lot_size_acres !== null) {
        acres = parseFloat(details.lot_size_acres);
      } else if (details.lot_size !== undefined && details.lot_size !== null) {
        acres = parseFloat(details.lot_size);
      } else if (details.lotSize !== undefined && details.lotSize !== null) {
        acres = parseFloat(details.lotSize);
      } else if (details.acreage !== undefined && details.acreage !== null) {
        acres = parseFloat(details.acreage);
      } else if (details.land_area_acres !== undefined && details.land_area_acres !== null) {
        acres = parseFloat(details.land_area_acres);
      }

      // Log all lot-size related fields for debugging
      console.log(`📏 [HELLODATA-LOTSIZE] Lot size field check:`, {
        lot_size_acres: details.lot_size_acres,
        lot_size: details.lot_size,
        lotSize: details.lotSize,
        acreage: details.acreage,
        land_area_acres: details.land_area_acres,
        extracted_acres: acres
      });

      if (!acres || isNaN(acres) || acres <= 0) {
        console.log(`⚠️ [HELLODATA-LOTSIZE] No valid lot size found in property data`);
        return {
          success: false,
          source: 'hellodata',
          error: 'Lot size data not available for this property'
        };
      }

      console.log(`✅ [HELLODATA-LOTSIZE] Successfully extracted lot size: ${acres} acres`);
      console.log(`${'='.repeat(80)}\n`);

      return {
        success: true,
        acres,
        source: 'hellodata'
      };

    } catch (error) {
      console.error(`❌ [HELLODATA-LOTSIZE] Error getting lot size:`, error);
      return {
        success: false,
        source: 'hellodata',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get comprehensive property data for dataAccuracyService
   * Returns lot size, market value, assessed value, and other property details
   * CRITICAL FIX (Dec 4, 2025): Added city/state parameters to prevent geocoding misinterpretation
   */
  async getPropertyData(address: string, city?: string, state?: string): Promise<{
    success: boolean;
    data?: {
      lotSize?: number; // Square feet
      marketValue?: number;
      assessedValue?: number;
      yearBuilt?: number;
      units?: number;
      propertyType?: string;
      lastUpdated?: string;
    };
    error?: string;
  }> {
    try {
      console.log(`📋 [HELLODATA-PROPERTY] Getting property data for: ${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}`);

      if (!this.apiKey) {
        const errorMsg = 'HelloData API key not configured - enrichment disabled';
        console.error(`❌ [HELLODATA-PROPERTY] ${errorMsg}`);
        return {
          success: false,
          error: errorMsg
        };
      }

      // Step 1: Search for the property (may throw on auth errors)
      // Pass city/state to prevent geocoding misinterpretation
      let searchResult: { property: HelloDataProperty | null; suggestedAddress?: string };
      try {
        searchResult = await this.searchProperty(address, city, state);
      } catch (searchError) {
        // Propagate configuration/authentication errors clearly
        const errorMsg = searchError instanceof Error ? searchError.message : 'Unknown error';
        console.error(`❌ [HELLODATA-PROPERTY] Search failed with error: ${errorMsg}`);
        
        // Check if this is an auth error
        if (errorMsg.includes('401') || errorMsg.includes('key not configured') || errorMsg.includes('Unauthorized')) {
          return {
            success: false,
            error: `HelloData authentication failed: ${errorMsg}`
          };
        }
        
        // Other errors - treat as transient
        return {
          success: false,
          error: `HelloData search failed: ${errorMsg}`
        };
      }
      
      const property = searchResult.property;
      if (!property) {
        console.log(`ℹ️ [HELLODATA-PROPERTY] Property not found in database (expected for some properties)`);
        return {
          success: false,
          error: 'Property not found in HelloData database'
        };
      }

      // Step 2: Get full property details
      const details = await this.getPropertyDetails(property.id);
      if (!details) {
        return {
          success: false,
          error: 'Could not retrieve property details'
        };
      }

      // Step 3: Extract and normalize property data
      const data: any = {};

      // Lot size (convert acres to square feet if needed)
      if (details.lot_size_acres) {
        data.lotSize = parseFloat(details.lot_size_acres) * 43560; // Convert acres to sqft
      } else if (details.lot_size) {
        data.lotSize = parseFloat(details.lot_size);
      } else if (details.lotSize) {
        data.lotSize = parseFloat(details.lotSize);
      }

      // Market value and assessed value
      if (details.market_value) data.marketValue = parseFloat(details.market_value);
      if (details.assessed_value) data.assessedValue = parseFloat(details.assessed_value);
      if (details.marketValue) data.marketValue = parseFloat(details.marketValue);
      if (details.assessedValue) data.assessedValue = parseFloat(details.assessedValue);

      // Additional property details
      if (details.year_built) data.yearBuilt = parseInt(details.year_built);
      if (details.yearBuilt) data.yearBuilt = parseInt(details.yearBuilt);
      if (details.units) data.units = parseInt(details.units);
      if (details.property_type) data.propertyType = details.property_type;
      if (details.propertyType) data.propertyType = details.propertyType;

      // Last updated timestamp
      data.lastUpdated = details.last_updated || details.lastUpdated || new Date().toISOString();

      console.log(`✅ [HELLODATA-PROPERTY] Retrieved property data successfully`);

      return {
        success: true,
        data
      };

    } catch (error) {
      console.error(`❌ [HELLODATA-PROPERTY] Error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search comparables for ACQUISITION deals.
   * Finds all multifamily properties within `radiusMiles` (default 4 miles),
   * filtered to ±5 years of `subjectVintage` (if provided).
   * Fetches rent data for each property and returns formatted notes.
   */
  async searchAcquisitionComparables(
    lat: number,
    lng: number,
    subjectVintage: number | null,
    radiusMiles: number = 4
  ): Promise<{
    success: boolean;
    count: number;
    comparables: any[];
    notes: string;
    comparablesJson?: string;
    error?: string;
  }> {
    try {
      console.log(`\n🏢 [ACQUISITION-COMPS] Searching ${radiusMiles}-mile radius from ${lat}, ${lng}`);
      if (subjectVintage) {
        console.log(`   Vintage filter: ${subjectVintage - 5} – ${subjectVintage + 5}`);
      } else {
        console.log(`   No vintage filter (subject vintage unknown)`);
      }

      const rawComparables = await this.findComparablesWithCoordinates(lat, lng, undefined, 50, radiusMiles);

      if (rawComparables.length === 0) {
        return { success: true, count: 0, comparables: [], notes: `No comparable properties found within ${radiusMiles} miles.` };
      }

      // Filter to multifamily only (exclude SFR)
      const multifamily = rawComparables.filter((comp: any) => {
        const units = parseInt(comp.number_units || comp.units || comp.unitCount || 0);
        const isSingleFamily = comp.is_single_family === true;
        const propertyType = (comp.property_type || comp.propertyType || '').toLowerCase();
        const isSFR = propertyType.includes('single') || propertyType.includes('sfr') ||
          (propertyType.includes('residential') && !propertyType.includes('multi'));
        const isTownhome = propertyType.includes('townhome') || propertyType.includes('townhouse');
        const isMultifamily = units >= 5 || comp.is_apartment === true ||
          propertyType.includes('apartment') || propertyType.includes('multifamily');
        return (isMultifamily || isTownhome) && !isSingleFamily && !isSFR;
      });

      console.log(`   ${multifamily.length}/${rawComparables.length} are multifamily/townhome`);

      // Filter to ±5 years of subjectVintage (if known)
      const vintageFiltered = subjectVintage
        ? multifamily.filter((comp: any) => {
            const yb = parseInt(comp.year_built || comp.vintage || comp.yearBuilt || 0);
            return yb > 0 && yb >= subjectVintage - 5 && yb <= subjectVintage + 5;
          })
        : multifamily;

      console.log(`   ${vintageFiltered.length} after vintage filter (±5 years)`);

      if (vintageFiltered.length === 0) {
        const vintageMsg = subjectVintage
          ? ` with vintage between ${subjectVintage - 5}–${subjectVintage + 5}`
          : '';
        return {
          success: true,
          count: 0,
          comparables: [],
          notes: `Found ${multifamily.length} multifamily properties within ${radiusMiles} miles, but none${vintageMsg}. Broader market context: ${multifamily.length} total apartment properties in area.`
        };
      }

      // Fetch pricing for up to 10 comparables (limit API calls)
      const maxToFetch = Math.min(vintageFiltered.length, 10);
      const results: any[] = [];

      for (let i = 0; i < maxToFetch; i++) {
        const comp = vintageFiltered[i];
        const yearBuilt = parseInt(comp.year_built || comp.vintage || comp.yearBuilt || 0);
        const units = parseInt(comp.number_units || comp.units || comp.unitCount || 0);
        const distance = parseFloat(comp.distance_miles || comp.distance || 0);

        let propertyName = comp.building_name || comp.property_name || comp.name || null;
        let rentPSF = 0;
        let avgRentPerUnit = 0;
        let lat2: number | undefined;
        let lng2: number | undefined;
        let vacancyRate3: number | null = null;
        let developer3: string | null = null;
        let owner3: string | null = null;
        let stories3: number | null = null;
        let buildingSize3 = 0;
        let leasedPct3: number | null = null;
        let leasedPctChange3: number | null = null;
        let exposure3: number | null = null;
        let exposureChange3: number | null = null;
        let unitsVacant3: number | null = null;
        let unitsExposed3: number | null = null;
        let unitMix3: UnitMixEntry[] | null = null;
        let websiteUrl3: string | null = null;
        let propertyType3 = comp.property_type || comp.propertyType || 'Multifamily';
        let zipCode3 = comp.zip_code || comp.zipCode || comp.zip || '';

        // Seed rich fields from the SEARCH RESULT itself before the detail call.
        // If the detail call fails silently, at least the search-level data persists.
        const searchStories = parseInt(comp.number_stories || comp.stories || comp.num_floors || comp.floors || 0);
        if (searchStories > 0) stories3 = searchStories;
        const searchLeased = comp.adv_leased_pct ?? comp.leased_pct ?? comp.leased_percentage ??
                             comp.occupancy_rate ?? comp.occupancy ?? null;
        if (searchLeased !== null && !isNaN(parseFloat(searchLeased))) {
          const rawLeased = parseFloat(searchLeased);
          // HelloData returns leased as a decimal (0-1) or percentage (0-100)
          leasedPct3 = rawLeased <= 1.0 ? parseFloat((rawLeased * 100).toFixed(1)) : parseFloat(rawLeased.toFixed(1));
          vacancyRate3 = parseFloat((100 - leasedPct3).toFixed(1));
        }
        buildingSize3 = parseInt(comp.sqft || comp.building_size || comp.total_sqft || comp.gross_sqft || 0);

        if (comp.id) {
          try {
            const details = await this.getPropertyDetails(comp.id);
            if (details) {
              propertyName = propertyName || details.building_name || details.property_name || details.name || details.community_name;
              lat2 = parseFloat(details.lat || details.latitude || 0) || undefined;
              lng2 = parseFloat(details.lon || details.longitude || 0) || undefined;

              // Extract enriched fields from property details
              if (details.property_type) propertyType3 = details.property_type;
              buildingSize3 = parseInt(details.sqft || details.building_size || details.total_sqft ||
                             details.gross_sqft || details.building_sqft || details.gross_square_feet ||
                             details.total_square_feet || comp.sqft || 0);
              stories3 = details.stories || details.num_floors || details.floors ||
                        details.number_of_stories || details.num_stories || details.story_count ||
                        details.building_stories || details.num_levels || details.floor_count ||
                        details.total_floors || null;
              developer3 = details.developer || details.developer_name || details.builder || null;
              owner3 = details.owner || details.owner_name || details.current_owner || details.management_company || null;
              const rawV3 = details.vacancy_rate ?? details.vacancy ?? details.current_vacancy ?? null;
              if (rawV3 !== null && !isNaN(parseFloat(rawV3))) vacancyRate3 = parseFloat(rawV3);
              const rawLP3 = details.leased_percentage ?? details.percent_leased ?? details.leased ??
                             details.occupancy_rate ?? details.occupancy ?? details.percent_occupied ?? null;
              if (rawLP3 !== null && !isNaN(parseFloat(rawLP3))) leasedPct3 = parseFloat(rawLP3);
              if (!zipCode3) zipCode3 = details.zip_code || details.zipCode || details.zip || '';

              // Extract property website URL
              websiteUrl3 = details.website || details.website_url || details.property_url ||
                            details.management_website || details.website_link || details.url || null;

              // Extract occupancy trend & exposure fields
              const trend3 = extractTrendFields(details);
              leasedPctChange3 = trend3.leasedPctChange;
              exposure3 = trend3.exposure;
              exposureChange3 = trend3.exposureChange;
              unitsVacant3 = trend3.unitsVacant;
              unitsExposed3 = trend3.unitsExposed;

              // PRIMARY: Extract vacancy, leased, stories, unit mix from building_availability (per API docs)
              const bldgAvail3 = extractFromBuildingAvailability(details);
              if (bldgAvail3.vacancyRate !== null) vacancyRate3 = bldgAvail3.vacancyRate;
              if (bldgAvail3.leasedPct !== null) leasedPct3 = bldgAvail3.leasedPct;
              if (bldgAvail3.stories !== null) stories3 = bldgAvail3.stories;
              if (bldgAvail3.unitMix.length > 0) {
                unitMix3 = bldgAvail3.unitMix;
                console.log(`      🏠 Unit mix (from building_availability): ${bldgAvail3.unitMix.map(m => `${m.unitType}=$${m.avgRent}`).join(', ')}`);
              }

              // FALLBACK: field-level extraction if building_availability didn't have data
              if (stories3 === null) {
                stories3 = details.stories || details.num_floors || details.floors ||
                          details.number_of_stories || details.num_stories || details.story_count ||
                          details.building_stories || details.num_levels || details.floor_count ||
                          details.total_floors || null;
              }
              if (vacancyRate3 === null) {
                const rawV3 = details.vacancy_rate ?? details.vacancy ?? details.current_vacancy ?? null;
                if (rawV3 !== null && !isNaN(parseFloat(rawV3))) vacancyRate3 = parseFloat(rawV3);
              }
              if (leasedPct3 === null) {
                const rawLP3 = details.leased_percentage ?? details.percent_leased ?? details.leased ??
                               details.occupancy_rate ?? details.occupancy ?? details.percent_occupied ?? null;
                if (rawLP3 !== null && !isNaN(parseFloat(rawLP3))) leasedPct3 = parseFloat(rawLP3);
              }

              // SECONDARY: Extract unit mix from property details (floorplan names)
              if (!unitMix3) {
                const detailsMix3 = extractUnitMixFromDetails(details);
                if (detailsMix3.length > 0) {
                  unitMix3 = detailsMix3;
                  console.log(`      🏠 Unit mix (from details): ${detailsMix3.map(m => `${m.unitType}=$${m.avgRent}`).join(', ')}`);
                }
              }

              // Fetch pricing
              try {
                const pricingStart = Date.now();
                const pricingResp = await retryWithBackoff(async () => {
                  const r = await fetchWithTimeout(`${this.baseUrl}/property/pricing`, {
                    method: 'POST',
                    headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subject: details })
                  }, 30000);
                  if (!r.ok) throw new Error(`Pricing ${r.status}`);
                  return r.json();
                });
                apiCallTracker.logCall('HelloData', 'property/pricing', true, Date.now() - pricingStart);

                const allItems = Array.isArray(pricingResp) ? pricingResp : [];
                const validUnits = allItems.filter((item: any) => {
                  const sqft = item.unit?.sqft || item.sqft || 0;
                  const price = item.unit?.price || item.price || item.effective_rent || item.rent || 0;
                  return sqft > 0 && price > 0;
                });
                if (validUnits.length > 0) {
                  const totalPrice = validUnits.reduce((s: number, u: any) => s + (u.unit?.price || u.price || u.effective_rent || u.rent || 0), 0);
                  const totalSqft = validUnits.reduce((s: number, u: any) => s + (u.unit?.sqft || u.sqft || 0), 0);
                  rentPSF = totalPrice / totalSqft;
                  avgRentPerUnit = totalPrice / validUnits.length;
                }
                // Unit mix stays from extractUnitMixFromDetails (active-unit asking prices).
                // Do NOT override with pricing API response which includes historical/contract rents.
              } catch {
                // no pricing data available
              }
            }
          } catch (detailErr: any) {
            console.warn(`⚠️ [HELLODATA] Detail call failed for comp ${comp.id} (${propertyName ?? comp.building_name ?? 'unknown'}) — using search-result data only. Error: ${detailErr?.message ?? detailErr}`);
          }
        }

        results.push({
          address: comp.street_address || comp.address || '',
          city: comp.city || '',
          state: comp.state || '',
          zipCode: zipCode3,
          propertyName: propertyName || undefined,
          yearBuilt,
          unitCount: units,
          distance,
          rentPSF: rentPSF || undefined,
          avgRent: avgRentPerUnit || undefined,
          latitude: lat2,
          longitude: lng2,
          propertyType: propertyType3,
          buildingSize: buildingSize3 || null,
          stories: stories3 ? parseInt(String(stories3)) : null,
          vacancyRate: vacancyRate3,
          developer: developer3,
          owner: owner3,
          leasedPct: leasedPct3,
          leasedPctChange: leasedPctChange3,
          exposure: exposure3,
          exposureChange: exposureChange3,
          unitsVacant: unitsVacant3,
          unitsExposed: unitsExposed3,
          unitMix: unitMix3,
          websiteUrl: websiteUrl3,
        });
      }

      // Build formatted notes
      const vintageLabel = subjectVintage ? ` (±5yr of ${subjectVintage})` : '';
      let notes = `[ACQUISITION COMPARABLES — ${radiusMiles}-mile radius${vintageLabel}]\n`;
      notes += `Found ${results.length} comparable ${results.length === 1 ? 'property' : 'properties'}`;
      if (vintageFiltered.length > maxToFetch) notes += ` (showing ${maxToFetch} of ${vintageFiltered.length})`;
      notes += `\n\n`;

      const withRent = results.filter(r => r.avgRent && r.avgRent > 0);
      const withPSF = results.filter(r => r.rentPSF && r.rentPSF > 0);

      results.forEach((r, idx) => {
        const name = r.propertyName || r.address || 'Unknown';
        const distStr = r.distance > 0 ? ` — ${r.distance.toFixed(1)} mi` : '';
        const vintageStr = r.yearBuilt > 0 ? `${r.yearBuilt}` : 'N/A';
        const unitsStr = r.unitCount > 0 ? `${r.unitCount} units` : 'N/A units';
        const rentStr = r.avgRent > 0 ? `$${Math.round(r.avgRent).toLocaleString()}/unit` : 'No rent data';
        const psfStr = r.rentPSF > 0 ? ` | $${r.rentPSF.toFixed(2)}/sqft` : '';
        notes += `${idx + 1}. ${name}${distStr}\n`;
        notes += `   ${vintageStr} vintage | ${unitsStr} | ${rentStr}${psfStr}\n`;
      });

      // Summary stats
      if (withRent.length > 0) {
        notes += `\n`;
        const avgRentAll = withRent.reduce((s, r) => s + r.avgRent, 0) / withRent.length;
        const topRentAll = Math.max(...withRent.map(r => r.avgRent));
        notes += `AVG RENT/UNIT: $${Math.round(avgRentAll).toLocaleString()}/mo | HIGH: $${Math.round(topRentAll).toLocaleString()}/mo\n`;
        if (withPSF.length > 0) {
          const avgPSF = withPSF.reduce((s, r) => s + r.rentPSF, 0) / withPSF.length;
          const topPSF = Math.max(...withPSF.map(r => r.rentPSF));
          notes += `AVG RENT/SQFT: $${avgPSF.toFixed(2)} | HIGH: $${topPSF.toFixed(2)}\n`;
        }
      }

      console.log(`✅ [ACQUISITION-COMPS] Compiled ${results.length} comparables`);

      return {
        success: true,
        count: results.length,
        comparables: results,
        notes,
        comparablesJson: JSON.stringify(results)
      };

    } catch (error: any) {
      console.error(`❌ [ACQUISITION-COMPS] Error:`, error);
      return { success: false, count: 0, comparables: [], notes: '', error: error.message };
    }
  }
}

// Export singleton instance
export const hellodataService = new HelloDataService();

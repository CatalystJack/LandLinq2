/**
 * Read-only Census Bureau context data for analyst deal views.
 *
 * Every public function is deliberately failure-tolerant. Census data is
 * enrichment only and must never prevent a deal from loading or being edited.
 */

export interface CensusFips {
  stateFips: string;
  countyFips: string;
  tractFips: string;
}

export interface CensusAcsData {
  population: number | null;
  medianHouseholdIncome: number | null;
  ownerOccupiedUnits: number | null;
  renterOccupiedUnits: number | null;
  renterOccupiedPct: number | null;
  ownerOccupiedPct: number | null;
  medianAge: number | null;
  populationGrowthPct: number | null;
}

const ACS_VARIABLES = [
  "B01003_001E",
  "B19013_001E",
  "B25003_001E",
  "B25003_002E",
  "B25003_003E",
  "B01002_001E",
] as const;

const PERMIT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let permitCache:
  | { fetchedAt: number; totalsByCounty: Map<string, number> }
  | null = null;
let permitCachePromise: Promise<Map<string, number> | null> | null = null;

function cleanFips(value: unknown, length: number): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? digits.padStart(length, "0").slice(-length) : null;
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function getFipsForCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): Promise<CensusFips | null> {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const url = new URL(
      "https://geocoding.geo.census.gov/geocoder/geographies/coordinates",
    );
    url.searchParams.set("x", String(lng));
    url.searchParams.set("y", String(lat));
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("vintage", "Current_Current");
    url.searchParams.set("format", "json");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const payload = await response.json() as any;
    const tract = payload?.result?.geographies?.["Census Tracts"]?.[0];
    if (!tract) return null;

    const stateFips = cleanFips(tract.STATE ?? tract.STATEFP, 2);
    const countyFips = cleanFips(tract.COUNTY ?? tract.COUNTYFP, 3);
    const tractFips = cleanFips(tract.TRACT ?? tract.TRACTCE, 6);
    if (!stateFips || !countyFips || !tractFips) return null;

    return { stateFips, countyFips, tractFips };
  } catch (error) {
    console.warn("[CENSUS-DATA] Coordinate geocoder failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchAcsVintage(
  vintage: number,
  stateFips: string,
  countyFips: string,
  tractFips: string,
): Promise<Map<string, number | null> | null> {
  try {
    const apiKey = process.env.CENSUS_API_KEY;
    if (!apiKey) return null;

    const url = new URL(`https://api.census.gov/data/${vintage}/acs/acs5`);
    url.searchParams.set("get", ACS_VARIABLES.join(","));
    url.searchParams.set("for", `tract:${tractFips}`);
    url.searchParams.set("in", `state:${stateFips} county:${countyFips}`);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;

    const payload = await response.json() as unknown;
    if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[0]) || !Array.isArray(payload[1])) {
      return null;
    }

    const headers = payload[0] as string[];
    const values = payload[1] as string[];
    const result = new Map<string, number | null>();
    for (const variable of ACS_VARIABLES) {
      const index = headers.indexOf(variable);
      const raw = index >= 0 ? Number(values[index]) : NaN;
      result.set(variable, Number.isFinite(raw) && raw >= 0 ? raw : null);
    }
    return result;
  } catch (error) {
    console.warn(`[CENSUS-DATA] ACS ${vintage} request failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

function buildAcsData(
  current: Map<string, number | null> | null,
  prior: Map<string, number | null> | null,
): CensusAcsData | null {
  if (!current && !prior) return null;

  const currentPopulation = current?.get("B01003_001E") ?? null;
  const priorPopulation = prior?.get("B01003_001E") ?? null;
  const ownerOccupiedUnits = current?.get("B25003_002E") ?? null;
  const renterOccupiedUnits = current?.get("B25003_003E") ?? null;
  const occupiedUnits =
    (ownerOccupiedUnits ?? 0) + (renterOccupiedUnits ?? 0);

  return {
    population: currentPopulation,
    medianHouseholdIncome: current?.get("B19013_001E") ?? null,
    ownerOccupiedUnits,
    renterOccupiedUnits,
    renterOccupiedPct:
      occupiedUnits > 0 && renterOccupiedUnits != null
        ? round((renterOccupiedUnits / occupiedUnits) * 100)
        : null,
    ownerOccupiedPct:
      occupiedUnits > 0 && ownerOccupiedUnits != null
        ? round((ownerOccupiedUnits / occupiedUnits) * 100)
        : null,
    medianAge: current?.get("B01002_001E") ?? null,
    populationGrowthPct:
      currentPopulation != null && priorPopulation != null && priorPopulation > 0
        ? round(((currentPopulation - priorPopulation) / priorPopulation) * 100)
        : null,
  };
}

export async function getAcsDataForTract(
  stateFips: string,
  countyFips: string,
  tractFips: string,
): Promise<CensusAcsData | null> {
  try {
    if (!process.env.CENSUS_API_KEY) return null;

    const [current, prior] = await Promise.all([
      fetchAcsVintage(2023, stateFips, countyFips, tractFips),
      fetchAcsVintage(2019, stateFips, countyFips, tractFips),
    ]);
    return buildAcsData(current, prior);
  } catch (error) {
    console.warn("[CENSUS-DATA] ACS data failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

function currentPermitFileUrl(date = new Date()): string {
  const year = String(date.getUTCFullYear() % 100).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `https://www2.census.gov/econ/bps/County/co${year}${month}y.txt`;
}

async function fetchPermitTotals(): Promise<Map<string, number> | null> {
  try {
    const response = await fetch(currentPermitFileUrl(), {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;

    const text = await response.text();
    const totalsByCounty = new Map<string, number>();

    for (const line of text.split(/\r?\n/)) {
      const columns = line.split(",").map((value) => value.trim());
      if (columns.length < 18 || !/^\d{6}$/.test(columns[0])) continue;

      const stateFips = cleanFips(columns[1], 2);
      const countyFips = cleanFips(columns[2], 3);
      if (!stateFips || !countyFips) continue;

      // BPS county files group unit counts as:
      // 1-unit, 2-units, 3-4 units, and 5+ units.
      const unitIndexes = [8, 11, 14, 17];
      const units = unitIndexes.reduce((sum, index) => {
        const value = Number(columns[index]);
        return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
      }, 0);
      totalsByCounty.set(`${stateFips}${countyFips}`, units);
    }

    return totalsByCounty;
  } catch (error) {
    console.warn("[CENSUS-DATA] Building permits request failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function getPermitTotals(): Promise<Map<string, number> | null> {
  if (permitCache && Date.now() - permitCache.fetchedAt < PERMIT_CACHE_TTL_MS) {
    return permitCache.totalsByCounty;
  }
  if (!permitCachePromise) {
    permitCachePromise = fetchPermitTotals().finally(() => {
      permitCachePromise = null;
    });
  }

  const totals = await permitCachePromise;
  if (totals) permitCache = { fetchedAt: Date.now(), totalsByCounty: totals };
  return totals;
}

export async function getRecentBuildingPermits(
  stateFips: string,
  countyFips: string,
): Promise<number | null> {
  try {
    const totals = await getPermitTotals();
    if (!totals) return null;
    return totals.get(`${cleanFips(stateFips, 2)}${cleanFips(countyFips, 3)}`) ?? null;
  } catch (error) {
    console.warn("[CENSUS-DATA] Building permits lookup failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
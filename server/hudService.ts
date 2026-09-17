const HUD_API_BASE = "https://www.huduser.gov/hudapi/public";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type HudApiResponse = Record<string, any> | Record<string, any>[];

export type HudDealData = {
  status: "matched" | "not_configured" | "location_unresolved" | "unavailable";
  areaName: string | null;
  entityId: string | null;
  fmrTwoBedroom: number | null;
  medianIncome: number | null;
  lowIncomeLimitFourPerson: number | null;
  veryLowIncomeLimitFourPerson: number | null;
  lookedUpAt: string;
};

type CacheEntry = {
  expiresAt: number;
  value: HudDealData;
};

const responseCache = new Map<string, CacheEntry>();
let stateCache: { expiresAt: number; values: Array<Record<string, string>> } | null = null;
const countyCache = new Map<string, { expiresAt: number; values: Array<Record<string, string>> }>();

function getToken(): string | null {
  const token = process.env.HUD_API_TOKEN?.trim();
  return token || null;
}

function normalized(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(county|parish|borough|census area|municipality|city and borough)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function hudGet<T>(path: string): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("HUD_API_TOKEN is not configured");

  const response = await fetch(`${HUD_API_BASE}/${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`HUD API returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function unwrapData(value: any): any {
  return value && !Array.isArray(value) && value.data !== undefined ? value.data : value;
}

async function getStates(): Promise<Array<Record<string, string>>> {
  if (stateCache && stateCache.expiresAt > Date.now()) return stateCache.values;
  const response = await hudGet<HudApiResponse>("fmr/listStates");
  const payload = unwrapData(response);
  const values = Array.isArray(payload) ? payload : [];
  stateCache = { expiresAt: Date.now() + CACHE_TTL_MS, values };
  return values;
}

async function getCounties(stateCode: string): Promise<Array<Record<string, string>>> {
  const cached = countyCache.get(stateCode);
  if (cached && cached.expiresAt > Date.now()) return cached.values;
  const response = await hudGet<HudApiResponse>(`fmr/listCounties/${encodeURIComponent(stateCode)}`);
  const payload = unwrapData(response);
  const values = Array.isArray(payload) ? payload : [];
  countyCache.set(stateCode, { expiresAt: Date.now() + CACHE_TTL_MS, values });
  return values;
}

async function resolveEntityId(deal: {
  state?: string | null;
  county?: string | null;
  censusTractFips?: string | null;
}): Promise<string | null> {
  const tractFips = String(deal.censusTractFips || "").replace(/\D/g, "");
  if (tractFips.length >= 5) return `${tractFips.slice(0, 5)}99999`;

  if (!deal.state || !deal.county) return null;
  const stateInput = String(deal.state).trim();
  const states = await getStates();
  const state = states.find((item) =>
    String(item.state_code || "").toLowerCase() === stateInput.toLowerCase()
    || String(item.state_name || "").toLowerCase() === stateInput.toLowerCase(),
  );
  if (!state?.state_code) return null;

  const counties = await getCounties(state.state_code);
  const countyInput = normalized(deal.county);
  const county = counties.find((item) =>
    normalized(item.county_name) === countyInput
    || normalized(item.town_name) === countyInput,
  );
  return county?.fips_code || null;
}

function firstRecord(data: any): Record<string, any> {
  const payload = unwrapData(data);
  if (Array.isArray(payload)) {
    return payload.find((item) => !item.zip_code || item.zip_code === "MSA level") || payload[0] || {};
  }
  return payload || {};
}

function numericValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readFourPersonLimit(record: Record<string, any> | undefined): number | null {
  if (!record) return null;
  return numericValue(record.il80_p4 ?? record.il50_p4 ?? record.p4 ?? record["4-person"]);
}

export async function lookupHudDataForDeal(deal: {
  state?: string | null;
  county?: string | null;
  censusTractFips?: string | null;
}): Promise<HudDealData> {
  const lookedUpAt = new Date().toISOString();
  const notConfigured: HudDealData = {
    status: "not_configured",
    areaName: null,
    entityId: null,
    fmrTwoBedroom: null,
    medianIncome: null,
    lowIncomeLimitFourPerson: null,
    veryLowIncomeLimitFourPerson: null,
    lookedUpAt,
  };
  if (!getToken()) return notConfigured;

  const cacheKey = [
    deal.state || "",
    deal.county || "",
    deal.censusTractFips || "",
  ].join("|").toLowerCase();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let entityId: string | null = null;
  try {
    entityId = await resolveEntityId(deal);
  } catch (error) {
    console.warn("[HUD] Could not resolve location:", error instanceof Error ? error.message : error);
  }

  if (!entityId) {
    const result: HudDealData = { ...notConfigured, status: "location_unresolved" };
    responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
    return result;
  }

  try {
    const [fmrResult, incomeResult] = await Promise.all([
      hudGet<HudApiResponse>(`fmr/data/${encodeURIComponent(entityId)}`),
      hudGet<HudApiResponse>(`il/data/${encodeURIComponent(entityId)}`),
    ]);
    const fmr = firstRecord(fmrResult);
    const income = firstRecord(incomeResult);
    const basicData = firstRecord(fmr.basicdata);
    const result: HudDealData = {
      status: "matched",
      areaName: String(
        fmr.area_name
        || fmr.metro_name
        || fmr.county_name
        || income.area_name
        || income.metro_name
        || income.county_name
        || "",
      ) || null,
      entityId,
      fmrTwoBedroom: numericValue(basicData["Two-Bedroom"] ?? fmr["Two-Bedroom"]),
      medianIncome: numericValue(income.median_income),
      lowIncomeLimitFourPerson: readFourPersonLimit(income.low),
      veryLowIncomeLimitFourPerson: readFourPersonLimit(income.very_low),
      lookedUpAt,
    };
    responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
    return result;
  } catch (error) {
    console.warn("[HUD] Lookup unavailable:", error instanceof Error ? error.message : error);
    const result: HudDealData = {
      ...notConfigured,
      status: "unavailable",
      entityId,
    };
    responseCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, value: result });
    return result;
  }
}
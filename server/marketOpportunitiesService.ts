/**
 * Market Opportunities Service
 * Searches county GIS parcel data for land held 5+ years by non-developers.
 * Uses public ArcGIS REST services from NC county portals.
 */

export type MarketKey = "wilmington" | "raleigh_durham" | "charlotte" | "asheville";

// ── County ArcGIS configurations ────────────────────────────────────────────

interface CountyGISConfig {
  url: string;
  ownerFields: string[];
  deedFields: string[];
  acreFields: string[];
  zoningFields: string[];
  addrFields: string[];
  idFields: string[];
  valueFields: string[];
  landUseFields: string[];
}

const COUNTY_GIS: Record<MarketKey, CountyGISConfig> = {
  raleigh_durham: {
    url: "https://imaps.wakegov.com/arcgis/rest/services/Parcels/MapServer/0/query",
    ownerFields: ["OWNER_NAME", "OWNER", "OWNERNME", "OWNER1"],
    deedFields: ["DEED_DATE", "SALE_DATE", "TRANSFER_DATE", "LAST_SALE_DATE"],
    acreFields: ["CALC_ACREAGE", "GIS_ACRES", "ACRES", "ACREAGE", "TOTAL_ACRES"],
    zoningFields: ["ZONING_DIST", "ZONING", "ZONE_DIST", "CURRENT_ZONING"],
    addrFields: ["SITE_ADDRESS", "PROP_ADDR", "ADDRESS", "LOCATION"],
    idFields: ["REID", "PIN", "PARCEL_ID", "TAX_ACCOUNT"],
    valueFields: ["LAND_VALUE", "TOTAL_LAND_VALUE", "ASSESSED_VALUE", "TOTAL_VALUE"],
    landUseFields: ["LAND_CLASS", "USE_CODE", "PROP_TYPE", "LAND_USE"],
  },
  charlotte: {
    url: "https://geo.mecknc.gov/arcgis/rest/services/Property/Property_Lookup_and_Search/MapServer/0/query",
    ownerFields: ["OWNER", "OWNER_NAME", "OWNERNME"],
    deedFields: ["DEED_DATE", "SALE_DATE", "LAST_SALE_DATE"],
    acreFields: ["ACRES", "CALC_ACREAGE", "GIS_ACRES", "ACREAGE"],
    zoningFields: ["ZONING", "ZONING_DIST", "ZONE_CODE"],
    addrFields: ["ADDRESS", "SITE_ADDRESS", "PARCEL_ADDR"],
    idFields: ["PID", "REID", "PARCEL_ID"],
    valueFields: ["ASSESSED_VALUE", "LAND_VALUE", "TOTAL_VALUE"],
    landUseFields: ["USE_CODE", "LAND_USE", "PROP_TYPE"],
  },
  wilmington: {
    url: "https://gis.nhcgov.com/arcgis/rest/services/NHC/Parcels/MapServer/0/query",
    ownerFields: ["OWNER_NAME", "OWNER", "TAXOWNER"],
    deedFields: ["DEED_DATE", "SALE_DATE", "TRANSFER_DATE"],
    acreFields: ["GIS_ACRES", "ACRES", "CALC_ACREAGE", "LAND_AREA_ACRES"],
    zoningFields: ["ZONING", "ZONING_DIST", "ZONE_CODE"],
    addrFields: ["SITE_ADDRESS", "ADDRESS", "PROP_ADDR"],
    idFields: ["PARCEL_ID", "PIN", "REID"],
    valueFields: ["ASSESSED_VALUE", "LAND_VALUE", "TOTAL_VALUE"],
    landUseFields: ["LAND_USE", "USE_CODE", "PROP_TYPE"],
  },
  asheville: {
    url: "https://gis.buncombecounty.org/arcgis/rest/services/parcels/MapServer/0/query",
    ownerFields: ["OWNER_NAME", "OWNER", "TAXOWNER"],
    deedFields: ["DEED_DATE", "TRANSFER_DATE", "SALE_DATE"],
    acreFields: ["CALC_ACREAGE", "GIS_ACRES", "ACRES", "ACREAGE"],
    zoningFields: ["ZONING", "ZONING_DIST", "ZONE_DIST"],
    addrFields: ["ADDRESS", "SITE_ADDRESS", "PROP_ADDR"],
    idFields: ["PIN", "PARCEL_ID", "REID"],
    valueFields: ["TOTAL_VALUE", "ASSESSED_VALUE", "LAND_VALUE"],
    landUseFields: ["LAND_USE", "USE_CODE", "PROP_TYPE"],
  },
};

// ── Developer classification ─────────────────────────────────────────────────

const DEVELOPER_COMPANY_NAMES = [
  "DR HORTON", "D R HORTON", "DRHORTON",
  "LENNAR", "PULTE", "NVR INC", "RYAN HOMES",
  "KB HOME", "KBHOME", "TOLL BROTHERS",
  "MERITAGE HOMES", "CENTURY COMMUNITIES",
  "BEAZER HOMES", "SMITH DOUGLAS",
  "STANLEY MARTIN", "MATTAMY", "ASHTON WOODS",
  "TAYLOR MORRISON", "TRI POINTE", "DREAM FINDERS",
  "DAVID WEEKLEY", "MARK SMITH HOMES",
];

const DEVELOPER_KEYWORDS = [
  "DEVELOPMENT LLC", "DEVELOPMENTS LLC", "DEVELOPMENT CO",
  "HOMEBUILDERS", "HOME BUILDERS", "BUILDERS LLC", "BUILDERS INC",
  "BUILDERS LP", "RESIDENTIAL COMMUNITIES",
  "LAND DEVELOPMENT", "LAND DEVELOPERS",
  "HOMES LLC", "HOMES INC", "HOMES LP", "HOMES LTD",
  "CONSTRUCTION LLC", "CONSTRUCTION CO",
  "LAND HOLDINGS LLC", "PROPERTIES GROUP", "REALTY GROUP",
  "REAL ESTATE DEVELOPMENT", "RESIDENTIAL DEVELOPMENT",
  "ACQUISITION LLC", "ACQUISITIONS LLC",
];

const CORPORATE_SUFFIXES = /\b(LLC|LP|LLP|INC|CORP|CO\b|COMPANY|PARTNERS|GROUP|HOLDINGS|PROPERTIES|VENTURES|REALTY|MANAGEMENT|ASSOCIATES|ENTERPRISES)\b/i;
const TRUST_PATTERN = /\b(IRREVOCABLE TRUST|REVOCABLE TRUST|LIVING TRUST|FAMILY TRUST|TESTAMENTARY|ESTATE OF|HEIRS OF|HEIRS AT LAW|REVOCABLE LIV)\b/i;
const GOVERNMENT_PATTERN = /\b(COUNTY OF|CITY OF|STATE OF|TOWN OF|VILLAGE OF|GOVERNMENT|DEPT OF|DEPARTMENT OF|US ARMY|US GOV|NC STATE|NORTH CAROLINA|MUNICIPALITY|AUTHORITY|COMMISSION|DISTRICT)\b/i;

export interface OwnerClassification {
  type: "individual" | "family_llc" | "small_llc" | "trust" | "developer" | "corporate" | "government" | "unknown";
  label: string;
  isTarget: boolean; // true = likely non-developer, good acquisition target
}

export function classifyOwner(name: string): OwnerClassification {
  if (!name?.trim()) return { type: "unknown", label: "Unknown", isTarget: false };

  const upper = name.toUpperCase().trim();

  if (GOVERNMENT_PATTERN.test(upper))
    return { type: "government", label: "Government", isTarget: false };

  for (const dev of DEVELOPER_COMPANY_NAMES) {
    if (upper.includes(dev)) return { type: "developer", label: "Developer", isTarget: false };
  }

  for (const kw of DEVELOPER_KEYWORDS) {
    if (upper.includes(kw)) return { type: "developer", label: "Developer", isTarget: false };
  }

  if (TRUST_PATTERN.test(upper))
    return { type: "trust", label: "Trust / Estate", isTarget: true };

  // No corporate suffix at all → individual
  if (!CORPORATE_SUFFIXES.test(upper))
    return { type: "individual", label: "Individual", isTarget: true };

  // Family/farm LLC pattern → good target
  if (/\b(FAMILY|FARM|FARMS|LAND|ACRES|RANCH|HOMESTEAD|TIMBER)\b/.test(upper) && /\bLLC\b/.test(upper))
    return { type: "family_llc", label: "Family LLC", isTarget: true };

  // Generic LLC/LP without developer keywords
  if (/\b(LLC|LP|LLP)\b/.test(upper))
    return { type: "small_llc", label: "Small LLC", isTarget: true };

  return { type: "corporate", label: "Corporate", isTarget: false };
}

// ── Field normalization utilities ────────────────────────────────────────────

function getField(attrs: Record<string, any>, candidates: string[]): any {
  for (const f of candidates) {
    if (attrs[f] != null) return attrs[f];
    // case-insensitive fallback
    const found = Object.keys(attrs).find((k) => k.toUpperCase() === f.toUpperCase());
    if (found && attrs[found] != null) return attrs[found];
  }
  return null;
}

function parseArcGISDate(val: any): { dateStr: string | null; yearsHeld: number | null } {
  if (val == null) return { dateStr: null, yearsHeld: null };

  let d: Date | null = null;

  if (typeof val === "number" && val > 1e10) {
    // ArcGIS Unix timestamp in ms
    d = new Date(val);
  } else if (typeof val === "string" && val.trim()) {
    d = new Date(val);
    if (isNaN(d.getTime())) {
      // Try MMDDYYYY or YYYYMMDD
      const digits = val.replace(/\D/g, "");
      if (digits.length === 8) {
        const y1 = digits.slice(0, 4);
        const y2 = digits.slice(4, 8);
        if (parseInt(y1) >= 1900 && parseInt(y1) <= 2030) {
          d = new Date(`${y1}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`);
        } else if (parseInt(y2) >= 1900 && parseInt(y2) <= 2030) {
          d = new Date(`${y2}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`);
        }
      }
    }
  }

  if (!d || isNaN(d.getTime())) return { dateStr: null, yearsHeld: null };
  if (d.getFullYear() < 1900 || d > new Date()) return { dateStr: null, yearsHeld: null };

  const yearsHeld = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return {
    dateStr: d.toISOString().split("T")[0],
    yearsHeld: Math.round(yearsHeld * 10) / 10,
  };
}

// ── Parcel result type ───────────────────────────────────────────────────────

export interface ParcelOpportunity {
  parcelId: string;
  address: string;
  ownerName: string;
  ownerType: string;
  ownerLabel: string;
  isTarget: boolean;
  lastSaleDate: string | null;
  yearsHeld: number | null;
  acreage: number | null;
  currentZoning: string;
  landUse: string;
  assessedValue: number | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
}

function normalizeParcel(
  attrs: Record<string, any>,
  cfg: CountyGISConfig,
  geo: any,
  market: string
): ParcelOpportunity | null {
  const ownerName = String(getField(attrs, cfg.ownerFields) ?? "").trim();
  const deedRaw = getField(attrs, cfg.deedFields);
  const acreRaw = getField(attrs, cfg.acreFields);
  const zoning = String(getField(attrs, cfg.zoningFields) ?? "").trim();
  const address = String(getField(attrs, cfg.addrFields) ?? "").trim();
  const parcelId = String(getField(attrs, cfg.idFields) ?? "").trim();
  const valueRaw = getField(attrs, cfg.valueFields);
  const landUse = String(getField(attrs, cfg.landUseFields) ?? "").trim();

  const acres = parseFloat(String(acreRaw)) || 0;
  const { dateStr, yearsHeld } = parseArcGISDate(deedRaw);
  const owner = classifyOwner(ownerName);

  // Coordinates from geometry
  let lat: number | null = null, lng: number | null = null;
  if (geo) {
    if (geo.x != null && geo.y != null) {
      lng = geo.x;
      lat = geo.y;
    } else if (Array.isArray(geo.rings) && geo.rings[0]?.length) {
      const ring = geo.rings[0] as number[][];
      lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    } else if (Array.isArray(geo.points) && geo.points[0]) {
      lng = geo.points[0][0];
      lat = geo.points[0][1];
    }
  }

  return {
    parcelId,
    address,
    ownerName,
    ownerType: owner.type,
    ownerLabel: owner.label,
    isTarget: owner.isTarget,
    lastSaleDate: dateStr,
    yearsHeld,
    acreage: acres > 0 ? acres : null,
    currentZoning: zoning,
    landUse,
    assessedValue: parseInt(String(valueRaw ?? 0)) || null,
    latitude: lat,
    longitude: lng,
    source: `county_gis_${market}`,
  };
}

// ── County GIS bulk parcel search ────────────────────────────────────────────

export interface OpportunitySearchFilters {
  minAcres?: number;
  maxAcres?: number;
  minYears?: number;
  onlyTargetOwners?: boolean;
  limit?: number;
}

export async function searchCountyParcels(
  market: MarketKey,
  filters: OpportunitySearchFilters
): Promise<{ results: ParcelOpportunity[]; total: number; error?: string; warning?: string }> {
  const cfg = COUNTY_GIS[market];
  if (!cfg) return { results: [], total: 0, error: "County GIS not configured for this market" };

  const { minAcres = 2, maxAcres, minYears = 5, onlyTargetOwners = true, limit = 75 } = filters;

  // Calculate cutoff — we filter in memory since field names vary
  const cutoffMs = Date.now() - minYears * 365.25 * 24 * 3600 * 1000;

  // Use a broad WHERE clause — more reliable than guessing field names
  // We fetch up to 500 records and filter in memory
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
    resultRecordCount: "500",
    orderByFields: "OBJECTID DESC",
  });

  const url = `${cfg.url}?${params}`;

  let data: any;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "LandLinq/1.0" },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return { results: [], total: 0, error: `County GIS returned HTTP ${response.status}` };
    }

    data = await response.json();
  } catch (e: any) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return { results: [], total: 0, error: "County GIS request timed out (20s)" };
    }
    return { results: [], total: 0, error: e.message };
  }

  if (data.error) {
    return { results: [], total: 0, error: data.error.message || "County GIS error" };
  }

  if (!Array.isArray(data.features) || data.features.length === 0) {
    return { results: [], total: 0, warning: "County GIS returned no parcels for this query" };
  }

  const results: ParcelOpportunity[] = [];

  for (const feat of data.features) {
    const attrs = feat.attributes ?? {};
    const parcel = normalizeParcel(attrs, cfg, feat.geometry, market);
    if (!parcel) continue;

    // Apply acreage filter
    if (parcel.acreage === null) continue;
    if (parcel.acreage < minAcres) continue;
    if (maxAcres != null && parcel.acreage > maxAcres) continue;

    // Apply years-held filter
    if (parcel.yearsHeld === null) continue;
    if (parcel.yearsHeld < minYears) continue;

    // Apply owner type filter
    if (onlyTargetOwners && !parcel.isTarget) continue;

    results.push(parcel);
    if (results.length >= limit) break;
  }

  return { results, total: results.length };
}

// ── Spatial parcel lookup by coordinates ────────────────────────────────────

export async function lookupParcelByCoords(
  market: MarketKey,
  lat: number,
  lng: number
): Promise<ParcelOpportunity | null> {
  const cfg = COUNTY_GIS[market];
  if (!cfg) return null;

  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "false",
    f: "json",
  });

  try {
    const res = await fetch(`${cfg.url}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (!data.features?.[0]) return null;
    return normalizeParcel(data.features[0].attributes, cfg, null, market);
  } catch {
    return null;
  }
}

// ── Batch address screener ────────────────────────────────────────────────────

export interface ScreenResult {
  inputAddress: string;
  geocodedAddress?: string;
  parcel?: ParcelOpportunity;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

export async function screenAddressBatch(
  market: MarketKey,
  addresses: string[],
  minYears: number = 5
): Promise<{ results: ScreenResult[]; screened: number }> {
  const apiKey = process.env.GEOCODIO_API_KEY;
  if (!apiKey) throw new Error("GEOCODIO_API_KEY not configured");

  const results: ScreenResult[] = [];

  for (const rawAddr of addresses.slice(0, 50)) {
    const addr = rawAddr.trim();
    if (!addr) continue;

    try {
      // Geocode to get lat/lng
      const geoUrl = `https://api.geocod.io/v1.9/geocode?q=${encodeURIComponent(addr)}&api_key=${apiKey}`;
      const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(8000) });
      const geoData = await geoRes.json();

      const geoResult = geoData.results?.[0];
      if (!geoResult) {
        results.push({ inputAddress: addr, error: "Geocoding returned no results" });
        continue;
      }

      const { lat, lng } = geoResult.location;
      const geocodedAddress = geoResult.formatted_address;

      // Look up parcel from county GIS
      const parcel = await lookupParcelByCoords(market, lat, lng);

      if (!parcel) {
        results.push({ inputAddress: addr, geocodedAddress, error: "No parcel data found in county GIS" });
        continue;
      }

      const owner = classifyOwner(parcel.ownerName);

      if (parcel.yearsHeld !== null && parcel.yearsHeld < minYears) {
        results.push({
          inputAddress: addr,
          geocodedAddress,
          parcel,
          skipped: true,
          skipReason: `Held only ${parcel.yearsHeld.toFixed(1)} years (min ${minYears})`,
        });
        continue;
      }

      if (!owner.isTarget) {
        results.push({
          inputAddress: addr,
          geocodedAddress,
          parcel,
          skipped: true,
          skipReason: `Owner classified as ${owner.label}`,
        });
        continue;
      }

      results.push({ inputAddress: addr, geocodedAddress, parcel });
    } catch (e: any) {
      results.push({ inputAddress: addr, error: e.message });
    }
  }

  return { results, screened: addresses.length };
}

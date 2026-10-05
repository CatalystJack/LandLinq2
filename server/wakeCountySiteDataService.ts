import type { PropertyData } from "@shared/schema";

const WAKE_PARCEL_QUERY =
  "https://maps.wake.gov/arcgis/rest/services/Property/Parcels/FeatureServer/0/query";
const RALEIGH_ZONING_QUERY =
  "https://maps.wake.gov/arcgis/rest/services/Planning/Zoning/FeatureServer/23/query";
const WAKE_PARCEL_SOURCE = "Wake County GIS Parcels";
const RALEIGH_ZONING_SOURCE = "Raleigh Zoning Districts";
const RALEIGH_WATER_SOURCE =
  "https://www.arcgis.com/home/item.html?id=42a74108c2714d88b364cf4859017e82";

export type LocalSiteCheckStatus =
  | "available"
  | "no_match"
  | "ambiguous"
  | "not_covered"
  | "not_checked"
  | "error";

type ArcGisGeometry = {
  rings: number[][][];
  spatialReference?: { wkid?: number; latestWkid?: number };
};

type ParcelAttributes = {
  PIN_NUM?: string | number | null;
  SITE_ADDRESS?: string | null;
  CALC_AREA?: number | string | null;
  PLANNING_JURISDICTION?: string | null;
};

type ZoningDistrict = {
  code: string;
  districtType: string | null;
  effectiveDate: string | null;
  ordinance: string | null;
  caseNumber: string | null;
  conditional: string | null;
};

export type WakeCountySiteData = {
  pilotRegion: "Wake County, NC / Raleigh zoning jurisdiction";
  checkedAt: string;
  parcel: {
    status: LocalSiteCheckStatus;
    message: string;
    source: string;
    sourceUrl: string;
    checkedAt: string;
    parcelId: string | null;
    siteAddress: string | null;
    acreage: number | null;
    geometry: ArcGisGeometry | null;
  };
  zoning: {
    status: LocalSiteCheckStatus;
    message: string;
    source: string;
    sourceUrl: string;
    checkedAt: string;
    districts: ZoningDistrict[];
  };
  utilities: {
    status: "unknown";
    source: string;
    sourceUrl: string;
    message: string;
  };
  persistenceStatus?: "saved" | "error";
};

export type WakeCountySiteDataInput = {
  dealId?: string;
  address?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  parcelId?: string | null;
};

type ArcGisFeature = {
  attributes?: Record<string, unknown>;
  geometry?: ArcGisGeometry | null;
};

function normalizeCounty(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .replace(/\s+county$/i, "")
    .toUpperCase();
}

function isNorthCarolina(value: string | null | undefined): boolean {
  const state = (value || "").trim().toUpperCase();
  return state === "NC" || state === "NORTH CAROLINA";
}

function normalizeCity(value: string | null | undefined): string {
  return (value || "")
    .toUpperCase()
    .replace(/\bCITY\s+OF\s+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+CITY$/, "")
    .trim();
}

function emptySiteData(
  checkedAt: string,
  status: LocalSiteCheckStatus,
  message: string,
): WakeCountySiteData {
  return {
    pilotRegion: "Wake County, NC / Raleigh zoning jurisdiction",
    checkedAt,
    parcel: {
      status,
      message,
      source: WAKE_PARCEL_SOURCE,
      sourceUrl: WAKE_PARCEL_QUERY,
      checkedAt,
      parcelId: null,
      siteAddress: null,
      acreage: null,
      geometry: null,
    },
    zoning: {
      status,
      message,
      source: RALEIGH_ZONING_SOURCE,
      sourceUrl: RALEIGH_ZONING_QUERY,
      checkedAt,
      districts: [],
    },
    utilities: {
      status: "unknown",
      source: "Raleigh Water Sewer Collection System",
      sourceUrl: RALEIGH_WATER_SOURCE,
      message:
        "Mapped sewer assets do not verify a parcel connection, available capacity, or water service. Utility status remains unknown.",
    },
  };
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeStreet(value: string): string {
  return value
    .toUpperCase()
    .replace(/[.,#]/g, " ")
    .replace(/\bNORTH\b/g, "N")
    .replace(/\bSOUTH\b/g, "S")
    .replace(/\bEAST\b/g, "E")
    .replace(/\bWEST\b/g, "W")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bCIRCLE\b/g, "CIR")
    .replace(/\bHIGHWAY\b/g, "HWY")
    .replace(/\bPARKWAY\b/g, "PKWY")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSiteAddress(address: string | null | undefined): {
  streetNumber: string;
  fullStreetName: string;
} | null {
  const streetLine = (address || "").split(",")[0].trim();
  const match = streetLine.match(/^(\d+[A-Z]?)\s+(.+)$/i);
  if (!match) return null;
  const fullStreetName = normalizeStreet(match[2]);
  if (!fullStreetName) return null;
  return { streetNumber: match[1].toUpperCase(), fullStreetName };
}

async function fetchArcGisFeatures(
  endpoint: string,
  params: Record<string, string>,
): Promise<ArcGisFeature[]> {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries({ ...params, f: "json" })) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`ArcGIS source returned HTTP ${response.status}`);
  const payload = await response.json() as {
    error?: { message?: string };
    features?: ArcGisFeature[];
  };
  if (payload.error) throw new Error(payload.error.message || "ArcGIS query failed");
  if (!Array.isArray(payload.features)) {
    throw new Error("ArcGIS query returned no feature list");
  }
  return payload.features;
}

function parcelQuery(address: string | null | undefined, parcelId: string | null | undefined): {
  where: string;
} | null {
  const normalizedParcelId = (parcelId || "").trim() ||
    (address || "").match(/^Parcel ID:\s*(.+)$/i)?.[1]?.trim() ||
    "";
  if (normalizedParcelId) {
    return { where: `PIN_NUM = '${escapeSqlString(normalizedParcelId)}'` };
  }
  const parsed = parseSiteAddress(address);
  if (!parsed) return null;
  return {
    where:
      `STNUM = ${parsed.streetNumber} AND upper(FULL_STREET_NAME) = ` +
      `'${escapeSqlString(parsed.fullStreetName)}'`,
  };
}

function formatEffectiveDate(value: unknown): string | null {
  const epoch = Number(value);
  if (!Number.isFinite(epoch) || epoch <= 0) return null;
  const date = new Date(epoch);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function mapZoningDistrict(attributes: Record<string, unknown>): ZoningDistrict | null {
  const code = String(attributes.ZONING || attributes.ZONE_TYPE || "").trim();
  if (!code) return null;
  return {
    code,
    districtType: attributes.ZONE_TYPE_DECODE == null
      ? null
      : String(attributes.ZONE_TYPE_DECODE),
    effectiveDate: formatEffectiveDate(attributes.EFF_DATE),
    ordinance: attributes.ORDINANCE == null ? null : String(attributes.ORDINANCE),
    caseNumber: attributes.ZONE_CASE == null ? null : String(attributes.ZONE_CASE),
    conditional: attributes.CONDITIONAL == null ? null : String(attributes.CONDITIONAL),
  };
}

function districtKey(district: ZoningDistrict): string {
  return [
    district.code,
    district.effectiveDate || "",
    district.ordinance || "",
    district.caseNumber || "",
    district.conditional || "",
  ].join("|");
}

export async function lookupWakeCountySiteData(
  input: WakeCountySiteDataInput,
): Promise<WakeCountySiteData> {
  const checkedAt = new Date().toISOString();
  const state = (input.state || "").trim();
  const county = normalizeCounty(input.county);
  if (!state || !county) {
    return emptySiteData(
      checkedAt,
      "not_checked",
      "A known state and county are required to determine local source coverage.",
    );
  }
  if (
    !isNorthCarolina(state) ||
    county !== "WAKE"
  ) {
    return emptySiteData(
      checkedAt,
      "not_covered",
      "Automatic parcel and zoning checks are limited to Wake County, North Carolina.",
    );
  }

  const exactQuery = parcelQuery(input.address, input.parcelId);
  if (!exactQuery) {
    const result = emptySiteData(
      checkedAt,
      "no_match",
      "An exact site address or parcel PIN is required for a reliable parcel match.",
    );
    result.zoning.status = "not_checked";
    result.zoning.message = "Zoning requires a uniquely matched parcel geometry.";
    return result;
  }

  let parcelFeatures: ArcGisFeature[];
  try {
    parcelFeatures = await fetchArcGisFeatures(WAKE_PARCEL_QUERY, {
      where: exactQuery.where,
      outFields: "PIN_NUM,SITE_ADDRESS,CALC_AREA,PLANNING_JURISDICTION",
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: "5",
    });
  } catch (error) {
    const result = emptySiteData(
      checkedAt,
      "error",
      error instanceof Error ? error.message : "Wake County parcel lookup failed.",
    );
    result.zoning.status = "not_checked";
    result.zoning.message = "Zoning was not queried because the parcel source failed.";
    result.parcel.status = "error";
    return result;
  }

  if (parcelFeatures.length === 0) {
    const result = emptySiteData(
      checkedAt,
      "no_match",
      "Wake County GIS returned no parcel for the exact PIN or site address.",
    );
    result.zoning.status = "not_checked";
    result.zoning.message = "Zoning requires a uniquely matched parcel geometry.";
    return result;
  }
  if (parcelFeatures.length !== 1) {
    const result = emptySiteData(
      checkedAt,
      "ambiguous",
      "Wake County GIS returned multiple parcels for this exact match; no parcel was selected.",
    );
    result.zoning.status = "not_checked";
    result.zoning.message = "Zoning requires an unambiguous parcel match.";
    return result;
  }

  const parcelFeature = parcelFeatures[0];
  const attributes = (parcelFeature.attributes || {}) as ParcelAttributes;
  if (!attributes.PIN_NUM || !parcelFeature.geometry?.rings?.length) {
    const result = emptySiteData(
      checkedAt,
      "error",
      "The matched Wake County record is missing its parcel PIN or polygon geometry.",
    );
    result.parcel.status = "error";
    result.zoning.status = "not_checked";
    result.zoning.message = "Zoning was not queried because the parcel record is incomplete.";
    return result;
  }

  const parsedArea = attributes.CALC_AREA == null ? null : Number(attributes.CALC_AREA);
  const result = emptySiteData(
    checkedAt,
    "available",
    "A unique Wake County parcel matched by exact PIN or situs address.",
  );
  result.parcel = {
    status: "available",
    message: "A unique Wake County parcel matched by exact PIN or situs address.",
    source: WAKE_PARCEL_SOURCE,
    sourceUrl: WAKE_PARCEL_QUERY,
    checkedAt,
    parcelId: String(attributes.PIN_NUM),
    siteAddress: attributes.SITE_ADDRESS == null ? null : String(attributes.SITE_ADDRESS),
    acreage: parsedArea !== null && Number.isFinite(parsedArea) && parsedArea >= 0
      ? parsedArea
      : null,
    geometry: parcelFeature.geometry,
  };

  const city = normalizeCity(input.city);
  if (!city) {
    result.zoning.status = "not_checked";
    result.zoning.message =
      "A known municipality is required to determine whether the Raleigh zoning layer covers this parcel.";
    return result;
  }
  if (city !== "RALEIGH") {
    result.zoning.status = "not_covered";
    result.zoning.message =
      "This zoning layer covers Raleigh only; other Wake County municipalities and unincorporated areas are not included.";
    return result;
  }
  const planningJurisdiction = String(attributes.PLANNING_JURISDICTION || "")
    .trim()
    .toUpperCase();
  if (planningJurisdiction && planningJurisdiction !== "RA") {
    result.zoning.status = "not_covered";
    result.zoning.message =
      "Wake County identifies this parcel outside the Raleigh planning jurisdiction; Raleigh zoning is not applied.";
    return result;
  }

  let zoningFeatures: ArcGisFeature[];
  try {
    zoningFeatures = await fetchArcGisFeatures(RALEIGH_ZONING_QUERY, {
      geometry: JSON.stringify(parcelFeature.geometry),
      geometryType: "esriGeometryPolygon",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "ZONE_TYPE,ZONE_TYPE_DECODE,ZONING,EFF_DATE,ORDINANCE,ZONE_CASE,CONDITIONAL",
      returnGeometry: "false",
      resultRecordCount: "25",
    });
  } catch (error) {
    result.zoning.status = "error";
    result.zoning.message = error instanceof Error
      ? error.message
      : "Raleigh zoning lookup failed.";
    return result;
  }

  const districtMap = new Map<string, ZoningDistrict>();
  for (const feature of zoningFeatures) {
    const district = mapZoningDistrict(feature.attributes || {});
    if (district) districtMap.set(districtKey(district), district);
  }
  result.zoning.districts = Array.from(districtMap.values());
  if (result.zoning.districts.length === 0) {
    result.zoning.status = "no_match";
    result.zoning.message =
      "No Raleigh zoning polygon intersected the matched parcel. The address may be outside Raleigh's zoning jurisdiction or the source may not cover the parcel; zoning remains unverified.";
  } else if (new Set(result.zoning.districts.map((district) => district.code)).size > 1) {
    result.zoning.status = "ambiguous";
    result.zoning.message =
      "The parcel intersects more than one Raleigh zoning district; manual parcel-level review is required.";
  } else {
    result.zoning.status = "available";
    result.zoning.message =
      "Raleigh zoning district matched spatially against the Wake County parcel polygon.";
  }
  result.zoning.checkedAt = checkedAt;
  return result;
}

function publicSiteData(data: WakeCountySiteData): Omit<WakeCountySiteData, "parcel"> & {
  parcel: Omit<WakeCountySiteData["parcel"], "geometry"> & { geometryAvailable: boolean };
} {
  const { geometry, ...parcel } = data.parcel;
  return {
    ...data,
    parcel: { ...parcel, geometryAvailable: Boolean(geometry?.rings?.length) },
  };
}

function cacheTtlMs(data: {
  parcel: Pick<WakeCountySiteData["parcel"], "status">;
  zoning: Pick<WakeCountySiteData["zoning"], "status">;
}): number {
  if (data.parcel.status === "error" || data.zoning.status === "error") {
    return 30 * 60 * 1000;
  }
  if (data.parcel.status === "not_covered") return 30 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

export async function enrichDealWithWakeCountySiteData(
  input: WakeCountySiteDataInput & { dealId: string },
): Promise<ReturnType<typeof publicSiteData>> {
const [{ db }, { propertyData }, { eq }] = await Promise.all([
    import("./db.js"),
    import("../shared/schema.js"),
    import("drizzle-orm"),
  ]);
  const [existing] = await db.select({
    id: propertyData.id,
    dealId: propertyData.dealId,
    parcelId: propertyData.parcelId,
    boundaries: propertyData.boundaries,
    area: propertyData.area,
    currentZoning: propertyData.currentZoning,
    environmentalConstraints: propertyData.environmentalConstraints,
  }).from(propertyData).where(eq(propertyData.dealId, input.dealId)).limit(1);

  const existingConstraints = existing?.environmentalConstraints &&
    typeof existing.environmentalConstraints === "object"
    ? existing.environmentalConstraints as Record<string, unknown>
    : {};
  const cached = existingConstraints.localSiteData as ReturnType<typeof publicSiteData> | undefined;
  if (cached?.checkedAt) {
    const cachedAt = Date.parse(cached.checkedAt);
    if (
      Number.isFinite(cachedAt) &&
      Date.now() - cachedAt < cacheTtlMs(cached)
    ) {
      return cached as ReturnType<typeof publicSiteData>;
    }
  }

  const result = await lookupWakeCountySiteData(input);
  const compactResult = publicSiteData(result);
  const environmentalConstraints = {
    ...existingConstraints,
    localSiteData: compactResult,
  };
  const updates: Record<string, unknown> = {
    environmentalConstraints,
    updatedAt: new Date(),
  };
  if (result.parcel.status === "available") {
    updates.boundaries = result.parcel.geometry;
    if (result.parcel.acreage !== null) updates.area = String(result.parcel.acreage);
    if (result.zoning.status === "available" && result.zoning.districts.length === 1) {
      updates.currentZoning = result.zoning.districts[0].code;
    }
  }

  try {
    if (existing) {
      const parcelId = result.parcel.status === "available" ? result.parcel.parcelId : null;
      if (parcelId) {
        const [parcelOwner] = await db.select({ id: propertyData.id })
          .from(propertyData)
          .where(eq(propertyData.parcelId, parcelId))
          .limit(1);
        if (!parcelOwner || parcelOwner.id === existing.id) updates.parcelId = parcelId;
      }
      await db.update(propertyData).set(updates as any)
        .where(eq(propertyData.id, existing.id));
    } else {
      const values: Partial<PropertyData> & { dealId: string } = {
        dealId: input.dealId,
        environmentalConstraints,
      };
      if (result.parcel.status === "available") {
        values.boundaries = result.parcel.geometry as any;
        if (result.parcel.acreage !== null) values.area = String(result.parcel.acreage);
        if (result.zoning.status === "available" && result.zoning.districts.length === 1) {
          values.currentZoning = result.zoning.districts[0].code;
        }
        const [parcelOwner] = await db.select({ id: propertyData.id })
          .from(propertyData)
          .where(eq(propertyData.parcelId, result.parcel.parcelId!))
          .limit(1);
        if (!parcelOwner) values.parcelId = result.parcel.parcelId;
      }
      await db.insert(propertyData).values(values as any);
    }
    return { ...compactResult, persistenceStatus: "saved" };
  } catch (error) {
    console.warn(
      `[LOCAL-SITE-DATA] Could not persist source result for deal ${input.dealId}:`,
      error instanceof Error ? error.message : error,
    );
    return { ...compactResult, persistenceStatus: "error" };
  }
}
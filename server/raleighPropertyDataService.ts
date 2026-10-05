import { eq, sql } from "drizzle-orm";

const WAKE_PARCEL_LAYER =
  "https://maps.wake.gov/arcgis/rest/services/Property/Parcels/FeatureServer/0";
const RALEIGH_ZONING_LAYER =
  "https://maps.raleighnc.gov/arcgis/rest/services/Planning/Zoning/MapServer/0";
const REQUEST_TIMEOUT_MS = 10_000;
const PARCEL_SEARCH_RADIUS_METERS = 10;

export type LocalPropertySourceStatus = "available" | "not_available" | "error";

export interface RaleighParcelZoningLookup {
  market: "Raleigh, NC";
  checkedAt: string;
  parcel: {
    status: LocalPropertySourceStatus;
    reason?: string;
    parcelId: string | null;
    reid: string | null;
    sourceUrl: string;
    recordDate: null;
  };
  zoning: {
    status: LocalPropertySourceStatus;
    reason?: string;
    code: string | null;
    description: string | null;
    effectiveDate: string | null;
    zoningCase: string | null;
    conditionsUrl: string | null;
    sourceUrl: string;
  };
  note: string;
}

interface ArcGisFeature {
  attributes?: Record<string, unknown>;
  geometry?: { rings?: number[][][] };
}

interface ArcGisResponse {
  error?: { message?: string };
  features?: ArcGisFeature[];
  exceededTransferLimit?: boolean;
}

function normalizeCity(city: string | null | undefined): string {
  return (city || "")
    .trim()
    .toLowerCase()
    .replace(/^(city|town|village)\s+of\s+/, "")
    .replace(/\s+/g, " ");
}

export function isRaleighPropertyPilot(
  city: string | null | undefined,
  state: string | null | undefined,
): boolean {
  const normalizedState = (state || "").trim().toUpperCase();
  return normalizeCity(city) === "raleigh" &&
    (normalizedState === "NC" || normalizedState === "NORTH CAROLINA");
}

function asCoordinate(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validCoordinates(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeServiceDate(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const date = typeof value === "number" || /^\d{13}$/.test(value)
    ? new Date(Number(value))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function fetchArcGisJson(url: string, params: URLSearchParams): Promise<ArcGisResponse> {
  const response = await fetch(`${url}/query?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status}`);

  const payload = await response.json() as ArcGisResponse;
  if (payload.error) throw new Error(payload.error.message || "ArcGIS query failed");
  return payload;
}

type RingRelation = "inside" | "outside" | "boundary";

function pointInRing(longitude: number, latitude: number, ring: number[][]): RingRelation {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x1, y1] = ring[index] || [];
    const [x2, y2] = ring[previous] || [];
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;

    const cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1);
    const withinSegment =
      longitude >= Math.min(x1, x2) - 1e-10 &&
      longitude <= Math.max(x1, x2) + 1e-10 &&
      latitude >= Math.min(y1, y2) - 1e-10 &&
      latitude <= Math.max(y1, y2) + 1e-10;
    if (Math.abs(cross) <= 1e-10 && withinSegment) return "boundary";

    const crossesLatitude = (y1 > latitude) !== (y2 > latitude);
    if (crossesLatitude) {
      const intersectionLongitude = x1 + ((latitude - y1) * (x2 - x1)) / (y2 - y1);
      if (longitude < intersectionLongitude) inside = !inside;
    }
  }
  return inside ? "inside" : "outside";
}

function pointInPolygon(
  longitude: number,
  latitude: number,
  rings: number[][][] | undefined,
): RingRelation | "invalid" {
  if (!Array.isArray(rings) || rings.length === 0) return "invalid";
  let inside = false;
  for (const ring of rings) {
    const relation = pointInRing(longitude, latitude, ring);
    if (relation === "boundary") return "boundary";
    if (relation === "inside") inside = !inside;
  }
  return inside ? "inside" : "outside";
}

function emptyLookup(
  checkedAt: string,
  reason: string,
  status: LocalPropertySourceStatus = "not_available",
): RaleighParcelZoningLookup {
  return {
    market: "Raleigh, NC",
    checkedAt,
    parcel: {
      status,
      reason,
      parcelId: null,
      reid: null,
      sourceUrl: WAKE_PARCEL_LAYER,
      recordDate: null,
    },
    zoning: {
      status,
      reason,
      code: null,
      description: null,
      effectiveDate: null,
      zoningCase: null,
      conditionsUrl: null,
      sourceUrl: RALEIGH_ZONING_LAYER,
    },
    note: "Public map matches are screening context only. A mapped parcel or zoning district does not establish entitlement, permitted unit yield, utility capacity, or diligence clearance.",
  };
}

async function lookupParcel(
  latitude: number,
  longitude: number,
): Promise<RaleighParcelZoningLookup["parcel"]> {
  const latitudeDelta = PARCEL_SEARCH_RADIUS_METERS / 111_320;
  const longitudeDelta =
    PARCEL_SEARCH_RADIUS_METERS / (111_320 * Math.cos(latitude * Math.PI / 180));
  const geometry = {
    xmin: longitude - longitudeDelta,
    ymin: latitude - latitudeDelta,
    xmax: longitude + longitudeDelta,
    ymax: latitude + latitudeDelta,
    spatialReference: { wkid: 4326 },
  };
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify(geometry),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "PIN_NUM,REID",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "20",
    f: "json",
  });
  const payload = await fetchArcGisJson(WAKE_PARCEL_LAYER, params);
  const features = payload.features || [];
  const base = {
    parcelId: null,
    reid: null,
    sourceUrl: WAKE_PARCEL_LAYER,
    recordDate: null,
  } as const;

  if (payload.exceededTransferLimit || features.length >= 20) {
    return { ...base, status: "not_available", reason: "ambiguous_intersection" };
  }
  if (features.length === 0) {
    return { ...base, status: "not_available", reason: "no_parcel_intersection" };
  }

  const relations = features.map((feature) =>
    pointInPolygon(longitude, latitude, feature.geometry?.rings));
  if (relations.includes("invalid")) {
    return { ...base, status: "error", reason: "parcel_geometry_unavailable" };
  }
  if (relations.includes("boundary")) {
    return { ...base, status: "not_available", reason: "coordinate_on_parcel_boundary" };
  }
  const matchingFeatures = features.filter((_, index) => relations[index] === "inside");
  if (matchingFeatures.length !== 1) {
    return {
      ...base,
      status: "not_available",
      reason: matchingFeatures.length > 1 ? "ambiguous_parcel_geometry" : "coordinate_not_inside_parcel",
    };
  }

  const attributes = matchingFeatures[0].attributes || {};
  const parcelId = stringValue(attributes.PIN_NUM);
  if (!parcelId) {
    return { ...base, status: "not_available", reason: "parcel_identifier_missing" };
  }
  return {
    status: "available",
    parcelId,
    reid: stringValue(attributes.REID),
    sourceUrl: WAKE_PARCEL_LAYER,
    recordDate: null,
  };
}

async function lookupZoning(
  latitude: number,
  longitude: number,
): Promise<RaleighParcelZoningLookup["zoning"]> {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "ZONING,ZONE_TYPE_DECODE,EFF_DATE,ZONE_CASE,COND_LINK",
    returnGeometry: "false",
    resultRecordCount: "5",
    f: "json",
  });
  const payload = await fetchArcGisJson(RALEIGH_ZONING_LAYER, params);
  const features = payload.features || [];
  if (payload.exceededTransferLimit || features.length > 1) {
    return {
      status: "not_available",
      reason: "ambiguous_zoning_intersection",
      code: null,
      description: null,
      effectiveDate: null,
      zoningCase: null,
      conditionsUrl: null,
      sourceUrl: RALEIGH_ZONING_LAYER,
    };
  }
  const attributes = features[0]?.attributes || {};
  const code = stringValue(attributes.ZONING);
  if (!code) {
    return {
      status: "not_available",
      reason: "no_zoning_intersection",
      code: null,
      description: null,
      effectiveDate: null,
      zoningCase: null,
      conditionsUrl: null,
      sourceUrl: RALEIGH_ZONING_LAYER,
    };
  }
  return {
    status: "available",
    code,
    description: stringValue(attributes.ZONE_TYPE_DECODE),
    effectiveDate: normalizeServiceDate(attributes.EFF_DATE),
    zoningCase: stringValue(attributes.ZONE_CASE),
    conditionsUrl: stringValue(attributes.COND_LINK),
    sourceUrl: RALEIGH_ZONING_LAYER,
  };
}

export async function lookupRaleighPropertyData(input: {
  city: string | null | undefined;
  state: string | null | undefined;
  latitude: number | string | null | undefined;
  longitude: number | string | null | undefined;
}): Promise<RaleighParcelZoningLookup> {
  const startedAt = new Date().toISOString();
  if (!isRaleighPropertyPilot(input.city, input.state)) {
    return emptyLookup(startedAt, "outside_raleigh_pilot");
  }

  const latitude = asCoordinate(input.latitude);
  const longitude = asCoordinate(input.longitude);
  if (latitude === null || longitude === null) {
    return emptyLookup(startedAt, "location_unresolved");
  }
  if (!validCoordinates(latitude, longitude)) {
    return emptyLookup(startedAt, "invalid_coordinates", "error");
  }

  const [parcelResult, zoningResult] = await Promise.allSettled([
    lookupParcel(latitude, longitude),
    lookupZoning(latitude, longitude),
  ]);
  const checkedAt = new Date().toISOString();
  const parcel = parcelResult.status === "fulfilled"
    ? parcelResult.value
    : {
        status: "error" as const,
        reason: "source_query_failed",
        parcelId: null,
        reid: null,
        sourceUrl: WAKE_PARCEL_LAYER,
        recordDate: null,
      };
  const zoning = zoningResult.status === "fulfilled"
    ? zoningResult.value
    : {
        status: "error" as const,
        reason: "source_query_failed",
        code: null,
        description: null,
        effectiveDate: null,
        zoningCase: null,
        conditionsUrl: null,
        sourceUrl: RALEIGH_ZONING_LAYER,
      };

  if (parcelResult.status === "rejected") {
    console.warn("[RALEIGH-PROPERTY] Wake County parcel query failed");
  }
  if (zoningResult.status === "rejected") {
    console.warn("[RALEIGH-PROPERTY] Raleigh zoning query failed");
  }

  return {
    market: "Raleigh, NC",
    checkedAt,
    parcel,
    zoning,
    note: "Public map matches are screening context only. A mapped parcel or zoning district does not establish entitlement, permitted unit yield, utility capacity, or diligence clearance.",
  };
}

export async function persistRaleighPropertyData(input: {
  dealId: string;
  latitude: number;
  longitude: number;
  lookup: RaleighParcelZoningLookup;
}): Promise<void> {
  const [{ db }, { propertyData }] = await Promise.all([
    import("./db.js"),
    import("../shared/schema.js"),
  ]);
  const lookupJson = JSON.stringify({ localParcelZoning: input.lookup });
  const updatedRows = await db.update(propertyData)
    .set({
      environmentalConstraints: sql`COALESCE(${propertyData.environmentalConstraints}, '{}'::jsonb) || ${lookupJson}::jsonb`,
      updatedAt: new Date(),
    } as any)
    .where(eq(propertyData.dealId, input.dealId))
    .returning({ id: propertyData.id });
  if (updatedRows.length > 0) return;

  await db.insert(propertyData).values({
    dealId: input.dealId,
    coordinates: { lat: input.latitude, lng: input.longitude },
    environmentalConstraints: { localParcelZoning: input.lookup },
  } as any);
}

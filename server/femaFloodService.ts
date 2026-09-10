/**
 * FEMA National Flood Hazard Layer lookup.
 *
 * Public ArcGIS REST service — no API key required.
 * The service returns the FEMA zone code and the optional zone subtype for
 * the point that represents the property.
 */

const NFHL_QUERY_ENDPOINT =
  'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query';

export interface FemaFloodData {
  isInFloodZone: boolean;
  zoneCode: string | null;
  description: string | null;
  zoneSubtype: string | null;
  source: 'FEMA NFHL';
  queriedAt: string;
}

interface FemaQueryResponse {
  features?: Array<{ attributes?: Record<string, unknown> }>;
  error?: { message?: string };
}

const ZONE_DESCRIPTIONS: Record<string, string> = {
  A: 'High-risk area with a 1% annual chance of flooding; base flood elevations may not be available.',
  AE: 'High-risk area with a 1% annual chance of flooding and published base flood elevations.',
  AH: 'High-risk area with a 1% annual chance of shallow flooding, usually one to three feet deep.',
  AO: 'High-risk area with a 1% annual chance of shallow sheet-flow flooding.',
  AR: 'High-risk area with a temporarily increased flood risk due to a previously accredited system.',
  A99: 'High-risk area where a federal flood protection system is under construction.',
  V: 'Coastal high-risk area with a 1% annual chance of flooding and additional wave hazards.',
  VE: 'Coastal high-risk area with a 1% annual chance of flooding, wave hazards, and published elevations.',
  D: 'Possible flood hazard area where the risk has not been determined.',
  X: 'Area of minimal flood hazard outside the 0.2% annual-chance floodplain.',
  X500: 'Moderate-risk area with a 0.2% annual chance of flooding or shallow flooding risk.',
};

export async function fetchFemaFloodData(
  latitude: number,
  longitude: number,
): Promise<FemaFloodData | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${longitude},${latitude}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,ZONE_SUBTY',
    returnGeometry: 'false',
    f: 'json',
  });

  const startedAt = Date.now();
  try {
    const response = await fetch(`${NFHL_QUERY_ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.warn(`⚠️ [FEMA] HTTP ${response.status} after ${Date.now() - startedAt}ms`);
      return null;
    }

    const payload = await response.json() as FemaQueryResponse;
    if (payload.error) {
      console.warn(`⚠️ [FEMA] API error: ${payload.error.message || 'unknown error'}`);
      return null;
    }

    const attributes = payload.features?.[0]?.attributes || {};
    const zoneCode = String(attributes.FLD_ZONE || '').trim().toUpperCase() || null;
    const zoneSubtype = String(attributes.ZONE_SUBTY || '').trim() || null;

    return {
      isInFloodZone: !!zoneCode && zoneCode !== 'X' && zoneCode !== 'X500',
      zoneCode,
      description: zoneCode
        ? ZONE_DESCRIPTIONS[zoneCode] || zoneSubtype || `FEMA flood zone ${zoneCode}.`
        : 'No mapped FEMA flood hazard zone at this location.',
      zoneSubtype,
      source: 'FEMA NFHL',
      queriedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`⚠️ [FEMA] Lookup failed after ${Date.now() - startedAt}ms:`, error instanceof Error ? error.message : error);
    return null;
  }
}
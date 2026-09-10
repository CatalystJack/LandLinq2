/**
 * U.S. Fish & Wildlife Service National Wetlands Inventory lookup.
 *
 * Public ArcGIS REST service — no API key required. A 100-meter search
 * distance is used so a mapped wetland immediately adjacent to a site is
 * surfaced as a screening result rather than silently missed.
 */

const NWI_QUERY_ENDPOINT =
  'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query';

export interface WetlandsData {
  isWetland: boolean;
  nearbyCount: number;
  classifications: string[];
  details: Array<Record<string, unknown>>;
  searchDistanceMeters: number;
  source: 'USFWS National Wetlands Inventory';
  queriedAt: string;
}

interface NwiQueryResponse {
  features?: Array<{ attributes?: Record<string, unknown> }>;
  error?: { message?: string };
}

export async function fetchWetlandsData(
  latitude: number,
  longitude: number,
): Promise<WetlandsData | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const searchDistanceMeters = 100;
  // The NWI map service does not reliably honor the ArcGIS `distance`
  // parameter on this joined layer. Use a small geographic envelope instead
  // (approximately 100m in each direction) to keep the near-site screen.
  const latitudeDelta = searchDistanceMeters / 111_000;
  const longitudeDelta = searchDistanceMeters / (111_000 * Math.max(Math.cos(latitude * Math.PI / 180), 0.2));
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${longitude - longitudeDelta},${latitude - latitudeDelta},${longitude + longitudeDelta},${latitude + latitudeDelta}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    resultRecordCount: '25',
    returnGeometry: 'false',
    f: 'json',
  });

  const startedAt = Date.now();
  try {
    const response = await fetch(`${NWI_QUERY_ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      console.warn(`⚠️ [WETLANDS] HTTP ${response.status} after ${Date.now() - startedAt}ms`);
      return null;
    }

    const payload = await response.json() as NwiQueryResponse;
    if (payload.error) {
      console.warn(`⚠️ [WETLANDS] API error: ${payload.error.message || 'unknown error'}`);
      return null;
    }

    const details = (payload.features || [])
      .map(feature => {
        const attributes = feature.attributes || {};
        const value = (...keys: string[]) => {
          const key = keys.find(candidate => attributes[candidate] !== undefined);
          return key ? attributes[key] : null;
        };
        return {
          attribute: value('ATTRIBUTE', 'Wetlands.ATTRIBUTE'),
          wetlandType: value('WETLAND_TYPE', 'Wetlands.WETLAND_TYPE'),
          acres: value('ACRES', 'Wetlands.ACRES'),
          system: value('SYSTEM', 'NWI_Wetland_Codes.SYSTEM'),
          systemName: value('SYSTEM_NAME', 'NWI_Wetland_Codes.SYSTEM_NAME'),
          className: value('CLASS_NAME', 'NWI_Wetland_Codes.CLASS_NAME'),
          subclassName: value('SUBCLASS_NAME', 'NWI_Wetland_Codes.SUBCLASS_NAME'),
          waterRegime: value('WATER_REGIME_NAME', 'NWI_Wetland_Codes.WATER_REGIME_NAME'),
        } as Record<string, unknown>;
      })
      .slice(0, 25);
    const classifications = Array.from(new Set(details.flatMap(attributes =>
      ['attribute', 'wetlandType', 'className', 'subclassName', 'waterRegime']
        .map(key => String(attributes[key] || '').trim())
        .filter(Boolean),
    )));

    return {
      isWetland: details.length > 0,
      nearbyCount: details.length,
      classifications,
      details,
      searchDistanceMeters,
      source: 'USFWS National Wetlands Inventory',
      queriedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`⚠️ [WETLANDS] Lookup failed after ${Date.now() - startedAt}ms:`, error instanceof Error ? error.message : error);
    return null;
  }
}
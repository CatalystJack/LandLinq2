const NCES_SCHOOL_DISTRICT_QUERY =
  'https://nces.ed.gov/opengis/rest/services/School_District_Boundaries/EDGE_SCHOOLDISTRICT_TL23_SY2223/MapServer/0/query';

const REQUEST_TIMEOUT_MS = 15_000;

function validCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
}

/**
 * Returns the NCES district containing the supplied WGS84 point.
 * NCES is a public federal endpoint and does not require an API key.
 */
export async function lookupSchoolDistrict(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!validCoordinates(latitude, longitude)) return null;

  const params = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'NAME',
    returnGeometry: 'false',
    f: 'json',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${NCES_SCHOOL_DISTRICT_QUERY}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`NCES returned HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      error?: { message?: string };
      features?: Array<{ attributes?: { NAME?: string } }>;
    };
    if (payload.error) {
      throw new Error(payload.error.message || 'NCES query failed');
    }

    const name = payload.features?.[0]?.attributes?.NAME?.trim();
    return name || null;
  } catch (error) {
    console.warn(
      '⚠️ [SCHOOL-DISTRICT] NCES lookup failed:',
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
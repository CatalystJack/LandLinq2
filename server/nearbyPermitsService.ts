export type NearbyPermitsStatus = 'available' | 'not_available' | 'error';

export interface NearbyPermitsResult {
  count: number | null;
  status: NearbyPermitsStatus;
  market: 'nashville' | 'atlanta' | 'raleigh' | 'charlotte' | null;
  source: string | null;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

const RADIUS_METERS = 1609.34;
const REQUEST_TIMEOUT_MS = 20_000;

const NASHVILLE_PERMITS_LAYER =
  'https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Building_Permits_Issued_2/FeatureServer/0/query';
const RALEIGH_PERMITS_LAYER =
  'https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Building_Permits/FeatureServer/0/query';
const ATLANTA_PERMITS_DATA =
  'https://www.arcgis.com/sharing/rest/content/items/655f985f43cc40b4bf2ab7bc73d2169b/data?f=json';

const EMPTY_RESULT = (market: NearbyPermitsResult['market']): NearbyPermitsResult => ({
  count: null,
  status: 'not_available',
  market,
  source: null,
});

function validCoordinates({ latitude, longitude }: Coordinates): boolean {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
}

function normalizeCity(city: string | null | undefined): string {
  return (city || '')
    .toLowerCase()
    .replace(/\b(city|town|village)\s+of\s+/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function marketForCity(city: string | null | undefined): NearbyPermitsResult['market'] {
  const normalized = normalizeCity(city);
  if (normalized === 'nashville' || normalized.startsWith('nashville davidson')) return 'nashville';
  if (normalized === 'atlanta') return 'atlanta';
  if (normalized === 'raleigh') return 'raleigh';
  if (normalized === 'charlotte') return 'charlotte';
  return null;
}

function dateWindowStart(): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Permit source returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function countArcgisPermits(
  source: string,
  dateField: string,
  coordinates: Coordinates,
): Promise<number> {
  const statistics = JSON.stringify([{
    statisticType: 'count',
    onStatisticField: 'OBJECTID',
    outStatisticFieldName: 'permit_count',
  }]);
  const params = new URLSearchParams({
    where: `${dateField} >= DATE '${dateWindowStart()}'`,
    geometry: `${coordinates.longitude},${coordinates.latitude}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(RADIUS_METERS),
    units: 'esriSRUnit_Meter',
    outStatistics: statistics,
    returnGeometry: 'false',
    f: 'json',
  });
  const payload = await fetchJson(`${source}?${params}`);
  if (payload.error) throw new Error(payload.error.message || 'ArcGIS permit query failed');
  const rawCount = payload.features?.[0]?.attributes?.permit_count;
  const count = Number(rawCount);
  if (!Number.isFinite(count)) throw new Error('ArcGIS permit query returned no count');
  return count;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function haversineMiles(a: Coordinates, latitude: number, longitude: number): number {
  const earthRadiusMiles = 3958.7613;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(latitude - a.latitude);
  const dLng = toRadians(longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(latitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

async function countAtlantaPermits(coordinates: Coordinates): Promise<number> {
  // Atlanta's published item is a CSV rather than a queryable feature layer.
  // Filter its official records locally by issue/open date and a one-mile radius.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ATLANTA_PERMITS_DATA, {
      signal: controller.signal,
      headers: { Accept: 'text/csv, application/json' },
    });
    if (!response.ok) throw new Error(`Atlanta permit source returned HTTP ${response.status}`);
    const text = await response.text();
    const cutoff = Date.parse(`${dateWindowStart()}T00:00:00Z`);
    return parseCsv(text).filter((row) => {
      const issued = Date.parse(row['DATE OPENED'] || row['DATE ISSUED'] || '');
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      return Number.isFinite(issued) &&
        issued >= cutoff &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        haversineMiles(coordinates, latitude, longitude) <= 1;
    }).length;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupNearbyPermits(
  city: string | null | undefined,
  latitude: number,
  longitude: number,
): Promise<NearbyPermitsResult> {
  const market = marketForCity(city);
  if (!validCoordinates({ latitude, longitude })) {
    return { ...EMPTY_RESULT(market), status: 'error' };
  }
  if (!market || market === 'charlotte') return EMPTY_RESULT(market);

  try {
    if (market === 'nashville') {
      return {
        count: await countArcgisPermits(NASHVILLE_PERMITS_LAYER, 'Date_Issued', { latitude, longitude }),
        status: 'available',
        market,
        source: NASHVILLE_PERMITS_LAYER,
      };
    }
    if (market === 'raleigh') {
      return {
        count: await countArcgisPermits(RALEIGH_PERMITS_LAYER, 'issueddate', { latitude, longitude }),
        status: 'available',
        market,
        source: RALEIGH_PERMITS_LAYER,
      };
    }
    return {
      count: await countAtlantaPermits({ latitude, longitude }),
      status: 'available',
      market,
      source: ATLANTA_PERMITS_DATA,
    };
  } catch (error) {
    console.warn(
      `⚠️ [NEARBY-PERMITS] ${market} lookup failed:`,
      error instanceof Error ? error.message : error,
    );
    return { count: null, status: 'error', market, source: null };
  }
}
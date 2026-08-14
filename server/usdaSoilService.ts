/**
 * USDA NRCS Soil Data Access (SDA) Service
 * Fetches soil survey data from the NRCS Web Soil Survey Tabular API
 * Endpoint: https://SDMDataAccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest
 * Public API — no key required. USDA_API_KEY reserved for future USDA services.
 *
 * Response format (JSON+COLUMNNAME+METADATA):
 *   Table[0] = column names
 *   Table[1] = column metadata
 *   Table[2..] = data rows
 */

const SDA_ENDPOINT = 'https://SDMDataAccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest';

export interface SoilComponent {
  name: string;
  percentage: number;
  isMajor: boolean;
  drainageClass: string | null;
  hydricRating: string | null;
  landCapabilityClass: string | null; // nirrcapcl: 1-8 (1=best, 8=worst)
  floodingFrequency: string | null;   // from comonth.flodfreqcl
  floodType: string | null;
  slope: number | null;               // representative slope %
  taxClass: string | null;
  taxOrder: string | null;
}

export type ConstructionSuitability = 'Good' | 'Moderate' | 'Poor' | 'Unknown';

export interface SoilData {
  mapUnitName: string;
  dominantComponent: SoilComponent;
  allComponents: SoilComponent[];
  constructionSuitability: ConstructionSuitability;
  constructionNotes: string[];
  source: 'USDA NRCS Web Soil Survey';
}

function deriveSuitability(comp: SoilComponent): { suitability: ConstructionSuitability; notes: string[] } {
  const notes: string[] = [];
  let score = 0;

  // Land capability class (1-4 good, 5-6 moderate, 7-8 poor)
  const lcc = parseInt(comp.landCapabilityClass ?? '');
  if (!isNaN(lcc)) {
    if (lcc <= 4) score += 2;
    else if (lcc <= 6) score += 0;
    else { score -= 1; notes.push(`Low land capability class (${lcc}/8) — severe limitations for most uses`); }
  }

  // Drainage class
  const drain = comp.drainageClass?.toLowerCase() ?? '';
  if (['well drained', 'somewhat excessively drained', 'excessively drained'].some(d => drain.includes(d.replace('excessively', 'excessi')))) {
    score += 2;
  } else if (drain.includes('moderately well')) {
    score += 0;
  } else if (['somewhat poorly', 'poorly drained', 'very poorly'].some(d => drain.includes(d))) {
    score -= 2;
    notes.push(`${comp.drainageClass} — may require engineered fill, drainage improvements, or elevated foundations`);
  }

  // Flooding frequency
  const flood = comp.floodingFrequency?.toLowerCase() ?? '';
  if (!flood || flood === 'none' || flood === 'not flooded') {
    score += 1;
  } else if (['very rare', 'rare'].some(f => flood.includes(f))) {
    notes.push(`Rare flooding noted — verify FEMA flood zone status`);
  } else if (['occasional', 'frequent', 'very frequent'].some(f => flood.includes(f))) {
    score -= 3;
    notes.push(`"${comp.floodingFrequency}" flooding — significant development risk; verify 100-year FEMA floodplain`);
  }

  // Hydric soils (wetland indicator)
  if (comp.hydricRating?.toLowerCase() === 'yes') {
    score -= 2;
    notes.push(`Hydric soils — potential wetland jurisdiction; Army Corps §404 permit may be required`);
  }

  // Slope
  if (comp.slope !== null && comp.slope > 15) {
    score -= 1;
    notes.push(`${comp.slope}% slope — grading costs and erosion controls will apply`);
  }

  let suitability: ConstructionSuitability;
  if (score >= 3) suitability = 'Good';
  else if (score >= 0) suitability = 'Moderate';
  else suitability = 'Poor';

  return { suitability, notes };
}

function parseRows(table: string[][]): { headers: string[]; rows: string[][] } {
  if (table.length < 3) return { headers: [], rows: [] };
  return { headers: table[0], rows: table.slice(2) };
}

function col(row: string[], headers: string[], name: string): string | null {
  const i = headers.indexOf(name);
  return i >= 0 ? (row[i] ?? null) : null;
}

function parseComponents(headers: string[], rows: string[][]): SoilComponent[] {
  return rows.map(row => ({
    name: col(row, headers, 'compname') ?? 'Unknown',
    percentage: parseFloat(col(row, headers, 'comppct_r') ?? '0') || 0,
    isMajor: (col(row, headers, 'majcompflag') ?? '').trim().toLowerCase() === 'yes',
    drainageClass: col(row, headers, 'drainagecl'),
    hydricRating: col(row, headers, 'hydricrating'),
    landCapabilityClass: col(row, headers, 'nirrcapcl'),
    floodingFrequency: col(row, headers, 'flodfreq'),
    floodType: col(row, headers, 'floodtype'),
    slope: parseFloat(col(row, headers, 'slope_r') ?? '') || null,
    taxClass: col(row, headers, 'taxclname'),
    taxOrder: col(row, headers, 'taxorder'),
  }));
}

export async function fetchSoilData(lat: number, lng: number): Promise<SoilData | null> {
  // SDA spatial functions use POINT(longitude latitude) order
  const wkt = `POINT(${lng} ${lat})`;

  const query = `
    SELECT
      mu.muname,
      c.compname,
      c.comppct_r,
      c.majcompflag,
      c.drainagecl,
      c.hydricrating,
      c.nirrcapcl,
      c.slope_r,
      c.taxclname,
      c.taxorder,
      c.floodtype,
      (SELECT TOP 1 cm.flodfreqcl
       FROM comonth cm
       WHERE cm.cokey = c.cokey
         AND cm.flodfreqcl IS NOT NULL
       ORDER BY cm.monthseq) AS flodfreq
    FROM mapunit mu
    INNER JOIN component c ON c.mukey = mu.mukey
    WHERE mu.mukey IN (
      SELECT * FROM SDA_Get_Mukey_from_Intersection_with_WktWgs84('${wkt}')
    )
    ORDER BY c.comppct_r DESC
  `;

  const startTime = Date.now();

  try {
    console.log(`🌱 [SOIL] Fetching soil data for (${lat}, ${lng})`);

    const response = await fetch(SDA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, format: 'JSON+COLUMNNAME+METADATA' }),
      signal: AbortSignal.timeout(25000),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const body = await response.text();
      console.error(`❌ [SOIL] SDA API error ${response.status} after ${elapsed}ms: ${body.substring(0, 200)}`);
      return null;
    }

    const payload = await response.json() as { Table?: string[][] };
    const table: string[][] = payload?.Table ?? [];

    if (table.length < 3) {
      console.warn(`⚠️ [SOIL] No soil data returned for (${lat}, ${lng}) — may be water, urban paved area, or non-survey area`);
      return null;
    }

    const { headers, rows } = parseRows(table);
    const components = parseComponents(headers, rows);

    if (components.length === 0) {
      console.warn(`⚠️ [SOIL] No components parsed`);
      return null;
    }

    const mapUnitName: string = components[0].name !== 'Unknown'
      ? (col(rows[0], headers, 'muname') ?? 'Unknown map unit')
      : 'Unknown map unit';

    const { suitability, notes } = deriveSuitability(components[0]);

    console.log(`✅ [SOIL] Retrieved in ${elapsed}ms: "${mapUnitName}", dominant="${components[0].name}", suitability=${suitability}`);

    return {
      mapUnitName: col(rows[0], headers, 'muname') ?? 'Unknown map unit',
      dominantComponent: components[0],
      allComponents: components,
      constructionSuitability: suitability,
      constructionNotes: notes,
      source: 'USDA NRCS Web Soil Survey',
    };
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ [SOIL] Fetch failed after ${elapsed}ms:`, error.message);
    return null;
  }
}

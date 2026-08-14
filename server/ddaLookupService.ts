import { readFileSync } from 'fs';
import { join } from 'path';

interface DDAEntry {
  type: string;
  name: string;
  fips?: string;
  stateFips?: string;
  stateAbbr?: string;
}

interface DDALookup {
  byCountyFips: Record<string, DDAEntry>;
  byZip: Record<string, DDAEntry>;
  byStateCounty: Record<string, DDAEntry & { fips: string }>;
}

let lookup: DDALookup | null = null;

function getLookup(): DDALookup {
  if (!lookup) {
    const path = join(process.cwd(), 'server/data/dda_2026.json');
    lookup = JSON.parse(readFileSync(path, 'utf-8')) as DDALookup;
  }
  return lookup;
}

export interface DDAResult {
  isDDA: boolean;
  ddaType: 'MDDA' | 'NMDDA' | null;
  ddaName: string | null;
  matchedBy: 'county' | 'zip' | null;
}

export function checkDDA(
  state: string | null | undefined,
  county: string | null | undefined,
  zip?: string | null
): DDAResult {
  const data = getLookup();
  const noMatch: DDAResult = { isDDA: false, ddaType: null, ddaName: null, matchedBy: null };

  // 1. Check by state+county name (NM — Non-Metropolitan DDAs)
  if (state && county) {
    const stateAbbr = state.trim().toUpperCase().slice(0, 2);
    const countyLower = county.toLowerCase().trim();

    // Try full county name as stored
    const fullKey = `${stateAbbr}:${countyLower}`;
    if (data.byStateCounty[fullKey]) {
      const entry = data.byStateCounty[fullKey];
      return { isDDA: true, ddaType: 'NMDDA', ddaName: entry.name, matchedBy: 'county' };
    }

    // Try with trailing suffix stripped (e.g. "Mecklenburg County" → "Mecklenburg")
    const stripped = countyLower
      .replace(/\s+(county|parish|borough|census area|city and borough|island|planning region)$/i, '')
      .trim();
    const strippedKey = `${stateAbbr}:${stripped}`;
    if (data.byStateCounty[strippedKey]) {
      const entry = data.byStateCounty[strippedKey];
      return { isDDA: true, ddaType: 'NMDDA', ddaName: entry.name, matchedBy: 'county' };
    }

    // Try with " county" appended (in case deal only stores bare name)
    const withCounty = `${stateAbbr}:${countyLower} county`;
    if (data.byStateCounty[withCounty]) {
      const entry = data.byStateCounty[withCounty];
      return { isDDA: true, ddaType: 'NMDDA', ddaName: entry.name, matchedBy: 'county' };
    }
  }

  // 2. Check by zip code (SA — Metropolitan DDAs)
  if (zip) {
    const zipNorm = zip.replace(/\D/g, '').substring(0, 5).padStart(5, '0');
    if (zipNorm.length === 5 && data.byZip[zipNorm]) {
      const entry = data.byZip[zipNorm];
      return { isDDA: true, ddaType: 'MDDA', ddaName: entry.name, matchedBy: 'zip' };
    }
  }

  return noMatch;
}

// Extract a 5-digit zip code from a free-form address string
export function extractZipFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

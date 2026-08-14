/**
 * Novogradac GoZone Map — Tilequery Integration
 *
 * Queries Novogradac's publicly embedded Mapbox tilesets to enrich deal data
 * with affordable housing designations that are not available from a single
 * government source:
 *
 *   • OZ Eligible/Contiguous — tracts eligible for OZ designation (even if not
 *     designated), useful for investors tracking adjacent zones.
 *   • NMTC (New Markets Tax Credits) — actual NMTC investments in the census tract.
 *   • LIHTC Nearby — existing LIHTC projects within 2km (competitive landscape).
 *   • HTC Nearby — Historic Tax Credit projects within 2km.
 *
 * Data source: Novogradac/Novogradac GoZone map public Mapbox tilesets.
 * Token: public access token (pk.*) embedded in the publicly-accessible HTML page.
 */

const MAPBOX_TOKEN = 'pk.eyJ1Ijoibm92b2dyYWRhYyIsImEiOiJjaWtwd3JseGIxNGlwdHpqN3M1aDh1MDFjIn0.EKpUq0uTKTizL-bhjwQCDQ';
const TILEQUERY_BASE = 'https://api.mapbox.com/v4';

const TILESETS = {
  ozEligible: 'novogradac.1pkg13of',  // OZ-eligible tracts (LIC or CONTIGUOUS)
  nmtc:       'novogradac.7iu513lx',  // NMTC investments
  lihtc:      'novogradac.2tusdfda',  // LIHTC projects
  htc:        'novogradac.8dlawwx8',  // Historic Tax Credit projects
};

export interface NovogradacResult {
  // OZ Contiguous/Eligible (tracts that qualify but weren't designated)
  ozEligible: 'CONTIGUOUS' | 'LIC' | 'NO' | 'N/A';

  // New Markets Tax Credits — actual investment in the census tract
  nmtcStatus: 'YES' | 'NO' | 'N/A';
  nmtcProjectId: string | null;
  nmtcAmount: number | null;
  nmtcPurpose: string | null;

  // Nearby LIHTC projects (within 2km)
  lihtcNearby: Array<{
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    totalUnits: number;
    lowIncomeUnits: number;
    hudId: string;
    distanceMeters: number;
  }>;

  // Nearby Historic Tax Credit projects (within 2km)
  htcNearby: Array<{
    name: string;
    address: string;
    city: string;
    estimatedQRE: number | null;
    distanceMeters: number;
  }>;
}

async function tilequery(tileset: string, lng: number, lat: number, radius: number, limit: number): Promise<any[]> {
  const url = `${TILEQUERY_BASE}/${tileset}/tilequery/${lng},${lat}.json?radius=${radius}&limit=${limit}&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tilequery ${tileset} returned HTTP ${res.status}`);
  const data = await res.json() as any;
  return data.features || [];
}

export async function queryNovogradac(lat: number, lng: number): Promise<NovogradacResult> {
  const result: NovogradacResult = {
    ozEligible: 'N/A',
    nmtcStatus: 'N/A',
    nmtcProjectId: null,
    nmtcAmount: null,
    nmtcPurpose: null,
    lihtcNearby: [],
    htcNearby: [],
  };

  try {
    // Run all 4 queries in parallel
    const [ozFeatures, nmtcFeatures, lihtcFeatures, htcFeatures] = await Promise.all([
      tilequery(TILESETS.ozEligible, lng, lat, 0, 1),
      tilequery(TILESETS.nmtc, lng, lat, 0, 1),
      tilequery(TILESETS.lihtc, lng, lat, 2000, 5),
      tilequery(TILESETS.htc, lng, lat, 2000, 5),
    ]);

    // OZ Eligible/Contiguous
    if (ozFeatures.length > 0) {
      const type = ozFeatures[0].properties?.TYPE as string | undefined;
      result.ozEligible = (type === 'CONTIGUOUS' || type === 'LIC') ? type : 'LIC';
      console.log(`🏛️ [NOVOGRADAC] OZ Eligible: ${result.ozEligible} at ${lat},${lng}`);
    } else {
      result.ozEligible = 'NO';
    }

    // NMTC
    if (nmtcFeatures.length > 0) {
      const p = nmtcFeatures[0].properties || {};
      result.nmtcStatus = 'YES';
      result.nmtcProjectId = p['Project ID'] || null;
      result.nmtcAmount = p['QLICI Amount'] ? Number(p['QLICI Amount']) : null;
      result.nmtcPurpose = p['Purpose of Investment'] || null;
      console.log(`💰 [NOVOGRADAC] NMTC: ${result.nmtcProjectId} $${result.nmtcAmount?.toLocaleString()} at ${lat},${lng}`);
    } else {
      result.nmtcStatus = 'NO';
    }

    // LIHTC Nearby
    result.lihtcNearby = lihtcFeatures.map(f => {
      const p = f.properties || {};
      return {
        name: p.PROJECT || 'Unknown',
        address: p.PROJ_ADD || '',
        city: p.PROJ_CTY || '',
        state: p.PROJ_ST || '',
        zip: String(p.PROJ_ZIP || '').padStart(5, '0'),
        totalUnits: Number(p.N_UNITS) || 0,
        lowIncomeUnits: Number(p.LI_UNITS) || 0,
        hudId: p.HUD_ID || '',
        distanceMeters: Math.round(p.tilequery?.distance || 0),
      };
    });
    if (result.lihtcNearby.length > 0) {
      console.log(`🏠 [NOVOGRADAC] ${result.lihtcNearby.length} LIHTC project(s) within 2km at ${lat},${lng}`);
    }

    // HTC Nearby
    result.htcNearby = htcFeatures.map(f => {
      const p = f.properties || {};
      return {
        name: p['Building Name'] || p['Project Name'] || 'Unknown',
        address: p['Address'] || '',
        city: p['City'] || '',
        estimatedQRE: p['Final Estimated QRE'] ? Number(p['Final Estimated QRE']) : null,
        distanceMeters: Math.round(p.tilequery?.distance || 0),
      };
    });

  } catch (err: any) {
    console.warn(`⚠️ [NOVOGRADAC] Tilequery failed for ${lat},${lng}:`, err?.message || err);
    // Return partial result — individual fields remain 'N/A' or empty arrays
  }

  return result;
}

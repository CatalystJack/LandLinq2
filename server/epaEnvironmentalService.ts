/**
 * EPA environmental screening lookup.
 *
 * ECHO's facility-radius endpoint is public and keyless. It provides the
 * EPA-regulated facility universe around a coordinate, including RCRA,
 * TRI, CAA, CWA, and other program indicators. The result is deliberately
 * a screening flag, not a regulatory or Phase I environmental conclusion.
 */

const ECHO_ENDPOINT =
  'https://echodata.epa.gov/echo/echo_rest_services.get_facility_info';

export interface EpaEnvironmentalSite {
  name: string;
  registryId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  programIndicators: string[];
  raw: Record<string, unknown>;
}

export interface EpaEnvironmentalData {
  hasNearbySites: boolean;
  contaminationFlag: boolean;
  screeningRadiusMiles: number;
  nearbySites: EpaEnvironmentalSite[];
  counts: {
    regulatedFacilities: number;
    facilitiesWithRcra: number;
    facilitiesWithTri: number;
    facilitiesWithAir: number;
    facilitiesWithWater: number;
  };
  note: string;
  source: 'EPA ECHO Facility Search';
  queriedAt: string;
}

interface EchoResponse {
  Results?: {
    Facilities?: Array<Record<string, unknown>>;
    Message?: string;
  };
}

function truthy(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '' &&
    value !== '0' && value !== 0 && value !== 'N' && value !== 'NO' && value !== false;
}

function programIndicators(facility: Record<string, unknown>): string[] {
  const indicators: string[] = [];
  if (truthy(facility.RCRAComplianceStatus) || truthy(facility.RCRAInspectionCount)) indicators.push('RCRA');
  if (truthy(facility.TRIFlag) || truthy(facility.TRIReleasesTransfers)) indicators.push('TRI');
  if (truthy(facility.AIRFlag) || truthy(facility.CAAComplianceStatus)) indicators.push('CAA');
  if (truthy(facility.CWAComplianceTracking) || truthy(facility.CWAComplianceStatus)) indicators.push('CWA');
  if (truthy(facility.SDWASystemTypes) || truthy(facility.SDWAComplianceStatus)) indicators.push('SDWA');
  return indicators;
}

export async function fetchEpaEnvironmentalData(
  latitude: number,
  longitude: number,
  screeningRadiusMiles = 3,
): Promise<EpaEnvironmentalData | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const params = new URLSearchParams({
    output: 'JSON',
    p_lat: String(latitude),
    p_long: String(longitude),
    p_radius: String(screeningRadiusMiles),
  });

  const startedAt = Date.now();
  try {
    const response = await fetch(`${ECHO_ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.warn(`⚠️ [EPA] HTTP ${response.status} after ${Date.now() - startedAt}ms`);
      return null;
    }

    const payload = await response.json() as EchoResponse;
    const facilities = payload.Results?.Facilities || [];
    const nearbySites = facilities.slice(0, 100).map(facility => {
      const indicators = programIndicators(facility);
      return {
        name: String(facility.FacName || 'Unnamed EPA facility'),
        registryId: facility.RegistryID ? String(facility.RegistryID) : null,
        address: facility.FacStreet ? String(facility.FacStreet) : null,
        city: facility.FacCity ? String(facility.FacCity) : null,
        state: facility.FacState ? String(facility.FacState) : null,
        latitude: Number.isFinite(Number(facility.FacLat)) ? Number(facility.FacLat) : null,
        longitude: Number.isFinite(Number(facility.FacLong)) ? Number(facility.FacLong) : null,
        programIndicators: indicators,
        raw: {
          registryId: facility.RegistryID || null,
          mapIcon: facility.FacMapIcon || null,
          federalFlag: facility.FacFederalFlg || null,
          activeFlag: facility.FacActiveFlag || null,
          complianceStatus: facility.FacComplianceStatus || null,
          programIndicators: indicators,
        },
      };
    });

    const counts = {
      regulatedFacilities: nearbySites.length,
      facilitiesWithRcra: nearbySites.filter(site => site.programIndicators.includes('RCRA')).length,
      facilitiesWithTri: nearbySites.filter(site => site.programIndicators.includes('TRI')).length,
      facilitiesWithAir: nearbySites.filter(site => site.programIndicators.includes('CAA')).length,
      facilitiesWithWater: nearbySites.filter(site => site.programIndicators.includes('CWA')).length,
    };

    return {
      hasNearbySites: nearbySites.length > 0,
      // ECHO's facility result is the broad public screening universe. Keep
      // the flag explicit so downstream users do not mistake it for a
      // confirmed Superfund, brownfield, or UST determination.
      contaminationFlag: nearbySites.some(site => site.programIndicators.length > 0),
      screeningRadiusMiles,
      nearbySites,
      counts,
      note: nearbySites.length > 0
        ? 'Nearby EPA-regulated facilities found. Review individual records and order formal environmental diligence before relying on this screening result.'
        : 'No EPA ECHO facilities returned within the screening radius.',
      source: 'EPA ECHO Facility Search',
      queriedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`⚠️ [EPA] Lookup failed after ${Date.now() - startedAt}ms:`, error instanceof Error ? error.message : error);
    return null;
  }
}
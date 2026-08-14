/**
 * Geocoding Service using OpenCage API with Google Maps Geocoding API fallback
 * Automatically fetches ZIP codes and coordinates for addresses
 */

interface GeocodingResult {
  success: boolean;
  zipCode?: string;
  city?: string;
  state?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  error?: string;
}

const STATE_NAME_TO_ABBREV: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
};

function normalizeStateToAbbrev(s: string): string {
  if (!s) return '';
  const trimmed = s.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_NAME_TO_ABBREV[trimmed.toLowerCase()] || trimmed.toUpperCase();
}

function citiesMatch(userCity: string, geocodedCity: string): boolean {
  const normalize = (c: string) =>
    c.toLowerCase()
      .replace(/^city of /i, '')
      .replace(/\s+(city|town|village|township)$/i, '')
      .trim();
  const a = normalize(userCity);
  const b = normalize(geocodedCity);
  return a === b || a.includes(b) || b.includes(a);
}

async function geocodeWithGoogle(fullAddress: string): Promise<GeocodingResult> {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { success: false, error: 'No Google Maps API key' };

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return { success: false, error: `Google API ${resp.status}` };
    const data = await resp.json();
    if (data.status !== 'OK' || !data.results?.length) {
      return { success: false, error: `Google: ${data.status}` };
    }

    const result = data.results[0];
    const comps: any[] = result.address_components || [];
    const get = (type: string) => comps.find((c: any) => c.types.includes(type));

    const lat = result.geometry?.location?.lat;
    const lng = result.geometry?.location?.lng;
    const zip = get('postal_code')?.short_name;
    const city = get('locality')?.long_name || get('sublocality')?.long_name || get('neighborhood')?.long_name;
    const stateComp = get('administrative_area_level_1');
    const state = stateComp?.short_name || stateComp?.long_name;
    const countyComp = get('administrative_area_level_2');
    const county = countyComp?.long_name?.replace(/ County$/i, '');

    console.log(`✅ [GOOGLE-GEOCODE] ${lat}, ${lng} — ${city}, ${state} ${zip}`);
    return { success: true, latitude: lat, longitude: lng, zipCode: zip, city, state, county };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export class GeocodingService {
  private apiKey: string;
  private baseUrl: string = 'https://api.opencagedata.com/geocode/v1/json';

  constructor() {
    this.apiKey = process.env.OPENCAGE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ OPENCAGE_API_KEY not configured — will use Google Maps geocoding only');
    }
  }

  async geocodeAddress(address: string): Promise<GeocodingResult> {
    try {
      if (!this.apiKey) {
        return { success: false, error: 'OpenCage API key not configured' };
      }

      if (!address || address.length < 5) {
        return { success: false, error: 'Invalid address provided' };
      }

      console.log(`🌍 [OPENCAGE] Geocoding: ${address}`);

      const params = new URLSearchParams({
        q: address,
        key: this.apiKey,
        limit: '1',
        countrycode: 'us',
        no_annotations: '1',
      });

      const response = await fetch(`${this.baseUrl}?${params}`);
      if (!response.ok) {
        throw new Error(`OpenCage API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        console.log(`⚠️ [OPENCAGE] No results for: ${address}`);
        return { success: false, error: 'No results found for address' };
      }

      const result = data.results[0];
      const components = result.components;
      const zipCode = components.postcode || components.postal_code;
      const city = components.city || components.town || components.village;
      const state = components.state_code || components.state;
      const county = components.county;
      const latitude = result.geometry?.lat;
      const longitude = result.geometry?.lng;

      return { success: true, zipCode: zipCode?.split('-')[0], city, state, county, latitude, longitude };
    } catch (error) {
      console.error('❌ [OPENCAGE] Geocoding error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async enrichWithZipCode(dealData: {
    address?: string;
    zip?: string;
    city?: string;
    state?: string;
  }): Promise<{ zip?: string; city?: string; state?: string; county?: string; latitude?: number; longitude?: number }> {
    if (!dealData.address) {
      console.log(`⚠️ No address to geocode`);
      return {};
    }

    let fullAddress = dealData.address;
    if (dealData.city || dealData.state) {
      const parts = [dealData.address];
      if (dealData.city) parts.push(dealData.city);
      if (dealData.state) parts.push(dealData.state);
      fullAddress = parts.join(', ');
      console.log(`🔍 [GEOCODE] Full address: "${fullAddress}"`);
    }

    let result: GeocodingResult = { success: false };

    if (this.apiKey) {
      result = await this.geocodeAddress(fullAddress);
    }

    if (!result.success) {
      console.log(`⚠️ [GEOCODE] OpenCage failed for: ${fullAddress}`);
      return {};
    }

    const enrichment: any = {};

    const userStateAbbrev = normalizeStateToAbbrev(dealData.state || '');
    const geocodedStateAbbrev = normalizeStateToAbbrev(result.state || '');
    const stateMatch = !dealData.state || !result.state || userStateAbbrev === geocodedStateAbbrev;
    const cityMatch = !dealData.city || !result.city || citiesMatch(dealData.city, result.city);
    const locationMismatch = !stateMatch;

    if (!stateMatch) {
      console.warn(`⚠️ [GEOCODE] State mismatch: user="${dealData.state}" (${userStateAbbrev}) vs geocoded="${result.state}" (${geocodedStateAbbrev}) — skipping coordinates`);
    }
    if (!cityMatch) {
      console.warn(`⚠️ [GEOCODE] City mismatch: user="${dealData.city}" vs geocoded="${result.city}" — noting but still saving coords if state matches`);
    }

    if (!dealData.zip && result.zipCode) {
      enrichment.zip = result.zipCode;
    }
    if (!dealData.city && result.city) {
      enrichment.city = result.city;
    }
    if (!dealData.state && result.state) {
      enrichment.state = result.state;
    }

    if (!locationMismatch) {
      if (result.county) enrichment.county = result.county;
      if (result.latitude && result.longitude) {
        enrichment.latitude = result.latitude;
        enrichment.longitude = result.longitude;
        console.log(`📍 [GEOCODE] Saved coordinates: ${result.latitude}, ${result.longitude}`);
      }
    }

    console.log(`✅ [GEOCODE] Enrichment:`, enrichment);
    return enrichment;
  }
}

export const geocodingService = new GeocodingService();

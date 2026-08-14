/**
 * Regrid Parcel API Service for Property Data Enrichment
 * Auto-populates acreage, zoning, ownership, assessed values, and parcel information
 * API Docs: https://support.regrid.com/api/parcel-api-endpoints
 * Schema: https://support.regrid.com/parcel-data/schema
 */

import { apiCallTracker } from './apiCallTracker.js';

interface RegridParcelData {
  // Coordinates (centroid)
  ll_latitude?: number;
  ll_longitude?: number;

  // Acreage
  ll_gisacre?: number; // Primary acreage field (Regrid-calculated from geometry)
  
  // Zoning
  zoning?: string; // Zoning code (e.g., "R-1", "MF-3")
  zoning_description?: string; // Human-readable zoning name
  zoning_type?: string; // Standardized zoning type (Premium)
  zoning_subtype?: string; // Zoning subtype (Premium)
  
  // Property Details
  yearbuilt?: number; // Year structure was built
  numunits?: number; // Number of living units (KEY for multifamily!)
  numstories?: number; // Number of stories
  structstyle?: string; // Building style
  usecode?: string; // Property use code
  usedesc?: string; // Property use description
  
  // Valuation
  landval?: number; // Land value
  improvval?: number; // Improvement value
  parval?: number; // Total assessed value
  parvaltype?: string; // Value type (Assessed, Market, etc.)
  saleprice?: number; // Last sale price
  saledate?: string; // Last sale date
  taxamt?: number; // Annual tax bill
  taxyear?: string; // Tax year
  
  // Ownership
  owner?: string; // Owner name
  owntype?: string; // Owner type
  mailadd?: string; // Owner mailing address
  mail_city?: string;
  mail_state2?: string;
  mail_zip?: string;
  previous_owner?: string; // Previous owner
  
  // Parcel IDs
  parcelnumb?: string; // Assessor's Parcel Number (APN)
  parcelnumb_no_formatting?: string; // APN without formatting
  account_number?: string; // Account number
  tax_id?: string; // Tax ID
  
  // Address
  address?: string; // Full parcel address
  scity?: string; // City
  state2?: string; // State
  szip?: string; // ZIP code
  county?: string; // County
  
  // Location
  geoid?: string; // FIPS code
  ll_uuid?: string; // Regrid UUID for this parcel
}

interface RegridSearchResult {
  success: boolean;
  parcelData?: RegridParcelData;
  error?: string;
  apiCallsMade: number;
}

export class RegridService {
  private apiToken: string;
  private baseUrl: string = 'https://app.regrid.com/api/v2';

  constructor() {
    this.apiToken = process.env.REGRID_API_TOKEN || '';
    if (!this.apiToken) {
      console.warn('⚠️ REGRID_API_TOKEN not configured');
    }
  }

  /**
   * Search for parcel by address and return enriched property data
   */
  async searchParcelByAddress(address: string): Promise<RegridSearchResult> {
    if (!this.apiToken) {
      console.error('❌ [REGRID] API token not configured');
      return {
        success: false,
        error: 'Regrid API token not configured',
        apiCallsMade: 0
      };
    }

    try {
      console.log(`🔍 [REGRID] Searching for parcel: "${address}"`);
      
      // Track API call
      const startTime = Date.now();
      
      // Call Regrid Address Search API
      const response = await fetch(
        `${this.baseUrl}/parcels/search?query=${encodeURIComponent(address)}&limit=1&return_geometry=false`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Accept': 'application/json'
          }
        }
      );

      const responseTime = Date.now() - startTime;
      
      // Track API call for monitoring
      apiCallTracker.logCall(
        'Other',
        'regrid_parcel_search',
        response.ok,
        responseTime
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [REGRID] API error (${response.status}): ${errorText}`);
        return {
          success: false,
          error: `Regrid API error: ${response.status}`,
          apiCallsMade: 1
        };
      }

      const data = await response.json();
      
      // Check if we got results
      if (!data.parcels || data.parcels.length === 0) {
        console.log(`⚠️ [REGRID] No parcels found for address: ${address}`);
        return {
          success: false,
          error: 'No parcel found for this address',
          apiCallsMade: 1
        };
      }

      // Get the first (best match) parcel
      const parcel = data.parcels[0];
      const properties = parcel.properties || {};
      
      console.log(`✅ [REGRID] Found parcel:`, {
        address: properties.address,
        acreage: properties.ll_gisacre,
        zoning: properties.zoning,
        owner: properties.owner,
        assessedValue: properties.parval
      });

      // Extract centroid from geometry if available
      let ll_latitude: number | undefined;
      let ll_longitude: number | undefined;
      if (parcel.geometry && parcel.geometry.coordinates) {
        const centroid = this.extractCentroid(parcel.geometry);
        if (centroid) { ll_latitude = centroid.lat; ll_longitude = centroid.lng; }
      }
      if (!ll_latitude && properties.ll_latitude) ll_latitude = parseFloat(properties.ll_latitude);
      if (!ll_longitude && properties.ll_longitude) ll_longitude = parseFloat(properties.ll_longitude);
      if (!ll_latitude && properties.lat) ll_latitude = parseFloat(properties.lat);
      if (!ll_longitude && properties.lon) ll_longitude = parseFloat(properties.lon);

      // Extract and structure the parcel data
      const parcelData: RegridParcelData = {
        // Coordinates
        ll_latitude,
        ll_longitude,

        // Acreage
        ll_gisacre: properties.ll_gisacre ? parseFloat(properties.ll_gisacre) : undefined,
        
        // Zoning
        zoning: properties.zoning,
        zoning_description: properties.zoning_description,
        zoning_type: properties.zoning_type,
        zoning_subtype: properties.zoning_subtype,
        
        // Property Details
        yearbuilt: properties.yearbuilt ? parseInt(properties.yearbuilt) : undefined,
        numunits: properties.numunits ? parseInt(properties.numunits) : undefined,
        numstories: properties.numstories ? parseFloat(properties.numstories) : undefined,
        structstyle: properties.structstyle,
        usecode: properties.usecode,
        usedesc: properties.usedesc,
        
        // Valuation
        landval: properties.landval ? parseFloat(properties.landval) : undefined,
        improvval: properties.improvval ? parseFloat(properties.improvval) : undefined,
        parval: properties.parval ? parseFloat(properties.parval) : undefined,
        parvaltype: properties.parvaltype,
        saleprice: properties.saleprice ? parseFloat(properties.saleprice) : undefined,
        saledate: properties.saledate,
        taxamt: properties.taxamt ? parseFloat(properties.taxamt) : undefined,
        taxyear: properties.taxyear,
        
        // Ownership
        owner: properties.owner,
        owntype: properties.owntype,
        mailadd: properties.mailadd,
        mail_city: properties.mail_city,
        mail_state2: properties.mail_state2,
        mail_zip: properties.mail_zip,
        previous_owner: properties.previous_owner,
        
        // Parcel IDs
        parcelnumb: properties.parcelnumb,
        parcelnumb_no_formatting: properties.parcelnumb_no_formatting,
        account_number: properties.account_number,
        tax_id: properties.tax_id,
        
        // Address
        address: properties.address,
        scity: properties.scity,
        state2: properties.state2,
        szip: properties.szip,
        county: properties.county,
        
        // Location
        geoid: properties.geoid,
        ll_uuid: properties.ll_uuid
      };

      return {
        success: true,
        parcelData,
        apiCallsMade: 1
      };

    } catch (error) {
      console.error('❌ [REGRID] Error searching parcel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        apiCallsMade: 1
      };
    }
  }

  /**
   * Compute centroid from GeoJSON Polygon or MultiPolygon geometry
   */
  private extractCentroid(geometry: any): { lat: number; lng: number } | null {
    try {
      let ring: number[][];
      if (geometry.type === 'Polygon') {
        ring = geometry.coordinates[0];
      } else if (geometry.type === 'MultiPolygon') {
        ring = geometry.coordinates[0][0];
      } else {
        return null;
      }
      if (!ring || ring.length === 0) return null;
      const lng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
      const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
      return { lat, lng };
    } catch {
      return null;
    }
  }

  /**
   * Search for parcel by APN (Assessor's Parcel Number) and optional state
   * Used when a deal comes in with only a parcel ID as the address
   */
  async searchParcelByAPN(parcelnumb: string, state?: string): Promise<RegridSearchResult> {
    if (!this.apiToken) {
      return { success: false, error: 'Regrid API token not configured', apiCallsMade: 0 };
    }

    try {
      console.log(`🔍 [REGRID-APN] Searching by APN: "${parcelnumb}" state: "${state || 'any'}"`);
      const startTime = Date.now();

      // Build query — Regrid APN endpoint
      const params = new URLSearchParams({ parcelnumb, limit: '1' });
      if (state) params.set('state_abbr', state.toUpperCase());

      const response = await fetch(
        `${this.baseUrl}/parcels/apn?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${this.apiToken}`, 'Accept': 'application/json' } }
      );

      apiCallTracker.logCall('Other', 'regrid_apn_search', response.ok, Date.now() - startTime);

      if (!response.ok) {
        // Fall back to generic search using just the parcel number as query
        console.log(`⚠️ [REGRID-APN] APN endpoint failed (${response.status}), falling back to search query`);
        return this.searchParcelByAddress(`${parcelnumb}${state ? ` ${state}` : ''}`);
      }

      const data = await response.json();
      if (!data.parcels || data.parcels.length === 0) {
        console.log(`⚠️ [REGRID-APN] No parcels found for APN: ${parcelnumb}`);
        // Fall back to text search
        return this.searchParcelByAddress(`${parcelnumb}${state ? ` ${state}` : ''}`);
      }

      const parcel = data.parcels[0];
      const properties = parcel.properties || {};

      let ll_latitude: number | undefined;
      let ll_longitude: number | undefined;
      if (parcel.geometry?.coordinates) {
        const centroid = this.extractCentroid(parcel.geometry);
        if (centroid) { ll_latitude = centroid.lat; ll_longitude = centroid.lng; }
      }
      if (!ll_latitude && properties.ll_latitude) ll_latitude = parseFloat(properties.ll_latitude);
      if (!ll_longitude && properties.ll_longitude) ll_longitude = parseFloat(properties.ll_longitude);
      if (!ll_latitude && properties.lat) ll_latitude = parseFloat(properties.lat);
      if (!ll_longitude && properties.lon) ll_longitude = parseFloat(properties.lon);

      const parcelData: RegridParcelData = {
        ll_latitude, ll_longitude,
        ll_gisacre: properties.ll_gisacre ? parseFloat(properties.ll_gisacre) : undefined,
        zoning: properties.zoning,
        zoning_description: properties.zoning_description,
        address: properties.address,
        scity: properties.scity,
        state2: properties.state2,
        szip: properties.szip,
        county: properties.county,
        parcelnumb: properties.parcelnumb,
        parcelnumb_no_formatting: properties.parcelnumb_no_formatting,
        owner: properties.owner,
        parval: properties.parval ? parseFloat(properties.parval) : undefined,
        geoid: properties.geoid,
        ll_uuid: properties.ll_uuid,
      };

      console.log(`✅ [REGRID-APN] Found parcel: ${parcelData.address}, ${parcelData.scity}, ${parcelData.state2} (${ll_latitude}, ${ll_longitude})`);
      return { success: true, parcelData, apiCallsMade: 1 };

    } catch (error) {
      console.error('❌ [REGRID-APN] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', apiCallsMade: 1 };
    }
  }

  /**
   * Get enriched property data summary for logging/display
   */
  getDataSummary(parcelData?: RegridParcelData): string {
    if (!parcelData) return 'No data available';
    
    const parts: string[] = [];
    
    if (parcelData.ll_gisacre) {
      parts.push(`${parcelData.ll_gisacre.toFixed(2)} acres`);
    }
    
    if (parcelData.zoning) {
      parts.push(`Zoning: ${parcelData.zoning}`);
    }
    
    if (parcelData.parval) {
      parts.push(`Assessed: $${parcelData.parval.toLocaleString()}`);
    }
    
    if (parcelData.owner) {
      parts.push(`Owner: ${parcelData.owner}`);
    }
    
    return parts.join(' | ') || 'Limited data available';
  }
}

// Export singleton instance
export const regridService = new RegridService();

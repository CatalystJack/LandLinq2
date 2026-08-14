import fetch from 'node-fetch';

export interface RentCastPropertyData {
  id?: string;
  address?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
  assessedValue?: number;
  marketValue?: number;
  pricePerSquareFoot?: number;
  rentEstimate?: {
    rent?: number;
    rentRangeLow?: number;
    rentRangeHigh?: number;
    confidence?: number;
  };
  comparables?: Array<{
    address?: string;
    rent?: number;
    distance?: number;
    bedrooms?: number;
    bathrooms?: number;
  }>;
}

export interface RentCastMarketData {
  averageRent?: number;
  medianRent?: number;
  rentGrowth?: number;
  vacancyRate?: number;
  marketScore?: number;
  trends?: {
    month?: number;
    year?: number;
    averageRent?: number;
  }[];
}

export class RentCastService {
  private apiKey: string;
  private baseUrl = 'https://api.rentcast.io/v1';

  constructor() {
    this.apiKey = process.env.RENTCAST_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ RentCast API key not configured - property enrichment will be limited');
    }
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add parameters to URL
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`RentCast API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getPropertyData(address: string): Promise<RentCastPropertyData | null> {
    try {
      const data = await this.makeRequest('/properties', { address });
      return data || null;
    } catch (error) {
      console.error('Error fetching property data from RentCast:', error);
      return null;
    }
  }

  async getRentEstimate(address: string): Promise<any> {
    try {
      const data = await this.makeRequest('/avm/rent', { address });
      return data;
    } catch (error) {
      console.error('Error fetching rent estimate from RentCast:', error);
      return null;
    }
  }

  async getValueEstimate(address: string): Promise<any> {
    try {
      const data = await this.makeRequest('/avm/value', { address });
      return data;
    } catch (error) {
      console.error('Error fetching value estimate from RentCast:', error);
      return null;
    }
  }

  async getComparables(address: string, type: 'rent' | 'sale' = 'rent'): Promise<any> {
    try {
      const endpoint = type === 'rent' ? '/avm/rent/comparables' : '/avm/value/comparables';
      const data = await this.makeRequest(endpoint, { address });
      return data;
    } catch (error) {
      console.error('Error fetching comparables from RentCast:', error);
      return null;
    }
  }

  async getMarketData(city: string, state: string): Promise<RentCastMarketData | null> {
    try {
      const data = await this.makeRequest('/markets', { city, state });
      return data || null;
    } catch (error) {
      console.error('Error fetching market data from RentCast:', error);
      return null;
    }
  }

  async enrichDealData(deal: any): Promise<any> {
    try {
      if (!deal.address) {
        return deal;
      }

      // Get property data
      const propertyData = await this.getPropertyData(deal.address);
      const rentEstimate = await this.getRentEstimate(deal.address);
      const valueEstimate = await this.getValueEstimate(deal.address);
      const topRentPSFs = await this.getComparables(deal.address, 'rent');

      // Extract city and state from address for market data
      const addressParts = deal.address.split(',');
      const cityState = addressParts[addressParts.length - 1]?.trim().split(' ');
      const state = cityState?.[cityState.length - 1];
      const city = addressParts[addressParts.length - 2]?.trim();

      let marketData = null;
      if (city && state) {
        marketData = await this.getMarketData(city, state);
      }

      // Enhance deal with RentCast data
      const enrichedDeal = {
        ...deal,
        rentcastData: {
          property: propertyData,
          rentEstimate,
          valueEstimate,
          topRentPSFs,
          marketData,
          lastUpdated: new Date().toISOString()
        }
      };

      // Update rent comparable if we got better data (explicit null check, allow 0 values)
      if (rentEstimate?.rent !== null && rentEstimate?.rent !== undefined && deal.topRentPSF === null) {
        enrichedDeal.topRentPSF = rentEstimate.rent.toString();
      }

      // Update market value estimate
      if (valueEstimate?.value) {
        enrichedDeal.estimatedMarketValue = valueEstimate.value;
      }

      // Calculate price per acre if we have lot size (allow 0 lot size)
      if (propertyData?.lotSize !== null && propertyData?.lotSize !== undefined && deal.askingPrice !== null && deal.askingPrice !== undefined) {
        const lotSizeAcres = propertyData.lotSize / 43560; // Convert sq ft to acres
        if (lotSizeAcres > 0) { // Avoid division by zero
          enrichedDeal.pricePerAcre = parseFloat(deal.askingPrice) / lotSizeAcres;
        }
      }

      return enrichedDeal;
    } catch (error) {
      console.error('Error enriching deal data with RentCast:', error);
      return deal;
    }
  }

  async analyzeDevelopmentPotential(address: string, productTypes: string[] = []): Promise<any> {
    try {
      const propertyData = await this.getPropertyData(address);
      const rentEstimate = await this.getRentEstimate(address);
      const topRentPSFs = await this.getComparables(address, 'rent');

      if (!propertyData) {
        return { error: 'Property data not found' };
      }

      // Calculate development metrics
      const lotSizeAcres = propertyData.lotSize !== null && propertyData.lotSize !== undefined ? propertyData.lotSize / 43560 : 0;
      const estimatedUnits = this.estimateUnitCount(lotSizeAcres, productTypes);
      const rentPerUnit = rentEstimate?.rent ?? null;
      const totalGrossRent = estimatedUnits === null ? null : estimatedUnits * rentPerUnit * 12; // Annual
      
      // Get comparable rents for confidence
      const avgComparableRent = topRentPSFs?.comparables?.length > 0 
        ? topRentPSFs.comparables.reduce((sum: number, comp: any) => sum + (comp.rent ?? 0), 0) / topRentPSFs.comparables.length
        : 0;

      return {
        property: propertyData,
        development: {
          lotSizeAcres,
          estimatedUnits,
          rentPerUnit,
          totalGrossRent,
          avgComparableRent,
          comparablesCount: topRentPSFs?.comparables?.length || 0,
          confidence: rentEstimate?.confidence ?? 0
        },
        comparables: topRentPSFs?.comparables ?? []
      };
    } catch (error) {
      console.error('Error analyzing development potential:', error);
      return { error: 'Analysis failed' };
    }
  }

  private estimateUnitCount(acres: number, productTypes: string[]): number | null {
    // NO DENSITY ASSUMPTIONS - RentCast doesn't provide density mapping by development type
    // User preference: Never make base assumptions on data, leave blank if not available from API
    console.log(`⚠️ No density mapping data available from RentCast API for development types: ${productTypes.join(', ')} on ${acres} acres. Leaving unit count empty to avoid assumptions.`);
    return null; // Return null instead of making assumptions - analysts will handle this manually
  }
}

// RentCast service enabled for real property data
export const rentcastService = new RentCastService();
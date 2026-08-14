import { db } from './db.js';
import { acquisitionMarkets } from '@shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

// State name to abbreviation mapping for normalizing Geocodio responses
const STATE_ABBREVIATIONS: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC'
};

// Normalize state to 2-letter abbreviation
function normalizeState(state: string): string {
  if (!state) return '';
  const trimmed = state.trim();
  
  // Already a 2-letter abbreviation
  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }
  
  // Look up full state name
  const abbrev = STATE_ABBREVIATIONS[trimmed.toLowerCase()];
  if (abbrev) {
    console.log(`🔄 [MSA-MATCHING] Normalized state "${trimmed}" → "${abbrev}"`);
    return abbrev;
  }
  
  // Unknown - return uppercase
  return trimmed.toUpperCase();
}

export interface MSAMatchResult {
  matched: boolean;
  msaName?: string;
  county?: string;
  state?: string;
  productTypes?: string[];
  fullCountyName?: string;
  cityNote?: string;
}

export class MSAMatchingService {
  /**
   * Match a county/state combination against acquisition markets
   * Returns MSA information if the location is in a target market
   */
  static async matchCountyToMarket(
    county: string, 
    state: string, 
    dealProductTypes?: string[]
  ): Promise<MSAMatchResult> {
    try {
      console.log(`🗺️ [MSA-MATCHING] Looking up market for: ${county} County, ${state}`);
      
      if (!county || !state) {
        console.log('⚠️ [MSA-MATCHING] Missing county or state - cannot match');
        return { matched: false };
      }
      
      // Normalize county name - remove "County" suffix if present
      const normalizedCounty = county
        .replace(/\s*County\s*/i, '')
        .trim();
      
      console.log(`🔍 [MSA-MATCHING] Normalized county: "${normalizedCounty}"`);
      
      // CRITICAL FIX (Jan 1, 2026): Normalize state to 2-letter abbreviation
      // Geocodio sometimes returns full state names like "South Carolina" instead of "SC"
      const stateAbbrev = normalizeState(state);
      console.log(`🔍 [MSA-MATCHING] State for query: "${stateAbbrev}" (original: "${state}")`);
      
      // CRITICAL FIX (Dec 19, 2025): Use simpler Drizzle query to avoid SQL template literal issues
      // The complex sql`` template was not properly parameterizing values during pipeline execution
      // Solution: Use ilike for case-insensitive matching and explicit eq() conditions
      const stateUpper = stateAbbrev;  // Already uppercase from normalizeState
      const countyLower = normalizedCounty.toLowerCase();
      
      // First try exact match
      let markets = await db
        .select()
        .from(acquisitionMarkets)
        .where(
          and(
            eq(acquisitionMarkets.state, stateUpper),
            eq(acquisitionMarkets.isActive, true)
          )
        );
      
      // CRITICAL DEBUG (Jan 1, 2026): Log ALL counties from DB BEFORE filtering
      const dbCounties = markets.map(m => m.county);
      console.log(`🔍 [MSA-MATCHING] Counties in DB for ${stateUpper}: [${dbCounties.join(', ')}]`);
      console.log(`🔍 [MSA-MATCHING] Looking for county: "${normalizedCounty}" (lowercase: "${countyLower}")`);
      
      // Filter in JavaScript for case-insensitive county matching (more reliable than SQL template)
      markets = markets.filter(m => {
        const marketCounty = (m.county || '').replace(/\s*County\s*/i, '').trim().toLowerCase();
        const matches = marketCounty === countyLower;
        if (!matches && m.county && normalizedCounty.toLowerCase().includes(marketCounty)) {
          console.log(`🔍 [MSA-MATCHING] Near miss: DB has "${m.county}" vs looking for "${normalizedCounty}"`);
        }
        return matches;
      });
      
      console.log(`🔍 [MSA-MATCHING] Query returned ${markets.length} markets (filtered from DB)`);
      if (markets.length > 0) {
        console.log(`🔍 [MSA-MATCHING] First match: ${JSON.stringify(markets[0])}`);
      }
      
      if (markets.length === 0) {
        console.log(`❌ [MSA-MATCHING] No market found for ${normalizedCounty}, ${stateUpper}`);
        
        // DEBUG: Check what's in the database for this state
        const allMarketsForState = await db
          .select()
          .from(acquisitionMarkets)
          .where(
            and(
              eq(acquisitionMarkets.state, stateUpper),
              eq(acquisitionMarkets.isActive, true)
            )
          );
        console.log(`🔍 [MSA-MATCHING] DEBUG - All active markets for state ${stateUpper}: ${allMarketsForState.length}`);
        
        // CRITICAL DEBUG: List ALL counties for this state to see what's available
        if (allMarketsForState.length > 0) {
          const availableCounties = [...new Set(allMarketsForState.map(m => m.county))];
          console.log(`🔍 [MSA-MATCHING] DEBUG - Available counties for ${stateUpper}: ${availableCounties.join(', ')}`);
        } else {
          // Check ALL states in database to see if the issue is state format
          const allActiveMarkets = await db
            .select()
            .from(acquisitionMarkets)
            .where(eq(acquisitionMarkets.isActive, true));
          const allStates = [...new Set(allActiveMarkets.map(m => m.state))];
          console.log(`🔍 [MSA-MATCHING] DEBUG - NO markets for ${stateUpper}! Available states in DB: ${allStates.join(', ')}`);
          console.log(`🔍 [MSA-MATCHING] DEBUG - Total active markets: ${allActiveMarkets.length}`);
        }
        
        // Check if county exists with different spelling
        const similarCounties = allMarketsForState.filter(m => 
          (m.county || '').toLowerCase().includes(countyLower) || 
          countyLower.includes((m.county || '').toLowerCase())
        );
        console.log(`🔍 [MSA-MATCHING] DEBUG - Similar county matches: ${similarCounties.length}`);
        if (similarCounties.length > 0) {
          console.log(`🔍 [MSA-MATCHING] DEBUG - Sample similar: county="${similarCounties[0].county}", state="${similarCounties[0].state}"`);
        }
        
        return { 
          matched: false,
          county: normalizedCounty,
          state: stateUpper
        };
      }
      
      // If multiple markets found (different product types for same county), 
      // merge product types
      const allProductTypes = new Set<string>();
      markets.forEach(market => {
        market.productTypes?.forEach(type => allProductTypes.add(type));
      });
      
      const firstMarket = markets[0];
      
      console.log(`✅ [MSA-MATCHING] Market found:`, {
        msaName: firstMarket.msaName,
        county: firstMarket.county,
        state: firstMarket.state,
        productTypes: Array.from(allProductTypes),
        cityNote: firstMarket.cityNote
      });
      
      // Check if deal's product types are supported in this market
      let matchedProductTypes: string[] = Array.from(allProductTypes);
      if (dealProductTypes && dealProductTypes.length > 0) {
        matchedProductTypes = dealProductTypes.filter(dt => 
          allProductTypes.has(dt)
        );
        
        if (matchedProductTypes.length > 0) {
          console.log(`✅ [MSA-MATCHING] Product type match: ${matchedProductTypes.join(', ')}`);
        } else {
          console.log(`⚠️ [MSA-MATCHING] County found but product types don't match. Deal: ${dealProductTypes.join(', ')}, Market: ${Array.from(allProductTypes).join(', ')}`);
        }
      } else {
        console.log(`ℹ️ [MSA-MATCHING] Deal has no product type - accepting county match (analyst will assign product type later)`);
      }
      
      return {
        matched: true,
        msaName: firstMarket.msaName || undefined,
        county: firstMarket.county || undefined,
        state: firstMarket.state || undefined,
        productTypes: Array.from(allProductTypes),
        fullCountyName: firstMarket.fullCountyName || undefined,
        cityNote: firstMarket.cityNote || undefined
      };
      
    } catch (error) {
      console.error('❌ [MSA-MATCHING] Error matching county to market:', error);
      return { matched: false };
    }
  }
  
  /**
   * Get all markets for a specific MSA
   */
  static async getMarketsByMSA(msaName: string) {
    try {
      const markets = await db
        .select()
        .from(acquisitionMarkets)
        .where(
          and(
            eq(acquisitionMarkets.msaName, msaName),
            eq(acquisitionMarkets.isActive, true)
          )
        );
      
      return markets;
    } catch (error) {
      console.error('❌ Error fetching markets by MSA:', error);
      return [];
    }
  }
  
  /**
   * Get all active acquisition markets grouped by product type
   */
  static async getAllMarketsByProductType() {
    try {
      const allMarkets = await db
        .select()
        .from(acquisitionMarkets)
        .where(eq(acquisitionMarkets.isActive, true));
      
      const groupedByProductType: Record<string, typeof allMarkets> = {};
      
      allMarkets.forEach(market => {
        market.productTypes?.forEach(productType => {
          if (!groupedByProductType[productType]) {
            groupedByProductType[productType] = [];
          }
          groupedByProductType[productType].push(market);
        });
      });
      
      return groupedByProductType;
    } catch (error) {
      console.error('❌ Error fetching markets by product type:', error);
      return {};
    }
  }
  
  /**
   * Check if a county/state combination is in ANY target market
   */
  static async isInTargetMarket(county: string, state: string): Promise<boolean> {
    const result = await this.matchCountyToMarket(county, state);
    return result.matched;
  }
}

export const msaMatchingService = new MSAMatchingService();

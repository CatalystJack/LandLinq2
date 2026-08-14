import { apiCallTracker } from './apiCallTracker.js';
import { db } from './db.js';
import { geocodingAuditLog } from '@shared/schema.js';

/**
 * Retry utility with exponential backoff
 */
// Fetch with timeout - prevents hanging forever if API doesn't respond
async function fetchWithTimeout(url: string, timeoutMs: number = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Geocodio request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Geocodio retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Intersection Address Detection and Normalization (Dec 16, 2025)
 * Detects intersection-style addresses and reformats them for Geocodio
 * Patterns detected: "Street1 & Street2", "Street1 @ Street2", "Street1 at Street2"
 */
interface IntersectionInfo {
  isIntersection: boolean;
  originalAddress: string;
  normalizedFormats: string[];
}

function detectAndNormalizeIntersection(address: string): IntersectionInfo {
  const original = address.trim();
  
  // Common intersection patterns
  const intersectionPatterns = [
    /^(.+?)\s*&\s*(.+)$/i,           // "Street1 & Street2"
    /^(.+?)\s+and\s+(.+)$/i,         // "Street1 and Street2" (but not "Grand and Main")
    /^(.+?)\s*@\s*(.+)$/i,           // "Street1 @ Street2"
    /^(.+?)\s+at\s+(.+)$/i,          // "Street1 at Street2"
    /^(.+?)\s*\/\s*(.+)$/i,          // "Street1 / Street2"
  ];
  
  for (const pattern of intersectionPatterns) {
    const match = original.match(pattern);
    if (match) {
      const street1 = match[1].trim();
      const street2 = match[2].trim();
      
      // Skip if either part looks like a city/state (contains comma or is very short)
      if (street1.includes(',') || street2.includes(',')) continue;
      if (street1.length < 3 || street2.length < 3) continue;
      
      console.log(`🔀 [INTERSECTION] Detected intersection address: "${original}"`);
      console.log(`   Street 1: "${street1}"`);
      console.log(`   Street 2: "${street2}"`);
      
      // Generate multiple format attempts for Geocodio
      const normalizedFormats = [
        `${street1} and ${street2}`,           // Geocodio's preferred intersection format
        `${street2} and ${street1}`,           // Try reverse order
        street1,                                // Try just the first street
        street2,                                // Try just the second street
      ];
      
      return {
        isIntersection: true,
        originalAddress: original,
        normalizedFormats
      };
    }
  }
  
  return {
    isIntersection: false,
    originalAddress: original,
    normalizedFormats: [original]
  };
}

interface GeocodioResponse {
  results?: Array<{
    location: { lat: number; lng: number };
    accuracy?: number;
    accuracy_type?: string;
    address_components: {
      number?: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      county?: string;
    };
    fields?: {
      census?: {
        '2020'?: {
          tract_code?: string;
          full_fips?: string;
          state_fips?: string;
          county_fips?: string;
        };
        '2010'?: {
          tract_code?: string;
          full_fips?: string;
          state_fips?: string;
          county_fips?: string;
        };
      };
      acs?: {
        demographics?: {
          Median_age?: { value: number; margin_of_error: number };
          Total_population?: { value: number; margin_of_error: number };
          Male?: { value: number; margin_of_error: number };
          Female?: { value: number; margin_of_error: number };
          Age?: {
            [key: string]: {
              value: number;
              margin_of_error: number;
              percentage?: number;
            };
          };
        };
        income?: {
          Median_household_income?: { value: number; margin_of_error: number };
          Household_income?: {
            [key: string]: {
              value: number;
              margin_of_error: number;
              percentage?: number;
            };
          };
        };
      };
    };
  }>;
}

interface DemographicsResult {
  success: boolean;
  population55Plus?: number;
  totalPopulation?: number;
  percentOver55?: number;
  medianAge?: number;
  income75kPlus?: number;
  medianHouseholdIncome?: number;
  error?: string;
}

export class GeocodioService {
  private apiKey: string;
  private baseUrl = 'https://api.geocod.io/v1.9';

  constructor() {
    this.apiKey = process.env.GEOCODIO_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ GEOCODIO_API_KEY not found in environment variables');
    }
  }

  /**
   * Log geocoding attempt to audit table (fire-and-forget for performance)
   */
  private async logGeocodingAttempt(params: {
    requestedAddress: string;
    success: boolean;
    errorMessage?: string;
    accuracyType?: string;
    accuracyScore?: number;
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
    zipCode?: string;
    county?: string;
    formattedAddress?: string;
    cityMismatch?: boolean;
    stateMismatch?: boolean;
    rejectedLowAccuracy?: boolean;
    responseTimeMs?: number;
    dealId?: string;
  }): Promise<void> {
    // Fire and forget - don't block geocoding on logging
    setImmediate(async () => {
      try {
        await db.insert(geocodingAuditLog).values({
          dealId: params.dealId || null,
          requestedAddress: params.requestedAddress,
          service: 'Geocodio',
          success: params.success,
          errorMessage: params.errorMessage || null,
          accuracyType: params.accuracyType || null,
          accuracyScore: params.accuracyScore ? String(params.accuracyScore) : null,
          latitude: params.latitude ? String(params.latitude) : null,
          longitude: params.longitude ? String(params.longitude) : null,
          city: params.city || null,
          state: params.state || null,
          zipCode: params.zipCode || null,
          county: params.county || null,
          formattedAddress: params.formattedAddress || null,
          cityMismatch: params.cityMismatch || false,
          stateMismatch: params.stateMismatch || false,
          rejectedLowAccuracy: params.rejectedLowAccuracy || false,
          responseTimeMs: params.responseTimeMs || null,
        });
        console.log(`📝 [GEOCODING-AUDIT] Logged ${params.success ? 'successful' : 'failed'} geocoding attempt for: ${params.requestedAddress}`);
      } catch (error) {
        console.error('❌ [GEOCODING-AUDIT] Failed to log geocoding attempt:', error);
        // Don't throw - logging failure shouldn't break geocoding
      }
    });
  }

  async geocodeAddress(address: string, cityStateZip?: string): Promise<{
    success: boolean;
    fips?: string;
    lat?: number;
    lng?: number;
    zipCode?: string;
    formattedAddress?: string;
    county?: string;
    state?: string;
    city?: string;
    error?: string;
    isIntersectionFallback?: boolean;
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Geocodio API key not configured'
      };
    }

    // Dec 16, 2025: Intersection detection and multi-format fallback
    const intersectionInfo = detectAndNormalizeIntersection(address);
    
    if (intersectionInfo.isIntersection) {
      console.log(`🔀 [INTERSECTION] Attempting ${intersectionInfo.normalizedFormats.length} format variations...`);
      
      // Try each format until one succeeds
      for (let i = 0; i < intersectionInfo.normalizedFormats.length; i++) {
        const formatToTry = intersectionInfo.normalizedFormats[i];
        const fullAddress = cityStateZip ? `${formatToTry}, ${cityStateZip}` : formatToTry;
        
        console.log(`   Attempt ${i + 1}: "${fullAddress}"`);
        
        const result = await this.geocodeAddressInternal(fullAddress);
        
        if (result.success) {
          console.log(`   ✅ Success with format: "${formatToTry}"`);
          result.isIntersectionFallback = i > 0; // Mark if we used a fallback format
          return result;
        }
        
        console.log(`   ❌ Failed, trying next format...`);
      }
      
      // All formats failed - return error with helpful message
      console.error(`❌ [INTERSECTION] All format attempts failed for: "${address}"`);
      return {
        success: false,
        error: `Intersection address could not be geocoded. Try using the "Correct Pin Location" feature to manually place the marker.`
      };
    }

    // Not an intersection - use standard geocoding
    return this.geocodeAddressInternal(address);
  }

  private async geocodeAddressInternal(address: string): Promise<{
    success: boolean;
    fips?: string;
    lat?: number;
    lng?: number;
    zipCode?: string;
    formattedAddress?: string;
    county?: string;
    state?: string;
    city?: string;
    error?: string;
    isIntersectionFallback?: boolean;
  }> {
    try {
      console.log(`🔍 Geocoding address: ${address}`);
      
      // Geocodio requires census fields to get tract information
      const url = `${this.baseUrl}/geocode?q=${encodeURIComponent(address)}&fields=census2020&api_key=${this.apiKey}`;
      
      // Use retry logic with 15-second timeout per attempt (prevents hanging)
      const startTime = Date.now();
      const { response, data } = await retryWithBackoff(async () => {
        const res = await fetchWithTimeout(url, 15000); // 15 second timeout
        const jsonData: GeocodioResponse = await res.json();
        
        if (!res.ok) {
          const responseTime = Date.now() - startTime;
          apiCallTracker.logCall('Geocodio', 'geocode', false, responseTime, {
            errorMessage: `${res.status}`
          });
          
          // ENHANCED ERROR LOGGING: Show exact Geocodio error details
          console.error('❌ [GEOCODING-FAILURE] Geocodio API returned error');
          console.error(`   Address: "${address}"`);
          console.error(`   HTTP Status: ${res.status} ${res.statusText}`);
          console.error(`   Response Body:`, JSON.stringify(jsonData, null, 2));
          console.error(`   API URL: ${url.replace(this.apiKey, '[REDACTED]')}`);
          
          throw new Error(`Geocodio API error: ${res.status} ${res.statusText}`);
        }
        
        return { response: res, data: jsonData };
      });
      
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('Geocodio', 'geocode', true, responseTime);

      if (!data.results || data.results.length === 0) {
        // ENHANCED ERROR LOGGING: Show why no results were found
        console.error('❌ [GEOCODING-FAILURE] No geocoding results found');
        console.error(`   Address: "${address}"`);
        console.error(`   Possible reasons:`);
        console.error(`   - Address does not exist`);
        console.error(`   - Address format is invalid`);
        console.error(`   - Missing city/state/ZIP`);
        console.error(`   Full Geocodio Response:`, JSON.stringify(data, null, 2));
        
        // Log failed geocoding attempt
        await this.logGeocodingAttempt({
          requestedAddress: address,
          success: false,
          errorMessage: 'No geocoding results found',
          responseTimeMs: responseTime,
        });
        
        return {
          success: false,
          error: 'No geocoding results found'
        };
      }

      const result = data.results[0];
      
      // CRITICAL: Validate address accuracy to prevent fake addresses
      // Reject ZIP/city center matches - only accept real address coordinates
      const accuracyType = result.accuracy_type;
      const accuracyScore = result.accuracy;
      
      console.log('🔍 [GEOCODIO-VALIDATION] Address accuracy check:', {
        accuracy_type: accuracyType || 'UNKNOWN',
        accuracy_score: accuracyScore || 'UNKNOWN',
        address: address
      });
      
      // VALIDATION 1: Reject low-precision accuracy types
      // These indicate Geocodio only found ZIP/city center, not a real property
      const lowPrecisionTypes = ['place', 'city', 'zip', 'zip_center', 'state', 'county'];
      
      if (accuracyType && lowPrecisionTypes.includes(accuracyType.toLowerCase())) {
        console.error(`❌ [GEOCODING-FAILURE] Address validation FAILED`);
        console.error(`   Address: "${address}"`);
        console.error(`   Reason: Low precision match (${accuracyType}) - likely fake/non-existent address`);
        console.error(`   This typically means Geocodio only found ZIP/city center, not a real property`);
        
        // Log rejected geocoding (low precision)
        await this.logGeocodingAttempt({
          requestedAddress: address,
          success: false,
          errorMessage: `Low precision match: ${accuracyType}`,
          accuracyType: accuracyType,
          accuracyScore: accuracyScore,
          responseTimeMs: responseTime,
        });
        
        return {
          success: false,
          error: `Address validation failed: ${accuracyType} match only (not a real property address)`
        };
      }
      
      // VALIDATION 2: Reject low accuracy scores
      // Geocodio returns accuracy from 0.0 (no confidence) to 1.0 (perfect match)
      // USER REQUEST (Dec 10, 2025): Lowered from 0.8 to 0.7 to allow more deals to geocode
      // USER REQUEST (Dec 12, 2025): Accept 0.5+ for street_center type (new construction addresses)
      // street_center means Geocodio found the street and interpolated position - good for new developments
      const isStreetCenterType = accuracyType?.toLowerCase() === 'street_center';
      const MIN_ACCURACY_SCORE = isStreetCenterType ? 0.5 : 0.7;
      if (typeof accuracyScore === 'number' && accuracyScore < MIN_ACCURACY_SCORE) {
        console.error(`❌ [GEOCODING-FAILURE] Accuracy score too low: ${accuracyScore} < ${MIN_ACCURACY_SCORE}`);
        console.error(`   Address: "${address}"`);
        console.error(`   Accuracy type: ${accuracyType || 'unknown'} (threshold: ${MIN_ACCURACY_SCORE})`);
        console.error(`   This geocoding result has low confidence and may be inaccurate`);
        
        // Log rejected geocoding (low accuracy score)
        await this.logGeocodingAttempt({
          requestedAddress: address,
          success: false,
          errorMessage: `Low accuracy score: ${accuracyScore}`,
          accuracyType: accuracyType,
          accuracyScore: accuracyScore,
          rejectedLowAccuracy: true,
          responseTimeMs: responseTime,
        });
        
        return {
          success: false,
          error: `Low geocoding confidence (${(accuracyScore * 100).toFixed(0)}%) - address may not exist or is ambiguous`
        };
      }
      
      console.log(`✅ [GEOCODIO-VALIDATION] Address accuracy acceptable (${accuracyType || 'unknown'}, score: ${accuracyScore || 'N/A'})`);
      
      // CRITICAL FIX: Validate that geocoding result matches user's input city/state
      // If user says "SALISBURY, NC" but Geocodio returns "Wisconsin Rapids, WI", reject it!
      const userProvidedCity = this.extractCityFromAddress(address);
      const userProvidedState = this.extractStateFromAddress(address);
      const geocodedCity = result.address_components.city;
      const geocodedState = result.address_components.state;
      
      if (userProvidedState && geocodedState) {
        const stateMatch = userProvidedState.toUpperCase().trim() === geocodedState.toUpperCase().trim();
        
        if (!stateMatch) {
          console.error(`❌ [GEOCODING-FAILURE] State mismatch detected!`);
          console.error(`   Address: "${address}"`);
          console.error(`   User provided: ${userProvidedState}`);
          console.error(`   Geocodio returned: ${geocodedState}`);
          console.error(`   REJECTING geocoding result - user needs to provide more info`);
          
          // Log rejected geocoding (state mismatch)
          await this.logGeocodingAttempt({
            requestedAddress: address,
            success: false,
            errorMessage: `State mismatch: user=${userProvidedState}, geocoded=${geocodedState}`,
            accuracyType: accuracyType,
            accuracyScore: accuracyScore,
            stateMismatch: true,
            latitude: result.location.lat,
            longitude: result.location.lng,
            city: geocodedCity,
            state: geocodedState,
            responseTimeMs: responseTime,
          });
          
          return {
            success: false,
            error: `Address not found in ${userProvidedState}. Please provide ZIP code for verification.`
          };
        }
        
        console.log(`✅ [GEOCODIO-VALIDATION] State match confirmed: ${userProvidedState} = ${geocodedState}`);
      }
      
      if (userProvidedCity && geocodedCity) {
        // Use NORMALIZED comparison to handle "St." vs "Saint", punctuation, etc.
        const normalizedUserCity = this.normalizeCityName(userProvidedCity);
        const normalizedGeocodedCity = this.normalizeCityName(geocodedCity);
        const cityMatch = normalizedUserCity === normalizedGeocodedCity;
        
        if (!cityMatch) {
          console.log(`⚠️ [GEOCODIO-VALIDATION] City mismatch detected!`);
          console.log(`   User provided: "${userProvidedCity}" (normalized: "${normalizedUserCity}")`);
          console.log(`   Geocodio returned: "${geocodedCity}" (normalized: "${normalizedGeocodedCity}")`);
          
          // SMART VALIDATION: Accept if we have reasonable confidence (good accuracy + state match)
          // Dec 15, 2025: Expanded to include street_center for neighboring city cases (e.g., Mount Juliet/Smyrna, TN)
          const acceptableAccuracyTypes = ['rooftop', 'rooftop_interpolated', 'range_interpolation', 'street_center'];
          const hasGoodAccuracy = acceptableAccuracyTypes.includes(accuracyType || '') || (accuracyScore || 0) >= 0.5;
          const stateMatches = userProvidedState && geocodedState &&
            userProvidedState.toUpperCase().trim() === geocodedState.toUpperCase().trim();
          
          // Check if ZIP code matches (if provided) - ZIP match is strong evidence of correct location
          const userZip = address.match(/\b(\d{5})\b/)?.[1];
          const geocodedZip = result.address_components?.zip;
          const zipMatches = userZip && geocodedZip && userZip === geocodedZip;
          
          const canAcceptCityMismatch = (hasGoodAccuracy && stateMatches) || zipMatches;
          
          if (canAcceptCityMismatch) {
            console.log(`✅ [GEOCODIO-VALIDATION] Acceptable confidence (${accuracyType}, score: ${accuracyScore}, state match: ${stateMatches}, ZIP match: ${zipMatches}) - ACCEPTING and auto-correcting city`);
            console.log(`   Auto-correcting user's city from "${userProvidedCity}" to "${geocodedCity}"`);
          } else {
            console.log(`   REJECTING geocoding result - insufficient confidence (accuracy: ${accuracyType}, score: ${accuracyScore}, state: ${stateMatches}, ZIP: ${zipMatches})`);
            
            // Log rejected geocoding (city mismatch)
            await this.logGeocodingAttempt({
              requestedAddress: address,
              success: false,
              errorMessage: `City mismatch: user=${userProvidedCity}, geocoded=${geocodedCity}`,
              accuracyType: accuracyType,
              accuracyScore: accuracyScore,
              cityMismatch: true,
              latitude: result.location.lat,
              longitude: result.location.lng,
              city: geocodedCity,
              state: geocodedState,
              responseTimeMs: responseTime,
            });
            
            return {
              success: false,
              error: `Address not found in ${userProvidedCity}. Please provide ZIP code for verification.`
            };
          }
        } else {
          console.log(`✅ [GEOCODIO-VALIDATION] City match confirmed: "${userProvidedCity}" = "${geocodedCity}"`);
        }
      }
      
      const census2020 = result.fields?.census?.['2020'];
      const census2010 = result.fields?.census?.['2010'];
      const census = census2020 || census2010;

      console.log('🔍 [GEOCODIO-DEBUG] Census data received:', {
        has2020: !!census2020,
        has2010: !!census2010,
        usingCensus: census2020 ? '2020' : census2010 ? '2010' : 'NONE',
        rawCensusData: JSON.stringify(census, null, 2)
      });

      if (!census) {
        console.log('⚠️ No census information found in geocoding result');
        return {
          success: false,
          error: 'No census information available'
        };
      }

      // CRITICAL FIX: Build full 11-digit FIPS code (state + county + tract)
      // QCT dataset uses 11-digit FIPS: SSCCCTTTTTT (2-digit state + 3-digit county + 6-digit tract)
      let fullFips = census.full_fips;
      
      console.log('🔍 [GEOCODIO-DEBUG] FIPS extraction:', {
        full_fips_raw: census.full_fips || 'NOT PROVIDED',
        state_fips: census.state_fips || 'NOT PROVIDED',
        county_fips: census.county_fips || 'NOT PROVIDED',
        tract_code: census.tract_code || 'NOT PROVIDED'
      });
      
      if (!fullFips && census.state_fips && census.county_fips && census.tract_code) {
        // Construct from parts if full_fips not provided.
        // IMPORTANT: Geocodio returns tract_code in human-readable format (e.g. "9711.00")
        // with a decimal point. Strip all non-digit characters before padding to 6 digits
        // so the resulting FIPS is 11 digits and matches the OZ/QCT datasets exactly.
        const stateFips = String(census.state_fips).replace(/\D/g, '').padStart(2, '0');
        const countyFips = String(census.county_fips).replace(/\D/g, '').padStart(3, '0');
        const tractCode = String(census.tract_code).replace(/\D/g, '').padStart(6, '0');
        fullFips = `${stateFips}${countyFips}${tractCode}`;
        console.log(`🔧 [GEOCODIO-DEBUG] Constructed full FIPS: ${fullFips} from parts`, {
          stateFips_padded: stateFips,
          countyFips_padded: countyFips,
          tractCode_padded: tractCode,
          combined: fullFips,
          length: fullFips.length
        });
      } else if (fullFips) {
        console.log(`✅ [GEOCODIO-DEBUG] Full FIPS provided directly: ${fullFips} (length: ${fullFips.length})`);
      }

      if (!fullFips) {
        console.log('⚠️ [GEOCODIO-DEBUG] Unable to determine full FIPS code - missing required fields');
        return {
          success: false,
          error: 'Unable to determine census tract FIPS code'
        };
      }

      // CRITICAL: Truncate to 11 digits for QCT matching
      // Geocodio sometimes returns 15-digit FIPS (with block group/block)
      // QCT datasets only use 11-digit FIPS (state+county+tract)
      if (fullFips.length > 11) {
        const originalFips = fullFips;
        fullFips = fullFips.substring(0, 11);
        console.log(`🔧 [GEOCODIO-DEBUG] Truncated FIPS from ${originalFips.length} to 11 digits:`, {
          original: originalFips,
          truncated: fullFips,
          removedDigits: originalFips.substring(11)
        });
      }

      // Format the address from components
      const components = result.address_components;
      const formattedAddress = [
        components.number,
        components.street,
        components.city,
        components.state,
        components.zip
      ].filter(Boolean).join(', ');

      // DEBUG (Dec 15, 2025): Log county extraction to diagnose MSA matching issues
      console.log(`✅ Geocoded successfully: ${formattedAddress}, Full FIPS: ${fullFips}, County: ${components.county || 'NOT FOUND'}`);

      // Log successful geocoding
      await this.logGeocodingAttempt({
        requestedAddress: address,
        success: true,
        accuracyType: accuracyType,
        accuracyScore: accuracyScore,
        latitude: result.location.lat,
        longitude: result.location.lng,
        city: components.city,
        state: components.state,
        zipCode: components.zip,
        county: components.county,
        formattedAddress,
        responseTimeMs: responseTime,
      });

      return {
        success: true,
        fips: fullFips,
        lat: result.location.lat,
        lng: result.location.lng,
        zipCode: components.zip,
        formattedAddress,
        county: components.county,
        state: components.state,
        city: components.city
      };

    } catch (error) {
      // ENHANCED ERROR LOGGING: Show detailed error context
      console.error('❌ [GEOCODING-FAILURE] Geocoding failed');
      console.error(`   Address: "${address}"`);
      console.error(`   Error Type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`   Error Message: ${error instanceof Error ? error.message : String(error)}`);
      
      if (error instanceof Error && error.stack) {
        console.error(`   Stack Trace:`, error.stack);
      }
      
      // Log to audit table
      await this.logGeocodingAttempt({
        requestedAddress: address,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTimeMs: Date.now() - Date.now(), // Will be near 0 if caught early
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Lenient geocoding for force-comparables (Dec 11, 2025)
   * Accepts lower accuracy scores (0.4) and skips city/state validation
   * Use when user explicitly requests a search despite potential inaccuracy
   */
  async geocodeAddressLenient(address: string): Promise<{
    success: boolean;
    lat?: number;
    lng?: number;
    zipCode?: string;
    formattedAddress?: string;
    county?: string;
    state?: string;
    city?: string;
    error?: string;
  }> {
    if (!this.apiKey) {
      return { success: false, error: 'Geocodio API key not configured' };
    }

    try {
      console.log(`🔍 [LENIENT] Geocoding address (lenient mode): ${address}`);
      
      const url = `${this.baseUrl}/geocode?q=${encodeURIComponent(address)}&api_key=${this.apiKey}`;
      const startTime = Date.now();
      
      const { response, data } = await retryWithBackoff(async () => {
        const res = await fetchWithTimeout(url, 15000);
        const jsonData: GeocodioResponse = await res.json();
        if (!res.ok) throw new Error(`Geocodio API error: ${res.status}`);
        return { response: res, data: jsonData };
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`📍 [API-TRACKER] Geocodio | geocode | ${responseTime}ms`);

      if (!data.results || data.results.length === 0) {
        console.log(`❌ [LENIENT] No geocoding results found`);
        return { success: false, error: 'No geocoding results found' };
      }

      const result = data.results[0];
      const accuracyType = result.accuracy_type;
      const accuracyScore = result.accuracy;
      
      console.log(`📊 [LENIENT] Accuracy: ${accuracyScore}, Type: ${accuracyType}`);
      
      // Lenient mode: Only reject place/city/zip center matches (too imprecise)
      // But accept street_center and low scores that standard mode would reject
      const tooImprecise = ['place', 'city', 'zip_center', 'state', 'county'];
      if (accuracyType && tooImprecise.includes(accuracyType.toLowerCase())) {
        console.log(`❌ [LENIENT] Too imprecise (${accuracyType}) - rejecting`);
        return { success: false, error: `Location too imprecise (${accuracyType})` };
      }
      
      // Accept anything with accuracy >= 0.4 in lenient mode
      const MIN_LENIENT_ACCURACY = 0.4;
      if (typeof accuracyScore === 'number' && accuracyScore < MIN_LENIENT_ACCURACY) {
        console.log(`❌ [LENIENT] Accuracy ${accuracyScore} below lenient minimum ${MIN_LENIENT_ACCURACY}`);
        return { success: false, error: `Accuracy too low (${(accuracyScore * 100).toFixed(0)}%)` };
      }
      
      const components = result.address_components;
      const formattedAddress = [
        components.number,
        components.street,
        components.city,
        components.state,
        components.zip
      ].filter(Boolean).join(', ');
      
      console.log(`✅ [LENIENT] Geocoded successfully: ${result.location.lat}, ${result.location.lng}`);
      
      return {
        success: true,
        lat: result.location.lat,
        lng: result.location.lng,
        zipCode: components.zip,
        formattedAddress,
        county: components.county,
        state: components.state,
        city: components.city
      };
    } catch (error) {
      console.error(`❌ [LENIENT] Geocoding failed:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getCensusTract(address: string): Promise<string | null> {
    const result = await this.geocodeAddress(address);
    return result.success && result.fips ? result.fips : null;
  }

  /**
   * Geocode at ZIP/city level for new construction or addresses not in database
   * ENHANCEMENT (Dec 11, 2025): For new construction where street address isn't in Geocodio,
   * fall back to geocoding just the ZIP code (preferred) or city/state to get approximate coordinates
   * ZIP center is typically within 1-2 miles; city center may be 1-5 miles off
   */
  async geocodeZipOrCityLevel(city: string, state: string, zip?: string): Promise<{
    success: boolean;
    error?: string;
    lat?: number;
    lng?: number;
    city?: string;
    state?: string;
    zipCode?: string;
    county?: string;
    isApproximate?: boolean;
  }> {
    if (!this.apiKey) {
      return { success: false, error: 'Geocodio API key not configured' };
    }

    try {
      // Build query - prioritize ZIP code for more precise location (1-2 miles vs 1-5 miles)
      const query = zip ? `${zip}` : `${city}, ${state}`;
      const locationType = zip ? 'ZIP center' : 'city center';
      console.log(`📍 [APPROX-GEOCODE] Geocoding to ${locationType}: ${query}`);
      
      const url = `${this.baseUrl}/geocode?q=${encodeURIComponent(query)}&api_key=${this.apiKey}`;
      
      const startTime = Date.now();
      const { data } = await retryWithBackoff(async () => {
        const res = await fetchWithTimeout(url, 10000);
        const jsonData: GeocodioResponse = await res.json();
        return { response: res, data: jsonData };
      });
      
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('Geocodio', 'city_level_geocode', true, responseTime);

      if (!data.results || data.results.length === 0) {
        console.log(`❌ [APPROX-GEOCODE] No results found for: ${query}`);
        return { success: false, error: zip ? 'ZIP code not found' : 'City not found' };
      }

      const result = data.results[0];
      const components = result.address_components;
      
      console.log(`✅ [APPROX-GEOCODE] Found ${locationType}: ${result.location.lat}, ${result.location.lng}`);
      
      return {
        success: true,
        lat: result.location.lat,
        lng: result.location.lng,
        city: components.city,
        state: components.state,
        zipCode: components.zip,
        county: components.county,
        isApproximate: true // Flag that this is approximate, not exact address
      };
    } catch (error) {
      console.error(`❌ [APPROX-GEOCODE] Geocoding failed:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Reverse geocode coordinates to get address components (county, state, city, etc.)
   * Dec 17, 2025: Added for deals submitted with coordinates instead of addresses
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<{
    success: boolean;
    county?: string;
    state?: string;
    city?: string;
    zipCode?: string;
    formattedAddress?: string;
    fips?: string;
    error?: string;
  }> {
    if (!this.apiKey) {
      return { success: false, error: 'Geocodio API key not configured' };
    }

    try {
      console.log(`🔄 [REVERSE-GEOCODE] Reverse geocoding coordinates: ${latitude}, ${longitude}`);
      
      // Geocodio reverse geocoding endpoint - pass coordinates and request census data for FIPS
      const url = `${this.baseUrl}/reverse?q=${latitude},${longitude}&fields=census2020&api_key=${this.apiKey}`;
      
      const startTime = Date.now();
      const { data } = await retryWithBackoff(async () => {
        const res = await fetchWithTimeout(url, 15000); // 15 second timeout
        const jsonData: GeocodioResponse = await res.json();
        
        if (!res.ok) {
          const responseTime = Date.now() - startTime;
          apiCallTracker.logCall('Geocodio', 'reverse_geocode', false, responseTime, {
            errorMessage: `${res.status}`
          });
          console.error('❌ [REVERSE-GEOCODE] Geocodio API error:', jsonData);
          throw new Error(`Geocodio API error: ${res.status}`);
        }
        
        return { response: res, data: jsonData };
      });
      
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('Geocodio', 'reverse_geocode', true, responseTime);

      if (!data.results || data.results.length === 0) {
        console.log(`⚠️ [REVERSE-GEOCODE] No results found for coordinates: ${latitude}, ${longitude}`);
        return { success: false, error: 'No reverse geocoding results found' };
      }

      const result = data.results[0];
      const components = result.address_components;
      const censusData = result.fields?.census?.['2020'];
      
      // Normalize county name - remove " County" suffix if present
      const county = components.county?.replace(/\s*County\s*$/i, '').trim();
      
      // Build formatted address from components
      const formattedAddress = [
        components.number,
        components.street,
        components.city,
        components.state,
        components.zip
      ].filter(Boolean).join(', ');
      
      console.log(`✅ [REVERSE-GEOCODE] Found: ${county} County, ${components.state} (${components.city})`);
      
      return {
        success: true,
        county: county,
        state: components.state,
        city: components.city,
        zipCode: components.zip,
        formattedAddress: formattedAddress || undefined,
        fips: censusData?.full_fips
      };
    } catch (error) {
      console.error('❌ [REVERSE-GEOCODE] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get 55+ demographics for Active Adult community analysis
   * Fetches ACS Census data and sums age brackets 55+
   * Also gets income data for $75k+ households
   */
  async getDemographics(address: string): Promise<DemographicsResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Geocodio API key not configured'
      };
    }

    try {
      console.log(`📊 [GEOCODIO-DEMOGRAPHICS] Fetching 55+ demographics for: ${address}`);
      
      // Request demographics and income data from ACS
      const url = `${this.baseUrl}/geocode?q=${encodeURIComponent(address)}&fields=acs-demographics,acs-income&api_key=${this.apiKey}`;
      
      const startTime = Date.now();
      const { response, data } = await retryWithBackoff(async () => {
        const res = await fetchWithTimeout(url, 15000); // 15 second timeout
        const jsonData: GeocodioResponse = await res.json();
        
        if (!res.ok) {
          const responseTime = Date.now() - startTime;
          apiCallTracker.logCall('Geocodio', 'demographics', false, responseTime, {
            errorMessage: `${res.status}`
          });
          console.error('❌ [GEOCODIO-DEMOGRAPHICS] API error:', res.status);
          throw new Error(`Geocodio API error: ${res.status}`);
        }
        
        return { response: res, data: jsonData };
      });
      
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('Geocodio', 'demographics', true, responseTime);

      if (!data.results || data.results.length === 0) {
        console.log('⚠️ [GEOCODIO-DEMOGRAPHICS] No results found');
        return {
          success: false,
          error: 'No geocoding results found'
        };
      }

      const result = data.results[0];
      const demographics = result.fields?.acs?.demographics;
      const income = result.fields?.acs?.income;
      
      // Dec 29, 2025: Log raw API response structure when debugging zero demographics
      console.log('🔍 [GEOCODIO-DEMOGRAPHICS-RAW] Full fields structure:', JSON.stringify(result.fields, null, 2));
      console.log('🔍 [GEOCODIO-DEMOGRAPHICS-RAW] Demographics object keys:', demographics ? Object.keys(demographics) : 'null');
      console.log('🔍 [GEOCODIO-DEMOGRAPHICS-RAW] Income object keys:', income ? Object.keys(income) : 'null');
      
      if (!demographics) {
        console.log('⚠️ [GEOCODIO-DEMOGRAPHICS] No demographic data available');
        console.log('🔍 [GEOCODIO-DEMOGRAPHICS-RAW] result.fields:', JSON.stringify(result.fields, null, 2));
        return {
          success: false,
          error: 'No demographic data available for this location'
        };
      }

      // Sum 55+ age brackets
      // Geocodio returns age brackets like: "55 - 59", "60 - 64", "65 - 69", etc.
      const ageData = demographics.Age || {};
      let population55Plus = 0;
      
      // Log raw age data structure to debug zero values
      console.log('🔍 [GEOCODIO-DEMOGRAPHICS-RAW] Raw Age data:', JSON.stringify(ageData, null, 2));
      
      // Age bracket keys that represent 55+ population
      const ageBrackets55Plus = [
        '55 - 59',
        '55 to 59',
        '60 - 64',
        '60 to 64',
        '65 - 69',
        '65 to 69',
        '70 - 74',
        '70 to 74',
        '75 - 79',
        '75 to 79',
        '80 - 84',
        '80 to 84',
        '85 and over',
        '85+'
      ];
      
      console.log('📊 [GEOCODIO-DEMOGRAPHICS] Age brackets found:', Object.keys(ageData));
      
      for (const [bracket, data] of Object.entries(ageData)) {
        // Check if this bracket is 55+
        const normalizedBracket = bracket.toLowerCase().replace(/\s+/g, ' ').trim();
        const is55Plus = ageBrackets55Plus.some(b => 
          normalizedBracket.includes(b.toLowerCase()) ||
          normalizedBracket.startsWith('55') ||
          normalizedBracket.startsWith('60') ||
          normalizedBracket.startsWith('65') ||
          normalizedBracket.startsWith('70') ||
          normalizedBracket.startsWith('75') ||
          normalizedBracket.startsWith('80') ||
          normalizedBracket.startsWith('85')
        );
        
        if (is55Plus && data?.value) {
          console.log(`   Adding ${bracket}: ${data.value}`);
          population55Plus += data.value;
        }
      }

      // Get total population and calculate percentage
      const totalPopulation = demographics.Total_population?.value || 0;
      const percentOver55 = totalPopulation > 0 
        ? Math.round((population55Plus / totalPopulation) * 100) 
        : 0;
      
      // Get median age
      const medianAge = demographics.Median_age?.value || null;

      // Sum income brackets $75k+
      const incomeData = income?.Household_income || {};
      let income75kPlus = 0;
      
      // Log raw income data structure to debug zero values
      console.log('🔍 [GEOCODIO-DEMOGRAPHICS-RAW] Raw Income object:', JSON.stringify(income, null, 2));
      console.log('🔍 [GEOCODIO-DEMOGRAPHICS-RAW] Raw Household_income data:', JSON.stringify(incomeData, null, 2));
      console.log('📊 [GEOCODIO-DEMOGRAPHICS] Income brackets found:', Object.keys(incomeData));
      
      for (const [bracket, data] of Object.entries(incomeData)) {
        // Check if this is a $75k+ income bracket
        const normalizedBracket = bracket.toLowerCase();
        const is75kPlus = 
          normalizedBracket.includes('75,000') ||
          normalizedBracket.includes('75000') ||
          normalizedBracket.includes('100,000') ||
          normalizedBracket.includes('100000') ||
          normalizedBracket.includes('125,000') ||
          normalizedBracket.includes('125000') ||
          normalizedBracket.includes('150,000') ||
          normalizedBracket.includes('150000') ||
          normalizedBracket.includes('200,000') ||
          normalizedBracket.includes('200000') ||
          normalizedBracket.includes('or more');
        
        if (is75kPlus && data?.value) {
          console.log(`   Adding income bracket ${bracket}: ${data.value}`);
          income75kPlus += data.value;
        }
      }

      const medianHouseholdIncome = income?.Median_household_income?.value || null;

      console.log(`✅ [GEOCODIO-DEMOGRAPHICS] Results for ${address}:`);
      console.log(`   Population 55+: ${population55Plus.toLocaleString()}`);
      console.log(`   Total Population: ${totalPopulation.toLocaleString()}`);
      console.log(`   Percent 55+: ${percentOver55}%`);
      console.log(`   Median Age: ${medianAge || 'N/A'}`);
      console.log(`   Households $75k+: ${income75kPlus.toLocaleString()}`);
      console.log(`   Median Household Income: $${medianHouseholdIncome?.toLocaleString() || 'N/A'}`);

      return {
        success: true,
        population55Plus,
        totalPopulation,
        percentOver55,
        medianAge: medianAge || undefined,
        income75kPlus,
        medianHouseholdIncome: medianHouseholdIncome || undefined
      };

    } catch (error) {
      console.error('❌ [GEOCODIO-DEMOGRAPHICS] Error fetching demographics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Simple geocoding that only requires coordinates (no census data)
   * Used for bulk geocoding existing deals where we just need lat/lng for map display
   */
  async getCoordinates(address: string): Promise<{
    success: boolean;
    lat?: number;
    lng?: number;
    formattedAddress?: string;
    error?: string;
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Geocodio API key not configured'
      };
    }

    try {
      console.log(`🔍 Getting coordinates for: ${address}`);
      
      // Simple geocode without census fields
      const url = `${this.baseUrl}/geocode?q=${encodeURIComponent(address)}&api_key=${this.apiKey}`;
      
      const startTime = Date.now();
      const { response, data } = await retryWithBackoff(async () => {
        const res = await fetchWithTimeout(url, 15000); // 15 second timeout
        const jsonData: GeocodioResponse = await res.json();
        
        if (!res.ok) {
          const responseTime = Date.now() - startTime;
          apiCallTracker.logCall('Geocodio', 'geocode', false, responseTime, {
            errorMessage: `${res.status}`
          });
          console.error('❌ Geocodio API error:', jsonData);
          throw new Error(`Geocodio API error: ${res.status}`);
        }
        
        return { response: res, data: jsonData };
      });
      
      const responseTime = Date.now() - startTime;
      apiCallTracker.logCall('Geocodio', 'geocode', true, responseTime);

      if (!data.results || data.results.length === 0) {
        console.log('⚠️ No geocoding results found');
        return {
          success: false,
          error: 'No geocoding results found'
        };
      }

      const result = data.results[0];
      const components = result.address_components;
      const formattedAddress = [
        components.number,
        components.street,
        components.city,
        components.state,
        components.zip
      ].filter(Boolean).join(', ');

      console.log(`✅ Coordinates retrieved: ${result.location.lat}, ${result.location.lng}`);

      return {
        success: true,
        lat: result.location.lat,
        lng: result.location.lng,
        formattedAddress
      };

    } catch (error) {
      console.error('❌ Error getting coordinates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get normalized address components for location validation
   */
  async getAddressComponents(address: string): Promise<{
    success: boolean;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    number?: string;
    street?: string;
    error?: string;
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Geocodio API key not configured'
      };
    }

    try {
      console.log(`🔍 [GEOCODIO] Getting address components for: ${address}`);
      
      const url = `${this.baseUrl}/geocode?q=${encodeURIComponent(address)}&api_key=${this.apiKey}`;
      
      // Use retry logic with 15-second timeout for address components API call
      const data = await retryWithBackoff(async () => {
        const response = await fetchWithTimeout(url, 15000); // 15 second timeout
        const jsonData: GeocodioResponse = await response.json();

        if (!response.ok || !jsonData.results || jsonData.results.length === 0) {
          throw new Error('Failed to geocode address');
        }
        
        return jsonData;
      });

      if (!data.results || data.results.length === 0) {
        return {
          success: false,
          error: 'No results returned from geocoding'
        };
      }

      const components = data.results[0].address_components;
      console.log(`✅ [GEOCODIO] Address components: ${components.city}, ${components.state} ${components.zip}, ${components.county}`);

      return {
        success: true,
        city: components.city,
        state: components.state,
        zip: components.zip,
        county: components.county,
        number: components.number,
        street: components.street
      };
    } catch (error) {
      console.error('❌ [GEOCODIO] Error getting address components:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * US State name to abbreviation mapping
   * CRITICAL: Includes DC variants BEFORE "washington" to prevent WA mismatch
   */
  private readonly STATE_MAPPINGS: Record<string, string> = {
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
    'wisconsin': 'WI', 'wyoming': 'WY',
    // DC variants - must be checked BEFORE "washington"
    'washington dc': 'DC', 'washington, dc': 'DC', 'district of columbia': 'DC', 'dc': 'DC'
  };

  /**
   * Pre-computed sorted states list (longest first) to avoid re-sorting per iteration
   */
  private readonly SORTED_STATES = Object.entries({
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
    'wisconsin': 'WI', 'wyoming': 'WY',
    'washington dc': 'DC', 'washington, dc': 'DC', 'district of columbia': 'DC', 'dc': 'DC'
  }).sort((a, b) => b[0].length - a[0].length);

  /**
   * Aggressively normalize token - strip punctuation, country codes, noise
   */
  private normalizeStateToken(token: string): string {
    return token
      .toLowerCase()
      .replace(/\s+\d{5}(-\d{4})?/, '') // Remove ZIP codes
      .replace(/\b(usa|united states|us|u\.s\.|u\.s\.a\.)\b/gi, '') // Remove country
      .replace(/[()\/\-–—\[\]{}]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract state from address string (ULTRA-ROBUST VERSION)
   * Walks BACKWARDS through comma-separated parts until valid state found
   * Handles: abbreviations, spelled-out names, appended country codes, all punctuation noise
   * 
   * Expected formats: 
   * - "123 Main St, Charlotte, NC"
   * - "123 Main St, Charlotte, NC 28202"
   * - "123 Main St, Suite 100, Charlotte, NC"
   * - "123 Main St, Charlotte, North Carolina"
   * - "1600 Pennsylvania Ave NW, Washington, DC, USA" (skips "USA")
   * - "Springfield, Illinois (USA)" (strips parentheses)
   * - "Las Cruces, New Mexico/USA" (strips slash + USA)
   */
  private extractStateFromAddress(address: string): string | null {
    const parts = address.split(',').map(p => p.trim());
    
    if (parts.length === 0) return null;
    
    const validCodes = Object.values(this.STATE_MAPPINGS);
    
    // Walk BACKWARDS through parts until we find a valid state
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      
      // Try to extract 2-letter state code FIRST (most common)
      const stateAbbrevMatch = part.match(/\b([A-Z]{2})\b/i);
      if (stateAbbrevMatch) {
        const code = stateAbbrevMatch[1].toUpperCase();
        if (validCodes.includes(code)) {
          return code;
        }
      }
      
      // Normalize token aggressively
      const normalized = this.normalizeStateToken(part);
      
      if (!normalized) continue; // Skip empty tokens
      
      // EXACT match against STATE_MAPPINGS
      if (this.STATE_MAPPINGS[normalized]) {
        return this.STATE_MAPPINGS[normalized];
      }
      
      // Partial match with LONGEST names first (pre-sorted)
      for (const [stateName, stateCode] of this.SORTED_STATES) {
        if (normalized.includes(stateName)) {
          return stateCode;
        }
      }
    }
    
    return null;
  }

  /**
   * Check if a string looks like a full street address (not a city name)
   * Returns true if it contains street number + street suffix patterns
   */
  private looksLikeFullAddress(candidate: string): boolean {
    const lower = candidate.toLowerCase().trim();
    
    // Common street suffixes
    const streetSuffixes = [
      'street', 'st', 'avenue', 'ave', 'boulevard', 'blvd', 'drive', 'dr',
      'road', 'rd', 'lane', 'ln', 'way', 'court', 'ct', 'circle', 'cir',
      'place', 'pl', 'terrace', 'ter', 'highway', 'hwy', 'parkway', 'pkwy',
      'trail', 'trl', 'path', 'loop', 'run', 'crossing', 'xing', 'pike'
    ];
    
    // Check if starts with a number (street number) AND contains a street suffix
    const startsWithNumber = /^\d+/.test(lower);
    const hasStreetSuffix = streetSuffixes.some(suffix => {
      // Match suffix as a word boundary (not part of another word)
      const regex = new RegExp(`\\b${suffix}\\b`);
      return regex.test(lower);
    });
    
    return startsWithNumber && hasStreetSuffix;
  }

  /**
   * Extract city from address string (ROBUST VERSION)
   * Parse from END, skip state/ZIP, ignore suite/apartment tokens
   * Expected formats: 
   * - "123 Main St, Charlotte, NC" → "Charlotte"
   * - "123 Main St, Suite 100, Charlotte, NC" → "Charlotte"
   * - "123 Main St, Apt 5B, Charlotte, NC 28202" → "Charlotte"
   * - "21993 crested quail dr ASHBURN VIRGINIA 20148, VA" → null (no proper city separation)
   */
  private extractCityFromAddress(address: string): string | null {
    const parts = address.split(',').map(p => p.trim());
    
    if (parts.length < 2) return null;
    
    // Suite/apartment/building keywords to skip
    const skipTokens = ['suite', 'ste', 'apt', 'apartment', 'unit', 'building', 'bldg', 'floor', 'fl', 'room'];
    
    // Valid state codes to skip (Dec 11, 2025: Fix bug where state was being returned as city)
    const stateCodes = Object.values(this.STATE_MAPPINGS);
    
    // Walk backwards from second-to-last part (skip state/ZIP)
    // Find first part that's NOT a suite/apartment/building/state
    for (let i = parts.length - 2; i >= 1; i--) {
      const part = parts[i].toLowerCase();
      const partUpper = parts[i].toUpperCase().trim();
      
      // Skip if this looks like a suite/apartment designation
      const isSkippable = skipTokens.some(token => part.includes(token));
      if (isSkippable) continue;
      
      // Skip if this is just a number (likely suite/apt number)
      if (/^\d+[a-z]?$/.test(part.trim())) continue;
      
      // Skip if this looks like a full address (not a city)
      if (this.looksLikeFullAddress(parts[i])) continue;
      
      // Dec 11, 2025: Skip if this is a 2-letter state code (e.g., "NC", "TX", "CA")
      // This prevents returning state as city when address is "Street, City, State, ZIP"
      if (partUpper.length === 2 && stateCodes.includes(partUpper)) continue;
      
      // This looks like a city name
      return parts[i];
    }
    
    // Fallback: if we couldn't find a city by skipping tokens,
    // check the second-to-last part - but ONLY if it doesn't look like a full address
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2];
      // Don't return if it looks like a full street address
      if (!this.looksLikeFullAddress(candidate)) {
        return candidate;
      }
    }
    
    return null;
  }
  
  /**
   * Normalize city name for comparison
   * Handles common variations like "St." vs "Saint", punctuation, case
   */
  private normalizeCityName(city: string): string {
    return city
      .toLowerCase()
      .trim()
      // Remove punctuation
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      // Normalize Saint/St
      .replace(/\bst\b/g, 'saint')
      .replace(/\bste\b/g, 'sainte')
      // Normalize Fort/Ft
      .replace(/\bft\b/g, 'fort')
      // Normalize Mount/Mt
      .replace(/\bmt\b/g, 'mount')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const geocodioService = new GeocodioService();

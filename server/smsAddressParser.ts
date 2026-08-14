import { geocodioService } from './geocodioService';

export interface ParsedSMSAddress {
  street: string;
  city: string;
  state: string;
  zip?: string;
  parseMethod: 'deterministic' | 'ai_fallback';
  validationStatus?: 'geocode_confirmed' | 'geocode_mismatch' | 'skipped';
  fallbackReason?: string;
}

interface CanonicalizedSMS {
  text: string;
  hasAddressPattern: boolean;
}

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]);

const CONVERSATIONAL_STOP_PHRASES = new Set([
  'please', 'call', 'text', 'email', 'contact', 'asap', 'urgent',
  'info', 'help', 'need', 'want', 'thanks', 'hello', 'hi', 'yes',
  'no', 'follow', 'let', 'me', 'know', 'soon', 'update', 'get',
  'back', 'reach', 'out', 'send', 'give', 'interested', 'available'
]);

export function canonicalizeSMS(rawText: string): CanonicalizedSMS {
  let text = rawText.trim();
  
  // CRITICAL: Normalize line endings BUT PRESERVE newlines for multi-line detection
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Search ALL lines for address pattern (brokers often send address on line 2+)
  // Example: "Here's a property:\n816 HOWELL MILL ROAD, WAYNESVILLE, NC"
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // CRITICAL FIX (Nov 21, 2025): Handle concatenated street+city (no space between)
  // Example: "4300 Monroe RdCharlotte, NC" → "4300 Monroe Rd Charlotte, NC"
  // Handles multi-word cities: "RdSt Louis" → "Rd St Louis"
  // Avoids breaking directionals: "RdNW" stays "RdNW" (uppercase letters)
  const streetSuffixes = [
    'Street', 'St', 'Road', 'Rd', 'Avenue', 'Ave', 'Drive', 'Dr', 'Lane', 'Ln',
    'Court', 'Ct', 'Circle', 'Cir', 'Boulevard', 'Blvd', 'Parkway', 'Pkwy',
    'Highway', 'Hwy', 'Place', 'Pl', 'Way', 'Cove',
    // Lowercase variations for case-insensitive matching
    'street', 'st', 'road', 'rd', 'avenue', 'ave', 'drive', 'dr', 'lane', 'ln',
    'court', 'ct', 'circle', 'cir', 'boulevard', 'blvd', 'parkway', 'pkwy',
    'highway', 'hwy', 'place', 'pl', 'way', 'cove',
    // Uppercase variations for all-caps messages
    'STREET', 'ST', 'ROAD', 'RD', 'AVENUE', 'AVE', 'DRIVE', 'DR', 'LANE', 'LN',
    'COURT', 'CT', 'CIRCLE', 'CIR', 'BOULEVARD', 'BLVD', 'PARKWAY', 'PKWY',
    'HIGHWAY', 'HWY', 'PLACE', 'PL', 'WAY', 'COVE'
  ];
  
  // Build lookahead regex to insert comma after street suffix before city name
  // CRITICAL: Handle both spaced ("ct broomfield") and concatenated ("RdCharlotte") cases
  // Pattern: \b(suffix)(?=\s|[A-Z]) 
  // Matches: suffix followed by whitespace OR uppercase letter (new word start)
  // Rejects: "Courtland" → "Court" because "l" is lowercase (not whitespace, not uppercase)
  // Known limitation: Directionals (NW, NE, etc.) require explicit commas for complex cases
  // NO 'i' flag to prevent [A-Z] from matching lowercase letters
  const suffixPattern = new RegExp(
    `\\b(${streetSuffixes.join('|')})(?=\\s|[A-Z])`,
    'g'
  );
  
  const processedLines = lines.map(line => {
    let processed = line;
    
    // Pass 1: Insert comma+space after known street suffixes when followed by city name
    // Example: "4300 Monroe RdCharlotte, NC" → "4300 Monroe Rd, Charlotte, NC"
    // Also handles: "12780 julian ct broomfield co" → "12780 julian ct, broomfield co"
    const afterSuffixFix = processed.replace(suffixPattern, '$1, ');
    if (processed !== afterSuffixFix) {
      console.log(`🔧 [SUFFIX-FIX] Split street+city: "${processed}" → "${afterSuffixFix}"`);
      processed = afterSuffixFix;
    }
    
    // Pass 2: Smart city/state separation - insert comma before state abbreviation
    // CRITICAL (Nov 21, 2025): Handle both capitalized and lowercase city names
    // Only match at END of string to avoid treating street suffixes as states
    // Examples:
    //   "12780 julian ct, broomfield co" → "12780 julian ct, broomfield, co"
    //   "123 Main St, Charlotte NC" → "123 Main St, Charlotte, NC"
    //   "456 Oak Ave Dallas TX" → "456 Oak Ave, Dallas, TX"
    const stateSeparatorPattern = /\b([a-z]+)\s+([a-z]{2})(?:\s*$)/gi;
    const afterStateFix = processed.replace(stateSeparatorPattern, (match, city, state) => {
      // Only insert comma if state is a valid US state abbreviation
      // EXCLUDE street suffixes to prevent "julian ct" → "julian, ct"
      const stateUpper = state.toUpperCase();
      const isSuffix = streetSuffixes.some(suffix => suffix.toUpperCase() === stateUpper);
      
      if (US_STATES.has(stateUpper) && !isSuffix) {
        return `${city}, ${state}`;
      }
      return match; // No change if not a state or if it's a street suffix
    });
    if (processed !== afterStateFix) {
      console.log(`🔧 [STATE-SEPARATOR-FIX] Split city/state: "${processed}" → "${afterStateFix}"`);
      processed = afterStateFix;
    }
    
    if (line !== processed) {
      console.log(`✅ [CANONICALIZATION] Final: "${line}" → "${processed}"`);
    }
    
    return processed;
  });
  
  // CASE-INSENSITIVE: Accept both "NC" and "nc" from Twilio (use /i flag)
  // FLEXIBLE: Accept both "street, city, STATE" AND "street, city STATE" (comma before state is optional)
  const addressPattern = /^\d+\s+[^,]+,\s*[^,]+,?\s*[A-Z]{2}/i;
  
  // CRITICAL FIX (Nov 21, 2025): Handle multi-line addresses
  // When brokers send address across two lines like:
  //   "6115 Holly Springs Rd"
  //   "Raleigh, NC 27606"
  // We need to join them before pattern matching
  
  // Strategy 1: Find first line that matches complete address pattern
  const addressLine = processedLines.find(line => addressPattern.test(line));
  
  if (addressLine) {
    // Found complete address on a single line
    let normalizedLine = addressLine.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ');
    console.log(`📍 [CANONICALIZE] Found complete address on line ${processedLines.indexOf(addressLine) + 1}: "${normalizedLine}"`);
    return {
      text: normalizedLine,
      hasAddressPattern: true
    };
  }
  
  // Strategy 2: Try joining first two lines (common pattern: street on line 1, city/state on line 2)
  if (processedLines.length >= 2) {
    const joinedAddress = `${processedLines[0]} ${processedLines[1]}`;
    const normalizedJoined = joinedAddress.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ');
    
    if (addressPattern.test(normalizedJoined)) {
      console.log(`📍 [CANONICALIZE-MULTILINE] Joined lines 1-2 to form complete address: "${normalizedJoined}"`);
      return {
        text: normalizedJoined,
        hasAddressPattern: true
      };
    }
  }
  
  // Strategy 3: Try joining all lines (handles cases with extra spacing)
  if (processedLines.length > 1) {
    const allJoined = processedLines.join(' ');
    const normalizedAll = allJoined.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ');
    
    if (addressPattern.test(normalizedAll)) {
      console.log(`📍 [CANONICALIZE-MULTILINE] Joined all ${processedLines.length} lines to form complete address: "${normalizedAll}"`);
      return {
        text: normalizedAll,
        hasAddressPattern: true
      };
    }
  }
  
  // Fallback: Use first line if no address pattern found
  const firstLine = processedLines[0] || text;
  const normalizedFirstLine = firstLine.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ');
  const hasAddressPattern = addressPattern.test(normalizedFirstLine);
  
  console.log(`⚠️ [CANONICALIZE-FALLBACK] No complete address pattern found, using first line: "${normalizedFirstLine}"`);
  
  return {
    text: normalizedFirstLine,
    hasAddressPattern
  };
}

export function parseStrictSingleLine(text: string): ParsedSMSAddress | null {
  // CRITICAL FIX: Anchored regex prevents backtracking into city name
  // REQUIRES actual delimiter (comma+space OR space) before state to prevent "WAYNESVILLE" → "LE" extraction
  // Accepts both "street, city, STATE ZIP" AND "street, city STATE ZIP"
  const pattern = /^(\d+\s+[^,]+?),\s*([^,]+?)(?:,\s*|\s+)([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?\s*$/i;
  const match = text.match(pattern);
  
  if (!match) {
    return null;
  }
  
  const [, rawStreet, rawCity, state, zip] = match;
  const street = rawStreet.trim();
  const city = rawCity.trim();
  
  if (!street || street.length < 3 || !/^\d/.test(street)) {
    console.log('❌ [SMS-PARSE] Street validation failed - must start with number and be 3+ chars');
    return null;
  }
  
  if (!city || city.length < 2 || city.length > 50) {
    console.log('❌ [SMS-PARSE] City validation failed - must be 2-50 chars');
    return null;
  }
  
  if (!US_STATES.has(state.toUpperCase())) {
    console.log(`❌ [SMS-PARSE] Invalid state code: ${state}`);
    return null;
  }
  
  const cityWords = city.toLowerCase().split(/\s+/);
  const hasStopPhrase = cityWords.some(word => CONVERSATIONAL_STOP_PHRASES.has(word));
  
  if (hasStopPhrase) {
    console.log(`❌ [SMS-PARSE] City contains conversational stop phrase: "${city}"`);
    return null;
  }
  
  if (!/^[A-Za-z\s.'\-()]+$/.test(city)) {
    console.log(`❌ [SMS-PARSE] City contains invalid characters: "${city}"`);
    return null;
  }
  
  console.log('✅ [SMS-PARSE] Strict single-line parse successful');
  console.log(`   Street: "${street}"`);
  console.log(`   City: "${city}"`);
  console.log(`   State: "${state}"`);
  if (zip) console.log(`   ZIP: "${zip}"`);
  
  return {
    street,
    city,
    state: state.toUpperCase(),
    zip,
    parseMethod: 'deterministic',
    validationStatus: 'skipped'
  };
}

export async function geocodeConfirmation(parsed: ParsedSMSAddress): Promise<boolean> {
  try {
    const fullAddress = `${parsed.street}, ${parsed.city}, ${parsed.state}${parsed.zip ? ' ' + parsed.zip : ''}`;
    
    console.log(`🔍 [GEOCODE-CONFIRM] Validating: "${fullAddress}"`);
    
    const geocodeResult = await geocodioService.geocodeAddress(fullAddress);
    
    if (!geocodeResult) {
      console.log('❌ [GEOCODE-CONFIRM] Geocoding failed - no result returned');
      parsed.validationStatus = 'geocode_mismatch';
      parsed.fallbackReason = 'geocoding_failed';
      return false;
    }
    
    // CRITICAL: Guard against missing city/state from Geocodio (common on failures)
    const geocodedCity = geocodeResult.city ? geocodeResult.city.toLowerCase().trim() : undefined;
    const geocodedState = geocodeResult.state ? geocodeResult.state.toUpperCase().trim() : undefined;
    const parsedCity = parsed.city.toLowerCase().trim();
    const parsedState = parsed.state.toUpperCase().trim();
    
    // If Geocodio didn't return city or state, reject and fall back to AI
    if (!geocodedCity || !geocodedState) {
      console.log('❌ [GEOCODE-CONFIRM] Geocodio returned incomplete data - falling back to AI');
      parsed.validationStatus = 'geocode_mismatch';
      parsed.fallbackReason = 'geocoding_incomplete_data';
      return false;
    }
    
    console.log(`   Geocoded: ${geocodedCity}, ${geocodedState}`);
    console.log(`   Parsed:   ${parsedCity}, ${parsedState}`);
    
    // GEOCODE VALIDATION & CORRECTION STRATEGY:
    // (1) State MUST match - reject if different state
    // (2) If city differs, TRUST Geocodio and UPDATE parsed data with correct city
    // Rationale: Geocodio's geocoded result is authoritative - it provides the ACTUAL
    // municipality for the address (e.g., "Pineville" for "123 Main St, Charlotte, NC")
    
    const stateMatches = geocodedState === parsedState;
    
    if (!stateMatches) {
      console.log('❌ [GEOCODE-CONFIRM] State mismatch - falling back to AI');
      console.log(`   Expected: ${parsedState}, Got: ${geocodedState}`);
      parsed.validationStatus = 'geocode_mismatch';
      parsed.fallbackReason = `state_mismatch_expected_${parsedState}_got_${geocodedState}`;
      return false;
    }
    
    // CRITICAL FIX (Nov 21, 2025): REJECT geocoding when city doesn't match broker's value
    // The broker knows the actual location - if Geocodio returns different city, it geocoded WRONG
    // Example: "6115 Holly Springs Rd Raleigh" → Geocodio returns "Charlotte" → REJECT & use AI
    // Rationale: Wrong city means wrong coordinates - can't trust any part of Geocodio's result
    if (geocodedCity !== parsedCity && geocodeResult.city) {
      console.log(`❌ [GEOCODE-MISMATCH] City mismatch - rejecting Geocodio result and falling back to AI`);
      console.log(`   Broker provided: "${parsedCity}" (CORRECT)`);
      console.log(`   Geocodio result: "${geocodedCity}" (WRONG - geocoded to wrong place)`);
      console.log(`   Action: REJECT coordinates and fall back to AI for proper geocoding`);
      parsed.validationStatus = 'geocode_mismatch';
      parsed.fallbackReason = `city_mismatch_broker_${parsedCity}_geocodio_${geocodedCity}`;
      return false; // Trigger AI fallback to get correct coordinates for broker's city
    }
    
    // Also update ZIP if Geocodio provided one and we don't have it
    if (geocodeResult.zipCode && !parsed.zip) {
      console.log(`📍 [GEOCODE-ENRICHMENT] Adding ZIP code from Geocodio: ${geocodeResult.zipCode}`);
      parsed.zip = geocodeResult.zipCode;
    }
    
    console.log('✅ [GEOCODE-CONFIRM] Validation passed (state match + data corrected) - CONFIRMED');
    parsed.validationStatus = 'geocode_confirmed';
    return true;
    
  } catch (error) {
    console.error('❌ [GEOCODE-CONFIRM] Error during geocoding:', error);
    parsed.validationStatus = 'geocode_mismatch';
    parsed.fallbackReason = 'geocoding_error';
    return false;
  }
}

export async function parseOrFallback(rawText: string): Promise<ParsedSMSAddress | null> {
  console.log('\n========== SMS ADDRESS PARSER ==========');
  console.log(`Raw input: "${rawText}"`);
  
  const canonical = canonicalizeSMS(rawText);
  
  if (!canonical.hasAddressPattern) {
    console.log('❌ [SMS-PARSE] No address pattern detected - will fall back to AI with no hints');
    return {
      street: '',
      city: '',
      state: '',
      parseMethod: 'ai_fallback',
      fallbackReason: 'no_address_pattern'
    };
  }
  
  const parsed = parseStrictSingleLine(canonical.text);
  
  if (!parsed) {
    console.log('❌ [SMS-PARSE] Strict parsing failed - will fall back to AI');
    return {
      street: '',
      city: '',
      state: '',
      parseMethod: 'ai_fallback',
      fallbackReason: 'strict_parse_failed'
    };
  }
  
  const confirmed = await geocodeConfirmation(parsed);
  
  if (!confirmed) {
    console.log('❌ [SMS-PARSE] Geocode confirmation failed - will fall back to AI');
    console.log(`🔄 [BUG1-FIX] Preserving deterministic data for AI merge: street="${parsed.street}", city="${parsed.city}", state="${parsed.state}"`);
    return {
      street: parsed.street,  // ✅ PRESERVE deterministic data for AI to merge
      city: parsed.city,      // ✅ PRESERVE deterministic data for AI to merge
      state: parsed.state,    // ✅ PRESERVE deterministic data for AI to merge
      zip: parsed.zip,        // ✅ PRESERVE deterministic data for AI to merge
      parseMethod: 'ai_fallback',
      fallbackReason: parsed.fallbackReason || 'geocode_validation_failed'
    };
  }
  
  console.log('🎉 [SMS-PARSE] DETERMINISTIC PARSE SUCCESSFUL - skipping AI');
  console.log('=========================================\n');
  
  return parsed;
}

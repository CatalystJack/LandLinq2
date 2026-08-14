/**
 * Address Field Normalizer
 * Converts empty strings to undefined for address components (city, state, ZIP)
 * 
 * CRITICAL FIX: Prevents empty strings from being stored in database
 * Empty strings pass truthy checks but cause geocoding/validation failures
 * 
 * Example:
 *   dealData.city = '' → undefined (missing)
 *   dealData.city = 'Charlotte' → 'Charlotte' (valid)
 *   dealData.city = null → undefined (normalized)
 */

export interface AddressData {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  zipCode?: string | null; // Handle both field names
}

/**
 * Normalize address fields: convert empty/whitespace-only strings to undefined
 * This ensures downstream code can reliably detect missing values
 */
export function normalizeAddressFields<T extends AddressData>(data: T): T {
  const normalized = { ...data };

  // Helper: convert empty/whitespace strings to undefined
  const cleanField = (value: string | null | undefined): string | undefined => {
    if (!value || typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  // Normalize each address component
  normalized.address = cleanField(data.address) as any;
  normalized.city = cleanField(data.city) as any;
  normalized.state = cleanField(data.state) as any;
  
  // Handle both zip field names
  if ('zipCode' in data) {
    normalized.zipCode = cleanField(data.zipCode) as any;
  }
  if ('zip' in data) {
    normalized.zip = cleanField(data.zip) as any;
  }

  return normalized;
}

/**
 * CRITICAL FIX (Nov 21, 2025): Remove duplicate city/state/zip tokens from address field
 * 
 * Production Issue: Regex fallback parser (when OPENAI_API_KEY is missing) returns full
 * "street, city, state" in address field, causing duplication when formatFullAddress() runs.
 * 
 * Examples:
 *   address="8 6106 Burlington Rd Gibsonville", city="Gibsonville", state="NC"
 *   → cleanAddress="6106 Burlington Rd" (removed "8" prefix, "Gibsonville" duplicate)
 * 
 *   address="4200 Monroe Road Charlotte nc", city="Charlotte", state="NC"  
 *   → cleanAddress="4200 Monroe Road" (removed "Charlotte" and "nc" duplicates)
 * 
 * This function:
 * 1. Removes numeric list prefixes (1, 2, 8, 1., 2), etc.)
 * 2. Removes city/state/zip tokens if they appear in address field
 */
export function stripDuplicateAddressTokens(data: AddressData): AddressData {
  if (!data.address || typeof data.address !== 'string') {
    return data;
  }

  let cleanedAddress = data.address.trim();
  const originalAddress = cleanedAddress;

  console.log('🧹 [ADDRESS-DEDUP] Starting duplicate token removal...');
  console.log(`   Original: "${originalAddress}"`);

  // STEP 1: Remove numeric list prefixes (e.g., "8 6106 Burlington Rd" → "6106 Burlington Rd")
  // Match patterns: "8 ", "1. ", "2) ", etc. at the START of the address
  const listPrefixPattern = /^(\d+[\.\)]\s+|\d+\s+)/;
  const listPrefixMatch = cleanedAddress.match(listPrefixPattern);
  if (listPrefixMatch) {
    // SAFETY CHECK: Only remove if remaining text still looks like an address
    const withoutPrefix = cleanedAddress.replace(listPrefixPattern, '').trim();
    
    // Only strip prefix if result still has at least 2 tokens (e.g., "6106 Burlington")
    const tokens = withoutPrefix.split(/\s+/);
    if (tokens.length >= 2) {
      cleanedAddress = withoutPrefix;
      console.log(`   ✂️ Removed list prefix: "${listPrefixMatch[0].trim()}" → "${cleanedAddress}"`);
    }
  }

  // STEP 2: Remove ALL trailing city/state/zip tokens from address field
  // CRITICAL FIX (Nov 22, 2025): Remove ALL city/state/zip from address field to prevent duplicates
  // 
  // Address field should contain ONLY street address: "6106 Burlington Rd"
  // City/state/zip stored in separate fields are combined by formatFullAddress()
  // 
  // Previous bug: Keeping one set caused duplicates like:
  //   address="6106 Burlington Rd Gibsonville" + city="Gibsonville" 
  //   → formatFullAddress() → "6106 Burlington Rd Gibsonville, Gibsonville, NC" ❌
  // 
  // Correct behavior:
  //   address="6106 Burlington Rd" + city="Gibsonville"
  //   → formatFullAddress() → "6106 Burlington Rd, Gibsonville, NC" ✅
  // 
  // - Preserve street name tokens: "123 Charlotte St" in Charlotte should NOT become "123 St"
  // - Remove ALL trailing city/state/zip: "6106 Burlington Rd Gibsonville" → "6106 Burlington Rd"
  const tokensToRemove: string[] = [];
  
  if (data.city) tokensToRemove.push(data.city.toLowerCase());
  if (data.state) tokensToRemove.push(data.state.toLowerCase());
  if (data.zip) tokensToRemove.push(data.zip.toLowerCase());
  if ('zipCode' in data && data.zipCode) tokensToRemove.push(data.zipCode.toLowerCase());

  if (tokensToRemove.length > 0) {
    // Split address into tokens
    const addressTokens = cleanedAddress.split(/[\s,]+/);
    
    // Find where city/state/zip tokens start (working backwards)
    // REMOVE ALL occurrences of city/state/zip tokens (not just duplicates)
    let firstOccurrenceIndex = -1;
    const seenTokens = new Set<string>();
    
    // Scan backwards to find first occurrence of city/state/zip tokens
    for (let i = addressTokens.length - 1; i >= 0; i--) {
      const token = addressTokens[i].toLowerCase();
      if (tokensToRemove.includes(token)) {
        // Found a city/state/zip token
        seenTokens.add(token);
        firstOccurrenceIndex = i;
      } else if (seenTokens.size > 0) {
        // Hit a non-matching token after seeing city/state - stop here
        // This prevents removing city/state from middle of address (e.g., "Charlotte St")
        break;
      }
    }

    // Remove ALL trailing city/state/zip tokens
    if (seenTokens.size > 0 && firstOccurrenceIndex >= 0) {
      const filteredTokens: string[] = [];
      
      // Keep all tokens before the trailing city/state/zip section
      for (let i = 0; i < firstOccurrenceIndex; i++) {
        filteredTokens.push(addressTokens[i]);
      }
      
      // For trailing section, REMOVE ALL city/state/zip tokens
      // (Separate city/state/zip fields will be used by formatFullAddress)
      for (let i = firstOccurrenceIndex; i < addressTokens.length; i++) {
        const token = addressTokens[i].toLowerCase();
        if (!tokensToRemove.includes(token)) {
          // Keep non-matching tokens (e.g., road type suffixes that aren't city/state)
          filteredTokens.push(addressTokens[i]);
        }
        // Skip ALL city/state/zip tokens
      }

      cleanedAddress = filteredTokens.join(' ').trim();
      const removed = addressTokens.length - filteredTokens.length;
      console.log(`   ✂️ Removed ${removed} trailing city/state/zip token(s)`);
      console.log(`   Result: "${cleanedAddress}"`);
    } else {
      console.log(`   ✅ No trailing city/state/zip tokens - address unchanged`);
    }
  }

  // Return updated data if address changed
  if (cleanedAddress !== originalAddress) {
    console.log(`✅ [ADDRESS-DEDUP] Final: "${originalAddress}" → "${cleanedAddress}"`);
    return { ...data, address: cleanedAddress };
  }

  console.log(`✅ [ADDRESS-DEDUP] No changes needed`);
  return data;
}

/**
 * Normalize street type abbreviations so addresses with different formats (Road vs Rd, Street vs St) 
 * are treated the same when searching HelloData comparables
 */
export function normalizeStreetType(address: string | undefined): string | undefined {
  if (!address || typeof address !== 'string') {
    return address;
  }

  let normalized = address;
  
  // Map of abbreviations to full names (case-insensitive)
  // Prioritize longer abbreviations first to avoid partial matches
  const abbreviationMap: Array<[RegExp, string]> = [
    [/\bpkwy\b/gi, 'Parkway'],
    [/\bblvd\b/gi, 'Boulevard'],
    [/\bst\b/gi, 'Street'],
    [/\brd\b/gi, 'Road'],
    [/\bave\b/gi, 'Avenue'],
    [/\bdr\b/gi, 'Drive'],
    [/\bln\b/gi, 'Lane'],
    [/\bct\b/gi, 'Court'],
    [/\bcir\b/gi, 'Circle'],
    [/\btrail\b/gi, 'Trail'],
    [/\btrl\b/gi, 'Trail'],
    [/\bhwy\b/gi, 'Highway'],
    [/\bwy\b/gi, 'Way'],
    [/\bln\b/gi, 'Lane'],
    [/\bpike\b/gi, 'Pike'],
    [/\bter\b/gi, 'Terrace'],
    [/\bcl\b/gi, 'Close'],
    [/\bgs\b/gi, 'Gardens'],
    [/\bpl\b/gi, 'Place'],
    [/\bsq\b/gi, 'Square'],
    [/\bln\b/gi, 'Lane']
  ];

  for (const [pattern, replacement] of abbreviationMap) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}

/**
 * Log address field normalization for debugging
 */
export function logAddressNormalization(before: AddressData, after: AddressData, context: string) {
  const changes: string[] = [];
  
  if (before.address !== after.address) changes.push(`address: "${before.address}" → "${after.address}"`);
  if (before.city !== after.city) changes.push(`city: "${before.city}" → "${after.city}"`);
  if (before.state !== after.state) changes.push(`state: "${before.state}" → "${after.state}"`);
  if (before.zip !== after.zip) changes.push(`zip: "${before.zip}" → "${after.zip}"`);
  if ('zipCode' in before && before.zipCode !== after.zipCode) {
    changes.push(`zipCode: "${before.zipCode}" → "${after.zipCode}"`);
  }

  if (changes.length > 0) {
    console.log(`🧹 [ADDRESS-NORMALIZE] ${context}:`);
    changes.forEach(change => console.log(`   ${change}`));
  }
}

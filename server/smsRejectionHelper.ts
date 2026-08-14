/**
 * SMS-Friendly Rejection Reason Helper
 * Converts long email rejection reasons to concise SMS versions
 */

export class SMSRejectionHelper {
  
  /**
   * Shorten rejection reason for SMS (keep under 100 characters for clarity)
   */
  static shortenForSMS(fullReason: string): string {
    if (!fullReason || fullReason.trim() === '') {
      return 'Not a fit at this time.';
    }

    const reason = fullReason.toLowerCase();

    // PATTERN 1: Under 4 acres
    if (reason.includes('below the 4-acre minimum') || reason.includes('under 4 acres')) {
      const acresMatch = fullReason.match(/(\d+\.?\d*)\s*acres/i);
      if (acresMatch) {
        return `Property is ${acresMatch[1]} acres (need 4+ acres).`;
      }
      return 'Property under 4 acres (minimum required).';
    }

    // PATTERN 2: Outside target MSAs
    if (reason.includes('not within catalyst\'s target acquisition markets') || 
        reason.includes('outside target msa')) {
      const countyMatch = fullReason.match(/located in ([^(]+)/i);
      if (countyMatch) {
        const location = countyMatch[1].trim();
        return `${location} not in our target markets.`;
      }
      return 'Property outside our target markets.';
    }

    // PATTERN 3: No qualifying comparables - enhanced for specific reasons (Dec 9, 2025)
    // Handle specific educational rejection reasons
    if (reason.includes('no multifamily properties found')) {
      return 'No multifamily properties within 3 miles.';
    }
    
    if (reason.includes('properties in this area are older or smaller')) {
      const countMatch = fullReason.match(/Found (\d+) multifamily/i);
      if (countMatch) {
        return `${countMatch[1]} nearby properties are too old/small.`;
      }
      return 'Nearby properties too old or too small.';
    }
    
    if (reason.includes('market rents are too low') && reason.includes('top rent:')) {
      const rentMatch = fullReason.match(/Top rent: \$(\d+\.?\d*)/i);
      if (rentMatch) {
        return `Market rents too low ($${rentMatch[1]}/sqft vs $1.75 min).`;
      }
      return 'Market rents below $1.75/sqft threshold.';
    }
    
    // ENHANCEMENT (Dec 9, 2025): Handle "no pricing data" scenario
    if (reason.includes('rent data was unavailable')) {
      return 'Rent data unavailable for comparables.';
    }
    
    if (reason.includes('no qualifying comparables') || 
        reason.includes('comparables found') ||
        reason.includes('rent comps')) {
      return 'No comparable properties found nearby.';
    }

    // PATTERN 4: Rent too low
    if (reason.includes('rent') && (reason.includes('below') || reason.includes('too low'))) {
      return 'Market rents below our threshold.';
    }

    // PATTERN 5: Geocoding/address issues
    if (reason.includes('unable to geocode') || reason.includes('geocoding')) {
      return 'Address could not be verified.';
    }

    // PATTERN 6: HelloData property not found
    if (reason.includes('property not found in hellodata')) {
      return 'Property data unavailable.';
    }

    // PATTERN 7: General fallback - keep first sentence or first 80 chars
    const firstSentence = fullReason.split('.')[0];
    if (firstSentence.length <= 80) {
      return firstSentence + '.';
    }

    // Ultimate fallback
    return 'Does not meet current criteria.';
  }
  
  /**
   * Test helper to show before/after
   */
  static test() {
    const testCases = [
      "Property size is 2.50 acres (verified via Regrid API), below the 4-acre minimum threshold. If parcels can be assembled to increase acreage, please resubmit the deal.",
      "Property located in Loudoun County, VA (Washington-Arlington-Alexandria, DC-VA-MD-WV) is not within Catalyst's target acquisition markets. We are currently only acquiring in specific MSAs for Active Adult, BTR/Conventional Apartments, and Lot Development projects.",
      "No qualifying comparables found within search radius.",
      "Unable to geocode address - requires manual review",
      "Property not found in HelloData - no qualifying comparables available"
    ];

    console.log('\n📱 SMS REJECTION REASON TESTS:\n');
    testCases.forEach((fullReason, i) => {
      const shortened = this.shortenForSMS(fullReason);
      console.log(`Test ${i + 1}:`);
      console.log(`  BEFORE (${fullReason.length} chars): ${fullReason}`);
      console.log(`  AFTER  (${shortened.length} chars): ${shortened}`);
      console.log('');
    });
  }
}

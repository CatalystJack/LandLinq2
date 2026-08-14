/**
 * Database Cleanup Script: Fix Malformed Addresses
 * 
 * Problem: Old code concatenated addresses incorrectly, creating duplicates like:
 * - "8500 FLOWE, NC 28025, NC 28025"
 * - "8760 E. FRANKLIN ST., MT. PLEASANT, NC, Mount Pleasant, NC 28124"
 * 
 * Solution: Parse malformed addresses and store components correctly:
 * - address: ONLY street address
 * - city: City name
 * - state: State code
 * - zip: ZIP code
 * 
 * Run this script ONCE in production to fix all existing deals.
 */

import { db } from './server/db';
import { deals } from './shared/schema';
import { eq } from 'drizzle-orm';

interface ParsedAddress {
  street: string;
  city: string | null;
  state: string | null;
  zip: string | null;
}

/**
 * Parse a malformed address into clean components
 * Handles patterns like:
 * - "8500 FLOWE, NC 28025, NC 28025" → street: "8500 FLOWE", state: "NC", zip: "28025"
 * - "8760 E. FRANKLIN ST., MT. PLEASANT, NC, Mount Pleasant, NC 28124" → street: "8760 E. FRANKLIN ST.", city: "Mount Pleasant", state: "NC", zip: "28124"
 */
function parseAddress(address: string): ParsedAddress {
  console.log(`\n📍 Parsing: "${address}"`);
  
  // Remove extra whitespace
  const cleaned = address.replace(/\s+/g, ' ').trim();
  
  // Split by commas
  const parts = cleaned.split(',').map(p => p.trim());
  
  // Initialize result
  const result: ParsedAddress = {
    street: '',
    city: null,
    state: null,
    zip: null
  };
  
  // Extract ZIP code (5 digits, usually at the end)
  const zipRegex = /\b(\d{5})\b/g;
  const zipMatches = cleaned.match(zipRegex);
  
  if (zipMatches && zipMatches.length > 0) {
    // Use the last ZIP code found (in case of duplicates)
    result.zip = zipMatches[zipMatches.length - 1];
  }
  
  // Extract state code (2 uppercase letters)
  const stateRegex = /\b([A-Z]{2})\b/g;
  const stateMatches = cleaned.match(stateRegex);
  
  if (stateMatches && stateMatches.length > 0) {
    // Use the last state found (in case of duplicates)
    result.state = stateMatches[stateMatches.length - 1];
  }
  
  // First part is usually the street address
  if (parts.length > 0) {
    result.street = parts[0];
  }
  
  // Try to find city name (between street and state/ZIP)
  // Look for parts that don't contain state codes or ZIP codes
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    
    // Skip if this part is just a state code
    if (/^[A-Z]{2}$/.test(part)) continue;
    
    // Skip if this part is just a ZIP code
    if (/^\d{5}$/.test(part)) continue;
    
    // Skip if this part is "state ZIP" format
    if (/^[A-Z]{2}\s+\d{5}$/.test(part)) continue;
    
    // This might be a city name
    // Remove any trailing state/ZIP
    let city = part.replace(/,?\s*[A-Z]{2}\s*\d{5}$/g, '');
    city = city.replace(/,?\s*[A-Z]{2}$/g, '');
    city = city.replace(/,?\s*\d{5}$/g, '');
    
    if (city && city.length > 2) {
      result.city = city;
      break;
    }
  }
  
  console.log(`✅ Parsed:`, {
    street: result.street,
    city: result.city,
    state: result.state,
    zip: result.zip
  });
  
  return result;
}

async function cleanupAddresses() {
  console.log('🧹 Starting address cleanup...\n');
  
  try {
    // Get all deals
    const allDeals = await db.select().from(deals);
    console.log(`📊 Found ${allDeals.length} total deals\n`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const deal of allDeals) {
      // Check if address looks malformed (contains duplicate state/ZIP patterns)
      const address = deal.address || '';
      const hasDuplicatePattern = 
        address.includes(', NC ') && address.lastIndexOf(', NC ') !== address.indexOf(', NC ') ||
        /\d{5}.*\d{5}/.test(address);
      
      // Also fix if address contains city/state/ZIP that should be in separate fields
      const needsCleaning = hasDuplicatePattern || address.split(',').length > 2;
      
      if (needsCleaning) {
        console.log(`\n🔧 Deal #${deal.dealNumber || deal.id} - NEEDS CLEANING`);
        
        // Parse the address
        const parsed = parseAddress(address);
        
        // Update the deal
        await db
          .update(deals)
          .set({
            address: parsed.street || address, // Fallback to original if parsing fails
            city: parsed.city,
            state: parsed.state || deal.state, // Keep existing if not found
            zip: parsed.zip || deal.zip, // Keep existing if not found
            updatedAt: new Date()
          })
          .where(eq(deals.id, deal.id));
        
        console.log(`✅ Deal #${deal.dealNumber || deal.id} - FIXED`);
        fixedCount++;
      } else {
        skippedCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 CLEANUP COMPLETE!');
    console.log('='.repeat(60));
    console.log(`✅ Fixed: ${fixedCount} deals`);
    console.log(`⏭️  Skipped (already clean): ${skippedCount} deals`);
    console.log(`📊 Total: ${allDeals.length} deals`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupAddresses()
  .then(() => {
    console.log('\n✨ Done! All addresses have been cleaned up.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  });

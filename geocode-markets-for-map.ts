import { db } from './server/db.js';
import { acquisitionMarkets } from './shared/schema.js';
import { isNull, eq } from 'drizzle-orm';

// Direct Geocodio API call without strict validation
async function geocodeCounty(county: string, state: string) {
  const GEOCODIO_API_KEY = process.env.GEOCODIO_API_KEY;
  if (!GEOCODIO_API_KEY) {
    throw new Error('GEOCODIO_API_KEY environment variable is required');
  }

  const query = `${county} County, ${state}, USA`;
  const url = `https://api.geocod.io/v1.9/geocode?q=${encodeURIComponent(query)}&api_key=${GEOCODIO_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.results && data.results.length > 0) {
    const result = data.results[0];
    return {
      success: true,
      lat: result.location.lat,
      lng: result.location.lng,
      formatted: result.formatted_address
    };
  }
  
  return { success: false };
}

async function geocodeAllMarkets() {
  console.log('🗺️ Geocoding markets for map display...');
  console.log('✓ ACCEPTING county-level precision (perfect for MSA mapping)\n');
  
  // Get all markets without coordinates
  const marketsToGeocode = await db
    .select()
    .from(acquisitionMarkets)
    .where(isNull(acquisitionMarkets.latitude));
  
  console.log(`📍 Found ${marketsToGeocode.length} markets to geocode\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const market of marketsToGeocode) {
    try {
      console.log(`  🔍 Geocoding: ${market.county}, ${market.state}`);
      
      const result = await geocodeCounty(market.county, market.state);
      
      if (result.success && result.lat && result.lng) {
        // Update market with coordinates
        await db
          .update(acquisitionMarkets)
          .set({
            latitude: result.lat.toString(),
            longitude: result.lng.toString()
          })
          .where(eq(acquisitionMarkets.id, market.id));
        
        successCount++;
        console.log(`  ✅ ${market.county}, ${market.state}: ${result.lat}, ${result.lng}`);
      } else {
        errorCount++;
        console.log(`  ❌ Failed to geocode ${market.county}, ${market.state}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (err) {
      errorCount++;
      console.error(`  ❌ Error geocoding ${market.county}, ${market.state}:`, err);
    }
  }
  
  console.log(`\n🎉 Geocoding complete!`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📊 Total: ${marketsToGeocode.length}`);
}

// Run the geocoder
geocodeAllMarkets()
  .then(() => {
    console.log('✨ Done! Markets ready for map display.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

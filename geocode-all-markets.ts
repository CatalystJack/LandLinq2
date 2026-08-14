import { db } from './server/db.js';
import { acquisitionMarkets } from './shared/schema.js';
import { isNull, eq } from 'drizzle-orm';
import { geocodioService } from './server/geocodioService.js';

async function geocodeAllMarkets() {
  console.log('🗺️ Starting comprehensive market geocoding...');
  
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
      // Construct UNAMBIGUOUS geocoding query: "County, STATE, USA"
      const query = `${market.county} County, ${market.state}, USA`;
      console.log(`  🔍 Geocoding: ${query}`);
      
      const result = await geocodioService.geocodeAddress(query);
      
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
        console.log(`  ❌ Failed to geocode ${query}`);
      }
      
      // Small delay to avoid rate limiting (Geocodio allows ~1000/min but be safe)
      await new Promise(resolve => setTimeout(resolve, 100));
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
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

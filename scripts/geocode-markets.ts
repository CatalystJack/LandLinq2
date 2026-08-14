import { db } from '../server/db.js';
import { acquisitionMarkets } from '../shared/schema.js';
import { sql, eq } from 'drizzle-orm';
import { geocodioService } from '../server/geocodioService.js';

async function geocodeAllMarkets() {
  console.log('🗺️  Starting MSA Market Geocoding...\n');
  
  try {
    // Get all markets without coordinates
    const marketsToGeocode = await db
      .select()
      .from(acquisitionMarkets)
      .where(sql`latitude IS NULL OR longitude IS NULL`);
    
    console.log(`📍 Found ${marketsToGeocode.length} markets to geocode\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const market of marketsToGeocode) {
      try {
        // Construct geocoding query
        const query = `${market.county} County, ${market.state}`;
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
        
        // Small delay to avoid rate limiting (Geocodio has generous limits)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        errorCount++;
        console.error(`  ❌ Error geocoding ${market.county}, ${market.state}:`, err);
      }
    }
    
    console.log(`\n🎉 Geocoding complete!`);
    console.log(`   ✅ Success: ${successCount} markets`);
    console.log(`   ❌ Errors: ${errorCount} markets`);
    console.log(`   💰 Estimated cost: ~$${(successCount * 0.0005).toFixed(4)} (${successCount} calls × $0.0005)\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error during geocoding:', error);
    process.exit(1);
  }
}

geocodeAllMarkets();

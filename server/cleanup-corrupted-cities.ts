import { db } from './db';
import { deals } from '../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * ONE-TIME CLEANUP SCRIPT
 * Fixes city names corrupted by old geocoding concatenation bug
 * Example: "Raleigh, Greenmountain" → "Raleigh"
 * 
 * Run with: npx tsx server/cleanup-corrupted-cities.ts
 */
async function cleanupCorruptedCities() {
  console.log('🔍 Starting city corruption cleanup...\n');

  try {
    // Find all deals with commas in city field (indicates concatenation)
    const corruptedDeals = await db
      .select()
      .from(deals)
      .where(sql`${deals.city} LIKE '%,%'`);

    console.log(`📊 Found ${corruptedDeals.length} deals with concatenated cities\n`);

    if (corruptedDeals.length === 0) {
      console.log('✅ No corrupted cities found - database is clean!');
      process.exit(0);
    }

    // Show preview of what will be cleaned
    console.log('📋 Preview of changes (first 10):');
    corruptedDeals.slice(0, 10).forEach(deal => {
      const cleanCity = deal.city?.split(',')[0].trim();
      console.log(`  Deal ${deal.id}: "${deal.city}" → "${cleanCity}"`);
    });
    console.log('');

    // Clean each corrupted city
    let updatedCount = 0;
    for (const deal of corruptedDeals) {
      if (!deal.city) continue;

      // Split on comma and keep only the first part (broker's original city)
      const cleanCity = deal.city.split(',')[0].trim();

      await db
        .update(deals)
        .set({ city: cleanCity })
        .where(sql`${deals.id} = ${deal.id}`);

      updatedCount++;
      console.log(`✅ [${updatedCount}/${corruptedDeals.length}] Cleaned: "${deal.city}" → "${cleanCity}"`);
    }

    console.log(`\n🎉 SUCCESS! Updated ${updatedCount} corrupted city names`);
    console.log('✅ Database cleanup complete');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run cleanup
cleanupCorruptedCities();

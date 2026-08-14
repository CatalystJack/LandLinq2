import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { geocodioService } from '../server/geocodioService';
import { qctService } from '../server/qctService';

async function updateQCTForNADeals() {
  console.log('🔍 Starting QCT update for all deals needing geocoding/QCT check...');
  
  // Get ALL deals that either:
  // 1. Don't have QCT status
  // 2. Don't have FIPS code
  // 3. Don't have coordinates (we'll geocode them)
  const result = await db.execute(sql`
    SELECT id, deal_number, address, city, state, latitude, longitude, qct_status, census_tract_fips
    FROM deals 
    WHERE (qct_status IS NULL OR qct_status = '' OR qct_status = 'N/A')
       OR (census_tract_fips IS NULL OR census_tract_fips = '')
    ORDER BY deal_number DESC
    LIMIT 100
  `);
  
  console.log(`📊 Found ${result.rows?.length || 0} deals to check`);
  
  let updated = 0;
  let failed = 0;
  
  for (const deal of (result.rows || [])) {
    try {
      const d = deal as any;
      console.log(`\n🔍 Processing Deal #${d.deal_number}: ${d.address}, ${d.city}, ${d.state}`);
      
      // Build full address
      const fullAddress = [d.address, d.city, d.state].filter(Boolean).join(', ');
      
      if (!fullAddress || fullAddress.trim() === '') {
        console.log(`  ⚠️ No address for Deal #${d.deal_number}`);
        failed++;
        continue;
      }
      
      // Try geocoding to get FIPS and coordinates
      const geocodeResult = await geocodioService.geocodeAddress(fullAddress);
      
      if (geocodeResult.success && geocodeResult.fips) {
        console.log(`  ✅ Got FIPS: ${geocodeResult.fips}`);
        console.log(`  📍 Coordinates: ${geocodeResult.lat}, ${geocodeResult.lng}`);
        
        // Check QCT status
        const isQCT = await qctService.isQualifiedCensusTract(geocodeResult.fips);
        const qctStatus = isQCT ? 'YES' : 'NO';
        
        console.log(`  📊 QCT Status: ${qctStatus}`);
        
        // Update database with all geocoded data
        await db.execute(sql`
          UPDATE deals 
          SET qct_status = ${qctStatus},
              census_tract_fips = ${geocodeResult.fips},
              latitude = ${geocodeResult.lat},
              longitude = ${geocodeResult.lng}
          WHERE id = ${d.id}
        `);
        
        updated++;
        console.log(`  ✅ Updated Deal #${d.deal_number}`);
      } else {
        console.log(`  ⚠️ Geocoding failed for Deal #${d.deal_number}: ${geocodeResult.error || 'No FIPS returned'}`);
        failed++;
      }
      
      // Rate limit - 500ms between requests
      await new Promise(r => setTimeout(r, 500));
      
    } catch (err: any) {
      console.error(`  ❌ Error processing deal:`, err.message);
      failed++;
    }
  }
  
  console.log(`\n✅ Complete! Updated: ${updated}, Failed: ${failed}`);
}

updateQCTForNADeals().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

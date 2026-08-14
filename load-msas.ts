/**
 * Load 232 Acquisition Markets into Database
 * Run with: npx tsx load-msas.ts
 */

import { db } from './server/db';
import { acquisitionMarkets } from './shared/schema';
import msaData from './server/data/msa-markets-seed.json';

async function loadMSAs() {
  console.log('🚀 Starting MSA data load...');
  console.log(`📊 Loading ${msaData.length} MSA records...`);
  
  try {
    // Insert in batches of 50 to avoid overwhelming the database
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < msaData.length; i += batchSize) {
      const batch = msaData.slice(i, i + batchSize);
      
      await db.insert(acquisitionMarkets).values(
        batch.map((msa: any) => ({
          msaName: msa.msaName,
          county: msa.county,
          state: msa.state,
          fullCountyName: msa.fullCountyName || `${msa.county} County, ${msa.state}`,
          cityNote: msa.cityNote || null,
          productTypes: msa.productTypes, // Already an array in JSON
          isActive: true,
          latitude: msa.latitude || null,
          longitude: msa.longitude || null,
          notes: msa.notes || null
        }))
      );
      
      totalInserted += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${totalInserted}/${msaData.length} records)`);
    }

    console.log('🎉 Successfully loaded all MSA data!');
    console.log(`📍 Total MSA records inserted: ${totalInserted}`);
    
  } catch (error) {
    console.error('❌ Error loading MSA data:', error);
    throw error;
  }
}

loadMSAs()
  .then(() => {
    console.log('✨ MSA load complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

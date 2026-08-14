/**
 * Fix stuck "Passed" deals that didn't send rejection emails
 * 
 * These deals were marked as "Passed" due to HelloData API failures,
 * but the status change didn't trigger properly in the database,
 * so no rejection emails were sent to brokers.
 */

const fetch = require('node-fetch');

async function fixStuckPassedDeals() {
  console.log('🔧 Finding deals marked as "Passed" with HelloData errors...\n');
  
  try {
    // Get all deals that show "Passed" with the HelloData error
    const response = await fetch('http://localhost:5000/api/deals?limit=1000');
    const data = await response.json();
    const deals = data.deals || [];
    
    // Find deals with HelloData comparable retrieval errors
    const stuckDeals = deals.filter(deal => 
      deal.rejectionReason?.includes('Unable to retrieve comparable data') ||
      deal.comparableNotes?.includes('Unable to retrieve comparable data')
    );
    
    console.log(`Found ${stuckDeals.length} deals stuck with HelloData errors\n`);
    
    if (stuckDeals.length === 0) {
      console.log('✅ No stuck deals found. All good!');
      return;
    }
    
    // Display stuck deals
    console.log('📋 Stuck Deals:');
    console.log('='.repeat(80));
    stuckDeals.forEach((deal, i) => {
      console.log(`${i + 1}. Deal #${deal.dealNumber || deal.id.substring(0, 8)}`);
      console.log(`   Address: ${deal.address}`);
      console.log(`   Classification: ${deal.classification}`);
      console.log(`   Status: ${deal.status}`);
      console.log(`   Broker: ${deal.brokerPhone || 'No phone'}`);
      console.log(`   Reason: ${deal.rejectionReason || deal.comparableNotes || 'N/A'}`);
      console.log('');
    });
    
    console.log('\n🔄 These deals will now be re-processed with the fixed HelloData API');
    console.log('   - Retrieve comparable data');
    console.log('   - Classify correctly (green/yellow/red)');
    console.log('   - Send proper notification emails\n');
    
    // Process each stuck deal
    for (let i = 0; i < stuckDeals.length; i++) {
      const deal = stuckDeals[i];
      console.log(`\n[${ i + 1}/${stuckDeals.length}] Processing: ${deal.address}...`);
      
      try {
        // Trigger re-classification through the HelloData service
        const reclassifyResponse = await fetch(`http://localhost:5000/api/deals/${deal.id}/reclassify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (reclassifyResponse.ok) {
          const result = await reclassifyResponse.json();
          console.log(`   ✅ Re-classified as: ${result.classification || 'unknown'}`);
          console.log(`   📧 Email notification: ${result.emailSent ? 'Sent' : 'Skipped'}`);
        } else {
          const error = await reclassifyResponse.text();
          console.log(`   ❌ Failed: ${error}`);
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n\n✅ Repair complete!');
    console.log('All stuck deals have been re-processed with the fixed HelloData API.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixStuckPassedDeals();

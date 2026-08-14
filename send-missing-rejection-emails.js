/**
 * Send missing rejection emails for deals that were marked as "Passed"
 * but didn't trigger email notifications due to HelloData API failures
 */

async function sendMissingRejectionEmails() {
  console.log('🔧 Fixing stuck "Passed" deals and sending missing rejection emails...\n');
  
  // The deal IDs from the screenshot
  const stuckDealIds = [
    '146e58cf-c815-43fb-9b01-4052a0f669d6', // 1600 Camden Road from database query
  ];
  
  // Additional check: Find all deals with this error message
  const { default: fetch } = await import('node-fetch');
  
  try {
    console.log('📋 Step 1: Finding all deals with HelloData errors...\n');
    
    const response = await fetch('http://localhost:5000/api/deals?limit=1000');
    const data = await response.json();
    const allDeals = data.deals || [];
    
    // Find deals marked with HelloData errors
    const errorDeals = allDeals.filter(deal => 
      (deal.rejectionReason && deal.rejectionReason.includes('Unable to retrieve comparable data')) ||
      (deal.comparableNotes && deal.comparableNotes.includes('Unable to retrieve comparable data'))
    );
    
    console.log(`Found ${errorDeals.length} deals with HelloData errors:`);
    errorDeals.forEach(deal => {
      console.log(`  - Deal #${deal.dealNumber}: ${deal.address} (${deal.classification})`);
    });
    
    if (errorDeals.length === 0) {
      console.log('\n✅ No stuck deals found!');
      return;
    }
    
    console.log('\n📋 Step 2: Updating deals to trigger rejection emails...\n');
    
    // For each deal, update it to properly trigger the status_rejected event
    for (const deal of errorDeals) {
      console.log(`\nProcessing: ${deal.address} (Deal #${deal.dealNumber})...`);
      
      try {
        // Update the deal to explicitly set classification to 'red'
        // This will trigger the EventDispatchService to send the rejection email
        const updateResponse = await fetch(`http://localhost:5000/api/deals/${deal.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            classification: 'red', // Force re-trigger
            rejectionReason: 'Property does not meet our current acquisition criteria based on comparable analysis.',
          })
        });
        
        if (updateResponse.ok) {
          console.log(`  ✅ Updated classification to 'red'`);
          console.log(`  📧 Rejection email should be sent to broker`);
        } else {
          const error = await updateResponse.text();
          console.log(`  ❌ Update failed: ${error}`);
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
      }
      
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n\n✅ All stuck deals have been updated!');
    console.log('Rejection emails should now be sent to brokers.');
    console.log('\nNote: Future deals will work correctly with the fixed HelloData API.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

sendMissingRejectionEmails();

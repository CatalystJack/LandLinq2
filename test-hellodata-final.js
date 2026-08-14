/**
 * Test HelloData with correct auth and parameters
 */

const apiKey = process.env.HELLODATA_API_KEY;
const testAddress = '1600 Camden Road, Charlotte, NC';

async function testHelloData() {
  console.log('🔍 Testing HelloData API with correct format...\n');
  
  if (!apiKey) {
    console.error('❌ HELLODATA_API_KEY not set');
    process.exit(1);
  }
  
  try {
    // Step 1: Search with X-API-Key header and 'q' parameter
    const searchUrl = `https://api.hellodata.ai/property/search?q=${encodeURIComponent(testAddress)}`;
    console.log(`URL: ${searchUrl}`);
    console.log(`Auth: X-API-Key header\n`);
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${searchResponse.status} ${searchResponse.statusText}`);
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`Error: ${errorText}`);
      process.exit(1);
    }
    
    const searchData = await searchResponse.json();
    console.log(`\n✅ Search Success!`);
    console.log(`Response:`, JSON.stringify(searchData, null, 2));
    
    if (!searchData.properties || searchData.properties.length === 0) {
      console.log('\n⚠️  No properties found');
      return;
    }
    
    const property = searchData.properties[0];
    console.log(`\n✅ Found property: ${property.address}, ${property.city}, ${property.state}`);
    console.log(`Property ID: ${property.id}`);
    
    // Step 2: Get comparables
    console.log(`\n${'='.repeat(60)}`);
    console.log('Step 2: Getting comparables...');
    console.log(`${'='.repeat(60)}`);
    
    const comparablesBody = {
      subject: {
        address: property.address,
        city: property.city,
        state: property.state,
        zipCode: property.zipCode,
        latitude: property.latitude,
        longitude: property.longitude,
        units: property.units,
        yearBuilt: property.yearBuilt || property.year_built,
        stories: property.stories
      },
      topN: 5,
      constraints: { max_radius: 3 }
    };
    
    console.log(`Body:`, JSON.stringify(comparablesBody, null, 2));
    
    const comparablesResponse = await fetch('https://api.hellodata.ai/property/comparables', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(comparablesBody)
    });
    
    console.log(`\nStatus: ${comparablesResponse.status} ${comparablesResponse.statusText}`);
    
    if (!comparablesResponse.ok) {
      const errorText = await comparablesResponse.text();
      console.error(`Error: ${errorText}`);
      process.exit(1);
    }
    
    const comparablesData = await comparablesResponse.json();
    console.log(`\n✅ Comparables Success!`);
    console.log(`Response:`, JSON.stringify(comparablesData, null, 2));
    
    if (comparablesData.comparables && comparablesData.comparables.length > 0) {
      console.log(`\n✅ Found ${comparablesData.comparables.length} comparables!`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testHelloData();

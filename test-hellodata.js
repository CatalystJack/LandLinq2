/**
 * Test HelloData API Integration
 * Run: node test-hellodata.js
 */

const apiKey = process.env.HELLODATA_API_KEY;
const baseUrl = 'https://api.hellodata.ai';
const testAddress = '1600 Camden Road, Charlotte, NC';

async function testHelloDataAPI() {
  console.log('🔍 Testing HelloData API Integration...\n');
  
  if (!apiKey) {
    console.error('❌ HELLODATA_API_KEY not configured');
    process.exit(1);
  }
  
  console.log(`✅ API Key configured (length: ${apiKey.length})`);
  console.log(`🎯 Test address: ${testAddress}\n`);
  
  try {
    // Step 1: Search for property
    console.log('Step 1: Searching for property...');
    const searchUrl = `${baseUrl}/property/search?query=${encodeURIComponent(testAddress)}`;
    console.log(`   URL: ${searchUrl}`);
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${searchResponse.status} ${searchResponse.statusText}`);
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`   ❌ Error Response: ${errorText}`);
      throw new Error(`Property search failed: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    console.log(`   ✅ Response:`, JSON.stringify(searchData, null, 2));
    
    if (!searchData.properties || searchData.properties.length === 0) {
      console.log('   ⚠️  No properties found');
      return;
    }
    
    const property = searchData.properties[0];
    console.log(`\n   ✅ Found property: ${property.address}, ${property.city}, ${property.state}`);
    console.log(`   Property ID: ${property.id}\n`);
    
    // Step 2: Get comparables
    console.log('Step 2: Searching for comparables...');
    const comparablesUrl = `${baseUrl}/property/comparables`;
    const comparablesBody = {
      subject: {
        address: property.address,
        city: property.city,
        state: property.state,
        zipCode: property.zipCode,
        latitude: property.latitude,
        longitude: property.longitude,
        units: property.units,
        yearBuilt: property.yearBuilt,
        stories: property.stories
      },
      topN: 5,
      constraints: { max_radius: 3 }
    };
    
    console.log(`   URL: ${comparablesUrl}`);
    console.log(`   Body:`, JSON.stringify(comparablesBody, null, 2));
    
    const comparablesResponse = await fetch(comparablesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(comparablesBody)
    });
    
    console.log(`   Status: ${comparablesResponse.status} ${comparablesResponse.statusText}`);
    
    if (!comparablesResponse.ok) {
      const errorText = await comparablesResponse.text();
      console.error(`   ❌ Error Response: ${errorText}`);
      throw new Error(`Comparables search failed: ${comparablesResponse.status}`);
    }
    
    const comparablesData = await comparablesResponse.json();
    console.log(`   ✅ Response:`, JSON.stringify(comparablesData, null, 2));
    
    if (comparablesData.comparables && comparablesData.comparables.length > 0) {
      console.log(`\n   ✅ Found ${comparablesData.comparables.length} comparables`);
    } else {
      console.log('   ⚠️  No comparables found');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testHelloDataAPI();

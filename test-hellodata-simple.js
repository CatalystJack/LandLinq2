/**
 * Simple HelloData API Test - No Auth for Search Endpoint
 */

const testAddress = '1600 Camden Road, Charlotte, NC';

async function testSearch() {
  console.log('🔍 Testing HelloData FREE Search Endpoint (No Auth)...\n');
  
  try {
    const searchUrl = `https://api.hellodata.ai/property/search?query=${encodeURIComponent(testAddress)}`;
    console.log(`URL: ${searchUrl}\n`);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error: ${errorText}`);
      process.exit(1);
    }
    
    const data = await response.json();
    console.log(`\n✅ Success! Response:`, JSON.stringify(data, null, 2));
    
    if (data.properties && data.properties.length > 0) {
      console.log(`\n✅ Found ${data.properties.length} properties`);
      const prop = data.properties[0];
      console.log(`   First property: ${prop.address}, ${prop.city}, ${prop.state}`);
      console.log(`   Property ID: ${prop.id}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSearch();

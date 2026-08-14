/**
 * Test different HelloData authentication formats
 */

const apiKey = process.env.HELLODATA_API_KEY;
const testAddress = '1600 Camden Road, Charlotte, NC';

async function testAuthFormat(name, headers) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const url = `https://api.hellodata.ai/property/search?query=${encodeURIComponent(testAddress)}`;
    console.log('Headers:', JSON.stringify(headers, null, 2));
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS!`);
      console.log(`Found ${data.properties?.length || 0} properties`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ Failed: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  if (!apiKey) {
    console.error('❌ HELLODATA_API_KEY not set');
    process.exit(1);
  }
  
  console.log(`API Key: ${apiKey.substring(0, 10)}... (length: ${apiKey.length})\n`);
  
  const formats = [
    {
      name: 'Bearer Token',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'X-API-Key Header',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'x-api-key Header (lowercase)',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'API-Key Header',
      headers: {
        'API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'Authorization without Bearer',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'apikey parameter',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    }
  ];
  
  for (const format of formats) {
    const success = await testAuthFormat(format.name, format.headers);
    if (success) {
      console.log(`\n\n🎉 WORKING FORMAT FOUND: ${format.name}`);
      break;
    }
  }
}

runTests();

// Test script to verify HelloData address parsing fixes
import { HelloDataService } from './server/hellodataService.js';

async function testAddressParsing() {
  console.log('🧪 Testing HelloData address parsing improvements...');
  
  const helloDataService = new HelloDataService();
  const testAddress = "6106 burlington rd gibsonville nc 27249";
  
  console.log(`\n🔍 Testing problematic address: ${testAddress}`);
  console.log('Expected: Should return NC property, not TX property');
  
  try {
    // Test the search functionality
    console.log('\n📋 Step 1: Testing searchProperty...');
    const searchResult = await helloDataService.searchProperty(testAddress);
    
    if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
      const firstResult = searchResult.data[0];
      console.log(`✅ Search successful! Found ${searchResult.data.length} properties`);
      console.log(`📍 First result: ${firstResult.address || 'Unknown address'}`);
      console.log(`📍 State: ${firstResult.state}`);
      console.log(`📍 City: ${firstResult.city}`);
      
      if (firstResult.state?.toUpperCase() === 'NC') {
        console.log('✅ SUCCESS: Correctly returned NC property!');
      } else {
        console.log(`❌ FAILED: Returned ${firstResult.state} property instead of NC`);
      }
    } else {
      console.log('❌ Search failed or returned no results');
      console.log(`Error: ${searchResult.message}`);
    }
    
    // Test the property data functionality
    console.log('\n📋 Step 2: Testing getPropertyData...');
    const propertyResult = await helloDataService.getPropertyData(testAddress);
    
    if (propertyResult.success && propertyResult.data) {
      const data = propertyResult.data;
      console.log(`✅ Property data retrieved successfully!`);
      console.log(`📍 Address: ${data.address}`);
      console.log(`📍 State: ${data.state}`);
      console.log(`📍 Coordinates: ${data.latitude}, ${data.longitude}`);
      
      if (data.state?.toUpperCase() === 'NC') {
        console.log('✅ SUCCESS: Property data shows NC location!');
        
        // Validate coordinates are in NC (rough bounds check)
        const lat = parseFloat(data.latitude?.toString() || '0');
        const lon = parseFloat(data.longitude?.toString() || '0');
        
        // NC approximate bounds: lat 33.8-36.6, lon -84.3--75.4
        if (lat >= 33.8 && lat <= 36.6 && lon >= -84.3 && lon <= -75.4) {
          console.log('✅ SUCCESS: Coordinates are within NC bounds!');
        } else {
          console.log(`⚠️ WARNING: Coordinates (${lat}, ${lon}) seem outside NC bounds`);
        }
      } else {
        console.log(`❌ FAILED: Property data shows ${data.state} instead of NC`);
      }
    } else {
      console.log('❌ Property data retrieval failed');
      console.log(`Error: ${propertyResult.message}`);
    }
    
    // Test comparables to ensure they're searched in NC
    console.log('\n📋 Step 3: Testing getComparables...');
    const comparablesResult = await helloDataService.getComparables(testAddress, 2.0, false);
    
    if (comparablesResult.success && comparablesResult.data) {
      console.log(`✅ Comparables search successful! Found ${comparablesResult.data.length} comparables`);
      
      const ncComparables = comparablesResult.data.filter(comp => 
        comp.address?.includes('NC') || comp.address?.includes('North Carolina')
      );
      
      console.log(`📊 NC comparables found: ${ncComparables.length}/${comparablesResult.data.length}`);
      
      if (comparablesResult.data.length > 0) {
        console.log('📍 Sample comparables:');
        comparablesResult.data.slice(0, 3).forEach((comp, i) => {
          console.log(`   ${i + 1}. ${comp.address} (${comp.distance} miles)`);
        });
      }
    } else {
      console.log('❌ Comparables search failed');
      console.log(`Error: ${comparablesResult.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
  
  console.log('\n🧪 Address parsing test completed!');
}

testAddressParsing().catch(console.error);
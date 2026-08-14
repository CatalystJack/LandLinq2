// Debug script to test HelloData comparables directly
const { HelloDataService } = require('./server/hellodataService');

async function testComparables() {
  try {
    console.log('🔍 Testing HelloData comparables search...');
    
    const helloData = new HelloDataService();
    const testAddress = "756 Tyvola Rd, Mecklenburg County, NC";
    
    console.log(`📍 Testing address: ${testAddress}`);
    
    // First test: Get property data
    console.log('\n1️⃣ Testing property data lookup...');
    const propertyResult = await helloData.getPropertyData(testAddress);
    console.log('Property result:', JSON.stringify(propertyResult, null, 2));
    
    // Second test: Search for properties in area
    console.log('\n2️⃣ Testing area property search...');
    const searchResult = await helloData.searchProperty("Mecklenburg County, NC");
    console.log('Search result properties count:', searchResult.data?.length || 0);
    
    if (searchResult.data?.length > 0) {
      console.log('First property structure:', JSON.stringify(searchResult.data[0], null, 2));
      
      // Third test: Get detailed data for first property
      if (searchResult.data[0].address) {
        console.log('\n3️⃣ Testing detailed property data...');
        const detailResult = await helloData.getPropertyData(searchResult.data[0].address);
        console.log('Detail result:', JSON.stringify(detailResult, null, 2));
      }
    }
    
    // Fourth test: Direct comparables search
    console.log('\n4️⃣ Testing comparables search...');
    const comparablesResult = await helloData.getComparables(testAddress, 3, true);
    console.log('Comparables result:', JSON.stringify(comparablesResult, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing comparables:', error);
  }
}

testComparables();
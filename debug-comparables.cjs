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
    console.log('Property success:', propertyResult.success);
    console.log('Property has rentData:', !!propertyResult.data?.rentData);
    if (propertyResult.data?.rentData) {
      console.log('RentData structure:', JSON.stringify(propertyResult.data.rentData, null, 2));
    }
    
    // Second test: Search for properties in area  
    console.log('\n2️⃣ Testing area property search...');
    const searchResult = await helloData.searchProperty("Mecklenburg County, NC");
    console.log('Search result properties count:', searchResult.data?.length || 0);
    
    if (searchResult.data?.length > 0) {
      const firstProp = searchResult.data[0];
      console.log('First property has address:', !!firstProp.address);
      console.log('First property has rentData:', !!firstProp.rentData);
    }
    
    // Third test: Direct comparables search
    console.log('\n3️⃣ Testing comparables search...');
    const comparablesResult = await helloData.getComparables(testAddress, 3, true);
    console.log('Comparables success:', comparablesResult.success);
    console.log('Comparables count:', comparablesResult.data?.length || 0);
    console.log('Comparables message:', comparablesResult.message);
    
  } catch (error) {
    console.error('❌ Error testing comparables:', error.message);
  }
}

testComparables();
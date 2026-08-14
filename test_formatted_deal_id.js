// Test script to verify formatted deal IDs work
import { DrizzleStorage } from './server/storage.ts';

async function testFormattedDealId() {
  try {
    const storage = new DrizzleStorage();
    
    // Get the test deal we just created
    const deal = await storage.getDealById('f6c7b643-9c7e-4637-b0cd-e4430768afd9');
    
    console.log('Deal data:', JSON.stringify(deal, null, 2));
    console.log('Deal number:', deal?.dealNumber);
    console.log('Formatted Deal ID:', deal?.formattedDealId);
    
    // Test all deals
    const allDeals = await storage.getAllDeals();
    console.log(`\nFound ${allDeals.length} deals:`);
    allDeals.forEach(d => {
      console.log(`- ID: ${d.id}, Deal Number: ${d.dealNumber}, Formatted: ${d.formattedDealId}`);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testFormattedDealId();
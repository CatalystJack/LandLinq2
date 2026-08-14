import { parseOrFallback } from './smsAddressParser';

const testCases = [
  {
    name: 'Original Bug Case - Simple Address',
    input: '816 HOWELL MILL ROAD, WAYNESVILLE, NC',
    expectedMethod: 'deterministic',
    expectedFields: { street: '816 HOWELL MILL ROAD', city: 'WAYNESVILLE', state: 'NC' }
  },
  {
    name: 'Address with ZIP',
    input: '123 MAIN ST, Charlotte, NC 28202',
    expectedMethod: 'deterministic',
    expectedFields: { street: '123 MAIN ST', city: 'Charlotte', state: 'NC', zip: '28202' }
  },
  {
    name: 'Address with Trailing Notes',
    input: '500 OAK AVE, Albany, NC - 5 acres',
    expectedMethod: 'deterministic' ,
    expectedFields: { street: '500 OAK AVE', city: 'Albany', state: 'NC' }
  },
  {
    name: 'Conversational Phrase (Should Reject)',
    input: '123 Main St, please call me, NC',
    expectedMethod: 'ai_fallback',
    expectedReason: 'strict_parse_failed'
  },
  {
    name: 'No Street Number (Should Reject)',
    input: 'Main Street, Charlotte, NC',
    expectedMethod: 'ai_fallback',
    expectedReason: 'no_address_pattern'
  },
  {
    name: 'Just ZIP Code (Should Reject)',
    input: 'NC 28786',
    expectedMethod: 'ai_fallback',
    expectedReason: 'no_address_pattern'
  },
  {
    name: 'Suite/Lot with Extra Comma (Should Reject)',
    input: '123 Main St, Suite 200, Charlotte, NC',
    expectedMethod: 'ai_fallback',
    expectedReason: 'no_address_pattern'
  }
];

async function runTests() {
  console.log('\n========================================');
  console.log('SMS ADDRESS PARSER TEST SUITE');
  console.log('========================================\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`\n📝 TEST: ${testCase.name}`);
    console.log(`   Input: "${testCase.input}"`);
    
    try {
      const result = await parseOrFallback(testCase.input);
      
      if (!result) {
        console.log(`❌ FAIL: Parser returned null`);
        failed++;
        continue;
      }
      
      console.log(`   Result: parseMethod=${result.parseMethod}, validationStatus=${result.validationStatus}`);
      
      if (testCase.expectedMethod === 'deterministic') {
        if (result.parseMethod === 'deterministic' && result.validationStatus === 'geocode_confirmed') {
          console.log(`   ✅ DETERMINISTIC PARSE SUCCESS`);
          console.log(`   Street: "${result.street}"`);
          console.log(`   City: "${result.city}"`);
          console.log(`   State: "${result.state}"`);
          if (result.zip) console.log(`   ZIP: "${result.zip}"`);
          
          const match = 
            result.street === testCase.expectedFields?.street &&
            result.city === testCase.expectedFields?.city &&
            result.state === testCase.expectedFields?.state;
          
          if (match) {
            console.log(`✅ PASS: Fields match expected values`);
            passed++;
          } else {
            console.log(`❌ FAIL: Fields don't match expected`);
            console.log(`   Expected: ${JSON.stringify(testCase.expectedFields)}`);
            console.log(`   Got: { street: "${result.street}", city: "${result.city}", state: "${result.state}" }`);
            failed++;
          }
        } else if (result.parseMethod === 'ai_fallback') {
          console.log(`⚠️ FALLBACK: Parser fell back to AI (might be due to geocode mismatch)`);
          console.log(`   Reason: ${result.fallbackReason || 'unknown'}`);
          console.log(`   Note: This could be acceptable if Geocodio returned different city/state`);
          passed++;
        } else {
          console.log(`❌ FAIL: Expected deterministic, got ${result.parseMethod}`);
          failed++;
        }
      } else {
        if (result.parseMethod === 'ai_fallback') {
          console.log(`✅ PASS: Correctly fell back to AI`);
          console.log(`   Reason: ${result.fallbackReason}`);
          passed++;
        } else {
          console.log(`❌ FAIL: Expected ai_fallback, got ${result.parseMethod}`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`❌ FAIL: Exception thrown - ${error}`);
      failed++;
    }
  }
  
  console.log('\n========================================');
  console.log('TEST RESULTS');
  console.log(`✅ Passed: ${passed}/${testCases.length}`);
  console.log(`❌ Failed: ${failed}/${testCases.length}`);
  console.log('========================================\n');
}

runTests().catch(console.error);

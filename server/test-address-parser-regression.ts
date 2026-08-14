import { canonicalizeSMS, parseStrictSingleLine } from './smsAddressParser';

console.log('======================================');
console.log('SMS Address Parser Regression Tests');
console.log('======================================\n');

interface TestCase {
  name: string;
  input: string;
  expectedStreet: string;
  expectedCity: string;
  expectedState: string;
  shouldPass: boolean;
}

const testCases: TestCase[] = [
  {
    name: 'Lowercase address with spaces',
    input: '12780 julian ct broomfield co',
    expectedStreet: '12780 julian ct',
    expectedCity: 'broomfield',
    expectedState: 'CO',
    shouldPass: true
  },
  {
    name: 'Street name containing suffix (Courtland)',
    input: '123 Courtland Ave Charlotte NC',
    expectedStreet: '123 Courtland Ave',
    expectedCity: 'Charlotte',
    expectedState: 'NC',
    shouldPass: true
  },
  {
    name: 'Street name containing suffix (Driveway)',
    input: '456 Driveway Ln Atlanta GA',
    expectedStreet: '456 Driveway Ln',
    expectedCity: 'Atlanta',
    expectedState: 'GA',
    shouldPass: true
  },
  {
    name: 'Normal capitalized address',
    input: '789 Main St Dallas TX',
    expectedStreet: '789 Main St',
    expectedCity: 'Dallas',
    expectedState: 'TX',
    shouldPass: true
  },
  {
    name: 'Address with concatenated street+city',
    input: '4300 Monroe RdCharlotte, NC',
    expectedStreet: '4300 Monroe Rd',
    expectedCity: 'Charlotte',
    expectedState: 'NC',
    shouldPass: true
  }
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`\nTest: ${testCase.name}`);
  console.log(`Input: "${testCase.input}"`);
  
  try {
    const canonical = canonicalizeSMS(testCase.input);
    console.log(`Canonicalized: "${canonical.text}"`);
    
    const parsed = parseStrictSingleLine(canonical.text);
    
    if (parsed) {
      const streetMatch = parsed.street.toLowerCase().trim() === testCase.expectedStreet.toLowerCase().trim();
      const cityMatch = parsed.city.toLowerCase().trim() === testCase.expectedCity.toLowerCase().trim();
      const stateMatch = parsed.state.toUpperCase() === testCase.expectedState.toUpperCase();
      
      if (streetMatch && cityMatch && stateMatch) {
        console.log(`✅ PASSED`);
        console.log(`   Street: "${parsed.street}"`);
        console.log(`   City: "${parsed.city}"`);
        console.log(`   State: "${parsed.state}"`);
        passed++;
      } else {
        console.log(`❌ FAILED - Parsed incorrectly`);
        console.log(`   Expected: ${testCase.expectedStreet}, ${testCase.expectedCity}, ${testCase.expectedState}`);
        console.log(`   Got: ${parsed.street}, ${parsed.city}, ${parsed.state}`);
        failed++;
      }
    } else {
      console.log(`❌ FAILED - Parser returned null`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAILED - Exception: ${error}`);
    failed++;
  }
}

console.log('\n======================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('======================================\n');

if (failed === 0) {
  console.log('✅✅✅ ALL TESTS PASSED!');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED');
  process.exit(1);
}

import { canonicalizeSMS, parseStrictSingleLine } from './smsAddressParser';

console.log('======================================');
console.log('Testing lowercase address parsing fix');
console.log('======================================\n');

// Test case from user: "12780 julian ct broomfield co"
const testInput = "12780 julian ct broomfield co";

console.log(`Input: "${testInput}"\n`);

// Step 1: Test canonicalization
console.log('Step 1: Canonicalization');
const canonical = canonicalizeSMS(testInput);
console.log(`Canonicalized text: "${canonical.text}"`);
console.log(`Has address pattern: ${canonical.hasAddressPattern}\n`);

// Step 2: Test strict parsing
console.log('Step 2: Strict Parsing');
const parsed = parseStrictSingleLine(canonical.text);

if (parsed) {
  console.log('✅ PARSE SUCCESSFUL');
  console.log(`   Street: "${parsed.street}"`);
  console.log(`   City: "${parsed.city}"`);
  console.log(`   State: "${parsed.state}"`);
  console.log(`   ZIP: ${parsed.zip || 'null'}`);
  console.log(`   Parse Method: ${parsed.parseMethod}`);
  
  // Verify correctness
  const expectedStreet = "12780 julian ct";
  const expectedCity = "broomfield";
  const expectedState = "CO";
  
  if (parsed.street.toLowerCase().includes("12780") && 
      parsed.street.toLowerCase().includes("julian") &&
      parsed.city.toLowerCase() === expectedCity &&
      parsed.state.toUpperCase() === expectedState) {
    console.log('\n✅✅✅ TEST PASSED - Address parsed correctly!');
  } else {
    console.log('\n❌ TEST FAILED - Address components incorrect');
    console.log(`   Expected: ${expectedStreet}, ${expectedCity}, ${expectedState}`);
    console.log(`   Got: ${parsed.street}, ${parsed.city}, ${parsed.state}`);
  }
} else {
  console.log('❌ PARSE FAILED - Parser returned null');
  console.log('   This means the canonicalization or strict parsing still needs work');
}

console.log('\n======================================\n');

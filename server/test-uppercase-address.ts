import { canonicalizeSMS, parseStrictSingleLine } from './smsAddressParser';

console.log('======================================');
console.log('Testing uppercase address parsing');
console.log('======================================\n');

const testInput = "4300 MONROE RD CHARLOTTE NC";

console.log(`Input: "${testInput}"\n`);

const canonical = canonicalizeSMS(testInput);
console.log(`Canonicalized: "${canonical.text}"`);
console.log(`Has address pattern: ${canonical.hasAddressPattern}\n`);

const parsed = parseStrictSingleLine(canonical.text);

if (parsed) {
  console.log('✅ PARSE SUCCESSFUL');
  console.log(`   Street: "${parsed.street}"`);
  console.log(`   City: "${parsed.city}"`);
  console.log(`   State: "${parsed.state}"`);
  console.log(`   ZIP: ${parsed.zip || 'null'}`);
  
  if (parsed.street.toLowerCase().includes("monroe") &&
      parsed.city.toLowerCase() === "charlotte" &&
      parsed.state.toUpperCase() === "NC") {
    console.log('\n✅✅✅ UPPERCASE TEST PASSED!');
  } else {
    console.log('\n❌ TEST FAILED');
  }
} else {
  console.log('❌ PARSE FAILED');
}

console.log('\n======================================\n');

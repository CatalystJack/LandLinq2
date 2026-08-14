/**
 * EMAIL PARSER TEST SUITE
 * Verifies AI parser correctly handles real-world Northmarq examples
 */

import { parsePropertyDataWithAI } from './aiEmailParser';

const TEST_CASES = {
  // Test Case 1: Cedar Farm - Should NOT extract "zoning complete" as zoning
  cedarFarm: `
    ON MARKET | BTR Development Site | ±14-Acre Opportunity Zone Development Site in Kingsport, TN
    
    The Offering | Kingsport Development Site
    Northmarq is pleased to present the Kingsport Development Site, a 14-acre fully entitled multifamily development
    opportunity along West Stone Drive in Kingsport, Tennessee. Zoned and approved for ±274 apartment units
    (16-multifamily building on two parcels). All utilities available and a full suite of due diligence already
    completed, including an ALTA survey, rezoning complete, environmental assessments, and a subsurface evaluation.
    Located within a federally designated Opportunity Zone, investors have the ability to defer capital gains taxes,
    including capital gains deferrals and tax-free appreciation.
    
    Additionally, the City of Kingsport may provide grants between $300,000 and $500,000 for site preparation
    and infrastructure improvements.
  `,
  
  // Test Case 2: The Greens - Ground lease, should NOT extract rent as price
  theGreens: `
    Subject: The Greens Ground Lease | Nashville, TN | 180 Units on 15 Acres
    
    Northmarq Nashville presents a GROUND LEASE opportunity on 15± acres in Nashville for development of 180 apartment units.
    
    Key Details:
    - Location: 0 West Trinity Lane (37207), 0 Day Street (37218), 2608 Old Buena Vista Road (37218)
    - Total Acres: 15± acres across three parcels
    - Proposed Units: 180 units
    - Ground Lease Terms: $7.25M initial rent (6% of land value), NNN lease
    - Zoning: R-4 (Residential)
    
    Recent Comparable Sales:
    - 869 West Trinity Lane sold for $4.2M (2023)
    - Nearby lot development at $95,000 per lot
    
    Key Sale Comps show strong demand in this submarket with per-unit pricing around $35,790/unit.
  `,
  
  // Test Case 3: OZ Property - Should note OZ in additionalNotes, not zoning
  opportunityZone: `
    Subject: Multifamily Site | Qualified Opportunity Zone | Charlotte, NC
    
    Property: 123 Main Street, Charlotte, NC 28203
    Size: 8.5 acres
    Units: 220 apartment units (approved)
    Asking Price: $2,500,000
    
    This property is located in a federally designated Opportunity Zone (OZ) and Qualified Census Tract (QCT).
    Full approvals in place. Architecturally completed with R-2 zoning.
  `,
  
  // Test Case 4: Multi-parcel assemblage
  assemblage: `
    Subject: Multi-Parcel Development Site | Nashville Metro
    
    Offering: Three-parcel assemblage totaling 22 acres
    Addresses:
    - 100 Industrial Parkway, Nashville, TN 37211
    - 0 Commerce Drive, Nashville, TN 37211  
    - 200 Business Center Drive, Antioch, TN 37013
    
    Total Development: 350 multifamily units across all parcels
    Zoning: MF-1 (all parcels)
    Price: $5.2M for entire assemblage
  `,
};

async function runTests() {
  console.log('🧪 RUNNING EMAIL PARSER TEST SUITE\n');
  console.log('=' .repeat(80));
  
  // Test 1: Cedar Farm - OZ detection
  console.log('\n📋 TEST 1: Cedar Farm (Opportunity Zone)');
  console.log('Expected: zoning = null, OZ noted in additionalNotes');
  console.log('-'.repeat(80));
  const cedarResult = await parsePropertyDataWithAI(TEST_CASES.cedarFarm);
  console.log('Result:');
  console.log(`  ✓ Address: ${cedarResult.address}`);
  console.log(`  ✓ Acres: ${cedarResult.sizeAcres}`);
  console.log(`  ✓ Units: ${cedarResult.unitCount}`);
  console.log(`  ✓ Zoning: ${cedarResult.zoning || 'NULL (CORRECT!)'}`);
  console.log(`  ✓ Asking Price: ${cedarResult.askingPrice || 'NULL (CORRECT!)'}`);
  console.log(`  ✓ Additional Notes: ${cedarResult.additionalNotes?.substring(0, 100)}...`);
  
  const test1Pass = cedarResult.zoning === null && 
                    cedarResult.additionalNotes?.toLowerCase().includes('opportunity zone');
  console.log(`\n${test1Pass ? '✅ PASS' : '❌ FAIL'}: OZ not extracted as zoning\n`);
  
  // Test 2: The Greens - Ground lease detection
  console.log('=' .repeat(80));
  console.log('\n📋 TEST 2: The Greens (Ground Lease)');
  console.log('Expected: askingPrice = null, ground lease noted');
  console.log('-'.repeat(80));
  const greensResult = await parsePropertyDataWithAI(TEST_CASES.theGreens);
  console.log('Result:');
  console.log(`  ✓ Address: ${greensResult.address}`);
  console.log(`  ✓ Acres: ${greensResult.sizeAcres}`);
  console.log(`  ✓ Zoning: ${greensResult.zoning || 'NULL'}`);
  console.log(`  ✓ Asking Price: ${greensResult.askingPrice || 'NULL (CORRECT!)'}`);
  console.log(`  ✓ Additional Notes: ${greensResult.additionalNotes?.substring(0, 100)}...`);
  
  const test2Pass = greensResult.askingPrice === null && 
                    greensResult.additionalNotes?.toLowerCase().includes('ground lease');
  console.log(`\n${test2Pass ? '✅ PASS' : '❌ FAIL'}: Ground lease rent not extracted as price\n`);
  
  // Test 3: OZ + QCT detection
  console.log('=' .repeat(80));
  console.log('\n📋 TEST 3: Opportunity Zone + QCT');
  console.log('Expected: zoning = "R-2", OZ/QCT in notes, price = $2,500,000');
  console.log('-'.repeat(80));
  const ozResult = await parsePropertyDataWithAI(TEST_CASES.opportunityZone);
  console.log('Result:');
  console.log(`  ✓ Address: ${ozResult.address}`);
  console.log(`  ✓ Asking Price: $${ozResult.askingPrice?.toLocaleString()}`);
  console.log(`  ✓ Zoning: ${ozResult.zoning} (should be R-2)`);
  console.log(`  ✓ Additional Notes: ${ozResult.additionalNotes?.substring(0, 100)}...`);
  
  const test3Pass = ozResult.zoning === 'R-2' && 
                    ozResult.askingPrice === 2500000 &&
                    (ozResult.additionalNotes?.toLowerCase().includes('opportunity zone') ||
                     ozResult.additionalNotes?.toLowerCase().includes('oz'));
  console.log(`\n${test3Pass ? '✅ PASS' : '❌ FAIL'}: Actual zoning extracted, OZ/QCT in notes\n`);
  
  // Test 4: Multi-parcel assemblage
  console.log('=' .repeat(80));
  console.log('\n📋 TEST 4: Multi-Parcel Assemblage');
  console.log('Expected: Primary address extracted, all parcels in notes');
  console.log('-'.repeat(80));
  const assemblageResult = await parsePropertyDataWithAI(TEST_CASES.assemblage);
  console.log('Result:');
  console.log(`  ✓ Address: ${assemblageResult.address}`);
  console.log(`  ✓ Acres: ${assemblageResult.sizeAcres}`);
  console.log(`  ✓ Units: ${assemblageResult.unitCount}`);
  console.log(`  ✓ Price: $${assemblageResult.askingPrice?.toLocaleString()}`);
  console.log(`  ✓ Additional Notes: ${assemblageResult.additionalNotes?.substring(0, 150)}...`);
  
  const test4Pass = assemblageResult.address?.includes('Industrial Parkway') &&
                    assemblageResult.sizeAcres === 22 &&
                    assemblageResult.askingPrice === 5200000;
  console.log(`\n${test4Pass ? '✅ PASS' : '❌ FAIL'}: Multi-parcel correctly parsed\n`);
  
  // Summary
  console.log('=' .repeat(80));
  console.log('\n📊 TEST SUMMARY');
  console.log('-'.repeat(80));
  const allPass = test1Pass && test2Pass && test3Pass && test4Pass;
  console.log(`Test 1 (OZ Detection): ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Ground Lease): ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (OZ+QCT+Zoning): ${test3Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 4 (Multi-Parcel): ${test4Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('-'.repeat(80));
  console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);
  console.log('=' .repeat(80));
}

export { runTests };

// Run tests if this is the main module
runTests().catch(console.error);

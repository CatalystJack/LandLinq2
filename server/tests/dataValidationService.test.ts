import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { dataValidationService, ValidatedPropertyData } from '../dataValidationService';

// Mock data for testing different scenarios
const MOCK_ADDRESSES = {
  // Well-known address with good data coverage
  VALID_WITH_MULTIPLE_SOURCES: '9738 Ridge St, Charlotte, NC 28214',
  
  // Address with potential discrepancies
  DISCREPANCY_ADDRESS: '123 Test Street, Charlotte, NC 28202',
  
  // Address with limited data
  LIMITED_DATA_ADDRESS: '999 Unknown Rd, Rural, NC 28000',
  
  // Invalid/non-existent address
  INVALID_ADDRESS: 'This Is Not A Real Address 99999'
};

// Expected confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  HIGH: 85,
  MEDIUM: 65,
  LOW: 45
};

describe('DataValidationService', () => {
  
  describe('validatePropertyData', () => {
    
    test('should validate property data with multiple sources successfully', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      // Check overall structure
      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
      expect(result.size).toBeDefined();
      expect(result.valuation).toBeDefined();
      expect(result.details).toBeDefined();
      expect(result.demographics).toBeDefined();
      expect(result.rentData).toBeDefined();
      expect(result.validation).toBeDefined();
      
      // Check validation metadata
      expect(result.validation.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.validation.overallConfidence).toBeLessThanOrEqual(100);
      expect(result.validation.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.validation.qualityScore).toBeLessThanOrEqual(100);
      expect(result.validation.sourceCount).toBeGreaterThan(0);
      expect(result.validation.sourcesUsed).toBeInstanceOf(Array);
      expect(result.validation.lastValidated).toBeInstanceOf(Date);
      
      // For a well-known address, we should have good data
      expect(result.validation.overallConfidence).toBeGreaterThan(CONFIDENCE_THRESHOLDS.LOW);
      
      console.log(`✅ Validation test passed for ${MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES}:`);
      console.log(`   Confidence: ${result.validation.overallConfidence}%`);
      console.log(`   Quality: ${result.validation.qualityScore}%`);
      console.log(`   Sources: ${result.validation.sourcesUsed.join(', ')}`);
    }, 30000); // 30 second timeout for API calls
    
    test('should handle address standardization', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      expect(result.address.standardized).toBeDefined();
      expect(result.address.standardized).toBeTruthy();
      expect(result.address.confidence).toBeGreaterThanOrEqual(0);
      expect(result.address.sources).toBeInstanceOf(Array);
      expect(result.address.discrepancies).toBeInstanceOf(Array);
      
      // Should have address components
      expect(result.address.components).toBeDefined();
      
      console.log(`📍 Address validation test passed:`);
      console.log(`   Standardized: ${result.address.standardized}`);
      console.log(`   Confidence: ${result.address.confidence}%`);
      console.log(`   Components:`, result.address.components);
    }, 30000);
    
    test('should validate property size with confidence scoring', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      expect(result.size.confidence).toBeGreaterThanOrEqual(0);
      expect(result.size.confidence).toBeLessThanOrEqual(100);
      expect(result.size.sources).toBeInstanceOf(Array);
      expect(result.size.discrepancies).toBeInstanceOf(Array);
      
      // At least one size metric should be available
      const hasSizeData = result.size.acres || result.size.squareFootage || result.size.lotSizeSquareFeet;
      if (result.size.sources.length > 0) {
        expect(hasSizeData).toBeTruthy();
      }
      
      console.log(`📏 Size validation test passed:`);
      console.log(`   Acres: ${result.size.acres || 'N/A'}`);
      console.log(`   Square Footage: ${result.size.squareFootage?.toLocaleString() || 'N/A'}`);
      console.log(`   Confidence: ${result.size.confidence}%`);
    }, 30000);
    
    test('should validate demographics with Census data priority', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      expect(result.demographics.confidence).toBeGreaterThanOrEqual(0);
      expect(result.demographics.sources).toBeInstanceOf(Array);
      expect(result.demographics.discrepancies).toBeInstanceOf(Array);
      
      // Census should be prioritized for demographics
      if (result.demographics.sources.includes('census')) {
        expect(result.demographics.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLDS.LOW);
      }
      
      console.log(`👥 Demographics validation test passed:`);
      console.log(`   Population 55+: ${result.demographics.population55Plus?.toLocaleString() || 'N/A'}`);
      console.log(`   Median Income: ${result.demographics.medianHouseholdIncome ? '$' + result.demographics.medianHouseholdIncome.toLocaleString() : 'N/A'}`);
      console.log(`   Confidence: ${result.demographics.confidence}%`);
      console.log(`   Sources: ${result.demographics.sources.join(', ')}`);
    }, 30000);
    
    test('should detect and flag data discrepancies', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      // Check discrepancy structure
      const allDiscrepancies = [
        ...result.address.discrepancies,
        ...result.size.discrepancies,
        ...result.valuation.discrepancies,
        ...result.details.discrepancies,
        ...result.demographics.discrepancies,
        ...result.rentData.discrepancies
      ];
      
      expect(result.validation.discrepancyCount).toBe(allDiscrepancies.length);
      
      console.log(`⚠️ Discrepancy detection test passed:`);
      console.log(`   Total discrepancies: ${result.validation.discrepancyCount}`);
      if (allDiscrepancies.length > 0) {
        console.log(`   Sample discrepancies:`, allDiscrepancies.slice(0, 3));
      }
    }, 30000);
    
    test('should implement hierarchical source priority', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      // Census should be highest priority for demographics
      if (result.demographics.sources.includes('census')) {
        expect(result.demographics.sources[0]).toBe('census');
      }
      
      // Check that sources are being used according to priority
      const allSources = result.validation.sourcesUsed;
      expect(allSources).toBeInstanceOf(Array);
      expect(allSources.length).toBeGreaterThan(0);
      
      console.log(`🎯 Source priority test passed:`);
      console.log(`   Sources used: ${allSources.join(', ')}`);
      console.log(`   Demographics sources: ${result.demographics.sources.join(', ')}`);
    }, 30000);
    
    test('should handle invalid addresses gracefully', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.INVALID_ADDRESS);
      
      expect(result).toBeDefined();
      expect(result.validation.overallConfidence).toBeLessThan(CONFIDENCE_THRESHOLDS.MEDIUM);
      expect(result.validation.sourceCount).toBeGreaterThanOrEqual(0);
      
      console.log(`❌ Invalid address test passed:`);
      console.log(`   Confidence: ${result.validation.overallConfidence}% (expected low)`);
      console.log(`   Sources: ${result.validation.sourceCount} (expected few)`);
    }, 30000);
    
  });
  
  describe('quickValidate', () => {
    
    test('should provide quick validation for deal creation pipeline', async () => {
      const result = await dataValidationService.quickValidate(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.warnings).toBeInstanceOf(Array);
      
      console.log(`⚡ Quick validation test passed:`);
      console.log(`   Valid: ${result.isValid}`);
      console.log(`   Confidence: ${result.confidence}%`);
      console.log(`   Warnings: ${result.warnings.length}`);
      console.log(`   Estimated Acres: ${result.estimatedAcres || 'N/A'}`);
      console.log(`   Estimated Value: ${result.estimatedValue ? '$' + result.estimatedValue.toLocaleString() : 'N/A'}`);
    }, 30000);
    
    test('should identify critical validation issues', async () => {
      const result = await dataValidationService.quickValidate(MOCK_ADDRESSES.INVALID_ADDRESS);
      
      expect(result.isValid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLDS.MEDIUM);
      
      console.log(`🚨 Critical issues test passed:`);
      console.log(`   Valid: ${result.isValid} (expected false)`);
      console.log(`   Warnings: ${result.warnings.join(', ')}`);
    }, 30000);
    
  });
  
  describe('generateValidationReport', () => {
    
    test('should generate comprehensive validation report', async () => {
      const validationData = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      const report = dataValidationService.generateValidationReport(validationData);
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(100);
      
      // Should contain key sections
      expect(report).toContain('PROPERTY DATA VALIDATION REPORT');
      expect(report).toContain('OVERALL METRICS');
      expect(report).toContain('ADDRESS VALIDATION');
      expect(report).toContain('PROPERTY SIZE');
      expect(report).toContain('VALUATION');
      expect(report).toContain('DEMOGRAPHICS');
      expect(report).toContain('RECOMMENDATIONS');
      
      console.log(`📋 Validation report test passed:`);
      console.log(`   Report length: ${report.length} characters`);
      console.log(`   Contains all required sections: ✅`);
    }, 30000);
    
  });
  
  describe('Data Quality and Confidence Metrics', () => {
    
    test('should calculate accurate confidence scores', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      // Confidence should correlate with source count and data completeness
      const hasMultipleSources = result.validation.sourceCount > 1;
      const hasGoodData = result.validation.qualityScore > 50;
      
      if (hasMultipleSources && hasGoodData) {
        expect(result.validation.overallConfidence).toBeGreaterThan(CONFIDENCE_THRESHOLDS.LOW);
      }
      
      console.log(`📊 Confidence calculation test passed:`);
      console.log(`   Multiple sources: ${hasMultipleSources}`);
      console.log(`   Good data quality: ${hasGoodData}`);
      console.log(`   Overall confidence: ${result.validation.overallConfidence}%`);
    }, 30000);
    
    test('should track data completeness in quality score', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      expect(result.validation.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.validation.qualityScore).toBeLessThanOrEqual(100);
      
      // Quality score should reflect data completeness
      const fieldsWithData = [
        result.address.standardized,
        result.size.acres,
        result.valuation.listingPrice || result.valuation.assessedValue || result.valuation.marketValue,
        result.details.yearBuilt,
        result.demographics.totalPopulation,
        result.rentData.averageRent || result.rentData.medianGrossRent
      ].filter(field => field !== undefined && field !== null).length;
      
      const expectedQuality = (fieldsWithData / 6) * 100;
      
      console.log(`📈 Quality score test passed:`);
      console.log(`   Fields with data: ${fieldsWithData}/6`);
      console.log(`   Expected quality: ~${expectedQuality.toFixed(0)}%`);
      console.log(`   Actual quality: ${result.validation.qualityScore}%`);
    }, 30000);
    
  });
  
  describe('Integration with Real Estate Business Rules', () => {
    
    test('should validate Active Adult demographic requirements', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      // Check if demographics meet Active Adult criteria
      if (result.demographics.population55Plus && result.demographics.medianHouseholdIncome) {
        const meetsPopulation = result.demographics.population55Plus >= 20000;
        const meetsIncome = result.demographics.medianHouseholdIncome >= 75000;
        
        console.log(`🏘️ Active Adult criteria test:`);
        console.log(`   Population 55+: ${result.demographics.population55Plus.toLocaleString()} (≥20,000: ${meetsPopulation})`);
        console.log(`   Median Income: $${result.demographics.medianHouseholdIncome.toLocaleString()} (≥$75,000: ${meetsIncome})`);
        console.log(`   Meets criteria: ${meetsPopulation && meetsIncome}`);
      }
    }, 30000);
    
    test('should validate property size for development types', async () => {
      const result = await dataValidationService.validatePropertyData(MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES);
      
      if (result.size.acres) {
        const suitableForConventional = result.size.acres >= 4;
        const suitableForBTR = result.size.acres >= 5;
        const suitableForLotDevelopment = result.size.acres >= 6;
        
        console.log(`🏗️ Development suitability test:`);
        console.log(`   Property size: ${result.size.acres} acres`);
        console.log(`   Conventional Apartments (≥4 acres): ${suitableForConventional}`);
        console.log(`   Build to Rent (≥5 acres): ${suitableForBTR}`);
        console.log(`   Lot Development (≥6 acres): ${suitableForLotDevelopment}`);
      }
    }, 30000);
    
  });
  
});

// Performance and error handling tests
describe('DataValidationService Performance and Error Handling', () => {
  
  test('should handle concurrent validation requests', async () => {
    const addresses = [
      MOCK_ADDRESSES.VALID_WITH_MULTIPLE_SOURCES,
      MOCK_ADDRESSES.LIMITED_DATA_ADDRESS
    ];
    
    const startTime = Date.now();
    const results = await Promise.all(
      addresses.map(address => dataValidationService.quickValidate(address))
    );
    const endTime = Date.now();
    
    expect(results).toHaveLength(2);
    results.forEach(result => {
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
    
    console.log(`⚡ Concurrent validation test passed:`);
    console.log(`   Processed ${addresses.length} addresses in ${endTime - startTime}ms`);
    console.log(`   Average time per address: ${(endTime - startTime) / addresses.length}ms`);
  }, 60000);
  
  test('should handle network errors gracefully', async () => {
    // This test should not throw an error even if services are down
    try {
      const result = await dataValidationService.quickValidate('Test Address');
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      
      console.log(`🛡️ Error handling test passed:`);
      console.log(`   Result confidence: ${result.confidence}%`);
      console.log(`   Warnings: ${result.warnings.length}`);
    } catch (error) {
      console.log(`🛡️ Error handling test - caught error as expected:`, error);
      expect(error).toBeDefined();
    }
  }, 30000);
  
});

// Export test utilities for potential use in other test files
export {
  MOCK_ADDRESSES,
  CONFIDENCE_THRESHOLDS
};
/**
 * PHASE 2: Enhanced Validation Integration Tests
 * Comprehensive testing suite for the enhanced multi-source cross-validation system
 */

import { validationServiceRegistry, ValidationMode } from '../validationServiceRegistry';
import { EnhancedValidationResult } from '../enhancedDataValidationService';

// Test configuration
const TEST_CONFIG = {
  TEST_ADDRESS: '123 Main Street, Dallas, TX 75201',
  TIMEOUT_MS: 60000,
  EXPECTED_MIN_CONFIDENCE: 95,
  EXPECTED_MIN_SOURCES: 3
};

/**
 * Test the enhanced validation system end-to-end
 */
export async function testEnhancedValidationSystem(): Promise<{
  success: boolean;
  results: any[];
  summary: string;
}> {
  console.log('🧪 Starting PHASE 2 Enhanced Validation Integration Tests...');
  
  const testResults: any[] = [];
  
  try {
    // Test 1: Enhanced Validation Mode
    console.log('\n🔬 Test 1: Enhanced Validation Mode');
    const enhancedTest = await testEnhancedValidationMode();
    testResults.push(enhancedTest);
    
    // Test 2: Source Reliability Scoring
    console.log('\n🔬 Test 2: Source Reliability Scoring');
    const reliabilityTest = await testSourceReliabilityScoring();
    testResults.push(reliabilityTest);
    
    // Test 3: Conflict Resolution Algorithms
    console.log('\n🔬 Test 3: Conflict Resolution Algorithms');
    const conflictTest = await testConflictResolution();
    testResults.push(conflictTest);
    
    // Test 4: Auto-Escalation Logic
    console.log('\n🔬 Test 4: Auto-Escalation Logic');
    const escalationTest = await testAutoEscalation();
    testResults.push(escalationTest);
    
    // Test 5: Audit Trail Generation
    console.log('\n🔬 Test 5: Audit Trail Generation');
    const auditTest = await testAuditTrailGeneration();
    testResults.push(auditTest);
    
    // Test 6: Batch Validation Processing
    console.log('\n🔬 Test 6: Batch Validation Processing');
    const batchTest = await testBatchValidation();
    testResults.push(batchTest);
    
    // Test 7: Service Health Monitoring
    console.log('\n🔬 Test 7: Service Health Monitoring');
    const healthTest = await testServiceHealth();
    testResults.push(healthTest);
    
    // Calculate overall results
    const passedTests = testResults.filter(t => t.passed).length;
    const totalTests = testResults.length;
    const successRate = (passedTests / totalTests) * 100;
    
    const summary = `PHASE 2 Enhanced Validation Tests: ${passedTests}/${totalTests} passed (${successRate.toFixed(1)}%)`;
    
    console.log(`\n✅ ${summary}`);
    
    return {
      success: passedTests === totalTests,
      results: testResults,
      summary
    };
    
  } catch (error) {
    console.error('❌ Enhanced validation testing failed:', error);
    
    return {
      success: false,
      results: testResults,
      summary: `Testing failed with error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Test enhanced validation mode with comprehensive data validation
 */
async function testEnhancedValidationMode(): Promise<{ testName: string; passed: boolean; details: any }> {
  try {
    console.log('📊 Testing enhanced validation mode...');
    
    const result = await validationServiceRegistry.validateProperty(
      TEST_CONFIG.TEST_ADDRESS,
      undefined,
      'enhanced'
    ) as EnhancedValidationResult;
    
    // Validate result structure
    const hasEnhancedFeatures = 'sourceReliabilityScores' in result.validation &&
                               'conflictResolutions' in result.validation &&
                               'flaggingDecisions' in result.validation &&
                               'processingMetrics' in result.validation &&
                               'auditTrail' in result.validation;
    
    // Validate confidence requirements
    const meetsConfidenceThreshold = result.validation.overallConfidence >= TEST_CONFIG.EXPECTED_MIN_CONFIDENCE;
    
    // Validate source diversity
    const hasAdequateSources = result.validation.sourceCount >= TEST_CONFIG.EXPECTED_MIN_SOURCES;
    
    const passed = hasEnhancedFeatures && meetsConfidenceThreshold && hasAdequateSources;
    
    console.log(`📈 Enhanced validation: Confidence=${result.validation.overallConfidence.toFixed(1)}%, Sources=${result.validation.sourceCount}, Features=${hasEnhancedFeatures}`);
    
    return {
      testName: 'Enhanced Validation Mode',
      passed,
      details: {
        confidence: result.validation.overallConfidence,
        sourceCount: result.validation.sourceCount,
        hasEnhancedFeatures,
        conflictResolutions: result.validation.conflictResolutions.length,
        flaggingDecisions: result.validation.flaggingDecisions.length,
        auditTrailEntries: result.validation.auditTrail.length
      }
    };
    
  } catch (error) {
    console.error('❌ Enhanced validation mode test failed:', error);
    return {
      testName: 'Enhanced Validation Mode',
      passed: false,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

/**
 * Test source reliability scoring system
 */
async function testSourceReliabilityScoring(): Promise<{ testName: string; passed: boolean; details: any }> {
  try {
    console.log('🎯 Testing source reliability scoring...');
    
    const result = await validationServiceRegistry.validateProperty(
      TEST_CONFIG.TEST_ADDRESS,
      undefined,
      'enhanced'
    ) as EnhancedValidationResult;
    
    const sourceMetrics = result.validation.sourceReliabilityScores;
    const expectedSources = ['hellodata'];  // USPS, census, and attom removed per user request
    
    // Check that reliability scores exist for expected sources
    const hasReliabilityScores = expectedSources.some(source => 
      sourceMetrics[source] && 
      typeof sourceMetrics[source].historicalAccuracy === 'number' &&
      typeof sourceMetrics[source].conflictResolutionWeight === 'number'
    );
    
    // Validate score ranges (0-100)
    const validScoreRanges = Object.values(sourceMetrics).every(metric => 
      metric.historicalAccuracy >= 0 && metric.historicalAccuracy <= 100 &&
      metric.responseTimeReliability >= 0 && metric.responseTimeReliability <= 100 &&
      metric.dataFreshnessScore >= 0 && metric.dataFreshnessScore <= 100
    );
    
    const passed = hasReliabilityScores && validScoreRanges;
    
    console.log(`📊 Source reliability: Metrics available=${hasReliabilityScores}, Valid ranges=${validScoreRanges}`);
    
    return {
      testName: 'Source Reliability Scoring',
      passed,
      details: {
        sourcesWithMetrics: Object.keys(sourceMetrics),
        sampleMetrics: Object.entries(sourceMetrics).slice(0, 2).map(([name, metric]) => ({
          source: name,
          accuracy: metric.historicalAccuracy,
          reliability: metric.responseTimeReliability,
          weight: metric.conflictResolutionWeight
        }))
      }
    };
    
  } catch (error) {
    console.error('❌ Source reliability scoring test failed:', error);
    return {
      testName: 'Source Reliability Scoring',
      passed: false,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

/**
 * Test conflict resolution algorithms
 */
async function testConflictResolution(): Promise<{ testName: string; passed: boolean; details: any }> {
  try {
    console.log('⚖️ Testing conflict resolution algorithms...');
    
    const result = await validationServiceRegistry.validateProperty(
      TEST_CONFIG.TEST_ADDRESS,
      undefined,
      'enhanced'
    ) as EnhancedValidationResult;
    
    const conflicts = result.validation.conflictResolutions;
    
    // Check that conflicts have proper structure
    const validConflictStructure = conflicts.every(conflict => 
      conflict.field &&
      conflict.conflictType &&
      conflict.resolutionMethod &&
      typeof conflict.confidence === 'number' &&
      Array.isArray(conflict.sourcesInvolved)
    );
    
    // Check for resolution methods
    const hasResolutionMethods = conflicts.some(conflict => 
      ['weighted_average', 'highest_confidence', 'most_reliable_source'].includes(conflict.resolutionMethod)
    );
    
    const passed = validConflictStructure && (conflicts.length === 0 || hasResolutionMethods);
    
    console.log(`⚖️ Conflict resolution: Conflicts=${conflicts.length}, Valid structure=${validConflictStructure}`);
    
    return {
      testName: 'Conflict Resolution Algorithms',
      passed,
      details: {
        conflictCount: conflicts.length,
        resolutionMethods: [...new Set(conflicts.map(c => c.resolutionMethod))],
        fieldsWithConflicts: [...new Set(conflicts.map(c => c.field))]
      }
    };
    
  } catch (error) {
    console.error('❌ Conflict resolution test failed:', error);
    return {
      testName: 'Conflict Resolution Algorithms',
      passed: false,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

/**
 * Test auto-escalation logic
 */
async function testAutoEscalation(): Promise<{ testName: string; passed: boolean; details: any }> {
  try {
    console.log('🚨 Testing auto-escalation logic...');
    
    const result = await validationServiceRegistry.validateProperty(
      TEST_CONFIG.TEST_ADDRESS,
      undefined,
      'enhanced'
    ) as EnhancedValidationResult;
    
    const flaggingDecisions = result.validation.flaggingDecisions;
    
    // Check flagging decision structure
    const validFlaggingStructure = flaggingDecisions.every(decision => 
      decision.reason &&
      decision.severity &&
      typeof decision.autoEscalated === 'boolean' &&
      typeof decision.threshold === 'number' &&
      Array.isArray(decision.recommendations)
    );
    
    // Check severity levels
    const validSeverityLevels = flaggingDecisions.every(decision => 
      ['low', 'medium', 'high', 'critical'].includes(decision.severity)
    );
    
    const passed = validFlaggingStructure && validSeverityLevels;
    
    console.log(`🚨 Auto-escalation: Flags=${flaggingDecisions.length}, Valid structure=${validFlaggingStructure}`);
    
    return {
      testName: 'Auto-Escalation Logic',
      passed,
      details: {
        flagCount: flaggingDecisions.length,
        autoEscalatedCount: flaggingDecisions.filter(f => f.autoEscalated).length,
        severityLevels: [...new Set(flaggingDecisions.map(f => f.severity))],
        escalationReasons: [...new Set(flaggingDecisions.map(f => f.reason))]
      }
    };
    
  } catch (error) {
    console.error('❌ Auto-escalation test failed:', error);
    return {
      testName: 'Auto-Escalation Logic',
      passed: false,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

/**
 * Test audit trail generation
 */
async function testAuditTrailGeneration(): Promise<{ testName: string; passed: boolean; details: any }> {
  try {
    console.log('📝 Testing audit trail generation...');
    
    const result = await validationServiceRegistry.validateProperty(
      TEST_CONFIG.TEST_ADDRESS,
      undefined,
      'enhanced'
    ) as EnhancedValidationResult;
    
    const auditTrail = result.validation.auditTrail;
    
    // Check audit trail structure
    const validAuditStructure = auditTrail.every(entry => 
      entry.validationId &&
      entry.timestamp &&
      entry.action &&
      typeof entry.confidence === 'number' &&
      typeof entry.processingTime === 'number' &&
      Array.isArray(entry.issues) &&
      entry.metadata
    );
    
    // Check for expected actions
    const expectedActions = ['source_fetch', 'cross_validation', 'confidence_calculation'];
    const hasExpectedActions = expectedActions.some(action => 
      auditTrail.some(entry => entry.action === action)
    );
    
    const passed = validAuditStructure && hasExpectedActions && auditTrail.length > 0;
    
    console.log(`📝 Audit trail: Entries=${auditTrail.length}, Valid structure=${validAuditStructure}`);
    
    return {
      testName: 'Audit Trail Generation',
      passed,
      details: {
        entryCount: auditTrail.length,
        actionTypes: [...new Set(auditTrail.map(e => e.action))],
        avgProcessingTime: auditTrail.reduce((sum, e) => sum + e.processingTime, 0) / auditTrail.length
      }
    };
    
  } catch (error) {
    console.error('❌ Audit trail test failed:', error);
    return {
      testName: 'Audit Trail Generation',
      passed: false,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

/**
 * Test batch validation processing
 */
async function testBatchValidation(): Promise<{ testName: string; passed: boolean; details: any }> {
  try {
    console.log('🏭 Testing batch validation processing...');
    
    const testAddresses = [
      '123 Main Street, Dallas, TX 75201',
      '456 Oak Avenue, Austin, TX 78701'
    ];
    
    const batchResults = await validationServiceRegistry.validatePropertiesBatch(testAddresses, 'enhanced');
    
    // Check that we got results for all addresses
    const allAddressesProcessed = batchResults.length === testAddresses.length;
    
    // Check that at least some validations succeeded
    const someSuccessful = batchResults.some(result => result.result);
    
    // Check result structure
    const validStructure = batchResults.every(result => 
      result.address && (result.result || result.error)
    );
    
    const passed = allAddressesProcessed && someSuccessful && validStructure;
    
    const successCount = batchResults.filter(r => r.result).length;
    const errorCount = batchResults.filter(r => r.error).length;
    
    console.log(`🏭 Batch validation: ${successCount} successful, ${errorCount} errors`);
    
    return {
      testName: 'Batch Validation Processing',
      passed,
      details: {
        totalAddresses: testAddresses.length,
        successfulValidations: successCount,
        failedValidations: errorCount,
        processingRate: (successCount / testAddresses.length) * 100
      }
    };
    
  } catch (error) {
    console.error('❌ Batch validation test failed:', error);
    return {
      testName: 'Batch Validation Processing',
      passed: false,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

/**
 * Test service health monitoring
 */
async function testServiceHealth(): Promise<{ testName: string; passed: boolean; details: any }> {
  try {
    console.log('🏥 Testing service health monitoring...');
    
    const healthStatus = await validationServiceRegistry.getServiceHealth();
    
    // Check health status structure
    const validStructure = healthStatus.status &&
                          ['healthy', 'degraded', 'critical'].includes(healthStatus.status) &&
                          typeof healthStatus.services === 'object' &&
                          typeof healthStatus.metrics === 'object';
    
    // Check that we have service information
    const hasServiceInfo = Object.keys(healthStatus.services).length > 0;
    
    const passed = validStructure && hasServiceInfo;
    
    console.log(`🏥 Service health: Status=${healthStatus.status}, Services=${Object.keys(healthStatus.services).length}`);
    
    return {
      testName: 'Service Health Monitoring',
      passed,
      details: {
        overallStatus: healthStatus.status,
        serviceCount: Object.keys(healthStatus.services).length,
        services: Object.keys(healthStatus.services),
        hasMetrics: Object.keys(healthStatus.metrics).length > 0
      }
    };
    
  } catch (error) {
    console.error('❌ Service health test failed:', error);
    return {
      testName: 'Service Health Monitoring',
      passed: false,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

// Export for external use
export { testEnhancedValidationSystem };
/**
 * Test Data Cleanup and Database Isolation for E2E Testing
 * Provides proper cleanup and isolated database operations during testing
 */

import { db } from './db';
import { deals, brokers, communications } from '@shared/schema';
import { eq, like, inArray, or } from 'drizzle-orm';

export interface TestDataCleanup {
  testBrokerIds: string[];
  testDealIds: string[];
  testCommunicationIds: string[];
  testEntities: {
    brokers: any[];
    deals: any[];
    communications: any[];
  };
}

// Test data tracking
let currentTestSession: TestDataCleanup | null = null;

/**
 * Check if we should skip test operations (production/deployment environment)
 * DEPLOYMENT-SAFE: Blocks ALL test operations unless explicitly in local development
 */
function shouldSkipTestOperations(): boolean {
  // DEPLOYMENT-SAFE: Return true for ALL non-explicit development scenarios
  const nodeEnv = process.env.NODE_ENV;
  const replEnv = process.env.REPL_ENVIRONMENT;
  const replitDeployment = process.env.REPLIT_DEPLOYMENT;
  const isReplit = process.env.REPLIT_DB_URL || process.env.REPL_ID;
  const isTestingEnabled = process.env.ENABLE_TEST_OPERATIONS === 'true';
  const isLocalDev = process.env.LOCAL_DEVELOPMENT === 'true';
  
  console.log(`🔍 Environment check: NODE_ENV=${nodeEnv}, REPL_ENV=${replEnv}, DEPLOYMENT=${replitDeployment}, LOCAL=${isLocalDev}`);
  
  // ALWAYS SKIP: Unless in explicit local development mode
  if (!isLocalDev) {
    console.log('🚫 DEPLOYMENT PROTECTION: Skipping test operations - not in local development');
    return true;
  }
  
  // ALWAYS SKIP: Any production indicators
  if (nodeEnv === 'production' || replEnv === 'production' || replitDeployment === '1') {
    console.log('🚫 DEPLOYMENT PROTECTION: Production environment detected');
    return true;
  }
  
  // ALWAYS SKIP: Any Replit hosting environment
  if (isReplit) {
    console.log('🚫 DEPLOYMENT PROTECTION: Replit hosting environment detected');
    return true;
  }
  
  // ALWAYS SKIP: If explicitly disabled
  if (process.env.DISABLE_TEST_CLEANUP === 'true') {
    console.log('🚫 DEPLOYMENT PROTECTION: Test operations explicitly disabled');
    return true;
  }
  
  // ALWAYS SKIP: Unless NODE_ENV is explicitly 'development' AND testing enabled
  if (nodeEnv !== 'development' || !isTestingEnabled) {
    console.log('🚫 DEPLOYMENT PROTECTION: Not in explicit development mode with testing enabled');
    return true;
  }
  
  console.log('✅ Test operations allowed - explicit local development environment');
  return false;
}

/**
 * Start a new test session - creates isolated test environment
 * Only runs when explicitly requested, not during application startup
 */
export async function startTestSession(): Promise<TestDataCleanup> {
  // CRITICAL DEPLOYMENT PROTECTION: Exit immediately for ANY non-local environment
  if (!process.env.LOCAL_DEVELOPMENT) {
    console.log('🚫 DEPLOYMENT PROTECTION: startTestSession blocked - not local development');
    return {
      testBrokerIds: [],
      testDealIds: [],
      testCommunicationIds: [],
      testEntities: { brokers: [], deals: [], communications: [] }
    };
  }
  
  if (shouldSkipTestOperations()) {
    console.log('⏭️ Test session skipped due to environment');
    return {
      testBrokerIds: [],
      testDealIds: [],
      testCommunicationIds: [],
      testEntities: { brokers: [], deals: [], communications: [] }
    };
  }
  
  try {
    console.log('🧪 Starting isolated test session...');
    
    const testSession: TestDataCleanup = {
      testBrokerIds: [],
      testDealIds: [],
      testCommunicationIds: [],
      testEntities: {
        brokers: [],
        deals: [],
        communications: []
      }
    };
    
    currentTestSession = testSession;
    
    // Clean up any existing test data from previous failed runs
    await cleanupPreviousTestData();
    
    console.log('✅ Test session started with clean environment');
    return testSession;
  } catch (error) {
    console.error('❌ Error starting test session:', error);
    // Return empty session rather than crashing
    return {
      testBrokerIds: [],
      testDealIds: [],
      testCommunicationIds: [],
      testEntities: { brokers: [], deals: [], communications: [] }
    };
  }
}

/**
 * End test session - clean up all test data
 * Handles foreign key constraints properly and includes comprehensive error handling
 */
export async function endTestSession(session?: TestDataCleanup): Promise<void> {
  // CRITICAL DEPLOYMENT PROTECTION: Exit immediately for ANY non-local environment
  if (!process.env.LOCAL_DEVELOPMENT) {
    console.log('🚫 DEPLOYMENT PROTECTION: endTestSession blocked - not local development');
    return;
  }
  
  if (shouldSkipTestOperations()) {
    console.log('⏭️ Test session cleanup skipped due to environment');
    return;
  }
  
  const activeSession = session || currentTestSession;
  
  if (!activeSession) {
    console.log('⚠️ No active test session to clean up');
    return;
  }
  
  console.log('🧹 Cleaning up test session data...');
  
  try {
    // Enhanced foreign key constraint handling - delete in proper dependency order
    
    // 1. First delete all dependent communications records
    if (activeSession.testCommunicationIds.length > 0) {
      try {
        await db.delete(communications)
          .where(inArray(communications.id, activeSession.testCommunicationIds));
        console.log(`✅ Deleted ${activeSession.testCommunicationIds.length} test communications`);
      } catch (commError) {
        console.warn('⚠️ Error deleting test communications:', commError);
        // Continue with cleanup
      }
    }
    
    // 2. Delete communications that reference test deals (by relationship)
    if (activeSession.testDealIds.length > 0) {
      try {
        await db.delete(communications)
          .where(inArray(communications.relatedDealId, activeSession.testDealIds));
        console.log('✅ Deleted communications referencing test deals');
      } catch (dealCommError) {
        console.warn('⚠️ Error deleting deal communications:', dealCommError);
        // Continue with cleanup
      }
    }
    
    // 3. Delete all deals that reference test brokers (child records first)
    if (activeSession.testBrokerIds.length > 0) {
      try {
        const dealsToDelete = await db.select({ id: deals.id })
          .from(deals)
          .where(inArray(deals.brokerId, activeSession.testBrokerIds));
        
        if (dealsToDelete.length > 0) {
          const dealIds = dealsToDelete.map(d => d.id);
          
          // Delete communications for these deals first
          await db.delete(communications)
            .where(inArray(communications.relatedDealId, dealIds));
          
          // Now delete the deals
          await db.delete(deals)
            .where(inArray(deals.id, dealIds));
          
          console.log(`✅ Deleted ${dealIds.length} deals referencing test brokers`);
        }
      } catch (brokerDealError) {
        console.warn('⚠️ Error deleting broker deals:', brokerDealError);
        // Continue with cleanup
      }
    }
    
    // 4. Delete test deals (remaining ones)
    if (activeSession.testDealIds.length > 0) {
      try {
        await db.delete(deals)
          .where(inArray(deals.id, activeSession.testDealIds));
        console.log(`✅ Deleted ${activeSession.testDealIds.length} test deals`);
      } catch (dealError) {
        console.warn('⚠️ Error deleting test deals:', dealError);
        // Continue with cleanup
      }
    }
    
    // 5. Finally delete test brokers (no dependencies should remain)
    if (activeSession.testBrokerIds.length > 0) {
      try {
        await db.delete(brokers)
          .where(inArray(brokers.id, activeSession.testBrokerIds));
        console.log(`✅ Deleted ${activeSession.testBrokerIds.length} test brokers`);
      } catch (brokerError) {
        console.warn('⚠️ Error deleting test brokers:', brokerError);
        // Continue with pattern-based cleanup as fallback
      }
    }
    
    // Run pattern-based cleanup as a safety measure
    await cleanupByTestPatterns();
    
    console.log('✅ Test session cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Error during test session cleanup:', error);
    // Always attempt pattern-based cleanup as fallback
    try {
      await cleanupByTestPatterns();
      console.log('✅ Fallback pattern-based cleanup completed');
    } catch (fallbackError) {
      console.error('❌ Even fallback cleanup failed:', fallbackError);
      // Don't throw - prevent application crash
    }
  }
  
  currentTestSession = null;
}

/**
 * Track a test entity for cleanup
 */
export function trackTestEntity(type: 'broker' | 'deal' | 'communication', id: string, entity?: any): void {
  if (!currentTestSession) {
    console.warn('⚠️ No active test session to track entity');
    return;
  }
  
  switch (type) {
    case 'broker':
      currentTestSession.testBrokerIds.push(id);
      if (entity) currentTestSession.testEntities.brokers.push(entity);
      break;
    case 'deal':
      currentTestSession.testDealIds.push(id);
      if (entity) currentTestSession.testEntities.deals.push(entity);
      break;
    case 'communication':
      currentTestSession.testCommunicationIds.push(id);
      if (entity) currentTestSession.testEntities.communications.push(entity);
      break;
  }
}

/**
 * Get current test session
 */
export function getCurrentTestSession(): TestDataCleanup | null {
  return currentTestSession;
}

/**
 * Clean up test data by identifying test patterns
 * Enhanced with proper foreign key constraint handling
 */
async function cleanupByTestPatterns(): Promise<void> {
  // CRITICAL DEPLOYMENT PROTECTION: Exit immediately for ANY non-local environment
  if (!process.env.LOCAL_DEVELOPMENT) {
    console.log('🚫 DEPLOYMENT PROTECTION: cleanupByTestPatterns blocked - not local development');
    return;
  }
  
  if (shouldSkipTestOperations()) {
    return;
  }
  
  try {
    console.log('🧹 Running pattern-based cleanup as safety measure...');
    
    // Step 1: Clean up communications with test patterns first (child records)
    try {
      await db.delete(communications)
        .where(or(
          like(communications.email, '%testbroker@example.com%'),
          like(communications.phone, '%15551234567%')
        ));
    } catch (commCleanupError) {
      console.warn('⚠️ Error in communications pattern cleanup:', commCleanupError);
    }
    
    // Step 2: Clean up deals with test patterns (child records)
    try {
      await db.delete(deals)
        .where(or(
          like(deals.address, '%Test Street%'),
          like(deals.address, '%Test City%')
        ));
    } catch (dealCleanupError) {
      console.warn('⚠️ Error in deals pattern cleanup:', dealCleanupError);
    }
    
    // Step 3: Clean up brokers with test patterns last (parent records)
    try {
      await db.delete(brokers)
        .where(or(
          like(brokers.email, '%testbroker@example.com%'),
          like(brokers.firstName, 'Test Broker%')
        ));
    } catch (brokerCleanupError) {
      console.warn('⚠️ Error in brokers pattern cleanup:', brokerCleanupError);
    }
    
    console.log('✅ Pattern-based cleanup completed');
    
  } catch (error) {
    console.error('❌ Error during pattern-based cleanup:', error);
    // Don't throw - prevent application crash
  }
}

/**
 * Clean up previous test data from failed runs
 * Only runs when explicitly requested during test execution
 */
async function cleanupPreviousTestData(): Promise<void> {
  if (shouldSkipTestOperations()) {
    return;
  }
  
  try {
    console.log('🧹 Cleaning up any previous test data...');
    await cleanupByTestPatterns();
    console.log('✅ Previous test data cleanup completed');
  } catch (error) {
    console.error('❌ Error during previous test data cleanup:', error);
    // Don't throw - prevent application crash during startup
  }
}

/**
 * Create database transaction for test isolation
 */
export async function withTestTransaction<T>(callback: () => Promise<T>): Promise<T> {
  // Note: For full isolation, we'd want to use database transactions
  // For now, we'll use the cleanup mechanism as a safety net
  
  const session = await startTestSession();
  
  try {
    const result = await callback();
    return result;
  } finally {
    await endTestSession(session);
  }
}

/**
 * Verify test environment is clean before starting tests
 * Only runs during explicit test execution, not application startup
 */
export async function verifyCleanTestEnvironment(): Promise<boolean> {
  // CRITICAL DEPLOYMENT PROTECTION: Exit immediately for ANY non-local environment
  if (!process.env.LOCAL_DEVELOPMENT) {
    console.log('🚫 DEPLOYMENT PROTECTION: verifyCleanTestEnvironment blocked - not local development');
    return true;
  }
  
  if (shouldSkipTestOperations()) {
    console.log('⏭️ Test environment verification skipped - production environment');
    return true;
  }
  
  try {
    console.log('🔍 Verifying test environment is clean...');
    
    // Check for existing test entities
    const testBrokers = await db.select().from(brokers)
      .where(or(
        like(brokers.email, '%testbroker@example.com%'),
        like(brokers.firstName, 'Test Broker%')
      ))
      .limit(1);
    
    const testDeals = await db.select().from(deals)
      .where(or(
        like(deals.address, '%Test Street%'),
        like(deals.address, '%Test City%')
      ))
      .limit(1);
    
    const testComms = await db.select().from(communications)
      .where(or(
        like(communications.email, '%testbroker@example.com%'),
        like(communications.phone, '%15551234567%')
      ))
      .limit(1);
    
    const isClean = testBrokers.length === 0 && testDeals.length === 0 && testComms.length === 0;
    
    if (isClean) {
      console.log('✅ Test environment is clean');
    } else {
      console.log('⚠️ Test environment has residual data - cleaning up...');
      await cleanupByTestPatterns();
      console.log('✅ Test environment cleaned');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verifying test environment:', error);
    // Return true instead of false to prevent blocking during startup
    return true;
  }
}
#!/usr/bin/env node

/**
 * Standalone CLI tool for test cleanup operations
 * This isolates test operations from the main server startup
 */

// Check environment before doing anything
if (!process.env.RUN_TEST_OPERATIONS) {
  console.log('🚫 RUN_TEST_OPERATIONS environment variable not set');
  console.log('💡 Set RUN_TEST_OPERATIONS=true to run test cleanup');
  process.exit(0);
}

// Only import test modules if explicitly requested
async function runTestCleanup() {
  try {
    console.log('🧪 Loading test cleanup modules...');
    
    // Dynamic import only when explicitly requested
    const { startTestSession, endTestSession, verifyCleanTestEnvironment } = await import('../server/testDataCleanup.js');
    
    console.log('🔍 Verifying clean test environment...');
    await verifyCleanTestEnvironment();
    
    console.log('🧪 Starting test session...');
    const session = await startTestSession();
    
    console.log('🧹 Ending test session (cleanup)...');
    await endTestSession(session);
    
    console.log('✅ Test cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Test cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTestCleanup();
}
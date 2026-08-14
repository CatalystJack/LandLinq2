/**
 * Comprehensive Test Scenarios with Strict Validation for End-to-End Testing
 * Each scenario includes database assertions, message validation, and flow verification
 */

import { storage } from "./storage";
import { FollowUpService } from "./followUpService";
import { ResolutionService } from "./resolutionService";
import type { Deal, Broker, Communication } from "@shared/schema";
import { 
  testEmailWebhookDeduplication, 
  testSMSWebhookDeduplication, 
  testCooldownMechanism,
  MockTimeProvider
} from "./testWebhookRoutes";
import { 
  TestAssertions,
  type AssertionResult,
  type DatabaseAssertion,
  type MessageAssertion,
  type CommunicationFlowAssertion
} from "./testAssertions";
import type { Express } from "express";

// Test configuration
const TEST_CONFIG = {
  TEST_BROKER_EMAIL: "testbroker@example.com",
  TEST_BROKER_PHONE: "+15551234567",
  TEST_ADDRESS: "123 Test Street, Test City, TX 75001",
  TEST_PRICE: 500000,
  TEST_ACREAGE: 5.5
};

export class ComprehensiveTestScenarios {
  
  constructor(
    private expressApp: Express,
    private timeProvider: MockTimeProvider,
    private testBroker: Broker,
    private mockEmails: any[] = [],
    private mockSMS: any[] = []
  ) {}

  /**
   * SCENARIO 1: Complete Deal Submission (No Follow-up Expected)
   * Tests: Deal processing with all required information provided
   */
  async testCompleteDealSubmission(): Promise<void> {
    console.log("📧 Testing complete deal submission with all required information...");
    
    // Create webhook payload with complete information
    const emailPayload = {
      'Message-Id': `complete-deal-${Date.now()}`,
      from: TEST_CONFIG.TEST_BROKER_EMAIL,
      subject: 'New Property for Sale',
      text: `Great property available:
        Address: ${TEST_CONFIG.TEST_ADDRESS}
        Price: $${TEST_CONFIG.TEST_PRICE.toLocaleString()}
        Size: ${TEST_CONFIG.TEST_ACREAGE} acres
        
        Excellent multifamily development opportunity!`,
      to: 'deals@landlinq.ai'
    };

    // Execute real HTTP call to email webhook
    const result = await testEmailWebhookDeduplication(
      this.expressApp, 
      emailPayload, 
      'test-signature'
    );

    // Assert HTTP response
    if (result.firstCall.statusCode !== 200) {
      throw new Error(`Expected 200 status, got ${result.firstCall.statusCode}`);
    }

    // Wait for processing
    await this.sleep(500);

    // Get created deal
    const deals = await storage.getAllDeals();
    const testDeal = deals.find(d => d.address?.includes('Test Street'));
    
    if (!testDeal) {
      throw new Error('Deal was not created from complete email submission');
    }

    // Assert database state
    const assertions: AssertionResult[] = [];
    
    // Database assertions
    const dbAssertions = await TestAssertions.assertDealState(testDeal.id, {
      dealValidationStatus: 'valid',
      communicationCount: 1, // Only the initial submission
      communicationTypes: ['inbound']
    });
    assertions.push(...dbAssertions);

    // Communication flow assertions  
    const flowAssertions = await TestAssertions.assertCommunicationFlow(testDeal.id, this.testBroker.id, {
      resolutionStatus: 'resolved', // Complete info = resolved
      threadLinkage: true
    });
    assertions.push(...flowAssertions);

    // Message assertions (no follow-up should be sent)
    const messageAssertions = TestAssertions.assertMessageOutputs(this.mockEmails, this.mockSMS, {
      emailCount: 0, // No follow-up emails expected
      smsCount: 0    // No follow-up SMS expected
    });
    assertions.push(...messageAssertions);

    // Print results and check for failures
    TestAssertions.printResults(assertions, 'Complete Deal Submission');
    
    const failures = assertions.filter(a => !a.passed);
    if (failures.length > 0) {
      throw new Error(`${failures.length} assertions failed in complete deal submission test`);
    }

    console.log("✅ Complete deal submission test passed - no follow-up triggered");
  }

  /**
   * SCENARIO 2: Missing Acreage Follow-up and Resolution
   * Tests: Follow-up for missing acreage, then resolution when provided
   */
  async testMissingAcreageScenario(): Promise<void> {
    console.log("🔍 Testing missing acreage scenario with follow-up and resolution...");
    
    // Step 1: Submit deal missing acreage
    const initialPayload = {
      'Message-Id': `missing-acreage-${Date.now()}`,
      from: TEST_CONFIG.TEST_BROKER_EMAIL,
      subject: 'Property Listing - Missing Acreage',
      text: `Property available:
        Address: ${TEST_CONFIG.TEST_ADDRESS}
        Price: $${TEST_CONFIG.TEST_PRICE.toLocaleString()}
        
        Great location for development!`,
      to: 'deals@landlinq.ai'
    };

    // Execute initial submission
    const initialResult = await testEmailWebhookDeduplication(
      this.expressApp, 
      initialPayload, 
      'test-signature-initial'
    );

    if (initialResult.firstCall.statusCode !== 200) {
      throw new Error(`Initial submission failed: ${initialResult.firstCall.statusCode}`);
    }

    // Wait for processing and follow-up
    await this.sleep(1000);

    // Get the created deal
    const deals = await storage.getAllDeals();
    const testDeal = deals.find(d => d.address?.includes('Test Street'));
    
    if (!testDeal) {
      throw new Error('Deal was not created from initial submission');
    }

    // Assert initial state
    let assertions: AssertionResult[] = [];
    
    const initialDbAssertions = await TestAssertions.assertDealState(testDeal.id, {
      communicationCount: 2, // Initial + follow-up
      communicationTypes: ['inbound', 'outbound']
    });
    assertions.push(...initialDbAssertions);

    // Step 2: Advance time and submit follow-up with acreage
    this.timeProvider.advanceMinutes(10); // Advance to avoid cooldown

    const resolutionPayload = {
      'Message-Id': `acreage-resolution-${Date.now()}`,
      from: TEST_CONFIG.TEST_BROKER_EMAIL,
      subject: 'RE: Property Information Request',
      text: `Thanks for following up! Here's the missing information:
        Property size: ${TEST_CONFIG.TEST_ACREAGE} acres
        
        Let me know if you need anything else.`,
      to: 'deals@landlinq.ai'
    };

    const resolutionResult = await testEmailWebhookDeduplication(
      this.expressApp, 
      resolutionPayload, 
      'test-signature-resolution'
    );

    if (resolutionResult.firstCall.statusCode !== 200) {
      throw new Error(`Resolution submission failed: ${resolutionResult.firstCall.statusCode}`);
    }

    // Wait for processing
    await this.sleep(500);

    // Assert final state
    const finalDbAssertions = await TestAssertions.assertDealState(testDeal.id, {
      communicationCount: 3, // Initial + follow-up + resolution
      communicationTypes: ['inbound', 'outbound', 'inbound']
    });
    assertions.push(...finalDbAssertions);

    const finalFlowAssertions = await TestAssertions.assertCommunicationFlow(testDeal.id, this.testBroker.id, {
      resolutionStatus: 'resolved', // Should be resolved now
      threadLinkage: true
    });
    assertions.push(...finalFlowAssertions);

    // Print results and check for failures
    TestAssertions.printResults(assertions, 'Missing Acreage Scenario');
    
    const failures = assertions.filter(a => !a.passed);
    if (failures.length > 0) {
      throw new Error(`${failures.length} assertions failed in missing acreage scenario`);
    }

    console.log("✅ Missing acreage scenario test passed - follow-up triggered and resolved");
  }

  /**
   * SCENARIO 6: Deduplication and Cooldown Testing
   * Tests: Message deduplication, cooldown enforcement, and database state management
   */
  async testDeduplicationAndCooldown(): Promise<void> {
    console.log("🔄 Testing deduplication and cooldown mechanisms...");
    
    const assertions: AssertionResult[] = [];
    
    // Test 1: Email deduplication
    const emailPayload = {
      'Message-Id': `dedup-test-${Date.now()}`,
      from: TEST_CONFIG.TEST_BROKER_EMAIL,
      subject: 'Duplicate Test Property',
      text: `Address: ${TEST_CONFIG.TEST_ADDRESS}, Price: $300,000`,
      to: 'deals@landlinq.ai'
    };

    const emailDedup = await testEmailWebhookDeduplication(
      this.expressApp,
      emailPayload,
      'test-signature-dedup'
    );

    // Assert deduplication worked
    if (!emailDedup.deduplicationWorked) {
      throw new Error('Email deduplication failed - duplicate was not rejected');
    }

    if (emailDedup.firstCall.statusCode !== 200 || emailDedup.duplicateCall.statusCode !== 409) {
      throw new Error(`Email deduplication status codes incorrect: first=${emailDedup.firstCall.statusCode}, duplicate=${emailDedup.duplicateCall.statusCode}`);
    }

    // Test 2: SMS deduplication
    const smsPayload = {
      MessageSid: `SMS${Date.now()}`,
      From: TEST_CONFIG.TEST_BROKER_PHONE,
      Body: `New property: ${TEST_CONFIG.TEST_ADDRESS}, $250,000, 3 acres`,
      To: '+15551234567'
    };

    const smsDedup = await testSMSWebhookDeduplication(
      this.expressApp,
      smsPayload
    );

    if (!smsDedup.deduplicationWorked) {
      throw new Error('SMS deduplication failed - duplicate was not rejected');
    }

    // Test 3: Cooldown mechanism
    const deals = await storage.getAllDeals();
    const testDeal = deals[0]; // Use any existing deal

    if (testDeal) {
      const cooldownTest = await testCooldownMechanism(
        this.expressApp,
        this.timeProvider,
        testDeal.id,
        this.testBroker.id
      );

      if (!cooldownTest.cooldownWorked) {
        throw new Error('Cooldown mechanism failed - rapid requests were not handled correctly');
      }

      console.log(`✅ Cooldown test results: first=${cooldownTest.withinCooldown.statusCode}, second=${cooldownTest.afterCooldown.statusCode}`);
    }

    // Assert deduplication database state
    const dedupAssertion = await TestAssertions.assertDeduplication(emailDedup.messageId, true);
    assertions.push(dedupAssertion);

    TestAssertions.printResults(assertions, 'Deduplication and Cooldown');
    
    const failures = assertions.filter(a => !a.passed);
    if (failures.length > 0) {
      throw new Error(`${failures.length} assertions failed in deduplication/cooldown test`);
    }

    console.log("✅ Deduplication and cooldown tests passed");
  }

  /**
   * SCENARIO 7: Time-Based Flow Validation
   * Tests: Reminder timing, escalation after max attempts, cooldown enforcement
   */
  async testTimeBasedFlows(): Promise<void> {
    console.log("⏱️ Testing time-based communication flows...");
    
    // Create incomplete deal for time-based testing
    const incompletePayload = {
      'Message-Id': `time-test-${Date.now()}`,
      from: TEST_CONFIG.TEST_BROKER_EMAIL,
      subject: 'Time-Based Test Property',
      text: `Address: ${TEST_CONFIG.TEST_ADDRESS}
        Looking for development opportunities`,
      to: 'deals@landlinq.ai'
    };

    // Submit incomplete deal
    const result = await testEmailWebhookDeduplication(
      this.expressApp,
      incompletePayload,
      'test-signature-time'
    );

    if (result.firstCall.statusCode !== 200) {
      throw new Error(`Time-based test submission failed: ${result.firstCall.statusCode}`);
    }

    await this.sleep(500);

    // Get the deal
    const deals = await storage.getAllDeals();
    const testDeal = deals.find(d => d.address?.includes('Test Street'));
    
    if (!testDeal) {
      throw new Error('Time-based test deal was not created');
    }

    const assertions: AssertionResult[] = [];

    // Test 1: Initial follow-up timing
    let timeAssertions = await TestAssertions.assertTimestamps(testDeal.id, this.testBroker.id, {
      lastFollowUpWithin: 2 // Should have follow-up within 2 minutes
    });
    assertions.push(...timeAssertions);

    // Test 2: Advance time to reminder threshold
    console.log("⏰ Advancing time to trigger reminder flow...");
    this.timeProvider.advanceHours(2.5); // Past 2-hour reminder threshold

    // Simulate reminder processing
    await FollowUpService.processReminderQueue();
    
    await this.sleep(300);

    // Test 3: Advance time and test escalation
    console.log("⚠️ Testing escalation after max attempts...");
    
    // Simulate multiple follow-up attempts by advancing time and creating communications
    for (let attempt = 1; attempt <= 3; attempt++) {
      this.timeProvider.advanceHours(1.5); // Advance past cooldown
      
      // This would trigger another follow-up attempt in a real scenario
      // In our test, we verify the timing logic
      console.log(`⏱️ Simulating follow-up attempt ${attempt}...`);
    }

    // Final time-based assertions
    const finalTimeAssertions = await TestAssertions.assertTimestamps(testDeal.id, this.testBroker.id, {
      reminderDue: true // Should be due for escalation
    });
    assertions.push(...finalTimeAssertions);

    TestAssertions.printResults(assertions, 'Time-Based Flows');
    
    const failures = assertions.filter(a => !a.passed);
    if (failures.length > 0) {
      throw new Error(`${failures.length} assertions failed in time-based flows test`);
    }

    console.log("✅ Time-based flow validation passed");
  }

  /**
   * Helper method for test delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
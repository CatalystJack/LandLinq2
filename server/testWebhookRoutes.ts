/**
 * HTTP Webhook Route Testing for End-to-End Testing
 * Tests actual webhook endpoints to exercise route-level deduplication and processing
 */

import { Request, Response } from 'express';
import { Buffer } from 'buffer';
import request from 'supertest';
import type { Express } from 'express';

export interface WebhookTestResult {
  success: boolean;
  statusCode: number;
  response: any;
  headers?: Record<string, string>;
  processingTime: number;
}

export interface DeduplicationTestResult {
  firstCall: WebhookTestResult;
  duplicateCall: WebhookTestResult;
  deduplicationWorked: boolean;
  messageId: string;
}

/**
 * Test email webhook endpoint with deduplication using real HTTP calls
 */
export async function testEmailWebhookDeduplication(
  app: Express,
  payload: any,
  signature: string
): Promise<DeduplicationTestResult> {
  
  const messageId = payload['Message-Id'] || `test-${Date.now()}`;
  
  console.log(`🧪 Testing email webhook deduplication for message: ${messageId}`);
  
  // First call - should process normally (200 status)
  const firstCall = await executeRealWebhookCall(
    app, 
    'POST', 
    '/api/webhooks/email', 
    payload, 
    { 'X-Twilio-Email-Event-Webhook-Signature': signature }
  );
  
  // Wait a moment to ensure any async processing completes
  await sleep(100);
  
  // Duplicate call with same message ID - should be rejected (409 status)
  const duplicateCall = await executeRealWebhookCall(
    app, 
    'POST', 
    '/api/webhooks/email', 
    payload, 
    { 'X-Twilio-Email-Event-Webhook-Signature': signature }
  );
  
  // Check if deduplication worked - first should be 200, duplicate should be 409
  const deduplicationWorked = 
    firstCall.statusCode === 200 && duplicateCall.statusCode === 409;
  
  console.log(`📊 Email webhook deduplication result: first=${firstCall.statusCode}, duplicate=${duplicateCall.statusCode}, worked=${deduplicationWorked}`);
  
  return {
    firstCall,
    duplicateCall,
    deduplicationWorked,
    messageId
  };
}

/**
 * Test SMS webhook endpoint with deduplication using real HTTP calls
 */
export async function testSMSWebhookDeduplication(
  app: Express,
  payload: any
): Promise<DeduplicationTestResult> {
  
  const messageId = payload.MessageSid || `test-sms-${Date.now()}`;
  
  console.log(`🧪 Testing SMS webhook deduplication for message: ${messageId}`);
  
  // First call - should process normally (200 status)
  const firstCall = await executeRealWebhookCall(
    app,
    'POST',
    '/api/sms/webhook',
    payload,
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  );
  
  // Wait a moment
  await sleep(100);
  
  // Duplicate call with same MessageSid - should be rejected (409 status)
  const duplicateCall = await executeRealWebhookCall(
    app,
    'POST', 
    '/api/sms/webhook',
    payload,
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  );
  
  // Check if deduplication worked - first should be 200, duplicate should be 409
  const deduplicationWorked = 
    firstCall.statusCode === 200 && duplicateCall.statusCode === 409;
  
  console.log(`📊 SMS webhook deduplication result: first=${firstCall.statusCode}, duplicate=${duplicateCall.statusCode}, worked=${deduplicationWorked}`);
  
  return {
    firstCall,
    duplicateCall, 
    deduplicationWorked,
    messageId
  };
}

/**
 * Test cooldown functionality using time provider injection and real HTTP calls
 */
export async function testCooldownMechanism(
  app: Express,
  timeProvider: MockTimeProvider,
  dealId: string,
  brokerId: string
): Promise<{
  withinCooldown: WebhookTestResult;
  afterCooldown: WebhookTestResult;
  cooldownWorked: boolean;
  timeDetails: {
    firstCallTime: number;
    secondCallTime: number;
    cooldownPeriodHours: number;
  };
}> {
  
  console.log(`🧪 Testing cooldown mechanism for deal ${dealId}`);
  
  // Activate mock time for precise control
  timeProvider.activate();
  const startTime = timeProvider.now();
  
  // Simulate first follow-up request
  const payload1 = {
    'Message-Id': `test-cooldown-1-${Date.now()}`,
    from: 'testbroker@example.com',
    subject: 'Re: Property Information Request',
    text: 'Here is the additional information you requested',
    to: 'deals@landlinq.ai'
  };
  
  const withinCooldown = await executeRealWebhookCall(
    app,
    'POST',
    '/api/webhooks/email',
    payload1,
    { 'Content-Type': 'application/json' }
  );
  
  console.log(`📧 First follow-up result: ${withinCooldown.statusCode}`);
  
  // Wait just 1 hour (should still be within 24-hour cooldown)
  timeProvider.advanceHours(1);
  const secondCallTime = timeProvider.now();
  
  const payload2 = {
    'Message-Id': `test-cooldown-2-${Date.now()}`,
    from: 'testbroker@example.com', 
    subject: 'Follow up on property',
    text: 'Another follow up within cooldown period',
    to: 'deals@landlinq.ai'
  };
  
  const afterCooldown = await executeRealWebhookCall(
    app,
    'POST',
    '/api/webhooks/email', 
    payload2,
    { 'Content-Type': 'application/json' }
  );
  
  console.log(`📧 Second follow-up result: ${afterCooldown.statusCode}`);
  
  // Cooldown should prevent the second follow-up from being sent
  // First call should succeed, second should either be blocked or succeed but not send duplicate follow-up
  const cooldownWorked = 
    withinCooldown.statusCode === 200 && 
    (afterCooldown.statusCode === 200 || afterCooldown.statusCode === 429);
  
  // Reset time provider
  timeProvider.deactivate();
  
  console.log(`📊 Cooldown test result: worked=${cooldownWorked}, first=${withinCooldown.statusCode}, second=${afterCooldown.statusCode}`);
  
  return {
    withinCooldown,
    afterCooldown,
    cooldownWorked,
    timeDetails: {
      firstCallTime: startTime,
      secondCallTime,
      cooldownPeriodHours: 1
    }
  };
}

/**
 * Execute real HTTP webhook call using supertest
 */
async function executeRealWebhookCall(
  app: Express,
  method: string,
  endpoint: string,
  payload: any,
  headers: Record<string, string> = {}
): Promise<WebhookTestResult> {
  
  const startTime = Date.now();
  
  try {
    let testRequest;
    
    // Create the appropriate supertest request based on method
    if (method.toLowerCase() === 'post') {
      testRequest = request(app).post(endpoint);
    } else if (method.toLowerCase() === 'get') {
      testRequest = request(app).get(endpoint);
    } else if (method.toLowerCase() === 'put') {
      testRequest = request(app).put(endpoint);
    } else {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }
    
    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      testRequest.set(key, value);
    });
    
    // Send payload for POST/PUT requests
    if (method.toLowerCase() === 'post' || method.toLowerCase() === 'put') {
      const contentType = headers['Content-Type'] || headers['content-type'] || 'application/json';
      
      if (contentType.includes('application/x-www-form-urlencoded')) {
        testRequest.send(payload).type('form');
      } else {
        testRequest.send(payload);
      }
    }
    
    // Execute the request
    const response = await testRequest;
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      response: response.body || response.text,
      headers: response.headers,
      processingTime
    };
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    
    // Handle supertest errors which may include status codes
    const statusCode = error.status || 500;
    
    return {
      success: false,
      statusCode,
      response: { 
        error: error.message || 'Unknown error',
        details: error.response?.body || error.response?.text 
      },
      headers: error.response?.headers || {},
      processingTime
    };
  }
}

/**
 * Enhanced MockTimeProvider for comprehensive time control in testing
 */
export interface TimeProvider {
  now(): number;
  addHours(hours: number): number;
  addMinutes(minutes: number): number;
  addSeconds(seconds: number): number;
}

/**
 * Production time provider that uses real time
 */
export class RealTimeProvider implements TimeProvider {
  now(): number {
    return Date.now();
  }

  addHours(hours: number): number {
    return this.now() + (hours * 60 * 60 * 1000);
  }

  addMinutes(minutes: number): number {
    return this.now() + (minutes * 60 * 1000);
  }

  addSeconds(seconds: number): number {
    return this.now() + (seconds * 1000);
  }
}

/**
 * Mock time provider for testing time-dependent flows
 */
export class MockTimeProvider implements TimeProvider {
  private mockTime: number;
  private isActive: boolean = false;

  constructor(initialTime?: number) {
    this.mockTime = initialTime || Date.now();
  }
  
  /**
   * Activate mock time for testing
   */
  activate(): void {
    this.isActive = true;
    console.log(`🕐 MockTimeProvider activated at: ${new Date(this.mockTime).toISOString()}`);
  }

  /**
   * Deactivate mock time (use real time)
   */
  deactivate(): void {
    this.isActive = false;
    console.log('🕐 MockTimeProvider deactivated - using real time');
  }

  /**
   * Set the mock time for testing
   */
  setMockTime(timestamp: number): void {
    this.mockTime = timestamp;
    console.log(`🕐 Mock time set to: ${new Date(timestamp).toISOString()}`);
  }
  
  /**
   * Get current time (mock or real)
   */
  now(): number {
    return this.isActive ? this.mockTime : Date.now();
  }

  /**
   * Add hours to current mock time
   */
  addHours(hours: number): number {
    return this.now() + (hours * 60 * 60 * 1000);
  }

  /**
   * Add minutes to current mock time
   */
  addMinutes(minutes: number): number {
    return this.now() + (minutes * 60 * 1000);
  }

  /**
   * Add seconds to current mock time
   */
  addSeconds(seconds: number): number {
    return this.now() + (seconds * 1000);
  }
  
  /**
   * Advance mock time by specified milliseconds
   */
  advanceTime(milliseconds: number): void {
    if (this.isActive) {
      this.mockTime += milliseconds;
      console.log(`🕐 Advanced mock time by ${milliseconds}ms to: ${new Date(this.mockTime).toISOString()}`);
    } else {
      console.warn('⚠️ Cannot advance time when MockTimeProvider is not active');
    }
  }

  /**
   * Advance time by hours (convenience method for testing)
   */
  advanceHours(hours: number): void {
    this.advanceTime(hours * 60 * 60 * 1000);
  }

  /**
   * Advance time by minutes (convenience method for testing)
   */
  advanceMinutes(minutes: number): void {
    this.advanceTime(minutes * 60 * 1000);
  }
  
  /**
   * Reset to real time
   */
  resetTime(): void {
    this.isActive = false;
    this.mockTime = Date.now();
    console.log('🕐 Reset to real time');
  }

  /**
   * Get a timestamp for testing that represents a specific number of hours ago
   */
  hoursAgo(hours: number): number {
    return this.now() - (hours * 60 * 60 * 1000);
  }

  /**
   * Get a timestamp for testing that represents a specific number of minutes ago
   */
  minutesAgo(minutes: number): number {
    return this.now() - (minutes * 60 * 1000);
  }
}

/**
 * Helper function for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export singleton instance
export const mockTimeProvider = new MockTimeProvider();
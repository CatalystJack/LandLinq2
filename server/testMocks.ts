/**
 * Test Mocks and Doubles for E2E Testing
 * Prevents real email/SMS communications during testing
 */

export interface MockEmailNotification {
  to: string;
  subject: string;
  html: string;
  type: string;
  priority?: string;
}

export interface MockSMSParams {
  to: string;
  message: string;
}

// Mock storage for test communications
let mockEmailsSent: MockEmailNotification[] = [];
let mockSMSSent: MockSMSParams[] = [];

// Test mode flag - set by test environment
let isTestMode = false;

// Force disable test mode on startup to ensure emails work
console.log('🔧 Initializing email system: disabling test mode to ensure real email delivery');
isTestMode = false;

/**
 * Enable test mode - all communications will be mocked
 */
export function enableTestMode(): void {
  isTestMode = true;
  mockEmailsSent = [];
  mockSMSSent = [];
  console.log('🧪 Test mode ENABLED - all communications will be mocked');
}

/**
 * Disable test mode - restore normal communications
 */
export function disableTestMode(): void {
  isTestMode = false;
  console.log('🧪 Test mode DISABLED - normal communications restored');
}

/**
 * Check if currently in test mode
 */
export function isInTestMode(): boolean {
  return isTestMode;
}

/**
 * Mock email service - replaces sendNotificationEmail during tests
 */
export async function mockSendNotificationEmail(notification: MockEmailNotification): Promise<boolean> {
  if (!isTestMode) {
    throw new Error('mockSendNotificationEmail should only be called in test mode');
  }
  
  mockEmailsSent.push(notification);
  console.log(`📧 [TEST MOCK] Email captured: ${notification.to} - ${notification.subject}`);
  return true;
}

/**
 * Mock SMS service - replaces sendSMS during tests
 */
export async function mockSendSMS(params: MockSMSParams): Promise<boolean> {
  if (!isTestMode) {
    throw new Error('mockSendSMS should only be called in test mode');
  }
  
  mockSMSSent.push(params);
  console.log(`📱 [TEST MOCK] SMS captured: ${params.to} - ${params.message.substring(0, 50)}...`);
  return true;
}

/**
 * Get all mocked emails sent during testing
 */
export function getMockedEmails(): MockEmailNotification[] {
  return [...mockEmailsSent];
}

/**
 * Get all mocked SMS sent during testing
 */
export function getMockedSMS(): MockSMSParams[] {
  return [...mockSMSSent];
}

/**
 * Clear all mocked communications
 */
export function clearMockedCommunications(): void {
  mockEmailsSent = [];
  mockSMSSent = [];
  console.log('🧪 Cleared all mocked communications');
}

/**
 * Get test statistics
 */
export function getTestCommunicationStats(): {
  emailsSent: number;
  smsSent: number;
  totalCommunications: number;
} {
  return {
    emailsSent: mockEmailsSent.length,
    smsSent: mockSMSSent.length,
    totalCommunications: mockEmailsSent.length + mockSMSSent.length
  };
}
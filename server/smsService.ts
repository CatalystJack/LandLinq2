import twilio from 'twilio';
import { getAnalystInfo } from './landLinqTemplates';
import { TemplateService, TemplateVariables } from './templateService';
import { apiCallTracker } from './apiCallTracker.js';

// Initialize Twilio client
let twilioClient: any = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export interface SMSParams {
  to: string;
  message: string;
  brokerOverride?: any; // Optional: if provided, skips database fetch for opt-in check
}

/**
 * Structured return type for sendSMS to provide delivery status, tracking info, and error details
 */
export interface SendSMSResult {
  success: boolean;        // Overall operation succeeded (no errors)
  delivered: boolean;      // Message actually sent to Twilio (false for opt-outs, invalid numbers, simulations)
  sid?: string;           // Twilio message SID (for tracking/auditing)
  mode?: 'live' | 'simulated' | 'test' | 'opted_out';  // How the message was handled
  error?: string;         // Error message if failed
  reason?: string;        // Additional context (e.g., "invalid_phone_format", "opted_out")
}

/**
 * Normalizes phone number to E.164 format (+1XXXXXXXXXX)
 * Handles various input formats:
 * - "7834744399" → "+17834744399"
 * - "(783) 474-4399" → "+17834744399"
 * - "+17834744399" → "+17834744399" (already normalized)
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If it's already 11 digits starting with 1, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // If it's 10 digits, add +1 prefix
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // Return original if it already starts with +1
  if (phone.startsWith('+1')) {
    return phone.replace(/\s/g, '');
  }
  
  // Can't normalize - return original
  return phone;
}

/**
 * Validates if a phone number is in valid E.164 format
 * Must be +1 followed by 10 digits (US format)
 */
function isValidPhoneNumber(phone: string): boolean {
  // Remove any whitespace
  const cleaned = phone.replace(/\s/g, '');
  
  // Check if it matches E.164 format for US numbers: +1 followed by exactly 10 digits
  const e164Regex = /^\+1\d{10}$/;
  return e164Regex.test(cleaned);
}

export async function sendSMS(params: SMSParams): Promise<SendSMSResult> {
  const startTime = Date.now();
  
  try {
    // MASTER MESSAGING TOGGLE CHECK (Dec 16, 2025)
    // If master messaging is OFF, block ALL SMS
    try {
      const { storage } = await import('./storage');
      const settings = await storage.getBusinessSettings();
      const masterEnabled = (settings as any)?.outreachMasterEnabled !== false;
      
      if (!masterEnabled) {
        console.log('🚫 [SMS-BLOCKED] Master Messaging is OFF - SMS not sent');
        console.log(`   To: ${params.to}`);
        console.log(`   Message: ${params.message?.substring(0, 50)}...`);
        return {
          success: true,  // Not an error, just blocked by toggle
          delivered: false,
          mode: 'simulated',
          reason: 'master_messaging_disabled'
        };
      }
    } catch (toggleError) {
      // If we can't check the toggle, fail open (allow sending) to not break critical notifications
      console.warn('⚠️ [SMS] Could not check master toggle, proceeding with send:', toggleError);
    }
    
    // AUTO-NORMALIZE phone number to E.164 format (+1XXXXXXXXXX)
    // This handles brokers who enter phone without +1 prefix
    const normalizedPhone = normalizePhoneNumber(params.to);
    
    if (normalizedPhone !== params.to) {
      console.log(`📱 [PHONE-NORMALIZE] Converted "${params.to}" → "${normalizedPhone}"`);
    }
    
    // Validate phone number format
    if (!isValidPhoneNumber(normalizedPhone)) {
      console.warn(`⚠️ SMS not sent - invalid phone number format: ${params.to}`);
      console.warn(`   After normalization: ${normalizedPhone}`);
      console.warn(`   Expected format: +1XXXXXXXXXX (11 digits total)`);
      return {
        success: true,  // No error occurred, just invalid format
        delivered: false,
        mode: 'simulated',
        reason: 'invalid_phone_format',
        error: `Invalid phone format: ${params.to}`
      };
    }
    
    // Use normalized phone number for all operations
    params.to = normalizedPhone;
    
    // Check SMS opt-out status before sending
    // RACE CONDITION FIX: Use provided broker object if available to avoid stale database fetch
    try {
      let broker = params.brokerOverride;
      
      if (!broker) {
        const { storage } = await import('./storage');
        broker = await storage.getBrokerByPhone(params.to);
      } else {
        console.log(`📱 Using provided broker object (smsOptIn: ${broker.smsOptIn}) - skipping database fetch`);
      }
      
      if (broker && broker.smsOptIn === false) {
        console.log(`🚫 SMS not sent to ${params.to} - broker has opted out of SMS communications`);
        console.log(`   Opt-out date: ${broker.smsOptOutDate || 'N/A'}`);
        return {
          success: true,  // Successfully handled (not an error)
          delivered: false,
          mode: 'opted_out',
          reason: 'broker_opted_out'
        };
      }
    } catch (error) {
      // If we can't check opt-out status, log but continue (fail open)
      console.warn(`⚠️ Unable to check SMS opt-out status for ${params.to}:`, error);
    }
    
    // Check if we're in test mode - if so, use mock instead of real SMS
    try {
      const { isInTestMode, mockSendSMS } = await import('./testMocks');
      if (isInTestMode()) {
        return await mockSendSMS(params);
      }
    } catch (error) {
      // testMocks not available or error importing - continue with normal SMS
    }
    
    // If no Twilio credentials, just log the SMS
    if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
      console.log(`📱 [SMS SIMULATION] To: ${params.to}`);
      console.log(`📱 [SMS SIMULATION] Message: ${params.message}`);
      console.log('   ✅ SMS logged (no Twilio credentials)');
      return {
        success: true,
        delivered: false,
        mode: 'simulated',
        reason: 'no_twilio_credentials'
      };
    }

    // Send actual SMS using Twilio
    const message = await twilioClient.messages.create({
      body: params.message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: params.to
    });

    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('Twilio', 'messages.create', true, responseTime);

    console.log(`📱 SMS sent successfully to ${params.to} (SID: ${message.sid})`);
    return {
      success: true,
      delivered: true,
      mode: 'live',
      sid: message.sid
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('Twilio', 'messages.create', false, responseTime, {
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    
    console.error('❌ Twilio SMS error:', error);
    return {
      success: false,
      delivered: false,
      mode: 'live',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// LandLinq specific SMS templates - Using ONLY outreach management custom templates

export const landLinqSMSTemplates = {
  welcome: async (brokerName: string) => {
    const message = await TemplateService.getSMSTemplate('broker_registered', { brokerName });
    if (!message) {
      console.error('No broker_registered SMS template configured in outreach management');
      return null;
    }
    return message;
  },

  dealReceived: async (brokerName: string, address: string) => {
    const message = await TemplateService.getSMSTemplate('deal_submitted', { brokerName, address });
    if (!message) {
      console.error('No deal_submitted SMS template configured in outreach management');
      return null;
    }
    return message;
  },
    
  greenlight: async (brokerName: string, address: string, productType?: string) => {
    const analystInfo = getAnalystInfo('green', productType);
    const message = await TemplateService.getSMSTemplate('status_pursuing', { 
      brokerName, 
      address, 
      analystName: analystInfo.analystName 
    });
    if (!message) {
      console.error('No status_pursuing SMS template configured in outreach management');
      return null;
    }
    return message;
  },
    
  pass: async (brokerName: string, address: string) => {
    const message = await TemplateService.getSMSTemplate('status_rejected', { brokerName, address });
    if (!message) {
      console.error('No status_rejected SMS template configured in outreach management');
      return null;
    }
    return message;
  },

  // Legacy templates - all use outreach management templates now
  brokerRegistration: async (brokerName: string) => {
    return await landLinqSMSTemplates.welcome(brokerName);
  },

  dealApproved: async (brokerName: string, address: string) => {
    return await landLinqSMSTemplates.greenlight(brokerName, address);
  },

  dealRejected: async (brokerName: string, address: string) => {
    return await landLinqSMSTemplates.pass(brokerName, address);
  },

  missingAcreage: async (brokerName: string, address: string) => {
    const message = await TemplateService.getSMSTemplate('info_missing', { 
      brokerName, 
      address,
      missingInfo: 'acreage'
    });
    if (!message) {
      console.error('No info_missing SMS template configured in outreach management');
      return null;
    }
    return message;
  },

  missingPrice: async (brokerName: string, address: string) => {
    const message = await TemplateService.getSMSTemplate('info_missing', { 
      brokerName, 
      address,
      missingInfo: 'asking price'
    });
    if (!message) {
      console.error('No info_missing SMS template configured in outreach management');
      return null;
    }
    return message;
  },

  missingBoth: async (brokerName: string, address: string) => {
    const message = await TemplateService.getSMSTemplate('info_missing', { 
      brokerName, 
      address,
      missingInfo: 'asking price, acreage'
    });
    if (!message) {
      console.error('No info_missing SMS template configured in outreach management');
      return null;
    }
    return message;
  }
};
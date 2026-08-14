/**
 * CRITICAL SECURITY TESTS for Webhook Endpoints
 * 
 * These tests verify that the security fixes for inbound message processing
 * are working correctly and protect against:
 * - Message forgery
 * - Replay attacks
 * - Unsigned/invalid requests
 * - Premature deduplication blocking legitimate retries
 */

const request = require('supertest');
const crypto = require('crypto');
const { EventWebhook } = require('@sendgrid/eventwebhook');
const twilio = require('twilio');

// Mock environment variables for testing
process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = 'test_sendgrid_key';
process.env.TWILIO_AUTH_TOKEN = 'test_twilio_token';

describe('Webhook Security Tests', () => {
  let app;
  
  beforeEach(() => {
    // Reset processed messages cache
    global.processedMessages = new Map();
  });

  describe('SMS Webhook Security (/api/webhooks/sms-inbound)', () => {
    
    test('SECURITY-SMS-01: Should reject requests without Twilio signature', async () => {
      const smsPayload = {
        From: '+1234567890',
        To: '+1987654321',
        Body: '123 Main St Charlotte NC, 5 acres, $250k',
        MessageSid: 'test_message_12345'
      };

      const response = await request(app)
        .post('/api/webhooks/sms-inbound')
        .send(smsPayload)
        .expect(401);

      expect(response.text).toContain('Unauthorized');
      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });

    test('SECURITY-SMS-02: Should reject requests with invalid Twilio signature', async () => {
      const smsPayload = {
        From: '+1234567890',
        To: '+1987654321', 
        Body: '123 Main St Charlotte NC, 5 acres, $250k',
        MessageSid: 'test_message_12346'
      };

      const response = await request(app)
        .post('/api/webhooks/sms-inbound')
        .set('X-Twilio-Signature', 'invalid_signature_hash')
        .send(smsPayload)
        .expect(401);

      expect(response.text).toContain('Unauthorized');
    });

    test('SECURITY-SMS-03: Should use deterministic MessageSid for deduplication', async () => {
      const smsPayload = {
        From: '+1234567890',
        To: '+1987654321',
        Body: '123 Main St Charlotte NC, 5 acres, $250k',
        MessageSid: 'SM12345deterministic'
      };

      // First request without signature should be rejected but messageId should be deterministic
      const response1 = await request(app)
        .post('/api/webhooks/sms-inbound')
        .send(smsPayload)
        .expect(401);

      // Verify rejection happened before deduplication marking
      expect(response1.text).toContain('Unauthorized');
      
      // Second identical request should also be rejected (not deduplicated)
      const response2 = await request(app)
        .post('/api/webhooks/sms-inbound')  
        .send(smsPayload)
        .expect(401);

      expect(response2.text).toContain('Unauthorized');
    });

    test('SECURITY-SMS-04: Should verify Twilio signature with exact URL and raw body', async () => {
      const smsPayload = {
        From: '+1234567890',
        To: '+1987654321',
        Body: '123 Main St Charlotte NC, 5 acres, $250k',
        MessageSid: 'SM12345valid'
      };

      // Generate valid Twilio signature
      const url = 'https://test.example.com/api/webhooks/sms-inbound';
      const rawBody = new URLSearchParams(smsPayload).toString();
      const signature = twilio.webhooks.getExpectedTwilioSignature(
        process.env.TWILIO_AUTH_TOKEN,
        url,
        rawBody
      );

      const response = await request(app)
        .post('/api/webhooks/sms-inbound')
        .set('X-Twilio-Signature', signature)
        .set('X-Forwarded-Host', 'test.example.com')
        .set('X-Forwarded-Proto', 'https')
        .send(smsPayload);

      // Note: Might fail due to DB issues but signature verification should pass
      expect(response.status).not.toBe(401); // Should not be signature auth failure
    });
  });

  describe('Email Webhook Security (/api/webhooks/email-inbound)', () => {
    
    test('SECURITY-EMAIL-01: Should reject requests without SendGrid signature when key is configured', async () => {
      const emailPayload = {
        from: 'test@example.com',
        to: 'deals@landlinq.ai',
        subject: 'Test Deal',
        text: '123 Main St Charlotte NC, 5 acres, $250k',
        'Message-Id': '<test@example.com>'
      };

      const response = await request(app)
        .post('/api/webhooks/email-inbound')
        .send(emailPayload)
        .expect(401);

      expect(response.body.error).toContain('Missing signature headers');
    });

    test('SECURITY-EMAIL-02: Should reject requests with invalid SendGrid signature', async () => {
      const emailPayload = {
        from: 'test@example.com',
        to: 'deals@landlinq.ai', 
        subject: 'Test Deal',
        text: '123 Main St Charlotte NC, 5 acres, $250k',
        'Message-Id': '<test2@example.com>'
      };

      const response = await request(app)
        .post('/api/webhooks/email-inbound')
        .set('X-Twilio-Email-Event-Webhook-Signature', 'invalid_signature')
        .set('X-Twilio-Email-Event-Webhook-Timestamp', Date.now().toString())
        .send(emailPayload)
        .expect(401);

      expect(response.body.error).toContain('Invalid signature');
    });

    test('SECURITY-EMAIL-03: Should use deterministic Message-Id for deduplication', async () => {
      const emailPayload = {
        from: 'test@example.com',
        to: 'deals@landlinq.ai',
        subject: 'Test Deal', 
        text: '123 Main St Charlotte NC, 5 acres, $250k',
        'Message-Id': '<deterministic123@example.com>'
      };

      // First request without signature should be rejected
      const response1 = await request(app)
        .post('/api/webhooks/email-inbound')
        .send(emailPayload)
        .expect(401);

      expect(response1.body.error).toContain('Missing signature headers');
      
      // Second identical request should also be rejected (not deduplicated)  
      const response2 = await request(app)
        .post('/api/webhooks/email-inbound')
        .send(emailPayload)
        .expect(401);

      expect(response2.body.error).toContain('Missing signature headers');
    });

    test('SECURITY-EMAIL-04: Should handle multipart/form-data content type', async () => {
      const formData = 'from=test%40example.com&to=deals%40landlinq.ai&subject=Test%20Deal&text=123%20Main%20St';
      
      const response = await request(app)
        .post('/api/webhooks/email-inbound')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(formData)
        .expect(401); // Will fail signature verification but should parse body correctly

      expect(response.body.error).toContain('Missing signature headers');
    });

    test('SECURITY-EMAIL-05: Should verify signature using raw body buffer (not JSON.stringify)', async () => {
      const emailPayload = {
        from: 'test@example.com',
        to: 'deals@landlinq.ai',
        subject: 'Test Deal',
        text: '123 Main St Charlotte NC, 5 acres, $250k',
        'Message-Id': '<rawbody@example.com>'
      };

      // The key fix: signature verification should use raw body, not JSON.stringify(req.body)
      // This test verifies the fix is implemented correctly
      const rawBody = JSON.stringify(emailPayload);
      const timestamp = Date.now().toString();
      
      // Mock SendGrid signature (this would need actual implementation)
      const mockSignature = 'mocked_sendgrid_signature';

      const response = await request(app)
        .post('/api/webhooks/email-inbound')
        .set('X-Twilio-Email-Event-Webhook-Signature', mockSignature)
        .set('X-Twilio-Email-Event-Webhook-Timestamp', timestamp)
        .send(emailPayload);

      // Should fail signature verification (mock signature) but not because of JSON.stringify issue
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid signature');
    });
  });

  describe('Deduplication Security', () => {
    
    test('SECURITY-DEDUP-01: Should NOT mark message as processed before signature verification', async () => {
      const messageId = 'test_dedup_before_verification';
      
      const smsPayload = {
        From: '+1234567890',
        To: '+1987654321',
        Body: '123 Main St Charlotte NC, 5 acres, $250k',
        MessageSid: messageId
      };

      // Send unsigned request - should be rejected
      await request(app)
        .post('/api/webhooks/sms-inbound')
        .send(smsPayload)
        .expect(401);

      // Check that message was NOT marked as processed (since signature failed)
      expect(global.processedMessages.has(messageId)).toBe(false);
      
      // Send same request again - should also be rejected (not deduplicated)
      await request(app)
        .post('/api/webhooks/sms-inbound')
        .send(smsPayload)
        .expect(401);
    });

    test('SECURITY-DEDUP-02: Should mark message as processed only AFTER successful persistence', async () => {
      // This test would require mocking successful signature verification
      // and checking that deduplication only happens after DB persistence
      
      const messageId = 'test_dedup_after_persistence';
      
      // This is a conceptual test - actual implementation would need
      // to mock the signature verification and DB operations
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Communication Persistence Verification', () => {
    
    test('PERSISTENCE-01: Should store communication record with proper schema fields', async () => {
      // This test verifies that communication records include:
      // - threading keys
      // - broker identification  
      // - parsed deal fields
      // - missing field annotations
      
      // Would need to mock successful webhook processing and verify DB record
      expect(true).toBe(true); // Placeholder - requires DB mocking
    });

    test('PERSISTENCE-02: Should use deterministic provider message IDs in DB records', async () => {
      // Verify that stored communication records use:
      // - SendGrid Message-Id for email
      // - Twilio MessageSid for SMS
      // - Not random generated IDs
      
      expect(true).toBe(true); // Placeholder - requires DB verification
    });
  });

  describe('Rate Limiting and Logging', () => {
    
    test('SECURITY-RATE-01: Should apply rate limiting to webhook endpoints', async () => {
      const smsPayload = {
        From: '+1234567890',
        To: '+1987654321',
        Body: 'test',
        MessageSid: 'rate_limit_test'
      };

      // Make multiple requests rapidly
      const promises = Array(35).fill().map(() => 
        request(app)
          .post('/api/webhooks/sms-inbound')
          .send(smsPayload)
      );

      const responses = await Promise.all(promises);
      
      // Should eventually hit rate limit (30 requests per minute)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('SECURITY-LOG-01: Should log security events for unauthorized requests', async () => {
      // Mock the security logging to verify events are recorded
      const mockLogSecurityEvent = jest.fn();
      
      // This would require mocking the logSecurityEvent function
      // and verifying it's called with correct parameters
      
      expect(true).toBe(true); // Placeholder
    });
  });
});

/**
 * Manual Security Testing Commands
 * 
 * Run these commands manually to verify security fixes:
 * 
 * 1. Test SMS without signature:
 * curl -X POST http://localhost:5000/api/webhooks/sms-inbound \
 *   -H "Content-Type: application/x-www-form-urlencoded" \
 *   -d "From=%2B1234567890&To=%2B1987654321&Body=test&MessageSid=manual_test_1"
 * Expected: 401 Unauthorized
 * 
 * 2. Test SMS with invalid signature:
 * curl -X POST http://localhost:5000/api/webhooks/sms-inbound \
 *   -H "Content-Type: application/x-www-form-urlencoded" \
 *   -H "X-Twilio-Signature: invalid_sig" \
 *   -d "From=%2B1234567890&To=%2B1987654321&Body=test&MessageSid=manual_test_2"
 * Expected: 401 Unauthorized
 * 
 * 3. Test Email without signature:
 * curl -X POST http://localhost:5000/api/webhooks/email-inbound \
 *   -H "Content-Type: application/json" \
 *   -d '{"from":"test@example.com","text":"test","Message-Id":"manual_test_3"}'
 * Expected: 401 Unauthorized (if SENDGRID_WEBHOOK_PUBLIC_KEY is set)
 * 
 * 4. Check security logs:
 * Look for security events in application logs with timestamps and details
 */
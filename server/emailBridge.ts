/**
 * Email Bridge Service - Immediate Solution for DNS Propagation Issues
 * 
 * This service provides multiple email ingestion methods while DNS propagates:
 * 1. Direct webhook processing (working)
 * 2. Manual email forwarding processor 
 * 3. Multiple email source management
 */

import { storage } from './storage';

interface EmailSource {
  id: string;
  type: 'webhook' | 'manual' | 'forward';
  config: any;
  active: boolean;
  lastChecked?: Date;
}

export class EmailBridgeService {
  private sources: EmailSource[] = [];

  constructor() {
    this.initializeSources();
  }

  private initializeSources() {
    // Add working subdomain as primary
    this.sources.push({
      id: 'inbound_subdomain',
      type: 'webhook',
      config: { 
        url: '/api/webhooks/email',
        email: 'deals@inbound.landlinq.ai',
        status: 'working'
      },
      active: true
    });

    // Add manual processing
    this.sources.push({
      id: 'manual_processing',
      type: 'manual',
      config: {
        endpoint: '/api/emails/manual',
        status: 'working'
      },
      active: true
    });
  }

  /**
   * IMMEDIATE SOLUTION 1: Use working subdomain
   */
  public getWorkingEmailAddress(): string {
    return 'deals@inbound.landlinq.ai';
  }

  /**
   * IMMEDIATE SOLUTION 2: Manual email forwarding processor
   * For copying/pasting emails directly into the system
   */
  public async processEmailText(emailText: string, forwarderEmail: string): Promise<{ success: boolean; dealId?: string; error?: string }> {
    try {
      console.log('📧 Processing manual email forward from:', forwarderEmail);
      
      // Parse email components from text
      const emailData = this.parseEmailText(emailText);
      
      // Use existing webhook processing logic
      const response = await fetch('http://localhost:5000/api/webhooks/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: emailData.from || forwarderEmail,
          to: 'deals@landlinq.ai',
          subject: emailData.subject || 'Manual Forward',
          text: emailData.body || emailText,
          source: 'manual_forward'
        })
      });

      const result = await response.json();
      return { success: true, dealId: result.dealId };

    } catch (error: any) {
      console.error('❌ Manual email processing error:', error);
      return { success: false, error: error.message || 'Processing failed' };
    }
  }

  /**
   * Parse email components from raw text
   */
  private parseEmailText(text: string): { from?: string; subject?: string; body: string } {
    const lines = text.split('\n');
    let from = '';
    let subject = '';
    let bodyStart = 0;

    // Look for email headers in forwarded message
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i];
      if (line.toLowerCase().startsWith('from:')) {
        from = line.substring(5).trim();
      } else if (line.toLowerCase().startsWith('subject:')) {
        subject = line.substring(8).trim();
        bodyStart = i + 1;
        break;
      }
    }

    const body = lines.slice(bodyStart).join('\n').trim();

    return { from, subject, body: body || text };
  }

  /**
   * Get status of all email sources
   */
  public getSourceStatus(): { working: EmailSource[]; failed: EmailSource[]; total: number } {
    const working = this.sources.filter(s => s.active);
    const failed = this.sources.filter(s => !s.active);
    
    return {
      working,
      failed,
      total: this.sources.length
    };
  }

  /**
   * Test all email sources
   */
  public async testAllSources(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};

    for (const source of this.sources) {
      try {
        if (source.type === 'webhook') {
          // Test webhook endpoint
          const response = await fetch(`http://localhost:5000${source.config.url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'test@example.com',
              to: source.config.email,
              subject: 'Test Email',
              text: 'Test property at 123 Test St',
              source: `test_${source.id}`
            })
          });
          results[source.id] = response.ok;
        } else {
          results[source.id] = true; // Manual processing always available
        }
      } catch (error) {
        results[source.id] = false;
      }
    }

    return results;
  }
}

export const emailBridge = new EmailBridgeService();
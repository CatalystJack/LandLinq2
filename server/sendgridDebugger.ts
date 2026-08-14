/**
 * SendGrid Webhook Debugger
 * Captures and stores raw webhook payloads for debugging
 */

interface WebhookPayload {
  timestamp: Date;
  headers: Record<string, string>;
  body: any;
  bodyKeys: string[];
  hasRawMime: boolean;
  hasAttachments: boolean;
  attachmentInfo: Array<{
    filename: string;
    contentType: string;
    hasContent: boolean;
    hasUrl: boolean;
    size: number;
  }>;
  parsedFormat: 'raw_mime' | 'multipart' | 'json' | 'unknown';
}

class SendGridDebugger {
  private payloads: WebhookPayload[] = [];
  private readonly MAX_PAYLOADS = 50; // Keep last 50 payloads

  /**
   * Capture a webhook payload for debugging
   */
  capturePayload(headers: Record<string, string>, body: any): void {
    const payload: WebhookPayload = {
      timestamp: new Date(),
      headers,
      body,
      bodyKeys: Object.keys(body),
      hasRawMime: !!(body.email && typeof body.email === 'string' && body.email.includes('MIME-Version')),
      hasAttachments: false,
      attachmentInfo: [],
      parsedFormat: 'unknown'
    };

    // Detect format
    if (payload.hasRawMime) {
      payload.parsedFormat = 'raw_mime';
    } else if (body.attachments) {
      payload.parsedFormat = 'multipart';
      payload.hasAttachments = true;
      
      // Parse attachment info
      try {
        const attachments = Array.isArray(body.attachments) 
          ? body.attachments 
          : JSON.parse(body.attachments);
        
        for (const att of attachments) {
          payload.attachmentInfo.push({
            filename: att.filename || att.name || 'unknown',
            contentType: att.contentType || att.type || 'unknown',
            hasContent: !!(att.content),
            hasUrl: !!(att.url),
            size: att.size || (att.content ? att.content.length : 0)
          });
        }
      } catch (e) {
        console.error('Failed to parse attachment info:', e);
      }
    } else if (body.from && body.subject) {
      payload.parsedFormat = 'json';
    }

    // Check for attachment URLs in body keys
    const attachmentKeys = Object.keys(body).filter(key => 
      key.startsWith('attachment') || key.includes('file')
    );
    if (attachmentKeys.length > 0) {
      payload.hasAttachments = true;
      console.log(`📎 Found ${attachmentKeys.length} attachment keys:`, attachmentKeys);
    }

    this.payloads.push(payload);

    // Keep only recent payloads
    if (this.payloads.length > this.MAX_PAYLOADS) {
      this.payloads.shift();
    }

    // Log summary
    console.log('\n' + '='.repeat(80));
    console.log('🐛 [SENDGRID-DEBUG] Webhook Payload Captured');
    console.log('='.repeat(80));
    console.log(`Format: ${payload.parsedFormat.toUpperCase()}`);
    console.log(`Has Raw MIME: ${payload.hasRawMime ? '✅' : '❌'}`);
    console.log(`Has Attachments: ${payload.hasAttachments ? '✅' : '❌'}`);
    console.log(`Body Keys (${payload.bodyKeys.length}):`, payload.bodyKeys);
    if (payload.attachmentInfo.length > 0) {
      console.log('Attachments:');
      payload.attachmentInfo.forEach((att, idx) => {
        console.log(`  ${idx + 1}. ${att.filename} (${att.contentType})`);
        console.log(`     - Has Content: ${att.hasContent ? '✅' : '❌'}`);
        console.log(`     - Has URL: ${att.hasUrl ? '✅' : '❌'}`);
        console.log(`     - Size: ${att.size} bytes`);
      });
    }
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Get recent payloads
   */
  getRecentPayloads(limit: number = 10): WebhookPayload[] {
    return this.payloads.slice(-limit).reverse();
  }

  /**
   * Get payload statistics
   */
  getStats() {
    const formatCounts: Record<string, number> = {};
    let withMime = 0;
    let withAttachments = 0;

    this.payloads.forEach(p => {
      formatCounts[p.parsedFormat] = (formatCounts[p.parsedFormat] || 0) + 1;
      if (p.hasRawMime) withMime++;
      if (p.hasAttachments) withAttachments++;
    });

    return {
      totalPayloads: this.payloads.length,
      formatCounts,
      withRawMime: withMime,
      withAttachments,
      mostRecentFormat: this.payloads[this.payloads.length - 1]?.parsedFormat || 'none'
    };
  }

  /**
   * Clear all captured payloads
   */
  clear(): void {
    this.payloads = [];
    console.log('🗑️ [SENDGRID-DEBUG] Cleared all captured payloads');
  }
}

// Singleton instance
export const sendGridDebugger = new SendGridDebugger();

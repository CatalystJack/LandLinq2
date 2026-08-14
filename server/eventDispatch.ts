import { TemplateEvent, EmailTemplate, SMSTemplate } from '@shared/schema';
import { storage } from './storage';

// Helper: Sanitize dynamic template data for SendGrid
// Converts Dates and complex objects to JSON-serializable primitives
function sanitizeDynamicTemplateData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      sanitized[key] = '';
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString();
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Flatten nested objects to strings
      sanitized[key] = JSON.stringify(value);
    } else if (Array.isArray(value)) {
      // Sanitize arrays recursively
      sanitized[key] = value.map(item => {
        if (item instanceof Date) return item.toISOString();
        if (typeof item === 'object' && item !== null) return JSON.stringify(item);
        return item;
      });
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Event payload interface for template variable replacement
export interface EventPayload {
  brokerName: string;
  brokerEmail?: string;
  brokerPhone?: string;
  propertyAddress?: string;
  dealValue?: string;
  dealId?: string;
  analystName?: string;
  companyName?: string;
  supportEmail?: string;
  supportPhone?: string;
  date?: string;
  // Additional context-specific fields
  [key: string]: any;
}

// HTML entity decoder utility
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Template rendering utilities
function renderTemplate(template: string, payload: EventPayload, decodeHtml: boolean = false): string {
  let rendered = template;
  
  // Replace all template variables with payload values
  Object.entries(payload).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    let replacementValue = String(value || '');
    
    // Decode HTML entities if requested (for email subjects)
    if (decodeHtml) {
      replacementValue = decodeHtmlEntities(replacementValue);
    }
    
    rendered = rendered.replace(regex, replacementValue);
  });
  
  // Clean up any unresolved template variables
  rendered = rendered.replace(/{{[\w\s]+}}/g, '');
  
  return rendered;
}

// Convert URLs to styled buttons
function convertUrlsToButtons(text: string): string {
  // Pattern 1: "View your dashboard: https://..." → Button
  text = text.replace(
    /View your dashboard:\s*(https?:\/\/[^\s<]+)/gi,
    '<div style="margin: 20px 0;"><a href="$1" style="display: inline-block; background-color: #4A90E2; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">View Your Dashboard</a></div>'
  );
  
  // Pattern 2: "Click here to opt-in to SMS notifications" with URL
  text = text.replace(
    /(Click here to opt-in to SMS notifications):\s*(https?:\/\/[^\s<]+)/gi,
    '<div style="margin: 20px 0;"><a href="$2" style="display: inline-block; background-color: #4A90E2; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Opt-in to SMS Notifications</a></div>'
  );
  
  // Pattern 3: Standalone "Click here to opt-in..." link (for footer)
  text = text.replace(
    /Click here to opt-in to SMS notifications/gi,
    '<a href="{{websiteUrl}}/sms-opt-in" style="display: inline-block; background-color: #4A90E2; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 12px; margin: 10px 0;">Opt-in to SMS Notifications</a>'
  );
  
  return text;
}

// Event dispatch service
export class EventDispatchService {
  
  /**
   * Centralized event dispatcher
   * Handles: event → resolve template → render → send
   */
  static async emit(event: TemplateEvent, payload: EventPayload): Promise<{
    emailSent: boolean;
    smsSent: boolean;
    error?: string;
  }> {
    try {
      console.log(`🎯 Event dispatch: ${event} for broker ${payload.brokerName}`);
      
      // IDEMPOTENCY CHECK: Prevent duplicate notifications for same deal + event
      // BUT: Only block if previous attempt actually succeeded (not a ghost/failed record)
      if (payload.dealId) {
        console.log(`🔍 [IDEMPOTENCY] Checking for existing ${event} notification for deal ${payload.dealId}`);
        
        const { db } = await import('./db');
        const { communications } = await import('@shared/schema');
        const { and, eq } = await import('drizzle-orm');
        
        const existingNotification = await db.select()
          .from(communications)
          .where(
            and(
              eq(communications.relatedDealId, payload.dealId),
              eq(communications.eventType, event)
            )
          )
          .limit(1);
        
        if (existingNotification && existingNotification.length > 0) {
          const record = existingNotification[0];
          const sentAt = record.createdAt || new Date();
          const minutesAgo = Math.round((Date.now() - new Date(sentAt).getTime()) / (1000 * 60));
          
          // Check if previous attempt actually succeeded by checking status
          // If status is 'resolved', the notification was successfully sent - block duplicates
          if (record.status === 'resolved') {
            console.log(`⚠️ [IDEMPOTENCY] ${event} notification already sent ${minutesAgo} minutes ago - SKIPPING duplicate`);
            console.log(`   Previous notification ID: ${record.id}`);
            return { 
              emailSent: false, 
              smsSent: false, 
              error: `Notification already sent ${minutesAgo} minutes ago` 
            };
          } else {
            console.log(`⚠️ [IDEMPOTENCY] Found failed/pending record from ${minutesAgo} minutes ago - retrying send`);
            console.log(`   Failed record ID: ${record.id} (status: ${record.status})`);
          }
        }
        
        console.log(`✅ [IDEMPOTENCY] No existing successful ${event} notification found - proceeding to send`);
      }
      
      // Get business settings with templates
      const settings = await storage.getBusinessSettings();
      
      if (!settings) {
        throw new Error('Business settings not found');
      }
      
      // Parse templates from JSON if needed
      const emailTemplates = typeof settings.emailTemplates === 'string' 
        ? JSON.parse(settings.emailTemplates as string) 
        : settings.emailTemplates;
      const smsTemplates = typeof settings.smsTemplates === 'string'
        ? JSON.parse(settings.smsTemplates as string)
        : settings.smsTemplates;
      
      // Enhance payload with business brand data
      // ⚠️ HARDCODED LOGO: Use Catalyst:LandLinq branding for ALL emails (per user requirement)
      const currentDomain = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'https://catalyst.landlinq.ai';
      
      // Served from Object Storage to reduce deployment size
      const hardcodedLogoUrl = `${currentDomain}/api/assets/public%2Fassets%2FAdd%20a%20heading%20copy_1762196498512.png`;
      
      const enhancedPayload: EventPayload = {
        ...payload,
        // Map propertyAddress to address for SMS template compatibility
        address: payload.propertyAddress || '',
        companyName: settings.companyName || 'LandLinq - Catalyst Capital Partners',
        supportEmail: settings.supportEmail || 'deals@catalyst.landlinq.ai',
        supportPhone: settings.supportPhone || '(704) 610-1549',
        analystName: payload.analystName || 'Austin Blondell',
        date: payload.date || new Date().toLocaleDateString(),
        // Add branding and dashboard variables
        brandColor: settings.primaryColor || '#4A90E2',
        brandColorDark: '#081729',
        // ⚠️ HARDCODED: Always use Catalyst:LandLinq logo (DO NOT use settings.logoUrl)
        logoUrl: hardcodedLogoUrl,
        dashboardUrl: 'https://landlinq.ai/dashboard',
        contactPhone: settings.supportPhone || '(704) 610-1549',
        contactEmail: settings.supportEmail || 'deals@catalyst.landlinq.ai',
        websiteUrl: 'https://landlinq.ai'
      };
      
      let emailSent = false;
      let smsSent = false;
      
      // Process email template
      const emailTemplate = emailTemplates.find((t: EmailTemplate) => t.event === event && t.enabled !== false);
      if (emailTemplate && payload.brokerEmail) {
        console.log(`📧 Sending email: ${emailTemplate.name}`);
        
        // Auto-detect: If sendgridTemplateId is provided → use SendGrid; otherwise use Outreach Tab
        const useSendGrid = emailTemplate.sendgridTemplateId && emailTemplate.sendgridTemplateId.trim() !== '';
        console.log(`📧 Template source: ${useSendGrid ? 'SendGrid' : 'Outreach Tab'} ${useSendGrid ? `(ID: ${emailTemplate.sendgridTemplateId})` : '(Database template)'}`);
        
        // Check if using SendGrid Dynamic Templates
        if (useSendGrid) {
          // Use SendGrid Dynamic Template
          console.log(`📧 [SENDGRID] Using SendGrid Dynamic Template ID: ${emailTemplate.sendgridTemplateId}`);
          
          // Sanitize dynamic data for SendGrid (convert Dates/objects to strings)
          const sanitizedData = sanitizeDynamicTemplateData(enhancedPayload);
          console.log(`📧 [SENDGRID] Sanitized ${Object.keys(sanitizedData).length} template variables`);
          
          const { sendNotificationEmail } = await import('./emailService');
          try {
            const sendResult = await sendNotificationEmail({
              to: payload.brokerEmail,
              subject: '', // Subject is defined in SendGrid template
              html: '', // HTML is defined in SendGrid template
              type: 'broker_invitation',
              priority: 'medium',
              sendgridTemplateId: emailTemplate.sendgridTemplateId,
              sendgridDynamicData: sanitizedData // Pass sanitized variables to SendGrid
            });
            
            if (sendResult) {
              emailSent = true;
              console.log(`✅ [SENDGRID] Email sent via SendGrid Dynamic Template`);
            } else {
              console.error(`❌ [SENDGRID-ERROR] Failed to send SendGrid Dynamic Template email`);
              return { emailSent: false, smsSent: false, error: 'SendGrid send failed' };
            }
          } catch (error) {
            console.error(`❌ [SENDGRID-ERROR] Exception while sending SendGrid email:`, error);
            return { emailSent: false, smsSent: false, error: 'SendGrid send exception' };
          }
        } else {
          // Use Outreach Tab template (default/backward compatible)
          console.log(`📧 [OUTREACH] Using Outreach Tab template`);
          console.log(`📧 [OUTREACH] Template has html field: ${!!emailTemplate.html}`);
          console.log(`📧 [OUTREACH] Template has content field: ${!!emailTemplate.content}`);
          
          const subject = renderTemplate(emailTemplate.subject, enhancedPayload, true); // Decode HTML entities for subject line
          
          // CRITICAL: ALWAYS use HTML field from Outreach Management tab templates
          // NO hardcoded HTML generation allowed per system design requirements
          let htmlContent: string;
          if (emailTemplate.html && emailTemplate.html.trim()) {
            // Template has HTML - use it and render variables
            htmlContent = renderTemplate(emailTemplate.html, enhancedPayload);
            console.log(`✅ [OUTREACH-HTML] Using HTML template from Outreach Management for ${event}`);
          } else if (emailTemplate.content) {
            // ❌ DEPRECATED: This fallback path should NOT be used
            // All templates in Outreach Management MUST include HTML field
            console.error(`❌ [OUTREACH-ERROR] Template for '${event}' missing HTML field - using deprecated plain text fallback`);
            console.error(`❌ [OUTREACH-ERROR] ALL templates MUST have HTML field configured in Outreach Management`);
            console.error(`❌ [OUTREACH-ERROR] This email will use hardcoded fallback HTML structure`);
            
            // Template only has plain text content - convert to HTML locally
            let plainTextContent = renderTemplate(emailTemplate.content, enhancedPayload);
            
            // CRITICAL FIX: Handle literal \n strings (backslash-n) vs actual newlines
            // If content has literal \n strings, convert them to actual newlines first
            if (plainTextContent.includes('\\n')) {
              plainTextContent = plainTextContent.replace(/\\n/g, '\n');
              console.log(`🔄 Converted literal \\n to actual newlines for ${event}`);
            }
            
            // Convert URLs to styled buttons BEFORE paragraph processing
            plainTextContent = convertUrlsToButtons(plainTextContent);
            
            // Convert plain text to HTML: replace \n with <br/> and wrap in paragraphs
            const paragraphs = plainTextContent.split(/\n\n/);
            const htmlParagraphs = paragraphs
              .filter(p => p.trim())
              .map(p => {
                // Skip button divs (already formatted)
                if (p.trim().startsWith('<div style="margin: 20px 0;">')) {
                  return p;
                }
                
                // Check if this is a header (line ending with ":")
                const lines = p.split('\n');
                const processedLines = lines.map(line => {
                  const trimmedLine = line.trim();
                  // Detect headers: lines ending with ":" or all-caps lines
                  if (trimmedLine.endsWith(':') || (trimmedLine.length > 0 && trimmedLine === trimmedLine.toUpperCase() && /[A-Z]/.test(trimmedLine))) {
                    return `<strong style="font-weight: 700; display: block; margin: 15px 0 10px 0;">${line}</strong>`;
                  }
                  return line;
                });
                
                const withBreaks = processedLines.join('<br/>');
                return `<p style="margin: 10px 0;">${withBreaks}</p>`;
              })
              .join('\n');
            
            htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; background-color: #ffffff;">
              ${enhancedPayload.logoUrl ? `<img src="${enhancedPayload.logoUrl}" alt="${enhancedPayload.companyName || 'Catalyst Acquisitions'}" style="max-width: 280px; height: auto; display: block; margin: 0 auto;" />` : `<h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #081729;">${enhancedPayload.companyName || 'Catalyst Acquisitions'}</h1>`}
            </td>
          </tr>
          
          <!-- Separator Line -->
          <tr>
            <td style="padding: 0; height: 4px; background: linear-gradient(to right, #4A90E2, #2E5C8A);"></td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 40px; background-color: #ffffff;">
              ${htmlParagraphs}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #ffffff; border-top: 1px solid #e0e0e0;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #333;">Let's Build What's Next, Together!</p>
                    <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #081729;">Catalyst</p>
                    <p style="margin: 0 0 20px 0; font-size: 12px; color: #666;">Powered By LandLinq™</p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 20px; border-top: 1px solid #e8e8e8;">
                    <p style="margin: 0 0 12px 0; font-size: 12px; color: #666; line-height: 1.6;">
                      © 2025 LandLinq™ | <a href="mailto:${enhancedPayload.contactEmail}" style="color: #4A90E2; text-decoration: none;">${enhancedPayload.contactEmail}</a> | <a href="tel:${enhancedPayload.contactPhone?.replace(/\D/g, '')}" style="color: #4A90E2; text-decoration: none;">${enhancedPayload.contactPhone}</a> | <a href="https://landlinq.ai" style="color: #4A90E2; text-decoration: none;">landlinq.ai</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Unsubscribe -->
          <tr>
            <td style="padding: 20px; background-color: #f9f9f9; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #999; line-height: 1.5;">
                To unsubscribe from future emails, <a href="${enhancedPayload.dashboardUrl || 'https://landlinq.ai/unsubscribe'}" style="color: #4A90E2; text-decoration: none;">click here</a> or reply with UNSUBSCRIBE.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
            console.log(`✅ Converted plain text to HTML for ${event}`);
          } else {
            console.error(`❌ No HTML or content found in template for ${event}`);
            return { emailSent: false, smsSent: false, error: 'No template content' };
          }
          
          // Send email via sendNotificationEmail
          const { sendNotificationEmail } = await import('./emailService');
          await sendNotificationEmail({
            to: payload.brokerEmail,
            subject: subject,
            html: htmlContent,
            type: 'broker_invitation', // default type for template events
            priority: 'medium'
          });
          
          emailSent = true;
          console.log(`✅ [OUTREACH] Email sent via Outreach Tab template`);
        }
      }
      
      // Process SMS template (exclude loi_sent for SMS)
      console.log(`🔍 [SMS-CHECK] Starting SMS processing for event: ${event}`);
      console.log(`🔍 [SMS-CHECK] brokerPhone present: ${!!payload.brokerPhone} (${payload.brokerPhone || 'NONE'})`);
      console.log(`🔍 [SMS-CHECK] event !== 'loi_sent': ${event !== 'loi_sent'}`);
      
      if (event !== 'loi_sent' && payload.brokerPhone) {
        console.log(`✅ [SMS-CHECK] Conditions met - proceeding with SMS`);
        
        try {
          const { TemplateService } = await import('./templateService');
          const { sendSMS } = await import('./smsService');
          
          // Validate phone number before attempting SMS
          const phoneRegex = /^\+?1?(\d{10})$/; // US phone: optional +1, then 10 digits
          const cleanPhone = payload.brokerPhone.replace(/[\s\-\(\)]/g, ''); // Remove formatting
          
          console.log(`🔍 [SMS-VALIDATION] cleanPhone: ${cleanPhone}, regex test: ${phoneRegex.test(cleanPhone)}`);
          
          if (!phoneRegex.test(cleanPhone)) {
            console.log(`⚠️ Invalid phone number format for SMS: ${payload.brokerPhone} - skipping SMS`);
          } else {
            console.log(`✅ [SMS-VALIDATION] Phone valid - fetching SMS template for event: ${event}`);
            
            // Use TemplateService to get and render SMS template from business settings
            const smsContent = await TemplateService.getSMSTemplate(event, enhancedPayload);
            
            console.log(`🔍 [SMS-TEMPLATE] Template result: ${smsContent ? `FOUND (${smsContent.length} chars)` : 'NULL/NOT FOUND'}`);
            
            if (smsContent) {
              console.log(`📱 Sending SMS for event: ${event} to ${payload.brokerPhone}`);
              console.log(`📱 SMS content preview: ${smsContent.substring(0, 100)}...`);
              
              // Format phone to E.164 format for Twilio (+1XXXXXXXXXX)
              const formattedPhone = cleanPhone.match(/^\+/) ? cleanPhone : `+1${cleanPhone.replace(/^\+?1?/, '')}`;
              
              console.log(`📱 Formatted phone: ${formattedPhone}`);
              
              const smsResult = await sendSMS({
                to: formattedPhone,
                message: smsContent,
                brokerOverride: payload.broker // Pass broker to avoid stale database fetch
              });
              
              if (smsResult.success && smsResult.delivered) {
                console.log(`✅ [SMS-SENT] SMS sent successfully (SID: ${smsResult.sid})`);
                smsSent = true;
              } else if (smsResult.success && !smsResult.delivered) {
                console.log(`⏭️ [SMS-SENT] SMS not delivered - ${smsResult.reason || smsResult.mode}`);
                smsSent = false;
              } else {
                console.log(`❌ [SMS-SENT] SMS failed - ${smsResult.error}`);
                smsSent = false;
              }
            } else {
              console.log(`📱 No SMS template found for event: ${event} - SMS NOT SENT`);
            }
          }
        } catch (smsError) {
          console.error(`❌ [SMS-ERROR] Error during SMS processing:`, smsError);
          // Don't throw - email was already sent successfully, continue
        }
      } else {
        console.log(`⏭️ [SMS-SKIP] SMS skipped - event=${event}, hasPhone=${!!payload.brokerPhone}`);
      }
      
      console.log(`✅ Event dispatch complete: email=${emailSent}, sms=${smsSent}`);
      
      // IDEMPOTENCY: Update existing placeholder record to 'resolved' OR create new one
      if (payload.dealId && (emailSent || smsSent)) {
        try {
          console.log(`📝 [IDEMPOTENCY] Marking notification as resolved for deal ${payload.dealId}, event: ${event}`);
          
          const { db } = await import('./db');
          const { communications } = await import('@shared/schema');
          const { eq, and } = await import('drizzle-orm');
          
          // First, try to UPDATE any existing placeholder record with status='pending_followup'
          const updateResult = await db
            .update(communications)
            .set({ 
              status: 'resolved',
              email: payload.brokerEmail || undefined,
              phone: payload.brokerPhone || undefined,
              subject: emailSent ? `${event} notification` : undefined,
              message: `Notification sent via ${emailSent ? 'email' : 'SMS'} for event: ${event}`,
              rawText: `Event: ${event}, Sent to: ${payload.brokerEmail || payload.brokerPhone}`,
              channel: emailSent ? 'email' : 'sms'
            })
            .where(
              and(
                eq(communications.relatedDealId, payload.dealId),
                eq(communications.eventType, event),
                eq(communications.status, 'pending_followup')
              )
            );
          
          console.log(`🔄 [IDEMPOTENCY-UPDATE] Updated ${(updateResult as any).rowCount || 0} placeholder record(s) to resolved`);
          
          // If no existing record was updated, create a new one
          if (!(updateResult as any).rowCount || (updateResult as any).rowCount === 0) {
            console.log(`📝 [IDEMPOTENCY-CREATE] No placeholder found, creating new resolved record`);
            await storage.createCommunication({
              brokerId: payload.brokerId || undefined,
              relatedDealId: payload.dealId,
              eventType: event,
              channel: emailSent ? 'email' : 'sms',
              direction: 'outbound',
              email: payload.brokerEmail || undefined,
              phone: payload.brokerPhone || undefined,
              subject: emailSent ? `${event} notification` : undefined,
              message: `Notification sent via ${emailSent ? 'email' : 'SMS'} for event: ${event}`,
              rawText: `Event: ${event}, Sent to: ${payload.brokerEmail || payload.brokerPhone}`,
              status: 'resolved'
            });
          }
          
          console.log(`✅ [IDEMPOTENCY] Communication record marked as resolved successfully`);
        } catch (commError: any) {
          // Check if error is due to unique constraint violation (duplicate notification)
          if (commError.message?.includes('unique_deal_event') || commError.code === '23505') {
            console.log(`⚠️ [IDEMPOTENCY] Communication record already exists (race condition handled by DB constraint)`);
          } else {
            console.error(`❌ [IDEMPOTENCY] Failed to update/create communication record:`, commError);
            // Don't fail the entire operation - email/SMS was already sent successfully
          }
        }
      }
      
      return { emailSent, smsSent };
      
    } catch (error) {
      console.error(`❌ Event dispatch failed for ${event}:`, error);
      return { 
        emailSent: false, 
        smsSent: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Convenience methods for specific business events
   */
  
  static async brokerRegistered(payload: {
    brokerName: string;
    brokerEmail: string;
    brokerPhone?: string;
    brokerId?: string;
  }) {
    return this.emit('broker_registered', payload);
  }
  
  static async dealSubmitted(payload: {
    brokerName: string;
    brokerEmail: string;
    brokerPhone?: string;
    propertyAddress: string;
    dealValue?: string;
    dealId: string;
    brokerId?: string;
  }) {
    return this.emit('deal_submitted', payload);
  }
  
  static async infoMissing(payload: {
    brokerName: string;
    brokerEmail: string;
    brokerPhone?: string;
    propertyAddress: string;
    dealId: string;
    brokerId?: string;
  }) {
    return this.emit('info_missing', payload);
  }
  
  static async statusUnderReview(payload: {
    brokerName: string;
    brokerEmail: string;
    brokerPhone?: string;
    propertyAddress: string;
    dealId: string;
    brokerId?: string;
  }) {
    return this.emit('status_under_review', payload);
  }
  
  static async statusPursuing(payload: {
    brokerName: string;
    brokerEmail: string;
    brokerPhone?: string;
    propertyAddress: string;
    dealId: string;
    brokerId?: string;
  }) {
    return this.emit('status_pursuing', payload);
  }
  
  static async statusRejected(payload: {
    brokerName: string;
    brokerEmail: string;
    brokerPhone?: string;
    propertyAddress: string;
    dealId: string;
    brokerId?: string;
  }) {
    return this.emit('status_rejected', payload);
  }
  
  static async loiSent(payload: {
    brokerName: string;
    brokerEmail: string;
    propertyAddress: string;
    dealId: string;
    brokerId?: string;
  }) {
    // LOI is email-only, no SMS
    return this.emit('loi_sent', payload);
  }
  
  static async infoMissingReminder(payload: {
    brokerName: string;
    brokerPhone: string;
    propertyAddress: string;
    dealId: string;
    brokerId?: string;
  }) {
    // Reminder is SMS-only
    return this.emit('info_missing_reminder', payload);
  }
}

/**
 * Legacy template support (for existing routes using string templates)
 */
export const emailTemplates = {
  confirmation: (brokerName: string) => ({
    subject: "Welcome to {{companyName}} - Your Land Deal Pipeline Starts Here!",
    message: `Dear ${brokerName},\n\nWelcome to {{companyName}}! We're excited to have you join our land acquisition network...`
  }),
  dealReceived: (brokerName: string) => ({
    subject: "Deal Received - {{propertyAddress}} | {{companyName}} #{{dealId}}",
    message: `Dear ${brokerName},\n\nThank you for submitting your deal to {{companyName}}...`
  }),
  dealApproved: (brokerName: string) => ({
    subject: "Great News - We Want to Move Forward!",
    message: `Hi ${brokerName},\n\nGreat news! We're interested in moving forward...`
  }),
  dealRejected: (brokerName: string) => ({
    subject: "Deal Update",
    message: `Hi ${brokerName},\n\nThank you for thinking of Catalyst...`
  }),
};

// SMS templates REMOVED - ALL SMS templates must come from outreach management tab
// Use landLinqSMSTemplates from smsService.ts which pulls from businessSettings
// NO FALLBACK TEMPLATES ALLOWED per system rules
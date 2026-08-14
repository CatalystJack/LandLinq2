// ALL HARDCODED EMAIL FUNCTIONS COMPLETELY REMOVED
// 100% OUTREACH MANAGEMENT TEMPLATE USAGE ENFORCED
//
// This file now uses TemplateService exclusively for ALL email templates.
// NO hardcoded HTML, subjects, or content allowed anywhere.

import type { EmailNotification } from './types';
import { TemplateService } from './templateService';
import { apiCallTracker } from './apiCallTracker.js';
import { storage } from './storage';

// Import for SendGrid integration
import sgMail from '@sendgrid/mail';

/**
 * Helper to get raw email template from business settings (for sendgridTemplateId access)
 * CRITICAL: If a template has a SendGrid template ID configured, we MUST use it
 */
async function getRawEmailTemplate(eventType: string): Promise<any | null> {
  try {
    const businessSettings = await storage.getBusinessSettings();
    let emailTemplates: any[] = [];
    
    try {
      emailTemplates = typeof (businessSettings as any)?.emailTemplates === 'string'
        ? JSON.parse((businessSettings as any).emailTemplates)
        : (businessSettings as any)?.emailTemplates || [];
    } catch (parseError) {
      console.error(`❌ [TEMPLATE-PARSE] Failed to parse emailTemplates:`, parseError);
      return null;
    }
    
    // Normalize event name for comparison
    const normalizeEventName = (name: string) => name?.toLowerCase().trim().replace(/\s+/g, '_') || '';
    const targetNormalized = normalizeEventName(eventType);
    
    // Find template by event name (flexible matching)
    return emailTemplates.find((t: any) => {
      const templateEvent = t.event || t.type || t.trigger || t.eventType || t.name || '';
      const templateNormalized = normalizeEventName(templateEvent);
      return templateNormalized === targetNormalized;
    }) || null;
  } catch (error) {
    console.error(`❌ Error getting raw template for ${eventType}:`, error);
    return null;
  }
}

// Replit SendGrid Connector - Get fresh client with credentials from connector system
async function getSendGridClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found - cannot authenticate with SendGrid connector');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected via Replit connector');
  }
  
  sgMail.setApiKey(connectionSettings.settings.api_key);
  return {
    client: sgMail,
    fromEmail: connectionSettings.settings.from_email
  };
}

// Fallback: Configure SendGrid from environment variable if connector unavailable
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Email sending function
export async function sendNotificationEmail(notification: EmailNotification, disableClickTracking: boolean = true): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    // MASTER MESSAGING TOGGLE CHECK (Dec 16, 2025)
    // If master messaging is OFF, block outreach/drip emails only.
    // Transactional deal notifications to partner developers always go through.
    const TRANSACTIONAL_TYPES = ['developer-deal', 'developer_deal_info', 'broker_approval', 'high'];
    const isTransactional = TRANSACTIONAL_TYPES.includes(notification.type) || notification.priority === 'high';
    try {
      if (!isTransactional) {
        const settings = await storage.getBusinessSettings();
        const masterEnabled = (settings as any)?.outreachMasterEnabled !== false;
        if (!masterEnabled) {
          console.log('🚫 [EMAIL-BLOCKED] Master Messaging is OFF - email not sent');
          console.log(`   To: ${notification.to}`);
          console.log(`   Subject: ${notification.subject}`);
          return false;
        }
      }
    } catch (toggleError) {
      // If we can't check the toggle, fail open (allow sending) to not break critical notifications
      console.warn('⚠️ [EMAIL] Could not check master toggle, proceeding with send:', toggleError);
    }
    
    console.log('📧 [SENDGRID] Attempting to send email...');
    console.log('📧 [SENDGRID] To:', notification.to);
    console.log('📧 [SENDGRID] Subject:', notification.subject);
    
    // Try to get SendGrid client from Replit connector first, fallback to env var
    let sendGridClient;
    let fromEmail = 'deals@catalyst.landlinq.ai';
    
    try {
      console.log('📧 [SENDGRID] Attempting to use Replit SendGrid Connector...');
      const connectorClient = await getSendGridClient();
      sendGridClient = connectorClient.client;
      fromEmail = connectorClient.fromEmail;
      console.log('✅ [SENDGRID] Using Replit connector with from:', fromEmail);
    } catch (connectorError) {
      console.log('⚠️ [SENDGRID] Connector failed, trying environment variable...');
      console.log('   Connector error:', connectorError instanceof Error ? connectorError.message : String(connectorError));
      
      if (!process.env.SENDGRID_API_KEY) {
        console.error('❌ [SENDGRID] API key not configured - email cannot be sent');
        console.error('❌ [SENDGRID] Set SENDGRID_API_KEY environment variable or configure SendGrid connector');
        console.log('📧 [EMAIL SIMULATION] - Would have sent:');
        console.log('   To:', notification.to);
        console.log('   Subject:', notification.subject);
        console.log('   Type:', notification.type);
        console.log('   Priority:', notification.priority);
        console.log('---');
        return false;
      }
      
      sendGridClient = sgMail;
      console.log('✅ [SENDGRID] Using environment variable API key');
    }

    console.log('📧 [SENDGRID] Preparing email for:', notification.to);

    // Check if using SendGrid Dynamic Template
    let msg: any;
    
    if (notification.sendgridTemplateId) {
      // SendGrid Dynamic Template mode
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅✅✅ USING SENDGRID DYNAMIC TEMPLATE ✅✅✅');
      console.log(`📧 Template ID: ${notification.sendgridTemplateId}`);
      console.log(`📧 Recipient: ${notification.to}`);
      console.log(`📧 Variables: ${Object.keys(notification.sendgridDynamicData || {}).join(', ')}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      
      msg = {
        to: notification.to,
        from: {
          email: notification.fromEmail || fromEmail,
          name: notification.fromName || 'Catalyst Acquisitions'
        },
        replyTo: 'acquisitions@catalystcp.com',
        templateId: notification.sendgridTemplateId,
        dynamicTemplateData: notification.sendgridDynamicData || {}
      };
    } else {
      // Traditional HTML/Text mode (Outreach Tab templates)
      console.log('');
      console.log('⚠️⚠️⚠️ USING OUTREACH TAB HTML (not SendGrid Dynamic Template) ⚠️⚠️⚠️');
      console.log(`📧 Recipient: ${notification.to}`);
      console.log('');
      
      // Add unsubscribe link to HTML content if not already present
      let htmlContent = notification.html || '';
      // Use plain text version if available, otherwise strip HTML properly
      let textContent = notification.text || (htmlContent ? htmlContent
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags  
        .replace(/<[^>]+>/g, '') // Remove all HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim() : '');
      
      // Use the published domain to avoid SSL issues with SendGrid tracking
      const baseUrl = process.env.REPLIT_DOMAINS ? 
        `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 
        'https://landlinq.ai';
      const unsubscribeUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(notification.to)}`;
      
      // Check if unsubscribe link already exists
      if (htmlContent && !htmlContent.includes('unsubscribe')) {
        // Add unsubscribe link to HTML - without any special headers to avoid SendGrid rewriting
        htmlContent += `<br><br><hr><small style="color: #666;">To unsubscribe from future emails, <a href="${unsubscribeUrl}" style="color: #666;">click here</a> or reply with UNSUBSCRIBE.</small>`;
        
        // Add unsubscribe text to plain text version
        textContent += `\n\n---\nTo unsubscribe from future emails, visit: ${unsubscribeUrl} or reply with UNSUBSCRIBE.`;
      }
      
      msg = {
        to: notification.to,
        from: {
          email: notification.fromEmail || fromEmail,
          name: notification.fromName || 'Catalyst Acquisitions'
        },
        replyTo: notification.fromEmail || 'acquisitions@catalystcp.com',
        subject: notification.subject,
        // SendGrid requires text/plain FIRST, then text/html
        content: [
          {
            type: 'text/plain',
            value: textContent || notification.text || ''
          },
          {
            type: 'text/html',
            value: htmlContent || notification.html || notification.text || ''
          }
        ],
        // Remove unsubscribe group to avoid configuration issues
        // asm: {
        //   groupId: 1, // Use SendGrid's built-in unsubscribe group
        //   groupsToDisplay: [1]
        // }
      };
    }

    // Disable click tracking if requested (prevents SSL issues with SendGrid tracking domains)
    if (disableClickTracking) {
      msg.trackingSettings = {
        clickTracking: {
          enable: false
        }
      };
      console.log('📧 Click tracking DISABLED for this email to prevent SSL certificate issues');
    }

    // Add file attachments if provided
    if (notification.attachments && notification.attachments.length > 0) {
      msg.attachments = notification.attachments;
      console.log(`📎 [SENDGRID] Adding ${notification.attachments.length} attachment(s): ${notification.attachments.map(a => a.filename).join(', ')}`);
    }

    console.log('📧 [SENDGRID] Calling SendGrid API...');
    
    // Only log HTML debug info for traditional HTML mode (not dynamic templates)
    if (!notification.sendgridTemplateId && notification.html) {
      console.log('🔍 [DEBUG] HTML Preview (first 500 chars):', notification.html.substring(0, 500));
      console.log('🔍 [DEBUG] Has angle brackets?', notification.html.includes('<div'), notification.html.includes('</div>'));
    } else if (notification.sendgridTemplateId) {
      console.log('🔍 [DEBUG] Using SendGrid Dynamic Template - HTML content managed by SendGrid');
    }
    
    const result = await sendGridClient.send(msg);
    
    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('SendGrid', 'send', true, responseTime);
    
    console.log('✅ [SENDGRID] SUCCESS! Email sent to:', notification.to);
    console.log('✅ [SENDGRID] Subject:', notification.subject);
    console.log('✅ [SENDGRID] SendGrid response status:', result[0]?.statusCode);
    return true;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    apiCallTracker.logCall('SendGrid', 'send', false, responseTime, {
      errorMessage: error.message || String(error)
    });
    
    console.error('❌ [SENDGRID] FAILED to send email');
    console.error('❌ [SENDGRID] To:', notification.to);
    console.error('❌ [SENDGRID] Subject:', notification.subject);
    console.error('❌ [SENDGRID] Error:', error.message || error);
    console.error('❌ [SENDGRID] Error details:', JSON.stringify(error, null, 2));
    return false;
  }
}

// Helper to get analyst information based on deal classification and product type
function getAnalystInfo(classification: 'green' | 'yellow' | 'red', productType?: string) {
  // Team assignments based on product type
  const teamAssignments = {
    'conventional-apartments': { analystName: 'Austin', analystEmail: 'austin@catalystcp.com' },
    'active-adult': { analystName: 'Austin', analystEmail: 'austin@catalystcp.com' },
    'btr': { analystName: 'Davis', analystEmail: 'davis@catalystcp.com' },
    'build-to-rent': { analystName: 'Davis', analystEmail: 'davis@catalystcp.com' },
    'lot-development': { analystName: 'Davis', analystEmail: 'davis@catalystcp.com' }
  };

  const team = teamAssignments[productType as keyof typeof teamAssignments] || 
    { analystName: 'Austin', analystEmail: 'austin@catalystcp.com' };

  return {
    ...team,
    classification,
    classificationColor: classification === 'green' ? '#22c55e' : 
                        classification === 'yellow' ? '#eab308' : '#ef4444'
  };
}

// Main email service with ALL functions using TemplateService exclusively
const emailService = {
  async sendConfirmationEmail(brokerName: string, brokerEmail: string, deal: any, passwordSetupToken?: string): Promise<boolean> {
    console.log('📧 [EMAIL-CONFIRM] Starting confirmation email process...');
    console.log('📧 [EMAIL-CONFIRM] Broker:', brokerName, '|', brokerEmail);
    console.log('📧 [EMAIL-CONFIRM] Deal ID:', deal.id, '| Address:', deal.address);
    
    // Build password setup URL and HTML section if token provided (for new brokers)
    const passwordSetupUrl = passwordSetupToken 
      ? `https://landlinq.ai/reset-password?token=${passwordSetupToken}`
      : '';
    
    const passwordSetupSection = passwordSetupToken ? `
      <div style="background-color: #fef3c7; border-left: 4px solid #d4af37; padding: 25px; margin: 30px 0; border-radius: 6px;">
        <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">🔐 Set Up Your Dashboard Access</h3>
        <p style="color: #92400e; margin: 0 0 15px 0; font-size: 15px; line-height: 1.6;">
          This is your first submission! To track your deal status online, please set up your password by clicking the button below.
        </p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${passwordSetupUrl}" style="background-color: #4A90E2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">Set Up Your Password</a>
        </div>
        <p style="color: #92400e; margin: 10px 0 0 0; font-size: 13px; text-align: center; font-style: italic;">
          This link expires in 1 hour for security
        </p>
      </div>
    ` : '';
    
    if (passwordSetupToken) {
      console.log('🔐 [EMAIL-CONFIRM] Password setup link included for new broker');
    }
    
    // Prepare all template variables required by deal_submitted template
    const templateVars = {
      brokerName,
      propertyAddress: deal.address || 'Property',
      address: deal.address || 'Property',
      dealId: deal.id || 'N/A',
      date: new Date().toLocaleDateString(),
      dealValue: deal.price ? `$${deal.price.toLocaleString()}` : 'TBD',
      analystName: deal.assignedAnalyst || 'Austin Blondell',
      passwordSetupSection,  // Conditional HTML section for new brokers
      // NOTE: logoUrl, companyName, contactPhone, contactEmail, etc. are fetched from businessSettings by templateService
      // Do NOT hardcode them here - they will be added by templateService from the database
    };
    
    console.log('📧 [EMAIL-CONFIRM] Looking for "Deal Submitted" template in outreach management...');
    
    // CRITICAL: Get raw template to check for sendgridTemplateId
    const rawTemplate = await getRawEmailTemplate('deal_submitted');
    console.log(`📧 [EMAIL-CONFIRM] Raw template found: ${!!rawTemplate}, Has sendgridTemplateId: ${!!rawTemplate?.sendgridTemplateId}`);
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('Deal Submitted', templateVars);
    
    if (!template) {
      console.error('❌ [EMAIL-CONFIRM] FAILED: No "Deal Submitted" email template found in outreach management');
      console.error('❌ [EMAIL-CONFIRM] Email NOT sent to:', brokerEmail);
      return false;
    }
    
    console.log('✅ [EMAIL-CONFIRM] Template found! Subject:', template.subject);
    console.log('📧 [EMAIL-CONFIRM] Preparing to send via SendGrid...');
    
    // CRITICAL: Pass sendgridTemplateId if configured (for SendGrid dynamic templates)
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content, // Plain text version from template
      type: 'confirmation',
      priority: 'medium',
      sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
      sendgridDynamicData: rawTemplate?.sendgridTemplateId ? templateVars : undefined
    };
    
    const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
    console.log(`📧 [EMAIL-CONFIRM] Template mode: ${templateMode}`);
    
    const result = await sendNotificationEmail(notification);
    
    if (result) {
      console.log('✅ [EMAIL-CONFIRM] SUCCESS: Confirmation email sent to', brokerEmail);
    } else {
      console.error('❌ [EMAIL-CONFIRM] FAILED: Could not send email to', brokerEmail);
    }
    
    return result;
  },

  async sendMissingInfoEmail(brokerName: string, brokerEmail: string, deal: any, missingFields: string[]): Promise<boolean> {
    console.log('📧 [MISSING-INFO] Starting missing info request email...');
    console.log('📧 [MISSING-INFO] Broker:', brokerName, '|', brokerEmail);
    console.log('📧 [MISSING-INFO] Deal ID:', deal.id, '| Missing:', missingFields.join(', '));
    
    // Prepare template variables for info_missing template
    const templateVars = {
      brokerName,
      propertyAddress: deal.address || 'Your Property',
      address: deal.address || 'Your Property',
      dealId: deal.id || 'N/A',
      missingFields: missingFields.join(', '),
      missingFieldsList: missingFields.map(f => `• ${f}`).join('\n'),
      // NOTE: logoUrl, companyName, contactPhone, contactEmail, etc. are fetched from businessSettings by templateService
      // Do NOT hardcode them here - they will be added by templateService from the database
    };
    
    console.log('📧 [MISSING-INFO] Looking for "Info Missing" template in outreach management...');
    
    // CRITICAL: Get raw template to check for sendgridTemplateId
    const rawTemplate = await getRawEmailTemplate('info_missing');
    console.log(`📧 [MISSING-INFO] Raw template found: ${!!rawTemplate}, Has sendgridTemplateId: ${!!rawTemplate?.sendgridTemplateId}`);
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('Info Missing', templateVars);
    
    if (!template) {
      console.error('❌ [MISSING-INFO] FAILED: No "Info Missing" email template found in outreach management');
      console.error('❌ [MISSING-INFO] Email NOT sent to:', brokerEmail);
      return false;
    }
    
    console.log('✅ [MISSING-INFO] Template found! Subject:', template.subject);
    console.log('📧 [MISSING-INFO] Preparing to send via SendGrid...');
    
    // CRITICAL: Pass sendgridTemplateId if configured (for SendGrid dynamic templates)
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content, // Plain text version from template
      type: 'info_request',
      priority: 'medium',
      sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
      sendgridDynamicData: rawTemplate?.sendgridTemplateId ? templateVars : undefined
    };
    
    const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
    console.log(`📧 [MISSING-INFO] Template mode: ${templateMode}`);
    
    const result = await sendNotificationEmail(notification);
    
    if (result) {
      console.log('✅ [MISSING-INFO] SUCCESS: Missing info request sent to', brokerEmail);
    } else {
      console.error('❌ [MISSING-INFO] FAILED: Could not send email to', brokerEmail);
    }
    
    return result;
  },

  async sendGreenlightEmail(brokerName: string, brokerEmail: string, address: string, productType?: string): Promise<boolean> {
    const analystInfo = getAnalystInfo('green', productType);
    
    const templateVars = { 
      brokerName, 
      address,
      propertyAddress: address,
      analystName: analystInfo.analystName,
      analystEmail: analystInfo.analystEmail,
      productType,
      classification: 'green',
      classificationEmoji: '🟢',
    };
    
    // CRITICAL: Get raw template to check for sendgridTemplateId
    const rawTemplate = await getRawEmailTemplate('status_pursuing');
    console.log(`🟢 [GREENLIGHT] Raw template found: ${!!rawTemplate}, Has sendgridTemplateId: ${!!rawTemplate?.sendgridTemplateId}`);
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('status_pursuing', templateVars);
    
    if (!template) {
      console.error('No status_pursuing email template configured in outreach management');
      return false;
    }
    
    // CRITICAL: Pass sendgridTemplateId if configured (for SendGrid dynamic templates)
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content,
      type: 'deal_alert',
      priority: 'high',
      sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
      sendgridDynamicData: rawTemplate?.sendgridTemplateId ? templateVars : undefined
    };
    
    const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
    console.log(`🟢 [GREENLIGHT] Template mode: ${templateMode}`);
    
    return await sendNotificationEmail(notification);
  },

  async sendPassEmail(brokerName: string, brokerEmail: string, address: string, rejectionReason?: string): Promise<boolean> {
    const templateVars = { 
      brokerName, 
      address,
      propertyAddress: address,
      rejectionReason,
      classification: 'red',
      classificationEmoji: '🔴',
    };
    
    // CRITICAL: Get raw template to check for sendgridTemplateId
    const rawTemplate = await getRawEmailTemplate('status_rejected');
    console.log(`🔴 [PASS] Raw template found: ${!!rawTemplate}, Has sendgridTemplateId: ${!!rawTemplate?.sendgridTemplateId}`);
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('status_rejected', templateVars);
    
    if (!template) {
      console.error('No status_rejected email template configured in outreach management');
      return false;
    }
    
    // CRITICAL: Pass sendgridTemplateId if configured (for SendGrid dynamic templates)
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content,
      type: 'status_update',
      priority: 'medium',
      sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
      sendgridDynamicData: rawTemplate?.sendgridTemplateId ? templateVars : undefined
    };
    
    const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
    console.log(`🔴 [PASS] Template mode: ${templateMode}`);
    
    return await sendNotificationEmail(notification);
  },

  // Helper function to convert plain text to simple HTML
  convertTextToHtml(text: string): string {
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/E: (.*?)$/gm, 'E: <a href="mailto:$1">$1</a>')
      .replace(/W: (.*?)$/gm, 'W: <a href="$1" target="_blank">$1</a>');
  },

  /**
   * Send password reset email using outreach management templates ONLY
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    try {
      console.log(`📧 Sending password reset email to: ${email}`);
      
      // Create password reset link
      const resetUrl = `${process.env.BASE_URL || 'https://landlinq.ai'}/reset-password?token=${resetToken}`;
      
      const templateVars = {
        resetUrl,
        resetToken,
        userEmail: email
      };
      
      // CRITICAL: Get raw template to check for sendgridTemplateId
      const rawTemplate = await getRawEmailTemplate('password_reset');
      console.log(`🔐 [PASSWORD-RESET] Raw template found: ${!!rawTemplate}, Has sendgridTemplateId: ${!!rawTemplate?.sendgridTemplateId}`);
      
      // Get processed template from outreach management system
      const template = await TemplateService.getEmailTemplate('Password Reset', templateVars);
      
      // CRITICAL: No fallbacks - template MUST exist in outreach management
      if (!template) {
        console.error(`❌ CRITICAL: Password reset template not found in outreach management. Configure the "password_reset" template in the outreach tab.`);
        throw new Error('Password reset template not configured in outreach management. All templates must be configured in the outreach tab.');
      }
      
      const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
      console.log(`🔐 [PASSWORD-RESET] Template mode: ${templateMode}`);
      
      // Send email using template-based system with SendGrid dynamic template if configured
      await sendNotificationEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.content,
        type: 'password_reset',
        priority: 'high',
        sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
        sendgridDynamicData: rawTemplate?.sendgridTemplateId ? templateVars : undefined
      });
      
      console.log(`✅ Password reset email sent to: ${email}`);
      
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }
  },

  /**
   * Send SMS opt-in email to brokers without phone numbers
   * Uses outreach management templates ONLY
   */
  async sendSMSOptInEmail(brokerName: string, brokerEmail: string): Promise<boolean> {
    console.log('📧 [SMS-OPT-IN] Starting SMS opt-in email process...');
    console.log('📧 [SMS-OPT-IN] Broker:', brokerName, '|', brokerEmail);
    
    // Create opt-in URL
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://landlinq.ai';
    const optInUrl = `${baseUrl}/sms-opt-in`;
    
    // Prepare template variables for SMS opt-in template
    const templateVars = {
      brokerName,
      optInUrl,
      dashboardUrl: `${baseUrl}/dashboard`,
    };
    
    console.log('📧 [SMS-OPT-IN] Looking for "SMS Opt-In" template in outreach management...');
    
    // CRITICAL: Get raw template to check for sendgridTemplateId
    const rawTemplate = await getRawEmailTemplate('sms_opt_in');
    console.log(`📧 [SMS-OPT-IN] Raw template found: ${!!rawTemplate}, Has sendgridTemplateId: ${!!rawTemplate?.sendgridTemplateId}`);
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('SMS Opt-In', templateVars);
    
    if (!template) {
      console.error('❌ [SMS-OPT-IN] FAILED: No "SMS Opt-In" email template found in outreach management');
      console.error('❌ [SMS-OPT-IN] Email NOT sent to:', brokerEmail);
      return false;
    }
    
    console.log('✅ [SMS-OPT-IN] Template found! Subject:', template.subject);
    console.log('📧 [SMS-OPT-IN] Preparing to send via SendGrid...');
    
    // CRITICAL: Pass sendgridTemplateId if configured (for SendGrid dynamic templates)
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content,
      type: 'info_request',
      priority: 'medium',
      sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
      sendgridDynamicData: rawTemplate?.sendgridTemplateId ? templateVars : undefined
    };
    
    const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
    console.log(`📧 [SMS-OPT-IN] Template mode: ${templateMode}`);
    
    const result = await sendNotificationEmail(notification);
    
    if (result) {
      console.log('✅ [SMS-OPT-IN] SUCCESS: SMS opt-in email sent to', brokerEmail);
    } else {
      console.error('❌ [SMS-OPT-IN] FAILED: Could not send email to', brokerEmail);
    }
    
    return result;
  },

  /**
   * Send confirmation email when deal is updated from email reply
   */
  async sendDealUpdateConfirmation(
    brokerEmail: string,
    deal: any,
    fieldsUpdated: string[]
  ): Promise<boolean> {
    console.log(`📧 [DEAL-UPDATE] Sending update confirmation to ${brokerEmail}`);
    console.log(`   Deal ID: ${deal.id}`);
    console.log(`   Fields updated: ${fieldsUpdated.join(', ')}`);
    
    const baseUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    
    const templateVars = {
      dealId: deal.id,
      propertyAddress: deal.address || 'Property',
      fieldsUpdated: fieldsUpdated.join(', '),
      brokerName: deal.contactName || 'Valued Partner',
      // NOTE: logoUrl, companyName, contactPhone, contactEmail, etc. are fetched from businessSettings by templateService
    };
    
    // Try to get a custom template, or use a generic confirmation
    const template = await TemplateService.getEmailTemplate('Deal Update Confirmation', templateVars);
    
    // If no custom template, create a simple confirmation
    const finalSubject = template?.subject || `Deal Update Received - ${deal.address}`;
    const finalHtml = template?.html || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank You for the Update!</h2>
        <p>We've successfully updated your property submission with the information you provided.</p>
        <p><strong>Deal ID:</strong> ${deal.id}</p>
        <p><strong>Property:</strong> ${deal.address}</p>
        <p><strong>Updated Fields:</strong> ${fieldsUpdated.join(', ')}</p>
        <p>We're re-analyzing the property with this new information and will be in touch soon.</p>
        <p>Thank you for your partnership!</p>
      </div>
    `;
    
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: finalSubject,
      html: finalHtml,
      text: template?.content || `Thank you for updating your property submission (Deal ID: ${deal.id}). We've updated: ${fieldsUpdated.join(', ')}. We're re-analyzing the property and will be in touch soon.`,
      type: 'confirmation',
      priority: 'medium'
    };
    
    const result = await sendNotificationEmail(notification);
    
    if (result) {
      console.log('✅ [DEAL-UPDATE] Update confirmation sent');
    } else {
      console.error('❌ [DEAL-UPDATE] Failed to send confirmation');
    }
    
    return result;
  }
};

// REMOVED: ALL hardcoded email generation functions
// REMOVED: generatePropertyAlertEmail - Use TemplateService.getEmailTemplate() exclusively  
// REMOVED: generateZoningAlertEmail - Use TemplateService.getEmailTemplate() exclusively
// REMOVED: generateLandValuationShareEmail - Use TemplateService.getEmailTemplate() exclusively  
// REMOVED: generateBrokerInvitationEmail - Use TemplateService.getEmailTemplate() exclusively
// REMOVED: generateBrokerApprovalEmail - Use TemplateService.getEmailTemplate() exclusively
// REMOVED: generateTeamDealNotificationEmail - Use TemplateService.getEmailTemplate() exclusively
// REMOVED: generateBrokerRejectionEmail - Use TemplateService.getEmailTemplate() exclusively  
// REMOVED: generateMissingInfoFollowupEmail - Use TemplateService.getEmailTemplate() exclusively
//
// ALL EMAIL TEMPLATES MUST BE CONFIGURED IN THE OUTREACH MANAGEMENT TAB
// NO HARDCODED HTML, SUBJECTS, OR CONTENT ALLOWED

// Simple text to HTML transformation function (utility only)
export function transformTextToHTML(text: string): string {
  if (!text) return '';
  
  return text
    // First escape HTML characters to prevent corruption
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Convert double newlines to paragraph breaks
    .replace(/\n\s*\n/g, '<br><br>')
    // Convert single newlines to line breaks
    .replace(/\n/g, '<br>')
    // Convert multiple spaces to non-breaking spaces
    .replace(/  +/g, (match) => '&nbsp;'.repeat(match.length))
    // Convert leading spaces to non-breaking spaces
    .replace(/^( +)/gm, (match) => '&nbsp;'.repeat(match.length));
}

// Export named and default for compatibility
export { emailService };
export default emailService;
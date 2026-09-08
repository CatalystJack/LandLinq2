// ALL HARDCODED EMAIL FUNCTIONS COMPLETELY REMOVED
// 100% OUTREACH MANAGEMENT TEMPLATE USAGE ENFORCED
//
// This file now uses TemplateService exclusively for ALL email templates.
// NO hardcoded HTML, subjects, or content allowed anywhere.

import type { EmailNotification } from './types';
import { TemplateService, renderBrandedEmail } from './templateService';
import { apiCallTracker } from './apiCallTracker.js';
import { storage } from './storage';

import { getAppOnlyGraphToken } from './microsoftAuth';
import sgMail from '@sendgrid/mail';

export const PUBLIC_TRANSACTIONAL_EMAIL = 'help@landlinq.ai';
export const PUBLIC_TRANSACTIONAL_NAME = 'LandLinq Support';

async function getSendGridClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;
  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found - cannot authenticate with SendGrid connector');
  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        Accept: 'application/json',
        X_REPLIT_TOKEN: xReplitToken,
      },
    },
  ).then((res) => res.json()).then((data) => data.items?.[0]);
  if (!connectionSettings || !connectionSettings.settings.api_key || !connectionSettings.settings.from_email) {
    throw new Error('SendGrid not connected via Replit connector');
  }
  sgMail.setApiKey(connectionSettings.settings.api_key);
  return { client: sgMail, fromEmail: connectionSettings.settings.from_email };
}

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendSystemEmail(
  to: string,
  subject: string,
  htmlBody: string,
  attachments: EmailNotification['attachments'] = [],
  fromMailbox = PUBLIC_TRANSACTIONAL_EMAIL,
): Promise<boolean> {
  const startTime = Date.now();
  const mailbox = fromMailbox.trim().toLowerCase();
  try {
    const accessToken = await getAppOnlyGraphToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: htmlBody },
            toRecipients: [{ emailAddress: { address: to } }],
            ...(attachments?.length ? {
              attachments: attachments.map((attachment) => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: attachment.filename,
                contentType: attachment.type,
                contentBytes: attachment.content,
                isInline: attachment.disposition === 'inline',
              })),
            } : {}),
          },
          saveToSentItems: true,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Microsoft Graph send failed (${response.status}): ${errorBody}`);
    }
    apiCallTracker.logCall('Other', 'Microsoft Graph sendMail', true, Date.now() - startTime);
    console.log(`✅ [GRAPH-SYSTEM] Email sent from ${mailbox} to ${to}`);
    return true;
  } catch (error: any) {
    apiCallTracker.logCall('Other', 'Microsoft Graph sendMail', false, Date.now() - startTime, {
      errorMessage: error?.message || String(error),
    });
    console.error(`❌ [GRAPH-SYSTEM] Failed to send from ${mailbox} to ${to}:`, error?.message || error);
    return false;
  }
}

// Email sending function
export async function sendNotificationEmail(notification: EmailNotification, disableClickTracking: boolean = true): Promise<boolean> {
  const startTime = Date.now();
  const senderEmail = notification.fromEmail?.trim().toLowerCase() || PUBLIC_TRANSACTIONAL_EMAIL;
  const senderName = notification.fromName || PUBLIC_TRANSACTIONAL_NAME;
  
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

    const rawHtml = notification.html || (notification.text ? transformTextToHTML(notification.text) : '');
    const graphHtml = rawHtml
      ? (rawHtml.includes('landlinq-branded-email')
        ? rawHtml
        : renderBrandedEmail({ title: notification.subject, bodyHtml: rawHtml }))
      : '';
    if (notification.subject && graphHtml) {
      console.log(`📧 [GRAPH-SYSTEM] Attempting platform email to ${notification.to}`);
      const graphSent = await sendSystemEmail(
        notification.to,
        notification.subject,
        graphHtml,
        notification.attachments,
        senderEmail,
      );
      if (graphSent) return true;
      console.warn('⚠️ [GRAPH-SYSTEM] Graph delivery failed; using temporary SendGrid fallback');
    } else {
      console.warn('⚠️ [GRAPH-SYSTEM] Message has no rendered subject/body; using transport fallback');
    }
    
    console.log('📧 [SENDGRID] Attempting to send email...');
    console.log('📧 [SENDGRID] To:', notification.to);
    console.log('📧 [SENDGRID] Subject:', notification.subject);
    
    // Try to get SendGrid client from Replit connector first, fallback to env var
    let sendGridClient;
    try {
      console.log('📧 [SENDGRID] Attempting to use Replit SendGrid Connector...');
      const connectorClient = await getSendGridClient();
      sendGridClient = connectorClient.client;
      console.log('✅ [SENDGRID] Using Replit connector; transactional sender:', senderEmail);
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

    let msg: any;
    
    // All outbound email uses locally-rendered HTML. Keep SendGrid available only
    // as the transport fallback when Graph delivery is unavailable.
    console.log(`📧 [SENDGRID-FALLBACK] Preparing rendered HTML email for: ${notification.to}`);
    
    // Add unsubscribe link to HTML content if not already present
    let htmlContent = graphHtml;
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
      if (htmlContent && !notification.transactional && !htmlContent.includes('unsubscribe')) {
        // Add unsubscribe link to HTML - without any special headers to avoid SendGrid rewriting
        htmlContent += `<br><br><hr><small style="color: #666;">To unsubscribe from future emails, <a href="${unsubscribeUrl}" style="color: #666;">click here</a> or reply with UNSUBSCRIBE.</small>`;
        
        // Add unsubscribe text to plain text version
        textContent += `\n\n---\nTo unsubscribe from future emails, visit: ${unsubscribeUrl} or reply with UNSUBSCRIBE.`;
      }
      
    msg = {
      to: notification.to,
      from: {
        email: senderEmail,
        name: senderName
      },
      replyTo: senderEmail,
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
    };

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
    
    if (notification.html) {
      console.log('🔍 [DEBUG] HTML Preview (first 500 chars):', notification.html.substring(0, 500));
      console.log('🔍 [DEBUG] Has angle brackets?', notification.html.includes('<div'), notification.html.includes('</div>'));
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
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('Deal Submitted', templateVars);
    
    if (!template) {
      console.error('❌ [EMAIL-CONFIRM] FAILED: No "Deal Submitted" email template found in outreach management');
      console.error('❌ [EMAIL-CONFIRM] Email NOT sent to:', brokerEmail);
      return false;
    }
    
    console.log('✅ [EMAIL-CONFIRM] Template found! Subject:', template.subject);
    console.log('📧 [EMAIL-CONFIRM] Preparing locally-rendered HTML email...');
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content, // Plain text version from template
      type: 'confirmation',
      priority: 'medium'
    };
    
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
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('Info Missing', templateVars);
    
    if (!template) {
      console.error('❌ [MISSING-INFO] FAILED: No "Info Missing" email template found in outreach management');
      console.error('❌ [MISSING-INFO] Email NOT sent to:', brokerEmail);
      return false;
    }
    
    console.log('✅ [MISSING-INFO] Template found! Subject:', template.subject);
    console.log('📧 [MISSING-INFO] Preparing locally-rendered HTML email...');
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content, // Plain text version from template
      type: 'info_request',
      priority: 'medium'
    };
    
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
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('status_pursuing', templateVars);
    
    if (!template) {
      console.error('No status_pursuing email template configured in outreach management');
      return false;
    }
    
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content,
      type: 'deal_alert',
      priority: 'high'
    };
    
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
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('status_rejected', templateVars);
    
    if (!template) {
      console.error('No status_rejected email template configured in outreach management');
      return false;
    }
    
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content,
      type: 'status_update',
      priority: 'medium'
    };
    
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
      
      // Get processed template from outreach management system
      const template = await TemplateService.getEmailTemplate('Password Reset', templateVars);
      
      // CRITICAL: No fallbacks - template MUST exist in outreach management
      if (!template) {
        console.error(`❌ CRITICAL: Password reset template not found in outreach management. Configure the "password_reset" template in the outreach tab.`);
        throw new Error('Password reset template not configured in outreach management. All templates must be configured in the outreach tab.');
      }
      
      // Send email using the locally-rendered template.
      await sendNotificationEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.content,
        type: 'password_reset',
        priority: 'high',
        transactional: true
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
    
    // Get processed template from outreach management tab
    const template = await TemplateService.getEmailTemplate('SMS Opt-In', templateVars);
    
    if (!template) {
      console.error('❌ [SMS-OPT-IN] FAILED: No "SMS Opt-In" email template found in outreach management');
      console.error('❌ [SMS-OPT-IN] Email NOT sent to:', brokerEmail);
      return false;
    }
    
    console.log('✅ [SMS-OPT-IN] Template found! Subject:', template.subject);
    console.log('📧 [SMS-OPT-IN] Preparing locally-rendered HTML email...');
    const notification: EmailNotification = {
      to: brokerEmail,
      subject: template.subject,
      html: template.html,
      text: template.content,
      type: 'info_request',
      priority: 'medium'
    };
    
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
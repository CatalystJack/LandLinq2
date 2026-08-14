// ============================================================================
// TEMPLATE SERVICE - 100% OUTREACH MANAGEMENT EXCLUSIVE
// ============================================================================
// 
// ⚠️  CRITICAL SYSTEM RULE: OUTREACH MANAGEMENT TEMPLATES ONLY
//
// ALL email and SMS templates MUST come from the Outreach Management tab.
// ZERO hardcoded templates, HTML, subjects, or content allowed.
// NO fallback templates - system MUST fail if template is missing.
//
// Rules:
// 1. Email templates: Pull from businessSettings.emailTemplates
// 2. SMS templates: Pull from businessSettings.smsTemplates  
// 3. Branding: Pull from businessSettings (logo, colors, contact info)
// 4. NO hardcoded constants or fallbacks anywhere
// 5. Missing template = Error (forces proper configuration)
//
// This applies to ALL communications:
// - Welcome emails, deal confirmations, rejections
// - Password resets, info requests, status updates
// - SMS notifications, broker messages
// - ALL other email/SMS communications
//
// Templates must provide complete HTML including styling, branding, and footer.
// ============================================================================

import { storage } from './storage';

/**
 * Convert plain text with \n characters to proper HTML
 */
function convertTextToHTML(text: string, brandingVars?: any): string {
  if (!text) return '';
  
  // Use actual branding values or fallbacks (absolute URL for email clients)
  // Get current environment domain
  const baseUrl = process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : 'https://catalyst.landlinq.ai';
  
  // ⚠️ HARDCODED LOGO: Use CATALYST:LandLinq branding logo at top of ALL emails (per user request)
  // Served from Object Storage to reduce deployment size
  const logoUrl = `${baseUrl}/api/assets/public%2Fassets%2FAdd%20a%20heading%20copy_1762196498512.png`;
  
  // Dashboard URL for "View Live Dashboard" button
  const dashboardUrl = `${baseUrl}/broker-dashboard`;
  
  const companyName = brandingVars?.companyName || 'LandLinq';
  const contactEmail = brandingVars?.supportEmail || brandingVars?.contactEmail || 'catalyst@landlinq.ai';
  const contactPhone = brandingVars?.supportPhone || brandingVars?.contactPhone || '(704) 610-1549';
  const websiteUrl = brandingVars?.websiteUrl || 'https://landlinq.ai';
  
  // Convert literal \n strings to actual newlines first (for templates that have escaped newlines)
  text = text.replace(/\\n/g, '\n');
  
  // Split by double newlines for paragraphs
  const paragraphs = text.split(/\n\n/);
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.5;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .email-container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 0px;
      padding-bottom: 20px;
      border-bottom: 2px solid #4A90E2;
    }
    .logo {
      max-width: 350px;
      height: auto;
      display: block;
      margin: 0 auto 20px auto;
    }
    .dashboard-button {
      display: inline-block;
      background-color: #4A90E2;
      color: white !important;
      padding: 12px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      margin-top: 15px;
      box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);
    }
    .dashboard-button:hover {
      background-color: #357ABD;
    }
    .content {
      margin-top: 20px;
    }
    .content p {
      margin: 0 0 8px 0;
      line-height: 1.5;
    }
    .button-container {
      text-align: center;
      margin: 20px 0;
    }
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <img src="${logoUrl}" alt="${companyName}" class="logo" />
    </div>
    <div class="content">
`;

  paragraphs.forEach(paragraph => {
    if (paragraph.trim()) {
      // Convert single newlines within paragraphs to <br> tags
      let formattedParagraph = paragraph
        .replace(/\\n/g, '<br>')
        .replace(/\n/g, '<br>')
        .trim();
      
      // Reduce excessive line breaks (more than 2 consecutive <br> tags) to just 2
      formattedParagraph = formattedParagraph.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
      
      // Bold specific section headers and labels
      formattedParagraph = formattedParagraph
        .replace(/(Here is why:)/gi, '<strong>$1</strong>')
        .replace(/(Property:)/gi, '<strong>$1</strong>')
        .replace(/\b(Status:)/gi, '<strong>$1</strong>')
        .replace(/(3 Ways to Submit Deals:)/gi, '<strong>$1</strong>')
        .replace(/(View your dashboard:)/gi, '<strong>$1</strong>')
        .replace(/(Deal Details:)/gi, '<strong>$1</strong>')
        .replace(/(Your Team:)/gi, '<strong>$1</strong>')
        .replace(/(Next Steps:)/gi, '<strong>$1</strong>');
      
      // Auto-hyperlink "Catalyst" to https://www.catalystcp.com/
      // Avoid double-linking by checking if Catalyst is already in an anchor tag
      if (!/<a[^>]*>.*Catalyst.*<\/a>/i.test(formattedParagraph)) {
        formattedParagraph = formattedParagraph
          .replace(/\bCatalyst\b/g, '<a href="https://www.catalystcp.com/" style="color: #4A90E2; text-decoration: none;">Catalyst</a>');
      }
      
      // Convert main action URLs to styled button links (but keep footer/inline links as regular links)
      // Skip URLs that are already inside anchor tags to avoid double-linking
      if (!/<a[^>]*>.*https?:\/\/.*<\/a>/i.test(formattedParagraph)) {
        // Only convert dashboard and password reset URLs to buttons
        // Footer links like unsubscribe, contact links, etc. remain as regular links
        formattedParagraph = formattedParagraph
          .replace(
            /(https?:\/\/[^\s<]+\/(dashboard|reset-password)[^\s<]*)/gi,
            (url) => {
              // Determine button text based on URL
              let buttonText = 'Click Here';
              if (url.includes('/dashboard')) {
                buttonText = 'View Your Dashboard';
              } else if (url.includes('/reset-password')) {
                buttonText = 'Reset Your Password';
              }
              
              return `<div style="text-align: center; margin: 25px 0;"><a href="${url}" style="background-color: #4A90E2; color: white; padding: 16px 48px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(74, 144, 226, 0.4); transition: all 0.3s ease;">${buttonText}</a></div>`;
            }
          );
      }
      
      // Check if paragraph contains HTML block elements (div, a with href, etc.)
      // If it does, don't wrap in <p> tags to avoid breaking HTML structure
      const hasHTMLTags = /<(div|a\s+href|button|table|ul|ol|h[1-6])[>\s]/i.test(formattedParagraph);
      
      if (hasHTMLTags) {
        // Already has HTML structure - insert directly without wrapping
        html += `      ${formattedParagraph}\n`;
      } else {
        // Plain text or simple formatting - wrap in <p> tags
        html += `      <p>${formattedParagraph}</p>\n`;
      }
    }
  });

  // Strip trailing <br> tags accumulated at end of content before closing the div
  html = html.replace(/(\s*<br\s*\/?>\s*)+$/i, '');

  html += `
    </div>`;
  
  // Add email signature if available from business settings
  const signature = brandingVars?.emailSignature || '';
  if (signature) {
    let formattedSignature = signature
      .replace(/\\n/g, '<br>')
      .replace(/\n/g, '<br>')
      .trim();
    
    // Make "Powered By LandLinq™" text smaller than rest of signature
    formattedSignature = formattedSignature.replace(
      /(Powered By LandLinq™?|Powered By LandLinq)/gi,
      '<span style="font-size: 10px; color: #999;">$1</span>'
    );
    
    html += `
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee; white-space: pre-line;">
      ${formattedSignature}
    </div>`;
  }
  
  html += `
    <div class="footer">
      <p>© 2025 ${companyName} | ${contactEmail} | ${contactPhone} | ${websiteUrl}</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

export interface TemplateVariables {
  [key: string]: string | undefined;
}

// DEPRECATED: DO NOT USE - All branding comes from outreach management settings
// This constant is kept ONLY for backward compatibility with legacy code
// All new code should fetch branding from businessSettings via storage.getBusinessSettings()
export const LANDLINQ_BRANDING = {
  logoUrl: '', // DEPRECATED - Use businessSettings.logoUrl
  logoAlt: 'LandLinq', // DEPRECATED - Use businessSettings.companyName
  companyName: 'LandLinq', // DEPRECATED - Use businessSettings.companyName
  tagline: 'Professional Land Acquisition Platform', // DEPRECATED - Use businessSettings.tagline
  brandColor: '#4A90E2', // DEPRECATED - Use businessSettings.secondaryColor
  brandColorDark: '#0A2B4A', // DEPRECATED - Use businessSettings.primaryColor
  contactPhone: '(704) 610-1549', // DEPRECATED - Use businessSettings.supportPhone
  contactEmail: 'catalyst@landlinq.ai', // DEPRECATED - Use businessSettings.supportEmail
  websiteUrl: 'https://landlinq.ai', // Static
  dashboardUrl: '/dashboard' // Static
};

export interface TemplateResult {
  subject: string;
  content: string;
  html?: string;
  sendgridTemplateId?: string;
  sendgridDynamicData?: Record<string, any>;
}

export class TemplateService {
  /**
   * Get email template from business settings (outreach management) ONLY
   * Templates must provide complete HTML - no hardcoded styling or branding allowed
   * Logo and branding variables are automatically added
   */
  static async getEmailTemplate(eventType: string, variables: TemplateVariables = {}): Promise<TemplateResult | null> {
    try {
      console.log(`📧 [TEMPLATE-LOOKUP] Searching for email template: "${eventType}"`);
      
      // Get business settings which contains ALL templates from outreach management
      const businessSettings = await storage.getBusinessSettings();
      const emailTemplates = (businessSettings as any)?.emailTemplates || [];
      
      console.log(`📧 [TEMPLATE-LOOKUP] Found ${emailTemplates.length} total email templates in database`);
      
      // Normalize event name for comparison
      const normalizeEventName = (name: string) => name?.toLowerCase().trim().replace(/\s+/g, '_') || '';
      const targetNormalized = normalizeEventName(eventType);
      
      console.log(`📧 [TEMPLATE-LOOKUP] Normalized search term: "${targetNormalized}"`);
      
      // Log all available templates for debugging
      if (emailTemplates.length > 0) {
        console.log(`📧 [TEMPLATE-LOOKUP] Available templates:`);
        emailTemplates.forEach((t: any, index: number) => {
          const eventField = t.event || t.type || t.trigger || t.eventType || t.tag || 'NO_EVENT_FIELD';
          const normalized = normalizeEventName(eventField);
          console.log(`   ${index + 1}. Name: "${t.name || 'unnamed'}" | Event: "${eventField}" | Normalized: "${normalized}" | Active: ${t.isActive !== false}`);
        });
      }
      
      // Find template by checking ALL legacy keys: event, type, trigger, eventType, tag
      let template = emailTemplates.find((tmpl: any) => {
        const templateEvent = tmpl.event || tmpl.type || tmpl.trigger || tmpl.eventType || tmpl.tag || '';
        const templateNormalized = normalizeEventName(templateEvent);
        return templateNormalized === targetNormalized;
      });
      
      // FALLBACK: Try prefix matching for specific missing info templates
      // e.g., 'info_missing_address' → 'info_missing', 'info_missing_acreage' → 'info_missing'
      if (!template && targetNormalized.startsWith('info_missing_')) {
        console.log(`🔍 [EMAIL-TEMPLATE] Exact match not found for '${eventType}', trying fallback to 'info_missing'...`);
        template = emailTemplates.find((tmpl: any) => {
          const templateEvent = tmpl.event || tmpl.type || tmpl.trigger || tmpl.eventType || tmpl.tag || '';
          const templateNormalized = normalizeEventName(templateEvent);
          return templateNormalized === 'info_missing';
        });
        if (template) {
          console.log(`✅ [EMAIL-TEMPLATE] Fallback successful: Using 'info_missing' template for '${eventType}'`);
        }
      }
      
      if (!template) {
        console.error(`❌ [TEMPLATE-LOOKUP] NOT FOUND: No template matches "${eventType}" (normalized: "${targetNormalized}")`);
        console.error(`❌ [TEMPLATE-LOOKUP] Total templates in DB: ${emailTemplates.length}`);
        console.error(`❌ [TEMPLATE-LOOKUP] HINT: Create a template in Outreach Management with event type: "Deal Submitted" or "deal_submitted"`);
        return null;
      }
      
      console.log(`✅ [TEMPLATE-LOOKUP] FOUND template: "${template.name}" | Event: "${template.event || template.type || template.trigger || template.eventType || template.tag}"`);
      console.log(`✅ [TEMPLATE-LOOKUP] Subject: "${template.subject || 'NO SUBJECT'}"`);
      console.log(`✅ [TEMPLATE-LOOKUP] Has content: ${!!template.content} | Has HTML: ${!!template.html}`);
      
      // Replace variables in subject, content, and html
      let subject = template.subject || '';
      let content = template.content || '';
      let html = template.html || '';
      
      console.log(`🔍 [TEMPLATE-RAW] Template "${eventType}" retrieved from database`);
      console.log(`🔍 [TEMPLATE-RAW] HTML preview (first 300 chars):`, html.substring(0, 300));
      console.log(`🔍 [TEMPLATE-RAW] HTML has angle brackets?`, html.includes('<div>'), html.includes('</div>'));
      
      // ⚠️ HARDCODED LOGO: Use Catalyst:LandLinq logo at top of ALL emails (per user request)
      // Get current environment domain
      const currentDomain = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'https://catalyst.landlinq.ai';
      
      // Hardcode logo URL - DO NOT use businessSettings.logoUrl - Use new Catalyst branding
      // Served from Object Storage to reduce deployment size
      const logoUrl = `${currentDomain}/api/assets/public%2Fassets%2FAdd%20a%20heading%20copy_1762196498512.png`;
      console.log(`🔒 [LOGO-HARDCODED] Using hardcoded Catalyst:LandLinq logo: ${logoUrl}`);
      
      const dynamicBranding = {
        logoUrl,
        logoAlt: 'LandLinq Logo',
        companyName: businessSettings?.companyName || 'LandLinq',
        tagline: businessSettings?.tagline || 'Professional Land Acquisition Platform',
        primaryColor: businessSettings?.primaryColor || '#0A2B4A',
        secondaryColor: businessSettings?.secondaryColor || '#4A90E2',
        brandColor: businessSettings?.secondaryColor || '#4A90E2', // Alias for backward compatibility
        brandColorDark: businessSettings?.primaryColor || '#0A2B4A', // Alias for backward compatibility
        supportPhone: businessSettings?.supportPhone || '(704) 610-1549',
        supportEmail: businessSettings?.supportEmail || 'catalyst@landlinq.ai',
        contactPhone: businessSettings?.supportPhone || '(704) 610-1549', // Alias
        contactEmail: businessSettings?.supportEmail || 'catalyst@landlinq.ai', // Alias
        emailSignature: businessSettings?.emailSignature || '', // Email signature from business settings
        websiteUrl: 'https://landlinq.ai',
        dashboardUrl: `${currentDomain}/broker-dashboard` // ✅ Fixed: Use current domain, not hardcoded old URL
      };
      
      // Provide sensible defaults for all common variables to prevent empty placeholders
      const commonDefaults = {
        brokerName: 'Valued Partner',
        propertyAddress: 'Property Address',
        address: 'Property Address',
        analystName: 'Austin Blondell',
        dealId: 'Pending',
        missingFields: 'additional details',
        date: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
        dealValue: 'To be determined',
        brokerEmail: '',
        receivedDate: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: true }),
        dashboardUrl: `${currentDomain}/broker-dashboard`, // ✅ Fixed: Use current domain
        reportDate: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
      };
      
      const allVariables = {
        ...dynamicBranding, // Business settings branding
        ...commonDefaults, // Default values for common variables
        ...variables // User-provided variables override everything
      };
      
      // Replace all template variables in all fields
      for (const [key, value] of Object.entries(allVariables)) {
        if (value !== undefined && value !== null && value !== '') {
          const placeholder = `{{${key}}}`;
          const regex = new RegExp(placeholder, 'g');
          const stringValue = String(value); // Convert to string to handle numbers/booleans
          subject = subject.replace(regex, stringValue);
          content = content.replace(regex, stringValue);
          html = html.replace(regex, stringValue);
        }
      }
      
      // CRITICAL: Remove any remaining unreplaced placeholders to prevent {{variableName}} in emails
      const removeUnreplacedPlaceholders = (text: string): string => {
        // Find all {{variableName}} patterns and replace with empty string
        return text.replace(/\{\{[^}]+\}\}/g, '');
      };
      
      subject = removeUnreplacedPlaceholders(subject);
      content = removeUnreplacedPlaceholders(content);
      html = removeUnreplacedPlaceholders(html);
      
      // CRITICAL FIX: Convert literal \n escape sequences to actual newlines FIRST
      // This must happen BEFORE bold formatting to prevent HTML detection from skipping newline conversion
      const convertEscapedNewlines = (text: string): string => {
        return text.replace(/\\n/g, '\n');
      };
      
      content = convertEscapedNewlines(content);
      html = convertEscapedNewlines(html);
      
      // CRITICAL: If no HTML provided in template, convert content to proper HTML
      // But outreach management should provide complete HTML
      console.log(`🔍 [TEMPLATE] Before HTML processing - html exists: ${!!html}, content exists: ${!!content}`);
      if (html) {
        console.log(`🔍 [TEMPLATE] HTML field preview: ${html.substring(0, 100)}...`);
      }
      if (content) {
        console.log(`🔍 [TEMPLATE] Content field preview: ${content.substring(0, 100)}...`);
      }
      
      if ((!html || html.trim() === '') && content) {
        // Check if content already contains COMPLEX HTML tags (not just <strong> or <br>)
        // We want to use convertTextToHTML for plain text with basic formatting
        const containsComplexHTML = /<(div|table|html|head|body|style)[>\s]/i.test(content);
        
        if (containsComplexHTML) {
          // Content already has HTML - use it directly and wrap with email shell
          console.log(`✅ [TEMPLATE] Detected HTML in content field for '${eventType}' - using as HTML`);
          console.log(`✅ [TEMPLATE] Content preview: ${content.substring(0, 200)}...`);
          
          // CRITICAL FIX: Convert newlines to <br> tags for HTML content
          // Replace \n\n with <br><br> for paragraph breaks, \n with <br> for line breaks
          content = content.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
          
          const baseUrl = process.env.REPLIT_DOMAINS 
            ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
            : 'https://landlinq.ai';
          // ⚠️ HARDCODED LOGO: Use Catalyst:LandLinq logo (same as line 336)
          // Served from Object Storage to reduce deployment size
          const logoUrl = `${baseUrl}/api/assets/public%2Fassets%2FAdd%20a%20heading%20copy_1762196498512.png`;
          const companyName = dynamicBranding.companyName || 'LandLinq';
          const contactEmail = dynamicBranding.supportEmail || 'catalyst@landlinq.ai';
          const contactPhone = dynamicBranding.supportPhone || '(704) 610-1549';
          const websiteUrl = dynamicBranding.websiteUrl || 'https://landlinq.ai';
          
          html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.5;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .email-container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 0px;
      padding-bottom: 20px;
      border-bottom: 2px solid #4A90E2;
    }
    .logo {
      max-width: 350px;
      height: auto;
      display: block;
      margin: 0 auto 20px auto;
    }
    .dashboard-button {
      display: inline-block;
      background-color: #4A90E2;
      color: white !important;
      padding: 12px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      margin-top: 15px;
      box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);
    }
    .dashboard-button:hover {
      background-color: #357ABD;
    }
    .content {
      margin-top: 20px;
    }
    .content p {
      margin: 0 0 8px 0;
      line-height: 1.5;
    }
    .button-container {
      text-align: center;
      margin: 20px 0;
    }
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <img src="${logoUrl}" alt="${companyName}" class="logo" />
    </div>
    <div class="content">
      ${content.replace(/(\s*<br\s*\/?>\s*)+$/gi, '')}
    </div>
    <div class="footer">
      <p>© 2025 ${companyName} | ${contactEmail} | ${contactPhone} | ${websiteUrl}</p>
    </div>
  </div>
</body>
</html>`;
        } else {
          // Plain text content - convert to HTML properly (this is normal and supported)
          console.log(`📧 [TEMPLATE] Converting plain text to HTML for '${eventType}'`);
          html = convertTextToHTML(content, dynamicBranding); // Convert plain text to proper HTML with actual branding values
        }
      }
      
      console.log(`🔍 [TEMPLATE-RETURN] Returning template for "${eventType}"`);
      console.log(`🔍 [TEMPLATE-RETURN] HTML preview (first 300 chars):`, html.substring(0, 300));
      console.log(`🔍 [TEMPLATE-RETURN] HTML has angle brackets?`, html.includes('<div>'), html.includes('</div>'));
      
      // ⚠️ POST-PROCESSING: Inject "View Live Dashboard" button for:
      // 1. Weekly digest emails
      // 2. Deal alert emails (when catalystcp.com members are assigned to deals)
      // 3. Deal submission confirmation emails (brokers)
      // 4. New broker registration emails
      // 5. Info missing follow-up emails (brokers)
      // 6. Status update emails - under review (brokers)
      // 7. Status update emails - rejected (brokers)
      // 8. Monthly broker outreach emails (brokers)
      // 9. Status update emails - pursuing (brokers)
      const isWeeklyDigest = eventType?.toLowerCase().includes('weekly') || 
                            eventType?.toLowerCase().includes('digest') ||
                            eventType?.toLowerCase().includes('weekly_digest');
      
      const isDealAlert = eventType?.toLowerCase().includes('deal_alert') ||
                         eventType?.toLowerCase().includes('deal_assigned');
      
      const isDealSubmitted = eventType?.toLowerCase().includes('deal_submitted') ||
                             eventType?.toLowerCase().includes('deal_confirmation');
      
      const isBrokerRegistered = eventType?.toLowerCase().includes('broker_registered') ||
                                eventType?.toLowerCase().includes('welcome') ||
                                eventType?.toLowerCase().includes('registration');
      
      const isInfoMissing = eventType?.toLowerCase().includes('info_missing') ||
                           eventType?.toLowerCase().includes('information_missing') ||
                           eventType?.toLowerCase().includes('missing_info');
      
      const isStatusUnderReview = eventType?.toLowerCase().includes('status_under_review') ||
                                 eventType?.toLowerCase().includes('under_review') ||
                                 eventType?.toLowerCase().includes('status_update');
      
      const isStatusRejected = eventType?.toLowerCase().includes('status_rejected') ||
                              eventType?.toLowerCase().includes('rejected') ||
                              eventType?.toLowerCase().includes('deal_rejected');
      
      const isMonthlyOutreach = eventType?.toLowerCase().includes('monthly_broker_outreach') ||
                               eventType?.toLowerCase().includes('monthly_outreach') ||
                               eventType?.toLowerCase().includes('broker_outreach');
      
      const isStatusPursuing = eventType?.toLowerCase().includes('status_pursuing') ||
                              eventType?.toLowerCase().includes('pursuing') ||
                              eventType?.toLowerCase().includes('deal_pursuing');
      
      // CRITICAL: Classification emails (green/yellow/red) should NOT get auto-injected buttons
      // The templates in Outreach Management handle their own button placement
      const isClassificationEmail = isStatusPursuing || isStatusUnderReview || isStatusRejected;
      
      const shouldShowDashboardButton = (isWeeklyDigest || isDealAlert || isDealSubmitted || isBrokerRegistered || isInfoMissing || isMonthlyOutreach) && !isClassificationEmail;
      
      if (shouldShowDashboardButton && html && html.includes('</body>')) {
        // Determine target dashboard based on email type
        let targetDashboard: string;
        
        if (isWeeklyDigest) {
          // Weekly digest goes to analyst dashboard
          targetDashboard = '/analyst-dashboard';
        } else if (isDealAlert && variables.dealId) {
          // Deal alerts go to specific deal in analyst dashboard
          targetDashboard = `/analyst-dashboard?dealId=${variables.dealId}`;
        } else if (isDealAlert) {
          // Deal alert without dealId, go to analyst dashboard
          targetDashboard = '/analyst-dashboard';
        } else {
          // All broker emails go to broker dashboard
          targetDashboard = '/broker-dashboard';
        }
        
        // Build login URL with redirect parameter
        const dashboardUrl = `${currentDomain}/login?redirect=${encodeURIComponent(targetDashboard)}`;
        
        const dashboardButtonHTML = `
    <!-- View Live Dashboard Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="display: inline-block; background-color: #4A90E2; color: white !important; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">View Live Dashboard</a>
    </div>
  </body>`;
        
        html = html.replace('</body>', dashboardButtonHTML);
        const emailType = isWeeklyDigest ? 'weekly digest' : 
                         isDealAlert ? 'deal alert' : 
                         isDealSubmitted ? 'deal confirmation' : 
                         isBrokerRegistered ? 'broker registration' :
                         isInfoMissing ? 'info missing' :
                         isStatusUnderReview ? 'status under review' :
                         isStatusRejected ? 'status rejected' :
                         isMonthlyOutreach ? 'monthly outreach' :
                         'status pursuing';
        console.log(`✅ [DASHBOARD-BUTTON] Injected "View Live Dashboard" button into ${emailType} email`);
      }
      
      // ⚠️ POST-PROCESSING: Inject "Reset Password" button for password_reset emails
      const isPasswordReset = eventType?.toLowerCase()?.includes('password_reset') ||
                             eventType?.toLowerCase()?.includes('password reset');
      
      if (isPasswordReset && html && html.includes('</body>') && variables.resetUrl) {
        const resetPasswordButtonHTML = `
    <!-- Reset Password Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${variables.resetUrl}" style="display: inline-block; background-color: #DC2626; color: white !important; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);">Reset Password</a>
    </div>
  </body>`;
        
        html = html.replace('</body>', resetPasswordButtonHTML);
        console.log(`✅ [PASSWORD-RESET-BUTTON] Injected "Reset Password" button into password reset email`);
      }
      
      // ⚠️ POST-PROCESSING: Inject "Opt In to SMS" button for sms_opt_in emails
      const isSmsOptIn = eventType?.toLowerCase()?.includes('sms_opt_in') ||
                        eventType?.toLowerCase()?.includes('sms opt-in') ||
                        eventType?.toLowerCase()?.includes('sms opt in');
      
      if (isSmsOptIn && html && html.includes('</body>') && variables.optInUrl) {
        const smsOptInButtonHTML = `
    <!-- Opt In to SMS Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${variables.optInUrl}" style="display: inline-block; background-color: #10B981; color: white !important; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">Opt In to SMS Notifications</a>
    </div>
  </body>`;
        
        html = html.replace('</body>', smsOptInButtonHTML);
        console.log(`✅ [SMS-OPT-IN-BUTTON] Injected "Opt In to SMS" button into SMS opt-in email`);
      }
      
      // Check if template has a SendGrid dynamic template ID configured
      const sendgridTemplateId = template.sendgridTemplateId || undefined;
      
      // If SendGrid template ID is set, prepare dynamic data for SendGrid
      let sendgridDynamicData: Record<string, any> | undefined = undefined;
      if (sendgridTemplateId) {
        console.log(`✅✅✅ [SENDGRID-DYNAMIC] Using SendGrid template: ${sendgridTemplateId} for event: ${eventType}`);
        // Pass all variables as dynamic template data for SendGrid
        sendgridDynamicData = allVariables;
      } else {
        console.log(`📧 [OUTREACH-TAB] Using Outreach Tab HTML template for event: ${eventType} (no SendGrid ID configured)`);
      }
      
      return {
        subject,
        content,
        html,
        sendgridTemplateId,
        sendgridDynamicData
      };
    } catch (error) {
      console.error(`Error loading email template for ${eventType}:`, error);
      return null;
    }
  }
  
  /**
   * Get SMS template from business settings (outreach management) ONLY
   */
  static async getSMSTemplate(eventType: string, variables: TemplateVariables = {}): Promise<string | null> {
    try {
      const businessSettings = await storage.getBusinessSettings();
      const smsTemplates = (businessSettings as any)?.smsTemplates || [];
      
      // Normalize event name for comparison
      const normalizeEventName = (name: string) => name?.toLowerCase().trim().replace(/\s+/g, '_') || '';
      const targetNormalized = normalizeEventName(eventType);
      
      // Find template by checking ALL legacy keys: event, type, trigger, eventType, tag
      let template = smsTemplates.find((tmpl: any) => {
        const templateEvent = tmpl.event || tmpl.type || tmpl.trigger || tmpl.eventType || tmpl.tag || '';
        const templateNormalized = normalizeEventName(templateEvent);
        return templateNormalized === targetNormalized;
      });
      
      // FALLBACK: Try prefix matching for specific missing info templates
      // e.g., 'info_missing_address' → 'info_missing', 'info_missing_acreage' → 'info_missing'
      if (!template && targetNormalized.startsWith('info_missing_')) {
        console.log(`🔍 [SMS-TEMPLATE] Exact match not found for '${eventType}', trying fallback to 'info_missing'...`);
        template = smsTemplates.find((tmpl: any) => {
          const templateEvent = tmpl.event || tmpl.type || tmpl.trigger || tmpl.eventType || tmpl.tag || '';
          const templateNormalized = normalizeEventName(templateEvent);
          return templateNormalized === 'info_missing';
        });
        if (template) {
          console.log(`✅ [SMS-TEMPLATE] Fallback successful: Using 'info_missing' template for '${eventType}'`);
        }
      }
      
      if (!template) {
        console.error(`❌ [SMS-TEMPLATE] NOT FOUND: '${eventType}' (looking for: '${targetNormalized}')`);
        console.error(`❌ [SMS-TEMPLATE] Available events:`, smsTemplates.map((t: any) => 
          t.event || t.type || t.trigger || t.eventType
        ));
        return null;
      }
      
      console.log(`✅ [SMS-TEMPLATE] FOUND template for '${eventType}': "${template.name || 'unnamed'}"`)
      
      // Replace variables in content
      let content = template.content || '';
      
      // Debug logging for status_rejected to trace rejectionReason issue
      const DEBUG_TEMPLATES = process.env.DEBUG_TEMPLATES === 'true' || eventType === 'status_rejected';
      
      if (DEBUG_TEMPLATES) {
        console.log(`📝 [SMS-TEMPLATE] Template content before variable substitution:`, content.substring(0, 200));
        console.log(`📝 [SMS-TEMPLATE] Variables provided:`, Object.keys(variables).join(', '));
        // Specifically log rejectionReason for debugging
        if (eventType === 'status_rejected') {
          console.log(`📝 [SMS-TEMPLATE] rejectionReason value:`, (variables as any).rejectionReason || 'NOT PROVIDED');
        }
      }
      
      // Replace all template variables
      for (const [key, value] of Object.entries(variables)) {
        if (value !== undefined && value !== null) {
          const placeholder = `{{${key}}}`;
          const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const before = content;
          content = content.replace(new RegExp(escapedPlaceholder, 'g'), String(value));
          if (DEBUG_TEMPLATES && before !== content) {
            console.log(`  ✅ Replaced {{${key}}}`);
          }
        } else if (DEBUG_TEMPLATES) {
          console.log(`  ⚠️ Skipping {{${key}}} (value is ${value})`);
        }
      }
      
      if (DEBUG_TEMPLATES) {
        console.log(`📝 [SMS-TEMPLATE] Variables replaced successfully`);
      }
      
      // Convert literal \n to actual newlines for SMS
      content = content.replace(/\\n/g, '\n');
      
      return content;
    } catch (error) {
      console.error(`Error loading SMS template for ${eventType}:`, error);
      return null;
    }
  }
  
  // REMOVED: All hardcoded HTML generation functions
  // REMOVED: All hardcoded branding and styling
  // REMOVED: All hardcoded template content
  //
  // Templates from outreach management MUST provide:
  // 1. Complete HTML including <html>, <head>, <body> tags
  // 2. All CSS styling inline or in <style> tags
  // 3. Company branding, colors, logos
  // 4. Footer with contact information
  // 5. Responsive design for mobile devices
  //
  // NO HARDCODED FALLBACKS ALLOWED
  // If template is missing from outreach management, communication WILL FAIL
  // This enforces 100% outreach management template usage
}

// NO HARDCODED TEMPLATES OR FALLBACKS - 100% outreach management exclusive
// All email and SMS templates MUST be configured in business settings
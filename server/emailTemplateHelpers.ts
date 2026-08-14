// EMAIL TEMPLATE HELPERS FOR LANDLINQ BRANDING
// This provides utilities for creating professional email templates with consistent branding

export const LANDLINQ_EMAIL_STYLE = `
<style>
  .landlinq-email {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 600px;
    margin: 0 auto;
    background: white;
  }
  .landlinq-header {
    background: linear-gradient(135deg, #0A2B4A 0%, #4A90E2 100%);
    color: white;
    padding: 8px 20px;
    text-align: center;
    border-radius: 8px 8px 0 0;
  }
  .landlinq-logo {
    max-width: 200px;
    height: auto;
    margin: 0;
    display: block;
    margin-left: auto;
    margin-right: auto;
  }
  .landlinq-tagline {
    font-size: 14px;
    opacity: 0.9;
    margin: 0;
  }
  .landlinq-content {
    padding: 30px 20px;
    background: white;
  }
  .landlinq-footer {
    background: #f8fafc;
    padding: 20px;
    text-align: center;
    border-top: 1px solid #e2e8f0;
    border-radius: 0 0 8px 8px;
  }
  .landlinq-button {
    display: inline-block;
    background: #4A90E2;
    color: white;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 500;
    margin: 15px 0;
  }
  .landlinq-button:hover {
    background: #0A2B4A;
  }
</style>
`;

export function createEmailTemplate(content: string, options: {
  logoUrl?: string;
  headerColor?: string;
  showFooter?: boolean;
} = {}) {
  const {
    logoUrl = '/landlinq-logo.png', // Updated to use your new logo
    headerColor = 'linear-gradient(135deg, #0A2B4A 0%, #4A90E2 100%)',
    showFooter = true
  } = options;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LandLinq - Professional Land Acquisition Platform</title>
  ${LANDLINQ_EMAIL_STYLE}
</head>
<body>
  <div class="landlinq-email">
    <div class="landlinq-header" style="background: ${headerColor};">
      <img src="{{logoUrl}}" alt="{{logoAlt}}" class="landlinq-logo" />
      <p class="landlinq-tagline">{{tagline}}</p>
    </div>
    
    <div class="landlinq-content">
      ${content}
    </div>
    
    ${showFooter ? `
    <div class="landlinq-footer">
      <p style="margin: 0; font-size: 14px; color: #666;">
        © 2025 LandLinq. | <a href="mailto:{{contactEmail}}" style="color: #4A90E2; text-decoration: none;">{{contactEmail}}</a> | {{contactPhone}} | <a href="{{websiteUrl}}" style="color: #4A90E2; text-decoration: none;">{{websiteUrl}}</a>
      </p>
    </div>
    ` : ''}
  </div>
</body>
</html>
  `.trim();
}

// SAMPLE EMAIL TEMPLATES FOR OUTREACH MANAGEMENT
export const SAMPLE_EMAIL_TEMPLATES = {
  deal_submitted: {
    event: 'deal_submitted',
    subject: '✅ Deal Received - {{address}} | {{companyName}}',
    content: `Hi {{brokerName}},

Thank you for submitting your deal! We've received your property submission and our team is already reviewing it.

**Deal Details:**
📍 Address: {{address}}
🆔 Deal ID: {{dealId}}
📊 Status: {{classification}}

We'll provide feedback within 24-48 hours. Our team will reach out if we need any additional information.

Best regards,
The LandLinq Team`,
    html: createEmailTemplate(`
      <h2 style="color: #0A2B4A; margin-bottom: 20px;">Your LandLinq™ property submission has been received!</h2>
      <p>Hi <strong>{{brokerName}}</strong>,</p>
      
      <p><strong>Property:</strong> {{address}}<br>
      <strong>Status:</strong> Under Review</p>
      
      <p>Someone from the Catalyst Acquisition Team will respond within 24 hours.</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="{{websiteUrl}}/broker-dashboard" class="landlinq-button" style="background: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">View Your Broker Dashboard</a>
      </div>
      
      <p style="font-size: 12px; color: #666; margin-top: 20px;">Track your deal status, add information, or edit details anytime from your broker dashboard.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0;">Best regards,<br><strong>The LandLinq Team</strong></p>
      </div>
    `)
  },

  info_missing: {
    event: 'info_missing',
    subject: '📝 Additional Information Needed - {{address}} | {{companyName}}',
    content: `Hi {{brokerName}},

Thanks for your property submission! We're excited to review {{address}}, but we need a bit more information to complete our analysis.

**Missing Information:**
{{missingFields}}

Could you please provide these details when you have a moment? Once we have this information, we can provide you with comprehensive feedback on the opportunity.

Best regards,
The LandLinq Team`,
    html: createEmailTemplate(`
      <h2 style="color: #0A2B4A; margin-bottom: 20px;">📝 Additional Information Needed</h2>
      <p>Hi <strong>{{brokerName}}</strong>,</p>
      <p>Thanks for your property submission! We're excited to review <strong>{{address}}</strong>, but we need a bit more information to complete our analysis.</p>
      
      <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h3 style="margin: 0 0 15px; color: #856404;">Missing Information</h3>
        <p style="margin: 0; color: #856404;">{{missingFields}}</p>
      </div>
      
      <p>Could you please provide these details when you have a moment? Once we have this information, we can provide you with comprehensive feedback on the opportunity.</p>
      
      <a href="{{websiteUrl}}{{dashboardUrl}}" class="landlinq-button">View Your Dashboard</a>
      
      <p>Best regards,<br><strong>The LandLinq Team</strong></p>
    `)
  }
};
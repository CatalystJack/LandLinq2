// Email Deliverability Service - Ensures broker emails never hit spam
import { sendNotificationEmail } from './emailService';

export class EmailDeliverabilityService {
  
  // Enhanced email templates with anti-spam features
  static generateBrokerConfirmationEmail(brokerName: string, dealDetails: any): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Deal Submission Confirmed - LandLinq</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #1e293b 0%, #475569 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .content { padding: 30px; }
          .status-badge { background: #22c55e; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; }
          .deal-summary { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .deal-detail { margin: 8px 0; }
          .deal-label { font-weight: 600; color: #475569; }
          .next-steps { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
          .cta-button { 
            background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; 
            border-radius: 6px; display: inline-block; margin: 15px 0; font-weight: 600;
            transition: background-color 0.2s;
          }
          .cta-button:hover { background: #2563eb; }
          .footer { background: #f8fafc; padding: 25px; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0; }
          .company-info { font-size: 14px; margin-bottom: 15px; }
          .contact-info { font-size: 13px; color: #64748b; }
          .unsubscribe { font-size: 12px; color: #94a3b8; margin-top: 20px; }
          .professional-signature { 
            background: #f1f5f9; padding: 20px; border-top: 3px solid #3b82f6; 
            text-align: left; margin-top: 20px;
          }
          .signature-name { font-weight: 600; color: #1e293b; }
          .signature-title { color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 LandLinq Notification</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Email Generated From Outreach Management Templates</p>
          </div>
          
          <div class="content">
            <p>Dear ${brokerName},</p>
            
            <p>Thank you for submitting your property deal through LandLinq. We have successfully received your submission and it has been added to our review queue.</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <span class="status-badge">SUBMITTED FOR REVIEW</span>
            </div>
            
            <div class="deal-summary">
              <h3 style="margin-top: 0; color: #1e293b;">📋 Deal Summary</h3>
              <div class="deal-detail">
                <span class="deal-label">Property:</span> ${dealDetails.address || 'Property submitted via email'}
              </div>
              <div class="deal-detail">
                <span class="deal-label">Deal ID:</span> ${dealDetails.id}
              </div>
              <div class="deal-detail">
                <span class="deal-label">Submitted:</span> ${new Date().toLocaleDateString()}
              </div>
              <div class="deal-detail">
                <span class="deal-label">Status:</span> Under Review
              </div>
            </div>
            
            <div class="next-steps">
              <h3 style="margin-top: 0; color: #059669;">🚀 What Happens Next</h3>
              <p style="margin-bottom: 15px;">Our acquisition team will review your submission using our comprehensive criteria:</p>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Property specifications and location analysis</li>
                <li>Market conditions and development potential</li>
                <li>Financial feasibility and returns assessment</li>
                <li>Zoning and regulatory compliance review</li>
              </ul>
              <p style="margin-top: 15px; margin-bottom: 0;"><strong>Response Time:</strong> You can expect to hear back from us within 24-48 hours.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://landlinq.ai/broker-portal" class="cta-button">View Your Submissions</a>
            </div>
            
            <div class="professional-signature">
              <div class="signature-name">LandLinq Acquisition Team</div>
              <div class="signature-title">Real Estate Deal Processing</div>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #64748b;">
                📧 catalyst@landlinq.ai | 📱 (704) 610-1549 | 🌐 landlinq.ai
              </p>
            </div>
          </div>
          
          <div class="footer">
            <div class="company-info">
              <strong>LandLinq</strong> - Connecting Brokers with Capital Partners<br>
              Streamlining Real Estate Acquisitions Since 2024
            </div>
            <div class="contact-info">
              This email was sent to ${dealDetails.brokerEmail || 'your registered email'}<br>
              © 2024 LandLinq. All rights reserved.
            </div>
            <div class="unsubscribe">
              If you no longer wish to receive deal confirmations, please email 
              <a href="mailto:unsubscribe@landlinq.ai" style="color: #94a3b8;">unsubscribe@landlinq.ai</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Send enhanced broker confirmation
  // DISABLED: ALL emails must use templates from outreach management tab
  static async sendBrokerConfirmation(brokerEmail: string, brokerName: string, dealDetails: any): Promise<boolean> {
    console.log(`⚠️ Broker confirmation disabled - no hardcoded emails allowed. Use deal_submitted template instead.`);
    // CRITICAL RULE: Zero hardcoded email templates allowed
    // All emails must come from outreach management tab (use 'deal_submitted' event)
    return false;
  }

  // Enhanced spam prevention guidelines
  static getSpamPreventionChecklist(): string[] {
    return [
      "✅ Professional sender name: 'LandLinq Deal Processing'",
      "✅ Consistent from address: catalyst@landlinq.ai",
      "✅ Authentication headers and organization info",
      "✅ Unsubscribe link in every email",
      "✅ Professional HTML design with proper structure",
      "✅ Clear subject lines without spam trigger words",
      "✅ SendGrid tracking optimized for deliverability",
      "✅ Email categories for analytics and reputation",
      "✅ No excessive links or promotional content",
      "✅ Professional signature with contact information"
    ];
  }

  // Check email content for spam triggers
  static analyzeSpamRisk(subject: string, content: string): {
    riskLevel: 'low' | 'medium' | 'high';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check subject line
    const spamWords = ['free', 'urgent', 'act now', 'limited time', 'guaranteed', 'cash', 'money'];
    const subjectLower = subject.toLowerCase();
    
    spamWords.forEach(word => {
      if (subjectLower.includes(word)) {
        issues.push(`Subject contains potential spam word: "${word}"`);
      }
    });
    
    // Check content length
    if (content.length < 100) {
      issues.push('Email content is very short');
      recommendations.push('Add more detailed information');
    }
    
    // Check for excessive capitalization
    const capsRatio = (subject.match(/[A-Z]/g) || []).length / subject.length;
    if (capsRatio > 0.3) {
      issues.push('Subject line has too many capital letters');
      recommendations.push('Use normal capitalization');
    }
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (issues.length > 2) riskLevel = 'high';
    else if (issues.length > 0) riskLevel = 'medium';
    
    if (issues.length === 0) {
      recommendations.push('Email follows best practices for deliverability');
    }
    
    return { riskLevel, issues, recommendations };
  }
}

// Domain authentication setup instructions
export const DOMAIN_SETUP_INSTRUCTIONS = {
  sendgrid: {
    steps: [
      "1. Go to SendGrid → Settings → Sender Authentication",
      "2. Authenticate Domain: landlinq.ai",
      "3. Add these DNS records to your domain:",
      "   - CNAME: s1._domainkey → s1.domainkey.uXXXX.wl.sendgrid.net",
      "   - CNAME: s2._domainkey → s2.domainkey.uXXXX.wl.sendgrid.net", 
      "   - CNAME: em1234 → u12345.wl.sendgrid.net",
      "4. Wait for DNS propagation (24-48 hours)",
      "5. Verify domain authentication in SendGrid"
    ],
    benefits: [
      "✅ SPF and DKIM authentication automatically configured",
      "✅ Improved sender reputation and deliverability",
      "✅ Reduced chance of emails being marked as spam",
      "✅ Professional email authentication visible to recipients"
    ]
  }
};

export default EmailDeliverabilityService;
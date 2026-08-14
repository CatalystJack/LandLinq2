// In-memory business settings storage
import { BusinessSettings } from "@shared/schema";

// HARDCODED: Default business settings with Catalyst:LandLinq logo for all emails
const defaultBusinessSettings: BusinessSettings = {
  id: "default-settings",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  // Essential 7 Email Templates
  emailTemplates: [
    // 1. Welcome Email (broker_registered)
    {
      id: "1",
      name: "Welcome - New Broker Registration",
      subject: "Welcome to {{companyName}} - Your Land Deal Pipeline Starts Here!",
      content: "Dear {{brokerName}},\n\nWelcome to LandLinq! We're excited to have you join our land acquisition network. Here's how to get started:\n\nSubmission Methods:\n- Email: catalyst@landlinq.ai\n- SMS: (704) 610-1549\n- Web: https://landlinq.ai/submit-deal",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 20px 20px 5px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Dear {{brokerName}},</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Welcome to LandLinq! We're excited to have you join our land acquisition network. Here's how to get started:</p>
          <div style="background-color: #fef3c7; border-left: 4px solid #d4af37; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
            <p style="color: #92400e; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Submission Methods:</p>
            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.8;">
              Email: <a href="mailto:catalyst@landlinq.ai" style="color: #92400e;">catalyst@landlinq.ai</a><br>
              SMS: <a href="tel:7046101549" style="color: #92400e;">(704) 610-1549</a><br>
              Web: <a href="https://landlinq.ai/submit-deal" style="color: #92400e;">https://landlinq.ai/submit-deal</a>
            </p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "broker_registered"
    },

    // 2. Deal Submission Confirmation (deal_submitted)
    {
      id: "2", 
      name: "Deal Submission Confirmation",
      subject: "Property Received: {{propertyAddress}}",
      content: "Hi {{brokerName}},\n\nYour LandLinq™ property submission has been received!\n\nProperty: {{propertyAddress}}\nStatus: Under Review\n\nThe Catalyst Acquisition Team will respond within 24 hours with your unique site classification.",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <!-- Header with Logo -->
        <div style="text-align: center; background-color: #ffffff; padding: 20px 20px 5px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin-left: auto; margin-right: auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
        
        <!-- Main Content -->
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Hi {{brokerName}},</p>
          
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
            Your LandLinq™ property submission has been received!
          </p>
          
          <p style="color: #374151; margin: 0 0 10px 0; font-size: 16px; line-height: 1.6;">
            <strong>Property:</strong> {{propertyAddress}}
          </p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
            <strong>Status:</strong> Under Review
          </p>
          
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
            The Catalyst Acquisition Team will respond within 24 hours with your unique site classification.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboardUrl}}" style="background-color: #4A90E2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">View Your Dashboard</a>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 10px;">Track your submission status and communicate with our team</p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #374151; margin: 0 0 10px 0; font-size: 16px; line-height: 1.6; font-weight: 600;">Let's Build What's Next, Together!</p>
            <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.6;"><strong>Catalyst</strong></p>
            <p style="color: #6b7280; margin: 0; font-size: 14px; line-height: 1.6;">Powered by LandLinq™</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a> | 
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "deal_submitted"
    },

    // 3. Information Request (info_missing)
    {
      id: "3",
      name: "Information Request - Missing Details",
      subject: "LandLinq - Quick Property Info Needed: {{propertyAddress}}",
      content: "Hi {{brokerName}},\n\nOur Acquisitions team is requesting additional information for {{propertyAddress}}: {{missingFields}}\n\nWe need this information to run our market analysis and provide you with a quick response.\n\nPlease reply with this info as soon as possible, so that we can continue our analysis and pursuit.",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <!-- Header with Logo -->
        <div style="text-align: center; background-color: #ffffff; padding: 20px 20px 5px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin-left: auto; margin-right: auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
        
        <!-- Main Content -->
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Hi {{brokerName}},</p>
          
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
            Our Acquisitions team is requesting additional information for <strong>{{propertyAddress}}</strong>:
          </p>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #d4af37; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
            <p style="color: #92400e; margin: 0 0 8px 0; font-size: 16px; line-height: 1.6; font-weight: 600;">Missing Information:</p>
            <p style="color: #92400e; margin: 0; font-size: 16px; line-height: 1.6; font-weight: 600;">{{missingFields}}</p>
          </div>
          
          <p style="color: #374151; margin: 0 0 10px 0; font-size: 16px; line-height: 1.6;">
            We need this information to run our market analysis and provide you with a quick response.
          </p>
          
          <p style="color: #374151; margin: 0; font-size: 16px; line-height: 1.6;">
            Please reply with this info as soon as possible, so that we can continue our analysis and pursuit.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboardUrl}}" style="background-color: #4A90E2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">View in Your Dashboard</a>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 10px;">Track your submission status and communicate with our team</p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "info_missing"
    },

    // 4. Under Review (status_under_review)
    {
      id: "4",
      name: "Deal Under Review - In Progress",
      subject: "Under Review: {{propertyAddress}} - Analysis in Progress",
      content: "Dear {{brokerName}},\n\nUpdate on {{propertyAddress}} - our team has completed the initial review and we're moving to detailed analysis.\n\nCurrent Status: Under Review\nTimeline: Decision expected within 48-72 hours\nDeal ID: {{dealId}}\n\nWhat we're analyzing:\n• Market comparables and trends\n• Development feasibility\n• Financial modeling\n• Zoning and permitting requirements\n• Infrastructure and utility costs\n\nOur Process:\nWe're conducting thorough due diligence to ensure we make informed decisions. We'll keep you updated throughout the process.\n\nFeel free to reach out with any questions.\n\nBest regards,\n{{analystName}}\nAcquisitions Team\n{{companyName}}",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 20px 20px 5px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Dear {{brokerName}},</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Update on <strong>{{propertyAddress}}</strong> - our team has completed the initial review and we're moving to detailed analysis.</p>
          <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
            <p style="color: #1e3a8a; margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">Current Status: Under Review</p>
            <p style="color: #1e40af; margin: 0; font-size: 14px;">Timeline: Decision expected within 48-72 hours<br>Deal ID: {{dealId}}</p>
          </div>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">What we're analyzing:</p>
          <ul style="color: #374151; margin: 0 0 25px 0; padding-left: 20px; font-size: 16px; line-height: 1.8;">
            <li>Market comparables and trends</li>
            <li>Development feasibility</li>
            <li>Financial modeling</li>
            <li>Zoning and permitting requirements</li>
            <li>Infrastructure and utility costs</li>
          </ul>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;"><strong>Our Process:</strong><br>We're conducting thorough due diligence to ensure we make informed decisions. We'll keep you updated throughout the process.</p>
          <p style="color: #374151; margin: 0 0 10px 0; font-size: 16px; line-height: 1.6;">Feel free to reach out with any questions.</p>
          <p style="color: #374151; margin: 0 0 25px 0; font-size: 16px; line-height: 1.6;">Best regards,<br>{{analystName}}<br>Acquisitions Team<br>{{companyName}}</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboardUrl}}" style="background-color: #4A90E2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">View in Your Dashboard</a>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 10px;">Track your submission status and communicate with our team</p>
        </div>
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "status_under_review"
    },

    // 5. Pursuing/Approved (status_pursuing)
    {
      id: "5",
      name: "High Priority - Pursuing Deal",
      subject: "HIGH PRIORITY: {{propertyAddress}} - Moving Forward!",
      content: "Dear {{brokerName}},\n\nExcellent news! Your property at {{propertyAddress}} has been classified as HIGH PRIORITY and we're moving forward immediately.\n\nWhy we're excited:\n• Perfect market fit\n• Ideal development potential\n• Strong financial projections\n• Meets all our acquisition criteria\n\nImmediate next steps:\n• Site visit scheduled within 3 business days\n• Due diligence package being prepared\n• Direct contact from {{analystName}} within 2 hours\n• Preliminary offer expected within 5-7 business days\n\nYour dedicated team:\n• Lead Analyst: {{analystName}}\n• Deal ID: {{dealId}}\n\nThis is exactly the type of deal we've been looking for. Let's move quickly!\n\nTalk soon!\n\n{{analystName}}\nSenior Acquisitions Analyst\n{{companyName}}",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; border-bottom: 3px solid #22c55e; padding: 20px 20px 10px 20px; margin-bottom: 30px; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 60px; width: auto; margin: 0 auto 10px auto; display: block;" />
          <h1 style="color: #1f2937; margin: 0; font-size: 24px;">{{companyName}}</h1>
        </div>
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background-color: #dcfce7; border-left: 4px solid #22c55e; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
            <p style="color: #166534; margin: 0; font-size: 18px; font-weight: bold;">HIGH PRIORITY - Moving Forward!</p>
          </div>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Dear {{brokerName}},</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Excellent news! Your property at <strong>{{propertyAddress}}</strong> has been classified as HIGH PRIORITY and we're moving forward immediately.</p>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Why we're excited:</p>
          <ul style="color: #374151; margin: 0 0 25px 0; padding-left: 20px; font-size: 16px; line-height: 1.8;">
            <li>Perfect market fit</li>
            <li>Ideal development potential</li>
            <li>Strong financial projections</li>
            <li>Meets all our acquisition criteria</li>
          </ul>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Immediate next steps:</p>
          <ul style="color: #374151; margin: 0 0 25px 0; padding-left: 20px; font-size: 16px; line-height: 1.8;">
            <li>Site visit scheduled within 3 business days</li>
            <li>Due diligence package being prepared</li>
            <li>Direct contact from {{analystName}} within 2 hours</li>
            <li>Preliminary offer expected within 5-7 business days</li>
          </ul>
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 4px; margin: 0 0 25px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>Your dedicated team:</strong><br>
              Lead Analyst: {{analystName}}<br>
              Deal ID: {{dealId}}
            </p>
          </div>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">This is exactly the type of deal we've been looking for. Let's move quickly!</p>
          <p style="color: #374151; margin: 0 0 25px 0; font-size: 16px; line-height: 1.6;">Talk soon!<br><br>{{analystName}}<br>Senior Acquisitions Analyst<br>{{companyName}}</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboardUrl}}" style="background-color: #4A90E2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">View in Your Dashboard</a>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 10px;">Track your submission status and communicate with our team</p>
        </div>
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "status_pursuing"
    },

    // 6. Not a Fit (status_rejected)
    {
      id: "6",
      name: "Deal Does Not Meet Criteria",
      subject: "Update on {{propertyAddress}} - Not a Current Fit",
      content: "Dear {{brokerName}},\n\nThank you for submitting {{propertyAddress}} for our consideration. After thorough review, this property doesn't align with our current acquisition criteria.\n\nReview Summary:\n• Property: {{propertyAddress}}\n• Deal ID: {{dealId}}\n• Review Date: {{date}}\n\nThis doesn't mean it's not a good deal - it's simply not the right fit for our current portfolio and investment strategy.\n\nWe'd love to see more deals from you that fit these criteria:\n• Size: 15+ acres preferred\n• Zoning: Residential or planned development\n• Location: Growth corridors with infrastructure\n• Development potential: Clear path to entitlements\n\nPlease keep us in mind for future opportunities! We value our relationship and want to work together on the right deal.\n\nThanks again for thinking of {{companyName}}.\n\nBest regards,\n{{analystName}}\n{{companyName}} Acquisitions",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 20px 20px 5px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Dear {{brokerName}},</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Thank you for submitting <strong>{{propertyAddress}}</strong> for our consideration. After thorough review, this property doesn't align with our current acquisition criteria.</p>
          <div style="background-color: #f3f4f6; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
            <p style="color: #374151; margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">Review Summary:</p>
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              Property: {{propertyAddress}}<br>
              Deal ID: {{dealId}}<br>
              Review Date: {{date}}
            </p>
          </div>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">This doesn't mean it's not a good deal - it's simply not the right fit for our current portfolio and investment strategy.</p>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">We'd love to see more deals from you that fit these criteria:</p>
          <ul style="color: #374151; margin: 0 0 25px 0; padding-left: 20px; font-size: 16px; line-height: 1.8;">
            <li>Size: 15+ acres preferred</li>
            <li>Zoning: Residential or planned development</li>
            <li>Location: Growth corridors with infrastructure</li>
            <li>Development potential: Clear path to entitlements</li>
          </ul>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Please keep us in mind for future opportunities! We value our relationship and want to work together on the right deal.</p>
          <p style="color: #374151; margin: 0 0 25px 0; font-size: 16px; line-height: 1.6;">Thanks again for thinking of {{companyName}}.<br><br>Best regards,<br>{{analystName}}<br>{{companyName}} Acquisitions</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboardUrl}}" style="background-color: #4A90E2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">View Your Dashboard</a>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 10px;">Submit your next deal anytime</p>
        </div>
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "status_rejected"
    },

    // 7. LOI Sent (loi_sent) 
    {
      id: "7",
      name: "Letter of Intent Sent",
      subject: "LOI Submitted - {{propertyAddress}} | Next Steps",
      content: "Dear {{brokerName}},\n\nWe've submitted our Letter of Intent for {{propertyAddress}}!\n\nLOI Summary:\n• Property: {{propertyAddress}}\n• Deal ID: {{dealId}}\n• Submission Date: {{date}}\n• Estimated Value: {{dealValue}}\n\nKey Terms Proposed:\n• Subject to satisfactory due diligence\n• Clear title and survey required\n• Environmental clearance needed\n• Zoning verification for intended use\n• Utility availability confirmation\n\nWhat happens next:\n1. Seller review (2-3 business days typically)\n2. Negotiations (we're flexible on terms)\n3. Contract execution (once LOI is accepted)\n4. Due diligence begins immediately upon signing\n\nYour role moving forward:\n• Coordinate with seller for LOI response\n• Help facilitate due diligence access\n• Keep communication flowing between all parties\n\nWe're excited about this opportunity and look forward to working together!\n\n{{analystName}}\nSenior Acquisitions Analyst\n{{companyName}}",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 20px 20px 5px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin: 0 auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Dear {{brokerName}},</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">We've submitted our Letter of Intent for <strong>{{propertyAddress}}</strong>!</p>
          <div style="background-color: #fef3c7; border-left: 4px solid #d4af37; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
            <p style="color: #92400e; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">LOI Summary:</p>
            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.8;">
              Property: {{propertyAddress}}<br>
              Deal ID: {{dealId}}<br>
              Submission Date: {{date}}<br>
              Estimated Value: {{dealValue}}
            </p>
          </div>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Key Terms Proposed:</p>
          <ul style="color: #374151; margin: 0 0 25px 0; padding-left: 20px; font-size: 16px; line-height: 1.8;">
            <li>Subject to satisfactory due diligence</li>
            <li>Clear title and survey required</li>
            <li>Environmental clearance needed</li>
            <li>Zoning verification for intended use</li>
            <li>Utility availability confirmation</li>
          </ul>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">What happens next:</p>
          <ol style="color: #374151; margin: 0 0 25px 0; padding-left: 20px; font-size: 16px; line-height: 1.8;">
            <li>Seller review (2-3 business days typically)</li>
            <li>Negotiations (we're flexible on terms)</li>
            <li>Contract execution (once LOI is accepted)</li>
            <li>Due diligence begins immediately upon signing</li>
          </ol>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Your role moving forward:</p>
          <ul style="color: #374151; margin: 0 0 25px 0; padding-left: 20px; font-size: 16px; line-height: 1.8;">
            <li>Coordinate with seller for LOI response</li>
            <li>Help facilitate due diligence access</li>
            <li>Keep communication flowing between all parties</li>
          </ul>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">We're excited about this opportunity and look forward to working together!</p>
          <p style="color: #374151; margin: 0 0 25px 0; font-size: 16px; line-height: 1.6;">{{analystName}}<br>Senior Acquisitions Analyst<br>{{companyName}}</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboardUrl}}" style="background-color: #4A90E2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">View in Your Dashboard</a>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 10px;">Track this deal and all your submissions</p>
        </div>
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "loi_sent"
    },

    // 8. Monthly Broker Outreach Email (monthlyOutreachReminder)
    {
      id: "8",
      name: "Monthly Broker Outreach Email",
      subject: "🏡 Still Looking for Your Perfect Deal!",
      content: "Hi {{brokerName}},\n\nHope you're having a great month! We wanted to check in and see if you have any exciting land deals that might be a good fit for {{companyName}}.\n\nWe're actively acquiring in these product types:\n• Conventional Apartments (10+ acres)\n• Active Adult Communities (15+ acres)\n• Build-to-Rent (5+ acres)\n• Lot Development (10+ acres)\n\n🎯 What makes a great {{companyName}} deal:\n✓ Proper zoning or entitlements in place\n✓ Strong local rental market fundamentals\n✓ Clear title and development-ready sites\n✓ Competitive pricing for the submarket\n\n💰 Quick decisions and competitive offers\n🚀 No lengthy approval processes\n📞 Direct access to our acquisition team\n\nHave something that might work? Send us the basics:\n📧 Email: catalyst@landlinq.ai\n📱 Text: (704) 610-1549\n🌐 Web: https://landlinq.ai/submit-deal\n\nJust need: Address, asking price, and acreage to get started!\n\nThanks for being part of the {{companyName}} network,\n{{analystName}}\n{{companyName}} Team\n\n---\nTo unsubscribe from monthly updates, reply with \"UNSUBSCRIBE\"",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; border-bottom: 3px solid #d4af37; padding: 20px 20px 10px 20px; margin-bottom: 30px; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 60px; width: auto; margin: 0 auto 10px auto; display: block;" />
          <h1 style="color: #1f2937; margin: 0; font-size: 24px;">{{companyName}}</h1>
          <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 16px;">🏡 Still Looking for Your Perfect Deal!</p>
        </div>
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Hi {{brokerName}},</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Hope you're having a great month! We wanted to check in and see if you have any exciting land deals that might be a good fit for {{companyName}}.</p>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">We're actively acquiring in these product types:</p>
          <ul style="color: #374151; margin: 0 0 25px 0; padding-left: 20px; font-size: 16px; line-height: 1.8;">
            <li>Conventional Apartments (10+ acres)</li>
            <li>Active Adult Communities (15+ acres)</li>
            <li>Build-to-Rent (5+ acres)</li>
            <li>Lot Development (10+ acres)</li>
          </ul>
          <div style="background-color: #fef3c7; border-left: 4px solid #d4af37; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
            <p style="color: #92400e; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">🎯 What makes a great {{companyName}} deal:</p>
            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.8;">
              ✓ Proper zoning or entitlements in place<br>
              ✓ Strong local rental market fundamentals<br>
              ✓ Clear title and development-ready sites<br>
              ✓ Competitive pricing for the submarket
            </p>
          </div>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
            💰 Quick decisions and competitive offers<br>
            🚀 No lengthy approval processes<br>
            📞 Direct access to our acquisition team
          </p>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Have something that might work? Send us the basics:</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.8;">
            📧 Email: <a href="mailto:catalyst@landlinq.ai" style="color: #d4af37;">catalyst@landlinq.ai</a><br>
            📱 Text: <a href="tel:7046101549" style="color: #d4af37;">(704) 610-1549</a><br>
            🌐 Web: <a href="https://landlinq.ai/submit-deal" style="color: #d4af37;">https://landlinq.ai/submit-deal</a>
          </p>
          <p style="color: #6b7280; margin: 0 0 25px 0; font-size: 14px; font-style: italic;">Just need: Address, asking price, and acreage to get started!</p>
          <p style="color: #374151; margin: 0 0 25px 0; font-size: 16px; line-height: 1.6;">Thanks for being part of the {{companyName}} network,<br>{{analystName}}<br>{{companyName}} Team</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{dashboardUrl}}" style="background-color: #4A90E2; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">View Your Dashboard</a>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 10px;">Check all your deal submissions and activity</p>
        </div>
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0 0 8px 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">To unsubscribe from monthly updates, reply with "UNSUBSCRIBE"</p>
        </div>
      </div>`,
      event: "monthlyOutreachReminder"
    },

    // 9. Missing Address Request (info_missing_address)
    {
      id: "9",
      name: "Missing Address Request",
      subject: "Property Address Needed - {{companyName}}",
      content: "Hi {{brokerName}},\n\nThank you for reaching out to {{companyName}}! We're excited to review your property submission.\n\nTo get started with our AI analysis, we need the full property address.\n\nPlease reply with:\n• Complete property address (street, city, state)\n• Example: \"123 Main Street, Charlotte, NC 28202\"\n\nWhy we need this:\nOur AI system performs instant market analysis, comparable sales research, and zoning verification - all of which require the exact property location.\n\nNext Steps:\nOnce we have the address, you'll receive our initial analysis within 2 hours!\n\nThanks for choosing {{companyName}}!\n\n{{analystName}}\n{{companyName}} Team\nPhone: {{supportPhone}}",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 20px 20px 5px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin-left: auto; margin-right: auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Hi {{brokerName}},</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Thank you for reaching out to {{companyName}}! We're excited to review your property submission.</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">To get started with our AI analysis, we need the full property address.</p>
          <div style="background-color: #fef3c7; border-left: 4px solid #d4af37; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
            <p style="color: #92400e; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Please reply with:</p>
            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.8;">
              • Complete property address (street, city, state)<br>
              • Example: "123 Main Street, Charlotte, NC 28202"
            </p>
          </div>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Why we need this:</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Our AI system performs instant market analysis, comparable sales research, and zoning verification - all of which require the exact property location.</p>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Next Steps:</p>
          <p style="color: #374151; margin: 0 0 25px 0; font-size: 16px; line-height: 1.6;">Once we have the address, you'll receive our initial analysis within 2 hours!</p>
          <p style="color: #374151; margin: 0; font-size: 16px; line-height: 1.6;">Thanks for choosing {{companyName}}!<br><br>{{analystName}}<br>{{companyName}} Team<br>Phone: {{supportPhone}}</p>
        </div>
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "info_missing_address"
    },

    // 10. Missing All Vital Information (info_missing_all_vital)
    {
      id: "10",
      name: "Missing All Vital Information",
      subject: "Property Details Needed - {{companyName}}",
      content: "Hi {{brokerName}},\n\nThank you for contacting {{companyName}}! We're ready to analyze your land deal.\n\nTo get started, please provide:\n• Property address (street, city, state)\n• Property size in acres\n• Asking price\n\nExample format:\n\"123 Main Street, Charlotte, NC - 5.2 acres - $2,500,000\"\n\nWhy we need this:\nOur AI system requires these three key data points to perform instant market analysis, comparable sales research, and feasibility assessment.\n\nTimeline:\nOnce we have this information, you'll receive our analysis within 2 hours!\n\nQuestions? Call us at {{supportPhone}}\n\nLooking forward to reviewing your deal!\n\n{{analystName}}\n{{companyName}} Acquisitions Team",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 20px 20px 5px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin-left: auto; margin-right: auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Hi {{brokerName}},</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Thank you for contacting {{companyName}}! We're ready to analyze your land deal.</p>
          <div style="background-color: #fef3c7; border-left: 4px solid #d4af37; padding: 20px; margin: 0 0 20px 0; border-radius: 4px;">
            <p style="color: #92400e; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">To get started, please provide:</p>
            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.8;">
              • Property address (street, city, state)<br>
              • Property size in acres<br>
              • Asking price
            </p>
          </div>
          <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px; font-style: italic;">Example format: "123 Main Street, Charlotte, NC - 5.2 acres - $2,500,000"</p>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Why we need this:</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Our AI system requires these three key data points to perform instant market analysis, comparable sales research, and feasibility assessment.</p>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Timeline:</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Once we have this information, you'll receive our analysis within 2 hours!</p>
          <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px;">Questions? Call us at {{supportPhone}}</p>
          <p style="color: #374151; margin: 0; font-size: 16px; line-height: 1.6;">Looking forward to reviewing your deal!<br><br>{{analystName}}<br>{{companyName}} Acquisitions Team</p>
        </div>
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "info_missing_all_vital"
    },

    // 11. Uncertain Details Confirmation (info_uncertain_details)
    {
      id: "11",
      name: "Uncertain Details Confirmation",
      subject: "Please Confirm Property Details - {{propertyAddress}}",
      content: "Hi {{brokerName}},\n\nWe're analyzing {{propertyAddress}} and want to make sure we have the correct details for our evaluation.\n\nPlease confirm the following:\n{{missingFields}}\n\nWhy this matters:\nAccurate information ensures we provide the most precise market analysis and appropriate response for your property.\n\nEasy to confirm:\nSimply reply with the corrected information, and we'll update our analysis immediately.\n\nQuestions?\nCall {{supportPhone}} if you need any assistance.\n\nThanks for helping us get this right!\n\n{{analystName}}\n{{companyName}} Team\nDeal ID: {{dealId}}",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="text-align: center; background-color: #ffffff; padding: 20px 20px 5px 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin-left: auto; margin-right: auto;" />
        </div>
        <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
        <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Hi {{brokerName}},</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">We're analyzing <strong>{{propertyAddress}}</strong> and want to make sure we have the correct details for our evaluation.</p>
          <div style="background-color: #fef3c7; border-left: 4px solid #d4af37; padding: 20px; margin: 0 0 25px 0; border-radius: 4px;">
            <p style="color: #92400e; margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Please confirm the following:</p>
            <p style="color: #92400e; margin: 0; font-size: 16px; line-height: 1.6; font-weight: 600;">{{missingFields}}</p>
          </div>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Why this matters:</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Accurate information ensures we provide the most precise market analysis and appropriate response for your property.</p>
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Easy to confirm:</p>
          <p style="color: #374151; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">Simply reply with the corrected information, and we'll update our analysis immediately.</p>
          <p style="color: #6b7280; margin: 0 0 25px 0; font-size: 14px;">Questions? Call {{supportPhone}} if you need any assistance.</p>
          <p style="color: #374151; margin: 0; font-size: 16px; line-height: 1.6;">Thanks for helping us get this right!<br><br>{{analystName}}<br>{{companyName}} Team<br><span style="color: #6b7280; font-size: 14px;">Deal ID: {{dealId}}</span></p>
        </div>
        <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
          <p style="margin: 0 0 8px 0;">
            <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
            <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
          </p>
          <p style="margin: 0;">
            <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
          </p>
        </div>
      </div>`,
      event: "info_uncertain_details"
    },

    // 12. Password Reset Email (password_reset)
    {
      id: "12",
      name: "Password Reset Email",
      subject: "🔐 Reset Your {{companyName}} Password",
      content: "Hi {{userEmail}},\n\nYou recently requested to reset your password for your {{companyName}} account.\n\nTo reset your password, click the link below:\n{{resetUrl}}\n\nImportant details:\n• This link will expire in 1 hour for security\n• If you didn't request this reset, please ignore this email\n• Your password won't change until you click the link and create a new one\n\nNeed help?\nIf you're having trouble with the link or didn't request this reset, contact our support team:\n📧 Email: {{supportEmail}}\n📱 Phone: {{supportPhone}}\n\nSecurity tip: Always use a strong, unique password for your {{companyName}} account.\n\nBest regards,\nThe {{companyName}} Security Team\n\n---\nThis email was sent to {{userEmail}}. If you received this in error, please contact support immediately.",
      html: `<div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #ffffff; padding: 20px;">
        <!-- Header with Logo -->
        <div style="text-align: center; border-bottom: 2px solid {{primaryColor}}; padding-bottom: 20px; margin-bottom: 30px;">
          <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 50px; width: auto; margin-bottom: 10px;" />
          <h1 style="color: {{primaryColor}}; margin: 0; font-size: 24px;">{{companyName}}</h1>
          <p style="color: {{secondaryColor}}; margin: 5px 0 0 0; font-size: 14px;">Professional Land Acquisition Platform</p>
        </div>
        
        <!-- Email Body -->
        <div style="color: #333333; line-height: 1.6;">
          <p>Hi <a href="mailto:{{userEmail}}" style="color: {{secondaryColor}};">{{userEmail}}</a>,</p>
          
          <p>You recently requested to reset your password for your {{companyName}} account.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetUrl}}" style="background-color: {{primaryColor}}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">🔐 Reset Your Password</a>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: {{primaryColor}};">Important details:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li>This link will expire in 1 hour for security</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Your password won't change until you click the link and create a new one</li>
            </ul>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">Need help?</h4>
            <p style="margin: 0;">If you're having trouble with the link or didn't request this reset, contact our support team:</p>
            <p style="margin: 5px 0 0 0;">
              📧 Email: <a href="mailto:{{supportEmail}}" style="color: {{secondaryColor}};">{{supportEmail}}</a><br>
              📱 Phone: {{supportPhone}}
            </p>
          </div>
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #0c5460;">🔒 Security tip:</p>
            <p style="margin: 5px 0 0 0; color: #0c5460;">Always use a strong, unique password for your {{companyName}} account.</p>
          </div>
          
          <p>Best regards,<br>
          The {{companyName}} Security Team</p>
        </div>
        
        <!-- Footer -->
        <div style="border-top: 1px solid #e5e7eb; margin-top: 40px; padding-top: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>© {{companyName}} | {{supportEmail}} | {{supportPhone}}</p>
          <p><a href="{{websiteUrl}}" style="color: {{secondaryColor}};">{{websiteUrl}}</a></p>
          <p style="margin: 10px 0 0 0; color: #999;">This email was sent to <a href="mailto:{{userEmail}}" style="color: {{secondaryColor}};">{{userEmail}}</a>. If you received this in error, please contact support immediately.</p>
        </div>
      </div>`,
      event: "password_reset"
    },

    // 8. Junior Analyst Daily Digest (daily_digest_analyst)
    {
      id: "8",
      name: "Junior Analyst Daily Digest",
      subject: "Daily Deal Digest - {{totalDeals}} deals assigned ({{reviewDeals}} need review)",
      content: "Good morning {{analystName}},\n\nHere's your daily summary of deals assigned to you in the last 24 hours:\n\nTotal Assigned: {{totalDeals}}\nNeeds Review: {{reviewDeals}}\n\nView your dashboard for full details.",
      html: `<div style="max-width: 700px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #475569 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🌅 Daily Deal Digest</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">{{today}}</p>
        </div>
        
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1f2937; margin: 0 0 20px 0;">Good morning, {{analystFirstName}}!</h2>
          <p style="color: #4b5563; margin: 0 0 20px 0; font-size: 16px;">
            Here's your daily summary of deals assigned to you in the last 24 hours:
          </p>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
              <h3 style="color: #1f2937; margin: 0; font-size: 24px;">{{totalDeals}}</h3>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Total Assigned</p>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #f59e0b;">
              <h3 style="color: #f59e0b; margin: 0; font-size: 24px;">{{reviewDeals}}</h3>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Need Review</p>
            </div>
          </div>
          
          {{reviewDealsSection}}
          {{allDealsSection}}
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://landlinq.ai/analyst-dashboard" style="background: #4A90E2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
              View Full Dashboard →
            </a>
          </div>
        </div>
        
        <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">
            {{companyName}} - Catalyst Capital Partners<br>
            <a href="mailto:{{supportEmail}}" style="color: #4A90E2;">{{supportEmail}}</a> | 
            <a href="tel:{{supportPhone}}" style="color: #4A90E2;">{{supportPhone}}</a>
          </p>
        </div>
      </div>`,
      event: "daily_digest_analyst"
    },

    // 9. Senior Team Daily Digest (daily_digest_senior)
    {
      id: "9",
      name: "Senior Team Daily Digest",
      subject: "Daily Deal Digest - {{totalDeals}} deals assigned ({{reviewDeals}} need review)",
      content: "Good morning {{teamMemberName}},\n\nHere's your daily summary of deals assigned to you in the last 24 hours:\n\nTotal Assigned: {{totalDeals}}\nNeed Review: {{reviewDeals}}\n\nView the dashboard for full details.",
      html: `<div style="max-width: 700px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #475569 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🌅 Daily Deal Digest</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">{{today}}</p>
        </div>
        
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1f2937; margin: 0 0 20px 0;">Good morning, {{teamMemberFirstName}}!</h2>
          <p style="color: #4b5563; margin: 0 0 20px 0; font-size: 16px;">
            Here's your daily summary of deals assigned to you in the last 24 hours:
          </p>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
              <h3 style="color: #1f2937; margin: 0; font-size: 24px;">{{totalDeals}}</h3>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Deals Assigned</p>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #f59e0b;">
              <h3 style="color: #f59e0b; margin: 0; font-size: 24px;">{{reviewDeals}}</h3>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Need Review</p>
            </div>
          </div>
          
          {{reviewDealsSection}}
          {{allDealsSection}}
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://landlinq.ai/analyst-dashboard" style="background: #4A90E2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
              View Full Dashboard →
            </a>
          </div>
        </div>
        
        <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">
            {{companyName}} - Catalyst Capital Partners<br>
            <a href="mailto:{{supportEmail}}" style="color: #4A90E2;">{{supportEmail}}</a> | 
            <a href="tel:{{supportPhone}}" style="color: #4A90E2;">{{supportPhone}}</a>
          </p>
        </div>
      </div>`,
      event: "daily_digest_senior"
    }
  ],

  // Essential 7 SMS Templates
  smsTemplates: [
    // 1. Registration Welcome (broker_registered)
    {
      id: "1",
      name: "Registration Welcome SMS",
      content: "Welcome to {{companyName}}, {{brokerName}}! Ready to submit deals? Text property details to this number or email catalyst@landlinq.ai. We respond within 2 hours. - {{companyName}} Team",
      event: "broker_registered"
    },

    // 2. Deal Received (deal_submitted)
    {
      id: "2",
      name: "Deal Received SMS",
      content: "Deal received for {{propertyAddress}}! ID: {{dealId}}. Initial review within 2 hours, full analysis in 24-48 hours. Track status in your dashboard. - {{analystName}}, {{companyName}}",
      event: "deal_submitted"
    },

    // 3. Deal Approved/Pursuing (status_pursuing)
    {
      id: "3",
      name: "Deal Pursuing SMS",
      content: "🎉 GREAT NEWS! {{propertyAddress}} is HIGH PRIORITY - we're moving forward! {{analystName}} will call you within 2 hours. Site visit scheduled this week. - {{companyName}}",
      event: "status_pursuing"
    },

    // 4. Deal Under Review / Yellow (status_under_review)
    {
      id: "4",
      name: "Deal Approved (Yellow)",
      content: "{{address}} passed our initial review and we have our analyst team now reviewing. We'll be in touch. Thanks! AJ w/Catalyst",
      event: "status_under_review"
    },

    // 5. Deal Rejected (status_rejected)
    {
      id: "5",
      name: "Deal Rejected SMS",
      content: "Thanks for {{propertyAddress}} submission. Not a fit for our current criteria, but we'd love to see more 15+ acre residential deals in growth markets. Keep them coming! - {{companyName}}",
      event: "status_rejected"
    },

    // 6. Not a Fit (status_rejected)
    {
      id: "6",
      name: "Not a Fit SMS",
      content: "Thanks for {{propertyAddress}} submission. Not a fit for our current criteria, but we'd love to see more 15+ acre residential deals in growth markets. Keep them coming! - {{companyName}}",
      event: "status_rejected"
    },

    // 6. Info Request Reminder (info_missing_reminder)
    {
      id: "7",
      name: "Info Reminder SMS",
      content: "Reminder: Still need additional info for {{propertyAddress}} (ID: {{dealId}}) to complete our review. Can you help us move this forward? - {{analystName}}, {{companyName}}",
      event: "info_missing_reminder"
    },

    // 8. Monthly Broker Outreach (monthlyOutreachReminder)
    {
      id: "8",
      name: "Monthly Broker Outreach SMS",
      content: "Hi {{brokerName}}! {{companyName}} here. We're actively acquiring 15+ acre residential development sites in growth markets. Have any deals that fit? Quick 2-hour response guaranteed! - {{analystName}}",
      event: "monthlyOutreachReminder"
    },

    // 9. Missing Address SMS (info_missing_address)
    {
      id: "9",
      name: "Missing Address SMS",
      content: "Hi {{brokerName}}! Thanks for reaching out. We need the property address to start our analysis. Can you reply with the full address? (Example: \"123 Main St, Charlotte NC\") Thanks! -LandLinq",
      event: "info_missing_address"
    },

    // 10. Missing All Vital Info SMS (info_missing_all_vital)
    {
      id: "10",
      name: "Missing All Vital Info SMS",
      content: "Hi {{brokerName}}! Thanks for reaching out. We need: address, acres, and price to analyze your deal. Reply with format: \"123 Main St, Charlotte NC, 5.2 acres, $2.5M\" Thanks! -LandLinq",
      event: "info_missing_all_vital"
    },

    // 11. Uncertain Details SMS (info_uncertain_details)
    {
      id: "11",
      name: "Uncertain Details SMS",
      content: "Hi {{brokerName}}! Quick confirmation needed for {{propertyAddress}}: {{missingFields}}. Want to ensure we have accurate details for proper evaluation. Reply to confirm. Thanks! -LandLinq",
      event: "info_uncertain_details"
    },

    // 12. Password Reset SMS (password_reset)
    {
      id: "12",
      name: "Password Reset SMS",
      content: "🔐 LandLinq Password Reset: Click to reset your password: {{resetUrl}} (expires in 1 hour). Didn't request this? Contact (704) 610-1549. -LandLinq Security",
      event: "password_reset"
    },

    // 13. SMS Opt-Out Confirmation (sms_opt_out)
    {
      id: "13",
      name: "SMS Opt-Out Confirmation",
      content: "You've been unsubscribed from LandLinq SMS updates. You won't receive text messages from us. To resubscribe, text START or contact {{supportPhone}}. -LandLinq",
      event: "sms_opt_out"
    },

    // 13. Not Understanding / Need Email (sms_not_understanding)
    {
      id: "13",
      name: "Not Understanding SMS",
      content: "Not understanding. Please email catalyst@landlinq.ai for further help. Our team will respond quickly! -LandLinq",
      event: "sms_not_understanding"
    }
  ],

  // Required fields for schema compliance
  acquisitionCriteria: [],
  dealAssignments: [],

  // Global Business Brand
  primaryColor: "#081729",        // Catalyst Navy
  secondaryColor: "#4A90E2",      // Catalyst Blue
  tertiaryColor: "#d4af37",       // Catalyst Gold
  backgroundColor: "#FDFFFF",     // Clean white background
  textColor: "#081729",           // Navy text
  fontFamily: "Inter, sans-serif", // Modern, clean font
  fontSize: "16px",               // Standard readable size
  logoUrl: "/api/assets/public%2Fassets%2FAdd%20a%20heading%20copy_1762196498512.png", // Catalyst:LandLinq logo from Object Storage
  companyName: "LandLinq",        // Company name
  supportEmail: "catalyst@landlinq.ai", // Support contact - actual email used
  supportPhone: "(704) 610-1549", // Support phone - updated to standardized number
  emailSignature: null,
  tagline: "Professional Land Acquisition Platform",
  buttonStyle: "rounded",
  emailWidth: "600px"
};

export { defaultBusinessSettings };
// LandLinq Communication Templates
// Updated to match exact user-provided templates

export interface TemplateVariables {
  brokerName: string;
  address?: string;
  analystName?: string;
  analystEmail?: string;
  missingFields?: string;
  supportPhone?: string;
  dealId?: string;
  currentStatus?: string;
  nextStep?: string;
  deadline?: string;
  amount?: string;
  // Enhanced for autoclassification and team assignments
  classificationEmoji?: string; // 🟢🟡🔴
  classification?: string; // green, yellow, red
  productType?: string;
  developerName?: string;
  partnerName?: string;
  rejectionReason?: string;
  statusFrom?: string;
  statusTo?: string;
  // Property details for acceptance emails
  vintage?: string | number;
  acreage?: string | number;
  unitCount?: string | number;
  askingPrice?: string | number;
  msaName?: string;
  state?: string;
  county?: string;
  // Comparable properties
  comparables?: Array<{
    name: string;
    vintage?: number;
    units?: number;
    distance?: string;
    rentPsf?: string;
  }>;
  // AI analysis notes
  classificationNotes?: string;
}

// Email Templates
export const emailTemplates = {
  welcome: {
    subject: "Welcome to LandLinq - Your Gateway to Fast Land Deals",
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Welcome to LandLinq! We're excited to have you as part of our broker network. Your account is active and ready for submissions.

**🚀 How to Submit Deals (Multiple Ways)**
📧 Email: catalyst@landlinq.ai
📱 Text/SMS: (704) 610-1549  
🌐 Web Portal: https://landlinq.ai/submit-deal
📞 Phone: (704) 610-1549

**📋 What We Need (Minimum)**
• Property address
• Asking price
• Acreage
*We'll handle all the research and due diligence from there!*

**🎯 What We're Buying**
• **Conventional Apartments** - Multifamily development
• **Active Adult Communities** - Senior-focused housing
• **Build-to-Rent** - Single-family rental communities  
• **Lot Development** - Residential subdivision opportunities

**⚡ Response Times**
• Initial classification: 24-48 hours
• 🟢 Green (High Priority): Same day analyst contact
• 🟡 Yellow (Under Review): 3-5 business days for decision
• 🔴 Red (Not a Fit): Immediate notification with feedback

**👥 Your Team**
Each deal gets assigned to our specialized acquisition team based on property type. You'll know exactly who's handling your submission.

Ready to submit your first deal? Just send us the basics and we'll take it from there!

Talk soon,
Catalyst Acquisitions
Catalyst Capital Partners

---
To unsubscribe from future emails, reply STOP or email us at catalyst@landlinq.ai`
  },

  dealSubmissionConfirmation: {
    subject: (vars: TemplateVariables) => `${vars.classificationEmoji || '📋'} Deal Received: ${vars.address}`,
    body: (vars: TemplateVariables) => {
      // Format acceptance criteria summary (concise checkmark style)
      const formatAcceptanceCriteria = () => {
        if (vars.classification !== 'green' || !vars.classificationNotes) return '';
        
        // Use the classificationNotes directly - it should already be formatted like:
        // "270 units (150+ ✓), in target MSA ✓. Missing: vintage/year built (analyst review needed)."
        return `\n**✅ Acceptance Reason:**\n${vars.classificationNotes}\n`;
      };

      return `Hi ${vars.brokerName},

Your deal submission has been received and processed! Here are the details:

**📍 Property:** ${vars.address}
**🆔 Deal ID:** ${vars.dealId || 'Processing...'}
**${vars.classificationEmoji || '📋'} Status:** ${vars.classification === 'green' ? 'HIGH PRIORITY - Excellent Fit!' : vars.classification === 'yellow' ? 'UNDER REVIEW - Potential Interest' : vars.classification === 'red' ? 'NOT A FIT - See details below' : 'Processing Classification'}

${vars.productType ? `**🏗️ Product Type:** ${vars.productType}` : ''}
${formatAcceptanceCriteria()}
**👥 Your Assigned Team:**
${vars.analystName ? `• Analyst: ${vars.analystName} (${vars.analystEmail})` : '• Analyst: Assigning...'}
${vars.developerName ? `• Developer: ${vars.developerName}` : ''}
${vars.partnerName ? `• Partner: ${vars.partnerName}` : ''}

**⚡ Next Steps:**
${vars.classification === 'green' ? 
  `🟢 PRIORITY TRACK: ${vars.analystName} will contact you within 24 hours to discuss next steps and move quickly on this opportunity.` : 
  vars.classification === 'yellow' ? 
  `🟡 REVIEW PROCESS: Our team is conducting deeper market analysis. Full decision expected within 3-5 business days.` : 
  vars.classification === 'red' ? 
  `🔴 NOT A MATCH: This property doesn't align with our current acquisition criteria. Details in separate notification.` : 
  'Our AI analysis is enriching property details. Classification and team assignment coming shortly.'}

**Questions?** Reply to this email or text (704) 610-1549.

${vars.classification === 'green' ? 'Exciting opportunity - talk soon!' : 'Thank you for the submission!'}

Catalyst Acquisitions
Catalyst Capital Partners

---
To unsubscribe from future emails, reply STOP or email us at catalyst@landlinq.ai`;
    }
  },

  greenlightHighInterest: {
    subject: (vars: TemplateVariables) => `PRIORITY DEAL: ${vars.address}`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Great news — ${vars.address} looks like a strong fit.

Our analyst ${vars.analystName} will connect with you directly at ${vars.analystEmail}.

We want to move fast on this one.

Talk soon,
Catalyst Acquisitions

---
To unsubscribe from future emails, reply STOP or email us at catalyst@landlinq.ai`
  },

  passNotAFit: {
    subject: (vars: TemplateVariables) => `🔴 ${vars.address} - Not a Fit This Time`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

After review, ${vars.address} doesn't match our current criteria.

We value the partnership and want to see your next submission.

You can email, text, or visit our website to submit deals:
E: catalyst@landlinq.ai
P: (704) 610-1549
W: https://landlinq.ai/submit-deal

Talk soon,
Catalyst Acquisitions

---
To unsubscribe from future emails, reply STOP or email us at catalyst@landlinq.ai`
  },

  // Enhanced Status Change Templates
  dealRejected: {
    subject: (vars: TemplateVariables) => `🔴 ${vars.address} - Detailed Review Results`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Thank you for your submission of ${vars.address}. After conducting our comprehensive analysis, this property doesn't align with our current acquisition criteria.

**📍 Property:** ${vars.address}
**🆔 Deal ID:** ${vars.dealId}
**🔴 Status:** Not a Fit - Detailed Analysis Below

**📊 Why This Doesn't Meet Our Criteria:**
${vars.rejectionReason || `Based on our analysis, this property doesn't meet our minimum requirements for:
• Unit count thresholds for target product types
• Minimum acreage requirements (varies by product: Apartments 4+, BTR 5+, Lots 6+)
• Market fundamentals in the specific submarket
• Development feasibility or entitlement status`}

**🎯 What We're Looking For:**
• **Conventional Apartments** - Multifamily development opportunities
• **Active Adult Communities** - Senior-focused housing projects
• **Build-to-Rent** - Single-family rental communities
• **Lot Development** - Residential subdivision opportunities

**💡 For Your Next Submission:**
Properties that are larger, properly zoned, or in stronger rental markets tend to perform better in our evaluation process.

**Keep Them Coming!**
We value our broker relationships and want to see more opportunities from you. Every "no" gets us closer to a "yes"!

**Submit Your Next Deal:**
📧 Email: catalyst@landlinq.ai
📱 Text: (704) 610-1549  
🌐 Web: https://landlinq.ai/submit-deal

Thank you for thinking of us,
Catalyst Acquisitions
Catalyst Capital Partners

---
To unsubscribe from future emails, reply STOP or email us at catalyst@landlinq.ai`
  },

  dealApprovedGreen: {
    subject: (vars: TemplateVariables) => `🟢 EXCITING NEWS: ${vars.address} - High Priority Deal!`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

🎉 FANTASTIC NEWS! We are very excited about your submission!

**📍 Property:** ${vars.address}
**🆔 Deal ID:** ${vars.dealId}
**🟢 Status:** HIGH PRIORITY - Excellent Fit for Our Portfolio!

**Why We Love This Deal:**
This property hits all the marks for our acquisition criteria - great location, proper sizing, and strong market fundamentals. Our initial analysis shows excellent potential!

**👥 Your Dedicated Team:**
• **Lead Analyst:** ${vars.analystName} (${vars.analystEmail})
• **Developer:** ${vars.developerName}
• **Partner:** ${vars.partnerName}

${vars.analystName} will be reaching out to you within the next 24 hours to discuss:
• Detailed property information and due diligence process
• Market analysis and development timeline
• Next steps to move this forward quickly
• Any additional documentation we might need

**🚀 What Happens Next:**
1. ${vars.analystName} contacts you directly (within 24 hours)
2. We conduct detailed market and feasibility analysis
3. Property visit and evaluation (if needed)
4. Letter of Intent and terms discussion
5. Move to closing process

**⚡ Our Commitment:**
We move FAST on deals we like, and we like this one! Expect quick decisions and a streamlined process.

**Direct Contact:**
📧 ${vars.analystEmail} 
📱 (704) 610-1549
(Feel free to call or text anytime)

Thank you for bringing us this excellent opportunity!

Very excited to work with you,
${vars.analystName}
Catalyst Capital Partners`
  },

  statusUpgradeYellowToGreen: {
    subject: (vars: TemplateVariables) => `🟡➡️🟢 UPGRADE: ${vars.address} - Now High Priority!`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Great news about your deal! After deeper analysis, we're upgrading the status.

**📍 Property:** ${vars.address}
**🆔 Deal ID:** ${vars.dealId}
**📊 Status Update:** 🟡 Under Review ➡️ 🟢 HIGH PRIORITY

**🔍 What Changed:**
Our expanded market research and development analysis revealed this property has stronger potential than initially assessed. The numbers work, and this fits perfectly into our acquisition strategy!

**👥 Your New Priority Team:**
• **Lead Analyst:** ${vars.analystName} (${vars.analystEmail})
• **Developer:** ${vars.developerName}
• **Partner:** ${vars.partnerName}

**⚡ Immediate Next Steps:**
${vars.analystName} will contact you directly within the next 24 hours to fast-track this opportunity. We're moving this into our priority pipeline!

**What This Means:**
• Direct analyst contact within 24 hours
• Expedited due diligence process
• Priority review by our investment committee
• Faster decision timeline

**Direct Contact:**
📧 ${vars.analystEmail}
📱 (704) 610-1549

Excited about this upgrade and looking forward to moving quickly!

${vars.analystName}
Catalyst Capital Partners`
  },

  // Missing Information Follow-up Templates
  info_missing_acreage: {
    subject: (vars: TemplateVariables) => `Quick Question About ${vars.address}`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Thanks for submitting ${vars.address}! We're excited to review this opportunity.

To complete our AI analysis and get you a quick decision, we need one more piece of information:
• Property size (acres)

You can reply to this email or text us at (704) 610-1549 with the acreage.

Thanks for your submission!
Catalyst Acquisitions`
  },

  info_missing_price: {
    subject: (vars: TemplateVariables) => `Quick Question About ${vars.address}`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Thanks for submitting ${vars.address}! We're excited to review this opportunity.

To complete our AI analysis and get you a quick decision, we need one more piece of information:
• Asking price

You can reply to this email or text us at (704) 610-1549 with the price.

Thanks for your submission!
Catalyst Acquisitions`
  },

  info_missing_both: {
    subject: (vars: TemplateVariables) => `Quick Question About ${vars.address}`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Thanks for submitting ${vars.address}! We're excited to review this opportunity.

To complete our AI analysis and get you a quick decision, we need two more pieces of information:
• Property size (acres)
• Asking price

You can reply to this email or text us at (704) 610-1549 with both details.

Thanks for your submission!
Catalyst Acquisitions`
  },

  info_missing_address: {
    subject: (vars: TemplateVariables) => `Property Address Needed for Deal Submission`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Thanks for reaching out! We received your deal submission, but we need the property address to proceed with our analysis.

To complete our review, please provide:
• Full property address (street, city, state)

You can reply to this email or text us at (704) 610-1549 with the address.

Thanks for your submission!
Catalyst Acquisitions`
  },

  info_missing_all_vital: {
    subject: (vars: TemplateVariables) => `Property Details Needed for Deal Submission`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Thanks for reaching out! We received your deal submission, but we need a few key details to proceed with our analysis.

To complete our review, please provide:
• Property address
• Property size (acres)
• Asking price

You can reply to this email or text us at (704) 610-1549 with these details.

Example format: "123 Main St, Charlotte NC, 5.2 acres, $2.5M"

Thanks for your submission!
Catalyst Acquisitions`
  },

  info_uncertain_details: {
    subject: (vars: TemplateVariables) => `Quick Confirmation: ${vars.address || 'Property Details'}`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Thanks for submitting your deal! We want to make sure we have the correct details for our analysis.

Could you please confirm the following information:
${vars.missingFields}

You can reply to this email or text us at (704) 610-1549 to verify these details.

This helps us provide the most accurate evaluation of your property.

Thanks!
Catalyst Acquisitions`
  },

  info_missing_reminder: {
    subject: (vars: TemplateVariables) => `Friendly Reminder: ${vars.address}`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Just following up on ${vars.address} - we're still missing some information to complete our review:
${vars.missingFields}

Once we have these details, our AI can provide an immediate classification and next steps.

You can reply to this email or text us at (704) 610-1549.

If you'd prefer not to receive these reminders, just let us know.

Thanks!
Catalyst Acquisitions`
  },

  // Monthly Outreach Reminder Template
  monthlyOutreachReminder: {
    subject: "🏡 Still Looking for Your Perfect Deal!",
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Hope you're having a great month! We wanted to check in and see if you have any exciting land deals that might be a good fit for LandLinq.

We're actively acquiring in these product types:
• Conventional Apartments (10+ acres)
• Active Adult Communities (15+ acres)  
• Build-to-Rent (5+ acres)
• Lot Development (10+ acres)

🎯 What makes a great LandLinq deal:
✓ Proper zoning or entitlements in place
✓ Strong local rental market fundamentals
✓ Clear title and development-ready sites
✓ Competitive pricing for the submarket

💰 Quick decisions and competitive offers
🚀 No lengthy approval processes
📞 Direct access to our acquisition team

Have something that might work? Send us the basics:
📧 Email: catalyst@landlinq.ai
📱 Text: (704) 610-1549  
🌐 Web: https://landlinq.ai/submit-deal

Just need: Address, asking price, and acreage to get started!

Thanks for being part of the LandLinq network,

The Catalyst Acquisitions

---
To unsubscribe from monthly updates, reply with "UNSUBSCRIBE"`
  },

  // Additional Core Communication Templates
  dealUnderReview: {
    subject: (vars: TemplateVariables) => `${vars.address} Under Review | LandLinq`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Thank you for your submission. We've completed our initial review of your property:

**Property:** ${vars.address}
**Status:** Under Review (Potential Interest)
**Classification:** Yellow - Requires Additional Analysis

Our team is conducting deeper market research and feasibility analysis. We'll update you as soon as our evaluation is complete.

**Your Analyst:** ${vars.analystName}
**Questions?** ${vars.analystEmail}

Thank you for your patience as we conduct our thorough review process.

Best regards,
${vars.analystName}
Catalyst Capital Partners`
  },

  followUpAfterInterest: {
    subject: (vars: TemplateVariables) => `Following Up: ${vars.address} | LandLinq`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

I hope this email finds you well. I'm following up on the property submission we discussed:

**Property:** ${vars.address}

I wanted to ensure we maintain momentum on this opportunity. Please let me know if you have any updates or if there's additional information I can provide.

**Best times to reach me:**
- Phone: ${vars.supportPhone}
- Email: ${vars.analystEmail} (checked regularly)

Looking forward to moving this forward together.

Best regards,
${vars.analystName}
Catalyst Capital Partners`
  },

  documentRequest: {
    subject: (vars: TemplateVariables) => `Documents Needed: ${vars.address} | LandLinq`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

To continue our evaluation of your property submission, we need the following documents:

**Property:** ${vars.address}

**Required Documents:**
${vars.missingFields}

**Upload Instructions:**
1. Email directly to: ${vars.analystEmail}
2. Or text to: ${vars.supportPhone}

If you have any questions about specific documents, please don't hesitate to contact me.

Best regards,
${vars.analystName}
Catalyst Capital Partners
${vars.analystEmail} | ${vars.supportPhone}`
  },

  meetingConfirmation: {
    subject: (vars: TemplateVariables) => `Meeting Confirmed: ${vars.address}`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

This confirms our upcoming meeting to discuss the property opportunity:

**Property:** ${vars.address}

**Meeting Agenda:**
1. Property overview and highlights
2. Market analysis discussion
3. Development potential review
4. Next steps and timeline
5. Q&A

**Contact Information:**
If you need to reschedule or have any questions:
- ${vars.analystName}: ${vars.supportPhone}
- Email: ${vars.analystEmail}

Looking forward to our productive discussion.

Best regards,
${vars.analystName}
Catalyst Capital Partners`
  },

  marketUpdateNewsletter: {
    subject: "Market Insights Monthly | LandLinq",
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Here's your monthly market update for new opportunities:

**What We're Seeing:**
Strong demand for quality land deals in our target markets. Fast decisions and competitive offers for properties that meet our criteria.

**Current Acquisition Focus:**
- Conventional Apartments: 200+ units, 4+ acres
- Active Adult: 150+ units, 4+ acres  
- Build-to-Rent: 70+ units, 5+ acres
- Lot Development: 50+ units, 6+ acres

**Recently Approved:**
Several high-quality deals from broker partners like you!

**Submit Deals:** catalyst@landlinq.ai or (704) 610-1549
**Questions:** ${vars.analystEmail}

Thank you for being a valued member of our broker network.

Best regards,
The Catalyst Acquisitions
Catalyst Capital Partners`
  },

  commissionPayment: {
    subject: (vars: TemplateVariables) => `Commission Payment Processed - ${vars.address}`,
    body: (vars: TemplateVariables) => `Hi ${vars.brokerName},

Great news! Your commission payment has been processed for the following deal:

**Property:** ${vars.address}

Your payment should appear in your account within 3-5 business days.

**Questions about this payment?**
Contact our team:
- Email: ${vars.analystEmail}
- Phone: ${vars.supportPhone}

Thank you for bringing us this excellent opportunity!

Best regards,
${vars.analystName}
Catalyst Capital Partners`
  }
};

// SMS Templates
export const smsTemplates = {
  welcome: (vars: TemplateVariables) => 
    `🏡 Welcome to LandLinq, ${vars.brokerName}!

Submit deals 3 ways:
📱 TEXT (here)
📧 EMAIL (catalyst@landlinq.ai) 
🌐 WEB (landlinq.ai/submit-deal)

Just need: address, price & acres to start!

-Catalyst Acquisitions`,

  dealSubmissionConfirmation: (vars: TemplateVariables) => 
    `${vars.classificationEmoji || '📋'} Deal received: ${vars.address}

📍 Property: ${vars.address}
🆔 Deal ID: ${vars.dealId || 'Processing...'}
📊 Status: ${vars.classification === 'green' ? 'HIGH PRIORITY' : vars.classification === 'yellow' ? 'UNDER REVIEW' : vars.classification === 'red' ? 'NOT A FIT' : 'Processing...'}

${vars.analystName ? `👤 Analyst: ${vars.analystName}` : ''}

Full details coming via email.

-Catalyst Acquisitions`,

  greenlightHighInterest: (vars: TemplateVariables) => 
    `🎯 PRIORITY DEAL: ${vars.address}

Great news — this looks like a strong fit!

👤 ${vars.analystName} will connect with you directly ASAP.

We want to move fast on this one.

-Catalyst Acquisitions`,

  passNotAFit: (vars: TemplateVariables) => 
    `🔴 ${vars.address} - Not a Fit This Time

After review, ${vars.address} doesn't match our current criteria.

We value the partnership and want to see your next submission.

Submit your next deal:
📧 catalyst@landlinq.ai
📱 (704) 610-1549  
🌐 landlinq.ai/submit-deal

-Catalyst Acquisitions`,

  // Enhanced Status Change SMS Templates
  dealRejected: (vars: TemplateVariables) =>
    `🔴 ${vars.address} - Detailed Review Results

Thank you for your submission of ${vars.address}.

📍 Property: ${vars.address}
🆔 Deal ID: ${vars.dealId}
🔴 Status: Not a Fit

${vars.rejectionReason ? `Why: ${vars.rejectionReason}` : 'Detailed explanation in email.'}

Keep them coming! 
Text more deals anytime.

📧 catalyst@landlinq.ai
📱 (704) 610-1549

-Catalyst Acquisitions`,

  dealApprovedGreen: (vars: TemplateVariables) =>
    `🟢 EXCITING NEWS: ${vars.address} - High Priority!

🎉 FANTASTIC NEWS! We are very excited about your submission!

📍 Property: ${vars.address}
🆔 Deal ID: ${vars.dealId}
🟢 Status: HIGH PRIORITY

👤 ${vars.analystName} will contact you within 24 hours.

This looks like an excellent fit!
Check email for full details.

-${vars.analystName}, Catalyst Acquisitions`,

  statusUpgradeYellowToGreen: (vars: TemplateVariables) =>
    `🟡➡️🟢 UPGRADE: ${vars.address}

Moved to HIGH PRIORITY after deeper analysis!

📍 Property: ${vars.address}
🆔 Deal ID: ${vars.dealId}
🟢 Status: HIGH PRIORITY

👤 ${vars.analystName} will contact you within 24hrs to fast-track.

Check email for full details!

-${vars.analystName}, Catalyst Acquisitions`,

  // Missing Information Follow-up SMS Templates
  info_missing_acreage: (vars: TemplateVariables) =>
    `Hi ${vars.brokerName}!

Quick question about ${vars.address}:

📏 We need the property size (acres) to complete our analysis and get you the right decision ASAP.

Can you reply with the acreage?

Thanks!
-Catalyst Acquisitions`,

  info_missing_price: (vars: TemplateVariables) =>
    `Hi ${vars.brokerName}!

Quick question about ${vars.address}:

💰 We need the asking price to complete our analysis and get you the right decision ASAP.

Can you reply with the price?

Thanks!
-Catalyst Acquisitions`,

  info_missing_both: (vars: TemplateVariables) =>
    `Hi ${vars.brokerName}!

Quick question about ${vars.address}:

We need:
📏 Property size (acres)
💰 Asking price

Can you reply with both?

Thanks!
-Catalyst Acquisitions`,

  info_missing_address: (vars: TemplateVariables) =>
    `Hi ${vars.brokerName}!

Thanks for reaching out.

📍 We need the property address to start our analysis.

Can you reply with the full address?
(Example: "123 Main St, Charlotte NC")

Thanks!
-Catalyst Acquisitions`,

  info_missing_all_vital: (vars: TemplateVariables) =>
    `Hi ${vars.brokerName}! Thanks for reaching out. We need: address, acres, and price to analyze your deal. Reply with format: "123 Main St, Charlotte NC, 5.2 acres, $2.5M" Thanks! -Catalyst Acquisitions`,

  info_uncertain_details: (vars: TemplateVariables) =>
    `Hi ${vars.brokerName}! Quick confirmation needed for ${vars.address || 'your property'}: ${vars.missingFields}. Want to ensure we have accurate details for proper evaluation. Reply to confirm. Thanks! -Catalyst Acquisitions`,

  info_missing_reminder: (vars: TemplateVariables) =>
    `Hi ${vars.brokerName}! Still need info for ${vars.address}: ${vars.missingFields}. Reply when convenient. Thanks! -Catalyst Acquisitions`,

  // Monthly Outreach Reminder SMS
  monthlyOutreachReminder: (vars: TemplateVariables) =>
    `🏡 Hi ${vars.brokerName}!

Got any great land deals this month?

🎯 What We're Buying:
• Conventional Apartments - Multifamily development
• Active Adult Communities - Senior-focused housing
• Build-to-Rent - Single-family rental communities  
• Lot Development - Residential subdivision opportunities

💰 Quick decisions and competitive offers

Have something that might work?

Just reply with: address, price & acres

-Catalyst Acquisitions

---
Reply STOP to unsubscribe`,

  // Additional SMS Templates
  dealUnderReview: (vars: TemplateVariables) =>
    `📋 Update: ${vars.address} is under review (potential interest). ${vars.analystName} will update you soon with next steps. -Catalyst Acquisitions`,

  followUpAfterInterest: (vars: TemplateVariables) =>
    `👋 Hi ${vars.brokerName}! Following up on ${vars.address}. Any updates? Call ${vars.supportPhone} or reply here. -${vars.analystName}`,

  documentReminder: (vars: TemplateVariables) =>
    `📄 Reminder: Documents needed for ${vars.address}. Reply with docs or call ${vars.supportPhone}. Thanks! -${vars.analystName}`,

  meetingReminder: (vars: TemplateVariables) =>
    `📅 Meeting reminder: Tomorrow for ${vars.address}. Need to reschedule? Call ${vars.supportPhone}. -${vars.analystName}`,

  marketAlert: (vars: TemplateVariables) =>
    `🔥 MARKET ALERT: High demand for quality land deals! Submit yours: catalyst@landlinq.ai or (704) 610-1549. Fast decisions! -Catalyst Acquisitions`,

  paymentProcessed: (vars: TemplateVariables) =>
    `💰 Commission processed for ${vars.address}! Payment arriving in 3-5 days. Details in email. Thanks! -Catalyst Acquisitions`,

  quickStatusUpdate: (vars: TemplateVariables) =>
    `📊 Update on ${vars.address}: Analysis in progress. Full update coming soon. Questions? Call ${vars.supportPhone}. -${vars.analystName}`
};

// Template utility functions
export function getEmailTemplate(type: keyof typeof emailTemplates, vars: TemplateVariables) {
  const template = emailTemplates[type];
  
  return {
    subject: typeof template.subject === 'function' ? template.subject(vars) : template.subject,
    body: template.body(vars)
  };
}

export function getSMSTemplate(type: keyof typeof smsTemplates, vars: TemplateVariables) {
  const template = smsTemplates[type];
  return template(vars);
}

// Helper function to get complete team info based on deal classification
export function getAnalystInfo(classification: string, productType?: string): { analystName: string; analystEmail: string } {
  // Based on team assignments from acquisition criteria
  switch (productType?.toLowerCase()) {
    case 'conventional apartments':
      return { analystName: 'Austin Blondell', analystEmail: 'catalyst@landlinq.ai' };
    case 'active adult':
      return { analystName: 'Austin Blondell', analystEmail: 'catalyst@landlinq.ai' };
    case 'btr':
    case 'build to rent':
      return { analystName: 'Davis', analystEmail: 'davis@catalystcp.com' };
    case 'lot development':
      return { analystName: 'Davis', analystEmail: 'davis@catalystcp.com' };
    default:
      return { analystName: 'Austin Blondell', analystEmail: 'catalyst@landlinq.ai' };
  }
}

// Helper function to get complete team assignments based on product type
export function getTeamAssignments(productType?: string): { 
  analystName: string; 
  analystEmail: string; 
  developerName: string; 
  partnerName: string; 
} {
  // Based on team assignments from exact acquisition criteria in replit.md
  switch (productType?.toLowerCase()) {
    case 'conventional apartments':
      return {
        analystName: 'Austin Blondell',
        analystEmail: 'catalyst@landlinq.ai',
        developerName: 'Steve Hillebrand',
        partnerName: 'AJ Klenk'
      };
    case 'active adult':
      return {
        analystName: 'Austin Blondell',
        analystEmail: 'catalyst@landlinq.ai',
        developerName: 'John Bell',
        partnerName: 'AJ Klenk'
      };
    case 'btr':
    case 'build to rent':
      return {
        analystName: 'Davis',
        analystEmail: 'catalyst@landlinq.ai',
        developerName: 'Steve Hillebrand',
        partnerName: 'Brian Ford'
      };
    case 'lot development':
      return {
        analystName: 'Davis',
        analystEmail: 'catalyst@landlinq.ai',
        developerName: 'Mallie Colavita',
        partnerName: 'Brian Ford'
      };
    default:
      return {
        analystName: 'Austin Blondell',
        analystEmail: 'catalyst@landlinq.ai',
        developerName: 'Steve Hillebrand',
        partnerName: 'AJ Klenk'
      };
  }
}
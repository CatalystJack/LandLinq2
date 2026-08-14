import { storage } from "./storage";
import { emailService, sendNotificationEmail } from "./emailService";
import { TemplateService } from "./templateService";

export class EmailAutomationService {
  // Send deal submission confirmation using standardized templates from outreach management
  async sendDealSubmissionConfirmation(dealId: string, brokerEmail: string): Promise<void> {
    try {
      const deal = await storage.getDealById(dealId);
      const broker = await storage.getBrokerByEmail(brokerEmail);
      
      if (!deal || !broker) {
        console.error("Deal or broker not found for confirmation email");
        return;
      }

      // ✅ USE STANDARDIZED TEMPLATE SERVICE - NO CUSTOM HTML
      // CRITICAL FIX (Nov 22, 2025): Add absolute dashboard URL for deal link
      const dealUrl = `https://landlinq.ai/messaging/deals/${deal.id}`;
      
      // Jan 29, 2026: Use CONCISE aiExplanatoryNotes for acceptance reason (not verbose comparableNotes)
      // aiExplanatoryNotes = "YELLOW: 5 qualifying comparables found ($2065/unit avg)..."
      const acceptanceReason = (deal as any).aiExplanatoryNotes || '';
      
      const template = await TemplateService.getEmailTemplate('deal_submitted', {
        brokerName: `${broker.firstName} ${broker.lastName}`,
        propertyAddress: deal.address,
        address: deal.address,
        dealId: deal.id || '',
        dealUrl: dealUrl, // Add absolute URL for deal link in email - correct route is /messaging/deals/
        status: 'Under Review',
        submissionMethod: deal.submissionMethod || 'FORM',
        // Include acceptance reason for high priority deals
        classification: (deal as any).classification || '',
        classificationNotes: acceptanceReason,
        acceptanceReason: acceptanceReason
      });

      if (!template) {
        console.error('No deal_submitted template found in outreach management');
        return;
      }

      const htmlContent = template.html || template.content;
      const emailSubject = template.subject;

      // Send HTML email using sendNotificationEmail
      await sendNotificationEmail({
        to: brokerEmail,
        subject: emailSubject,
        html: htmlContent,
        type: 'deal_alert',
        priority: 'medium'
      });

      // Log communication with actual email content for analyst review
      // Convert HTML to plain text for communication log while preserving content
      const plainTextVersion = htmlContent
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/&amp;/g, '&') // Replace HTML entities
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
      
      await storage.createCommunication({
        brokerId: broker.id,
        relatedDealId: dealId,
        channel: "email",
        direction: "outbound",
        rawText: plainTextVersion, // Store the actual content for analyst review
        subject: emailSubject,
        message: plainTextVersion, // Store the actual message content
        recipientEmail: brokerEmail,
        status: "resolved" // Deal confirmation, not a follow-up for missing info
      });

      console.log(`Deal submission confirmation sent to ${brokerEmail} using custom template`);
    } catch (error) {
      console.error("Failed to send deal submission confirmation:", error);
    }
  }

  // Send deal status update notification — uses Outreach Management templates exclusively
  async sendDealStatusUpdate(dealId: string, newStatus: string): Promise<void> {
    try {
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        console.error("Deal not found for status update email");
        return;
      }

      const broker = await storage.getBrokerById(deal.brokerId);
      if (!broker) {
        console.error("Broker not found for deal status update");
        return;
      }

      if (!broker.email || broker.email.includes('@temp.landlinq.ai')) {
        console.log(`Skipping status update email — no real email for broker ${broker.id}`);
        return;
      }

      // Map newStatus to template event type
      const eventTypeMap: Record<string, string> = {
        'rejected': 'status_rejected',
        'approved': 'status_pursuing',
        'high_priority': 'status_pursuing',
        'under_review': 'status_under_review',
      };
      const eventType = eventTypeMap[newStatus];
      if (!eventType) {
        console.log(`No template event mapping for status: ${newStatus}`);
        return;
      }

      const brokerName = `${broker.firstName || ''} ${broker.lastName || ''}`.trim() || 'Broker';
      const emailTemplate = await TemplateService.getEmailTemplate(eventType, {
        brokerName,
        address: deal.address,
        propertyAddress: deal.address,
        declineReason: (deal as any).rejectionReason || '',
        rejectionReason: (deal as any).rejectionReason || '',
      });

      if (!emailTemplate) {
        console.error(`❌ [STATUS-UPDATE] No Outreach Management template found for event "${eventType}" — email not sent. Add this template in Outreach Management.`);
        return;
      }

      await sendNotificationEmail({
        to: broker.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        type: eventType,
        sendgridTemplateId: emailTemplate.sendgridTemplateId,
        sendgridDynamicData: emailTemplate.sendgridDynamicData,
        priority: 'medium'
      });

      const templateMode = emailTemplate.sendgridTemplateId ? `SendGrid (${emailTemplate.sendgridTemplateId})` : 'Outreach Tab';
      console.log(`✅ [STATUS-UPDATE] ${eventType} email sent via ${templateMode} to ${broker.email}`);

      // Log communication
      const plainText = (emailTemplate.html || emailTemplate.content || emailTemplate.subject)
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      await storage.createCommunication({
        brokerId: broker.id,
        relatedDealId: dealId,
        channel: "email",
        direction: "outbound",
        rawText: plainText,
        subject: emailTemplate.subject,
        message: plainText,
        recipientEmail: broker.email,
        status: "resolved"
      });

    } catch (error) {
      console.error("Failed to send deal status update:", error);
    }
  }

  // Send weekly digest to analysts
  async sendWeeklyAnalystDigest(): Promise<void> {
    try {
      const teamMembers = await storage.getCatalystTeamMembers();
      const recentDeals = await storage.getAllDealsWithBrokers();
      
      // Filter deals from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const weeklyDeals = recentDeals.filter(deal => 
        deal.createdAt && new Date(deal.createdAt) >= weekAgo
      );

      if (weeklyDeals.length === 0) {
        console.log("No new deals this week, skipping digest");
        return;
      }

      const subject = `Weekly LandLinq Digest - ${weeklyDeals.length} New Submissions`;
      const text = `
Weekly LandLinq Activity Summary
===============================

This week: ${weeklyDeals.length} new property submissions

High Priority Deals (${weeklyDeals.filter(d => d.classification === 'green').length}):
${weeklyDeals.filter(d => d.classification === 'green').map(d => 
  `• ${d.address} - ${d.sizeAcres} acres - $${d.askingPrice} - ${d.broker.firstName} ${d.broker.lastName}`
).join('\n')}

Under Review (${weeklyDeals.filter(d => d.classification === 'yellow').length}):
${weeklyDeals.filter(d => d.classification === 'yellow').map(d => 
  `• ${d.address} - ${d.sizeAcres} acres - ${d.broker.firstName} ${d.broker.lastName}`
).join('\n')}

Pipeline Summary:
- Total Active Deals: ${recentDeals.length}
- Approved This Week: ${weeklyDeals.filter(d => d.status === 'approved').length}
- High Priority: ${recentDeals.filter(d => d.classification === 'green').length}
- Under Review: ${recentDeals.filter(d => d.classification === 'yellow').length}

View full dashboard: https://landlinq.ai/analyst-dashboard

Best regards,
LandLinq Analytics Engine
`;

      // Send to all team members
      for (const member of teamMembers) {
        await sendNotificationEmail({
          to: member.email,
          subject,
          text,
          type: 'weekly_digest',
          priority: 'low'
        });
      }

      console.log(`Weekly digest sent to ${teamMembers.length} team members`);
    } catch (error) {
      console.error("Failed to send weekly analyst digest:", error);
    }
  }

  // Commission payment notification (disabled)
  async sendCommissionPaymentNotification(brokerId: string, amount: number, dealAddress: string): Promise<void> {
    try {
      const broker = await storage.getBrokerById(brokerId);
      if (!broker) {
        console.error("Broker not found for commission tracking");
        return;
      }

      // Log commission tracking only (no automated notifications)
      console.log(`Commission payment tracked for ${broker.firstName} ${broker.lastName}`);
      console.log(`Amount: $${amount.toLocaleString()} for ${dealAddress}`);
      console.log("Automated commission notifications disabled");

    } catch (error) {
      console.error("Failed to track commission payment:", error);
    }
  }
}

export const emailAutomationService = new EmailAutomationService();
import { storage } from "./storage";
import { emailService, sendNotificationEmail } from "./emailService";
import { sendSMS } from "./smsService";
import { TemplateService, TemplateVariables } from "./templateService";
import { ResolutionService } from "./resolutionService";
import { TimeProvider, RealTimeProvider } from "./testWebhookRoutes";
import type { Communication, Deal, Broker } from "@shared/schema";

export interface MissingFieldsAnalysis {
  hasMissingFields: boolean;
  missingFields: string[];
  templateType: 'info_missing_address' | 'info_missing_acreage' | 'info_missing_price' | 'info_missing_both' | 'info_missing_all_vital' | 'info_uncertain_details' | 'info_missing_reminder' | null;
  missingFieldsText: string;
  hasUncertainInfo: boolean;
  uncertainFields: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface FollowUpContext {
  broker: Broker;
  deal: Deal;
  communication?: Communication;
  channel: 'email' | 'sms';
  supportPhone: string;
}

export class FollowUpService {
  private static timeProvider: TimeProvider = new RealTimeProvider();
  private static testConfig = {
    COOLDOWN_HOURS: 24, // Minimum hours between follow-ups
    REMINDER_HOURS: 48, // Hours to wait before sending reminder
    MAX_FOLLOW_UP_ATTEMPTS: 3, // Escalate after this many attempts
    SUPPORT_PHONE: "(704) 610-1549"
  };

  /**
   * Set time provider for testing (allows time manipulation)
   */
  static setTimeProvider(provider: TimeProvider): void {
    this.timeProvider = provider;
    console.log('⏰ FollowUpService time provider updated for testing');
  }

  /**
   * Set test configuration for flexible testing intervals
   */
  static setTestConfig(config: Partial<typeof FollowUpService.testConfig>): void {
    this.testConfig = { ...this.testConfig, ...config };
    console.log('🧪 FollowUpService test configuration updated:', config);
  }

  /**
   * Reset to production defaults
   */
  static resetToDefaults(): void {
    this.timeProvider = new RealTimeProvider();
    this.testConfig = {
      COOLDOWN_HOURS: 24,
      REMINDER_HOURS: 48,
      MAX_FOLLOW_UP_ATTEMPTS: 3,
      SUPPORT_PHONE: "(704) 610-1549"
    };
    console.log('🔄 FollowUpService reset to production defaults');
  }

  /**
   * Analyze a deal to determine what information is missing or uncertain
   * CRITICAL: Only ADDRESS/ZIP/STATE are truly REQUIRED to proceed with classification.
   * Price and acreage are optional - system can analyze deals without them.
   */
  static analyzeMissingFields(deal: Deal): MissingFieldsAnalysis {
    const missingFields: string[] = [];
    const uncertainFields: string[] = [];
    
    // Check for missing ADDRESS (required field per system requirements)
    const hasAddress = deal.address && deal.address.trim().length > 0;
    if (!hasAddress) {
      missingFields.push('address');
    }
    
    // Check for missing ZIP CODE (required for HelloData API searches and complete address)
    const hasZipCode = deal.zip && deal.zip.trim().length > 0;
    if (!hasZipCode) {
      missingFields.push('ZIP code');
    }
    
    // Check for missing STATE (required for complete address)
    const hasState = deal.state && deal.state.trim().length > 0;
    if (!hasState) {
      missingFields.push('state');
    }
    
    // REMOVED: Price and acreage checks - these are optional and don't block classification
    // The system can proceed with incomplete price/acreage data

    // Check for LOW CONFIDENCE / UNCERTAIN information
    // This checks if data was extracted with low confidence from parsing
    const dealData = deal as any; // Cast to access extended properties
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    
    if (dealData.extractedInfo) {
      const extractedInfo = dealData.extractedInfo;
      
      // Check address confidence (ONLY for address, which is required)
      if (hasAddress && extractedInfo.addressConfidence && extractedInfo.addressConfidence < 0.7) {
        uncertainFields.push(`address (unsure if "${deal.address}" is correct)`);
      }
      
      // Calculate overall confidence based on extraction confidence
      if (extractedInfo.confidence) {
        confidence = extractedInfo.confidence;
      } else if (extractedInfo.addressConfidence) {
        // Base confidence on address extraction only
        if (extractedInfo.addressConfidence >= 0.8) confidence = 'high';
        else if (extractedInfo.addressConfidence >= 0.6) confidence = 'medium';
        else confidence = 'low';
      }
    }
    
    // Determine template type based on missing and uncertain fields
    let templateType: MissingFieldsAnalysis['templateType'] = null;
    
    const hasAddressIssues = missingFields.includes('address') || missingFields.includes('ZIP code') || missingFields.includes('state');
    
    if (uncertainFields.length > 0 && missingFields.length === 0) {
      // Only uncertain info, need confirmation
      templateType = 'info_uncertain_details';
    } else if (hasAddressIssues) {
      // Missing any part of the complete address (the only required data)
      templateType = 'info_missing_address';
    }
    // REMOVED: Price and acreage template logic - these fields are optional
    
    // Create human-readable missing fields text
    let missingFieldsText = '';
    const allMissingParts: string[] = [];
    
    if (missingFields.includes('address')) {
      allMissingParts.push('property address');
    }
    if (missingFields.includes('ZIP code')) {
      allMissingParts.push('ZIP code');
    }
    if (missingFields.includes('state')) {
      allMissingParts.push('state');
    }
    // REMOVED: Price and acreage text - these fields are optional
    
    if (allMissingParts.length > 0) {
      missingFieldsText = allMissingParts.join(', ');
    } else if (uncertainFields.length > 0) {
      missingFieldsText = uncertainFields.join(', ');
    }
    
    return {
      hasMissingFields: missingFields.length > 0,
      missingFields,
      templateType,
      missingFieldsText,
      hasUncertainInfo: uncertainFields.length > 0,
      uncertainFields,
      confidence
    };
  }

  /**
   * Check if we should send a follow-up for missing information
   * @param isRecentSubmission - If true, bypasses cooldown for fresh submissions with missing info
   */
  static async shouldSendFollowUp(
    dealId: string, 
    brokerId: string,
    isRecentSubmission: boolean = false
  ): Promise<{ 
    shouldSend: boolean; 
    reason: string; 
    existingCommunication?: Communication;
    followUpType: 'initial' | 'reminder' | 'escalation';
  }> {
    // STEP 1: Check overall deal communication resolution status first
    const dealCommStatus = await ResolutionService.getDealCommunicationStatus(dealId);
    
    if (!dealCommStatus.hasActiveThreads && dealCommStatus.totalThreads > 0) {
      return {
        shouldSend: false,
        reason: `All communication threads for this deal are resolved (${dealCommStatus.resolvedThreads.length} resolved threads)`,
        followUpType: 'initial'
      };
    }
    
    // STEP 2: Get existing communications for this deal and broker combination
    const communications = await storage.getCommunicationsByDealId(dealId);
    const brokerCommunications = communications.filter(c => 
      c.brokerId === brokerId
    );
    
    // STEP 3: Check for resolved threads specifically for this broker
    const brokerThreads = new Set(brokerCommunications
      .filter(c => c.threadKey)
      .map(c => c.threadKey)
    );
    
    // Check if any of this broker's threads are resolved
    for (const threadKey of Array.from(brokerThreads)) {
      if (threadKey) {
        const isResolved = await ResolutionService.isThreadResolved(threadKey);
        if (isResolved) {
          return {
            shouldSend: false,
            reason: `Communication thread ${threadKey} is already resolved`,
            followUpType: 'initial'
          };
        }
      }
    }
    
    // STEP 4: Filter out resolved communications using new resolution fields
    const unresolvedBrokerComms = brokerCommunications.filter(c => 
      !c.resolved && c.status !== 'resolved'
    );
    
    // Check if we already have follow-up communications that are not resolved
    // CRITICAL FIX: Only check 'followup_sent' status to avoid false cooldowns from placeholder 'pending_followup' records
    const followUpComms = unresolvedBrokerComms.filter(c => 
      c.direction === 'outbound' && 
      c.status === 'followup_sent'
    );
    
    if (followUpComms.length === 0) {
      return { shouldSend: true, reason: 'No previous unresolved follow-ups', followUpType: 'initial' };
    }
    
    // Get the most recent follow-up
    const latestFollowUp = followUpComms.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )[0];
    
    // Check cooldown period using injectable time provider
    const currentTime = this.timeProvider.now();
    const lastFollowUpTime = new Date(latestFollowUp.lastFollowUpAt || latestFollowUp.createdAt || 0).getTime();
    const hoursSinceLastFollowUp = (currentTime - lastFollowUpTime) / (1000 * 60 * 60);
    
    // CRITICAL FIX: For recent submissions with missing info, bypass cooldown
    // This ensures brokers get immediate feedback when submitting deals (even duplicates)
    if (hoursSinceLastFollowUp < this.testConfig.COOLDOWN_HOURS) {
      if (isRecentSubmission) {
        console.log(`🔄 [COOLDOWN-BYPASS] Recent submission with missing info - sending follow-up despite cooldown (${hoursSinceLastFollowUp.toFixed(1)}h)`);
        return {
          shouldSend: true,
          reason: `Recent submission requires immediate follow-up (cooldown bypassed)`,
          existingCommunication: latestFollowUp,
          followUpType: 'initial'
        };
      }
      
      return { 
        shouldSend: false, 
        reason: `Cooldown period active (${hoursSinceLastFollowUp.toFixed(1)}h < ${this.testConfig.COOLDOWN_HOURS}h)`,
        existingCommunication: latestFollowUp,
        followUpType: 'initial'
      };
    }
    
    // Check if we've exceeded max attempts
    const totalFollowUps = followUpComms.reduce((sum, comm) => sum + (comm.followUpCount || 0), 0);
    
    if (totalFollowUps >= this.testConfig.MAX_FOLLOW_UP_ATTEMPTS) {
      return { 
        shouldSend: false, 
        reason: `Max follow-up attempts reached (${totalFollowUps}/${this.testConfig.MAX_FOLLOW_UP_ATTEMPTS})`,
        existingCommunication: latestFollowUp,
        followUpType: 'escalation'
      };
    }
    
    // Determine if this is a reminder (48+ hours since last follow-up)
    const followUpType = hoursSinceLastFollowUp >= this.testConfig.REMINDER_HOURS ? 'reminder' : 'initial';
    
    return { 
      shouldSend: true, 
      reason: `Cooldown complete, no resolved threads found (${hoursSinceLastFollowUp.toFixed(1)}h >= ${this.testConfig.COOLDOWN_HOURS}h)`,
      existingCommunication: latestFollowUp,
      followUpType
    };
  }

  /**
   * Determine the preferred communication channel for a broker
   */
  static determineChannel(broker: Broker, inboundChannel?: 'email' | 'sms'): 'email' | 'sms' {
    // If broker has SMS opt-out, always use email
    if (!broker.smsOptIn) {
      return 'email';
    }
    
    // Use the same channel as inbound communication if specified
    if (inboundChannel) {
      return inboundChannel;
    }
    
    // If broker has phone and SMS opt-in, prefer SMS
    if (broker.phone && broker.smsOptIn) {
      return 'sms';
    }
    
    // Default to email
    return 'email';
  }

  /**
   * Send a follow-up message for missing information
   */
  static async sendFollowUpMessage(context: FollowUpContext, missingFields: MissingFieldsAnalysis, followUpType: 'initial' | 'reminder' | 'escalation'): Promise<boolean> {
    try {
      const { broker, deal, channel } = context;
      
      // Determine template type - use reminder template for reminder follow-ups
      const templateType = followUpType === 'reminder' ? 'info_missing_reminder' : missingFields.templateType;
      
      if (!templateType) {
        console.error('No template type determined for follow-up');
        return false;
      }
      
      // Get analyst information for the deal
      let analystName = 'Catalyst Team';
      if (deal.assignedAnalyst) {
        try {
          const analyst = await storage.getUser(deal.assignedAnalyst);
          if (analyst) {
            // Construct full name from firstName and lastName
            const parts = [analyst.firstName, analyst.lastName].filter(Boolean);
            if (parts.length > 0) {
              analystName = parts.join(' ');
            }
          }
        } catch (error) {
          console.warn(`Could not fetch analyst for deal ${deal.id}:`, error);
        }
      }
      
      // Get company branding from business settings
      let companyName = 'Catalyst Capital Partners';
      try {
        const businessSettings = await storage.getBusinessSettings();
        if (businessSettings && businessSettings.companyName) {
          companyName = businessSettings.companyName;
        }
      } catch (error) {
        console.warn('Could not fetch business settings:', error);
      }
      
      // Prepare template variables
      const templateVars: TemplateVariables = {
        brokerName: broker.firstName || 'there',
        address: deal.address,
        propertyAddress: deal.address, // Some templates use propertyAddress instead of address
        missingFields: missingFields.missingFieldsText,
        supportPhone: this.testConfig.SUPPORT_PHONE,
        analystName: analystName,
        companyName: companyName,
        dealId: deal.id
      };
      
      let success = false;
      let messageContent = '';
      let subject = '';
      
      if (channel === 'email') {
        // Send email follow-up using outreach management templates ONLY
        const template = await TemplateService.getEmailTemplate(templateType, templateVars);
        if (!template) {
          console.error(`No email template configured in outreach management for: ${templateType}`);
          return false;
        }
        subject = template.subject;
        messageContent = template.content;
        
        if (broker.email) {
          success = await sendNotificationEmail({
            to: broker.email,
            subject: template.subject,
            html: template.html, // templateService always returns properly formatted HTML with logo/blue line/footer
            text: template.content,
            type: 'missing_info_followup',
            priority: followUpType === 'reminder' ? 'medium' : 'high'
          });
        }
      } else if (channel === 'sms') {
        // Send SMS follow-up using outreach management templates ONLY
        const smsTemplate = await TemplateService.getSMSTemplate(templateType, templateVars);
        if (!smsTemplate) {
          console.error(`No SMS template configured in outreach management for: ${templateType}`);
          return false;
        }
        messageContent = smsTemplate;
        
        if (broker.phone && broker.smsOptIn) {
          const smsResult = await sendSMS({
            to: broker.phone,
            message: messageContent
          });
          
          if (smsResult.success && smsResult.delivered) {
            console.log(`✅ Follow-up SMS sent (SID: ${smsResult.sid})`);
            success = true;
          } else if (smsResult.success && !smsResult.delivered) {
            console.log(`⏭️ Follow-up SMS not delivered - ${smsResult.reason || smsResult.mode}`);
            success = false;
          } else {
            console.log(`❌ Follow-up SMS failed - ${smsResult.error}`);
            success = false;
          }
        }
      }
      
      if (success) {
        // Create or update communication record
        const existingComm = context.communication;
        
        if (existingComm) {
          // Update existing communication
          await storage.updateCommunication(existingComm.id, {
            followUpCount: (existingComm.followUpCount || 0) + 1,
            lastFollowUpAt: new Date(),
            status: 'followup_sent',
            updatedAt: new Date()
          });
        } else {
          // Create new communication record
          await storage.createCommunication({
            brokerId: broker.id,
            relatedDealId: deal.id,
            email: channel === 'email' ? broker.email : undefined,
            phone: channel === 'sms' ? broker.phone : undefined,
            channel,
            direction: 'outbound',
            rawText: messageContent,
            subject: subject || undefined,
            message: messageContent,
            missingFields: missingFields.missingFields,
            status: 'followup_sent',
            threadKey: `deal-${deal.id}-broker-${broker.id}` // For threading related messages
          });
        }
        
        console.log(`✅ Follow-up (${followUpType}) sent via ${channel} to ${broker.firstName} ${broker.lastName} for ${deal.address}`);
        return true;
      } else {
        console.error(`❌ Failed to send follow-up via ${channel} to ${broker.firstName} ${broker.lastName}`);
        return false;
      }
    } catch (error) {
      console.error('Error sending follow-up message:', error);
      return false;
    }
  }

  /**
   * Process a deal for potential follow-up automation
   */
  static async processFollowUpForDeal(dealId: string, inboundChannel?: 'email' | 'sms'): Promise<void> {
    try {
      console.log(`🔄 Processing follow-up automation for deal ${dealId}`);
      
      // Get deal and broker information
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        console.error(`Deal ${dealId} not found`);
        return;
      }
      
      const broker = await storage.getBrokerById(deal.brokerId);
      if (!broker) {
        console.error(`Broker ${deal.brokerId} not found for deal ${dealId}`);
        return;
      }
      
      // Analyze missing fields
      const missingFieldsAnalysis = this.analyzeMissingFields(deal);
      
      if (!missingFieldsAnalysis.hasMissingFields) {
        console.log(`✅ No missing fields for deal ${dealId}, no follow-up needed`);
        return;
      }
      
      console.log(`📋 Missing fields detected: ${missingFieldsAnalysis.missingFields.join(', ')}`);
      
      // Check if we should send a follow-up
      const shouldFollowUp = await this.shouldSendFollowUp(dealId, broker.id);
      
      if (!shouldFollowUp.shouldSend) {
        console.log(`⏸️ Follow-up skipped for deal ${dealId}: ${shouldFollowUp.reason}`);
        
        // Check if we need to escalate
        if (shouldFollowUp.followUpType === 'escalation') {
          await this.escalateToManualReview(deal, broker, missingFieldsAnalysis);
        }
        return;
      }
      
      console.log(`🚀 Sending follow-up for deal ${dealId}: ${shouldFollowUp.reason}`);
      
      // Determine communication channel
      const channel = this.determineChannel(broker, inboundChannel);
      
      // Prepare follow-up context
      const context: FollowUpContext = {
        broker,
        deal,
        communication: shouldFollowUp.existingCommunication,
        channel,
        supportPhone: this.testConfig.SUPPORT_PHONE
      };
      
      // Send follow-up message
      const success = await this.sendFollowUpMessage(context, missingFieldsAnalysis, shouldFollowUp.followUpType);
      
      if (success) {
        console.log(`✅ Follow-up automation completed successfully for deal ${dealId}`);
      } else {
        console.error(`❌ Follow-up automation failed for deal ${dealId}`);
      }
    } catch (error) {
      console.error(`Error processing follow-up for deal ${dealId}:`, error);
    }
  }

  /**
   * Escalate a deal to manual review after max follow-up attempts
   */
  static async escalateToManualReview(deal: Deal, broker: Broker, missingFields: MissingFieldsAnalysis): Promise<void> {
    try {
      console.log(`🚨 Escalating deal ${deal.id} to manual review after max follow-up attempts`);
      
      // Create escalation communication record
      await storage.createCommunication({
        brokerId: broker.id,
        relatedDealId: deal.id,
        channel: 'email', // System escalation via email
        direction: 'outbound',
        rawText: `ESCALATION: Deal requires manual review. Missing: ${missingFields.missingFieldsText}. Max follow-up attempts reached (${this.testConfig.MAX_FOLLOW_UP_ATTEMPTS}).`,
        message: `Deal escalated to manual review due to missing information after ${this.testConfig.MAX_FOLLOW_UP_ATTEMPTS} follow-up attempts.`,
        status: 'pending_followup', // Escalated but pending manual review
        missingFields: missingFields.missingFields
      });
      
      // Update deal status if needed
      if (deal.status === 'pending_review') {
        await storage.updateDeal(deal.id, {
          status: 'initial_review',
          analystNotes: `Escalated: Missing ${missingFields.missingFieldsText} after ${this.testConfig.MAX_FOLLOW_UP_ATTEMPTS} follow-up attempts.`,
          priority: 'high'
        });
      }
      
      console.log(`✅ Deal ${deal.id} escalated to manual review`);
    } catch (error) {
      console.error(`Error escalating deal ${deal.id} to manual review:`, error);
    }
  }

  /**
   * Process reminder follow-ups for deals with pending missing information
   */
  static async processReminderFollowUps(): Promise<void> {
    try {
      console.log('🔄 Processing reminder follow-ups for incomplete deals');
      
      // Get all deals with pending communications
      const allCommunications = await storage.getRecentCommunications(1000);
      
      // Find communications that need reminder follow-ups
      const reminderCandidates = allCommunications.filter(comm => 
        comm.status === 'followup_sent' && 
        comm.missingFields && 
        comm.missingFields.length > 0 &&
        comm.lastFollowUpAt
      );
      
      for (const communication of reminderCandidates) {
        if (!communication.lastFollowUpAt) continue;
        
        const hoursSinceLastFollowUp = (Date.now() - new Date(communication.lastFollowUpAt).getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastFollowUp >= this.testConfig.REMINDER_HOURS) {
          if (communication.relatedDealId) {
            await this.processFollowUpForDeal(communication.relatedDealId, communication.channel as 'email' | 'sms');
          }
        }
      }
      
      console.log(`✅ Reminder follow-up processing completed`);
    } catch (error) {
      console.error('Error processing reminder follow-ups:', error);
    }
  }

  /**
   * Mark follow-up communications as resolved when broker provides missing info
   * This prevents the infinite loop where we keep asking for the same info
   */
  static async markFollowUpResolved(dealId: string, channel: 'email' | 'sms'): Promise<void> {
    try {
      console.log(`📝 Marking ${channel} follow-up as resolved for deal ${dealId}`);
      
      // Get all communications for this deal
      const communications = await storage.getCommunicationsByDealId(dealId);
      
      // Find unresolved follow-up communications for this channel
      const unresolvedFollowUps = communications.filter((c: any) => 
        c.channel === channel &&
        c.direction === 'outbound' &&
        c.status === 'followup_sent' &&
        !c.resolved
      );
      
      // Mark them all as resolved
      for (const comm of unresolvedFollowUps) {
        await storage.updateCommunication(comm.id, {
          resolved: true,
          status: 'resolved',
          updatedAt: new Date()
        });
        console.log(`✅ Marked communication ${comm.id} as resolved`);
      }
      
      console.log(`✅ Follow-up marked as resolved for deal ${dealId} (${unresolvedFollowUps.length} communications updated)`);
    } catch (error) {
      console.error(`Error marking follow-up as resolved for deal ${dealId}:`, error);
      throw error;
    }
  }
}

export const followUpService = FollowUpService;
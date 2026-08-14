// Core Outreach Service for LandLinq
// Handles monthly broker outreach campaigns with rate limiting and compliance

import { storage } from '../storage';
import { sendNotificationEmail, transformTextToHTML } from '../emailService';
import { sendSMS, SendSMSResult } from '../smsService';
import { TemplateService, TemplateVariables } from '../templateService';
import { outreachSafeguardService } from '../outreachSafeguardService';
import type { OutreachCampaign, OutreachRun, OutreachMessage, Broker, InsertOutreachRun, InsertOutreachMessage } from '@shared/schema';

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

export interface OutreachExecutionOptions {
  dryRun?: boolean;
  maxMessages?: number;
  rateLimitPerMinute?: number;
}

export interface OutreachRunResult {
  runId: string;
  totalTargets: number;
  sentEmailCount: number;
  sentSMSCount: number;
  failuresCount: number;
  skippedCount: number;
  errors: string[];
}

export class OutreachService {
  private rateLimitQueues: Map<string, Date[]> = new Map();

  /**
   * Check if outreach is globally enabled via master toggle
   */
  async isOutreachEnabled(): Promise<boolean> {
    try {
      const settings = await storage.getBusinessSettings();
      // Default to true if field doesn't exist (backward compatibility)
      const enabled = (settings as any)?.outreachMasterEnabled !== false;
      return enabled;
    } catch (error) {
      console.error('❌ Error checking outreach master toggle:', error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Get campaigns that are due to run
   */
  async getDueCampaigns(): Promise<OutreachCampaign[]> {
    try {
      // Dec 12, 2025: Check master toggle first
      const isEnabled = await this.isOutreachEnabled();
      if (!isEnabled) {
        console.log(`🚫 [OUTREACH] Master toggle is OFF - skipping all outreach campaigns`);
        return [];
      }

      const dueCampaigns = await storage.getDueOutreachCampaigns();
      console.log(`📅 Found ${dueCampaigns.length} due outreach campaigns`);
      return dueCampaigns;
    } catch (error) {
      console.error('❌ Error getting due campaigns:', error);
      throw error;
    }
  }

  /**
   * Build list of target brokers for a campaign based on filters
   */
  async buildTargetBrokers(campaign: OutreachCampaign): Promise<Broker[]> {
    try {
      console.log(`🎯 Building target brokers for campaign: ${campaign.name}`);
      
      // Get eligible brokers based on campaign filters
      const eligibleBrokers = await storage.getEligibleBrokersForOutreach(campaign.brokerFilter || {});
      
      // Filter out brokers who already received outreach this period
      const currentPeriodKey = this.getCurrentPeriodKey();
      const targetBrokers: Broker[] = [];
      
      for (const broker of eligibleBrokers) {
        // Check each channel the campaign supports
        const channels = campaign.channels as string[];
        let shouldInclude = false;
        
        for (const channel of channels) {
          // Check if broker should receive this channel based on preferences
          if (!this.shouldSendToChannel(broker, channel)) {
            continue;
          }
          
          // Check if we already sent to this broker on this channel this period
          const exists = await storage.checkMessageExists(
            campaign.id,
            broker.id,
            channel,
            currentPeriodKey
          );
          
          if (!exists) {
            shouldInclude = true;
            break;
          }
        }
        
        if (shouldInclude) {
          targetBrokers.push(broker);
        }
      }
      
      console.log(`✅ Found ${targetBrokers.length} target brokers (${eligibleBrokers.length} total eligible)`);
      return targetBrokers;
    } catch (error) {
      console.error('❌ Error building target brokers:', error);
      throw error;
    }
  }

  /**
   * Execute an outreach campaign run
   */
  async executeOutreachRun(
    campaign: OutreachCampaign,
    options: OutreachExecutionOptions = {}
  ): Promise<OutreachRunResult> {
    const startTime = new Date();
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🚀 [OUTREACH-${runId}] STARTING CAMPAIGN EXECUTION`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`📋 Campaign: ${campaign.name} (ID: ${campaign.id})`);
    console.log(`👤 Sender ID: ${campaign.senderId || 'NOT ASSIGNED - safeguards bypassed!'}`);
    console.log(`📧 Email Template: ${campaign.emailTemplateKey || 'none'}`);
    console.log(`📱 SMS Template: ${campaign.smsTemplateKey || 'none'}`);
    console.log(`🔀 Channels: ${JSON.stringify(campaign.channels)}`);
    console.log(`⚙️ Options: dryRun=${options.dryRun || false}, maxMessages=${options.maxMessages || 'unlimited'}`);
    console.log(`${'─'.repeat(80)}`);
    
    // Create run record
    const runData: InsertOutreachRun = {
      campaignId: campaign.id,
      startedAt: startTime,
      status: 'running',
      totalTargets: 0,
      sentEmailCount: 0,
      sentSMSCount: 0,
      failuresCount: 0
    };
    
    const run = await storage.createOutreachRun(runData);
    
    const result: OutreachRunResult = {
      runId: run.id,
      totalTargets: 0,
      sentEmailCount: 0,
      sentSMSCount: 0,
      failuresCount: 0,
      skippedCount: 0,
      errors: []
    };
    
    try {
      // Get target brokers
      console.log(`\n📊 [OUTREACH] PHASE 1: Building target broker list...`);
      const targetBrokers = await this.buildTargetBrokers(campaign);
      result.totalTargets = targetBrokers.length;
      
      // Update run with total targets
      await storage.updateOutreachRun(run.id, { totalTargets: targetBrokers.length });
      
      if (targetBrokers.length === 0) {
        console.log(`⚪ [OUTREACH] No target brokers found - campaign complete`);
        console.log(`${'═'.repeat(80)}\n`);
        await this.completeRun(run.id, result, 'completed');
        return result;
      }
      
      // Apply max message limit if specified
      const brokersToProcess = options.maxMessages ? 
        targetBrokers.slice(0, options.maxMessages) : targetBrokers;
      
      const rateLimitPerMinute = options.rateLimitPerMinute || campaign.rateLimitPerMinute || 10;
      const channels = campaign.channels as string[];
      const currentPeriodKey = this.getCurrentPeriodKey();
      
      console.log(`\n📊 [OUTREACH] PHASE 2: Processing brokers...`);
      console.log(`   📧 Target brokers: ${targetBrokers.length}`);
      console.log(`   📤 Processing: ${brokersToProcess.length} brokers`);
      console.log(`   ⏱️ Rate limit: ${rateLimitPerMinute}/min`);
      console.log(`   📅 Period key: ${currentPeriodKey}`);
      console.log(`${'─'.repeat(80)}`);
      
      let brokerIndex = 0;
      
      // Process each broker
      for (const broker of brokersToProcess) {
        brokerIndex++;
        const brokerName = `${broker.firstName || ''} ${broker.lastName || ''}`.trim() || 'Unknown';
        
        for (const channel of channels) {
          try {
            // Check if we should send to this channel
            if (!this.shouldSendToChannel(broker, channel)) {
              console.log(`   [${brokerIndex}/${brokersToProcess.length}] ⏭️ ${brokerName} - ${channel} skipped (no ${channel === 'email' ? 'email' : 'phone/opt-in'})`);
              result.skippedCount++;
              continue;
            }
            
            // Check for existing message (double-check for race conditions)
            const exists = await storage.checkMessageExists(
              campaign.id,
              broker.id,
              channel,
              currentPeriodKey
            );
            
            if (exists) {
              console.log(`   [${brokerIndex}/${brokersToProcess.length}] ⏭️ ${brokerName} - ${channel} skipped (already sent this period)`);
              result.skippedCount++;
              continue;
            }
            
            // Apply rate limiting
            await this.enforceRateLimit(campaign.id, rateLimitPerMinute);
            
            // Check safeguard authorization before sending (email only)
            // CRITICAL: Pass campaign.senderId (not campaign.id) to check the actual sender's limits
            if (channel === 'email' && campaign.senderId) {
              console.log(`   [${brokerIndex}/${brokersToProcess.length}] 🛡️ Checking safeguards for sender ${campaign.senderId}...`);
              const authorization = await outreachSafeguardService.authorizeSend(campaign.senderId, campaign.id);
              
              if (authorization.status === 'PAUSED') {
                console.log(`   [${brokerIndex}/${brokersToProcess.length}] 🛑 ${brokerName} - PAUSED: ${authorization.reason}`);
                result.skippedCount++;
                continue;
              } else if (authorization.status === 'THROTTLED') {
                console.log(`   [${brokerIndex}/${brokersToProcess.length}] ⏸️ ${brokerName} - THROTTLED: ${authorization.reason}`);
                console.log(`   ⚠️ Daily limit reached - stopping campaign for today`);
                // Break out of both loops when throttled
                break;
              } else if (authorization.status === 'AUTHORIZED') {
                console.log(`   [${brokerIndex}/${brokersToProcess.length}] ✅ Authorized (remaining: ${authorization.remainingQuota}, delay: ${authorization.nextSendDelay}ms)`);
                // Apply staggered delay from safeguard service
                if (authorization.nextSendDelay > 0) {
                  console.log(`   ⏳ Waiting ${authorization.nextSendDelay}ms (staggered sending)...`);
                  await new Promise(resolve => setTimeout(resolve, Math.min(authorization.nextSendDelay, 5000)));
                }
              }
            } else if (channel === 'email' && !campaign.senderId) {
              // Log warning if campaign has no sender assigned - skip safeguard but continue sending
              console.log(`   [${brokerIndex}/${brokersToProcess.length}] ⚠️ ${brokerName} - No senderId, safeguards BYPASSED`);
            }
            
            // Send message
            console.log(`   [${brokerIndex}/${brokersToProcess.length}] 📤 Sending ${channel} to ${brokerName}...`);
            const messageResult = await this.sendMessage(
              campaign,
              run.id,
              broker,
              channel,
              currentPeriodKey,
              options.dryRun || false
            );
            
            if (messageResult.success) {
              if (channel === 'email') {
                result.sentEmailCount++;
                console.log(`   [${brokerIndex}/${brokersToProcess.length}] ✅ EMAIL SENT to ${broker.email}`);
              } else if (channel === 'sms') {
                result.sentSMSCount++;
                console.log(`   [${brokerIndex}/${brokersToProcess.length}] ✅ SMS SENT to ${broker.phone}`);
              }
            } else {
              result.failuresCount++;
              console.log(`   [${brokerIndex}/${brokersToProcess.length}] ❌ FAILED: ${messageResult.error}`);
              result.errors.push(`${broker.firstName} ${broker.lastName} (${channel}): ${messageResult.error}`);
            }
            
          } catch (error: any) {
            result.failuresCount++;
            result.errors.push(`${broker.firstName} ${broker.lastName} (${channel}): ${error?.message || 'Unknown error'}`);
            console.error(`❌ Error sending to ${broker.firstName} ${broker.lastName} on ${channel}:`, error);
          }
        }
      }
      
      // Complete the run
      await this.completeRun(run.id, result, 'completed');
      
      // Update campaign last run and calculate next run
      await this.updateCampaignAfterRun(campaign);
      
      const duration = Date.now() - startTime.getTime();
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📊 [OUTREACH] CAMPAIGN EXECUTION COMPLETE`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`   📋 Campaign: ${campaign.name}`);
      console.log(`   ⏱️ Duration: ${duration}ms`);
      console.log(`   📧 Emails sent: ${result.sentEmailCount}`);
      console.log(`   📱 SMS sent: ${result.sentSMSCount}`);
      console.log(`   ⏭️ Skipped: ${result.skippedCount}`);
      console.log(`   ❌ Failures: ${result.failuresCount}`);
      if (result.errors.length > 0) {
        console.log(`   📝 Errors: ${result.errors.slice(0, 5).join(', ')}${result.errors.length > 5 ? '...' : ''}`);
      }
      console.log(`${'═'.repeat(80)}\n`);
      return result;
      
    } catch (error: any) {
      result.errors.push(`Campaign execution error: ${error?.message || 'Unknown error'}`);
      await this.completeRun(run.id, result, 'failed', error?.message || 'Unknown error');
      throw error;
    }
  }

  /**
   * Send individual message to broker
   */
  private async sendMessage(
    campaign: OutreachCampaign,
    runId: string,
    broker: Broker,
    channel: string,
    periodKey: string,
    dryRun: boolean
  ): Promise<{ success: boolean; error?: string }> {
    
    // Create message record
    const templateKey = channel === 'email' ? campaign.emailTemplateKey : campaign.smsTemplateKey;
    
    // Get recipient (email or phone based on channel)
    const recipient = channel === 'email' ? broker.email : broker.phone;
    
    // Skip if no recipient available
    if (!recipient) {
      console.log(`⚠️ Skipping ${channel} for broker ${broker.id} - no ${channel === 'email' ? 'email' : 'phone'} on file`);
      return { success: false, error: `No ${channel === 'email' ? 'email address' : 'phone number'} on file` };
    }
    
    const messageData: InsertOutreachMessage = {
      campaignId: campaign.id,
      runId: runId,
      brokerId: broker.id,
      channel: channel as 'email' | 'sms',
      periodKey: periodKey,
      templateKey: templateKey || 'Monthly Outreach',
      status: 'queued',
      recipient: recipient,
      content: 'Pending...' // Will be updated with actual content before sending
    };
    
    const message = await storage.createOutreachMessage(messageData);
    
    try {
      const templateVars: TemplateVariables = {
        brokerName: `${broker.firstName} ${broker.lastName}`.trim() || 'there',
        analystName: 'Austin Blondell',
        // NOTE: logoUrl, companyName, contactPhone, contactEmail, etc. are fetched from businessSettings by templateService
        // Do NOT hardcode them here - they will be added by templateService from the database
      };
      
      if (channel === 'email') {
        const template = await TemplateService.getEmailTemplate(templateKey || 'Monthly Outreach', templateVars);
        if (!template) {
          throw new Error(`${templateKey || 'Monthly Outreach'} email template not configured in outreach management`);
        }
        
        // CRITICAL: Get raw template to check for sendgridTemplateId
        const rawTemplate = await getRawEmailTemplate(templateKey || 'monthly_outreach');
        
        // Get sender's signature HTML if available
        let senderSignature = '';
        if (campaign.senderId) {
          try {
            const sender = await storage.getOutreachSenderById(campaign.senderId);
            if (sender?.signatureHtml) {
              senderSignature = `<br/><br/>${sender.signatureHtml}`;
              console.log(`   📝 Adding sender signature for ${sender.name}`);
            }
          } catch (sigError) {
            console.warn(`   ⚠️ Could not fetch sender signature:`, sigError);
          }
        }
        
        // Append signature to email HTML
        const emailHtmlWithSignature = template.html + senderSignature;
        
        // Update message with content snapshot
        await storage.updateOutreachMessage(message.id, {
          subject: template.subject,
          content: template.content,
          body: template.content
        });
        
        if (dryRun) {
          console.log(`📧 [DRY RUN] Would send email to ${broker.email}`);
          await storage.updateOutreachMessage(message.id, {
            status: 'sent',
            sentAt: new Date(),
            metadata: { dryRun: true, dryRunAt: new Date().toISOString() }
          });
          return { success: true };
        }
        
        // Send real email with proper HTML transformation for spacing preservation
        // CRITICAL: Pass sendgridTemplateId if configured in outreach management
        const emailResult = await sendNotificationEmail({
          to: broker.email!,
          subject: template.subject,
          html: emailHtmlWithSignature,
          text: template.content,
          type: 'monthly_outreach',
          priority: 'low',
          sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
          sendgridDynamicData: rawTemplate?.sendgridTemplateId ? templateVars : undefined
        });
        
        if (emailResult) {
          await storage.updateOutreachMessage(message.id, {
            status: 'sent',
            sentAt: new Date()
          });
          const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
          console.log(`📧 Email sent to ${broker.firstName} ${broker.lastName} (${broker.email}) via ${templateMode}`);
          return { success: true };
        } else {
          throw new Error('Email sending failed');
        }
        
      } else if (channel === 'sms') {
        const smsContent = await TemplateService.getSMSTemplate(templateKey || 'Monthly Outreach', templateVars);
        if (!smsContent) {
          throw new Error(`${templateKey || 'Monthly Outreach'} SMS template not configured in outreach management`);
        }
        
        // Update message with content snapshot
        await storage.updateOutreachMessage(message.id, {
          content: smsContent,
          body: smsContent
        });
        
        if (dryRun) {
          console.log(`📱 [DRY RUN] Would send SMS to ${broker.phone}`);
          await storage.updateOutreachMessage(message.id, {
            status: 'sent',
            sentAt: new Date(),
            metadata: { dryRun: true, dryRunAt: new Date().toISOString() }
          });
          return { success: true };
        }
        
        // Send real SMS
        const smsResult = await sendSMS({
          to: broker.phone!,
          message: smsContent
        });
        
        if (smsResult.success) {
          await storage.updateOutreachMessage(message.id, {
            status: 'sent',
            sentAt: new Date(),
            providerIds: { twilioSid: smsResult.sid }
          });
          console.log(`📱 SMS sent to ${broker.firstName} ${broker.lastName} (${broker.phone})`);
          return { success: true };
        } else {
          throw new Error(smsResult.error || 'SMS sending failed');
        }
      }
      
      throw new Error(`Unsupported channel: ${channel}`);
      
    } catch (error: any) {
      await storage.updateOutreachMessage(message.id, {
        status: 'failed',
        errorAt: new Date(),
        reason: error?.message || 'Unknown error'
      });
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  /**
   * Check if we should send to this broker on this channel
   */
  private shouldSendToChannel(broker: Broker, channel: string): boolean {
    // CRITICAL: Never send to inactive brokers (opt-out compliance)
    if (!broker.isActive) {
      console.log(`🚫 Skipping inactive broker ${broker.firstName} ${broker.lastName} (${broker.email || broker.phone})`);
      return false;
    }
    
    if (channel === 'email') {
      return !!(broker.email && broker.email.trim());
    } else if (channel === 'sms') {
      // Respect SMS opt-in preference
      return !!(broker.phone && broker.phone.trim() && broker.smsOptIn);
    }
    return false;
  }

  /**
   * Enforce rate limiting to avoid provider flags
   */
  private async enforceRateLimit(campaignId: string, rateLimitPerMinute: number): Promise<void> {
    const now = new Date();
    const queueKey = `campaign_${campaignId}`;
    
    if (!this.rateLimitQueues.has(queueKey)) {
      this.rateLimitQueues.set(queueKey, []);
    }
    
    const queue = this.rateLimitQueues.get(queueKey)!;
    
    // Remove timestamps older than 1 minute
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    while (queue.length > 0 && queue[0] < oneMinuteAgo) {
      queue.shift();
    }
    
    // Check if we're at rate limit
    if (queue.length >= rateLimitPerMinute) {
      const oldestInQueue = queue[0];
      const waitTime = 60 * 1000 - (now.getTime() - oldestInQueue.getTime());
      
      if (waitTime > 0) {
        console.log(`⏳ Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Add current request to queue
    queue.push(now);
  }

  /**
   * Get current period key (YYYY-MM format)
   */
  private getCurrentPeriodKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Complete a campaign run
   */
  private async completeRun(
    runId: string,
    result: OutreachRunResult,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    await storage.updateOutreachRun(runId, {
      completedAt: new Date(),
      status: status,
      sentEmailCount: result.sentEmailCount,
      sentSMSCount: result.sentSMSCount,
      failuresCount: result.failuresCount,
      error: error
    });
  }

  /**
   * Calculate next run date based on schedule week (1st Monday or 3rd Monday)
   * @param scheduleWeek - "1st_monday" or "3rd_monday"
   * @param hourEST - Hour in EST (0-23)
   * @returns Next run date in UTC
   */
  private calculateNextRunDate(scheduleWeek: string, hourEST: number): Date {
    const now = new Date();
    const targetOccurrence = scheduleWeek === '1st_monday' ? 1 : 3;
    
    // Start from next month
    let checkDate = new Date(now);
    checkDate.setMonth(checkDate.getMonth() + 1);
    checkDate.setDate(1); // First day of next month
    
    // Find the Nth Monday
    let mondayCount = 0;
    while (mondayCount < targetOccurrence) {
      if (checkDate.getDay() === 1) { // Monday
        mondayCount++;
        if (mondayCount === targetOccurrence) {
          break;
        }
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
    
    // Convert EST hour to UTC (EST is UTC-5 or UTC-4 depending on DST)
    // Using a simple EST offset of -5 hours (adjust for DST if needed)
    const utcHour = (hourEST + 5) % 24;
    checkDate.setHours(utcHour, 0, 0, 0);
    
    return checkDate;
  }

  /**
   * PUBLIC: Calculate next run date for a campaign (used when creating/activating campaigns)
   * @param scheduleWeek - "1st_monday" or "3rd_monday"
   * @param sendHourUtc - Hour in UTC (0-23)
   * @returns Next run date in UTC
   */
  calculateCampaignNextRun(scheduleWeek: string, sendHourUtc: number): Date {
    return this.calculateNextRunDate(scheduleWeek, sendHourUtc);
  }

  /**
   * Update campaign after successful run
   */
  private async updateCampaignAfterRun(campaign: OutreachCampaign): Promise<void> {
    const now = new Date();
    
    // Calculate next run time based on schedule week
    const nextRun = this.calculateNextRunDate(campaign.scheduleWeek || '1st_monday', campaign.sendHourUtc || 10);
    
    await storage.updateOutreachCampaign(campaign.id, {
      lastRunAt: now,
      nextRunAt: nextRun
    });
    
    console.log(`📅 Campaign ${campaign.name} next run scheduled for: ${nextRun.toISOString()}`);
  }

  /**
   * Preview message content for a specific broker
   */
  async previewMessage(
    campaign: OutreachCampaign,
    brokerId: string,
    channel: string
  ): Promise<{ subject?: string; body: string }> {
    const broker = await storage.getBrokerById(brokerId);
    if (!broker) {
      throw new Error('Broker not found');
    }
    
    const templateVars: TemplateVariables = {
      brokerName: `${broker.firstName} ${broker.lastName}`.trim() || 'there',
      analystName: 'Austin Blondell',
      // NOTE: logoUrl, companyName, contactPhone, contactEmail, etc. are fetched from businessSettings by templateService
      // Do NOT hardcode them here - they will be added by templateService from the database
    };
    
    const templateKey = channel === 'email' ? campaign.emailTemplateKey : campaign.smsTemplateKey;
    
    if (channel === 'email') {
      const template = await TemplateService.getEmailTemplate(templateKey || 'Monthly Outreach', templateVars);
      if (!template) {
        throw new Error(`${templateKey || 'Monthly Outreach'} email template not configured in outreach management`);
      }
      return {
        subject: template.subject,
        body: template.content
      };
    } else if (channel === 'sms') {
      const smsContent = await TemplateService.getSMSTemplate(templateKey || 'Monthly Outreach', templateVars);
      if (!smsContent) {
        throw new Error(`${templateKey || 'Monthly Outreach'} SMS template not configured in outreach management`);
      }
      return { body: smsContent };
    }
    
    throw new Error(`Unsupported channel: ${channel}`);
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<{
    totalRuns: number;
    totalMessagesSent: number;
    totalEmailsSent: number;
    totalSMSSent: number;
    totalFailures: number;
    lastRunAt?: Date;
    nextRunAt?: Date;
  }> {
    const [campaign, runs] = await Promise.all([
      storage.getOutreachCampaignById(campaignId),
      storage.getOutreachRunsByCampaignId(campaignId)
    ]);
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    const stats = {
      totalRuns: runs.length,
      totalMessagesSent: 0,
      totalEmailsSent: 0,
      totalSMSSent: 0,
      totalFailures: 0,
      lastRunAt: campaign.lastRunAt || undefined,
      nextRunAt: campaign.nextRunAt || undefined
    };
    
    for (const run of runs) {
      stats.totalEmailsSent += run.sentEmailCount || 0;
      stats.totalSMSSent += run.sentSMSCount || 0;
      stats.totalFailures += run.failuresCount || 0;
    }
    
    stats.totalMessagesSent = stats.totalEmailsSent + stats.totalSMSSent;
    
    return stats;
  }
}

// Export singleton instance
export const outreachService = new OutreachService();
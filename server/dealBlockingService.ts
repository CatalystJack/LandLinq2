import { db } from './db';
import { deals, reviewQueue } from '@shared/schema';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { sendNotificationEmail } from './emailService';
import { sendSMS } from './smsService';

// Deal blocking configuration - per user requirements
export const DEAL_BLOCKING_CONFIG = {
  BLOCKING_TIMEOUT_MINUTES: 10,           // 10 minutes before escalation
  ESCALATION_RECIPIENTS: [
    'jack@catalystcp.com',               // Updated per user requirement
    'aj@landlinq.ai'
  ],
  MAX_BLOCKING_TIME_HOURS: 24,           // Maximum time to block a deal
  ESCALATION_RETRY_MINUTES: 30           // Retry escalation every 30 minutes
};

interface BlockedDeal {
  dealId: string;
  blockedAt: Date;
  blockedBy: 'system' | 'manual';
  reason: string;
  validationIssues: Array<{
    type: string;
    confidence: number;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  escalated: boolean;
  escalatedAt?: Date;
  timeoutAt: Date;
}

export class DealBlockingService {
  
  /**
   * Block a deal for validation issues with 10-minute timeout
   */
  static async blockDealForValidation(
    dealId: string,
    validationIssues: Array<{
      type: string;
      confidence: number;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>,
    blockedBy: 'system' | 'manual' = 'system'
  ): Promise<void> {
    const now = new Date();
    const timeoutAt = new Date(now.getTime() + DEAL_BLOCKING_CONFIG.BLOCKING_TIMEOUT_MINUTES * 60 * 1000);
    
    console.log(`🛑 Blocking deal ${dealId} for validation issues (${DEAL_BLOCKING_CONFIG.BLOCKING_TIMEOUT_MINUTES}min timeout)`);
    
    try {
      // Update deal status to blocked
      await db
        .update(deals)
        .set({
          validationStatus: 'blocked',
          blockedAt: now,
          blockedBy,
          blockingReason: this.generateBlockingReason(validationIssues),
          validationTimeoutAt: timeoutAt,
          dataQualityIssues: validationIssues,
          updatedAt: now
        })
        .where(eq(deals.id, dealId));

      console.log(`✅ Deal ${dealId} blocked successfully, timeout scheduled for ${timeoutAt.toISOString()}`);
      
      // Schedule escalation check
      this.scheduleEscalationCheck(dealId, timeoutAt);
      
    } catch (error) {
      console.error(`❌ Failed to block deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Check for deals that need escalation due to timeout
   */
  static async checkBlockedDealsForEscalation(): Promise<void> {
    const now = new Date();
    
    try {
      // Find deals that have exceeded blocking timeout but haven't been escalated
      const timedOutDeals = await db
        .select({
          id: deals.id,
          validationStatus: deals.validationStatus,
          validationTimeoutAt: deals.validationTimeoutAt,
          escalatedAt: deals.escalatedAt,
          address: deals.address,
          brokerId: deals.brokerId
        })
        .from(deals)
        .where(
          and(
            eq(deals.validationStatus, 'blocked'),
            lt(deals.validationTimeoutAt, now),
            isNull(deals.escalatedAt)
          )
        );

      console.log(`🔍 Found ${timedOutDeals.length} deals requiring escalation due to timeout`);

      for (const deal of timedOutDeals) {
        await this.escalateBlockedDeal(deal.id, 'timeout');
      }
      
    } catch (error) {
      console.error('❌ Error checking blocked deals for escalation:', error);
    }
  }

  /**
   * Escalate a blocked deal to manual review
   */
  static async escalateBlockedDeal(
    dealId: string,
    escalationReason: 'timeout' | 'manual' | 'critical_issues'
  ): Promise<void> {
    const now = new Date();
    
    console.log(`🚨 Escalating blocked deal ${dealId} (reason: ${escalationReason})`);
    
    try {
      // Update deal with escalation information
      await db
        .update(deals)
        .set({
          validationStatus: 'escalated',
          escalatedAt: now,
          updatedAt: now
        })
        .where(eq(deals.id, dealId));

      // Add to review queue if not already there
      const existingReview = await db
        .select()
        .from(reviewQueue)
        .where(eq(reviewQueue.dealId, dealId))
        .limit(1);

      if (existingReview.length === 0) {
        await db.insert(reviewQueue).values({
          dealId,
          triggerReason: `Deal blocked for validation issues, escalated due to ${escalationReason}`,
          status: 'pending_review',
          priority: this.getPriorityForEscalation(escalationReason),
          targetCompletionDate: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 hours
          escalationReason: `Escalated from deal blocking service: ${escalationReason}`
        });
      }

      // Send escalation notifications
      await this.sendEscalationNotifications(dealId, escalationReason);
      
      console.log(`✅ Deal ${dealId} escalated successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to escalate deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Allow analyst override to unblock deal
   */
  static async analystOverride(
    dealId: string,
    analystEmail: string,
    overrideReason: string,
    forceApproval: boolean = false
  ): Promise<void> {
    const now = new Date();
    
    console.log(`👤 Analyst override for deal ${dealId} by ${analystEmail} (force: ${forceApproval})`);
    
    try {
      const newStatus = forceApproval ? 'force_approved' : 'analyst_override';
      
      await db
        .update(deals)
        .set({
          validationStatus: newStatus,
          analystOverride: true,
          analystOverrideBy: analystEmail,
          analystOverrideAt: now,
          analystOverrideReason: overrideReason,
          forceApproved: forceApproval,
          blockedAt: null,
          validationTimeoutAt: null,
          escalated: false,
          updatedAt: now
        })
        .where(eq(deals.id, dealId));

      // Log the override action for audit trail
      console.log(`✅ Deal ${dealId} ${forceApproval ? 'force approved' : 'override approved'} by ${analystEmail}`);
      console.log(`📝 Override reason: ${overrideReason}`);
      
      // Remove from review queue if present
      await db
        .delete(reviewQueue)
        .where(eq(reviewQueue.dealId, dealId));

      // Send override confirmation
      await this.sendOverrideConfirmation(dealId, analystEmail, overrideReason, forceApproval);
      
    } catch (error) {
      console.error(`❌ Failed to process analyst override for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Generate human-readable blocking reason
   */
  private static generateBlockingReason(
    validationIssues: Array<{
      type: string;
      confidence: number;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>
  ): string {
    const criticalIssues = validationIssues.filter(issue => issue.severity === 'critical');
    const highIssues = validationIssues.filter(issue => issue.severity === 'high');
    
    if (criticalIssues.length > 0) {
      return `Critical validation issues: ${criticalIssues.map(i => i.type).join(', ')}`;
    } else if (highIssues.length > 0) {
      return `High severity validation issues: ${highIssues.map(i => i.type).join(', ')}`;
    } else {
      return `Multiple validation issues detected (${validationIssues.length} total)`;
    }
  }

  /**
   * Get priority level for escalation
   */
  private static getPriorityForEscalation(escalationReason: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (escalationReason) {
      case 'critical_issues':
        return 'critical';
      case 'timeout':
        return 'high';
      case 'manual':
        return 'medium';
      default:
        return 'medium';
    }
  }

  /**
   * Schedule escalation check (in a real system, this would use a job scheduler)
   */
  private static scheduleEscalationCheck(dealId: string, timeoutAt: Date): void {
    const delay = timeoutAt.getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        await this.checkBlockedDealsForEscalation();
      }, delay);
    }
  }

  /**
   * Send escalation notifications
   */
  private static async sendEscalationNotifications(
    dealId: string,
    escalationReason: string
  ): Promise<void> {
    const subject = `🚨 Deal Escalation Required - ${dealId}`;
    const message = `Deal ${dealId} has been escalated for manual review due to: ${escalationReason}. Please review in the analyst dashboard.`;
    
    try {
      // Send email notifications
      console.log(`⚠️ Escalation notifications disabled - no hardcoded emails allowed`);
      // CRITICAL RULE: Zero hardcoded email templates allowed
      
      // Send SMS for critical escalations
      if (escalationReason === 'critical_issues') {
        const smsResult = await sendSMS({ message, to: '+1234567890' }); // Replace with actual phone numbers
        
        if (smsResult.success && smsResult.delivered) {
          console.log(`✅ Critical escalation SMS sent (SID: ${smsResult.sid})`);
        } else if (smsResult.success && !smsResult.delivered) {
          console.log(`⏭️ Critical escalation SMS not delivered - ${smsResult.reason || smsResult.mode}`);
        } else {
          console.log(`❌ Critical escalation SMS failed - ${smsResult.error}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to send escalation notifications:', error);
    }
  }

  /**
   * Send override confirmation
   */
  private static async sendOverrideConfirmation(
    dealId: string,
    analystEmail: string,
    overrideReason: string,
    forceApproval: boolean
  ): Promise<void> {
    const subject = `✅ Deal ${forceApproval ? 'Force Approved' : 'Override Approved'} - ${dealId}`;
    const message = `Deal ${dealId} has been ${forceApproval ? 'force approved' : 'override approved'} by ${analystEmail}.\n\nReason: ${overrideReason}`;
    
    try {
      // Send confirmation to escalation recipients
      for (const recipient of DEAL_BLOCKING_CONFIG.ESCALATION_RECIPIENTS) {
        await sendNotificationEmail({
          to: recipient,
          subject: subject,
          html: message.replace(/\n/g, '<br/>'),
          type: 'status_update',
          priority: 'medium'
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to send override confirmation:', error);
    }
  }

  /**
   * Get blocking status for a deal
   */
  static async getDealBlockingStatus(dealId: string): Promise<{
    isBlocked: boolean;
    blockedAt?: Date;
    timeoutAt?: Date;
    timeRemaining?: number;
    canOverride: boolean;
  }> {
    try {
      const deal = await db
        .select({
          validationStatus: deals.validationStatus,
          blockedAt: deals.blockedAt,
          validationTimeoutAt: deals.validationTimeoutAt,
          analystOverride: deals.analystOverride
        })
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1);

      if (deal.length === 0) {
        return { isBlocked: false, canOverride: false };
      }

      const dealData = deal[0];
      const isBlocked = dealData.validationStatus === 'blocked';
      const timeRemaining = dealData.validationTimeoutAt 
        ? Math.max(0, dealData.validationTimeoutAt.getTime() - Date.now())
        : 0;

      return {
        isBlocked,
        blockedAt: dealData.blockedAt || undefined,
        timeoutAt: dealData.validationTimeoutAt || undefined,
        timeRemaining: timeRemaining > 0 ? timeRemaining : undefined,
        canOverride: isBlocked && !dealData.analystOverride
      };
      
    } catch (error) {
      console.error(`❌ Failed to get blocking status for deal ${dealId}:`, error);
      return { isBlocked: false, canOverride: false };
    }
  }
}

// Escalation checker DISABLED per user requirements
// Alert system monitoring is completely disabled - no automatic deal escalation
// setInterval(() => {
//   DealBlockingService.checkBlockedDealsForEscalation();
// }, 60 * 1000); // Check every minute
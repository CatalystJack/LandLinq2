import { db } from "./db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { outreachSenders, senderDailyStats, outreachMessageEvents, outreachMessages, outreachCampaigns } from "@shared/schema";

export type AuthorizationResult = 
  | { status: 'AUTHORIZED'; remainingQuota: number; nextSendDelay: number }
  | { status: 'THROTTLED'; reason: string; retryAfter: Date }
  | { status: 'PAUSED'; reason: string };

export interface WarmupStageConfig {
  stage: number;
  minDays: number;
  maxDays: number;
  dailyLimit: number;
  healthyDaysRequired: number;
  maxBounceRate: number;
  maxComplaintRate: number;
}

// Microsoft Outlook-optimized warmup schedule
// Designed for gradual reputation building with conservative limits
// Key principles: 
// - Never increase more than 50% per stage
// - Monitor bounce rate (<2% safe, >3% pause)
// - Monitor complaint rate (<0.1% safe, >0.3% pause)
// - Require healthy days before advancing
const WARMUP_STAGES: WarmupStageConfig[] = [
  { stage: 1, minDays: 0, maxDays: 6,   dailyLimit: 25,  healthyDaysRequired: 3, maxBounceRate: 2, maxComplaintRate: 0.1 },  // Week 1: Gentle start
  { stage: 2, minDays: 7, maxDays: 13,  dailyLimit: 40,  healthyDaysRequired: 4, maxBounceRate: 2, maxComplaintRate: 0.1 },  // Week 2: +60%
  { stage: 3, minDays: 14, maxDays: 20, dailyLimit: 60,  healthyDaysRequired: 5, maxBounceRate: 2, maxComplaintRate: 0.1 },  // Week 3: +50%
  { stage: 4, minDays: 21, maxDays: 27, dailyLimit: 80,  healthyDaysRequired: 5, maxBounceRate: 2, maxComplaintRate: 0.1 },  // Week 4: +33%
  { stage: 5, minDays: 28, maxDays: 41, dailyLimit: 100, healthyDaysRequired: 7, maxBounceRate: 2, maxComplaintRate: 0.1 },  // Week 5-6: +25%
  { stage: 6, minDays: 42, maxDays: Infinity, dailyLimit: 150, healthyDaysRequired: 7, maxBounceRate: 2, maxComplaintRate: 0.1 }, // Month 2+: Cruising speed (150/day max)
];

const ACTIVE_HOURS_PER_DAY = 10;
const MIN_SEND_GAP_MS = 90000;
const JITTER_PERCENT = 0.35;

export class OutreachSafeguardService {
  
  async authorizeSend(senderId: string, campaignId?: string): Promise<AuthorizationResult> {
    const logPrefix = `🛡️ [SAFEGUARD]`;
    
    try {
      console.log(`${logPrefix} Checking authorization for sender: ${senderId}`);
      
      const sender = await db.select().from(outreachSenders).where(eq(outreachSenders.id, senderId)).limit(1);
      
      if (!sender.length) {
        console.error(`${logPrefix} ❌ Sender NOT FOUND: ${senderId}`);
        return { status: 'PAUSED', reason: 'Sender not found' };
      }
      
      const senderData = sender[0];
      console.log(`${logPrefix} Sender found: ${senderData.name} (${senderData.email})`);
      console.log(`${logPrefix}   Warmup Stage: ${senderData.warmupStage || 1}`);
      console.log(`${logPrefix}   Active: ${senderData.isActive}, Paused: ${senderData.sendingPaused}`);
      
      if (senderData.sendingPaused) {
        console.log(`${logPrefix} 🛑 PAUSED: ${senderData.pausedReason}`);
        return { status: 'PAUSED', reason: senderData.pausedReason || 'Sending is paused' };
      }
      
      if (!senderData.isActive) {
        console.log(`${logPrefix} 🛑 INACTIVE sender`);
        return { status: 'PAUSED', reason: 'Sender is inactive' };
      }
      
      const dailyLimit = this.getDailyLimit(senderData);
      const todaySent = await this.getTodaysSentCount(senderId);
      
      console.log(`${logPrefix}   Daily limit: ${dailyLimit} (Stage ${senderData.warmupStage || 1})`);
      console.log(`${logPrefix}   Sent today: ${todaySent}/${dailyLimit}`);
      
      if (todaySent >= dailyLimit) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0);
        
        console.log(`${logPrefix} ⏸️ THROTTLED: Daily limit reached (${todaySent}/${dailyLimit})`);
        return { 
          status: 'THROTTLED', 
          reason: `Daily limit of ${dailyLimit} emails reached (${todaySent} sent today)`,
          retryAfter: tomorrow
        };
      }
      
      const isHealthy = await this.checkSenderHealth(senderId);
      console.log(`${logPrefix}   Health check: ${isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
      
      if (!isHealthy) {
        await this.pauseSender(senderId, 'Health check failed - high bounce or complaint rate');
        console.log(`${logPrefix} 🛑 AUTO-PAUSED due to health issues`);
        return { status: 'PAUSED', reason: 'Sender paused due to health issues' };
      }
      
      const remainingQuota = dailyLimit - todaySent;
      const nextSendDelay = this.calculateNextSendDelay(remainingQuota);
      
      console.log(`${logPrefix} ✅ AUTHORIZED - Remaining: ${remainingQuota}, Delay: ${nextSendDelay}ms`);
      
      return {
        status: 'AUTHORIZED',
        remainingQuota,
        nextSendDelay
      };
    } catch (error) {
      console.error(`${logPrefix} ❌ Authorization error:`, error);
      return { status: 'PAUSED', reason: 'Authorization error - defaulting to safe mode' };
    }
  }
  
  getDailyLimit(sender: typeof outreachSenders.$inferSelect): number {
    if (sender.dailyLimitOverride && sender.dailyLimitOverride > 0) {
      return sender.dailyLimitOverride;
    }
    
    const stage = sender.warmupStage || 1;
    const stageConfig = WARMUP_STAGES.find(s => s.stage === stage) || WARMUP_STAGES[0];
    return stageConfig.dailyLimit;
  }
  
  async getTodaysSentCount(senderId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    
    // First, check the sender_daily_stats table (preferred - already aggregated)
    const result = await db.select()
      .from(senderDailyStats)
      .where(and(
        eq(senderDailyStats.senderId, senderId),
        eq(senderDailyStats.date, today)
      ))
      .limit(1);
    
    if (result.length > 0) {
      return result[0].emailsSent || 0;
    }
    
    // Fallback: Count messages for THIS SENDER only (join through campaigns)
    // CRITICAL: Filter by senderId to ensure per-sender rate limiting
    const sentToday = await db.select({ count: sql<number>`count(*)` })
      .from(outreachMessages)
      .innerJoin(outreachCampaigns, eq(outreachMessages.campaignId, outreachCampaigns.id))
      .where(and(
        eq(outreachCampaigns.senderId, senderId),
        sql`${outreachMessages.sentAt}::date = ${today}::date`,
        eq(outreachMessages.status, 'sent'),
        eq(outreachMessages.channel, 'email') // Only count emails for email limits
      ));
    
    return Number(sentToday[0]?.count || 0);
  }
  
  async checkSenderHealth(senderId: string): Promise<boolean> {
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const recentStats = await db.select()
        .from(senderDailyStats)
        .where(and(
          eq(senderDailyStats.senderId, senderId),
          gte(senderDailyStats.date, threeDaysAgo.toISOString().split('T')[0])
        ))
        .orderBy(desc(senderDailyStats.date));
      
      if (recentStats.length === 0) {
        return true;
      }
      
      let totalSent = 0;
      let totalBounced = 0;
      let totalComplained = 0;
      
      for (const day of recentStats) {
        totalSent += day.emailsSent || 0;
        totalBounced += day.emailsBounced || 0;
        totalComplained += day.emailsComplained || 0;
      }
      
      if (totalSent === 0) {
        return true;
      }
      
      const bounceRate = (totalBounced / totalSent) * 100;
      const complaintRate = (totalComplained / totalSent) * 100;
      
      const sender = await db.select().from(outreachSenders).where(eq(outreachSenders.id, senderId)).limit(1);
      const maxBounce = sender[0]?.maxBounceRate ? parseFloat(String(sender[0].maxBounceRate)) : 5;
      const maxComplaint = sender[0]?.maxComplaintRate ? parseFloat(String(sender[0].maxComplaintRate)) : 0.1;
      
      if (bounceRate > maxBounce) {
        console.warn(`[OutreachSafeguard] High bounce rate for sender ${senderId}: ${bounceRate.toFixed(2)}%`);
        return false;
      }
      
      if (complaintRate > maxComplaint) {
        console.warn(`[OutreachSafeguard] High complaint rate for sender ${senderId}: ${complaintRate.toFixed(2)}%`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`[OutreachSafeguard] Error checking sender health:`, error);
      return true;
    }
  }
  
  calculateNextSendDelay(remainingQuota: number): number {
    const remainingHours = this.getRemainingActiveHours();
    if (remainingHours <= 0 || remainingQuota <= 0) {
      return 0;
    }
    
    const baseIntervalMs = (remainingHours * 60 * 60 * 1000) / remainingQuota;
    const jitter = (Math.random() * 2 - 1) * JITTER_PERCENT * baseIntervalMs;
    const delayMs = Math.max(MIN_SEND_GAP_MS, baseIntervalMs + jitter);
    
    return Math.round(delayMs);
  }
  
  getRemainingActiveHours(): number {
    const now = new Date();
    const hour = now.getHours();
    
    const endHour = 18;
    
    if (hour >= endHour) {
      return 0;
    }
    
    const startHour = 8;
    const effectiveStart = Math.max(hour, startHour);
    
    return endHour - effectiveStart;
  }
  
  async pauseSender(senderId: string, reason: string): Promise<void> {
    console.warn(`[OutreachSafeguard] PAUSING sender ${senderId}: ${reason}`);
    
    await db.update(outreachSenders)
      .set({
        sendingPaused: true,
        pausedReason: reason,
        pausedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(outreachSenders.id, senderId));
  }
  
  async unpauseSender(senderId: string): Promise<void> {
    console.log(`[OutreachSafeguard] Unpausing sender ${senderId}`);
    
    await db.update(outreachSenders)
      .set({
        sendingPaused: false,
        pausedReason: null,
        pausedAt: null,
        updatedAt: new Date()
      })
      .where(eq(outreachSenders.id, senderId));
  }
  
  async recordSendOutcome(
    senderId: string, 
    success: boolean, 
    eventType: 'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked' | 'replied' | 'complained',
    channel: 'email' | 'sms' = 'email',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const existing = await db.select()
        .from(senderDailyStats)
        .where(and(
          eq(senderDailyStats.senderId, senderId),
          eq(senderDailyStats.date, today)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(senderDailyStats).values({
          senderId,
          date: today,
          emailsSent: eventType === 'sent' && channel === 'email' ? 1 : 0,
          emailsDelivered: eventType === 'delivered' && channel === 'email' ? 1 : 0,
          emailsBounced: eventType === 'bounced' && channel === 'email' ? 1 : 0,
          emailsOpened: eventType === 'opened' && channel === 'email' ? 1 : 0,
          emailsClicked: eventType === 'clicked' && channel === 'email' ? 1 : 0,
          emailsReplied: eventType === 'replied' && channel === 'email' ? 1 : 0,
          emailsComplained: eventType === 'complained' && channel === 'email' ? 1 : 0,
          smsSent: eventType === 'sent' && channel === 'sms' ? 1 : 0,
          smsDelivered: eventType === 'delivered' && channel === 'sms' ? 1 : 0,
          smsFailed: eventType === 'bounced' && channel === 'sms' ? 1 : 0,
          smsReplied: eventType === 'replied' && channel === 'sms' ? 1 : 0,
        });
      } else {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        
        if (channel === 'email') {
          if (eventType === 'sent') updates.emailsSent = sql`emails_sent + 1`;
          if (eventType === 'delivered') updates.emailsDelivered = sql`emails_delivered + 1`;
          if (eventType === 'bounced') updates.emailsBounced = sql`emails_bounced + 1`;
          if (eventType === 'opened') updates.emailsOpened = sql`emails_opened + 1`;
          if (eventType === 'clicked') updates.emailsClicked = sql`emails_clicked + 1`;
          if (eventType === 'replied') updates.emailsReplied = sql`emails_replied + 1`;
          if (eventType === 'complained') updates.emailsComplained = sql`emails_complained + 1`;
        } else {
          if (eventType === 'sent') updates.smsSent = sql`sms_sent + 1`;
          if (eventType === 'delivered') updates.smsDelivered = sql`sms_delivered + 1`;
          if (eventType === 'bounced') updates.smsFailed = sql`sms_failed + 1`;
          if (eventType === 'replied') updates.smsReplied = sql`sms_replied + 1`;
        }
        
        await db.update(senderDailyStats)
          .set(updates)
          .where(and(
            eq(senderDailyStats.senderId, senderId),
            eq(senderDailyStats.date, today)
          ));
      }
      
      if (eventType === 'bounced' && channel === 'email') {
        const todaysBounces = await db.select()
          .from(senderDailyStats)
          .where(and(
            eq(senderDailyStats.senderId, senderId),
            eq(senderDailyStats.date, today)
          ))
          .limit(1);
        
        const bounces = todaysBounces[0]?.emailsBounced || 0;
        if (bounces >= 3) {
          await this.pauseSender(senderId, `Circuit breaker: ${bounces} bounces today`);
        }
      }
      
    } catch (error) {
      console.error(`[OutreachSafeguard] Error recording send outcome:`, error);
    }
  }
  
  async advanceWarmupStage(senderId: string): Promise<boolean> {
    try {
      const sender = await db.select().from(outreachSenders).where(eq(outreachSenders.id, senderId)).limit(1);
      
      if (!sender.length) return false;
      
      const currentStage = sender[0].warmupStage || 1;
      const consecutiveHealthyDays = sender[0].consecutiveHealthyDays || 0;
      
      const stageConfig = WARMUP_STAGES.find(s => s.stage === currentStage);
      if (!stageConfig) return false;
      
      if (consecutiveHealthyDays >= stageConfig.healthyDaysRequired && currentStage < WARMUP_STAGES.length) {
        await db.update(outreachSenders)
          .set({
            warmupStage: currentStage + 1,
            consecutiveHealthyDays: 0,
            updatedAt: new Date()
          })
          .where(eq(outreachSenders.id, senderId));
        
        console.log(`[OutreachSafeguard] Advanced sender ${senderId} to stage ${currentStage + 1}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`[OutreachSafeguard] Error advancing warmup stage:`, error);
      return false;
    }
  }
  
  async runNightlyHealthCheck(): Promise<void> {
    console.log('[OutreachSafeguard] Running nightly health check...');
    
    try {
      const senders = await db.select().from(outreachSenders).where(eq(outreachSenders.isActive, true));
      
      for (const sender of senders) {
        const isHealthy = await this.checkSenderHealth(sender.id);
        const today = new Date().toISOString().split('T')[0];
        
        if (isHealthy) {
          await db.update(outreachSenders)
            .set({
              consecutiveHealthyDays: (sender.consecutiveHealthyDays || 0) + 1,
              lastHealthCheckDate: today,
              updatedAt: new Date()
            })
            .where(eq(outreachSenders.id, sender.id));
          
          await this.advanceWarmupStage(sender.id);
        } else {
          await db.update(outreachSenders)
            .set({
              consecutiveHealthyDays: 0,
              lastHealthCheckDate: today,
              updatedAt: new Date()
            })
            .where(eq(outreachSenders.id, sender.id));
        }
        
        await this.updateDailyStatsHealth(sender.id);
      }
      
      console.log('[OutreachSafeguard] Nightly health check complete');
    } catch (error) {
      console.error('[OutreachSafeguard] Nightly health check failed:', error);
    }
  }
  
  async updateDailyStatsHealth(senderId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = await db.select()
      .from(senderDailyStats)
      .where(and(
        eq(senderDailyStats.senderId, senderId),
        eq(senderDailyStats.date, today)
      ))
      .limit(1);
    
    if (!stats.length) return;
    
    const stat = stats[0];
    const sent = stat.emailsSent || 0;
    const bounced = stat.emailsBounced || 0;
    const delivered = stat.emailsDelivered || 0;
    const opened = stat.emailsOpened || 0;
    const replied = stat.emailsReplied || 0;
    
    let healthStatus = 'healthy';
    let bounceRate = 0;
    let openRate = 0;
    let replyRate = 0;
    
    if (sent > 0) {
      bounceRate = (bounced / sent) * 100;
      if (bounceRate > 5) healthStatus = 'critical';
      else if (bounceRate > 3) healthStatus = 'warning';
    }
    
    if (delivered > 0) {
      openRate = (opened / delivered) * 100;
      replyRate = (replied / delivered) * 100;
    }
    
    await db.update(senderDailyStats)
      .set({
        bounceRate: String(bounceRate.toFixed(2)),
        openRate: String(openRate.toFixed(2)),
        replyRate: String(replyRate.toFixed(2)),
        healthStatus,
        updatedAt: new Date()
      })
      .where(and(
        eq(senderDailyStats.senderId, senderId),
        eq(senderDailyStats.date, today)
      ));
  }
  
  async getSenderSafeguardStatus(senderId: string): Promise<{
    sender: typeof outreachSenders.$inferSelect | null;
    todayStats: typeof senderDailyStats.$inferSelect | null;
    dailyLimit: number;
    remainingQuota: number;
    warmupStage: WarmupStageConfig;
    healthStatus: string;
  } | null> {
    const sender = await db.select().from(outreachSenders).where(eq(outreachSenders.id, senderId)).limit(1);
    
    if (!sender.length) return null;
    
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await db.select()
      .from(senderDailyStats)
      .where(and(
        eq(senderDailyStats.senderId, senderId),
        eq(senderDailyStats.date, today)
      ))
      .limit(1);
    
    const dailyLimit = this.getDailyLimit(sender[0]);
    const todaySent = await this.getTodaysSentCount(senderId);
    const stageConfig = WARMUP_STAGES.find(s => s.stage === (sender[0].warmupStage || 1)) || WARMUP_STAGES[0];
    
    return {
      sender: sender[0],
      todayStats: todayStats[0] || null,
      dailyLimit,
      remainingQuota: dailyLimit - todaySent,
      warmupStage: stageConfig,
      healthStatus: todayStats[0]?.healthStatus || 'unknown'
    };
  }
}

export const outreachSafeguardService = new OutreachSafeguardService();

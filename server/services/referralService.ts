import { nanoid } from 'nanoid';
import type { DatabaseStorage } from '../storage';
import { 
  referralLinks, 
  referralActivities, 
  commissionSplits, 
  brokerPartnerships,
  referralMetrics,
  type InsertReferralLink,
  type InsertReferralActivity,
  type InsertCommissionSplit,
  type InsertBrokerPartnership,
  type ReferralLink,
  type ReferralActivity,
  type CommissionSplit,
  type BrokerPartnership
} from '@shared/schema';
import { db } from '../db';
import { eq, and, desc, sum, count, gte, lte, sql } from 'drizzle-orm';

export class ReferralService {
  constructor(private storage: DatabaseStorage) {}

  // ==================================================
  // REFERRAL LINK GENERATION
  // ==================================================

  /**
   * Generate a unique referral link for a broker
   */
  async generateReferralLink(
    brokerId: string, 
    linkType: 'signup' | 'deal_share' | 'partner_invite',
    metadata?: Record<string, any>,
    expiresAt?: Date
  ): Promise<ReferralLink> {
    const referralCode = this.generateUniqueCode();
    
    const linkData: InsertReferralLink = {
      brokerId,
      referralCode,
      linkType,
      isActive: true,
      expiresAt,
      metadata,
    };

    const [link] = await db.insert(referralLinks).values(linkData).returning();
    return link;
  }

  /**
   * Generate unique 8-character referral code
   */
  private generateUniqueCode(): string {
    return nanoid(8).toUpperCase();
  }

  /**
   * Get all referral links for a broker
   */
  async getBrokerReferralLinks(brokerId: string): Promise<ReferralLink[]> {
    return await db
      .select()
      .from(referralLinks)
      .where(eq(referralLinks.brokerId, brokerId))
      .orderBy(desc(referralLinks.createdAt));
  }

  /**
   * Track referral link click
   */
  async trackReferralClick(
    referralCode: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const [link] = await db
      .select()
      .from(referralLinks)
      .where(eq(referralLinks.referralCode, referralCode));

    if (!link || !link.isActive) {
      throw new Error('Invalid or inactive referral link');
    }

    // Check if link has expired
    if (link.expiresAt && new Date() > link.expiresAt) {
      throw new Error('Referral link has expired');
    }

    // Increment click count
    await db
      .update(referralLinks)
      .set({ 
        clickCount: sql`${referralLinks.clickCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(referralLinks.id, link.id));

    // Track activity
    await this.trackReferralActivity({
      referralLinkId: link.id,
      referrerBrokerId: link.brokerId,
      activityType: 'click',
      ipAddress,
      userAgent,
    });
  }

  // ==================================================
  // REFERRAL ACTIVITY TRACKING
  // ==================================================

  /**
   * Track any referral activity
   */
  async trackReferralActivity(activityData: InsertReferralActivity): Promise<ReferralActivity> {
    const [activity] = await db.insert(referralActivities).values(activityData).returning();
    return activity;
  }

  /**
   * Track successful referral conversion
   */
  async trackReferralConversion(
    referralCode: string,
    conversionType: 'signup' | 'deal_submit' | 'commission_earned',
    referredUserId?: string,
    referredBrokerId?: string,
    dealId?: string,
    conversionValue?: number
  ): Promise<void> {
    const [link] = await db
      .select()
      .from(referralLinks)
      .where(eq(referralLinks.referralCode, referralCode));

    if (!link) {
      throw new Error('Referral link not found');
    }

    // Increment conversion count
    await db
      .update(referralLinks)
      .set({ 
        conversionCount: sql`${referralLinks.conversionCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(referralLinks.id, link.id));

    // Track conversion activity
    await this.trackReferralActivity({
      referralLinkId: link.id,
      referrerBrokerId: link.brokerId,
      activityType: conversionType,
      referredUserId,
      referredBrokerId,
      dealId,
      conversionValue: conversionValue?.toString(),
    });

    // Update broker referral stats
    await this.updateBrokerReferralStats(link.brokerId);
  }

  // ==================================================
  // COMMISSION SPLITTING
  // ==================================================

  /**
   * Calculate and create commission split for a deal
   */
  async createCommissionSplit(
    dealId: string,
    primaryBrokerId: string,
    totalCommission: number,
    referrerBrokerId?: string,
    splitType: 'referral' | 'partnership' | 'finder_fee' = 'referral',
    customSplitPercentage?: number
  ): Promise<CommissionSplit> {
    let referrerShare = 0;
    let splitPercentage = 0;

    if (referrerBrokerId) {
      // Get partnership details if exists
      const partnership = await this.getBrokerPartnership(primaryBrokerId, referrerBrokerId);
      
      if (partnership) {
        splitPercentage = parseFloat(partnership.commissionSplitPercentage || '10');
      } else {
        // Default split percentages by type
        const defaultSplits = {
          referral: 10, // 10% for referrals
          partnership: 15, // 15% for partnerships
          finder_fee: 5, // 5% for finder fees
        };
        splitPercentage = customSplitPercentage || defaultSplits[splitType];
      }

      referrerShare = (totalCommission * splitPercentage) / 100;
    }

    const primaryBrokerShare = totalCommission - referrerShare;
    const platformFee = totalCommission * 0.02; // 2% platform fee

    const splitData: InsertCommissionSplit = {
      dealId,
      primaryBrokerId,
      referrerBrokerId,
      totalCommission: totalCommission.toString(),
      primaryBrokerShare: primaryBrokerShare.toString(),
      referrerShare: referrerShare.toString(),
      platformFee: platformFee.toString(),
      splitType,
      splitPercentage: splitPercentage.toString(),
      status: 'pending',
    };

    const [split] = await db.insert(commissionSplits).values(splitData).returning();

    // Update partnership stats if applicable
    if (referrerBrokerId && referrerShare > 0) {
      await this.updatePartnershipStats(primaryBrokerId, referrerBrokerId, referrerShare);
    }

    return split;
  }

  /**
   * Get commission splits for a broker
   */
  async getBrokerCommissionSplits(brokerId: string, status?: string): Promise<CommissionSplit[]> {
    let query = db
      .select()
      .from(commissionSplits)
      .where(
        sql`${commissionSplits.primaryBrokerId} = ${brokerId} OR ${commissionSplits.referrerBrokerId} = ${brokerId}`
      );

    if (status) {
      query = query.where(eq(commissionSplits.status, status));
    }

    return await query.orderBy(desc(commissionSplits.createdAt));
  }

  /**
   * Update commission split status
   */
  async updateCommissionSplitStatus(
    splitId: string,
    status: 'pending' | 'approved' | 'paid' | 'disputed',
    notes?: string
  ): Promise<void> {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === 'paid') {
      updateData.paidAt = new Date();
    }
    
    if (notes) {
      updateData.notes = notes;
    }

    await db
      .update(commissionSplits)
      .set(updateData)
      .where(eq(commissionSplits.id, splitId));
  }

  // ==================================================
  // BROKER PARTNERSHIPS
  // ==================================================

  /**
   * Create or update broker partnership
   */
  async createBrokerPartnership(
    brokerAId: string,
    brokerBId: string,
    partnershipType: 'referral_partner' | 'co_broker' | 'preferred_partner',
    commissionSplitPercentage: number = 10,
    notes?: string
  ): Promise<BrokerPartnership> {
    // Check if partnership already exists
    const existing = await this.getBrokerPartnership(brokerAId, brokerBId);
    
    if (existing) {
      // Update existing partnership
      const [updated] = await db
        .update(brokerPartnerships)
        .set({
          partnershipType,
          commissionSplitPercentage: commissionSplitPercentage.toString(),
          notes,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(brokerPartnerships.id, existing.id))
        .returning();
      
      return updated;
    }

    // Create new partnership
    const partnershipData: InsertBrokerPartnership = {
      brokerAId,
      brokerBId,
      partnershipType,
      commissionSplitPercentage: commissionSplitPercentage.toString(),
      notes,
    };

    const [partnership] = await db.insert(brokerPartnerships).values(partnershipData).returning();
    return partnership;
  }

  /**
   * Get partnership between two brokers
   */
  async getBrokerPartnership(brokerAId: string, brokerBId: string): Promise<BrokerPartnership | null> {
    const [partnership] = await db
      .select()
      .from(brokerPartnerships)
      .where(
        sql`(${brokerPartnerships.brokerAId} = ${brokerAId} AND ${brokerPartnerships.brokerBId} = ${brokerBId}) OR 
            (${brokerPartnerships.brokerAId} = ${brokerBId} AND ${brokerPartnerships.brokerBId} = ${brokerAId})`
      );

    return partnership || null;
  }

  /**
   * Get all partnerships for a broker
   */
  async getBrokerPartnerships(brokerId: string): Promise<BrokerPartnership[]> {
    return await db
      .select()
      .from(brokerPartnerships)
      .where(
        sql`${brokerPartnerships.brokerAId} = ${brokerId} OR ${brokerPartnerships.brokerBId} = ${brokerId}`
      )
      .orderBy(desc(brokerPartnerships.lastActivityAt));
  }

  /**
   * Update partnership statistics
   */
  private async updatePartnershipStats(
    brokerAId: string,
    brokerBId: string,
    commissionAmount: number
  ): Promise<void> {
    const partnership = await this.getBrokerPartnership(brokerAId, brokerBId);
    
    if (partnership) {
      await db
        .update(brokerPartnerships)
        .set({
          totalDealsShared: sql`${brokerPartnerships.totalDealsShared} + 1`,
          totalCommissionShared: sql`${brokerPartnerships.totalCommissionShared} + ${commissionAmount}`,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(brokerPartnerships.id, partnership.id));
    }
  }

  // ==================================================
  // REFERRAL ANALYTICS
  // ==================================================

  /**
   * Get referral performance metrics for a broker
   */
  async getBrokerReferralMetrics(brokerId: string, startDate?: Date, endDate?: Date): Promise<any> {
    let query = db
      .select({
        totalReferrals: count(referralActivities.id),
        successfulReferrals: count(sql`CASE WHEN ${referralActivities.activityType} IN ('signup', 'deal_submit') THEN 1 END`),
        totalCommissionEarned: sum(sql`CAST(${referralActivities.conversionValue} AS DECIMAL)`),
        totalClicks: count(sql`CASE WHEN ${referralActivities.activityType} = 'click' THEN 1 END`),
      })
      .from(referralActivities)
      .where(eq(referralActivities.referrerBrokerId, brokerId));

    if (startDate) {
      query = query.where(gte(referralActivities.createdAt, startDate));
    }
    
    if (endDate) {
      query = query.where(lte(referralActivities.createdAt, endDate));
    }

    const [metrics] = await query;

    // Calculate conversion rate
    const totalClicks = parseInt(metrics.totalClicks?.toString() || '0');
    const successfulReferrals = parseInt(metrics.successfulReferrals?.toString() || '0');
    const conversionRate = totalClicks > 0 ? (successfulReferrals / totalClicks) * 100 : 0;

    return {
      ...metrics,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
    };
  }

  /**
   * Update broker referral statistics
   */
  private async updateBrokerReferralStats(brokerId: string): Promise<void> {
    // This could be expanded to update daily/monthly metrics
    // For now, we'll update the broker's viral signup count
    await this.storage.updateBroker(brokerId, {
      viralSignupsGenerated: sql`viral_signups_generated + 1`,
      lastActivityDate: new Date(),
    } as any);
  }

  /**
   * Get top performing referral brokers
   */
  async getTopReferralBrokers(limit: number = 10): Promise<any[]> {
    return await db
      .select({
        brokerId: referralActivities.referrerBrokerId,
        totalReferrals: count(referralActivities.id),
        successfulReferrals: count(sql`CASE WHEN ${referralActivities.activityType} IN ('signup', 'deal_submit') THEN 1 END`),
        totalCommissionEarned: sum(sql`CAST(${referralActivities.conversionValue} AS DECIMAL)`),
      })
      .from(referralActivities)
      .groupBy(referralActivities.referrerBrokerId)
      .orderBy(desc(sql`COUNT(${referralActivities.id})`))
      .limit(limit);
  }

  // ==================================================
  // UTILITY METHODS
  // ==================================================

  /**
   * Generate shareable referral URL
   */
  generateReferralUrl(referralCode: string, baseUrl: string = 'https://landlinq.ai'): string {
    return `${baseUrl}/signup?ref=${referralCode}`;
  }

  /**
   * Validate referral code format
   */
  isValidReferralCode(code: string): boolean {
    return /^[A-Z0-9]{8}$/.test(code);
  }

  /**
   * Get referral link by code
   */
  async getReferralLinkByCode(referralCode: string): Promise<ReferralLink | null> {
    const [link] = await db
      .select()
      .from(referralLinks)
      .where(eq(referralLinks.referralCode, referralCode));

    return link || null;
  }
}
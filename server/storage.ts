import {
  users,
  brokers,
  deals,
  communications,
  analytics,
  acquisitionCriteria,
  passwordResetTokens,
  dealTags,
  viralSignups,
  brokerPoints,
  valuations,
  valuationShares,
  preferredPartners,
  partnershipInvitations,
  commissionEarnings,
  referralLinks,
  referralActivities,
  commissionSplits,
  brokerPartnerships,
  referralMetrics,
  brandSettings,
  businessSettings,
  propertyData,
  publicListingSearches,
  partnerDevelopers,
  // Additional tables for cascading deletes
  sitePlans,
  marketAnalysis,
  dataQualitySnapshots,
  dataQualityAlerts,
  dealValidationHistory,
  reviewQueue,
  reviewAssignments,
  reviewActions,
  reviewCorrections,
  reviewEscalations,
  publicListingSources,
  publicListingMatches,
  propertyComments,
  apiHealthMetrics,
  apiDataSources,
  // Outreach system tables
  outreachCampaigns,
  outreachRuns,
  outreachMessages,
  // Email deduplication table
  processedEmails,
  // SMS deduplication table
  processedSMS,
  // Background jobs table
  backgroundJobs,
  // Gamification tables
  brokerRewards,
  brokerAchievements,
  platformShares,
  // Messaging system tables
  conversations,
  conversationMessages,
  // Site evaluations table
  siteEvaluations,
  type User,
  type InsertUser,
  type UpsertUser,
  type InsertBroker,
  type Broker,
  type InsertDeal,
  type Deal,
  type PropertyData,
  type InsertPropertyData,
  type InsertCommunication,
  type Communication,
  type Analytics,
  type AcquisitionCriteria,
  type InsertAcquisitionCriteria,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type DealTag,
  type InsertDealTag,
  type ViralSignup,
  type InsertViralSignup,
  type Valuation,
  type InsertValuation,
  type ValuationShare,
  type InsertValuationShare,
  type PreferredPartner,
  type InsertPreferredPartner,
  type PartnershipInvitation,
  type InsertPartnershipInvitation,
  type CommissionEarning,
  type InsertCommissionEarning,
  type ReferralLink,
  type InsertReferralLink,
  type ReferralActivity,
  type InsertReferralActivity,
  type CommissionSplit,
  type InsertCommissionSplit,
  type BrokerPartnership,
  type InsertBrokerPartnership,
  type ReferralMetrics,
  type InsertReferralMetrics,
  type BrandSettings,
  type InsertBrandSettings,
  type BusinessSettings,
  type InsertBusinessSettings,
  type PublicListingSearch,
  type InsertPublicListingSearch,
  type PublicListingSource,
  type InsertPublicListingSource,
  type PartnerDeveloper,
  type InsertPartnerDeveloper,
  offMarketImports,
  offMarketProperties,
  type OffMarketImport,
  type InsertOffMarketImport,
  type OffMarketProperty,
  type InsertOffMarketProperty,
  // Outreach system types
  type OutreachCampaign,
  type InsertOutreachCampaign,
  type OutreachRun,
  type InsertOutreachRun,
  type OutreachMessage,
  type InsertOutreachMessage,
  type ProcessedEmail,
  type InsertProcessedEmail,
  type ProcessedSMS,
  type InsertProcessedSMS,
  type BackgroundJob,
  type InsertBackgroundJob,
  // Messaging system types
  type Conversation,
  type InsertConversation,
  type ConversationMessage,
  type InsertConversationMessage,
  // Site evaluation types
  type SiteEvaluation,
  type InsertSiteEvaluation,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, avg, sum, and, or, like, sql, isNull, isNotNull, inArray, gte, lte } from "drizzle-orm";

// Utility function to format deal numbers as 001, 002, etc.
export function formatDealNumber(dealNumber: number): string {
  return dealNumber.toString().padStart(3, '0');
}

// Utility function to add formatted deal ID to deal objects
export function addFormattedDealId(deal: any): any {
  return {
    ...deal,
    formattedDealId: deal.dealNumber ? formatDealNumber(deal.dealNumber) : null
  };
}

export interface IStorage {
  // User operations 
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getCatalystTeamMembers(): Promise<User[]>;
  getAllTeamMembers(): Promise<string[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  getUsersByRoles(roles: string[]): Promise<User[]>;
  getUsersByDealRole(dealRole: string): Promise<User[]>;
  getUsersByDealRoles(dealRoles: string[]): Promise<User[]>;
  
  // PropertyData operations
  getPropertyDataByDealId(dealId: string): Promise<PropertyData | undefined>;
  createPropertyData(data: InsertPropertyData): Promise<PropertyData>;
  updatePropertyData(id: string, updates: Partial<PropertyData>): Promise<PropertyData | undefined>;
  deleteUser(id: string): Promise<void>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Broker operations
  createBroker(broker: InsertBroker): Promise<Broker>;
  createBrokerWithUserId(broker: InsertBroker & { userId: string }): Promise<Broker>;
  getBrokerByEmail(email: string): Promise<Broker | undefined>;
  getBrokerByPhone(phone: string): Promise<Broker | undefined>;
  getBrokerByUserId(userId: string): Promise<Broker | undefined>;
  findOrCreateBroker(data: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    brokerage?: string;
    marketsCovered?: string[];
    smsConsent?: boolean;
    smsOptIn?: boolean;
  }): Promise<{ broker: Broker; isNew: boolean; wasUpdated: boolean }>;
  getBrokerById(id: string): Promise<Broker | undefined>;
  getAllBrokers(): Promise<Broker[]>;
  updateBroker(id: string, updates: Partial<Broker>): Promise<Broker>;
  deleteBroker(id: string): Promise<void>;
  mergeBrokers(sourceBrokerId: string, targetBrokerId: string): Promise<{ mergedDeals: number; mergedConversations: number; mergedCommunications: number }>;
  findDuplicateBrokersByPhone(): Promise<Array<{ normalizedPhone: string; brokerIds: string[]; count: number }>>;
  deduplicateAllBrokers(): Promise<{ groupsMerged: number; brokersRemoved: number; totalDeals: number; totalCommunications: number }>;
  deduplicateByEmail(): Promise<{ groupsMerged: number; brokersRemoved: number; dealsTransferred: number; commsTransferred: number }>;

  // Deal operations
  createDeal(deal: InsertDeal): Promise<Deal>;
  getDealById(id: string): Promise<Deal | undefined>;
  getDealsByBrokerId(brokerId: string): Promise<Deal[]>;
  getAllDeals(): Promise<Deal[]>;
  updateDeal(id: string, updates: Partial<Deal>): Promise<Deal>;
  deleteDeal(id: string): Promise<void>;
  getRecentDealsByEmail(email: string): Promise<Deal[]>;
  bulkDeleteDeals(dealIds: string[]): Promise<{
    successCount: number;
    errorCount: number;
    results: Array<{id: string; success: boolean; error?: string}>;
  }>;
  getDealsWithBrokers(): Promise<(Deal & { broker: Broker })[]>;
  getDealsWithBrokersPaginated(params: {
    offset: number;
    limit: number;
    search?: string;
    classification?: string;
  }): Promise<{ deals: (Deal & { broker: Broker })[]; total: number }>;
  getAllDealsWithBrokers(): Promise<(Deal & { broker: Broker })[]>;
  getUnassignedDeals(): Promise<Deal[]>;
  getDealsAssignedToTeamMember(userId: string): Promise<Deal[]>;
  
  // Communication operations
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  updateCommunication(id: string, updates: Partial<Communication>): Promise<Communication | undefined>;
  getCommunicationsByBrokerId(brokerId: string): Promise<Communication[]>;
  getCommunicationsByDealId(dealId: string): Promise<Communication[]>;
  getRecentCommunications(limit?: number): Promise<(Communication & { broker?: Broker | null })[]>;
  getRecentCommunicationsByDeal(dealId: string, since: Date): Promise<Communication[]>;
  getCommunicationByProviderMessageId(providerMessageId: string): Promise<Communication | undefined>;
  getCommunicationsByThreadKey(threadKey: string): Promise<Communication[]>;
  
  // Messaging dashboard operations (two-way SMS conversations)
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversationById(id: string): Promise<Conversation | undefined>;
  getConversationByBrokerId(brokerId: string): Promise<Conversation | undefined>;
  getAllConversations(): Promise<(Conversation & { broker: Broker })[]>;
  getActiveConversations(): Promise<(Conversation & { broker: Broker })[]>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  updateConversationMessage(id: string, updates: Partial<ConversationMessage>): Promise<ConversationMessage | undefined>;
  getMessageByTwilioSid(twilioMessageSid: string): Promise<ConversationMessage | undefined>;
  deleteConversationMessage(id: string): Promise<boolean>;
  deleteConversation(id: string): Promise<boolean>;
  
  // Analytics operations
  getAnalytics(): Promise<Analytics | undefined>;
  updateAnalytics(): Promise<void>;
  
  // Acquisition criteria operations
  getAllAcquisitionCriteria(): Promise<AcquisitionCriteria[]>;
  getAcquisitionCriteria(id: string): Promise<AcquisitionCriteria | undefined>;
  createAcquisitionCriteria(criteria: InsertAcquisitionCriteria): Promise<AcquisitionCriteria>;
  updateAcquisitionCriteria(id: string, updates: Partial<AcquisitionCriteria>): Promise<AcquisitionCriteria | undefined>;
  deleteAcquisitionCriteria(id: string): Promise<void>;
  
  // Password reset operations
  createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  
  // Deal tagging and viral loop operations
  createDealTag(dealTag: InsertDealTag): Promise<DealTag>;
  getDealTagsByDealId(dealId: string): Promise<DealTag[]>;
  getDealTagsByBrokerId(brokerId: string): Promise<DealTag[]>;
  updateDealTag(id: string, updates: Partial<DealTag>): Promise<DealTag | undefined>;
  createViralSignup(viralSignup: InsertViralSignup): Promise<ViralSignup>;
  
  // Valuation operations
  createValuation(valuation: InsertValuation): Promise<Valuation>;
  getValuationById(id: string): Promise<Valuation | undefined>;
  getValuationsByBrokerId(brokerId: string): Promise<Valuation[]>;
  updateValuation(id: string, updates: Partial<Valuation>): Promise<Valuation | undefined>;
  
  // Valuation sharing operations
  createValuationShare(share: InsertValuationShare): Promise<ValuationShare>;
  getValuationSharesByValuationId(valuationId: string): Promise<ValuationShare[]>;
  getValuationSharesByBrokerId(brokerId: string): Promise<ValuationShare[]>;
  updateValuationShare(id: string, updates: Partial<ValuationShare>): Promise<ValuationShare | undefined>;
  
  // Preferred partner operations
  createPreferredPartner(partner: InsertPreferredPartner): Promise<PreferredPartner>;
  getPreferredPartnersByBrokerId(brokerId: string): Promise<PreferredPartner[]>;
  getPreferredPartnersForBroker(brokerId: string): Promise<PreferredPartner[]>;
  updatePreferredPartner(id: string, updates: Partial<PreferredPartner>): Promise<PreferredPartner | undefined>;
  
  // Partnership invitation operations
  createPartnershipInvitation(invitation: InsertPartnershipInvitation): Promise<PartnershipInvitation>;
  getPartnershipInvitationsByBrokerId(brokerId: string): Promise<PartnershipInvitation[]>;
  getPartnershipInvitationsByEmail(email: string): Promise<PartnershipInvitation[]>;
  updatePartnershipInvitation(id: string, updates: Partial<PartnershipInvitation>): Promise<PartnershipInvitation | undefined>;
  
  // Commission earnings operations
  createCommissionEarning(earning: InsertCommissionEarning): Promise<CommissionEarning>;
  getCommissionEarningsByBrokerId(brokerId: string): Promise<CommissionEarning[]>;
  getCommissionLeaderboard(limit?: number): Promise<Array<{ brokerId: string; brokerName: string; totalCommissions: number; dealCount: number; lastEarning: Date | null; }>>;
  updateCommissionEarning(id: string, updates: Partial<CommissionEarning>): Promise<CommissionEarning | undefined>;
  

  // Referral system operations
  createReferralLink(link: InsertReferralLink): Promise<ReferralLink>;
  getReferralLinkById(id: string): Promise<ReferralLink | undefined>;
  getReferralLinkByCode(code: string): Promise<ReferralLink | undefined>;
  getBrokerReferralLinks(brokerId: string): Promise<ReferralLink[]>;
  updateReferralLink(id: string, updates: Partial<ReferralLink>): Promise<ReferralLink | undefined>;

  createReferralActivity(activity: InsertReferralActivity): Promise<ReferralActivity>;
  getReferralActivitiesByBroker(brokerId: string): Promise<ReferralActivity[]>;

  createCommissionSplit(split: InsertCommissionSplit): Promise<CommissionSplit>;
  getCommissionSplitsByBroker(brokerId: string): Promise<CommissionSplit[]>;
  updateCommissionSplit(id: string, updates: Partial<CommissionSplit>): Promise<CommissionSplit | undefined>;

  createBrokerPartnership(partnership: InsertBrokerPartnership): Promise<BrokerPartnership>;
  getBrokerPartnerships(brokerId: string): Promise<BrokerPartnership[]>;
  updateBrokerPartnership(id: string, updates: Partial<BrokerPartnership>): Promise<BrokerPartnership | undefined>;

  // Brand settings operations
  getBrandSettings(): Promise<BrandSettings | undefined>;
  createBrandSettings(settings: InsertBrandSettings): Promise<BrandSettings>;
  updateBrandSettings(id: string, settings: Partial<InsertBrandSettings>): Promise<BrandSettings>;
  getActiveBrandSettings(): Promise<BrandSettings | undefined>;

  // Business settings operations (simplified template system)
  getBusinessSettings(): Promise<BusinessSettings>;
  updateBusinessSettings(settings: Partial<BusinessSettings>): Promise<BusinessSettings>;
  updateBusinessSettingsField(field: string, value: any): Promise<void>;
  
  // Notification template operations
  getNotificationTemplate(type: string): Promise<any>;

  // Public listing search operations
  getLatestPublicListingSearchByDealId(dealId: string): Promise<PublicListingSearch | undefined>;
  
  // Public listing source operations
  getPublicListingSourceByName(name: string): Promise<PublicListingSource | undefined>;
  createPublicListingSource(source: InsertPublicListingSource): Promise<PublicListingSource>;
  updatePublicListingSourceMetrics(name: string, updates: Partial<PublicListingSource>): Promise<PublicListingSource | undefined>;

  // Outreach system operations
  // Sender operations
  getOutreachSenderById(id: string): Promise<{ id: string; name: string; email: string; signatureHtml?: string } | undefined>;
  
  // Campaign operations
  createOutreachCampaign(campaign: InsertOutreachCampaign): Promise<OutreachCampaign>;
  getOutreachCampaignById(id: string): Promise<OutreachCampaign | undefined>;
  getAllOutreachCampaigns(): Promise<OutreachCampaign[]>;
  getActiveOutreachCampaigns(): Promise<OutreachCampaign[]>;
  getDueOutreachCampaigns(): Promise<OutreachCampaign[]>;
  updateOutreachCampaign(id: string, updates: Partial<OutreachCampaign>): Promise<OutreachCampaign | undefined>;
  deleteOutreachCampaign(id: string): Promise<void>;

  // Campaign run operations
  createOutreachRun(run: InsertOutreachRun): Promise<OutreachRun>;
  getOutreachRunById(id: string): Promise<OutreachRun | undefined>;
  getOutreachRunsByCampaignId(campaignId: string): Promise<OutreachRun[]>;
  getAllOutreachRunsPaginated(params: { offset: number; limit: number }): Promise<{ runs: OutreachRun[]; total: number }>;
  updateOutreachRun(id: string, updates: Partial<OutreachRun>): Promise<OutreachRun | undefined>;

  // Message operations
  createOutreachMessage(message: InsertOutreachMessage): Promise<OutreachMessage>;
  getOutreachMessageById(id: string): Promise<OutreachMessage | undefined>;
  getOutreachMessagesByRunId(runId: string): Promise<OutreachMessage[]>;
  getOutreachMessagesByCampaignId(campaignId: string): Promise<OutreachMessage[]>;
  getAllOutreachMessagesPaginated(params: { offset: number; limit: number }): Promise<{ messages: OutreachMessage[]; total: number }>;
  updateOutreachMessage(id: string, updates: Partial<OutreachMessage>): Promise<OutreachMessage | undefined>;
  
  // Deduplication helper - check if message already exists for period
  checkMessageExists(campaignId: string, brokerId: string, channel: string, periodKey: string): Promise<boolean>;
  
  // Get eligible brokers for outreach (active, with contact preferences)
  getEligibleBrokersForOutreach(brokerFilter: any): Promise<Broker[]>;

  // Email deduplication operations - Permanent storage to prevent SendGrid replays
  checkEmailProcessed(emailHash: string): Promise<ProcessedEmail | undefined>;
  markEmailProcessed(email: InsertProcessedEmail): Promise<ProcessedEmail>;

  // SMS deduplication operations - Permanent storage to prevent Twilio webhook retries
  checkSMSProcessed(messageSid: string): Promise<ProcessedSMS | undefined>;
  markSMSProcessed(sms: InsertProcessedSMS): Promise<ProcessedSMS | null>;

  // Background job operations - Async processing to prevent webhook timeouts
  createBackgroundJob(job: InsertBackgroundJob): Promise<BackgroundJob>;
  getBackgroundJobById(id: string): Promise<BackgroundJob | undefined>;
  getPendingJobs(limit?: number): Promise<BackgroundJob[]>;
  updateBackgroundJob(id: string, updates: Partial<BackgroundJob>): Promise<BackgroundJob | undefined>;

  // Site evaluation operations - LIHTC scoring storage
  createSiteEvaluation(evaluation: InsertSiteEvaluation): Promise<SiteEvaluation>;
  getSiteEvaluationById(id: string): Promise<SiteEvaluation | undefined>;
  getSiteEvaluationByDealId(dealId: string): Promise<SiteEvaluation | undefined>;
  getAllSiteEvaluations(): Promise<SiteEvaluation[]>;
  getSiteEvaluationsSummary(): Promise<Array<{ dealId: string | null; address: string; scoreTotal: number | null; evaluatedAt: Date | null }>>;
  updateSiteEvaluation(id: string, updates: Partial<SiteEvaluation>): Promise<SiteEvaluation | undefined>;

  // Partner Developer Network
  createPartnerDeveloper(data: InsertPartnerDeveloper): Promise<PartnerDeveloper>;
  getAllPartnerDevelopers(): Promise<PartnerDeveloper[]>;
  getActivePartnerDevelopers(): Promise<PartnerDeveloper[]>;

  // Off-Market Sourcing
  createOffMarketImport(data: InsertOffMarketImport): Promise<OffMarketImport>;
  getAllOffMarketImports(): Promise<OffMarketImport[]>;
  deleteOffMarketImport(id: string): Promise<void>;
  insertOffMarketProperties(rows: InsertOffMarketProperty[]): Promise<void>;
  getOffMarketProperties(filters: {
    importId?: string;
    county?: string;
    band?: string;
    ownerType?: string;
    isAbsentee?: boolean;
    isOutOfState?: boolean;
    permitType?: string;
    search?: string;
    minScore?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: OffMarketProperty[]; total: number }>;
  getOffMarketCounties(): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = email?.toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async updateBrokerFromUser(userId: string, updates: { phone?: string | null; marketsCovered?: string[]; brokerage?: string | null }): Promise<void> {
    // Find existing broker by userId
    const [existingBroker] = await db.select().from(brokers).where(eq(brokers.userId, userId)).limit(1);

    if (existingBroker) {
      // Only update fields that are explicitly provided (not undefined)
      const brokerUpdates: any = {
        updatedAt: new Date(),
      };
      if (updates.phone !== undefined) brokerUpdates.phone = updates.phone;
      if (updates.marketsCovered !== undefined) brokerUpdates.marketsCovered = updates.marketsCovered;
      if (updates.brokerage !== undefined) brokerUpdates.brokerage = updates.brokerage;

      // Only perform update if there are fields to update
      if (Object.keys(brokerUpdates).length > 1) {
        await db.update(brokers)
          .set(brokerUpdates)
          .where(eq(brokers.id, existingBroker.id));
        console.log(`✅ [BROKER-SYNC] Updated broker profile for userId: ${userId}`, { updates: Object.keys(brokerUpdates) });
      }
    } else {
      // Broker doesn't exist - create one with user's actual data
      const user = await this.getUser(userId);
      if (user && user.firstName && user.lastName) {
        const brokerData = {
          userId: userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email || '',
          phone: updates.phone ?? null,
          marketsCovered: updates.marketsCovered ?? [],
          brokerage: updates.brokerage ?? null,
          isActive: true,
        };
        await db.insert(brokers).values(brokerData);
        console.log(`✅ [BROKER-SYNC] Created broker profile for userId: ${userId}`);
      } else {
        console.error(`❌ [BROKER-SYNC] Cannot create broker - user missing required fields:`, { userId, user });
      }
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      console.log('Starting comprehensive cascade delete for user:', id);
      
      // Get broker record if exists
      const broker = await db.select().from(brokers).where(eq(brokers.userId, id)).limit(1);
      if (broker.length > 0) {
        const brokerId = broker[0].id;
        console.log('Found broker record for user:', { userId: id, brokerId });
        
        // STEP 1: Find or create system "unassigned" broker for deal reassignment
        let systemBroker = await db.select().from(brokers).where(eq(brokers.email, 'system@catalystcp.com')).limit(1);
        if (systemBroker.length === 0) {
          console.log('Creating system broker for orphaned deals');
          const [newSystemBroker] = await db.insert(brokers).values({
            email: 'system@catalystcp.com',
            firstName: 'System',
            lastName: 'Unassigned',
            phone: null,
            userId: null,
            targetMarkets: [],
            productTypes: [],
            companyName: 'Catalyst Capital Partners',
            prefersSms: false,
            smsOptInStatus: 'opted_out'
          }).returning();
          systemBroker = [newSystemBroker];
        }
        const systemBrokerId = systemBroker[0].id;
        console.log('System broker ready:', systemBrokerId);
        
        // STEP 2: Reassign deals to system broker (preserves business data)
        const brokerDeals = await db.select().from(deals).where(eq(deals.brokerId, brokerId));
        if (brokerDeals.length > 0) {
          console.log(`Reassigning ${brokerDeals.length} deals to system broker`);
          await db.update(deals).set({ brokerId: systemBrokerId }).where(eq(deals.brokerId, brokerId));
          console.log('Deals reassigned successfully');
        }
        
        // STEP 3: Delete child dependencies first (tables that reference broker-owned tables)
        
        // 3a. Delete valuation shares (references valuations)
        const brokerValuations = await db.select({ id: valuations.id }).from(valuations).where(eq(valuations.brokerId, brokerId));
        const valuationIds = brokerValuations.map(v => v.id);
        if (valuationIds.length > 0) {
          await db.delete(valuationShares).where(inArray(valuationShares.valuationId, valuationIds));
          console.log(`Deleted valuation shares for ${valuationIds.length} valuations`);
        }
        
        // 3b. Deal tags - check for tagged broker ID (table doesn't have dealTagConversions child table)
        const brokerDealTags = await db.select({ id: dealTags.id }).from(dealTags).where(eq(dealTags.taggerBrokerId, brokerId));
        const dealTagIds = brokerDealTags.map(dt => dt.id);
        console.log(`Found ${dealTagIds.length} deal tags to delete`);

        
        // 3c. Delete referral activities involving this broker
        await db.delete(referralActivities).where(eq(referralActivities.referrerBrokerId, brokerId));
        await db.delete(referralActivities).where(eq(referralActivities.referredBrokerId, brokerId));
        console.log('Deleted referral activities');
        
        // STEP 4: Delete direct broker-owned tables
        
        // 4a. Communications
        await db.delete(communications).where(eq(communications.brokerId, brokerId));
        console.log('Deleted communications');
        
        // 4b. Broker points
        await db.delete(brokerPoints).where(eq(brokerPoints.brokerId, brokerId));
        console.log('Deleted broker points');
        
        // 4c. Broker rewards
        await db.delete(brokerRewards).where(eq(brokerRewards.brokerId, brokerId));
        console.log('Deleted broker rewards');
        
        // 4d. Broker achievements
        await db.delete(brokerAchievements).where(eq(brokerAchievements.brokerId, brokerId));
        console.log('Deleted broker achievements');
        
        // 4e. Platform shares
        await db.delete(platformShares).where(eq(platformShares.brokerId, brokerId));
        console.log('Deleted platform shares');
        
        // 4f. Referral links
        await db.delete(referralLinks).where(eq(referralLinks.brokerId, brokerId));
        console.log('Deleted referral links');
        
        // 4g. Deal tags
        if (dealTagIds.length > 0) {
          await db.delete(dealTags).where(eq(dealTags.taggerBrokerId, brokerId));
          console.log('Deleted deal tags');
        }
        
        // 4h. Valuations (after shares deleted)
        if (valuationIds.length > 0) {
          await db.delete(valuations).where(eq(valuations.brokerId, brokerId));
          console.log('Deleted valuations');
        }
        
        // STEP 5: Delete commission and partnership records (already existed)
        
        await db.delete(commissionEarnings).where(eq(commissionEarnings.brokerId, brokerId));
        console.log('Deleted commission earnings');
        
        await db.delete(commissionSplits).where(eq(commissionSplits.primaryBrokerId, brokerId));
        await db.delete(commissionSplits).where(eq(commissionSplits.referrerBrokerId, brokerId));
        console.log('Deleted commission splits');
        
        await db.delete(brokerPartnerships).where(eq(brokerPartnerships.brokerAId, brokerId));
        await db.delete(brokerPartnerships).where(eq(brokerPartnerships.brokerBId, brokerId));
        console.log('Deleted broker partnerships');
        
        await db.delete(referralMetrics).where(eq(referralMetrics.brokerId, brokerId));
        console.log('Deleted referral metrics');
        
        // STEP 6: Now safe to delete broker record
        console.log('Deleting broker record');
        await db.delete(brokers).where(eq(brokers.userId, id));
        console.log('Broker deleted successfully');
      }
      
      // Delete password reset tokens (lookup user email first)
      try {
        const [userToDelete] = await db.select().from(users).where(eq(users.id, id));
        if (userToDelete?.email) {
          await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, userToDelete.email));
          console.log('Deleted password reset tokens for user');
        }
      } catch (error) {
        console.log('Error deleting password reset tokens, skipping...');
      }
      
      // Handle deals table - null out user references
      try {
        await db.update(deals).set({ statusUpdatedBy: null }).where(eq(deals.statusUpdatedBy, id));
        await db.update(deals).set({ reviewedBy: null }).where(eq(deals.reviewedBy, id));
        await db.update(deals).set({ assignedAnalyst: null }).where(eq(deals.assignedAnalyst, id));
        console.log('Nullified user references in deals table');
      } catch (error) {
        console.log('Error nullifying deals, skipping...');
      }
      
      // Handle property comments - delete authored, null out resolved
      try {
        await db.delete(propertyComments).where(eq(propertyComments.authorId, id));
        await db.update(propertyComments).set({ resolvedBy: null }).where(eq(propertyComments.resolvedBy, id));
        console.log('Handled property comments for user');
      } catch (error) {
        console.log('Error handling property comments, skipping...');
      }
      
      // Handle review queue - null out assigned analyst
      try {
        await db.update(reviewQueue).set({ assignedAnalyst: null }).where(eq(reviewQueue.assignedAnalyst, id));
        console.log('Nullified review queue assigned analyst');
      } catch (error) {
        console.log('Error nullifying review queue, skipping...');
      }
      
      // Handle review assignments - delete assignments where user is analyst, null out assignedBy
      try {
        await db.delete(reviewAssignments).where(eq(reviewAssignments.analystId, id));
        await db.update(reviewAssignments).set({ assignedBy: null }).where(eq(reviewAssignments.assignedBy, id));
        console.log('Handled review assignments for user');
      } catch (error) {
        console.log('Error handling review assignments, skipping...');
      }
      
      // Handle review actions - delete actions by this analyst
      try {
        await db.delete(reviewActions).where(eq(reviewActions.analystId, id));
        console.log('Deleted review actions for user');
      } catch (error) {
        console.log('Error deleting review actions, skipping...');
      }
      
      // Handle review corrections - null out verifiedBy and analystId
      try {
        await db.update(reviewCorrections).set({ verifiedBy: null }).where(eq(reviewCorrections.verifiedBy, id));
        await db.delete(reviewCorrections).where(eq(reviewCorrections.analystId, id));
        console.log('Handled review corrections for user');
      } catch (error) {
        console.log('Error handling review corrections, skipping...');
      }
      
      // Handle review escalations - delete escalations involving this user
      try {
        await db.delete(reviewEscalations).where(eq(reviewEscalations.escalatedBy, id));
        await db.delete(reviewEscalations).where(eq(reviewEscalations.escalatedTo, id));
        await db.update(reviewEscalations).set({ resolvedBy: null }).where(eq(reviewEscalations.resolvedBy, id));
        console.log('Handled review escalations for user');
      } catch (error) {
        console.log('Error handling review escalations, skipping...');
      }
      
      // Delete deal tags where user signed up
      try {
        await db.delete(dealTags).where(eq(dealTags.signedUpUserId, id));
        console.log('Deleted deal tags for user');
      } catch (error) {
        console.log('Error deleting deal tags, skipping...');
      }
      
      // Delete viral signups
      try {
        await db.delete(viralSignups).where(eq(viralSignups.newUserId, id));
        console.log('Deleted viral signups for user');
      } catch (error) {
        console.log('Error deleting viral signups, skipping...');
      }
      
      // Delete valuation shares
      try {
        await db.delete(valuationShares).where(eq(valuationShares.signedUpUserId, id));
        console.log('Deleted valuation shares for user');
      } catch (error) {
        console.log('Error deleting valuation shares, skipping...');
      }
      
      // Delete preferred partners
      try {
        await db.delete(preferredPartners).where(eq(preferredPartners.partnerUserId, id));
        console.log('Deleted preferred partners for user');
      } catch (error) {
        console.log('Error deleting preferred partners, skipping...');
      }
      
      // Delete partnership invitations
      try {
        await db.delete(partnershipInvitations).where(eq(partnershipInvitations.newUserId, id));
        console.log('Deleted partnership invitations for user');
      } catch (error) {
        console.log('Error deleting partnership invitations, skipping...');
      }
      
      // Delete referral activities (not referralLinks!)
      try {
        await db.delete(referralActivities).where(eq(referralActivities.referredUserId, id));
        console.log('Deleted referral activities for user');
      } catch (error) {
        console.log('Error deleting referral activities, skipping...');
      }
      
      // Delete public listing searches
      try {
        await db.delete(publicListingSearches).where(eq(publicListingSearches.triggeredByUserId, id));
        console.log('Deleted public listing searches for user');
      } catch (error) {
        console.log('Error deleting public listing searches, skipping...');
      }
      
      // Finally delete the user record
      await db.delete(users).where(eq(users.id, id));
      console.log('Successfully deleted user:', id);
      
    } catch (error) {
      console.error('Error in cascade delete user:', error);
      throw error;
    }
  }

  async getCatalystTeamMembers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(like(users.email, '%@catalystcp.com'))
      .orderBy(users.email);
  }

  async getAllTeamMembers(): Promise<string[]> {
    // Return the predefined team roster from replit.md
    return [
      'aj@catalystcp.com',
      'ford@catalystcp.com', 
      'ted@catalystcp.com',
      'erich@catalystcp.com',
      'john@catalystcp.com',
      'steve@catalystcp.com',
      'mallie@catalystcp.com',
      'nic@catalystcp.com',
      'mike@catalystcp.com',
      'austin@catalystcp.com',
      'davis@catalystcp.com',
      'darian@catalystcp.com',
      'jack@catalystcp.com',
      'jim@catalystcp.com'
    ];
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Normalize email to lowercase to prevent case-sensitive duplicates
    const normalizedData = {
      ...userData,
      email: userData.email?.toLowerCase(),
    };
    const [user] = await db.insert(users).values(normalizedData).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Normalize email to lowercase to prevent case-sensitive duplicates
    const normalizedData = {
      ...userData,
      email: userData.email?.toLowerCase(),
    };
    const [user] = await db
      .insert(users)
      .values(normalizedData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...normalizedData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, role))
      .orderBy(users.createdAt);
  }

  async getUsersByRoles(roles: string[]): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(inArray(users.role, roles))
      .orderBy(users.createdAt);
  }

  async getUsersByDealRole(dealRole: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.dealRole, dealRole))
      .orderBy(users.createdAt);
  }

  async getUsersByDealRoles(dealRoles: string[]): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(inArray(users.dealRole, dealRoles))
      .orderBy(users.createdAt);
  }

  // Broker operations
  
  /**
   * Normalize phone number to E.164 format (+1XXXXXXXXXX)
   * This ensures consistent storage and prevents duplicate brokers from different phone formats
   */
  private normalizePhoneToE164(phone: string | null | undefined): string {
    if (!phone || phone === '' || phone === 'Unknown') return phone || '';
    
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Get last 10 digits (the actual phone number without country code)
    const last10 = digitsOnly.slice(-10);
    
    // If we don't have exactly 10 digits, return original (invalid number)
    if (last10.length !== 10) {
      console.log(`⚠️ [PHONE-NORMALIZE] Cannot normalize "${phone}" - not 10 digits after cleaning: "${last10}"`);
      return phone;
    }
    
    // Return in E.164 format: +1XXXXXXXXXX
    const normalized = `+1${last10}`;
    if (normalized !== phone) {
      console.log(`📱 [PHONE-NORMALIZE] "${phone}" → "${normalized}"`);
    }
    return normalized;
  }
  
  async createBroker(broker: InsertBroker): Promise<Broker> {
    // Normalize phone to E.164 format before storage
    const normalizedBroker = {
      ...broker,
      phone: this.normalizePhoneToE164(broker.phone)
    };
    
    const results = await db.insert(brokers).values(normalizedBroker).returning();
    const [newBroker] = Array.isArray(results) ? results : [results];
    return newBroker as Broker;
  }

  async createBrokerWithUserId(broker: InsertBroker & { userId: string }): Promise<Broker> {
    // Normalize phone to E.164 format before storage
    const normalizedBroker = {
      ...broker,
      phone: this.normalizePhoneToE164(broker.phone)
    };
    
    const results = await db.insert(brokers).values(normalizedBroker).returning();
    const [newBroker] = Array.isArray(results) ? results : [results];
    return newBroker as Broker;
  }

  async getBrokerByEmail(email: string): Promise<Broker | undefined> {
    const [broker] = await db.select().from(brokers)
      .where(sql`LOWER(email) = LOWER(${email})`);
    return broker as Broker | undefined;
  }

  async getBrokerByPhone(phone: string): Promise<Broker | undefined> {
    // Normalize phone to just digits for comparison
    // This handles format mismatches: +17034744399 vs 7034744399 vs (703) 474-4399
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Get the last 10 digits (removes country code if present)
    const last10Digits = digitsOnly.slice(-10);
    
    if (last10Digits.length !== 10) {
      console.log(`⚠️ [BROKER-PHONE-LOOKUP] Invalid phone length after normalization: "${phone}" → "${last10Digits}"`);
      // Try exact match as fallback
      const [broker] = await db.select().from(brokers).where(eq(brokers.phone, phone));
      return broker as Broker | undefined;
    }
    
    console.log(`🔍 [BROKER-PHONE-LOOKUP] Searching for phone "${phone}" → normalized to last 10 digits: "${last10Digits}"`);
    
    // Search for all possible formats:
    // 1. Just 10 digits: 7034744399
    // 2. With +1 prefix: +17034744399
    // 3. With 1 prefix: 17034744399
    const possibleFormats = [
      last10Digits,           // 7034744399
      `+1${last10Digits}`,    // +17034744399
      `1${last10Digits}`      // 17034744399
    ];
    
    const [broker] = await db.select().from(brokers).where(
      or(
        eq(brokers.phone, possibleFormats[0]),
        eq(brokers.phone, possibleFormats[1]),
        eq(brokers.phone, possibleFormats[2])
      )
    );
    
    if (broker) {
      console.log(`✅ [BROKER-PHONE-LOOKUP] Found broker ${broker.id} with phone "${broker.phone}" (searched for "${phone}")`);
    } else {
      console.log(`❌ [BROKER-PHONE-LOOKUP] No broker found for phone "${phone}" (tried formats: ${possibleFormats.join(', ')})`);
    }
    
    return broker as Broker | undefined;
  }

  async getBrokerByUserId(userId: string): Promise<Broker | undefined> {
    const [broker] = await db.select().from(brokers).where(eq(brokers.userId, userId));
    return broker as Broker | undefined;
  }

  /**
   * SMART BROKER LOOKUP: Find existing broker by email OR phone, update with missing info, or create new
   * This prevents duplicate broker profiles when the same person submits via different channels
   */
  async findOrCreateBroker(data: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    brokerage?: string;
    marketsCovered?: string[];
    smsConsent?: boolean;
    smsOptIn?: boolean;
  }): Promise<{ broker: Broker; isNew: boolean; wasUpdated: boolean }> {
    const { email, phone, firstName, lastName, brokerage, marketsCovered, smsConsent, smsOptIn } = data;
    
    // Helper to check if email is a temp email (sms-xxx@temp.landlinq.ai)
    const isTempEmail = (e: string | null | undefined) => e && e.includes('@temp.landlinq.ai');
    
    let existingBroker: Broker | undefined;
    let matchedBy: 'email' | 'phone' | null = null;
    
    // Step 1: Check BOTH email and phone simultaneously to catch cross-channel duplicates
    const [byEmail, byPhone] = await Promise.all([
      (email && !isTempEmail(email)) ? this.getBrokerByEmail(email) : Promise.resolve(undefined),
      phone ? this.getBrokerByPhone(phone) : Promise.resolve(undefined),
    ]);

    if (byEmail && byPhone && byEmail.id !== byPhone.id) {
      // Two different brokers match — merge phone-found into email-found
      console.log(`🔀 [BROKER-DEDUP] Merging broker ${byPhone.id} (phone) into ${byEmail.id} (email)`);
      try {
        await this.mergeBrokers(byPhone.id, byEmail.id);
      } catch (mergeErr) {
        console.error(`❌ [BROKER-DEDUP] Merge failed, continuing with email broker:`, mergeErr);
      }
      existingBroker = await this.getBrokerById(byEmail.id);
      matchedBy = 'email';
    } else if (byEmail) {
      existingBroker = byEmail;
      matchedBy = 'email';
      console.log(`🔗 [BROKER-MERGE] Found existing broker ${existingBroker.id} by email: ${email}`);
    } else if (byPhone) {
      existingBroker = byPhone;
      matchedBy = 'phone';
      console.log(`🔗 [BROKER-MERGE] Found existing broker ${existingBroker.id} by phone: ${phone}`);
    }
    
    // Step 3: If we found an existing broker, update it with any new/missing info
    if (existingBroker) {
      const updates: Partial<Broker> = {};
      let hasUpdates = false;
      
      // Add email if existing broker has temp email and we have a real email
      if (email && !isTempEmail(email) && isTempEmail(existingBroker.email)) {
        updates.email = email;
        hasUpdates = true;
        console.log(`🔗 [BROKER-MERGE] Upgrading temp email to real email: ${email}`);
      }
      
      // Add phone if existing broker has no phone and we have one
      if (phone && (!existingBroker.phone || existingBroker.phone === '')) {
        updates.phone = phone;
        hasUpdates = true;
        console.log(`🔗 [BROKER-MERGE] Adding phone to broker: ${phone}`);
      }
      
      // Update name if existing broker has placeholder names and we have real ones
      if (firstName && firstName !== '' && (existingBroker.firstName === '' || existingBroker.firstName === 'Email' || existingBroker.firstName === 'Unknown')) {
        updates.firstName = firstName;
        hasUpdates = true;
      }
      if (lastName && lastName !== '' && (existingBroker.lastName === '' || existingBroker.lastName === 'Submission' || existingBroker.lastName === 'Broker')) {
        updates.lastName = lastName;
        hasUpdates = true;
      }
      
      // Update brokerage if missing
      if (brokerage && brokerage !== '' && (!existingBroker.brokerage || existingBroker.brokerage === '')) {
        updates.brokerage = brokerage;
        hasUpdates = true;
      }
      
      // Update SMS consent if provided and broker doesn't have it
      if (smsConsent === true && !existingBroker.smsConsent) {
        updates.smsConsent = true;
        hasUpdates = true;
      }
      if (smsOptIn === true && !existingBroker.smsOptIn) {
        updates.smsOptIn = true;
        updates.smsOptInDate = new Date();
        hasUpdates = true;
      }
      
      if (hasUpdates) {
        console.log(`🔗 [BROKER-MERGE] Updating broker ${existingBroker.id} with new info:`, updates);
        const updatedBroker = await this.updateBroker(existingBroker.id, updates);
        return { broker: updatedBroker, isNew: false, wasUpdated: true };
      }
      
      return { broker: existingBroker, isNew: false, wasUpdated: false };
    }
    
    // Step 4: No existing broker found - create a new one
    console.log(`🆕 [BROKER-CREATE] Creating new broker with email=${email}, phone=${phone}`);
    
    // Generate temp email if no real email provided
    const brokerEmail = email || `sms-${(phone || '').replace(/\D/g, '')}-${Date.now()}@temp.landlinq.ai`;
    
    const newBroker = await this.createBroker({
      email: brokerEmail,
      phone: phone || '',
      firstName: firstName || '',
      lastName: lastName || '',
      brokerage: brokerage || '',
      marketsCovered: marketsCovered || [],
      smsConsent: smsConsent,
      smsOptIn: smsOptIn,
      smsOptInDate: smsOptIn ? new Date() : undefined
    } as InsertBroker);
    
    console.log(`✅ [BROKER-CREATE] Created new broker ${newBroker.id}`);
    return { broker: newBroker, isNew: true, wasUpdated: false };
  }

  async getBrokerById(id: string): Promise<Broker | undefined> {
    const [broker] = await db.select().from(brokers).where(eq(brokers.id, id));
    return broker as Broker | undefined;
  }

  async getAllBrokers(): Promise<Broker[]> {
    return await db.select().from(brokers).orderBy(desc(brokers.createdAt)) as Broker[];
  }

  async updateBroker(id: string, updates: Partial<Broker>): Promise<Broker> {
    // Normalize phone to E.164 format if being updated
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.phone !== undefined) {
      normalizedUpdates.phone = this.normalizePhoneToE164(normalizedUpdates.phone);
    }
    
    const [broker] = await db
      .update(brokers)
      .set({ ...normalizedUpdates, updatedAt: new Date() })
      .where(eq(brokers.id, id))
      .returning();
    return broker as Broker;
  }

  async deleteBroker(id: string): Promise<void> {
    await db.delete(brokers).where(eq(brokers.id, id));
  }

  async mergeBrokers(sourceBrokerId: string, targetBrokerId: string): Promise<{ mergedDeals: number; mergedConversations: number; mergedCommunications: number }> {
    console.log(`[MERGE] Starting merge of broker ${sourceBrokerId} into ${targetBrokerId}`);
    
    // Verify both brokers exist
    const sourceBroker = await this.getBrokerById(sourceBrokerId);
    const targetBroker = await this.getBrokerById(targetBrokerId);
    
    if (!sourceBroker) {
      throw new Error(`Source broker ${sourceBrokerId} not found`);
    }
    if (!targetBroker) {
      throw new Error(`Target broker ${targetBrokerId} not found`);
    }
    
    let mergedDeals = 0;
    let mergedConversations = 0;
    let mergedCommunications = 0;
    
    // Transfer deals from source to target
    const dealsResult = await db
      .update(deals)
      .set({ brokerId: targetBrokerId })
      .where(eq(deals.brokerId, sourceBrokerId));
    mergedDeals = dealsResult.rowCount || 0;
    console.log(`[MERGE] Transferred ${mergedDeals} deals`);
    
    // Transfer communications from source to target
    const commsResult = await db
      .update(communications)
      .set({ brokerId: targetBrokerId })
      .where(eq(communications.brokerId, sourceBrokerId));
    mergedCommunications = commsResult.rowCount || 0;
    console.log(`[MERGE] Transferred ${mergedCommunications} communications`);
    
    // Transfer conversations - need to check if target already has a conversation
    const sourceConversation = await this.getConversationByBrokerId(sourceBrokerId);
    const targetConversation = await this.getConversationByBrokerId(targetBrokerId);
    
    if (sourceConversation) {
      if (targetConversation) {
        // Transfer messages from source conversation to target conversation
        await db
          .update(conversationMessages)
          .set({ conversationId: targetConversation.id })
          .where(eq(conversationMessages.conversationId, sourceConversation.id));
        
        // Delete the source conversation
        await db.delete(conversations).where(eq(conversations.id, sourceConversation.id));
        console.log(`[MERGE] Transferred messages to existing target conversation`);
      } else {
        // Just update the broker ID on the source conversation
        await db
          .update(conversations)
          .set({ brokerId: targetBrokerId })
          .where(eq(conversations.id, sourceConversation.id));
        console.log(`[MERGE] Transferred conversation to target broker`);
      }
      mergedConversations = 1;
    }
    
    // Update target broker with source broker's contact info if target is missing it
    const updates: Partial<Broker> = {};
    if (!targetBroker.phone && sourceBroker.phone) {
      updates.phone = sourceBroker.phone;
    }
    if (!targetBroker.email && sourceBroker.email) {
      updates.email = sourceBroker.email;
    }
    if (!targetBroker.firstName && sourceBroker.firstName) {
      updates.firstName = sourceBroker.firstName;
    }
    if (!targetBroker.lastName && sourceBroker.lastName) {
      updates.lastName = sourceBroker.lastName;
    }
    if (!targetBroker.brokerage && sourceBroker.brokerage) {
      updates.brokerage = sourceBroker.brokerage;
    }
    if ((!targetBroker.marketsCovered || targetBroker.marketsCovered.length === 0) && sourceBroker.marketsCovered?.length) {
      updates.marketsCovered = sourceBroker.marketsCovered;
    }
    
    if (Object.keys(updates).length > 0) {
      await this.updateBroker(targetBrokerId, updates);
      console.log(`[MERGE] Updated target broker with source broker info:`, updates);
    }
    
    // Clean up outreach_messages for source broker before delete (unique constraint prevents transfer)
    await db.delete(outreachMessages).where(eq(outreachMessages.brokerId, sourceBrokerId));
    console.log(`[MERGE] Removed outreach_messages for source broker`);

    // Clean up broker_points for source broker (both broker_id rows AND referral_id refs)
    await db.delete(brokerPoints).where(eq(brokerPoints.brokerId, sourceBrokerId));
    await db.execute(sql`UPDATE broker_points SET referral_id = NULL WHERE referral_id = ${sourceBrokerId}`);
    console.log(`[MERGE] Removed broker_points for source broker`);

    // Nullify commission_splits.referrer_broker_id refs (no cascade on that column)
    await db.execute(sql`UPDATE commission_splits SET referrer_broker_id = NULL WHERE referrer_broker_id = ${sourceBrokerId}`);
    console.log(`[MERGE] Cleared commission_splits.referrer_broker_id for source broker`);

    // Delete the source broker
    await this.deleteBroker(sourceBrokerId);
    console.log(`[MERGE] Deleted source broker ${sourceBrokerId}`);
    
    console.log(`[MERGE] Complete: ${mergedDeals} deals, ${mergedConversations} conversations, ${mergedCommunications} communications`);
    
    return { mergedDeals, mergedConversations, mergedCommunications };
  }

  /**
   * Find all brokers that have duplicate phone numbers (same number, different formats)
   * Returns groups of broker IDs that should be merged
   */
  async findDuplicateBrokersByPhone(): Promise<Array<{ normalizedPhone: string; brokerIds: string[]; count: number }>> {
    // Get all brokers with phone numbers
    const allBrokers = await db.select().from(brokers).where(
      and(
        isNotNull(brokers.phone),
        sql`${brokers.phone} != ''`,
        sql`${brokers.phone} != 'Unknown'`
      )
    );
    
    // Group by normalized phone (last 10 digits)
    const phoneGroups = new Map<string, string[]>();
    
    for (const broker of allBrokers) {
      if (!broker.phone) continue;
      
      // Normalize: remove all non-digits and take last 10
      const digitsOnly = broker.phone.replace(/\D/g, '');
      const last10 = digitsOnly.slice(-10);
      
      // Skip if not a valid 10-digit phone
      if (last10.length !== 10) continue;
      
      const existing = phoneGroups.get(last10) || [];
      existing.push(broker.id);
      phoneGroups.set(last10, existing);
    }
    
    // Filter to only groups with duplicates
    const duplicates: Array<{ normalizedPhone: string; brokerIds: string[]; count: number }> = [];
    
    Array.from(phoneGroups.entries()).forEach(([phone, ids]) => {
      if (ids.length > 1) {
        duplicates.push({
          normalizedPhone: phone,
          brokerIds: ids,
          count: ids.length
        });
      }
    });
    
    console.log(`[DEDUP] Found ${duplicates.length} phone number groups with duplicates`);
    return duplicates;
  }

  /**
   * Automatically merge all duplicate brokers based on normalized phone numbers
   * Keeps the oldest broker (by createdAt) as the primary and merges others into it
   */
  async deduplicateAllBrokers(): Promise<{ groupsMerged: number; brokersRemoved: number; totalDeals: number; totalCommunications: number }> {
    console.log('[DEDUP] Starting broker deduplication...');
    
    const duplicateGroups = await this.findDuplicateBrokersByPhone();
    
    let groupsMerged = 0;
    let brokersRemoved = 0;
    let totalDeals = 0;
    let totalCommunications = 0;
    
    for (const group of duplicateGroups) {
      console.log(`[DEDUP] Processing phone ${group.normalizedPhone} with ${group.count} brokers`);
      
      // Get full broker records to determine which is oldest
      const groupBrokers = await Promise.all(
        group.brokerIds.map(id => this.getBrokerById(id))
      );
      
      // Filter out nulls and sort by createdAt (oldest first)
      const validBrokers = groupBrokers
        .filter((b): b is Broker => b !== undefined)
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      
      if (validBrokers.length < 2) continue;
      
      // Keep the oldest as the primary (or the one with real email vs temp email)
      let primaryBroker = validBrokers[0];
      
      // Prefer broker with real email over temp email
      for (const broker of validBrokers) {
        if (broker.email && !broker.email.includes('@temp.landlinq.ai') && 
            (!primaryBroker.email || primaryBroker.email.includes('@temp.landlinq.ai'))) {
          primaryBroker = broker;
          break;
        }
      }
      
      // Merge all other brokers into the primary
      for (const broker of validBrokers) {
        if (broker.id === primaryBroker.id) continue;
        
        try {
          const result = await this.mergeBrokers(broker.id, primaryBroker.id);
          totalDeals += result.mergedDeals;
          totalCommunications += result.mergedCommunications;
          brokersRemoved++;
          console.log(`[DEDUP] Merged broker ${broker.id} (${broker.email}) into ${primaryBroker.id} (${primaryBroker.email})`);
        } catch (error) {
          console.error(`[DEDUP] Failed to merge broker ${broker.id}:`, error);
        }
      }
      
      // Normalize the primary broker's phone to E.164 format
      const normalizedPhone = this.normalizePhoneToE164(primaryBroker.phone);
      if (normalizedPhone !== primaryBroker.phone) {
        await this.updateBroker(primaryBroker.id, { phone: normalizedPhone });
        console.log(`[DEDUP] Normalized primary broker ${primaryBroker.id} phone: "${primaryBroker.phone}" → "${normalizedPhone}"`);
      }
      
      groupsMerged++;
    }
    
    console.log(`[DEDUP] Complete: ${groupsMerged} groups merged, ${brokersRemoved} brokers removed, ${totalDeals} deals transferred, ${totalCommunications} communications transferred`);
    
    return { groupsMerged, brokersRemoved, totalDeals, totalCommunications };
  }

  /**
   * Find and merge all duplicate brokers that share the same email address (case-insensitive).
   * Keeps the oldest broker as primary; merges all newer duplicates into it.
   */
  async deduplicateByEmail(): Promise<{ groupsMerged: number; brokersRemoved: number; dealsTransferred: number; commsTransferred: number }> {
    console.log('[EMAIL-DEDUP] Starting email-based deduplication...');

    // Find all emails that appear more than once (case-insensitive)
    const dupeRows = await db.execute(sql`
      SELECT LOWER(email) as lower_email, array_agg(id ORDER BY created_at ASC) as ids, COUNT(*) as cnt
      FROM brokers
      WHERE email IS NOT NULL AND email != '' AND email NOT LIKE '%@temp.landlinq.ai'
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `);

    const groups = (dupeRows.rows as any[]);
    console.log(`[EMAIL-DEDUP] Found ${groups.length} email groups with duplicates`);

    let groupsMerged = 0;
    let brokersRemoved = 0;
    let dealsTransferred = 0;
    let commsTransferred = 0;

    for (const group of groups) {
      const ids: string[] = group.ids;
      // First in array is oldest (ORDER BY created_at ASC) — keep it as primary
      const primaryId = ids[0];
      const duplicateIds = ids.slice(1);

      for (const dupId of duplicateIds) {
        try {
          const result = await this.mergeBrokers(dupId, primaryId);
          dealsTransferred += result.mergedDeals;
          commsTransferred += result.mergedCommunications;
          brokersRemoved++;
          console.log(`[EMAIL-DEDUP] Merged ${dupId} into ${primaryId} (email: ${group.lower_email})`);
        } catch (err) {
          console.error(`[EMAIL-DEDUP] Failed to merge ${dupId} into ${primaryId}:`, err);
        }
      }
      groupsMerged++;
    }

    console.log(`[EMAIL-DEDUP] Done: ${groupsMerged} groups, ${brokersRemoved} removed, ${dealsTransferred} deals transferred`);
    return { groupsMerged, brokersRemoved, dealsTransferred, commsTransferred };
  }

  // Deal operations
  async createDeal(deal: InsertDeal): Promise<Deal> {
    // HARD RULE: BLOCK deals with "Property Submission" address - these are fake/automated deals
    if (deal.address === 'Property Submission') {
      const errorMsg = '🚫 BLOCKED: Cannot create deal with address "Property Submission" - This is a forbidden address used by automated fake deals';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    // SECURITY: Strip any incoming ID and dealNumber to prevent injection
    // Always rely on database's gen_random_uuid() for ID and auto-increment for dealNumber
    const cleanDeal = { ...deal };
    delete (cleanDeal as any).id;
    delete (cleanDeal as any).dealNumber; // Auto-generated by database
    
    // Log deal creation source for debugging fake deal issues
    console.log('📝 Creating deal:', {
      address: cleanDeal.address,
      broker: cleanDeal.brokerId,
      method: cleanDeal.submissionMethod,
      source: (deal as any).source || 'api',
      hasNotes: !!cleanDeal.brokerNotes,
      hasFiles: !!cleanDeal.documentUrls,
      notesPreview: cleanDeal.brokerNotes ? cleanDeal.brokerNotes.substring(0, 50) + '...' : 'none',
      filesCount: Array.isArray(cleanDeal.documentUrls) ? cleanDeal.documentUrls.length : 0
    });
    
    const [newDeal] = await db.insert(deals).values(cleanDeal).returning();
    
    // AUTO-CLASSIFICATION COMPLETELY REMOVED per user requirement - all deals must be manually classified
    console.log(`✅ Deal ${newDeal.id} created (UUID: ${newDeal.id.length} chars) - NO automatic classification, requires manual analyst review`);
    
    return newDeal;
  }

  async getDealById(id: string): Promise<Deal | undefined> {
    const [deal] = await db
      .select({
        // All Deal fields that actually exist in schema
        id: deals.id,
        dealNumber: deals.dealNumber,
        brokerId: deals.brokerId,
        address: deals.address,
        city: deals.city,
        state: deals.state,
        zip: deals.zip,
        county: deals.county,
        latitude: deals.latitude,
        longitude: deals.longitude,
        askingPrice: deals.askingPrice,
        sizeAcres: deals.sizeAcres,
        unitCount: deals.unitCount,
        hasEntitlements: deals.hasEntitlements,
        parcelId: deals.parcelId,
        zoning: deals.zoning,
        sewerAvailable: deals.sewerAvailable,
        topRentPSF: deals.topRentPSF,
        avgRentPSF: deals.avgRentPSF,
        topRentPerUnit: deals.topRentPerUnit,
        avgRentPerUnit: deals.avgRentPerUnit,
        productTypes: deals.productTypes,
        dealType: deals.dealType,
        yearBuilt: deals.yearBuilt,
        propertyName: deals.propertyName,
        constructionCostPerSF: deals.constructionCostPerSF,
        projectedRentPerSF: deals.projectedRentPerSF,
        totalProjectCost: deals.totalProjectCost,
        projectedNOI: deals.projectedNOI,
        marketCapRate: deals.marketCapRate,
        yieldOnCost: deals.yieldOnCost,
        irr: deals.irr,
        developmentTimelineMonths: deals.developmentTimelineMonths,
        unitSize: deals.unitSize,
        estimatedUnits: deals.estimatedUnits,
        estimatedRentPSF: deals.estimatedRentPSF,
        estimatedAnnualGrossRent: deals.estimatedAnnualGrossRent,
        population55Plus5Mile: deals.population55Plus5Mile,
        income75Plus55Plus: deals.income75Plus55Plus,
        demographicsNotes: deals.demographicsNotes,
        assignedAnalyst: deals.assignedAnalyst,
        assignedJrAnalyst: deals.assignedJrAnalyst,
        assignedDeveloper: deals.assignedDeveloper,
        assignedPartner: deals.assignedPartner,
        nextSteps: deals.nextSteps,
        brokerNotes: deals.brokerNotes,
        status: deals.status,
        classification: deals.classification,
        qctStatus: deals.qctStatus,
        censusTractFips: deals.censusTractFips,
        comparableNotes: deals.comparableNotes,
        comparableCount: deals.comparableCount,
        comparablesJson: deals.comparablesJson,
        suggestedDevelopmentType: deals.suggestedDevelopmentType,
        statusUpdatedAt: deals.statusUpdatedAt,
        statusUpdatedBy: deals.statusUpdatedBy,
        pipelineStage: deals.pipelineStage,
        timeInCurrentStage: deals.timeInCurrentStage,
        totalPipelineTime: deals.totalPipelineTime,
        stageHistory: deals.stageHistory,
        priority: deals.priority,
        estimatedCloseDate: deals.estimatedCloseDate,
        actualCloseDate: deals.actualCloseDate,
        aiAnalysisData: deals.aiAnalysisData,
        submissionMethod: deals.submissionMethod,
        documentUrls: deals.documentUrls,
        analystNotes: deals.analystNotes,
        developerSummary: deals.developerSummary,
        wetlandNotes: deals.wetlandNotes,
        rejectionReason: deals.rejectionReason,
        calculatedFields: deals.calculatedFields,
        reviewedBy: deals.reviewedBy,
        reviewedAt: deals.reviewedAt,
        isArchived: deals.isArchived,
        archivedAt: deals.archivedAt,
        
        // Deal Flagging System Fields
        flagged: deals.flagged,
        riskLevel: deals.riskLevel,
        confidenceScore: deals.confidenceScore,
        dataQualityIssues: deals.dataQualityIssues,
        validationFlags: deals.validationFlags,
        sourceConflicts: deals.sourceConflicts,
        flaggedAt: deals.flaggedAt,
        flaggedBy: deals.flaggedBy,
        flaggingReason: deals.flaggingReason,
        specificWarnings: deals.specificWarnings,
        estimatedReviewTime: deals.estimatedReviewTime,
        lastValidationAt: deals.lastValidationAt,
        validationHistory: deals.validationHistory,
        analystReviewStatus: deals.analystReviewStatus,
        reviewStartedAt: deals.reviewStartedAt,
        reviewCompletedAt: deals.reviewCompletedAt,
        reviewNotes: deals.reviewNotes,
        dataCorrections: deals.dataCorrections,
        
        // Public Listing Cross-Reference System
        publicListings: deals.publicListings,
        
        // Deal Validation and Blocking System
        validationStatus: deals.validationStatus,
        blockedAt: deals.blockedAt,
        blockedBy: deals.blockedBy,
        validationTimeoutAt: deals.validationTimeoutAt,
        escalatedAt: deals.escalatedAt,
        analystOverride: deals.analystOverride,
        blockingReason: deals.blockingReason,
        analystOverrideBy: deals.analystOverrideBy,
        analystOverrideAt: deals.analystOverrideAt,
        analystOverrideReason: deals.analystOverrideReason,
        forceApproved: deals.forceApproved,
        escalated: deals.escalated,
        
        // Emergency Review System Fields
        emergencyReviewFlag: deals.emergencyReviewFlag,
        emergencyTriggeredAt: deals.emergencyTriggeredAt,
        emergencyReason: deals.emergencyReason,

        // Fields added via raw SQL migration — must be explicitly listed here
        dealSummary: deals.dealSummary,
        netDevelopableAcres: deals.netDevelopableAcres,
        apexNotes: deals.apexNotes,
        maxUnitsByZoning: deals.maxUnitsByZoning,
        seniorLoanPct: deals.seniorLoanPct,
        
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .where(eq(deals.id, id));
    return deal ? addFormattedDealId(deal) : deal;
  }

  // Alias for getDealById to match the routes.ts usage
  async getDeal(id: string): Promise<Deal | undefined> {
    return this.getDealById(id);
  }

  async getDealsByBrokerId(brokerId: string): Promise<Deal[]> {
    const dealList = await db
      .select()
      .from(deals)
      .where(eq(deals.brokerId, brokerId))
      .orderBy(desc(deals.createdAt));
    return dealList.map(addFormattedDealId);
  }

  async getAllDeals(): Promise<Deal[]> {
    const dealList = await db
      .select()
      .from(deals)
      .orderBy(desc(deals.createdAt));
    return dealList.map(addFormattedDealId);
  }

  async getUnassignedDeals(): Promise<Deal[]> {
    const dealList = await db
      .select()
      .from(deals)
      .where(eq(deals.classification, 'unclassified'))
      .orderBy(desc(deals.createdAt));
    return dealList.map(addFormattedDealId);
  }

  async getRecentDealsByEmail(email: string): Promise<Deal[]> {
    const dealList = await db
      .select()
      .from(deals)
      .innerJoin(brokers, eq(deals.brokerId, brokers.id))
      .where(eq(brokers.email, email))
      .orderBy(desc(deals.createdAt))
      .limit(5); // Get last 5 deals from this email
    
    return dealList.map((row) => addFormattedDealId(row.deals));
  }

  async getDealsAssignedToTeamMember(userId: string): Promise<Deal[]> {
    // Get the user to determine their role and email
    const user = await this.getUser(userId);
    if (!user) return [];
    
    // Get all active deals (not red/green) that have been assigned (have product types)
    const activeDeals = await db
      .select()
      .from(deals)
      .where(and(
        sql`${deals.classification} != 'red'`,
        sql`${deals.classification} != 'green'`,
        sql`${deals.productTypes} IS NOT NULL`,
        sql`jsonb_array_length(${deals.productTypes}) > 0`
      ))
      .orderBy(desc(deals.createdAt));
    
    // Import routing logic using dynamic import for ESM compatibility
    const { getAutomaticRouting } = await import('./dealRouting.js');
    
    // Deterministic team member mapping by email and role
    // Note: Davis is no longer a senior analyst and doesn't receive morning reports
    const teamMemberMapping = {
      // Analysts
      'austin@catalystcp.com': 'Austin Blondell',
      'austin.blondell@catalystcp.com': 'Austin Blondell', 
      
      // Developers
      'steve@catalystcp.com': 'Steve Hillebrand',
      'steve.hillebrand@catalystcp.com': 'Steve Hillebrand',
      'john@catalystcp.com': 'John Bell',
      'john.bell@catalystcp.com': 'John Bell',
      'mallie@catalystcp.com': 'Mallie Colavita',
      'mallie.colavita@catalystcp.com': 'Mallie Colavita',
      
      // Partners
      'aj@catalystcp.com': 'AJ Klenk',
      'aj.klenk@catalystcp.com': 'AJ Klenk',
      'ford@catalystcp.com': 'Brian Ford',
      'brian@catalystcp.com': 'Brian Ford',
      'brian.ford@catalystcp.com': 'Brian Ford'
    };
    
    const userTeamName = teamMemberMapping[user.email.toLowerCase()];
    
    // If user is not in team mapping, return empty (not a senior team member)
    if (!userTeamName) {
      return [];
    }
    
    // Filter deals based on team member assignment using the routing logic
    const assignedDeals = [];
    for (const deal of activeDeals) {
      if (!deal.productTypes || deal.productTypes.length === 0) continue;
      
      const market = `${deal.city || ''} ${deal.state || ''}`.trim() || deal.address || '';
      const routing = await getAutomaticRouting(deal.productTypes, market);
      
      // Check if this user is assigned to this deal based on routing
      if (routing.analyst === userTeamName || 
          routing.developer === userTeamName || 
          routing.partner === userTeamName) {
        assignedDeals.push(deal);
      }
    }
    
    return assignedDeals.map(addFormattedDealId);
  }

  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    // Debug logging for productTypes updates
    if ('productTypes' in updates) {
      console.log(`🗄️ Storage.updateDeal - productTypes being saved to database:`, updates.productTypes);
    }
    
    // FIX (Jan 15, 2026): Debug logging for vintage updates
    if ('vintage' in updates) {
      console.log(`🗓️ Storage.updateDeal - vintage being saved to database:`, updates.vintage, `(type: ${typeof updates.vintage})`);
    }

    // Sanitize updates to handle empty strings for numeric fields
    const sanitizedUpdates: Partial<Deal> = { ...updates };
    
    // Convert empty strings to null for numeric fields
    // FIX (Jan 15, 2026): Added 'vintage' and 'yearBuilt' to numeric fields list
    const numericFields = [
      'unitCount', 'sizeAcres', 'yieldOnCost', 'projectedRentPerSF', 
      'topRentPSF', 'avgRentPSF', 'topRentPerUnit', 'avgRentPerUnit',
      'population55Plus5Mile', 'income75Plus55Plus',
      'vintage', 'yearBuilt'
    ];
    
    numericFields.forEach(field => {
      if (field in sanitizedUpdates && sanitizedUpdates[field as keyof Deal] === '') {
        (sanitizedUpdates as any)[field] = null;
      }
    });
    
    // Convert empty strings to null for other optional fields that might cause issues
    const optionalFields = ['analystNotes', 'rejectionReason', 'propertyName'];
    optionalFields.forEach(field => {
      if (field in sanitizedUpdates && sanitizedUpdates[field as keyof Deal] === '') {
        (sanitizedUpdates as any)[field] = null;
      }
    });
    
    // CRITICAL FIX: Ensure array fields (documentUrls, productTypes) are properly preserved
    // These are already sanitized by the PATCH endpoint, just ensure they pass through correctly
    // The PATCH handler calls sanitizeStringArray() before passing updates here
    if ('documentUrls' in sanitizedUpdates) {
      console.log(`📎 Storage.updateDeal - documentUrls being saved:`, sanitizedUpdates.documentUrls);
    }

    const [deal] = await db
      .update(deals)
      .set({ ...sanitizedUpdates, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();

    // Jan 13, 2026: CRITICAL - Throw error if no rows were updated
    // This catches the case where the ID doesn't match any rows
    if (!deal) {
      console.error(`❌ [STORAGE] updateDeal FAILED - No rows affected for ID: ${id}`);
      console.error(`   This means the deal ID doesn't exist in the database`);
      console.error(`   Updates that were attempted:`, Object.keys(sanitizedUpdates).join(', '));
      throw new Error(`updateDeal failed: No deal found with ID ${id}`);
    }

    // Debug logging for productTypes after database operation
    if ('productTypes' in updates) {
      console.log(`🗄️ Storage.updateDeal - productTypes returned from database:`, deal.productTypes);
    }
    
    // Debug logging for documentUrls after database operation
    if ('documentUrls' in updates) {
      console.log(`📎 Storage.updateDeal - documentUrls returned from database:`, deal.documentUrls);
    }

    return deal;
  }

  async deleteDeal(id: string): Promise<void> {
    console.log(`🗑️ Starting SIMPLIFIED DELETE for deal ${id}`);
    
    try {
      // First verify the deal exists
      const existingDeal = await db.select({ id: deals.id }).from(deals).where(eq(deals.id, id)).limit(1);
      if (existingDeal.length === 0) {
        throw new Error(`Deal ${id} not found`);
      }
      
      // Check which dependent tables exist and have records
      console.log(`🧹 Deleting dependent records for deal ${id}`);
      
      // Delete from existing tables in dependency order
      // Only delete from tables that exist in our schema imports
      
      try {
        await db.delete(viralSignups).where(eq(viralSignups.dealId, id));
        console.log(`✅ Deleted from viral_signups`);
      } catch (error: any) {
        console.log(`⚠️ Error deleting from viral_signups (may not exist):`, error.message);
      }
      
      try {
        await db.delete(communications).where(eq(communications.relatedDealId, id));
        console.log(`✅ Deleted from communications`);
      } catch (error: any) {
        console.log(`⚠️ Error deleting from communications:`, error.message);
      }
      
      try {
        await db.delete(propertyData).where(eq(propertyData.dealId, id));
        console.log(`✅ Deleted from property_data`);
      } catch (error: any) {
        console.log(`⚠️ Error deleting from property_data:`, error.message);
      }
      
      console.log(`✅ Deleted dependent records for deal ${id}`);
      
      // Now delete the deal itself
      const deleteResult = await db.delete(deals).where(eq(deals.id, id)).returning({ id: deals.id });
      
      if (deleteResult.length === 0) {
        throw new Error(`Failed to delete deal ${id} - no rows affected`);
      }
      
      console.log(`✅ Successfully deleted deal ${id} and all dependent records`);
      
    } catch (error) {
      console.error(`❌ DELETE failed for deal ${id}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete deal ${id}: ${errorMessage}`);
    }
  }

  async bulkDeleteDeals(dealIds: string[]): Promise<{
    successCount: number;
    errorCount: number;
    results: Array<{id: string; success: boolean; error?: string}>;
  }> {
    const results: Array<{id: string; success: boolean; error?: string}> = [];
    let successCount = 0;
    let errorCount = 0;

    // Process deals in smaller batches to avoid overwhelming the database
    const batchSize = 5;
    for (let i = 0; i < dealIds.length; i += batchSize) {
      const batch = dealIds.slice(i, i + batchSize);
      
      // Process each deal in the batch sequentially to avoid transaction conflicts
      for (const dealId of batch) {
        try {
          console.log(`🗑️ Deleting deal: ${dealId}`);
          await this.deleteDeal(dealId);
          results.push({ id: dealId, success: true });
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to delete deal ${dealId}:`, error);
          results.push({ 
            id: dealId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          errorCount++;
        }
      }
      
      // Small delay between batches to prevent database overload
      if (i + batchSize < dealIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { successCount, errorCount, results };
  }

  async getDealsWithBrokers(): Promise<(Deal & { broker: Broker })[]> {
    return await db
      .select({
        // All Deal fields that actually exist in schema
        id: deals.id,
        dealNumber: deals.dealNumber,
        brokerId: deals.brokerId,
        address: deals.address,
        city: deals.city,
        state: deals.state,
        zip: deals.zip,
        county: deals.county,
        latitude: deals.latitude,
        longitude: deals.longitude,
        askingPrice: deals.askingPrice,
        sizeAcres: deals.sizeAcres,
        unitCount: deals.unitCount,
        hasEntitlements: deals.hasEntitlements,
        parcelId: deals.parcelId,
        zoning: deals.zoning,
        sewerAvailable: deals.sewerAvailable,
        topRentPSF: deals.topRentPSF,
        avgRentPSF: deals.avgRentPSF,
        topRentPerUnit: deals.topRentPerUnit,
        avgRentPerUnit: deals.avgRentPerUnit,
        productTypes: deals.productTypes,
        dealType: deals.dealType,
        yearBuilt: deals.yearBuilt,
        propertyName: deals.propertyName,
        constructionCostPerSF: deals.constructionCostPerSF,
        projectedRentPerSF: deals.projectedRentPerSF,
        totalProjectCost: deals.totalProjectCost,
        projectedNOI: deals.projectedNOI,
        marketCapRate: deals.marketCapRate,
        yieldOnCost: deals.yieldOnCost,
        irr: deals.irr,
        developmentTimelineMonths: deals.developmentTimelineMonths,
        unitSize: deals.unitSize,
        estimatedUnits: deals.estimatedUnits,
        estimatedRentPSF: deals.estimatedRentPSF,
        estimatedAnnualGrossRent: deals.estimatedAnnualGrossRent,
        population55Plus5Mile: deals.population55Plus5Mile,
        income75Plus55Plus: deals.income75Plus55Plus,
        demographicsNotes: deals.demographicsNotes,
        assignedAnalyst: deals.assignedAnalyst,
        assignedJrAnalyst: deals.assignedJrAnalyst,
        assignedDeveloper: deals.assignedDeveloper,
        assignedPartner: deals.assignedPartner,
        nextSteps: deals.nextSteps,
        brokerNotes: deals.brokerNotes,
        status: deals.status,
        classification: deals.classification,
        qctStatus: deals.qctStatus,
        censusTractFips: deals.censusTractFips,
        comparableNotes: deals.comparableNotes,
        comparableCount: deals.comparableCount,
        comparablesJson: deals.comparablesJson,
        suggestedDevelopmentType: deals.suggestedDevelopmentType,
        statusUpdatedAt: deals.statusUpdatedAt,
        statusUpdatedBy: deals.statusUpdatedBy,
        pipelineStage: deals.pipelineStage,
        timeInCurrentStage: deals.timeInCurrentStage,
        totalPipelineTime: deals.totalPipelineTime,
        stageHistory: deals.stageHistory,
        priority: deals.priority,
        estimatedCloseDate: deals.estimatedCloseDate,
        actualCloseDate: deals.actualCloseDate,
        aiAnalysisData: deals.aiAnalysisData,
        submissionMethod: deals.submissionMethod,
        documentUrls: deals.documentUrls,
        analystNotes: deals.analystNotes,
        developerSummary: deals.developerSummary,
        wetlandNotes: deals.wetlandNotes,
        rejectionReason: deals.rejectionReason,
        calculatedFields: deals.calculatedFields,
        reviewedBy: deals.reviewedBy,
        reviewedAt: deals.reviewedAt,
        isArchived: deals.isArchived,
        archivedAt: deals.archivedAt,
        
        // Deal Flagging System Fields
        flagged: deals.flagged,
        riskLevel: deals.riskLevel,
        confidenceScore: deals.confidenceScore,
        dataQualityIssues: deals.dataQualityIssues,
        validationFlags: deals.validationFlags,
        sourceConflicts: deals.sourceConflicts,
        flaggedAt: deals.flaggedAt,
        flaggedBy: deals.flaggedBy,
        flaggingReason: deals.flaggingReason,
        specificWarnings: deals.specificWarnings,
        estimatedReviewTime: deals.estimatedReviewTime,
        lastValidationAt: deals.lastValidationAt,
        validationHistory: deals.validationHistory,
        analystReviewStatus: deals.analystReviewStatus,
        reviewStartedAt: deals.reviewStartedAt,
        reviewCompletedAt: deals.reviewCompletedAt,
        reviewNotes: deals.reviewNotes,
        dataCorrections: deals.dataCorrections,
        
        // Public Listing Cross-Reference System
        publicListings: deals.publicListings,
        
        // Deal Validation and Blocking System
        validationStatus: deals.validationStatus,
        blockedAt: deals.blockedAt,
        blockedBy: deals.blockedBy,
        validationTimeoutAt: deals.validationTimeoutAt,
        escalatedAt: deals.escalatedAt,
        analystOverride: deals.analystOverride,
        blockingReason: deals.blockingReason,
        analystOverrideBy: deals.analystOverrideBy,
        analystOverrideAt: deals.analystOverrideAt,
        analystOverrideReason: deals.analystOverrideReason,
        forceApproved: deals.forceApproved,
        escalated: deals.escalated,
        
        // Emergency Review System Fields
        emergencyReviewFlag: deals.emergencyReviewFlag,
        emergencyTriggeredAt: deals.emergencyTriggeredAt,
        emergencyReason: deals.emergencyReason,
        
        // Next Assignee and Deal Step dropdown fields (Dec 15, 2025)
        nextAssignee: deals.nextAssignee,
        dealStep: deals.dealStep,
        
        // LIHTC QAP Scoring fields
        lihtcScoreTotal: deals.lihtcScoreTotal,
        lihtcScorePreliminary: deals.lihtcScorePreliminary,
        lihtcCountyIncomeTier: deals.lihtcCountyIncomeTier,
        lihtcUnits30AMI: deals.lihtcUnits30AMI,
        lihtcUnits40AMI: deals.lihtcUnits40AMI,
        lihtcUnits50AMI: deals.lihtcUnits50AMI,
        lihtcNeighborhoodQuality: deals.lihtcNeighborhoodQuality,
        lihtcIsRedevelopment: deals.lihtcIsRedevelopment,
        lihtcAmenityOverrides: deals.lihtcAmenityOverrides,
        lihtcCostPerUnit: deals.lihtcCostPerUnit,
        lihtcScoreBreakdown: deals.lihtcScoreBreakdown,
        lihtcScoredAt: deals.lihtcScoredAt,

        // Fields added over time — were missing from this hardcoded select list
        vintage: deals.vintage,
        underContract: deals.underContract,
        loiSubmitted: deals.loiSubmitted,
        automatedYoc: deals.automatedYoc,
        underwritingState: deals.underwritingState,
        submissionCount: deals.submissionCount,
        lastResubmittedAt: deals.lastResubmittedAt,
        analystDocumentUrls: deals.analystDocumentUrls,
        excelModelUrl: deals.excelModelUrl,
        ingestionNotes: deals.ingestionNotes,
        censusTotalPopulation: deals.censusTotalPopulation,
        censusMedianIncome: deals.censusMedianIncome,
        censusMedianAge: deals.censusMedianAge,
        censusVacancyRate: deals.censusVacancyRate,
        censusRenterRate: deals.censusRenterRate,
        censusPopGrowth: deals.censusPopGrowth,
        censusTractId: deals.censusTractId,
        ozStatus: deals.ozStatus,
        ddaStatus: deals.ddaStatus,
        apex: deals.apex,
        msaName: deals.msaName,
        inTargetMarket: deals.inTargetMarket,
        targetProductTypes: deals.targetProductTypes,
        aiExplanatoryNotes: deals.aiExplanatoryNotes,
        regridData: deals.regridData,
        ownerName: deals.ownerName,
        assessedValue: deals.assessedValue,
        landValue: deals.landValue,
        improvementValue: deals.improvementValue,
        lastSalePrice: deals.lastSalePrice,
        lastSaleDate: deals.lastSaleDate,
        manualLatitude: deals.manualLatitude,
        manualLongitude: deals.manualLongitude,
        manualCoordsSetBy: deals.manualCoordsSetBy,
        manualCoordsSetAt: deals.manualCoordsSetAt,
        manualCoordsReason: deals.manualCoordsReason,
        geocodingAccuracyType: deals.geocodingAccuracyType,
        geocodingAccuracyScore: deals.geocodingAccuracyScore,
        addressConfidence: deals.addressConfidence,
        dealRoomUrl: deals.dealRoomUrl,
        outlookMessageId: deals.outlookMessageId,
        originalSenderEmail: deals.originalSenderEmail,
        originalEmailSubject: deals.originalEmailSubject,

        // Fields added via raw SQL migration — must be explicitly listed here
        dealSummary: deals.dealSummary,
        netDevelopableAcres: deals.netDevelopableAcres,
        apexNotes: deals.apexNotes,
        maxUnitsByZoning: deals.maxUnitsByZoning,
        seniorLoanPct: deals.seniorLoanPct,

        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
        
        // Broker object
        broker: brokers,
      })
      .from(deals)
      .leftJoin(brokers, eq(deals.brokerId, brokers.id))
      .orderBy(desc(deals.createdAt));
  }

  async getAllDealsWithBrokers(): Promise<(Deal & { broker: Broker })[]> {
    try {
      console.log('Starting getAllDealsWithBrokers query...');
      
      // Use a simpler, more reliable query structure
      const allDeals = await db.select().from(deals).orderBy(desc(deals.createdAt));
      console.log('✅ Successfully fetched', allDeals.length, 'deals');
      
      // Fetch brokers separately to avoid complex join issues
      const allBrokers = await db.select().from(brokers);
      console.log('✅ Successfully fetched', allBrokers.length, 'brokers');
      
      // Create a broker lookup map for efficiency
      const brokerMap = new Map();
      allBrokers.forEach(broker => {
        brokerMap.set(broker.id, broker);
      });
      
      // Combine deals with their brokers and construct coordinates object for map
      const dealsWithBrokers = allDeals.map(deal => {
        // Type assertion since latitude/longitude exist in DB but may not be in base type
        const dealData = deal as any;
        return {
          ...deal,
          broker: deal.brokerId ? brokerMap.get(deal.brokerId) || null : null,
          // Construct coordinates object from latitude/longitude for map compatibility
          coordinates: dealData.latitude && dealData.longitude ? {
            lat: parseFloat(dealData.latitude),
            lng: parseFloat(dealData.longitude)
          } : null
        };
      });
      
      console.log('✅ Successfully combined deals with brokers:', dealsWithBrokers.length, 'results');
      return dealsWithBrokers;
      
    } catch (error) {
      console.error('❌ Error in getAllDealsWithBrokers:', error);
      throw error;
    }
  }

  async getDealsWithBrokersPaginated(params: {
    offset: number;
    limit: number;
    search?: string;
    classification?: string;
  }): Promise<{ deals: (Deal & { broker: Broker })[]; total: number }> {
    // Simple implementation using existing method and filtering
    const allDeals = await this.getDealsWithBrokers();
    
    const filteredDeals = allDeals.filter(deal => {
      const matchesSearch = !params.search || 
        deal.address.toLowerCase().includes(params.search.toLowerCase());
      const matchesClassification = !params.classification || deal.classification === params.classification;
      return matchesSearch && matchesClassification;
    });
    
    const total = filteredDeals.length;
    const deals = filteredDeals.slice(params.offset, params.offset + params.limit);
    
    return { deals, total };
  }

  // Communication operations
  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    const [newCommunication] = await db
      .insert(communications)
      .values(communication)
      .returning();
    return newCommunication;
  }

  async getCommunicationsByBrokerId(brokerId: string): Promise<Communication[]> {
    return await db
      .select()
      .from(communications)
      .where(eq(communications.brokerId, brokerId))
      .orderBy(desc(communications.createdAt));
  }

  async getCommunicationsByDealId(dealId: string): Promise<Communication[]> {
    return await db
      .select()
      .from(communications)
      .where(eq(communications.relatedDealId, dealId))
      .orderBy(desc(communications.createdAt));
  }

  async getRecentCommunicationsByDeal(dealId: string, since: Date): Promise<Communication[]> {
    return await db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.relatedDealId, dealId),
          gte(communications.createdAt, since)
        )
      )
      .orderBy(desc(communications.createdAt));
  }

  async getRecentCommunications(limit: number = 50): Promise<(Communication & { broker?: Broker | null })[]> {
    return await db
      .select({
        // Enhanced communications fields
        id: communications.id,
        brokerId: communications.brokerId,
        relatedDealId: communications.relatedDealId,
        email: communications.email,
        phone: communications.phone,
        channel: communications.channel,
        direction: communications.direction,
        rawText: communications.rawText,
        parsedJson: communications.parsedJson,
        missingFields: communications.missingFields,
        status: communications.status,
        followUpCount: communications.followUpCount,
        lastFollowUpAt: communications.lastFollowUpAt,
        providerMessageId: communications.providerMessageId,
        threadKey: communications.threadKey,
        // Legacy fields for backward compatibility
        subject: communications.subject,
        message: communications.message,
        recipientEmail: communications.recipientEmail,
        sentAt: communications.sentAt,
        isArchived: communications.isArchived,
        archivedAt: communications.archivedAt,
        createdAt: communications.createdAt,
        updatedAt: communications.updatedAt,
        resolved: communications.resolved,
        resolvedAt: communications.resolvedAt,
        resolvedFields: communications.resolvedFields,
        broker: brokers,
      })
      .from(communications)
      .leftJoin(brokers, eq(communications.brokerId, brokers.id))
      .orderBy(desc(communications.createdAt))
      .limit(limit);
  }

  async updateCommunication(id: string, updates: Partial<Communication>): Promise<Communication | undefined> {
    const [updated] = await db
      .update(communications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(communications.id, id))
      .returning();
    return updated;
  }

  async getCommunicationByProviderMessageId(providerMessageId: string): Promise<Communication | undefined> {
    const [communication] = await db
      .select()
      .from(communications)
      .where(eq(communications.providerMessageId, providerMessageId));
    return communication;
  }

  async getCommunicationsByThreadKey(threadKey: string): Promise<Communication[]> {
    return await db
      .select()
      .from(communications)
      .where(eq(communications.threadKey, threadKey))
      .orderBy(desc(communications.createdAt));
  }

  // Messaging dashboard operations (two-way SMS conversations)
  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  async getConversationById(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation;
  }

  async getConversationByBrokerId(brokerId: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.brokerId, brokerId))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(1);
    return conversation;
  }

  async getAllConversations(): Promise<(Conversation & { broker: Broker })[]> {
    const results = await db
      .select()
      .from(conversations)
      .leftJoin(brokers, eq(conversations.brokerId, brokers.id))
      .orderBy(desc(conversations.lastMessageAt));
    
    return results.map(result => ({
      ...result.conversations,
      broker: result.brokers!
    }));
  }

  async getActiveConversations(): Promise<(Conversation & { broker: Broker })[]> {
    const results = await db
      .select()
      .from(conversations)
      .leftJoin(brokers, eq(conversations.brokerId, brokers.id))
      .where(eq(conversations.status, 'active'))
      .orderBy(desc(conversations.lastMessageAt));
    
    return results.map(result => ({
      ...result.conversations,
      broker: result.brokers!
    }));
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const [updated] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const [newMessage] = await db
      .insert(conversationMessages)
      .values(message)
      .returning();
    
    // Update conversation lastMessageAt and unreadCount if it's an inbound message
    if (message.direction === 'inbound') {
      await db
        .update(conversations)
        .set({ 
          lastMessageAt: new Date(),
          unreadCount: sql`${conversations.unreadCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(conversations.id, message.conversationId));
    } else {
      // For outbound messages, just update lastMessageAt
      await db
        .update(conversations)
        .set({ 
          lastMessageAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(conversations.id, message.conversationId));
    }
    
    return newMessage;
  }

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.createdAt);
  }

  async updateConversationMessage(id: string, updates: Partial<ConversationMessage>): Promise<ConversationMessage | undefined> {
    const [updated] = await db
      .update(conversationMessages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversationMessages.id, id))
      .returning();
    return updated;
  }

  async getMessageByTwilioSid(twilioMessageSid: string): Promise<ConversationMessage | undefined> {
    const [message] = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.twilioMessageSid, twilioMessageSid));
    return message;
  }

  async deleteConversationMessage(id: string): Promise<boolean> {
    const result = await db
      .delete(conversationMessages)
      .where(eq(conversationMessages.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning();
    return result.length > 0;
  }

  // Analytics operations
  async getAnalytics(): Promise<Analytics | undefined> {
    const [analyticsResult] = await db
      .select()
      .from(analytics)
      .orderBy(desc(analytics.date))
      .limit(1);
    return analyticsResult;
  }

  async updateAnalytics(): Promise<void> {
    // Calculate current analytics
    const [totalDealsResult] = await db.select({ count: count() }).from(deals);
    const [pendingDealsResult] = await db
      .select({ count: count() })
      .from(deals)
      .where(eq(deals.status, "pending_review"));
    const [approvedDealsResult] = await db
      .select({ count: count() })
      .from(deals)
      .where(eq(deals.status, "approved"));
    const [rejectedDealsResult] = await db
      .select({ count: count() })
      .from(deals)
      .where(or(eq(deals.status, "rejected"), eq(deals.status, "clear_no")));
    const [pipelineValueResult] = await db
      .select({ total: sum(deals.totalProjectCost) })
      .from(deals)
      .where(eq(deals.status, "pending_review"));

    await db.insert(analytics).values({
      totalDeals: totalDealsResult.count,
      pendingDeals: pendingDealsResult.count,
      approvedDeals: approvedDealsResult.count,
      rejectedDeals: rejectedDealsResult.count,
      avgReviewTime: "2.3", // Mock for now
      totalPipelineValue: pipelineValueResult.total || "0",
    });
  }

  // Acquisition criteria operations
  async getAllAcquisitionCriteria(): Promise<AcquisitionCriteria[]> {
    return await db.select().from(acquisitionCriteria).orderBy(desc(acquisitionCriteria.createdAt));
  }

  async getAcquisitionCriteria(id: string): Promise<AcquisitionCriteria | undefined> {
    const [criteria] = await db.select().from(acquisitionCriteria).where(eq(acquisitionCriteria.id, id));
    return criteria;
  }

  async createAcquisitionCriteria(criteriaData: InsertAcquisitionCriteria): Promise<AcquisitionCriteria> {
    const [criteria] = await db.insert(acquisitionCriteria).values(criteriaData).returning();
    return criteria;
  }

  async updateAcquisitionCriteria(id: string, updates: Partial<AcquisitionCriteria>): Promise<AcquisitionCriteria | undefined> {
    const [criteria] = await db
      .update(acquisitionCriteria)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(acquisitionCriteria.id, id))
      .returning();
    return criteria;
  }

  async deleteAcquisitionCriteria(id: string): Promise<void> {
    await db.delete(acquisitionCriteria).where(eq(acquisitionCriteria.id, id));
  }



  // Deal tagging and viral loop operations
  async createDealTag(dealTagData: InsertDealTag): Promise<DealTag> {
    const [dealTag] = await db.insert(dealTags).values(dealTagData).returning();
    return dealTag;
  }

  async getDealTagsByDealId(dealId: string): Promise<DealTag[]> {
    return await db.select().from(dealTags).where(eq(dealTags.dealId, dealId));
  }

  async getDealTagsByBrokerId(brokerId: string): Promise<DealTag[]> {
    return await db.select().from(dealTags).where(eq(dealTags.taggerBrokerId, brokerId));
  }

  async updateDealTag(id: string, updates: Partial<DealTag>): Promise<DealTag | undefined> {
    const [dealTag] = await db
      .update(dealTags)
      .set(updates)
      .where(eq(dealTags.id, id))
      .returning();
    return dealTag;
  }

  async createViralSignup(viralSignupData: InsertViralSignup): Promise<ViralSignup> {
    const [viralSignup] = await db.insert(viralSignups).values(viralSignupData).returning();
    return viralSignup;
  }

  // Password reset operations
  async createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db.insert(passwordResetTokens).values(data).returning();
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return resetToken;
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  // Valuation operations
  async createValuation(valuationData: InsertValuation): Promise<Valuation> {
    const [valuation] = await db.insert(valuations).values(valuationData).returning();
    return valuation;
  }

  async getValuationById(id: string): Promise<Valuation | undefined> {
    const [valuation] = await db.select().from(valuations).where(eq(valuations.id, id));
    return valuation;
  }

  async getValuationsByBrokerId(brokerId: string): Promise<Valuation[]> {
    return await db.select().from(valuations).where(eq(valuations.brokerId, brokerId)).orderBy(desc(valuations.createdAt));
  }

  async updateValuation(id: string, updates: Partial<Valuation>): Promise<Valuation | undefined> {
    const [valuation] = await db
      .update(valuations)
      .set(updates)
      .where(eq(valuations.id, id))
      .returning();
    return valuation;
  }

  // Valuation sharing operations
  async createValuationShare(shareData: InsertValuationShare): Promise<ValuationShare> {
    const [share] = await db.insert(valuationShares).values(shareData).returning();
    return share;
  }

  async getValuationSharesByValuationId(valuationId: string): Promise<ValuationShare[]> {
    return await db.select().from(valuationShares).where(eq(valuationShares.valuationId, valuationId));
  }

  async getValuationSharesByBrokerId(brokerId: string): Promise<ValuationShare[]> {
    return await db.select().from(valuationShares).where(eq(valuationShares.sharedByBrokerId, brokerId)).orderBy(desc(valuationShares.createdAt));
  }

  async updateValuationShare(id: string, updates: Partial<ValuationShare>): Promise<ValuationShare | undefined> {
    const [share] = await db
      .update(valuationShares)
      .set(updates)
      .where(eq(valuationShares.id, id))
      .returning();
    return share;
  }

  // Preferred partner operations
  async createPreferredPartner(partnerData: InsertPreferredPartner): Promise<PreferredPartner> {
    const [partner] = await db.insert(preferredPartners).values(partnerData).returning();
    return partner;
  }

  async getPreferredPartnersByBrokerId(brokerId: string): Promise<PreferredPartner[]> {
    return await db.select().from(preferredPartners).where(eq(preferredPartners.brokerId, brokerId)).orderBy(desc(preferredPartners.createdAt));
  }

  async getPreferredPartnersForBroker(brokerId: string): Promise<PreferredPartner[]> {
    // Get partnerships where this broker is the partner (they've been added as preferred by others)
    const broker = await this.getBrokerById(brokerId);
    if (!broker?.email) return [];
    
    return await db.select().from(preferredPartners).where(eq(preferredPartners.partnerEmail, broker.email)).orderBy(desc(preferredPartners.createdAt));
  }

  async updatePreferredPartner(id: string, updates: Partial<PreferredPartner>): Promise<PreferredPartner | undefined> {
    const [partner] = await db
      .update(preferredPartners)
      .set(updates)
      .where(eq(preferredPartners.id, id))
      .returning();
    return partner;
  }

  // Partnership invitation operations
  async createPartnershipInvitation(invitationData: InsertPartnershipInvitation): Promise<PartnershipInvitation> {
    const [invitation] = await db.insert(partnershipInvitations).values(invitationData).returning();
    return invitation;
  }

  async getPartnershipInvitationsByBrokerId(brokerId: string): Promise<PartnershipInvitation[]> {
    return await db.select().from(partnershipInvitations).where(eq(partnershipInvitations.inviterBrokerId, brokerId)).orderBy(desc(partnershipInvitations.createdAt));
  }

  async getPartnershipInvitationsByEmail(email: string): Promise<PartnershipInvitation[]> {
    return await db.select().from(partnershipInvitations).where(eq(partnershipInvitations.inviteeEmail, email)).orderBy(desc(partnershipInvitations.createdAt));
  }

  async updatePartnershipInvitation(id: string, updates: Partial<PartnershipInvitation>): Promise<PartnershipInvitation | undefined> {
    const [invitation] = await db
      .update(partnershipInvitations)
      .set(updates)
      .where(eq(partnershipInvitations.id, id))
      .returning();
    return invitation;
  }

  // Commission earnings operations
  async createCommissionEarning(earningData: InsertCommissionEarning): Promise<CommissionEarning> {
    const [earning] = await db.insert(commissionEarnings).values(earningData).returning();
    return earning;
  }

  async getCommissionEarningsByBrokerId(brokerId: string): Promise<CommissionEarning[]> {
    return await db.select().from(commissionEarnings).where(eq(commissionEarnings.brokerId, brokerId)).orderBy(desc(commissionEarnings.createdAt));
  }

  async getCommissionLeaderboard(limit: number = 10): Promise<Array<{ brokerId: string; brokerName: string; totalCommissions: number; dealCount: number; lastEarning: Date | null; }>> {
    const result = await db
      .select({
        brokerId: commissionEarnings.brokerId,
        brokerName: sql<string>`${brokers.firstName} || ' ' || ${brokers.lastName}`,
        totalCommissions: sum(commissionEarnings.commissionAmount),
        dealCount: count(commissionEarnings.id),
        lastEarning: sql<Date>`MAX(${commissionEarnings.createdAt})`,
      })
      .from(commissionEarnings)
      .innerJoin(brokers, eq(commissionEarnings.brokerId, brokers.id))
      .groupBy(commissionEarnings.brokerId, brokers.firstName, brokers.lastName)
      .orderBy(desc(sum(commissionEarnings.commissionAmount)))
      .limit(limit);

    return result.map(row => ({
      brokerId: row.brokerId,
      brokerName: row.brokerName,
      totalCommissions: Number(row.totalCommissions) || 0,
      dealCount: Number(row.dealCount) || 0,
      lastEarning: row.lastEarning ? new Date(row.lastEarning) : null,
    }));
  }

  async updateCommissionEarning(id: string, updates: Partial<CommissionEarning>): Promise<CommissionEarning | undefined> {
    const [earning] = await db
      .update(commissionEarnings)
      .set(updates)
      .where(eq(commissionEarnings.id, id))
      .returning();
    return earning;
  }

  // ==================================================
  // REFERRAL SYSTEM OPERATIONS
  // ==================================================

  // Referral links operations
  async createReferralLink(linkData: InsertReferralLink): Promise<ReferralLink> {
    const [link] = await db.insert(referralLinks).values(linkData).returning();
    return link;
  }

  async getReferralLinkById(id: string): Promise<ReferralLink | undefined> {
    const [link] = await db.select().from(referralLinks).where(eq(referralLinks.id, id));
    return link;
  }

  async getReferralLinkByCode(code: string): Promise<ReferralLink | undefined> {
    const [link] = await db.select().from(referralLinks).where(eq(referralLinks.referralCode, code));
    return link;
  }

  async getBrokerReferralLinks(brokerId: string): Promise<ReferralLink[]> {
    return await db
      .select()
      .from(referralLinks)
      .where(eq(referralLinks.brokerId, brokerId))
      .orderBy(desc(referralLinks.createdAt));
  }

  async updateReferralLink(id: string, updates: Partial<ReferralLink>): Promise<ReferralLink | undefined> {
    const [link] = await db
      .update(referralLinks)
      .set(updates)
      .where(eq(referralLinks.id, id))
      .returning();
    return link;
  }

  // Referral activities operations
  async createReferralActivity(activityData: InsertReferralActivity): Promise<ReferralActivity> {
    const [activity] = await db.insert(referralActivities).values(activityData).returning();
    return activity;
  }

  async getReferralActivitiesByBroker(brokerId: string): Promise<ReferralActivity[]> {
    return await db
      .select()
      .from(referralActivities)
      .where(eq(referralActivities.referrerBrokerId, brokerId))
      .orderBy(desc(referralActivities.createdAt));
  }

  // Commission splits operations
  async createCommissionSplit(splitData: InsertCommissionSplit): Promise<CommissionSplit> {
    const [split] = await db.insert(commissionSplits).values(splitData).returning();
    return split;
  }

  async getCommissionSplitsByBroker(brokerId: string): Promise<CommissionSplit[]> {
    return await db
      .select()
      .from(commissionSplits)
      .where(
        sql`${commissionSplits.primaryBrokerId} = ${brokerId} OR ${commissionSplits.referrerBrokerId} = ${brokerId}`
      )
      .orderBy(desc(commissionSplits.createdAt));
  }

  async updateCommissionSplit(id: string, updates: Partial<CommissionSplit>): Promise<CommissionSplit | undefined> {
    const [split] = await db
      .update(commissionSplits)
      .set(updates)
      .where(eq(commissionSplits.id, id))
      .returning();
    return split;
  }

  // Broker partnerships operations
  async createBrokerPartnership(partnershipData: InsertBrokerPartnership): Promise<BrokerPartnership> {
    const [partnership] = await db.insert(brokerPartnerships).values(partnershipData).returning();
    return partnership;
  }

  async getBrokerPartnerships(brokerId: string): Promise<BrokerPartnership[]> {
    return await db
      .select()
      .from(brokerPartnerships)
      .where(
        sql`${brokerPartnerships.brokerAId} = ${brokerId} OR ${brokerPartnerships.brokerBId} = ${brokerId}`
      )
      .orderBy(desc(brokerPartnerships.lastActivityAt));
  }

  async updateBrokerPartnership(id: string, updates: Partial<BrokerPartnership>): Promise<BrokerPartnership | undefined> {
    const [partnership] = await db
      .update(brokerPartnerships)
      .set(updates)
      .where(eq(brokerPartnerships.id, id))
      .returning();
    return partnership;
  }

  // Brand settings operations
  async getBrandSettings(): Promise<BrandSettings | undefined> {
    const [settings] = await db.select().from(brandSettings).limit(1);
    return settings;
  }

  async createBrandSettings(settingsData: InsertBrandSettings): Promise<BrandSettings> {
    // First deactivate any existing settings
    await db.update(brandSettings).set({ isActive: false });
    
    // Create new settings as active
    const [settings] = await db
      .insert(brandSettings)
      .values({ ...settingsData, isActive: true })
      .returning();
    return settings;
  }

  async updateBrandSettings(id: string, settingsData: Partial<InsertBrandSettings>): Promise<BrandSettings> {
    const [settings] = await db
      .update(brandSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(brandSettings.id, id))
      .returning();
    return settings;
  }

  async getActiveBrandSettings(): Promise<BrandSettings | undefined> {
    const [settings] = await db
      .select()
      .from(brandSettings)
      .where(eq(brandSettings.isActive, true))
      .limit(1);
    return settings;
  }

  // Business settings operations (simplified template system)
  async getBusinessSettings(): Promise<BusinessSettings> {
    const [settings] = await db
      .select()
      .from(businessSettings)
      .where(eq(businessSettings.isActive, true))
      .limit(1);
    
    if (settings) {
      return settings;
    }
    
    // If no settings exist, create default settings
    const { defaultBusinessSettings } = await import('./memoryBusinessSettings');
    const [newSettings] = await db
      .insert(businessSettings)
      .values({
        emailTemplates: defaultBusinessSettings.emailTemplates,
        smsTemplates: defaultBusinessSettings.smsTemplates,
        acquisitionCriteria: [],
        dealAssignments: [],
        primaryColor: defaultBusinessSettings.primaryColor,
        secondaryColor: defaultBusinessSettings.secondaryColor,
        tertiaryColor: defaultBusinessSettings.tertiaryColor,
        backgroundColor: defaultBusinessSettings.backgroundColor,
        textColor: defaultBusinessSettings.textColor,
        fontFamily: defaultBusinessSettings.fontFamily,
        fontSize: defaultBusinessSettings.fontSize,
        logoUrl: defaultBusinessSettings.logoUrl,
        companyName: defaultBusinessSettings.companyName,
        supportEmail: defaultBusinessSettings.supportEmail,
        supportPhone: defaultBusinessSettings.supportPhone,
        isActive: true
      })
      .returning();
    
    return newSettings;
  }

  async updateBusinessSettings(updates: Partial<BusinessSettings>): Promise<BusinessSettings> {
    // Use transaction to prevent race conditions between deactivate and insert
    return await db.transaction(async (tx) => {
      // Get current settings BEFORE deactivating them
      const [currentSettings] = await tx
        .select()
        .from(businessSettings)
        .where(eq(businessSettings.isActive, true))
        .limit(1);
      
      // Use current settings or defaults
      const settings = currentSettings || await this.getBusinessSettings();
      
      // Deactivate existing settings within transaction
      await tx.update(businessSettings).set({ isActive: false });
      
      // Prepare merged data for insert - jsonb columns handle JSON serialization automatically
      const mergedData = {
        emailTemplates: updates.emailTemplates !== undefined ? updates.emailTemplates : settings.emailTemplates,
        smsTemplates: updates.smsTemplates !== undefined ? updates.smsTemplates : settings.smsTemplates,
        acquisitionCriteria: updates.acquisitionCriteria !== undefined ? updates.acquisitionCriteria : settings.acquisitionCriteria,
        dealAssignments: updates.dealAssignments !== undefined ? updates.dealAssignments : settings.dealAssignments,
        rejectionReasons: updates.rejectionReasons !== undefined ? updates.rejectionReasons : settings.rejectionReasons,
        primaryColor: updates.primaryColor || settings.primaryColor,
        secondaryColor: updates.secondaryColor || settings.secondaryColor,
        tertiaryColor: updates.tertiaryColor || settings.tertiaryColor,
        backgroundColor: updates.backgroundColor || settings.backgroundColor,
        textColor: updates.textColor || settings.textColor,
        fontFamily: updates.fontFamily || settings.fontFamily,
        fontSize: updates.fontSize || settings.fontSize,
        logoUrl: updates.logoUrl !== undefined ? updates.logoUrl : settings.logoUrl,
        companyName: updates.companyName || settings.companyName,
        supportEmail: updates.supportEmail || settings.supportEmail,
        supportPhone: updates.supportPhone || settings.supportPhone,
        // Add missing branding fields
        emailSignature: updates.emailSignature || settings.emailSignature,
        tagline: updates.tagline || settings.tagline,
        buttonStyle: updates.buttonStyle || settings.buttonStyle,
        emailWidth: updates.emailWidth || settings.emailWidth,
        isActive: true
      };
      
      // Insert new active settings within the same transaction
      const [newSettings] = await tx
        .insert(businessSettings)
        .values(mergedData)
        .returning();
      
      return newSettings;
    });
  }

  // Migration: ensure required email templates exist in the active business_settings record.
  // Uses a direct JSONB append so it does NOT create a new row (unlike updateBusinessSettings).
  async ensureMissingEmailTemplates(): Promise<void> {
    try {
      const settings = await this.getBusinessSettings();
      const currentTemplates: any[] = Array.isArray((settings as any).emailTemplates)
        ? (settings as any).emailTemplates
        : [];

      const currentEvents = new Set(currentTemplates.map((t: any) => t.event || t.type || ''));

      // Templates that must exist for broker notifications to work
      const requiredTemplates: any[] = [
        {
          id: '1760032100001',
          name: 'High Priority - Pursuing Deal',
          event: 'status_pursuing',
          subject: 'HIGH PRIORITY: {{address}} - Moving Forward!',
          content: 'Dear {{brokerName}},\n\nExcellent news! Your property at {{address}} has been classified as HIGH PRIORITY and we\'re moving forward immediately.\n\nWhy we\'re excited:\n• Perfect market fit\n• Ideal development potential\n• Strong financial projections\n• Meets all our acquisition criteria\n\nImmediate next steps:\n• Site visit scheduled within 3 business days\n• Direct contact from our acquisitions team within 2 hours\n• Preliminary offer expected within 5-7 business days\n\nTalk soon!\n\nThe Catalyst Acquisitions Team',
        },
      ];

      const missing = requiredTemplates.filter(t => !currentEvents.has(t.event));

      if (missing.length === 0) {
        console.log('✅ [TEMPLATE-MIGRATION] All required email templates present in active record');
        return;
      }

      console.log(`⚠️ [TEMPLATE-MIGRATION] Adding ${missing.length} missing email template(s): ${missing.map(t => t.event).join(', ')}`);

      // Append missing templates directly to the active row without creating a new row
      const updatedTemplates = [...currentTemplates, ...missing];
      await db
        .update(businessSettings)
        .set({ emailTemplates: updatedTemplates } as any)
        .where(eq(businessSettings.isActive, true));

      console.log(`✅ [TEMPLATE-MIGRATION] Successfully added: ${missing.map(t => t.event).join(', ')}`);
    } catch (err) {
      console.error('❌ [TEMPLATE-MIGRATION] Failed to ensure missing email templates:', err);
    }
  }

  // Dec 12, 2025: Update a single business settings field directly (for toggles)
  async updateBusinessSettingsField(field: string, value: any): Promise<void> {
    try {
      // Update directly in the active business settings row
      await db
        .update(businessSettings)
        .set({ [field]: value, updatedAt: new Date() })
        .where(eq(businessSettings.isActive, true));
    } catch (error) {
      console.error(`Error updating business settings field ${field}:`, error);
      throw error;
    }
  }

  // Notification template operations
  async getNotificationTemplate(type: string): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM notification_templates 
        WHERE type = ${type} 
        AND is_active = true 
        LIMIT 1
      `);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting notification template:', error);
      return null;
    }
  }
  
  // PropertyData operations
  async getPropertyDataByDealId(dealId: string): Promise<any | undefined> {
    try {
      const [property] = await db
        .select()
        .from(propertyData)
        .where(eq(propertyData.dealId, dealId))
        .limit(1);
      return property;
    } catch (error) {
      console.error('Error getting property data by deal ID:', error);
      return undefined;
    }
  }
  
  async createPropertyData(data: any): Promise<any> {
    try {
      const [property] = await db
        .insert(propertyData)
        .values({
          dealId: data.dealId,
          coordinates: data.coordinates,
          area: data.area,
          demographics: data.demographics,
          comparables: data.comparables,
          marketTrends: data.marketTrends,
          ...data
        })
        .returning();
      return property;
    } catch (error) {
      console.error('Error creating property data:', error);
      throw error;
    }
  }
  
  async updatePropertyData(id: string, updates: any): Promise<any | undefined> {
    try {
      const [property] = await db
        .update(propertyData)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(propertyData.id, id))
        .returning();
      return property;
    } catch (error) {
      console.error('Error updating property data:', error);
      return undefined;
    }
  }

  // Public listing search operations
  async getLatestPublicListingSearchByDealId(dealId: string): Promise<PublicListingSearch | undefined> {
    const [search] = await db
      .select()
      .from(publicListingSearches)
      .where(eq(publicListingSearches.dealId, dealId))
      .orderBy(desc(publicListingSearches.createdAt))
      .limit(1);
    return search;
  }

  // Public listing source operations - with graceful error handling for deployment
  async getPublicListingSourceByName(name: string): Promise<PublicListingSource | undefined> {
    try {
      const [source] = await db
        .select()
        .from(publicListingSources)
        .where(eq(publicListingSources.sourceName, name as any))
        .limit(1);
      return source;
    } catch (error: any) {
      // Handle missing table/columns during deployment gracefully
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.warn('⚠️ Public listing sources table not available during deployment:', error.message);
        return undefined;
      }
      throw error; // Re-throw other errors
    }
  }

  async createPublicListingSource(source: InsertPublicListingSource): Promise<PublicListingSource | null> {
    try {
      const [newSource] = await db
        .insert(publicListingSources)
        .values(source)
        .returning();
      return newSource;
    } catch (error: any) {
      // Handle missing table during deployment gracefully
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        console.warn('⚠️ Cannot create public listing source during deployment - table not available:', error.message);
        return null;
      }
      throw error; // Re-throw other errors
    }
  }

  async updatePublicListingSourceMetrics(name: string, updates: Partial<PublicListingSource>): Promise<PublicListingSource | undefined> {
    try {
      const [updatedSource] = await db
        .update(publicListingSources)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(publicListingSources.sourceName, name as any))
        .returning();
      return updatedSource;
    } catch (error: any) {
      // Handle missing table/columns during deployment gracefully
      if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('column')) {
        console.warn('⚠️ Cannot update public listing source metrics during deployment - table/column not available:', error.message);
        return undefined;
      }
      throw error; // Re-throw other errors
    }
  }

  // Outreach system operations
  
  // Sender operations
  async getOutreachSenderById(id: string): Promise<{ id: string; name: string; email: string; signatureHtml?: string } | undefined> {
    try {
      const result = await db.execute(sql`
        SELECT id, name, email, signature_html as "signatureHtml"
        FROM outreach_senders
        WHERE id = ${id}
        LIMIT 1
      `);
      const rows = result.rows as any[];
      return rows[0] || undefined;
    } catch (error: any) {
      console.warn('⚠️ Could not fetch outreach sender:', error.message);
      return undefined;
    }
  }
  
  // Campaign operations
  async createOutreachCampaign(campaign: InsertOutreachCampaign): Promise<OutreachCampaign> {
    const [newCampaign] = await db
      .insert(outreachCampaigns)
      .values(campaign)
      .returning();
    return newCampaign;
  }

  async getOutreachCampaignById(id: string): Promise<OutreachCampaign | undefined> {
    const [campaign] = await db
      .select()
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.id, id))
      .limit(1);
    return campaign;
  }

  async getAllOutreachCampaigns(): Promise<OutreachCampaign[]> {
    try {
      // Use select() to get all columns - simpler and more robust
      const campaigns = await db
        .select()
        .from(outreachCampaigns)
        .orderBy(desc(outreachCampaigns.createdAt));
      
      return campaigns;
    } catch (error) {
      console.error('❌ Error fetching outreach campaigns:', error);
      // Return empty array if table doesn't exist yet
      return [];
    }
  }

  async getActiveOutreachCampaigns(): Promise<OutreachCampaign[]> {
    return await db
      .select()
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.status, 'active'))
      .orderBy(desc(outreachCampaigns.createdAt));
  }

  async getDueOutreachCampaigns(): Promise<OutreachCampaign[]> {
    const now = new Date();
    return await db
      .select()
      .from(outreachCampaigns)
      .where(
        and(
          eq(outreachCampaigns.status, 'active'),
          or(
            isNull(outreachCampaigns.nextRunAt),
            sql`${outreachCampaigns.nextRunAt} <= ${now}`
          )
        )
      );
  }

  async updateOutreachCampaign(id: string, updates: Partial<OutreachCampaign>): Promise<OutreachCampaign | undefined> {
    const [updatedCampaign] = await db
      .update(outreachCampaigns)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(outreachCampaigns.id, id))
      .returning();
    return updatedCampaign;
  }

  async deleteOutreachCampaign(id: string): Promise<void> {
    await db
      .delete(outreachCampaigns)
      .where(eq(outreachCampaigns.id, id));
  }

  // Campaign run operations
  async createOutreachRun(run: InsertOutreachRun): Promise<OutreachRun> {
    const [newRun] = await db
      .insert(outreachRuns)
      .values(run)
      .returning();
    return newRun;
  }

  async getOutreachRunById(id: string): Promise<OutreachRun | undefined> {
    const [run] = await db
      .select()
      .from(outreachRuns)
      .where(eq(outreachRuns.id, id))
      .limit(1);
    return run;
  }

  async getOutreachRunsByCampaignId(campaignId: string): Promise<OutreachRun[]> {
    return await db
      .select()
      .from(outreachRuns)
      .where(eq(outreachRuns.campaignId, campaignId))
      .orderBy(desc(outreachRuns.startedAt));
  }

  async getAllOutreachRunsPaginated(params: { offset: number; limit: number }): Promise<{ runs: OutreachRun[]; total: number }> {
    const [totalResult] = await db
      .select({ count: count() })
      .from(outreachRuns);

    const runs = await db
      .select()
      .from(outreachRuns)
      .orderBy(desc(outreachRuns.startedAt))
      .offset(params.offset)
      .limit(params.limit);

    return {
      runs,
      total: totalResult.count
    };
  }

  async updateOutreachRun(id: string, updates: Partial<OutreachRun>): Promise<OutreachRun | undefined> {
    const [updatedRun] = await db
      .update(outreachRuns)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(outreachRuns.id, id))
      .returning();
    return updatedRun;
  }

  // Message operations
  async createOutreachMessage(message: InsertOutreachMessage): Promise<OutreachMessage> {
    const [newMessage] = await db
      .insert(outreachMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  async getOutreachMessageById(id: string): Promise<OutreachMessage | undefined> {
    const [message] = await db
      .select()
      .from(outreachMessages)
      .where(eq(outreachMessages.id, id))
      .limit(1);
    return message;
  }

  async getOutreachMessagesByRunId(runId: string): Promise<OutreachMessage[]> {
    return await db
      .select()
      .from(outreachMessages)
      .where(eq(outreachMessages.runId, runId))
      .orderBy(desc(outreachMessages.createdAt));
  }

  async getOutreachMessagesByCampaignId(campaignId: string): Promise<OutreachMessage[]> {
    return await db
      .select()
      .from(outreachMessages)
      .where(eq(outreachMessages.campaignId, campaignId))
      .orderBy(desc(outreachMessages.createdAt));
  }

  async getAllOutreachMessagesPaginated(params: { offset: number; limit: number }): Promise<{ messages: OutreachMessage[]; total: number }> {
    const [totalResult] = await db
      .select({ count: count() })
      .from(outreachMessages);

    const messages = await db
      .select()
      .from(outreachMessages)
      .orderBy(desc(outreachMessages.createdAt))
      .offset(params.offset)
      .limit(params.limit);

    return {
      messages,
      total: totalResult.count
    };
  }

  async updateOutreachMessage(id: string, updates: Partial<OutreachMessage>): Promise<OutreachMessage | undefined> {
    const [updatedMessage] = await db
      .update(outreachMessages)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(outreachMessages.id, id))
      .returning();
    return updatedMessage;
  }

  // Deduplication helper - check if message already exists for period
  async checkMessageExists(campaignId: string, brokerId: string, channel: string, periodKey: string): Promise<boolean> {
    const [existingMessage] = await db
      .select({ id: outreachMessages.id })
      .from(outreachMessages)
      .where(
        and(
          eq(outreachMessages.campaignId, campaignId),
          eq(outreachMessages.brokerId, brokerId),
          eq(outreachMessages.channel, channel as any),
          eq(outreachMessages.periodKey, periodKey)
        )
      )
      .limit(1);
    
    return !!existingMessage;
  }

  // Get eligible brokers for outreach (active, with contact preferences)
  async getEligibleBrokersForOutreach(brokerFilter: any): Promise<Broker[]> {
    const conditions = [eq(brokers.isActive, true)];
    
    // Apply additional filters from brokerFilter object
    if (brokerFilter.marketsCovered) {
      conditions.push(like(brokers.marketsCovered, `%${brokerFilter.marketsCovered}%`));
    }
    
    if (brokerFilter.yearsExperience) {
      conditions.push(eq(brokers.yearsExperience, brokerFilter.yearsExperience));
    }
    
    if (brokerFilter.brokerage) {
      conditions.push(like(brokers.brokerage, `%${brokerFilter.brokerage}%`));
    }

    return await db
      .select()
      .from(brokers)
      .where(and(...conditions))
      .orderBy(brokers.firstName, brokers.lastName);
  }

  // Email deduplication operations - Permanent storage to prevent SendGrid replays
  async checkEmailProcessed(emailHash: string): Promise<ProcessedEmail | undefined> {
    const [existing] = await db
      .select()
      .from(processedEmails)
      .where(eq(processedEmails.emailHash, emailHash))
      .limit(1);
    return existing;
  }

  async markEmailProcessed(email: InsertProcessedEmail): Promise<ProcessedEmail> {
    const [newRecord] = await db
      .insert(processedEmails)
      .values(email)
      .returning();
    return newRecord;
  }

  // SMS deduplication operations - Permanent storage to prevent Twilio webhook retries
  async checkSMSProcessed(messageSid: string): Promise<ProcessedSMS | undefined> {
    const [existing] = await db
      .select()
      .from(processedSMS)
      .where(eq(processedSMS.messageSid, messageSid))
      .limit(1);
    return existing;
  }

  async markSMSProcessed(sms: InsertProcessedSMS): Promise<ProcessedSMS | null> {
    // CRITICAL: Use onConflictDoNothing to make insert atomic
    // This prevents race conditions when concurrent Twilio retries arrive
    const [result] = await db
      .insert(processedSMS)
      .values(sms)
      .onConflictDoNothing()
      .returning();
    
    // If result is undefined, the insert was a no-op (duplicate MessageSid)
    // Return null to signal this was a duplicate
    return result || null;
  }

  // Background job operations - Async processing to prevent webhook timeouts
  async createBackgroundJob(job: InsertBackgroundJob): Promise<BackgroundJob> {
    const [newJob] = await db
      .insert(backgroundJobs)
      .values(job)
      .returning();
    return newJob;
  }

  async getBackgroundJobById(id: string): Promise<BackgroundJob | undefined> {
    const [job] = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, id))
      .limit(1);
    return job;
  }

  async getPendingJobs(limit: number = 10): Promise<BackgroundJob[]> {
    return await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.status, 'pending'),
          lte(backgroundJobs.scheduledFor, new Date())
        )
      )
      .orderBy(backgroundJobs.createdAt)
      .limit(limit);
  }

  async updateBackgroundJob(id: string, updates: Partial<BackgroundJob>): Promise<BackgroundJob | undefined> {
    const [updatedJob] = await db
      .update(backgroundJobs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, id))
      .returning();
    return updatedJob;
  }

  // Site evaluation operations - LIHTC scoring storage
  async createSiteEvaluation(evaluation: InsertSiteEvaluation): Promise<SiteEvaluation> {
    const [newEval] = await db
      .insert(siteEvaluations)
      .values(evaluation)
      .returning();
    return newEval;
  }

  async getSiteEvaluationById(id: string): Promise<SiteEvaluation | undefined> {
    const [evaluation] = await db
      .select()
      .from(siteEvaluations)
      .where(eq(siteEvaluations.id, id))
      .limit(1);
    return evaluation;
  }

  async getSiteEvaluationByDealId(dealId: string): Promise<SiteEvaluation | undefined> {
    const [evaluation] = await db
      .select()
      .from(siteEvaluations)
      .where(eq(siteEvaluations.dealId, dealId))
      .orderBy(desc(siteEvaluations.evaluatedAt))
      .limit(1);
    return evaluation;
  }

  async getAllSiteEvaluations(): Promise<SiteEvaluation[]> {
    return await db
      .select()
      .from(siteEvaluations)
      .orderBy(desc(siteEvaluations.evaluatedAt));
  }

  async getSiteEvaluationsSummary(): Promise<Array<{ dealId: string | null; address: string; scoreTotal: number | null; evaluatedAt: Date | null }>> {
    return await db
      .select({
        dealId: siteEvaluations.dealId,
        address: siteEvaluations.address,
        scoreTotal: siteEvaluations.scoreTotal,
        evaluatedAt: siteEvaluations.evaluatedAt,
      })
      .from(siteEvaluations)
      .orderBy(desc(siteEvaluations.evaluatedAt));
  }

  async updateSiteEvaluation(id: string, updates: Partial<SiteEvaluation>): Promise<SiteEvaluation | undefined> {
    const [updatedEval] = await db
      .update(siteEvaluations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(siteEvaluations.id, id))
      .returning();
    return updatedEval;
  }

  // Partner Developer Network
  async createPartnerDeveloper(data: InsertPartnerDeveloper): Promise<PartnerDeveloper> {
    const [record] = await db.insert(partnerDevelopers).values(data).returning();
    return record;
  }

  async getAllPartnerDevelopers(): Promise<PartnerDeveloper[]> {
    return db.select().from(partnerDevelopers).orderBy(desc(partnerDevelopers.createdAt));
  }

  async getActivePartnerDevelopers(): Promise<PartnerDeveloper[]> {
    return db.select().from(partnerDevelopers)
      .where(eq(partnerDevelopers.isActive, true))
      .orderBy(desc(partnerDevelopers.createdAt));
  }

  // Off-Market Sourcing
  async createOffMarketImport(data: InsertOffMarketImport): Promise<OffMarketImport> {
    const [record] = await db.insert(offMarketImports).values(data).returning();
    return record;
  }

  async getAllOffMarketImports(): Promise<OffMarketImport[]> {
    return db.select().from(offMarketImports).orderBy(desc(offMarketImports.importedAt));
  }

  async deleteOffMarketImport(id: string): Promise<void> {
    await db.delete(offMarketImports).where(eq(offMarketImports.id, id));
  }

  async insertOffMarketProperties(rows: InsertOffMarketProperty[]): Promise<void> {
    if (rows.length === 0) return;
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await db.insert(offMarketProperties).values(chunk);
    }
  }

  async getOffMarketProperties(filters: {
    importId?: string;
    county?: string;
    band?: string;
    ownerType?: string;
    isAbsentee?: boolean;
    isOutOfState?: boolean;
    permitType?: string;
    search?: string;
    minScore?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: OffMarketProperty[]; total: number }> {
    const conditions = [];
    if (filters.importId) conditions.push(eq(offMarketProperties.importId, filters.importId));
    if (filters.county) conditions.push(eq(offMarketProperties.county, filters.county));
    if (filters.band) conditions.push(eq(offMarketProperties.band, filters.band));
    if (filters.ownerType) conditions.push(eq(offMarketProperties.ownerType, filters.ownerType));
    if (filters.isAbsentee !== undefined) conditions.push(eq(offMarketProperties.isAbsentee, filters.isAbsentee));
    if (filters.isOutOfState !== undefined) conditions.push(eq(offMarketProperties.isOutOfState, filters.isOutOfState));
    if (filters.permitType) conditions.push(eq(offMarketProperties.permitType, filters.permitType));
    if (filters.minScore !== undefined) conditions.push(gte(offMarketProperties.score, filters.minScore));
    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`lower(${offMarketProperties.ownerName})`, term),
          like(sql`lower(${offMarketProperties.propertyAddress})`, term),
          like(sql`lower(${offMarketProperties.ownerAddress})`, term),
        )
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const [rows, totalResult] = await Promise.all([
      db.select().from(offMarketProperties)
        .where(whereClause)
        .orderBy(desc(offMarketProperties.score))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(offMarketProperties).where(whereClause),
    ]);

    return { rows, total: totalResult[0]?.count ?? 0 };
  }

  async getOffMarketCounties(): Promise<string[]> {
    const rows = await db.selectDistinct({ county: offMarketProperties.county }).from(offMarketProperties);
    return rows.map(r => r.county).filter(Boolean).sort();
  }
}

export const storage = new DatabaseStorage();

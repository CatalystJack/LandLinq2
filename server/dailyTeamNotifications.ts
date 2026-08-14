import cron from 'node-cron';
import { sendNotificationEmail } from './emailService';

interface TeamMember {
  name: string;
  email: string;
  role: string;
}

interface DealSummary {
  id: string;
  address: string;
  classification: string;
  createdAt: string;
  assignedJrAnalyst?: string;
  assignedAnalyst?: string;
  assignedDeveloper?: string;
  assignedPartner?: string;
  unitCount?: number;
  sizeAcres?: number;
  askingPrice?: number;
  brokerName?: string;
  brokerEmail?: string;
  needsReview: boolean;
}

// Team member mappings for email addresses
const TEAM_MEMBER_EMAILS: { [key: string]: string } = {
  'Austin Blondell': 'austin@catalystcp.com',
  'Davis Hammond': 'davis@catalystcp.com', 
  'Steve Hillebrand': 'steve@catalystcp.com',
  'John Bell': 'john@catalystcp.com',
  'Mallie Colavita': 'mallie@catalystcp.com',
  'AJ Klenk': 'aj@catalystcp.com',
  'Brian Ford': 'brian@catalystcp.com',
  'Ted Hill': 'ted@catalystcp.com',
  'Jack Berg': 'jack@catalystcp.com'
};

// Team members who should ALWAYS receive daily digest (regardless of deal assignments)
// NOTE: Only internal analysts, not brokers who submit deals
const ALWAYS_NOTIFY_MEMBERS: string[] = [
  // Jack Berg removed - he's a broker and shouldn't receive team digests
];

// Senior team members who receive the comprehensive senior team digest
// NOTE: Only internal team members, not brokers
const SENIOR_TEAM_MEMBERS = [
  'Austin Blondell',  // Senior Analyst
  'Steve Hillebrand', // Developer
  'John Bell',        // Developer
  'Mallie Colavita',  // Developer
  'AJ Klenk',         // Partner
  'Brian Ford'        // Partner
  // Jack Berg removed - he's a broker and shouldn't receive internal team digests
];

/**
 * Daily Team Notification System
 * Runs every day at 6:00 AM Eastern Time to send team members their assigned deals
 */
export class DailyTeamNotifications {
  
  /**
   * Validate that all assignable team members have email mappings
   */
  static validateTeamMemberEmails(): void {
    const assignableMembers = [
      'Austin Blondell', // Analyst
      'John Bell',       // Developer
      'Steve Hillebrand', // Developer
      'Mallie Colavita', // Developer
      'AJ Klenk',        // Partner
      'Brian Ford'       // Partner
    ];

    const missingEmails = assignableMembers.filter(member => !TEAM_MEMBER_EMAILS[member]);
    
    if (missingEmails.length > 0) {
      console.error('❌ CRITICAL: Missing email mappings for:', missingEmails);
      console.error('❌ These team members will NOT receive daily digest emails!');
      console.error('❌ Update TEAM_MEMBER_EMAILS in server/dailyTeamNotifications.ts');
    } else {
      console.log('✅ All assignable team members have email mappings');
      console.log(`✅ Validated ${assignableMembers.length} team members:`, assignableMembers.join(', '));
    }
  }
  
  static start() {
    console.log('📅 Daily team notification scheduler RE-ENABLED - daily digest only, no individual deal emails');
    
    // Validate email mappings on startup
    this.validateTeamMemberEmails();
    
    // Schedule for 6:00 AM Eastern Time every day - DAILY DIGEST ONLY
    // During EDT (Mar-Nov): 6 AM EDT = 10 AM UTC  
    // During EST (Nov-Mar): 6 AM EST = 11 AM UTC
    // Using 10 AM UTC to align with EDT (most of the year)
    cron.schedule('0 10 * * *', async () => {
      console.log('🌅 6:00 AM Eastern Time - Starting daily team digest (NO individual deal emails)...');
      await this.sendDailyTeamDigest();
    });
    
    // For testing - daily digest only
    console.log('📧 Daily digest ENABLED - individual deal emails DISABLED per user rule');
  }
  
  /**
   * Send daily digest emails to all team members
   */
  static async sendDailyTeamDigest(): Promise<void> {
    try {
      console.log('📊 Generating daily team digest (individual deal emails DISABLED)...');
      
      // Get deals from last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentDeals = await this.getRecentDeals(twentyFourHoursAgo);
      
      console.log(`📈 Found ${recentDeals.length} deals from last 24 hours`);
      
      if (recentDeals.length === 0) {
        console.log('📭 No deals in last 24 hours - skipping team notifications');
        return;
      }
      
      // Group deals by team member
      const dealsByTeamMember = this.groupDealsByTeamMember(recentDeals);
      
      // Send personalized emails to each team member - DAILY DIGEST ONLY
      for (const [memberName, memberDeals] of Object.entries(dealsByTeamMember)) {
        if (memberDeals.length > 0) {
          await this.sendMemberDigest(memberName, memberDeals);
        }
      }
      
      // Send digest to members who should ALWAYS be notified (even with no assigned deals)
      for (const memberName of ALWAYS_NOTIFY_MEMBERS) {
        if (!dealsByTeamMember[memberName] || dealsByTeamMember[memberName].length === 0) {
          console.log(`📧 Sending comprehensive digest to always-notify member: ${memberName}`);
          // Send all recent deals as comprehensive overview
          await this.sendMemberDigest(memberName, recentDeals, true);
        }
      }
      
      // Send senior team digest to all senior members
      await this.sendSeniorTeamDigest(recentDeals);
      
      console.log('✅ Daily team digest sent successfully (individual deal emails remain disabled)');
      
    } catch (error) {
      console.error('❌ Failed to send daily team digest:', error);
    }
  }
  
  /**
   * Get deals from the last 24 hours
   */
  static async getRecentDeals(since: Date): Promise<DealSummary[]> {
    try {
      const { storage } = await import('./storage');
      const allDealsWithBrokers = await storage.getDealsWithBrokers();
      
      const recentDeals = allDealsWithBrokers
        .filter(dealWithBroker => dealWithBroker.createdAt && new Date(dealWithBroker.createdAt) >= since)
        .map(dealWithBroker => ({
          id: dealWithBroker.id,
          address: dealWithBroker.address || 'Address not provided',
          classification: dealWithBroker.classification || 'unclassified',
          createdAt: dealWithBroker.createdAt ? dealWithBroker.createdAt.toString() : new Date().toISOString(),
          assignedJrAnalyst: dealWithBroker.assignedJrAnalyst || undefined,
          assignedAnalyst: dealWithBroker.assignedAnalyst || undefined,
          assignedDeveloper: dealWithBroker.assignedDeveloper || undefined,
          assignedPartner: dealWithBroker.assignedPartner || undefined,
          unitCount: dealWithBroker.unitCount || undefined,
          sizeAcres: dealWithBroker.sizeAcres ? Number(dealWithBroker.sizeAcres) : undefined,
          askingPrice: undefined, // Deal value not available in join result
          brokerName: dealWithBroker.broker ? `${dealWithBroker.broker.firstName} ${dealWithBroker.broker.lastName || ''}`.trim() : 'Unknown',
          brokerEmail: dealWithBroker.broker?.email || 'No email',
          needsReview: ['yellow'].includes(dealWithBroker.classification?.toLowerCase() || '')
        }));
      
      return recentDeals;
      
    } catch (error) {
      console.error('❌ Error fetching recent deals:', error);
      return [];
    }
  }
  
  /**
   * Group deals by team member (analyst, developer, partner)
   */
  static groupDealsByTeamMember(deals: DealSummary[]): { [memberName: string]: DealSummary[] } {
    const dealsByMember: { [memberName: string]: DealSummary[] } = {};
    
    deals.forEach(deal => {
      // Add to junior analyst
      if (deal.assignedJrAnalyst) {
        if (!dealsByMember[deal.assignedJrAnalyst]) {
          dealsByMember[deal.assignedJrAnalyst] = [];
        }
        dealsByMember[deal.assignedJrAnalyst].push(deal);
      }
      
      // Add to analyst
      if (deal.assignedAnalyst) {
        if (!dealsByMember[deal.assignedAnalyst]) {
          dealsByMember[deal.assignedAnalyst] = [];
        }
        dealsByMember[deal.assignedAnalyst].push(deal);
      }
      
      // Add to developer
      if (deal.assignedDeveloper) {
        if (!dealsByMember[deal.assignedDeveloper]) {
          dealsByMember[deal.assignedDeveloper] = [];
        }
        dealsByMember[deal.assignedDeveloper].push(deal);
      }
      
      // Add to partner
      if (deal.assignedPartner) {
        if (!dealsByMember[deal.assignedPartner]) {
          dealsByMember[deal.assignedPartner] = [];
        }
        dealsByMember[deal.assignedPartner].push(deal);
      }
    });
    
    return dealsByMember;
  }
  
  /**
   * Send daily digest email to a team member using template from outreach management
   */
  static async sendMemberDigest(memberName: string, deals: DealSummary[], isComprehensive: boolean = false): Promise<void> {
    try {
      const memberEmail = TEAM_MEMBER_EMAILS[memberName];
      
      if (!memberEmail) {
        console.error(`❌ CRITICAL: No email mapping found for team member: "${memberName}"`);
        console.error(`❌ This team member will NOT receive daily digest!`);
        console.error(`❌ Add "${memberName}": "email@catalystcp.com" to TEAM_MEMBER_EMAILS`);
        return;
      }
      
      console.log(`📬 Preparing digest for: ${memberName} → ${memberEmail}`);
      
      // Get template from outreach management - ZERO hardcoded content allowed
      const { storage } = await import('./storage');
      const businessSettings = await storage.getBusinessSettings();
      const emailTemplates = (businessSettings as any)?.emailTemplates || [];
      const template = emailTemplates.find((tmpl: any) => tmpl.event === 'daily_digest_analyst');
      
      if (!template) {
        console.error('❌ CRITICAL: daily_digest_analyst template not found in outreach management');
        return;
      }
      
      // Separate deals needing review vs all assigned deals
      const dealsNeedingReview = deals.filter(deal => deal.needsReview);
      const totalDeals = deals.length;
      
      if (isComprehensive) {
        console.log(`📧 Sending comprehensive digest to ${memberName} (${memberEmail}): ${totalDeals} total deals (no specific assignments)`);
      } else {
        console.log(`📧 Sending digest to ${memberName} (${memberEmail}): ${totalDeals} deals, ${dealsNeedingReview.length} need review`);
      }
      
      // Build summary data for template variables
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const dealsSummary = `Total Deals: ${totalDeals}\nNeeds Review: ${dealsNeedingReview.length}`;
      const pendingActions = dealsNeedingReview.length > 0 
        ? `${dealsNeedingReview.length} deal${dealsNeedingReview.length === 1 ? '' : 's'} need your review`
        : 'All deals have been reviewed';
      
      // Replace template variables
      let emailHtml = template.html || '';
      let emailSubject = template.subject || '';
      
      emailHtml = emailHtml.replace(/\{\{analystName\}\}/g, memberName);
      emailHtml = emailHtml.replace(/\{\{date\}\}/g, today);
      emailHtml = emailHtml.replace(/\{\{dealsSummary\}\}/g, dealsSummary);
      emailHtml = emailHtml.replace(/\{\{pendingActions\}\}/g, pendingActions);
      emailHtml = emailHtml.replace(/\{\{logoUrl\}\}/g, businessSettings?.logoUrl || '');
      emailHtml = emailHtml.replace(/\{\{contactEmail\}\}/g, businessSettings?.supportEmail || '');
      emailHtml = emailHtml.replace(/\{\{contactPhone\}\}/g, businessSettings?.supportPhone || '');
      
      emailSubject = emailSubject.replace(/\{\{analystName\}\}/g, memberName);
      emailSubject = emailSubject.replace(/\{\{date\}\}/g, today);
      
      await sendNotificationEmail({
        to: memberEmail,
        subject: emailSubject,
        html: emailHtml,
        type: 'deal_alert',
        priority: dealsNeedingReview.length > 0 ? 'high' : 'medium'
      }, true);
      
      console.log(`✅ Daily digest sent to ${memberName}`);
      
    } catch (error) {
      console.error(`❌ Failed to send digest to ${memberName}:`, error);
    }
  }
  
  // REMOVED: generateDigestEmail() - All templates now come from Outreach Management tab exclusively
  // ZERO hardcoded HTML allowed per user requirements
  
  /**
   * Send senior team digest using template from businessSettings
   * Sends to ANYONE tagged in a deal from last 24 hours (Mallie, AJ, Brian, John, Steve, Austin)
   */
  static async sendSeniorTeamDigest(recentDeals: DealSummary[]): Promise<void> {
    try {
      console.log('👔 Collecting all team members tagged in deals from last 24 hours...');
      
      // Collect ALL unique team members tagged in recent deals
      const taggedMembers = new Set<string>();
      
      recentDeals.forEach(deal => {
        if (deal.assignedJrAnalyst) taggedMembers.add(deal.assignedJrAnalyst);
        if (deal.assignedAnalyst) taggedMembers.add(deal.assignedAnalyst);
        if (deal.assignedDeveloper) taggedMembers.add(deal.assignedDeveloper);
        if (deal.assignedPartner) taggedMembers.add(deal.assignedPartner);
      });
      
      const taggedMembersList = Array.from(taggedMembers);
      console.log(`📧 Found ${taggedMembersList.length} unique team members tagged in deals:`, taggedMembersList.join(', '));
      
      if (taggedMembersList.length === 0) {
        console.log('📭 No team members tagged in recent deals - skipping senior digest');
        return;
      }
      
      // Get business settings and template
      const { defaultBusinessSettings } = await import('./memoryBusinessSettings');
      const settings = defaultBusinessSettings;
      const emailTemplates = settings.emailTemplates as any[];
      const template = emailTemplates.find((t: any) => t.event === 'daily_digest_senior');
      
      if (!template) {
        console.log('⚠️ No senior team digest template found - skipping');
        return;
      }
      
      const today = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Send to each tagged team member with their assigned deals
      for (const memberName of taggedMembersList) {
        const memberEmail = TEAM_MEMBER_EMAILS[memberName];
        
        if (!memberEmail) {
          console.log(`⚠️ No email found for team member: ${memberName} - skipping digest`);
          continue;
        }
        
        // Filter deals for this specific member (only their assignments)
        const memberDeals = recentDeals.filter(deal => 
          deal.assignedJrAnalyst === memberName ||
          deal.assignedAnalyst === memberName || 
          deal.assignedDeveloper === memberName || 
          deal.assignedPartner === memberName
        );
        
        if (memberDeals.length === 0) {
          console.log(`📭 No deals assigned to ${memberName} (shouldn't happen) - skipping`);
          continue;
        }
        
        // Pipeline summary for this member's deals
        const greenDeals = memberDeals.filter(d => d.classification === 'green').length;
        const yellowDeals = memberDeals.filter(d => d.classification === 'yellow').length;
        const orangeDeals = memberDeals.filter(d => d.classification === 'orange').length;
        const redDeals = memberDeals.filter(d => d.classification === 'red').length;
        const unclassifiedDeals = memberDeals.filter(d => !d.classification || d.classification === 'unclassified').length;
        
        const pipelineSummary = `Your Assigned Deals:\nTotal Deals: ${memberDeals.length}\n🟢 High Priority: ${greenDeals}\n🟡 Potential: ${yellowDeals}\n🟠 Under Review: ${orangeDeals}\n🔴 Not a Fit: ${redDeals}\n⚪ Unclassified: ${unclassifiedDeals}`;
        
        // High priority deals for this member
        const highPriorityDeals = memberDeals
          .filter(d => d.classification === 'green')
          .map(d => `• ${d.address} - ${d.sizeAcres ? d.sizeAcres + ' acres' : ''} ${d.askingPrice ? '- $' + d.askingPrice.toLocaleString() : ''} (${d.brokerName})`)
          .join('\n') || 'No high priority deals';
        
        // Team actions required for this member's deals
        const needsReview = memberDeals.filter(d => ['yellow', 'orange', 'unclassified'].includes(d.classification || '')).length;
        const teamActions = needsReview > 0 
          ? `${needsReview} deal${needsReview === 1 ? '' : 's'} require your review and classification`
          : 'All your deals have been classified';
        
        // Replace template variables
        let emailHtml = template.html;
        let emailSubject = template.subject;
        
        emailHtml = emailHtml.replace(/\{\{date\}\}/g, today);
        emailHtml = emailHtml.replace(/\{\{pipelineSummary\}\}/g, pipelineSummary);
        emailHtml = emailHtml.replace(/\{\{highPriorityDeals\}\}/g, highPriorityDeals);
        emailHtml = emailHtml.replace(/\{\{teamActions\}\}/g, teamActions);
        emailHtml = emailHtml.replace(/\{\{logoUrl\}\}/g, settings.logoUrl || '');
        emailHtml = emailHtml.replace(/\{\{contactEmail\}\}/g, settings.supportEmail || '');
        emailHtml = emailHtml.replace(/\{\{contactPhone\}\}/g, settings.supportPhone || '');
        
        emailSubject = emailSubject.replace(/\{\{date\}\}/g, today);
        
        await sendNotificationEmail({
          to: memberEmail,
          subject: emailSubject,
          html: emailHtml,
          type: 'deal_alert',
          priority: greenDeals > 0 ? 'high' : 'medium'
        }, true);
        
        console.log(`✅ Senior team digest sent to ${memberName} (${memberEmail}): ${memberDeals.length} assigned deals`);
      }
      
    } catch (error) {
      console.error('❌ Failed to send senior team digest:', error);
    }
  }
  
  /**
   * Manual trigger for testing (can be called via API)
   */
  static async testDailyDigest(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🧪 Testing daily digest generation...');
      await this.sendDailyTeamDigest();
      return {
        success: true,
        message: 'Test daily digest sent successfully'
      };
    } catch (error) {
      console.error('❌ Test daily digest failed:', error);
      return {
        success: false,
        message: 'Test daily digest failed',
        details: error
      };
    }
  }
}

// Auto-start when module is imported
// DailyTeamNotifications.start();
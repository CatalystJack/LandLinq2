import { storage } from './storage.js';
import { TemplateService } from './templateService.js';
import { sendNotificationEmail } from './emailService.js';
import * as cron from 'node-cron';

/**
 * Daily Morning Report System - 6AM Daily
 * 
 * WORKFLOW:
 * 1. Junior Analyst gets ALL new deals awaiting product type assignment at 6AM
 * 2. Senior team (analyst/developer/partner) get their assigned deals at 6AM (until red/green)
 */

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

export class DailyMorningReports {
  
  /**
   * Start the 6AM daily email scheduler
   */
  static startDailyScheduler() {
    console.log('📅 Starting daily morning report scheduler for 6:00 AM EST');
    
    // Run every day at 6:00 AM EST (11:00 UTC)
    cron.schedule('0 6 * * *', async () => {
      try {
        console.log('🌅 Running daily morning reports at 6:00 AM');
        
        // Send reports in parallel for efficiency
        await Promise.all([
          DailyMorningReports.sendJuniorAnalystReport(),
          DailyMorningReports.sendSeniorTeamReports()
        ]);
        
        console.log('✅ Daily morning reports completed successfully');
      } catch (error) {
        console.error('❌ Error sending daily morning reports:', error);
      }
    }, {
      timezone: "America/New_York" // EST/EDT
    });
    
    console.log('✅ Daily morning report scheduler started (6:00 AM EST)');
  }
  
  /**
   * Send report to ALL junior analysts with unassigned deals
   */
  static async sendJuniorAnalystReport(): Promise<void> {
    try {
      console.log('👨‍💼 Preparing junior analyst morning report');
      
      // Get all users with "Junior Analyst" deal role
      const juniorAnalysts = await storage.getUsersByDealRole('Junior Analyst');
      
      if (juniorAnalysts.length === 0) {
        console.log('ℹ️ No junior analysts found - skipping junior analyst report');
        return;
      }
      
      // Get all deals awaiting product type assignment (unclassified)
      const unassignedDeals = await storage.getUnassignedDeals();
      
      const reportDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Prepare deal summaries
      const newDealsAwaitingAssignment = unassignedDeals
        .filter(deal => {
          if (!deal.createdAt) return false;
          const createdAt = new Date(deal.createdAt);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          return createdAt >= yesterday;
        })
        .map(deal => this.formatDealSummary(deal))
        .join('\\n\\n');
        
      const olderUnassignedDeals = unassignedDeals
        .filter(deal => {
          if (!deal.createdAt) return false;
          const createdAt = new Date(deal.createdAt);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          return createdAt < yesterday;
        })
        .map(deal => this.formatDealSummary(deal))
        .join('\\n\\n');
      
      // Send to each junior analyst
      for (const analyst of juniorAnalysts) {
        const templateVariables = {
          analystName: `${analyst.firstName || ''} ${analyst.lastName || ''}`.trim() || analyst.email,
          reportDate,
          newUnassignedDeals: unassignedDeals.filter(d => {
            if (!d.createdAt) return false;
            const createdAt = new Date(d.createdAt);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return createdAt >= yesterday;
          }).length.toString(),
          totalPendingAssignment: unassignedDeals.length.toString(),
          newDealsAwaitingAssignment: newDealsAwaitingAssignment || 'No new deals awaiting assignment',
          olderUnassignedDeals: olderUnassignedDeals || 'No older unassigned deals',
          dashboardUrl: `${process.env.REPL_SLUG ? `https://${process.env.REPL_ID || process.env.REPL_SLUG}.${process.env.REPL_OWNER || 'replit'}.repl.co` : 'https://landlinq.ai'}/analyst-dashboard`
        };
        
        const template = await TemplateService.getEmailTemplate('Junior Analyst Daily Digest', templateVariables);
        
        // CRITICAL: Get raw template to check for sendgridTemplateId
        const rawTemplate = await getRawEmailTemplate('junior_analyst_daily_digest');
        
        if (template) {
          await sendNotificationEmail({
            to: analyst.email,
            subject: template.subject,
            html: template.html,
            text: template.content,
            type: 'daily_report',
            priority: 'high',
            sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
            sendgridDynamicData: rawTemplate?.sendgridTemplateId ? templateVariables : undefined
          });
          
          const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
          console.log(`📧 Junior analyst report sent to ${analyst.email} via ${templateMode}`);
        } else {
          console.error('❌ No daily_digest_analyst template configured');
        }
      }
      
    } catch (error) {
      console.error('❌ Error sending junior analyst report:', error);
    }
  }
  
  /**
   * Send reports to senior team members (analyst/developer/partner) with their assigned deals
   */
  static async sendSeniorTeamReports(): Promise<void> {
    try {
      console.log('👨‍💼 Preparing senior team morning reports');
      
      // Get all senior team members (analyst, developer, partner deal roles)
      const seniorTeamMembers = await storage.getUsersByDealRoles([
        'Senior Finance Associate',
        'Managing Partner', 
        'Regional Development Partner',
        'Development Partner',
        'Senior Analyst'
      ]);
      
      if (seniorTeamMembers.length === 0) {
        console.log('ℹ️ No senior team members found - skipping senior team reports');
        return;
      }
      
      const reportDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Send report to each senior team member
      for (const teamMember of seniorTeamMembers) {
        const memberName = `${teamMember.firstName || ''} ${teamMember.lastName || ''}`.trim() || teamMember.email;
        
        // Get deals assigned to this team member (not red/green classified)
        const assignedDeals = await storage.getDealsAssignedToTeamMember(teamMember.id);
        const activeDeals = assignedDeals.filter(deal => 
          deal.classification !== 'red' && deal.classification !== 'green'
        );
        
        // Format deal data
        const yourAssignedDeals = activeDeals
          .map(deal => this.formatDealSummary(deal))
          .join('\\n\\n');
          
        const priorityActions = activeDeals
          .filter(deal => deal.classification === 'yellow' || this.isOverdue(deal))
          .map(deal => `• ${deal.address} - ${this.getPriorityReason(deal)}`)
          .join('\\n');
        
        const templateVariables = {
          teamMemberName: memberName,
          reportDate,
          productType: this.getTeamMemberProductTypes(teamMember).join(', ') || 'All Types',
          teamRole: this.formatRole(teamMember.dealRole || 'Team Member'),
          activeDealsCount: activeDeals.length.toString(),
          dealsAwaitingReview: activeDeals.filter(d => d.status === 'pending_review').length.toString(),
          pipelineSummary: yourAssignedDeals || 'No active deals assigned to you',
          highPriorityDeals: priorityActions || 'No priority actions needed',
          dashboardUrl: `${process.env.REPL_SLUG ? `https://${process.env.REPL_ID || process.env.REPL_SLUG}.${process.env.REPL_OWNER || 'replit'}.repl.co` : 'https://landlinq.ai'}/analyst-dashboard`
        };
        
        const template = await TemplateService.getEmailTemplate('Senior Team Daily Digest', templateVariables);
        
        // CRITICAL: Get raw template to check for sendgridTemplateId
        const rawTemplate = await getRawEmailTemplate('daily_digest_senior');
        
        if (template) {
          await sendNotificationEmail({
            to: teamMember.email,
            subject: template.subject,
            html: template.html,
            text: template.content,
            type: 'daily_report',
            priority: 'medium',
            sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
            sendgridDynamicData: rawTemplate?.sendgridTemplateId ? templateVariables : undefined
          });
          
          const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
          console.log(`📧 Senior team report sent to ${teamMember.email} (${teamMember.dealRole}) via ${templateMode}`);
        } else {
          console.error('❌ No daily_digest_senior template configured');
        }
      }
      
    } catch (error) {
      console.error('❌ Error sending senior team reports:', error);
    }
  }
  
  /**
   * Format deal summary for emails
   */
  private static formatDealSummary(deal: any): string {
    const price = deal.askingPrice ? `$${deal.askingPrice.toLocaleString()}` : 'Price TBD';
    const acres = deal.sizeAcres ? `${deal.sizeAcres} acres` : 'Size TBD';
    const status = deal.classification?.replace('_', ' ').toUpperCase() || 'UNCLASSIFIED';
    const submittedDate = new Date(deal.createdAt).toLocaleDateString();
    
    return `📍 ${deal.address}
💰 ${price} | 🌾 ${acres} | 📊 ${status}
📅 Submitted: ${submittedDate}
🏢 Product: ${deal.productTypes?.join(', ') || 'TBD'}
👤 Contact: ${deal.contactName || 'TBD'}`;
  }
  
  /**
   * Check if deal is overdue for response
   */
  private static isOverdue(deal: any): boolean {
    const createdAt = new Date(deal.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation > 48; // Overdue if more than 48 hours
  }
  
  /**
   * Get priority reason for deal
   */
  private static getPriorityReason(deal: any): string {
    if (deal.classification === 'high_priority') return 'High Priority Classification';
    if (this.isOverdue(deal)) return 'Overdue Response (48+ hours)';
    return 'Needs Review';
  }
  
  /**
   * Get product types for team member from their user profile
   */
  private static getTeamMemberProductTypes(teamMember: any): string[] {
    // Use productTypes from user profile if available
    if (teamMember.productTypes && teamMember.productTypes.length > 0) {
      return teamMember.productTypes;
    }
    
    // Fallback for team members without configured product types
    return ['All Types'];
  }
  
  /**
   * Format role name for display
   */
  private static formatRole(role: string): string {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Send super admin report to Jack with all new deals, team assignments, AND system health
   */
  static async sendSuperAdminReport(): Promise<void> {
    try {
      console.log('👑 Preparing super admin morning report with system health');
      
      const reportDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Get all deals created in the last 24 hours
      const allDeals = await storage.getAllDeals();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const newDeals = allDeals.filter(deal => {
        if (!deal.createdAt) return false;
        const createdAt = new Date(deal.createdAt);
        return createdAt >= yesterday;
      });
      
      // =============== SYSTEM HEALTH SECTION ===============
      let systemHealthSection = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      systemHealthSection += '📊 SYSTEM HEALTH & OUTREACH STATUS\n';
      systemHealthSection += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      
      try {
        // Get outreach senders status
        const { db } = await import('./db.js');
        const { sql } = await import('drizzle-orm');
        
        const sendersResult = await db.execute(sql`
          SELECT name, email, warmup_stage, sending_paused, paused_reason, is_active,
                 daily_limit_override
          FROM outreach_senders
          WHERE is_active = true
          ORDER BY name
        `);
        const senders = (sendersResult.rows || sendersResult) as any[];
        
        // Get today's sent counts per sender
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        systemHealthSection += '📧 OUTREACH SENDERS:\n';
        for (const sender of senders) {
          const sentResult = await db.execute(sql`
            SELECT COUNT(*) as count FROM outreach_messages om
            JOIN outreach_runs r ON om.run_id = r.id
            JOIN outreach_campaigns c ON r.campaign_id = c.id
            WHERE c.sender_id = ${sender.id}
              AND om.created_at >= ${today}
              AND om.status = 'sent'
          `);
          const sentToday = parseInt((sentResult.rows?.[0] as any)?.count || '0');
          
          const warmupStage = sender.warmup_stage || 1;
          const limits: Record<number, number> = { 1: 40, 2: 60, 3: 80, 4: 100, 5: 120 };
          const dailyLimit = sender.daily_limit_override || limits[warmupStage] || 40;
          
          const statusIcon = sender.sending_paused ? '🛑' : '✅';
          const pauseReason = sender.sending_paused ? ` (PAUSED: ${sender.paused_reason})` : '';
          
          systemHealthSection += `   ${statusIcon} ${sender.name}: Stage ${warmupStage}, ${sentToday}/${dailyLimit} sent today${pauseReason}\n`;
        }
        
        // Get recent API errors (last 24 hours)
        const apiErrorsResult = await db.execute(sql`
          SELECT service, COUNT(*) as error_count
          FROM api_call_logs
          WHERE created_at >= ${yesterday}
            AND (success = false OR status_code >= 400)
          GROUP BY service
          ORDER BY error_count DESC
          LIMIT 5
        `);
        const apiErrors = (apiErrorsResult.rows || apiErrorsResult) as any[];
        
        if (apiErrors.length > 0) {
          systemHealthSection += '\n⚠️ API ERRORS (last 24h):\n';
          for (const error of apiErrors) {
            systemHealthSection += `   • ${error.service}: ${error.error_count} errors\n`;
          }
        } else {
          systemHealthSection += '\n✅ API STATUS: No errors in last 24 hours\n';
        }
        
        // Get API costs (last 24 hours)
        const apiCostResult = await db.execute(sql`
          SELECT SUM(estimated_cost) as total_cost
          FROM api_call_logs
          WHERE created_at >= ${yesterday}
        `);
        const totalApiCost = parseFloat((apiCostResult.rows?.[0] as any)?.total_cost || '0').toFixed(2);
        systemHealthSection += `\n💰 API COSTS (24h): $${totalApiCost}\n`;
        
        // Get outreach campaign runs (last 24 hours)
        const campaignRunsResult = await db.execute(sql`
          SELECT c.name, r.status, r.email_count, r.sms_count, r.created_at
          FROM outreach_runs r
          JOIN outreach_campaigns c ON r.campaign_id = c.id
          WHERE r.created_at >= ${yesterday}
          ORDER BY r.created_at DESC
          LIMIT 5
        `);
        const recentRuns = (campaignRunsResult.rows || campaignRunsResult) as any[];
        
        if (recentRuns.length > 0) {
          systemHealthSection += '\n📬 RECENT OUTREACH RUNS:\n';
          for (const run of recentRuns) {
            const statusIcon = run.status === 'completed' ? '✅' : run.status === 'failed' ? '❌' : '⏳';
            systemHealthSection += `   ${statusIcon} ${run.name}: ${run.email_count || 0} emails, ${run.sms_count || 0} SMS\n`;
          }
        }
        
        // Get broker count and recent signups
        const brokerCountResult = await db.execute(sql`
          SELECT COUNT(*) as total FROM brokers
        `);
        const newBrokerCountResult = await db.execute(sql`
          SELECT COUNT(*) as new_count FROM brokers WHERE created_at >= ${yesterday}
        `);
        const totalBrokers = (brokerCountResult.rows?.[0] as any)?.total || 0;
        const newBrokers = (newBrokerCountResult.rows?.[0] as any)?.new_count || 0;
        
        systemHealthSection += `\n👥 BROKERS: ${totalBrokers} total (${newBrokers} new in 24h)\n`;
        
      } catch (healthError) {
        console.error('⚠️ Error gathering system health:', healthError);
        systemHealthSection += '⚠️ Could not retrieve some system health metrics\n';
      }
      
      systemHealthSection += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      
      // Team members to track
      const teamEmails = [
        'steve@catalystcp.com',
        'mallie@catalystcp.com', 
        'john@catalystcp.com',
        'austin@catalystcp.com',
        'ford@catalystcp.com', // Brian Ford
        'aj@catalystcp.com'
      ];
      
      // Get deals assigned to team members
      const teamAssignments: { [key: string]: any[] } = {};
      
      for (const email of teamEmails) {
        const user = await storage.getUserByEmail(email);
        if (user) {
          const assignedDeals = await storage.getDealsAssignedToTeamMember(user.id);
          const activeAssignments = assignedDeals.filter(deal => {
            if (!deal.createdAt) return false;
            const createdAt = new Date(deal.createdAt);
            return createdAt >= yesterday;
          });
          
          if (activeAssignments.length > 0) {
            teamAssignments[email] = activeAssignments;
          }
        }
      }
      
      // Format new deals summary
      const newDealsSummary = newDeals
        .map(deal => this.formatDealSummary(deal))
        .join('\n\n') || 'No new deals in the last 24 hours';
      
      // Format team assignments summary
      let teamAssignmentsSummary = '';
      for (const [email, deals] of Object.entries(teamAssignments)) {
        const userName = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
        teamAssignmentsSummary += `\n${userName} (${deals.length} deals):\n`;
        teamAssignmentsSummary += deals.map(deal => `  • ${deal.address || 'No address'} - ${deal.classification || 'unclassified'}`).join('\n');
        teamAssignmentsSummary += '\n';
      }
      
      if (!teamAssignmentsSummary) {
        teamAssignmentsSummary = 'No new team assignments in the last 24 hours';
      }
      
      const template = await TemplateService.getEmailTemplate('Super Admin Daily Digest', {
        adminName: 'Jack',
        reportDate,
        totalNewDeals: newDeals.length.toString(),
        newDealsSummary,
        teamAssignmentsSummary,
        systemHealthSection,
        dashboardUrl: `${process.env.REPL_SLUG ? `https://${process.env.REPL_ID || process.env.REPL_SLUG}.${process.env.REPL_OWNER || 'replit'}.repl.co` : 'https://landlinq.ai'}/analyst-dashboard`
      });
      
      if (template) {
        // Ensure system health section is included in the email
        // Convert to HTML-safe format with line breaks
        const healthHtml = systemHealthSection
          .replace(/\n/g, '<br>')
          .replace(/━/g, '─')
          .replace(/✅/g, '✅')
          .replace(/❌/g, '❌')
          .replace(/⚠️/g, '⚠️')
          .replace(/🛑/g, '🛑')
          .replace(/📧/g, '📧')
          .replace(/📬/g, '📬')
          .replace(/👥/g, '👥')
          .replace(/💰/g, '💰');
        
        // Append system health section to email HTML (before closing tags)
        let enhancedHtml = template.html || '';
        if (!enhancedHtml.includes('SYSTEM HEALTH')) {
          // Insert before </body> or at the end
          const insertPoint = enhancedHtml.lastIndexOf('</body>');
          if (insertPoint > -1) {
            enhancedHtml = enhancedHtml.slice(0, insertPoint) + 
              `<div style="font-family: monospace; background-color: #f8f9fa; padding: 20px; margin-top: 20px; border-radius: 8px; white-space: pre-wrap;">${healthHtml}</div>` +
              enhancedHtml.slice(insertPoint);
          } else {
            enhancedHtml += `<div style="font-family: monospace; background-color: #f8f9fa; padding: 20px; margin-top: 20px; border-radius: 8px; white-space: pre-wrap;">${healthHtml}</div>`;
          }
        }
        
        await sendNotificationEmail({
          to: 'jack@catalystcp.com',
          subject: `${template.subject} + System Health`,
          html: enhancedHtml,
          text: template.content + systemHealthSection,
          type: 'daily_report',
          priority: 'high'
        });
        
        console.log('📧 Super admin report with system health sent to jack@catalystcp.com');
      } else {
        // Fallback: send system health even without template
        console.log('⚠️ No template found, sending system health report directly');
        
        const fallbackHtml = `
          <h2>🌅 LandLinq Daily System Report</h2>
          <p>Date: ${reportDate}</p>
          <h3>📊 New Deals: ${newDeals.length}</h3>
          <pre>${newDealsSummary}</pre>
          <h3>👥 Team Assignments</h3>
          <pre>${teamAssignmentsSummary}</pre>
          <div style="font-family: monospace; background-color: #f8f9fa; padding: 20px; margin-top: 20px; border-radius: 8px; white-space: pre-wrap;">${systemHealthSection}</div>
        `;
        
        await sendNotificationEmail({
          to: 'jack@catalystcp.com',
          subject: `🌅 LandLinq Daily Report - ${reportDate}`,
          html: fallbackHtml,
          text: `LandLinq Daily Report\n\nNew Deals: ${newDeals.length}\n${newDealsSummary}\n\nTeam Assignments:\n${teamAssignmentsSummary}\n${systemHealthSection}`,
          type: 'daily_report',
          priority: 'high'
        });
        
        console.log('📧 Fallback system health report sent to jack@catalystcp.com');
      }
      
    } catch (error) {
      console.error('❌ Error sending super admin report:', error);
    }
  }
}
import * as cron from 'node-cron';
import { storage } from './storage';
import { createWeeklyReport } from './weeklyReportGenerator';
import { sendNotificationEmail } from './emailService';

/**
 * Weekly Report Scheduler - Every Monday at 6 AM EST
 * 
 * Sends comprehensive weekly deal pipeline reports to ALL @catalystcp.com emails
 * Uses the 'weekly_report' template from Outreach Management
 */
export class WeeklyReportScheduler {
  
  /**
   * Start the Monday 6 AM weekly report scheduler
   */
  static start() {
    console.log('📅 Weekly report scheduler started - Mondays at 6:00 AM EST');
    
    // Schedule for every Monday at 6:00 AM Eastern Time
    // Cron: 0 6 * * 1 (where 1 = Monday)
    cron.schedule('0 6 * * 1', async () => {
      console.log('📊 Monday 6:00 AM EST - Sending weekly reports to all @catalystcp.com emails...');
      await this.sendWeeklyReports();
    }, {
      timezone: "America/New_York" // EST/EDT automatic conversion
    });
    
    console.log('✅ Weekly report scheduler enabled - All @catalystcp.com emails will receive reports every Monday at 6 AM EST');
  }
  
  /**
   * Generate and send weekly reports to all @catalystcp.com emails
   */
  static async sendWeeklyReports(): Promise<void> {
    try {
      console.log('📊 Generating weekly deal pipeline report...');
      
      // Generate the report using the template from Outreach Management
      const report = await createWeeklyReport();
      
      if (!report || !report.subject || !report.html) {
        console.error('❌ CRITICAL: Weekly report template "weekly_report" not configured in Outreach Management');
        console.error('❌ Create a template with event type "weekly_report" or "Weekly Report" in the Outreach Management tab');
        return;
      }
      
      // Get all users with @catalystcp.com emails
      const allUsers = await storage.getAllUsers();
      const catalystTeam = allUsers.filter(user => 
        user.email && user.email.toLowerCase().includes('@catalystcp.com')
      );
      
      if (catalystTeam.length === 0) {
        console.log('ℹ️ No @catalystcp.com users found - skipping weekly report');
        return;
      }
      
      console.log(`📧 Sending weekly report to ${catalystTeam.length} @catalystcp.com recipients...`);
      
      // Send report to each team member
      const sendPromises = catalystTeam.map(async (user) => {
        try {
          await sendNotificationEmail({
            to: user.email,
            subject: report.subject,
            html: report.html,
            type: 'weekly_report',
            priority: 'medium'
          });
          
          console.log(`✅ Weekly report sent to: ${user.email}`);
        } catch (error) {
          console.error(`❌ Failed to send weekly report to ${user.email}:`, error);
        }
      });
      
      await Promise.all(sendPromises);
      
      console.log(`✅ Weekly reports sent successfully to ${catalystTeam.length} team members`);
      
    } catch (error) {
      console.error('❌ Error sending weekly reports:', error);
    }
  }
  
  /**
   * Manually trigger weekly report (for testing)
   */
  static async triggerManually(): Promise<void> {
    console.log('🧪 Manually triggering weekly report...');
    await this.sendWeeklyReports();
  }
}

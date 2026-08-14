import cron from 'node-cron';
import { sendNotificationEmail } from './emailService';
import { comprehensiveAuditService } from './comprehensiveAudit';

/**
 * Weekly Improvement Report System
 * Sends platform suggestions and improvements every Monday at 6 AM Eastern to Jack
 */
export class WeeklyImprovementReport {
  
  start() {
    console.log('📅 Weekly improvement report scheduler started - Mondays at 6 AM Eastern');
    
    // Schedule for every Monday at 6:00 AM Eastern Time
    // During EDT (Mar-Nov): 6 AM EDT = 10 AM UTC  
    // During EST (Nov-Mar): 6 AM EST = 11 AM UTC
    // Using 10 AM UTC (cron: 0 10 * * 1 where 1 = Monday)
    cron.schedule('0 10 * * 1', async () => {
      console.log('📊 Monday 6:00 AM Eastern - Generating weekly improvement report for Jack...');
      await this.sendWeeklyReport();
    });
    
    console.log('✅ Weekly improvement report enabled - jack@catalystcp.com will receive suggestions every Monday at 6 AM');
  }
  
  /**
   * Generate and send weekly improvement report
   */
  async sendWeeklyReport(): Promise<void> {
    try {
      console.log('🔍 Running comprehensive audit for weekly report...');
      
      // Run fresh audit to get current state
      const auditResults = await comprehensiveAuditService.performComprehensiveAudit();
      
      const critical = auditResults.issues.filter(i => i.severity === "critical");
      const high = auditResults.issues.filter(i => i.severity === "high");
      const medium = auditResults.issues.filter(i => i.severity === "medium");
      const prioritizedRecs = this.generatePrioritizedRecommendations(auditResults);
      
      const subject = `📊 LandLinq Weekly Suggestions - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      
      const htmlContent = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 700px; margin: 0 auto; background: #f9fafb; padding: 20px;">
  <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <h1 style="color: #1e40af; margin: 0 0 10px 0; font-size: 28px;">
      📊 LandLinq Weekly Suggestions
    </h1>
    <p style="color: #6b7280; margin: 0 0 25px 0; font-size: 14px;">
      ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    </p>
    
    <!-- Platform Health Score -->
    <div style="background: ${auditResults.overallScore >= 80 ? '#dcfce7' : auditResults.overallScore >= 60 ? '#fef3c7' : '#fecaca'}; 
                padding: 20px; border-radius: 10px; margin: 0 0 25px 0; text-align: center;">
      <div style="font-size: 48px; font-weight: bold; color: ${auditResults.overallScore >= 80 ? '#16a34a' : auditResults.overallScore >= 60 ? '#d97706' : '#dc2626'}; margin-bottom: 5px;">
        ${auditResults.overallScore}/100
      </div>
      <div style="font-size: 16px; color: #374151; font-weight: 500;">
        Platform Health Score
      </div>
    </div>

    <!-- Quick Stats -->
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 25px;">
      <div style="background: #fee2e2; padding: 15px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #dc2626;">${critical.length}</div>
        <div style="font-size: 12px; color: #7f1d1d; text-transform: uppercase;">Critical</div>
      </div>
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #d97706;">${high.length}</div>
        <div style="font-size: 12px; color: #92400e; text-transform: uppercase;">High Priority</div>
      </div>
    </div>

    ${critical.length > 0 ? `
    <!-- Critical Issues -->
    <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #dc2626; font-size: 18px;">🚨 Critical Issues</h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${critical.map(issue => `
          <li style="margin: 10px 0; color: #7f1d1d;">
            <strong>${issue.title}</strong><br>
            <span style="font-size: 14px;">${issue.description}</span><br>
            <span style="color: #16a34a; font-size: 13px; font-style: italic;">💡 ${issue.solution}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    ${high.length > 0 ? `
    <!-- High Priority -->
    <div style="background: #fef3c7; border-left: 4px solid #d97706; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #d97706; font-size: 18px;">🔥 High Priority</h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${high.slice(0, 5).map(issue => `
          <li style="margin: 10px 0; color: #92400e;">
            <strong>${issue.title}</strong><br>
            <span style="font-size: 14px;">${issue.description}</span><br>
            <span style="color: #16a34a; font-size: 13px; font-style: italic;">💡 ${issue.solution}</span>
          </li>
        `).join('')}
        ${high.length > 5 ? `<li style="font-style: italic; color: #92400e; margin-top: 10px;">...and ${high.length - 5} more high priority items</li>` : ''}
      </ul>
    </div>
    ` : ''}

    <!-- This Week's Suggestions -->
    <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">💡 This Week's Suggestions</h3>
      
      ${prioritizedRecs.mustFix.length > 0 ? `
      <div style="margin-bottom: 15px;">
        <div style="font-weight: bold; color: #dc2626; margin-bottom: 8px;">🔴 Must Fix This Week:</div>
        <ul style="margin: 0; padding-left: 20px;">
          ${prioritizedRecs.mustFix.slice(0, 3).map(rec => `<li style="margin: 5px 0; color: #374151; font-size: 14px;">${rec}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      ${prioritizedRecs.shouldFix.length > 0 ? `
      <div style="margin-bottom: 15px;">
        <div style="font-weight: bold; color: #d97706; margin-bottom: 8px;">🟡 Should Consider:</div>
        <ul style="margin: 0; padding-left: 20px;">
          ${prioritizedRecs.shouldFix.slice(0, 3).map(rec => `<li style="margin: 5px 0; color: #374151; font-size: 14px;">${rec}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      ${prioritizedRecs.niceToHave.length > 0 ? `
      <div>
        <div style="font-weight: bold; color: #16a34a; margin-bottom: 8px;">🟢 Cool Ideas for Later:</div>
        <ul style="margin: 0; padding-left: 20px;">
          ${prioritizedRecs.niceToHave.slice(0, 3).map(rec => `<li style="margin: 5px 0; color: #374151; font-size: 14px;">${rec}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    ${auditResults.overallScore >= 80 ? `
    <!-- All Good Message -->
    <div style="background: #dcfce7; padding: 20px; border-radius: 8px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 10px;">🎉</div>
      <div style="color: #166534; font-size: 18px; font-weight: 500;">
        Platform Looking Great!
      </div>
      <p style="color: #166534; margin: 10px 0 0 0; font-size: 14px;">
        No urgent issues this week. Keep up the excellent work!
      </p>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 13px;">
        📊 LandLinq Weekly Improvement Report<br>
        Delivered every Monday at 6:00 AM Eastern<br>
        ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>
  </div>
</div>
`;

      // Send to Jack
      await sendNotificationEmail({
        to: 'jack@catalystcp.com',
        subject,
        html: htmlContent,
        text: `LandLinq Weekly Suggestions - ${new Date().toLocaleDateString()}\n\nPlatform Health: ${auditResults.overallScore}/100\n\nCritical Issues: ${critical.length}\nHigh Priority: ${high.length}\nMedium Priority: ${medium.length}`
      });
      
      console.log('✅ Weekly improvement report sent to jack@catalystcp.com');
      
    } catch (error) {
      console.error('❌ Failed to send weekly improvement report:', error);
    }
  }
  
  /**
   * Generate prioritized recommendations for weekly report
   */
  private generatePrioritizedRecommendations(auditResults: any): {
    mustFix: string[];
    shouldFix: string[];
    niceToHave: string[];
  } {
    const mustFix: string[] = [];
    const shouldFix: string[] = [];
    const niceToHave: string[] = [];
    
    const critical = auditResults.issues.filter((i: any) => i.severity === "critical");
    const high = auditResults.issues.filter((i: any) => i.severity === "high");
    const medium = auditResults.issues.filter((i: any) => i.severity === "medium");
    
    // Must Fix (Critical + Top High Priority)
    critical.forEach((issue: any) => {
      mustFix.push(`${issue.title} - ${issue.solution}`);
    });
    
    high.slice(0, 3).forEach((issue: any) => {
      mustFix.push(`${issue.title} - ${issue.solution}`);
    });
    
    // Should Fix (Remaining High + Top Medium)
    high.slice(3).forEach((issue: any) => {
      shouldFix.push(`${issue.title} - ${issue.solution}`);
    });
    
    medium.slice(0, 5).forEach((issue: any) => {
      shouldFix.push(`${issue.title} - ${issue.solution}`);
    });
    
    // Nice to Have (Feature Ideas)
    niceToHave.push("Add dark mode theme support");
    niceToHave.push("Create advanced data visualization dashboard");
    niceToHave.push("Add Slack/Teams integration for notifications");
    niceToHave.push("Implement predictive deal scoring based on historical data");
    niceToHave.push("Build custom report builder for analysts");
    
    return { mustFix, shouldFix, niceToHave };
  }
}

export const weeklyImprovementReport = new WeeklyImprovementReport();

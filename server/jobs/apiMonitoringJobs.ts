import cron from 'node-cron';
import { ApiMonitoringService } from '../apiMonitoringService.js';
import { sendNotificationEmail } from '../emailService.js';

export class ApiMonitoringJobs {
  private static apiMonitoringJobStarted = false;
  private static recentAlerts: Map<string, number> = new Map(); // Prevent alert spam

  /**
   * Send instant alert when a critical API or connection fails
   * Call this from any service when a failure is detected
   */
  static async sendInstantFailureAlert(params: {
    service: string;
    error: string;
    severity: 'warning' | 'critical';
    context?: string;
  }): Promise<void> {
    const { service, error, severity, context } = params;
    const alertKey = `${service}:${error.substring(0, 50)}`;
    
    // Prevent sending same alert more than once per hour
    const lastAlert = this.recentAlerts.get(alertKey);
    if (lastAlert && Date.now() - lastAlert < 60 * 60 * 1000) {
      console.log(`[API-ALERT] Skipping duplicate alert for ${service} (sent ${Math.round((Date.now() - lastAlert) / 60000)} mins ago)`);
      return;
    }
    
    this.recentAlerts.set(alertKey, Date.now());
    
    const severityEmoji = severity === 'critical' ? '🚨' : '⚠️';
    const subject = `${severityEmoji} ${severity.toUpperCase()}: ${service} API/Connection Failed`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${severity === 'critical' ? '#dc3545' : '#ffc107'}; color: ${severity === 'critical' ? 'white' : 'black'}; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">${severityEmoji} API Failure Alert</h1>
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #ddd; border-top: none;">
          <h2 style="color: #333; margin-top: 0;">Service: ${service}</h2>
          <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 0;"><strong>Error:</strong></p>
            <pre style="background: #333; color: #f8f8f2; padding: 10px; border-radius: 4px; overflow-x: auto;">${error}</pre>
          </div>
          ${context ? `<p><strong>Context:</strong> ${context}</p>` : ''}
          <p style="margin-top: 20px; color: #666;">This alert was triggered because an API or service connection failed. If this is a trial service, you may need to upgrade or renew your subscription.</p>
        </div>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px;">
          <p>LandLinq API Monitoring • Instant Failure Alert</p>
        </div>
      </div>
    `;
    
    console.log(`[API-ALERT] ${severity.toUpperCase()}: ${service} failed - ${error} (email alerts disabled)`);

  }

  /**
   * Start API monitoring cron jobs
   */
  static startApiMonitoringJobs(): void {
    if (this.apiMonitoringJobStarted) {
      console.log('⚠️ API monitoring jobs already running');
      return;
    }

    console.log('🚀 Starting API monitoring job scheduler...');

    // Daily API health check at 8 AM EST
    // Schedule: 0 8 * * * = Every day at 8:00 AM
    cron.schedule('0 8 * * *', async () => {
      try {
        console.log('⏰ Running daily API health check...');
        const results = await ApiMonitoringService.checkAllApis();
        
        if (results.needsAttention) {
          console.log('⚠️ API health check: issues detected (email alerts disabled)');
        } else {
          console.log('✅ All APIs healthy');
        }
        
        console.log('✅ Daily API health check completed successfully');
      } catch (error) {
        console.error('❌ Error in daily API health check:', error);
      }
    }, {
      timezone: 'America/New_York' // EST/EDT timezone
    });

    // Weekly comprehensive report (Monday 9 AM EST) - even if healthy
    // Schedule: 0 9 * * 1 = Every Monday at 9:00 AM
    cron.schedule('0 9 * * 1', async () => {
      try {
        console.log('⏰ Running weekly comprehensive API report...');
        const results = await ApiMonitoringService.checkAllApis();
        
        const report = ApiMonitoringService.generateEmailReport(
          results.versionChecks,
          results.healthChecks
        );
        
        console.log('✅ Weekly API report completed (email disabled)');
      } catch (error) {
        console.error('❌ Error in weekly API report:', error);
      }
    }, {
      timezone: 'America/New_York'
    });

    // Daily API cost report at 6 AM EST
    // Schedule: 0 6 * * * = Every day at 6:00 AM
    cron.schedule('0 6 * * *', async () => {
      try {
        console.log('⏰ Running daily API cost report...');
        await this.sendDailyCostReport();
        console.log('✅ Daily API cost report completed successfully');
      } catch (error) {
        console.error('❌ Error in daily API cost report:', error);
      }
    }, {
      timezone: 'America/New_York' // EST/EDT timezone
    });

    this.apiMonitoringJobStarted = true;
    console.log('✅ API monitoring job scheduler started successfully');
    console.log('📋 Scheduled jobs:');
    console.log('   • Daily 6 AM EST: API cost report (last 24 hours)');
    console.log('   • Daily 8 AM EST: API health check (alerts only if issues)');
    console.log('   • Weekly Monday 9 AM EST: Comprehensive report (always sent)');
  }

  /**
   * Manual API health check (for admin dashboard)
   */
  static async runManualHealthCheck(): Promise<{
    versionChecks: any[];
    healthChecks: any[];
    needsAttention: boolean;
  }> {
    console.log('🔍 Running manual API health check...');
    const results = await ApiMonitoringService.checkAllApis();
    console.log('✅ Manual health check completed');
    return results;
  }

  /**
   * Send manual report to Jack (for admin dashboard)
   */
  static async sendManualReport(): Promise<void> {
    console.log('📧 Sending manual API health report...');
    const results = await ApiMonitoringService.checkAllApis();
    
    const report = ApiMonitoringService.generateEmailReport(
      results.versionChecks,
      results.healthChecks
    );
    
    await sendNotificationEmail({
      to: 'jack@catalystcp.com',
      subject: `[Manual] ${report.subject}`,
      html: report.html,
      text: report.text,
      type: 'api_manual_report'
    });
    
    console.log('✅ Manual report sent to jack@catalystcp.com');
  }

  /**
   * Send daily API cost report (last 24 hours)
   */
  static async sendDailyCostReport(): Promise<void> {
    console.log('📧 Generating daily API cost report...');
    
    try {
      const { apiCallTracker } = await import('../apiCallTracker.js');
      const { apiCostControl } = await import('../apiCostControl.js');
      
      // Get last 24 hours of API stats (1440 minutes)
      const stats = apiCallTracker.getStats(1440);
      const costControlStats = apiCostControl.getUsageStats();
      
      // Calculate costs
      const totalCost = stats.estimatedCost / 100; // Convert cents to dollars
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Build service breakdown
      const serviceBreakdown = Object.entries(stats.byService)
        .map(([service, data]: [string, any]) => ({
          service,
          calls: data.calls,
          cost: (data.cost / 100).toFixed(2),
          successRate: data.successRate.toFixed(1)
        }))
        .sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost)); // Sort by cost descending
      
      // Generate HTML email
      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #081729; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 20px; border: 1px solid #ddd; border-top: none; }
    .summary { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .total { font-size: 32px; font-weight: bold; color: #081729; }
    .service-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .service-table th { background: #4A90E2; color: white; padding: 10px; text-align: left; }
    .service-table td { padding: 10px; border-bottom: 1px solid #ddd; }
    .service-table tr:hover { background: #f8f9fa; }
    .highlight { background: #4A90E2; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; }
    .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Daily API Cost Report</h1>
      <p>${dateStr}</p>
    </div>
    <div class="content">
      <div class="summary">
        <h2 style="margin-top: 0;">24-Hour Summary</h2>
        <div class="total">$${totalCost.toFixed(2)}</div>
        <p style="color: #666; margin: 5px 0 0 0;">${stats.totalCalls} total API calls</p>
      </div>

      <h3>Cost Breakdown by Service</h3>
      <table class="service-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Calls</th>
            <th>Cost</th>
            <th>Success Rate</th>
          </tr>
        </thead>
        <tbody>
          ${serviceBreakdown.map(s => `
            <tr>
              <td><strong>${s.service}</strong></td>
              <td>${s.calls}</td>
              <td>$${s.cost}</td>
              <td><span class="highlight">${s.successRate}%</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3>HelloData Efficiency</h3>
      <div style="background: #e7f5e7; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745;">
        <p style="margin: 0;"><strong>Cache Savings:</strong> ${costControlStats.thisMonth.cached} cached calls</p>
        <p style="margin: 5px 0 0 0;"><strong>Monthly Usage:</strong> ${((costControlStats.thisMonth.cost / costControlStats.limits.monthlyCostLimit) * 100).toFixed(1)}% of $${costControlStats.limits.monthlyCostLimit} budget</p>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated daily report sent at 6:00 AM EST</p>
      <p>View detailed analytics at <a href="https://your-app.replit.app/api-monitoring">/api-monitoring</a></p>
    </div>
  </div>
</body>
</html>
      `;

      // Generate plain text version
      const text = `
DAILY API COST REPORT
${dateStr}

24-Hour Summary:
Total Cost: $${totalCost.toFixed(2)}
Total Calls: ${stats.totalCalls}

Cost Breakdown by Service:
${serviceBreakdown.map(s => `${s.service}: $${s.cost} (${s.calls} calls, ${s.successRate}% success)`).join('\n')}

HelloData Efficiency:
- Cache Savings: ${costControlStats.thisMonth.cached} cached calls
- Monthly Usage: ${((costControlStats.thisMonth.cost / costControlStats.limits.monthlyCostLimit) * 100).toFixed(1)}% of $${costControlStats.limits.monthlyCostLimit} budget

---
This is an automated daily report sent at 6:00 AM EST.
      `;
      
      console.log(`✅ Daily cost report generated: $${totalCost.toFixed(2)} spent in last 24 hours (email disabled)`);
    } catch (error) {
      console.error('❌ Error generating daily cost report:', error);
      throw error;
    }
  }
}

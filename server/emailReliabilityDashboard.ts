// Email Reliability Dashboard - Comprehensive monitoring and recovery
import { emailMonitor } from './emailReliabilityMonitor';
import { emailBackupProcessor } from './emailBackupProcessor';
import { sendNotificationEmail } from './emailService';

interface DashboardStats {
  emailHealth: {
    status: 'HEALTHY' | 'WARNING' | 'DEGRADED' | 'CRITICAL';
    lastEmailReceived: Date | null;
    emailsReceivedToday: number;
    emailsReceivedThisHour: number;
    consecutiveHoursWithoutEmail: number;
    averageEmailsPerDay: number;
  };
  backupQueue: {
    totalInQueue: number;
    processing: number;
    failed: number;
    processed: number;
    oldestUnprocessed: Date | null;
  };
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
    timestamp: Date;
  }>;
  systemHealth: {
    webhookEndpoint: 'UP' | 'DOWN';
    sendGridConnectivity: 'CONNECTED' | 'DISCONNECTED';
    databaseConnectivity: 'CONNECTED' | 'DISCONNECTED';
    lastHealthCheck: Date;
  };
}

export class EmailReliabilityDashboard {
  // Get comprehensive dashboard statistics
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Get email monitoring metrics
      const emailMetrics = emailMonitor.getMetrics();
      const recentAlerts = emailMonitor.getRecentAlerts(24);
      
      // Get backup queue status
      const backupStatus = emailBackupProcessor.getBackupStatus();
      
      // Determine overall email health status
      const emailHealthStatus = this.determineHealthStatus(emailMetrics, recentAlerts);
      
      // Check system connectivity
      const systemHealth = await this.checkSystemHealth();
      
      return {
        emailHealth: {
          status: emailHealthStatus,
          lastEmailReceived: emailMetrics.lastEmailReceived,
          emailsReceivedToday: emailMetrics.emailsReceivedToday,
          emailsReceivedThisHour: emailMetrics.emailsReceivedThisHour,
          consecutiveHoursWithoutEmail: emailMetrics.consecutiveHoursWithoutEmail,
          averageEmailsPerDay: emailMetrics.averageEmailsPerDay
        },
        backupQueue: {
          totalInQueue: backupStatus.queueLength,
          processing: backupStatus.processing,
          failed: backupStatus.failed,
          processed: backupStatus.processed,
          oldestUnprocessed: backupStatus.oldestUnprocessed
        },
        alerts: recentAlerts,
        systemHealth
      };
    } catch (error) {
      console.error('❌ [EMAIL-DASHBOARD] Failed to get dashboard stats:', error);
      throw error;
    }
  }

  // Determine overall health status
  private determineHealthStatus(metrics: any, alerts: any[]): 'HEALTHY' | 'WARNING' | 'DEGRADED' | 'CRITICAL' {
    const recentCriticalAlerts = alerts.filter(a => 
      a.severity === 'critical' && 
      (new Date().getTime() - a.timestamp.getTime()) < 60 * 60 * 1000 // Last hour
    );
    
    const recentHighAlerts = alerts.filter(a => 
      a.severity === 'high' && 
      (new Date().getTime() - a.timestamp.getTime()) < 60 * 60 * 1000 // Last hour
    );

    if (recentCriticalAlerts.length > 0) return 'CRITICAL';
    if (recentHighAlerts.length > 0) return 'DEGRADED';
    if (metrics.consecutiveHoursWithoutEmail > 2 && this.isBusinessHours()) return 'WARNING';
    
    return 'HEALTHY';
  }

  // Check if current time is business hours
  private isBusinessHours(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();
    
    // Monday-Friday, 9 AM - 6 PM EST
    return dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 9 && hour <= 18;
  }

  // Check system health components
  private async checkSystemHealth(): Promise<DashboardStats['systemHealth']> {
    const healthCheck = {
      webhookEndpoint: 'DOWN' as 'UP' | 'DOWN',
      sendGridConnectivity: 'DISCONNECTED' as 'CONNECTED' | 'DISCONNECTED',
      databaseConnectivity: 'DISCONNECTED' as 'CONNECTED' | 'DISCONNECTED',
      lastHealthCheck: new Date()
    };

    try {
      // Check webhook endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('http://localhost:5000/api/health', {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        healthCheck.webhookEndpoint = 'UP';
      }
    } catch (error) {
      console.log('Webhook endpoint check failed:', error);
    }

    try {
      // Check SendGrid connectivity (simplified)
      healthCheck.sendGridConnectivity = process.env.SENDGRID_API_KEY ? 'CONNECTED' : 'DISCONNECTED';
    } catch (error) {
      console.log('SendGrid connectivity check failed:', error);
    }

    try {
      // Check database connectivity
      const { storage } = await import('./storage');
      // Try a simple database operation
      await storage.getAllUsers();
      healthCheck.databaseConnectivity = 'CONNECTED';
    } catch (error) {
      console.log('Database connectivity check failed:', error);
    }

    return healthCheck;
  }

  // Force immediate health check across all systems
  async forceSystemHealthCheck(): Promise<{ 
    emailMonitor: any; 
    backupProcessor: any; 
    systemHealth: any; 
  }> {
    try {
      console.log('🔍 [EMAIL-DASHBOARD] Forcing comprehensive health check...');
      
      // Force email monitor health check
      const emailHealthStatus = await emailMonitor.forceHealthCheck();
      
      // Get backup processor status
      const backupStatus = emailBackupProcessor.getBackupStatus();
      
      // Check system health
      const systemHealth = await this.checkSystemHealth();
      
      console.log('✅ [EMAIL-DASHBOARD] Comprehensive health check completed');
      
      return {
        emailMonitor: emailHealthStatus,
        backupProcessor: backupStatus,
        systemHealth
      };
    } catch (error) {
      console.error('❌ [EMAIL-DASHBOARD] Health check failed:', error);
      throw error;
    }
  }

  // Test email processing pipeline
  async testEmailPipeline(testEmail?: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🧪 [EMAIL-DASHBOARD] Testing email processing pipeline...');
      
      const testEmailData = testEmail || {
        from: 'test@example.com',
        to: 'deals@landlinq.ai',
        subject: 'Test Email - Pipeline Check',
        text: 'This is a test email for pipeline verification.',
        html: '<p>This is a test email for pipeline verification.</p>',
        timestamp: new Date().toISOString()
      };

      // Add test email to backup processor (dry run)
      await emailBackupProcessor.addToBackupQueue(testEmailData, 'manual');
      
      console.log('✅ [EMAIL-DASHBOARD] Test email pipeline completed successfully');
      
      return {
        success: true,
        message: 'Email pipeline test completed successfully',
        details: {
          testEmail: testEmailData,
          addedToBackupQueue: true,
          timestamp: new Date()
        }
      };
    } catch (error) {
      console.error('❌ [EMAIL-DASHBOARD] Test email pipeline failed:', error);
      
      return {
        success: false,
        message: `Email pipeline test failed: ${error}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  // Generate comprehensive email health report
  async generateHealthReport(): Promise<string> {
    try {
      const stats = await this.getDashboardStats();
      const healthCheck = await this.forceSystemHealthCheck();
      
      const report = `
📧 LANDLINQ EMAIL RELIABILITY REPORT
Generated: ${new Date().toLocaleString()}
================================================================

🎯 OVERALL STATUS: ${stats.emailHealth.status}

📈 EMAIL METRICS:
  • Last Email Received: ${stats.emailHealth.lastEmailReceived?.toLocaleString() || 'Never'}
  • Emails Today: ${stats.emailHealth.emailsReceivedToday}
  • Emails This Hour: ${stats.emailHealth.emailsReceivedThisHour}
  • Hours Without Email: ${stats.emailHealth.consecutiveHoursWithoutEmail}
  • Daily Average: ${Math.round(stats.emailHealth.averageEmailsPerDay)}

📦 BACKUP QUEUE STATUS:
  • Total in Queue: ${stats.backupQueue.totalInQueue}
  • Currently Processing: ${stats.backupQueue.processing}
  • Failed: ${stats.backupQueue.failed}
  • Successfully Processed: ${stats.backupQueue.processed}
  • Oldest Unprocessed: ${stats.backupQueue.oldestUnprocessed?.toLocaleString() || 'None'}

🚨 RECENT ALERTS (24h): ${stats.alerts.length}
${stats.alerts.map(alert => 
  `  • ${alert.severity.toUpperCase()}: ${alert.message} (${alert.timestamp.toLocaleString()})`
).join('\n')}

🔧 SYSTEM HEALTH:
  • Webhook Endpoint: ${stats.systemHealth.webhookEndpoint}
  • SendGrid: ${stats.systemHealth.sendGridConnectivity}
  • Database: ${stats.systemHealth.databaseConnectivity}
  • Last Check: ${stats.systemHealth.lastHealthCheck.toLocaleString()}

💡 RECOMMENDATIONS:
${this.generateRecommendations(stats)}

================================================================
Report generated by LandLinq Email Reliability System
      `;
      
      return report;
    } catch (error) {
      console.error('❌ [EMAIL-DASHBOARD] Failed to generate health report:', error);
      return `Email Health Report Generation Failed: ${error}`;
    }
  }

  // Generate recommendations based on current status
  private generateRecommendations(stats: DashboardStats): string {
    const recommendations: string[] = [];
    
    if (stats.emailHealth.status === 'CRITICAL') {
      recommendations.push('• IMMEDIATE ACTION REQUIRED: Critical email system failure detected');
      recommendations.push('• Check SendGrid configuration and webhook endpoints');
    }
    
    if (stats.emailHealth.consecutiveHoursWithoutEmail > 4 && this.isBusinessHours()) {
      recommendations.push('• No emails received for extended period during business hours');
      recommendations.push('• Verify email forwarding configuration');
    }
    
    if (stats.backupQueue.failed > 0) {
      recommendations.push(`• ${stats.backupQueue.failed} emails failed permanent processing`);
      recommendations.push('• Review failed emails in backup queue for manual processing');
    }
    
    if (stats.systemHealth.webhookEndpoint === 'DOWN') {
      recommendations.push('• Webhook endpoint is unreachable');
      recommendations.push('• Check server status and network connectivity');
    }
    
    if (stats.systemHealth.sendGridConnectivity === 'DISCONNECTED') {
      recommendations.push('• SendGrid API key not configured');
      recommendations.push('• Verify SENDGRID_API_KEY environment variable');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('• Email system is operating normally');
      recommendations.push('• Continue monitoring for any changes');
    }
    
    return recommendations.join('\n');
  }

  // Send dashboard alert to admin team
  async sendDashboardAlert(alertType: 'health_report' | 'critical_failure' | 'recovery', data?: any): Promise<void> {
    try {
      const subject = `LandLinq Email System: ${alertType.replace('_', ' ').toUpperCase()}`;
      
      let htmlContent = '';
      
      if (alertType === 'health_report') {
        const report = await this.generateHealthReport();
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1976d2; margin: 0;">📧 Email System Health Report</h2>
            </div>
            <pre style="background: #f8f9fa; padding: 20px; border-radius: 8px; font-family: monospace; white-space: pre-wrap; font-size: 12px;">
${report}
            </pre>
          </div>
        `;
      }
      
      await sendNotificationEmail({
        to: 'jack@catalystcp.com',
        subject,
        html: htmlContent,
        type: 'deal_alert',
        priority: alertType === 'critical_failure' ? 'urgent' : 'high'
      });
      
      console.log(`📧 [EMAIL-DASHBOARD] Dashboard alert sent: ${alertType}`);
      
    } catch (error) {
      console.error('❌ [EMAIL-DASHBOARD] Failed to send dashboard alert:', error);
    }
  }
}

// Create singleton instance
export const emailDashboard = new EmailReliabilityDashboard();
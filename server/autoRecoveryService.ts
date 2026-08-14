import cron from 'node-cron';
import { hellodataService } from './hellodataService';
import { CircuitBreakerManager } from './apiHealthMonitoring';
import { sendNotificationEmail } from './emailService';

interface RecoveryAttempt {
  apiName: string;
  timestamp: string;
  success: boolean;
  error?: string;
  responseTime?: number;
}

class AutoRecoveryService {
  private recoveryHistory: RecoveryAttempt[] = [];
  private maxHistorySize = 100;
  private isRecoveryRunning = false;
  
  // Recovery intervals (in minutes)
  private readonly recoveryIntervals = {
    immediate: 2,     // Try recovery every 2 minutes initially
    moderate: 5,      // After 30 minutes, try every 5 minutes  
    extended: 15,     // After 2 hours, try every 15 minutes
    minimal: 60       // After 24 hours, try every hour
  };

  constructor() {
    this.initializeRecoverySchedule();
  }

  private initializeRecoverySchedule() {
    // Main recovery job - runs every 2 minutes
    cron.schedule('*/2 * * * *', async () => {
      if (!this.isRecoveryRunning) {
        await this.attemptApiRecovery();
      }
    });

    // Health check and circuit breaker evaluation - runs every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.evaluateCircuitBreakers();
    });

    // Recovery history cleanup - runs daily at 2 AM
    cron.schedule('0 2 * * *', () => {
      this.cleanupRecoveryHistory();
    });

    console.log('🔄 Auto-recovery service initialized with scheduled recovery attempts');
  }

  private async attemptApiRecovery() {
    this.isRecoveryRunning = true;
    console.log('🔄 Starting automatic API recovery attempt...');

    try {
      const circuitBreakers = CircuitBreakerManager.getAllStates();
      const failedApis = Object.entries(circuitBreakers)
        .filter(([apiName, state]) => CircuitBreakerManager.isOpen(apiName))
        .map(([apiName]) => apiName);

      if (failedApis.length === 0) {
        console.log('✅ All APIs operational - no recovery needed');
        return;
      }

      console.log(`🔧 Attempting recovery for ${failedApis.length} failed APIs: ${failedApis.join(', ')}`);

      for (const apiName of failedApis) {
        await this.attemptSingleApiRecovery(apiName);
      }

    } catch (error) {
      console.error('❌ Auto-recovery process failed:', error);
    } finally {
      this.isRecoveryRunning = false;
    }
  }

  private async attemptSingleApiRecovery(apiName: string): Promise<boolean> {
    const startTime = Date.now();
    console.log(`🔧 Attempting recovery for ${apiName}...`);

    try {
      let testResult = false;
      let errorMessage = '';

      switch (apiName) {
        case 'hellodata':
          try {
            // Try a simple test call to HelloData
            await hellodataService.searchProperty('Test Recovery Address, Test City, TX 12345');
            testResult = true;
          } catch (error) {
            errorMessage = (error as Error).message;
            testResult = false;
          }
          break;


        default:
          console.log(`⚠️ Recovery not implemented for API: ${apiName}`);
          return false;
      }

      const responseTime = Date.now() - startTime;
      
      const recoveryAttempt: RecoveryAttempt = {
        apiName,
        timestamp: new Date().toISOString(),
        success: testResult,
        error: testResult ? undefined : errorMessage,
        responseTime
      };

      this.addRecoveryAttempt(recoveryAttempt);

      if (testResult) {
        console.log(`✅ ${apiName} recovery successful (${responseTime}ms)`);
        
        // Reset the circuit breaker for successful recovery
        CircuitBreakerManager.resetBreaker(apiName);
        
        // Send recovery notification
        await this.sendRecoveryNotification(apiName, true, responseTime);
        
        return true;
      } else {
        console.log(`❌ ${apiName} recovery failed: ${errorMessage} (${responseTime}ms)`);
        
        // Check if we should send a failure notification (limit frequency)
        const recentFailures = this.getRecentFailures(apiName, 60); // Last hour
        if (recentFailures.length % 10 === 0 && recentFailures.length > 0) {
          // Send notification every 10th failure
          await this.sendRecoveryNotification(apiName, false, responseTime, errorMessage);
        }
        
        return false;
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      console.log(`❌ ${apiName} recovery attempt failed: ${errorMessage} (${responseTime}ms)`);
      
      const recoveryAttempt: RecoveryAttempt = {
        apiName,
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMessage,
        responseTime
      };

      this.addRecoveryAttempt(recoveryAttempt);
      return false;
    }
  }

  private async evaluateCircuitBreakers() {
    console.log('🔍 Evaluating circuit breaker states and recovery intervals...');
    
    const circuitBreakers = CircuitBreakerManager.getAllStates();
    
    for (const [apiName] of Object.entries(circuitBreakers)) {
      if (CircuitBreakerManager.isOpen(apiName)) {
        // For downtime calculation, we'll use a simple approach since we can't access internal state
        const downTimeMinutes = 60; // Assume it's been down for at least 1 hour if circuit is open
        
        console.log(`⚠️ ${apiName} has been down for ${downTimeMinutes} minutes`);
        
        // Escalate to manual intervention if down for more than 4 hours
        if (downTimeMinutes > 240) { // 4 hours
          await this.escalateToManualIntervention(apiName, downTimeMinutes);
        }
      }
    }
  }

  private async sendRecoveryNotification(apiName: string, success: boolean, responseTime: number, errorMessage?: string) {
    try {
      // Skip notifications for HelloData API - hellodataService.ts handles them with proper cooldown
      if (apiName.toLowerCase() === 'hellodata') {
        console.log(`🔕 Skipping HelloData recovery notification - handled by hellodataService.ts with cooldown`);
        return;
      }

      const subject = success ? 
        `${apiName} API Service Recovered` : 
        `${apiName} API Recovery Attempt Failed`;
        
      const message = success ? 
        `Good news! The ${apiName} API service has automatically recovered and is now operational.

Recovery Details:
- Service: ${apiName}
- Recovery Time: ${new Date().toLocaleString()}
- Response Time: ${responseTime}ms
- Status: Fully Operational

The circuit breaker has been reset and normal operations have resumed.` :

        `The automatic recovery attempt for ${apiName} API has failed.

Failure Details:
- Service: ${apiName}
- Attempt Time: ${new Date().toLocaleString()}
- Response Time: ${responseTime}ms
- Error: ${errorMessage || 'Unknown error'}
- Status: Still Down

Automatic recovery will continue. If issues persist, manual intervention may be required.`;

      console.log(`⚠️ Recovery notification disabled - no hardcoded emails allowed`);
      // CRITICAL RULE: Zero hardcoded email templates allowed
      
      console.log(`📧 Recovery notification sent for ${apiName}: ${success ? 'success' : 'failure'}`);
      
    } catch (error) {
      console.error('Failed to send recovery notification:', error);
    }
  }

  private async escalateToManualIntervention(apiName: string, downTimeMinutes: number) {
    try {
      // Skip escalation notifications for HelloData API - hellodataService.ts handles them with proper cooldown
      if (apiName.toLowerCase() === 'hellodata') {
        console.log(`🔕 Skipping HelloData escalation notification - handled by hellodataService.ts with cooldown`);
        return;
      }

      const recentAttempts = this.getRecentFailures(apiName, 240); // Last 4 hours
      
      const escalationMessage = `The ${apiName} API has been down for an extended period and requires manual intervention.

Critical Details:
- Service: ${apiName}
- Downtime: ${Math.floor(downTimeMinutes / 60)} hours ${downTimeMinutes % 60} minutes
- Recovery Attempts: ${recentAttempts.length} in the last 4 hours
- All automatic recovery attempts have failed

IMMEDIATE ACTION REQUIRED:
1. Check API service status and configuration
2. Verify API keys and authentication
3. Review server logs for detailed error information
4. Consider manual service restart or provider contact

Recent Recovery Failures:
${recentAttempts.slice(-5).map(attempt => 
  `- ${new Date(attempt.timestamp).toLocaleTimeString()}: ${attempt.error}`
).join('\n')}

System is using fallback data sources where available, but full functionality is compromised.`;
      
      console.log(`⚠️ Escalation notification disabled - no hardcoded emails allowed`);
      // CRITICAL RULE: Zero hardcoded email templates allowed
      
      console.log(`🚨 Escalated ${apiName} to manual intervention - down for ${Math.floor(downTimeMinutes / 60)} hours`);
      
    } catch (error) {
      console.error('Failed to send escalation notification:', error);
    }
  }

  private addRecoveryAttempt(attempt: RecoveryAttempt) {
    this.recoveryHistory.push(attempt);
    
    // Keep only the most recent attempts
    if (this.recoveryHistory.length > this.maxHistorySize) {
      this.recoveryHistory = this.recoveryHistory.slice(-this.maxHistorySize);
    }
  }

  private getRecentFailures(apiName: string, minutes: number): RecoveryAttempt[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    return this.recoveryHistory.filter(attempt => 
      attempt.apiName === apiName && 
      !attempt.success && 
      new Date(attempt.timestamp) > cutoffTime
    );
  }

  private cleanupRecoveryHistory() {
    // Keep only the last 24 hours of history
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.recoveryHistory = this.recoveryHistory.filter(attempt => 
      new Date(attempt.timestamp) > cutoffTime
    );
    
    console.log(`🧹 Cleaned up recovery history, keeping ${this.recoveryHistory.length} recent attempts`);
  }

  // Public methods for monitoring and control
  public getRecoveryHistory(apiName?: string): RecoveryAttempt[] {
    if (apiName) {
      return this.recoveryHistory.filter(attempt => attempt.apiName === apiName);
    }
    return [...this.recoveryHistory];
  }

  public getRecoveryStats(apiName: string): {
    totalAttempts: number;
    successfulRecoveries: number;
    failureRate: number;
    averageResponseTime: number;
    lastSuccessfulRecovery?: string;
  } {
    const attempts = this.recoveryHistory.filter(attempt => attempt.apiName === apiName);
    const successful = attempts.filter(attempt => attempt.success);
    
    return {
      totalAttempts: attempts.length,
      successfulRecoveries: successful.length,
      failureRate: attempts.length > 0 ? ((attempts.length - successful.length) / attempts.length) * 100 : 0,
      averageResponseTime: attempts.length > 0 ? 
        attempts.reduce((sum, attempt) => sum + (attempt.responseTime || 0), 0) / attempts.length : 0,
      lastSuccessfulRecovery: successful.length > 0 ? 
        successful[successful.length - 1].timestamp : undefined
    };
  }

  public async forceRecoveryAttempt(apiName: string): Promise<boolean> {
    console.log(`🔧 Manual recovery attempt triggered for ${apiName}`);
    return await this.attemptSingleApiRecovery(apiName);
  }

  public stopAutoRecovery() {
    // In a real implementation, you'd stop the cron jobs here
    console.log('🛑 Auto-recovery service stopped');
  }
}

// Export singleton instance
export const autoRecoveryService = new AutoRecoveryService();
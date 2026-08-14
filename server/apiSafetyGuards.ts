/**
 * API Safety Guards - Prevents runaway costs from bugs or errors
 * 
 * Features:
 * 1. Rate limiting (max calls per minute/hour)
 * 2. Daily spending caps with automatic shutdown
 * 3. Circuit breaker pattern (stops calls when error rate too high)
 * 4. Emergency kill switch for admins
 */

interface ApiCallRecord {
  timestamp: number;
  success: boolean;
  cost: number;
  apiName: string;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

interface DailyApiStats {
  calls: number;
  cost: number;
  failures: number;
}

class ApiSafetyGuards {
  // Rate limiting: Track recent API calls (last hour only for rate limiting)
  private callHistory: Map<string, ApiCallRecord[]> = new Map();
  
  // Daily aggregated stats: Track full-day stats per API (doesn't get truncated)
  private dailyStats: Map<string, DailyApiStats> = new Map();
  
  // Circuit breakers: Track failure rates per API
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Kill switches: Emergency disable per API
  private killSwitches: Map<string, boolean> = new Map();
  
  // Spending tracking
  private dailySpending: number = 0;
  private lastResetDate: string = new Date().toISOString().split('T')[0];
  private alertSentToday: boolean = false; // Track if we've sent the alert today
  
  // Configuration
  private readonly config = {
    // Rate limits (calls per time period)
    maxCallsPerMinute: {
      hellodata: 20,      // $0.50/call - limit to 20/min = $10/min max
      arcgis: 30,         // $0.10/call - limit to 30/min = $3/min max
      openai: 50,         // $0.02/call - limit to 50/min = $1/min max
      geocodio: 100,      // $0.0005/call - cheap, allow more
      twilio: 60,         // $0.0075/call - limit to 60/min
      sendgrid: 100       // $0.0004/call - cheap, allow more
    },
    
    // Daily spending caps
    dailySpendingCap: 200,  // $200/day max (safety cap, lower than $2000 monthly budget)
    
    // Circuit breaker settings
    circuitBreakerThreshold: 5,      // Open circuit after 5 consecutive failures
    circuitBreakerResetTime: 300000, // 5 minutes before trying again
    
    // Error rate threshold
    maxErrorRate: 0.5  // 50% error rate triggers slowdown
  };
  
  /**
   * Check if API call is allowed (rate limit + circuit breaker + kill switch)
   */
  canMakeApiCall(apiName: string): { allowed: boolean; reason?: string } {
    // Check 1: Kill switch
    if (this.killSwitches.get(apiName)) {
      return { 
        allowed: false, 
        reason: `${apiName} is temporarily disabled by admin kill switch` 
      };
    }
    
    // Check 2: Daily spending cap
    this.resetDailySpendingIfNeeded();
    if (this.dailySpending >= this.config.dailySpendingCap) {
      return { 
        allowed: false, 
        reason: `Daily spending cap of $${this.config.dailySpendingCap} reached. Current: $${this.dailySpending.toFixed(2)}` 
      };
    }
    
    // Check 3: Circuit breaker
    const circuitBreaker = this.circuitBreakers.get(apiName);
    if (circuitBreaker?.isOpen) {
      const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure < this.config.circuitBreakerResetTime) {
        return { 
          allowed: false, 
          reason: `${apiName} circuit breaker is open (too many failures). Retry in ${Math.ceil((this.config.circuitBreakerResetTime - timeSinceLastFailure) / 1000)}s` 
        };
      } else {
        // Reset circuit breaker after timeout
        circuitBreaker.isOpen = false;
        circuitBreaker.failures = 0;
      }
    }
    
    // Check 4: Rate limiting
    const recentCalls = this.getRecentCalls(apiName, 60000); // Last minute
    const maxCalls = this.config.maxCallsPerMinute[apiName as keyof typeof this.config.maxCallsPerMinute] || 50;
    
    if (recentCalls.length >= maxCalls) {
      return { 
        allowed: false, 
        reason: `${apiName} rate limit exceeded: ${recentCalls.length}/${maxCalls} calls/minute` 
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Record an API call (for tracking and rate limiting)
   */
  recordApiCall(apiName: string, success: boolean, cost: number) {
    const record: ApiCallRecord = {
      timestamp: Date.now(),
      success,
      cost,
      apiName
    };
    
    // Add to call history (for rate limiting - last hour only)
    if (!this.callHistory.has(apiName)) {
      this.callHistory.set(apiName, []);
    }
    this.callHistory.get(apiName)!.push(record);
    
    // Update daily aggregated stats (kept for full day)
    if (!this.dailyStats.has(apiName)) {
      this.dailyStats.set(apiName, { calls: 0, cost: 0, failures: 0 });
    }
    const stats = this.dailyStats.get(apiName)!;
    stats.calls++;
    stats.cost += cost;
    if (!success) {
      stats.failures++;
    }
    
    // Update daily spending
    const previousSpending = this.dailySpending;
    this.dailySpending += cost;
    
    // Check if we crossed the $200 threshold and send alert
    if (previousSpending < this.config.dailySpendingCap && 
        this.dailySpending >= this.config.dailySpendingCap && 
        !this.alertSentToday) {
      this.sendSpendingAlert();
    }
    
    // Update circuit breaker
    if (!success) {
      this.recordFailure(apiName);
    } else {
      this.recordSuccess(apiName);
    }
    
    // Cleanup old records in call history (keep last hour only for rate limiting)
    this.cleanupOldRecords(apiName);
  }
  
  /**
   * Record API failure for circuit breaker
   */
  private recordFailure(apiName: string) {
    if (!this.circuitBreakers.has(apiName)) {
      this.circuitBreakers.set(apiName, {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false
      });
    }
    
    const breaker = this.circuitBreakers.get(apiName)!;
    breaker.failures++;
    breaker.lastFailureTime = Date.now();
    
    // Open circuit if too many failures
    if (breaker.failures >= this.config.circuitBreakerThreshold) {
      breaker.isOpen = true;
      console.error(`🚨 [CIRCUIT-BREAKER] ${apiName} circuit opened after ${breaker.failures} consecutive failures`);
    }
  }
  
  /**
   * Record API success (resets circuit breaker)
   */
  private recordSuccess(apiName: string) {
    const breaker = this.circuitBreakers.get(apiName);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
    }
  }
  
  /**
   * Get recent API calls within time window
   */
  private getRecentCalls(apiName: string, timeWindowMs: number): ApiCallRecord[] {
    const calls = this.callHistory.get(apiName) || [];
    const cutoff = Date.now() - timeWindowMs;
    return calls.filter(call => call.timestamp > cutoff);
  }
  
  /**
   * Cleanup old records to prevent memory leaks
   */
  private cleanupOldRecords(apiName: string) {
    const calls = this.callHistory.get(apiName) || [];
    const oneHourAgo = Date.now() - 3600000;
    const recentCalls = calls.filter(call => call.timestamp > oneHourAgo);
    this.callHistory.set(apiName, recentCalls);
  }
  
  /**
   * Reset daily spending at midnight
   */
  private resetDailySpendingIfNeeded() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      console.log(`📊 [DAILY-RESET] Resetting daily spending from $${this.dailySpending.toFixed(2)} to $0`);
      this.dailySpending = 0;
      this.dailyStats.clear(); // Clear daily aggregated stats
      this.lastResetDate = today;
      this.alertSentToday = false; // Reset alert flag for new day
    }
  }
  
  /**
   * Send email alert when daily spending cap is reached
   */
  private async sendSpendingAlert() {
    try {
      this.alertSentToday = true; // Set flag immediately to prevent duplicates
      
      console.log(`🚨 [SPENDING-ALERT] Daily cap of $${this.config.dailySpendingCap} reached! Sending alert to jack@catalystcp.com`);
      
      // Get breakdown by API from daily stats (not truncated hourly data)
      const breakdown = Array.from(this.dailyStats.entries())
        .map(([apiName, stats]) => ({
          api: apiName,
          calls: stats.calls,
          cost: stats.cost,
          failures: stats.failures
        }))
        .sort((a, b) => b.cost - a.cost); // Sort by cost descending
      
      // Build email content
      const breakdownText = breakdown
        .map(data => `  - ${data.api}: ${data.calls} calls, $${data.cost.toFixed(2)} (${data.failures} failures)`)
        .join('\n');
      
      const emailBody = `
🚨 ALERT: Daily API Spending Cap Reached

Your LandLinq platform has reached the daily spending cap of $${this.config.dailySpendingCap}.

Current Spending: $${this.dailySpending.toFixed(2)}
Date: ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
Time: ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: true })}

Breakdown by API:
${breakdownText}

All API calls are now BLOCKED until midnight (automatic reset).

Action Required:
1. Check for bugs causing excessive API calls
2. Review recent deal submissions
3. Use the kill switch at /api-monitoring if needed
4. Monitor the API dashboard for issues

This is an automatic safety measure to prevent runaway costs.

- LandLinq API Safety System
      `.trim();
      
      // Use existing email service (nodemailer or SendGrid)
      const { emailService } = await import('./emailService.js');
      await emailService.sendSystemAlert({
        to: 'jack@catalystcp.com',
        subject: '🚨 ALERT: Daily API Spending Cap Reached ($200)',
        text: emailBody
      });
      
      console.log(`✅ [SPENDING-ALERT] Alert email sent successfully`);
    } catch (error) {
      console.error(`❌ [SPENDING-ALERT] Failed to send alert email:`, error);
      // Don't throw - we don't want email failures to break the guard
    }
  }
  
  /**
   * Get current API stats
   */
  getApiStats() {
    this.resetDailySpendingIfNeeded();
    
    const stats: any = {
      dailySpending: this.dailySpending,
      dailySpendingCap: this.config.dailySpendingCap,
      percentUsed: (this.dailySpending / this.config.dailySpendingCap) * 100,
      apiStatus: {}
    };
    
    // Get stats for each API
    for (const apiName of Object.keys(this.config.maxCallsPerMinute)) {
      const recentCalls = this.getRecentCalls(apiName, 60000);
      const maxCalls = this.config.maxCallsPerMinute[apiName as keyof typeof this.config.maxCallsPerMinute];
      const circuitBreaker = this.circuitBreakers.get(apiName);
      const killSwitch = this.killSwitches.get(apiName) || false;
      const dailyStat = this.dailyStats.get(apiName) || { calls: 0, cost: 0, failures: 0 };
      const errorRate = dailyStat.calls > 0 ? (dailyStat.failures / dailyStat.calls) : 0;
      
      stats.apiStatus[apiName] = {
        callsLastMinute: recentCalls.length,
        maxCallsPerMinute: maxCalls,
        percentCapacity: (recentCalls.length / maxCalls) * 100,
        callsToday: dailyStat.calls,
        costToday: dailyStat.cost,
        failuresToday: dailyStat.failures,
        errorRate: (errorRate * 100).toFixed(1) + '%',
        circuitBreakerOpen: circuitBreaker?.isOpen || false,
        consecutiveFailures: circuitBreaker?.failures || 0,
        killSwitchActive: killSwitch,
        status: killSwitch ? 'DISABLED' : 
                circuitBreaker?.isOpen ? 'CIRCUIT_OPEN' : 
                recentCalls.length >= maxCalls ? 'RATE_LIMITED' : 
                'OK'
      };
    }
    
    return stats;
  }
  
  /**
   * Emergency kill switch - disable an API completely
   */
  setKillSwitch(apiName: string, enabled: boolean) {
    this.killSwitches.set(apiName, enabled);
    console.log(`🔴 [KILL-SWITCH] ${apiName} ${enabled ? 'DISABLED' : 'ENABLED'} by admin`);
  }
  
  /**
   * Get all kill switch states
   */
  getKillSwitches(): Record<string, boolean> {
    const switches: Record<string, boolean> = {};
    for (const [api, enabled] of this.killSwitches.entries()) {
      switches[api] = enabled;
    }
    return switches;
  }
  
  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(apiName: string) {
    const breaker = this.circuitBreakers.get(apiName);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
      console.log(`🔄 [CIRCUIT-BREAKER] ${apiName} circuit manually reset`);
    }
  }
}

// Singleton instance
export const apiSafetyGuards = new ApiSafetyGuards();

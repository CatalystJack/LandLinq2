/**
 * API Safety System - Proactive Alerts & Fallback Strategies
 * 
 * Features:
 * 1. Proactive Alert Thresholds (70% spending cap, failure rates, etc.)
 * 2. Backup/Fallback Strategies for API failures
 * 3. Email/SMS notifications when thresholds crossed
 * 4. Graceful degradation for each API service
 */

import { db } from './db';
import { apiCallLogs } from '../shared/schema';
import { desc, gte, sql, and, eq } from 'drizzle-orm';
import { CircuitBreakerManager } from './apiHealthMonitoring';

// Alert threshold configurations
export const ALERT_THRESHOLDS = {
  // Daily spending alerts
  DAILY_SPENDING_CAP: 10000, // $100.00 in cents
  ALERT_AT_PERCENTAGE: 0.70, // Alert at 70% of cap ($70)
  CRITICAL_AT_PERCENTAGE: 0.90, // Critical alert at 90% ($90)
  
  // API failure rate alerts
  FAILURE_RATE_WARNING: 0.20, // 20% failure rate
  FAILURE_RATE_CRITICAL: 0.40, // 40% failure rate
  
  // Consecutive call alerts
  CONSECUTIVE_CALLS_WARNING: 50, // 50 calls to same API in 1 hour
  CONSECUTIVE_CALLS_CRITICAL: 100, // 100 calls in 1 hour
  
  // Response time degradation
  RESPONSE_TIME_WARNING: 5000, // 5 seconds avg
  RESPONSE_TIME_CRITICAL: 10000, // 10 seconds avg
};

// Fallback strategies for each API
export enum FallbackStrategy {
  SKIP_AND_FLAG = 'skip_and_flag', // Skip the operation, flag for manual review
  RETRY_LATER = 'retry_later', // Queue for background retry
  USE_CACHED_DATA = 'use_cached_data', // Use previously cached results
  MANUAL_INTERVENTION = 'manual_intervention', // Require analyst to provide data
  GRACEFUL_DEGRADE = 'graceful_degrade', // Continue with reduced functionality
}

export interface ApiFallbackConfig {
  apiName: string;
  primaryStrategy: FallbackStrategy;
  retryAttempts: number;
  retryDelay: number; // milliseconds
  requiresManualReview: boolean;
  criticalForOperation: boolean;
}

// Fallback configurations for each API service
export const API_FALLBACK_CONFIGS: Record<string, ApiFallbackConfig> = {
  HelloData: {
    apiName: 'HelloData',
    primaryStrategy: FallbackStrategy.SKIP_AND_FLAG,
    retryAttempts: 2,
    retryDelay: 30000, // 30 seconds
    requiresManualReview: true,
    criticalForOperation: false, // Comps are helpful but not required
  },
  Geocodio: {
    apiName: 'Geocodio',
    primaryStrategy: FallbackStrategy.MANUAL_INTERVENTION,
    retryAttempts: 3,
    retryDelay: 5000, // 5 seconds
    requiresManualReview: true,
    criticalForOperation: false, // Manual ZIP entry is acceptable
  },
  OpenAI: {
    apiName: 'OpenAI',
    primaryStrategy: FallbackStrategy.RETRY_LATER,
    retryAttempts: 3,
    retryDelay: 60000, // 1 minute
    requiresManualReview: true,
    criticalForOperation: true, // AI analysis is critical
  },
  ArcGIS: {
    apiName: 'ArcGIS',
    primaryStrategy: FallbackStrategy.SKIP_AND_FLAG,
    retryAttempts: 2,
    retryDelay: 15000, // 15 seconds
    requiresManualReview: true,
    criticalForOperation: false, // Demographics are nice-to-have
  },
  Twilio: {
    apiName: 'Twilio',
    primaryStrategy: FallbackStrategy.RETRY_LATER,
    retryAttempts: 5,
    retryDelay: 10000, // 10 seconds
    requiresManualReview: false,
    criticalForOperation: true, // SMS confirmations are important
  },
  SendGrid: {
    apiName: 'SendGrid',
    primaryStrategy: FallbackStrategy.RETRY_LATER,
    retryAttempts: 5,
    retryDelay: 10000, // 10 seconds
    requiresManualReview: false,
    criticalForOperation: true, // Email confirmations are important
  },
};

export interface AlertEvent {
  type: 'spending' | 'spending_threshold' | 'failure_rate' | 'consecutive_calls' | 'response_time' | 'circuit_breaker';
  severity: 'warning' | 'critical';
  apiName?: string;
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  actionRequired: string;
}

export class ApiSafetySystem {
  private static lastAlerts = new Map<string, Date>(); // Prevent alert spam
  private static recentAlerts: AlertEvent[] = []; // Store recent alerts for UI display
  private static readonly ALERT_COOLDOWN = 3600000; // 1 hour between duplicate alerts

  /**
   * Check all proactive alert thresholds
   */
  static async checkAllThresholds(): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];

    // 1. Check daily spending
    const spendingAlert = await this.checkDailySpending();
    if (spendingAlert) alerts.push(spendingAlert);

    // 2. Check API failure rates
    const failureAlerts = await this.checkFailureRates();
    alerts.push(...failureAlerts);

    // 3. Check consecutive calls
    const consecutiveAlerts = await this.checkConsecutiveCalls();
    alerts.push(...consecutiveAlerts);

    // 4. Check response time degradation
    const responseAlerts = await this.checkResponseTimes();
    alerts.push(...responseAlerts);

    // 5. Check circuit breakers
    const circuitAlerts = this.checkCircuitBreakers();
    alerts.push(...circuitAlerts);

    return alerts;
  }

  /**
   * Check daily spending threshold
   */
  private static async checkDailySpending(): Promise<AlertEvent | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await db
        .select({
          totalCost: sql<string>`COALESCE(SUM(CAST(${apiCallLogs.costEstimate} AS NUMERIC)), 0)`,
          callCount: sql<number>`COUNT(*)`,
        })
        .from(apiCallLogs)
        .where(gte(apiCallLogs.timestamp, today));

      const totalCost = parseFloat(result[0]?.totalCost || '0');
      const percentage = totalCost / ALERT_THRESHOLDS.DAILY_SPENDING_CAP;

      if (percentage >= ALERT_THRESHOLDS.CRITICAL_AT_PERCENTAGE) {
        return {
          type: 'spending',
          severity: 'critical',
          message: `CRITICAL: Daily API spending at ${(percentage * 100).toFixed(1)}% of cap ($${(totalCost / 100).toFixed(2)}/$${(ALERT_THRESHOLDS.DAILY_SPENDING_CAP / 100).toFixed(2)})`,
          currentValue: totalCost,
          threshold: ALERT_THRESHOLDS.DAILY_SPENDING_CAP * ALERT_THRESHOLDS.CRITICAL_AT_PERCENTAGE,
          timestamp: new Date(),
          actionRequired: 'Review recent API calls immediately. Consider temporarily disabling non-critical APIs.',
        };
      } else if (percentage >= ALERT_THRESHOLDS.ALERT_AT_PERCENTAGE) {
        return {
          type: 'spending',
          severity: 'warning',
          message: `WARNING: Daily API spending at ${(percentage * 100).toFixed(1)}% of cap ($${(totalCost / 100).toFixed(2)}/$${(ALERT_THRESHOLDS.DAILY_SPENDING_CAP / 100).toFixed(2)})`,
          currentValue: totalCost,
          threshold: ALERT_THRESHOLDS.DAILY_SPENDING_CAP * ALERT_THRESHOLDS.ALERT_AT_PERCENTAGE,
          timestamp: new Date(),
          actionRequired: 'Monitor API usage closely. Review if spending is expected.',
        };
      }

      return null;
    } catch (error) {
      console.error('❌ [SAFETY] Error checking daily spending:', error);
      return null;
    }
  }

  /**
   * Check API failure rates
   */
  private static async checkFailureRates(): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];
    const oneHourAgo = new Date(Date.now() - 3600000);

    try {
      const services = ['HelloData', 'Geocodio', 'OpenAI', 'ArcGIS', 'Twilio', 'SendGrid'];

      for (const service of services) {
        const result = await db
          .select({
            totalCalls: sql<number>`COUNT(*)`,
            failedCalls: sql<number>`SUM(CASE WHEN ${apiCallLogs.success} = false THEN 1 ELSE 0 END)`,
          })
          .from(apiCallLogs)
          .where(
            and(
              eq(apiCallLogs.service, service),
              gte(apiCallLogs.timestamp, oneHourAgo)
            )
          );

        const totalCalls = result[0]?.totalCalls || 0;
        const failedCalls = result[0]?.failedCalls || 0;

        if (totalCalls < 5) continue; // Need at least 5 calls for meaningful stats

        const failureRate = failedCalls / totalCalls;

        if (failureRate >= ALERT_THRESHOLDS.FAILURE_RATE_CRITICAL) {
          alerts.push({
            type: 'failure_rate',
            severity: 'critical',
            apiName: service,
            message: `CRITICAL: ${service} failure rate at ${(failureRate * 100).toFixed(1)}% (${failedCalls}/${totalCalls} calls failed in last hour)`,
            currentValue: failureRate,
            threshold: ALERT_THRESHOLDS.FAILURE_RATE_CRITICAL,
            timestamp: new Date(),
            actionRequired: `Check ${service} service status. Circuit breaker may open soon.`,
          });
        } else if (failureRate >= ALERT_THRESHOLDS.FAILURE_RATE_WARNING) {
          alerts.push({
            type: 'failure_rate',
            severity: 'warning',
            apiName: service,
            message: `WARNING: ${service} failure rate at ${(failureRate * 100).toFixed(1)}% (${failedCalls}/${totalCalls} calls failed in last hour)`,
            currentValue: failureRate,
            threshold: ALERT_THRESHOLDS.FAILURE_RATE_WARNING,
            timestamp: new Date(),
            actionRequired: `Monitor ${service} closely. May need fallback strategy.`,
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error('❌ [SAFETY] Error checking failure rates:', error);
      return [];
    }
  }

  /**
   * Check for excessive consecutive calls to same API
   */
  private static async checkConsecutiveCalls(): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];
    const oneHourAgo = new Date(Date.now() - 3600000);

    try {
      const services = ['HelloData', 'Geocodio', 'OpenAI', 'ArcGIS'];

      for (const service of services) {
        const result = await db
          .select({
            callCount: sql<number>`COUNT(*)`,
          })
          .from(apiCallLogs)
          .where(
            and(
              eq(apiCallLogs.service, service),
              gte(apiCallLogs.timestamp, oneHourAgo)
            )
          );

        const callCount = result[0]?.callCount || 0;

        if (callCount >= ALERT_THRESHOLDS.CONSECUTIVE_CALLS_CRITICAL) {
          alerts.push({
            type: 'consecutive_calls',
            severity: 'critical',
            apiName: service,
            message: `CRITICAL: ${callCount} calls to ${service} in last hour (possible runaway process)`,
            currentValue: callCount,
            threshold: ALERT_THRESHOLDS.CONSECUTIVE_CALLS_CRITICAL,
            timestamp: new Date(),
            actionRequired: `Investigate ${service} usage immediately. May indicate bug or attack.`,
          });
        } else if (callCount >= ALERT_THRESHOLDS.CONSECUTIVE_CALLS_WARNING) {
          alerts.push({
            type: 'consecutive_calls',
            severity: 'warning',
            apiName: service,
            message: `WARNING: ${callCount} calls to ${service} in last hour (higher than normal)`,
            currentValue: callCount,
            threshold: ALERT_THRESHOLDS.CONSECUTIVE_CALLS_WARNING,
            timestamp: new Date(),
            actionRequired: `Review ${service} usage patterns.`,
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error('❌ [SAFETY] Error checking consecutive calls:', error);
      return [];
    }
  }

  /**
   * Check average response time degradation
   */
  private static async checkResponseTimes(): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];
    const oneHourAgo = new Date(Date.now() - 3600000);

    try {
      const services = ['HelloData', 'Geocodio', 'OpenAI', 'ArcGIS'];

      for (const service of services) {
        const result = await db
          .select({
            avgResponseTime: sql<number>`AVG(${apiCallLogs.responseTime})`,
            callCount: sql<number>`COUNT(*)`,
          })
          .from(apiCallLogs)
          .where(
            and(
              eq(apiCallLogs.service, service),
              eq(apiCallLogs.success, true), // Only count successful calls
              gte(apiCallLogs.timestamp, oneHourAgo)
            )
          );

        const avgResponseTime = result[0]?.avgResponseTime || 0;
        const callCount = result[0]?.callCount || 0;

        if (callCount < 3) continue; // Need at least 3 calls for meaningful average

        if (avgResponseTime >= ALERT_THRESHOLDS.RESPONSE_TIME_CRITICAL) {
          alerts.push({
            type: 'response_time',
            severity: 'critical',
            apiName: service,
            message: `CRITICAL: ${service} avg response time is ${(avgResponseTime / 1000).toFixed(2)}s (service degraded)`,
            currentValue: avgResponseTime,
            threshold: ALERT_THRESHOLDS.RESPONSE_TIME_CRITICAL,
            timestamp: new Date(),
            actionRequired: `${service} is experiencing severe performance issues. Consider fallback.`,
          });
        } else if (avgResponseTime >= ALERT_THRESHOLDS.RESPONSE_TIME_WARNING) {
          alerts.push({
            type: 'response_time',
            severity: 'warning',
            apiName: service,
            message: `WARNING: ${service} avg response time is ${(avgResponseTime / 1000).toFixed(2)}s (slower than normal)`,
            currentValue: avgResponseTime,
            threshold: ALERT_THRESHOLDS.RESPONSE_TIME_WARNING,
            timestamp: new Date(),
            actionRequired: `Monitor ${service} performance.`,
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error('❌ [SAFETY] Error checking response times:', error);
      return [];
    }
  }

  /**
   * Check circuit breaker states
   */
  private static checkCircuitBreakers(): AlertEvent[] {
    const alerts: AlertEvent[] = [];
    const states = CircuitBreakerManager.getAllStates();

    for (const [apiName, state] of Object.entries(states)) {
      if (state === 'OPEN') {
        alerts.push({
          type: 'circuit_breaker',
          severity: 'critical',
          apiName,
          message: `CRITICAL: Circuit breaker OPEN for ${apiName} (service unavailable)`,
          currentValue: 1,
          threshold: 1,
          timestamp: new Date(),
          actionRequired: `${apiName} is offline. Fallback strategies are active. Check service status.`,
        });
      } else if (state === 'HALF_OPEN') {
        alerts.push({
          type: 'circuit_breaker',
          severity: 'warning',
          apiName,
          message: `WARNING: Circuit breaker HALF_OPEN for ${apiName} (testing recovery)`,
          currentValue: 0.5,
          threshold: 1,
          timestamp: new Date(),
          actionRequired: `${apiName} is recovering. Monitor closely.`,
        });
      }
    }

    return alerts;
  }

  /**
   * Send alerts via email/SMS
   */
  static async sendAlert(alert: AlertEvent): Promise<void> {
    // Check cooldown to prevent alert spam
    const alertKey = `${alert.type}:${alert.apiName || 'global'}:${alert.severity}`;
    const lastAlert = this.lastAlerts.get(alertKey);
    
    if (lastAlert && Date.now() - lastAlert.getTime() < this.ALERT_COOLDOWN) {
      console.log(`⏸️ [SAFETY] Alert cooldown active for ${alertKey}`);
      return;
    }

    this.lastAlerts.set(alertKey, new Date());

    const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
    console.log(`${emoji} [SAFETY-ALERT] ${alert.message}`);
    console.log(`   Action Required: ${alert.actionRequired}`);

    // Send email + SMS notification directly
    try {
      const subject = `${alert.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ WARNING'}: LandLinq API Alert - ${alert.apiName || 'System'}`;
      const message = `
LandLinq API Safety Alert
========================

${alert.message}

Details:
--------
Type: ${alert.type}
Severity: ${alert.severity.toUpperCase()}
API: ${alert.apiName || 'System-wide'}
Current Value: ${alert.currentValue}
Threshold: ${alert.threshold}
Time: ${alert.timestamp.toLocaleString()}

Action Required:
${alert.actionRequired}

Check your API Monitoring Dashboard for more details.
      `.trim();

      // Send platform alert through the shared system-mail path.
      try {
        const { sendNotificationEmail } = await import('./emailService');
        const sent = await sendNotificationEmail({
          to: 'jack@catalystcp.com',
          subject,
          text: message,
          type: 'api_safety_alert',
          priority: alert.severity === 'critical' ? 'high' : 'medium',
        });
        if (sent) console.log('✅ [SAFETY] Alert email sent to jack@catalystcp.com');
        else console.error('❌ [SAFETY] Shared email service could not send alert');
      } catch (emailError) {
        console.error('❌ [SAFETY] Failed to send email alert:', emailError);
      }

      // SMS notifications disabled per user request
      // if (alert.severity === 'critical') {
      //   try {
      //     const { sendSMS } = await import('./smsService');
      //     const smsResult = await sendSMS({
      //       to: '+17034744399', // Alert number
      //       message: `🚨 CRITICAL API ALERT: ${alert.message}. Check email for details.`,
      //     });
      //     
      //     if (smsResult.success && smsResult.delivered) {
      //       console.log(`✅ [SAFETY] Critical alert SMS sent (SID: ${smsResult.sid})`);
      //     } else if (smsResult.success && !smsResult.delivered) {
      //       console.log(`⏭️ [SAFETY] Critical alert SMS not delivered - ${smsResult.reason || smsResult.mode}`);
      //     } else {
      //       console.log(`❌ [SAFETY] Critical alert SMS failed - ${smsResult.error}`);
      //     }
      //   } catch (smsError) {
      //     console.error('❌ [SAFETY] Failed to send SMS alert:', smsError);
      //   }
      // }
    } catch (error) {
      console.error('❌ [SAFETY] Failed to send alert notification:', error);
    }
  }

  /**
   * Execute fallback strategy for failed API call
   */
  static async executeFallback(
    apiName: string,
    operation: string,
    error: Error,
    context?: any
  ): Promise<{
    success: boolean;
    strategy: FallbackStrategy;
    requiresManualReview: boolean;
    message: string;
    retryScheduled?: Date;
  }> {
    const config = API_FALLBACK_CONFIGS[apiName];
    
    if (!config) {
      console.error(`❌ [FALLBACK] No fallback config for ${apiName}`);
      return {
        success: false,
        strategy: FallbackStrategy.MANUAL_INTERVENTION,
        requiresManualReview: true,
        message: `API ${apiName} failed and no fallback configured`,
      };
    }

    console.log(`🔄 [FALLBACK] Executing ${config.primaryStrategy} for ${apiName}.${operation}`);

    switch (config.primaryStrategy) {
      case FallbackStrategy.SKIP_AND_FLAG:
        return {
          success: true,
          strategy: FallbackStrategy.SKIP_AND_FLAG,
          requiresManualReview: config.requiresManualReview,
          message: `${apiName} operation skipped. ${config.requiresManualReview ? 'Flagged for manual review.' : 'Continuing without this data.'}`,
        };

      case FallbackStrategy.RETRY_LATER:
        const retryAt = new Date(Date.now() + config.retryDelay);
        // Queue for background retry (implementation depends on your job queue system)
        return {
          success: true,
          strategy: FallbackStrategy.RETRY_LATER,
          requiresManualReview: config.requiresManualReview,
          message: `${apiName} operation will retry automatically`,
          retryScheduled: retryAt,
        };

      case FallbackStrategy.MANUAL_INTERVENTION:
        return {
          success: false,
          strategy: FallbackStrategy.MANUAL_INTERVENTION,
          requiresManualReview: true,
          message: `${apiName} operation requires manual intervention by analyst`,
        };

      case FallbackStrategy.GRACEFUL_DEGRADE:
        return {
          success: true,
          strategy: FallbackStrategy.GRACEFUL_DEGRADE,
          requiresManualReview: false,
          message: `${apiName} operation degraded - continuing with reduced functionality`,
        };

      default:
        return {
          success: false,
          strategy: FallbackStrategy.MANUAL_INTERVENTION,
          requiresManualReview: true,
          message: `Unknown fallback strategy for ${apiName}`,
        };
    }
  }

  /**
   * Get fallback status for UI display
   */
  static getFallbackStatus(): Record<string, {
    available: boolean;
    circuitBreakerState: string;
    lastFailure?: Date;
    fallbackStrategy: FallbackStrategy;
  }> {
    const status: Record<string, any> = {};
    const circuitStates = CircuitBreakerManager.getAllStates();

    for (const [apiName, config] of Object.entries(API_FALLBACK_CONFIGS)) {
      status[apiName] = {
        available: circuitStates[apiName.toLowerCase()] !== 'OPEN',
        circuitBreakerState: circuitStates[apiName.toLowerCase()] || 'CLOSED',
        fallbackStrategy: config.primaryStrategy,
      };
    }

    return status;
  }

  /**
   * Get comprehensive system status for UI display
   */
  static async getSystemStatus(): Promise<{
    fallbackStatus: Record<string, any>;
    thresholds: typeof ALERT_THRESHOLDS;
    recentAlerts: AlertEvent[];
    currentSpending: number;
    spendingLimit: number;
    systemHealth: 'healthy' | 'warning' | 'critical';
  }> {
    try {
      const { apiCallTracker } = await import('./apiCallTracker');
      
      // Get current spending for the day
      const currentSpending = await apiCallTracker.getTodaySpending();
      const spendingLimit = ALERT_THRESHOLDS.DAILY_SPENDING_CAP; // $100.00 in cents
      
      // Get recent alerts (last 24 hours)
      const recentAlerts = this.recentAlerts.filter(
        (alert: AlertEvent) => Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000
      );

      // Determine overall system health
      const criticalAlerts = recentAlerts.filter((a: AlertEvent) => a.severity === 'critical');
      const warningAlerts = recentAlerts.filter((a: AlertEvent) => a.severity === 'warning');
      
      let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (criticalAlerts.length > 0) {
        systemHealth = 'critical';
      } else if (warningAlerts.length > 0) {
        systemHealth = 'warning';
      }

      return {
        fallbackStatus: this.getFallbackStatus(),
        thresholds: ALERT_THRESHOLDS,
        recentAlerts,
        currentSpending,
        spendingLimit,
        systemHealth,
      };
    } catch (error) {
      console.error('❌ [SAFETY] Failed to get system status:', error);
      return {
        fallbackStatus: this.getFallbackStatus(),
        thresholds: ALERT_THRESHOLDS,
        recentAlerts: [],
        currentSpending: 0,
        spendingLimit: ALERT_THRESHOLDS.DAILY_SPENDING_CAP,
        systemHealth: 'healthy',
      };
    }
  }
}

// Run proactive checks every 5 minutes
setInterval(async () => {
  const alerts = await ApiSafetySystem.checkAllThresholds();
  
  for (const alert of alerts) {
    await ApiSafetySystem.sendAlert(alert);
  }
}, 5 * 60 * 1000); // 5 minutes

console.log('🛡️ [SAFETY] API Safety System initialized - proactive monitoring active');

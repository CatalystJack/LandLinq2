/**
 * API Call Tracker - Monitor external API usage to prevent excessive charges
 * Tracks HelloData, ArcGIS, Geocodio, and other external service calls
 * Persists all calls to database for accurate monthly cost tracking
 */

import { db } from './db.js';
import { apiCallLogs } from '../shared/schema.js';

interface ApiCallLog {
  service: 'HelloData' | 'ArcGIS' | 'Geocodio' | 'SendGrid' | 'Twilio' | 'OpenAI' | 'Other';
  endpoint: string;
  timestamp: Date;
  dealId?: string;
  success: boolean;
  responseTime: number;
  errorMessage?: string;
  costEstimate?: number; // Estimated cost in cents
}

class ApiCallTracker {
  private calls: ApiCallLog[] = [];
  private readonly MAX_LOG_SIZE = 1000; // Keep last 1000 calls in memory for quick stats
  
  // Cost tracking based on published API pricing (2025)
  // CRITICAL: These are per-call estimates from vendor pricing pages
  // Dashboard shows REAL costs = (actual call count from DB) × (vendor published rate)
  // NO fake infrastructure/hosting costs - only external API calls tracked
  // If no API calls made, dashboard shows $0.00
  private readonly COST_ESTIMATES = {
    HelloData: 50,      // $0.50/call - https://hellodata.ai/pricing
    ArcGIS: 10,         // $0.10/call - 10 credits @ $100/1000 credits
    Geocodio: 0.05,     // $0.0005/lookup - $0.50/1000 lookups
    Regrid: 10,         // $0.10/parcel - overage pricing
    SendGrid: 0.04,     // $0.0004/email - 50k/month tier
    Twilio: 0.75,       // $0.0075/SMS - US outbound
    OpenAI: 2.19,       // $0.0219/call - GPT-5 ~1.5k input + 2k output tokens
    Other: 0.0
  };

  /**
   * Calculate accurate cost per endpoint based on HelloData actual pricing
   */
  private getEndpointCost(service: string, endpoint: string): number {
    // HelloData endpoint-specific pricing (from screenshot)
    if (service === 'HelloData') {
      if (endpoint === 'property/search') return 0;        // FREE
      if (endpoint === 'property/comparables') return 0;   // FREE
      if (endpoint === 'property/{id}') return 50;         // $0.50
      if (endpoint === 'property/pricing') return 50;      // $0.50
      return 50; // Default to $0.50 for unknown HelloData endpoints
    }
    
    // Other services use flat rate
    return this.COST_ESTIMATES[service as ApiCallLog['service']] || 0;
  }

  /**
   * Log an API call - persists to database for accurate monthly tracking
   */
  logCall(
    service: ApiCallLog['service'],
    endpoint: string,
    success: boolean,
    responseTime: number,
    options?: {
      dealId?: string;
      errorMessage?: string;
    }
  ): void {
    const costEstimate = this.getEndpointCost(service, endpoint);
    const timestamp = new Date();
    
    const log: ApiCallLog = {
      service,
      endpoint,
      timestamp,
      success,
      responseTime,
      costEstimate,
      ...options
    };

    // Add to in-memory array for quick stats
    this.calls.push(log);

    // Keep only recent calls to prevent memory bloat
    if (this.calls.length > this.MAX_LOG_SIZE) {
      this.calls.shift();
    }

    // Persist to database for accurate monthly cost tracking (async, non-blocking)
    this.persistToDatabase(log).catch(error => {
      console.error('❌ [API-TRACKER] Failed to persist API call to database:', error);
    });

    // Check spending thresholds after logging call (async, non-blocking)
    this.checkSpendingThresholds().catch(error => {
      console.error('❌ [API-TRACKER] Failed to check spending thresholds:', error);
    });

    // Log to console with color coding (no cost shown - costs tracked in DB only)
    const emoji = success ? '✅' : '❌';
    console.log(`${emoji} [API-TRACKER] ${service} | ${endpoint} | ${responseTime}ms`);
    
    if (!success && options?.errorMessage) {
      console.log(`   ⚠️ Error: ${options.errorMessage}`);
    }
  }

  /**
   * Persist API call to database (async, non-blocking)
   */
  private async persistToDatabase(log: ApiCallLog): Promise<void> {
    try {
      await db.insert(apiCallLogs).values({
        service: log.service,
        endpoint: log.endpoint,
        success: log.success,
        responseTime: log.responseTime,
        errorMessage: log.errorMessage,
        costEstimate: log.costEstimate?.toString() || '0',
        dealId: log.dealId,
        timestamp: log.timestamp,
        month: log.timestamp.getMonth() + 1, // JavaScript months are 0-indexed
        year: log.timestamp.getFullYear(),
      });
    } catch (error) {
      // Log but don't throw - database persistence shouldn't block API calls
      console.error('❌ [API-TRACKER] Database insert failed:', error);
    }
  }

  /**
   * Get statistics for a time window
   */
  getStats(minutesAgo: number = 60): {
    totalCalls: number;
    successRate: number;
    avgResponseTime: number;
    estimatedCost: number;
    byService: Record<string, { calls: number; cost: number; successRate: number }>;
  } {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    const recentCalls = this.calls.filter(call => call.timestamp >= cutoffTime);

    if (recentCalls.length === 0) {
      return {
        totalCalls: 0,
        successRate: 100,
        avgResponseTime: 0,
        estimatedCost: 0,
        byService: {}
      };
    }

    const successfulCalls = recentCalls.filter(c => c.success).length;
    const totalResponseTime = recentCalls.reduce((sum, c) => sum + c.responseTime, 0);
    const totalCost = recentCalls.reduce((sum, c) => sum + (c.costEstimate || 0), 0);

    // Group by service
    const byService: Record<string, { calls: number; cost: number; successRate: number }> = {};
    
    recentCalls.forEach(call => {
      if (!byService[call.service]) {
        byService[call.service] = { calls: 0, cost: 0, successRate: 0 };
      }
      byService[call.service].calls++;
      byService[call.service].cost += call.costEstimate || 0;
    });

    // Calculate success rates per service
    Object.keys(byService).forEach(service => {
      const serviceCalls = recentCalls.filter(c => c.service === service);
      const successfulServiceCalls = serviceCalls.filter(c => c.success).length;
      byService[service].successRate = (successfulServiceCalls / serviceCalls.length) * 100;
    });

    return {
      totalCalls: recentCalls.length,
      successRate: (successfulCalls / recentCalls.length) * 100,
      avgResponseTime: Math.round(totalResponseTime / recentCalls.length),
      estimatedCost: totalCost,
      byService
    };
  }

  /**
   * Print summary to console
   */
  printSummary(minutesAgo: number = 60): void {
    const stats = this.getStats(minutesAgo);
    
    console.log('\n' + '='.repeat(80));
    console.log(`📊 API USAGE SUMMARY (Last ${minutesAgo} minutes)`);
    console.log('='.repeat(80));
    console.log(`Total API Calls: ${stats.totalCalls}`);
    console.log(`Success Rate: ${stats.successRate.toFixed(1)}%`);
    console.log(`Avg Response Time: ${stats.avgResponseTime}ms`);
    console.log(`Estimated Cost: $${(stats.estimatedCost / 100).toFixed(4)}`);
    console.log('\nBreakdown by Service:');
    
    Object.entries(stats.byService).forEach(([service, data]) => {
      const costDollars = (data.cost / 100).toFixed(4);
      console.log(`  ${service}:`);
      console.log(`    Calls: ${data.calls}`);
      console.log(`    Success Rate: ${data.successRate.toFixed(1)}%`);
      console.log(`    Est. Cost: $${costDollars}`);
    });
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Get all recent calls (for debugging)
   */
  getRecentCalls(limit: number = 50): ApiCallLog[] {
    return this.calls.slice(-limit);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.calls = [];
    console.log('🗑️ [API-TRACKER] Cleared all API call logs');
  }

  /**
   * Get today's total spending from database
   */
  async getTodaySpending(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { sql } = await import('drizzle-orm');
      const result = await db
        .select({
          totalCost: sql<string>`COALESCE(SUM(CAST(${apiCallLogs.costEstimate} AS DECIMAL)), 0)`
        })
        .from(apiCallLogs)
        .where(sql`${apiCallLogs.timestamp} >= ${today}`);
      
      const totalCents = parseFloat(result[0]?.totalCost || '0');
      return totalCents / 100; // Convert cents to dollars
    } catch (error) {
      console.error('❌ [API-TRACKER] Failed to get today spending:', error);
      return 0;
    }
  }

  /**
   * Check spending thresholds and trigger alerts
   */
  private async checkSpendingThresholds(): Promise<void> {
    try {
      const todaySpending = await this.getTodaySpending();
      const DAILY_LIMIT = 100; // $100/day limit
      const spendingPercentage = (todaySpending / DAILY_LIMIT) * 100;
      
      // Only alert at specific thresholds to avoid spam
      if (spendingPercentage >= 90 && spendingPercentage < 91) {
        // 90% threshold - Email + SMS
        console.warn(`🚨 [SPENDING-ALERT] 90% of daily limit reached: $${todaySpending.toFixed(2)} / $${DAILY_LIMIT}`);
        
        const { ApiSafetySystem } = await import('./apiSafetySystem');
        await ApiSafetySystem.sendAlert({
          type: 'spending_threshold',
          severity: 'critical',
          message: `Daily API spending has reached 90% of limit: $${todaySpending.toFixed(2)} / $${DAILY_LIMIT.toFixed(2)}`,
          timestamp: new Date(),
          actionRequired: 'Review API usage immediately. System approaching daily spending cap.',
          currentValue: spendingPercentage,
          threshold: 90,
        });
      } else if (spendingPercentage >= 70 && spendingPercentage < 71) {
        // 70% threshold - Email only
        console.warn(`⚠️ [SPENDING-ALERT] 70% of daily limit reached: $${todaySpending.toFixed(2)} / $${DAILY_LIMIT}`);
        
        const { ApiSafetySystem } = await import('./apiSafetySystem');
        await ApiSafetySystem.sendAlert({
          type: 'spending_threshold',
          severity: 'warning',
          message: `Daily API spending has reached 70% of limit: $${todaySpending.toFixed(2)} / $${DAILY_LIMIT.toFixed(2)}`,
          timestamp: new Date(),
          actionRequired: 'Monitor API usage. Consider reducing non-essential API calls.',
          currentValue: spendingPercentage,
          threshold: 70,
        });
      }
    } catch (error) {
      console.error('❌ [API-TRACKER] Failed to check spending thresholds:', error);
    }
  }
}

// Singleton instance
export const apiCallTracker = new ApiCallTracker();

// Print summary every hour
setInterval(() => {
  apiCallTracker.printSummary(60);
}, 60 * 60 * 1000);

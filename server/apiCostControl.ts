/**
 * API Cost Control Service
 * Prevents excessive API spending through caching, rate limiting, and usage tracking
 */

import { InMemoryCache } from './cache';

interface APICallMetrics {
  service: string;
  endpoint: string;
  timestamp: Date;
  cost: number;
  cached: boolean;
  address?: string;
}

interface UsageLimits {
  dailyCallLimit: number;
  dailyCostLimit: number;
  monthlyCallLimit: number;
  monthlyCostLimit: number;
  enabled: boolean;
}

interface RateLimitConfig {
  maxCallsPerMinute: number;
  maxCallsPerHour: number;
  enabled: boolean;
}

class APICostControlService {
  // In-memory cache with 24-hour TTL for HelloData results
  private cache = new InMemoryCache<any>(24 * 60 * 60 * 1000); // 24 hours
  
  // Track API calls
  private callHistory: APICallMetrics[] = [];
  
  // Default limits (configurable)
  private limits: UsageLimits = {
    dailyCallLimit: 1000,
    dailyCostLimit: 100, // $100 per day
    monthlyCallLimit: 20000,
    monthlyCostLimit: 2000, // $2000 per month
    enabled: true
  };

  // Rate limiting
  private rateLimit: RateLimitConfig = {
    maxCallsPerMinute: 60,
    maxCallsPerHour: 500,
    enabled: true
  };

  // HelloData pricing ($0.50 per call)
  private hellodataPricing = {
    propertySearch: 0.50,      // $0.50 per search
    propertyDetails: 0.50,     // $0.50 per details fetch
    comparables: 0.50,         // $0.50 per comparables search
  };

  /**
   * Generate cache key for HelloData queries
   */
  private getCacheKey(service: string, params: any): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    return `${service}:${normalized}`;
  }

  /**
   * Check if cached result exists
   */
  async checkCache<T>(service: string, params: any): Promise<T | null> {
    const key = this.getCacheKey(service, params);
    const cached = this.cache.get(key);
    
    if (cached) {
      console.log(`💰 [COST-CONTROL] Cache HIT for ${service} - Saved API call!`);
      
      // Track as cached call (no cost)
      this.trackCall(service, params, 0, true);
      
      return cached as T;
    }
    
    console.log(`🔍 [COST-CONTROL] Cache MISS for ${service} - Will make API call`);
    return null;
  }

  /**
   * Store result in cache
   */
  async cacheResult(service: string, params: any, result: any): Promise<void> {
    const key = this.getCacheKey(service, params);
    this.cache.set(key, result);
    console.log(`💾 [COST-CONTROL] Cached result for ${service}`);
  }

  /**
   * Check if we can make an API call (rate limiting + spending limits)
   */
  async canMakeCall(service: string, estimatedCost: number): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.limits.enabled && !this.rateLimit.enabled) {
      return { allowed: true };
    }

    // Check rate limits
    if (this.rateLimit.enabled) {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const callsLastMinute = this.callHistory.filter(
        c => !c.cached && c.timestamp >= oneMinuteAgo
      ).length;

      const callsLastHour = this.callHistory.filter(
        c => !c.cached && c.timestamp >= oneHourAgo
      ).length;

      if (callsLastMinute >= this.rateLimit.maxCallsPerMinute) {
        return { 
          allowed: false, 
          reason: `Rate limit exceeded: ${callsLastMinute} calls in last minute (max: ${this.rateLimit.maxCallsPerMinute})` 
        };
      }

      if (callsLastHour >= this.rateLimit.maxCallsPerHour) {
        return { 
          allowed: false, 
          reason: `Rate limit exceeded: ${callsLastHour} calls in last hour (max: ${this.rateLimit.maxCallsPerHour})` 
        };
      }
    }

    // Check spending limits
    if (this.limits.enabled) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayCalls = this.callHistory.filter(
        c => !c.cached && c.timestamp >= todayStart
      );

      const monthCalls = this.callHistory.filter(
        c => !c.cached && c.timestamp >= monthStart
      );

      const todayCost = todayCalls.reduce((sum, c) => sum + c.cost, 0);
      const monthCost = monthCalls.reduce((sum, c) => sum + c.cost, 0);

      // Check daily limits
      if (todayCalls.length >= this.limits.dailyCallLimit) {
        return { 
          allowed: false, 
          reason: `Daily call limit reached: ${todayCalls.length}/${this.limits.dailyCallLimit}` 
        };
      }

      if (todayCost + estimatedCost > this.limits.dailyCostLimit) {
        return { 
          allowed: false, 
          reason: `Daily cost limit would be exceeded: $${(todayCost + estimatedCost).toFixed(2)}/$${this.limits.dailyCostLimit}` 
        };
      }

      // Check monthly limits
      if (monthCalls.length >= this.limits.monthlyCallLimit) {
        return { 
          allowed: false, 
          reason: `Monthly call limit reached: ${monthCalls.length}/${this.limits.monthlyCallLimit}` 
        };
      }

      if (monthCost + estimatedCost > this.limits.monthlyCostLimit) {
        return { 
          allowed: false, 
          reason: `Monthly cost limit would be exceeded: $${(monthCost + estimatedCost).toFixed(2)}/$${this.limits.monthlyCostLimit}` 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Track an API call
   */
  private trackCall(service: string, params: any, cost: number, cached: boolean = false): void {
    const metric: APICallMetrics = {
      service,
      endpoint: params.endpoint || 'unknown',
      timestamp: new Date(),
      cost,
      cached,
      address: params.address || undefined
    };

    this.callHistory.push(metric);

    // Keep only last 30 days of history to prevent memory issues
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.callHistory = this.callHistory.filter(c => c.timestamp >= thirtyDaysAgo);

    if (!cached) {
      console.log(`💰 [COST-CONTROL] API Call tracked: ${service} - Cost: $${cost.toFixed(4)}`);
    }
  }

  /**
   * Execute HelloData call with cost controls
   */
  async executeWithCostControl<T>(
    service: string,
    endpoint: string,
    params: any,
    apiCall: () => Promise<T>
  ): Promise<T> {
    // Check cache first
    const cached = await this.checkCache<T>(service, params);
    if (cached) {
      return cached;
    }

    // Estimate cost based on endpoint
    let estimatedCost = 0;
    if (endpoint.includes('search')) {
      estimatedCost = this.hellodataPricing.propertySearch;
    } else if (endpoint.includes('property/')) {
      estimatedCost = this.hellodataPricing.propertyDetails;
    } else if (endpoint.includes('comparables')) {
      estimatedCost = this.hellodataPricing.comparables;
    }

    // Check if we can make the call
    const permission = await this.canMakeCall(service, estimatedCost);
    if (!permission.allowed) {
      console.error(`🚫 [COST-CONTROL] API call blocked: ${permission.reason}`);
      throw new Error(`API call blocked: ${permission.reason}`);
    }

    // Make the API call
    console.log(`✅ [COST-CONTROL] API call approved - Estimated cost: $${estimatedCost.toFixed(4)}`);
    const result = await apiCall();

    // Track the call
    this.trackCall(service, { endpoint, ...params }, estimatedCost, false);

    // Cache the result
    await this.cacheResult(service, params, result);

    return result;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    today: { calls: number; cost: number; cached: number };
    thisMonth: { calls: number; cost: number; cached: number };
    limits: UsageLimits;
    rateLimit: RateLimitConfig;
  } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayCalls = this.callHistory.filter(c => c.timestamp >= todayStart);
    const monthCalls = this.callHistory.filter(c => c.timestamp >= monthStart);

    const todayApiCalls = todayCalls.filter(c => !c.cached);
    const monthApiCalls = monthCalls.filter(c => !c.cached);

    return {
      today: {
        calls: todayApiCalls.length,
        cost: todayApiCalls.reduce((sum, c) => sum + c.cost, 0),
        cached: todayCalls.filter(c => c.cached).length
      },
      thisMonth: {
        calls: monthApiCalls.length,
        cost: monthApiCalls.reduce((sum, c) => sum + c.cost, 0),
        cached: monthCalls.filter(c => c.cached).length
      },
      limits: this.limits,
      rateLimit: this.rateLimit
    };
  }

  /**
   * Update spending limits
   */
  updateLimits(limits: Partial<UsageLimits>): void {
    this.limits = { ...this.limits, ...limits };
    console.log(`⚙️ [COST-CONTROL] Limits updated:`, this.limits);
  }

  /**
   * Update rate limits
   */
  updateRateLimit(rateLimit: Partial<RateLimitConfig>): void {
    this.rateLimit = { ...this.rateLimit, ...rateLimit };
    console.log(`⚙️ [COST-CONTROL] Rate limits updated:`, this.rateLimit);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log(`🗑️ [COST-CONTROL] Cache cleared`);
  }

  /**
   * Get call history
   */
  getCallHistory(limit: number = 100): APICallMetrics[] {
    return this.callHistory.slice(-limit).reverse();
  }
}

// Singleton instance
export const apiCostControl = new APICostControlService();

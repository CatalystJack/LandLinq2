import { desc, eq, and, gte, sql, count } from "drizzle-orm";
import { db } from "./db";
import { 
  apiHealthMetrics, 
  apiDataSources, 
  apiPerformanceSummary,
  type InsertApiHealthMetric,
  type InsertApiDataSource,
  type ApiHealthMetric 
} from "@shared/schema";

// API Health Status enum
export type ApiHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'offline';

// API Performance metrics interface
export interface ApiPerformanceMetrics {
  apiName: string;
  status: ApiHealthStatus;
  successRate: number;
  avgResponseTime: number;
  errorRate: number;
  totalRequests: number;
  recentErrors: string[];
  lastSuccessfulCall?: Date;
  healthScore: number;
  circuitBreakerOpen: boolean;
}

// Real-time API health data structure
export interface ApiHealthData {
  timestamp: Date;
  apis: {
    // HelloData removed per user request
    // All external data services removed per user request
  };
  overallHealth: {
    averageSuccessRate: number;
    totalRequests: number;
    activeApis: number;
    criticalIssues: number;
  };
}

// Circuit Breaker Management
export class CircuitBreakerManager {
  private static breakers = new Map<string, {
    failures: number;
    lastFailure: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    threshold: number;
    timeout: number;
  }>();

  static initializeBreaker(apiName: string, threshold = 5, timeout = 300000) { // 5 failures, 5 min timeout
    if (!this.breakers.has(apiName)) {
      this.breakers.set(apiName, {
        failures: 0,
        lastFailure: 0,
        state: 'CLOSED',
        threshold,
        timeout
      });
    }
  }

  static recordFailure(apiName: string): boolean {
    this.initializeBreaker(apiName);
    const breaker = this.breakers.get(apiName)!;
    
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= breaker.threshold && breaker.state === 'CLOSED') {
      breaker.state = 'OPEN';
      console.log(`🚨 Circuit breaker OPEN for ${apiName} after ${breaker.failures} failures`);
      return true; // Circuit breaker opened
    }
    
    return false;
  }

  static recordSuccess(apiName: string): void {
    this.initializeBreaker(apiName);
    const breaker = this.breakers.get(apiName)!;
    
    breaker.failures = 0;
    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'CLOSED';
      console.log(`✅ Circuit breaker CLOSED for ${apiName} - recovered`);
    }
  }

  static isOpen(apiName: string): boolean {
    this.initializeBreaker(apiName);
    const breaker = this.breakers.get(apiName)!;
    
    if (breaker.state === 'OPEN') {
      // Check if timeout period has passed
      if (Date.now() - breaker.lastFailure > breaker.timeout) {
        breaker.state = 'HALF_OPEN';
        console.log(`🔄 Circuit breaker HALF_OPEN for ${apiName} - testing recovery`);
        return false;
      }
      return true;
    }
    
    return false;
  }

  static getState(apiName: string): string {
    this.initializeBreaker(apiName);
    return this.breakers.get(apiName)!.state;
  }

  static getAllStates(): Record<string, string> {
    const states: Record<string, string> = {};
    const apis = ['hellodata'];  // USPS and census removed per user request
    
    for (const api of apis) {
      states[api] = this.getState(api);
    }
    
    return states;
  }

  static resetBreaker(apiName: string): void {
    this.initializeBreaker(apiName);
    const breaker = this.breakers.get(apiName)!;
    
    breaker.failures = 0;
    breaker.lastFailure = 0;
    breaker.state = 'CLOSED';
    console.log(`🔄 Circuit breaker RESET for ${apiName} - manually closed`);
  }

  static resetAllBreakers(): void {
    const apis = ['hellodata'];  // USPS and census removed per user request
    for (const api of apis) {
      this.resetBreaker(api);
    }
    console.log(`🔄 All circuit breakers RESET`);
  }
}

export class ApiHealthMonitoring {
  private static instance: ApiHealthMonitoring;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startRealTimeMonitoring();
  }

  public static getInstance(): ApiHealthMonitoring {
    if (!ApiHealthMonitoring.instance) {
      ApiHealthMonitoring.instance = new ApiHealthMonitoring();
    }
    return ApiHealthMonitoring.instance;
  }

  /**
   * Record API call metrics
   */
  async recordApiCall(data: {
    apiName: string;
    endpoint?: string;
    operationType?: string;
    success: boolean;
    responseTimeMs?: number;
    httpStatusCode?: number;
    errorType?: string;
    errorMessage?: string;
    errorDetails?: any;
    dataReceived?: boolean;
    confidenceScore?: number;
    dataCompleteness?: number;
    retryAttempt?: number;
    dealId?: string;
    userId?: string;
    requestId?: string;
    requestData?: any;
  }): Promise<void> {
    try {
      const database = db;
      
      // Record success/failure for circuit breaker
      if (data.success) {
        CircuitBreakerManager.recordSuccess(data.apiName);
      } else {
        CircuitBreakerManager.recordFailure(data.apiName);
      }

      const circuitBreakerState = CircuitBreakerManager.getState(data.apiName);

      // Insert health metric record
      const metricData: InsertApiHealthMetric = {
        apiName: data.apiName,
        endpoint: data.endpoint,
        operationType: data.operationType,
        requestId: data.requestId,
        requestData: data.requestData ? JSON.stringify(data.requestData) : null,
        success: data.success,
        responseTimeMs: data.responseTimeMs,
        httpStatusCode: data.httpStatusCode,
        errorType: data.errorType,
        errorMessage: data.errorMessage,
        errorDetails: data.errorDetails ? JSON.stringify(data.errorDetails) : null,
        dataReceived: data.dataReceived || false,
        confidenceScore: data.confidenceScore?.toString() || null,
        dataCompleteness: data.dataCompleteness?.toString() || null,
        circuitBreakerState,
        retryAttempt: data.retryAttempt || 0,
        dealId: data.dealId,
        userId: data.userId,
      };

      await database.insert(apiHealthMetrics).values(metricData);

      console.log(`📊 Recorded API metric: ${data.apiName} - ${data.success ? '✅' : '❌'} ${data.responseTimeMs}ms`);

    } catch (error) {
      console.error('❌ Failed to record API call metrics:', error);
    }
  }

  /**
   * Record data source attribution for transparency
   */
  async recordDataSource(data: {
    dealId: string;
    dataField: string;
    dataValue: string;
    primarySource: string;
    backupSources?: string[];
    sourceConfidence?: number;
    isEstimated?: boolean;
    isMockData?: boolean;
    isUserProvided?: boolean;
    validationStatus?: string;
    sourceMetadata?: any;
    accuracyScore?: number;
    freshnessScore?: number;
    reliabilityScore?: number;
  }): Promise<void> {
    try {
      const database = db;

      const sourceData: InsertApiDataSource = {
        dealId: data.dealId,
        dataField: data.dataField,
        dataValue: data.dataValue,
        primarySource: data.primarySource,
        backupSources: data.backupSources ? JSON.stringify(data.backupSources) : null,
        sourceConfidence: data.sourceConfidence,
        isEstimated: data.isEstimated || false,
        isMockData: data.isMockData || false,
        isUserProvided: data.isUserProvided || false,
        validationStatus: data.validationStatus,
        sourceMetadata: data.sourceMetadata ? JSON.stringify(data.sourceMetadata) : null,
        retrievedAt: new Date(),
        accuracyScore: data.accuracyScore,
        freshnessScore: data.freshnessScore,
        reliabilityScore: data.reliabilityScore,
      };

      await database.insert(apiDataSources).values(sourceData);

      console.log(`🔍 Recorded data source: ${data.dataField} from ${data.primarySource} for deal ${data.dealId}`);

    } catch (error) {
      console.error('❌ Failed to record data source:', error);
    }
  }

  /**
   * Get current API health status
   */
  async getCurrentApiHealth(): Promise<ApiHealthData> {
    try {
      const database = db;
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      // Get metrics for each API in the last hour
      const apis = ['hellodata'];  // USPS and census removed per user request
      const apiMetrics: Record<string, ApiPerformanceMetrics> = {};

      for (const apiName of apis) {
        const metrics = await database
          .select()
          .from(apiHealthMetrics)
          .where(
            and(
              eq(apiHealthMetrics.apiName, apiName),
              gte(apiHealthMetrics.timestamp, hourAgo)
            )
          )
          .orderBy(desc(apiHealthMetrics.timestamp))
          .limit(100);

        const totalRequests = metrics.length;
        const successfulRequests = metrics.filter(m => m.success).length;
        const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
        const avgResponseTime = metrics.length > 0 
          ? metrics.reduce((sum, m) => sum + (m.responseTimeMs || 0), 0) / metrics.length 
          : 0;
        const errorRate = 100 - successRate;
        
        const recentErrors = metrics
          .filter(m => !m.success && m.errorMessage)
          .slice(0, 5)
          .map(m => m.errorMessage || 'Unknown error');

        const lastSuccessfulCall = metrics.find(m => m.success)?.timestamp;
        
        // Calculate health score (weighted combination of success rate, response time, and recency)
        const recencyScore = lastSuccessfulCall 
          ? Math.max(0, 100 - ((Date.now() - lastSuccessfulCall.getTime()) / (1000 * 60 * 60))) // Decreases over hours
          : 0;
        const responseTimeScore = Math.max(0, 100 - (avgResponseTime / 100)); // Penalty for slow responses
        const healthScore = (successRate * 0.5) + (responseTimeScore * 0.3) + (recencyScore * 0.2);

        // Determine status based on health score
        let status: ApiHealthStatus;
        if (healthScore >= 80) status = 'healthy';
        else if (healthScore >= 60) status = 'degraded';
        else if (healthScore >= 30) status = 'unhealthy';
        else status = 'offline';

        const circuitBreakerOpen = CircuitBreakerManager.isOpen(apiName);
        if (circuitBreakerOpen) {
          status = 'offline';
        }

        apiMetrics[apiName] = {
          apiName,
          status,
          successRate,
          avgResponseTime,
          errorRate,
          totalRequests,
          recentErrors,
          lastSuccessfulCall: lastSuccessfulCall || undefined,
          healthScore,
          circuitBreakerOpen
        };
      }

      // Calculate overall health
      const totalRequests = Object.values(apiMetrics).reduce((sum, api) => sum + api.totalRequests, 0);
      const averageSuccessRate = Object.values(apiMetrics).reduce((sum, api) => sum + api.successRate, 0) / apis.length;
      const activeApis = Object.values(apiMetrics).filter(api => api.status !== 'offline').length;
      const criticalIssues = Object.values(apiMetrics).filter(api => 
        api.status === 'unhealthy' || api.status === 'offline'
      ).length;

      return {
        timestamp: new Date(),
        apis: apiMetrics as ApiHealthData['apis'],
        overallHealth: {
          averageSuccessRate,
          totalRequests,
          activeApis,
          criticalIssues
        }
      };

    } catch (error) {
      console.error('❌ Failed to get API health data:', error);
      // Strictly enforce no-mock-data policy: throw errors instead of returning synthetic metrics
      throw new Error(`API health monitoring service unavailable: ${error.message}`);
    }
  }

  /**
   * Get detailed API performance history
   */
  async getApiPerformanceHistory(apiName: string, hours = 24): Promise<Array<{
    timestamp: Date;
    successRate: number;
    avgResponseTime: number;
    totalRequests: number;
  }>> {
    try {
      const database = db;
      const timeAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Group by hour and calculate aggregated metrics
      const result = await database
        .select({
          hour: sql<string>`date_trunc('hour', ${apiHealthMetrics.timestamp})`,
          totalRequests: count(),
          successfulRequests: sql<number>`sum(case when ${apiHealthMetrics.success} then 1 else 0 end)`,
          avgResponseTime: sql<number>`avg(${apiHealthMetrics.responseTimeMs})`
        })
        .from(apiHealthMetrics)
        .where(
          and(
            eq(apiHealthMetrics.apiName, apiName),
            gte(apiHealthMetrics.timestamp, timeAgo)
          )
        )
        .groupBy(sql`date_trunc('hour', ${apiHealthMetrics.timestamp})`)
        .orderBy(sql`date_trunc('hour', ${apiHealthMetrics.timestamp})`);

      return result.map(row => ({
        timestamp: new Date(row.hour),
        successRate: row.totalRequests > 0 ? (row.successfulRequests / row.totalRequests) * 100 : 0,
        avgResponseTime: Number(row.avgResponseTime) || 0,
        totalRequests: row.totalRequests
      }));

    } catch (error) {
      console.error(`❌ Failed to get performance history for ${apiName}:`, error);
      // Strictly enforce no-mock-data policy: throw errors instead of returning empty arrays
      throw new Error(`API performance history unavailable for ${apiName}: ${error.message}`);
    }
  }

  /**
   * Get data source transparency for a deal
   */
  async getDealDataSources(dealId: string): Promise<Array<{
    dataField: string;
    dataValue: string;
    primarySource: string;
    confidence: number;
    isMockData: boolean;
    isUserProvided: boolean;
    retrievedAt: Date;
  }>> {
    try {
      const database = db;

      const sources = await database
        .select()
        .from(apiDataSources)
        .where(eq(apiDataSources.dealId, dealId))
        .orderBy(desc(apiDataSources.createdAt));

      return sources.map(source => ({
        dataField: source.dataField,
        dataValue: source.dataValue || '',
        primarySource: source.primarySource || 'unknown',
        confidence: Number(source.sourceConfidence) || 0,
        isMockData: source.isMockData || false,
        isUserProvided: source.isUserProvided || false,
        retrievedAt: source.retrievedAt || source.createdAt
      }));

    } catch (error) {
      console.error(`❌ Failed to get data sources for deal ${dealId}:`, error);
      return [];
    }
  }

  /**
   * Generate hourly performance summaries
   */
  async generatePerformanceSummaries(): Promise<void> {
    try {
      const database = db;
      const apis = ['hellodata'];  // USPS and census removed per user request
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);

      for (const apiName of apis) {
        // Get metrics for the last hour
        const metrics = await database
          .select()
          .from(apiHealthMetrics)
          .where(
            and(
              eq(apiHealthMetrics.apiName, apiName),
              gte(apiHealthMetrics.timestamp, hourAgo)
            )
          );

        if (metrics.length === 0) continue;

        const totalRequests = metrics.length;
        const successfulRequests = metrics.filter(m => m.success).length;
        const failedRequests = totalRequests - successfulRequests;
        const successRate = (successfulRequests / totalRequests) * 100;

        const responseTimes = metrics
          .filter(m => m.responseTimeMs !== null)
          .map(m => m.responseTimeMs!)
          .sort((a, b) => a - b);

        const avgResponseTime = responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : 0;

        const p95ResponseTime = responseTimes.length > 0 
          ? responseTimes[Math.floor(responseTimes.length * 0.95)] 
          : 0;

        // Error analysis
        const timeoutErrors = metrics.filter(m => m.errorType === 'timeout').length;
        const rateLimitErrors = metrics.filter(m => m.errorType === 'rate_limit').length;
        const authenticationErrors = metrics.filter(m => m.errorType === 'authentication').length;
        const serverErrors = metrics.filter(m => m.httpStatusCode && m.httpStatusCode >= 500).length;
        const networkErrors = metrics.filter(m => m.errorType === 'network_error').length;

        // Data quality
        const confidenceScores = metrics
          .filter(m => m.confidenceScore !== null)
          .map(m => Number(m.confidenceScore));
        const avgConfidenceScore = confidenceScores.length > 0 
          ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length 
          : 0;

        const completenessScores = metrics
          .filter(m => m.dataCompleteness !== null)
          .map(m => Number(m.dataCompleteness));
        const avgDataCompleteness = completenessScores.length > 0 
          ? completenessScores.reduce((sum, score) => sum + score, 0) / completenessScores.length 
          : 0;

        // Health calculation
        const healthScore = (successRate * 0.4) + 
                           (Math.max(0, 100 - avgResponseTime/100) * 0.3) +
                           (avgConfidenceScore * 0.3);

        const isHealthy = healthScore >= 70;
        const circuitBreakerTripped = CircuitBreakerManager.isOpen(apiName);

        // Insert summary
        await database.insert(apiPerformanceSummary).values({
          date: currentHour.toISOString().split('T')[0],
          hour: currentHour.getHours(),
          apiName,
          totalRequests,
          successfulRequests,
          failedRequests,
          successRate,
          avgResponseTime,
          minResponseTime: Math.min(...responseTimes) || 0,
          maxResponseTime: Math.max(...responseTimes) || 0,
          p95ResponseTime,
          timeoutErrors,
          rateLimitErrors,
          authenticationErrors,
          serverErrors,
          networkErrors,
          avgConfidenceScore,
          avgDataCompleteness,
          mockDataUsage: 0, // TODO: Track mock data usage
          healthScore,
          isHealthy,
          circuitBreakerTripped
        });

        console.log(`📈 Generated performance summary for ${apiName}: ${successRate.toFixed(1)}% success rate`);
      }

    } catch (error) {
      console.error('❌ Failed to generate performance summaries:', error);
    }
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(): void {
    // Generate performance summaries every hour
    this.monitoringInterval = setInterval(() => {
      this.generatePerformanceSummaries().catch(console.error);
    }, 60 * 60 * 1000); // Every hour

    console.log('🔍 API Health Monitoring started');
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('🛑 API Health Monitoring stopped');
  }

  /**
   * Check if an API should be bypassed due to circuit breaker
   */
  public shouldBypassApi(apiName: string): boolean {
    return CircuitBreakerManager.isOpen(apiName);
  }

  /**
   * Get circuit breaker states for all APIs
   */
  public getCircuitBreakerStates(): Record<string, string> {
    return CircuitBreakerManager.getAllStates();
  }
}

// Export singleton instance
export const apiHealthMonitoring = ApiHealthMonitoring.getInstance();

// Helper function to standardize API call recording
export async function recordApiCall(
  apiName: string,
  operation: () => Promise<any>,
  options: {
    endpoint?: string;
    operationType?: string;
    dealId?: string;
    userId?: string;
    requestId?: string;
    requestData?: any;
  } = {}
): Promise<any> {
  const startTime = Date.now();
  let success = false;
  let responseTimeMs = 0;
  let errorInfo: any = {};

  try {
    // Check circuit breaker
    if (apiHealthMonitoring.shouldBypassApi(apiName)) {
      throw new Error(`${apiName} API is currently offline (circuit breaker open)`);
    }

    const result = await operation();
    success = true;
    responseTimeMs = Date.now() - startTime;

    // Record successful call
    await apiHealthMonitoring.recordApiCall({
      apiName,
      ...options,
      success,
      responseTimeMs,
      httpStatusCode: 200,
      dataReceived: result !== null && result !== undefined,
      confidenceScore: result?.confidence || 85, // Default confidence for successful calls
      dataCompleteness: result?.completeness || 90,
    });

    return result;

  } catch (error) {
    responseTimeMs = Date.now() - startTime;
    
    // Categorize error
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorInfo.errorType = 'timeout';
      } else if (error.message.includes('rate limit')) {
        errorInfo.errorType = 'rate_limit';
      } else if (error.message.includes('authentication') || error.message.includes('401')) {
        errorInfo.errorType = 'authentication';
      } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        errorInfo.errorType = 'network_error';
      } else {
        errorInfo.errorType = 'api_error';
      }
      
      errorInfo.errorMessage = error.message;
      errorInfo.errorDetails = { stack: error.stack };
    } else {
      errorInfo.errorType = 'unknown';
      errorInfo.errorMessage = String(error);
    }

    // Record failed call
    await apiHealthMonitoring.recordApiCall({
      apiName,
      ...options,
      success,
      responseTimeMs,
      ...errorInfo,
      dataReceived: false,
      confidenceScore: 0,
      dataCompleteness: 0,
    });

    throw error;
  }
}

// Export functions for API routes
export async function getApiHealthMetrics() {
  try {
    const database = db;
    
    // Get current health status for each API
    const apis = ['hellodata'];  // USPS and census removed per user request
    const healthData: any = {
      timestamp: new Date(),
      apis: {},
      overallHealth: {
        averageSuccessRate: 0,
        totalRequests: 0,
        activeApis: 0,
        criticalIssues: 0
      }
    };

    let totalSuccessRate = 0;
    let totalRequests = 0;
    let activeApis = 0;

    for (const apiName of apis) {
      // Get recent metrics for this API (last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentMetrics = await database
        .select()
        .from(apiHealthMetrics)
        .where(and(
          eq(apiHealthMetrics.apiName, apiName),
          gte(apiHealthMetrics.timestamp, oneHourAgo)
        ))
        .orderBy(desc(apiHealthMetrics.timestamp))
        .limit(50);

      // Calculate metrics
      const totalCalls = recentMetrics.length;
      const successCalls = recentMetrics.filter(m => m.success).length;
      const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0;
      const avgResponseTime = totalCalls > 0 ? 
        recentMetrics.reduce((sum, m) => sum + (m.responseTimeMs || 0), 0) / totalCalls : 0;
      const errorRate = 100 - successRate;
      
      // Get recent errors
      const recentErrors = recentMetrics
        .filter(m => !m.success && m.errorMessage)
        .slice(0, 5)
        .map(m => m.errorMessage || 'Unknown error');

      // Calculate health score
      let healthScore = successRate;
      if (avgResponseTime > 5000) healthScore *= 0.8; // Slow response penalty
      if (totalCalls === 0) healthScore = 0; // No data penalty

      // Determine status
      let status: ApiHealthStatus = 'healthy';
      if (healthScore < 50) status = 'offline';
      else if (healthScore < 70) status = 'unhealthy';
      else if (healthScore < 90) status = 'degraded';

      // Check circuit breaker
      const circuitBreakerOpen = CircuitBreakerManager.isOpen(apiName);
      if (circuitBreakerOpen) {
        status = 'offline';
        healthScore = 0;
      }

      healthData.apis[apiName] = {
        apiName,
        status,
        successRate,
        avgResponseTime,
        errorRate,
        totalRequests: totalCalls,
        recentErrors,
        lastSuccessfulCall: recentMetrics.find(m => m.success)?.timestamp,
        healthScore,
        circuitBreakerOpen
      };

      // Update overall metrics
      if (totalCalls > 0) {
        totalSuccessRate += successRate;
        totalRequests += totalCalls;
        activeApis++;
      }
      
      if (status === 'unhealthy' || status === 'offline') {
        healthData.overallHealth.criticalIssues++;
      }
    }

    healthData.overallHealth.averageSuccessRate = activeApis > 0 ? totalSuccessRate / activeApis : 0;
    healthData.overallHealth.totalRequests = totalRequests;
    healthData.overallHealth.activeApis = activeApis;

    return healthData;
  } catch (error) {
    console.error('Error fetching API health metrics:', error);
    throw error;
  }
}

export async function getApiPerformanceHistory() {
  try {
    const database = db;
    const apis = ['hellodata'];  // USPS and census removed per user request
    const historyData: any = {};

    // Get last 24 hours of data
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const apiName of apis) {
      const metrics = await database
        .select()
        .from(apiHealthMetrics)
        .where(and(
          eq(apiHealthMetrics.apiName, apiName),
          gte(apiHealthMetrics.timestamp, oneDayAgo)
        ))
        .orderBy(desc(apiHealthMetrics.timestamp));

      // Group by hour and calculate averages
      const hourlyData: any = {};
      metrics.forEach(metric => {
        const hour = new Date(metric.timestamp);
        hour.setMinutes(0, 0, 0);
        const hourKey = hour.toISOString();

        if (!hourlyData[hourKey]) {
          hourlyData[hourKey] = {
            timestamp: hour,
            totalCalls: 0,
            successCalls: 0,
            totalResponseTime: 0
          };
        }

        hourlyData[hourKey].totalCalls++;
        if (metric.success) hourlyData[hourKey].successCalls++;
        hourlyData[hourKey].totalResponseTime += metric.responseTimeMs || 0;
      });

      // Convert to array format for charts
      historyData[apiName] = Object.values(hourlyData).map((data: any) => ({
        timestamp: data.timestamp,
        successRate: data.totalCalls > 0 ? (data.successCalls / data.totalCalls) * 100 : 0,
        avgResponseTime: data.totalCalls > 0 ? data.totalResponseTime / data.totalCalls : 0,
        totalRequests: data.totalCalls
      }));
    }

    return historyData;
  } catch (error) {
    console.error('Error fetching API performance history:', error);
    throw error;
  }
}

export async function getDataSourcesForDeal(dealId: string) {
  try {
    const database = db;
    
    const dataSources = await database
      .select()
      .from(apiDataSources)
      .where(eq(apiDataSources.dealId, dealId))
      .orderBy(desc(apiDataSources.retrievedAt));

    return dataSources.map(source => ({
      dataField: source.dataField,
      dataValue: source.dataValue,
      primarySource: source.primarySource,
      confidence: parseFloat(source.sourceConfidence || '0'),
      isMockData: source.isMockData,
      isUserProvided: source.isUserProvided,
      retrievedAt: source.retrievedAt || new Date()
    }));
  } catch (error) {
    console.error('Error fetching data sources for deal:', error);
    throw error;
  }
}
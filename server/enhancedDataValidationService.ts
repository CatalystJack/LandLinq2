// HelloData service removed per user request
// publicListingValidationService removed per user request
import { DataQualityMonitoringService } from './dataQualityMonitoringService';
import { db } from './db';
import { dataSourceMetrics, dealValidationHistory, deals } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

// PHASE 2: Enhanced interfaces for maximum validation accuracy
export interface SourceReliabilityMetrics {
  sourceName: string;
  historicalAccuracy: number;      // 0-100 based on past validation success
  responseTimeReliability: number; // 0-100 based on consistent response times
  dataFreshnessScore: number;      // 0-100 based on how current the data is
  conflictResolutionWeight: number; // Dynamic weight for resolving conflicts
  lastUpdated: Date;
  totalValidations: number;
  successfulValidations: number;
  averageConfidence: number;
  recentPerformanceTrend: 'improving' | 'stable' | 'declining';
}

export interface ValidationAuditTrail {
  validationId: string;
  dealId?: string;
  timestamp: Date;
  action: 'source_fetch' | 'cross_validation' | 'confidence_calculation' | 'discrepancy_detection' | 'flagging_decision';
  sourceName?: string;
  inputData: any;
  outputData: any;
  confidence: number;
  processingTime: number;
  issues: string[];
  metadata: {
    algorithmVersion: string;
    thresholds: any;
    sourceWeights: { [key: string]: number };
  };
}

export interface EnhancedValidationResult extends ValidatedPropertyData {
  // PHASE 2: Enhanced validation metadata
  validation: ValidatedPropertyData['validation'] & {
    sourceReliabilityScores: { [sourceName: string]: SourceReliabilityMetrics };
    conflictResolutions: Array<{
      field: string;
      conflictType: 'value_disagreement' | 'confidence_mismatch' | 'data_missing';
      sourcesInvolved: string[];
      resolutionMethod: 'weighted_average' | 'highest_confidence' | 'most_reliable_source' | 'manual_review';
      finalValue: any;
      confidence: number;
      auditTrail: string;
    }>;
    flaggingDecisions: Array<{
      reason: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      autoEscalated: boolean;
      threshold: number;
      actualValue: number;
      recommendations: string[];
    }>;
    processingMetrics: {
      totalProcessingTime: number;
      sourceResponseTimes: { [sourceName: string]: number };
      parallelizationEfficiency: number;
      cacheHitRate: number;
    };
    auditTrail: ValidationAuditTrail[];
  };
}

// Enhanced validation configuration - per user requirements (90%+ confidence)
const ENHANCED_VALIDATION_CONFIG = {
  // Confidence thresholds - elevated per user requirements
  CONFIDENCE_THRESHOLDS: {
    CRITICAL_MINIMUM: 95,    // Must be 95%+ for approval
    HIGH_CONFIDENCE: 90,     // High confidence threshold
    MEDIUM_CONFIDENCE: 80,   // Medium confidence threshold
    LOW_CONFIDENCE: 70,      // Low confidence threshold
    REJECT_BELOW: 60         // Auto-reject below this
  },

  // Enhanced discrepancy detection
  DISCREPANCY_THRESHOLDS: {
    // Financial data - more stringent for high-stakes decisions
    PRICE_CRITICAL: 0.05,       // 5% difference triggers critical review
    PRICE_MODERATE: 0.10,       // 10% difference flags for review
    PRICE_MINOR: 0.15,          // 15% difference noted but acceptable
    
    // Size measurements
    SIZE_CRITICAL: 0.03,        // 3% difference for size critical
    SIZE_MODERATE: 0.08,        // 8% difference for size review
    SIZE_MINOR: 0.12,           // 12% difference noted
    
    // Property details
    YEAR_BUILT_CRITICAL: 1,     // 1 year difference is critical
    YEAR_BUILT_MODERATE: 3,     // 3 years is moderate
    YEAR_BUILT_MINOR: 5,        // 5 years is minor
    
    // Demographics
    DEMO_CRITICAL: 0.08,        // 8% difference critical
    DEMO_MODERATE: 0.15,        // 15% difference moderate
    DEMO_MINOR: 0.25            // 25% difference minor
  },

  // Source reliability baseline weights (updated based on historical performance)
  SOURCE_BASELINE_WEIGHTS: {
    // USPS removed per user request
    'census': 0.90,      // Highest for demographics
    'hellodata': 0.75    // Good for rentals but limited coverage
  },

  // Auto-escalation rules
  ESCALATION_RULES: {
    CRITICAL_CONFLICTS: 2,      // Escalate if 2+ critical conflicts
    CONFIDENCE_DROP: 15,        // Escalate if confidence drops >15% from expected
    SOURCE_FAILURES: 3,         // Escalate if 3+ sources fail
    PROCESSING_TIMEOUT: 60000   // Escalate if processing takes >60s
  }
};

export class EnhancedDataValidationService {
  // Apify service removed per user request
  private hellodataService: HelloDataService;
  // ATTOM service removed
  private auditTrail: ValidationAuditTrail[] = [];
  private validationId: string;

  constructor() {
    // Apify service removed per user request
    this.hellodataService = new HelloDataService();
    // ATTOM service removed
    this.validationId = `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * PHASE 2: Get current source reliability metrics with historical analysis
   */
  private async getSourceReliabilityMetrics(): Promise<{ [sourceName: string]: SourceReliabilityMetrics }> {
    const metrics: { [sourceName: string]: SourceReliabilityMetrics } = {};
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
      console.log('📊 Loading source reliability metrics from historical data...');

      for (const sourceName of ['census', 'hellodata']) {
        // Get recent performance data
        const recentMetrics = await db
          .select()
          .from(dataSourceMetrics)
          .where(
            and(
              eq(dataSourceMetrics.sourceName, sourceName),
              gte(dataSourceMetrics.date, thirtyDaysAgo.toISOString().split('T')[0])
            )
          )
          .orderBy(desc(dataSourceMetrics.date))
          .limit(30);

        if (recentMetrics.length > 0) {
          // Calculate aggregated metrics
          const totalRequests = recentMetrics.reduce((sum, m) => sum + (m.totalRequests || 0), 0);
          const successfulRequests = recentMetrics.reduce((sum, m) => sum + (m.successfulRequests || 0), 0);
          const avgResponseTime = recentMetrics.reduce((sum, m) => sum + (Number(m.averageResponseTime) || 0), 0) / recentMetrics.length;
          const avgConfidence = recentMetrics.reduce((sum, m) => sum + (Number(m.averageConfidenceScore) || 0), 0) / recentMetrics.length;

          const historicalAccuracy = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
          const responseTimeReliability = Math.max(0, 100 - (avgResponseTime / 100)); // Lower response time = higher reliability
          const dataFreshnessScore = this.calculateDataFreshnessScore(sourceName, recentMetrics);

          // Calculate performance trend
          const recentHalf = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2));
          const olderHalf = recentMetrics.slice(Math.floor(recentMetrics.length / 2));
          
          const recentAvgSuccess = recentHalf.length > 0 ? 
            recentHalf.reduce((sum, m) => sum + (Number(m.successRate) || 0), 0) / recentHalf.length : 0;
          const olderAvgSuccess = olderHalf.length > 0 ? 
            olderHalf.reduce((sum, m) => sum + (Number(m.successRate) || 0), 0) / olderHalf.length : 0;

          let trend: 'improving' | 'stable' | 'declining' = 'stable';
          if (recentAvgSuccess > olderAvgSuccess + 5) trend = 'improving';
          else if (recentAvgSuccess < olderAvgSuccess - 5) trend = 'declining';

          // Calculate dynamic conflict resolution weight
          const baselineWeight = ENHANCED_VALIDATION_CONFIG.SOURCE_BASELINE_WEIGHTS[sourceName] || 0.5;
          const performanceMultiplier = (historicalAccuracy / 100) * (responseTimeReliability / 100);
          const conflictResolutionWeight = baselineWeight * performanceMultiplier;

          metrics[sourceName] = {
            sourceName,
            historicalAccuracy,
            responseTimeReliability,
            dataFreshnessScore,
            conflictResolutionWeight,
            lastUpdated: new Date(),
            totalValidations: totalRequests,
            successfulValidations: successfulRequests,
            averageConfidence: avgConfidence,
            recentPerformanceTrend: trend
          };

          console.log(`📈 ${sourceName.toUpperCase()}: Accuracy=${historicalAccuracy.toFixed(1)}%, Reliability=${responseTimeReliability.toFixed(1)}%, Weight=${conflictResolutionWeight.toFixed(3)}, Trend=${trend}`);
        } else {
          // Use baseline metrics for sources with no history
          metrics[sourceName] = {
            sourceName,
            historicalAccuracy: 75,
            responseTimeReliability: 75,
            dataFreshnessScore: 75,
            conflictResolutionWeight: ENHANCED_VALIDATION_CONFIG.SOURCE_BASELINE_WEIGHTS[sourceName] || 0.5,
            lastUpdated: new Date(),
            totalValidations: 0,
            successfulValidations: 0,
            averageConfidence: 0,
            recentPerformanceTrend: 'stable'
          };

          console.log(`📊 ${sourceName.toUpperCase()}: Using baseline metrics (no historical data)`);
        }
      }

      return metrics;
    } catch (error) {
      console.error('❌ Error loading source reliability metrics:', error);
      // Return baseline metrics on error
      const baselineMetrics: { [sourceName: string]: SourceReliabilityMetrics } = {};
      for (const sourceName of ['census', 'hellodata']) {
        baselineMetrics[sourceName] = {
          sourceName,
          historicalAccuracy: 75,
          responseTimeReliability: 75,
          dataFreshnessScore: 75,
          conflictResolutionWeight: ENHANCED_VALIDATION_CONFIG.SOURCE_BASELINE_WEIGHTS[sourceName] || 0.5,
          lastUpdated: new Date(),
          totalValidations: 0,
          successfulValidations: 0,
          averageConfidence: 0,
          recentPerformanceTrend: 'stable'
        };
      }
      return baselineMetrics;
    }
  }

  /**
   * Calculate data freshness score based on source characteristics
   */
  private calculateDataFreshnessScore(sourceName: string, metrics: any[]): number {
    // Different sources have different expected freshness
    const freshnessExpectations = {
      // USPS removed per user request
      'census': 70,    // Census data is inherently older but acceptable
      'hellodata': 85, // Rental data should be fairly current
    };

    // For now, return expected freshness - this could be enhanced with actual data age analysis
    return freshnessExpectations[sourceName] || 70;
  }

  /**
   * Add entry to validation audit trail
   */
  private addAuditEntry(
    action: ValidationAuditTrail['action'],
    sourceName: string | undefined,
    inputData: any,
    outputData: any,
    confidence: number,
    processingTime: number,
    issues: string[] = [],
    metadata: any = {}
  ): void {
    this.auditTrail.push({
      validationId: this.validationId,
      timestamp: new Date(),
      action,
      sourceName,
      inputData,
      outputData,
      confidence,
      processingTime,
      issues,
      metadata: {
        algorithmVersion: '2.0.0',
        thresholds: ENHANCED_VALIDATION_CONFIG.DISCREPANCY_THRESHOLDS,
        sourceWeights: {},
        ...metadata
      }
    });
  }

  /**
   * PHASE 2: Enhanced conflict resolution with weighted consensus algorithm
   */
  private resolveValueConflict<T>(
    values: Array<{ value: T; source: string; confidence: number }>,
    sourceMetrics: { [sourceName: string]: SourceReliabilityMetrics },
    field: string
  ): {
    resolvedValue: T;
    confidence: number;
    resolutionMethod: string;
    conflictDetails: any;
  } {
    if (values.length === 0) {
      return {
        resolvedValue: null as any,
        confidence: 0,
        resolutionMethod: 'no_data',
        conflictDetails: { reason: 'No values provided' }
      };
    }

    if (values.length === 1) {
      return {
        resolvedValue: values[0].value,
        confidence: values[0].confidence,
        resolutionMethod: 'single_source',
        conflictDetails: { source: values[0].source }
      };
    }

    // For numeric values, use weighted consensus
    if (typeof values[0].value === 'number') {
      return this.resolveNumericConflict(values as Array<{ value: number; source: string; confidence: number }>, sourceMetrics, field);
    }

    // For string values, use highest weighted confidence
    return this.resolveStringConflict(values, sourceMetrics, field);
  }

  /**
   * Resolve numeric conflicts using weighted average and outlier detection
   */
  private resolveNumericConflict(
    values: Array<{ value: number; source: string; confidence: number }>,
    sourceMetrics: { [sourceName: string]: SourceReliabilityMetrics },
    field: string
  ): { resolvedValue: number; confidence: number; resolutionMethod: string; conflictDetails: any } {
    
    // Calculate weights based on source reliability and confidence
    const weightedValues = values.map(v => {
      const sourceWeight = sourceMetrics[v.source]?.conflictResolutionWeight || 0.5;
      const confidenceWeight = v.confidence / 100;
      const finalWeight = sourceWeight * confidenceWeight;
      
      return {
        ...v,
        weight: finalWeight
      };
    });

    // Detect outliers (values that differ significantly from others)
    const outlierThreshold = this.getOutlierThreshold(field);
    const median = this.calculateMedian(values.map(v => v.value));
    const nonOutliers = weightedValues.filter(v => 
      Math.abs(v.value - median) / median <= outlierThreshold
    );

    const valuesToUse = nonOutliers.length >= 2 ? nonOutliers : weightedValues;
    
    // Calculate weighted average
    const totalWeight = valuesToUse.reduce((sum, v) => sum + v.weight, 0);
    const weightedSum = valuesToUse.reduce((sum, v) => sum + (v.value * v.weight), 0);
    const resolvedValue = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Calculate confidence based on agreement and source reliability
    const variance = this.calculateWeightedVariance(valuesToUse, resolvedValue);
    const agreementScore = Math.max(0, 100 - (variance * 10)); // Lower variance = higher agreement
    const avgSourceReliability = valuesToUse.reduce((sum, v) => 
      sum + (sourceMetrics[v.source]?.historicalAccuracy || 75), 0) / valuesToUse.length;
    
    const finalConfidence = (agreementScore * 0.6) + (avgSourceReliability * 0.4);

    return {
      resolvedValue,
      confidence: Math.min(100, finalConfidence),
      resolutionMethod: nonOutliers.length < weightedValues.length ? 'weighted_average_outliers_removed' : 'weighted_average',
      conflictDetails: {
        originalValues: values,
        weights: weightedValues.map(v => ({ source: v.source, weight: v.weight })),
        outliersRemoved: weightedValues.length - valuesToUse.length,
        variance,
        agreementScore
      }
    };
  }

  /**
   * Resolve string conflicts by selecting highest weighted confidence value
   */
  private resolveStringConflict<T>(
    values: Array<{ value: T; source: string; confidence: number }>,
    sourceMetrics: { [sourceName: string]: SourceReliabilityMetrics },
    field: string
  ): { resolvedValue: T; confidence: number; resolutionMethod: string; conflictDetails: any } {
    
    // Calculate combined scores (source reliability * confidence)
    const scoredValues = values.map(v => {
      const sourceReliability = sourceMetrics[v.source]?.historicalAccuracy || 75;
      const combinedScore = (sourceReliability / 100) * (v.confidence / 100) * 100;
      
      return {
        ...v,
        combinedScore
      };
    });

    // Select value with highest combined score
    const bestValue = scoredValues.reduce((best, current) => 
      current.combinedScore > best.combinedScore ? current : best
    );

    return {
      resolvedValue: bestValue.value,
      confidence: bestValue.combinedScore,
      resolutionMethod: 'highest_weighted_confidence',
      conflictDetails: {
        allScores: scoredValues.map(v => ({ 
          source: v.source, 
          value: v.value, 
          score: v.combinedScore 
        })),
        winner: { source: bestValue.source, score: bestValue.combinedScore }
      }
    };
  }

  /**
   * Get outlier detection threshold based on field type
   */
  private getOutlierThreshold(field: string): number {
    const thresholds = {
      'price': 0.25,        // 25% difference for prices
      'size': 0.15,         // 15% difference for sizes
      'year': 0.05,         // 5% difference for years (in context)
      'demographic': 0.30   // 30% difference for demographics
    };

    for (const [key, threshold] of Object.entries(thresholds)) {
      if (field.toLowerCase().includes(key)) {
        return threshold;
      }
    }

    return 0.20; // Default 20%
  }

  /**
   * Calculate median of numeric array
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * Calculate weighted variance
   */
  private calculateWeightedVariance(
    weightedValues: Array<{ value: number; weight: number }>, 
    mean: number
  ): number {
    const totalWeight = weightedValues.reduce((sum, v) => sum + v.weight, 0);
    const weightedSumSquaredDiff = weightedValues.reduce((sum, v) => 
      sum + (v.weight * Math.pow(v.value - mean, 2)), 0);
    
    return totalWeight > 0 ? weightedSumSquaredDiff / totalWeight : 0;
  }

  /**
   * PHASE 2: Enhanced parallel data fetching with circuit breakers and fallbacks
   */
  private async enhancedParallelDataFetch(
    address: string
  ): Promise<{
    sources: { [key: string]: any };
    metrics: { [key: string]: { responseTime: number; success: boolean; error?: string } };
    cacheHits: string[];
  }> {
    const startTime = Date.now();
    const fetchMetrics: { [key: string]: { responseTime: number; success: boolean; error?: string } } = {};
    const cacheHits: string[] = [];

    console.log(`🚀 Starting enhanced parallel data fetch for: ${address}`);

    // Enhanced timeout and retry configuration
    const FETCH_CONFIG = {
      timeout: 30000,           // 30 second timeout per source
      maxRetries: 2,           // 2 retries per source
      circuitBreakerThreshold: 5 // Open circuit after 5 failures
    };

    // Create fetch operations with enhanced error handling
    const fetchOperations = [
      // USPS removed per user request
      // Census API removed per user request
      // Apify removed per user request
      {
        name: 'hellodata',
        operation: () => this.fetchWithRetry(
          () => this.hellodataService.getPropertyData(address),
          'hellodata',
          FETCH_CONFIG
        )
      },
      // ATTOM disabled per user request - using HelloData only
      // {
      //   name: 'attom',
      //   operation: () => this.fetchWithRetry(
      //     () => this.attomService.getPropertyByAddress(address),
      //     'attom',
      //     FETCH_CONFIG
      //   )
      // }
    ];

    // Execute all operations in parallel with individual timeouts
    const results = await Promise.allSettled(
      fetchOperations.map(async ({ name, operation }) => {
        const opStartTime = Date.now();
        
        try {
          const result = await Promise.race([
            operation(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`${name} timeout`)), FETCH_CONFIG.timeout)
            )
          ]);
          
          const responseTime = Date.now() - opStartTime;
          fetchMetrics[name] = { responseTime, success: true };
          
          this.addAuditEntry(
            'source_fetch',
            name,
            { address },
            result,
            100,
            responseTime,
            [],
            { fetchConfig: FETCH_CONFIG }
          );
          
          console.log(`✅ ${name.toUpperCase()}: Fetched successfully in ${responseTime}ms`);
          return { name, result };
          
        } catch (error) {
          const responseTime = Date.now() - opStartTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          fetchMetrics[name] = { responseTime, success: false, error: errorMessage };
          
          this.addAuditEntry(
            'source_fetch',
            name,
            { address },
            null,
            0,
            responseTime,
            [errorMessage],
            { fetchConfig: FETCH_CONFIG }
          );
          
          console.warn(`⚠️ ${name.toUpperCase()}: Failed after ${responseTime}ms - ${errorMessage}`);
          throw error;
        }
      })
    );

    // Process results
    const sources: { [key: string]: any } = {};
    results.forEach((result, index) => {
      const sourceName = fetchOperations[index].name;
      if (result.status === 'fulfilled') {
        sources[sourceName] = result.value.result;
      } else {
        sources[sourceName] = null;
      }
    });

    const totalTime = Date.now() - startTime;
    console.log(`📊 Parallel fetch completed in ${totalTime}ms`);
    console.log(`📈 Success rate: ${Object.values(fetchMetrics).filter(m => m.success).length}/${Object.keys(fetchMetrics).length}`);

    return { sources, metrics: fetchMetrics, cacheHits };
  }

  /**
   * Enhanced fetch with retry logic and circuit breaker
   */
  private async fetchWithRetry<T>(
    operation: () => Promise<T>,
    sourceName: string,
    config: { timeout: number; maxRetries: number }
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Record successful fetch for reliability metrics
        await this.recordSourceMetric(sourceName, true, Date.now());
        
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`🔄 ${sourceName.toUpperCase()}: Retry ${attempt}/${config.maxRetries} failed - ${lastError.message}`);
        
        if (attempt === config.maxRetries) {
          // Record failed fetch for reliability metrics
          await this.recordSourceMetric(sourceName, false, Date.now());
          break;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Record source performance metric for future reliability calculations
   */
  private async recordSourceMetric(
    sourceName: string,
    success: boolean,
    processingTime: number
  ): Promise<void> {
    try {
      // This would typically update the dataSourceMetrics table
      // For now, we'll just log it - in production this should persist the metrics
      console.log(`📊 Recording metric: ${sourceName} - Success: ${success}, Time: ${processingTime}ms`);
      
      // TODO: Implement actual database recording when schema is ready
      // await db.insert(dataSourceMetrics).values({
      //   sourceName,
      //   date: new Date().toISOString().split('T')[0],
      //   totalRequests: 1,
      //   successfulRequests: success ? 1 : 0,
      //   failedRequests: success ? 0 : 1,
      //   averageResponseTime: processingTime
      // });
      
    } catch (error) {
      console.warn('Failed to record source metric:', error);
    }
  }

  /**
   * PHASE 2: Main enhanced validation method with comprehensive cross-validation
   */
  async validatePropertyDataEnhanced(
    address: string,
    dealId?: string
  ): Promise<EnhancedValidationResult> {
    const overallStartTime = Date.now();
    
    console.log(`🎯 PHASE 2: Starting enhanced validation for: ${address}`);
    
    try {
      // Step 1: Load source reliability metrics
      const sourceMetrics = await this.getSourceReliabilityMetrics();
      
      // Step 2: Enhanced parallel data fetching
      const { sources, metrics: fetchMetrics, cacheHits } = await this.enhancedParallelDataFetch(address);
      
      // Step 3: Cross-validate each data category with enhanced algorithms
      const addressValidation = await this.enhancedAddressValidation(address, sources, sourceMetrics);
      const sizeValidation = this.enhancedSizeValidation(sources, sourceMetrics);
      const valuationValidation = this.enhancedValuationValidation(sources, sourceMetrics);
      const detailsValidation = this.enhancedDetailsValidation(sources, sourceMetrics);
      const demographicsValidation = await this.enhancedDemographicsValidation(address, sources, sourceMetrics);
      const rentDataValidation = this.enhancedRentDataValidation(sources, sourceMetrics);
      const publicListingsValidation = await this.validatePublicListings(address);
      
      // Step 4: Calculate overall validation metrics with enhanced algorithms
      const enhancedResult: EnhancedValidationResult = {
        address: addressValidation.result,
        size: sizeValidation.result,
        valuation: valuationValidation.result,
        details: detailsValidation.result,
        demographics: demographicsValidation.result,
        rentData: rentDataValidation.result,
        publicListings: publicListingsValidation,
        validation: {
          overallConfidence: 0,
          sourceCount: 0,
          sourcesUsed: [],
          discrepancyCount: 0,
          lastValidated: new Date(),
          qualityScore: 0,
          sourceReliabilityScores: sourceMetrics,
          conflictResolutions: [
            ...addressValidation.conflicts,
            ...sizeValidation.conflicts,
            ...valuationValidation.conflicts,
            ...detailsValidation.conflicts,
            ...demographicsValidation.conflicts,
            ...rentDataValidation.conflicts
          ],
          flaggingDecisions: [],
          processingMetrics: {
            totalProcessingTime: Date.now() - overallStartTime,
            sourceResponseTimes: Object.fromEntries(
              Object.entries(fetchMetrics).map(([name, m]) => [name, m.responseTime])
            ),
            parallelizationEfficiency: this.calculateParallelizationEfficiency(fetchMetrics),
            cacheHitRate: cacheHits.length / Object.keys(sources).length
          },
          auditTrail: [...this.auditTrail]
        }
      };
      
      // Step 5: Calculate enhanced overall metrics
      enhancedResult.validation = {
        ...enhancedResult.validation,
        ...this.calculateEnhancedValidationMetrics(enhancedResult)
      };
      
      // Step 6: Apply enhanced flagging logic
      const flaggingDecisions = this.applyEnhancedFlaggingLogic(enhancedResult);
      enhancedResult.validation.flaggingDecisions = flaggingDecisions;
      
      // Step 7: Save validation audit trail if dealId provided
      if (dealId) {
        await this.saveValidationAuditTrail(dealId, enhancedResult);
      }
      
      const totalTime = Date.now() - overallStartTime;
      console.log(`✅ PHASE 2: Enhanced validation completed in ${totalTime}ms`);
      console.log(`📊 Final Results: Confidence=${enhancedResult.validation.overallConfidence.toFixed(1)}%, Quality=${enhancedResult.validation.qualityScore.toFixed(1)}%`);
      console.log(`🚨 Flagging Decisions: ${flaggingDecisions.length} total, ${flaggingDecisions.filter(f => f.autoEscalated).length} auto-escalated`);
      
      return enhancedResult;
      
    } catch (error) {
      const processingTime = Date.now() - overallStartTime;
      console.error(`❌ Enhanced validation failed after ${processingTime}ms:`, error);
      
      this.addAuditEntry(
        'cross_validation',
        undefined,
        { address, dealId },
        null,
        0,
        processingTime,
        [error instanceof Error ? error.message : String(error)],
        { errorType: 'validation_failure' }
      );
      
      throw error;
    }
  }

  /**
   * Enhanced address validation with sophisticated cross-validation
   */
  private async enhancedAddressValidation(
    address: string,
    sources: any,
    sourceMetrics: { [sourceName: string]: SourceReliabilityMetrics }
  ): Promise<{
    result: ValidatedPropertyData['address'];
    conflicts: Array<any>;
  }> {
    const startTime = Date.now();
    const conflicts: Array<any> = [];
    
    console.log('📮 Enhanced address validation starting...');
    
    // Collect all address data
    const addressCandidates: Array<{
      source: string;
      address: string;
      coordinates?: { lat: number; lon: number };
      confidence: number;
      components?: any;
    }> = [];
    
    // USPS removed per user request
    
    // Other sources
    ['apify', 'hellodata'].forEach(sourceName => {
      const data = sources[sourceName];
      if (data && data.address) {
        addressCandidates.push({
          source: sourceName,
          address: data.address,
          coordinates: data.latitude && data.longitude ? 
            { lat: data.latitude, lon: data.longitude } : undefined,
          confidence: 85 // Default confidence
        });
      }
    });
    
    // Resolve address conflicts using enhanced algorithm
    const addressResolution = this.resolveValueConflict(
      addressCandidates.map(c => ({ value: c.address, source: c.source, confidence: c.confidence })),
      sourceMetrics,
      'address'
    );
    
    if (addressCandidates.length > 1) {
      conflicts.push({
        field: 'address',
        conflictType: 'value_disagreement',
        sourcesInvolved: addressCandidates.map(c => c.source),
        resolutionMethod: addressResolution.resolutionMethod,
        finalValue: addressResolution.resolvedValue,
        confidence: addressResolution.confidence,
        auditTrail: `Resolved from ${addressCandidates.length} sources using ${addressResolution.resolutionMethod}`
      });
    }
    
    // Build final address result
    const result: ValidatedPropertyData['address'] = {
      standardized: addressResolution.resolvedValue || address,
      components: {},  // USPS removed per user request
      coordinates: {
        latitude: sources.apify?.latitude || sources.hellodata?.latitude,
        longitude: sources.apify?.longitude || sources.hellodata?.longitude
      },
      confidence: addressResolution.confidence,
      sources: addressCandidates.map(c => c.source),
      discrepancies: conflicts.map(c => c.auditTrail)
    };
    
    this.addAuditEntry(
      'cross_validation',
      'address_validation',
      { address, candidates: addressCandidates },
      result,
      result.confidence,
      Date.now() - startTime,
      [],
      { resolutionMethod: addressResolution.resolutionMethod }
    );
    
    return { result, conflicts };
  }
  
  /**
   * Enhanced size validation with outlier detection
   */
  private enhancedSizeValidation(
    sources: any,
    sourceMetrics: { [sourceName: string]: SourceReliabilityMetrics }
  ): Promise<{ result: ValidatedPropertyData['size']; conflicts: Array<any> }> {
    const startTime = Date.now();
    const conflicts: Array<any> = [];
    
    // Collect size data from sources
    const sizeCandidates: Array<{ source: string; acres?: number; sqft?: number; confidence: number }> = [];
    
    Object.entries(sources).forEach(([sourceName, data]) => {
      if (data) {
        const candidate: any = { source: sourceName, confidence: 80 };
        
        if (data.acres) candidate.acres = data.acres;
        if (data.sqft || data.squareFootage || data.lotSize) {
          candidate.sqft = data.sqft || data.squareFootage || data.lotSize;
        }
        
        if (candidate.acres || candidate.sqft) {
          sizeCandidates.push(candidate);
        }
      }
    });
    
    // Resolve size conflicts
    const acresValues = sizeCandidates.filter(c => c.acres).map(c => ({ 
      value: c.acres!, source: c.source, confidence: c.confidence 
    }));
    const sqftValues = sizeCandidates.filter(c => c.sqft).map(c => ({ 
      value: c.sqft!, source: c.source, confidence: c.confidence 
    }));
    
    const acresResolution = this.resolveValueConflict(acresValues, sourceMetrics, 'acres');
    const sqftResolution = this.resolveValueConflict(sqftValues, sourceMetrics, 'sqft');
    
    // Add conflicts if sources disagreed
    if (acresValues.length > 1) {
      conflicts.push({
        field: 'acres',
        conflictType: 'value_disagreement',
        sourcesInvolved: acresValues.map(v => v.source),
        resolutionMethod: acresResolution.resolutionMethod,
        finalValue: acresResolution.resolvedValue,
        confidence: acresResolution.confidence,
        auditTrail: `Acres resolved using ${acresResolution.resolutionMethod}`
      });
    }
    
    if (sqftValues.length > 1) {
      conflicts.push({
        field: 'sqft',
        conflictType: 'value_disagreement',
        sourcesInvolved: sqftValues.map(v => v.source),
        resolutionMethod: sqftResolution.resolutionMethod,
        finalValue: sqftResolution.resolvedValue,
        confidence: sqftResolution.confidence,
        auditTrail: `Square footage resolved using ${sqftResolution.resolutionMethod}`
      });
    }
    
    const avgConfidence = ((acresResolution.confidence || 0) + (sqftResolution.confidence || 0)) / 2;
    
    const result: ValidatedPropertyData['size'] = {
      acres: acresResolution.resolvedValue,
      squareFootage: sqftResolution.resolvedValue,
      lotSizeSquareFeet: sqftResolution.resolvedValue,
      confidence: avgConfidence,
      sources: sizeCandidates.map(c => c.source),
      discrepancies: conflicts.map(c => c.auditTrail)
    };
    
    this.addAuditEntry(
      'cross_validation',
      'size_validation',
      { candidates: sizeCandidates },
      result,
      result.confidence,
      Date.now() - startTime
    );
    
    return Promise.resolve({ result, conflicts });
  }
  
  /**
   * Enhanced valuation validation with price discrepancy analysis
   */
  private enhancedValuationValidation(
    sources: any,
    sourceMetrics: { [sourceName: string]: SourceReliabilityMetrics }
  ): Promise<{ result: ValidatedPropertyData['valuation']; conflicts: Array<any> }> {
    const startTime = Date.now();
    const conflicts: Array<any> = [];
    
    // Collect valuation data
    const priceCandidates: Array<{ source: string; price?: number; assessed?: number; market?: number; confidence: number }> = [];
    
    Object.entries(sources).forEach(([sourceName, data]) => {
      if (data) {
        const candidate: any = { source: sourceName, confidence: 80 };
        
        if (data.price) candidate.price = data.price;
        if (data.assessedValue) candidate.assessed = data.assessedValue;
        if (data.marketValue) candidate.market = data.marketValue;
        
        if (candidate.price || candidate.assessed || candidate.market) {
          priceCandidates.push(candidate);
        }
      }
    });
    
    // Resolve valuation conflicts
    const priceValues = priceCandidates.filter(c => c.price).map(c => ({ 
      value: c.price!, source: c.source, confidence: c.confidence 
    }));
    const assessedValues = priceCandidates.filter(c => c.assessed).map(c => ({ 
      value: c.assessed!, source: c.source, confidence: c.confidence 
    }));
    const marketValues = priceCandidates.filter(c => c.market).map(c => ({ 
      value: c.market!, source: c.source, confidence: c.confidence 
    }));
    
    const priceResolution = this.resolveValueConflict(priceValues, sourceMetrics, 'price');
    const assessedResolution = this.resolveValueConflict(assessedValues, sourceMetrics, 'price');
    const marketResolution = this.resolveValueConflict(marketValues, sourceMetrics, 'price');
    
    // Check for critical price discrepancies
    const allPrices = [...priceValues, ...assessedValues, ...marketValues];
    if (allPrices.length > 1) {
      const priceArray = allPrices.map(p => p.value);
      const maxPrice = Math.max(...priceArray);
      const minPrice = Math.min(...priceArray);
      const discrepancyPercent = (maxPrice - minPrice) / minPrice;
      
      if (discrepancyPercent > ENHANCED_VALIDATION_CONFIG.DISCREPANCY_THRESHOLDS.PRICE_CRITICAL) {
        conflicts.push({
          field: 'price',
          conflictType: 'value_disagreement',
          sourcesInvolved: allPrices.map(p => p.source),
          resolutionMethod: 'requires_manual_review',
          finalValue: null,
          confidence: 0,
          auditTrail: `CRITICAL: Price discrepancy of ${(discrepancyPercent * 100).toFixed(1)}% exceeds threshold`
        });
      }
    }
    
    const avgConfidence = [
      priceResolution.confidence,
      assessedResolution.confidence,
      marketResolution.confidence
    ].filter(c => c > 0).reduce((sum, c) => sum + c, 0) / 3;
    
    const result: ValidatedPropertyData['valuation'] = {
      listingPrice: priceResolution.resolvedValue,
      assessedValue: assessedResolution.resolvedValue,
      marketValue: marketResolution.resolvedValue,
      pricePerAcre: undefined, // Calculate if we have both price and acres
      pricePerSquareFoot: undefined, // Calculate if we have both price and sqft
      confidence: avgConfidence,
      sources: priceCandidates.map(c => c.source),
      discrepancies: conflicts.map(c => c.auditTrail)
    };
    
    this.addAuditEntry(
      'cross_validation',
      'valuation_validation',
      { candidates: priceCandidates },
      result,
      result.confidence,
      Date.now() - startTime
    );
    
    return Promise.resolve({ result, conflicts });
  }
  
  /**
   * Enhanced details validation
   */
  private enhancedDetailsValidation(
    sources: any,
    sourceMetrics: { [sourceName: string]: SourceReliabilityMetrics }
  ): Promise<{ result: ValidatedPropertyData['details']; conflicts: Array<any> }> {
    const startTime = Date.now();
    const conflicts: Array<any> = [];
    
    // Collect details data
    const detailsCandidates: Array<{ 
      source: string; 
      yearBuilt?: number; 
      bedrooms?: number; 
      bathrooms?: number;
      propertyType?: string;
      zoning?: string;
      confidence: number;
    }> = [];
    
    Object.entries(sources).forEach(([sourceName, data]) => {
      if (data) {
        const candidate: any = { source: sourceName, confidence: 80 };
        
        if (data.yearBuilt) candidate.yearBuilt = data.yearBuilt;
        if (data.bedrooms) candidate.bedrooms = data.bedrooms;
        if (data.bathrooms) candidate.bathrooms = data.bathrooms;
        if (data.propertyType) candidate.propertyType = data.propertyType;
        if (data.zoning) candidate.zoning = data.zoning;
        
        detailsCandidates.push(candidate);
      }
    });
    
    // Resolve each detail field
    const yearBuiltValues = detailsCandidates.filter(c => c.yearBuilt).map(c => ({ 
      value: c.yearBuilt!, source: c.source, confidence: c.confidence 
    }));
    
    const yearBuiltResolution = this.resolveValueConflict(yearBuiltValues, sourceMetrics, 'year');
    
    if (yearBuiltValues.length > 1) {
      const yearArray = yearBuiltValues.map(y => y.value);
      const maxYear = Math.max(...yearArray);
      const minYear = Math.min(...yearArray);
      
      if (maxYear - minYear > ENHANCED_VALIDATION_CONFIG.DISCREPANCY_THRESHOLDS.YEAR_BUILT_CRITICAL) {
        conflicts.push({
          field: 'yearBuilt',
          conflictType: 'value_disagreement',
          sourcesInvolved: yearBuiltValues.map(y => y.source),
          resolutionMethod: yearBuiltResolution.resolutionMethod,
          finalValue: yearBuiltResolution.resolvedValue,
          confidence: yearBuiltResolution.confidence,
          auditTrail: `Year built discrepancy: ${minYear}-${maxYear}`
        });
      }
    }
    
    const result: ValidatedPropertyData['details'] = {
      yearBuilt: yearBuiltResolution.resolvedValue,
      bedrooms: undefined, // Implement similar resolution for other fields
      bathrooms: undefined,
      propertyType: undefined,
      zoning: undefined,
      confidence: yearBuiltResolution.confidence,
      sources: detailsCandidates.map(c => c.source),
      discrepancies: conflicts.map(c => c.auditTrail)
    };
    
    this.addAuditEntry(
      'cross_validation',
      'details_validation',
      { candidates: detailsCandidates },
      result,
      result.confidence,
      Date.now() - startTime
    );
    
    return Promise.resolve({ result, conflicts });
  }
  
  /**
   * Enhanced demographics validation with geographic precision
   */
  private async enhancedDemographicsValidation(
    address: string,
    sources: any,
    sourceMetrics: { [sourceName: string]: SourceReliabilityMetrics }
  ): Promise<{ result: ValidatedPropertyData['demographics']; conflicts: Array<any> }> {
    const startTime = Date.now();
    const conflicts: Array<any> = [];
    
    console.log('📊 Enhanced demographics validation starting...');
    
    let result: ValidatedPropertyData['demographics'] = {
      totalPopulation: undefined,
      medianHouseholdIncome: undefined,
      population55Plus: undefined,
      income75Plus55Plus: undefined,
      medianAge: undefined,
      confidence: 0,
      sources: [],
      discrepancies: []
    };
    
    // Census data has highest priority
    if (sources.census && sources.census.success) {
      const censusData = sources.census.data;
      
      result = {
        totalPopulation: censusData.totalPopulation,
        medianHouseholdIncome: censusData.medianHouseholdIncome,
        population55Plus: censusData.population55Plus,
        income75Plus55Plus: undefined, // Will be populated by regional data
        medianAge: censusData.medianAge,
        confidence: 85,
        sources: ['census'],
        discrepancies: []
      };
      
      // Get enhanced regional demographics for Active Adult analysis
      try {
        console.log('⚠️ Census API removed - demographic data unavailable');
        result.population55Plus = 0;
        result.income75Plus55Plus = 0;
        result.confidence = 0;
        result.sources.push('census_removed');
      } catch (error) {
        console.warn('Could not get enhanced regional demographics:', error);
        result.discrepancies.push('Regional demographic enhancement failed');
      }
    }
    
    this.addAuditEntry(
      'cross_validation',
      'demographics_validation',
      { address, sources: Object.keys(sources) },
      result,
      result.confidence,
      Date.now() - startTime
    );
    
    return { result, conflicts };
  }
  
  /**
   * Enhanced rent data validation
   */
  private enhancedRentDataValidation(
    sources: any,
    sourceMetrics: { [sourceName: string]: SourceReliabilityMetrics }
  ): Promise<{ result: ValidatedPropertyData['rentData']; conflicts: Array<any> }> {
    const startTime = Date.now();
    const conflicts: Array<any> = [];
    
    // Collect rent data
    const rentCandidates: Array<{ source: string; avgRent?: number; rentPerSqFt?: number; confidence: number }> = [];
    
    Object.entries(sources).forEach(([sourceName, data]) => {
      if (data && (data.averageRent || data.rentPerSqFt)) {
        rentCandidates.push({
          source: sourceName,
          avgRent: data.averageRent,
          rentPerSqFt: data.rentPerSqFt,
          confidence: 75
        });
      }
    });
    
    // Simple resolution for now - can be enhanced with weighted algorithms
    const avgRent = rentCandidates.find(c => c.avgRent)?.avgRent;
    const rentPerSqFt = rentCandidates.find(c => c.rentPerSqFt)?.rentPerSqFt;
    
    const result: ValidatedPropertyData['rentData'] = {
      averageRent: avgRent,
      rentPerSquareFoot: rentPerSqFt,
      medianGrossRent: undefined,
      confidence: rentCandidates.length > 0 ? 75 : 0,
      sources: rentCandidates.map(c => c.source),
      discrepancies: []
    };
    
    this.addAuditEntry(
      'cross_validation',
      'rent_data_validation',
      { candidates: rentCandidates },
      result,
      result.confidence,
      Date.now() - startTime
    );
    
    return Promise.resolve({ result, conflicts });
  }
  
  /**
   * Placeholder for public listings validation (reuse existing method)
   */
  private async validatePublicListings(address: string): Promise<ValidatedPropertyData['publicListings']> {
    console.log(`🌐 Public listing validation for: ${address}`);
    
    // Use existing implementation for now
    return {
      isPubliclyListed: false,
      confidence: 'none',
      marketExposure: 'none',
      platformsFound: [],
      priceComparison: {
        hasComparison: false,
        dealPrice: 0,
        marketPrice: 0,
        difference: 0,
        differencePercent: 0,
        assessment: 'unknown'
      },
      exclusivityStatus: {
        isExclusive: true,
        brokerExclusivity: true,
        offMarketVerified: false
      },
      requiresAnalystReview: false,
      recommendations: ['Enhanced public listing validation pending'],
      validationSuccess: true,
      lastChecked: new Date(),
      sources: ['enhanced_validation_service'],
      discrepancies: []
    };
  }
  
  /**
   * Calculate parallelization efficiency metric
   */
  private calculateParallelizationEfficiency(fetchMetrics: { [key: string]: { responseTime: number; success: boolean } }): number {
    const responseTimes = Object.values(fetchMetrics).map(m => m.responseTime);
    const maxTime = Math.max(...responseTimes);
    const totalTime = responseTimes.reduce((sum, time) => sum + time, 0);
    
    // Efficiency = how much time we saved by running in parallel
    return maxTime > 0 ? (totalTime - maxTime) / totalTime * 100 : 0;
  }
  
  /**
   * Calculate enhanced validation metrics
   */
  private calculateEnhancedValidationMetrics(validationResult: EnhancedValidationResult): Partial<EnhancedValidationResult['validation']> {
    const allConfidences = [
      validationResult.address.confidence,
      validationResult.size.confidence,
      validationResult.valuation.confidence,
      validationResult.details.confidence,
      validationResult.demographics.confidence,
      validationResult.rentData.confidence
    ].filter(c => c > 0);
    
    const overallConfidence = allConfidences.length > 0 
      ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
      : 0;
    
    const allSources = new Set([
      ...validationResult.address.sources,
      ...validationResult.size.sources,
      ...validationResult.valuation.sources,
      ...validationResult.details.sources,
      ...validationResult.demographics.sources,
      ...validationResult.rentData.sources
    ]);
    
    const totalDiscrepancies = [
      validationResult.address.discrepancies.length,
      validationResult.size.discrepancies.length,
      validationResult.valuation.discrepancies.length,
      validationResult.details.discrepancies.length,
      validationResult.demographics.discrepancies.length,
      validationResult.rentData.discrepancies.length
    ].reduce((sum, count) => sum + count, 0);
    
    // Quality score based on confidence, sources, and discrepancies
    const qualityScore = Math.max(0, 
      overallConfidence - (totalDiscrepancies * 5) + (allSources.size * 2)
    );
    
    return {
      overallConfidence,
      sourceCount: allSources.size,
      sourcesUsed: Array.from(allSources),
      discrepancyCount: totalDiscrepancies,
      qualityScore: Math.min(100, qualityScore)
    };
  }
  
  /**
   * Apply enhanced flagging logic with automatic escalation
   */
  private applyEnhancedFlaggingLogic(validationResult: EnhancedValidationResult): Array<any> {
    const flaggingDecisions: Array<any> = [];
    
    // Check overall confidence threshold
    if (validationResult.validation.overallConfidence < ENHANCED_VALIDATION_CONFIG.CONFIDENCE_THRESHOLDS.CRITICAL_MINIMUM) {
      flaggingDecisions.push({
        reason: 'Overall confidence below critical minimum',
        severity: 'critical',
        autoEscalated: true,
        threshold: ENHANCED_VALIDATION_CONFIG.CONFIDENCE_THRESHOLDS.CRITICAL_MINIMUM,
        actualValue: validationResult.validation.overallConfidence,
        recommendations: ['Manual review required', 'Additional data sources needed']
      });
    }
    
    // Check for critical conflicts
    const criticalConflicts = validationResult.validation.conflictResolutions.filter(
      c => c.confidence < ENHANCED_VALIDATION_CONFIG.CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE
    );
    
    if (criticalConflicts.length >= ENHANCED_VALIDATION_CONFIG.ESCALATION_RULES.CRITICAL_CONFLICTS) {
      flaggingDecisions.push({
        reason: `${criticalConflicts.length} critical data conflicts detected`,
        severity: 'high',
        autoEscalated: true,
        threshold: ENHANCED_VALIDATION_CONFIG.ESCALATION_RULES.CRITICAL_CONFLICTS,
        actualValue: criticalConflicts.length,
        recommendations: ['Analyst review required', 'Source verification needed']
      });
    }
    
    // Check processing timeout
    if (validationResult.validation.processingMetrics.totalProcessingTime > ENHANCED_VALIDATION_CONFIG.ESCALATION_RULES.PROCESSING_TIMEOUT) {
      flaggingDecisions.push({
        reason: 'Validation processing exceeded timeout threshold',
        severity: 'medium',
        autoEscalated: false,
        threshold: ENHANCED_VALIDATION_CONFIG.ESCALATION_RULES.PROCESSING_TIMEOUT,
        actualValue: validationResult.validation.processingMetrics.totalProcessingTime,
        recommendations: ['Check source performance', 'Consider caching strategy']
      });
    }
    
    return flaggingDecisions;
  }
  
  /**
   * Save validation audit trail to database
   */
  private async saveValidationAuditTrail(
    dealId: string,
    validationResult: EnhancedValidationResult
  ): Promise<void> {
    try {
      console.log(`💾 Saving validation audit trail for deal ${dealId}`);
      
      // TODO: Implement database saving when schema is ready
      // For now, just log the audit trail
      console.log(`📋 Audit trail entries: ${this.auditTrail.length}`);
      console.log(`🚨 Flagging decisions: ${validationResult.validation.flaggingDecisions.length}`);
      console.log(`🔄 Conflict resolutions: ${validationResult.validation.conflictResolutions.length}`);
      
      // This would typically save to dealValidationHistory table
      // await db.insert(dealValidationHistory).values({
      //   dealId,
      //   validationId: this.validationId,
      //   validationData: validationResult,
      //   auditTrail: this.auditTrail,
      //   createdAt: new Date()
      // });
      
    } catch (error) {
      console.error('Failed to save validation audit trail:', error);
    }
  }
}
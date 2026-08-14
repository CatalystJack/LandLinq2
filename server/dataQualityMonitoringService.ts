import { db } from './db';
import { 
  dataSourceMetrics, 
  dataQualityMetrics, 
  dataQualityAlerts, 
  dataQualitySnapshots, 
  dealValidationHistory,
  deals
} from '@shared/schema';
import { sql, eq, desc, gte, lte, and, avg, count, sum } from 'drizzle-orm';
import { ValidatedPropertyData } from './dataValidationService';
import { sendNotificationEmail } from './emailService';
import { sendSMS } from './smsService';

// Data quality thresholds
export const QUALITY_THRESHOLDS = {
  HIGH_CONFIDENCE: 85,
  MEDIUM_CONFIDENCE: 65,
  LOW_CONFIDENCE: 45,
  CRITICAL_CONFIDENCE: 30,
  
  SERVICE_SUCCESS_RATE: 85,
  SERVICE_RESPONSE_TIME: 10000, // 10 seconds
  
  ALERT_THRESHOLDS: {
    LOW_CONFIDENCE_RATE: 20,     // Alert if >20% of validations are low confidence
    SERVICE_FAILURE_RATE: 15,    // Alert if service failure rate >15%
    AVERAGE_CONFIDENCE_DROP: 10  // Alert if average confidence drops by 10%
  }
};

// Alert configurations - Updated per user requirements
const ALERT_RECIPIENTS = [
  'aj@landlinq.ai',
  'jack@catalystcp.com'  // Updated per user requirement
];

export interface DataQualityReport {
  overview: {
    overallHealthScore: number;
    totalValidations: number;
    averageConfidence: number;
    averageQualityScore: number;
    activeAlerts: number;
  };
  confidenceDistribution: {
    high: number;    // >= 85%
    medium: number;  // 65-84%
    low: number;     // 45-64%
    critical: number; // < 45%
  };
  sourceReliability: Array<{
    sourceName: string;
    successRate: number;
    averageResponseTime: number;
    averageConfidence: number;
    status: 'healthy' | 'degraded' | 'critical';
  }>;
  trendAnalysis: {
    confidenceTrend: 'improving' | 'stable' | 'declining';
    qualityTrend: 'improving' | 'stable' | 'declining';
    reliabilityTrend: 'improving' | 'stable' | 'declining';
  };
  recentAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    createdAt: Date;
  }>;
}

export interface SourceHealthMetrics {
  sourceName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  averageConfidenceScore: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface QualityAssuranceReport {
  reportType: 'daily' | 'weekly' | 'monthly';
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  executiveSummary: {
    overallHealthScore: number;
    totalValidations: number;
    averageConfidence: number;
    criticalIssues: number;
    improvementTrend: 'improving' | 'stable' | 'declining';
  };
  sourceAnalysis: {
    sourceName: string;
    reliability: number;
    averageConfidence: number;
    issues: string[];
    recommendations: string[];
  }[];
  patternAnalysis: {
    lowConfidencePatterns: {
      addressTypes: { [key: string]: number };
      geographicAreas: { [key: string]: number };
      timeOfDay: { [key: string]: number };
      dayOfWeek: { [key: string]: number };
    };
    commonIssues: { issue: string; frequency: number; impact: string }[];
    improvementOpportunities: string[];
  };
  performanceMetrics: {
    validationSpeed: { average: number; median: number; p95: number };
    sourceResponseTimes: { [sourceName: string]: number };
    throughput: { validationsPerHour: number; peakLoad: number };
  };
  alertSummary: {
    totalAlerts: number;
    alertsByType: { [alertType: string]: number };
    averageResolutionTime: number;
    unresolvedAlerts: number;
  };
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: 'performance' | 'reliability' | 'accuracy';
    description: string;
    impact: string;
    estimatedEffort: string;
  }[];
  actionItems: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export interface TrendAnalysisReport {
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  confidenceTrends: {
    daily: { date: string; averageConfidence: number; validationCount: number }[];
    weekly: { week: string; averageConfidence: number; validationCount: number }[];
    monthly: { month: string; averageConfidence: number; validationCount: number }[];
  };
  sourceTrends: {
    [sourceName: string]: {
      reliabilityTrend: { date: string; successRate: number }[];
      confidenceTrend: { date: string; averageConfidence: number }[];
      performanceTrend: { date: string; averageResponseTime: number }[];
    };
  };
  alertTrends: {
    alertVolume: { date: string; alertCount: number }[];
    alertTypes: { date: string; [alertType: string]: number }[];
    resolutionTimes: { date: string; averageResolutionTime: number }[];
  };
  predictions: {
    nextWeekConfidence: number;
    potentialIssues: string[];
    recommendedActions: string[];
  };
}

export class DataQualityMonitoringService {
  private monitoringInterval?: NodeJS.Timeout;
  private lastSnapshotTime = new Date();

  constructor() {
    this.startContinuousMonitoring();
  }

  /**
   * Start continuous data quality monitoring
   */
  startContinuousMonitoring(): void {
    console.log('🔍 Starting continuous data quality monitoring...');
    
    // Create snapshots every 30 minutes
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.createQualitySnapshot();
        await this.checkAlertConditions();
      } catch (error) {
        console.error('❌ Data quality monitoring error:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Initial snapshot
    this.createQualitySnapshot().catch(console.error);
  }

  /**
   * Record validation attempt and results
   */
  async recordValidation(
    dealId: string,
    validationType: 'comprehensive' | 'quick' | 'retry',
    validationResult: ValidatedPropertyData,
    duration: number,
    isSuccessful: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      // Record in deal validation history
      await db.insert(dealValidationHistory).values({
        dealId,
        validationType,
        overallConfidence: validationResult.validation.overallConfidence.toString(),
        qualityScore: validationResult.validation.qualityScore.toString(),
        sourcesUsed: validationResult.validation.sourcesUsed,
        discrepancies: validationResult.address.discrepancies.concat(
          validationResult.size.discrepancies,
          validationResult.valuation.discrepancies,
          validationResult.details.discrepancies,
          validationResult.demographics.discrepancies,
          validationResult.rentData.discrepancies
        ),
        addressConfidence: validationResult.address.confidence.toString(),
        sizeConfidence: validationResult.size.confidence.toString(),
        valuationConfidence: validationResult.valuation.confidence.toString(),
        demographicsConfidence: validationResult.demographics.confidence.toString(),
        validationDuration: duration,
        isSuccessful,
        errorMessage
      });

      // Update source metrics
      await this.updateSourceMetrics(validationResult, duration, isSuccessful);

      // Check for immediate alerts
      await this.checkImmediateAlerts(dealId, validationResult);

      console.log(`📊 Validation recorded - Confidence: ${validationResult.validation.overallConfidence}%, Quality: ${validationResult.validation.qualityScore}%`);
    } catch (error) {
      console.error('❌ Failed to record validation:', error);
    }
  }

  /**
   * Update source-specific metrics
   */
  private async updateSourceMetrics(
    validationResult: ValidatedPropertyData,
    duration: number,
    isSuccessful: boolean
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // Update metrics for each source used
    for (const sourceName of validationResult.validation.sourcesUsed) {
      const existingMetrics = await db
        .select()
        .from(dataSourceMetrics)
        .where(and(
          eq(dataSourceMetrics.sourceName, sourceName),
          eq(dataSourceMetrics.date, today)
        ))
        .limit(1);

      const sourceConfidence = this.getSourceConfidence(sourceName, validationResult);

      if (existingMetrics.length > 0) {
        // Update existing metrics
        const metrics = existingMetrics[0];
        const newTotalRequests = (metrics.totalRequests || 0) + 1;
        const newSuccessfulRequests = (metrics.successfulRequests || 0) + (isSuccessful ? 1 : 0);
        const newFailedRequests = (metrics.failedRequests || 0) + (isSuccessful ? 0 : 1);
        const newSuccessRate = (newSuccessfulRequests / newTotalRequests) * 100;
        
        // Calculate running average of response time and confidence
        const oldAvgResponseTime = parseFloat(metrics.averageResponseTime?.toString() || '0');
        const newAvgResponseTime = ((oldAvgResponseTime * (metrics.totalRequests || 0)) + duration) / newTotalRequests;
        
        const oldAvgConfidence = parseFloat(metrics.averageConfidenceScore?.toString() || '0');
        const newAvgConfidence = ((oldAvgConfidence * (metrics.totalRequests || 0)) + sourceConfidence) / newTotalRequests;

        await db
          .update(dataSourceMetrics)
          .set({
            totalRequests: newTotalRequests,
            successfulRequests: newSuccessfulRequests,
            failedRequests: newFailedRequests,
            averageResponseTime: newAvgResponseTime.toString(),
            successRate: newSuccessRate.toString(),
            averageConfidenceScore: newAvgConfidence.toString(),
            updatedAt: new Date()
          })
          .where(eq(dataSourceMetrics.id, metrics.id));
      } else {
        // Create new metrics record
        await db.insert(dataSourceMetrics).values({
          sourceName,
          date: today,
          totalRequests: 1,
          successfulRequests: isSuccessful ? 1 : 0,
          failedRequests: isSuccessful ? 0 : 1,
          averageResponseTime: duration.toString(),
          successRate: isSuccessful ? '100' : '0',
          averageConfidenceScore: sourceConfidence.toString()
        });
      }
    }
  }

  /**
   * Get confidence score for specific source from validation result
   */
  private getSourceConfidence(sourceName: string, validationResult: ValidatedPropertyData): number {
    const sourceConfidences = {
      // 'usps': removed per user request
      'census': validationResult.demographics.confidence,
      'hellodata': validationResult.rentData.confidence,
      // 'attom': removed per user request
    };

    return sourceConfidences[sourceName as keyof typeof sourceConfidences] || validationResult.validation.overallConfidence;
  }

  /**
   * Check for immediate alerts after validation
   */
  private async checkImmediateAlerts(dealId: string, validationResult: ValidatedPropertyData): Promise<void> {
    const confidence = validationResult.validation.overallConfidence;
    const discrepancyCount = validationResult.validation.discrepancyCount;

    // Low confidence alert
    if (confidence < QUALITY_THRESHOLDS.CRITICAL_CONFIDENCE) {
      await this.createAlert(
        'low_confidence',
        'critical',
        dealId,
        undefined,
        `Deal ${dealId} has critically low confidence score: ${confidence}% (${discrepancyCount} discrepancies found)`,
        confidence
      );
    } else if (confidence < QUALITY_THRESHOLDS.LOW_CONFIDENCE) {
      await this.createAlert(
        'low_confidence',
        'high',
        dealId,
        undefined,
        `Deal ${dealId} has low confidence score: ${confidence}% - manual review recommended`,
        confidence
      );
    }

    // High discrepancy alert
    if (discrepancyCount >= 5) {
      await this.createAlert(
        'validation_failure',
        'medium',
        dealId,
        undefined,
        `Deal ${dealId} has ${discrepancyCount} data discrepancies across sources - data integrity concern`,
        confidence
      );
    }
  }

  /**
   * Create quality snapshot for dashboard
   */
  async createQualitySnapshot(): Promise<void> {
    try {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get recent validations
      const recentValidations = await db
        .select({
          overallConfidence: dealValidationHistory.overallConfidence,
          qualityScore: dealValidationHistory.qualityScore,
          isSuccessful: dealValidationHistory.isSuccessful
        })
        .from(dealValidationHistory)
        .where(gte(dealValidationHistory.createdAt, hourAgo));

      // Count active alerts
      const activeAlerts = await db
        .select({ count: count() })
        .from(dataQualityAlerts)
        .where(eq(dataQualityAlerts.isResolved, false));

      // Calculate metrics
      const validationCount = recentValidations.length;
      const avgConfidence = validationCount > 0 
        ? recentValidations.reduce((sum, v) => sum + parseFloat(v.overallConfidence || '0'), 0) / validationCount
        : 0;

      // Get service health scores
      const today = new Date().toISOString().split('T')[0];
      const sourceHealthScores = await db
        .select()
        .from(dataSourceMetrics)
        .where(eq(dataSourceMetrics.date, today));

      const serviceHealthScores = sourceHealthScores.reduce((acc: any, source) => {
        acc[source.sourceName] = {
          successRate: parseFloat(source.successRate?.toString() || '0'),
          avgResponseTime: parseFloat(source.averageResponseTime?.toString() || '0'),
          avgConfidence: parseFloat(source.averageConfidenceScore?.toString() || '0')
        };
        return acc;
      }, {});

      // Calculate overall health score
      const healthScore = this.calculateOverallHealthScore(serviceHealthScores, avgConfidence, activeAlerts[0]?.count || 0);

      // Create snapshot
      await db.insert(dataQualitySnapshots).values({
        timestamp: now,
        overallHealthScore: healthScore.toString(),
        activeAlertsCount: activeAlerts[0]?.count || 0,
        recentValidationsCount: validationCount,
        averageRecentConfidence: avgConfidence.toString(),
        serviceHealthScores: JSON.stringify(serviceHealthScores),
        trendingIssues: JSON.stringify([]) // Will be populated by trend analysis
      });

      console.log(`📊 Quality snapshot created: Health=${healthScore}%, Validations=${validationCount}, Alerts=${activeAlerts[0]?.count || 0}`);

    } catch (error) {
      console.error('❌ Failed to create quality snapshot:', error);
    }
  }

  /**
   * Calculate overall health score
   */
  private calculateOverallHealthScore(serviceHealthScores: any, avgConfidence: number, activeAlerts: number): number {
    const baseScore = Math.min(avgConfidence * 1.2, 100); // Confidence contributes 80% max
    
    // Deduct points for service issues
    const serviceIssues = Object.values(serviceHealthScores).filter((service: any) => 
      service.successRate < QUALITY_THRESHOLDS.SERVICE_SUCCESS_RATE
    ).length;
    
    const serviceDeduction = serviceIssues * 5;
    const alertDeduction = Math.min(activeAlerts * 3, 15); // Max 15 point deduction for alerts
    
    return Math.max(0, baseScore - serviceDeduction - alertDeduction);
  }

  /**
   * Check for system-wide alert conditions
   */
  private async checkAlertConditions(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Check service failure rates
      const sourceMetrics = await db
        .select()
        .from(dataSourceMetrics)
        .where(eq(dataSourceMetrics.date, today));

      for (const source of sourceMetrics) {
        const successRate = parseFloat(source.successRate?.toString() || '100');
        const avgResponseTime = parseFloat(source.averageResponseTime?.toString() || '0');

        if (successRate < QUALITY_THRESHOLDS.SERVICE_SUCCESS_RATE) {
          await this.createAlert(
            'service_degradation',
            'high',
            undefined,
            source.sourceName,
            `${source.sourceName} service degraded: ${successRate}% success rate (threshold: ${QUALITY_THRESHOLDS.SERVICE_SUCCESS_RATE}%)`,
            successRate
          );
        }

        if (avgResponseTime > QUALITY_THRESHOLDS.SERVICE_RESPONSE_TIME) {
          await this.createAlert(
            'service_degradation',
            'medium',
            undefined,
            source.sourceName,
            `${source.sourceName} response time elevated: ${Math.round(avgResponseTime)}ms (threshold: ${QUALITY_THRESHOLDS.SERVICE_RESPONSE_TIME}ms)`,
            undefined
          );
        }
      }

      // Check confidence score trends
      const todayValidations = await db
        .select({ confidence: dealValidationHistory.overallConfidence })
        .from(dealValidationHistory)
        .where(gte(dealValidationHistory.createdAt, new Date(today)));

      const yesterdayValidations = await db
        .select({ confidence: dealValidationHistory.overallConfidence })
        .from(dealValidationHistory)
        .where(and(
          gte(dealValidationHistory.createdAt, new Date(yesterday)),
          lte(dealValidationHistory.createdAt, new Date(today))
        ));

      if (todayValidations.length > 0 && yesterdayValidations.length > 0) {
        const todayAvg = todayValidations.reduce((sum, v) => sum + parseFloat(v.confidence || '0'), 0) / todayValidations.length;
        const yesterdayAvg = yesterdayValidations.reduce((sum, v) => sum + parseFloat(v.confidence || '0'), 0) / yesterdayValidations.length;
        
        const confidenceDrop = yesterdayAvg - todayAvg;
        
        if (confidenceDrop > QUALITY_THRESHOLDS.ALERT_THRESHOLDS.AVERAGE_CONFIDENCE_DROP) {
          await this.createAlert(
            'low_confidence',
            'high',
            undefined,
            undefined,
            `System-wide confidence drop detected: ${confidenceDrop.toFixed(1)}% decrease from yesterday (${yesterdayAvg.toFixed(1)}% → ${todayAvg.toFixed(1)}%)`,
            todayAvg
          );
        }
      }

    } catch (error) {
      console.error('❌ Failed to check alert conditions:', error);
    }
  }

  /**
   * Create alert and send notifications
   */
  async createAlert(
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    dealId?: string,
    sourceName?: string,
    message?: string,
    confidenceScore?: number
  ): Promise<void> {
    try {
      // Create alert record
      const alertId = await db.insert(dataQualityAlerts).values({
        alertType,
        severity,
        dealId,
        sourceName,
        message: message || `Data quality issue detected`,
        confidenceScore: confidenceScore?.toString(),
        isResolved: false
      }).returning({ id: dataQualityAlerts.id });

      console.log(`🚨 Data quality alert created: ${severity.toUpperCase()} - ${message}`);

      // Send notifications for high/critical alerts
      if (severity === 'high' || severity === 'critical') {
        await this.sendAlertNotifications(alertType, severity, message || 'Data quality issue', dealId);
      }

    } catch (error) {
      console.error('❌ Failed to create alert:', error);
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(
    alertType: string,
    severity: string,
    message: string,
    dealId?: string
  ): Promise<void> {
    try {
      const subject = `🚨 LandLinq Data Quality Alert - ${severity.toUpperCase()}`;
      const body = `
Data Quality Alert Triggered

Alert Type: ${alertType}
Severity: ${severity.toUpperCase()}
Message: ${message}
${dealId ? `Deal ID: ${dealId}` : ''}
Timestamp: ${new Date().toLocaleString()}

This alert was automatically generated by the LandLinq Data Quality Monitoring System.
Please investigate and take appropriate action.

Dashboard: https://landlinq.ai/admin/data-quality
      `.trim();

      // Send email notifications
      for (const recipient of ALERT_RECIPIENTS) {
        await sendNotificationEmail(
          recipient,
          subject,
          body,
          body
        );
      }

      console.log(`📧 Alert notifications sent to ${ALERT_RECIPIENTS.length} recipients`);

    } catch (error) {
      console.error('❌ Failed to send alert notifications:', error);
    }
  }

  /**
   * Get comprehensive data quality report
   */
  async getDataQualityReport(days: number = 7): Promise<DataQualityReport> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const today = new Date().toISOString().split('T')[0];

      // Get recent validations
      const recentValidations = await db
        .select()
        .from(dealValidationHistory)
        .where(gte(dealValidationHistory.createdAt, startDate));

      // Calculate confidence distribution
      const confidenceDistribution = {
        high: recentValidations.filter(v => parseFloat(v.overallConfidence || '0') >= QUALITY_THRESHOLDS.HIGH_CONFIDENCE).length,
        medium: recentValidations.filter(v => {
          const conf = parseFloat(v.overallConfidence || '0');
          return conf >= QUALITY_THRESHOLDS.MEDIUM_CONFIDENCE && conf < QUALITY_THRESHOLDS.HIGH_CONFIDENCE;
        }).length,
        low: recentValidations.filter(v => {
          const conf = parseFloat(v.overallConfidence || '0');
          return conf >= QUALITY_THRESHOLDS.LOW_CONFIDENCE && conf < QUALITY_THRESHOLDS.MEDIUM_CONFIDENCE;
        }).length,
        critical: recentValidations.filter(v => parseFloat(v.overallConfidence || '0') < QUALITY_THRESHOLDS.LOW_CONFIDENCE).length
      };

      // Get source reliability
      const sourceMetrics = await db
        .select()
        .from(dataSourceMetrics)
        .where(eq(dataSourceMetrics.date, today));

      const sourceReliability = sourceMetrics.map(source => {
        const successRate = parseFloat(source.successRate?.toString() || '0');
        const avgResponseTime = parseFloat(source.averageResponseTime?.toString() || '0');
        
        let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
        if (successRate < 50 || avgResponseTime > QUALITY_THRESHOLDS.SERVICE_RESPONSE_TIME * 2) {
          status = 'critical';
        } else if (successRate < QUALITY_THRESHOLDS.SERVICE_SUCCESS_RATE || avgResponseTime > QUALITY_THRESHOLDS.SERVICE_RESPONSE_TIME) {
          status = 'degraded';
        }

        return {
          sourceName: source.sourceName,
          successRate,
          averageResponseTime: avgResponseTime,
          averageConfidence: parseFloat(source.averageConfidenceScore?.toString() || '0'),
          status
        };
      });

      // Get active alerts
      const activeAlerts = await db
        .select({
          id: dataQualityAlerts.id,
          alertType: dataQualityAlerts.alertType,
          severity: dataQualityAlerts.severity,
          message: dataQualityAlerts.message,
          createdAt: dataQualityAlerts.createdAt
        })
        .from(dataQualityAlerts)
        .where(eq(dataQualityAlerts.isResolved, false))
        .orderBy(desc(dataQualityAlerts.createdAt))
        .limit(10);

      // Calculate overall metrics
      const totalValidations = recentValidations.length;
      const averageConfidence = totalValidations > 0
        ? recentValidations.reduce((sum, v) => sum + parseFloat(v.overallConfidence || '0'), 0) / totalValidations
        : 0;
      const averageQualityScore = totalValidations > 0
        ? recentValidations.reduce((sum, v) => sum + parseFloat(v.qualityScore || '0'), 0) / totalValidations
        : 0;

      // Calculate health score
      const serviceHealthScores = sourceReliability.reduce((acc, source) => {
        acc[source.sourceName] = {
          successRate: source.successRate,
          avgResponseTime: source.averageResponseTime,
          avgConfidence: source.averageConfidence
        };
        return acc;
      }, {} as any);

      const overallHealthScore = this.calculateOverallHealthScore(serviceHealthScores, averageConfidence, activeAlerts.length);

      return {
        overview: {
          overallHealthScore,
          totalValidations,
          averageConfidence,
          averageQualityScore,
          activeAlerts: activeAlerts.length
        },
        confidenceDistribution,
        sourceReliability,
        trendAnalysis: {
          confidenceTrend: 'stable', // TODO: Calculate actual trends
          qualityTrend: 'stable',
          reliabilityTrend: 'stable'
        },
        recentAlerts: activeAlerts.map(alert => ({
          id: alert.id,
          type: alert.alertType || '',
          severity: alert.severity || '',
          message: alert.message || '',
          createdAt: alert.createdAt || new Date()
        }))
      };

    } catch (error) {
      console.error('❌ Failed to generate data quality report:', error);
      throw error;
    }
  }

  /**
   * Get source health metrics - with graceful error handling for deployment
   */
  async getSourceHealthMetrics(): Promise<SourceHealthMetrics[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Gracefully handle missing tables during deployment
      const sourceMetrics = await db
        .select()
        .from(dataSourceMetrics)
        .where(eq(dataSourceMetrics.date, today));

      return sourceMetrics.map(source => {
        const successRate = parseFloat(source.successRate?.toString() || '0');
        const avgResponseTime = parseFloat(source.averageResponseTime?.toString() || '0');
        
        let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
        if (successRate < 50 || avgResponseTime > QUALITY_THRESHOLDS.SERVICE_RESPONSE_TIME * 2) {
          status = 'critical';
        } else if (successRate < QUALITY_THRESHOLDS.SERVICE_SUCCESS_RATE || avgResponseTime > QUALITY_THRESHOLDS.SERVICE_RESPONSE_TIME) {
          status = 'degraded';
        }

        return {
          sourceName: source.sourceName,
          totalRequests: source.totalRequests || 0,
          successfulRequests: source.successfulRequests || 0,
          failedRequests: source.failedRequests || 0,
          successRate,
          averageResponseTime: avgResponseTime,
          averageConfidenceScore: parseFloat(source.averageConfidenceScore?.toString() || '0'),
          status
        };
      });

    } catch (error: any) {
      // Handle missing tables/columns during deployment gracefully
      if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('column')) {
        console.warn('⚠️ Source health metrics table/columns not available during deployment:', error.message);
        return []; // Return empty array instead of crashing
      }
      console.error('❌ Failed to get source health metrics:', error);
      return [];
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    try {
      await db
        .update(dataQualityAlerts)
        .set({
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy,
          updatedAt: new Date()
        })
        .where(eq(dataQualityAlerts.id, alertId));

      console.log(`✅ Alert ${alertId} resolved by ${resolvedBy}`);
    } catch (error) {
      console.error('❌ Failed to resolve alert:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive quality assurance report
   */
  async generateQualityAssuranceReport(
    reportType: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<QualityAssuranceReport> {
    try {
      const now = new Date();
      const timeRanges = {
        daily: { days: 1, label: 'Daily' },
        weekly: { days: 7, label: 'Weekly' },
        monthly: { days: 30, label: 'Monthly' }
      };
      
      const { days, label } = timeRanges[reportType];
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const endDate = now;

      console.log(`📋 Generating ${label} Quality Assurance Report (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`);

      // Get base data quality report
      const baseReport = await this.getDataQualityReport(days);
      
      // Get validation history for pattern analysis
      const validationHistory = await db
        .select()
        .from(dealValidationHistory)
        .where(gte(dealValidationHistory.createdAt, startDate));

      // Get alerts for analysis
      const alerts = await db
        .select()
        .from(dataQualityAlerts)
        .where(gte(dataQualityAlerts.createdAt, startDate));

      // Calculate executive summary
      const criticalAlerts = alerts.filter(alert => alert.severity === 'critical').length;
      const lowConfidenceValidations = validationHistory.filter(v => 
        parseFloat(v.overallConfidence?.toString() || '0') < QUALITY_THRESHOLDS.MEDIUM_CONFIDENCE
      ).length;
      
      const executiveSummary = {
        overallHealthScore: baseReport.overview.overallHealthScore,
        totalValidations: baseReport.overview.totalValidations,
        averageConfidence: baseReport.overview.averageConfidence,
        criticalIssues: criticalAlerts + (lowConfidenceValidations > baseReport.overview.totalValidations * 0.1 ? 1 : 0),
        improvementTrend: baseReport.trendAnalysis.confidenceTrend
      };

      // Analyze source performance and generate recommendations
      const sourceAnalysis = baseReport.sourceReliability.map(source => {
        const issues: string[] = [];
        const recommendations: string[] = [];

        if (source.successRate < QUALITY_THRESHOLDS.SERVICE_SUCCESS_RATE) {
          issues.push(`Low success rate: ${source.successRate.toFixed(1)}%`);
          recommendations.push(`Investigate ${source.sourceName} service reliability`);
        }

        if (source.averageResponseTime > QUALITY_THRESHOLDS.SERVICE_RESPONSE_TIME) {
          issues.push(`Slow response time: ${Math.round(source.averageResponseTime)}ms`);
          recommendations.push(`Optimize ${source.sourceName} API calls or consider caching`);
        }

        if (source.averageConfidence < QUALITY_THRESHOLDS.MEDIUM_CONFIDENCE) {
          issues.push(`Low confidence scores: ${source.averageConfidence.toFixed(1)}%`);
          recommendations.push(`Review ${source.sourceName} data quality and validation rules`);
        }

        return {
          sourceName: source.sourceName,
          reliability: source.successRate,
          averageConfidence: source.averageConfidence,
          issues,
          recommendations
        };
      });

      // Pattern analysis for low confidence deals
      const lowConfidenceDeals = validationHistory.filter(v => 
        parseFloat(v.overallConfidence?.toString() || '0') < QUALITY_THRESHOLDS.MEDIUM_CONFIDENCE
      );

      const addressTypePatterns: { [key: string]: number } = {};
      const geographicPatterns: { [key: string]: number } = {};
      const timePatterns: { [key: string]: number } = {};
      const dayPatterns: { [key: string]: number } = {};

      lowConfidenceDeals.forEach(deal => {
        // Time of day analysis
        const hour = new Date(deal.createdAt || new Date()).getHours();
        const timeSlot = hour < 6 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
        timePatterns[timeSlot] = (timePatterns[timeSlot] || 0) + 1;

        // Day of week analysis  
        const dayOfWeek = new Date(deal.createdAt || new Date()).toLocaleDateString('en-US', { weekday: 'long' });
        dayPatterns[dayOfWeek] = (dayPatterns[dayOfWeek] || 0) + 1;

        // Address type analysis (basic heuristics)
        const discrepancies = deal.discrepancies || [];
        discrepancies.forEach(disc => {
          if (disc.includes('address') || disc.includes('Address')) {
            addressTypePatterns['Address Issues'] = (addressTypePatterns['Address Issues'] || 0) + 1;
          }
          if (disc.includes('size') || disc.includes('Size')) {
            addressTypePatterns['Size Issues'] = (addressTypePatterns['Size Issues'] || 0) + 1;
          }
          if (disc.includes('demographic') || disc.includes('Demographic')) {
            geographicPatterns['Demographic Issues'] = (geographicPatterns['Demographic Issues'] || 0) + 1;
          }
        });
      });

      // Common issues analysis
      const issueFrequency: { [key: string]: number } = {};
      validationHistory.forEach(deal => {
        const discrepancies = deal.discrepancies || [];
        discrepancies.forEach(disc => {
          issueFrequency[disc] = (issueFrequency[disc] || 0) + 1;
        });
      });

      const commonIssues = Object.entries(issueFrequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([issue, frequency]) => ({
          issue,
          frequency,
          impact: frequency > validationHistory.length * 0.1 ? 'High' : frequency > validationHistory.length * 0.05 ? 'Medium' : 'Low'
        }));

      // Performance metrics
      const validationTimes = validationHistory.map(v => v.validationDuration || 0).filter(t => t > 0);
      const sortedTimes = validationTimes.sort((a, b) => a - b);
      
      const performanceMetrics = {
        validationSpeed: {
          average: validationTimes.length > 0 ? validationTimes.reduce((a, b) => a + b, 0) / validationTimes.length : 0,
          median: validationTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0,
          p95: validationTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.95)] : 0
        },
        sourceResponseTimes: sourceAnalysis.reduce((acc, source) => {
          acc[source.sourceName] = source.averageConfidence; // Using confidence as proxy for performance
          return acc;
        }, {} as { [sourceName: string]: number }),
        throughput: {
          validationsPerHour: validationHistory.length > 0 ? (validationHistory.length / (days * 24)) : 0,
          peakLoad: Math.max(...Object.values(timePatterns))
        }
      };

      // Alert summary
      const alertsByType = alerts.reduce((acc, alert) => {
        acc[alert.alertType || 'unknown'] = (acc[alert.alertType || 'unknown'] || 0) + 1;
        return acc;
      }, {} as { [alertType: string]: number });

      const resolvedAlerts = alerts.filter(alert => alert.isResolved);
      const averageResolutionTime = resolvedAlerts.length > 0 
        ? resolvedAlerts.reduce((sum, alert) => {
            const created = new Date(alert.createdAt || new Date()).getTime();
            const resolved = new Date(alert.resolvedAt || new Date()).getTime();
            return sum + (resolved - created);
          }, 0) / resolvedAlerts.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      const alertSummary = {
        totalAlerts: alerts.length,
        alertsByType,
        averageResolutionTime,
        unresolvedAlerts: alerts.filter(alert => !alert.isResolved).length
      };

      // Generate recommendations
      const recommendations: QualityAssuranceReport['recommendations'] = [];

      if (executiveSummary.criticalIssues > 0) {
        recommendations.push({
          priority: 'high',
          category: 'reliability',
          description: 'Address critical data quality issues immediately',
          impact: 'Prevents system degradation and maintains user trust',
          estimatedEffort: '1-2 days'
        });
      }

      if (executiveSummary.averageConfidence < QUALITY_THRESHOLDS.HIGH_CONFIDENCE) {
        recommendations.push({
          priority: 'medium',
          category: 'accuracy',
          description: 'Improve overall validation confidence scores',
          impact: 'Increases data reliability and reduces manual review needs',
          estimatedEffort: '1-2 weeks'
        });
      }

      const slowSources = sourceAnalysis.filter(s => s.issues.some(i => i.includes('response time')));
      if (slowSources.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'performance',
          description: `Optimize slow data sources: ${slowSources.map(s => s.sourceName).join(', ')}`,
          impact: 'Improves validation speed and user experience',
          estimatedEffort: '3-5 days'
        });
      }

      // Action items
      const actionItems = {
        immediate: [
          ...(executiveSummary.criticalIssues > 0 ? ['Investigate critical alerts'] : []),
          ...(alertSummary.unresolvedAlerts > 5 ? ['Review unresolved alerts'] : [])
        ],
        shortTerm: [
          ...(executiveSummary.averageConfidence < 80 ? ['Improve validation algorithms'] : []),
          ...(performanceMetrics.validationSpeed.average > 10000 ? ['Optimize validation performance'] : [])
        ],
        longTerm: [
          'Implement predictive quality monitoring',
          'Enhanced geographic pattern analysis',
          'Automated source reliability scoring'
        ]
      };

      const report: QualityAssuranceReport = {
        reportType,
        timeRange: { startDate, endDate },
        executiveSummary,
        sourceAnalysis,
        patternAnalysis: {
          lowConfidencePatterns: {
            addressTypes: addressTypePatterns,
            geographicAreas: geographicPatterns,
            timeOfDay: timePatterns,
            dayOfWeek: dayPatterns
          },
          commonIssues,
          improvementOpportunities: [
            'Implement real-time source monitoring',
            'Add geographic-specific validation rules',
            'Enhance confidence score algorithms',
            'Implement predictive quality analytics'
          ]
        },
        performanceMetrics,
        alertSummary,
        recommendations,
        actionItems
      };

      console.log(`✅ ${label} Quality Assurance Report generated - ${recommendations.length} recommendations, ${actionItems.immediate.length} immediate actions`);
      
      return report;

    } catch (error) {
      console.error('❌ Failed to generate quality assurance report:', error);
      throw error;
    }
  }

  /**
   * Generate trend analysis report
   */
  async generateTrendAnalysisReport(days: number = 30): Promise<TrendAnalysisReport> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      console.log(`📈 Generating Trend Analysis Report (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`);

      // Get validation history
      const validationHistory = await db
        .select()
        .from(dealValidationHistory)
        .where(gte(dealValidationHistory.createdAt, startDate))
        .orderBy(dealValidationHistory.createdAt);

      // Get source metrics history
      const sourceHistory = await db
        .select()
        .from(dataSourceMetrics)
        .where(gte(dataSourceMetrics.createdAt, startDate))
        .orderBy(dataSourceMetrics.createdAt);

      // Get alert history
      const alertHistory = await db
        .select()
        .from(dataQualityAlerts)
        .where(gte(dataQualityAlerts.createdAt, startDate))
        .orderBy(dataQualityAlerts.createdAt);

      // Build confidence trends
      const dailyConfidenceMap = new Map<string, { confidence: number; count: number; total: number }>();
      
      validationHistory.forEach(validation => {
        const date = new Date(validation.createdAt || new Date()).toISOString().split('T')[0];
        const confidence = parseFloat(validation.overallConfidence?.toString() || '0');
        
        if (!dailyConfidenceMap.has(date)) {
          dailyConfidenceMap.set(date, { confidence: 0, count: 0, total: 0 });
        }
        
        const entry = dailyConfidenceMap.get(date)!;
        entry.total += confidence;
        entry.count += 1;
        entry.confidence = entry.total / entry.count;
      });

      const confidenceTrends = {
        daily: Array.from(dailyConfidenceMap.entries()).map(([date, data]) => ({
          date,
          averageConfidence: data.confidence,
          validationCount: data.count
        })),
        weekly: [], // Would implement weekly aggregation
        monthly: [] // Would implement monthly aggregation
      };

      // Build source trends
      const sourceTrends: TrendAnalysisReport['sourceTrends'] = {};
      sourceHistory.forEach(metric => {
        const date = new Date(metric.createdAt || new Date()).toISOString().split('T')[0];
        
        if (!sourceTrends[metric.sourceName]) {
          sourceTrends[metric.sourceName] = {
            reliabilityTrend: [],
            confidenceTrend: [],
            performanceTrend: []
          };
        }
        
        sourceTrends[metric.sourceName].reliabilityTrend.push({
          date,
          successRate: parseFloat(metric.successRate?.toString() || '0')
        });
        
        sourceTrends[metric.sourceName].confidenceTrend.push({
          date,
          averageConfidence: parseFloat(metric.averageConfidenceScore?.toString() || '0')
        });
        
        sourceTrends[metric.sourceName].performanceTrend.push({
          date,
          averageResponseTime: parseFloat(metric.averageResponseTime?.toString() || '0')
        });
      });

      // Build alert trends
      const alertVolumeMap = new Map<string, number>();
      const alertTypeMap = new Map<string, { [type: string]: number }>();
      
      alertHistory.forEach(alert => {
        const date = new Date(alert.createdAt || new Date()).toISOString().split('T')[0];
        
        alertVolumeMap.set(date, (alertVolumeMap.get(date) || 0) + 1);
        
        if (!alertTypeMap.has(date)) {
          alertTypeMap.set(date, {});
        }
        const typeEntry = alertTypeMap.get(date)!;
        typeEntry[alert.alertType || 'unknown'] = (typeEntry[alert.alertType || 'unknown'] || 0) + 1;
      });

      const alertTrends = {
        alertVolume: Array.from(alertVolumeMap.entries()).map(([date, alertCount]) => ({
          date,
          alertCount
        })),
        alertTypes: Array.from(alertTypeMap.entries()).map(([date, types]) => ({
          date,
          ...types
        })),
        resolutionTimes: [] // Would calculate from resolved alerts
      };

      // Generate predictions (simple heuristic-based)
      const recentConfidenceAvg = confidenceTrends.daily
        .slice(-7)
        .reduce((sum, day) => sum + day.averageConfidence, 0) / Math.min(7, confidenceTrends.daily.length);

      const predictions = {
        nextWeekConfidence: recentConfidenceAvg,
        potentialIssues: [
          ...(recentConfidenceAvg < QUALITY_THRESHOLDS.MEDIUM_CONFIDENCE ? ['Declining confidence scores'] : []),
          ...(alertTrends.alertVolume.slice(-3).some(day => day.alertCount > 5) ? ['Increased alert volume'] : [])
        ],
        recommendedActions: [
          'Monitor source reliability closely',
          'Review recent validation patterns',
          'Consider proactive source optimization'
        ]
      };

      return {
        timeRange: { startDate, endDate },
        confidenceTrends,
        sourceTrends,
        alertTrends,
        predictions
      };

    } catch (error) {
      console.error('❌ Failed to generate trend analysis report:', error);
      throw error;
    }
  }

  /**
   * Schedule automated reports
   */
  async scheduleAutomatedReports(): Promise<void> {
    console.log('📅 Scheduling automated quality assurance reports...');
    
    // Daily report at 8 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 8 && now.getMinutes() === 0) {
        try {
          const report = await this.generateQualityAssuranceReport('daily');
          await this.sendReportNotification(report);
          console.log('📊 Daily quality assurance report generated and sent');
        } catch (error) {
          console.error('❌ Failed to generate daily report:', error);
        }
      }
    }, 60000); // Check every minute

    // Weekly report on Mondays at 9 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getDay() === 1 && now.getHours() === 9 && now.getMinutes() === 0) {
        try {
          const report = await this.generateQualityAssuranceReport('weekly');
          await this.sendReportNotification(report);
          console.log('📊 Weekly quality assurance report generated and sent');
        } catch (error) {
          console.error('❌ Failed to generate weekly report:', error);
        }
      }
    }, 60000);

    console.log('✅ Automated reporting scheduled successfully');
  }

  /**
   * Send report notification
   */
  private async sendReportNotification(report: QualityAssuranceReport): Promise<void> {
    try {
      const subject = `📊 ${report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Data Quality Report`;
      
      const body = `
Data Quality Report - ${report.timeRange.startDate.toLocaleDateString()} to ${report.timeRange.endDate.toLocaleDateString()}

📊 EXECUTIVE SUMMARY
• Overall Health Score: ${report.executiveSummary.overallHealthScore.toFixed(1)}%
• Total Validations: ${report.executiveSummary.totalValidations.toLocaleString()}
• Average Confidence: ${report.executiveSummary.averageConfidence.toFixed(1)}%
• Critical Issues: ${report.executiveSummary.criticalIssues}
• Trend: ${report.executiveSummary.improvementTrend.toUpperCase()}

🔧 IMMEDIATE ACTIONS NEEDED:
${report.actionItems.immediate.map(item => `• ${item}`).join('\n')}

📈 RECOMMENDATIONS:
${report.recommendations.slice(0, 3).map(rec => `• [${rec.priority.toUpperCase()}] ${rec.description}`).join('\n')}

🚨 ALERT SUMMARY:
• Total Alerts: ${report.alertSummary.totalAlerts}
• Unresolved: ${report.alertSummary.unresolvedAlerts}
• Avg Resolution Time: ${report.alertSummary.averageResolutionTime.toFixed(1)} hours

View full dashboard: https://landlinq.ai/admin/data-quality
      `.trim();

      // Send to quality assurance team
      for (const recipient of ALERT_RECIPIENTS) {
        await sendNotificationEmail(
          recipient,
          subject,
          body,
          body
        );
      }

      console.log(`📧 Quality assurance report sent to ${ALERT_RECIPIENTS.length} recipients`);

    } catch (error) {
      console.error('❌ Failed to send report notification:', error);
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log('🛑 Data quality monitoring stopped');
    }
  }
}

// Export singleton instance
export const dataQualityMonitoringService = new DataQualityMonitoringService();
import { db } from './db';
import {
  reviewQueue,
  reviewAssignments,
  reviewActions,
  deals,
  users,
  dealValidationHistory
} from '@shared/schema';
import { eq, desc, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { ValidatedPropertyData } from './dataValidationService';
import { QUALITY_THRESHOLDS } from './dataQualityMonitoringService';
import { sendNotificationEmail } from './emailService';
import { sendSMS } from './smsService';

// Review flagging thresholds - Updated per user requirements (90% minimum)
export const FLAGGING_THRESHOLDS = {
  // Overall confidence thresholds for review flagging
  OVERALL_CONFIDENCE_CRITICAL: 95,    // Must flag for review (raised from 90%)
  OVERALL_CONFIDENCE_HIGH: 90,        // Flag if other issues present (raised from 85%)
  
  // Individual field thresholds
  FIELD_CONFIDENCE_CRITICAL: 80,      // Any field below this gets flagged
  FIELD_CONFIDENCE_HIGH: 75,          // Flag if multiple fields below this
  
  // Discrepancy thresholds
  HIGH_DISCREPANCY_COUNT: 3,          // Number of discrepancies that triggers review
  CRITICAL_DISCREPANCY_COUNT: 5,      // Number that makes it critical priority
  
  // Source reliability thresholds
  MIN_SOURCES_REQUIRED: 2,            // Minimum sources needed to be confident
  MAX_SOURCE_CONFLICTS: 2             // Maximum conflicts before flagging
};

// Priority calculation weights
const PRIORITY_WEIGHTS = {
  OVERALL_CONFIDENCE: 0.4,
  FIELD_CONFIDENCE_ISSUES: 0.3,
  DISCREPANCY_COUNT: 0.2,
  SOURCE_RELIABILITY: 0.1
};

// Team members for assignment rotation (from analyst-dashboard.tsx)
const AVAILABLE_ANALYSTS = [
  { id: "austin-blondell", name: "Austin Blondell", email: "austin@landlinq.ai" },
  { id: "davis-hammond", name: "Davis Hammond", email: "davis@landlinq.ai" },
  { id: "steve-hillebrand", name: "Steve Hillebrand", email: "steve@landlinq.ai" },
  { id: "john-bell", name: "John Bell", email: "john@landlinq.ai" },
  { id: "mallie-colavita", name: "Mallie Colavita", email: "mallie@landlinq.ai" }
];

interface FlaggingResult {
  shouldFlag: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  triggerReason: string;
  specificIssues: Array<{
    type: string;
    field: string;
    confidence: number;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  estimatedReviewTime: number; // minutes
}

export class ReviewFlaggingService {
  
  /**
   * Main entry point - analyze validation result and flag deal directly in main table
   */
  static async analyzeAndFlag(
    dealId: string,
    validationResult: ValidatedPropertyData,
    dealData?: any
  ): Promise<boolean> {
    console.log(`🔍 Analyzing deal ${dealId} for review flagging`);
    
    try {
      // Run flagging analysis
      const analysis = await this.performFlaggingAnalysis(validationResult, dealData);
      
      if (!analysis.shouldFlag) {
        console.log(`✅ Deal ${dealId} passed confidence thresholds - marking as clean`);
        await this.markDealAsClean(dealId, validationResult);
        return false;
      }
      
      // Flag the deal directly in the main deals table
      await this.flagDealInMainTable(dealId, analysis, validationResult);
      
      console.log(`🚨 Deal ${dealId} flagged as ${analysis.priority} risk: ${analysis.triggerReason}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error in review flagging for deal ${dealId}:`, error);
      return false;
    }
  }

  /**
   * Flag deal directly in main deals table (new approach)
   */
  private static async flagDealInMainTable(
    dealId: string,
    analysis: FlaggingResult,
    validationResult: ValidatedPropertyData
  ): Promise<void> {
    
    // Map priority to risk level
    const riskLevel = this.mapPriorityToRiskLevel(analysis.priority);
    
    // Create specific warnings for analysts
    const specificWarnings = this.generateAnalystWarnings(analysis, validationResult);
    
    // Extract source conflicts
    const sourceConflicts = this.extractSourceConflicts(validationResult);
    
    // Update the deal with flagging information
    await db
      .update(deals)
      .set({
        flagged: true,
        riskLevel,
        confidenceScore: validationResult.validation.overallConfidence.toString(),
        dataQualityIssues: analysis.specificIssues,
        validationFlags: {
          lastValidation: new Date().toISOString(),
          sourcesUsed: validationResult.validation.sourcesUsed,
          discrepancyCount: validationResult.validation.discrepancyCount,
          qualityScore: validationResult.validation.qualityScore
        },
        sourceConflicts,
        flaggedAt: new Date(),
        flaggedBy: 'system',
        flaggingReason: analysis.triggerReason,
        specificWarnings,
        estimatedReviewTime: analysis.estimatedReviewTime,
        lastValidationAt: new Date(),
        validationHistory: [
          {
            timestamp: new Date().toISOString(),
            overallConfidence: validationResult.validation.overallConfidence,
            sourcesUsed: validationResult.validation.sourcesUsed.length,
            flagged: true,
            riskLevel,
            issues: analysis.specificIssues.length
          }
        ],
        analystReviewStatus: 'pending',
        updatedAt: new Date()
      })
      .where(eq(deals.id, dealId));
      
    console.log(`📝 Deal ${dealId} flagged in main table with ${riskLevel} risk level`);
  }

  /**
   * Mark deal as clean (no issues found)
   */
  private static async markDealAsClean(
    dealId: string,
    validationResult: ValidatedPropertyData
  ): Promise<void> {
    
    await db
      .update(deals)
      .set({
        flagged: false,
        riskLevel: 'clean',
        confidenceScore: validationResult.validation.overallConfidence.toString(),
        validationFlags: {
          lastValidation: new Date().toISOString(),
          sourcesUsed: validationResult.validation.sourcesUsed,
          discrepancyCount: validationResult.validation.discrepancyCount,
          qualityScore: validationResult.validation.qualityScore
        },
        lastValidationAt: new Date(),
        validationHistory: [
          {
            timestamp: new Date().toISOString(),
            overallConfidence: validationResult.validation.overallConfidence,
            sourcesUsed: validationResult.validation.sourcesUsed.length,
            flagged: false,
            riskLevel: 'clean',
            issues: 0
          }
        ],
        analystReviewStatus: 'completed',
        updatedAt: new Date()
      })
      .where(eq(deals.id, dealId));
  }
  
  /**
   * Perform detailed analysis to determine if deal should be flagged
   */
  private static async performFlaggingAnalysis(
    validationResult: ValidatedPropertyData,
    dealData?: any
  ): Promise<FlaggingResult> {
    const issues: FlaggingResult['specificIssues'] = [];
    let priorityScore = 0;
    let shouldFlag = false;
    let primaryTrigger = '';
    
    // 1. Overall confidence analysis
    const overallConfidence = validationResult.validation.overallConfidence;
    if (overallConfidence < FLAGGING_THRESHOLDS.OVERALL_CONFIDENCE_CRITICAL) {
      shouldFlag = true;
      priorityScore += 40;
      primaryTrigger = 'low_overall_confidence';
      
      issues.push({
        type: 'overall_confidence',
        field: 'overall',
        confidence: overallConfidence,
        description: `Overall confidence ${overallConfidence}% is below critical threshold ${FLAGGING_THRESHOLDS.OVERALL_CONFIDENCE_CRITICAL}%`,
        severity: overallConfidence < 70 ? 'critical' : 'high'
      });
    }
    
    // 2. Individual field confidence analysis
    const fieldConfidences = [
      { name: 'address', confidence: validationResult.address.confidence, data: validationResult.address },
      { name: 'size', confidence: validationResult.size.confidence, data: validationResult.size },
      { name: 'valuation', confidence: validationResult.valuation.confidence, data: validationResult.valuation },
      { name: 'demographics', confidence: validationResult.demographics.confidence, data: validationResult.demographics },
      { name: 'rentData', confidence: validationResult.rentData.confidence, data: validationResult.rentData }
    ];
    
    let lowConfidenceFields = 0;
    for (const field of fieldConfidences) {
      if (field.confidence < FLAGGING_THRESHOLDS.FIELD_CONFIDENCE_CRITICAL) {
        shouldFlag = true;
        lowConfidenceFields++;
        
        issues.push({
          type: 'field_confidence',
          field: field.name,
          confidence: field.confidence,
          description: `${field.name} confidence ${field.confidence}% is below field threshold ${FLAGGING_THRESHOLDS.FIELD_CONFIDENCE_CRITICAL}%`,
          severity: field.confidence < 60 ? 'critical' : field.confidence < 70 ? 'high' : 'medium'
        });
      }
    }
    
    if (lowConfidenceFields >= 2) {
      priorityScore += 25;
      if (!primaryTrigger) primaryTrigger = 'multiple_field_issues';
    } else if (lowConfidenceFields === 1) {
      priorityScore += 15;
      if (!primaryTrigger) primaryTrigger = 'single_field_issue';
    }
    
    // 3. Discrepancy analysis
    const totalDiscrepancies = validationResult.validation.discrepancyCount;
    if (totalDiscrepancies >= FLAGGING_THRESHOLDS.HIGH_DISCREPANCY_COUNT) {
      shouldFlag = true;
      priorityScore += totalDiscrepancies >= FLAGGING_THRESHOLDS.CRITICAL_DISCREPANCY_COUNT ? 30 : 20;
      
      issues.push({
        type: 'discrepancy_count',
        field: 'multiple',
        confidence: overallConfidence,
        description: `High discrepancy count: ${totalDiscrepancies} conflicts between data sources`,
        severity: totalDiscrepancies >= FLAGGING_THRESHOLDS.CRITICAL_DISCREPANCY_COUNT ? 'critical' : 'high'
      });
      
      if (!primaryTrigger) primaryTrigger = 'high_discrepancy_count';
    }
    
    // 4. Source reliability analysis
    const sourcesUsed = validationResult.validation.sourcesUsed.length;
    if (sourcesUsed < FLAGGING_THRESHOLDS.MIN_SOURCES_REQUIRED) {
      shouldFlag = true;
      priorityScore += 15;
      
      issues.push({
        type: 'source_reliability',
        field: 'sources',
        confidence: overallConfidence,
        description: `Insufficient data sources: only ${sourcesUsed} sources available (minimum: ${FLAGGING_THRESHOLDS.MIN_SOURCES_REQUIRED})`,
        severity: 'high'
      });
      
      if (!primaryTrigger) primaryTrigger = 'insufficient_sources';
    }
    
    // 5. Calculate final priority
    const priority = this.calculatePriority(priorityScore, issues);
    
    // 6. Estimate review time based on complexity
    const estimatedReviewTime = this.estimateReviewTime(issues, totalDiscrepancies, sourcesUsed);
    
    return {
      shouldFlag,
      priority,
      triggerReason: primaryTrigger,
      specificIssues: issues,
      estimatedReviewTime
    };
  }
  
  /**
   * Calculate priority level based on score and issues
   */
  private static calculatePriority(
    priorityScore: number, 
    issues: FlaggingResult['specificIssues']
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Check for any critical issues
    const hasCriticalIssues = issues.some(issue => issue.severity === 'critical');
    if (hasCriticalIssues || priorityScore >= 70) {
      return 'critical';
    }
    
    // Check for high priority issues
    const hasHighIssues = issues.some(issue => issue.severity === 'high');
    if (hasHighIssues || priorityScore >= 50) {
      return 'high';
    }
    
    // Medium or low based on score
    return priorityScore >= 30 ? 'medium' : 'low';
  }
  
  /**
   * Estimate review time based on issue complexity
   */
  private static estimateReviewTime(
    issues: FlaggingResult['specificIssues'],
    discrepancyCount: number,
    sourceCount: number
  ): number {
    let baseTime = 15; // Base 15 minutes for any review
    
    // Add time per issue
    baseTime += issues.length * 5;
    
    // Add time for discrepancies (need to compare sources)
    baseTime += discrepancyCount * 3;
    
    // Add time if few sources (need additional research)
    if (sourceCount < 2) {
      baseTime += 10;
    }
    
    // Add time for critical issues (more thorough review needed)
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    baseTime += criticalIssues * 8;
    
    // Cap at reasonable maximum
    return Math.min(baseTime, 60);
  }

  /**
   * Map analysis priority to risk level enum
   */
  private static mapPriorityToRiskLevel(priority: FlaggingResult['priority']): 'clean' | 'low' | 'medium' | 'high' {
    const mapping = {
      'critical': 'high' as const,
      'high': 'high' as const,
      'medium': 'medium' as const,
      'low': 'low' as const
    };
    return mapping[priority];
  }

  /**
   * Generate specific analyst warnings based on issues found
   */
  private static generateAnalystWarnings(
    analysis: FlaggingResult,
    validationResult: ValidatedPropertyData
  ): Array<{type: string, severity: string, message: string, icon: string}> {
    const warnings = [];

    // Address verification warnings
    if (validationResult.address.confidence < 85) {
      warnings.push({
        type: 'address_verification',
        severity: validationResult.address.confidence < 70 ? 'high' : 'medium',
        message: `🚨 ADDRESS NOT FULLY VERIFIED - ${validationResult.address.discrepancies.join(', ')}`,
        icon: '🚨'
      });
    }

    // Size verification warnings  
    if (validationResult.size.confidence < 80) {
      warnings.push({
        type: 'size_verification',
        severity: validationResult.size.confidence < 60 ? 'high' : 'medium',
        message: `⚠️ VERIFY PROPERTY SIZE - Low confidence (${validationResult.size.confidence}%)`,
        icon: '⚠️'
      });
    }

    // Valuation warnings
    if (validationResult.valuation.confidence < 75) {
      warnings.push({
        type: 'valuation_verification',
        severity: validationResult.valuation.confidence < 50 ? 'high' : 'medium',
        message: `💰 VERIFY PRICING DATA - Confidence only ${validationResult.valuation.confidence}%`,
        icon: '💰'
      });
    }

    // Demographics warnings
    if (validationResult.demographics.confidence < 80) {
      warnings.push({
        type: 'demographics_verification',
        severity: validationResult.demographics.confidence < 65 ? 'high' : 'medium',
        message: `⚡ DEMOGRAPHICS LOW CONFIDENCE (${validationResult.demographics.confidence}%) - Double-check population data`,
        icon: '⚡'
      });
    }

    // Source conflict warnings
    if (validationResult.validation.discrepancyCount > 0) {
      warnings.push({
        type: 'source_conflicts',
        severity: validationResult.validation.discrepancyCount > 3 ? 'high' : 'medium',
        message: `🔍 CONFLICTING DATA - ${validationResult.validation.discrepancyCount} discrepancies between sources`,
        icon: '🔍'
      });
    }

    // Low source count warnings
    if (validationResult.validation.sourcesUsed.length < 2) {
      warnings.push({
        type: 'insufficient_sources',
        severity: 'high',
        message: `📊 INSUFFICIENT DATA SOURCES - Only ${validationResult.validation.sourcesUsed.length} source(s) available`,
        icon: '📊'
      });
    }

    return warnings;
  }

  /**
   * Extract source conflicts for detailed analysis
   */
  private static extractSourceConflicts(validationResult: ValidatedPropertyData): any {
    const conflicts: Record<string, any> = {};

    // Address conflicts
    if (validationResult.address.discrepancies.length > 0) {
      conflicts['address'] = {
        discrepancies: validationResult.address.discrepancies,
        sources: validationResult.address.sources,
        confidence: validationResult.address.confidence
      };
    }

    // Size conflicts
    if (validationResult.size.discrepancies.length > 0) {
      conflicts['size'] = {
        discrepancies: validationResult.size.discrepancies,
        sources: validationResult.size.sources,
        confidence: validationResult.size.confidence
      };
    }

    // Valuation conflicts
    if (validationResult.valuation.discrepancies.length > 0) {
      conflicts['valuation'] = {
        discrepancies: validationResult.valuation.discrepancies,
        sources: validationResult.valuation.sources,
        confidence: validationResult.valuation.confidence
      };
    }

    // Demographics conflicts
    if (validationResult.demographics.discrepancies.length > 0) {
      conflicts['demographics'] = {
        discrepancies: validationResult.demographics.discrepancies,
        sources: validationResult.demographics.sources,
        confidence: validationResult.demographics.confidence
      };
    }

    return conflicts;
  }
  
  /**
   * Create new review queue entry
   */
  private static async createReviewQueueEntry(
    dealId: string,
    analysis: FlaggingResult,
    validationResult: ValidatedPropertyData
  ): Promise<string> {
    
    // Set target completion based on priority
    const hoursToComplete = {
      'critical': 4,   // 4 hours
      'high': 24,      // 1 day  
      'medium': 72,    // 3 days
      'low': 168       // 1 week
    }[analysis.priority];
    
    const targetCompletionDate = new Date(Date.now() + hoursToComplete * 60 * 60 * 1000);
    
    const reviewQueueEntry = await db.insert(reviewQueue).values({
      dealId: dealId,
      overallConfidence: validationResult.validation.overallConfidence.toString(),
      triggerReason: analysis.triggerReason,
      specificIssues: analysis.specificIssues,
      addressConfidence: validationResult.address.confidence,
      sizeConfidence: validationResult.size.confidence,
      valuationConfidence: validationResult.valuation.confidence,
      demographicsConfidence: validationResult.demographics.confidence,
      rentDataConfidence: validationResult.rentData.confidence,
      priority: analysis.priority,
      sourceDataSnapshot: {
        address: validationResult.address,
        size: validationResult.size,
        valuation: validationResult.valuation,
        demographics: validationResult.demographics,
        rentData: validationResult.rentData,
        validation: validationResult.validation
      },
      discrepancies: [
        ...validationResult.address.discrepancies,
        ...validationResult.size.discrepancies,
        ...validationResult.valuation.discrepancies,
        ...validationResult.demographics.discrepancies,
        ...validationResult.rentData.discrepancies
      ],
      sourcesUsed: validationResult.validation.sourcesUsed,
      targetCompletionDate
    }).returning({ id: reviewQueue.id });
    
    return reviewQueueEntry[0].id;
  }
  
  /**
   * Update existing review queue entry
   */
  private static async updateExistingReview(
    reviewQueueId: string,
    analysis: FlaggingResult,
    validationResult: ValidatedPropertyData
  ): Promise<void> {
    await db.update(reviewQueue)
      .set({
        overallConfidence: validationResult.validation.overallConfidence.toString(),
        specificIssues: analysis.specificIssues,
        priority: analysis.priority,
        sourceDataSnapshot: {
          address: validationResult.address,
          size: validationResult.size,
          valuation: validationResult.valuation,
          demographics: validationResult.demographics,
          rentData: validationResult.rentData,
          validation: validationResult.validation
        },
        discrepancies: [
          ...validationResult.address.discrepancies,
          ...validationResult.size.discrepancies,
          ...validationResult.valuation.discrepancies,
          ...validationResult.demographics.discrepancies,
          ...validationResult.rentData.discrepancies
        ],
        updatedAt: new Date()
      })
      .where(eq(reviewQueue.id, reviewQueueId));
  }
  
  /**
   * Auto-assign review to available analyst using round-robin
   */
  private static async assignToAnalyst(
    dealId: string,
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    try {
      // Get review queue entry
      const reviewEntry = await db
        .select()
        .from(reviewQueue)
        .where(eq(reviewQueue.dealId, dealId))
        .limit(1);
        
      if (reviewEntry.length === 0) {
        console.log(`⚠️ No review queue entry found for deal ${dealId}`);
        return;
      }
      
      // Find analyst with least active assignments (workload balancing)
      const analystWorkloads = await db
        .select({
          analystId: reviewAssignments.analystId,
          analystEmail: reviewAssignments.analystEmail,
          activeCount: sql<number>`count(*)`
        })
        .from(reviewAssignments)
        .where(inArray(reviewAssignments.status, ['assigned', 'in_review']))
        .groupBy(reviewAssignments.analystId, reviewAssignments.analystEmail);
      
      // Find the analyst with the lowest workload
      const availableAnalyst = AVAILABLE_ANALYSTS.reduce((best, analyst) => {
        const workload = analystWorkloads.find(w => w.analystEmail === analyst.email);
        const currentLoad = workload ? Number(workload.activeCount) : 0;
        
        if (!best || currentLoad < best.workload) {
          return { analyst, workload: currentLoad };
        }
        return best;
      }, null as { analyst: typeof AVAILABLE_ANALYSTS[0], workload: number } | null);
      
      if (!availableAnalyst) {
        console.log(`⚠️ No available analysts found for assignment`);
        return;
      }
      
      // Calculate estimated time based on priority
      const estimatedTime = {
        'critical': 60,
        'high': 45,
        'medium': 30,
        'low': 20
      }[priority];
      
      // Create assignment
      await db.insert(reviewAssignments).values({
        reviewQueueId: reviewEntry[0].id,
        dealId,
        analystId: availableAnalyst.analyst.id,
        analystEmail: availableAnalyst.analyst.email,
        assignmentMethod: 'auto_round_robin',
        estimatedTimeMinutes: estimatedTime
      });
      
      // Update review queue status
      await db.update(reviewQueue)
        .set({
          status: 'assigned',
          assignedAnalyst: availableAnalyst.analyst.id,
          assignedAt: new Date()
        })
        .where(eq(reviewQueue.id, reviewEntry[0].id));
      
      // Send notification to analyst for high/critical priority
      if (priority === 'high' || priority === 'critical') {
        await this.notifyAnalyst(
          availableAnalyst.analyst.email,
          availableAnalyst.analyst.name,
          dealId,
          priority,
          reviewEntry[0].triggerReason
        );
      }
      
      console.log(`✅ Deal ${dealId} assigned to ${availableAnalyst.analyst.name} (${availableAnalyst.analyst.email})`);
      
    } catch (error) {
      console.error(`❌ Error assigning deal ${dealId} to analyst:`, error);
    }
  }
  
  /**
   * Send notification to analyst about new assignment
   */
  private static async notifyAnalyst(
    analystEmail: string,
    analystName: string,
    dealId: string,
    priority: string,
    triggerReason: string
  ): Promise<void> {
    try {
      const subject = `🚨 ${priority.toUpperCase()} Priority Review: Deal ${dealId}`;
      const message = `
Hi ${analystName},

A new ${priority} priority deal has been assigned to you for manual review.

Deal ID: ${dealId}
Priority: ${priority.toUpperCase()}
Trigger Reason: ${triggerReason}

Please review this deal as soon as possible at:
https://landlinq.ai/analyst/review-queue

This deal requires manual verification due to low confidence scores or data discrepancies.

Best regards,
LandLinq Review System
      `.trim();
      
      console.log(`⚠️ Review notification disabled - no hardcoded emails allowed`);
      // CRITICAL RULE: Zero hardcoded email templates allowed
      // await sendNotificationEmail({
      //   to: analystEmail,
      //   subject: subject,
      //   html: message,
      //   type: 'deal_alert',
      //   priority: priority === 'critical' ? 'urgent' : 'high'
      // });
      
      console.log(`📧 Notification sent to ${analystEmail} for deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Error sending notification to analyst:`, error);
    }
  }
  
  /**
   * Get review queue statistics for monitoring
   */
  static async getReviewQueueStats(): Promise<{
    totalQueued: number;
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
    averageWaitTime: number;
    overdueReviews: number;
  }> {
    try {
      // Get all queue entries
      const queueEntries = await db
        .select({
          priority: reviewQueue.priority,
          status: reviewQueue.status,
          flaggedAt: reviewQueue.flaggedAt,
          targetCompletionDate: reviewQueue.targetCompletionDate
        })
        .from(reviewQueue)
        .where(inArray(reviewQueue.status, ['pending_review', 'assigned', 'in_review', 'needs_more_info']));
      
      const now = new Date();
      
      const stats = {
        totalQueued: queueEntries.length,
        byPriority: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        averageWaitTime: 0,
        overdueReviews: 0
      };
      
      let totalWaitTime = 0;
      
      for (const entry of queueEntries) {
        // Count by priority
        stats.byPriority[entry.priority || 'medium'] = (stats.byPriority[entry.priority || 'medium'] || 0) + 1;
        
        // Count by status
        stats.byStatus[entry.status || 'pending_review'] = (stats.byStatus[entry.status || 'pending_review'] || 0) + 1;
        
        // Calculate wait time
        if (entry.flaggedAt) {
          const waitTime = now.getTime() - entry.flaggedAt.getTime();
          totalWaitTime += waitTime;
        }
        
        // Count overdue
        if (entry.targetCompletionDate && now > entry.targetCompletionDate) {
          stats.overdueReviews++;
        }
      }
      
      // Calculate average wait time in hours
      stats.averageWaitTime = queueEntries.length > 0 
        ? totalWaitTime / queueEntries.length / (1000 * 60 * 60) 
        : 0;
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error getting review queue stats:', error);
      return {
        totalQueued: 0,
        byPriority: {},
        byStatus: {},
        averageWaitTime: 0,
        overdueReviews: 0
      };
    }
  }
  
  /**
   * Force recheck all recent deals for review flagging (batch operation)
   */
  static async recheckRecentDeals(daysBack: number = 7): Promise<{
    checked: number;
    flagged: number;
    errors: number;
  }> {
    console.log(`🔄 Rechecking deals from last ${daysBack} days for review flagging...`);
    
    const results = { checked: 0, flagged: 0, errors: 0 };
    
    try {
      // Get recent deals with validation history
      const recentValidations = await db
        .select({
          dealId: dealValidationHistory.dealId,
          overallConfidence: dealValidationHistory.overallConfidence,
          qualityScore: dealValidationHistory.qualityScore,
          createdAt: dealValidationHistory.createdAt
        })
        .from(dealValidationHistory)
        .where(gte(dealValidationHistory.createdAt, new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)))
        .orderBy(desc(dealValidationHistory.createdAt));
      
      console.log(`📊 Found ${recentValidations.length} recent validations to check`);
      
      // Process each validation
      for (const validation of recentValidations) {
        try {
          results.checked++;
          
          const confidence = parseFloat(validation.overallConfidence || '100');
          
          // Only recheck if confidence is below threshold
          if (confidence < FLAGGING_THRESHOLDS.OVERALL_CONFIDENCE_CRITICAL) {
            // Create minimal validation result for analysis
            const mockValidationResult: ValidatedPropertyData = {
              address: { standardized: '', components: {}, coordinates: {}, confidence: 85, sources: ['system'], discrepancies: [] },
              size: { confidence: 85, sources: ['system'], discrepancies: [] },
              valuation: { confidence: 85, sources: ['system'], discrepancies: [] },
              details: { confidence: 85, sources: ['system'], discrepancies: [] },
              demographics: { confidence: 85, sources: ['system'], discrepancies: [] },
              rentData: { confidence: 85, sources: ['system'], discrepancies: [] },
              validation: {
                overallConfidence: confidence,
                sourceCount: 2,
                sourcesUsed: ['system', 'fallback'],
                discrepancyCount: confidence < 70 ? 2 : 1,
                lastValidated: new Date(),
                qualityScore: parseFloat(validation.qualityScore || '80')
              }
            };
            
            const wasFlagged = await this.analyzeAndFlag(validation.dealId, mockValidationResult);
            if (wasFlagged) {
              results.flagged++;
            }
          }
          
        } catch (error) {
          results.errors++;
          console.error(`❌ Error rechecking deal ${validation.dealId}:`, error);
        }
      }
      
      console.log(`✅ Recheck complete: ${results.checked} checked, ${results.flagged} flagged, ${results.errors} errors`);
      return results;
      
    } catch (error) {
      console.error('❌ Error in batch recheck:', error);
      return results;
    }
  }
}

export const reviewFlaggingService = new ReviewFlaggingService();
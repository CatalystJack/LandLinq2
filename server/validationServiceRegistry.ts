/**
 * PHASE 2: Validation Service Registry
 * Central registry for managing enhanced multi-source cross-validation protocols
 */

import { EnhancedDataValidationService, EnhancedValidationResult } from './enhancedDataValidationService';
import { DataValidationService, ValidatedPropertyData } from './dataValidationService';
import { DataQualityMonitoringService } from './dataQualityMonitoringService';
import { ReviewFlaggingService } from './reviewFlaggingService';
import { db } from './db';
import { deals, dealValidationHistory } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type ValidationMode = 'standard' | 'enhanced' | 'emergency';

export interface ValidationServiceConfig {
  mode: ValidationMode;
  confidenceThreshold: number;
  enableAutoEscalation: boolean;
  enableAuditTrail: boolean;
  enableQualityMonitoring: boolean;
  timeoutMs: number;
}

/**
 * Configuration for different validation modes based on deal importance
 */
const VALIDATION_CONFIGS: { [key in ValidationMode]: ValidationServiceConfig } = {
  standard: {
    mode: 'standard',
    confidenceThreshold: 85,
    enableAutoEscalation: false,
    enableAuditTrail: false,
    enableQualityMonitoring: true,
    timeoutMs: 30000
  },
  enhanced: {
    mode: 'enhanced',
    confidenceThreshold: 95,        // 95% confidence required per user requirements
    enableAutoEscalation: true,
    enableAuditTrail: true,
    enableQualityMonitoring: true,
    timeoutMs: 60000
  },
  emergency: {
    mode: 'emergency',
    confidenceThreshold: 98,        // 98% confidence for emergency situations
    enableAutoEscalation: true,
    enableAuditTrail: true,
    enableQualityMonitoring: true,
    timeoutMs: 120000
  }
};

export class ValidationServiceRegistry {
  private static instance: ValidationServiceRegistry;
  private standardService: DataValidationService;
  private enhancedService: EnhancedDataValidationService;
  private qualityMonitoringService: DataQualityMonitoringService;
  private reviewFlaggingService: ReviewFlaggingService;

  private constructor() {
    this.standardService = new DataValidationService();
    this.enhancedService = new EnhancedDataValidationService();
    this.qualityMonitoringService = new DataQualityMonitoringService();
    this.reviewFlaggingService = new ReviewFlaggingService();

    console.log('🏭 Validation Service Registry initialized with PHASE 2 enhancements');
  }

  public static getInstance(): ValidationServiceRegistry {
    if (!ValidationServiceRegistry.instance) {
      ValidationServiceRegistry.instance = new ValidationServiceRegistry();
    }
    return ValidationServiceRegistry.instance;
  }

  /**
   * Main validation endpoint - automatically selects appropriate validation mode
   */
  async validateProperty(
    address: string,
    dealId?: string,
    mode: ValidationMode = 'enhanced'
  ): Promise<EnhancedValidationResult | ValidatedPropertyData> {
    const config = VALIDATION_CONFIGS[mode];
    const startTime = Date.now();

    console.log(`🎯 Starting ${mode.toUpperCase()} validation for: ${address}`);
    console.log(`⚙️ Config: Confidence=${config.confidenceThreshold}%, Timeout=${config.timeoutMs}ms, Auto-escalation=${config.enableAutoEscalation}`);

    try {
      let validationResult: EnhancedValidationResult | ValidatedPropertyData;

      // Select validation service based on mode
      if (mode === 'enhanced' || mode === 'emergency') {
        validationResult = await this.enhancedService.validatePropertyDataEnhanced(address, dealId);
      } else {
        validationResult = await this.standardService.validatePropertyData(address);
      }

      // Apply quality monitoring if enabled
      if (config.enableQualityMonitoring) {
        await this.applyQualityMonitoring(validationResult, dealId);
      }

      // Apply auto-escalation if enabled
      if (config.enableAutoEscalation && this.shouldAutoEscalate(validationResult, config)) {
        await this.autoEscalateValidation(validationResult, dealId, mode);
      }

      // Update deal with validation results if dealId provided
      if (dealId) {
        await this.updateDealWithValidationResults(dealId, validationResult, mode);
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ ${mode.toUpperCase()} validation completed in ${processingTime}ms`);
      console.log(`📊 Final confidence: ${validationResult.validation.overallConfidence.toFixed(1)}%`);

      return validationResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ ${mode.toUpperCase()} validation failed after ${processingTime}ms:`, error);

      // Record validation failure for monitoring
      if (config.enableQualityMonitoring) {
        await this.recordValidationFailure(address, dealId, mode, error as Error);
      }

      throw error;
    }
  }

  /**
   * Apply quality monitoring and alerting
   */
  private async applyQualityMonitoring(
    validationResult: EnhancedValidationResult | ValidatedPropertyData,
    dealId?: string
  ): Promise<void> {
    try {
      console.log('📊 Applying quality monitoring...');

      // Record validation metrics
      await this.qualityMonitoringService.recordValidationMetrics({
        validationId: `validation_${Date.now()}`,
        dealId,
        overallConfidence: validationResult.validation.overallConfidence,
        qualityScore: validationResult.validation.qualityScore,
        sourceCount: validationResult.validation.sourceCount,
        discrepancyCount: validationResult.validation.discrepancyCount,
        processingTime: (validationResult as EnhancedValidationResult).validation.processingMetrics?.totalProcessingTime || 0,
        timestamp: new Date()
      });

      // Check for quality alerts
      await this.qualityMonitoringService.checkQualityThresholds(validationResult);

      console.log('✅ Quality monitoring applied successfully');

    } catch (error) {
      console.warn('⚠️ Quality monitoring failed:', error);
      // Don't fail the validation if monitoring fails
    }
  }

  /**
   * Determine if validation should be auto-escalated
   */
  private shouldAutoEscalate(
    validationResult: EnhancedValidationResult | ValidatedPropertyData,
    config: ValidationServiceConfig
  ): boolean {
    // Check confidence threshold
    if (validationResult.validation.overallConfidence < config.confidenceThreshold) {
      console.log(`🚨 Auto-escalation triggered: Confidence ${validationResult.validation.overallConfidence.toFixed(1)}% < ${config.confidenceThreshold}%`);
      return true;
    }

    // Check for enhanced validation specific triggers
    if ('conflictResolutions' in validationResult.validation) {
      const enhancedResult = validationResult as EnhancedValidationResult;
      
      // Check for critical conflicts
      const criticalConflicts = enhancedResult.validation.conflictResolutions.filter(
        c => c.confidence < 80
      );
      
      if (criticalConflicts.length >= 2) {
        console.log(`🚨 Auto-escalation triggered: ${criticalConflicts.length} critical conflicts detected`);
        return true;
      }

      // Check for auto-escalated flagging decisions
      const autoEscalatedFlags = enhancedResult.validation.flaggingDecisions.filter(
        f => f.autoEscalated
      );
      
      if (autoEscalatedFlags.length > 0) {
        console.log(`🚨 Auto-escalation triggered: ${autoEscalatedFlags.length} auto-escalated flags`);
        return true;
      }
    }

    return false;
  }

  /**
   * Auto-escalate validation for manual review
   */
  private async autoEscalateValidation(
    validationResult: EnhancedValidationResult | ValidatedPropertyData,
    dealId?: string,
    mode: ValidationMode = 'enhanced'
  ): Promise<void> {
    try {
      console.log('🚨 Auto-escalating validation for manual review...');

      if (dealId) {
        // Use review flagging service to create review queue entry
        await this.reviewFlaggingService.flagDealForReview(dealId, {
          triggerReason: `Auto-escalated ${mode} validation`,
          confidence: validationResult.validation.overallConfidence,
          qualityScore: validationResult.validation.qualityScore,
          discrepancies: validationResult.validation.discrepancyCount,
          requiredAction: 'manual_validation_review',
          priority: validationResult.validation.overallConfidence < 90 ? 'high' : 'medium',
          estimatedReviewTime: 30, // 30 minutes for validation review
          specificWarnings: this.generateValidationWarnings(validationResult),
          dataQualityIssues: this.extractDataQualityIssues(validationResult)
        });

        console.log(`✅ Deal ${dealId} auto-escalated for manual review`);
      }

    } catch (error) {
      console.error('❌ Auto-escalation failed:', error);
    }
  }

  /**
   * Generate validation warnings for manual review
   */
  private generateValidationWarnings(
    validationResult: EnhancedValidationResult | ValidatedPropertyData
  ): string[] {
    const warnings: string[] = [];

    // Overall confidence warning
    if (validationResult.validation.overallConfidence < 95) {
      warnings.push(`Overall confidence ${validationResult.validation.overallConfidence.toFixed(1)}% below optimal threshold`);
    }

    // Source availability warnings
    if (validationResult.validation.sourceCount < 3) {
      warnings.push(`Limited data sources: only ${validationResult.validation.sourceCount} sources available`);
    }

    // Discrepancy warnings
    if (validationResult.validation.discrepancyCount > 0) {
      warnings.push(`${validationResult.validation.discrepancyCount} data discrepancies detected across sources`);
    }

    // Enhanced validation specific warnings
    if ('conflictResolutions' in validationResult.validation) {
      const enhancedResult = validationResult as EnhancedValidationResult;
      
      const criticalConflicts = enhancedResult.validation.conflictResolutions.filter(
        c => c.confidence < 80
      );
      
      if (criticalConflicts.length > 0) {
        warnings.push(`${criticalConflicts.length} critical data conflicts requiring manual resolution`);
      }

      if (enhancedResult.validation.processingMetrics.totalProcessingTime > 60000) {
        warnings.push('Validation processing time exceeded normal threshold - potential source reliability issues');
      }
    }

    return warnings;
  }

  /**
   * Extract data quality issues for flagging
   */
  private extractDataQualityIssues(
    validationResult: EnhancedValidationResult | ValidatedPropertyData
  ): Array<{ type: string; confidence: number; message: string; severity: string }> {
    const issues: Array<{ type: string; confidence: number; message: string; severity: string }> = [];

    // Add issues from all validation categories
    [
      { category: 'address', data: validationResult.address },
      { category: 'size', data: validationResult.size },
      { category: 'valuation', data: validationResult.valuation },
      { category: 'details', data: validationResult.details },
      { category: 'demographics', data: validationResult.demographics },
      { category: 'rentData', data: validationResult.rentData }
    ].forEach(({ category, data }) => {
      if (data.confidence < 85) {
        issues.push({
          type: `${category}_confidence`,
          confidence: data.confidence,
          message: `${category} validation confidence below threshold`,
          severity: data.confidence < 70 ? 'high' : 'medium'
        });
      }

      data.discrepancies.forEach(discrepancy => {
        issues.push({
          type: `${category}_discrepancy`,
          confidence: data.confidence,
          message: discrepancy,
          severity: 'medium'
        });
      });
    });

    return issues;
  }

  /**
   * Update deal with validation results
   */
  private async updateDealWithValidationResults(
    dealId: string,
    validationResult: EnhancedValidationResult | ValidatedPropertyData,
    mode: ValidationMode
  ): Promise<void> {
    try {
      console.log(`💾 Updating deal ${dealId} with ${mode} validation results...`);

      // Update deal with validation metadata
      await db
        .update(deals)
        .set({
          confidenceScore: validationResult.validation.overallConfidence,
          lastValidationAt: new Date(),
          validationHistory: {
            mode,
            confidence: validationResult.validation.overallConfidence,
            qualityScore: validationResult.validation.qualityScore,
            sources: validationResult.validation.sourcesUsed,
            timestamp: new Date()
          } as any,
          updatedAt: new Date()
        })
        .where(eq(deals.id, dealId));

      console.log(`✅ Deal ${dealId} updated with validation results`);

    } catch (error) {
      console.warn('⚠️ Failed to update deal with validation results:', error);
      // Don't fail the validation if database update fails
    }
  }

  /**
   * Record validation failure for monitoring
   */
  private async recordValidationFailure(
    address: string,
    dealId: string | undefined,
    mode: ValidationMode,
    error: Error
  ): Promise<void> {
    try {
      console.log(`📊 Recording validation failure for monitoring...`);

      await this.qualityMonitoringService.recordValidationFailure({
        dealId,
        address,
        mode,
        error: error.message,
        timestamp: new Date()
      });

    } catch (monitoringError) {
      console.warn('⚠️ Failed to record validation failure:', monitoringError);
    }
  }

  /**
   * Get validation service health status
   */
  async getServiceHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    services: { [serviceName: string]: { status: string; lastCheck: Date } };
    metrics: any;
  }> {
    console.log('🏥 Checking validation service health...');

    const healthStatus = {
      status: 'healthy' as 'healthy' | 'degraded' | 'critical',
      services: {},
      metrics: {}
    };

    try {
      // Check quality monitoring service health
      const qualityHealth = await this.qualityMonitoringService.getHealthStatus();
      healthStatus.services['quality_monitoring'] = {
        status: qualityHealth.status,
        lastCheck: new Date()
      };

      // Get validation metrics from last 24 hours
      const metrics = await this.qualityMonitoringService.getValidationMetrics(24);
      healthStatus.metrics = metrics;

      // Determine overall health
      const criticalServices = Object.values(healthStatus.services).filter(
        s => s.status === 'critical'
      );
      
      if (criticalServices.length > 0) {
        healthStatus.status = 'critical';
      } else if (metrics.averageConfidence < 90) {
        healthStatus.status = 'degraded';
      }

      console.log(`✅ Service health check complete: ${healthStatus.status.toUpperCase()}`);
      
      return healthStatus;

    } catch (error) {
      console.error('❌ Service health check failed:', error);
      return {
        status: 'critical',
        services: {},
        metrics: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Validate multiple properties in batch (for bulk operations)
   */
  async validatePropertiesBatch(
    addresses: string[],
    mode: ValidationMode = 'enhanced'
  ): Promise<Array<{ address: string; result?: EnhancedValidationResult | ValidatedPropertyData; error?: string }>> {
    console.log(`🏭 Starting batch validation for ${addresses.length} properties using ${mode.toUpperCase()} mode`);

    const results = await Promise.allSettled(
      addresses.map(async (address) => {
        try {
          const result = await this.validateProperty(address, undefined, mode);
          return { address, result };
        } catch (error) {
          return { 
            address, 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      })
    );

    const batchResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { 
          address: addresses[index], 
          error: result.reason instanceof Error ? result.reason.message : String(result.reason) 
        };
      }
    });

    const successCount = batchResults.filter(r => r.result).length;
    const errorCount = batchResults.filter(r => r.error).length;

    console.log(`✅ Batch validation completed: ${successCount} successful, ${errorCount} failed`);

    return batchResults;
  }
}

// Export singleton instance
export const validationServiceRegistry = ValidationServiceRegistry.getInstance();
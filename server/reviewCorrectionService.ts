import { db } from './db';
import {
  deals,
  reviewQueue,
  reviewCorrections,
  reviewActions,
  dealValidationHistory
} from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { dataValidationService } from './dataValidationService';
import { ReviewFlaggingService } from './reviewFlaggingService';

/**
 * Service for integrating corrected data back into deal records
 * and updating confidence scores after manual review
 */
export class ReviewCorrectionService {

  /**
   * Apply all corrections from a completed review back to the deal record
   */
  static async applyCorrectionsToDeal(reviewQueueId: string): Promise<void> {
    console.log(`🔄 Applying corrections from review ${reviewQueueId} to deal record`);
    
    try {
      // Get the review queue item
      const reviewItem = await db
        .select()
        .from(reviewQueue)
        .where(eq(reviewQueue.id, reviewQueueId))
        .limit(1);
      
      if (reviewItem.length === 0) {
        throw new Error(`Review queue item ${reviewQueueId} not found`);
      }
      
      const review = reviewItem[0];
      const dealId = review.dealId;
      
      // Get all corrections for this review
      const corrections = await db
        .select()
        .from(reviewCorrections)
        .where(eq(reviewCorrections.reviewQueueId, reviewQueueId))
        .orderBy(desc(reviewCorrections.createdAt));
      
      if (corrections.length === 0) {
        console.log(`ℹ️ No corrections found for review ${reviewQueueId}`);
        return;
      }
      
      // Get current deal record
      const dealResult = await db
        .select()
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1);
      
      if (dealResult.length === 0) {
        throw new Error(`Deal ${dealId} not found`);
      }
      
      const currentDeal = dealResult[0];
      
      // Apply corrections to deal data
      const updatedDealData = await this.buildUpdatedDealData(currentDeal, corrections);
      
      // Update the deal record
      await db.update(deals)
        .set({
          ...updatedDealData,
          analystNotes: this.appendCorrectionNotes(currentDeal.analystNotes, corrections),
          updatedAt: new Date()
        })
        .where(eq(deals.id, dealId));
      
      // Recalculate confidence scores with corrected data
      await this.recalculateConfidenceScores(dealId, updatedDealData, corrections);
      
      // Update deal classification if needed
      await this.updateDealClassification(dealId, updatedDealData);
      
      // Log the correction application
      await db.insert(reviewActions).values({
        reviewQueueId,
        dealId,
        actionType: 'corrections_applied',
        analystId: review.assignedAnalyst || 'system',
        analystName: 'System',
        notes: `Applied ${corrections.length} field corrections to deal record`,
        timeSpentMinutes: 0
      });
      
      console.log(`✅ Applied ${corrections.length} corrections to deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Error applying corrections for review ${reviewQueueId}:`, error);
      throw error;
    }
  }
  
  /**
   * Build updated deal data object with corrections applied
   */
  private static async buildUpdatedDealData(currentDeal: any, corrections: any[]): Promise<any> {
    const updatedData: any = {};
    const correctionLog: any = {};
    
    for (const correction of corrections) {
      const field = correction.fieldName;
      const correctedValue = correction.correctedValue;
      const originalValue = correction.originalValue;
      
      // Apply correction based on field type
      switch (field) {
        case 'address':
          updatedData.address = correctedValue;
          break;
          
        case 'sizeAcres':
        case 'size':
          updatedData.sizeAcres = parseFloat(correctedValue) || correctedValue;
          break;
          
        case 'askingPrice':
        case 'price':
          updatedData.askingPrice = parseFloat(correctedValue) || correctedValue;
          break;
          
        case 'zoning':
          updatedData.zoning = correctedValue;
          break;
          
        case 'unitCount':
          updatedData.unitCount = parseInt(correctedValue) || correctedValue;
          break;
          
        case 'topRentPSF':
          updatedData.topRentPSF = parseFloat(correctedValue) || correctedValue;
          break;
          
        case 'demographics.population55Plus':
          if (!updatedData.aiAnalysisData) {
            updatedData.aiAnalysisData = currentDeal.aiAnalysisData || {};
          }
          updatedData.aiAnalysisData.demographics = {
            ...updatedData.aiAnalysisData.demographics,
            population55Plus: parseInt(correctedValue) || correctedValue
          };
          break;
          
        case 'demographics.medianIncome':
          if (!updatedData.aiAnalysisData) {
            updatedData.aiAnalysisData = currentDeal.aiAnalysisData || {};
          }
          updatedData.aiAnalysisData.demographics = {
            ...updatedData.aiAnalysisData.demographics,
            medianIncome: parseInt(correctedValue) || correctedValue
          };
          break;
          
        default:
          // Store in aiAnalysisData for unknown fields
          if (!updatedData.aiAnalysisData) {
            updatedData.aiAnalysisData = currentDeal.aiAnalysisData || {};
          }
          if (!updatedData.aiAnalysisData.manualCorrections) {
            updatedData.aiAnalysisData.manualCorrections = {};
          }
          updatedData.aiAnalysisData.manualCorrections[field] = {
            correctedValue,
            originalValue,
            correctedAt: correction.createdAt,
            correctedBy: correction.analystId,
            justification: correction.justification
          };
      }
      
      // Track the correction
      correctionLog[field] = {
        original: originalValue,
        corrected: correctedValue,
        confidence: correction.confidenceLevel,
        justification: correction.justification
      };
    }
    
    // Store correction log in deal data
    if (!updatedData.aiAnalysisData) {
      updatedData.aiAnalysisData = currentDeal.aiAnalysisData || {};
    }
    updatedData.aiAnalysisData.correctionLog = correctionLog;
    updatedData.aiAnalysisData.lastCorrectionApplied = new Date();
    
    return updatedData;
  }
  
  /**
   * Recalculate confidence scores after corrections are applied
   */
  private static async recalculateConfidenceScores(
    dealId: string, 
    updatedDealData: any, 
    corrections: any[]
  ): Promise<void> {
    try {
      console.log(`🔍 Recalculating confidence scores for deal ${dealId} after corrections`);
      
      // Create a pseudo-address for validation (use updated address if corrected)
      const validationAddress = updatedDealData.address || 'Unknown';
      
      // Re-validate the property with corrected data
      const updatedValidation = await dataValidationService.validatePropertyData(validationAddress);
      
      // Apply manual confidence boosts for corrected fields
      const adjustedValidation = { ...updatedValidation };
      
      for (const correction of corrections) {
        const field = correction.fieldName;
        const confidence = correction.confidenceLevel || 95; // Default high confidence for manual corrections
        
        // Boost confidence for corrected fields
        switch (field) {
          case 'address':
            adjustedValidation.address.confidence = Math.max(adjustedValidation.address.confidence, confidence);
            break;
          case 'sizeAcres':
          case 'size':
            adjustedValidation.size.confidence = Math.max(adjustedValidation.size.confidence, confidence);
            break;
          case 'askingPrice':
          case 'price':
            adjustedValidation.valuation.confidence = Math.max(adjustedValidation.valuation.confidence, confidence);
            break;
          case 'demographics.population55Plus':
          case 'demographics.medianIncome':
            adjustedValidation.demographics.confidence = Math.max(adjustedValidation.demographics.confidence, confidence);
            break;
        }
      }
      
      // Recalculate overall confidence
      const fieldConfidences = [
        adjustedValidation.address.confidence,
        adjustedValidation.size.confidence,
        adjustedValidation.valuation.confidence,
        adjustedValidation.demographics.confidence,
        adjustedValidation.rentData.confidence
      ];
      
      const overallConfidence = fieldConfidences.reduce((sum, conf) => sum + conf, 0) / fieldConfidences.length;
      
      // Update review queue with new confidence scores
      await db.update(reviewQueue)
        .set({
          overallConfidence: Math.round(overallConfidence).toString(),
          addressConfidence: Math.round(adjustedValidation.address.confidence).toString(),
          sizeConfidence: Math.round(adjustedValidation.size.confidence).toString(), 
          valuationConfidence: Math.round(adjustedValidation.valuation.confidence).toString(),
          demographicsConfidence: Math.round(adjustedValidation.demographics.confidence).toString(),
          rentDataConfidence: Math.round(adjustedValidation.rentData.confidence).toString(),
          sourceDataSnapshot: {
            ...adjustedValidation,
            correctionApplied: true,
            originalConfidence: updatedValidation.validation.overallConfidence,
            adjustedConfidence: overallConfidence
          },
          updatedAt: new Date()
        })
        .where(eq(reviewQueue.dealId, dealId));
      
      // Store validation history
      await db.insert(dealValidationHistory).values({
        dealId,
        validationType: 'post_correction',
        validationData: adjustedValidation,
        overallConfidence: Math.round(overallConfidence).toString(),
        sourcesUsed: (adjustedValidation.validation?.sourcesUsed || []).join(','),
        discrepancyCount: adjustedValidation.validation?.discrepancyCount || 0,
        performedBy: 'review_correction_service'
      });
      
      console.log(`✅ Updated confidence scores for deal ${dealId}: ${overallConfidence.toFixed(1)}%`);
      
    } catch (error) {
      console.error(`❌ Error recalculating confidence for deal ${dealId}:`, error);
      // Don't throw - corrections should still be applied even if confidence calc fails
    }
  }
  
  /**
   * Update deal classification after corrections if confidence has improved significantly
   */
  private static async updateDealClassification(dealId: string, updatedDealData: any): Promise<void> {
    try {
      // Get updated review queue item with new confidence scores
      const reviewItem = await db
        .select()
        .from(reviewQueue)
        .where(eq(reviewQueue.dealId, dealId))
        .limit(1);
      
      if (reviewItem.length === 0) return;
      
      const review = reviewItem[0];
      const newOverallConfidence = review.overallConfidence;
      
      // If confidence is now above review thresholds, potentially update classification
      const confidenceValue = newOverallConfidence ? parseFloat(newOverallConfidence.toString()) : 0;
      if (confidenceValue >= 90) {
        console.log(`🔄 Deal ${dealId} confidence improved to ${confidenceValue}% - checking for classification update`);
        
        // Import business rules for re-classification
        const { classifyDealByExactCriteria } = await import('./businessRules');
        
        // DISABLED: No automatic re-classification - all deals require manual analyst review
        console.log(`🔄 Deal ${dealId} corrections completed - classification remains manual review required`);
        
        // Update deal with correction notes only (NO automatic classification)
        await db.update(deals)
          .set({
            // classification: NEVER auto-classify - keep existing or set to unclassified
            classification: 'unclassified',
            status: 'pending_review', // Always requires manual review
            aiAnalysisData: {
              ...updatedDealData.aiAnalysisData,
              reclassification: {
                newClassification: reclassification.classification,
                reason: 'manual_correction_improved_confidence',
                previousClassification: updatedDealData.classification,
                reclassifiedAt: new Date()
              }
            },
            updatedAt: new Date()
          })
          .where(eq(deals.id, dealId));
        
        console.log(`✅ Updated deal ${dealId} classification to ${reclassification.classification} after corrections`);
      }
      
    } catch (error) {
      console.error(`❌ Error updating classification for deal ${dealId}:`, error);
      // Don't throw - corrections should still be applied
    }
  }
  
  /**
   * Append correction notes to existing analyst notes
   */
  private static appendCorrectionNotes(existingNotes: string | null, corrections: any[]): string {
    const correctionSummary = corrections.map(c => 
      `${c.fieldName}: ${c.originalValue} → ${c.correctedValue} (${c.justification})`
    ).join('; ');
    
    const correctionNote = `\n\n[MANUAL CORRECTIONS APPLIED - ${new Date().toISOString()}]\n${correctionSummary}`;
    
    return (existingNotes || '') + correctionNote;
  }
  
  /**
   * Check if review has corrections that need to be applied
   */
  static async hasUnappliedCorrections(reviewQueueId: string): Promise<boolean> {
    const corrections = await db
      .select()
      .from(reviewCorrections)
      .where(eq(reviewCorrections.reviewQueueId, reviewQueueId))
      .limit(1);
    
    return corrections.length > 0;
  }
  
  /**
   * Get correction summary for a review
   */
  static async getCorrectionSummary(reviewQueueId: string): Promise<{
    correctionCount: number;
    fieldsChanged: string[];
    totalConfidenceImprovement: number;
  }> {
    const corrections = await db
      .select()
      .from(reviewCorrections)
      .where(eq(reviewCorrections.reviewQueueId, reviewQueueId));
    
    const fieldsChanged = [...new Set(corrections.map(c => c.fieldDisplayName || c.fieldPath))];
    const avgConfidenceImprovement = corrections.length > 0 ? 
      corrections.reduce((sum, c) => sum + (parseFloat(c.newConfidence || '0')), 0) / corrections.length : 0;
    
    return {
      correctionCount: corrections.length,
      fieldsChanged,
      totalConfidenceImprovement: avgConfidenceImprovement
    };
  }
}

// Export singleton instance
export const reviewCorrectionService = ReviewCorrectionService;
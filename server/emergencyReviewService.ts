import { db } from './db';
import { deals, emergencyReviews } from '@shared/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { sendNotificationEmail } from './emailService';
import { sendSMS } from './smsService';

// Emergency review configuration - per user requirements
export const EMERGENCY_CONFIG = {
  API_DOWN_THRESHOLD_MINUTES: 15,        // APIs down for 15+ minutes triggers emergency mode
  MAX_FAILED_APIS: 2,                    // If 2+ APIs fail, enable emergency mode  
  EMERGENCY_RECIPIENTS: [
    // Emergency notifications disabled per user request
  ],
  PARTIAL_DATA_THRESHOLD: 0.8,           // 80% data completeness threshold
  MANUAL_REVIEW_TIMEOUT_HOURS: 4         // Manual reviews must be completed within 4 hours
};

interface EmergencyStatus {
  isEmergencyMode: boolean;
  triggeredAt?: Date;
  triggeredBy: 'api_failures' | 'manual' | 'system_overload';
  affectedServices: string[];
  dealsPending: number;
  estimatedResolution?: Date;
}

interface PartialDataAnalysis {
  completeness: number;
  missingFields: string[];
  availableData: string[];
  confidence: number;
  canProceedWithReview: boolean;
  recommendedAction: 'approve' | 'flag_for_review' | 'reject';
}

export class EmergencyReviewService {
  
  /**
   * Check if emergency manual review should be activated
   */
  static async checkEmergencyConditions(): Promise<EmergencyStatus> {
    try {
      // Check API health status
      const apiStatus = await this.checkAPIHealth();
      const failedAPIs = apiStatus.filter(api => !api.healthy);
      
      // Determine if emergency mode should be activated
      const shouldActivateEmergency = 
        failedAPIs.length >= EMERGENCY_CONFIG.MAX_FAILED_APIS ||
        apiStatus.some(api => api.downTimeMinutes >= EMERGENCY_CONFIG.API_DOWN_THRESHOLD_MINUTES);

      if (shouldActivateEmergency) {
        return await this.activateEmergencyMode(failedAPIs.map(api => api.name));
      }

      return {
        isEmergencyMode: false,
        triggeredBy: 'manual',
        affectedServices: [],
        dealsPending: 0
      };
      
    } catch (error) {
      console.error('❌ Error checking emergency conditions:', error);
      
      // If we can't check conditions, assume emergency mode for safety
      return await this.activateEmergencyMode(['health_check_failed']);
    }
  }

  /**
   * Activate emergency manual review mode
   */
  static async activateEmergencyMode(affectedServices: string[]): Promise<EmergencyStatus> {
    const now = new Date();
    
    console.log(`🚨 ACTIVATING EMERGENCY MANUAL REVIEW MODE`);
    console.log(`📊 Affected services: ${affectedServices.join(', ')}`);
    
    try {
      // Count pending deals that need review
      const pendingDeals = await db
        .select()
        .from(deals)
        .where(
          and(
            eq(deals.validationStatus, 'active'),
            isNull(deals.emergencyReviewFlag)
          )
        );

      console.log(`📋 Found ${pendingDeals.length} pending deals requiring emergency review`);

      // Flag all pending deals for emergency manual review
      await db
        .update(deals)
        .set({
          emergencyReviewFlag: true,
          emergencyTriggeredAt: now,
          emergencyReason: `API failures: ${affectedServices.join(', ')}`,
          priority: 'high',
          validationStatus: 'emergency_review',
          updatedAt: now
        })
        .where(
          and(
            eq(deals.validationStatus, 'active'),
            isNull(deals.emergencyReviewFlag)
          )
        );

      // Send emergency notifications
      await this.sendEmergencyNotifications(affectedServices, pendingDeals.length);

      const emergencyStatus: EmergencyStatus = {
        isEmergencyMode: true,
        triggeredAt: now,
        triggeredBy: 'api_failures',
        affectedServices,
        dealsPending: pendingDeals.length,
        estimatedResolution: new Date(now.getTime() + EMERGENCY_CONFIG.MANUAL_REVIEW_TIMEOUT_HOURS * 60 * 60 * 1000)
      };

      console.log(`✅ Emergency mode activated successfully`);
      return emergencyStatus;
      
    } catch (error) {
      console.error('❌ Failed to activate emergency mode:', error);
      throw error;
    }
  }

  /**
   * Analyze partial data completeness and determine if review can proceed
   */
  static async analyzePartialData(dealData: any): Promise<PartialDataAnalysis> {
    console.log(`📊 Analyzing partial data completeness for deal validation`);
    
    // Essential fields for validation
    const essentialFields = [
      'address',
      'askingPrice',
      'sizeAcres',
      'propertyType'
    ];

    // Important fields that improve confidence
    const importantFields = [
      'city',
      'state',
      'zoning',
      'utilities.sewer',
      'utilities.water',
      'yearBuilt'
    ];

    // Nice-to-have fields
    const optionalFields = [
      'bedrooms',
      'bathrooms',
      'squareFootage',
      'description'
    ];

    const allFields = [...essentialFields, ...importantFields, ...optionalFields];
    
    // Calculate completeness
    let availableData: string[] = [];
    let missingFields: string[] = [];
    
    for (const field of allFields) {
      const fieldValue = this.getNestedProperty(dealData, field);
      if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
        availableData.push(field);
      } else {
        missingFields.push(field);
      }
    }

    const completeness = availableData.length / allFields.length;
    
    // Check essential fields completeness
    const essentialCompleteness = essentialFields.filter(field => 
      this.getNestedProperty(dealData, field) !== null
    ).length / essentialFields.length;

    // Calculate confidence based on completeness and field importance
    let confidence = completeness * 100;
    
    // Penalty for missing essential fields
    if (essentialCompleteness < 1) {
      confidence -= (1 - essentialCompleteness) * 40;
    }

    // Determine if we can proceed with review
    const canProceedWithReview = 
      completeness >= EMERGENCY_CONFIG.PARTIAL_DATA_THRESHOLD && 
      essentialCompleteness >= 0.75; // At least 75% of essential fields

    // Recommend action
    let recommendedAction: 'approve' | 'flag_for_review' | 'reject';
    
    if (canProceedWithReview && confidence >= 85) {
      recommendedAction = 'approve';
    } else if (canProceedWithReview && confidence >= 60) {
      recommendedAction = 'flag_for_review';
    } else {
      recommendedAction = 'reject';
    }

    console.log(`📈 Partial data analysis: ${(completeness * 100).toFixed(1)}% complete, ${confidence.toFixed(1)}% confidence`);
    console.log(`🎯 Recommendation: ${recommendedAction}`);

    return {
      completeness,
      missingFields,
      availableData,
      confidence,
      canProceedWithReview,
      recommendedAction
    };
  }

  /**
   * Process deal with partial data during emergency mode
   */
  static async processPartialDataDeal(dealId: string, dealData: any): Promise<{
    processed: boolean;
    action: string;
    confidence: number;
    requiredManualReview: boolean;
  }> {
    console.log(`🔄 Processing deal ${dealId} with partial data in emergency mode`);
    
    try {
      const analysis = await this.analyzePartialData(dealData);
      
      if (!analysis.canProceedWithReview) {
        // Insufficient data - flag for manual review
        await db
          .update(deals)
          .set({
            validationStatus: 'insufficient_data',
            flagged: true,
            analystNotes: `Emergency mode: Insufficient data (${(analysis.completeness * 100).toFixed(1)}% complete)`,
            updatedAt: new Date()
          })
          .where(eq(deals.id, dealId));

        return {
          processed: true,
          action: 'flagged_insufficient_data',
          confidence: analysis.confidence,
          requiredManualReview: true
        };
      }

      // Sufficient data - proceed based on recommendation
      let validationStatus: string;
      let requiredManualReview: boolean;
      
      switch (analysis.recommendedAction) {
        case 'approve':
          validationStatus = 'resolved';
          requiredManualReview = false;
          break;
        case 'flag_for_review':
          validationStatus = 'escalated';
          requiredManualReview = true;
          break;
        case 'reject':
          validationStatus = 'resolved';
          requiredManualReview = false;
          break;
      }

      await db
        .update(deals)
        .set({
          validationStatus: validationStatus as any,
          confidenceScore: analysis.confidence.toString(),
          flagged: requiredManualReview,
          analystNotes: `Emergency mode: ${analysis.recommendedAction} with ${(analysis.completeness * 100).toFixed(1)}% data completeness`,
          updatedAt: new Date()
        })
        .where(eq(deals.id, dealId));

      console.log(`✅ Deal ${dealId} processed in emergency mode: ${analysis.recommendedAction}`);

      return {
        processed: true,
        action: analysis.recommendedAction,
        confidence: analysis.confidence,
        requiredManualReview
      };
      
    } catch (error) {
      console.error(`❌ Failed to process partial data deal ${dealId}:`, error);
      
      // On error, flag for manual review as safety measure
      await db
        .update(deals)
        .set({
          validationStatus: 'emergency_error',
          flagged: true,
          analystNotes: `Emergency mode: Processing error - ${error instanceof Error ? error.message : 'Unknown error'}`,
          updatedAt: new Date()
        })
        .where(eq(deals.id, dealId));

      return {
        processed: false,
        action: 'error_flagged',
        confidence: 0,
        requiredManualReview: true
      };
    }
  }

  /**
   * Check API health status
   */
  private static async checkAPIHealth(): Promise<Array<{
    name: string;
    healthy: boolean;
    downTimeMinutes: number;
    lastError?: string;
  }>> {
    const apis = [
      // USPS removed per user request
      { name: 'Census', endpoint: '/api/census/health' },
      { name: 'HelloData', endpoint: '/api/hellodata/health' },
      // Attom removed per user request
    ];

    const healthChecks = apis.map(async (api) => {
      try {
        // In a real implementation, this would check actual API health
        // For now, we'll simulate health checks
        const isHealthy = Math.random() > 0.1; // 90% uptime simulation
        
        return {
          name: api.name,
          healthy: isHealthy,
          downTimeMinutes: isHealthy ? 0 : Math.floor(Math.random() * 30),
          lastError: isHealthy ? undefined : 'Simulated API error'
        };
      } catch (error) {
        return {
          name: api.name,
          healthy: false,
          downTimeMinutes: 20,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(healthChecks);
  }

  /**
   * Send emergency notifications
   */
  private static async sendEmergencyNotifications(
    affectedServices: string[],
    pendingDeals: number
  ): Promise<void> {
    const subject = '🚨 EMERGENCY: Manual Review Mode Activated';
    const message = `
EMERGENCY MANUAL REVIEW MODE ACTIVATED

Affected Services: ${affectedServices.join(', ')}
Pending Deals: ${pendingDeals}
Triggered At: ${new Date().toISOString()}

All pending deals have been flagged for emergency manual review.
Please prioritize these reviews in the analyst dashboard.

This is an automated alert from the LandLinq validation system.
    `.trim();

    try {
      // Send email notifications
      for (const recipient of EMERGENCY_CONFIG.EMERGENCY_RECIPIENTS) {
        await sendNotificationEmail({
          to: recipient,
          subject: subject,
          html: message.replace(/\n/g, '<br>'),
          type: 'deal_alert',
          priority: 'urgent'
        });
      }
      
      // Send SMS for critical emergency
      if (pendingDeals > 10) {
        const smsMessage = `🚨 EMERGENCY: ${pendingDeals} deals need manual review. Services down: ${affectedServices.join(', ')}`;
        // Send SMS to configured emergency phone numbers
        const emergencyPhones = process.env.EMERGENCY_PHONE_NUMBERS?.split(',') || [];
        for (const phone of emergencyPhones) {
          if (phone.trim()) {
            const smsResult = await sendSMS({ to: phone.trim(), message: smsMessage });
            
            if (smsResult.success && smsResult.delivered) {
              console.log(`✅ Emergency SMS sent to ${phone.trim()} (SID: ${smsResult.sid})`);
            } else if (smsResult.success && !smsResult.delivered) {
              console.log(`⏭️ Emergency SMS not delivered to ${phone.trim()} - ${smsResult.reason || smsResult.mode}`);
            } else {
              console.log(`❌ Emergency SMS failed to ${phone.trim()} - ${smsResult.error}`);
            }
          }
        }
      }
      
      console.log(`📧 Emergency notifications sent to ${EMERGENCY_CONFIG.EMERGENCY_RECIPIENTS.length} recipients`);
      
    } catch (error) {
      console.error('❌ Failed to send emergency notifications:', error);
    }
  }

  /**
   * Deactivate emergency mode
   */
  static async deactivateEmergencyMode(): Promise<void> {
    console.log(`✅ Deactivating emergency manual review mode`);
    
    try {
      // Reset emergency flags on deals
      await db
        .update(deals)
        .set({
          emergencyReviewFlag: null,
          emergencyTriggeredAt: null,
          emergencyReason: null,
          updatedAt: new Date()
        })
        .where(eq(deals.emergencyReviewFlag, true));

      console.log(`🎯 Emergency mode deactivated successfully`);
      
    } catch (error) {
      console.error('❌ Failed to deactivate emergency mode:', error);
      throw error;
    }
  }

  /**
   * Utility function to get nested property values
   */
  private static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get emergency status for dashboard
   */
  static async getEmergencyStatus(): Promise<EmergencyStatus> {
    try {
      const emergencyDeals = await db
        .select()
        .from(deals)
        .where(eq(deals.emergencyReviewFlag, true));

      if (emergencyDeals.length === 0) {
        return {
          isEmergencyMode: false,
          triggeredBy: 'manual',
          affectedServices: [],
          dealsPending: 0
        };
      }

      const firstEmergencyDeal = emergencyDeals[0];
      
      return {
        isEmergencyMode: true,
        triggeredAt: firstEmergencyDeal.emergencyTriggeredAt || undefined,
        triggeredBy: 'api_failures',
        affectedServices: firstEmergencyDeal.emergencyReason?.split(': ')[1]?.split(', ') || [],
        dealsPending: emergencyDeals.length
      };
      
    } catch (error) {
      console.error('❌ Failed to get emergency status:', error);
      return {
        isEmergencyMode: false,
        triggeredBy: 'manual',
        affectedServices: [],
        dealsPending: 0
      };
    }
  }
}

// Emergency conditions checker DISABLED per user requirements
// Alert system monitoring is completely disabled - no automatic emergency mode activation
// setInterval(() => {
//   EmergencyReviewService.checkEmergencyConditions();
// }, 5 * 60 * 1000); // Check every 5 minutes
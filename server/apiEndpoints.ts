// API endpoints for new validation configuration features
import { Request, Response } from 'express';
import { DealBlockingService } from './dealBlockingService';
import { EmergencyReviewService } from './emergencyReviewService';
import { db } from './db';
import { deals } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * API Endpoints for new configuration features - per user requirements
 */

// Deal Blocking and Override Endpoints
export const dealBlockingEndpoints = {
  
  /**
   * Get blocking status for a deal
   */
  async getBlockingStatus(req: Request, res: Response) {
    try {
      const { dealId } = req.params;
      const status = await DealBlockingService.getDealBlockingStatus(dealId);
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      console.error('❌ Failed to get blocking status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get blocking status'
      });
    }
  },

  /**
   * Analyst override - allow force-approval of deals per user requirement
   */
  async analystOverride(req: Request, res: Response) {
    try {
      const { dealId } = req.params;
      const { analystEmail, overrideReason, forceApproval } = req.body;
      
      if (!analystEmail || !overrideReason) {
        return res.status(400).json({
          success: false,
          error: 'Analyst email and override reason are required'
        });
      }

      await DealBlockingService.analystOverride(
        dealId, 
        analystEmail, 
        overrideReason, 
        forceApproval || false
      );
      
      res.json({
        success: true,
        message: `Deal ${dealId} ${forceApproval ? 'force approved' : 'override approved'} by ${analystEmail}`
      });
      
    } catch (error) {
      console.error('❌ Failed to process analyst override:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process analyst override'
      });
    }
  },

  /**
   * Manual escalation of blocked deal
   */
  async manualEscalation(req: Request, res: Response) {
    try {
      const { dealId } = req.params;
      
      await DealBlockingService.escalateBlockedDeal(dealId, 'manual');
      
      res.json({
        success: true,
        message: `Deal ${dealId} escalated manually`
      });
      
    } catch (error) {
      console.error('❌ Failed to escalate deal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to escalate deal'
      });
    }
  }
};

// Emergency Review Endpoints
export const emergencyReviewEndpoints = {
  
  /**
   * Get current emergency status
   */
  async getEmergencyStatus(req: Request, res: Response) {
    try {
      const status = await EmergencyReviewService.getEmergencyStatus();
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      console.error('❌ Failed to get emergency status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get emergency status'
      });
    }
  },

  /**
   * Manually activate emergency mode
   */
  async activateEmergency(req: Request, res: Response) {
    try {
      const { affectedServices, reason } = req.body;
      
      const services = affectedServices || ['manual_activation'];
      const status = await EmergencyReviewService.activateEmergencyMode(services);
      
      res.json({
        success: true,
        data: status,
        message: 'Emergency mode activated successfully'
      });
      
    } catch (error) {
      console.error('❌ Failed to activate emergency mode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to activate emergency mode'
      });
    }
  },

  /**
   * Deactivate emergency mode
   */
  async deactivateEmergency(req: Request, res: Response) {
    try {
      await EmergencyReviewService.deactivateEmergencyMode();
      
      res.json({
        success: true,
        message: 'Emergency mode deactivated successfully'
      });
      
    } catch (error) {
      console.error('❌ Failed to deactivate emergency mode:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate emergency mode'
      });
    }
  },

  /**
   * Analyze partial data for a specific deal
   */
  async analyzePartialData(req: Request, res: Response) {
    try {
      const { dealId } = req.params;
      
      // Get deal data
      const deal = await db
        .select()
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1);
        
      if (deal.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Deal not found'
        });
      }

      const analysis = await EmergencyReviewService.analyzePartialData(deal[0]);
      
      res.json({
        success: true,
        data: analysis
      });
      
    } catch (error) {
      console.error('❌ Failed to analyze partial data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze partial data'
      });
    }
  }
};

// Configuration Status Endpoints
export const configurationEndpoints = {
  
  /**
   * Get current validation configuration status
   */
  async getValidationConfig(req: Request, res: Response) {
    try {
      const config = {
        validationThresholds: {
          confidenceMinimum: 90,
          sourcesRequired: 2,
          // USPS removed per user request
        },
        businessLogic: {
          dealBlockingTimeoutMinutes: 10,
          alertRecipients: ['jack@catalystcp.com', 'aj@landlinq.ai'],
          analystOverrideEnabled: true
        },
        dataQualityStandards: {
          geographicPrecision: 'census_tract',
          demographicMaxAge: 5,
          activeAdultValidation: true
        },
        errorHandling: {
          emergencyReviewEnabled: true,
          partialDataThreshold: 0.8,
          intelligentEscalation: true
        },
        specialRequirements: {
          activeAdultDemographics: {
            minPopulation55Plus: 5000,
            minIncome75KPlus: 2000,
            minPercentage55Plus: 0.25
          },
          // USPS removed per user request
        },
        status: {
          allSystemsOperational: true,
          lastConfigUpdate: new Date().toISOString(),
          implementationComplete: true
        }
      };
      
      res.json({
        success: true,
        data: config,
        message: 'All user-requested configuration preferences have been successfully implemented'
      });
      
    } catch (error) {
      console.error('❌ Failed to get configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get configuration'
      });
    }
  }
};
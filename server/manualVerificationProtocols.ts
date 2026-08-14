import { db } from './db';
import { deals, users, reviewQueue } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { ValidatedPropertyData } from './dataValidationService';
import { VerificationLevel, VERIFICATION_LEVELS } from './riskBasedVerificationService';
import { sendNotificationEmail } from './emailService';

// PHASE 4: Manual Verification Protocols for High-Value Deals
// Comprehensive checklists and multi-stage approval processes for deals over $1M

export interface VerificationChecklist {
  category: string;
  items: Array<{
    id: string;
    description: string;
    required: boolean;
    verificationMethod: 'document_review' | 'third_party_validation' | 'field_verification' | 'expert_analysis';
    completedBy?: string;
    completedAt?: Date;
    status: 'pending' | 'completed' | 'failed' | 'not_applicable';
    evidence?: string;
    notes?: string;
    escalationRequired?: boolean;
  }>;
}

export interface ApprovalStage {
  stage: number;
  name: string;
  description: string;
  requiredRole: string;
  approverName?: string;
  approverId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated';
  approvedAt?: Date;
  conditions?: string[];
  rejectionReason?: string;
  delegatedTo?: string;
}

export interface ManualVerificationWorkflow {
  dealId: string;
  verificationLevel: 'enhanced' | 'premium' | 'external_audit';
  dealValue: number;
  checklists: VerificationChecklist[];
  approvalStages: ApprovalStage[];
  currentStage: number;
  overallStatus: 'initiated' | 'documentation' | 'verification' | 'approval' | 'completed' | 'rejected';
  startedAt: Date;
  targetCompletionDate: Date;
  actualCompletionDate?: Date;
  qualityAssuranceScore: number;
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    performedBy: string;
    details: string;
    category: 'checklist' | 'approval' | 'escalation' | 'quality_assurance';
  }>;
}

// Enhanced Verification Checklists by Deal Value
export const VERIFICATION_CHECKLISTS = {
  // Enhanced Level: $1M - $2M Deals
  ENHANCED: {
    PROPERTY_VERIFICATION: {
      category: 'Property Verification',
      items: [
        {
          id: 'PROP_001',
          description: 'Verify property address with multiple official sources (tax records, HelloData, survey)',
          required: true,
          verificationMethod: 'document_review' as const
        },
        {
          id: 'PROP_002', 
          description: 'Confirm property boundaries through professional survey or GIS mapping',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'PROP_003',
          description: 'Validate acreage/square footage through independent measurement',
          required: true,
          verificationMethod: 'field_verification' as const
        },
        {
          id: 'PROP_004',
          description: 'Verify zoning designation and development restrictions',
          required: true,
          verificationMethod: 'document_review' as const
        },
        {
          id: 'PROP_005',
          description: 'Confirm utility availability (water, sewer, electric, gas)',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'PROP_006',
          description: 'Check for environmental restrictions or concerns',
          required: true,
          verificationMethod: 'expert_analysis' as const
        }
      ]
    },
    FINANCIAL_VERIFICATION: {
      category: 'Financial Verification',
      items: [
        {
          id: 'FIN_001',
          description: 'Verify asking price against recent comparable sales',
          required: true,
          verificationMethod: 'expert_analysis' as const
        },
        {
          id: 'FIN_002',
          description: 'Validate construction cost estimates with local contractors',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'FIN_003',
          description: 'Confirm rental market rates through market analysis',
          required: true,
          verificationMethod: 'expert_analysis' as const
        },
        {
          id: 'FIN_004',
          description: 'Verify financing availability and terms',
          required: false,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'FIN_005',
          description: 'Review property tax implications and assessments',
          required: true,
          verificationMethod: 'document_review' as const
        }
      ]
    },
    MARKET_VERIFICATION: {
      category: 'Market Verification',
      items: [
        {
          id: 'MKT_001',
          description: 'Validate demographic data through census and local sources',
          required: true,
          verificationMethod: 'expert_analysis' as const
        },
        {
          id: 'MKT_002',
          description: 'Confirm local market demand through broker consultation',
          required: true,
          verificationMethod: 'expert_analysis' as const
        },
        {
          id: 'MKT_003',
          description: 'Verify competitive landscape and comparable properties',
          required: true,
          verificationMethod: 'expert_analysis' as const
        },
        {
          id: 'MKT_004',
          description: 'Review local development pipeline and future plans',
          required: false,
          verificationMethod: 'document_review' as const
        }
      ]
    },
    LEGAL_VERIFICATION: {
      category: 'Legal Verification',
      items: [
        {
          id: 'LEG_001',
          description: 'Verify clear title and ownership through title search',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'LEG_002',
          description: 'Check for liens, easements, or encumbrances',
          required: true,
          verificationMethod: 'document_review' as const
        },
        {
          id: 'LEG_003',
          description: 'Review local building codes and permit requirements',
          required: true,
          verificationMethod: 'document_review' as const
        },
        {
          id: 'LEG_004',
          description: 'Confirm HOA restrictions or community guidelines',
          required: false,
          verificationMethod: 'document_review' as const
        }
      ]
    }
  },

  // Premium Level: $2M - $5M Deals
  PREMIUM: {
    COMPREHENSIVE_DUE_DILIGENCE: {
      category: 'Comprehensive Due Diligence',
      items: [
        {
          id: 'PREM_001',
          description: 'Complete Phase I Environmental Site Assessment',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'PREM_002',
          description: 'Conduct professional geotechnical analysis',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'PREM_003',
          description: 'Obtain independent property appraisal',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'PREM_004',
          description: 'Review entitlement status and development timeline',
          required: true,
          verificationMethod: 'expert_analysis' as const
        },
        {
          id: 'PREM_005',
          description: 'Analyze traffic impact and infrastructure capacity',
          required: true,
          verificationMethod: 'expert_analysis' as const
        }
      ]
    },
    INSTITUTIONAL_ANALYSIS: {
      category: 'Institutional-Grade Analysis',
      items: [
        {
          id: 'INST_001',
          description: 'Prepare detailed investment memorandum',
          required: true,
          verificationMethod: 'expert_analysis' as const
        },
        {
          id: 'INST_002',
          description: 'Conduct sensitivity analysis on key assumptions',
          required: true,
          verificationMethod: 'expert_analysis' as const
        },
        {
          id: 'INST_003',
          description: 'Review comparable transactions and benchmarking',
          required: true,
          verificationMethod: 'expert_analysis' as const
        },
        {
          id: 'INST_004',
          description: 'Validate exit strategy and timing assumptions',
          required: true,
          verificationMethod: 'expert_analysis' as const
        }
      ]
    }
  },

  // External Audit Level: $5M+ Deals
  EXTERNAL_AUDIT: {
    THIRD_PARTY_VERIFICATION: {
      category: 'Third-Party Verification',
      items: [
        {
          id: 'EXT_001',
          description: 'Independent third-party property valuation',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'EXT_002',
          description: 'External audit of financial projections',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'EXT_003',
          description: 'Legal due diligence by external counsel',
          required: true,
          verificationMethod: 'third_party_validation' as const
        },
        {
          id: 'EXT_004',
          description: 'Independent market analysis and validation',
          required: true,
          verificationMethod: 'third_party_validation' as const
        }
      ]
    }
  }
};

// Multi-Stage Approval Processes by Verification Level
export const APPROVAL_WORKFLOWS = {
  ENHANCED: [
    {
      stage: 1,
      name: 'Primary Analyst Review',
      description: 'Initial comprehensive review by assigned analyst',
      requiredRole: 'analyst'
    },
    {
      stage: 2,
      name: 'Senior Analyst Approval',
      description: 'Senior analyst validation and approval',
      requiredRole: 'senior_analyst'
    }
  ],
  PREMIUM: [
    {
      stage: 1,
      name: 'Lead Analyst Review',
      description: 'Comprehensive analysis by lead analyst',
      requiredRole: 'lead_analyst'
    },
    {
      stage: 2,
      name: 'Investment Committee Review',
      description: 'Review by investment committee',
      requiredRole: 'investment_committee'
    },
    {
      stage: 3,
      name: 'Executive Approval',
      description: 'Final approval by executive team',
      requiredRole: 'executive_reviewer'
    }
  ],
  EXTERNAL_AUDIT: [
    {
      stage: 1,
      name: 'Internal Review Committee',
      description: 'Comprehensive internal review',
      requiredRole: 'review_committee'
    },
    {
      stage: 2,
      name: 'External Audit Review',
      description: 'Independent third-party audit',
      requiredRole: 'external_auditor'
    },
    {
      stage: 3,
      name: 'Executive Committee',
      description: 'Executive committee review and recommendation',
      requiredRole: 'executive_committee'
    },
    {
      stage: 4,
      name: 'Board Approval',
      description: 'Final board-level approval for major investments',
      requiredRole: 'board_member'
    }
  ]
};

export class ManualVerificationService {

  /**
   * Initiate manual verification workflow for high-value deals
   */
  static async initiateManualVerification(
    dealId: string,
    dealValue: number,
    verificationLevel: 'enhanced' | 'premium' | 'external_audit'
  ): Promise<ManualVerificationWorkflow> {
    console.log(`📋 Initiating manual verification for deal ${dealId} at ${verificationLevel} level`);

    try {
      // 1. Create comprehensive checklist based on verification level
      const checklists = this.createVerificationChecklists(verificationLevel);

      // 2. Set up approval workflow
      const approvalStages = this.createApprovalStages(verificationLevel);

      // 3. Calculate target completion date
      const targetCompletion = this.calculateTargetCompletion(verificationLevel);

      // 4. Initialize workflow
      const workflow: ManualVerificationWorkflow = {
        dealId,
        verificationLevel,
        dealValue,
        checklists,
        approvalStages,
        currentStage: 1,
        overallStatus: 'initiated',
        startedAt: new Date(),
        targetCompletionDate: targetCompletion,
        qualityAssuranceScore: 0,
        auditTrail: [{
          timestamp: new Date(),
          action: 'Manual verification workflow initiated',
          performedBy: 'system',
          details: `${verificationLevel} level verification for $${dealValue.toLocaleString()} deal`,
          category: 'escalation'
        }]
      };

      // 5. Send initial notifications
      await this.sendWorkflowNotifications(workflow);

      console.log(`✅ Manual verification workflow initiated for deal ${dealId}`);
      return workflow;

    } catch (error) {
      console.error(`❌ Error initiating manual verification for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Create verification checklists based on verification level
   */
  private static createVerificationChecklists(level: 'enhanced' | 'premium' | 'external_audit'): VerificationChecklist[] {
    const checklists: VerificationChecklist[] = [];

    switch (level) {
      case 'enhanced':
        Object.values(VERIFICATION_CHECKLISTS.ENHANCED).forEach(checklist => {
          checklists.push({
            category: checklist.category,
            items: checklist.items.map(item => ({
              ...item,
              status: 'pending' as const
            }))
          });
        });
        break;

      case 'premium':
        // Include all enhanced checklists plus premium-specific items
        Object.values(VERIFICATION_CHECKLISTS.ENHANCED).forEach(checklist => {
          checklists.push({
            category: checklist.category,
            items: checklist.items.map(item => ({
              ...item,
              status: 'pending' as const
            }))
          });
        });
        Object.values(VERIFICATION_CHECKLISTS.PREMIUM).forEach(checklist => {
          checklists.push({
            category: checklist.category,
            items: checklist.items.map(item => ({
              ...item,
              status: 'pending' as const
            }))
          });
        });
        break;

      case 'external_audit':
        // Include all previous levels plus external audit items
        Object.values(VERIFICATION_CHECKLISTS.ENHANCED).forEach(checklist => {
          checklists.push({
            category: checklist.category,
            items: checklist.items.map(item => ({
              ...item,
              status: 'pending' as const
            }))
          });
        });
        Object.values(VERIFICATION_CHECKLISTS.PREMIUM).forEach(checklist => {
          checklists.push({
            category: checklist.category,
            items: checklist.items.map(item => ({
              ...item,
              status: 'pending' as const
            }))
          });
        });
        Object.values(VERIFICATION_CHECKLISTS.EXTERNAL_AUDIT).forEach(checklist => {
          checklists.push({
            category: checklist.category,
            items: checklist.items.map(item => ({
              ...item,
              status: 'pending' as const
            }))
          });
        });
        break;
    }

    return checklists;
  }

  /**
   * Create approval stages based on verification level
   */
  private static createApprovalStages(level: 'enhanced' | 'premium' | 'external_audit'): ApprovalStage[] {
    const workflowTemplate = APPROVAL_WORKFLOWS[level.toUpperCase() as keyof typeof APPROVAL_WORKFLOWS];
    
    return workflowTemplate.map(stage => ({
      ...stage,
      status: 'pending' as const
    }));
  }

  /**
   * Calculate target completion date based on verification level
   */
  private static calculateTargetCompletion(level: 'enhanced' | 'premium' | 'external_audit'): Date {
    const now = new Date();
    let daysToAdd = 2; // Default for enhanced

    switch (level) {
      case 'enhanced':
        daysToAdd = 2; // 48 hours
        break;
      case 'premium':
        daysToAdd = 3; // 72 hours
        break;
      case 'external_audit':
        daysToAdd = 7; // 168 hours (7 days)
        break;
    }

    return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  /**
   * Send workflow notifications to relevant team members
   */
  private static async sendWorkflowNotifications(workflow: ManualVerificationWorkflow): Promise<void> {
    const subject = `📋 Manual Verification Required - Deal ${workflow.dealId} (${workflow.verificationLevel.toUpperCase()})`;
    
    const message = `
📋 **MANUAL VERIFICATION WORKFLOW INITIATED**

**Deal ID:** ${workflow.dealId}
**Verification Level:** ${workflow.verificationLevel.toUpperCase()}
**Deal Value:** $${workflow.dealValue.toLocaleString()}
**Target Completion:** ${workflow.targetCompletionDate.toLocaleDateString()}

**Verification Requirements:**
• Total Checklist Items: ${workflow.checklists.reduce((total, list) => total + list.items.length, 0)}
• Approval Stages: ${workflow.approvalStages.length}
• Required Documentation: Comprehensive due diligence package

**Key Checklist Categories:**
${workflow.checklists.map(list => `• ${list.category} (${list.items.length} items)`).join('\n')}

**Approval Workflow:**
${workflow.approvalStages.map((stage, index) => `${index + 1}. ${stage.name} (${stage.requiredRole})`).join('\n')}

⚠️ **Critical:** This high-value verification requires meticulous attention to detail and complete documentation.

Please access the LandLinq verification portal to begin the manual verification process.

Best regards,
LandLinq Manual Verification System
    `.trim();

    // Send to relevant team members based on verification level
    const recipients = this.getWorkflowRecipients(workflow.verificationLevel);
    
    for (const recipient of recipients) {
      try {
        await sendNotificationEmail(recipient.email, subject, message);
        console.log(`📧 Manual verification notification sent to ${recipient.name}`);
      } catch (error) {
        console.error(`❌ Failed to send notification to ${recipient.name}:`, error);
      }
    }
  }

  /**
   * Get relevant team members for workflow notifications
   */
  private static getWorkflowRecipients(level: 'enhanced' | 'premium' | 'external_audit'): Array<{name: string, email: string}> {
    const recipients = [
      { name: "Austin Blondell", email: "austin@landlinq.ai" }
      // Jack removed from manual review emails per request
    ];

    // Add additional recipients based on level
    if (level === 'premium' || level === 'external_audit') {
      recipients.push({ name: "AJ", email: "aj@landlinq.ai" });
    }

    return recipients;
  }

  /**
   * Complete checklist item
   */
  static async completeChecklistItem(
    dealId: string,
    checklistCategory: string,
    itemId: string,
    completedBy: string,
    status: 'completed' | 'failed' | 'not_applicable',
    evidence?: string,
    notes?: string
  ): Promise<void> {
    console.log(`✅ Completing checklist item ${itemId} for deal ${dealId}`);

    // Implementation would update the workflow state
    // For now, just log the completion
    console.log(`Checklist item completed: ${checklistCategory}/${itemId} by ${completedBy} - ${status}`);
  }

  /**
   * Approve workflow stage
   */
  static async approveWorkflowStage(
    dealId: string,
    stageNumber: number,
    approverId: string,
    approverName: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<void> {
    console.log(`🔐 Processing stage ${stageNumber} approval for deal ${dealId} by ${approverName}`);

    if (approved) {
      console.log(`✅ Stage ${stageNumber} approved for deal ${dealId}`);
      // Progress to next stage
    } else {
      console.log(`❌ Stage ${stageNumber} rejected for deal ${dealId}: ${rejectionReason}`);
      // Handle rejection workflow
    }
  }

  /**
   * Calculate quality assurance score based on checklist completion
   */
  static calculateQualityAssuranceScore(workflow: ManualVerificationWorkflow): number {
    let totalItems = 0;
    let completedItems = 0;
    let requiredItems = 0;
    let completedRequiredItems = 0;

    workflow.checklists.forEach(checklist => {
      checklist.items.forEach(item => {
        totalItems++;
        if (item.required) requiredItems++;
        
        if (item.status === 'completed') {
          completedItems++;
          if (item.required) completedRequiredItems++;
        }
      });
    });

    // Quality score: 70% weight on required items, 30% on total completion
    const requiredScore = requiredItems > 0 ? (completedRequiredItems / requiredItems) * 70 : 0;
    const overallScore = totalItems > 0 ? (completedItems / totalItems) * 30 : 0;

    return Math.round(requiredScore + overallScore);
  }
}
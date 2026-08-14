import { db } from './db';
import { deals, users, reviewQueue, dealValidationHistory } from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { ValidatedPropertyData } from './dataValidationService';
import { sendNotificationEmail } from './emailService';
import { sendSMS } from './smsService';

// PHASE 4: Risk-Based Verification Workflows by Deal Value
// This service implements tiered verification levels for maximum accuracy in high-stakes real estate decisions

export interface VerificationLevel {
  level: 'standard' | 'enhanced' | 'premium' | 'external_audit';
  minValue: number;
  maxValue: number;
  requiredSteps: string[];
  requiredApprovals: number;
  maxProcessingTime: number; // hours
  escalationThreshold: number; // confidence score below which to escalate
  requiredTeamMembers: string[];
  documentation: string[];
  complianceChecks: string[];
}

// Verification Level Configuration - Based on Deal Value and Risk
export const VERIFICATION_LEVELS: Record<string, VerificationLevel> = {
  // Standard Level: Deals under $1M
  STANDARD: {
    level: 'standard',
    minValue: 0,
    maxValue: 999999,
    requiredSteps: [
      'automated_data_validation',
      'basic_market_analysis',
      'financial_verification',
      'single_analyst_review'
    ],
    requiredApprovals: 1,
    maxProcessingTime: 24,
    escalationThreshold: 90, // 90% confidence required
    requiredTeamMembers: ['analyst'],
    documentation: ['property_details', 'financial_projections'],
    complianceChecks: ['basic_due_diligence', 'zoning_verification']
  },

  // Enhanced Level: Deals $1M - $2M  
  ENHANCED: {
    level: 'enhanced',
    minValue: 1000000,
    maxValue: 1999999,
    requiredSteps: [
      'comprehensive_data_validation',
      'enhanced_market_analysis',
      'financial_deep_dive',
      'dual_analyst_review',
      'senior_analyst_approval',
      'market_specialist_consultation'
    ],
    requiredApprovals: 2,
    maxProcessingTime: 48,
    escalationThreshold: 95, // 95% confidence required
    requiredTeamMembers: ['analyst', 'senior_analyst', 'market_specialist'],
    documentation: [
      'comprehensive_property_analysis',
      'detailed_financial_projections',
      'market_comparables',
      'risk_assessment_report'
    ],
    complianceChecks: [
      'enhanced_due_diligence',
      'environmental_screening',
      'regulatory_compliance',
      'title_verification'
    ]
  },

  // Premium Level: Deals $2M - $5M
  PREMIUM: {
    level: 'premium',
    minValue: 2000000,
    maxValue: 4999999,
    requiredSteps: [
      'exhaustive_data_validation',
      'institutional_grade_analysis',
      'comprehensive_financial_modeling',
      'multi_analyst_review_committee',
      'executive_team_presentation',
      'third_party_validation',
      'legal_review'
    ],
    requiredApprovals: 3,
    maxProcessingTime: 72,
    escalationThreshold: 98, // 98% confidence required
    requiredTeamMembers: [
      'lead_analyst',
      'senior_analyst', 
      'market_specialist',
      'financial_analyst',
      'executive_reviewer'
    ],
    documentation: [
      'institutional_investment_memorandum',
      'comprehensive_due_diligence_report',
      'third_party_valuation',
      'legal_opinion',
      'risk_mitigation_plan'
    ],
    complianceChecks: [
      'institutional_due_diligence',
      'comprehensive_environmental_assessment',
      'full_regulatory_compliance',
      'title_insurance_verification',
      'legal_structure_review'
    ]
  },

  // External Audit Level: Deals over $5M
  EXTERNAL_AUDIT: {
    level: 'external_audit',
    minValue: 5000000,
    maxValue: Infinity,
    requiredSteps: [
      'pre_audit_internal_validation',
      'external_auditor_selection',
      'third_party_comprehensive_audit',
      'audit_findings_review',
      'executive_committee_approval',
      'board_level_presentation',
      'regulatory_filing_preparation'
    ],
    requiredApprovals: 4,
    maxProcessingTime: 168, // 7 days
    escalationThreshold: 99, // 99% confidence required
    requiredTeamMembers: [
      'lead_analyst',
      'senior_analyst',
      'market_specialist', 
      'financial_analyst',
      'executive_reviewer',
      'external_auditor',
      'legal_counsel'
    ],
    documentation: [
      'external_audit_report',
      'independent_valuation',
      'legal_due_diligence_report',
      'regulatory_compliance_certification',
      'executive_investment_committee_memo',
      'board_resolution'
    ],
    complianceChecks: [
      'external_audit_verification',
      'independent_environmental_assessment',
      'regulatory_approval_verification',
      'legal_structure_audit',
      'fiduciary_compliance_review'
    ]
  }
};

// Team Member Assignments by Role
export const TEAM_ASSIGNMENTS = {
  ANALYSTS: [
    { id: "austin-blondell", name: "Austin Blondell", email: "austin@landlinq.ai", role: "analyst", level: "senior" },
    { id: "davis-hammond", name: "Davis Hammond", email: "davis@landlinq.ai", role: "analyst", level: "junior" },
    { id: "steve-hillebrand", name: "Steve Hillebrand", email: "steve@landlinq.ai", role: "market_specialist", level: "senior" },
    { id: "john-bell", name: "John Bell", email: "john@landlinq.ai", role: "financial_analyst", level: "senior" },
    { id: "mallie-colavita", name: "Mallie Colavita", email: "mallie@landlinq.ai", role: "analyst", level: "junior" }
  ],
  EXECUTIVES: [
    { id: "jack-catalystcp", name: "Jack", email: "jack@catalystcp.com", role: "executive_reviewer", level: "executive" },
    { id: "aj-landlinq", name: "AJ", email: "aj@landlinq.ai", role: "executive_reviewer", level: "executive" }
  ],
  EXTERNAL_PARTNERS: [
    // These would be configured based on approved external auditing firms
    { id: "external-auditor-1", name: "TBD - External Auditor", email: "audit@partner.com", role: "external_auditor", level: "certified" }
  ]
};

interface VerificationWorkflow {
  dealId: string;
  verificationLevel: VerificationLevel;
  currentStep: number;
  totalSteps: number;
  assignedTeam: Array<{
    role: string;
    assigneeId: string;
    assigneeName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'escalated';
    assignedAt: Date;
    completedAt?: Date;
    approvalRequired: boolean;
  }>;
  requiredDocuments: Array<{
    type: string;
    status: 'pending' | 'uploaded' | 'verified' | 'rejected';
    uploadedAt?: Date;
    verifiedBy?: string;
    rejectionReason?: string;
  }>;
  complianceStatus: Array<{
    check: string;
    status: 'pending' | 'completed' | 'failed' | 'requires_escalation';
    completedBy?: string;
    completedAt?: Date;
    notes?: string;
  }>;
  overallStatus: 'initiated' | 'in_progress' | 'ready_for_approval' | 'approved' | 'escalated' | 'rejected';
  createdAt: Date;
  targetCompletionDate: Date;
  actualCompletionDate?: Date;
  confidenceScore: number;
  riskScore: number;
}

export class RiskBasedVerificationService {

  /**
   * Main entry point: Initiate verification workflow based on deal value and risk
   */
  static async initiateVerificationWorkflow(
    dealId: string,
    dealValue: number,
    validationResult: ValidatedPropertyData,
    dealData?: any
  ): Promise<VerificationWorkflow> {
    console.log(`🔍 Initiating risk-based verification for deal ${dealId} (value: $${dealValue.toLocaleString()})`);

    try {
      // 1. Determine appropriate verification level
      const verificationLevel = this.determineVerificationLevel(dealValue, validationResult);
      console.log(`📊 Assigned verification level: ${verificationLevel.level.toUpperCase()}`);

      // 2. Assess additional risk factors
      const riskScore = this.calculateRiskScore(dealValue, validationResult, dealData);
      console.log(`⚠️ Risk score calculated: ${riskScore}/100`);

      // 3. Create verification workflow
      const workflow = await this.createVerificationWorkflow(
        dealId,
        verificationLevel,
        validationResult.validation.overallConfidence,
        riskScore
      );

      // 4. Assign team members based on verification level
      await this.assignTeamMembers(workflow);

      // 5. Send initial notifications
      await this.sendInitialNotifications(workflow);

      // 6. Update deal with verification status
      await this.updateDealVerificationStatus(dealId, workflow);

      console.log(`✅ Verification workflow initiated for deal ${dealId}`);
      return workflow;

    } catch (error) {
      console.error(`❌ Error initiating verification workflow for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Determine verification level based on deal value and risk factors
   */
  private static determineVerificationLevel(
    dealValue: number,
    validationResult: ValidatedPropertyData
  ): VerificationLevel {
    // Start with value-based determination
    let baseLevel: VerificationLevel;

    if (dealValue >= 5000000) {
      baseLevel = VERIFICATION_LEVELS.EXTERNAL_AUDIT;
    } else if (dealValue >= 2000000) {
      baseLevel = VERIFICATION_LEVELS.PREMIUM;
    } else if (dealValue >= 1000000) {
      baseLevel = VERIFICATION_LEVELS.ENHANCED;
    } else {
      baseLevel = VERIFICATION_LEVELS.STANDARD;
    }

    // Check if risk factors require escalation to higher level
    const confidenceScore = validationResult.validation.overallConfidence;
    const discrepancyCount = validationResult.validation.discrepancyCount;
    const sourceCount = validationResult.validation.sourceCount;

    // Escalation logic for high-risk deals
    if (confidenceScore < 85 || discrepancyCount > 5 || sourceCount < 2) {
      console.log(`⬆️ Escalating verification level due to risk factors: confidence=${confidenceScore}%, discrepancies=${discrepancyCount}, sources=${sourceCount}`);
      
      // Escalate to next level if not already at highest
      if (baseLevel.level === 'standard') {
        return VERIFICATION_LEVELS.ENHANCED;
      } else if (baseLevel.level === 'enhanced') {
        return VERIFICATION_LEVELS.PREMIUM;
      } else if (baseLevel.level === 'premium') {
        return VERIFICATION_LEVELS.EXTERNAL_AUDIT;
      }
    }

    return baseLevel;
  }

  /**
   * Calculate comprehensive risk score (0-100, higher = more risk)
   */
  private static calculateRiskScore(
    dealValue: number,
    validationResult: ValidatedPropertyData,
    dealData?: any
  ): number {
    let riskScore = 0;

    // Data quality risk (40% of total score)
    const dataQualityRisk = Math.max(0, 100 - validationResult.validation.overallConfidence);
    riskScore += dataQualityRisk * 0.4;

    // Source reliability risk (20% of total score)
    const sourceRisk = validationResult.validation.sourceCount < 3 ? 30 : 0;
    riskScore += sourceRisk * 0.2;

    // Discrepancy risk (20% of total score)
    const discrepancyRisk = Math.min(100, validationResult.validation.discrepancyCount * 10);
    riskScore += discrepancyRisk * 0.2;

    // Market risk factors (10% of total score)
    let marketRisk = 0;
    if (validationResult.publicListings.isPubliclyListed) {
      marketRisk += 15; // Public listings have competition risk
    }
    if (validationResult.demographics.confidence < 75) {
      marketRisk += 10; // Uncertain demographics add risk
    }
    riskScore += Math.min(30, marketRisk) * 0.1;

    // Deal complexity risk (10% of total score)
    let complexityRisk = 0;
    if (dealValue > 5000000) complexityRisk += 20;
    else if (dealValue > 2000000) complexityRisk += 15;
    else if (dealValue > 1000000) complexityRisk += 10;
    
    if (dealData?.hasEntitlements) complexityRisk += 5;
    if (dealData?.zoning && !['R-1', 'R-2', 'R-3'].includes(dealData.zoning)) {
      complexityRisk += 5; // Complex zoning adds risk
    }
    
    riskScore += Math.min(30, complexityRisk) * 0.1;

    return Math.min(100, Math.round(riskScore));
  }

  /**
   * Create detailed verification workflow
   */
  private static async createVerificationWorkflow(
    dealId: string,
    verificationLevel: VerificationLevel,
    confidenceScore: number,
    riskScore: number
  ): Promise<VerificationWorkflow> {
    const now = new Date();
    const targetCompletion = new Date(now.getTime() + verificationLevel.maxProcessingTime * 60 * 60 * 1000);

    // Initialize team assignments (will be populated by assignTeamMembers)
    const assignedTeam = verificationLevel.requiredTeamMembers.map(role => ({
      role,
      assigneeId: '', // Will be assigned
      assigneeName: '', // Will be assigned
      status: 'pending' as const,
      assignedAt: now,
      approvalRequired: this.isApprovalRole(role)
    }));

    // Initialize required documents
    const requiredDocuments = verificationLevel.documentation.map(type => ({
      type,
      status: 'pending' as const
    }));

    // Initialize compliance checks
    const complianceStatus = verificationLevel.complianceChecks.map(check => ({
      check,
      status: 'pending' as const
    }));

    const workflow: VerificationWorkflow = {
      dealId,
      verificationLevel,
      currentStep: 0,
      totalSteps: verificationLevel.requiredSteps.length,
      assignedTeam,
      requiredDocuments,
      complianceStatus,
      overallStatus: 'initiated',
      createdAt: now,
      targetCompletionDate: targetCompletion,
      confidenceScore,
      riskScore
    };

    return workflow;
  }

  /**
   * Assign team members to workflow based on availability and expertise
   */
  private static async assignTeamMembers(workflow: VerificationWorkflow): Promise<void> {
    console.log(`👥 Assigning team members for ${workflow.verificationLevel.level} verification`);

    for (const teamMember of workflow.assignedTeam) {
      const availableAssignee = await this.findBestAssignee(teamMember.role, workflow.dealId);
      
      if (availableAssignee) {
        teamMember.assigneeId = availableAssignee.id;
        teamMember.assigneeName = availableAssignee.name;
        console.log(`✅ Assigned ${availableAssignee.name} as ${teamMember.role}`);
      } else {
        console.warn(`⚠️ No available assignee found for role: ${teamMember.role}`);
        // Escalate if critical role cannot be assigned
        if (this.isCriticalRole(teamMember.role)) {
          workflow.overallStatus = 'escalated';
        }
      }
    }
  }

  /**
   * Find best available team member for a specific role
   */
  private static async findBestAssignee(role: string, dealId: string): Promise<any> {
    // Get all team members for this role
    const candidates = [
      ...TEAM_ASSIGNMENTS.ANALYSTS,
      ...TEAM_ASSIGNMENTS.EXECUTIVES,
      ...TEAM_ASSIGNMENTS.EXTERNAL_PARTNERS
    ].filter(member => member.role === role || this.roleMatches(member.role, role));

    if (candidates.length === 0) {
      return null;
    }

    // For now, simple round-robin assignment
    // In production, this would consider workload, expertise, availability
    return candidates[0];
  }

  /**
   * Check if roles match (including role hierarchies)
   */
  private static roleMatches(memberRole: string, requiredRole: string): boolean {
    const roleHierarchy: Record<string, string[]> = {
      'analyst': ['analyst', 'senior_analyst', 'lead_analyst'],
      'senior_analyst': ['senior_analyst', 'lead_analyst'],
      'market_specialist': ['market_specialist'],
      'financial_analyst': ['financial_analyst'],
      'executive_reviewer': ['executive_reviewer'],
      'external_auditor': ['external_auditor'],
      'legal_counsel': ['legal_counsel']
    };

    return roleHierarchy[requiredRole]?.includes(memberRole) || memberRole === requiredRole;
  }

  /**
   * Check if role requires approval authority
   */
  private static isApprovalRole(role: string): boolean {
    const approvalRoles = ['senior_analyst', 'lead_analyst', 'executive_reviewer', 'external_auditor'];
    return approvalRoles.includes(role);
  }

  /**
   * Check if role is critical for workflow completion
   */
  private static isCriticalRole(role: string): boolean {
    const criticalRoles = ['analyst', 'senior_analyst', 'executive_reviewer'];
    return criticalRoles.includes(role);
  }

  /**
   * Send initial notifications to assigned team members
   */
  private static async sendInitialNotifications(workflow: VerificationWorkflow): Promise<void> {
    console.log(`📧 Sending verification workflow notifications for deal ${workflow.dealId}`);

    for (const teamMember of workflow.assignedTeam) {
      if (teamMember.assigneeId && teamMember.assigneeName) {
        const subject = `🔍 ${workflow.verificationLevel.level.toUpperCase()} Verification Assignment - Deal ${workflow.dealId}`;
        const message = this.generateNotificationMessage(workflow, teamMember);

        try {
          // Get assignee email from team assignments
          const assigneeEmail = this.getAssigneeEmail(teamMember.assigneeId);
          
          if (assigneeEmail) {
            await sendNotificationEmail(assigneeEmail, subject, message);
            console.log(`✅ Notification sent to ${teamMember.assigneeName} (${assigneeEmail})`);
          }
        } catch (error) {
          console.error(`❌ Failed to send notification to ${teamMember.assigneeName}:`, error);
        }
      }
    }
  }

  /**
   * Generate personalized notification message
   */
  private static generateNotificationMessage(workflow: VerificationWorkflow, teamMember: any): string {
    const urgencyLevel = workflow.riskScore > 70 ? 'HIGH PRIORITY' : workflow.riskScore > 40 ? 'MEDIUM PRIORITY' : 'STANDARD';
    
    return `
🔍 **${workflow.verificationLevel.level.toUpperCase()} VERIFICATION REQUIRED**

**Deal ID:** ${workflow.dealId}
**Your Role:** ${teamMember.role.replace('_', ' ').toUpperCase()}
**Priority Level:** ${urgencyLevel}
**Target Completion:** ${workflow.targetCompletionDate.toLocaleDateString()}

**Verification Requirements:**
• Confidence Score: ${workflow.confidenceScore}%
• Risk Score: ${workflow.riskScore}/100
• Required Steps: ${workflow.totalSteps}
• Approval Required: ${teamMember.approvalRequired ? 'YES' : 'NO'}

**Key Actions:**
${workflow.verificationLevel.requiredSteps.map(step => `• ${step.replace('_', ' ').toUpperCase()}`).join('\n')}

**Required Documentation:**
${workflow.verificationLevel.documentation.map(doc => `• ${doc.replace('_', ' ').toUpperCase()}`).join('\n')}

⚠️ **Important:** This is a high-stakes real estate verification requiring maximum accuracy.

Please access the LandLinq verification portal to begin your review.

Best regards,
LandLinq Verification System
    `.trim();
  }

  /**
   * Get assignee email from team assignments
   */
  private static getAssigneeEmail(assigneeId: string): string | null {
    const allTeamMembers = [
      ...TEAM_ASSIGNMENTS.ANALYSTS,
      ...TEAM_ASSIGNMENTS.EXECUTIVES,
      ...TEAM_ASSIGNMENTS.EXTERNAL_PARTNERS
    ];

    const assignee = allTeamMembers.find(member => member.id === assigneeId);
    return assignee?.email || null;
  }

  /**
   * Update deal with verification workflow status
   */
  private static async updateDealVerificationStatus(
    dealId: string,
    workflow: VerificationWorkflow
  ): Promise<void> {
    try {
      await db
        .update(deals)
        .set({
          validationStatus: 'active',
          riskLevel: this.mapRiskScoreToLevel(workflow.riskScore),
          confidenceScore: workflow.confidenceScore.toString(),
          validationFlags: {
            verificationLevel: workflow.verificationLevel.level,
            riskScore: workflow.riskScore,
            assignedTeam: workflow.assignedTeam.length,
            targetCompletion: workflow.targetCompletionDate.toISOString(),
            workflowStatus: workflow.overallStatus
          },
          updatedAt: new Date()
        })
        .where(eq(deals.id, dealId));

      console.log(`✅ Deal ${dealId} updated with verification workflow status`);
    } catch (error) {
      console.error(`❌ Failed to update deal ${dealId} verification status:`, error);
      throw error;
    }
  }

  /**
   * Map risk score to risk level enum
   */
  private static mapRiskScoreToLevel(riskScore: number): 'clean' | 'low' | 'medium' | 'high' {
    if (riskScore <= 20) return 'clean';
    if (riskScore <= 40) return 'low';
    if (riskScore <= 70) return 'medium';
    return 'high';
  }

  /**
   * Process workflow step completion
   */
  static async completeWorkflowStep(
    dealId: string,
    stepName: string,
    completedBy: string,
    result: 'approved' | 'rejected' | 'escalated',
    notes?: string
  ): Promise<void> {
    console.log(`✅ Completing workflow step: ${stepName} for deal ${dealId} by ${completedBy}`);

    // Update workflow progress
    // Implementation would update workflow state and trigger next steps
    
    if (result === 'escalated') {
      await this.escalateWorkflow(dealId, stepName, notes || 'Step escalated by reviewer');
    }
  }

  /**
   * Escalate workflow to higher verification level or manual review
   */
  static async escalateWorkflow(
    dealId: string,
    reason: string,
    details: string
  ): Promise<void> {
    console.log(`🚨 Escalating workflow for deal ${dealId}: ${reason}`);

    try {
      // Update deal status
      await db
        .update(deals)
        .set({
          validationStatus: 'escalated',
          flagged: true,
          riskLevel: 'high',
          flaggingReason: `Workflow escalated: ${reason}`,
          escalatedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(deals.id, dealId));

      // Send escalation notifications
      await this.sendEscalationNotifications(dealId, reason, details);

      console.log(`✅ Workflow escalated for deal ${dealId}`);
    } catch (error) {
      console.error(`❌ Failed to escalate workflow for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Send escalation notifications to executive team
   */
  private static async sendEscalationNotifications(
    dealId: string,
    reason: string,
    details: string
  ): Promise<void> {
    const escalationMessage = `
🚨 **VERIFICATION WORKFLOW ESCALATION**

**Deal ID:** ${dealId}
**Escalation Reason:** ${reason}
**Details:** ${details}
**Timestamp:** ${new Date().toISOString()}

**Required Action:** Executive review and approval needed for this high-stakes verification.

Please access the LandLinq executive dashboard for immediate review.

This escalation requires immediate attention due to the critical nature of the investment decision.
    `.trim();

    // Send to executive team
    for (const executive of TEAM_ASSIGNMENTS.EXECUTIVES) {
      try {
        await sendNotificationEmail(
          executive.email,
          `🚨 URGENT: Verification Escalation - Deal ${dealId}`,
          escalationMessage
        );
        console.log(`📧 Escalation notification sent to ${executive.name}`);
      } catch (error) {
        console.error(`❌ Failed to send escalation notification to ${executive.name}:`, error);
      }
    }
  }
}
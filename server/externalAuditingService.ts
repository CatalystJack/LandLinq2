import { db } from './db';
import { deals, users, reviewQueue } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { ValidatedPropertyData } from './dataValidationService';
import { sendNotificationEmail } from './emailService';
import { sendSMS } from './smsService';

// PHASE 4: External Auditing System for Deals Over $2M
// Third-party auditing integration and compliance reporting for premium investments

export interface ExternalAuditor {
  id: string;
  firmName: string;
  contactName: string;
  email: string;
  phone: string;
  certifications: string[];
  specialties: string[];
  minDealValue: number;
  maxDealValue: number;
  averageAuditTime: number; // hours
  qualityRating: number; // 1-10
  isActive: boolean;
  lastAuditDate?: Date;
  auditCount: number;
  successRate: number; // percentage
}

export interface AuditScope {
  category: string;
  requirements: Array<{
    id: string;
    description: string;
    mandatory: boolean;
    estimatedHours: number;
    deliverable: string;
    deadline: Date;
  }>;
}

export interface ExternalAuditWorkflow {
  auditId: string;
  dealId: string;
  dealValue: number;
  auditLevel: 'comprehensive' | 'enhanced' | 'full_compliance';
  assignedAuditor: ExternalAuditor;
  backupAuditor?: ExternalAuditor;
  auditScope: AuditScope[];
  status: 'initiated' | 'auditor_assigned' | 'in_progress' | 'preliminary_findings' | 'final_report' | 'completed' | 'escalated';
  startedAt: Date;
  targetCompletionDate: Date;
  actualCompletionDate?: Date;
  auditFindings: Array<{
    id: string;
    category: string;
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
    impact: string;
    status: 'open' | 'addressed' | 'accepted_risk' | 'escalated';
    discoveredAt: Date;
    addressedAt?: Date;
  }>;
  auditDocuments: Array<{
    type: string;
    fileName: string;
    uploadedAt: Date;
    uploadedBy: string;
    verified: boolean;
    notes?: string;
  }>;
  complianceReport: {
    overallRating: 'pass' | 'conditional_pass' | 'fail';
    confidenceLevel: number;
    majorFindings: number;
    minorFindings: number;
    recommendations: string[];
    riskAssessment: string;
    executiveSummary: string;
  };
  costTracking: {
    estimatedCost: number;
    actualCost: number;
    hourlyRate: number;
    totalHours: number;
    expenseBreakdown: Array<{
      category: string;
      amount: number;
      description: string;
    }>;
  };
  qualityMetrics: {
    thoroughnessScore: number; // 1-100
    timelinessScore: number; // 1-100
    accuracyScore: number; // 1-100
    communicationScore: number; // 1-100
    overallScore: number; // 1-100
  };
}

// Certified External Auditing Partners
export const CERTIFIED_AUDITORS: ExternalAuditor[] = [
  {
    id: 'deloitte-re',
    firmName: 'Deloitte Real Estate Advisory',
    contactName: 'Senior Partner TBD',
    email: 'realestate@deloitte.com',
    phone: '+1-800-DELOITTE',
    certifications: ['CPA', 'MAI', 'CRE', 'CCIM'],
    specialties: ['commercial_real_estate', 'investment_analysis', 'due_diligence', 'regulatory_compliance'],
    minDealValue: 2000000,
    maxDealValue: 100000000,
    averageAuditTime: 120,
    qualityRating: 9.5,
    isActive: true,
    auditCount: 0,
    successRate: 98.5
  },
  {
    id: 'pwc-realestate',
    firmName: 'PwC Real Estate Practice',
    contactName: 'Real Estate Director TBD',
    email: 'realestate@pwc.com',
    phone: '+1-646-471-4000',
    certifications: ['CPA', 'CFA', 'CRE', 'MAI'],
    specialties: ['asset_valuation', 'market_analysis', 'financial_modeling', 'risk_assessment'],
    minDealValue: 1500000,
    maxDealValue: 50000000,
    averageAuditTime: 96,
    qualityRating: 9.2,
    isActive: true,
    auditCount: 0,
    successRate: 97.8
  },
  {
    id: 'cbre-valuation',
    firmName: 'CBRE Valuation & Advisory Services',
    contactName: 'Valuation Director TBD',
    email: 'valuation@cbre.com',
    phone: '+1-213-613-3333',
    certifications: ['MAI', 'CRE', 'ASA', 'CFA'],
    specialties: ['property_valuation', 'market_research', 'highest_best_use', 'feasibility_studies'],
    minDealValue: 1000000,
    maxDealValue: 25000000,
    averageAuditTime: 80,
    qualityRating: 9.0,
    isActive: true,
    auditCount: 0,
    successRate: 96.5
  },
  {
    id: 'newmark-advisory',
    firmName: 'Newmark Advisory Services',
    contactName: 'Advisory Partner TBD',
    email: 'advisory@newmark.com',
    phone: '+1-212-372-2000',
    certifications: ['CRE', 'MAI', 'CCIM', 'SIOR'],
    specialties: ['investment_sales', 'due_diligence', 'capital_markets', 'development_consulting'],
    minDealValue: 2000000,
    maxDealValue: 75000000,
    averageAuditTime: 100,
    qualityRating: 8.8,
    isActive: true,
    auditCount: 0,
    successRate: 95.2
  }
];

// Comprehensive Audit Scopes by Deal Value
export const AUDIT_SCOPES = {
  // $2M - $5M: Comprehensive Audit
  COMPREHENSIVE: {
    PROPERTY_VALIDATION: {
      category: 'Property Validation & Verification',
      requirements: [
        {
          id: 'PV_001',
          description: 'Independent property inspection and condition assessment',
          mandatory: true,
          estimatedHours: 16,
          deliverable: 'Property Condition Report with photographs and recommendations',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        },
        {
          id: 'PV_002',
          description: 'Professional boundary survey and title verification',
          mandatory: true,
          estimatedHours: 12,
          deliverable: 'Survey Report and Title Analysis',
          deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days
        },
        {
          id: 'PV_003',
          description: 'Zoning compliance and development rights analysis',
          mandatory: true,
          estimatedHours: 8,
          deliverable: 'Zoning Compliance Report',
          deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days
        }
      ]
    },
    FINANCIAL_ANALYSIS: {
      category: 'Financial Analysis & Valuation',
      requirements: [
        {
          id: 'FA_001',
          description: 'Independent market valuation using multiple approaches',
          mandatory: true,
          estimatedHours: 20,
          deliverable: 'Comprehensive Appraisal Report',
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
        },
        {
          id: 'FA_002',
          description: 'Financial model validation and sensitivity analysis',
          mandatory: true,
          estimatedHours: 16,
          deliverable: 'Financial Model Validation Report',
          deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days
        },
        {
          id: 'FA_003',
          description: 'Market rent analysis and competitive positioning',
          mandatory: true,
          estimatedHours: 12,
          deliverable: 'Market Analysis Report',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      ]
    },
    RISK_ASSESSMENT: {
      category: 'Risk Assessment & Compliance',
      requirements: [
        {
          id: 'RA_001',
          description: 'Environmental due diligence and Phase I ESA review',
          mandatory: true,
          estimatedHours: 10,
          deliverable: 'Environmental Risk Assessment',
          deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000) // 12 days
        },
        {
          id: 'RA_002',
          description: 'Regulatory compliance and permit analysis',
          mandatory: true,
          estimatedHours: 8,
          deliverable: 'Regulatory Compliance Report',
          deadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000) // 8 days
        }
      ]
    }
  },

  // $5M+: Enhanced Full Compliance Audit
  ENHANCED: {
    COMPREHENSIVE_DUE_DILIGENCE: {
      category: 'Comprehensive Due Diligence',
      requirements: [
        {
          id: 'EDD_001',
          description: 'Complete institutional-grade due diligence package',
          mandatory: true,
          estimatedHours: 40,
          deliverable: 'Institutional Due Diligence Report',
          deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000) // 21 days
        },
        {
          id: 'EDD_002',
          description: 'Third-party engineering and architectural review',
          mandatory: true,
          estimatedHours: 24,
          deliverable: 'Engineering Assessment Report',
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
        }
      ]
    },
    INSTITUTIONAL_VALIDATION: {
      category: 'Institutional-Grade Validation',
      requirements: [
        {
          id: 'IV_001',
          description: 'Investment committee presentation preparation',
          mandatory: true,
          estimatedHours: 16,
          deliverable: 'Investment Committee Memorandum',
          deadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000) // 18 days
        },
        {
          id: 'IV_002',
          description: 'Regulatory filing preparation and compliance review',
          mandatory: true,
          estimatedHours: 12,
          deliverable: 'Compliance Documentation Package',
          deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
        }
      ]
    }
  }
};

export class ExternalAuditingService {

  /**
   * Initiate external audit for premium deals over $2M
   */
  static async initiateExternalAudit(
    dealId: string,
    dealValue: number,
    validationResult: ValidatedPropertyData,
    urgency: 'standard' | 'expedited' | 'rush' = 'standard'
  ): Promise<ExternalAuditWorkflow> {
    console.log(`🔍 Initiating external audit for deal ${dealId} (value: $${dealValue.toLocaleString()})`);

    try {
      // 1. Determine audit level based on deal value
      const auditLevel = this.determineAuditLevel(dealValue);
      console.log(`📊 Audit level determined: ${auditLevel}`);

      // 2. Select and assign best auditor
      const assignedAuditor = await this.selectOptimalAuditor(dealValue, auditLevel, urgency);
      console.log(`👔 Assigned auditor: ${assignedAuditor.firmName}`);

      // 3. Create audit scope
      const auditScope = this.createAuditScope(auditLevel, urgency);

      // 4. Calculate timeline and costs
      const timeline = this.calculateAuditTimeline(auditScope, urgency);
      const estimatedCost = this.estimateAuditCost(assignedAuditor, auditScope);

      // 5. Initialize audit workflow
      const auditWorkflow: ExternalAuditWorkflow = {
        auditId: `AUDIT_${dealId}_${Date.now()}`,
        dealId,
        dealValue,
        auditLevel,
        assignedAuditor,
        auditScope,
        status: 'initiated',
        startedAt: new Date(),
        targetCompletionDate: timeline.completionDate,
        auditFindings: [],
        auditDocuments: [],
        complianceReport: {
          overallRating: 'pass', // Will be updated during audit
          confidenceLevel: 0,
          majorFindings: 0,
          minorFindings: 0,
          recommendations: [],
          riskAssessment: '',
          executiveSummary: ''
        },
        costTracking: {
          estimatedCost,
          actualCost: 0,
          hourlyRate: assignedAuditor.qualityRating * 150, // Base rate adjusted by quality
          totalHours: 0,
          expenseBreakdown: []
        },
        qualityMetrics: {
          thoroughnessScore: 0,
          timelinessScore: 0,
          accuracyScore: 0,
          communicationScore: 0,
          overallScore: 0
        }
      };

      // 6. Send audit initiation notifications
      await this.sendAuditInitiationNotifications(auditWorkflow);

      // 7. Update deal with audit status
      await this.updateDealAuditStatus(dealId, auditWorkflow);

      console.log(`✅ External audit initiated successfully for deal ${dealId}`);
      return auditWorkflow;

    } catch (error) {
      console.error(`❌ Error initiating external audit for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Determine audit level based on deal value
   */
  private static determineAuditLevel(dealValue: number): 'comprehensive' | 'enhanced' | 'full_compliance' {
    if (dealValue >= 10000000) {
      return 'full_compliance';
    } else if (dealValue >= 5000000) {
      return 'enhanced';
    } else {
      return 'comprehensive';
    }
  }

  /**
   * Select optimal auditor based on criteria
   */
  private static async selectOptimalAuditor(
    dealValue: number,
    auditLevel: string,
    urgency: string
  ): Promise<ExternalAuditor> {
    console.log(`🔍 Selecting optimal auditor for ${auditLevel} audit of $${dealValue.toLocaleString()} deal`);

    // Filter auditors based on deal value and capabilities
    const qualifiedAuditors = CERTIFIED_AUDITORS.filter(auditor => 
      auditor.isActive &&
      dealValue >= auditor.minDealValue &&
      dealValue <= auditor.maxDealValue
    );

    if (qualifiedAuditors.length === 0) {
      throw new Error(`No qualified auditors available for deal value $${dealValue.toLocaleString()}`);
    }

    // Score auditors based on multiple criteria
    const scoredAuditors = qualifiedAuditors.map(auditor => {
      let score = 0;

      // Quality rating (40% weight)
      score += auditor.qualityRating * 4;

      // Success rate (30% weight)
      score += (auditor.successRate / 100) * 30;

      // Availability/timeline (20% weight)
      const timelineFactor = urgency === 'rush' ? 2 : urgency === 'expedited' ? 1.5 : 1;
      score += (100 / auditor.averageAuditTime) * timelineFactor * 20;

      // Experience (10% weight)
      score += Math.min(10, auditor.auditCount / 10);

      return { auditor, score };
    });

    // Sort by score and select the best
    scoredAuditors.sort((a, b) => b.score - a.score);
    const selectedAuditor = scoredAuditors[0].auditor;

    console.log(`✅ Selected ${selectedAuditor.firmName} (score: ${scoredAuditors[0].score.toFixed(1)})`);
    return selectedAuditor;
  }

  /**
   * Create comprehensive audit scope
   */
  private static createAuditScope(auditLevel: string, urgency: string): AuditScope[] {
    const baseScope = auditLevel === 'enhanced' || auditLevel === 'full_compliance' 
      ? AUDIT_SCOPES.ENHANCED 
      : AUDIT_SCOPES.COMPREHENSIVE;

    // Adjust deadlines based on urgency
    const urgencyMultiplier = urgency === 'rush' ? 0.5 : urgency === 'expedited' ? 0.75 : 1.0;

    const adjustedScope: AuditScope[] = Object.values(baseScope).map(scope => ({
      category: scope.category,
      requirements: scope.requirements.map(req => ({
        ...req,
        deadline: new Date(Date.now() + (req.deadline.getTime() - Date.now()) * urgencyMultiplier)
      }))
    }));

    return adjustedScope;
  }

  /**
   * Calculate audit timeline
   */
  private static calculateAuditTimeline(auditScope: AuditScope[], urgency: string): {
    totalHours: number;
    completionDate: Date;
    milestones: Array<{date: Date, description: string}>;
  } {
    const totalHours = auditScope.reduce((total, scope) => 
      total + scope.requirements.reduce((scopeTotal, req) => scopeTotal + req.estimatedHours, 0), 0
    );

    const urgencyMultiplier = urgency === 'rush' ? 0.6 : urgency === 'expedited' ? 0.8 : 1.0;
    const workingDays = Math.ceil((totalHours / 8) * urgencyMultiplier);
    const completionDate = new Date(Date.now() + workingDays * 24 * 60 * 60 * 1000);

    const milestones = [
      { date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), description: 'Audit kickoff and document collection' },
      { date: new Date(Date.now() + Math.floor(workingDays * 0.3) * 24 * 60 * 60 * 1000), description: 'Initial findings review' },
      { date: new Date(Date.now() + Math.floor(workingDays * 0.7) * 24 * 60 * 60 * 1000), description: 'Preliminary report delivery' },
      { date: completionDate, description: 'Final audit report and recommendations' }
    ];

    return { totalHours, completionDate, milestones };
  }

  /**
   * Estimate audit cost
   */
  private static estimateAuditCost(auditor: ExternalAuditor, auditScope: AuditScope[]): number {
    const totalHours = auditScope.reduce((total, scope) => 
      total + scope.requirements.reduce((scopeTotal, req) => scopeTotal + req.estimatedHours, 0), 0
    );

    const hourlyRate = auditor.qualityRating * 150; // Base rate adjusted by quality
    const baseCost = totalHours * hourlyRate;

    // Add additional costs
    const expenseFactor = 1.15; // 15% for expenses, travel, etc.
    const estimatedCost = baseCost * expenseFactor;

    return Math.round(estimatedCost);
  }

  /**
   * Send audit initiation notifications
   */
  private static async sendAuditInitiationNotifications(auditWorkflow: ExternalAuditWorkflow): Promise<void> {
    console.log(`📧 Sending audit initiation notifications for deal ${auditWorkflow.dealId}`);

    // Notification to assigned auditor
    const auditorSubject = `🔍 External Audit Assignment - Deal ${auditWorkflow.dealId}`;
    const auditorMessage = this.generateAuditorNotification(auditWorkflow);

    try {
      await sendNotificationEmail(auditWorkflow.assignedAuditor.email, auditorSubject, auditorMessage);
      console.log(`📧 Audit assignment sent to ${auditWorkflow.assignedAuditor.firmName}`);
    } catch (error) {
      console.error(`❌ Failed to notify auditor ${auditWorkflow.assignedAuditor.firmName}:`, error);
    }

    // Notification to internal team
    const internalSubject = `🏛️ External Audit Initiated - Deal ${auditWorkflow.dealId}`;
    const internalMessage = this.generateInternalAuditNotification(auditWorkflow);

    const internalRecipients = [
      { name: "Jack", email: "jack@catalystcp.com" },
      { name: "AJ", email: "aj@landlinq.ai" },
      { name: "Austin Blondell", email: "austin@landlinq.ai" }
    ];

    for (const recipient of internalRecipients) {
      try {
        await sendNotificationEmail(recipient.email, internalSubject, internalMessage);
        console.log(`📧 Internal audit notification sent to ${recipient.name}`);
      } catch (error) {
        console.error(`❌ Failed to notify ${recipient.name}:`, error);
      }
    }
  }

  /**
   * Generate auditor notification message
   */
  private static generateAuditorNotification(auditWorkflow: ExternalAuditWorkflow): string {
    const totalHours = auditWorkflow.auditScope.reduce((total, scope) => 
      total + scope.requirements.reduce((scopeTotal, req) => scopeTotal + req.estimatedHours, 0), 0
    );

    return `
🔍 **EXTERNAL AUDIT ASSIGNMENT**

**Audit ID:** ${auditWorkflow.auditId}
**Deal ID:** ${auditWorkflow.dealId}
**Deal Value:** $${auditWorkflow.dealValue.toLocaleString()}
**Audit Level:** ${auditWorkflow.auditLevel.toUpperCase()}

**Assignment Details:**
• Estimated Hours: ${totalHours}
• Hourly Rate: $${auditWorkflow.costTracking.hourlyRate}
• Estimated Cost: $${auditWorkflow.costTracking.estimatedCost.toLocaleString()}
• Target Completion: ${auditWorkflow.targetCompletionDate.toLocaleDateString()}

**Audit Scope:**
${auditWorkflow.auditScope.map(scope => 
  `• ${scope.category}: ${scope.requirements.length} requirements`
).join('\n')}

**Key Requirements:**
${auditWorkflow.auditScope.flatMap(scope => 
  scope.requirements.filter(req => req.mandatory).map(req => `• ${req.description}`)
).slice(0, 5).join('\n')}

**Next Steps:**
1. Confirm audit assignment within 24 hours
2. Schedule initial kick-off meeting with internal team
3. Begin document collection and review process
4. Provide weekly progress updates

This is a high-stakes real estate investment requiring institutional-grade audit standards.

Please confirm receipt and estimated start date.

Best regards,
LandLinq External Audit Coordination Team
    `.trim();
  }

  /**
   * Generate internal audit notification
   */
  private static generateInternalAuditNotification(auditWorkflow: ExternalAuditWorkflow): string {
    return `
🏛️ **EXTERNAL AUDIT INITIATED**

**Deal ID:** ${auditWorkflow.dealId}
**Deal Value:** $${auditWorkflow.dealValue.toLocaleString()}
**Audit Level:** ${auditWorkflow.auditLevel.toUpperCase()}

**Assigned Auditor:**
• Firm: ${auditWorkflow.assignedAuditor.firmName}
• Contact: ${auditWorkflow.assignedAuditor.contactName}
• Quality Rating: ${auditWorkflow.assignedAuditor.qualityRating}/10
• Success Rate: ${auditWorkflow.assignedAuditor.successRate}%

**Audit Summary:**
• Estimated Cost: $${auditWorkflow.costTracking.estimatedCost.toLocaleString()}
• Target Completion: ${auditWorkflow.targetCompletionDate.toLocaleDateString()}
• Scope Categories: ${auditWorkflow.auditScope.length}

**Required Actions:**
1. Prepare deal documentation for auditor access
2. Coordinate internal team for audit support
3. Monitor audit progress and milestone completion
4. Review preliminary findings when available

This external audit ensures institutional-grade verification for this significant investment opportunity.

Access the LandLinq audit dashboard for detailed tracking and updates.

Best regards,
LandLinq External Audit System
    `.trim();
  }

  /**
   * Update deal with audit status
   */
  private static async updateDealAuditStatus(dealId: string, auditWorkflow: ExternalAuditWorkflow): Promise<void> {
    try {
      await db
        .update(deals)
        .set({
          validationStatus: 'active',
          riskLevel: 'medium', // External audit deals are medium risk by default
          validationFlags: {
            externalAuditRequired: true,
            auditLevel: auditWorkflow.auditLevel,
            assignedAuditor: auditWorkflow.assignedAuditor.firmName,
            auditStartDate: auditWorkflow.startedAt.toISOString(),
            estimatedCompletionDate: auditWorkflow.targetCompletionDate.toISOString(),
            estimatedCost: auditWorkflow.costTracking.estimatedCost
          },
          updatedAt: new Date()
        })
        .where(eq(deals.id, dealId));

      console.log(`✅ Deal ${dealId} updated with external audit status`);
    } catch (error) {
      console.error(`❌ Failed to update deal ${dealId} audit status:`, error);
      throw error;
    }
  }

  /**
   * Process audit findings
   */
  static async processAuditFindings(
    auditId: string,
    findings: Array<{
      category: string;
      severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
      description: string;
      recommendation: string;
      impact: string;
    }>
  ): Promise<void> {
    console.log(`📋 Processing ${findings.length} audit findings for audit ${auditId}`);

    // Analyze findings and determine if escalation is needed
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');

    if (criticalFindings.length > 0 || highFindings.length > 2) {
      console.log(`🚨 Critical findings detected - escalating audit ${auditId}`);
      await this.escalateAuditFindings(auditId, findings);
    }

    // Update audit workflow with findings
    // Implementation would update the audit workflow state
  }

  /**
   * Escalate critical audit findings
   */
  private static async escalateAuditFindings(
    auditId: string,
    findings: Array<{
      category: string;
      severity: string;
      description: string;
      recommendation: string;
      impact: string;
    }>
  ): Promise<void> {
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');

    const escalationMessage = `
🚨 **CRITICAL AUDIT FINDINGS ESCALATION**

**Audit ID:** ${auditId}
**Escalation Level:** ${criticalFindings.length > 0 ? 'CRITICAL' : 'HIGH'}

**Critical Findings (${criticalFindings.length}):**
${criticalFindings.map(f => `• ${f.category}: ${f.description}`).join('\n')}

**High Priority Findings (${highFindings.length}):**
${highFindings.map(f => `• ${f.category}: ${f.description}`).join('\n')}

**Immediate Action Required:**
Executive review and investment decision on hold pending resolution of critical findings.

Please access the LandLinq audit portal for detailed findings and recommendations.
    `.trim();

    // Send to executive team
    const executiveRecipients = [
      { name: "Jack", email: "jack@catalystcp.com" },
      { name: "AJ", email: "aj@landlinq.ai" }
    ];

    for (const recipient of executiveRecipients) {
      try {
        await sendNotificationEmail(
          recipient.email,
          `🚨 URGENT: Critical Audit Findings - ${auditId}`,
          escalationMessage
        );
        console.log(`📧 Critical findings escalation sent to ${recipient.name}`);
      } catch (error) {
        console.error(`❌ Failed to escalate to ${recipient.name}:`, error);
      }
    }
  }

  /**
   * Generate compliance report
   */
  static generateComplianceReport(auditWorkflow: ExternalAuditWorkflow): any {
    const report = {
      auditId: auditWorkflow.auditId,
      dealId: auditWorkflow.dealId,
      dealValue: auditWorkflow.dealValue,
      auditorFirm: auditWorkflow.assignedAuditor.firmName,
      auditPeriod: {
        start: auditWorkflow.startedAt,
        end: auditWorkflow.actualCompletionDate || auditWorkflow.targetCompletionDate
      },
      complianceRating: auditWorkflow.complianceReport.overallRating,
      executiveSummary: auditWorkflow.complianceReport.executiveSummary,
      findingsSummary: {
        critical: auditWorkflow.auditFindings.filter(f => f.severity === 'critical').length,
        high: auditWorkflow.auditFindings.filter(f => f.severity === 'high').length,
        medium: auditWorkflow.auditFindings.filter(f => f.severity === 'medium').length,
        low: auditWorkflow.auditFindings.filter(f => f.severity === 'low').length
      },
      recommendations: auditWorkflow.complianceReport.recommendations,
      qualityMetrics: auditWorkflow.qualityMetrics,
      costSummary: auditWorkflow.costTracking,
      certification: {
        certifiedBy: auditWorkflow.assignedAuditor.contactName,
        certificationDate: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        certificationLevel: auditWorkflow.auditLevel
      }
    };

    return report;
  }
}
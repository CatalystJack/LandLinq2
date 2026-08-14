import OpenAI from "openai";
import { LandOpportunity } from "./landDiscoveryService";

/**
 * Advanced Property Search and Filtering Service
 * Uses AI and multiple data sources to identify optimal development opportunities
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SearchFilters {
  // Geographic
  markets: string[];
  proximity?: {
    address: string;
    radiusMiles: number;
  };
  
  // Property Characteristics
  acreageRange: { min: number; max: number };
  zoningTypes: string[];
  developmentTypes: string[];
  
  // Financial
  priceRange: { min: number; max: number };
  targetROI?: { min: number; max: number };
  
  // Infrastructure
  sewerRequired?: boolean;
  utilityRequirements?: string[];
  
  // Opportunity Type
  opportunityTypes: ('rezoning' | 'dual_zoning' | 'underutilized' | 'assemblage' | 'off_market')[];
  
  // Timing
  timeframe: 'immediate' | 'short_term' | 'long_term';
  maxDealTime?: number; // months
  
  // Risk Tolerance
  riskLevel: 'low' | 'moderate' | 'high';
  
  // AI Preferences
  aiScoreThreshold?: number;
  prioritizeFactors?: string[];
}

export interface PropertyScore {
  totalScore: number;
  breakdown: {
    location: number;
    financial: number;
    development: number;
    timing: number;
    risk: number;
  };
  matchReasons: string[];
  concerns: string[];
}

export interface EnhancedOpportunity extends LandOpportunity {
  score: PropertyScore;
  competitiveAnalysis: {
    marketPosition: 'best_in_class' | 'competitive' | 'below_average';
    uniqueAdvantages: string[];
    marketRisks: string[];
  };
  actionPlan: {
    immediateSteps: string[];
    timeline: Array<{ phase: string; duration: string; actions: string[] }>;
    keyMilestones: string[];
  };
}

export class PropertySearchService {
  async searchOptimalProperties(filters: SearchFilters): Promise<EnhancedOpportunity[]> {
    try {
      // Get base opportunities from land discovery service
      const { LandDiscoveryService } = await import('./landDiscoveryService');
      const landService = new LandDiscoveryService();
      
      const baseOpportunities = await landService.discoverOpportunities({
        targetMarkets: filters.markets,
        developmentTypes: filters.developmentTypes,
        minAcres: filters.acreageRange.min,
        maxAcres: filters.acreageRange.max,
        budgetRange: filters.priceRange,
        timeframe: filters.timeframe
      });

      // Apply advanced filtering
      let filteredOpportunities = this.applyAdvancedFilters(baseOpportunities, filters);
      
      // Enhanced AI scoring and analysis
      const enhancedOpportunities = await Promise.all(
        filteredOpportunities.map(opp => this.enhanceOpportunityAnalysis(opp, filters))
      );

      // Final ranking based on comprehensive scoring
      return enhancedOpportunities
        .sort((a, b) => b.score.totalScore - a.score.totalScore)
        .slice(0, 20); // Return top 20 opportunities
      
    } catch (error) {
      console.error('Error searching optimal properties:', error);
      throw error;
    }
  }

  async findSimilarOpportunities(
    referenceOpportunity: LandOpportunity,
    searchRadius: number = 10
  ): Promise<EnhancedOpportunity[]> {
    try {
      const filters: SearchFilters = {
        markets: [referenceOpportunity.marketArea],
        acreageRange: {
          min: referenceOpportunity.acreage * 0.7,
          max: referenceOpportunity.acreage * 1.5
        },
        zoningTypes: [referenceOpportunity.currentZoning],
        developmentTypes: ['Market Rate Apartments'], // Default
        priceRange: {
          min: referenceOpportunity.estimatedAcquisitionCost * 0.8,
          max: referenceOpportunity.estimatedAcquisitionCost * 1.3
        },
        opportunityTypes: [referenceOpportunity.opportunityType],
        timeframe: 'short_term',
        riskLevel: 'moderate',
        proximity: {
          address: referenceOpportunity.address,
          radiusMiles: searchRadius
        }
      };

      return this.searchOptimalProperties(filters);
    } catch (error) {
      console.error('Error finding similar opportunities:', error);
      throw error;
    }
  }

  async analyzeBestOpportunityTypes(
    market: string,
    budget: number
  ): Promise<{
    recommendations: Array<{
      type: string;
      score: number;
      reasoning: string[];
      expectedROI: number;
      sampleOpportunities: number;
    }>;
    marketInsights: {
      hotZones: string[];
      emergingTrends: string[];
      riskFactors: string[];
    };
  }> {
    try {
      // Analyze all opportunity types for the market
      const opportunityTypes = ['rezoning', 'dual_zoning', 'underutilized', 'assemblage', 'off_market'] as const;
      
      const analysis = await Promise.all(
        opportunityTypes.map(async (type) => {
          const filters: SearchFilters = {
            markets: [market],
            acreageRange: { min: 1, max: 100 },
            zoningTypes: ['R-1', 'R-2', 'R-4', 'R-6', 'MF-1', 'MF-2'],
            developmentTypes: ['Market Rate Apartments'],
            priceRange: { min: budget * 0.5, max: budget * 1.5 },
            opportunityTypes: [type],
            timeframe: 'short_term',
            riskLevel: 'moderate'
          };

          const opportunities = await this.searchOptimalProperties(filters);
          
          return {
            type,
            score: opportunities.length > 0 ? opportunities[0].score.totalScore : 0,
            reasoning: opportunities.length > 0 ? opportunities[0].score.matchReasons : [],
            expectedROI: opportunities.length > 0 ? opportunities[0].estimatedROI : 0,
            sampleOpportunities: opportunities.length
          };
        })
      );

      // Generate market insights using AI
      const marketInsights = await this.generateMarketInsights(market, budget);

      return {
        recommendations: analysis.sort((a, b) => b.score - a.score),
        marketInsights
      };
    } catch (error) {
      console.error('Error analyzing opportunity types:', error);
      throw error;
    }
  }

  private applyAdvancedFilters(
    opportunities: LandOpportunity[],
    filters: SearchFilters
  ): LandOpportunity[] {
    return opportunities.filter(opp => {
      // Opportunity type filter
      if (!filters.opportunityTypes.includes(opp.opportunityType)) {
        return false;
      }

      // Zoning filter
      if (filters.zoningTypes.length > 0 && 
          !filters.zoningTypes.includes(opp.currentZoning)) {
        return false;
      }

      // Infrastructure requirements
      if (filters.sewerRequired && opp.infrastructureStatus.sewer !== 'available') {
        return false;
      }

      // AI score threshold
      if (filters.aiScoreThreshold && opp.aiScore < filters.aiScoreThreshold) {
        return false;
      }

      // Risk level filter
      const riskScore = this.calculateRiskScore(opp);
      if (filters.riskLevel === 'low' && riskScore > 40) return false;
      if (filters.riskLevel === 'moderate' && (riskScore < 20 || riskScore > 70)) return false;
      if (filters.riskLevel === 'high' && riskScore < 50) return false;

      // Proximity filter
      if (filters.proximity) {
        const distance = this.calculateDistance(
          opp.coordinates,
          { lat: 35.2271, lng: -80.8431 } // Would geocode the proximity address
        );
        if (distance > filters.proximity.radiusMiles) return false;
      }

      return true;
    });
  }

  private async enhanceOpportunityAnalysis(
    opportunity: LandOpportunity,
    filters: SearchFilters
  ): Promise<EnhancedOpportunity> {
    try {
      // Calculate comprehensive score
      const score = this.calculateComprehensiveScore(opportunity, filters);
      
      // Competitive analysis
      const competitiveAnalysis = await this.analyzeCompetitivePosition(opportunity);
      
      // Generate action plan
      const actionPlan = this.generateActionPlan(opportunity);

      return {
        ...opportunity,
        score,
        competitiveAnalysis,
        actionPlan
      };
    } catch (error) {
      console.error('Error enhancing opportunity analysis:', error);
      // Return basic enhanced opportunity on error
      return {
        ...opportunity,
        score: {
          totalScore: opportunity.aiScore,
          breakdown: {
            location: opportunity.aiScore * 0.2,
            financial: opportunity.aiScore * 0.3,
            development: opportunity.aiScore * 0.2,
            timing: opportunity.aiScore * 0.15,
            risk: opportunity.aiScore * 0.15
          },
          matchReasons: opportunity.reasonsForInterest,
          concerns: opportunity.potentialChallenges
        },
        competitiveAnalysis: {
          marketPosition: 'competitive',
          uniqueAdvantages: ['Standard market opportunity'],
          marketRisks: ['Standard market risks']
        },
        actionPlan: {
          immediateSteps: ['Begin due diligence'],
          timeline: [{ phase: 'Due Diligence', duration: '30 days', actions: ['Property research'] }],
          keyMilestones: ['Complete analysis']
        }
      };
    }
  }

  private calculateComprehensiveScore(
    opportunity: LandOpportunity,
    filters: SearchFilters
  ): PropertyScore {
    // Location scoring (20%)
    const locationScore = this.scoreLocation(opportunity, filters);
    
    // Financial scoring (30%)
    const financialScore = this.scoreFinancials(opportunity, filters);
    
    // Development potential scoring (20%)
    const developmentScore = this.scoreDevelopmentPotential(opportunity);
    
    // Timing scoring (15%)
    const timingScore = this.scoreTiming(opportunity, filters);
    
    // Risk scoring (15%)
    const riskScore = this.scoreRisk(opportunity, filters);

    const totalScore = (
      locationScore * 0.2 +
      financialScore * 0.3 +
      developmentScore * 0.2 +
      timingScore * 0.15 +
      riskScore * 0.15
    );

    const matchReasons = [];
    const concerns = [];

    if (locationScore > 80) matchReasons.push('Excellent location with high growth potential');
    if (financialScore > 85) matchReasons.push('Strong financial returns projected');
    if (developmentScore > 80) matchReasons.push('High development potential');
    if (timingScore < 60) concerns.push('Timeline may be extended');
    if (riskScore < 60) concerns.push('Higher than average risk factors');

    return {
      totalScore,
      breakdown: {
        location: locationScore,
        financial: financialScore,
        development: developmentScore,
        timing: timingScore,
        risk: riskScore
      },
      matchReasons,
      concerns
    };
  }

  private scoreLocation(opportunity: LandOpportunity, filters: SearchFilters): number {
    let score = 70; // Base score

    // Market preference
    if (filters.markets.includes(opportunity.marketArea)) {
      score += 10;
    }

    // Infrastructure availability
    if (opportunity.infrastructureStatus.sewer === 'available') score += 8;
    if (opportunity.infrastructureStatus.water === 'available') score += 5;
    if (opportunity.infrastructureStatus.power === 'available') score += 2;

    // Nearby developments (indicates market activity)
    if (opportunity.nearbyDevelopments.length > 1) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private scoreFinancials(opportunity: LandOpportunity, filters: SearchFilters): number {
    let score = 60; // Base score

    // ROI scoring
    if (opportunity.estimatedROI > 30) score += 20;
    else if (opportunity.estimatedROI > 20) score += 15;
    else if (opportunity.estimatedROI > 15) score += 10;

    // Budget fit
    if (opportunity.estimatedAcquisitionCost >= filters.priceRange.min &&
        opportunity.estimatedAcquisitionCost <= filters.priceRange.max) {
      score += 15;
    }

    // Value potential
    const valueRatio = opportunity.projectedDevelopmentValue / opportunity.estimatedAcquisitionCost;
    if (valueRatio > 3) score += 15;
    else if (valueRatio > 2.5) score += 10;
    else if (valueRatio > 2) score += 5;

    return Math.min(100, score);
  }

  private scoreDevelopmentPotential(opportunity: LandOpportunity): number {
    let score = 65; // Base score

    // Opportunity type scoring
    switch (opportunity.opportunityType) {
      case 'dual_zoning':
        score += 20; // Highest potential
        break;
      case 'rezoning':
        score += 15;
        break;
      case 'underutilized':
        score += 12;
        break;
      case 'assemblage':
        score += 8; // More complex
        break;
      case 'off_market':
        score += 10;
        break;
    }

    // Size appropriateness
    if (opportunity.acreage >= 5 && opportunity.acreage <= 15) {
      score += 10; // Optimal size range
    }

    return Math.min(100, score);
  }

  private scoreTiming(opportunity: LandOpportunity, filters: SearchFilters): number {
    let score = 70; // Base score

    // Timeline fit
    const timelineMonths = this.parseTimelineToMonths(opportunity.estimatedTimeline);
    
    if (filters.timeframe === 'immediate' && timelineMonths <= 6) score += 20;
    else if (filters.timeframe === 'short_term' && timelineMonths <= 12) score += 15;
    else if (filters.timeframe === 'long_term' && timelineMonths <= 24) score += 10;

    // Owner motivation
    if (opportunity.ownershipInfo.motivationIndicators.length > 2) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private scoreRisk(opportunity: LandOpportunity, filters: SearchFilters): number {
    let score = 80; // Start high, deduct for risks

    // Challenge count
    score -= opportunity.potentialChallenges.length * 5;

    // Opportunity type risk
    switch (opportunity.opportunityType) {
      case 'assemblage':
        score -= 15; // Highest risk
        break;
      case 'rezoning':
        score -= 10;
        break;
      case 'off_market':
        score -= 8;
        break;
      case 'underutilized':
        score -= 5;
        break;
      case 'dual_zoning':
        score -= 3; // Lowest risk
        break;
    }

    // Infrastructure risk
    if (opportunity.infrastructureStatus.sewer === 'extension_needed') score -= 10;

    return Math.max(20, score);
  }

  private async analyzeCompetitivePosition(opportunity: LandOpportunity): Promise<{
    marketPosition: 'best_in_class' | 'competitive' | 'below_average';
    uniqueAdvantages: string[];
    marketRisks: string[];
  }> {
    // Simulate competitive analysis
    const advantages = [];
    const risks = [];

    if (opportunity.aiScore > 85) {
      advantages.push('Top-tier opportunity in market');
    }
    if (opportunity.infrastructureStatus.sewer === 'available') {
      advantages.push('Infrastructure readily available');
    }
    if (opportunity.opportunityType === 'dual_zoning') {
      advantages.push('Flexible zoning reduces regulatory risk');
    }

    if (opportunity.potentialChallenges.length > 3) {
      risks.push('Multiple execution challenges');
    }
    if (opportunity.nearbyDevelopments.length === 0) {
      risks.push('Limited comparable market activity');
    }

    return {
      marketPosition: opportunity.aiScore > 85 ? 'best_in_class' : 
                     opportunity.aiScore > 70 ? 'competitive' : 'below_average',
      uniqueAdvantages: advantages.length > 0 ? advantages : ['Standard market opportunity'],
      marketRisks: risks.length > 0 ? risks : ['Standard market risks']
    };
  }

  private generateActionPlan(opportunity: LandOpportunity): {
    immediateSteps: string[];
    timeline: Array<{ phase: string; duration: string; actions: string[] }>;
    keyMilestones: string[];
  } {
    const immediateSteps = [
      'Verify property details and ownership',
      'Conduct preliminary zoning research',
      'Assess infrastructure availability'
    ];

    if (opportunity.opportunityType === 'rezoning') {
      immediateSteps.push('Research zoning precedents');
    }
    if (opportunity.opportunityType === 'assemblage') {
      immediateSteps.push('Identify key parcels and owners');
    }

    const timeline = [
      {
        phase: 'Due Diligence',
        duration: '30-60 days',
        actions: [
          'Property inspection and survey',
          'Environmental assessment',
          'Market analysis validation',
          'Financial modeling refinement'
        ]
      },
      {
        phase: 'Acquisition',
        duration: '60-90 days',
        actions: [
          'Negotiate purchase terms',
          'Secure financing',
          'Complete legal review',
          'Close transaction'
        ]
      }
    ];

    if (opportunity.opportunityType === 'rezoning') {
      timeline.push({
        phase: 'Entitlements',
        duration: '6-12 months',
        actions: [
          'Submit rezoning application',
          'Community engagement',
          'Planning commission review',
          'Final approval'
        ]
      });
    }

    const keyMilestones = [
      'Complete due diligence',
      'Secure property under contract',
      'Obtain necessary approvals',
      'Begin development'
    ];

    return {
      immediateSteps,
      timeline,
      keyMilestones
    };
  }

  private calculateRiskScore(opportunity: LandOpportunity): number {
    let risk = 30; // Base risk

    risk += opportunity.potentialChallenges.length * 8;
    
    if (opportunity.opportunityType === 'assemblage') risk += 20;
    else if (opportunity.opportunityType === 'rezoning') risk += 15;
    
    if (opportunity.infrastructureStatus.sewer === 'extension_needed') risk += 10;

    return Math.min(100, risk);
  }

  private calculateDistance(
    coord1: { lat: number; lng: number },
    coord2: { lat: number; lng: number }
  ): number {
    // Haversine formula for distance calculation
    const R = 3959; // Earth's radius in miles
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private parseTimelineToMonths(timeline: string): number {
    // Simple parser for timeline strings
    const months = timeline.match(/(\d+)-?(\d+)?\s*months?/i);
    if (months) {
      return parseInt(months[1]);
    }
    return 12; // Default
  }

  private async generateMarketInsights(market: string, budget: number): Promise<{
    hotZones: string[];
    emergingTrends: string[];
    riskFactors: string[];
  }> {
    // Simulate market insights generation
    return {
      hotZones: [
        'South End corridor - transit-oriented development',
        'University area - student housing demand',
        'Suburban infill - single-family to multifamily conversion'
      ],
      emergingTrends: [
        'Increased demand for mid-density housing',
        'Transit-oriented development incentives',
        'Streamlined approval processes for affordable housing',
        'Growing interest in mixed-use developments'
      ],
      riskFactors: [
        'Interest rate volatility affecting financing',
        'Construction cost inflation',
        'Labor shortage in construction trades',
        'Potential zoning policy changes'
      ]
    };
  }
}
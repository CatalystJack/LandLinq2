import type { DealScore } from "./dealScoringService";

export interface DealInsights {
  // Strategic Analysis
  investmentStrategy: {
    recommendation: 'immediate_action' | 'watch_closely' | 'proceed_cautiously' | 'pass';
    reasoning: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    confidence: number; // 0-1
  };
  
  // Market Intelligence
  marketPosition: {
    competitiveAdvantage: string[];
    marketRisks: string[];
    timingFactors: string[];
    demandIndicators: {
      score: number; // 0-10
      factors: string[];
    };
  };
  
  // Financial Intelligence
  financialInsights: {
    valueCreationOpportunities: string[];
    costOptimizations: string[];
    revenueUpside: string[];
    riskMitigations: string[];
    expectedOutcomes: {
      bestCase: { roi: number; timeline: string; description: string };
      mostLikely: { roi: number; timeline: string; description: string };
      worstCase: { roi: number; timeline: string; description: string };
    };
  };
  
  // Operational Intelligence  
  executionInsights: {
    criticalPath: string[];
    potentialObstacles: string[];
    successFactors: string[];
    phaseRecommendations: {
      phase: string;
      timeline: string;
      keyActions: string[];
      risks: string[];
    }[];
  };
  
  // Comparative Analysis
  benchmarking: {
    similarDeals: string[];
    marketComparables: {
      metric: string;
      dealValue: number | string;
      marketAverage: number | string;
      percentile: number;
      insight: string;
    }[];
    competitivePosition: 'market_leader' | 'above_average' | 'average' | 'below_average';
  };
}

export class DealInsightsEngine {
  
  // Generate comprehensive insights for a deal
  generateInsights(deal: any, score: DealScore): DealInsights {
    return {
      investmentStrategy: this.analyzeInvestmentStrategy(deal, score),
      marketPosition: this.analyzeMarketPosition(deal, score),
      financialInsights: this.analyzeFinancialInsights(deal, score),
      executionInsights: this.analyzeExecutionInsights(deal, score),
      benchmarking: this.analyzeBenchmarking(deal, score)
    };
  }
  
  private analyzeInvestmentStrategy(deal: any, score: DealScore) {
    const totalScore = score.totalScore;
    const classification = score.classification;
    const grade = score.grade;
    
    let recommendation: DealInsights['investmentStrategy']['recommendation'];
    let reasoning: string;
    let priority: DealInsights['investmentStrategy']['priority'];
    let confidence: number;
    
    // Determine recommendation based on score and key factors
    if (totalScore >= 85 && classification === 'green') {
      recommendation = 'immediate_action';
      priority = 'critical';
      confidence = 0.9;
      reasoning = `Exceptional opportunity scoring ${totalScore}/100 with grade ${grade}. Strong fundamentals across all categories justify immediate pursuit.`;
    } else if (totalScore >= 75 && classification === 'green') {
      recommendation = 'immediate_action';
      priority = 'high';
      confidence = 0.8;
      reasoning = `Strong opportunity with ${totalScore}/100 score. Good fundamentals with some optimization potential.`;
    } else if (totalScore >= 70 && (classification === 'unclassified' || classification === 'yellow')) {
      recommendation = 'manual_review_required';
      priority = 'medium';
      confidence = 0.5;
      reasoning = `Deal requires manual analyst review. Score of ${totalScore}/100 - automatic classification disabled per user requirement.`;
    } else if (totalScore >= 60 && (classification === 'unclassified' || classification === 'yellow')) {
      recommendation = 'manual_review_required';
      priority = 'low';
      confidence = 0.5;
      reasoning = `Deal requires manual analyst review. Score of ${totalScore}/100 - automatic classification disabled per user requirement.`;
    } else {
      recommendation = 'pass';
      priority = 'low';
      confidence = 0.8;
      reasoning = `Poor fundamentals with score of ${totalScore}/100. Multiple red flags indicate high risk of poor returns.`;
    }
    
    // Adjust based on specific red flags
    if (score.redFlags.some(flag => flag.includes('size below minimum'))) {
      recommendation = 'pass';
      reasoning += ' Critical issue: Property size below development threshold.';
      confidence = Math.min(confidence, 0.9);
    }
    
    if (score.redFlags.some(flag => flag.includes('ROI below target'))) {
      if (recommendation === 'immediate_action') {
        recommendation = 'proceed_cautiously';
        priority = 'medium';
      }
      reasoning += ' Financial returns below target thresholds.';
    }
    
    return { recommendation, reasoning, priority, confidence };
  }
  
  private analyzeMarketPosition(deal: any, score: DealScore) {
    const competitiveAdvantage: string[] = [];
    const marketRisks: string[] = [];
    const timingFactors: string[] = [];
    const demandFactors: string[] = [];
    
    // Analyze location advantages
    const locationScore = score.breakdown.locationMarket.components.location.score;
    if (locationScore >= 12) {
      competitiveAdvantage.push('Prime location with strong demographic fundamentals');
      demandFactors.push('High-demand location with sustained growth prospects');
    } else if (locationScore <= 8) {
      marketRisks.push('Suboptimal location may limit growth potential and exit options');
    }
    
    // Market cycle analysis
    const address = deal.address?.toLowerCase() || '';
    const marketScore = score.breakdown.locationMarket.components.market.score;
    
    if (marketScore >= 8) {
      timingFactors.push('Strong market fundamentals support immediate development');
      demandFactors.push('Market showing positive absorption and rent growth');
    } else if (marketScore <= 5) {
      marketRisks.push('Weak market conditions may extend lease-up periods');
      timingFactors.push('Consider delaying development until market improves');
    }
    
    // Texas market advantages
    const majorTexasMarkets = ['dallas', 'austin', 'houston', 'san antonio'];
    if (majorTexasMarkets.some(market => address.includes(market))) {
      competitiveAdvantage.push('Located in major Texas growth market with business-friendly environment');
      demandFactors.push('Benefiting from Texas population and job growth trends');
    }
    
    // Premium area analysis
    const premiumAreas = ['the woodlands', 'plano', 'frisco', 'southlake', 'westlake'];
    if (premiumAreas.some(area => address.includes(area))) {
      competitiveAdvantage.push('Premium submarket with affluent demographics and limited supply');
      demandFactors.push('High barrier to entry market with strong pricing power');
    }
    
    // Calculate demand score
    let demandScore = 5; // Base score
    if (locationScore >= 12) demandScore += 2;
    if (marketScore >= 8) demandScore += 2;
    if (deal.population55Plus5Mile > 50000) demandScore += 1;
    demandScore = Math.min(10, demandScore);
    
    return {
      competitiveAdvantage,
      marketRisks,
      timingFactors,
      demandIndicators: {
        score: demandScore,
        factors: demandFactors
      }
    };
  }
  
  private analyzeFinancialInsights(deal: any, score: DealScore) {
    const valueCreationOpportunities: string[] = [];
    const costOptimizations: string[] = [];
    const revenueUpside: string[] = [];
    const riskMitigations: string[] = [];
    
    // Pricing analysis
    const pricingScore = score.breakdown.financial.components.pricing.score;
    if (pricingScore >= 12) {
      valueCreationOpportunities.push('Excellent entry pricing creates immediate equity upside');
      valueCreationOpportunities.push('Below-market acquisition cost provides development margin buffer');
    } else if (pricingScore <= 8) {
      costOptimizations.push('Negotiate asking price to improve project economics');
      riskMitigations.push('Implement value engineering to offset higher land cost');
    }
    
    // Revenue optimization
    const rentScore = score.breakdown.financial.components.rentability.score;
    if (rentScore >= 8) {
      revenueUpside.push('Strong rent-to-cost ratio supports premium rental strategies');
      revenueUpside.push('Consider ancillary revenue streams (parking, storage, amenities)');
    }
    
    // Utility cost analysis
    const utilitiesScore = score.breakdown.property.components.utilities.score;
    if (!deal.sewerAvailable) {
      costOptimizations.push('Explore shared septic systems to reduce per-unit infrastructure cost');
      riskMitigations.push('Include utility connection contingencies in development budget');
    } else {
      costOptimizations.push('Municipal utilities available - reduces development cost and risk');
    }
    
    // Size optimization
    const sizeScore = score.breakdown.property.components.size.score;
    const sizeAcres = parseFloat(deal.sizeAcres) || 0;
    if (sizeScore >= 7) {
      valueCreationOpportunities.push('Optimal size allows for efficient development and management');
      if (sizeAcres >= 15) {
        revenueUpside.push('Large site enables phased development to capture market timing');
      }
    }
    
    // Generate outcome scenarios
    const askingPrice = parseFloat(deal.askingPrice) || 0;
    const baseROI = 0.06; // 6% base assumption
    
    const expectedOutcomes = {
      bestCase: {
        roi: baseROI + 0.04, // 10%
        timeline: '18-24 months',
        description: 'Optimal execution with favorable market conditions and cost controls'
      },
      mostLikely: {
        roi: baseROI + 0.01, // 7%
        timeline: '24-30 months', 
        description: 'Standard development timeline with market-rate performance'
      },
      worstCase: {
        roi: baseROI - 0.02, // 4%
        timeline: '36+ months',
        description: 'Extended timeline with market headwinds and cost overruns'
      }
    };
    
    return {
      valueCreationOpportunities,
      costOptimizations,
      revenueUpside,
      riskMitigations,
      expectedOutcomes
    };
  }
  
  private analyzeExecutionInsights(deal: any, score: DealScore) {
    const criticalPath: string[] = [];
    const potentialObstacles: string[] = [];
    const successFactors: string[] = [];
    
    // Zoning and entitlements
    const zoningScore = score.breakdown.property.components.zoning.score;
    const entitlementsScore = score.breakdown.property.components.entitlements.score;
    
    if (entitlementsScore >= 4) {
      successFactors.push('Development entitlements in place - reduces approval risk and timeline');
      criticalPath.push('Validate entitlements and begin detailed design (Months 1-2)');
    } else {
      criticalPath.push('Secure necessary zoning approvals and entitlements (Months 1-6)');
      potentialObstacles.push('Entitlement process may extend timeline and increase costs');
    }
    
    if (zoningScore <= 4) {
      potentialObstacles.push('Zoning challenges may require variance applications or rezoning');
      criticalPath.push('Address zoning compliance issues before proceeding');
    }
    
    // Utilities and infrastructure
    const utilitiesScore = score.breakdown.property.components.utilities.score;
    if (deal.sewerAvailable) {
      successFactors.push('Municipal sewer connection available - standard utility hookup');
      criticalPath.push('Coordinate utility connections during site preparation');
    } else {
      potentialObstacles.push('Septic system requirements increase complexity and cost');
      criticalPath.push('Design and permit septic system - adds 2-3 months to timeline');
    }
    
    // Market timing
    const marketScore = score.breakdown.locationMarket.components.market.score;
    if (marketScore >= 8) {
      successFactors.push('Strong market fundamentals support absorption and pricing');
    } else {
      potentialObstacles.push('Weak market conditions may impact lease-up velocity');
    }
    
    // Phased development plan
    const sizeAcres = parseFloat(deal.sizeAcres) || 0;
    const phaseRecommendations = [];
    
    if (sizeAcres >= 15) {
      phaseRecommendations.push({
        phase: 'Phase 1: Infrastructure & First Buildings',
        timeline: 'Months 1-18',
        keyActions: ['Site preparation', 'Utility installation', 'First 40% of units'],
        risks: ['Weather delays', 'Permitting delays', 'Material cost inflation']
      });
      
      phaseRecommendations.push({
        phase: 'Phase 2: Remaining Development',
        timeline: 'Months 12-30',
        keyActions: ['Complete buildout', 'Lease-up management', 'Final inspections'],
        risks: ['Market absorption risk', 'Construction quality issues', 'Lease-up velocity']
      });
    } else {
      phaseRecommendations.push({
        phase: 'Single Phase Development',
        timeline: 'Months 1-24',
        keyActions: ['Complete development', 'Lease-up', 'Stabilized operations'],
        risks: ['Market timing risk', 'Single-phase exposure', 'All-in execution risk']
      });
    }
    
    return {
      criticalPath,
      potentialObstacles,
      successFactors,
      phaseRecommendations
    };
  }
  
  private analyzeBenchmarking(deal: any, score: DealScore) {
    const askingPrice = parseFloat(deal.askingPrice) || 0;
    const sizeAcres = parseFloat(deal.sizeAcres) || 0;
    const pricePerAcre = askingPrice / sizeAcres || 0;
    
    const marketComparables = [];
    
    // Price per acre benchmarking
    const address = deal.address?.toLowerCase() || '';
    let marketBenchmark = 350000; // Default Dallas benchmark
    
    if (address.includes('austin')) marketBenchmark = 400000;
    else if (address.includes('houston')) marketBenchmark = 320000;
    else if (address.includes('san antonio')) marketBenchmark = 280000;
    
    const pricePercentile = pricePerAcre <= marketBenchmark * 0.8 ? 90 : 
                           pricePerAcre <= marketBenchmark ? 70 :
                           pricePerAcre <= marketBenchmark * 1.2 ? 50 : 25;
    
    marketComparables.push({
      metric: 'Price per Acre',
      dealValue: `$${pricePerAcre.toLocaleString()}`,
      marketAverage: `$${marketBenchmark.toLocaleString()}`,
      percentile: pricePercentile,
      insight: pricePercentile >= 70 ? 'Below market pricing provides value opportunity' :
               pricePercentile >= 50 ? 'Market-rate pricing' : 
               'Above-market pricing requires careful evaluation'
    });
    
    // Size benchmarking
    const sizePercentile = sizeAcres >= 20 ? 85 :
                          sizeAcres >= 10 ? 70 :
                          sizeAcres >= 5 ? 50 : 25;
    
    marketComparables.push({
      metric: 'Property Size',
      dealValue: `${sizeAcres} acres`,
      marketAverage: '8-15 acres',
      percentile: sizePercentile,
      insight: sizePercentile >= 70 ? 'Above-average size enables efficient development' :
               sizePercentile >= 50 ? 'Standard development size' :
               'Below-average size may limit efficiency'
    });
    
    // Demographics benchmarking
    const pop55Plus = deal.population55Plus5Mile || 0;
    const popPercentile = pop55Plus >= 60000 ? 90 :
                         pop55Plus >= 40000 ? 70 :
                         pop55Plus >= 25000 ? 50 : 25;
    
    marketComparables.push({
      metric: '55+ Population (5mi)',
      dealValue: pop55Plus.toLocaleString(),
      marketAverage: '35,000-45,000',
      percentile: popPercentile,
      insight: popPercentile >= 70 ? 'Strong target demographic concentration' :
               popPercentile >= 50 ? 'Adequate target market density' :
               'Below-average target demographic presence'
    });
    
    // Overall competitive position
    const avgPercentile = marketComparables.reduce((sum, comp) => sum + comp.percentile, 0) / marketComparables.length;
    const competitivePosition: 'market_leader' | 'above_average' | 'average' | 'below_average' = 
      avgPercentile >= 80 ? 'market_leader' :
      avgPercentile >= 65 ? 'above_average' :
      avgPercentile >= 45 ? 'average' : 'below_average';
    
    return {
      similarDeals: [
        'Austin BTR development - 12 acres, $4.2M, similar demographics',
        'Dallas mixed-use project - 15 acres, $5.8M, comparable location',
        'San Antonio senior living - 8 acres, $2.9M, target market overlap'
      ],
      marketComparables,
      competitivePosition
    };
  }
}

export const dealInsightsEngine = new DealInsightsEngine();
import type { Deal } from "@shared/schema";

// Scoring criteria weights (total should equal 100)
export const SCORING_WEIGHTS = {
  // Financial Metrics (35%)
  pricingScore: 15,        // Price vs market value
  rentabilityScore: 10,    // Rent potential vs asking price
  roiScore: 10,           // Return on investment potential
  
  // Location & Market (30%)
  locationScore: 15,       // Prime location, demographics
  marketScore: 10,         // Market growth, demand
  accessibilityScore: 5,   // Transportation, amenities
  
  // Property Characteristics (25%)
  sizeScore: 8,           // Optimal size for development
  zoningScore: 7,         // Zoning compliance
  utilitiesScore: 5,      // Infrastructure readiness
  entitlementsScore: 5,   // Development approvals
  
  // Risk & Execution (10%)
  brokerScore: 5,         // Broker track record
  timelineScore: 3,       // Development timeline
  regulatoryScore: 2      // Regulatory risks
};

export interface DealScore {
  totalScore: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  classification: 'green' | 'yellow' | 'red';
  breakdown: {
    financial: {
      score: number;
      maxScore: number;
      components: {
        pricing: { score: number; maxScore: number; details: string; };
        rentability: { score: number; maxScore: number; details: string; };
        roi: { score: number; maxScore: number; details: string; };
      };
    };
    locationMarket: {
      score: number;
      maxScore: number;
      components: {
        location: { score: number; maxScore: number; details: string; };
        market: { score: number; maxScore: number; details: string; };
        accessibility: { score: number; maxScore: number; details: string; };
      };
    };
    property: {
      score: number;
      maxScore: number;
      components: {
        size: { score: number; maxScore: number; details: string; };
        zoning: { score: number; maxScore: number; details: string; };
        utilities: { score: number; maxScore: number; details: string; };
        entitlements: { score: number; maxScore: number; details: string; };
      };
    };
    riskExecution: {
      score: number;
      maxScore: number;
      components: {
        broker: { score: number; maxScore: number; details: string; };
        timeline: { score: number; maxScore: number; details: string; };
        regulatory: { score: number; maxScore: number; details: string; };
      };
    };
  };
  recommendations: string[];
  redFlags: string[];
  strengths: string[];
}

export class DealScoringService {
  // Score pricing based on market comparables and asking price
  private scorePricing(deal: any): { score: number; details: string } {
    const askingPrice = parseFloat(deal.askingPrice) || 0;
    const sizeAcres = parseFloat(deal.sizeAcres) || 0;
    
    if (askingPrice === 0 || sizeAcres === 0) {
      return { score: 0, details: "Missing price or size data" };
    }
    
    const pricePerAcre = askingPrice / sizeAcres;
    
    // Target markets pricing benchmarks (price per acre)
    const pricingBenchmarks = {
      'dallas': { low: 200000, optimal: 350000, high: 500000 },
      'austin': { low: 250000, optimal: 400000, high: 600000 },
      'houston': { low: 180000, optimal: 320000, high: 450000 },
      'san_antonio': { low: 150000, optimal: 280000, high: 400000 }
    };
    
    // Determine market based on address or use default
    const address = deal.address?.toLowerCase() || '';
    let market = 'dallas'; // default
    
    if (address.includes('austin')) market = 'austin';
    else if (address.includes('houston')) market = 'houston';
    else if (address.includes('san antonio')) market = 'san_antonio';
    
    const benchmark = pricingBenchmarks[market as keyof typeof pricingBenchmarks];
    
    let score = 0;
    let details = '';
    
    if (pricePerAcre <= benchmark.optimal) {
      // Great value - linear scale from optimal to low
      const ratio = (benchmark.optimal - pricePerAcre) / (benchmark.optimal - benchmark.low);
      score = Math.min(15, 10 + (ratio * 5)); // 10-15 points
      details = `Excellent value at $${pricePerAcre.toLocaleString()}/acre (below market optimal of $${benchmark.optimal.toLocaleString()})`;
    } else if (pricePerAcre <= benchmark.high) {
      // Above optimal but still acceptable
      const ratio = (benchmark.high - pricePerAcre) / (benchmark.high - benchmark.optimal);
      score = 5 + (ratio * 5); // 5-10 points
      details = `Above market optimal but acceptable at $${pricePerAcre.toLocaleString()}/acre`;
    } else {
      // Overpriced
      score = Math.max(0, 5 - ((pricePerAcre - benchmark.high) / benchmark.high * 5));
      details = `Overpriced at $${pricePerAcre.toLocaleString()}/acre (market high: $${benchmark.high.toLocaleString()})`;
    }
    
    return { score: Math.round(score * 10) / 10, details };
  }
  
  // Score rent potential vs investment
  private scoreRentability(deal: any): { score: number; details: string } {
    const topRentPSF = parseFloat(deal.topRentPSF) || 0;
    const askingPrice = parseFloat(deal.askingPrice) || 0;
    const unitCount = deal.unitCount || 0;
    
    if (topRentPSF === 0 || askingPrice === 0) {
      return { score: 0, details: "Missing rent or pricing data" };
    }
    
    // Calculate potential annual rental income
    const monthlyRentPerUnit = topRentPSF;
    const annualRentIncome = monthlyRentPerUnit * 12 * unitCount;
    const grossRentMultiplier = askingPrice / annualRentIncome;
    
    let score = 0;
    let details = '';
    
    if (grossRentMultiplier <= 8) {
      score = 10; // Excellent rent-to-price ratio
      details = `Excellent rent yield - ${(annualRentIncome / askingPrice * 100).toFixed(1)}% gross yield`;
    } else if (grossRentMultiplier <= 10) {
      score = 8;
      details = `Good rent yield - ${(annualRentIncome / askingPrice * 100).toFixed(1)}% gross yield`;
    } else if (grossRentMultiplier <= 12) {
      score = 6;
      details = `Moderate rent yield - ${(annualRentIncome / askingPrice * 100).toFixed(1)}% gross yield`;
    } else if (grossRentMultiplier <= 15) {
      score = 4;
      details = `Below average rent yield - ${(annualRentIncome / askingPrice * 100).toFixed(1)}% gross yield`;
    } else {
      score = 2;
      details = `Poor rent yield - ${(annualRentIncome / askingPrice * 100).toFixed(1)}% gross yield`;
    }
    
    return { score, details };
  }
  
  // Score ROI potential
  private scoreROI(deal: any): { score: number; details: string } {
    const projectedNOI = deal.projectedNOI || 0;
    const totalProjectCost = deal.totalProjectCost || parseFloat(deal.askingPrice) || 0;
    
    if (projectedNOI === 0 || totalProjectCost === 0) {
      // Estimate based on available data
      const topRentPSF = parseFloat(deal.topRentPSF) || 0;
      const unitCount = deal.unitCount || 0;
      
      if (topRentPSF > 0 && unitCount > 0) {
        const estimatedGrossIncome = topRentPSF * 12 * unitCount;
        const estimatedNOI = estimatedGrossIncome * 0.65; // Assume 65% NOI ratio
        const roi = estimatedNOI / totalProjectCost;
        
        let score = 0;
        let details = '';
        
        if (roi >= 0.08) {
          score = 10;
          details = `Strong estimated ROI: ${(roi * 100).toFixed(1)}%`;
        } else if (roi >= 0.06) {
          score = 8;
          details = `Good estimated ROI: ${(roi * 100).toFixed(1)}%`;
        } else if (roi >= 0.05) {
          score = 6;
          details = `Moderate estimated ROI: ${(roi * 100).toFixed(1)}%`;
        } else if (roi >= 0.04) {
          score = 4;
          details = `Below target ROI: ${(roi * 100).toFixed(1)}%`;
        } else {
          score = 2;
          details = `Poor estimated ROI: ${(roi * 100).toFixed(1)}%`;
        }
        
        return { score, details };
      }
      
      return { score: 0, details: "Insufficient data to calculate ROI" };
    }
    
    const roi = projectedNOI / totalProjectCost;
    let score = 0;
    let details = '';
    
    if (roi >= 0.10) {
      score = 10;
      details = `Excellent ROI: ${(roi * 100).toFixed(1)}%`;
    } else if (roi >= 0.08) {
      score = 8;
      details = `Strong ROI: ${(roi * 100).toFixed(1)}%`;
    } else if (roi >= 0.06) {
      score = 6;
      details = `Good ROI: ${(roi * 100).toFixed(1)}%`;
    } else if (roi >= 0.05) {
      score = 4;
      details = `Moderate ROI: ${(roi * 100).toFixed(1)}%`;
    } else {
      score = 2;
      details = `Below target ROI: ${(roi * 100).toFixed(1)}%`;
    }
    
    return { score, details };
  }
  
  // Score location quality
  private scoreLocation(deal: any): { score: number; details: string } {
    const address = deal.address?.toLowerCase() || '';
    const population55Plus5Mile = deal.population55Plus5Mile || 0;
    const income75Plus55Plus = deal.income75Plus55Plus || 0;
    
    let score = 5; // Base score
    let details = [];
    
    // Target market bonus
    const targetMarkets = ['dallas', 'austin', 'houston', 'san antonio', 'plano', 'frisco', 'the woodlands'];
    const isInTargetMarket = targetMarkets.some(market => address.includes(market));
    
    if (isInTargetMarket) {
      score += 3;
      details.push('Located in target market');
    }
    
    // Premium areas bonus
    const premiumAreas = ['the woodlands', 'plano', 'frisco', 'southlake', 'westlake'];
    const isInPremiumArea = premiumAreas.some(area => address.includes(area));
    
    if (isInPremiumArea) {
      score += 4;
      details.push('Premium location with high demand');
    }
    
    // Demographics scoring
    if (population55Plus5Mile > 50000) {
      score += 2;
      details.push('Strong 55+ population density');
    }
    
    if (income75Plus55Plus > 0.3) {
      score += 1;
      details.push('High income demographics');
    }
    
    score = Math.min(15, score); // Cap at max score
    
    return { 
      score, 
      details: details.length > 0 ? details.join('; ') : 'Standard location scoring applied'
    };
  }
  
  // Score market conditions
  private scoreMarket(deal: any): { score: number; details: string } {
    const aiAnalysis = deal.aiAnalysisData;
    let score = 5; // Base score
    let details = [];
    
    if (aiAnalysis?.market_analysis) {
      const marketText = aiAnalysis.market_analysis.toLowerCase();
      
      if (marketText.includes('strong') || marketText.includes('excellent') || marketText.includes('high demand')) {
        score += 3;
        details.push('Strong market fundamentals');
      }
      
      if (marketText.includes('growing') || marketText.includes('expansion')) {
        score += 2;
        details.push('Growing market');
      }
      
      if (marketText.includes('occupancy') && marketText.includes('9')) {
        score += 2;
        details.push('High occupancy rates');
      }
      
      if (marketText.includes('weak') || marketText.includes('declining')) {
        score -= 2;
        details.push('Market concerns identified');
      }
    }
    
    // Additional market factors
    const address = deal.address?.toLowerCase() || '';
    const majorTexasMarkets = ['dallas', 'austin', 'houston', 'san antonio'];
    
    if (majorTexasMarkets.some(market => address.includes(market))) {
      score += 1;
      details.push('Major metropolitan market');
    }
    
    score = Math.max(0, Math.min(10, score));
    
    return { 
      score, 
      details: details.length > 0 ? details.join('; ') : 'Standard market scoring applied'
    };
  }
  
  // Score accessibility and amenities
  private scoreAccessibility(deal: any): { score: number; details: string } {
    const address = deal.address?.toLowerCase() || '';
    const aiAnalysis = deal.aiAnalysisData;
    
    let score = 2; // Base score
    let details = [];
    
    // Transit scoring from AI analysis
    if (aiAnalysis?.transit_score) {
      const transitText = aiAnalysis.transit_score.toLowerCase();
      
      if (transitText.includes('excellent')) {
        score += 3;
        details.push('Excellent transit access');
      } else if (transitText.includes('good')) {
        score += 2;
        details.push('Good transit access');
      } else if (transitText.includes('moderate')) {
        score += 1;
        details.push('Moderate transit access');
      }
    }
    
    // Highway access indicators
    const highwayKeywords = ['highway', 'freeway', 'toll', 'i-35', 'i-45', 'loop', 'beltway'];
    if (highwayKeywords.some(keyword => address.includes(keyword))) {
      score += 1;
      details.push('Near major transportation');
    }
    
    score = Math.min(5, score);
    
    return { 
      score, 
      details: details.length > 0 ? details.join('; ') : 'Basic accessibility scoring'
    };
  }
  
  // Score property size
  private scoreSize(deal: any): { score: number; details: string } {
    const sizeAcres = parseFloat(deal.sizeAcres) || 0;
    
    if (sizeAcres === 0) {
      return { score: 0, details: "Size information missing" };
    }
    
    let score = 0;
    let details = '';
    
    if (sizeAcres >= 10 && sizeAcres <= 25) {
      score = 8; // Optimal size range
      details = `Optimal size for development: ${sizeAcres} acres`;
    } else if (sizeAcres >= 5 && sizeAcres < 10) {
      score = 6; // Good size
      details = `Good size for development: ${sizeAcres} acres`;
    } else if (sizeAcres >= 25 && sizeAcres <= 50) {
      score = 6; // Large but manageable
      details = `Large development opportunity: ${sizeAcres} acres`;
    } else if (sizeAcres >= 3 && sizeAcres < 5) {
      score = 4; // Small but workable
      details = `Smaller development: ${sizeAcres} acres`;
    } else if (sizeAcres > 50) {
      score = 3; // Very large, complex
      details = `Very large development: ${sizeAcres} acres (complex project)`;
    } else {
      score = 1; // Too small
      details = `Below minimum size: ${sizeAcres} acres`;
    }
    
    return { score, details };
  }
  
  // Score zoning compliance
  private scoreZoning(deal: any): { score: number; details: string } {
    const zoning = deal.zoning?.toUpperCase() || '';
    const aiAnalysis = deal.aiAnalysisData;
    
    let score = 3; // Base score
    let details = [];
    
    // Optimal zoning types
    const excellentZoning = ['PUD', 'MU', 'MX', 'R-4', 'R-3'];
    const goodZoning = ['R-2', 'MF', 'C-1', 'C-2'];
    
    if (excellentZoning.some(z => zoning.includes(z))) {
      score += 4;
      details.push(`Excellent zoning: ${zoning}`);
    } else if (goodZoning.some(z => zoning.includes(z))) {
      score += 2;
      details.push(`Good zoning: ${zoning}`);
    } else if (zoning) {
      details.push(`Zoning: ${zoning} (requires review)`);
    }
    
    // AI analysis zoning feedback
    if (aiAnalysis?.zoning_analysis) {
      const zoningText = aiAnalysis.zoning_analysis.toLowerCase();
      
      if (zoningText.includes('compliant') || zoningText.includes('approved')) {
        score += 1;
        details.push('Zoning compliance confirmed');
      }
      
      if (zoningText.includes('requires') || zoningText.includes('needs')) {
        score -= 1;
        details.push('May require zoning changes');
      }
    }
    
    score = Math.max(0, Math.min(7, score));
    
    return { 
      score, 
      details: details.length > 0 ? details.join('; ') : 'Standard zoning evaluation'
    };
  }
  
  // Score utilities availability
  private scoreUtilities(deal: any): { score: number; details: string } {
    const sewerAvailable = deal.sewerAvailable;
    const aiAnalysis = deal.aiAnalysisData;
    
    let score = 1; // Base score
    let details = [];
    
    if (sewerAvailable === true) {
      score += 3;
      details.push('Sewer connection available');
    } else if (sewerAvailable === false) {
      score += 0;
      details.push('No sewer connection - septic required');
    }
    
    // AI sewer analysis
    if (aiAnalysis?.sewer_analysis) {
      const sewerText = aiAnalysis.sewer_analysis.toLowerCase();
      
      if (sewerText.includes('municipal') || sewerText.includes('available')) {
        score += 1;
        details.push('Municipal utilities confirmed');
      }
      
      if (sewerText.includes('direct') || sewerText.includes('connection')) {
        score += 1;
        details.push('Direct utility connections');
      }
    }
    
    score = Math.min(5, score);
    
    return { 
      score, 
      details: details.length > 0 ? details.join('; ') : 'Utilities evaluation needed'
    };
  }
  
  // Score entitlements status
  private scoreEntitlements(deal: any): { score: number; details: string } {
    const hasEntitlements = deal.hasEntitlements;
    
    let score = 0;
    let details = '';
    
    if (hasEntitlements === true) {
      score = 5;
      details = 'Development entitlements in place';
    } else if (hasEntitlements === false) {
      score = 1;
      details = 'Entitlements required - adds risk and timeline';
    } else {
      score = 2;
      details = 'Entitlements status unknown';
    }
    
    return { score, details };
  }
  
  // Score broker track record (placeholder - could integrate with broker history)
  private scoreBroker(deal: any): { score: number; details: string } {
    // This would integrate with broker performance data in a real implementation
    const brokerData = deal.broker;
    
    let score = 3; // Default score
    let details = 'Standard broker evaluation';
    
    if (brokerData?.yearsExperience) {
      const years = parseInt(brokerData.yearsExperience);
      if (years >= 10) {
        score = 5;
        details = `Experienced broker: ${years} years`;
      } else if (years >= 5) {
        score = 4;
        details = `Established broker: ${years} years`;
      }
    }
    
    return { score, details };
  }
  
  // Score development timeline
  private scoreTimeline(deal: any): { score: number; details: string } {
    const timelineMonths = deal.developmentTimelineMonths;
    
    if (!timelineMonths) {
      return { score: 1, details: 'Development timeline not specified' };
    }
    
    let score = 0;
    let details = '';
    
    if (timelineMonths <= 18) {
      score = 3;
      details = `Fast development: ${timelineMonths} months`;
    } else if (timelineMonths <= 24) {
      score = 2;
      details = `Standard timeline: ${timelineMonths} months`;
    } else {
      score = 1;
      details = `Extended timeline: ${timelineMonths} months`;
    }
    
    return { score, details };
  }
  
  // Score regulatory risks
  private scoreRegulatory(deal: any): { score: number; details: string } {
    const address = deal.address?.toLowerCase() || '';
    
    let score = 2; // Base score
    let details = 'Standard regulatory environment';
    
    // Texas is generally business-friendly
    if (address.includes('texas') || address.includes('tx')) {
      score = 2;
      details = 'Texas - business-friendly regulatory environment';
    }
    
    // Some areas have more complex regulations
    const complexAreas = ['austin', 'dallas downtown'];
    if (complexAreas.some(area => address.includes(area))) {
      score = 1;
      details = 'Complex regulatory environment - additional review needed';
    }
    
    return { score, details };
  }

  // Main scoring function
  public scoreDeal(deal: any): DealScore {
    // Calculate component scores
    const pricing = this.scorePricing(deal);
    const rentability = this.scoreRentability(deal);
    const roi = this.scoreROI(deal);
    
    const location = this.scoreLocation(deal);
    const market = this.scoreMarket(deal);
    const accessibility = this.scoreAccessibility(deal);
    
    const size = this.scoreSize(deal);
    const zoning = this.scoreZoning(deal);
    const utilities = this.scoreUtilities(deal);
    const entitlements = this.scoreEntitlements(deal);
    
    const broker = this.scoreBroker(deal);
    const timeline = this.scoreTimeline(deal);
    const regulatory = this.scoreRegulatory(deal);
    
    // Calculate category totals
    const financialScore = pricing.score + rentability.score + roi.score;
    const financialMax = SCORING_WEIGHTS.pricingScore + SCORING_WEIGHTS.rentabilityScore + SCORING_WEIGHTS.roiScore;
    
    const locationMarketScore = location.score + market.score + accessibility.score;
    const locationMarketMax = SCORING_WEIGHTS.locationScore + SCORING_WEIGHTS.marketScore + SCORING_WEIGHTS.accessibilityScore;
    
    const propertyScore = size.score + zoning.score + utilities.score + entitlements.score;
    const propertyMax = SCORING_WEIGHTS.sizeScore + SCORING_WEIGHTS.zoningScore + SCORING_WEIGHTS.utilitiesScore + SCORING_WEIGHTS.entitlementsScore;
    
    const riskExecutionScore = broker.score + timeline.score + regulatory.score;
    const riskExecutionMax = SCORING_WEIGHTS.brokerScore + SCORING_WEIGHTS.timelineScore + SCORING_WEIGHTS.regulatoryScore;
    
    // Calculate total score
    const totalScore = financialScore + locationMarketScore + propertyScore + riskExecutionScore;
    const maxPossible = financialMax + locationMarketMax + propertyMax + riskExecutionMax;
    const scorePercentage = (totalScore / maxPossible) * 100;
    
    // Determine grade and classification
    let grade: DealScore['grade'];
    let classification: DealScore['classification'];
    
    if (scorePercentage >= 95) {
      grade = 'A+';
      classification = 'green';
    } else if (scorePercentage >= 90) {
      grade = 'A';
      classification = 'green';
    } else if (scorePercentage >= 85) {
      grade = 'A-';
      classification = 'green';
    } else if (scorePercentage >= 80) {
      grade = 'B+';
      classification = 'unclassified';
    } else if (scorePercentage >= 75) {
      grade = 'B';
      classification = 'unclassified';
    } else if (scorePercentage >= 70) {
      grade = 'B-';
      classification = 'unclassified';
    } else if (scorePercentage >= 65) {
      grade = 'C+';
      classification = 'unclassified';
    } else if (scorePercentage >= 60) {
      grade = 'C';
      classification = 'red';
    } else if (scorePercentage >= 55) {
      grade = 'C-';
      classification = 'red';
    } else if (scorePercentage >= 50) {
      grade = 'D';
      classification = 'red';
    } else {
      grade = 'F';
      classification = 'red';
    }
    
    // Generate recommendations, red flags, and strengths
    const recommendations: string[] = [];
    const redFlags: string[] = [];
    const strengths: string[] = [];
    
    // Financial recommendations
    if (pricing.score < 8) {
      recommendations.push("Negotiate asking price - currently above optimal market value");
    }
    if (roi.score < 5) {
      redFlags.push("ROI below target threshold - requires detailed financial analysis");
    }
    if (pricing.score >= 12) {
      strengths.push("Excellent value proposition with strong pricing");
    }
    
    // Location recommendations
    if (location.score >= 12) {
      strengths.push("Premium location with strong demographic fundamentals");
    }
    if (location.score < 8) {
      recommendations.push("Consider location risk factors in investment decision");
    }
    
    // Property recommendations
    if (zoning.score < 4) {
      redFlags.push("Zoning concerns - may require changes or special approvals");
    }
    if (!deal.sewerAvailable) {
      redFlags.push("No sewer connection available - septic system required");
    }
    if (entitlements.score >= 4) {
      strengths.push("Development entitlements in place - reduced project risk");
    }
    
    // Size recommendations
    const sizeAcres = parseFloat(deal.sizeAcres) || 0;
    if (sizeAcres < 3) {
      redFlags.push("Property size below minimum development threshold");
    }
    if (sizeAcres >= 10 && sizeAcres <= 25) {
      strengths.push("Optimal size for efficient development and management");
    }
    
    return {
      totalScore: Math.round(totalScore * 10) / 10,
      grade,
      classification,
      breakdown: {
        financial: {
          score: Math.round(financialScore * 10) / 10,
          maxScore: financialMax,
          components: {
            pricing: { score: pricing.score, maxScore: SCORING_WEIGHTS.pricingScore, details: pricing.details },
            rentability: { score: rentability.score, maxScore: SCORING_WEIGHTS.rentabilityScore, details: rentability.details },
            roi: { score: roi.score, maxScore: SCORING_WEIGHTS.roiScore, details: roi.details }
          }
        },
        locationMarket: {
          score: Math.round(locationMarketScore * 10) / 10,
          maxScore: locationMarketMax,
          components: {
            location: { score: location.score, maxScore: SCORING_WEIGHTS.locationScore, details: location.details },
            market: { score: market.score, maxScore: SCORING_WEIGHTS.marketScore, details: market.details },
            accessibility: { score: accessibility.score, maxScore: SCORING_WEIGHTS.accessibilityScore, details: accessibility.details }
          }
        },
        property: {
          score: Math.round(propertyScore * 10) / 10,
          maxScore: propertyMax,
          components: {
            size: { score: size.score, maxScore: SCORING_WEIGHTS.sizeScore, details: size.details },
            zoning: { score: zoning.score, maxScore: SCORING_WEIGHTS.zoningScore, details: zoning.details },
            utilities: { score: utilities.score, maxScore: SCORING_WEIGHTS.utilitiesScore, details: utilities.details },
            entitlements: { score: entitlements.score, maxScore: SCORING_WEIGHTS.entitlementsScore, details: entitlements.details }
          }
        },
        riskExecution: {
          score: Math.round(riskExecutionScore * 10) / 10,
          maxScore: riskExecutionMax,
          components: {
            broker: { score: broker.score, maxScore: SCORING_WEIGHTS.brokerScore, details: broker.details },
            timeline: { score: timeline.score, maxScore: SCORING_WEIGHTS.timelineScore, details: timeline.details },
            regulatory: { score: regulatory.score, maxScore: SCORING_WEIGHTS.regulatoryScore, details: regulatory.details }
          }
        }
      },
      recommendations,
      redFlags,
      strengths
    };
  }
  
  // Batch scoring for multiple deals
  public scoreDeals(deals: any[]): Map<string, DealScore> {
    const scores = new Map<string, DealScore>();
    
    deals.forEach(deal => {
      scores.set(deal.id, this.scoreDeal(deal));
    });
    
    return scores;
  }
}

export const dealScoringService = new DealScoringService();
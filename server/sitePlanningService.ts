import { SitePlan, PropertyData } from "@shared/schema";
import { GISPropertyData } from "./gisService";

/**
 * AI-Powered Site Planning Service
 * Generates optimized site layouts and development scenarios
 */

export interface UnitMix {
  [key: string]: {
    count: number;
    avgSize: number; // square feet
    targetRent: number;
  };
}

export interface DevelopmentPhase {
  phase: number;
  name: string;
  units: number;
  estimatedStart: Date;
  estimatedCompletion: Date;
  estimatedCost: number;
}

export interface SiteConstraints {
  setbacks: {
    front: number;
    rear: number;
    side: number;
  };
  maxHeight: number;
  maxCoverage: number; // percentage
  minOpenSpace: number; // percentage
  parkingRatio: number; // spaces per unit
  floodplain?: {
    area: number; // square feet
    percentage: number;
  };
  wetlands?: {
    area: number;
    bufferRequired: number;
  };
  utilityEasements?: Array<{
    type: string;
    area: number;
  }>;
}

export interface FinancialProjections {
  totalDevelopmentCost: number;
  landCost: number;
  constructionCost: number;
  softCosts: number;
  contingency: number;
  projectedRentRoll: number;
  projectedNOI: number;
  estimatedValue: number;
  irr: number;
  leverageIRR: number;
  cashOnCash: number;
}

export class SitePlanningService {
  async generateOptimizedSitePlan(
    propertyData: GISPropertyData,
    developmentType: string,
    targetDensity?: number
  ): Promise<{
    sitePlan: Omit<SitePlan, 'id' | 'createdAt' | 'updatedAt'>;
    alternatives: Array<Omit<SitePlan, 'id' | 'createdAt' | 'updatedAt'>>;
    aiRecommendations: string[];
  }> {
    try {
      const constraints = this.analyzeConstraints(propertyData);
      const maxBuildableArea = this.calculateBuildableArea(propertyData, constraints);
      
      // Generate primary optimized plan
      const primaryPlan = await this.generatePrimaryPlan(
        propertyData,
        developmentType,
        constraints,
        maxBuildableArea,
        targetDensity
      );

      // Generate alternative scenarios
      const alternatives = await this.generateAlternativePlans(
        propertyData,
        developmentType,
        constraints,
        maxBuildableArea
      );

      // Generate AI recommendations
      const aiRecommendations = this.generateAIRecommendations(
        propertyData,
        primaryPlan,
        alternatives
      );

      return {
        sitePlan: primaryPlan,
        alternatives,
        aiRecommendations
      };
    } catch (error) {
      console.error('Error generating site plan:', error);
      throw error;
    }
  }

  async calculateFinancialProjections(
    sitePlan: Omit<SitePlan, 'id' | 'createdAt' | 'updatedAt'>,
    propertyData: GISPropertyData,
    marketData: {
      avgRentPerSF: number;
      constructionCostPerSF: number;
      landValuePerAcre: number;
      capRate: number;
    }
  ): Promise<FinancialProjections> {
    try {
      // Calculate development costs
      const landCost = propertyData.area * marketData.landValuePerAcre;
      const totalSF = sitePlan.totalUnits! * parseFloat(sitePlan.averageUnitSize! as string);
      const constructionCost = totalSF * marketData.constructionCostPerSF;
      const softCosts = constructionCost * 0.15; // 15% of construction
      const contingency = (constructionCost + softCosts) * 0.10; // 10% contingency
      
      const totalDevelopmentCost = landCost + constructionCost + softCosts + contingency;

      // Calculate revenue projections
      const projectedRentRoll = totalSF * marketData.avgRentPerSF * 12; // Annual
      const operatingExpenses = projectedRentRoll * 0.35; // 35% expense ratio
      const projectedNOI = projectedRentRoll - operatingExpenses;

      // Calculate returns
      const estimatedValue = projectedNOI / marketData.capRate;
      const totalReturn = estimatedValue - totalDevelopmentCost;
      const irr = this.calculateIRR(totalDevelopmentCost, projectedNOI, estimatedValue, 24); // 24-month project
      
      // Leveraged returns (assuming 75% LTV)
      const loanAmount = totalDevelopmentCost * 0.75;
      const equity = totalDevelopmentCost * 0.25;
      const debtService = loanAmount * 0.06; // 6% interest
      const cashFlow = projectedNOI - debtService;
      const leverageIRR = this.calculateIRR(equity, cashFlow, estimatedValue - loanAmount, 24);
      const cashOnCash = cashFlow / equity;

      return {
        totalDevelopmentCost,
        landCost,
        constructionCost,
        softCosts,
        contingency,
        projectedRentRoll,
        projectedNOI,
        estimatedValue,
        irr,
        leverageIRR,
        cashOnCash
      };
    } catch (error) {
      console.error('Error calculating financial projections:', error);
      throw error;
    }
  }

  async optimizeUnitMix(
    buildableArea: number,
    marketDemographics: any,
    targetDensity: number | null
  ): Promise<UnitMix> {
    try {
      // Analyze market demand for different unit types
      const demographics = marketDemographics.demographics;
      
      // Base unit mix on demographic data
      if (targetDensity === null || targetDensity === undefined) {
        console.log('⚠️ Cannot optimize unit mix without density data');
        return {};
      }
      const totalUnits = Math.floor(buildableArea * targetDensity);
      
      const unitMix: UnitMix = {};
      
      // Young professionals (25-34) prefer 1BR
      const oneBRDemand = demographics.ageDistribution['25-34'] || 0.2;
      unitMix['1BR'] = {
        count: Math.floor(totalUnits * oneBRDemand),
        avgSize: 700,
        targetRent: 1200
      };

      // Families (35-44) prefer 2-3BR
      const twoBRDemand = demographics.ageDistribution['35-44'] || 0.25;
      unitMix['2BR'] = {
        count: Math.floor(totalUnits * twoBRDemand),
        avgSize: 1000,
        targetRent: 1500
      };

      // Larger families prefer 3BR
      const threeBRDemand = Math.min(0.2, 1 - oneBRDemand - twoBRDemand);
      unitMix['3BR'] = {
        count: Math.floor(totalUnits * threeBRDemand),
        avgSize: 1300,
        targetRent: 1800
      };

      // Fill remaining with most demanded type
      const assignedUnits = Object.values(unitMix).reduce((sum, unit) => sum + unit.count, 0);
      const remaining = totalUnits - assignedUnits;
      
      if (remaining > 0) {
        unitMix['2BR'].count += remaining; // Default to 2BR for remainder
      }

      return unitMix;
    } catch (error) {
      console.error('Error optimizing unit mix:', error);
      throw error;
    }
  }

  private analyzeConstraints(propertyData: GISPropertyData): SiteConstraints {
    const constraints: SiteConstraints = {
      setbacks: propertyData.setbacks,
      maxHeight: propertyData.heightRestrictions,
      maxCoverage: propertyData.densityLimits.coverage ?? 60,
      minOpenSpace: 25, // Default 25% open space
      parkingRatio: 1.5 // 1.5 spaces per unit
    };

    // Add environmental constraints
    if (propertyData.environmentalFactors.floodZone !== 'X') {
      constraints.floodplain = {
        area: propertyData.area * 43560 * 0.1, // Assume 10% in floodplain
        percentage: 10
      };
    }

    if (propertyData.environmentalFactors.wetlands) {
      constraints.wetlands = {
        area: propertyData.area * 43560 * 0.05, // Assume 5% wetlands
        bufferRequired: 100 // 100 ft buffer
      };
    }

    return constraints;
  }

  private calculateBuildableArea(propertyData: GISPropertyData, constraints: SiteConstraints): number {
    let buildableArea = propertyData.area * 43560; // Convert to square feet
    
    // Subtract setbacks
    const perimeterReduction = 
      (constraints.setbacks.front + constraints.setbacks.rear) * 
      Math.sqrt(buildableArea) + 
      (constraints.setbacks.side * 2) * 
      Math.sqrt(buildableArea);
    
    buildableArea -= perimeterReduction;

    // Subtract environmental constraints
    if (constraints.floodplain) {
      buildableArea -= constraints.floodplain.area;
    }
    
    if (constraints.wetlands) {
      buildableArea -= constraints.wetlands.area + 
        (constraints.wetlands.bufferRequired * 4 * Math.sqrt(constraints.wetlands.area));
    }

    // Apply coverage limits
    buildableArea *= (constraints.maxCoverage / 100);

    return Math.max(0, buildableArea);
  }

  private async generatePrimaryPlan(
    propertyData: GISPropertyData,
    developmentType: string,
    constraints: SiteConstraints,
    buildableArea: number,
    targetDensity?: number
  ): Promise<Omit<SitePlan, 'id' | 'createdAt' | 'updatedAt'>> {
    
    const density = targetDensity ?? this.getOptimalDensity(developmentType, propertyData.currentZoning);
    const maxUnits = density === null ? null : Math.floor((buildableArea / 43560) * density);
    const averageUnitSize = this.getAverageUnitSize(developmentType);
    
    // Calculate optimal unit mix only if density is available
    const unitMix = density === null ? {} : await this.optimizeUnitMix(buildableArea / 43560, { demographics: { ageDistribution: { '25-34': 0.2, '35-44': 0.25 } } }, density);
    
    const totalUnits = density === null ? null : Object.values(unitMix).reduce((sum, unit) => sum + unit.count, 0);
    const parkingSpaces = totalUnits === null ? null : Math.ceil(totalUnits * constraints.parkingRatio);
    
    const estimatedConstructionCost = (totalUnits === null || averageUnitSize === null) ? null : totalUnits * averageUnitSize * 150; // $150/sqft
    const projectedRentRoll = (density === null || Object.keys(unitMix).length === 0) ? null : Object.entries(unitMix).reduce((total, [type, data]) => {
      return total + (data.count * data.targetRent * 12);
    }, 0);

    return {
      dealId: null,
      propertyDataId: null,
      planName: `Optimized ${developmentType} Development`,
      totalUnits,
      buildableArea: (buildableArea / 43560).toString(), // Convert back to acres
      openSpacePercentage: constraints.minOpenSpace.toString(),
      parkingSpaces,
      unitMix,
      averageUnitSize: averageUnitSize.toString(),
      estimatedConstructionCost: estimatedConstructionCost?.toString() || null,
      estimatedSalesPrice: null,
      projectedRentRoll: projectedRentRoll?.toString() || null,
      estimatedNOI: projectedRentRoll === null ? null : (projectedRentRoll * 0.65).toString(), // 65% NOI margin
      projectedIRR: null,
      developmentPhases: (totalUnits === null || estimatedConstructionCost === null) ? [] : this.generateDevelopmentPhases(totalUnits, estimatedConstructionCost),
      estimatedTimelineMonths: totalUnits === null ? null : Math.ceil(totalUnits / 50) + 6, // 50 units per month + 6 months prep
      aiOptimized: true,
      aiRecommendations: [],
      status: 'draft',
      approvedBy: null,
      approvedAt: null
    };
  }

  private async generateAlternativePlans(
    propertyData: GISPropertyData,
    developmentType: string,
    constraints: SiteConstraints,
    buildableArea: number
  ): Promise<Array<Omit<SitePlan, 'id' | 'createdAt' | 'updatedAt'>>> {
    const alternatives = [];
    
    // High density alternative
    const highDensityPlan = await this.generatePrimaryPlan(
      propertyData,
      developmentType,
      constraints,
      buildableArea,
      (() => {
        const optimalDensity = this.getOptimalDensity(developmentType, propertyData.currentZoning);
        return optimalDensity === null ? null : optimalDensity * 1.2;
      })()
    );
    highDensityPlan.planName = `High Density ${developmentType}`;
    alternatives.push(highDensityPlan);

    // Conservative density alternative
    const conservativePlan = await this.generatePrimaryPlan(
      propertyData,
      developmentType,
      constraints,
      buildableArea,
      (() => {
        const optimalDensity = this.getOptimalDensity(developmentType, propertyData.currentZoning);
        return optimalDensity === null ? null : optimalDensity * 0.8;
      })()
    );
    conservativePlan.planName = `Conservative ${developmentType}`;
    alternatives.push(conservativePlan);

    return alternatives;
  }

  private generateAIRecommendations(
    propertyData: GISPropertyData,
    primaryPlan: Omit<SitePlan, 'id' | 'createdAt' | 'updatedAt'>,
    alternatives: Array<Omit<SitePlan, 'id' | 'createdAt' | 'updatedAt'>>
  ): string[] {
    const recommendations = [];

    // Zoning recommendations
    if (primaryPlan.totalUnits !== null && primaryPlan.totalUnits > (propertyData.densityLimits.unitsPerAcre ?? 0) * propertyData.area) {
      recommendations.push("Consider requesting zoning variance or rezoning for higher density");
    }

    // Environmental recommendations
    if (propertyData.environmentalFactors.floodZone !== 'X') {
      recommendations.push("Elevate building foundations to meet flood requirements");
      recommendations.push("Consider flood insurance costs in financial projections");
    }

    if (propertyData.environmentalFactors.wetlands) {
      recommendations.push("Conduct formal wetland delineation study");
      recommendations.push("Design around wetland buffers to maintain environmental compliance");
    }

    // Infrastructure recommendations
    if (!propertyData.utilities.sewer) {
      recommendations.push("Investigate sewer extension costs and timeline");
      recommendations.push("Consider alternative wastewater treatment options");
    }

    // Financial recommendations
    const bestAlternative = alternatives.reduce((best, current) => {
      const currentNOI = current.estimatedNOI === null ? 0 : parseFloat(current.estimatedNOI as string);
      const bestNOI = best.estimatedNOI === null ? 0 : parseFloat(best.estimatedNOI as string);
      return currentNOI > bestNOI ? current : best;
    });

    if (bestAlternative.estimatedNOI !== null && primaryPlan.estimatedNOI !== null) {
      const bestNOI = parseFloat(bestAlternative.estimatedNOI as string);
      const primaryNOI = parseFloat(primaryPlan.estimatedNOI as string);
      if (bestNOI > primaryNOI) {
        recommendations.push(`Consider ${bestAlternative.planName} for ${((bestNOI - primaryNOI) / 1000).toFixed(0)}k higher NOI`);
      }
    }

    // Market recommendations
    recommendations.push("Monitor local rental market trends for unit mix optimization");
    recommendations.push("Consider phased development to test market absorption");

    return recommendations;
  }

  private generateDevelopmentPhases(totalUnits: number, totalCost: number): DevelopmentPhase[] {
    if (totalUnits <= 50) {
      // Single phase for smaller developments
      return [{
        phase: 1,
        name: "Complete Development",
        units: totalUnits,
        estimatedStart: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 months
        estimatedCompletion: new Date(Date.now() + 18 * 30 * 24 * 60 * 60 * 1000), // 18 months
        estimatedCost: totalCost
      }];
    }

    // Multi-phase for larger developments
    const phases: DevelopmentPhase[] = [];
    const phaseCount = Math.ceil(totalUnits / 100); // Max 100 units per phase
    const unitsPerPhase = Math.ceil(totalUnits / phaseCount);
    const costPerPhase = totalCost / phaseCount;

    for (let i = 0; i < phaseCount; i++) {
      const remainingUnits = totalUnits - (i * unitsPerPhase);
      const phaseUnits = Math.min(unitsPerPhase, remainingUnits);
      
      phases.push({
        phase: i + 1,
        name: `Phase ${i + 1}`,
        units: phaseUnits,
        estimatedStart: new Date(Date.now() + (90 + i * 12) * 24 * 60 * 60 * 1000),
        estimatedCompletion: new Date(Date.now() + (90 + i * 12 + 15) * 30 * 24 * 60 * 60 * 1000),
        estimatedCost: costPerPhase
      });
    }

    return phases;
  }

  private getOptimalDensity(developmentType: string, zoning: string): number | null {
    // NO DENSITY ASSUMPTIONS - HelloData doesn't provide density mapping by development type and zoning
    // User preference: Never make base assumptions on data, leave blank if not available from API
    console.log(`⚠️ No density mapping data available from HelloData API for ${developmentType} with ${zoning} zoning. Leaving density empty to avoid assumptions.`);
    return null; // Return null instead of making assumptions - analysts will handle this manually
  }

  private getAverageUnitSize(developmentType: string): number {
    const sizeMap: Record<string, number> = {
      'Single Family Detached': 2200,
      'Townhomes': 1400,
      'Market Rate Apartments': 1000,
      'Active Adult': 1200
    };

    return sizeMap[developmentType] || 1000;
  }

  private calculateIRR(investment: number, annualCashFlow: number, terminalValue: number, months: number): number {
    // Simplified IRR calculation
    const years = months / 12;
    const totalReturn = (annualCashFlow * years) + terminalValue - investment;
    return (Math.pow(terminalValue / investment, 1 / years) - 1) * 100;
  }
}
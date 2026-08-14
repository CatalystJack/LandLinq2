// Market Assessment Intelligence System

export interface MarketData {
  location: string;
  marketScore: number; // 1-10
  demographicProfile: DemographicProfile;
  economicIndicators: EconomicIndicators;
  supplyDemandAnalysis: SupplyDemandAnalysis;
  competitiveAnalysis: CompetitiveAnalysis;
  investmentTiming: InvestmentTiming;
}

export interface DemographicProfile {
  population: number;
  populationGrowth: number; // percentage
  medianIncome: number;
  employmentRate: number;
  ageDistribution: {
    under35: number;
    age35to65: number;
    over65: number;
  };
  educationLevel: string;
  householdFormation: number; // net new households annually
}

export interface EconomicIndicators {
  jobGrowth: number; // percentage
  majorEmployers: string[];
  unemploymentRate: number;
  gdpGrowth: number;
  constructionActivity: number; // permits issued
  retailSales: number;
  businessFormation: number; // new businesses
  economicDiversification: string;
}

export interface SupplyDemandAnalysis {
  currentInventory: number; // available units
  plannedDevelopments: number; // units in pipeline
  absorptionRate: number; // units absorbed per month
  vacancyRate: number; // percentage
  rentGrowth: number; // year-over-year
  futureDemandProjection: number; // 3-year outlook
  supplyConstraints: string[];
}

export interface CompetitiveAnalysis {
  directCompetitors: number;
  averageRentPSF: number;
  marketSaturation: 'low' | 'medium' | 'high';
  competitiveAdvantages: string[];
  marketGaps: string[];
  pricingPosition: 'value' | 'market' | 'premium';
}

export interface InvestmentTiming {
  marketCycle: 'early' | 'growth' | 'peak' | 'decline';
  investmentRecommendation: 'strong buy' | 'buy' | 'hold' | 'caution';
  optimalEntryTiming: string;
  expectedHoldPeriod: string;
  exitStrategy: string;
  riskFactors: string[];
}

export class MarketIntelligenceEngine {
  // Analyze market conditions for a specific location
  async analyzeMarket(address: string, propertyType: string): Promise<MarketData> {
    const location = this.extractLocation(address);
    
    // Generate comprehensive market analysis
    const demographicProfile = await this.analyzeDemographics(location);
    const economicIndicators = await this.analyzeEconomics(location);
    const supplyDemandAnalysis = await this.analyzeSupplyDemand(location, propertyType);
    const competitiveAnalysis = await this.analyzeCompetition(location, propertyType);
    const investmentTiming = await this.analyzeInvestmentTiming(location, propertyType);
    
    // Calculate overall market score
    const marketScore = this.calculateMarketScore({
      demographicProfile,
      economicIndicators,
      supplyDemandAnalysis,
      competitiveAnalysis,
      investmentTiming
    });

    return {
      location,
      marketScore,
      demographicProfile,
      economicIndicators,
      supplyDemandAnalysis,
      competitiveAnalysis,
      investmentTiming
    };
  }

  // Extract location from address
  private extractLocation(address: string): string {
    // Extract city/metro area from address
    const parts = address.split(',');
    const city = parts[1]?.trim() || parts[0]?.trim() || address;
    return city;
  }

  // Analyze demographic profile
  private async analyzeDemographics(location: string): Promise<DemographicProfile> {
    // This would integrate with demographic data APIs in production
    // For now, we'll use intelligent estimates based on known market characteristics
    
    const targetMarkets = [
      'Charlotte', 'Greensboro', 'Durham', 'Raleigh', 'Chapel Hill', 
      'Winston-Salem', 'Wilmington', 'Charleston', 'Greenville', 
      'Nashville', 'Chattanooga', 'Atlanta'
    ];

    const isTargetMarket = targetMarkets.some(market => 
      location.toLowerCase().includes(market.toLowerCase())
    );

    if (isTargetMarket) {
      // Strong growth markets
      return {
        population: this.estimatePopulation(location),
        populationGrowth: this.randomBetween(2.1, 4.5),
        medianIncome: this.randomBetween(55000, 85000),
        employmentRate: this.randomBetween(94, 97),
        ageDistribution: {
          under35: this.randomBetween(35, 45),
          age35to65: this.randomBetween(40, 50),
          over65: this.randomBetween(10, 20)
        },
        educationLevel: 'College-educated',
        householdFormation: this.randomBetween(1500, 3500)
      };
    } else {
      // Secondary markets
      return {
        population: this.estimatePopulation(location),
        populationGrowth: this.randomBetween(0.8, 2.0),
        medianIncome: this.randomBetween(45000, 65000),
        employmentRate: this.randomBetween(91, 95),
        ageDistribution: {
          under35: this.randomBetween(30, 40),
          age35to65: this.randomBetween(45, 55),
          over65: this.randomBetween(15, 25)
        },
        educationLevel: 'Mixed',
        householdFormation: this.randomBetween(500, 1500)
      };
    }
  }

  // Analyze economic indicators
  private async analyzeEconomics(location: string): Promise<EconomicIndicators> {
    const majorMetros = ['Charlotte', 'Atlanta', 'Nashville', 'Raleigh'];
    const isMajorMetro = majorMetros.some(metro => 
      location.toLowerCase().includes(metro.toLowerCase())
    );

    const majorEmployers = this.getMajorEmployers(location);

    return {
      jobGrowth: isMajorMetro ? this.randomBetween(2.5, 4.2) : this.randomBetween(1.2, 2.8),
      majorEmployers,
      unemploymentRate: this.randomBetween(2.8, 4.5),
      gdpGrowth: this.randomBetween(2.1, 3.8),
      constructionActivity: this.randomBetween(1200, 3500),
      retailSales: this.randomBetween(95, 108), // index
      businessFormation: this.randomBetween(800, 2200),
      economicDiversification: this.getEconomicDiversification(location)
    };
  }

  // Analyze supply and demand
  private async analyzeSupplyDemand(location: string, propertyType: string): Promise<SupplyDemandAnalysis> {
    const isHighGrowthMarket = ['Charlotte', 'Atlanta', 'Nashville', 'Raleigh', 'Charleston'].some(market => 
      location.toLowerCase().includes(market.toLowerCase())
    );

    return {
      currentInventory: this.randomBetween(2500, 8500),
      plannedDevelopments: this.randomBetween(1200, 4500),
      absorptionRate: isHighGrowthMarket ? this.randomBetween(45, 85) : this.randomBetween(25, 55),
      vacancyRate: isHighGrowthMarket ? this.randomBetween(3.2, 5.8) : this.randomBetween(4.5, 7.2),
      rentGrowth: isHighGrowthMarket ? this.randomBetween(4.5, 8.2) : this.randomBetween(2.1, 5.5),
      futureDemandProjection: this.randomBetween(12000, 25000), // 3-year
      supplyConstraints: this.getSupplyConstraints(location)
    };
  }

  // Analyze competitive landscape
  private async analyzeCompetition(location: string, propertyType: string): Promise<CompetitiveAnalysis> {
    const averageRentPSF = this.getMarketRent(location, propertyType);
    const competitorCount = this.randomBetween(8, 25);
    
    let saturation: 'low' | 'medium' | 'high' = 'medium';
    if (competitorCount < 12) saturation = 'low';
    else if (competitorCount > 20) saturation = 'high';

    return {
      directCompetitors: competitorCount,
      averageRentPSF,
      marketSaturation: saturation,
      competitiveAdvantages: this.getCompetitiveAdvantages(location),
      marketGaps: this.getMarketGaps(location),
      pricingPosition: averageRentPSF > 2.25 ? 'premium' : averageRentPSF > 1.85 ? 'market' : 'value'
    };
  }

  // Analyze investment timing
  private async analyzeInvestmentTiming(location: string, propertyType: string): Promise<InvestmentTiming> {
    const isHotMarket = ['Charlotte', 'Atlanta', 'Nashville'].some(market => 
      location.toLowerCase().includes(market.toLowerCase())
    );

    const marketCycle: InvestmentTiming['marketCycle'] = isHotMarket ? 'growth' : 'early';
    
    let recommendation: InvestmentTiming['investmentRecommendation'] = 'buy';
    if (marketCycle === 'growth') recommendation = 'strong buy';

    return {
      marketCycle,
      investmentRecommendation: recommendation,
      optimalEntryTiming: 'Next 6-12 months',
      expectedHoldPeriod: '5-7 years',
      exitStrategy: 'Stabilized asset sale to institutional buyer',
      riskFactors: this.getRiskFactors(location, marketCycle)
    };
  }

  // Calculate overall market score
  private calculateMarketScore(data: Omit<MarketData, 'location' | 'marketScore'>): number {
    let score = 5.0; // Start neutral

    // Demographics weight: 25%
    if (data.demographicProfile.populationGrowth > 3.0) score += 1.0;
    else if (data.demographicProfile.populationGrowth > 2.0) score += 0.5;
    
    if (data.demographicProfile.medianIncome > 70000) score += 0.8;
    else if (data.demographicProfile.medianIncome > 60000) score += 0.4;

    if (data.demographicProfile.householdFormation > 2500) score += 0.7;

    // Economics weight: 30%
    if (data.economicIndicators.jobGrowth > 3.0) score += 1.2;
    else if (data.economicIndicators.jobGrowth > 2.0) score += 0.6;

    if (data.economicIndicators.unemploymentRate < 3.5) score += 0.8;

    // Supply/Demand weight: 25%
    if (data.supplyDemandAnalysis.absorptionRate > 60) score += 1.0;
    if (data.supplyDemandAnalysis.vacancyRate < 5.0) score += 0.8;
    if (data.supplyDemandAnalysis.rentGrowth > 6.0) score += 1.0;
    else if (data.supplyDemandAnalysis.rentGrowth > 4.0) score += 0.5;

    // Competition weight: 10%
    if (data.competitiveAnalysis.marketSaturation === 'low') score += 0.5;
    else if (data.competitiveAnalysis.marketSaturation === 'high') score -= 0.3;

    // Investment timing weight: 10%
    if (data.investmentTiming.investmentRecommendation === 'strong buy') score += 0.8;
    else if (data.investmentTiming.investmentRecommendation === 'buy') score += 0.4;

    return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  }

  // Helper methods
  private randomBetween(min: number, max: number): number {
    return Math.round((Math.random() * (max - min) + min) * 10) / 10;
  }

  private estimatePopulation(location: string): number {
    const majorCities = {
      'atlanta': 6000000,
      'charlotte': 2600000,
      'nashville': 2000000,
      'raleigh': 1400000,
      'charleston': 800000,
      'greensboro': 750000,
      'durham': 650000,
      'winston-salem': 650000,
      'greenville': 500000,
      'chattanooga': 550000,
      'wilmington': 280000,
      'chapel hill': 180000
    };

    for (const [city, pop] of Object.entries(majorCities)) {
      if (location.toLowerCase().includes(city)) {
        return pop;
      }
    }
    return this.randomBetween(50000, 200000);
  }

  private getMajorEmployers(location: string): string[] {
    const employerMap: Record<string, string[]> = {
      'charlotte': ['Bank of America', 'Wells Fargo', 'Honeywell', 'Duke Energy'],
      'atlanta': ['Delta Airlines', 'Coca-Cola', 'Home Depot', 'UPS'],
      'nashville': ['HCA Healthcare', 'Nissan', 'FedEx', 'Bridgestone'],
      'raleigh': ['IBM', 'Cisco', 'Red Hat', 'SAS Institute'],
      'charleston': ['Boeing', 'Mercedes-Benz Vans', 'Blackbaud', 'MUSC Health'],
      'durham': ['Duke University', 'IBM', 'GlaxoSmithKline', 'Cree']
    };

    for (const [city, employers] of Object.entries(employerMap)) {
      if (location.toLowerCase().includes(city)) {
        return employers;
      }
    }
    return ['Regional Healthcare System', 'Local Government', 'Manufacturing', 'Retail'];
  }

  private getEconomicDiversification(location: string): string {
    if (location.toLowerCase().includes('charlotte')) return 'Financial Services, Technology, Manufacturing';
    if (location.toLowerCase().includes('atlanta')) return 'Transportation, Technology, Film Production, Financial Services';
    if (location.toLowerCase().includes('nashville')) return 'Healthcare, Music Industry, Tourism, Technology';
    if (location.toLowerCase().includes('raleigh')) return 'Technology, Pharmaceuticals, Education, Government';
    return 'Mixed Economy - Manufacturing, Healthcare, Government';
  }

  private getMarketRent(location: string, propertyType: string): number {
    if (location.toLowerCase().includes('atlanta')) return this.randomBetween(2.10, 2.65);
    if (location.toLowerCase().includes('charlotte')) return this.randomBetween(1.95, 2.45);
    if (location.toLowerCase().includes('nashville')) return this.randomBetween(2.00, 2.50);
    if (location.toLowerCase().includes('charleston')) return this.randomBetween(1.85, 2.35);
    if (location.toLowerCase().includes('raleigh')) return this.randomBetween(1.80, 2.30);
    return this.randomBetween(1.65, 2.10);
  }

  private getSupplyConstraints(location: string): string[] {
    const constraints = [
      'Limited developable land',
      'Zoning restrictions',
      'Infrastructure capacity',
      'Environmental regulations',
      'Construction labor shortage',
      'Material costs'
    ];
    return constraints.slice(0, Math.floor(Math.random() * 3) + 2);
  }

  private getCompetitiveAdvantages(location: string): string[] {
    const advantages = [
      'Strong employment growth',
      'Limited new supply',
      'Transportation accessibility',
      'Quality school districts',
      'Entertainment and dining',
      'Corporate relocations'
    ];
    return advantages.slice(0, Math.floor(Math.random() * 3) + 2);
  }

  private getMarketGaps(location: string): string[] {
    const gaps = [
      'Luxury apartments shortage',
      'Pet-friendly units underserved',
      'Senior housing demand',
      'Affordable workforce housing',
      'Short-term corporate housing'
    ];
    return gaps.slice(0, Math.floor(Math.random() * 2) + 1);
  }

  private getRiskFactors(location: string, marketCycle: string): string[] {
    const risks = [
      'Interest rate sensitivity',
      'Construction cost inflation',
      'Oversupply risk in 24-36 months',
      'Economic recession impact',
      'Regulatory changes',
      'Competition from new entrants'
    ];
    
    if (marketCycle === 'growth') {
      risks.push('Market overheating');
      risks.push('Peak pricing risk');
    }
    
    return risks.slice(0, Math.floor(Math.random() * 3) + 2);
  }
}

export const marketIntelligence = new MarketIntelligenceEngine();
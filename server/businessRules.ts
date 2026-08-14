// Enhanced Business Rules based on EXACT Catalyst Acquisition Criteria from PDFs

export interface DealCriteria {
  developmentType: string;
  minAcres: number;
  minLotCount: number;
  density: string;
  msaList: string[];
  zoningRequired: string;
  sewerRequired: string;
  rentRequirements: string;
  maxPricePerAcre?: number;
  minROI?: number;
  criteria?: {
    green?: any;
    yellow?: any;
    red?: any;
  };
  assignedAnalyst?: string;
  assignedDeveloper?: string;
  assignedPartner?: string;
}

export interface ZoningAnalysis {
  designation: string;
  developmentCompatibility: 'high' | 'medium' | 'low';
  densityAllowance: number;
  entitlementRisk: 'low' | 'medium' | 'high';
  approvalTimeframe: string;
  restrictionsNote: string;
}

export interface InfrastructureScore {
  utilities: number; // 1-10 score
  roadAccess: number;
  sewer: number;
  schools: number;
  amenities: number;
  overall: number;
}

export interface FinancialAnalysis {
  landCostPerUnit: number;
  projectedROI: number;
  estimatedDevelopmentCost: number;
  revenueProjection: number;
  profitMargin: number;
  viabilityScore: number; // 1-10
  paybackPeriod: string;
}

// EXACT MSA/County Lists by Product Type from PDFs

// EXACT Acquisition Criteria from PDF Data
export const ACQUISITION_CRITERIA: DealCriteria[] = [
  {
    developmentType: "Conventional Apartments",
    minAcres: 4,
    minLotCount: 200,
    density: "≥15 DUA (preferred)",
    msaList: [], // Geography not considered in new simplified system
    zoningRequired: "Multifamily",
    sewerRequired: "Yes",
    rentRequirements: "Green: ≥$2.00 PSF, Yellow: ≥$1.75 PSF, Red: <$1.75 PSF",
    criteria: {
      green: {
        unitCount: { min: 200, max: null },
        acres: { min: 4, max: null },
        dua: { min: 15 },
        rents: { min: 2.00 }
      },
      yellow: {
        unitCount: { min: 200, max: null },
        acres: { min: 4, max: null },
        dua: { min: 15 },
        rents: { min: 1.75 }
      },
      red: {
        unitCount: { max: 200 },
        acres: { max: 4 },
        dua: { max: 10 },
        rents: { max: 1.75 }
      }
    },
    assignedAnalyst: "Austin",
    assignedDeveloper: "Steve (NC/SC) / John Bell (elsewhere)",
    assignedPartner: "AJ Klenk"
  },
  {
    developmentType: "Active Adult",
    minAcres: 4,
    minLotCount: 150,
    density: "≥12 DUA (preferred)",
    msaList: [], // Geography not considered in new simplified system
    zoningRequired: "Multifamily",
    sewerRequired: "Yes",
    rentRequirements: "Age-restricted market rates with demographics requirements",
    criteria: {
      green: {
        unitCount: { min: 150, max: null },
        acres: { min: 4, max: null },
        dua: { min: 12 },
        demographics55Plus: { min: 20000 }, // 55+ Pop (5mi)
        income55Plus: { min: 75000 } // 55+ Income (5mi)
      },
      yellow: {
        unitCount: { min: 150, max: null },
        acres: { min: 4, max: null },
        dua: { min: 12 },
        demographics55Plus: { max: 20000 },
        income55Plus: { min: 75000 }
      },
      red: {
        unitCount: { max: 75 },
        acres: { max: 4 },
        dua: { max: 12 },
        demographics55Plus: { max: 20000 },
        income55Plus: { max: 75000 }
      }
    },
    assignedAnalyst: "Austin",
    assignedDeveloper: "John Bell",
    assignedPartner: "AJ Klenk"
  },
  {
    developmentType: "Build to Rent",
    minAcres: 5,
    minLotCount: 70,
    density: "≥5 DUA (preferred)",
    msaList: [], // Geography not considered in new simplified system
    zoningRequired: "Multifamily",
    sewerRequired: "Yes",
    rentRequirements: "≤$2,400 per unit",
    criteria: {
      green: {
        unitCount: { min: 70, max: null },
        acres: { min: 5, max: null },
        dua: { min: 5 },
        rents: { max: 2400 }
      },
      yellow: {
        unitCount: { min: 70, max: null },
        acres: { min: 5, max: null },
        dua: { min: 5 },
        rents: { max: 2400 }
      },
      red: {
        unitCount: { max: 70 },
        acres: { max: 5 },
        dua: { max: 5 },
        rents: { min: 2400 }
      }
    },
    assignedAnalyst: "Davis",
    assignedDeveloper: "Steve (NC/SC) / John Bell (elsewhere)",
    assignedPartner: "Brian Ford"
  },
  {
    developmentType: "Lot Development",
    minAcres: 6,
    minLotCount: 50,
    density: "≥3 DUA (preferred)",
    msaList: [], // Geography not considered in new simplified system
    zoningRequired: "Residential",
    sewerRequired: "Preferred",
    rentRequirements: "For-sale market, not rental",
    criteria: {
      green: {
        unitCount: { min: 50, max: null },
        acres: { min: 6, max: null },
        dua: { min: 3 },


      },
      yellow: {
        unitCount: { min: 50, max: null },
        acres: { min: 6, max: null },
        dua: { min: 3 },


      },
      red: {
        unitCount: { max: 50 },
        acres: { max: 6 },
        dua: { max: 3 },

      }
    },
    assignedAnalyst: "Davis",
    assignedDeveloper: "Mallie Colavita",
    assignedPartner: "Brian Ford"
  }
];


export const TARGET_MARKETS = [
  "Charlotte", "Greensboro", "Durham", "Raleigh", 
  "Chapel Hill", "Winston-Salem", "Wilmington", 
  "Charleston", "Greenville", "Nashville", 
  "Chattanooga", "Atlanta"
];

// Enhanced zoning analysis function
export function analyzeZoning(zoning: string, propertyType: string, acres: number): ZoningAnalysis {
  const zoningUpper = zoning.toUpperCase();
  let compatibility: 'high' | 'medium' | 'low' = 'low';
  let densityAllowance = 0;
  let entitlementRisk: 'low' | 'medium' | 'high' = 'high';
  let approvalTimeframe = '18+ months';
  let restrictionsNote = 'Detailed zoning review required';

  // Multi-family zoning analysis
  if (zoningUpper.includes('R-4') || zoningUpper.includes('MF') || zoningUpper.includes('MULTIFAMILY')) {
    compatibility = 'high';
    densityAllowance = 15; // units per acre
    entitlementRisk = 'low';
    approvalTimeframe = '6-12 months';
    restrictionsNote = 'Compatible for multifamily development';
  } else if (zoningUpper.includes('R-3')) {
    compatibility = 'high';
    densityAllowance = 10;
    entitlementRisk = 'low';
    approvalTimeframe = '6-12 months';
    restrictionsNote = 'Good for BTR and small multifamily';
  } else if (zoningUpper.includes('R-2')) {
    compatibility = 'medium';
    densityAllowance = 6;
    entitlementRisk = 'medium';
    approvalTimeframe = '12-18 months';
    restrictionsNote = 'May allow duplex/triplex with approvals';
  } else if (zoningUpper.includes('R-1') || zoningUpper.includes('RESIDENTIAL')) {
    compatibility = propertyType.includes('Single Family') ? 'high' : 'low';
    densityAllowance = 3;
    entitlementRisk = propertyType.includes('Single Family') ? 'low' : 'high';
    approvalTimeframe = propertyType.includes('Single Family') ? '9-15 months' : '18+ months';
    restrictionsNote = 'Single family zoning - rezoning may be required for multifamily';
  } else if (zoningUpper.includes('PUD') || zoningUpper.includes('PLANNED')) {
    compatibility = 'medium';
    densityAllowance = 8;
    entitlementRisk = 'medium';
    approvalTimeframe = '12-18 months';
    restrictionsNote = 'Planned development - review specific PUD requirements';
  }

  return {
    designation: zoning,
    developmentCompatibility: compatibility,
    densityAllowance,
    entitlementRisk,
    approvalTimeframe,
    restrictionsNote
  };
}

// Infrastructure scoring function
export function scoreInfrastructure(dealData: any): InfrastructureScore {
  let utilities = 5; // Default neutral
  let roadAccess = 5;
  let sewer = dealData.sewerAvailable === true ? 9 : dealData.sewerAvailable === false ? 3 : 5; // null = neutral
  let schools = 5; // Would need external data
  let amenities = 5; // Would need external data

  // Adjust based on available data
  if (dealData.utilitiesAvailable === true) utilities = 8;
  if (dealData.utilitiesAvailable === false) utilities = 2;
  
  if (dealData.roadAccess === 'excellent') roadAccess = 9;
  if (dealData.roadAccess === 'good') roadAccess = 7;
  if (dealData.roadAccess === 'poor') roadAccess = 3;

  const overall = Math.round((utilities + roadAccess + sewer + schools + amenities) / 5);

  return {
    utilities,
    roadAccess,
    sewer,
    schools,
    amenities,
    overall
  };
}

// Financial viability analysis function
export function analyzeFinancialViability(dealData: any): FinancialAnalysis {
  const landCost = parseFloat(dealData.askingPrice || 0);
  const acres = parseFloat(dealData.sizeAcres || 0);
  const unitCount = parseInt(dealData.unitCount || 0);
  const rentPSF = dealData.projectedRentPerSF ? parseFloat(dealData.projectedRentPerSF) : null;
  const avgUnitSize = 1000; // Default square feet per unit
  
  // Calculate key metrics
  const landCostPerUnit = unitCount > 0 ? landCost / unitCount : 0;
  const estimatedDevelopmentCost = landCost + (unitCount * 120000); // $120k per unit construction
  
  // Only calculate if we have REAL rent data - never use mock data
  const monthlyRentPerUnit = rentPSF ? rentPSF * avgUnitSize : null;
  const annualRevenuePerUnit = monthlyRentPerUnit ? monthlyRentPerUnit * 12 : null;
  const revenueProjection = annualRevenuePerUnit && unitCount ? annualRevenuePerUnit * unitCount : null;
  
  // Operating expense ratio (typical 35-50% for apartments)
  const operatingExpenseRatio = 0.40;
  const netOperatingIncome = revenueProjection ? revenueProjection * (1 - operatingExpenseRatio) : null;
  
  // ROI calculation - only if we have REAL data
  const projectedROI = (netOperatingIncome && estimatedDevelopmentCost > 0) ? (netOperatingIncome / estimatedDevelopmentCost) * 100 : null;
  const profitMargin = (netOperatingIncome && revenueProjection && revenueProjection > 0) ? ((netOperatingIncome - (estimatedDevelopmentCost * 0.08)) / revenueProjection) * 100 : null;
  
  // Viability scoring (1-10) - only if we have REAL rent data
  let viabilityScore = null;
  if (projectedROI !== null) {
    viabilityScore = 5; // Start neutral
    if (projectedROI >= 20) viabilityScore = 9;
    else if (projectedROI >= 15) viabilityScore = 7;
    else if (projectedROI >= 12) viabilityScore = 6;
    else if (projectedROI >= 8) viabilityScore = 4;
    else if (projectedROI < 8) viabilityScore = 2;
  }
  
  // Land cost per unit impact - only if we have a viability score
  if (viabilityScore !== null) {
    if (landCostPerUnit < 15000) viabilityScore += 1;
    else if (landCostPerUnit > 30000) viabilityScore -= 1;
    
    viabilityScore = Math.max(1, Math.min(10, viabilityScore));
  }
  
  const paybackPeriod = (projectedROI && projectedROI > 0) ? `${Math.round(100 / projectedROI)} years` : 'N/A';
  
  return {
    landCostPerUnit,
    projectedROI: projectedROI ? Math.round(projectedROI * 10) / 10 : 0,
    estimatedDevelopmentCost,
    revenueProjection: revenueProjection || 0,
    profitMargin: profitMargin ? Math.round(profitMargin * 10) / 10 : 0,
    viabilityScore: viabilityScore || 0,
    paybackPeriod
  };
}

// Enhanced AI Analysis Function with Comprehensive Property Assessment
export function analyzeAgainstCriteria(deal: any): {
  score: number;
  classification: 'green' | 'yellow' | 'red';
  reasoning: string;
  criteriaMatches: string[];
  concerns: string[];
  zoningAnalysis?: ZoningAnalysis;
  infrastructureScore?: InfrastructureScore;
  financialAnalysis?: FinancialAnalysis;
} {
  const concerns: string[] = [];
  const matches: string[] = [];
  let score = 0;

  // Determine if this is a conventional apartment deal
  const productTypes = deal.productTypes || [];
  const isConventionalApartments = productTypes.includes('Apartments - Market Rate') || 
                                   productTypes.includes('Apartments') ||
                                   (deal.propertyName && deal.propertyName.toLowerCase().includes('apartment'));

  if (isConventionalApartments) {
    // Use new simplified classification system for all property types
    const newClassification = classifyDealByExactCriteria(deal);
    return {
      score: newClassification.classification === 'green' ? 80 : newClassification.classification === 'unclassified' ? 60 : 20,
      classification: newClassification.classification,
      reasoning: newClassification.reasoning.join('; '),
      criteriaMatches: newClassification.conditionsMet,
      concerns: newClassification.conditionsNotMet
    };
  }

  // Original analysis for other property types
  // Check location (MOST IMPORTANT)
  const location = deal.address || deal.city || '';
  const inTargetMarket = TARGET_MARKETS.some(market => 
    location.toLowerCase().includes(market.toLowerCase())
  );
  
  if (inTargetMarket) {
    matches.push(`Located in target market: ${location}`);
    score += 40; // Location is critical
  } else {
    concerns.push(`Location "${location}" not in target markets`);
    score -= 20;
  }

  // Check size (SECOND MOST IMPORTANT)
  const acres = parseFloat(deal.sizeAcres || 0);
  if (acres >= 30) {
    matches.push(`Good size for SFD development (${acres} acres)`);
    score += 30;
  } else if (acres >= 5) {
    matches.push(`Suitable for BTR (${acres} acres)`);
    score += 20;
  } else if (acres >= 4) {
    matches.push(`Possible for apartments (${acres} acres)`);
    score += 10;
  } else {
    concerns.push(`Small size (${acres} acres) - limited development options`);
    score -= 15;
  }

  // Check zoning (focus area)
  const zoning = deal.zoning || '';
  if (zoning.includes('R-') || zoning.includes('Residential')) {
    matches.push(`Residential zoning: ${zoning}`);
    score += 15;
  } else if (zoning) {
    concerns.push(`Non-residential zoning: ${zoning}`);
    score -= 10;
  }


  // Classification
  let classification: 'green' | 'yellow' | 'red';
  if (score >= 50) {
    classification = 'green';
  } else if (score >= 20) {
    classification = 'unclassified';
  } else {
    classification = 'red';
  }

  // Enhanced analysis with zoning, infrastructure, and financial scoring
  const productType = Array.isArray(deal.productTypes) ? deal.productTypes[0] : 'Mixed Use';
  const zoningAnalysis = zoning ? analyzeZoning(zoning, productType, acres) : undefined;
  const infrastructureScore = scoreInfrastructure(deal);
  const financialAnalysis = analyzeFinancialViability(deal);

  // Adjust score based on enhanced analysis
  if (zoningAnalysis) {
    if (zoningAnalysis.developmentCompatibility === 'high') {
      score += 15;
      matches.push(`High zoning compatibility: ${zoningAnalysis.restrictionsNote}`);
    } else if (zoningAnalysis.developmentCompatibility === 'medium') {
      score += 5;
      matches.push(`Medium zoning compatibility: ${zoningAnalysis.restrictionsNote}`);
    } else {
      score -= 10;
      concerns.push(`Low zoning compatibility: ${zoningAnalysis.restrictionsNote}`);
    }

    if (zoningAnalysis.entitlementRisk === 'low') {
      score += 10;
      matches.push(`Low entitlement risk (${zoningAnalysis.approvalTimeframe})`);
    } else if (zoningAnalysis.entitlementRisk === 'high') {
      score -= 15;
      concerns.push(`High entitlement risk (${zoningAnalysis.approvalTimeframe})`);
    }
  }

  // Infrastructure scoring impact
  if (infrastructureScore.overall >= 7) {
    score += 10;
    matches.push(`Strong infrastructure (${infrastructureScore.overall}/10)`);
  } else if (infrastructureScore.overall <= 4) {
    score -= 10;
    concerns.push(`Poor infrastructure (${infrastructureScore.overall}/10)`);
  }

  // Financial viability scoring impact
  if (financialAnalysis.projectedROI >= 20) {
    score += 25;
    matches.push(`Excellent ROI projection (${financialAnalysis.projectedROI}%)`);
  } else if (financialAnalysis.projectedROI >= 15) {
    score += 15;
    matches.push(`Strong ROI projection (${financialAnalysis.projectedROI}%)`);
  } else if (financialAnalysis.projectedROI >= 12) {
    score += 5;
    matches.push(`Adequate ROI projection (${financialAnalysis.projectedROI}%)`);
  } else if (financialAnalysis.projectedROI < 8) {
    score -= 20;
    concerns.push(`Poor ROI projection (${financialAnalysis.projectedROI}%)`);
  }

  if (financialAnalysis.landCostPerUnit < 20000) {
    score += 10;
    matches.push(`Low land cost per unit ($${financialAnalysis.landCostPerUnit.toLocaleString()})`);
  } else if (financialAnalysis.landCostPerUnit > 35000) {
    score -= 10;
    concerns.push(`High land cost per unit ($${financialAnalysis.landCostPerUnit.toLocaleString()})`);
  }

  // Re-calculate classification with enhanced scoring
  if (score >= 60) {
    classification = 'green';
  } else if (score >= 30) {
    classification = 'unclassified';
  } else {
    classification = 'red';
  }

  const reasoning = `Enhanced Score: ${score}/100. ${matches.length > 0 ? 'Strengths: ' + matches.join('; ') + '. ' : ''}${concerns.length > 0 ? 'Concerns: ' + concerns.join('; ') + '.' : ''}`;

  return {
    score,
    classification,
    reasoning,
    criteriaMatches: matches,
    concerns,
    zoningAnalysis,
    infrastructureScore,
    financialAnalysis
  };
}

// ENHANCED AUTO-ENRICHMENT WITH CENSUS + HELLODATA DATA
export async function autoEnrichWithRentComps(deal: any): Promise<any> {
  // Get EXACT analyst table demographics ONLY - the 3 fields you specified
  if (deal.address) {
    try {
      console.log(`⚠️ Census API removed - demographic enrichment skipped for: ${deal.address}`);
      // Census API removed per user request - set default values
      deal.population55Plus5Mile = 0;
      deal.income75Plus55Plus = 0;
      deal.demographicsNotes = 'Census API removed - demographic data unavailable';
    } catch (error) {
      console.log(`⚠️ Demographic enrichment failed for ${deal.address}:`, error);
    }
  }
  // Check what rent data we actually have (FIXED: separate PSF from per-unit)
  const hasRentPerSF = parseFloat(deal.projectedRentPerSF) > 0;
  const hasRentPerUnit = parseFloat(deal.topRentPSF) > 0;
  
  // If we already have both types of rent data, return as-is
  if (hasRentPerSF && hasRentPerUnit && deal.address) {
    return deal;
  }

  // Auto-pull rent comps from HelloData when missing
  if (!deal.address) {
    console.log('⚠️ Cannot enrich rent data - no address provided');
    return deal;
  }

  try {
    console.log(`📡 Auto-enriching rent data for: ${deal.address}`);
    const { hellodataService } = await import('./hellodataService');
    
    // Get property data with rent information
    // CRITICAL FIX (Dec 4, 2025): Pass city/state to prevent geocoding misinterpretation
    const propertyResult = await hellodataService.getPropertyData(deal.address, deal.city, deal.state);
    if (propertyResult.success && propertyResult.data?.rentData) {
      const rentData = propertyResult.data.rentData;
      
      // Enrich with rent per square foot data
      if (!hasRentPerSF && rentData.rentPerSqFt) {
        deal.projectedRentPerSF = rentData.rentPerSqFt.toString();
        console.log(`✅ Auto-enriched rent PSF: $${rentData.rentPerSqFt}`);
      }
      
      // Enrich with average rent (per unit) data  
      if (!hasRentPerUnit && rentData.averageRent) {
        deal.topRentPSF = rentData.averageRent.toString();
        console.log(`✅ Auto-enriched average rent: $${rentData.averageRent}`);
      }

      // Add metadata about data source
      deal._enrichmentSource = 'HelloData.ai';
      deal._enrichmentTimestamp = new Date().toISOString();
    }

    // Get enhanced comparables for validation (recent properties within 1 mile)
    // Using simplified filtering: only year built and radius - no complex criteria
    const comparablesResult = await hellodataService.getComparables(deal.address, 1, true);
    if (comparablesResult.success && Array.isArray(comparablesResult.data)) {
      deal._comparables = comparablesResult.data;
      console.log(`✅ Retrieved ${comparablesResult.data.length} comparable properties`);
    } else {
      deal._comparables = [];
    }

  } catch (error) {
    console.log(`⚠️ HelloData enrichment failed for ${deal.address}:`, error);
  }
  
  return deal;
}

// NEW MULTI-DEVELOPMENT-TYPE ANALYSIS WITH AUTO-ENRICHMENT - Tests ALL types for each property
export async function classifyAllDevelopmentTypes(deal: any): Promise<{
  bestClassification: 'green' | 'yellow' | 'red';
  viableOptions: Array<{
    developmentType: string;
    classification: 'green' | 'yellow' | 'red';
    reasoning: string[];
    conditionsMet: string[];
    conditionsNotMet: string[];
    assignedTeam: {
      analyst?: string;
      developer?: string;
      partner?: string;
    };
  }>;
  dataQuality: {
    score: number;
    coverage: number;
    confidence: number;
    missingCriticalFields: string[];
  };
  enrichmentApplied: boolean;
  enrichmentSource?: string;
  comparablesFound: number;
}> {
  // Address is required for any analysis
  if (!deal.address) {
    return {
      bestClassification: 'red',
      viableOptions: [{
        developmentType: 'Unknown',
        classification: 'red',
        reasoning: ['Property address is required for classification'],
        conditionsMet: [],
        conditionsNotMet: ['Missing property address'],
        assignedTeam: {}
      }],
      dataQuality: {
        score: 0,
        coverage: 0,
        confidence: 0,
        missingCriticalFields: ['address']
      },
      enrichmentApplied: false,
      comparablesFound: 0
    };
  }

  const developmentTypes = ['Conventional Apartments', 'Active Adult', 'Build to Rent', 'Lot Development'];
  const results = [];
  
  // First auto-enrich with HelloData rent comps if missing
  const enrichedDeal = await autoEnrichWithRentComps(deal);

  // Test against each development type with enriched data
  for (const devType of developmentTypes) {
    const testDeal = { ...enrichedDeal, productTypes: [devType] };
    const result = classifyDealByExactCriteria(testDeal);
    
    results.push({
      developmentType: devType,
      classification: result.classification,
      reasoning: result.reasoning,
      conditionsMet: result.conditionsMet,
      conditionsNotMet: result.conditionsNotMet,
      assignedTeam: {
        analyst: result.assignedAnalyst,
        developer: result.assignedDeveloper,
        partner: result.assignedPartner
      }
    });
  }

  // Sort by viability: GREEN > YELLOW > RED
  const sortOrder = { 'green': 3, 'yellow': 2, 'red': 1 };
  results.sort((a, b) => sortOrder[b.classification] - sortOrder[a.classification]);

  // Get best classification
  const bestClassification = results[0].classification;

  // Filter to viable options (GREEN and YELLOW)
  const viableOptions = results.filter(r => r.classification === 'green' || r.classification === 'yellow');
  
  // If no viable options, return all with RED classifications
  const finalOptions = viableOptions.length > 0 ? viableOptions : results;

  return {
    bestClassification,
    viableOptions: finalOptions,
    dataQuality: assessDataQualitySimple(enrichedDeal, 'multiple'),
    enrichmentApplied: enrichedDeal._enrichmentSource ? true : false,
    enrichmentSource: enrichedDeal._enrichmentSource || undefined,
    comparablesFound: Array.isArray(enrichedDeal._comparables) ? enrichedDeal._comparables.length : 0
  };
}

// ORIGINAL SINGLE-TYPE CLASSIFICATION - Still needed for individual type analysis
export function classifyDealByExactCriteria(deal: any): {
  classification: 'unclassified'; // CRITICAL: NEVER auto-classify - all deals require manual review
  reasoning: string[];
  conditionsMet: string[];
  conditionsNotMet: string[];
  insufficientData: string[];
  suggestedDevelopmentType?: string;
  dataQuality: {
    score: number;
    coverage: number;
    confidence: number;
    missingCriticalFields: string[];
  };
  assignedAnalyst?: string;
  assignedDeveloper?: string;
  assignedPartner?: string;
} {
  const productType = Array.isArray(deal.productTypes) ? deal.productTypes[0] : deal.productTypes || '';
  const criteria = ACQUISITION_CRITERIA.find(c => c.developmentType === productType);
  
  // Extract key data for new classification logic - using null for unknown data
  const askingPrice = deal.askingPrice ? parseFloat(deal.askingPrice) : null;
  const acres = deal.sizeAcres ? parseFloat(deal.sizeAcres) : null;
  const pricePerAcre = (askingPrice !== null && acres !== null && acres > 0) ? askingPrice / acres : null;
  const rentPerSF = deal.projectedRentPerSF ? parseFloat(deal.projectedRentPerSF) : 
                    (deal.topRentPSF ? parseFloat(deal.topRentPSF) : null);
  const rentPerUnit = deal.topRentPSF ? parseFloat(deal.topRentPSF) : null;
  
  const conditionsMet: string[] = [];
  const conditionsNotMet: string[] = [];
  const insufficientData: string[] = [];
  const reasoning: string[] = [];
  
  // Assess data quality for NEW system
  const dataQuality = assessDataQualitySimple(deal, productType);
  
  // DISABLED: No auto-classification - all deals require manual analyst review
  let classification: 'unclassified' = 'unclassified';
  let suggestedDevelopmentType: string | undefined;

  // Address is required for any classification
  if (!deal.address) {
    return {
      classification: 'red',
      reasoning: ['Property address is required for classification'],
      conditionsMet: [],
      conditionsNotMet: ['Missing property address'],
      insufficientData: ['address'],
      dataQuality,
    };
  }

  // Apply new classification rules by product type
  switch (productType?.toLowerCase()) {
    case 'conventional apartments':
    case 'market-rate apartments':
    case 'conventional':
    case 'active adult':
      // RENT PER SF THRESHOLDS
      if (rentPerSF === null) {
        insufficientData.push('Rent per square foot data required');
        classification = 'unclassified';
        reasoning.push('Missing rent data - requires manual enrichment');
      } else if (rentPerSF <= 1.74) {
        classification = 'unclassified';
        reasoning.push(`Rent $${rentPerSF.toFixed(2)} PSF ≤ $1.74 PSF threshold`);
        conditionsNotMet.push('Rent below minimum threshold for profitability');
      } else if (rentPerSF >= 1.75 && rentPerSF <= 2.05) {
        classification = 'unclassified';
        suggestedDevelopmentType = '3-story walkup';
        reasoning.push(`Rent $${rentPerSF.toFixed(2)} PSF in $1.75-$2.05 range`);
        conditionsMet.push('Meets threshold for 3-story walkup development');
      } else if (rentPerSF >= 2.05 && rentPerSF <= 2.49) {
        classification = 'unclassified';
        suggestedDevelopmentType = '4-5 story surface parking';
        reasoning.push(`Rent $${rentPerSF.toFixed(2)} PSF in $2.05-$2.49 range`);
        conditionsMet.push('Supports 4-5 story with surface parking');
      } else if (rentPerSF >= 2.50 && rentPerSF <= 2.99) {
        classification = 'unclassified';
        suggestedDevelopmentType = '4-5 story structured parking';
        reasoning.push(`Rent $${rentPerSF.toFixed(2)} PSF in $2.50-$2.99 range`);
        conditionsMet.push('Supports 4-5 story with structured parking');
      } else if (rentPerSF >= 3.00) {
        classification = 'unclassified';
        suggestedDevelopmentType = 'Podium development';
        reasoning.push(`Rent $${rentPerSF.toFixed(2)} PSF ≥ $3.00 - premium market`);
        conditionsMet.push('High-end market supports podium development');
      }
      break;

    case 'btr':
    case 'build to rent':
    case 'build-to-rent':
      // RENT PER UNIT THRESHOLDS
      if (rentPerUnit === null) {
        insufficientData.push('Rent per unit data required');
        classification = 'unclassified';
        reasoning.push('Missing BTR rent data - requires manual enrichment');
      } else if (rentPerUnit <= 1999.99) {
        classification = 'unclassified';
        reasoning.push(`Rent $${rentPerUnit.toFixed(0)} per unit ≤ $1,999 threshold`);
        conditionsNotMet.push('BTR rent below minimum viable threshold');
      } else if (rentPerUnit >= 2000 && rentPerUnit <= 2399.99) {
        classification = 'unclassified';
        reasoning.push(`Rent $${rentPerUnit.toFixed(0)} per unit in $2,000-$2,399 range`);
        conditionsMet.push('BTR rent meets moderate threshold');
      } else if (rentPerUnit >= 2400) {
        classification = 'unclassified';
        reasoning.push(`Rent $${rentPerUnit.toFixed(0)} per unit ≥ $2,400`);
        conditionsMet.push('BTR rent meets strong threshold');
      }
      break;

    case 'lot development':
    case 'lots':
    case 'subdivision':
      // PRICE PER ACRE THRESHOLDS
      if (pricePerAcre === null) {
        insufficientData.push('Price per acre data required');
        classification = 'unclassified';
        reasoning.push('Missing lot price data - requires manual enrichment');
      } else if (pricePerAcre >= 350000) {
        classification = 'unclassified';
        reasoning.push(`Price $${(pricePerAcre/1000).toFixed(0)}K per acre ≥ $350K threshold`);
        conditionsNotMet.push('Lot price exceeds maximum acquisition threshold');
      } else if (pricePerAcre < 350000) {
        classification = 'unclassified';
        reasoning.push(`Price $${(pricePerAcre/1000).toFixed(0)}K per acre < $350K threshold`);
        conditionsMet.push('Lot price within acquisition range');
      }
      break;

    default:
      classification = 'unclassified';
      reasoning.push('Unknown or mixed product type - requires manual classification');
      insufficientData.push('Product type classification');
  }

  return {
    classification,
    reasoning,
    conditionsMet,
    conditionsNotMet,
    insufficientData,
    suggestedDevelopmentType,
    dataQuality,
    assignedAnalyst: criteria?.assignedAnalyst,
    assignedDeveloper: criteria?.assignedDeveloper,
    assignedPartner: criteria?.assignedPartner
  };
}

// Simplified data quality assessment for new classification system
function assessDataQualitySimple(deal: any, productType: string): {
  score: number;
  coverage: number;
  confidence: number;
  missingCriticalFields: string[];
} {
  const criticalFields = [];
  let filledFields = 0;
  let totalFields = 0;

  // Address is always critical
  if (deal.address) {
    filledFields++;
  } else {
    criticalFields.push('address');
  }
  totalFields++;

  // Product type specific critical fields
  switch (productType?.toLowerCase()) {
    case 'conventional apartments':
    case 'market-rate apartments':  
    case 'conventional':
    case 'active adult':
      // Need rent per SF
      if (deal.projectedRentPerSF || deal.topRentPSF) {
        filledFields++;
      } else {
        criticalFields.push('rent per square foot');
      }
      totalFields++;
      break;

    case 'btr':
    case 'build to rent':
    case 'build-to-rent':
      // Need rent per unit
      if (deal.topRentPSF) {
        filledFields++;
      } else {
        criticalFields.push('rent per unit');
      }
      totalFields++;
      break;

    case 'lot development':
    case 'lots':
    case 'subdivision':
      // Need price and acreage
      if (deal.askingPrice) {
        filledFields++;
      } else {
        criticalFields.push('asking price');
      }
      if (deal.sizeAcres) {
        filledFields++;
      } else {
        criticalFields.push('property size');
      }
      totalFields += 2;
      break;
  }

  const coverage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  const score = Math.min(coverage, 100);
  const confidence = coverage >= 80 ? 0.9 : coverage >= 60 ? 0.7 : 0.5;

  return {
    score,
    coverage,
    confidence,
    missingCriticalFields: criticalFields
  };
}

// Assess data quality and completeness for accurate classification
function assessDataQuality(deal: any, productType: string): {
  score: number;
  coverage: number;
  confidence: number;
  missingCriticalFields: string[];
} {
  const criticalFields = getCriticalFieldsByProductType(productType);
  const allFields = [
    'address', 'sizeAcres', 'unitCount', 'askingPrice', 'productTypes',
    'projectedRentPerSF', 'topRentPSF', 'sewerAvailable', 'zoning',
    'population55Plus5Mile', 'income75Plus55Plus', 'parcelId', 'marketValue',
    'unitSize', 'projectedNOI', 'constructionCostPerSF', 'qualityScore'
  ];
  
  const missingCriticalFields: string[] = [];
  let criticalFieldsPresent = 0;
  let allFieldsPresent = 0;
  let totalConfidence = 0;
  
  // Check critical fields
  for (const field of criticalFields) {
    if (deal[field] !== null && deal[field] !== undefined && deal[field] !== '' && deal[field] !== 0) {
      criticalFieldsPresent++;
      totalConfidence += getFieldConfidence(deal, field);
    } else {
      missingCriticalFields.push(field);
    }
  }
  
  // Check all fields for overall coverage
  for (const field of allFields) {
    if (deal[field] !== null && deal[field] !== undefined && deal[field] !== '' && deal[field] !== 0) {
      allFieldsPresent++;
    }
  }
  
  const coverage = Math.round((allFieldsPresent / allFields.length) * 100);
  const criticalCoverage = Math.round((criticalFieldsPresent / criticalFields.length) * 100);
  const confidence = criticalFieldsPresent > 0 ? Math.round(totalConfidence / criticalFieldsPresent) : 0;
  
  // Score based on critical field coverage and confidence
  let score = (criticalCoverage * 0.7) + (confidence * 0.3);
  
  // Bonus for high overall coverage
  if (coverage > 80) score += 10;
  else if (coverage > 60) score += 5;
  
  return {
    score: Math.min(100, Math.round(score)),
    coverage,
    confidence,
    missingCriticalFields
  };
}

// Get critical fields required for each product type
function getCriticalFieldsByProductType(productType: string): string[] {
  const baseFields = ['address', 'sizeAcres', 'unitCount', 'productTypes'];
  
  switch (productType) {
    case 'Conventional Apartments':
      return [...baseFields, 'projectedRentPerSF', 'sewerAvailable', 'zoning'];
    case 'Active Adult':
      return [...baseFields, 'population55Plus5Mile', 'income75Plus55Plus', 'sewerAvailable', 'zoning'];
    case 'BTR':
    case 'Build to Rent':
      return [...baseFields, 'projectedRentPerSF', 'topRentPSF', 'sewerAvailable', 'zoning'];
    case 'Lot Development':
      return [...baseFields, 'askingPrice', 'zoning'];
    default:
      return baseFields;
  }
}

// Assess confidence level of individual field data
function getFieldConfidence(deal: any, field: string): number {
  // Check if field has enrichment metadata
  const enrichmentData = deal.enrichmentMetadata;
  if (enrichmentData && enrichmentData.sources && enrichmentData.sources.length > 0) {
    // Higher confidence for API-enriched data
    if (enrichmentData.sources.includes('HelloData.ai')) return 90;
    // ATTOM Data API removed - using HelloData confidence scores
    if (enrichmentData.sources.includes('Auto-enriched')) return 80;
  }
  
  // Medium confidence for broker-provided data
  if (deal.submissionMethod === 'form') return 75;
  if (deal.submissionMethod === 'email') return 70;
  if (deal.submissionMethod === 'sms') return 65;
  
  // Default confidence
  return 60;
}

// Enhanced evaluation functions using ALL available data
function evaluateConventionalApartments(params: any): 'green' | 'yellow' | 'red' {
  const { 
    unitCount, acres, rents, sewer, zoning, 
    marketValue, qualityScore, unitSize, projectedNOI,
    conditionsMet, conditionsNotMet, reasoning 
  } = params;

  // Check if critical data is missing
  if (!unitCount || !acres || !rents) {
    reasoning.push('Insufficient data for classification - missing unit count, acreage, or rent data');
    return 'unclassified';
  }

  // Enhanced Green criteria with enriched data
  if (unitCount >= 200 && acres >= 4 && rents >= 2.00) {
    conditionsMet.push('GREEN: Meets all core criteria for conventional apartments');
    
    // Bonus points for enriched data quality
    if (qualityScore && qualityScore >= 80) {
      conditionsMet.push('HIGH QUALITY: Property quality score exceeds 80');
    }
    if (projectedNOI && projectedNOI > 0) {
      conditionsMet.push(`FINANCIAL: Projected NOI of $${projectedNOI.toLocaleString()}`);
    }
    if (sewer) {
      conditionsMet.push('INFRASTRUCTURE: Sewer available');
    }
    
    reasoning.push('High priority deal - all green criteria met with supporting data');
    return 'green';
  }
  
  // Enhanced Yellow criteria with more flexibility
  if (unitCount >= 200 && acres >= 4 && rents >= 1.75) {
    conditionsMet.push('YELLOW: Meets minimum criteria');
    
    // Check for supporting factors that could upgrade to green
    let supportingFactors = 0;
    if (sewer) supportingFactors++;
    if (qualityScore && qualityScore >= 70) supportingFactors++;
    if (unitSize && unitSize >= 900) supportingFactors++; // Good unit size
    if (marketValue && rents * unitSize * 12 * unitCount * 10 >= marketValue) supportingFactors++; // Good rent-to-value ratio
    
    if (supportingFactors >= 2) {
      conditionsMet.push(`UPGRADE POTENTIAL: ${supportingFactors} supporting factors present`);
      reasoning.push('Strong potential deal with multiple supporting factors');
    } else {
      reasoning.push('Meets minimum requirements but lacks strong supporting factors');
    }
    
    return 'unclassified';
  }
  
  // Enhanced Red criteria with specific feedback
  if (unitCount < 200 || acres < 4 || rents < 1.75) {
    if (unitCount < 200) conditionsNotMet.push(`Unit count below minimum: ${unitCount} < 200`);
    if (acres < 4) conditionsNotMet.push(`Acreage below minimum: ${acres} < 4 acres`);
    if (rents < 1.75) conditionsNotMet.push(`Rents below threshold: $${rents} < $1.75 PSF`);
    
    reasoning.push('Does not meet minimum criteria for conventional apartments');
    return 'red';
  }

  return 'unclassified'; // Default to unclassified for edge cases
}

function evaluateActiveAdult(params: any): 'green' | 'yellow' | 'red' {
  const { 
    unitCount, acres, sewer, demographics55Plus, income55Plus, 
    marketValue, qualityScore, conditionsMet, conditionsNotMet, reasoning 
  } = params;

  // Check if critical data is missing
  if (!unitCount || !acres) {
    reasoning.push('Insufficient data - missing unit count or acreage for Active Adult evaluation');
    return 'unclassified';
  }

  // Green criteria with enhanced validation
  if (unitCount >= 150 && acres >= 4 && demographics55Plus >= 20000 && income55Plus >= 75000) {
    conditionsMet.push('GREEN: Meets all Active Adult criteria including strong demographics');
    
    // Additional quality factors
    if (qualityScore && qualityScore >= 75) {
      conditionsMet.push('QUALITY: High property quality suitable for active adults');
    }
    if (sewer) {
      conditionsMet.push('INFRASTRUCTURE: Sewer available - essential for Active Adult');
    }
    
    reasoning.push('Excellent Active Adult opportunity with strong demographics and infrastructure');
    return 'green';
  }
  
  // Yellow criteria with missing demographics consideration
  if (unitCount >= 150 && acres >= 4) {
    conditionsMet.push('YELLOW: Meets size requirements');
    
    // Check demographics availability
    if (!demographics55Plus || !income55Plus) {
      reasoning.push('Demographics data missing - manual verification of 55+ population and income required');
      return 'unclassified';
    }
    if (demographics55Plus < 20000) conditionsNotMet.push('55+ population below preferred (20k)');
    if (income55Plus < 75000) conditionsNotMet.push('55+ income below preferred ($75k)');
    conditionsMet.push('YELLOW: Meets core criteria, demographics need review');
    reasoning.push('Potential Active Adult deal - demographics or density need review');
    return 'unclassified';
  }
  
  // Red criteria: Hard requirements not met
  if (unitCount < 150 || acres < 4) {
    if (unitCount < 150) conditionsNotMet.push('Unit count below minimum (150)');
    if (acres < 4) conditionsNotMet.push('Acreage below minimum (4 acres)');
    reasoning.push('Does not meet minimum criteria for Active Adult development');
    return 'red';
  }

  return 'red';
}

function evaluateBTR(params: any): 'green' | 'yellow' | 'red' {
  const { unitCount, acres, rents, sewer, conditionsMet, conditionsNotMet, reasoning } = params;

  // Green criteria: >=70 units, >=5 acres, <=2400 rents
  if (unitCount >= 70 && acres >= 5 && rents <= 2400) {
    conditionsMet.push('GREEN: Meets all BTR criteria');
    reasoning.push('Strong BTR opportunity - all criteria met');
    return 'green';
  }
  
  // Yellow criteria: >=70 units, >=5 acres OR density below preferred
  if (unitCount >= 70 && acres >= 5) {
    if (rents > 2400) conditionsNotMet.push('Rents above preferred ($2,400)');
    conditionsMet.push('YELLOW: Meets core criteria');
    reasoning.push('Potential BTR deal - rents or density need review');
    return 'unclassified';
  }
  
  // Red criteria: Hard requirements not met
  if (unitCount < 70 || acres < 5) {
    if (unitCount < 70) conditionsNotMet.push('Unit count below minimum (70)');
    if (acres < 5) conditionsNotMet.push('Acreage below minimum (5 acres)');
    reasoning.push('Does not meet minimum criteria for BTR development');
    return 'red';
  }

  return 'red';
}

function evaluateLotDevelopment(params: any): 'green' | 'yellow' | 'red' {
  const { unitCount, acres, pricePerAcre, conditionsMet, conditionsNotMet, reasoning } = params;

  // Green criteria: >=50 units, >=6 acres, <=350k per acre
  if (unitCount >= 50 && acres >= 6 && pricePerAcre <= 350000) {
    conditionsMet.push('GREEN: Meets all Lot Development criteria');
    reasoning.push('Excellent lot development opportunity');
    return 'green';
  }
  
  // Yellow criteria: >=50 units, >=6 acres OR density below preferred
  if (unitCount >= 50 && acres >= 6) {
    if (pricePerAcre > 350000) conditionsNotMet.push('Price per acre above preferred ($350k)');
    conditionsMet.push('YELLOW: Meets core criteria');
    reasoning.push('Potential lot development deal - price or density need review');
    return 'unclassified';
  }
  
  // Red criteria: Hard requirements not met
  if (unitCount < 50 || acres < 6) {
    if (unitCount < 50) conditionsNotMet.push('Unit count below minimum (50)');
    if (acres < 6) conditionsNotMet.push('Acreage below minimum (6 acres)');
    reasoning.push('Does not meet minimum criteria for lot development');
    return 'red';
  }

  return 'red';
}

// REMOVED: Old hardcoded getAutomaticRouting function
// Now using dynamic routing from dealRouting.ts that respects user profile settings
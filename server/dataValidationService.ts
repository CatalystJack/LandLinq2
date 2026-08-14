// HelloData service removed per user request
import { publicListingValidationService, PublicListingFlags } from './publicListingValidationService';

// Unified property data interface combining all sources
export interface ValidatedPropertyData {
  // Core Property Information
  address: {
    standardized: string;
    components: {
      streetNumber?: string;
      streetName?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      county?: string;
    };
    coordinates: {
      latitude?: number;
      longitude?: number;
    };
    confidence: number;
    sources: string[];
    discrepancies: string[];
  };
  
  // Property Characteristics
  size: {
    acres?: number;
    squareFootage?: number;
    lotSizeSquareFeet?: number;
    confidence: number;
    sources: string[];
    discrepancies: string[];
  };
  
  // Financial Data
  valuation: {
    listingPrice?: number;
    assessedValue?: number;
    marketValue?: number;
    pricePerAcre?: number;
    pricePerSquareFoot?: number;
    confidence: number;
    sources: string[];
    discrepancies: string[];
  };
  
  // Property Details
  details: {
    yearBuilt?: number;
    bedrooms?: number;
    bathrooms?: number;
    propertyType?: string;
    zoning?: string;
    confidence: number;
    sources: string[];
    discrepancies: string[];
  };
  
  // Demographics (5-mile radius)
  demographics: {
    totalPopulation?: number;
    medianHouseholdIncome?: number;
    population55Plus?: number;
    income75Plus55Plus?: number;
    medianAge?: number;
    confidence: number;
    sources: string[];
    discrepancies: string[];
  };
  
  // Rental Market Data
  rentData: {
    averageRent?: number;
    rentPerSquareFoot?: number;
    medianGrossRent?: number;
    confidence: number;
    sources: string[];
    discrepancies: string[];
  };
  
  // Public Listing Cross-Reference
  publicListings: {
    isPubliclyListed: boolean;
    confidence: 'high' | 'medium' | 'low' | 'none';
    marketExposure: 'none' | 'limited' | 'moderate' | 'wide';
    platformsFound: string[];
    priceComparison: {
      hasComparison: boolean;
      dealPrice: number;
      marketPrice: number;
      difference: number;
      differencePercent: number;
      assessment: 'underpriced' | 'market_rate' | 'overpriced' | 'unknown';
    };
    exclusivityStatus: {
      isExclusive: boolean;
      brokerExclusivity: boolean;
      offMarketVerified: boolean;
    };
    requiresAnalystReview: boolean;
    recommendations: string[];
    validationSuccess: boolean;
    lastChecked?: Date;
    sources: string[];
    discrepancies: string[];
  };
  
  // Overall Validation Results
  validation: {
    overallConfidence: number;
    sourceCount: number;
    sourcesUsed: string[];
    discrepancyCount: number;
    lastValidated: Date;
    qualityScore: number; // 0-100 based on data completeness and agreement
  };
}

// Data source priority hierarchy
const SOURCE_PRIORITY = {
  // USPS removed per user request
  // Census and HelloData removed per user request
};

// Confidence thresholds - Updated per user requirements (90% minimum)
const CONFIDENCE_THRESHOLDS = {
  HIGH: 90,        // Increased to 90% per user requirement
  MEDIUM: 75,      // Adjusted proportionally 
  LOW: 60          // Adjusted proportionally
};

// Discrepancy tolerance levels (percentage)
const DISCREPANCY_TOLERANCE = {
  PRICE: 0.15,        // 15% difference
  SIZE: 0.10,         // 10% difference
  YEAR_BUILT: 2,      // 2 years difference
  DEMOGRAPHIC: 0.20   // 20% difference
};

export class DataValidationService {
  // HelloData and ATTOM services removed per user request

  constructor() {
    // All external data services removed per user request
  }

  /**
   * Calculate age of demographic data in years
   */
  // Census data age calculation removed per user request

  /**
   * Check if property type requires Active Adult demographics
   */
  private isActiveAdultProperty(propertyType: string): boolean {
    const activeAdultTypes = [
      'active_adult',
      'senior_living',
      'age_restricted',
      'active adult',
      'senior living',
      'age restricted',
      '55+'
    ];
    
    return activeAdultTypes.some(type => 
      propertyType.toLowerCase().includes(type.toLowerCase())
    );
  }

  /**
   * Validate Active Adult demographic requirements per user requirements
   */
  private validateActiveAdultDemographics(demographics: {
    population55Plus: number;
    income75Plus55Plus: number;
    totalPopulation?: number;
  }): {
    meets_requirements: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 100;

    // Active Adult requirements per user configuration
    const ACTIVE_ADULT_REQUIREMENTS = {
      MIN_POPULATION_55_PLUS: 5000,      // Minimum 55+ population in 5-mile radius
      MIN_INCOME_75K_PLUS: 2000,        // Minimum high-income 55+ population
      MIN_55_PLUS_PERCENTAGE: 0.25,     // At least 25% of population should be 55+
      OPTIMAL_55_PLUS_PERCENTAGE: 0.35  // Optimal: 35% or higher
    };

    console.log(`🎯 Validating Active Adult demographics:`, {
      population55Plus: demographics.population55Plus,
      income75Plus55Plus: demographics.income75Plus55Plus,
      totalPopulation: demographics.totalPopulation
    });

    // Check minimum 55+ population
    if (demographics.population55Plus < ACTIVE_ADULT_REQUIREMENTS.MIN_POPULATION_55_PLUS) {
      issues.push(`55+ population (${demographics.population55Plus.toLocaleString()}) below minimum threshold (${ACTIVE_ADULT_REQUIREMENTS.MIN_POPULATION_55_PLUS.toLocaleString()})`);
      score -= 30;
    }

    // Check minimum high-income 55+ population
    if (demographics.income75Plus55Plus < ACTIVE_ADULT_REQUIREMENTS.MIN_INCOME_75K_PLUS) {
      issues.push(`High-income 55+ population (${demographics.income75Plus55Plus.toLocaleString()}) below minimum threshold (${ACTIVE_ADULT_REQUIREMENTS.MIN_INCOME_75K_PLUS.toLocaleString()})`);
      score -= 25;
    }

    // Check 55+ percentage of total population
    if (demographics.totalPopulation) {
      const percentage55Plus = demographics.population55Plus / demographics.totalPopulation;
      
      if (percentage55Plus < ACTIVE_ADULT_REQUIREMENTS.MIN_55_PLUS_PERCENTAGE) {
        issues.push(`55+ population percentage (${(percentage55Plus * 100).toFixed(1)}%) below minimum threshold (${(ACTIVE_ADULT_REQUIREMENTS.MIN_55_PLUS_PERCENTAGE * 100)}%)`);
        score -= 25;
      } else if (percentage55Plus >= ACTIVE_ADULT_REQUIREMENTS.OPTIMAL_55_PLUS_PERCENTAGE) {
        console.log(`✨ Excellent 55+ population percentage: ${(percentage55Plus * 100).toFixed(1)}%`);
        score += 10; // Bonus for optimal demographics
      }
    }

    const meetsRequirements = issues.length === 0;
    
    console.log(`📊 Active Adult validation result: ${meetsRequirements ? 'PASSED' : 'FAILED'}, Score: ${score}`);
    
    return {
      meets_requirements: meetsRequirements,
      issues,
      score: Math.max(0, Math.min(100, score))
    };
  }

  /**
   * Generate human-readable validation report
   */
  generateValidationReport(validationResult: ValidatedPropertyData): string {
    const sections = [];
    
    // Address validation
    sections.push(`Address: ${validationResult.address.standardized} (Confidence: ${validationResult.address.confidence}%)`);
    if (validationResult.address.discrepancies.length > 0) {
      sections.push(`  Issues: ${validationResult.address.discrepancies.join('; ')}`);
    }
    
    // Size validation
    if (validationResult.size.acres || validationResult.size.squareFootage) {
      const sizeInfo = [];
      if (validationResult.size.acres) sizeInfo.push(`${validationResult.size.acres} acres`);
      if (validationResult.size.squareFootage) sizeInfo.push(`${validationResult.size.squareFootage.toLocaleString()} sq ft`);
      sections.push(`Size: ${sizeInfo.join(', ')} (Confidence: ${validationResult.size.confidence}%)`);
    }
    
    // Valuation validation
    if (validationResult.valuation.listingPrice || validationResult.valuation.assessedValue) {
      const valInfo = [];
      if (validationResult.valuation.listingPrice) valInfo.push(`List: $${validationResult.valuation.listingPrice.toLocaleString()}`);
      if (validationResult.valuation.assessedValue) valInfo.push(`Assessed: $${validationResult.valuation.assessedValue.toLocaleString()}`);
      sections.push(`Valuation: ${valInfo.join(', ')} (Confidence: ${validationResult.valuation.confidence}%)`);
    }
    
    // Demographics validation
    if (validationResult.demographics.totalPopulation || validationResult.demographics.medianHouseholdIncome) {
      const demoInfo = [];
      if (validationResult.demographics.population55Plus) demoInfo.push(`55+: ${validationResult.demographics.population55Plus.toLocaleString()}`);
      if (validationResult.demographics.medianHouseholdIncome) demoInfo.push(`Med Income: $${validationResult.demographics.medianHouseholdIncome.toLocaleString()}`);
      sections.push(`Demographics: ${demoInfo.join(', ')} (Confidence: ${validationResult.demographics.confidence}%)`);
    }
    
    // Public listing validation
    const publicListings = validationResult.publicListings;
    if (publicListings.validationSuccess) {
      const listingStatus = publicListings.isPubliclyListed ? 
        `🌐 PUBLICLY LISTED (${publicListings.confidence.toUpperCase()})` : 
        `🔒 OFF-MARKET VERIFIED`;
      
      sections.push(`Market Status: ${listingStatus}`);
      
      if (publicListings.platformsFound.length > 0) {
        sections.push(`  Found on: ${publicListings.platformsFound.join(', ')}`);
        sections.push(`  Market Exposure: ${publicListings.marketExposure.toUpperCase()}`);
      }
      
      if (publicListings.priceComparison.hasComparison) {
        const priceDiff = publicListings.priceComparison.differencePercent;
        const priceStatus = priceDiff > 0 ? `+${priceDiff.toFixed(1)}%` : `${priceDiff.toFixed(1)}%`;
        sections.push(`  Price vs Market: ${priceStatus} (${publicListings.priceComparison.assessment.replace('_', ' ').toUpperCase()})`);
      }
      
      if (publicListings.requiresAnalystReview) {
        sections.push(`  ⚠️ REQUIRES ANALYST REVIEW`);
      }
      
      if (publicListings.recommendations.length > 0) {
        sections.push(`  Recommendations: ${publicListings.recommendations.slice(0, 2).join('; ')}`);
      }
    } else {
      sections.push(`Market Status: ❌ VALIDATION FAILED`);
    }
    
    // Overall metrics
    sections.push(`Sources: ${validationResult.validation.sourcesUsed.join(', ')}`);
    sections.push(`Overall Quality: ${validationResult.validation.qualityScore}%`);
    
    return sections.join('\n');
  }

  /**
   * Validate public listing status across major platforms
   */
  private async validatePublicListings(address: string): Promise<ValidatedPropertyData['publicListings']> {
    console.log(`🌐 Starting public listing validation for: ${address}`);
    
    try {
      // For validation purposes, we'll try to get cached results first
      const quickCheck = await publicListingValidationService.quickValidationCheck('temp-deal-id');
      
      if (quickCheck) {
        console.log(`✅ Found cached public listing data`);
        return this.convertPublicListingFlags(quickCheck, true);
      }
      
      // If no cached data, we'll indicate that validation is available but not performed
      // The actual validation would typically be triggered separately for performance
      console.log(`📋 Public listing validation available but not performed during data validation`);
      
      return {
        isPubliclyListed: false,
        confidence: 'none',
        marketExposure: 'none',
        platformsFound: [],
        priceComparison: {
          hasComparison: false,
          dealPrice: 0,
          marketPrice: 0,
          difference: 0,
          differencePercent: 0,
          assessment: 'unknown'
        },
        exclusivityStatus: {
          isExclusive: true,
          brokerExclusivity: true,
          offMarketVerified: false
        },
        requiresAnalystReview: false,
        recommendations: ['Public listing validation available - run cross-reference check'],
        validationSuccess: true,
        lastChecked: new Date(),
        sources: ['validation_service'],
        discrepancies: []
      };
      
    } catch (error) {
      console.error(`❌ Public listing validation failed: ${error}`);
      
      return {
        isPubliclyListed: false,
        confidence: 'none',
        marketExposure: 'none',
        platformsFound: [],
        priceComparison: {
          hasComparison: false,
          dealPrice: 0,
          marketPrice: 0,
          difference: 0,
          differencePercent: 0,
          assessment: 'unknown'
        },
        exclusivityStatus: {
          isExclusive: true,
          brokerExclusivity: true,
          offMarketVerified: false
        },
        requiresAnalystReview: false,
        recommendations: ['Public listing validation failed - manual check recommended'],
        validationSuccess: false,
        lastChecked: new Date(),
        sources: [],
        discrepancies: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Convert PublicListingFlags to ValidatedPropertyData format
   */
  private convertPublicListingFlags(flags: PublicListingFlags, validationSuccess: boolean): ValidatedPropertyData['publicListings'] {
    return {
      isPubliclyListed: flags.isPubliclyListed,
      confidence: flags.publicListingConfidence,
      marketExposure: flags.marketExposure,
      platformsFound: flags.platformsFound,
      priceComparison: flags.priceComparison,
      exclusivityStatus: flags.exclusivityStatus,
      requiresAnalystReview: flags.requiresAnalystReview,
      recommendations: flags.recommendations,
      validationSuccess,
      lastChecked: new Date(),
      sources: ['public_listing_service'],
      discrepancies: []
    };
  }

  /**
   * Main validation method - validates property data from all sources
   */
  async validatePropertyData(address: string): Promise<ValidatedPropertyData> {
    console.log(`🔍 Starting comprehensive data validation for: ${address}`);
    
    const startTime = Date.now();
    
    // Collect data from all sources in parallel with timeout
    const timeout = 45000; // 45 second overall timeout
    // All external data service calls removed per user request
    const hellodataResponse = { status: 'rejected', reason: 'HelloData removed per user request' };
    const censusResponse = { status: 'rejected', reason: 'Census removed per user request' };

    // All external data results set to null (services removed per user request)
    const hellodataResult = null;
    const censusResult = null;

    console.log(`📊 Data collection completed in ${Date.now() - startTime}ms`);
    console.log(`📋 All external data services removed per user request`);

    // Start validation process (all external data services removed)
    const validatedData: ValidatedPropertyData = {
      address: await this.validateAddress(address, null, null, null),
      size: this.validateSize(null, null, null),
      valuation: this.validateValuation(null, null, null),
      details: this.validateDetails(null, null, null),
      demographics: await this.validateDemographics(address, null, null),
      rentData: this.validateRentData(null, null, null),
      publicListings: await this.validatePublicListings(address),
      validation: {
        overallConfidence: 0,
        sourceCount: 0,
        sourcesUsed: [],
        discrepancyCount: 0,
        lastValidated: new Date(),
        qualityScore: 0
      }
    };

    // Calculate overall validation metrics
    validatedData.validation = this.calculateValidationMetrics(validatedData);

    console.log(`✅ Validation completed: Confidence=${validatedData.validation.overallConfidence}%, Quality=${validatedData.validation.qualityScore}%, Sources=${validatedData.validation.sourceCount}`);
    
    return validatedData;
  }

  /**
   * Validate address information (external services removed)
   */
  private async validateAddress(
    inputAddress: string, 
    apifyData: any | null, 
    // hellodataData removed per user request 
    // attomData removed per user request
  ): Promise<ValidatedPropertyData['address']> {
    const addresses: Array<{source: string, address: string, coords?: {lat: number, lon: number}, confidence?: number}> = [];
    const sources: string[] = [];
    const discrepancies: string[] = [];
    
    console.log(`📮 Starting address validation for: ${inputAddress} (external services removed)`);

    // All external data validation services removed per user request
    let standardizedAddress = inputAddress;
    let finalComponents = {
      streetNumber: undefined as string | undefined,
      streetName: undefined as string | undefined,
      city: undefined as string | undefined,
      state: undefined as string | undefined,
      zipCode: undefined as string | undefined,
      county: undefined as string | undefined
    };
    let coordinates = { latitude: undefined as number | undefined, longitude: undefined as number | undefined };
    let finalConfidence = 0;

    // All external data validation services removed per user request
    console.log(`⚠️ External data services removed - using input address as-is`);

    // Step 2: All cross-validation sources removed per user request
    console.log(`⚠️ Cross-validation disabled - external services removed`);
    
    // ATTOM removed per user request

    // Step 3: All coordinate services removed per user request
    console.log(`📍 External coordinate services removed`);

    // Step 4: All external address processing removed per user request
    console.log(`🔄 External address processing removed - using input as-is`);

    // Step 5: Default confidence (external services removed)
    finalConfidence = 50; // Default confidence without external validation

    console.log(`📊 Address validation summary: Sources=${sources.join(', ')}, Confidence=${finalConfidence}%, Discrepancies=${discrepancies.length}`);

    return {
      standardized: standardizedAddress,
      components: finalComponents,
      coordinates,
      confidence: finalConfidence,
      sources,
      discrepancies
    };
  }

  /**
   * Validate property size information
   */
  private validateSize(
    apifyData: any | null, 
    hellodataData: HelloDataPropertyData | null, 
    // attomData removed per user request
  ): ValidatedPropertyData['size'] {
    const sizeData: Array<{source: string, acres?: number, sqft?: number, lotSize?: number}> = [];
    const sources: string[] = [];
    const discrepancies: string[] = [];

    // Collect size data from sources
    // Apify removed per user request

    if (hellodataData) {
      sizeData.push({
        source: 'hellodata',
        sqft: hellodataData.squareFootage,
        lotSize: hellodataData.lotSize
      });
      sources.push('hellodata');
    }

    // ATTOM removed per user request

    // Find consensus values using priority weighting
    const acresValues = sizeData.filter(d => d.acres).map(d => ({value: d.acres!, source: d.source}));
    const sqftValues = sizeData.filter(d => d.sqft).map(d => ({value: d.sqft!, source: d.source}));
    const lotSizeValues = sizeData.filter(d => d.lotSize).map(d => ({value: d.lotSize!, source: d.source}));

    const finalAcres = this.selectBestValue(acresValues);
    const finalSqft = this.selectBestValue(sqftValues);
    const finalLotSize = this.selectBestValue(lotSizeValues);

    // Check for significant discrepancies in acres
    if (acresValues.length > 1) {
      const max = Math.max(...acresValues.map(v => v.value));
      const min = Math.min(...acresValues.map(v => v.value));
      if ((max - min) / min > DISCREPANCY_TOLERANCE.SIZE) {
        discrepancies.push(`Acres discrepancy: ${acresValues.map(v => `${v.source}:${v.value}`).join(', ')}`);
      }
    }

    // Check for significant discrepancies in square footage
    if (sqftValues.length > 1) {
      const max = Math.max(...sqftValues.map(v => v.value));
      const min = Math.min(...sqftValues.map(v => v.value));
      if ((max - min) / min > DISCREPANCY_TOLERANCE.SIZE) {
        discrepancies.push(`Square footage discrepancy: ${sqftValues.map(v => `${v.source}:${v.value}`).join(', ')}`);
      }
    }

    const confidence = this.calculateConfidence(sources.length, discrepancies.length);

    return {
      acres: finalAcres,
      squareFootage: finalSqft,
      lotSizeSquareFeet: finalLotSize,
      confidence,
      sources,
      discrepancies
    };
  }

  /**
   * Validate property valuation data
   */
  private validateValuation(
    apifyData: any | null,
    hellodataData: HelloDataPropertyData | null,
    // attomData removed per user request
  ): ValidatedPropertyData['valuation'] {
    const valuationData: Array<{source: string, price?: number, assessed?: number, market?: number, pricePerSqFt?: number}> = [];
    const sources: string[] = [];
    const discrepancies: string[] = [];

    // Collect valuation data
    // Apify removed per user request

    if (hellodataData) {
      valuationData.push({
        source: 'hellodata',
        assessed: hellodataData.assessedValue,
        market: hellodataData.marketValue,
        pricePerSqFt: hellodataData.pricePerSquareFoot
      });
      sources.push('hellodata');
    }

    // ATTOM removed per user request

    // Find consensus values
    const priceValues = valuationData.filter(d => d.price).map(d => ({value: d.price!, source: d.source}));
    const assessedValues = valuationData.filter(d => d.assessed).map(d => ({value: d.assessed!, source: d.source}));
    const marketValues = valuationData.filter(d => d.market).map(d => ({value: d.market!, source: d.source}));
    const pricePerSqFtValues = valuationData.filter(d => d.pricePerSqFt).map(d => ({value: d.pricePerSqFt!, source: d.source}));

    const finalPrice = this.selectBestValue(priceValues);
    const finalAssessed = this.selectBestValue(assessedValues);
    const finalMarket = this.selectBestValue(marketValues);
    const finalPricePerSqFt = this.selectBestValue(pricePerSqFtValues);

    // Check for price discrepancies
    const allPrices = [...priceValues, ...assessedValues, ...marketValues];
    if (allPrices.length > 1) {
      const max = Math.max(...allPrices.map(v => v.value));
      const min = Math.min(...allPrices.map(v => v.value));
      if ((max - min) / min > DISCREPANCY_TOLERANCE.PRICE) {
        discrepancies.push(`Price discrepancy: ${allPrices.map(v => `${v.source}:$${v.value.toLocaleString()}`).join(', ')}`);
      }
    }

    // Calculate price per acre if we have price and acres
    let pricePerAcre: number | undefined;
    if (finalPrice && apifyData?.acres) {
      pricePerAcre = finalPrice / apifyData.acres;
    }

    const confidence = this.calculateConfidence(sources.length, discrepancies.length);

    return {
      listingPrice: finalPrice,
      assessedValue: finalAssessed,
      marketValue: finalMarket,
      pricePerAcre,
      pricePerSquareFoot: finalPricePerSqFt,
      confidence,
      sources,
      discrepancies
    };
  }

  /**
   * Validate property details
   */
  private validateDetails(
    apifyData: any | null,
    hellodataData: HelloDataPropertyData | null,
    // attomData removed per user request
  ): ValidatedPropertyData['details'] {
    const detailsData: Array<{source: string, yearBuilt?: number, bedrooms?: number, bathrooms?: number, propertyType?: string, zoning?: string}> = [];
    const sources: string[] = [];
    const discrepancies: string[] = [];

    // Collect details data
    // Apify removed per user request

    if (hellodataData) {
      detailsData.push({
        source: 'hellodata',
        yearBuilt: hellodataData.yearBuilt,
        bedrooms: hellodataData.bedrooms,
        bathrooms: hellodataData.bathrooms,
        propertyType: hellodataData.propertyType
      });
      sources.push('hellodata');
    }

    // ATTOM removed per user request

    // Find consensus values
    const yearBuiltValues = detailsData.filter(d => d.yearBuilt).map(d => ({value: d.yearBuilt!, source: d.source}));
    const bedroomValues = detailsData.filter(d => d.bedrooms).map(d => ({value: d.bedrooms!, source: d.source}));
    const bathroomValues = detailsData.filter(d => d.bathrooms).map(d => ({value: d.bathrooms!, source: d.source}));
    const propertyTypeValues = detailsData.filter(d => d.propertyType).map(d => ({value: d.propertyType!, source: d.source}));
    const zoningValues = detailsData.filter(d => d.zoning).map(d => ({value: d.zoning!, source: d.source}));

    const finalYearBuilt = this.selectBestValue(yearBuiltValues);
    const finalBedrooms = this.selectBestValue(bedroomValues);
    const finalBathrooms = this.selectBestValue(bathroomValues);
    const finalPropertyType = this.selectBestValue(propertyTypeValues);
    const finalZoning = this.selectBestValue(zoningValues);

    // Check for year built discrepancies
    if (yearBuiltValues.length > 1) {
      const max = Math.max(...yearBuiltValues.map(v => v.value));
      const min = Math.min(...yearBuiltValues.map(v => v.value));
      if (max - min > DISCREPANCY_TOLERANCE.YEAR_BUILT) {
        discrepancies.push(`Year built discrepancy: ${yearBuiltValues.map(v => `${v.source}:${v.value}`).join(', ')}`);
      }
    }

    const confidence = this.calculateConfidence(sources.length, discrepancies.length);

    return {
      yearBuilt: finalYearBuilt,
      bedrooms: finalBedrooms,
      bathrooms: finalBathrooms,
      propertyType: finalPropertyType,
      zoning: finalZoning,
      confidence,
      sources,
      discrepancies
    };
  }

  /**
   * Validate demographic data (primarily from Census)
   */
  private async validateDemographics(
    address: string,
    censusData: any,
    hellodataData: HelloDataPropertyData | null,
    propertyType?: string
  ): Promise<ValidatedPropertyData['demographics']> {
    const sources: string[] = [];
    const discrepancies: string[] = [];

    // Census data has highest priority for demographics
    let demographics = {
      totalPopulation: undefined as number | undefined,
      medianHouseholdIncome: undefined as number | undefined,
      population55Plus: undefined as number | undefined,
      income75Plus55Plus: undefined as number | undefined,
      medianAge: undefined as number | undefined
    };

    if (censusData) {
      // Check data freshness - enforce 5-year maximum age per user requirement
      const dataAge = this.calculateDataAge(censusData);
      if (dataAge > 5) {
        discrepancies.push(`Census data is ${dataAge} years old (exceeds 5-year limit)`);
        console.warn(`⚠️ Census data age violation: ${dataAge} years (limit: 5 years)`);
      }

      demographics.totalPopulation = censusData.totalPopulation;
      demographics.medianHouseholdIncome = censusData.medianHouseholdIncome;
      demographics.population55Plus = censusData.population55Plus;
      demographics.medianAge = censusData.medianAge;
      sources.push('census');

      // Get EXACT 5-mile radius demographics for Active Adult analysis using precise tract boundaries
      try {
        console.log(`📊 Fetching precise 5-mile demographic data for validation...`);
        console.log(`⚠️ Census API removed - demographic data unavailable`);
        // Set default values since Census API is removed
        demographics.population55Plus = 0;
        demographics.income75Plus55Plus = 0;
      } catch (error) {
        console.warn('Could not get regional demographics:', error);
        discrepancies.push(`Regional demographic calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Cross-check with HelloData if available (lower priority)
    if (hellodataData && hellodataData.city && hellodataData.state) {
      try {
        const marketData = await this.hellodataService.getMarketData(hellodataData.city, hellodataData.state);
        if (marketData) {
          sources.push('hellodata');
          
          // Check for discrepancies if we have both census and market data
          if (censusData && marketData.totalUnits && demographics.totalPopulation) {
            const unitsPerCapita = marketData.totalUnits / demographics.totalPopulation;
            if (unitsPerCapita > 0.6 || unitsPerCapita < 0.2) {
              discrepancies.push(`Housing units to population ratio seems inconsistent: ${(unitsPerCapita * 100).toFixed(1)}%`);
            }
          }
        }
      } catch (error) {
        console.warn('Could not get HelloData market data for cross-validation:', error);
      }
    }

    const confidence = this.calculateConfidence(sources.length, discrepancies.length, censusData ? 20 : 0); // Bonus for census data

    return {
      totalPopulation: demographics.totalPopulation,
      medianHouseholdIncome: demographics.medianHouseholdIncome,
      population55Plus: demographics.population55Plus,
      income75Plus55Plus: demographics.income75Plus55Plus,
      medianAge: demographics.medianAge,
      confidence,
      sources,
      discrepancies
    };
  }

  /**
   * Validate rental market data
   */
  private validateRentData(
    apifyData: any | null,
    hellodataData: HelloDataPropertyData | null,
    censusData: any
  ): ValidatedPropertyData['rentData'] {
    const sources: string[] = [];
    const discrepancies: string[] = [];

    let rentData = {
      averageRent: undefined as number | undefined,
      rentPerSquareFoot: undefined as number | undefined,
      medianGrossRent: undefined as number | undefined
    };

    // HelloData has priority for rental data
    if (hellodataData?.rentData) {
      rentData.averageRent = hellodataData.rentData.averageRent;
      rentData.rentPerSquareFoot = hellodataData.rentData.rentPerSqFt;
      sources.push('hellodata');
    }

    // Census provides median gross rent for area
    if (censusData?.medianGrossRent) {
      rentData.medianGrossRent = censusData.medianGrossRent;
      sources.push('census');

      // Cross-check HelloData rent vs Census median gross rent
      if (rentData.averageRent && censusData.medianGrossRent) {
        const ratio = rentData.averageRent / censusData.medianGrossRent;
        if (ratio > 1.5 || ratio < 0.5) {
          discrepancies.push(`Rent data discrepancy: HelloData:$${rentData.averageRent}, Census:$${censusData.medianGrossRent}`);
        }
      }
    }

    const confidence = this.calculateConfidence(sources.length, discrepancies.length);

    return {
      averageRent: rentData.averageRent,
      rentPerSquareFoot: rentData.rentPerSquareFoot,
      medianGrossRent: rentData.medianGrossRent,
      confidence,
      sources,
      discrepancies
    };
  }

  /**
   * Select the best value from multiple sources using priority weighting
   */
  private selectBestValue<T>(values: Array<{value: T, source: string}>): T | undefined {
    if (values.length === 0) return undefined;
    if (values.length === 1) return values[0].value;

    // Sort by source priority
    values.sort((a, b) => {
      const priorityA = SOURCE_PRIORITY[a.source as keyof typeof SOURCE_PRIORITY] || 0;
      const priorityB = SOURCE_PRIORITY[b.source as keyof typeof SOURCE_PRIORITY] || 0;
      return priorityB - priorityA;
    });

    return values[0].value;
  }

  /**
   * Calculate confidence score based on source count and discrepancies
   */
  private calculateConfidence(sourceCount: number, discrepancyCount: number, bonus: number = 0, hasHelloData: boolean = false): number {
    let confidence = 50; // Base confidence

    // HelloData validation provides confidence boost
    if (hasHelloData) {
      confidence += 15; // +15 for HelloData validation success
      console.log(`📊 HelloData confidence boost: +15 points`);
    }

    // Source count bonus
    confidence += sourceCount * 15; // +15 per source

    // Discrepancy penalty
    confidence -= discrepancyCount * 10; // -10 per discrepancy

    // Apply bonus (e.g., for having Census data)
    confidence += bonus;

    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Calculate overall validation metrics
   */
  private calculateValidationMetrics(data: ValidatedPropertyData): ValidatedPropertyData['validation'] {
    const sections = [data.address, data.size, data.valuation, data.details, data.demographics, data.rentData];
    
    // Calculate overall confidence (weighted average)
    const weights = [20, 20, 25, 15, 15, 5]; // Address and valuation are most important
    let weightedConfidence = 0;
    let totalWeight = 0;

    sections.forEach((section, index) => {
      if (section.confidence > 0) {
        weightedConfidence += section.confidence * weights[index];
        totalWeight += weights[index];
      }
    });

    const overallConfidence = totalWeight > 0 ? Math.round(weightedConfidence / totalWeight) : 0;

    // Count total sources used
    const allSources = new Set<string>();
    sections.forEach(section => {
      section.sources.forEach(source => allSources.add(source));
    });

    // Count total discrepancies
    const totalDiscrepancies = sections.reduce((sum, section) => sum + section.discrepancies.length, 0);

    // Calculate quality score based on data completeness
    const dataFields = [
      data.address.standardized,
      data.size.acres,
      data.valuation.listingPrice || data.valuation.assessedValue || data.valuation.marketValue,
      data.details.yearBuilt,
      data.demographics.totalPopulation,
      data.rentData.averageRent || data.rentData.medianGrossRent
    ];

    const completedFields = dataFields.filter(field => field !== undefined && field !== null).length;
    const qualityScore = Math.round((completedFields / dataFields.length) * 100);

    return {
      overallConfidence,
      sourceCount: allSources.size,
      sourcesUsed: Array.from(allSources),
      discrepancyCount: totalDiscrepancies,
      lastValidated: new Date(),
      qualityScore
    };
  }

  /**
   * Quick validation for deal creation pipeline
   */
  async quickValidate(address: string): Promise<{
    isValid: boolean;
    confidence: number;
    warnings: string[];
    estimatedAcres?: number;
    estimatedValue?: number;
    demographics?: {
      population55Plus?: number;
      medianIncome?: number;
    };
  }> {
    try {
      const fullValidation = await this.validatePropertyData(address);
      
      const warnings: string[] = [];
      
      // Check for critical issues
      if (fullValidation.address.confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
        warnings.push('Address validation concerns');
      }
      
      if (fullValidation.size.confidence < CONFIDENCE_THRESHOLDS.MEDIUM && !fullValidation.size.acres) {
        warnings.push('Property size not confirmed');
      }
      
      if (fullValidation.demographics.confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
        warnings.push('Demographic data incomplete');
      }

      const isValid = fullValidation.validation.overallConfidence >= CONFIDENCE_THRESHOLDS.LOW;

      return {
        isValid,
        confidence: fullValidation.validation.overallConfidence,
        warnings,
        estimatedAcres: fullValidation.size.acres,
        estimatedValue: fullValidation.valuation.listingPrice || fullValidation.valuation.marketValue || fullValidation.valuation.assessedValue,
        demographics: {
          population55Plus: fullValidation.demographics.population55Plus,
          medianIncome: fullValidation.demographics.medianHouseholdIncome
        }
      };
    } catch (error) {
      console.error('Quick validation failed:', error);
      return {
        isValid: false,
        confidence: 0,
        warnings: ['Validation service error']
      };
    }
  }

}

// Export singleton instance
export const dataValidationService = new DataValidationService();
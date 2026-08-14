import { 
  deals,
  publicListings,
  publicListingMatches,
  matchConfidenceEnum,
  type Deal,
  type PublicListing,
  type InsertPublicListingMatch,
  type PublicListingMatch
} from '@shared/schema';
import { storage } from './storage';

// Configuration for matching tolerances
const MATCHING_CONFIG = {
  // Address matching
  ADDRESS: {
    EXACT_MATCH_THRESHOLD: 0.95,
    HIGH_CONFIDENCE_THRESHOLD: 0.85,
    MEDIUM_CONFIDENCE_THRESHOLD: 0.70,
    LOW_CONFIDENCE_THRESHOLD: 0.50,
  },
  
  // Property size tolerances
  SIZE: {
    ACRES_TOLERANCE_PERCENT: 0.10,     // ±10% for acres
    SQFT_TOLERANCE_PERCENT: 0.15,      // ±15% for square footage
    UNITS_EXACT_MATCH: true,           // Unit count must match exactly
  },
  
  // Price comparison tolerances
  PRICE: {
    SIMILAR_THRESHOLD_PERCENT: 0.20,   // ±20% considered similar
    SIGNIFICANT_DIFF_PERCENT: 0.50,    // >50% difference is significant
    REASONABLE_RANGE_PERCENT: 0.30,    // ±30% is reasonable range
  },
  
  // Overall match scoring weights
  WEIGHTS: {
    ADDRESS: 0.40,        // 40% weight for address match
    SIZE_MATCH: 0.25,     // 25% weight for size matching
    PRICE_MATCH: 0.20,    // 20% weight for price similarity
    TYPE_MATCH: 0.10,     // 10% weight for property type
    MISC_MATCH: 0.05,     // 5% weight for other factors
  }
};

export interface MatchAnalysis {
  dealId: string;
  publicListingId: string;
  matchConfidence: typeof matchConfidenceEnum.enumValues[number];
  matchScore: number;  // 0-100
  
  // Individual match components
  addressMatch: boolean;
  addressSimilarity: number;
  sizeMatch: boolean;
  sizeSimilarity: number;
  priceMatch: boolean;
  priceSimilarity: number;
  typeMatch: boolean;
  unitsMatch: boolean;
  
  // Price analysis
  dealPrice: number;
  listingPrice: number;
  priceDifferenceAmount: number;
  priceDifferencePercent: number;
  priceComparison: 'higher' | 'lower' | 'similar';
  
  // Market exposure analysis
  isWidelyMarketed: boolean;
  marketingChannels: string[];
  daysOnMarketWhenMatched?: number;
  
  // Broker analysis
  sameListingBroker: boolean;
  brokerConflictFlag: boolean;
  
  // Analysis results
  isLikelyDuplicate: boolean;
  isPriceDiscrepancy: boolean;
  requiresAnalystReview: boolean;
  
  // Algorithm metadata
  matchingAlgorithm: string;
  algorithmVersion: string;
}

export interface PropertyMatchResults {
  dealId: string;
  totalListingsChecked: number;
  exactMatches: MatchAnalysis[];
  highConfidenceMatches: MatchAnalysis[];
  mediumConfidenceMatches: MatchAnalysis[];
  lowConfidenceMatches: MatchAnalysis[];
  noMatches: number;
  analysisComplete: boolean;
  processingTimeMs: number;
  requiresManualReview: boolean;
  summary: {
    isPubliclyListed: boolean;
    marketExposureLevel: 'none' | 'limited' | 'moderate' | 'wide';
    pricePositioning: 'below_market' | 'at_market' | 'above_market' | 'unknown';
    brokerExclusivity: boolean;
    recommendedAction: string;
  };
}

export class PropertyMatchingService {
  
  constructor() {
    console.log('🔍 Property matching service initialized');
  }

  /**
   * Main entry point: analyze a deal against all public listings
   */
  async analyzeDealMatches(dealId: string): Promise<PropertyMatchResults> {
    const startTime = Date.now();
    console.log(`🔍 Starting property match analysis for deal: ${dealId}`);
    
    try {
      // Get deal details
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        throw new Error(`Deal not found: ${dealId}`);
      }
      
      // Get all relevant public listings (within reasonable geographic area)
      const publicListings = await this.getRelevantPublicListings(deal);
      console.log(`📋 Found ${publicListings.length} public listings to analyze`);
      
      // Analyze each listing for potential matches
      const allMatches: MatchAnalysis[] = [];
      
      for (const listing of publicListings) {
        const analysis = await this.analyzePropertyMatch(deal, listing);
        if (analysis.matchScore >= MATCHING_CONFIG.ADDRESS.LOW_CONFIDENCE_THRESHOLD * 100) {
          allMatches.push(analysis);
          
          // Store match in database
          await this.storeMatchAnalysis(analysis);
        }
      }
      
      // Categorize matches by confidence
      const exactMatches = allMatches.filter(m => m.matchConfidence === 'exact');
      const highConfidenceMatches = allMatches.filter(m => m.matchConfidence === 'high');
      const mediumConfidenceMatches = allMatches.filter(m => m.matchConfidence === 'medium');
      const lowConfidenceMatches = allMatches.filter(m => m.matchConfidence === 'low');
      
      // Generate summary analysis
      const summary = this.generateMatchSummary(deal, allMatches);
      
      const results: PropertyMatchResults = {
        dealId,
        totalListingsChecked: publicListings.length,
        exactMatches,
        highConfidenceMatches,
        mediumConfidenceMatches,
        lowConfidenceMatches,
        noMatches: publicListings.length - allMatches.length,
        analysisComplete: true,
        processingTimeMs: Date.now() - startTime,
        requiresManualReview: this.requiresManualReview(allMatches),
        summary
      };
      
      console.log(`✅ Match analysis completed for ${dealId}: ${allMatches.length} potential matches found in ${results.processingTimeMs}ms`);
      
      return results;
      
    } catch (error) {
      console.error(`❌ Failed to analyze matches for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Get public listings that could potentially match the deal
   */
  private async getRelevantPublicListings(deal: Deal): Promise<PublicListing[]> {
    // For now, get all active listings. In production, we'd filter by:
    // - Geographic proximity
    // - Property type similarity  
    // - Price range
    // - Size similarity
    
    try {
      return await storage.getAllPublicListings({
        status: 'active',
        limit: 1000  // Reasonable limit for analysis
      });
    } catch (error) {
      console.error('❌ Failed to get relevant public listings:', error);
      return [];
    }
  }

  /**
   * Core matching algorithm: compare a deal to a public listing
   */
  private async analyzePropertyMatch(deal: Deal, listing: PublicListing): Promise<MatchAnalysis> {
    // Address matching analysis
    const addressAnalysis = this.analyzeAddressMatch(deal.address, listing.address);
    
    // Size matching analysis  
    const sizeAnalysis = this.analyzeSizeMatch(deal, listing);
    
    // Price matching analysis
    const priceAnalysis = this.analyzePriceMatch(deal, listing);
    
    // Property type matching
    const typeMatch = this.analyzePropertyTypeMatch(deal, listing);
    
    // Unit count matching (for multifamily)
    const unitsMatch = this.analyzeUnitsMatch(deal, listing);
    
    // Broker analysis
    const brokerAnalysis = this.analyzeBrokerMatch(deal, listing);
    
    // Calculate overall match score
    const matchScore = this.calculateOverallMatchScore({
      addressSimilarity: addressAnalysis.similarity,
      sizeMatch: sizeAnalysis.matches,
      sizeSimilarity: sizeAnalysis.similarity,
      priceMatch: priceAnalysis.similar,
      typeMatch,
      unitsMatch
    });
    
    // Determine confidence level
    const matchConfidence = this.determineMatchConfidence(matchScore);
    
    // Market exposure analysis
    const marketAnalysis = this.analyzeMarketExposure(listing);
    
    // Price difference analysis
    const priceDifference = this.calculatePriceDifference(
      deal.askingPrice ? parseFloat(deal.askingPrice) : 0,
      listing.listingPrice ? parseFloat(listing.listingPrice) : 0
    );

    const analysis: MatchAnalysis = {
      dealId: deal.id,
      publicListingId: listing.id,
      matchConfidence,
      matchScore,
      
      // Individual components
      addressMatch: addressAnalysis.exact,
      addressSimilarity: addressAnalysis.similarity,
      sizeMatch: sizeAnalysis.matches,
      sizeSimilarity: sizeAnalysis.similarity,
      priceMatch: priceAnalysis.similar,
      priceSimilarity: priceAnalysis.similarity,
      typeMatch,
      unitsMatch,
      
      // Price analysis
      dealPrice: deal.askingPrice ? parseFloat(deal.askingPrice) : 0,
      listingPrice: listing.listingPrice ? parseFloat(listing.listingPrice) : 0,
      priceDifferenceAmount: priceDifference.amount,
      priceDifferencePercent: priceDifference.percent,
      priceComparison: priceDifference.comparison,
      
      // Market exposure
      isWidelyMarketed: marketAnalysis.widelyMarketed,
      marketingChannels: marketAnalysis.channels,
      daysOnMarketWhenMatched: listing.daysOnMarket || undefined,
      
      // Broker analysis
      sameListingBroker: brokerAnalysis.sameBroker,
      brokerConflictFlag: brokerAnalysis.conflictFlag,
      
      // Analysis results
      isLikelyDuplicate: this.isLikelyDuplicate(matchScore, addressAnalysis.similarity, sizeAnalysis.similarity),
      isPriceDiscrepancy: this.isPriceDiscrepancy(priceDifference.percent),
      requiresAnalystReview: this.requiresAnalystReview([{ matchScore, matchConfidence } as any]),
      
      // Algorithm metadata
      matchingAlgorithm: 'fuzzy_multi_factor',
      algorithmVersion: '1.0.0'
    };
    
    return analysis;
  }

  /**
   * Address matching with fuzzy string comparison
   */
  private analyzeAddressMatch(dealAddress: string, listingAddress: string): {
    exact: boolean;
    similarity: number;
  } {
    const normalize = (addr: string) => {
      return addr.toLowerCase()
        .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
        .replace(/\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|pl|place)\b/g, '')
        .replace(/\s+/g, ' ')      // Normalize whitespace
        .trim();
    };
    
    const normalizedDeal = normalize(dealAddress);
    const normalizedListing = normalize(listingAddress);
    
    // Exact match check
    const exact = normalizedDeal === normalizedListing;
    
    // Fuzzy similarity using Levenshtein distance
    const similarity = this.calculateStringSimilarity(normalizedDeal, normalizedListing);
    
    return { exact, similarity };
  }

  /**
   * Size matching analysis with configurable tolerances
   */
  private analyzeSizeMatch(deal: Deal, listing: PublicListing): {
    matches: boolean;
    similarity: number;
  } {
    let totalSimilarity = 0;
    let factorsChecked = 0;
    
    // Compare acres if both have data
    if (deal.sizeAcres && listing.sizeAcres) {
      const dealAcres = parseFloat(deal.sizeAcres);
      const listingAcres = parseFloat(listing.sizeAcres);
      const acresSimilarity = this.calculateNumericSimilarity(
        dealAcres, 
        listingAcres, 
        MATCHING_CONFIG.SIZE.ACRES_TOLERANCE_PERCENT
      );
      totalSimilarity += acresSimilarity;
      factorsChecked++;
    }
    
    // Compare square footage if both have data
    if (deal.unitSize && listing.squareFootage) {
      const dealSqft = parseFloat(deal.unitSize);
      const listingSqft = listing.squareFootage;
      const sqftSimilarity = this.calculateNumericSimilarity(
        dealSqft,
        listingSqft,
        MATCHING_CONFIG.SIZE.SQFT_TOLERANCE_PERCENT
      );
      totalSimilarity += sqftSimilarity;
      factorsChecked++;
    }
    
    const similarity = factorsChecked > 0 ? totalSimilarity / factorsChecked : 0;
    const matches = similarity >= 0.80; // 80% similarity threshold
    
    return { matches, similarity };
  }

  /**
   * Price matching and comparison analysis
   */
  private analyzePriceMatch(deal: Deal, listing: PublicListing): {
    similar: boolean;
    similarity: number;
  } {
    const dealPrice = deal.askingPrice ? parseFloat(deal.askingPrice) : 0;
    const listingPrice = listing.listingPrice ? parseFloat(listing.listingPrice) : 0;
    
    if (dealPrice === 0 || listingPrice === 0) {
      return { similar: false, similarity: 0 };
    }
    
    const similarity = this.calculateNumericSimilarity(
      dealPrice,
      listingPrice,
      MATCHING_CONFIG.PRICE.SIMILAR_THRESHOLD_PERCENT
    );
    
    const similar = similarity >= 0.70; // 70% price similarity threshold
    
    return { similar, similarity };
  }

  /**
   * Property type matching
   */
  private analyzePropertyTypeMatch(deal: Deal, listing: PublicListing): boolean {
    if (!listing.propertyType) return false;
    
    const dealTypes = deal.productTypes as string[] || [];
    const listingType = listing.propertyType.toLowerCase();
    
    // Simple keyword matching - can be enhanced with ML
    const keywords = {
      multifamily: ['multifamily', 'apartment', 'residential'],
      commercial: ['commercial', 'office', 'retail', 'industrial'],
      land: ['land', 'vacant', 'development'],
      mixed: ['mixed', 'multi-use']
    };
    
    for (const dealType of dealTypes) {
      for (const [category, keywordList] of Object.entries(keywords)) {
        if (dealType.toLowerCase().includes(category)) {
          return keywordList.some(keyword => listingType.includes(keyword));
        }
      }
    }
    
    return false;
  }

  /**
   * Unit count matching for multifamily properties
   */
  private analyzeUnitsMatch(deal: Deal, listing: PublicListing): boolean {
    if (!deal.unitCount || !listing.unitCount) return false;
    
    return Math.abs(deal.unitCount - listing.unitCount) <= 2; // Allow 2 unit variance
  }

  /**
   * Broker matching and conflict detection
   */
  private analyzeBrokerMatch(deal: Deal, listing: PublicListing): {
    sameBroker: boolean;
    conflictFlag: boolean;
  } {
    const dealBroker = deal.brokerPhone || '';
    const listingBroker = listing.brokerPhone || '';
    
    // Simple phone number matching
    const sameBroker = dealBroker === listingBroker && dealBroker !== '';
    
    // Flag potential conflicts if different brokers have same property
    const conflictFlag = !sameBroker && dealBroker !== '' && listingBroker !== '';
    
    return { sameBroker, conflictFlag };
  }

  /**
   * Calculate overall match score using weighted factors
   */
  private calculateOverallMatchScore(factors: {
    addressSimilarity: number;
    sizeMatch: boolean;
    sizeSimilarity: number;
    priceMatch: boolean;
    typeMatch: boolean;
    unitsMatch: boolean;
  }): number {
    const weights = MATCHING_CONFIG.WEIGHTS;
    
    let score = 0;
    score += factors.addressSimilarity * weights.ADDRESS;
    score += (factors.sizeMatch ? factors.sizeSimilarity : 0) * weights.SIZE_MATCH;
    score += (factors.priceMatch ? 1 : 0) * weights.PRICE_MATCH;
    score += (factors.typeMatch ? 1 : 0) * weights.TYPE_MATCH;
    score += (factors.unitsMatch ? 1 : 0) * weights.MISC_MATCH;
    
    return Math.round(score * 100); // Convert to 0-100 scale
  }

  /**
   * Determine match confidence level based on score
   */
  private determineMatchConfidence(score: number): typeof matchConfidenceEnum.enumValues[number] {
    const thresholds = MATCHING_CONFIG.ADDRESS;
    
    if (score >= thresholds.EXACT_MATCH_THRESHOLD * 100) return 'exact';
    if (score >= thresholds.HIGH_CONFIDENCE_THRESHOLD * 100) return 'high';
    if (score >= thresholds.MEDIUM_CONFIDENCE_THRESHOLD * 100) return 'medium';
    if (score >= thresholds.LOW_CONFIDENCE_THRESHOLD * 100) return 'low';
    return 'unlikely';
  }

  /**
   * Analyze market exposure for a listing
   */
  private analyzeMarketExposure(listing: PublicListing): {
    widelyMarketed: boolean;
    channels: string[];
  } {
    const channels = [listing.source];
    
    // In a real implementation, we'd check multiple sources
    const widelyMarketed = listing.daysOnMarket ? listing.daysOnMarket > 30 : false;
    
    return { widelyMarketed, channels };
  }

  /**
   * Calculate price difference between deal and listing
   */
  private calculatePriceDifference(dealPrice: number, listingPrice: number): {
    amount: number;
    percent: number;
    comparison: 'higher' | 'lower' | 'similar';
  } {
    const amount = dealPrice - listingPrice;
    const percent = listingPrice > 0 ? (amount / listingPrice) * 100 : 0;
    
    let comparison: 'higher' | 'lower' | 'similar';
    if (Math.abs(percent) <= MATCHING_CONFIG.PRICE.SIMILAR_THRESHOLD_PERCENT * 100) {
      comparison = 'similar';
    } else if (amount > 0) {
      comparison = 'higher';
    } else {
      comparison = 'lower';
    }
    
    return { amount, percent, comparison };
  }

  /**
   * String similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,        // deletion
          matrix[j - 1][i] + 1,        // insertion
          matrix[j - 1][i - 1] + indicator  // substitution
        );
      }
    }
    
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - matrix[str2.length][str1.length]) / maxLength;
  }

  /**
   * Numeric similarity with tolerance
   */
  private calculateNumericSimilarity(val1: number, val2: number, tolerancePercent: number): number {
    if (val1 === 0 && val2 === 0) return 1;
    if (val1 === 0 || val2 === 0) return 0;
    
    const difference = Math.abs(val1 - val2);
    const average = (val1 + val2) / 2;
    const percentDifference = difference / average;
    
    if (percentDifference <= tolerancePercent) {
      return 1 - (percentDifference / tolerancePercent);
    }
    
    return Math.max(0, 1 - percentDifference);
  }

  /**
   * Determine if properties are likely duplicates
   */
  private isLikelyDuplicate(matchScore: number, addressSimilarity: number, sizeSimilarity: number): boolean {
    return matchScore >= 85 && addressSimilarity >= 0.90 && sizeSimilarity >= 0.80;
  }

  /**
   * Determine if there's a significant price discrepancy
   */
  private isPriceDiscrepancy(pricePercentDiff: number): boolean {
    return Math.abs(pricePercentDiff) >= MATCHING_CONFIG.PRICE.SIGNIFICANT_DIFF_PERCENT * 100;
  }

  /**
   * Determine if matches require analyst review
   */
  private requiresManualReview(matches: MatchAnalysis[]): boolean {
    return matches.some(match => 
      match.matchConfidence === 'exact' ||
      match.matchConfidence === 'high' ||
      match.isLikelyDuplicate ||
      match.isPriceDiscrepancy ||
      match.brokerConflictFlag
    );
  }

  /**
   * Generate summary analysis of all matches
   */
  private generateMatchSummary(deal: Deal, matches: MatchAnalysis[]): PropertyMatchResults['summary'] {
    const highConfidenceMatches = matches.filter(m => 
      m.matchConfidence === 'exact' || m.matchConfidence === 'high'
    );
    
    const isPubliclyListed = highConfidenceMatches.length > 0;
    
    let marketExposureLevel: 'none' | 'limited' | 'moderate' | 'wide' = 'none';
    if (matches.length > 0) {
      const widelyMarketed = matches.filter(m => m.isWidelyMarketed).length;
      if (widelyMarketed >= 3) marketExposureLevel = 'wide';
      else if (widelyMarketed >= 2) marketExposureLevel = 'moderate';
      else if (matches.length > 0) marketExposureLevel = 'limited';
    }
    
    let pricePositioning: 'below_market' | 'at_market' | 'above_market' | 'unknown' = 'unknown';
    if (highConfidenceMatches.length > 0) {
      const avgPriceDiff = highConfidenceMatches.reduce((sum, m) => sum + m.priceDifferencePercent, 0) / highConfidenceMatches.length;
      if (avgPriceDiff > 10) pricePositioning = 'above_market';
      else if (avgPriceDiff < -10) pricePositioning = 'below_market';
      else pricePositioning = 'at_market';
    }
    
    const brokerExclusivity = !matches.some(m => m.sameListingBroker);
    
    let recommendedAction = 'proceed_with_analysis';
    if (matches.some(m => m.isLikelyDuplicate)) {
      recommendedAction = 'verify_exclusivity';
    } else if (matches.some(m => m.isPriceDiscrepancy)) {
      recommendedAction = 'price_analysis_required';
    } else if (isPubliclyListed) {
      recommendedAction = 'compare_market_terms';
    }
    
    return {
      isPubliclyListed,
      marketExposureLevel,
      pricePositioning,
      brokerExclusivity,
      recommendedAction
    };
  }

  /**
   * Store match analysis in database
   */
  private async storeMatchAnalysis(analysis: MatchAnalysis): Promise<void> {
    try {
      const matchData: InsertPublicListingMatch = {
        dealId: analysis.dealId,
        publicListingId: analysis.publicListingId,
        matchConfidence: analysis.matchConfidence,
        matchScore: analysis.matchScore.toString(),
        addressMatch: analysis.addressMatch,
        sizeMatch: analysis.sizeMatch,
        priceMatch: analysis.priceMatch,
        typeMatch: analysis.typeMatch,
        unitsMatch: analysis.unitsMatch,
        dealPrice: analysis.dealPrice.toString(),
        listingPrice: analysis.listingPrice.toString(),
        priceDifferenceAmount: analysis.priceDifferenceAmount.toString(),
        priceDifferencePercent: analysis.priceDifferencePercent.toString(),
        priceComparison: analysis.priceComparison,
        isWidelyMarketed: analysis.isWidelyMarketed,
        marketingChannels: analysis.marketingChannels,
        daysOnMarketWhenMatched: analysis.daysOnMarketWhenMatched,
        sameListingBroker: analysis.sameListingBroker,
        brokerConflictFlag: analysis.brokerConflictFlag,
        isLikelyDuplicate: analysis.isLikelyDuplicate,
        isPriceDiscrepancy: analysis.isPriceDiscrepancy,
        requiresAnalystReview: analysis.requiresAnalystReview,
        matchingAlgorithm: analysis.matchingAlgorithm,
        algorithmVersion: analysis.algorithmVersion
      };
      
      await storage.createPublicListingMatch(matchData);
      
    } catch (error) {
      console.error(`❌ Failed to store match analysis for deal ${analysis.dealId}:`, error);
    }
  }

  /**
   * Get existing matches for a deal
   */
  async getExistingMatches(dealId: string): Promise<PublicListingMatch[]> {
    try {
      return await storage.getPublicListingMatchesByDealId(dealId);
    } catch (error) {
      console.error(`❌ Failed to get existing matches for deal ${dealId}:`, error);
      return [];
    }
  }

  /**
   * Quick match check for a single deal-listing pair
   */
  async quickMatchCheck(dealId: string, listingId: string): Promise<MatchAnalysis | null> {
    try {
      const deal = await storage.getDealById(dealId);
      const listing = await storage.getPublicListingById(listingId);
      
      if (!deal || !listing) {
        return null;
      }
      
      return await this.analyzePropertyMatch(deal, listing);
      
    } catch (error) {
      console.error(`❌ Failed quick match check for deal ${dealId} and listing ${listingId}:`, error);
      return null;
    }
  }

  /**
   * Batch analyze multiple deals
   */
  async batchAnalyzeDeals(dealIds: string[]): Promise<Map<string, PropertyMatchResults>> {
    const results = new Map<string, PropertyMatchResults>();
    
    console.log(`🔍 Starting batch analysis for ${dealIds.length} deals`);
    
    for (const dealId of dealIds) {
      try {
        const result = await this.analyzeDealMatches(dealId);
        results.set(dealId, result);
        
        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to analyze deal ${dealId}:`, error);
      }
    }
    
    console.log(`✅ Batch analysis completed: ${results.size}/${dealIds.length} deals processed`);
    
    return results;
  }
}

// Create singleton instance
export const propertyMatchingService = new PropertyMatchingService();
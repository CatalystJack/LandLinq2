import { storage } from './storage';
import type { Deal } from '@shared/schema';
import { hellodataService } from './hellodataService';
import { geocodioService } from './geocodioService';
import { qctService } from './qctService';
import { ozService } from './ozService';
import { classificationProgressTracker } from './classificationProgress';
import { MSAMatchingService } from './msaMatchingService';

interface ClassificationResult {
  classification: 'yellow' | 'red' | 'unclassified'; // YELLOW/REVIEWING, RED/PASSED, or UNCLASSIFIED for manual review
  classificationDisplay: string; // "YELLOW / REVIEWING", "RED / PASSED", or "UNCLASSIFIED"
  qctStatus: 'YES' | 'NO' | 'N/A'; // QCT status: YES=in QCT, NO=not in QCT, N/A=unable to determine
  ozStatus: 'YES' | 'NO' | 'N/A'; // OZ status: YES=Opportunity Zone, NO=not OZ, N/A=unable to determine
  censusTractFips?: string; // Census tract FIPS code
  // DDA (Difficult Development Area) — 30% LIHTC basis boost
  ddaStatus?: 'MDDA' | 'NMDDA' | 'NO' | 'N/A';
  ddaAreaName?: string | null;
  ddaVlil?: number | null;
  ddaLihtcMaxRent?: number | null;
  ddaFmr?: number | null;
  // Novogradac GoZone enrichment
  ozEligible?: 'CONTIGUOUS' | 'LIC' | 'NO' | 'N/A';
  nmtcStatus?: 'YES' | 'NO' | 'N/A';
  nmtcProjectId?: string | null;
  nmtcAmount?: number | null;
  nmtcPurpose?: string | null;
  lihtcNearbyJson?: any[];
  // Geocoded coordinates (saved back to deal when forward/reverse geocoding resolves them)
  geocodedLat?: number | null;
  geocodedLng?: number | null;
  comparableCount: number; // Number of qualifying comparables found
  comparableNotes: string; // VERBOSE summary of comparable properties (full list for UI display)
  aiExplanatoryNotes?: string; // CONCISE criteria summary for acceptance reason (Jan 29, 2026)
  comparablesJson?: any[]; // Structured comparables with lat/lng for map display (Dec 11, 2025)
  topRentPSF?: number; // Highest weighted average rent PSF from qualifying comparables
  avgRentPSF?: number; // Average rent PSF across all qualifying comparables
  topRentPerUnit?: number; // Highest monthly rent per unit from comparables
  avgRentPerUnit?: number; // Average monthly rent per unit from comparables
  rejectionReason?: string; // Reason for RED/PASSED classification
}

export class AutoClassificationEngine {

  /**
   * NEW CLASSIFICATION WORKFLOW (2024)
   * 
   * Step 1: Hard Rule - Acreage < 4 acres → RED/PASSED
   * Step 1.5: Hard Rule - NOT in Target MSA → RED/PASSED
   * Step 2: Comparable Search - HelloData within 3 miles
   *         - Price PSF ≥ $1.75
   *         - Vintage ≥ 2020
   *         - Units ≥ 150
   *         - If 3+ found → YELLOW/REVIEWING
   *         - If < 3 found → RED/PASSED
   * Step 3: Missing Acreage Logic - Skip acreage rule if not provided
   * Step 4: QCT Column Population - Populate YES/NO/N/A (N/A if unable to determine)
   * Step 5: QCT Override - If RED/PASSED and in QCT (YES) → YELLOW/REVIEWING
   * Step 6: Output Classification, QCT, Rejection Reason, Comparable Info
   */
  static async classifyDeal(deal: Deal, options?: {
    forceHelloData?: boolean; // If true, always populate HelloData results even for early-rejection paths
    bypassMSARejection?: boolean; // If true, don't reject for being outside MSA (for manual re-runs)
    preloadedHelloData?: {  // Pre-fetched HelloData to avoid duplicate API calls
      success: boolean;
      qualifyingCount: number;
      topRentPSF?: number;
      avgRentPSF?: number;
      topRentPerUnit?: number;
      avgRentPerUnit?: number;
      summary?: string;
      aiExplanatoryNotes?: string;
      totalComparables?: number;
      candidateCount?: number;
      candidatesWithPricing?: number;
      comparables?: any[]; // Dec 22, 2025: Full comparables array for map display
    };
  }): Promise<ClassificationResult> {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🔍 Starting NEW CLASSIFICATION WORKFLOW for deal ${deal.id}`);
    
    // Check if this is an ACQUISITION deal - use different classification rules
    const dealType = (deal as any).dealType || 'land';
    console.log(`📋 Deal Type: "${dealType}" (from database)`);
    
    if (dealType === 'acquisition') {
      console.log(`🏢 ▶▶▶ ACQUISITION PATH - Using acquisition classification rules`);
      console.log(`${'═'.repeat(80)}\n`);
      return await AutoClassificationEngine.classifyAcquisitionDeal(deal, options);
    }
    
    console.log(`🏗️ ▶▶▶ LAND PATH - Using land development classification rules`);
    console.log(`${'═'.repeat(80)}\n`);
    
    // Extract deal info for progress tracking
    const dealNumber = typeof (deal as any).dealNumber === 'number' ? (deal as any).dealNumber : null;
    const address = deal.address || 'Unknown address';
    
    // Start progress tracking for land classification (5 steps)
    classificationProgressTracker.startJob(deal.id, dealNumber, address, 'land', 5);
    
    // Check if we have preloaded HelloData (from re-run endpoint)
    const hasPreloadedData = options?.preloadedHelloData?.success === true;
    if (hasPreloadedData) {
      console.log(`📊 [PRELOADED] Using pre-fetched HelloData: ${options.preloadedHelloData!.qualifyingCount} comparables`);
    }
    
    const result: ClassificationResult = {
      classification: 'unclassified',
      classificationDisplay: 'UNCLASSIFIED',
      qctStatus: 'N/A',
      ozStatus: 'N/A',
      comparableCount: 0,
      comparableNotes: '',
      rejectionReason: ''
    };
    
    try {
    // LAND CLASSIFICATION STEPS:
    // 1. Validating address and acreage
    // 2. Checking MSA eligibility  
    // 3. Fetching HelloData comparables
    // 4. Evaluating comparable criteria
    // 5. Checking QCT status
    
    classificationProgressTracker.updateStep(deal.id, 1, 'Validating address and acreage');

    // NORMALIZE STREET TYPES (Dec 18, 2025)
    // Convert abbreviations (Rd, St, Ave, etc.) to full names (Road, Street, Avenue)
    // This ensures HelloData returns consistent results regardless of address format
    const { normalizeStreetType } = await import('./addressFieldNormalizer.js');
    const normalizedStreet = normalizeStreetType(deal.address);
    if (normalizedStreet && normalizedStreet !== deal.address) {
      console.log(`🧹 [STREET-TYPE-NORMALIZE] "${deal.address}" → "${normalizedStreet}"`);
    }

    // BUILD FULL ADDRESS EARLY for consistent use across all paths (QCT check, HelloData, etc.)
    // This ensures Geocodio can properly identify the location with city/state/ZIP context
    const addressParts = [];
    if (normalizedStreet) addressParts.push(normalizedStreet);
    if (deal.city) addressParts.push(deal.city);
    if (deal.state) addressParts.push(deal.state);
    if (deal.zip) addressParts.push(deal.zip);
    const fullAddress = addressParts.join(', ');
    
    // ENHANCED LOGGING: Show exactly what address fields are present
    console.log(`📍 [ADDRESS-DEBUG] Building full address for HelloData/Geocodio:`);
    console.log(`   Street: "${deal.address || 'MISSING'}"`);
    console.log(`   City: "${deal.city || 'MISSING'}"`);
    console.log(`   State: "${deal.state || 'MISSING'}"`);
    console.log(`   ZIP: "${deal.zip || 'MISSING'}"`);
    console.log(`📍 Full Address for classification: "${fullAddress}"`);
    
    // Warn if address is incomplete (likely to cause geocoding failure)
    if (!deal.city || !deal.state) {
      console.warn(`⚠️ [ADDRESS-INCOMPLETE] Missing city or state - geocoding may fail!`);
    }

    // STEP 1: Acreage Check (Dec 12, 2025: Don't return early - run HelloData first for rent data)
    // Flag if under 4 acres, but continue to get HelloData for analyst context
    const acres = deal.sizeAcres ? parseFloat(deal.sizeAcres.toString()) : null;
    let acreageRejection: { shouldReject: boolean; reason: string; dataSource: string } | null = null;

    if (acres !== null && acres < 4) {
      console.log(`⚠️ ACREAGE UNDER MINIMUM: ${acres} acres < 4 acres - will reject AFTER HelloData runs`);
      
      // Determine data source for acreage
      let dataSource = 'unknown';
      const ingestionNotes = deal.ingestionNotes || '';
      
      if (ingestionNotes.includes('Regrid enrichment') || deal.regridData) {
        dataSource = 'Regrid parcel data (ll_gisacre)';
      } else if (ingestionNotes.includes('HelloData')) {
        dataSource = 'HelloData API';
      } else {
        dataSource = 'broker-provided';
      }
      
      console.log(`📊 Acreage source: ${dataSource}`);
      
      // Store rejection info but don't return yet - run HelloData first
      acreageRejection = {
        shouldReject: true,
        reason: `Property size is ${acres.toFixed(2)} acres (verified via ${dataSource}), below the 4-acre minimum threshold. If parcels can be assembled to increase acreage, please resubmit the deal.`,
        dataSource
      };
    } else if (acres === null) {
      console.log(`ℹ️ No acreage provided - skipping acreage rule`);
    } else {
      console.log(`✅ Acreage check passed: ${acres} acres >= 4 acres`);
    }

    classificationProgressTracker.updateStep(deal.id, 2, 'Checking MSA eligibility');
    
    // STEP 1.5: Hard Rule - MSA Market Validation
    // If NOT in target acquisition market → RED/PASSED (unless bypassMSARejection is set for manual re-runs)
    // Track if we need to add an MSA warning note
    let msaWarningNote = '';
    
    if (deal.inTargetMarket === false) {
      console.log(`❌ HARD RULE VIOLATION: Property NOT in target acquisition markets`);
      console.log(`📍 Location: ${deal.county || 'Unknown'}, ${deal.state || 'Unknown'}`);
      console.log(`🗺️ MSA: ${deal.msaName || 'Not identified'}`);
      
      // BUGFIX (Dec 11, 2025): Never use street address as location info in rejection
      // Fall back to city/state if county is missing, or "the submitted location" as last resort
      // BUGFIX (Dec 16, 2025): Remove "County" suffix before appending " County" to avoid duplication
      let locationInfo: string;
      if (deal.county && deal.state) {
        const countyName = deal.county.replace(/\s*County\s*$/i, '').trim();
        locationInfo = `${countyName} County, ${deal.state}`;
      } else if (deal.city && deal.state) {
        locationInfo = `${deal.city}, ${deal.state}`;
      } else if (deal.state) {
        locationInfo = deal.state;
      } else {
        locationInfo = 'the submitted location';
      }
      
      // Only include MSA if it looks like a valid MSA name (not a street address)
      const msaInfo = deal.msaName && 
        deal.msaName.length > 3 && 
        !deal.msaName.match(/^\d+\s/) && // Not starting with a number (street address)
        deal.msaName.includes('-') // MSAs typically have hyphens like "Charlotte-Concord-Gastonia"
        ? ` (${deal.msaName})` 
        : '';
      
      // USER REQUEST (Jan 1, 2026): If bypassMSARejection is set (manual re-run), 
      // don't reject - just add a note and continue with full analysis
      if (options?.bypassMSARejection) {
        console.log(`🔄 [MSA-BYPASS] Manual re-run - bypassing MSA rejection, adding warning note instead`);
        msaWarningNote = `⚠️ NOTE: Property located in ${locationInfo}${msaInfo} is OUTSIDE target acquisition markets. `;
        // Continue with classification - don't return early
      } else {
        // Normal flow - reject for being outside MSA
        result.classification = 'red';
        result.classificationDisplay = 'RED / PASSED';
        result.rejectionReason = `Property located in ${locationInfo}${msaInfo} is not within Catalyst's target acquisition markets. We are currently only acquiring in specific MSAs for Active Adult, BTR/Conventional Apartments, and Lot Development projects.`;
        
        // Still populate QCT status for informational purposes (no auto-override)
        // Dec 17, 2025: Pass coordinates for reverse geocoding when address is coordinate-based
        const dealCoords = (deal.latitude && deal.longitude) 
          ? { latitude: deal.latitude, longitude: deal.longitude }
          : (deal.manualLatitude && deal.manualLongitude)
            ? { latitude: deal.manualLatitude, longitude: deal.manualLongitude }
            : undefined;
        await this.populateQCTStatus(fullAddress, result, dealCoords);
        
        // QCT is informational only - analysts will manually upgrade if deal makes sense
        if (result.qctStatus === 'YES') {
          console.log(`ℹ️ QCT INFO: Deal is in Qualified Census Tract (for analyst reference)`);
        }
        
        // USER REQUEST (Dec 10, 2025): Include preloaded HelloData even for rejected deals
        // This ensures rent data is populated when analyst clicks Re-run
        // Dec 22, 2025: Also include full comparables array for map display
        if (hasPreloadedData && options?.preloadedHelloData) {
          console.log(`📊 [PRELOADED] Merging HelloData into rejected deal result`);
          result.comparableCount = options.preloadedHelloData.qualifyingCount;
          result.comparableNotes = options.preloadedHelloData.summary || result.comparableNotes;
          result.aiExplanatoryNotes = options.preloadedHelloData.aiExplanatoryNotes || result.aiExplanatoryNotes;
          result.topRentPSF = options.preloadedHelloData.topRentPSF;
          result.avgRentPSF = options.preloadedHelloData.avgRentPSF;
          result.topRentPerUnit = options.preloadedHelloData.topRentPerUnit;
          result.avgRentPerUnit = options.preloadedHelloData.avgRentPerUnit;
          
          // Dec 22, 2025: Include full comparables array for map display even for MSA-rejected deals
          if (options.preloadedHelloData.comparables && options.preloadedHelloData.comparables.length > 0) {
            console.log(`📊 [PRELOADED] Including ${options.preloadedHelloData.comparables.length} comparables for map display`);
            result.comparablesJson = options.preloadedHelloData.comparables.map((comp: any) => ({
              propertyName: comp.propertyName || comp.buildingName || comp.name || 'Unknown',
              address: comp.address || '',
              city: comp.city || '',
              state: comp.state || '',
              zipCode: comp.zipCode || null,
              units: comp.unitCount || comp.units || comp.numberOfUnits || 0,
              yearBuilt: comp.yearBuilt || comp.vintage || 0,
              rentPSF: comp.pricePerSqFt || comp.rentPSF || comp.rentPerSqFt || comp.avgRentPSF || 0,
              avgRent: comp.avgRent || comp.rentPerUnit || comp.avgRentPerUnit || 0,
              distance: comp.distance || 0,
              latitude: comp.latitude || null,
              longitude: comp.longitude || null,
              isQualifying: comp.isQualifying || comp.qualifies || false,
              propertyType: comp.propertyType || null,
              vacancyRate: comp.vacancyRate ?? null,
              developer: comp.developer || null,
              owner: comp.owner || null,
              buildingSize: comp.buildingSize || 0,
              stories: comp.stories ?? null,
              leasedPct: comp.leasedPct ?? null,
              leasedPctChange: comp.leasedPctChange ?? null,
              exposure: comp.exposure ?? null,
              exposureChange: comp.exposureChange ?? null,
              unitsVacant: comp.unitsVacant ?? null,
              unitsExposed: comp.unitsExposed ?? null,
              unitMix: comp.unitMix ?? null,
              websiteUrl: comp.websiteUrl ?? null
            }));
          }
        }
        
        classificationProgressTracker.completeJob(deal.id, result.classification);
        return result;
      }
    } else if (deal.inTargetMarket === true) {
      console.log(`✅ MSA check passed: Property IS in target market`);
      console.log(`📍 Location: ${deal.county || 'Unknown'}, ${deal.state || 'Unknown'}`);
      console.log(`🗺️ MSA: ${deal.msaName || 'Not identified'}`);
      if (deal.targetProductTypes && deal.targetProductTypes.length > 0) {
        console.log(`🏘️ Eligible for: ${deal.targetProductTypes.join(', ')}`);
      }
    } else {
      console.log(`ℹ️ MSA status unknown - location may not have been detected yet`);
    }

    classificationProgressTracker.updateStep(deal.id, 3, 'Fetching HelloData comparables');
    
    // STEP 2: Comparable Search with Safety System Integration
    console.log(`🔍 Searching for qualifying comparables...`);
    
    // NOTE: fullAddress is already built at the top of the function for consistent use
    console.log(`📍 Deal Address (street only): "${deal.address}"`);
    console.log(`📍 Full Address (for HelloData): "${fullAddress}"`);
    console.log(`📋 Deal ID: ${deal.id}`);
    
    let comparableResult;
    
    // Jan 13, 2026: HOISTED - Define primaryProductType BEFORE the preloaded data check
    // so it's available in BOTH code paths (preloaded and live fetch)
    // USER RULE: If deal has NO product type, ALWAYS use Conventional criteria ($1.75/sqft)
    // Do NOT infer product type from MSA - analyst must explicitly assign product type for BTR criteria
    const productTypes = (deal.productTypes as string[]) || [];
    const primaryProductType = productTypes[0] || 'Conventional Apartments';
    
    if (!productTypes[0]) {
      console.log(`📦 [CLASSIFICATION] Deal has no product type - defaulting to Conventional Apartments ($1.75/sqft criteria)`);
    }
    console.log(`📦 [CLASSIFICATION] Primary product type for criteria: ${primaryProductType}`);
    
    // USER REQUEST (Dec 10, 2025): Use preloaded HelloData if available (from re-run endpoint)
    // This avoids duplicate API calls when rerunning analysis
    if (hasPreloadedData && options?.preloadedHelloData) {
      console.log(`📊 [PRELOADED] Using pre-fetched HelloData instead of calling API`);
      comparableResult = {
        success: options.preloadedHelloData.success,
        qualifyingCount: options.preloadedHelloData.qualifyingCount,
        topRentPSF: options.preloadedHelloData.topRentPSF,
        avgRentPSF: options.preloadedHelloData.avgRentPSF,
        topRentPerUnit: options.preloadedHelloData.topRentPerUnit,
        avgRentPerUnit: options.preloadedHelloData.avgRentPerUnit,
        summary: options.preloadedHelloData.summary || '',
        aiExplanatoryNotes: options.preloadedHelloData.aiExplanatoryNotes || '',
        comparables: options.preloadedHelloData.comparables || [],
        totalComparables: options.preloadedHelloData.totalComparables || 0,
        candidateCount: options.preloadedHelloData.candidateCount || 0,
        candidatesWithPricing: options.preloadedHelloData.candidatesWithPricing || 0,
        error: undefined
      };
      console.log(`📊 Preloaded HelloData Result:`, JSON.stringify({
        success: comparableResult.success,
        qualifyingCount: comparableResult.qualifyingCount,
        summary: comparableResult.summary
      }, null, 2));
    } else {
      // No preloaded data - call HelloData API
      try {
        // Dec 17, 2025: Pass coordinates if available to avoid geocoding issues
        // Jan 12, 2026: Pass product type for custom filter criteria (BTR/Lot/Townhome/SF vs Conventional/AA)
        // Note: primaryProductType is now hoisted and defined before this if-else block
        const helloDataOptions: { latitude?: number; longitude?: number; productType?: string; radiusMiles?: number } = {
          productType: primaryProductType,
          radiusMiles: 3,
        };
        
        // Jan 13, 2026: Use stored coordinates to avoid geocoding "Coordinates: X, Y" address strings
        // Check both deal.latitude/longitude and manualLatitude/manualLongitude
        const dealLat = deal.latitude ? parseFloat(deal.latitude) : (deal.manualLatitude ? parseFloat(deal.manualLatitude) : null);
        const dealLng = deal.longitude ? parseFloat(deal.longitude) : (deal.manualLongitude ? parseFloat(deal.manualLongitude) : null);
        
        if (dealLat && dealLng && !isNaN(dealLat) && !isNaN(dealLng)) {
          helloDataOptions.latitude = dealLat;
          helloDataOptions.longitude = dealLng;
          console.log(`📍 [CLASSIFICATION] Using stored coordinates for HelloData: ${dealLat}, ${dealLng}`);
        }
        
        console.log(`📦 [CLASSIFICATION] Using product type for HelloData criteria: ${primaryProductType}`);
        
        comparableResult = await hellodataService.searchQualifyingComparables(fullAddress, helloDataOptions);
        
        console.log(`📊 HelloData Result:`, JSON.stringify({
          success: comparableResult.success,
          qualifyingCount: comparableResult.qualifyingCount,
          error: comparableResult.error,
          summary: comparableResult.summary
        }, null, 2));
      } catch (helloDataError: any) {
      // 🛡️ API Safety System: Graceful fallback for HelloData failures
      console.error(`❌ [SAFETY] HelloData API failed - executing fallback strategy`);
      
      const { ApiSafetySystem } = await import('./apiSafetySystem');
      const fallbackResult = await ApiSafetySystem.executeFallback(
        'HelloData',
        'searchQualifyingComparables',
        helloDataError,
        { dealId: deal.id, address: fullAddress }
      );
      
      console.log(`🛡️ [SAFETY] Fallback executed: ${fallbackResult.message}`);
      
      // Return unclassified result for manual review per fallback strategy
      comparableResult = {
        success: false,
        error: `HelloData API unavailable - ${fallbackResult.message}`,
        summary: `API failure handled by safety system. ${fallbackResult.requiresManualReview ? 'Flagged for manual review.' : ''}`,
        qualifyingCount: 0,
        topRentPSF: undefined,
        avgRentPSF: undefined,
        topRentPerUnit: undefined,
        avgRentPerUnit: undefined
      };
      }
    }

    classificationProgressTracker.updateStep(deal.id, 4, 'Evaluating comparable criteria');
    
    if (!comparableResult.success) {
      console.error(`❌ [CRITICAL] HelloData comparable search FAILED for deal ${deal.id}`);
      console.error(`   Full Address: ${fullAddress}`);
      console.error(`   Error: ${comparableResult.error}`);
      console.error(`   Summary: ${comparableResult.summary}`);
      
      // Check if this is a geocoding error - if so, leave for manual review
      const isGeocodingError = comparableResult.error?.includes('Unable to geocode') || 
                               comparableResult.error?.includes('geocode') ||
                               comparableResult.error?.includes('invalid address');
      
      // Check if this is an API Safety System fallback - if so, leave for manual review
      const isApiSafetyFallback = comparableResult.error?.includes('HelloData API unavailable') ||
                                   comparableResult.summary?.includes('API failure handled by safety system');
      
      const isNoCoverage = comparableResult.error?.includes('No qualifying comparables found') ||
                           comparableResult.summary?.includes('No qualifying multifamily comparables found') ||
                           comparableResult.summary?.includes('area without similar rental developments');

      if (isGeocodingError || isApiSafetyFallback) {
        console.warn(`⚠️ [MANUAL-REVIEW-REQUIRED] ${isGeocodingError ? 'Geocoding failure' : 'API Safety fallback'} - leaving as UNCLASSIFIED for manual review`);
        result.classification = 'unclassified';
        result.classificationDisplay = 'UNCLASSIFIED';
        result.rejectionReason = comparableResult.error || 'Unable to complete automatic classification - requires manual review';
        const addressNote = isGeocodingError 
          ? `Geocoding failed for address: "${fullAddress}". Address may be incomplete or invalid.`
          : 'HelloData API unavailable - automated comparable search could not be completed.';
        result.comparableNotes = comparableResult.summary || addressNote + ' Manual review required.';
        result.comparableCount = 0;
      } else if (isNoCoverage) {
        console.warn(`⚠️ [MANUAL-REVIEW-REQUIRED] HelloData has no coverage in this area - leaving as UNCLASSIFIED for manual review`);
        result.classification = 'unclassified';
        result.classificationDisplay = 'UNCLASSIFIED';
        result.rejectionReason = 'HelloData does not have data for this area - manual comparable review needed';
        result.comparableNotes = (comparableResult.summary || '') + '\n\nHelloData lacks coverage here. This does not mean there are no apartments nearby - manual research is recommended to find comparables that HelloData may not have indexed.';
        result.comparableCount = 0;
      } else {
        // Other HelloData failures (property not found, etc.) -> Mark as RED
        result.classification = 'red';
        result.classificationDisplay = 'RED / PASSED';
        result.rejectionReason = comparableResult.error || 'Property not found in HelloData - no qualifying comparables available';
        
        // Dec 11, 2025: Include suggested address in notes if available
        // Dec 16, 2025: Clearer message when address lookup fails but coordinate search is used
        let notes = comparableResult.summary || 'Property not found by address - searched by coordinates instead';
        if (comparableResult.suggestedAddress) {
          const distanceText = comparableResult.suggestedDistance !== undefined 
            ? ` (${comparableResult.suggestedDistance.toFixed(2)} miles from original)`
            : '';
          notes += `\n\nSuggested closest address: ${comparableResult.suggestedAddress}${distanceText}\nTry running HelloData on this address for approximate comparables.`;
        }
        result.comparableNotes = notes;
        result.comparableCount = 0;
      }
    } else {
      result.comparableCount = comparableResult.qualifyingCount;
      result.comparableNotes = comparableResult.summary;
      
      // Feb 5, 2026: Build ENHANCED explanatory notes showing WHY the property meets criteria
      // Include subject property criteria FIRST, then comparables summary
      const subjectVintage = deal.vintage || (deal as any).yearBuilt || null;
      const subjectUnits = deal.unitCount || null;
      const subjectMSA = deal.msaName || null;
      const subjectProductType = primaryProductType || 'Conventional Apartments';
      
      // Build criteria summary for subject property
      const criteriaParts: string[] = [];
      if (subjectVintage) {
        criteriaParts.push(`${subjectVintage} vintage`);
      }
      if (subjectUnits) {
        criteriaParts.push(`${subjectUnits} units`);
      }
      if (subjectMSA) {
        criteriaParts.push(`MSA: ${subjectMSA}`);
      }
      criteriaParts.push(`Product: ${subjectProductType}`);
      
      const subjectCriteriaSummary = criteriaParts.length > 0 
        ? `SUBJECT PROPERTY: ${criteriaParts.join(' | ')}. ` 
        : '';
      
      // Combine subject property criteria with comparables analysis
      // Build explanatory notes from HelloData; generate fallback when field is missing.
      // This can happen when preloaded data loses the aiExplanatoryNotes field in error paths.
      let hdNotes = comparableResult.aiExplanatoryNotes || '';
      if (!hdNotes) {
        const qCount = (comparableResult.qualifyingCount as number) ?? 0;
        if (qCount > 0) {
          const rentDisplay = (comparableResult.avgRentPSF as number) > 0
            ? `$${(comparableResult.avgRentPSF as number).toFixed(2)}/sqft avg`
            : (comparableResult.avgRentPerUnit as number) > 0
              ? `$${Math.round(comparableResult.avgRentPerUnit as number)}/unit avg`
              : '';
          hdNotes = `${qCount} qualifying comparable${qCount !== 1 ? 's' : ''} found${rentDisplay ? ` (${rentDisplay})` : ''}. Meets vintage and units criteria.`;
        } else if (qCount === 0) {
          hdNotes = `No qualifying comparables found in the search area meeting vintage and unit count criteria.`;
        } else {
          hdNotes = `Analysis complete.`;
        }
      }
      result.aiExplanatoryNotes = subjectCriteriaSummary + hdNotes;
      // FIXED (Feb 2026): Do NOT overwrite comparableNotes with AI reasoning.
      // comparableNotes keeps the verbose HelloData listing (individual properties, rent metrics)
      // aiExplanatoryNotes stores the concise AI reasoning separately
      // The UI shows aiExplanatoryNotes as "Acceptance Reasoning" and comparableNotes for HelloData details
      result.topRentPSF = comparableResult.topRentPSF;
      result.avgRentPSF = comparableResult.avgRentPSF;
      result.topRentPerUnit = comparableResult.topRentPerUnit;
      result.avgRentPerUnit = comparableResult.avgRentPerUnit;
      
      // Dec 11, 2025: Store structured comparables for map/table display
      // FIXED (Feb 2026): Store ALL comparables, not just ones with coordinates
      // Properties without lat/lng still need to appear in the comparables table
      if (comparableResult.comparables && comparableResult.comparables.length > 0) {
        result.comparablesJson = comparableResult.comparables
          .map((c: any) => ({
            address: c.address,
            city: c.city,
            state: c.state,
            zipCode: c.zipCode || null,
            latitude: c.latitude || null,
            longitude: c.longitude || null,
            propertyName: c.propertyName,
            units: c.unitCount,
            yearBuilt: c.yearBuilt,
            rentPSF: c.pricePerSqFt,
            avgRent: c.avgRent,
            distance: c.distance,
            isQualifying: c.isQualifying || false,
            propertyType: c.propertyType || null,
            vacancyRate: c.vacancyRate ?? null,
            developer: c.developer || null,
            owner: c.owner || null,
            buildingSize: c.buildingSize || 0,
            stories: c.stories ?? null,
            unitMix: c.unitMix ?? null,
            leasedPct: c.leasedPct ?? null,
            leasedPctChange: (c as any).leasedPctChange ?? null,
            exposure: (c as any).exposure ?? null,
            exposureChange: (c as any).exposureChange ?? null,
            unitsVacant: (c as any).unitsVacant ?? null,
            unitsExposed: (c as any).unitsExposed ?? null,
            websiteUrl: (c as any).websiteUrl ?? null
          }));
      }

      if (comparableResult.qualifyingCount >= 1) {
        console.log(`✅ Found ${comparableResult.qualifyingCount} qualifying comparable${comparableResult.qualifyingCount > 1 ? 's' : ''} - YELLOW/REVIEWING`);
        console.log(`💰 Rent Metrics:`);
        console.log(`   Top Rent PSF: $${comparableResult.topRentPSF?.toFixed(2) || '0.00'}`);
        console.log(`   Avg Rent PSF: $${comparableResult.avgRentPSF?.toFixed(2) || '0.00'}`);
        console.log(`   Top Rent/Unit: $${comparableResult.topRentPerUnit?.toFixed(0) || '0'}/month`);
        console.log(`   Avg Rent/Unit: $${comparableResult.avgRentPerUnit?.toFixed(0) || '0'}/month`);
        result.classification = 'yellow';
        result.classificationDisplay = 'YELLOW / REVIEWING';
        result.rejectionReason = '';
      } else {
        console.log(`❌ No qualifying comparables found - RED/PASSED`);
        result.classification = 'red';
        result.classificationDisplay = 'RED / PASSED';
        
        // ENHANCEMENT (Dec 9, 2025): Build specific, educational rejection reason
        // Help brokers understand WHY the deal doesn't work
        // Use direct counts from HelloData instead of parsing summary strings
        // Jan 13, 2026: Product-type-aware rejection messages
        let specificReason = '';
        
        const totalComps = comparableResult.totalComparables || 0;
        const candidateComps = comparableResult.candidateCount || 0;
        const candidatesWithPricing = comparableResult.candidatesWithPricing || 0;
        const topRent = comparableResult.topRentPSF || 0;
        const avgRent = comparableResult.avgRentPSF || 0;
        const topRentPerUnit = comparableResult.topRentPerUnit || 0;
        const avgRentPerUnit = comparableResult.avgRentPerUnit || 0;
        
        // Determine if this is a BTR/Lot/Townhome/SF deal type (relaxed criteria)
        const normalizedType = (primaryProductType || '').toLowerCase().trim();
        const relaxedCriteriaTypes = ['btr', 'lot', 'lot development', 'townhome', 'single family', 'single-family', 'singlefamily', 'btr-3-story', 'btr-sfr'];
        const isBTRType = relaxedCriteriaTypes.some(t => normalizedType.includes(t));
        
        // Product-type-specific criteria for messaging
        const vintageReq = isBTRType ? '2015+' : '2020+';
        const unitsReq = isBTRType ? '25+' : '150+';
        const rentReq = isBTRType ? '$2,000+/unit gross rent' : '$1.75+/sqft';
        const rentThreshold = isBTRType ? 2000 : 1.75;
        const rentMetric = isBTRType ? topRentPerUnit : topRent;
        const avgRentMetric = isBTRType ? avgRentPerUnit : avgRent;
        const rentLabel = isBTRType ? '/unit' : '/sqft';
        
        // Helper: build a bullet list of comps with their rent vs. threshold
        const buildRentBullets = (comps: any[], threshold: number, usePSF: boolean): string => {
          const lines: string[] = [];
          for (const c of comps) {
            const rent = usePSF ? (c.pricePerSqFt || c.rentPSF || 0) : (c.avgRent || 0);
            if (rent <= 0) continue;
            const gap = threshold - rent;
            const name = c.propertyName || c.address || 'Property';
            const vintage = c.yearBuilt ? ` — ${c.yearBuilt} vintage` : '';
            const units = c.unitCount ? `, ${c.unitCount} units` : '';
            const dist = c.distance ? `, ${c.distance.toFixed(1)} mi` : '';
            if (usePSF) {
              lines.push(`• ${name}: $${rent.toFixed(2)}/sqft ($${gap.toFixed(2)} below minimum)${vintage}${units}${dist}`);
            } else {
              lines.push(`• ${name}: $${rent.toFixed(0)}/unit ($${gap.toFixed(0)} below minimum)${vintage}${units}${dist}`);
            }
          }
          return lines.join('\n');
        };

        if (totalComps === 0) {
          // No comparables at all within 3 miles
          specificReason = `No multifamily properties found within 3 miles of this location. We require nearby comparable properties to validate market rents.`;
        } else if (candidateComps === 0) {
          // Comparables exist but none meet vintage/units criteria — list the top comps and why they fail
          const allComps = comparableResult.comparables || [];
          const topComps = allComps.slice(0, 5);
          let compLines = '';
          if (topComps.length > 0) {
            compLines = '\n\nProperties found nearby:\n' + topComps.map(c => {
              const name = (c as any).propertyName || (c as any).address || 'Property';
              const vintage = (c as any).yearBuilt || '?';
              const units = (c as any).unitCount || '?';
              const dist = (c as any).distance ? ` — ${(c as any).distance.toFixed(1)} mi` : '';
              const failReasons: string[] = [];
              if ((c as any).yearBuilt && (c as any).yearBuilt < (isBTRType ? 2015 : 2020)) failReasons.push(`built ${vintage} (need ${vintageReq})`);
              if ((c as any).unitCount && (c as any).unitCount < (isBTRType ? 25 : 150)) failReasons.push(`${units} units (need ${unitsReq})`);
              return `• ${name}${dist}: ${failReasons.length > 0 ? failReasons.join(', ') : `built ${vintage}, ${units} units`}`;
            }).join('\n');
          }
          specificReason = `Found ${totalComps} multifamily ${totalComps === 1 ? 'property' : 'properties'} within 3 miles, but none meet our acquisition criteria (built ${vintageReq} with ${unitsReq} units). The market here is composed of older or smaller assets that don't reflect institutional multifamily benchmarks.${compLines}`;
        } else if (candidatesWithPricing > 0 && rentMetric > 0 && rentMetric < rentThreshold) {
          // Candidates exist and we have pricing data showing rent is too low — name each one
          const allComps = comparableResult.comparables || [];
          const candidateCompsWithRent = allComps.filter((c: any) => {
            const rent = isBTRType ? (c.avgRent || 0) : (c.pricePerSqFt || c.rentPSF || 0);
            return rent > 0;
          });
          const bullets = buildRentBullets(candidateCompsWithRent, rentThreshold, !isBTRType);
          const gapToThreshold = rentThreshold - rentMetric;

          if (isBTRType) {
            specificReason = `Found ${candidatesWithPricing} comparable ${candidatesWithPricing === 1 ? 'property' : 'properties'} meeting age/size criteria (${vintageReq}, ${unitsReq} units), but gross rents don't support our $2,000/unit minimum:\n\n${bullets || `Top rent: $${topRentPerUnit.toFixed(0)}/unit, Average: $${avgRentPerUnit.toFixed(0)}/unit`}\n\nBest market rent is $${topRentPerUnit.toFixed(0)}/unit — $${gapToThreshold.toFixed(0)} short of our $2,000/unit threshold. This gap would materially impact BTR development returns.`;
          } else {
            specificReason = `Found ${candidatesWithPricing} comparable ${candidatesWithPricing === 1 ? 'property' : 'properties'} meeting age/size criteria (${vintageReq}, ${unitsReq} units), but market rents don't support our $1.75/sqft minimum:\n\n${bullets || `Top rent: $${topRent.toFixed(2)}/sqft, Average: $${avgRent.toFixed(2)}/sqft`}\n\nBest market rent in this area is $${topRent.toFixed(2)}/sqft — $${gapToThreshold.toFixed(2)}/sqft short of our minimum. This gap would materially impact development economics.`;
          }
        } else if (candidateComps > 0 && candidatesWithPricing === 0) {
          // Candidates exist but no pricing data available
          const allComps = comparableResult.comparables || [];
          const topCandidates = allComps.slice(0, 3);
          let candLines = '';
          if (topCandidates.length > 0) {
            candLines = '\n\nProperties meeting age/size criteria:\n' + topCandidates.map((c: any) => {
              const name = c.propertyName || c.address || 'Property';
              const vintage = c.yearBuilt ? `${c.yearBuilt} vintage` : '';
              const units = c.unitCount ? `${c.unitCount} units` : '';
              const dist = c.distance ? `${c.distance.toFixed(1)} mi` : '';
              return `• ${name}: ${[vintage, units, dist].filter(Boolean).join(', ')}`;
            }).join('\n');
          }
          specificReason = `Found ${candidateComps} ${candidateComps === 1 ? 'property' : 'properties'} meeting age/size criteria (${vintageReq}, ${unitsReq} units), but HelloData returned no rent data for ${candidateComps === 1 ? 'it' : 'them'}. We require verified market rents (${rentReq}) to confirm development feasibility.${candLines}`;
        } else {
          // Generic fallback
          specificReason = `No qualifying comparables found within 3 miles. We require properties built ${vintageReq}, ${unitsReq} units, with rents ${rentReq}.`;
        }
        
        result.rejectionReason = specificReason;
      }
    }

    // Dec 12, 2025: NOW apply acreage rejection AFTER HelloData ran (so rent data is populated)
    if (acreageRejection?.shouldReject) {
      console.log(`❌ APPLYING ACREAGE REJECTION: ${acres} acres < 4 acres minimum (HelloData data preserved)`);
      
      result.classification = 'red';
      result.classificationDisplay = 'RED / PASSED';
      result.rejectionReason = acreageRejection.reason;

      // Sync aiExplanatoryNotes with the actual red classification so the AI Notes popup
      // doesn't contradict the status badge. If comparable notes already exist (they were
      // written before this override), preserve them as context with a clear header.
      const prevNotes = result.aiExplanatoryNotes || '';
      const comparableContext = prevNotes
        ? ` Note: comparable market data WAS found (${prevNotes.replace(/^SUBJECT PROPERTY:[^.]+\.\s*/i, '').trim()}) but acreage criterion was not met.`
        : '';
      result.aiExplanatoryNotes = `RED: ${acreageRejection.reason}.${comparableContext}`;
      
      // Log that we have rent data available despite rejection
      if (result.topRentPSF || result.avgRentPSF) {
        console.log(`💰 Rent data preserved for analyst review: Top $${result.topRentPSF?.toFixed(2)}/sqft, Avg $${result.avgRentPSF?.toFixed(2)}/sqft`);
      }
      
      // Still populate QCT status - pass coordinates for reverse geocoding
      const acreageCoords = (deal.latitude && deal.longitude) 
        ? { latitude: deal.latitude, longitude: deal.longitude }
        : (deal.manualLatitude && deal.manualLongitude)
          ? { latitude: deal.manualLatitude, longitude: deal.manualLongitude }
          : undefined;
      await this.populateQCTStatus(fullAddress, result, acreageCoords);
      
      if (result.qctStatus === 'YES') {
        console.log(`ℹ️ QCT INFO: Deal is in Qualified Census Tract (for analyst reference)`);
      }
      
      classificationProgressTracker.completeJob(deal.id, result.classification);
      return result;
    }

    // STEP 4: QCT Column Population (informational only - no auto-override)
    // CRITICAL FIX: Use fullAddress (street + city + state + ZIP) instead of deal.address (street only)
    // This ensures Geocodio can properly identify the location and return FIPS code for QCT check
    // Dec 17, 2025: Pass coordinates for reverse geocoding when address is coordinate-based
    const finalCoords = (deal.latitude && deal.longitude) 
      ? { latitude: deal.latitude, longitude: deal.longitude }
      : (deal.manualLatitude && deal.manualLongitude)
        ? { latitude: deal.manualLatitude, longitude: deal.manualLongitude }
        : undefined;
    await this.populateQCTStatus(fullAddress, result, finalCoords);

    // QCT is informational only - analysts will manually upgrade if deal makes sense
    if (result.qctStatus === 'YES') {
      console.log(`ℹ️ QCT INFO: Deal is in Qualified Census Tract (for analyst reference)`);
    }

    // USER REQUEST (Jan 1, 2026): Prepend MSA warning note if bypass was used
    // USER REQUEST (Jan 14, 2026): Make MSA warning more prominent - add to both notes and reasoning
    if (msaWarningNote) {
      result.comparableNotes = msaWarningNote + (result.comparableNotes || '');
      // Also add to reasoning for visibility in the dashboard
      if (result.reasoning) {
        result.reasoning = msaWarningNote + result.reasoning;
      }
      // For green/yellow deals outside MSA, set a special note in shortRejectionReason
      // so it shows up in the Rejection Reason column
      if (result.classification !== 'red' && !result.shortRejectionReason) {
        result.shortRejectionReason = '⚠️ OUTSIDE TARGET MSA - Meets other criteria, consider for market expansion';
      }
      console.log(`🔄 [MSA-BYPASS] Added warning note to comparableNotes, reasoning, and shortRejectionReason`);
    }

    classificationProgressTracker.updateStep(deal.id, 5, 'Checking QCT status');

    console.log(`📊 Final Classification: ${result.classificationDisplay}, QCT: ${result.qctStatus}`);
    classificationProgressTracker.completeJob(deal.id, result.classification);
    return result;
    
    } catch (error: any) {
      // Classification failed - mark progress tracker
      classificationProgressTracker.failJob(deal.id, error?.message || 'Unknown error');
      throw error;
    }
  }

  /**
   * Populate QCT status using Geocodio and QCT dataset
   * Dec 17, 2025: Added coordinate support - uses reverse geocoding when lat/lng provided
   */
  private static async populateQCTStatus(
    address: string, 
    result: ClassificationResult,
    coordinates?: { latitude: number; longitude: number }
  ): Promise<void> {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔍 [QCT-DEBUG] Starting QCT Status Check');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📍 Address:', address || 'NO ADDRESS PROVIDED');
      console.log('📍 Coordinates:', coordinates ? `${coordinates.latitude}, ${coordinates.longitude}` : 'NONE');
      console.log('📏 Address Length:', address?.length || 0);
      console.log('───────────────────────────────────────────────────────');
      
      let geocodeResult: any;
      
      // Dec 17, 2025: Use reverse geocoding if coordinates provided and address looks like coordinates
      // Detect coordinate-style addresses: "Coordinates: ...", blank/empty, or raw lat/lng patterns
      const decimalCoordsPattern = /^[-+]?\d{1,3}\.\d+\s*,\s*[-+]?\d{1,3}\.\d+$/; // e.g., "28.719028, -81.861111"
      const isCoordinateAddress = !address || 
        address.trim().length === 0 || 
        address.toLowerCase().includes('coordinates:') ||
        decimalCoordsPattern.test(address.trim());
      
      if (coordinates && isCoordinateAddress) {
        console.log('⏳ Using REVERSE GEOCODING (coordinates provided, address is coordinate string)...');
        geocodeResult = await geocodioService.reverseGeocode(coordinates.latitude, coordinates.longitude);
        console.log(`📍 [REVERSE-GEOCODE] Result: ${geocodeResult.success ? 'Success' : 'Failed'}, FIPS: ${geocodeResult.fips || 'N/A'}`);
      } else {
        // Use forward geocoding from address
        console.log('⏳ Calling Geocodio API (forward geocoding)...');
        geocodeResult = await geocodioService.geocodeAddress(address);
      }
      
      console.log('📊 [QCT-DEBUG] Geocodio Response:', {
        success: geocodeResult.success,
        hasFips: !!geocodeResult.fips,
        fips: geocodeResult.fips || 'NO FIPS',
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        formattedAddress: geocodeResult.formattedAddress,
        error: geocodeResult.error || 'NO ERROR'
      });
      
      if (!geocodeResult.success || !geocodeResult.fips) {
        // FALLBACK: If forward geocoding failed but we have coordinates, try reverse geocoding
        if (coordinates) {
          console.log('⚠️ Forward geocoding failed — falling back to REVERSE GEOCODING using stored coordinates...');
          try {
            const reverseResult = await geocodioService.reverseGeocode(coordinates.latitude, coordinates.longitude);
            if (reverseResult.success && reverseResult.fips) {
              console.log(`✅ [REVERSE-FALLBACK] Reverse geocoding succeeded! FIPS: ${reverseResult.fips}`);
              geocodeResult = reverseResult;
            } else {
              console.warn('⚠️ [REVERSE-FALLBACK] Reverse geocoding also failed — marking QCT/OZ as N/A');
              result.qctStatus = 'N/A';
              result.censusTractFips = undefined;
              return;
            }
          } catch (reverseErr) {
            console.warn('⚠️ [REVERSE-FALLBACK] Reverse geocoding threw error:', reverseErr);
            result.qctStatus = 'N/A';
            result.censusTractFips = undefined;
            return;
          }
        } else {
          console.log('⚠️ ⚠️ ⚠️ Unable to determine census tract for address (no coordinates available for fallback)');
          console.log('❌ Marking QCT status as N/A');
          console.log('═══════════════════════════════════════════════════════');
          result.qctStatus = 'N/A';
          result.censusTractFips = undefined;
          return;
        }
      }

      result.censusTractFips = geocodeResult.fips;
      // Store geocoded coordinates so they can be written back to the deal record
      if (geocodeResult.lat && geocodeResult.lng) {
        result.geocodedLat = geocodeResult.lat;
        result.geocodedLng = geocodeResult.lng;
        console.log(`📍 [GEOCODE-COORDS] Storing geocoded lat/lng: ${geocodeResult.lat}, ${geocodeResult.lng}`);
      }
      console.log('✅ Census Tract FIPS obtained:', geocodeResult.fips);
      console.log('───────────────────────────────────────────────────────');

      // Check if FIPS is in QCT dataset
      console.log('⏳ Checking QCT dataset for FIPS:', geocodeResult.fips);
      const qctStatus = await qctService.checkQCTStatus(geocodeResult.fips);
      
      console.log('📊 [QCT-DEBUG] QCT Service Result:', {
        isQCT: qctStatus.isQCT,
        fips: qctStatus.fips,
        statusToSet: qctStatus.isQCT ? 'YES' : 'NO'
      });
      
      result.qctStatus = qctStatus.isQCT ? 'YES' : 'NO';
      
      if (qctStatus.isQCT) {
        console.log('✅✅✅ QCT Status: YES - Property IS in Qualified Census Tract');
      } else {
        console.log('❌❌❌ QCT Status: NO - Property NOT in Qualified Census Tract');
      }

      // OZ check runs immediately after QCT using the same FIPS code
      try {
        const ozResult = await ozService.checkOZStatus(geocodeResult.fips);
        result.ozStatus = ozResult.isOZ ? 'YES' : 'NO';
        console.log(`🏛️ OZ Status: ${result.ozStatus} for FIPS ${geocodeResult.fips}`);
      } catch (ozErr) {
        console.warn('⚠️ OZ check failed, marking N/A:', ozErr);
        result.ozStatus = 'N/A';
      }

      // DDA check — uses ZIP code (preferred) + county FIPS fallback
      try {
        const { ddaService } = await import('./ddaService.js');
        const dealZip = (deal as any).zip as string | undefined;
        const ddaResult = ddaService.checkDDAStatus(dealZip, geocodeResult.fips);
        result.ddaStatus = ddaResult.ddaStatus;
        result.ddaAreaName = ddaResult.areaName;
        result.ddaVlil = ddaResult.vlil;
        result.ddaLihtcMaxRent = ddaResult.lihtcMaxRent;
        result.ddaFmr = ddaResult.fmrOrSafmr;
        console.log(`🏗️ DDA Status: ${result.ddaStatus}${ddaResult.basisBoost ? ' ✅ 30% Basis Boost Available!' : ''}`);
      } catch (ddaErr) {
        console.warn('⚠️ DDA check failed:', ddaErr);
        result.ddaStatus = 'N/A';
      }

      // Novogradac GoZone enrichment — OZ-eligible, NMTC, LIHTC nearby, HTC nearby
      // Uses lat/lng from geocoding (already available at this point)
      const novLat = geocodeResult.lat;
      const novLng = geocodeResult.lng;
      if (novLat && novLng) {
        try {
          const { queryNovogradac } = await import('./novogradacService.js');
          const novResult = await queryNovogradac(novLat, novLng);
          result.ozEligible = novResult.ozEligible;
          result.nmtcStatus = novResult.nmtcStatus;
          result.nmtcProjectId = novResult.nmtcProjectId;
          result.nmtcAmount = novResult.nmtcAmount;
          result.nmtcPurpose = novResult.nmtcPurpose;
          result.lihtcNearbyJson = novResult.lihtcNearby.length > 0 ? novResult.lihtcNearby : undefined;
          console.log(`🗺️ Novogradac: OZ-Eligible=${novResult.ozEligible}, NMTC=${novResult.nmtcStatus}, LIHTC nearby=${novResult.lihtcNearby.length}`);
        } catch (novErr) {
          console.warn('⚠️ Novogradac enrichment failed:', novErr);
          result.ozEligible = 'N/A';
          result.nmtcStatus = 'N/A';
        }
      }

      console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
      console.error('❌❌❌ CRITICAL ERROR checking QCT status');
      console.error('Error details:', error);
      console.error('Marking QCT/OZ status as N/A');
      console.log('═══════════════════════════════════════════════════════');
      result.qctStatus = 'N/A';
      result.ozStatus = 'N/A';
      result.censusTractFips = undefined;
    }
  }

  /**
   * ACQUISITION DEAL CLASSIFICATION WORKFLOW (Jan 2026)
   * 
   * Classification rules for existing multifamily properties:
   * 
   * For Conventional, Student Housing, or Affordable:
   *   - MSA: BTR, Conventional, or Lot MSAs
   *   - Vintage: 1985 or newer (yearBuilt >= 1985)
   *   - Units: 150+ units
   *   - If all criteria met → YELLOW/REVIEWING
   * 
   * For BTR or Active Adult:
   *   - MSA: BTR, Conventional, or Lot MSAs  
   *   - Vintage: 1985 or newer (yearBuilt >= 1985)
   *   - Units: 50+ units
   *   - If all criteria met → YELLOW/REVIEWING
   * 
   * Otherwise → RED/PASSED with specific rejection reason
   */
  private static async classifyAcquisitionDeal(deal: Deal, options?: any): Promise<ClassificationResult> {
    const dealNumber = (deal as any).dealNumber || null;
    const address = `${deal.address || ''}, ${deal.city || ''}, ${deal.state || ''}`.trim();
    
    // Start progress tracking for acquisition classification (6 steps)
    classificationProgressTracker.startJob(deal.id, dealNumber, address, 'acquisition', 6);
    
    try {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🏢 [ACQUISITION] STARTING ACQUISITION DEAL CLASSIFICATION`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`📍 Deal ID: ${deal.id}`);
    console.log(`📍 Deal #${dealNumber || 'N/A'}`);
    console.log(`📍 Address: ${deal.address}, ${deal.city}, ${deal.state} ${deal.zip}`);
    console.log(`${'─'.repeat(70)}`);
    
    const result: ClassificationResult = {
      classification: 'unclassified',
      classificationDisplay: 'UNCLASSIFIED',
      qctStatus: 'N/A',
      ozStatus: 'N/A',
      comparableCount: 0,
      comparableNotes: '',
      rejectionReason: ''
    };

    // Extract deal properties
    // FIX (Jan 15, 2026): Check both vintage (user-entered) and yearBuilt (Regrid enrichment) columns
    const yearBuilt = deal.vintage || (deal as any).yearBuilt || null;
    const unitCount = deal.unitCount || null;
    const productTypes = (deal.productTypes as string[]) || [];
    let targetProductTypes = (deal as any).targetProductTypes || [];
    let inTargetMarket = (deal as any).inTargetMarket;
    
    // If inTargetMarket is not set, do our own MSA lookup using county/state
    if (inTargetMarket === null || inTargetMarket === undefined) {
      console.log(`📊 [ACQUISITION] inTargetMarket not set - performing MSA lookup...`);
      console.log(`   📍 Deal county raw: "${deal.county}", state raw: "${deal.state}"`);
      const county = deal.county?.replace(/\s*County\s*$/i, '').trim();
      const state = deal.state?.toUpperCase().trim();
      
      if (county && state) {
        try {
          const msaMatch = await MSAMatchingService.matchCountyToMarket(county, state);
          
          if (msaMatch.matched) {
            inTargetMarket = true;
            targetProductTypes = msaMatch.productTypes || [];
            console.log(`   ✅ Found MSA match: ${msaMatch.county}, ${msaMatch.state} - ${targetProductTypes.join(', ')}`);
          } else {
            inTargetMarket = false;
            console.log(`   ❌ No MSA match found for: "${county}", "${state}"`);
          }
        } catch (msaError) {
          console.error(`   ⚠️ MSA lookup error:`, msaError);
          inTargetMarket = false;
        }
      } else {
        console.log(`   ⚠️ Missing county (${county || 'EMPTY'}) or state (${state || 'EMPTY'}) - cannot perform MSA lookup`);
        console.log(`   ⚠️ Deal will be rejected for not being in target market`);
        inTargetMarket = false;
      }
    }
    
    classificationProgressTracker.updateStep(deal.id, 1, 'Extracting deal properties');
    console.log(`📊 [ACQUISITION] STEP 1: EXTRACTING DEAL PROPERTIES`);
    console.log(`   ├─ Year Built: ${yearBuilt !== null ? yearBuilt : '❓ Not specified'}`);
    console.log(`   ├─ Unit Count: ${unitCount !== null ? unitCount : '❓ Not specified'}`);
    console.log(`   ├─ Product Types: ${productTypes.length > 0 ? productTypes.join(', ') : '❓ Not specified'}`);
    console.log(`   ├─ Target Market MSAs: ${targetProductTypes.length > 0 ? targetProductTypes.join(', ') : '❓ None found'}`);
    console.log(`   └─ In Target Market: ${inTargetMarket === true ? '✅ YES' : inTargetMarket === false ? '❌ NO' : '❓ Unknown'}`);
    console.log(``);

    // Define valid MSAs for acquisitions (BTR, Conventional, or Lot MSAs)
    const validAcquisitionMSAs = ['BTR', 'Conventional Apartments', 'Lot Development', 'Conventional', 'Lot'];
    
    // Check if the property is in a valid acquisition MSA
    const isInValidMSA = inTargetMarket && targetProductTypes.some((pt: string) => 
      validAcquisitionMSAs.some(validMSA => pt.toLowerCase().includes(validMSA.toLowerCase()))
    );

    classificationProgressTracker.updateStep(deal.id, 2, 'Checking target market MSA');
    console.log(`🗺️ [ACQUISITION] STEP 2: CHECKING TARGET MARKET MSA`);
    console.log(`   ├─ Valid MSA Types: ${validAcquisitionMSAs.join(', ')}`);
    console.log(`   ├─ Deal's Target MSA Types: ${targetProductTypes.length > 0 ? targetProductTypes.join(', ') : 'None'}`);
    console.log(`   └─ Result: ${isInValidMSA ? '✅ IN VALID MSA' : '❌ NOT IN VALID MSA'}`);
    console.log(``);

    // Determine product type category
    const conventionalTypes = ['conventional', 'student housing', 'affordable', 'student', 'lihtc'];
    const btrActiveAdultTypes = ['btr', 'active adult', 'build-to-rent', 'build to rent', '55+', 'aa-'];
    
    const productTypesLower = productTypes.map(pt => pt.toLowerCase());
    const isConventionalType = productTypesLower.some(pt => 
      conventionalTypes.some(ct => pt.includes(ct))
    );
    const isBTRActiveAdultType = productTypesLower.some(pt => 
      btrActiveAdultTypes.some(bt => pt.includes(bt))
    );

    classificationProgressTracker.updateStep(deal.id, 3, 'Determining product type category');
    console.log(`📋 [ACQUISITION] STEP 3: DETERMINING PRODUCT TYPE CATEGORY`);
    console.log(`   ├─ Conventional/Student/Affordable types: ${conventionalTypes.join(', ')}`);
    console.log(`   ├─ BTR/Active Adult types: ${btrActiveAdultTypes.join(', ')}`);
    console.log(`   ├─ Deal product types: ${productTypesLower.join(', ') || 'None specified'}`);
    console.log(`   ├─ Is Conventional/Student/Affordable: ${isConventionalType ? '✅ YES' : '❌ NO'}`);
    console.log(`   └─ Is BTR/Active Adult: ${isBTRActiveAdultType ? '✅ YES' : '❌ NO'}`);
    console.log(``);

    // ACQUISITION CLASSIFICATION RULES:
    // 1. Must be in target MSA
    // 2. Unit count minimum:
    //    - BTR: 80+ units
    //    - Active Adult / Conventional (or unspecified type): 100+ units
    // If unit count is not provided, skip that check.
    // HelloData comparables (4-mile, ±5yr vintage) always run regardless of outcome.
    let msaWarningNote = '';

    classificationProgressTracker.updateStep(deal.id, 4, 'Checking target market MSA + unit count');
    console.log(`🔍 [ACQUISITION] STEP 4: MSA + UNIT COUNT CHECK`);
    console.log(`${'─'.repeat(50)}`);

    const location = (deal as any).county && (deal as any).state
      ? `${(deal as any).county} County, ${(deal as any).state}`
      : 'the submitted location';

    // Determine minimum unit threshold by product type
    const isBTRType = productTypesLower.some(pt =>
      ['btr', 'build-to-rent', 'build to rent'].some(b => pt.includes(b))
    );
    const minUnits = isBTRType ? 80 : 100;
    const productLabel = isBTRType ? 'BTR' : 'Active Adult / Conventional';

    console.log(`   Product type: ${productLabel} → minimum ${minUnits} units`);
    console.log(`   Deal unit count: ${unitCount !== null ? unitCount : '(not provided)'}`);

    // Check MSA — bypass flag lets manual re-runs skip MSA rejection
    const msaIsSatisfied = isInValidMSA || (options?.bypassMSARejection && !isInValidMSA);
    if (!isInValidMSA && options?.bypassMSARejection) {
      msaWarningNote = `⚠️ NOTE: Property located in ${location} is OUTSIDE target acquisition markets. `;
      console.log(`   🔄 [MSA-BYPASS] Manual re-run - adding warning note, continuing analysis`);
    }

    // Check unit count (skip if not provided)
    const unitCountFails = unitCount !== null && unitCount < minUnits;

    // Check vintage (skip if not provided) — acquisitions require 2000+ vintage
    const MIN_VINTAGE = 2000;
    const vintageFails = yearBuilt !== null && yearBuilt < MIN_VINTAGE;

    // Determine classification
    classificationProgressTracker.updateStep(deal.id, 5, 'Making classification decision');
    console.log(`\n⚖️ [ACQUISITION] STEP 5: CLASSIFICATION DECISION`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`   MSA satisfied: ${msaIsSatisfied ? '✅ YES' : '❌ NO'}`);
    console.log(`   Unit count: ${unitCount !== null ? `${unitCount} (min ${minUnits}) → ${unitCountFails ? '❌ FAIL' : '✅ PASS'}` : '⚠️ not provided — skipping'}`);
    console.log(`   Vintage: ${yearBuilt !== null ? `${yearBuilt} (min ${MIN_VINTAGE}) → ${vintageFails ? '❌ FAIL' : '✅ PASS'}` : '⚠️ not provided — skipping'}`);

    const rejectionReasons: string[] = [];
    if (!msaIsSatisfied) {
      rejectionReasons.push(`Property not in target acquisition market (${location})`);
    }
    if (unitCountFails) {
      rejectionReasons.push(`${unitCount} units is below the ${minUnits}-unit minimum for ${productLabel} acquisitions`);
    }
    if (vintageFails) {
      rejectionReasons.push(`${yearBuilt} vintage is below the ${MIN_VINTAGE} minimum for acquisitions`);
    }

    if (rejectionReasons.length === 0) {
      result.classification = 'yellow';
      result.classificationDisplay = 'YELLOW / REVIEWING';
      const msaLabel = isInValidMSA ? 'in target MSA ✓' : '⚠️ OUTSIDE target MSA (re-run bypass)';
      const unitsLabel = unitCount !== null ? `${unitCount} units (${minUnits}+ ✓)` : 'units not provided';
      const vintageLabel = yearBuilt !== null ? `${yearBuilt} vintage (${MIN_VINTAGE}+ ✓)` : 'vintage not provided';
      result.comparableNotes = (msaWarningNote + `Acquisition deal: ${msaLabel}, ${unitsLabel}, ${vintageLabel}. Comparable rent survey below.`).trim();
      console.log(`\n   🟡 DECISION: YELLOW (REVIEWING)`);
    } else {
      result.classification = 'red';
      result.classificationDisplay = 'RED / PASSED';
      result.rejectionReason = rejectionReasons.join('. ');
      result.aiExplanatoryNotes = result.rejectionReason;
      result.comparableNotes = '';
      console.log(`\n   🔴 DECISION: RED (PASSED) — ${result.rejectionReason}`);
    }

    // STEP 5.5: HelloData comparable search — always runs regardless of MSA result
    // 4-mile radius, ±5 years of subject vintage
    classificationProgressTracker.updateStep(deal.id, 5, 'Fetching comparable rent survey (HelloData)');
    console.log(`\n📊 [ACQUISITION] STEP 5.5: HELLODATA COMPARABLE RENT SURVEY`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`   Search: 4-mile radius${yearBuilt ? `, vintage ${yearBuilt - 5}–${yearBuilt + 5}` : ', no vintage filter'}`);

    try {
      const dealAny = deal as any;
      let lat = dealAny.latitude ? parseFloat(dealAny.latitude) :
        dealAny.manualLatitude ? parseFloat(dealAny.manualLatitude) : null;
      let lng = dealAny.longitude ? parseFloat(dealAny.longitude) :
        dealAny.manualLongitude ? parseFloat(dealAny.manualLongitude) : null;

      // If no coordinates stored, try geocoding the address on-the-fly
      if (!lat || !lng) {
        console.log(`   ⚠️ No coordinates on deal — attempting geocoding for HelloData search...`);
        try {
          const fullAddress = [deal.address, (deal as any).city, (deal as any).state, (deal as any).zip].filter(Boolean).join(', ');
          const geocodeResult = await geocodioService.geocodeAddress(fullAddress);
          if (geocodeResult.success && geocodeResult.lat && geocodeResult.lng) {
            console.log(`   ✅ Geocoded on-the-fly: ${geocodeResult.lat}, ${geocodeResult.lng}`);
            lat = geocodeResult.lat;
            lng = geocodeResult.lng;
            // Persist coordinates so future runs skip this step
            try {
              const { storage } = await import('./storage.js');
              await storage.updateDeal(deal.id, {
                latitude: String(geocodeResult.lat),
                longitude: String(geocodeResult.lng)
              });
              console.log(`   ✅ Geocoded coordinates saved to deal`);
            } catch (saveErr) {
              console.warn(`   ⚠️ Could not save geocoded coordinates:`, saveErr);
            }
          } else {
            console.warn(`   ❌ Geocoding failed: ${geocodeResult.error}`);
          }
        } catch (geocodeErr: any) {
          console.warn(`   ❌ Geocoding error during on-the-fly geocode:`, geocodeErr?.message || geocodeErr);
        }
      }

      if (lat && lng) {
        const { hellodataService } = await import('./hellodataService.js');
        const acqComps = await hellodataService.searchAcquisitionComparables(lat, lng, yearBuilt, 4);

        console.log(`   ✅ Comparable search complete: ${acqComps.count} properties found`);

        if (acqComps.count > 0) {
          result.comparableCount = acqComps.count;
          result.comparableNotes = (msaWarningNote + acqComps.notes).trim();
          // FIX: Use the array directly (not JSON.stringify'd string) so comparablesJson
          // is stored as a proper array in the DB and displayed correctly in the frontend.
          // All acquisition comps are pre-filtered to ±5yr vintage so mark all as qualifying.
          const mappedAcqComps = acqComps.comparables.map((c: any) => ({
            address: c.address,
            city: c.city || null,
            state: c.state || null,
            zipCode: c.zipCode || null,
            propertyName: c.propertyName,
            yearBuilt: c.yearBuilt,
            units: c.unitCount,
            unitCount: c.unitCount,
            distance: c.distance,
            rentPSF: c.rentPSF || 0,
            avgRent: c.avgRent || 0,
            latitude: c.latitude || null,
            longitude: c.longitude || null,
            isQualifying: true,
            propertyType: c.propertyType || null,
            buildingSize: c.buildingSize || 0,
            stories: c.stories ?? null,
            vacancyRate: c.vacancyRate ?? null,
            developer: c.developer || null,
            owner: c.owner || null,
            leasedPct: c.leasedPct ?? null,
            leasedPctChange: (c as any).leasedPctChange ?? null,
            exposure: (c as any).exposure ?? null,
            exposureChange: (c as any).exposureChange ?? null,
            unitsVacant: (c as any).unitsVacant ?? null,
            unitsExposed: (c as any).unitsExposed ?? null,
            unitMix: c.unitMix ?? null,
            websiteUrl: (c as any).websiteUrl ?? null,
          }));
          (result as any).comparablesJson = mappedAcqComps;
          (result as any).comparables = mappedAcqComps;
        } else {
          // No comps found — append to existing notes
          result.comparableNotes = (result.comparableNotes + '\n\n' + (acqComps.notes || `No comparable properties found within 4 miles matching ±5-year vintage range.`)).trim();
        }
      } else {
        console.log(`   ⚠️ No coordinates on deal — skipping HelloData comparable search`);
        result.comparableNotes = (result.comparableNotes + ' No coordinates available for comparable search.').trim();
      }
    } catch (hdError: any) {
      console.error(`   ⚠️ HelloData comparable search failed:`, hdError?.message || hdError);
      result.comparableNotes = (result.comparableNotes + ' Comparable search could not be completed.').trim();
    }

    // Check QCT status for affordable housing override
    classificationProgressTracker.updateStep(deal.id, 6, 'Checking QCT status');
    console.log(`\n🏠 [ACQUISITION] STEP 6: CHECKING QCT STATUS (AFFORDABLE HOUSING OVERRIDE)`);
    console.log(`${'─'.repeat(50)}`);
    // Only check QCT for RED classified deals (can be upgraded to YELLOW if in QCT)
    if (result.classification === 'red') {
      try {
        const fullAddress = `${deal.address}, ${deal.city}, ${deal.state} ${deal.zip}`;
        const coords = (deal.latitude && deal.longitude) 
          ? { latitude: deal.latitude, longitude: deal.longitude }
          : (deal.manualLatitude && deal.manualLongitude)
            ? { latitude: deal.manualLatitude, longitude: deal.manualLongitude }
            : undefined;
        await this.populateQCTStatus(fullAddress, result, coords);
        console.log(`   QCT Status Result: ${result.qctStatus}`);
        
        // QCT Override: If RED but in QCT, upgrade to YELLOW for affordable housing potential
        if (result.classification === 'red' && result.qctStatus === 'YES') {
          console.log(`\n   🏠 QCT OVERRIDE TRIGGERED!`);
          console.log(`   📝 Property is in a Qualified Census Tract`);
          console.log(`   📝 Upgrading from RED to YELLOW for affordable housing potential`);
          result.classification = 'yellow';
          result.classificationDisplay = 'YELLOW / REVIEWING';
          // FIXED: Do NOT overwrite comparableNotes — preserve the verbose HelloData listing.
          // Put QCT context into aiExplanatoryNotes and prepend a short notice to comparableNotes.
          const qctNotice = `⚠️ QCT OVERRIDE: ${result.rejectionReason}. Property is in a Qualified Census Tract — upgraded to YELLOW for affordable housing potential.\n\n`;
          result.comparableNotes = qctNotice + (result.comparableNotes || '');
          result.aiExplanatoryNotes = (result.aiExplanatoryNotes || '') + ` [QCT OVERRIDE: upgraded from RED — property is in Qualified Census Tract]`;
          result.rejectionReason = '';
        } else {
          console.log(`   No QCT override applied (QCT: ${result.qctStatus}, Classification: ${result.classification})`);
        }
      } catch (qctError) {
        console.error(`   ⚠️ QCT check failed:`, qctError);
      }
    } else {
      console.log(`   Skipping QCT check - deal already classified as YELLOW`);
    }

    // Final summary
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🏢 [ACQUISITION] CLASSIFICATION COMPLETE`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`   📊 FINAL CLASSIFICATION: ${result.classificationDisplay}`);
    console.log(`   🏠 QCT STATUS: ${result.qctStatus}`);
    if (result.rejectionReason) {
      console.log(`   ❌ REJECTION REASON: ${result.rejectionReason}`);
    }
    console.log(`   📝 NOTES: ${result.comparableNotes}`);
    console.log(`${'═'.repeat(70)}\n`);
    
    // Complete progress tracking
    classificationProgressTracker.completeJob(deal.id, result.classification);
    
    return result;
    
    } catch (error: any) {
      // Classification failed - mark progress tracker
      classificationProgressTracker.failJob(deal.id, error?.message || 'Unknown error');
      throw error;
    }
  }
}

import { storage } from './storage.js';
import { AutoClassificationEngine } from './autoClassificationEngine.js';
import { hellodataService } from './hellodataService.js';
import { geocodioService } from './geocodioService.js';
import { MSAMatchingService } from './msaMatchingService.js';
import { db } from './db';
import { communications, deals } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
// Note: sendgrid and types imports handled by existing system
// Will use direct email sending approach

// State name ↔ abbreviation normalization — prevents coordinate rejection when
// broker submits "TN" but geocoder returns "Tennessee" (or vice-versa)
const STATE_NAME_TO_ABBR: Record<string, string> = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
  'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
  'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA',
  'kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD',
  'massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO',
  'montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ',
  'new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH',
  'oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC',
  'south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
  'virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY',
  'district of columbia':'DC'
};
function normalizeState(s: string): string {
  const lower = s.toLowerCase().trim();
  return STATE_NAME_TO_ABBR[lower] || s.toUpperCase().trim();
}

// Define the status types for classification
type StatusKey = 'high_priority' | 'potentially' | 'clear_no' | 'pending_review';

// Define the DealSubmissionData interface
interface DealSubmissionData {
  // Property details
  address?: string;
  askingPrice?: number;
  sizeAcres?: number;
  unitCount?: number;
  pricingType?: string;
  hasEntitlements?: boolean;
  parcelId?: string;
  sewerAvailable?: boolean;
  productTypes?: string[];
  brokerNotes?: string;
  propertyName?: string;
  dealRoomUrl?: string; // Link to deal room/data room (Dec 11, 2025)
  attachments?: string[]; // Legacy field from email/SMS submissions
  documentUrls?: string[]; // Modern field from form submissions (presigned URL uploads)
  
  // Contact info
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  
  // Broker details
  brokerInfo?: any;
  teamMemberEmails?: string[];
  
  // Source tracking
  submissionMethod: 'form' | 'email' | 'sms' | 'rss';
  source?: string;
  
  // Optional fields from email/SMS processing
  rawEmailContent?: string;
  rawSmsContent?: string;
  currentZoning?: string;
  proposedUse?: string;
  developmentType?: string;
  estimatedUnits?: number;
  timelineExpectation?: string;
  // CRITICAL FIX (Nov 17, 2025): Accept null to distinguish missing data from empty strings
  // Webhooks pass null when data is truly missing (allows geocoding fallback)
  city?: string | null;
  state?: string | null;
  // CRITICAL FIX: Use ONLY 'zip' field (removed 'zipCode' to prevent confusion)
  zip?: string | null;
  county?: string | null;
}

// Define the ClassificationResult type
interface ClassificationResult {
  recommendation: StatusKey;
  confidence: number;
  reasoning: string;
  teamAssignment: {
    analyst: string;
    developer: string;
    partner: string;
  };
  developmentType: string;
}

// DISABLED: No automatic classification - all results require manual review
// NOTE: This function is unused - kept for reference only
function adaptAutoClassificationResult(autoResult: any): ClassificationResult {
  // NEVER auto-classify - all deals require manual analyst review
  const priorityMap: Record<string, StatusKey> = {
    'red': 'clear_no',
    'yellow': 'pending_review',
    'unclassified': 'pending_review'
  };
  
  return {
    recommendation: priorityMap[autoResult.classification] || 'pending_review', // Default to pending_review for unknown classifications
    confidence: autoResult.score ? autoResult.score / 100 : 0.5,
    reasoning: autoResult.reasons ? autoResult.reasons.join('; ') : 'Automated classification',
    teamAssignment: autoResult.automaticAssignment || {
      analyst: 'Austin Blondell',
      developer: 'Steve Hillebrand',
      partner: 'AJ Klenk'
    },
    developmentType: autoResult.suggestedDevelopmentType || 'Unknown'
  };
}

export class UnifiedDealPipeline {
  
  /**
   * Main entry point for all deal submissions - EMAIL, SMS, and FORM
   */
  static async processDealSubmission(
    submissionData: DealSubmissionData, 
    skipConfirmationOrBroker?: boolean | any, // Can be skipConfirmation (boolean) or verifiedBroker (object) for backwards compatibility
    skipConfirmation?: boolean // Explicit skipConfirmation when broker is provided
  ): Promise<any> {
    // Handle overloaded parameters
    let actualSkipConfirmation = false;
    let verifiedBroker = undefined;
    
    if (typeof skipConfirmationOrBroker === 'boolean') {
      actualSkipConfirmation = skipConfirmationOrBroker;
    } else if (skipConfirmationOrBroker) {
      verifiedBroker = skipConfirmationOrBroker;
      actualSkipConfirmation = skipConfirmation || false;
    }
    try {
      console.log('\n' + '='.repeat(100));
      console.log(`🔍 [DEBUG] UNIFIED PIPELINE STARTED - ${submissionData.submissionMethod.toUpperCase()} SUBMISSION`);
      console.log('='.repeat(100));
      console.log(`📝 [PIPELINE-STEP-1] Input validation and data extraction`);
      console.log(`📊 [DATA] Submission data:`, {
        address: submissionData.address || 'NOT PROVIDED',
        askingPrice: submissionData.askingPrice || 'NOT PROVIDED',
        sizeAcres: submissionData.sizeAcres || 'NOT PROVIDED',
        contactEmail: submissionData.contactEmail || 'NOT PROVIDED',
        contactName: submissionData.contactName || 'NOT PROVIDED',
        zip: submissionData.zip || 'NOT PROVIDED',
        submissionMethod: submissionData.submissionMethod
      });
      console.log(`✅ [PIPELINE-STEP-1] Input validation complete`);
      
      // CRITICAL VALIDATION: Reject garbage submissions with no valid property data
      // This prevents automated monitoring/testing from creating fake deals
      // Use word boundaries to avoid false positives (e.g., "Swannanoa" contains "na" but isn't invalid)
      const INVALID_ADDRESS_PATTERNS = [
        /\bn\/?a\b/i,           // Match "n/a", "N/A", "na", "NA" as standalone words only
        /\btbd\b/i,             // "tbd", "TBD" as standalone
        /address\s+tbd/i,       // "address tbd"
        /property\s+submission/i, // "property submission"
        /emergency\s+email/i,   // "emergency email submission"
        /\bnone\b/i,            // "none" as standalone
        /\bunknown\b/i,         // "unknown" as standalone  
        /\bnull\b/i,            // "null" as standalone
        /catalyst\s+office/i,   // "catalyst office"
        /test\s+address/i,      // "test address"
        /sample\s+property/i    // "sample property"
      ];
      
      const normalizedAddress = (submissionData.address || '').trim().toLowerCase();
      
      // Enhanced validation: Check if address looks real (not random garbage)
      const hasInvalidTokens = INVALID_ADDRESS_PATTERNS.some(pattern => pattern.test(normalizedAddress));
      const hasNumbers = /\d/.test(normalizedAddress); // Must have at least one number
      const hasLetters = /[a-z]/.test(normalizedAddress); // Must have at least one letter
      const notJustRandomChars = !/^[0-9\s]+[a-z0-9]{10,}$/i.test(normalizedAddress); // Reject "6 C1u61um1q8tas8rd" pattern
      
      const hasValidAddress = submissionData.address && 
                             normalizedAddress.length > 5 &&
                             !hasInvalidTokens &&
                             hasNumbers &&
                             hasLetters &&
                             notJustRandomChars;
      
      // Explicitly coerce to numbers to avoid string truthiness issues
      const priceNum = Number(submissionData.askingPrice) || 0;
      const acresNum = Number(submissionData.sizeAcres) || 0;
      const hasValidPrice = priceNum > 0;
      const hasValidAcres = acresNum > 0;
      
      // PENDING DETAILS WORKFLOW (Dec 9, 2025): Allow deals with property name + location even without street address
      // Examples: "The Northmarq Development in Dayton, KY" or marketing materials with deal room links
      const hasPropertyName = !!(submissionData.propertyName && submissionData.propertyName.trim().length > 2);
      const hasLocation = !!(submissionData.city || submissionData.state);
      const hasDealRoomUrl = !!(submissionData.dealRoomUrl && submissionData.dealRoomUrl.trim().length > 10);
      const isPendingDetailsSubmission = !hasValidAddress && hasPropertyName && hasLocation;
      
      const hasValidData = hasValidAddress || hasValidPrice || hasValidAcres || isPendingDetailsSubmission;
      
      // Flag for pending details workflow
      const addressConfidence = hasValidAddress ? 'verified' : (isPendingDetailsSubmission ? 'pending' : 'verified');
      
      if (!hasValidData) {
        console.error('❌ [VALIDATION-FAILED] Submission has NO valid property data - REJECTING');
        console.error(`   Address: ${submissionData.address || 'NONE'}`);
        console.error(`   Price: ${submissionData.askingPrice || 'NONE'}`);
        console.error(`   Acres: ${submissionData.sizeAcres || 'NONE'}`);
        console.error(`   PropertyName: ${submissionData.propertyName || 'NONE'}`);
        console.error(`   City/State: ${submissionData.city || 'NONE'}, ${submissionData.state || 'NONE'}`);
        console.error(`   Source: ${submissionData.submissionMethod}`);
        console.error('❌ NO DEAL CREATED - NO EMAILS SENT - Garbage data rejected');
        
        return {
          success: false,
          error: 'Insufficient property data - no valid address, price, or acreage',
          dealCreated: false,
          reason: 'VALIDATION_FAILED',
          skipConfirmation: actualSkipConfirmation  // CRITICAL: Propagate flag to caller
        };
      }
      
      // Log pending details workflow
      if (isPendingDetailsSubmission) {
        console.log('📋 [PENDING-DETAILS] Deal has property name + location but no street address');
        console.log(`   PropertyName: ${submissionData.propertyName}`);
        console.log(`   Location: ${submissionData.city || 'N/A'}, ${submissionData.state || 'N/A'}`);
        console.log(`   DealRoomUrl: ${submissionData.dealRoomUrl || 'N/A'}`);
        console.log('📋 [PENDING-DETAILS] Will create deal with addressConfidence=pending, skip auto-classification');
      }
      
      console.log('✅ [VALIDATION-PASSED] Submission has valid property data - proceeding');
      
      // Store addressConfidence for later use
      (submissionData as any)._addressConfidence = addressConfidence;
      
      // Step 1: Create or find broker (with new broker flag for welcome email)
      // RACE CONDITION FIX: Use verifiedBroker if provided (from SMS auto opt-in), otherwise find/create
      console.log(`\n📝 [PIPELINE-STEP-2] Finding or creating broker...`);
      let broker, isNewBroker;
      
      if (verifiedBroker) {
        console.log(`👤 [BROKER] Using verified broker from SMS auto opt-in (smsOptIn: ${verifiedBroker.smsOptIn})`);
        broker = verifiedBroker;
        isNewBroker = false; // Broker already exists (came from SMS)
      } else {
        const result = await UnifiedDealPipeline.findOrCreateBrokerWithFlag(submissionData);
        broker = result.broker;
        isNewBroker = result.isNewBroker;
        console.log(`📊 [DATA] Broker result:`, { 
          found: !!broker, 
          id: broker?.id, 
          email: broker?.email,
          isNew: isNewBroker
        });
        console.log(`✅ [PIPELINE-STEP-2] Broker ${isNewBroker ? 'created' : 'found'} successfully`);
      }
      
      // Step 2: Create deal record (returns deal + isDuplicate flag)
      console.log(`\n📝 [PIPELINE-STEP-3] Creating deal record with broker ID: ${broker?.id || 'NULL'}`);
      console.log(`🚨 [PRODUCTION-DEBUG] About to call createDealRecord - if logs stop here, createDealRecord is throwing`);
      
      let dealResult;
      try {
        dealResult = await UnifiedDealPipeline.createDealRecord(submissionData, broker);
        console.log(`🚨 [PRODUCTION-DEBUG] createDealRecord returned successfully`);
      } catch (createError: any) {
        console.error(`🚨 [PRODUCTION-DEBUG] createDealRecord THREW EXCEPTION:`);
        console.error(`   Error name: ${createError?.name}`);
        console.error(`   Error message: ${createError?.message}`);
        console.error(`   Error stack: ${createError?.stack}`);
        console.error(`   Broker ID: ${broker?.id}`);
        console.error(`   Address: ${submissionData.address}`);
        throw createError; // Re-throw to maintain existing error handling
      }
      
      if (!dealResult || !dealResult.deal) {
        console.log(`❌ [ERROR] Failed to create deal record - dealResult is null or missing deal property`);
        console.log(`   dealResult: ${JSON.stringify(dealResult)}`);
        throw new Error('Failed to create deal record');
      }
      
      const deal = dealResult.deal;
      const isDuplicate = dealResult.isDuplicate;
      
      console.log(`🚨 [PRODUCTION-DEBUG] Deal created successfully - ID: ${deal.id}`);
      console.log(`📊 [DATA] Deal ID: ${deal.id} (duplicate: ${isDuplicate})`);
      console.log(`✅ [PIPELINE-STEP-3] Deal record ${isDuplicate ? 'found (duplicate)' : 'created'} successfully`);
      
      // Step 3.5: Geocode to enrich address data if ANY field is missing (MOVED BEFORE CONFIRMATION)
      // This ensures city/state/ZIP are populated before sending confirmation/missing info requests
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📝 [PIPELINE-STEP-3.5] GEOCODING CHECK - START`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 [BEFORE-GEOCODE] Deal address data:`, {
        dealId: deal.id,
        address: deal.address,
        city: deal.city || 'MISSING',
        state: deal.state || 'MISSING',
        zip: deal.zip || 'MISSING',
        county: deal.county || 'MISSING',
        latitude: deal.latitude || 'MISSING',
        longitude: deal.longitude || 'MISSING'
      });
      
      // Need geocoding if missing address fields OR if missing coordinates (for Census lookup)
      const needsAddressFields = !deal.city || !deal.state || !deal.zip;
      const needsCoordinates = !deal.latitude || !deal.longitude;
      const needsGeocoding = needsAddressFields || needsCoordinates;
      
      if (needsGeocoding && deal.address && deal.address !== 'TBD') {
        const missingFields = [];
        if (!deal.city) missingFields.push('city');
        if (!deal.state) missingFields.push('state');
        if (!deal.zip) missingFields.push('ZIP');
        if (!deal.latitude || !deal.longitude) missingFields.push('coordinates');
        console.log(`🌍 [GEOCODING-NEEDED] Missing fields: ${missingFields.join(', ')}`);
        console.log(`🔍 [GEOCODING-INPUT] Calling geocodingService.enrichWithZipCode with existing data to preserve user input`);
        console.log(`   Address: "${deal.address}"`);
        console.log(`   City (existing): ${deal.city || 'none'}`);
        console.log(`   State (existing): ${deal.state || 'none'}`);
        console.log(`   ZIP (existing): ${deal.zip || 'none'}`);
        
        try {
          const { geocodingService } = await import('./geocodingService');
          // CRITICAL FIX: Pass existing city/state to preserve user input
          const geocodeResult = await geocodingService.enrichWithZipCode({ 
            address: deal.address, 
            zip: deal.zip,
            city: deal.city,
            state: deal.state
          });
          
          console.log(`📥 [GEOCODING-RESULT] Raw result from API:`, JSON.stringify(geocodeResult, null, 2));
          
          // Save ANY geocoding results we got (partial or complete)
          if (geocodeResult && Object.keys(geocodeResult).length > 0) {
            // CRITICAL FIX: Preserve user city/state/ZIP while adding geocoding enrichment
            const updateData: any = {};
            
            // Convert coordinates to strings (use != null to preserve 0.0 coordinates)
            if (geocodeResult.latitude != null) updateData.latitude = String(geocodeResult.latitude);
            if (geocodeResult.longitude != null) updateData.longitude = String(geocodeResult.longitude);
            
            // NOTE: OpenCage geocodingService doesn't return FIPS or formattedAddress
            // Those fields only come from Geocodio (used in QCT analysis below)
            
            // CRITICAL VALIDATION: Check if geocoding result matches user's ORIGINAL input
            // Extract city/state from ORIGINAL submission data to validate geocoding
            console.log(`🔍 [GEOCODE-VALIDATION] Validating geocoding result against original submission...`);
            
            const originalCity = submissionData.city;
            const originalState = submissionData.state;
            console.log(`📝 [ORIGINAL-INPUT] City: "${originalCity || 'none'}", State: "${originalState || 'none'}"`);
            console.log(`🌍 [GEOCODED-RESULT] City: "${geocodeResult.city || 'none'}", State: "${geocodeResult.state || 'none'}"`);
            
            // Validate state if user provided it
            if (originalState && geocodeResult.state) {
              const origStateNorm = normalizeState(originalState);
              const geocodedStateNorm = normalizeState(geocodeResult.state);
              
              if (origStateNorm !== geocodedStateNorm) {
                console.log(`❌ [GEOCODE-REJECT] STATE MISMATCH! User: ${origStateNorm}, Geocoding: ${geocodedStateNorm}`);
                console.log(`⚠️ [GEOCODE-REJECT] REJECTING geocoding result - WRONG LOCATION!`);
                console.log(`✅ [GEOCODE-REJECT] PRESERVING original parsed data from deterministic parser`);
                // REJECT geocoding coordinates - wrong location
                updateData.latitude = null;
                updateData.longitude = null;
                // CRITICAL FIX: Preserve original parsed data from submissionData (deterministic parser)
                if (!deal.city && originalCity) updateData.city = originalCity;
                if (!deal.state && originalState) updateData.state = originalState;
                if (!deal.zip && submissionData.zip) updateData.zip = submissionData.zip;
                console.log(`📧 [GEOCODE-REJECT] Preserved parsed data: city=${originalCity}, state=${originalState}, zip=${submissionData.zip || 'none'}`);
              } else {
                console.log(`✅ [GEOCODE-VALIDATION] State matches (${origStateNorm}) - accepting result`);
                // Only fill in MISSING user fields - never overwrite user-submitted data
                if (!deal.city && geocodeResult.city) updateData.city = geocodeResult.city;
                if (!deal.state && geocodeResult.state) updateData.state = geocodeResult.state;
                if (!deal.zip && (geocodeResult as any).zip) updateData.zip = (geocodeResult as any).zip;
                if (!deal.county && geocodeResult.county) updateData.county = geocodeResult.county;
              }
            } else if (originalCity && geocodeResult.city) {
              // No original state, but we have city - validate city
              const origCityNorm = originalCity.toLowerCase().trim();
              const geocodedCityNorm = geocodeResult.city.toLowerCase().trim();
              
              if (origCityNorm !== geocodedCityNorm) {
                console.log(`❌ [GEOCODE-REJECT] CITY MISMATCH! User: ${origCityNorm}, Geocoding: ${geocodedCityNorm}`);
                console.log(`⚠️ [GEOCODE-REJECT] REJECTING geocoding result - WRONG LOCATION!`);
                console.log(`✅ [GEOCODE-REJECT] PRESERVING original parsed data from deterministic parser`);
                // REJECT geocoding coordinates - wrong location
                updateData.latitude = null;
                updateData.longitude = null;
                // CRITICAL FIX: Preserve original parsed data from submissionData
                if (!deal.city && originalCity) updateData.city = originalCity;
                if (!deal.state && submissionData.state) updateData.state = submissionData.state;
                if (!deal.zip && submissionData.zip) updateData.zip = submissionData.zip;
                console.log(`📧 [GEOCODE-REJECT] Preserved parsed data: city=${originalCity}, state=${submissionData.state || 'none'}, zip=${submissionData.zip || 'none'}`);
              } else {
                console.log(`✅ [GEOCODE-VALIDATION] City matches - accepting result`);
                if (!deal.city && geocodeResult.city) updateData.city = geocodeResult.city;
                if (!deal.state && geocodeResult.state) updateData.state = geocodeResult.state;
                if (!deal.zip && (geocodeResult as any).zip) updateData.zip = (geocodeResult as any).zip;
                if (!deal.county && geocodeResult.county) updateData.county = geocodeResult.county;
              }
            } else {
              // No original city or state to validate against
              console.log(`⚠️ [GEOCODE-VALIDATION] Cannot validate - no city/state in original submission`);
              
              // CRITICAL FIX (Nov 17, 2025): For EMAIL/WEB submissions where parser couldn't extract city/state,
              // ALLOW geocoding enrichment. For SMS, parser is deterministic so null means truly missing.
              if (submissionData.submissionMethod === 'email' || submissionData.submissionMethod === 'form') {
                console.log(`✅ [GEOCODE-VALIDATION] Email/Web submission - accepting geocoding enrichment`);
                console.log(`   Rationale: Parser stores full address in one field, geocoding extracts components`);
                if (!deal.city && geocodeResult.city) updateData.city = geocodeResult.city;
                if (!deal.state && geocodeResult.state) updateData.state = geocodeResult.state;
                if (!deal.zip && (geocodeResult as any).zip) updateData.zip = (geocodeResult as any).zip;
                if (!deal.county && geocodeResult.county) updateData.county = geocodeResult.county;
              } else {
                console.log(`⚠️ [GEOCODE-REJECT] SMS submission with no city/state - skipping auto-fill`);
                console.log(`   Rationale: SMS parser is deterministic, null means data truly missing from SMS`);
                // Don't fill in anything - let missing info flow handle it
              }
            }
            
            console.log(`💾 [DATABASE-UPDATE] Preparing to save geocoded data:`, JSON.stringify(updateData, null, 2));
            console.log(`🔄 [DATABASE-UPDATE] Calling storage.updateDeal("${deal.id}", {...})`);
            
            await storage.updateDeal(deal.id, updateData);
            
            console.log(`✅ [DATABASE-UPDATE] storage.updateDeal() completed successfully`);
            console.log(`🔄 [MEMORY-UPDATE] Merging geocoded data into in-memory deal object...`);
            
            Object.assign(deal, updateData);
            
            console.log(`✅ [GEOCODE-SUCCESS] Address enrichment COMPLETE:`, {
              city: geocodeResult.city || 'N/A',
              state: geocodeResult.state || 'N/A',
              zip: geocodeResult.zip || 'N/A',
              county: geocodeResult.county || 'N/A',
              coordinates: geocodeResult.latitude && geocodeResult.longitude 
                ? `${geocodeResult.latitude}, ${geocodeResult.longitude}` 
                : 'N/A'
            });
            
            console.log(`📊 [AFTER-GEOCODE] Deal object now contains:`, {
              dealId: deal.id,
              address: deal.address,
              city: deal.city,
              state: deal.state,
              zip: deal.zip,
              county: deal.county,
              latitude: deal.latitude,
              longitude: deal.longitude
            });
          } else {
            console.log(`⚠️ [GEOCODING-EMPTY] Geocoding returned no data - will request from broker`);
          }
        } catch (geocodeError) {
          console.error(`❌ [GEOCODING-ERROR] Geocoding failed:`, geocodeError);
        }
      } else if (!needsGeocoding) {
        console.log(`✅ [GEOCODING-SKIP] Address data already complete: ${deal.city}, ${deal.state} ${deal.zip}`);
      } else {
        console.log(`⚠️ [GEOCODING-SKIP] Address is TBD - skipping geocoding`);
      }
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`✅ [PIPELINE-STEP-3.5] GEOCODING CHECK - COMPLETE`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Step 3.5b: CENSUS DEMOGRAPHICS ENRICHMENT (after geocoding ensures coordinates)
      // Fetch Census data automatically for all deals with coordinates
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 [PIPELINE-STEP-3.5b] CENSUS DEMOGRAPHICS ENRICHMENT - START`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      if (deal.latitude && deal.longitude) {
        try {
          const { getCensusDemographics } = await import('./censusService');
          const lat = parseFloat(String(deal.latitude));
          const lng = parseFloat(String(deal.longitude));
          
          console.log(`🌍 [CENSUS] Fetching demographics for coordinates: ${lat}, ${lng}`);
          
          const censusData = await getCensusDemographics(lat, lng);
          
          const hasAnyCensusData = !!(
            censusData?.totalPopulation || censusData?.medianIncome || 
            censusData?.medianAge || censusData?.vacancyRate || censusData?.renterRate
          );
          
          if (hasAnyCensusData) {
            const censusUpdate = {
              censusTotalPopulation: censusData.totalPopulation,
              censusMedianIncome: censusData.medianIncome,
              censusMedianAge: censusData.medianAge != null ? String(censusData.medianAge) : null,
              censusVacancyRate: censusData.vacancyRate != null ? String(censusData.vacancyRate) : null,
              censusRenterRate: censusData.renterRate != null ? String(censusData.renterRate) : null,
              censusTractId: censusData.tractId,
            };
            await storage.updateDeal(deal.id, censusUpdate);
            Object.assign(deal, censusUpdate);
            console.log(`✅ [CENSUS] Demographics saved: Pop=${censusData.totalPopulation}, Income=$${censusData.medianIncome}, Age=${censusData.medianAge}`);
          } else {
            console.log(`⚠️ [CENSUS] No Census data available for this location`);
          }
        } catch (censusError) {
          console.error(`⚠️ [CENSUS] Census enrichment failed (non-blocking):`, censusError);
        }
      } else {
        console.log(`⚠️ [CENSUS] Skipping - no coordinates available for Census lookup`);
      }
      
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`✅ [PIPELINE-STEP-3.5b] CENSUS DEMOGRAPHICS ENRICHMENT - COMPLETE`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Step 3.6: EARLY MISSING INFO CHECK (BEFORE CONFIRMATION)
      // This sets the flag so sendInstantConfirmation can send missing info request
      console.log(`\n📝 [PIPELINE-STEP-3.6] Early missing info check (before confirmation)...`);
      const { FollowUpService } = await import('./followUpService');
      const earlyMissingInfoAnalysis = await FollowUpService.analyzeMissingFields(deal as any);
      
      if (earlyMissingInfoAnalysis.hasMissingFields) {
        console.log(`⚠️ [MISSING-VITAL-INFO] Deal is missing: ${earlyMissingInfoAnalysis.missingFields.join(', ')}`);
        console.log(`📧 [ACTION] Will send missing info request WITH confirmation`);
        
        // Set flag BEFORE sending confirmation so it's picked up
        (deal as any)._pendingMissingInfoRequest = true;
        (deal as any)._missingInfoAnalysis = earlyMissingInfoAnalysis;
        
          // CRITICAL FIX (Nov 21, 2025): REMOVED early SMS missing info dispatch
        // ARCHITECT FEEDBACK: Must await confirmation send BEFORE missing info request
        // Missing info requests are now handled AFTER confirmation in later pipeline step
        console.log(`📝 [DEFERRED] Missing info check complete - will be handled AFTER confirmation is sent`);
      } else {
        console.log(`✅ [COMPLETE-DATA] All vital info present`);
      }
      console.log(`✅ [PIPELINE-STEP-3.6] Early missing info check complete`);
      
      // Step 4: Send INSTANT confirmation (picks up missing info flag if set)
      // SKIP if duplicate OR if skipConfirmation flag is set
      let confirmationWasSent = false; // Track if confirmation was actually sent
      
      if (isDuplicate) {
        console.log(`\n⏭️ [PIPELINE-STEP-4] SKIPPING confirmation - duplicate submission detected`);
        console.log(`📧 Broker already received confirmation for original submission ${Math.round((Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60))} minutes ago`);
      } else if (actualSkipConfirmation) {
        console.log(`\n⏭️ [PIPELINE-STEP-4] SKIPPING confirmation - skipConfirmation flag set to TRUE`);
        console.log(`📧 Broker already received instant acknowledgment from webhook - preventing duplicate`);
        
        // CRITICAL FIX (Nov 21, 2025): For SMS submissions with skipConfirmation=true,
        // the webhook already sent "Received!" SMS acknowledgment
        // Treat this as confirmation sent so missing info requests can proceed
        if (submissionData.submissionMethod === 'sms') {
          console.log(`📱 [SMS-ACKNOWLEDGMENT] Webhook sent instant "Received!" SMS - treating as confirmation sent`);
          confirmationWasSent = true; // Enable missing info in Step 4.5
        }
      } else {
        console.log(`\n📝 [PIPELINE-STEP-4] Sending INSTANT confirmation...`);
        try {
          await UnifiedDealPipeline.sendInstantConfirmation(deal.id, submissionData, isNewBroker, broker);
          console.log(`✅ [PIPELINE-STEP-4] Instant confirmation sent successfully`);
          confirmationWasSent = true; // Mark confirmation as sent
        
        // Add small delay to ensure confirmation email is delivered BEFORE classification email
        // SendGrid processes emails asynchronously - this prevents out-of-order delivery
        console.log(`⏳ [EMAIL-SEQUENCING] Waiting 2 seconds to ensure confirmation is delivered first...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log(`✅ [EMAIL-SEQUENCING] Delay complete - proceeding with classification`);
        } catch (emailError) {
          console.error(`❌ [PIPELINE-STEP-4] Failed to send instant confirmation:`, emailError);
          confirmationWasSent = false; // Confirmation failed
          // Don't fail the entire pipeline if email fails
        }
      }
      
      // Step 4.5: MISSING INFO REQUEST (AFTER CONFIRMATION)
      // CRITICAL FIX (Nov 21, 2025): Send missing info request AFTER confirmation is sent
      // Architect feedback: Must await confirmation send BEFORE missing info request
      // GUARD: Only run if confirmation was ACTUALLY sent (not skipped)
      if (confirmationWasSent && (deal as any)._pendingMissingInfoRequest && earlyMissingInfoAnalysis.hasMissingFields) {
        console.log(`\n📝 [PIPELINE-STEP-4.5] Sending missing info request (after confirmation)...`);
        console.log(`   Missing: ${earlyMissingInfoAnalysis.missingFields.join(', ')}`);
        
        try {
          await UnifiedDealPipeline.handleMissingInformationFollowup(deal, broker, submissionData);
          // CRITICAL FIX (Dec 9, 2025): Clear flag to prevent duplicate in sendInstantConfirmation
          (deal as any)._pendingMissingInfoRequest = false;
          (deal as any)._missingInfoSent = true;
          console.log(`✅ [PIPELINE-STEP-4.5] Missing info request sent successfully`);
        } catch (followUpError) {
          console.error(`❌ [PIPELINE-STEP-4.5] Failed to send missing info request:`, followUpError);
          // Don't fail the entire pipeline if follow-up fails
        }
        
        // CRITICAL FIX (Nov 24, 2025): DO NOT skip classification when missing price/acreage
        // QCT analysis and basic classification only need ADDRESS, not financial data
        // User requirement: "all i need is an address"
        console.log(`\n✅ [PIPELINE-CONTINUE] Missing info requested, but CONTINUING to classification`);
        console.log(`   Reason: QCT and classification only need address (geocoded successfully)`);
        console.log(`   Will classify deal and send notification, then await missing financial info`);
        
        // Set status to pending_info but DON'T return early - let classification run
        await storage.updateDeal(deal.id, {
          status: 'pending_info' // Mark as needing info but still process
        });
      } else if ((deal as any)._pendingMissingInfoRequest && earlyMissingInfoAnalysis.hasMissingFields && !confirmationWasSent) {
        console.log(`\n⏭️ [PIPELINE-STEP-4.5] SKIPPING missing info request - confirmation was not sent (likely skipConfirmation=true)`);
        console.log(`   Note: Broker received instant acknowledgment from webhook - follow-up will be handled separately`);
      }
      
      // Step 4.5: EARLY MSA VALIDATION
      // Check if property is in target markets for classification optimization
      console.log(`\n📝 [PIPELINE-STEP-4.5] Early MSA validation...`);
      let hasValidGeography = !!(deal.county && deal.state);
      
      if (hasValidGeography) {
        console.log(`🗺️ Checking if ${deal.county}, ${deal.state} is in target markets...`);
        const msaResult = await MSAMatchingService.matchCountyToMarket(
          deal.county,
          deal.state,
          deal.productTypes as string[] || []
        );
        
        if (msaResult.matched) {
          console.log(`✅ [MSA-CHECK] Property IS in target market`);
          console.log(`📍 MSA: ${msaResult.msaName || 'Not identified'}`);
          
          // Update deal with MSA info
          await storage.updateDeal(deal.id, {
            inTargetMarket: true,
            msaName: msaResult.msaName,
            targetProductTypes: msaResult.productTypes
          });
          Object.assign(deal, {
            inTargetMarket: true,
            msaName: msaResult.msaName,
            targetProductTypes: msaResult.productTypes
          });
        } else {
          console.log(`❌ [MSA-CHECK] Property CONFIRMED outside target markets`);
          console.log(`📍 Location: ${deal.county}, ${deal.state}`);
          
          // Mark as out-of-market
          await storage.updateDeal(deal.id, {
            inTargetMarket: false,
            msaName: null,
            targetProductTypes: []
          });
          Object.assign(deal, {
            inTargetMarket: false,
            msaName: null,
            targetProductTypes: []
          });
        }
      } else {
        console.log(`⚠️ [MSA-CHECK] Missing county/state data`);
        console.log(`📍 Current data: county=${deal.county || 'null'}, state=${deal.state || 'null'}`);
      }
      console.log(`✅ [PIPELINE-STEP-4.5] MSA validation complete`);
      
      // Step 4.6: EARLY REJECTION CHECK - Skip expensive APIs if deal will be rejected anyway
      // This can save $0.50 per deal (HelloData comparables search)
      console.log(`\n📝 [PIPELINE-STEP-4.6] Early rejection check (before expensive APIs)...`);
      let shouldSkipExpensiveAPIs = false;
      let earlyRejectionReason = '';
      
      // Check 1: Acreage < 4 acres (if we already have this data)
      const acres = deal.sizeAcres ? parseFloat(deal.sizeAcres.toString()) : null;
      if (acres !== null && acres < 4) {
        console.log(`❌ [EARLY-REJECT] Deal has ${acres} acres < 4 acre minimum`);
        console.log(`💰 SKIPPING expensive APIs - saves $0.50 (HelloData comparables)`);
        shouldSkipExpensiveAPIs = true;
        
        // Determine data source
        let dataSource = 'broker-provided';
        const ingestionNotes = deal.ingestionNotes || '';
        if (ingestionNotes.includes('HelloData')) {
          dataSource = 'HelloData API';
        }
        
        earlyRejectionReason = `Property size is ${acres.toFixed(2)} acres (verified via ${dataSource}), below the 4-acre minimum threshold. If parcels can be assembled to increase acreage, please resubmit the deal.`;
      }
      
      // Check 2: Not in target market (if we already confirmed this)
      if (!shouldSkipExpensiveAPIs && deal.inTargetMarket === false) {
        console.log(`❌ [EARLY-REJECT] Deal is outside target acquisition markets`);
        console.log(`💰 SKIPPING expensive APIs - saves $0.50 (HelloData comparables)`);
        shouldSkipExpensiveAPIs = true;
        
        // BUGFIX (Dec 17, 2025): Remove "County" suffix before appending " County" to avoid "County County" duplication
        let locationInfo: string;
        if (deal.county && deal.state) {
          const countyName = deal.county.replace(/\s*County\s*$/i, '').trim();
          locationInfo = `${countyName} County, ${deal.state}`;
        } else {
          locationInfo = deal.address || 'Unknown location';
        }
        const msaInfo = deal.msaName ? ` (${deal.msaName})` : '';
        
        earlyRejectionReason = `Property located in ${locationInfo}${msaInfo} is not within Catalyst's target acquisition markets. We are currently only acquiring in specific MSAs for Active Adult, BTR/Conventional Apartments, and Lot Development projects.`;
      }
      
      // If early rejection detected, check QCT status for potential override
      if (shouldSkipExpensiveAPIs) {
        console.log(`\n🔍 [QCT-CHECK] Checking Qualified Census Tract status for potential override...`);
        
        // Import and check QCT status (cheap Geocodio call at $0.0005)
        const { GeocodioService } = await import('./geocodioService.js');
        const { qctService } = await import('./qctService.js');
        const geocodioService = new GeocodioService();
        
        // CRITICAL FIX: Build full address with user-provided city/state/ZIP to prevent ambiguous geocoding
        // Bug fix: Previously geocoded only street address, causing wrong city matches (e.g., Waynesville → Atlanta)
        const geocodeAddressParts = [deal.address];
        if (deal.city) geocodeAddressParts.push(deal.city);
        if (deal.state) geocodeAddressParts.push(deal.state);
        if (deal.zip) geocodeAddressParts.push(deal.zip);
        const fullGeocodeAddress = geocodeAddressParts.join(', ');
        
        console.log(`📍 [GEOCODE-DEBUG] Full address for geocoding: "${fullGeocodeAddress}"`);
        const geocodeResult = await geocodioService.geocodeAddress(fullGeocodeAddress);
        
        let qctStatus = 'N/A';
        let censusTractFips: string | undefined;
        
        // CRITICAL FIX: Save coordinates AND address components for complete data (no extra API cost - already geocoded)
        if (geocodeResult.success && geocodeResult.lat && geocodeResult.lng) {
          // Build update object with all geocoded data
          const geocodedUpdate: any = {
            latitude: String(geocodeResult.lat),
            longitude: String(geocodeResult.lng)
          };
          
          // Copy enrichment fields (FIPS, formatted address) - these don't conflict with user data
          if (geocodeResult.fips) geocodedUpdate.censusTractFips = geocodeResult.fips;
          if (geocodeResult.formattedAddress) geocodedUpdate.formattedAddress = geocodeResult.formattedAddress;
          
          // CRITICAL FIX (Nov 17, 2025): NEVER overwrite user-provided city/state/ZIP with geocoding data
          // Bug: Geocoding was returning wrong state (e.g., NC → CA) and overwriting correct parser data
          // Solution: Trust user-provided/email-parsed data over geocoding results for address components
          // Only use geocoding to fill in truly missing fields (county OK since it's not user-provided)
          const hasUserCity = deal.city && deal.city.trim().length > 0;
          const hasUserState = deal.state && deal.state.trim().length > 0;
          const hasUserZip = deal.zip && deal.zip.trim().length > 0;
          
          if (!hasUserCity && geocodeResult.city) {
            geocodedUpdate.city = geocodeResult.city;
            console.log(`📍 [GEOCODE-FILL] Added missing city: ${geocodeResult.city}`);
          } else if (hasUserCity) {
            console.log(`✅ [GEOCODE-PRESERVE] Keeping user-provided city: ${deal.city}`);
          }
          
          if (!hasUserState && geocodeResult.state) {
            geocodedUpdate.state = geocodeResult.state;
            console.log(`📍 [GEOCODE-FILL] Added missing state: ${geocodeResult.state}`);
          } else if (hasUserState) {
            console.log(`✅ [GEOCODE-PRESERVE] Keeping user-provided state: ${deal.state}`);
          }
          
          if (!hasUserZip && geocodeResult.zipCode) {
            geocodedUpdate.zip = geocodeResult.zipCode;
            console.log(`📍 [GEOCODE-FILL] Added missing ZIP: ${geocodeResult.zipCode}`);
          } else if (hasUserZip) {
            console.log(`✅ [GEOCODE-PRESERVE] Keeping user-provided ZIP: ${deal.zip}`);
          }
          
          // County is safe to fill since it's not typically user-provided
          if (!deal.county && geocodeResult.county) geocodedUpdate.county = geocodeResult.county;
          
          // Save to database
          await storage.updateDeal(deal.id, geocodedUpdate);
          console.log(`📍 Saved geocoded data:`, {
            coordinates: `${geocodeResult.lat}, ${geocodeResult.lng}`,
            city: geocodeResult.city || 'N/A',
            state: geocodeResult.state || 'N/A',
            zip: geocodeResult.zipCode || 'N/A',
            county: geocodeResult.county || 'N/A'
          });
          
          // Update in-memory deal object
          Object.assign(deal, geocodedUpdate);
          
          // CRITICAL FIX (Dec 19, 2025): Re-run MSA matching after geocoding enriches county/state
          // Bug: MSA matching ran BEFORE geocoding, so deals without initial county/state were marked as out-of-market
          // Then geocoding filled in the county, but MSA was never rechecked - leaving valid Durham, NC deals as "not in target markets"
          // Solution: Re-run MSA matching now that we have enriched county/state data
          const enrichedCounty = deal.county || geocodedUpdate.county;
          const enrichedState = deal.state || geocodedUpdate.state;
          
          if (enrichedCounty && enrichedState && deal.inTargetMarket !== true) {
            console.log(`\n🔄 [MSA-RECHECK] Re-running MSA matching with geocoded data...`);
            console.log(`📍 County: ${enrichedCounty}, State: ${enrichedState}`);
            
            const msaRecheck = await MSAMatchingService.matchCountyToMarket(
              enrichedCounty,
              enrichedState,
              deal.productTypes as string[] || []
            );
            
            if (msaRecheck.matched) {
              console.log(`✅ [MSA-RECHECK] NOW IN TARGET MARKET!`);
              console.log(`📍 MSA: ${msaRecheck.msaName}`);
              console.log(`📦 Product Types: ${msaRecheck.productTypes?.join(', ') || 'All'}`);
              
              // Update deal with MSA info
              await storage.updateDeal(deal.id, {
                inTargetMarket: true,
                msaName: msaRecheck.msaName,
                targetProductTypes: msaRecheck.productTypes,
                county: msaRecheck.county || enrichedCounty,
                state: msaRecheck.state || enrichedState
              });
              Object.assign(deal, {
                inTargetMarket: true,
                msaName: msaRecheck.msaName,
                targetProductTypes: msaRecheck.productTypes,
                county: msaRecheck.county || enrichedCounty,
                state: msaRecheck.state || enrichedState
              });
              
              // CRITICAL: Clear the early rejection flag since we're now in target market
              shouldSkipExpensiveAPIs = false;
              earlyRejectionReason = '';
              console.log(`💰 [MSA-RECHECK] Re-enabling full pipeline - deal IS in target market!`);
            } else {
              console.log(`❌ [MSA-RECHECK] Still outside target markets`);
            }
          }
        }
        
        if (geocodeResult.success && geocodeResult.fips) {
          censusTractFips = geocodeResult.fips;
          const qctCheck = await qctService.checkQCTStatus(geocodeResult.fips);
          qctStatus = qctCheck.isQCT ? 'YES' : 'NO';
          console.log(`📊 QCT Status: ${qctStatus} (FIPS: ${censusTractFips})`);
          
          // CRITICAL FIX (Nov 17, 2025): Save QCT status for ALL deals, not just QCT=YES or rejected
          // Bug: Deals that pass early checks never got their QCT status saved, showing "N/A" in dashboard
          await storage.updateDeal(deal.id, {
            qctStatus: qctStatus,
            censusTractFips: censusTractFips
          });
          Object.assign(deal, {
            qctStatus: qctStatus,
            censusTractFips: censusTractFips
          });
          console.log(`✅ [QCT-SAVED] Saved QCT status: ${qctStatus} for all future pipeline steps`);

          // DDA check — runs immediately after QCT, same geocoded coordinates
          try {
            const { checkDDA, extractZipFromAddress } = await import('./ddaLookupService.js');
            const zip = extractZipFromAddress((deal as any).address || '');
            const ddaResult = checkDDA((deal as any).state, (deal as any).county, zip);
            const ddaStatus = ddaResult.isDDA ? ddaResult.ddaType! : 'NO';
            await storage.updateDeal(deal.id, { ddaStatus } as any);
            Object.assign(deal, { ddaStatus });
            console.log(`📊 [DDA] Status: ${ddaStatus}${ddaResult.ddaName ? ` — ${ddaResult.ddaName}` : ''} (matched by: ${ddaResult.matchedBy || 'none'})`);
          } catch (ddaErr: any) {
            console.warn(`⚠️ [DDA] Check failed: ${ddaErr.message}`);
          }
        } else {
          // ENHANCED ERROR LOGGING: Show why QCT check was skipped
          console.error(`⚠️ [QCT-SKIPPED] Could not determine QCT status - geocoding failed`);
          console.error(`   Deal ID: ${deal.id}`);
          console.error(`   Address: ${deal.address}, ${deal.city}, ${deal.state}`);
          console.error(`   Geocoding success: ${geocodeResult.success}`);
          console.error(`   FIPS code: ${geocodeResult.fips || 'MISSING'}`);
          console.error(`   Geocoding error: ${geocodeResult.error || 'Unknown'}`);
          console.error(`   → QCT status will remain "N/A" until address is geocoded successfully`);
          qctStatus = 'N/A';

          // DDA check still runs even when QCT/geocoding fails — it only needs state/county/zip
          try {
            const { checkDDA, extractZipFromAddress } = await import('./ddaLookupService.js');
            const zip = (deal as any).zip || extractZipFromAddress((deal as any).address || '');
            const ddaResult = checkDDA((deal as any).state, (deal as any).county, zip);
            const ddaStatus = ddaResult.isDDA ? ddaResult.ddaType! : 'NO';
            await storage.updateDeal(deal.id, { ddaStatus } as any);
            Object.assign(deal, { ddaStatus });
            console.log(`📊 [DDA] Status: ${ddaStatus} (matched by: ${ddaResult.matchedBy || 'none'}) — ran via geocoding-failure fallback`);
          } catch (ddaErr: any) {
            console.warn(`⚠️ [DDA] Fallback check failed: ${ddaErr.message}`);
          }
        }
        
        if (qctStatus === 'YES') {
          console.log(`✅ [QCT-OVERRIDE] Property IS in Qualified Census Tract - cannot skip APIs`);
          console.log(`🔄 Must run FULL analysis (will override RED to YELLOW)`);
          console.log(`💡 Re-enabling HelloData for complete QCT deal enrichment`);
          
          shouldSkipExpensiveAPIs = false; // Must run full pipeline for QCT deals
          // Note: QCT status already saved above (lines 648-656) for all deals
        } else {
          console.log(`❌ [CONFIRMED-REJECTION] Not in QCT - deal would be rejected BUT checking for missing info first`);
          
          // CRITICAL FIX: Check for missing information BEFORE sending rejection
          // If vital data is missing, we CAN'T make an informed decision - must request info first
          console.log(`\n📝 [MISSING-INFO-CHECK] Checking if rejection is due to incomplete data...`);
          const { FollowUpService } = await import('./followUpService.js');
          const missingFieldsAnalysis = await FollowUpService.analyzeMissingFields(deal);
          
          if (missingFieldsAnalysis.hasMissingFields) {
            console.log(`⚠️ [INCOMPLETE-DATA] Deal is missing info: ${missingFieldsAnalysis.missingFields.join(', ')}`);
            
            // CRITICAL FIX (Nov 25, 2025): DO NOT block classification just because ZIP/state is missing
            // If we have geocoded coordinates, we CAN run classification (QCT analysis uses coordinates, not ZIP)
            // User requirement: "all I need is an address"
            const hasGeocodedCoordinates = geocodeResult.success && geocodeResult.lat && geocodeResult.lng;
            
            if (hasGeocodedCoordinates) {
              console.log(`✅ [GEOCODE-SUCCESS] We have coordinates (${geocodeResult.lat}, ${geocodeResult.lng}) - CONTINUING to classification`);
              console.log(`   Missing fields (${missingFieldsAnalysis.missingFields.join(', ')}) will be requested AFTER confirmation`);
              console.log(`   Rationale: QCT/classification uses geocoded coordinates, not ZIP/state strings`);
              
              // Store missing info flag but DON'T return early
              (deal as any)._pendingMissingInfoRequest = true;
              (deal as any)._missingInfoAnalysis = missingFieldsAnalysis;
              (deal as any)._skipEarlyRejection = true; // Flag to skip early rejection below
              
              // DON'T reject - continue to classification step
              shouldSkipExpensiveAPIs = false; // Force classification to run
              
              // Update deal status but DON'T return early
              await storage.updateDeal(deal.id, {
                status: 'pending_info', // Mark as needing info
                qctStatus: qctStatus,
                censusTractFips: censusTractFips
              });
              Object.assign(deal, { status: 'pending_info', qctStatus, censusTractFips });
              
            } else {
              // No coordinates - can't classify, request missing info
              console.log(`❌ [NO-COORDINATES] Geocoding failed - cannot run classification without location`);
              console.log(`🚫 [REJECTION-BLOCKED] Cannot send rejection email - need complete data to make informed decision`);
              console.log(`📧 [MISSING-INFO-ONLY] Will send missing info request AFTER confirmation`);
              
              // Update deal to pending status (not rejected)
              await storage.updateDeal(deal.id, {
                status: 'pending_info',
                qctStatus: qctStatus,
                censusTractFips: censusTractFips
              });
              
              // CRITICAL FIX: DO NOT send missing info request here!
              // Store flag for later (will be sent AFTER confirmation)
              (deal as any)._pendingMissingInfoRequest = true;
              (deal as any)._missingInfoAnalysis = missingFieldsAnalysis;
              
              // EARLY RETURN only if we have NO coordinates
              console.log(`⏸️ [PIPELINE-PAUSED] Classification postponed until address can be geocoded`);
              return {
                success: true,
                dealId: deal.id,
                classification: null,
                status: 'pending_info',
                teamAssignment: null,
                enrichmentApplied: false,
                enrichmentSource: null,
                comparablesFound: 0,
                skipConfirmation: actualSkipConfirmation,  // CRITICAL: Propagate flag to caller
                aiReasoning: `Classification postponed - awaiting geocodable address from broker`
              };
            }
          }
          
          // Check if we should skip early rejection (set when we have coordinates but missing fields)
          if ((deal as any)._skipEarlyRejection) {
            console.log(`⏭️ [SKIP-EARLY-REJECTION] Continuing to classification despite missing fields (have geocoded coordinates)`);
            // Don't return early - let code continue to API enrichment and classification
          } else {
            // If we reach here, data is complete - proceed with rejection
            console.log(`✅ [COMPLETE-DATA] All vital info present - proceeding with rejection`);
            console.log(`💰 TOTAL SAVINGS: $0.50 per rejected deal (HelloData comparables skipped)`);
          
          // Update deal immediately with rejection
          await storage.updateDeal(deal.id, {
            classification: 'red',
            status: 'clear_no',
            qctStatus: qctStatus,
            censusTractFips: censusTractFips,
            rejectionReason: earlyRejectionReason,
            assignedJrAnalyst: null, // No junior analyst position currently
            assignedAnalyst: 'Austin Blondell', // USER FIX (Dec 11): Austin assigned to ALL deals including red
            // Set rent fields to 0 (no comparables needed)
            topRentPSF: '0',
            avgRentPSF: '0',
            topRentPerUnit: '0',
            avgRentPerUnit: '0',
            comparableCount: 0,
            comparableNotes: 'Comparable search skipped - deal rejected early based on hard rules',
            // Set demographics to 0 (not needed for rejected deals)
            population55Plus5Mile: 0,
            income75Plus55Plus: 0
          });
          Object.assign(deal, {
            classification: 'red',
            status: 'clear_no',
            qctStatus: qctStatus,
            censusTractFips: censusTractFips,
            rejectionReason: earlyRejectionReason
          });
          
          console.log(`✅ [PIPELINE-COMPLETE] Deal marked RED/REVIEWING - skipped expensive API calls`);
          
          // CRITICAL FIX (Nov 25, 2025): Send classification notification for early rejected deals too!
          // Brokers need to know the outcome of their submission
          console.log(`\n📝 [PIPELINE-STEP-8] Sending classification result notification for early-rejected deal...`);
          const earlyRejectionResult = {
            classification: 'red',
            status: 'clear_no',
            reasoning: earlyRejectionReason,
            shortRejectionReason: earlyRejectionReason, // CRITICAL: Include full rejection reason for SMS/email
            rejectionReason: earlyRejectionReason, // Also include as rejectionReason for consistency
            assignedAnalyst: 'Austin Blondell', // USER FIX (Dec 11): Austin assigned to ALL deals
            qctStatus: qctStatus,
            censusTractFips: censusTractFips
          };
          try {
            await UnifiedDealPipeline.sendClassificationNotification(deal, broker, earlyRejectionResult);
            console.log(`✅ [PIPELINE-STEP-8] Classification notification sent for early-rejected deal`);
          } catch (notificationError) {
            console.error(`❌ [PIPELINE-STEP-8] Failed to send early rejection notification:`, notificationError);
            // Don't throw - let pipeline complete successfully even if notification fails
          }
          
          // EARLY RETURN - skip HelloData and other API steps
          // Return in same format as successful completion (lines 506-520)
          return {
            success: true,
            dealId: deal.id,
            classification: 'red',
            status: 'clear_no',
            skipConfirmation: actualSkipConfirmation,  // CRITICAL: Propagate flag to caller
            teamAssignment: {
              analyst: null,
              developer: null,
              partner: null
            },
            enrichmentApplied: false,
            enrichmentSource: null,
            comparablesFound: 0,
            aiReasoning: `Early rejection: ${earlyRejectionReason}`
          };
          }
        }
      } else {
        console.log(`✅ [EARLY-REJECT-CHECK] No early rejection triggers - continue to API enrichment`);
      }
      console.log(`✅ [PIPELINE-STEP-4.6] Early rejection check complete`);
      
      // CRITICAL FIX (Dec 18, 2025): Ensure QCT status is calculated for ALL deals, not just rejected ones
      // Deals that pass MSA checks were skipping QCT calculation entirely
      if (!deal.qctStatus || deal.qctStatus === 'N/A') {
        console.log(`\n🔍 [QCT-CHECK-FOR-ALL] Calculating QCT status for deal that passed MSA checks...`);
        const { GeocodioService } = await import('./geocodioService.js');
        const { qctService } = await import('./qctService.js');
        const geocodioService = new GeocodioService();
        
        // Build full address with user-provided city/state/ZIP
        const geocodeAddressParts = [deal.address];
        if (deal.city) geocodeAddressParts.push(deal.city);
        if (deal.state) geocodeAddressParts.push(deal.state);
        if (deal.zip) geocodeAddressParts.push(deal.zip);
        const fullGeocodeAddress = geocodeAddressParts.join(', ');
        
        console.log(`📍 [GEOCODE-DEBUG] Full address for QCT check: "${fullGeocodeAddress}"`);
        const geocodeResult = await geocodioService.geocodeAddress(fullGeocodeAddress);
        
        if (geocodeResult.success && geocodeResult.fips) {
          const qctCheck = await qctService.checkQCTStatus(geocodeResult.fips);
          const qctStatus = qctCheck.isQCT ? 'YES' : 'NO';
          console.log(`📊 [QCT-CALCULATED] QCT Status: ${qctStatus} (FIPS: ${geocodeResult.fips})`);
          
          // Save QCT status for this deal
          await storage.updateDeal(deal.id, {
            qctStatus: qctStatus,
            censusTractFips: geocodeResult.fips
          });
          Object.assign(deal, {
            qctStatus: qctStatus,
            censusTractFips: geocodeResult.fips
          });
          console.log(`✅ [QCT-SAVED] QCT status saved: ${qctStatus}`);

          // DDA check for deals using the secondary QCT path
          try {
            const { checkDDA, extractZipFromAddress } = await import('./ddaLookupService.js');
            const zip = (deal as any).zip || extractZipFromAddress((deal as any).address || '');
            const ddaResult = checkDDA((deal as any).state, (deal as any).county, zip);
            const ddaStatus = ddaResult.isDDA ? ddaResult.ddaType! : 'NO';
            await storage.updateDeal(deal.id, { ddaStatus } as any);
            Object.assign(deal, { ddaStatus });
            console.log(`📊 [DDA] Status: ${ddaStatus} (matched by: ${ddaResult.matchedBy || 'none'})`);
          } catch (ddaErr: any) {
            console.warn(`⚠️ [DDA] Check failed: ${ddaErr.message}`);
          }
        } else {
          console.warn(`⚠️ [QCT-FAILED] Could not determine QCT - geocoding failed for: ${fullGeocodeAddress}`);
          console.warn(`   Geocoding success: ${geocodeResult.success}, FIPS: ${geocodeResult.fips || 'MISSING'}`);
        }
      }
      
      // Step 5: AUTO-POPULATE data from APIs (HelloData for acreage)
      console.log(`\n📝 [PIPELINE-STEP-5] API enrichment starting...`);
      console.log(`🔍 Auto-populating deal data from APIs for address: ${deal.address}`);
      const enrichedData = await UnifiedDealPipeline.enrichDealWithAPIs(deal);
      
      // Step 5.5: Update deal with enriched data
      if (enrichedData && Object.keys(enrichedData).length > 0) {
        console.log(`📊 [DATA] Enriched fields: ${JSON.stringify(Object.keys(enrichedData))}`);
        const updatedDeal = await storage.updateDeal(deal.id, enrichedData);
        console.log(`✅ Deal enriched with ${Object.keys(enrichedData).length} API fields`);
        Object.assign(deal, updatedDeal);
      } else {
        console.log(`⚠️ No enrichment data returned from APIs`);
      }
      console.log(`✅ [PIPELINE-STEP-5] API enrichment complete`);
      
      // Step 6: HelloData Comparable Search and Auto-Classification
      // Only runs if we have complete vital information (early missing info check passed)
      console.log(`\n📝 [PIPELINE-STEP-6] HelloData comparable search & auto-classification starting...`);
      
      // PENDING DETAILS WORKFLOW (Dec 9, 2025): Skip classification if address is pending
      const dealAddressConfidence = (deal as any).addressConfidence || (submissionData as any)._addressConfidence || 'verified';
      if (dealAddressConfidence === 'pending') {
        console.log(`📋 [PENDING-DETAILS] Skipping auto-classification - address is pending manual entry`);
        console.log(`📋 [PENDING-DETAILS] Deal will remain unclassified until address is added`);
        
        // Update deal status to pending_info (awaiting address)
        await storage.updateDeal(deal.id, {
          status: 'pending_info',
          classification: 'unclassified',
          comparableNotes: 'Classification pending - awaiting street address from broker or deal room access',
          addressConfidence: 'pending'
        });
        
        // Return early with pending status
        return {
          success: true,
          dealId: deal.id,
          dealNumber: deal.dealNumber,
          classification: 'unclassified',
          status: 'pending_info',
          teamAssignment: {
            analyst: 'Austin Blondell',
            jrAnalyst: null
          },
          enrichmentApplied: false,
          enrichmentSource: null,
          comparablesFound: 0,
          skipConfirmation: actualSkipConfirmation,
          aiReasoning: 'Classification pending - deal has property name and location but no street address. Manual address entry required before auto-classification.',
          addressConfidence: 'pending'
        };
      }
      
      console.log(`🔍 Running HelloData comparable search for deal ${deal.id} (${submissionData.submissionMethod})`);
      console.log(`📊 [CLASSIFICATION-INPUT] Deal data:`, {
        dealId: deal.id,
        address: deal.address,
        city: deal.city,
        state: deal.state,
        zip: deal.zip,
        sizeAcres: deal.sizeAcres,
        askingPrice: deal.askingPrice,
        productTypes: deal.productTypes
      });
      
      let comparableResult;
      try {
        comparableResult = await UnifiedDealPipeline.runComparableSearchAndClassify(deal);
        console.log(`📊 [DATA] Classification result: ${JSON.stringify(comparableResult, null, 2)}`);
        console.log(`✅ [PIPELINE-STEP-6] Classification complete: ${comparableResult.classification}`);
        console.log(`✅ [CLASSIFICATION-SUCCESS] Deal ${deal.id} classified as ${comparableResult.classification}`);
      } catch (hellodataError) {
        console.error(`❌ [PIPELINE-STEP-6] HelloData search FAILED for deal ${deal.id}:`, hellodataError);
        console.error(`❌ [CLASSIFICATION-ERROR] Full error stack:`, hellodataError instanceof Error ? hellodataError.stack : 'No stack trace');
        console.log(`⚠️ Using fallback values for classification and rent data`);
        
        // STILL try to check QCT even if HelloData fails - QCT is cheap ($0.0005) and important
        let fallbackQctStatus = 'N/A';
        let fallbackFips = '';
        try {
          console.log(`🔍 [QCT-FALLBACK] Checking QCT status despite HelloData failure...`);
          const { qctService } = await import('./qctService.js');
          const { GeocodioService } = await import('./geocodioService.js');
          const geocodioService = new GeocodioService();
          
          // Build full address for geocoding
          const addressParts = [deal.address];
          if (deal.city) addressParts.push(deal.city);
          if (deal.state) addressParts.push(deal.state);
          if (deal.zip) addressParts.push(deal.zip);
          const fullAddress = addressParts.join(', ');
          
          const geocodeResult = await geocodioService.geocodeAddress(fullAddress);
          if (geocodeResult.success && geocodeResult.fips) {
            fallbackFips = geocodeResult.fips;
            const qctCheck = await qctService.checkQCTStatus(geocodeResult.fips);
            fallbackQctStatus = qctCheck.isQCT ? 'YES' : 'NO';
            console.log(`✅ [QCT-FALLBACK] QCT status determined: ${fallbackQctStatus} (FIPS: ${fallbackFips})`);
          } else {
            console.log(`⚠️ [QCT-FALLBACK] Could not geocode for QCT check: ${geocodeResult.error || 'No FIPS returned'}`);
          }
        } catch (qctError) {
          console.error(`❌ [QCT-FALLBACK] QCT check also failed:`, qctError);
        }
        
        // Provide fallback result to guarantee fields are populated
        comparableResult = {
          classification: 'unclassified',
          classificationDisplay: 'UNCLASSIFIED',
          status: 'pending_review',
          reasoning: `HelloData API unavailable: ${hellodataError instanceof Error ? hellodataError.message : 'Unknown error'}`,
          assignedJrAnalyst: null,
          assignedAnalyst: 'Austin Blondell', // Austin handles all unclassified deals
          qctStatus: fallbackQctStatus,
          censusTractFips: fallbackFips,
          comparableCount: 0,
          comparableNotes: 'HelloData API error - unable to fetch comparables',
          topRentPSF: 0,
          avgRentPSF: 0,
          topRentPerUnit: 0,
          avgRentPerUnit: 0
        };
      }
      
      // Step 6.5: Fetch ArcGIS Demographics (population and income data)
      // GUARANTEED to populate these fields even if API throws exception
      console.log(`\n`);
      console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨`);
      console.log(`🚨 [PIPELINE-STEP-6.5] DEMOGRAPHICS FETCH - THIS SHOULD BE VISIBLE IN LOGS 🚨`);
      console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨`);
      console.log(`📝 [PIPELINE-STEP-6.5] Starting demographics fetch for deal ${deal.id}...`);
      console.log(`📍 [PIPELINE-STEP-6.5] Address: ${deal.address}`);
      console.log(`📍 [PIPELINE-STEP-6.5] City: ${deal.city || 'N/A'}, State: ${deal.state || 'N/A'}`);
      
      let demographicsData;
      try {
        console.log(`🔄 [PIPELINE-STEP-6.5] Calling fetchDemographicsData()...`);
        demographicsData = await UnifiedDealPipeline.fetchDemographicsData(deal);
        console.log(`✅ [PIPELINE-STEP-6.5] fetchDemographicsData() returned:`, JSON.stringify(demographicsData));
      } catch (arcgisError) {
        console.error(`❌ [PIPELINE-STEP-6.5] ArcGIS demographics fetch EXCEPTION:`, arcgisError);
        console.error(`❌ [PIPELINE-STEP-6.5] Error type: ${arcgisError?.constructor?.name}`);
        console.error(`❌ [PIPELINE-STEP-6.5] Error message: ${arcgisError instanceof Error ? arcgisError.message : String(arcgisError)}`);
        console.log(`⚠️ Using fallback values (0) for demographics`);
        demographicsData = null; // Fallback will apply below
      }
      
      // Ensure fields are ALWAYS populated (use 0 if API returns null or throws)
      const guaranteedDemographics = {
        population55Plus5Mile: demographicsData?.population55Plus5Mile ?? 0,
        income75Plus55Plus: demographicsData?.income75Plus55Plus ?? 0
      };
      
      console.log(`📊 [PIPELINE-STEP-6.5] Guaranteed demographics values:`, JSON.stringify(guaranteedDemographics));
      
      // DEFENSIVE: Wrap in try-catch to ensure Step 8 runs even if demographics update fails
      try {
        console.log(`💾 [PIPELINE-STEP-6.5] Saving demographics to database...`);
        await storage.updateDeal(deal.id, guaranteedDemographics);
        Object.assign(deal, guaranteedDemographics);
        console.log(`✅ [PIPELINE-STEP-6.5] Demographics SAVED to database successfully!`);
      } catch (demographicsSaveError) {
        console.error(`❌ [PIPELINE-STEP-6.5] Failed to save demographics:`, demographicsSaveError);
        console.log(`⚠️ Continuing to Step 7 despite demographics save failure`);
      }
      
      if (demographicsData && (demographicsData.population55Plus5Mile != null || demographicsData.income75Plus55Plus != null)) {
        console.log(`✅ [PIPELINE-STEP-6.5] Demographics COMPLETE - Data found:`, {
          population55Plus: demographicsData.population55Plus5Mile,
          income75Plus: demographicsData.income75Plus55Plus
        });
      } else {
        console.log(`⚠️ [PIPELINE-STEP-6.5] Demographics COMPLETE - No data, defaulted to 0 for both fields`);
      }
      console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨`);
      console.log(`🚨 [PIPELINE-STEP-6.5] DEMOGRAPHICS FETCH COMPLETE 🚨`);
      console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n`)
      
      // Step 6.6: Fetch Census Bureau Demographics (additional data: total population, median income, etc.)
      console.log(`📊 [PIPELINE-STEP-6.6] Starting Census Bureau demographics fetch...`);
      try {
        const lat = parseFloat(deal.latitude || deal.manualLatitude);
        const lng = parseFloat(deal.longitude || deal.manualLongitude);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          const { getCensusDemographics } = await import('./censusService');
          const censusData = await getCensusDemographics(lat, lng);
          
          // Save any available census data (not just when population/income exist)
          const hasAnyCensusData = censusData && (
            censusData.totalPopulation || censusData.medianIncome || 
            censusData.medianAge || censusData.vacancyRate || censusData.renterRate
          );
          
          if (hasAnyCensusData) {
            const censusUpdate = {
              censusTotalPopulation: censusData.totalPopulation,
              censusMedianIncome: censusData.medianIncome,
              censusMedianAge: censusData.medianAge != null ? String(censusData.medianAge) : null,
              censusVacancyRate: censusData.vacancyRate != null ? String(censusData.vacancyRate) : null,
              censusRenterRate: censusData.renterRate != null ? String(censusData.renterRate) : null,
              censusTractId: censusData.tractId,
            };
            await storage.updateDeal(deal.id, censusUpdate);
            Object.assign(deal, censusUpdate);
            console.log(`✅ [PIPELINE-STEP-6.6] Census demographics saved successfully`);
          } else {
            console.log(`⚠️ [PIPELINE-STEP-6.6] No Census data available for this location`);
          }
        } else {
          console.log(`⚠️ [PIPELINE-STEP-6.6] No coordinates available - skipping Census fetch`);
        }
      } catch (censusError: any) {
        console.error(`❌ [PIPELINE-STEP-6.6] Census demographics fetch failed:`, censusError.message);
      }
      
      // Step 7: Apply classification based on comparable search
      // ALWAYS populate rent fields - use "0" as fallback if HelloData fails
      
      // Jan 13, 2026: DETAILED LOGGING for debugging classification save failures
      console.log(`\n📋 [PIPELINE-STEP-7] Classification result details:`);
      console.log(`   classification: ${comparableResult.classification}`);
      console.log(`   status: ${comparableResult.status}`);
      console.log(`   comparableCount: ${comparableResult.comparableCount}`);
      console.log(`   shortRejectionReason: ${comparableResult.shortRejectionReason}`);
      
      // DEFENSIVE: Ensure classification and status are ALWAYS set
      const finalClassification = comparableResult.classification || 'unclassified';
      const finalStatus = comparableResult.status || (finalClassification === 'red' ? 'clear_no' : 'pending_review');
      
      console.log(`   FINAL classification: ${finalClassification}`);
      console.log(`   FINAL status: ${finalStatus}`);
      
      const classificationUpdates: any = {
        classification: finalClassification,
        status: finalStatus,
        aiReasoning: comparableResult.reasoning,
        assignedAnalyst: comparableResult.assignedAnalyst || 'Austin Blondell',
        qctStatus: comparableResult.qctStatus || 'N/A',
        ozStatus: (comparableResult as any).ozStatus || 'N/A',
        censusTractFips: comparableResult.censusTractFips,
        comparableCount: comparableResult.comparableCount ?? 0,
        comparableNotes: comparableResult.comparableNotes,
        aiExplanatoryNotes: comparableResult.aiExplanatoryNotes || null,
        // GUARANTEE these fields are always populated (use "0" if API fails)
        topRentPSF: String(comparableResult.topRentPSF ?? 0),
        avgRentPSF: String(comparableResult.avgRentPSF ?? 0),
        topRentPerUnit: String(comparableResult.topRentPerUnit ?? 0),
        avgRentPerUnit: String(comparableResult.avgRentPerUnit ?? 0),
        // Use SHORT rejection reason from runComparableSearchAndClassify
        // For yellow/unclassified deals this will be null (no rejection)
        // For red deals this will be a short reason like "Property size below 4-acre minimum"
        rejectionReason: comparableResult.shortRejectionReason || null
      };
      
      // Store comparable data if found
      if (comparableResult.comparableData) {
        classificationUpdates.comparableData = comparableResult.comparableData;
      }
      
      // Dec 11, 2025: Store structured comparables with lat/lng for map display
      if (comparableResult.comparablesJson && comparableResult.comparablesJson.length > 0) {
        classificationUpdates.comparablesJson = comparableResult.comparablesJson;
        console.log(`📍 [PIPELINE-STEP-7] Storing ${comparableResult.comparablesJson.length} comparables with coordinates for map`);
      }
      
      // DEFENSIVE: Wrap Step 7 in try-catch to ensure Step 8 runs even if classification update fails
      console.log(`\n📝 [PIPELINE-STEP-7] Saving classification to database...`);
      console.log(`   CRITICAL VALUES: classification=${classificationUpdates.classification}, status=${classificationUpdates.status}`);
      try {
        const savedDeal = await storage.updateDeal(deal.id, classificationUpdates);
        if (!savedDeal) {
          console.error(`❌ [PIPELINE-STEP-7] storage.updateDeal returned null/undefined!`);
        } else {
          console.log(`✅ [PIPELINE-STEP-7] Classification saved: ${savedDeal.classification}`);
          // Verify saved values match intended values
          if (savedDeal.classification !== classificationUpdates.classification) {
            console.error(`⚠️ [PIPELINE-STEP-7] MISMATCH: Saved="${savedDeal.classification}" vs Intended="${classificationUpdates.classification}"`);
          }
        }
      } catch (classificationSaveError) {
        console.error(`❌ [PIPELINE-STEP-7] Failed to save classification:`, classificationSaveError);
        console.error(`   Error type: ${classificationSaveError instanceof Error ? classificationSaveError.constructor.name : typeof classificationSaveError}`);
        console.error(`   Error message: ${classificationSaveError instanceof Error ? classificationSaveError.message : String(classificationSaveError)}`);
        console.log(`⚠️ Continuing to Step 8 despite classification save failure`);
      }
      
      // Step 8: Send classification result notification to broker
      // NEW FLOW: (1) Instant confirmation → (2) Missing info check → (3) Classification result (this step)
      console.log(`\n📝 [PIPELINE-STEP-8] Sending classification result notification to broker...`);
      console.log(`📊 [STEP-8-DEBUG] Deal ID: ${deal.id}, Broker ID: ${broker.id}, Classification: ${comparableResult.classification}`);
      try {
        await UnifiedDealPipeline.sendClassificationNotification(deal, broker, comparableResult);
        console.log(`✅ [PIPELINE-STEP-8] Classification notification sent`);
      } catch (notificationError) {
        console.error(`❌ [PIPELINE-STEP-8] Failed to send classification notification:`, notificationError);
        console.error(`❌ [STEP-8-ERROR] Stack:`, notificationError instanceof Error ? notificationError.stack : 'No stack');
        // Don't throw - let pipeline complete successfully even if notification fails
      }
      
      // Missing info check now happens in Step 3.6 (BEFORE confirmation to ensure proper message order)

      // Step 9: Auto-send to matching partner developers
      try {
        const dealForSend = {
          ...deal,
          ...classificationUpdates,
        };
        const { autoSendMatchingDeveloperEmails } = await import('./partnerDeveloperAutoSend');
        // Fire-and-forget — don't block the pipeline result
        autoSendMatchingDeveloperEmails(dealForSend).catch(e =>
          console.error('❌ [AUTO-SEND] Background auto-send failed:', e)
        );
        console.log(`📨 [PIPELINE-STEP-9] Auto-send check queued for deal ${deal.id}`);
      } catch (autoSendError) {
        console.error(`❌ [PIPELINE-STEP-9] Auto-send setup failed:`, autoSendError);
      }

      console.log(`✅ Deal ${deal.id} processed successfully via ${submissionData.submissionMethod}`);
      console.log(`   Classification: ${comparableResult?.classification || 'unclassified'}`);
      console.log(`   Status: ${comparableResult?.status || 'pending_review'}`);
      console.log(`   Assigned Analyst: ${comparableResult?.assignedAnalyst || 'None'}`);
      
      return {
        success: true,
        dealId: deal.id,
        classification: comparableResult?.classification || 'unclassified',
        status: comparableResult?.status || 'pending_review',
        teamAssignment: comparableResult?.assignedAnalyst ? {
          analyst: comparableResult.assignedAnalyst,
          developer: null,
          partner: null
        } : null,
        enrichmentApplied: enrichedData && Object.keys(enrichedData).length > 0,
        enrichmentSource: enrichedData && Object.keys(enrichedData).length > 0 ? 'HelloData API' : null,
        comparablesFound: comparableResult?.comparableData?.count || 0,
        aiReasoning: comparableResult?.reasoning || 'Classified via automated workflow',
        skipConfirmation: actualSkipConfirmation  // CRITICAL: Propagate flag to caller
      };
      
    } catch (error) {
      console.error('❌ Error in unified deal pipeline:', error);
      throw error;
    }
  }

  /**
   * Re-run analysis pipeline for an existing deal after updates
   * Used when broker replies with missing information (ZIP, state, price, acreage)
   */
  static async processDealUpdate(deal: any): Promise<void> {
    try {
      console.log(`\n🔄 [DEAL-UPDATE] Re-running analysis pipeline for deal ${deal.id}`);
      console.log(`   Address: ${deal.address}`);
      console.log(`   ZIP: ${deal.zip || 'N/A'}`);
      console.log(`   State: ${deal.state || 'N/A'}`);
      
      // Step 1: Re-geocode if we have better address data now
      if (deal.zip && !deal.latitude) {
        console.log(`🗺️ [DEAL-UPDATE] Geocoding address...`);
        try {
          const { geocodioService } = await import('./geocodioService');
          
          // CRITICAL FIX: Build full address with city/state/ZIP for accurate geocoding
          const updateGeocodeAddressParts = [deal.address];
          if (deal.city) updateGeocodeAddressParts.push(deal.city);
          if (deal.state) updateGeocodeAddressParts.push(deal.state);
          if (deal.zip) updateGeocodeAddressParts.push(deal.zip);
          const fullUpdateGeocodeAddress = updateGeocodeAddressParts.join(', ');
          
          console.log(`📍 [GEOCODE-DEBUG] Full address for re-geocoding: "${fullUpdateGeocodeAddress}"`);
          const geocodioResult = await geocodioService.geocodeAddress(fullUpdateGeocodeAddress);
          
          if (geocodioResult.success && geocodioResult.lat && geocodioResult.lng) {
            await storage.updateDeal(deal.id, {
              latitude: String(geocodioResult.lat),
              longitude: String(geocodioResult.lng),
              state: geocodioResult.state || deal.state,
              zip: geocodioResult.zipCode || deal.zip,
              county: geocodioResult.county || deal.county
            });
            
            console.log(`✅ [DEAL-UPDATE] Geocoded: ${geocodioResult.lat}, ${geocodioResult.lng}`);
            
            // Update deal object for next steps
            deal.latitude = geocodioResult.lat;
            deal.longitude = geocodioResult.lng;
            deal.state = geocodioResult.state || deal.state;
            deal.county = geocodioResult.county || deal.county;
          }
        } catch (geocodeError) {
          console.error(`⚠️ [DEAL-UPDATE] Geocoding failed:`, geocodeError);
        }
      }
      
      // Step 2: Re-run comparable search and classification
      console.log(`🔍 [DEAL-UPDATE] Running comparable search and classification...`);
      const comparableResult = await UnifiedDealPipeline.runComparableSearchAndClassify(deal);
      
      if (comparableResult) {
        console.log(`✅ [DEAL-UPDATE] Classification complete: ${comparableResult.classification}`);
        console.log(`   Status: ${comparableResult.status}`);
        console.log(`   Assigned Analyst: ${comparableResult.assignedAnalyst || 'None'}`);
      }
      
      console.log(`✅ [DEAL-UPDATE] Analysis pipeline completed for deal ${deal.id}`);
      
    } catch (error) {
      console.error(`❌ [DEAL-UPDATE] Error re-running analysis:`, error);
      throw error;
    }
  }

  /**
   * Create basic deal record for instant response
   */
  static async createBasicDealRecord(submissionData: DealSubmissionData): Promise<any> {
    try {
      console.log(`⚡ Creating basic deal record for instant response`);
      
      // Step 1: Find or create broker (track if new for welcome email)
      const { broker, isNewBroker } = await UnifiedDealPipeline.findOrCreateBrokerWithFlag(submissionData);
      
      // Step 2: Create basic deal record (no API calls)
      // CRITICAL FIX: createDealRecord returns { deal, isDuplicate }, not just deal
      const { deal, isDuplicate } = await UnifiedDealPipeline.createDealRecord(submissionData, broker);
      
      if (!deal) {
        return {
          success: false,
          error: 'Failed to create deal record'
        };
      }
      
      if (isDuplicate) {
        console.log(`⚠️ Duplicate deal detected - returning existing deal ${deal.id} without re-sending emails`);
      }
      
      console.log(`✅ Basic deal record created: ${deal.id} (broker: ${broker?.id || 'none'})`);
      
      // Step 3: Save original email/SMS content to communications table
      if (submissionData.rawEmailContent && broker) {
        try {
          await storage.createCommunication({
            brokerId: broker.id,
            relatedDealId: deal.id,
            channel: 'email',
            direction: 'inbound',
            rawText: submissionData.rawEmailContent,
            status: 'resolved',
            eventType: 'inbound_email'
          });
          console.log(`✅ Original email content saved to communications for deal ${deal.id}`);
        } catch (commError) {
          console.error(`⚠️ Failed to save original email content:`, commError);
          // Don't fail deal creation if communication save fails
        }
      } else if (submissionData.rawSmsContent && broker) {
        try {
          // CRITICAL FIX (Bug 2): Keep communication unresolved if deal needs follow-up info
          // This allows ResolutionService to find active threads for broker replies
          const hasMissingData = !deal.zip || !deal.state || !deal.askingPrice || !deal.sizeAcres;
          const needsFollowup = hasMissingData;
          
          console.log(`🔧 [BUG2-FIX] SMS communication resolution check:`, {
            hasMissingData,
            needsFollowup,
            resolved: !needsFollowup
          });
          
          await storage.createCommunication({
            brokerId: broker.id,
            relatedDealId: deal.id,
            channel: 'sms',
            direction: 'inbound',
            rawText: submissionData.rawSmsContent,
            status: needsFollowup ? 'pending_followup' : 'resolved',
            resolved: !needsFollowup, // Keep false if we need broker's reply
            eventType: 'inbound_sms'
          });
          console.log(`✅ Original SMS content saved to communications for deal ${deal.id} (resolved: ${!needsFollowup})`);
        } catch (commError) {
          console.error(`⚠️ Failed to save original SMS content:`, commError);
          // Don't fail deal creation if communication save fails
        }
      }
      
      return {
        success: true,
        dealId: deal.id,
        brokerId: broker?.id || null,
        isNewBroker: isNewBroker
      };
      
    } catch (error) {
      console.error('❌ Error creating basic deal record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ATOMIC WRITE-BEFORE-SEND: Create communication record BEFORE sending
   * Database unique constraint prevents ANY duplicates even with concurrent requests
   */
  private static async claimNotificationSlot(dealId: string, eventType: string, brokerId: string): Promise<boolean> {
    try {
      console.log(`🔒 [ATOMIC-CHECK] Claiming notification slot for deal ${dealId}, event ${eventType}...`);
      
      // Attempt to write communication record with event_type BEFORE sending
      // The unique constraint on (related_deal_id, event_type) will reject duplicates
      await storage.createCommunication({
        brokerId: brokerId,
        relatedDealId: dealId,
        channel: "email",
        direction: "outbound",
        rawText: `Notification placeholder for ${eventType}`, // Will be updated after send
        eventType: eventType, // This is the key field for idempotency
        status: "pending_followup" // Mark as pending until email actually sends
      });
      
      console.log(`✅ [ATOMIC-CHECK] Notification slot claimed successfully - proceeding with send`);
      return true; // Slot claimed, safe to send
      
    } catch (error: any) {
      // Check if this is a unique constraint violation (duplicate notification)
      if (error?.code === '23505' || error?.message?.includes('unique constraint') || error?.message?.includes('duplicate key')) {
        console.log(`⏭️ [IDEMPOTENCY] Notification already sent for deal ${dealId}, event ${eventType} - SKIPPING`);
        return false; // Duplicate detected by database
      }
      
      // For other errors, log but allow send to proceed (fail open for non-duplicate errors)
      console.error('❌ Error claiming notification slot:', error);
      return true; // Allow send on non-constraint errors
    }
  }

  /**
   * FIXED: Now uses ONLY outreach management templates - sends BOTH email and SMS
   * ALL notifications must come from outreach management system
   */
  static async sendInstantConfirmation(
    dealId: string, 
    submissionData: DealSubmissionData, 
    isNewBroker: boolean = false,
    verifiedBroker?: any // Optional: if provided, skip broker re-fetch (prevents race condition)
  ): Promise<void> {
    try {
      console.log(`🔍 [CONFIRMATION-START] Starting confirmation for deal ${dealId}`);
      
      // Get the deal record for confirmation details
      const deal = await storage.getDealById(dealId);
      console.log(`📊 [CONFIRMATION-DATA] Deal fetched:`, { found: !!deal, id: deal?.id, brokerId: deal?.brokerId });
      
      if (!deal) {
        throw new Error(`Deal ${dealId} not found for template-based confirmation`);
      }
      
      // ATOMIC IDEMPOTENCY CHECK: Claim notification slot BEFORE sending
      // This writes a record to the database that prevents duplicate sends
      const canSend = await UnifiedDealPipeline.claimNotificationSlot(dealId, 'deal_submitted', deal.brokerId);
      if (!canSend) {
        console.log(`⏭️ [DUPLICATE-PREVENTED] Confirmation already sent for deal ${dealId} - SKIPPING`);
        return;
      }
      
      // Get broker contact info - use submission data first, fall back to broker record
      let recipientEmail = submissionData.contactEmail;
      let recipientPhone = submissionData.contactPhone;
      let broker = verifiedBroker; // Use verified broker if provided (prevents race condition)
      console.log(`📧 [CONTACT-INFO] From submission: email=${recipientEmail || 'NONE'}, phone=${recipientPhone || 'NONE'}`);
      
      // Fetch broker only if not provided (needed for SMS opt-in check and to avoid race condition)
      if (deal.brokerId && !broker) {
        console.log(`📧 Fetching broker record for ${deal.brokerId}...`);
        broker = await storage.getBrokerById(deal.brokerId);
        console.log(`👤 [BROKER-DATA] Broker fetched:`, { 
          found: !!broker, 
          email: broker?.email, 
          phone: broker?.phone,
          smsOptIn: broker?.smsOptIn 
        });
      } else if (broker) {
        console.log(`👤 [BROKER-DATA] Using verified broker (smsOptIn: ${broker.smsOptIn}) - SKIPPING database fetch to prevent race condition`);
      }
      
      // Always fill in contact info from broker if missing
      if (broker) {
        recipientEmail = recipientEmail || broker?.email || undefined;
        recipientPhone = recipientPhone || broker?.phone || undefined;
      }
      
      console.log(`📧 [FINAL-CONTACT] email=${recipientEmail || 'NONE'}, phone=${recipientPhone || 'NONE'}`);
      
      if (!recipientEmail && !recipientPhone) {
        console.log('❌ [CONFIRMATION-SKIP] No email or phone available - skipping confirmation');
        return;
      }

      console.log(`📧 Sending confirmation notification for deal ${dealId} - email: ${recipientEmail}, sms: ${recipientPhone}`);

      // Import EventDispatchService to send BOTH email and SMS
      const { EventDispatchService } = await import('./eventDispatch');
      
      // Extract broker name from submission data or email
      const brokerName = submissionData.contactName || 
                        (recipientEmail ? recipientEmail.split('@')[0] : '') || 
                        'Valued Broker';

      // CRITICAL FIX: Build address from VALIDATED data (after geocoding and validation)
      // The 'address' field may contain fake city/state from AI parser like "48 Swannanoa Road, Deal, SU"
      // We MUST strip any trailing comma segments to prevent fake data from showing in emails
      let propertyAddress = deal.address || 'Property';
      
      // ALWAYS strip trailing comma segment (could be fake city/state from AI)
      // This regex removes everything after the last comma: ", Deal, SU" → ""
      // Example: "48 Swannanoa Road, Deal, SU" → "48 Swannanoa Road"
      const cleanAddress = propertyAddress.replace(/,\s*[^,]+,\s*[^,]+$/, '').trim();
      
      // CRITICAL FIX (Nov 26, 2025): Use submissionData as fallback for city/state/zip
      // At confirmation time, geocoding may not have completed yet - deal record might be missing these
      // submissionData contains parsed values from the original email/SMS that should be used first
      const cityValue = (deal as any).city || submissionData.city;
      const stateValue = deal.state || submissionData.state;
      const zipValue = deal.zip || submissionData.zip;
      
      console.log(`📍 [ADDRESS-BUILD] Sources - deal: city=${(deal as any).city || 'null'}, state=${deal.state || 'null'}, zip=${deal.zip || 'null'}`);
      console.log(`📍 [ADDRESS-BUILD] Sources - submission: city=${submissionData.city || 'null'}, state=${submissionData.state || 'null'}, zip=${submissionData.zip || 'null'}`);
      console.log(`📍 [ADDRESS-BUILD] Final: city=${cityValue || 'null'}, state=${stateValue || 'null'}, zip=${zipValue || 'null'}`);
      
      // Build full address with validated geocoded data: "123 Main St, Charlotte, NC 28202"
      const addressParts = [cleanAddress];
      if (cityValue) addressParts.push(cityValue);
      if (stateValue) addressParts.push(stateValue);
      if (zipValue) addressParts.push(zipValue);
      
      if (addressParts.length > 1) {
        propertyAddress = addressParts.join(', ');
        console.log(`✅ [ADDRESS-VALIDATED] Using full address: ${propertyAddress}`);
      } else {
        // No city/state/zip available - use clean street address only
        propertyAddress = cleanAddress;
        console.log(`⚠️ [ADDRESS-INCOMPLETE] Using street address only (no city/state/zip): ${propertyAddress}`);
      }
      
      // Use EventDispatchService to send BOTH email and SMS via outreach templates
      // RACE CONDITION FIX: Pass broker object to avoid stale database fetch in sendSMS
      let result = { emailSent: false, smsSent: false };
      
      console.log('\n' + '='.repeat(80));
      console.log('📣 [UNIFIED-PIPELINE] CONFIRMATION DECISION POINT');
      console.log('='.repeat(80));
      console.log(`🎯 Deal ID: ${deal.id}`);
      console.log(`📧 Broker Email: ${recipientEmail || 'NONE'}`);
      console.log(`📱 Broker Phone: ${recipientPhone || 'NONE'}`);
      console.log(`📍 Property Address: ${propertyAddress}`);
      console.log('='.repeat(80));
      
      console.log(`🎯 [SEND-CONFIRMATION] Calling EventDispatchService.emit('deal_submitted')...`);
      result = await EventDispatchService.emit('deal_submitted', {
          dealId: deal.id,
          brokerId: deal.brokerId,
          brokerEmail: recipientEmail,
          brokerPhone: recipientPhone,
          brokerName: brokerName,
          propertyAddress: propertyAddress, // Use validated address
          address: propertyAddress, // Alias for template compatibility
          broker: broker // Pass broker object to prevent SMS race condition
        });

      console.log(`✅ [CONFIRMATION-RESULT] Email sent: ${result.emailSent ? 'YES ✓' : 'NO ✗'}, SMS sent: ${result.smsSent ? 'YES ✓' : 'NO ✗'}`);
      
      if (!result.emailSent && !result.smsSent) {
        console.error(`❌ CRITICAL: No 'deal_submitted' template found in outreach management system`);
        console.error(`❌ ALL notifications MUST use outreach management templates`);
        throw new Error(`No confirmation template configured - ALL notifications must use outreach management templates`);
      }

      // CRITICAL FIX: Update placeholder communication record to 'resolved' to prevent duplicate sends
      // The placeholder was created by claimNotificationSlot() with status='pending_followup'
      // Now that we've successfully sent, mark it 'resolved' so future checks block duplicates
      if (result.emailSent || result.smsSent) {
        try {
          console.log(`🔧 [UPDATE-START] Attempting to update placeholder record to 'resolved' for deal ${dealId}...`);
          const updateResult = await db
            .update(communications)
            .set({ status: 'resolved' })
            .where(
              and(
                eq(communications.relatedDealId, dealId),
                eq(communications.eventType, 'deal_submitted'),
                eq(communications.status, 'pending_followup')
              )
            );
          console.log(`✅ [IDEMPOTENCY-FIX] Placeholder record update completed - rows affected:`, updateResult);
        } catch (updateError) {
          console.error(`⚠️ Failed to update placeholder record (non-critical):`, updateError);
          // Don't fail the whole function if this update fails
        }
      }

      // NEW: Send SMS opt-in email to brokers missing phone OR haven't opted in (ONE TIME only per broker)
      // CRITICAL FIX: Skip SMS opt-in for NEW BROKERS during email submission - they should get welcome email via registration system
      // CRITICAL FIX (Nov 22, 2025): Use existing `broker` variable instead of re-fetching to prevent race condition
      // Race condition bug: Re-fetching returns OLD smsOptIn=false even after SMS auto opt-in set it to true
      if (deal.brokerId && recipientEmail && !isNewBroker && broker) {
        console.log(`📱 [SMS-OPT-IN-CHECK] Using existing broker data (smsOptIn: ${broker.smsOptIn}) - NOT re-fetching to prevent race condition`);
        
        // Check if broker lacks phone OR hasn't opted in to SMS
        const lacksPhone = !broker.phone || broker.phone.length === 0;
        const hasntOptedIn = broker.smsOptIn !== true;
        const needsSmsOptIn = lacksPhone || hasntOptedIn;
        
        if (needsSmsOptIn) {
          console.log(`📱 Broker needs SMS setup (lacks phone: ${lacksPhone}, hasn't opted in: ${hasntOptedIn})`);
          
          // CRITICAL: Check if we've already sent SMS opt-in email to this broker
          // Query communications table for existing 'sms_opt_in' event for this broker
          const existingOptInEmail = await db
            .select()
            .from(communications)
            .where(
              and(
                eq(communications.brokerId, deal.brokerId),
                eq(communications.eventType, 'sms_opt_in')
              )
            )
            .limit(1);
          
          if (existingOptInEmail.length > 0) {
            console.log(`ℹ️ SMS opt-in email already sent to broker on ${existingOptInEmail[0].createdAt} - skipping duplicate`);
          } else {
            console.log(`📧 First SMS opt-in email for this broker - sending now`);
            try {
              const smsOptInResult = await EventDispatchService.emit('sms_opt_in', {
                brokerName: brokerName,
                brokerEmail: recipientEmail,
                brokerId: deal.brokerId
              });
              
              if (smsOptInResult.emailSent) {
                console.log(`✅ SMS opt-in email sent successfully`);
                
                // Record this event in communications table to prevent future duplicates
                await db.insert(communications).values({
                  brokerId: deal.brokerId,
                  eventType: 'sms_opt_in',
                  email: recipientEmail,
                  channel: 'email',
                  direction: 'outbound',
                  rawText: 'SMS opt-in encouragement email sent',
                  relatedDealId: deal.id
                });
                console.log(`✅ Logged 'sms_opt_in' event to prevent future duplicates`);
              }
            } catch (smsOptInError) {
              console.error(`❌ Failed to send SMS opt-in email:`, smsOptInError);
              // Don't fail the entire pipeline if SMS opt-in email fails
            }
          }
        } else {
          console.log(`✓ Broker has phone and opted in to SMS - no opt-in email needed`);
        }
      } else if (isNewBroker) {
        console.log(`🆕 [NEW-BROKER] Skipping SMS opt-in email for new broker - they should receive welcome email via EventDispatchService.brokerRegistered()`);
      }
      
      // CRITICAL FIX: Now send missing info request if it was deferred
      // This ensures confirmation is ALWAYS sent BEFORE missing info request
      // GUARD (Dec 9, 2025): Check _missingInfoSent to prevent duplicate (step 4.5 may have already sent)
      if ((deal as any)._pendingMissingInfoRequest && !(deal as any)._missingInfoSent) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📋 [DEFERRED-MISSING-INFO] Sending missing info request NOW (after confirmation)`);
        console.log(`${'='.repeat(80)}\n`);
        
        try {
          await UnifiedDealPipeline.handleMissingInformationFollowup(deal, broker, submissionData);
          (deal as any)._pendingMissingInfoRequest = false;
          (deal as any)._missingInfoSent = true;
          console.log(`✅ [MISSING-INFO-SENT] Missing info request sent successfully after confirmation`);
        } catch (followUpError) {
          console.error(`❌ [MISSING-INFO-ERROR] Failed to send missing info request:`, followUpError);
        }
      } else if ((deal as any)._missingInfoSent) {
        console.log(`⏭️ [SKIP-DUPLICATE] Missing info request already sent in step 4.5 - skipping`);
      }

    } catch (error) {
      console.error(`❌ Failed to send template-based confirmation for deal ${dealId}:`, error);
      throw error;
    }
  }
  
  /**
   * Send classification notification to broker after HelloData analysis completes
   * Uses existing SMS templates from outreach management
   */
  static async sendClassificationNotification(deal: any, broker: any, comparableResult: any): Promise<void> {
    try {
      console.log('\n' + '='.repeat(80));
      console.log('📬 [CLASSIFICATION-NOTIFICATION] Preparing to send classification result');
      console.log('='.repeat(80));
      console.log(`🎯 Deal ID: ${deal.id}`);
      console.log(`📊 Classification: ${comparableResult.classification}`);
      console.log(`📋 Status: ${comparableResult.status}`);
      console.log(`👤 Broker: ${broker?.firstName} ${broker?.lastName}`);
      console.log('='.repeat(80));
      
      if (!broker || (!broker.email && !broker.phone)) {
        console.log('⚠️ [SKIP] No broker contact info - cannot send classification notification');
        return;
      }
      
      // CRITICAL FIX: Map classification to template EVENT names (not display names!)
      // TemplateService.getSMSTemplate() looks up by the "event" field, not the "name" field
      // SMS events: "status_pursuing" (green), "status_under_review" (yellow), "status_rejected" (red)
      // Email events: Same as SMS
      let smsTemplateEvent: string;
      let emailTemplateEvent: string;
      let templateDescription: string;
      let normalizedClassification: string;  // Canonical value for idempotency
      
      switch (comparableResult.classification) {
        case 'green':
        case 'high_priority':
          smsTemplateEvent = 'status_pursuing';  // Maps to "High Priority - Green Deal" template
          emailTemplateEvent = 'status_pursuing';
          templateDescription = 'High Priority (Green Deal)';
          normalizedClassification = 'green';  // Canonical key
          break;
        
        case 'yellow':
        case 'potential':
        case 'reviewing':
          smsTemplateEvent = 'status_under_review';  // Maps to "Deal Approved (Yellow)" template
          emailTemplateEvent = 'status_under_review';
          templateDescription = 'Yellow/Approved';
          normalizedClassification = 'yellow';  // Canonical key
          break;
        
        case 'red':
        case 'clear_no':
        case 'passed':  // Legacy classification value - treat as red/rejected
          smsTemplateEvent = 'status_rejected';  // Maps to "Deal Not a Fit" template
          emailTemplateEvent = 'status_rejected';
          templateDescription = 'Deal Not a Fit';
          normalizedClassification = 'red';  // Canonical key
          break;
        
        case 'unclassified':
          console.log('⏭️ [SKIP] Deal is unclassified - not sending notification yet');
          return;
        
        default:
          console.log(`⚠️ [SKIP] Unknown classification: ${comparableResult.classification}`);
          return;
      }
      
      console.log(`📤 [SEND] Using templates - SMS event: "${smsTemplateEvent}", Email event: "${emailTemplateEvent}"`);
      
      // IDEMPOTENCY CHECK: Prevent duplicate classification notifications
      // Use NORMALIZED classification to prevent synonym duplicates (green/high_priority, yellow/potential/reviewing, red/clear_no)
      const idempotencyKey = `classification_${normalizedClassification}`;
      const canSend = await UnifiedDealPipeline.claimNotificationSlot(deal.id, idempotencyKey, broker.id);
      if (!canSend) {
        console.log(`⏭️ [DUPLICATE-PREVENTED] Classification notification already sent for deal ${deal.id} - SKIPPING`);
        return;
      }
      
      // Import services
      const { TemplateService } = await import('./templateService');
      const { sendSMS } = await import('./smsService');
      const { emailService } = await import('./emailService');
      
      // Build address for notification - include city/state/ZIP if available
      let propertyAddress = deal.address || 'Your property';
      const addressParts = [deal.address];
      if ((deal as any).city) addressParts.push((deal as any).city);
      if (deal.state) addressParts.push(deal.state);
      if (deal.zip) addressParts.push(deal.zip);
      
      if (addressParts.length > 1) {
        propertyAddress = addressParts.filter(Boolean).join(', ');
      }
      
      // Use short rejection reason for notifications (not the full HelloData analysis)
      const shortReason = comparableResult.shortRejectionReason || comparableResult.error || 'Does not meet acquisition criteria';
      const variables = {
        brokerName: `${broker.firstName || ''} ${broker.lastName || ''}`.trim(),
        propertyAddress: propertyAddress,
        address: propertyAddress,
        property: propertyAddress,
        classification: comparableResult.classification,
        status: comparableResult.status,
        reason: shortReason,
        rejectionReason: shortReason,
        analystName: comparableResult.assignedAnalyst || 'Our team',
        date: new Date().toLocaleDateString()
      };
      
      let emailSent = false;
      let smsSent = false;
      
      // Send SMS if broker has phone and NOT explicitly opted out
      // FIX (Jan 28, 2026): Changed from `smsOptIn === true` to `smsOptIn !== false`
      // This matches smsService.ts logic - only block if explicitly opted out
      // New brokers from web/email have smsOptIn = null, which should receive SMS
      if (broker.phone && broker.smsOptIn !== false) {
        try {
          const smsTemplate = await TemplateService.getSMSTemplate(smsTemplateEvent, variables);
          if (smsTemplate) {
            // CRITICAL FIX: Capture structured result to check if SMS actually sent
            // sendSMS returns SendSMSResult with success/delivered/sid/mode/error
            const smsResult = await sendSMS({
              to: broker.phone,
              message: smsTemplate
            });
            
            if (smsResult.success && smsResult.delivered) {
              smsSent = true;
              console.log(`✅ [SMS] Classification notification sent to ...${broker.phone.slice(-4)} using event "${smsTemplateEvent}" (SID: ${smsResult.sid || 'N/A'})`);
            } else if (smsResult.success && !smsResult.delivered) {
              // Successfully handled but not delivered (opt-out, simulation, etc.)
              console.log(`⏭️ [SMS] Not delivered - ${smsResult.reason || smsResult.mode} for ...${broker.phone.slice(-4)}`);
            } else {
              console.warn(`⚠️ [SMS] sendSMS failed - ${smsResult.error || 'unknown error'}`);
            }
          } else {
            console.warn(`⚠️ [SMS] Template event "${smsTemplateEvent}" not found in outreach management`);
          }
        } catch (smsError) {
          console.error(`❌ [SMS] Failed to send classification SMS:`, smsError);
        }
      } else {
        console.log(`⏭️ [SMS-SKIP] No SMS sent - phone: ${broker.phone ? 'YES' : 'NO'}, optedOut: ${broker.smsOptIn === false ? 'YES' : 'NO'}`);
      }
      
      // Send email if broker has email
      if (broker.email) {
        try {
          // CRITICAL FIX: Get raw template object to access sendgridTemplateId
          // TemplateService.getEmailTemplate() only returns rendered content, not the template ID
          const businessSettings = await storage.getBusinessSettings();
          
          // CRITICAL FIX: Parse emailTemplates if it's a JSON string
          let emailTemplates: any[] = [];
          try {
            emailTemplates = typeof (businessSettings as any)?.emailTemplates === 'string' 
              ? JSON.parse((businessSettings as any).emailTemplates)
              : (businessSettings as any)?.emailTemplates || [];
          } catch (parseError) {
            console.error(`❌ [TEMPLATE-PARSE] Failed to parse emailTemplates:`, parseError);
            emailTemplates = [];
          }
          
          const rawTemplate = emailTemplates.find((t: any) => t.event === emailTemplateEvent);
          
          const emailTemplate = await TemplateService.getEmailTemplate(emailTemplateEvent, variables);
          if (emailTemplate) {
            const { sendNotificationEmail } = await import('./emailService');
            
            // CRITICAL FIX: Pass sendgridTemplateId if configured (for SendGrid dynamic templates)
            // CRITICAL FIX: Capture return value to check if email actually sent
            const emailSuccess = await sendNotificationEmail({
              type: 'transactional',
              to: broker.email,
              subject: emailTemplate.subject || `Property Classification: ${propertyAddress}`,
              html: emailTemplate.html || emailTemplate.content,
              text: emailTemplate.content || '',
              sendgridTemplateId: rawTemplate?.sendgridTemplateId || undefined,
              sendgridDynamicData: rawTemplate?.sendgridTemplateId ? variables : undefined
            });
            
            // CRITICAL FIX: Only set emailSent if sendNotificationEmail returned true
            if (emailSuccess) {
              emailSent = true;
              const templateMode = rawTemplate?.sendgridTemplateId ? `SendGrid (ID: ${rawTemplate.sendgridTemplateId})` : 'Outreach Tab';
              console.log(`✅ [EMAIL] Classification notification sent to ${broker.email} using event "${emailTemplateEvent}" via ${templateMode}`);
            } else {
              console.error(`❌ [EMAIL] sendNotificationEmail returned false - email delivery failed`);
            }
          } else {
            console.warn(`⚠️ [EMAIL] Template event "${emailTemplateEvent}" not found in outreach management`);
          }
        } catch (emailError) {
          console.error(`❌ [EMAIL] Failed to send classification email:`, emailError);
        }
      }
      
      console.log(`✅ [CLASSIFICATION-NOTIFICATION] Email sent: ${emailSent ? 'YES ✓' : 'NO ✗'}, SMS sent: ${smsSent ? 'YES ✓' : 'NO ✗'}`);
      
      // CRITICAL FIX: Update communication record to status="resolved" to prevent duplicates
      // The claimNotificationSlot() created a placeholder with status="pending_followup"
      // We MUST mark it resolved after successful send, otherwise duplicates will slip through
      if (emailSent || smsSent) {
        try {
          console.log(`🔧 [UPDATE-RECORD] Marking classification notification as 'resolved' for deal ${deal.id}...`);
          const { db } = await import('./db');
          const { communications } = await import('@shared/schema');
          const { and, eq } = await import('drizzle-orm');
          
          const updateResult = await db
            .update(communications)
            .set({ 
              status: 'resolved',
              resolvedAt: new Date(),
              resolved: true
            })
            .where(
              and(
                eq(communications.relatedDealId, deal.id),
                eq(communications.eventType, idempotencyKey)
              )
            )
            .returning();
          
          if (updateResult && updateResult.length > 0) {
            console.log(`✅ [UPDATE-RECORD] Communication record marked as 'resolved' - duplicates now blocked`);
          } else {
            console.warn(`⚠️ [UPDATE-RECORD] No placeholder record found to update (this shouldn't happen)`);
          }
        } catch (updateError) {
          console.error(`❌ [UPDATE-RECORD] Failed to mark communication as resolved:`, updateError);
          // Don't throw - notification was sent successfully, just log the error
        }
      }
      
      if (!emailSent && !smsSent) {
        console.warn(`⚠️ [WARNING] Classification notification not sent - template "${templateDescription}" may not exist in outreach management`);
      }
      
    } catch (error) {
      console.error(`❌ [ERROR] Failed to send classification notification:`, error);
      // Don't throw - this is a non-critical notification
    }
  }
  
  /**
   * Send automatic classification email for RED or YELLOW deals
   * Uses templates from outreach management: status_rejected (red) or status_under_review (yellow)
   */
  static async sendClassificationEmail(dealId: string, classification: string, submissionData: DealSubmissionData): Promise<void> {
    try {
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        throw new Error(`Deal ${dealId} not found for classification email`);
      }
      
      // ATOMIC IDEMPOTENCY CHECK: Claim notification slot BEFORE sending
      const eventType = classification === 'red' ? 'status_rejected' : 'status_under_review';
      const canSend = await UnifiedDealPipeline.claimNotificationSlot(dealId, eventType, deal.brokerId);
      if (!canSend) {
        console.log(`⏭️ [DUPLICATE-PREVENTED] ${classification} classification email already sent for deal ${dealId} - SKIPPING`);
        return;
      }
      
      // Get broker info
      let recipientEmail = submissionData.contactEmail;
      let recipientPhone = submissionData.contactPhone;
      let brokerName = submissionData.contactName || 'Valued Broker';
      
      if (deal.brokerId) {
        const broker = await storage.getBrokerById(deal.brokerId);
        recipientEmail = recipientEmail || broker?.email || undefined;
        recipientPhone = recipientPhone || broker?.phone || undefined;
        brokerName = `${broker?.firstName || ''} ${broker?.lastName || ''}`.trim() || brokerName;
      }
      
      if (!recipientEmail && !recipientPhone) {
        console.log('📧 No email or phone available - skipping classification notification');
        return;
      }
      
      // Import event dispatcher for status emails
      const { EventDispatchService } = await import('./eventDispatch');
      
      // Get product type and analyst info for template variables
      const productTypes = (deal.productTypes as string[]) || [];
      const primaryProductType = productTypes[0] || 'Conventional Apartments';
      
      // Import helper to get analyst info based on product type
      const { getAnalystInfo } = await import('./landLinqTemplates');
      const analystInfo = getAnalystInfo(classification, primaryProductType);
      
      console.log(`📧 Sending ${eventType} notification for deal ${dealId} - email: ${recipientEmail}, sms: ${recipientPhone}`);
      
      // Jan 29, 2026: Use CONCISE aiExplanatoryNotes for acceptance reason (not verbose comparableNotes)
      // aiExplanatoryNotes = "YELLOW: 5 qualifying comparables found ($2065/unit avg)..."
      // comparableNotes = verbose list with all properties (for popup display)
      const acceptanceReason = (deal as any).aiExplanatoryNotes || '';
      
      // Dispatch the event which sends the appropriate email template and SMS
      const result = await EventDispatchService.emit(eventType as any, {
        dealId: deal.id,
        brokerId: deal.brokerId,
        brokerEmail: recipientEmail, // FIXED: Add broker email so EventDispatchService can send the email
        brokerPhone: recipientPhone, // FIXED: Add broker phone so EventDispatchService can send SMS
        brokerName: brokerName,
        address: deal.address,
        classification: deal.classification,
        status: deal.status,
        rejectionReason: deal.rejectionReason || 'Does not meet acquisition criteria',
        productType: primaryProductType, // FIXED: Add product type for template
        analystName: analystInfo.analystName, // FIXED: Add analyst name for template
        // Add acceptance reason for high priority deals - concise criteria summary
        acceptanceReason: acceptanceReason,
        classificationNotes: acceptanceReason
      });
      
      console.log(`✅ Classification notification sent: email=${result.emailSent}, sms=${result.smsSent}`);
      
      if (!result.emailSent && !result.smsSent) {
        if (result.error && result.error.includes('already sent')) {
          console.log(`⏭️  Classification notification skipped - ${result.error}`);
        } else {
          console.error(`❌ Failed to send classification notification - ${result.error || 'no templates configured for ' + eventType}`);
        }
      }

      // CRITICAL FIX: Update placeholder communication record to 'resolved' to prevent duplicate sends
      if (result.emailSent || result.smsSent) {
        try {
          console.log(`🔧 [UPDATE-START] Attempting to update ${eventType} placeholder record to 'resolved' for deal ${dealId}...`);
          const updateResult = await db
            .update(communications)
            .set({ status: 'resolved' })
            .where(
              and(
                eq(communications.relatedDealId, dealId),
                eq(communications.eventType, eventType),
                eq(communications.status, 'pending_followup')
              )
            );
          console.log(`✅ [IDEMPOTENCY-FIX] ${eventType} placeholder record update completed - rows affected:`, updateResult);
        } catch (updateError) {
          console.error(`⚠️ Failed to update placeholder record (non-critical):`, updateError);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to send classification email for deal ${dealId}:`, error);
      throw error;
    }
  }
  
  /**
   * Find existing broker or create new one - returns both broker and isNewBroker flag
   * FIXED: This prevents multiple emails by tracking when a broker is new
   */
  private static async findOrCreateBrokerWithFlag(submissionData: DealSubmissionData): Promise<{broker: any, isNewBroker: boolean}> {
    console.log(`🔍 Starting broker lookup/creation for:`, {
      email: submissionData.contactEmail,
      phone: submissionData.contactPhone,
      name: submissionData.contactName
    });
    
    let broker;
    let isNewBroker = false;
    
    if (!submissionData.contactEmail && !submissionData.contactPhone) {
      console.log(`❌ No contact email or phone provided - cannot create broker`);
      throw new Error('Contact email or phone is required for deal submission');
    }

    // Check BOTH email and phone simultaneously to detect and merge duplicates
    const [brokerByEmail, brokerByPhone] = await Promise.all([
      submissionData.contactEmail ? storage.getBrokerByEmail(submissionData.contactEmail) : Promise.resolve(undefined),
      submissionData.contactPhone ? storage.getBrokerByPhone(submissionData.contactPhone) : Promise.resolve(undefined),
    ]);

    console.log(`📧 Email lookup: ${brokerByEmail ? `found broker ${brokerByEmail.id}` : 'not found'}`);
    console.log(`📱 Phone lookup: ${brokerByPhone ? `found broker ${brokerByPhone.id}` : 'not found'}`);

    if (brokerByEmail && brokerByPhone && brokerByEmail.id !== brokerByPhone.id) {
      // MERGE: two different CRM records match — consolidate phone-found into email-found
      console.log(`🔀 [DEDUP] Two brokers match the same submission — merging broker ${brokerByPhone.id} (phone) into ${brokerByEmail.id} (email)`);
      try {
        const mergeResult = await storage.mergeBrokers(brokerByPhone.id, brokerByEmail.id);
        console.log(`✅ [DEDUP] Merge complete:`, mergeResult);
      } catch (mergeErr) {
        console.error(`❌ [DEDUP] Merge failed — using email-found broker without merge:`, mergeErr);
      }
      // Re-fetch to pick up any field updates from the merge
      broker = await storage.getBrokerById(brokerByEmail.id);
    } else if (brokerByEmail) {
      broker = brokerByEmail;
      // Update phone if we now have one and the broker record is missing it
      if (submissionData.contactPhone && !broker.phone) {
        console.log(`📱 [UPDATE] Adding phone to existing email broker ${broker.id}`);
        try {
          broker = await storage.updateBroker(broker.id, { phone: submissionData.contactPhone });
        } catch (err) {
          console.error(`❌ [UPDATE] Failed to add phone to broker:`, err);
        }
      }
    } else if (brokerByPhone) {
      broker = brokerByPhone;
      // Update email if we now have one and the broker record is missing it (skip temp emails)
      const isTempEmail = (submissionData.contactEmail || '').includes('@temp.landlinq.ai');
      if (submissionData.contactEmail && !isTempEmail && (!broker.email || broker.email.includes('@temp.landlinq.ai'))) {
        console.log(`📧 [UPDATE] Adding email to existing phone broker ${broker.id}`);
        try {
          broker = await storage.updateBroker(broker.id, { email: submissionData.contactEmail });
        } catch (err) {
          console.error(`❌ [UPDATE] Failed to add email to broker:`, err);
        }
      }
    }

    if (!broker) {
      const identifier = submissionData.contactEmail || submissionData.contactPhone || 'unknown';
      console.log(`👤 Creating new broker: ${identifier}`);
      
      // Handle name parsing for email or phone submissions
      let firstName, lastName;
      if (submissionData.contactName) {
        const nameParts = submissionData.contactName.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || '';
      } else if (submissionData.contactEmail) {
        const nameParts = submissionData.contactEmail.split('@')[0].split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = '';
      } else {
        firstName = 'SMS';
        lastName = 'User';
      }
      
      const brokerData = {
        firstName,
        lastName,
        email: submissionData.contactEmail || `${Date.now()}@temp.landlinq.ai`,
        phone: submissionData.contactPhone || '',
        company: submissionData.source || 'Unknown',
        isVerified: false,
        communicationPreferences: ['email'],
        tags: []
      };
      
      try {
        // Check if user already exists
        let existingUser = null;
        if (submissionData.contactEmail) {
          existingUser = await storage.getUserByEmail(submissionData.contactEmail);
        }
        
        let userForBroker;
        let tempPassword = '';
        
        if (existingUser) {
          console.log(`👤 User already exists: ${submissionData.contactEmail} (${existingUser.role})`);
          userForBroker = existingUser;
        } else {
          // Create user account for new broker
          const { hashPassword } = await import('./auth');
          tempPassword = `temp${Date.now()}`; // Temporary password
          const hashedPassword = await hashPassword(tempPassword);
          
          console.log(`👤 Creating user account for broker: ${submissionData.contactEmail}`);
          
          userForBroker = await storage.createUser({
            email: submissionData.contactEmail || `temp${Date.now()}@landlinq.ai`,
            password: hashedPassword,
            firstName,
            lastName,
            role: 'BROKER'
          });
          
          console.log(`✅ User account created:`, { id: userForBroker?.id, email: userForBroker?.email });
          
          // NOTE: Password setup emails are NOT sent automatically
          // Brokers can request password reset via "Forgot Password" link if needed
        }
        
        // Now create broker profile linked to user account
        const brokerDataWithUser = {
          ...brokerData,
          userId: userForBroker.id
        };
        
        broker = await storage.createBroker(brokerDataWithUser);
        console.log(`✅ Broker profile created successfully:`, { id: broker?.id, email: broker?.email });
        
        if (!broker || !broker.id) {
          throw new Error('Broker creation returned null or missing ID');
        }
        
        isNewBroker = true;
        
        // Check if new broker has a phone number - if not, send SMS opt-in email
        if (!broker.phone || broker.phone.trim() === '') {
          console.log(`📱 [SMS-OPT-IN] New broker has no phone number - sending opt-in email`);
          try {
            const emailService = await import('./emailService');
            const brokerName = `${broker.firstName || ''} ${broker.lastName || ''}`.trim() || 'Valued Partner';
            await emailService.default.sendSMSOptInEmail(brokerName, broker.email!);
            console.log(`✅ [SMS-OPT-IN] Opt-in email sent to ${broker.email}`);
          } catch (error) {
            console.error(`❌ [SMS-OPT-IN] Failed to send opt-in email:`, error);
            // Non-critical error - continue with deal submission
          }
        } else {
          console.log(`📱 [SMS-OPT-IN] Broker has phone number: ${broker.phone} - skipping opt-in email`);
        }
        
        // FIXED: Do NOT send welcome notification during deal submission
        // Welcome emails with login credentials should only be sent when brokers register accounts via auth system
        // For deal submissions, the 'deal_submitted' confirmation email is sufficient
        // if (!existingUser && tempPassword) {
        //   await UnifiedDealPipeline.sendWelcomeNotification(broker, tempPassword, submissionData);
        // }
        
      } catch (error) {
        console.error(`❌ Broker and user account creation failed:`, error);
        throw new Error(`Failed to create broker and user account: ${error}`);
      }
    }
    
    console.log(`🚫 MULTIPLE EMAIL PREVENTION: Single email will be sent ${isNewBroker ? '(with welcome message)' : '(regular confirmation)'}`);
    
    return { broker, isNewBroker };
  }
  
  /**
   * SERVER-SIDE SANITIZATION: Strip fake city/state placeholders from address string
   * This is a fail-safe if AI still generates placeholders despite prompt rules
   * CRITICAL: Handles ZIP codes, spelled-out states, and validates against whitelists
   */
  private static sanitizeFakeCityState(address: string | null): string | null {
    if (!address) return address;
    
    // CRITICAL ARCHITECTURE RULE:
    // The "address" field must ONLY contain the street address (e.g., "423 N MARTIN LUTHER KING JR A")
    // City, state, and ZIP are stored in SEPARATE database fields
    // formatFullAddress() combines them for display
    //
    // This function extracts ONLY the street portion from full addresses like:
    // - "423 N MARTIN LUTHER KING JR A, SALISBURY, NC" → "423 N MARTIN LUTHER KING JR A"
    // - "8500 FLOWE'S ST, Charlotte, NC" → "8500 FLOWE'S ST"
    // - "1234 Main St" → "1234 Main St" (unchanged if no comma)
    
    // Split address by commas
    const parts = address.split(',').map(p => p.trim());
    
    if (parts.length < 2) {
      // No city/state components - return as-is
      return address;
    }
    
    // ALWAYS return only the first part (street address) if there are multiple comma-separated parts
    // The remaining parts (city, state, ZIP) should come from separate database fields
    const streetOnly = parts[0];
    
    console.log(`🧹 [ADDRESS-SANITIZE] Extracted street from full address:`);
    console.log(`   Original: "${address}"`);
    console.log(`   Street only: "${streetOnly}"`);
    
    return streetOnly;
  }

  /**
   * Create deal record in database
   */
  private static async createDealRecord(submissionData: DealSubmissionData, broker: any): Promise<any> {
    if (!broker || !broker.id) {
      throw new Error('Broker is required to create a deal - broker ID cannot be null');
    }
    
    // ============================================================================
    // STRICT VALIDATION: Block all fake/test deals - ONLY allow legitimate manual submissions
    // Environment-gated: Bypassed in development/test, enforced in production
    // ============================================================================
    
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // 1. Block "Property Submission" placeholder addresses
      if (submissionData.address?.toLowerCase().includes('property submission')) {
        console.log(`🚫 BLOCKED: Rejecting fake deal with "Property Submission" as address`);
        throw new Error('Invalid property address: "Property Submission" is not a valid address');
      }
      
      // 2. Block common test/fake patterns in address (made more specific to avoid false positives)
      const fakeAddressPatterns = [
        'test property',
        'fake property',
        'sample address',
        'example address',
        'demo site',
        '123 test st',
        'asdf street',
        'qwerty ave',
        'xxxx road',
        'placeholder address'
      ];
      
      const addressLower = submissionData.address?.toLowerCase() || '';
      for (const pattern of fakeAddressPatterns) {
        if (addressLower.includes(pattern)) {
          console.log(`🚫 BLOCKED: Rejecting fake deal with test pattern "${pattern}" in address: ${submissionData.address}`);
          throw new Error(`Invalid property address: "${submissionData.address}" appears to be a test/fake submission`);
        }
      }
      
      // 3. Require minimum valid address length (at least 5 characters, not just "TBD")
      if (!submissionData.address || submissionData.address.trim().length < 5 || submissionData.address.toLowerCase() === 'tbd') {
        console.log(`🚫 BLOCKED: Address too short or invalid: "${submissionData.address}"`);
        throw new Error('Invalid property address: Please provide a real property address');
      }
      
      // 4. Block test emails from creating deals
      const emailLower = submissionData.contactEmail?.toLowerCase() || '';
      const fakeEmailPatterns = ['test@', 'fake@', 'noreply@', 'example@', 'demo@'];
      for (const pattern of fakeEmailPatterns) {
        if (emailLower.includes(pattern)) {
          console.log(`🚫 BLOCKED: Rejecting deal from test email: ${submissionData.contactEmail}`);
          throw new Error(`Invalid contact email: "${submissionData.contactEmail}" appears to be a test email`);
        }
      }
      
      console.log(`✅ VALIDATION PASSED: Deal appears legitimate - proceeding with creation`);
    } else {
      // Development/test environment - allow test submissions for pipeline testing
      console.log(`🧪 DEV MODE: Skipping fake address/email validation for testing (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
      console.log(`   Address: ${submissionData.address}`);
      console.log(`   Email: ${submissionData.contactEmail}`);
    }
    
    // CRITICAL DEFENSE: Normalize address fields to prevent empty strings
    // Empty strings bypass null checks but cause database/geocoding issues
    const { normalizeAddressFields, logAddressNormalization } = await import('./addressFieldNormalizer');
    const beforePipelineNorm = {
      address: submissionData.address,
      city: submissionData.city,
      state: submissionData.state,
      zip: submissionData.zip
    };
    const normalizedSubmission = normalizeAddressFields(beforePipelineNorm);
    logAddressNormalization(beforePipelineNorm, normalizedSubmission, 'Pipeline defensive check');
    
    // CRITICAL FIX: Sanitize address to remove fake city/state from AI parser
    // AI may generate placeholders like "48 Swannanoa Road, Deal, SU"
    // We must strip these BEFORE saving to database to prevent them appearing in templates
    const sanitizedAddress = this.sanitizeFakeCityState(normalizedSubmission.address || null) || normalizedSubmission.address || 'TBD';
    
    console.log(`📎 [DEBUG-PIPELINE] About to create deal - attachments from submissionData:`, submissionData.attachments);
    console.log(`📎 [DEBUG-PIPELINE] Attachments array length: ${Array.isArray(submissionData.attachments) ? submissionData.attachments.length : 'NOT AN ARRAY'}`);
    
    const dealData: any = {
      // Use exact field names from schema
      // CRITICAL: Store ONLY street address in address field (e.g., "8500 FLOWE'S ST")
      // City, state, ZIP are stored in separate fields and combined by formatFullAddress()
      address: sanitizedAddress,
      propertyName: submissionData.propertyName || null, // Auto-generated from address for SMS, extracted for email
      state: normalizedSubmission.state || null, // Use normalized (empty string → null)
      zip: normalizedSubmission.zip || null,
      city: normalizedSubmission.city || null, // CRITICAL: Store city separately for formatFullAddress()
      sizeAcres: submissionData.sizeAcres?.toString() || null,
      unitCount: submissionData.unitCount || null,
      parcelId: submissionData.parcelId || null,
      hasEntitlements: submissionData.hasEntitlements || null,
      productTypes: submissionData.productTypes || null,
      brokerNotes: submissionData.brokerNotes || null,
      documentUrls: submissionData.documentUrls || submissionData.attachments || null, // Store uploaded file paths (documentUrls from form, attachments from email/SMS)
      zoning: submissionData.currentZoning || '',
      askingPrice: submissionData.askingPrice ? submissionData.askingPrice.toString() : null,
      estimatedUnits: submissionData.estimatedUnits || null,
      sewerAvailable: submissionData.sewerAvailable || null,
      yieldOnCost: null, // Initialize as null - can be filled by analyst later
      brokerId: broker.id,
      submissionMethod: submissionData.submissionMethod,
      isArchived: false,
      status: 'pending_review',
      classification: 'unclassified', // Default - requires manual analyst classification
      // Team assignments: Austin assigned to all unclassified and yellow deals (no junior analyst currently)
      assignedAnalyst: 'Austin Blondell', // Austin handles all unclassified and yellow deals
      assignedJrAnalyst: null, // No junior analyst position currently
      // Pending Details Workflow (Dec 9, 2025)
      addressConfidence: (submissionData as any)._addressConfidence || 'verified', // 'verified', 'partial', 'pending'
      dealRoomUrl: submissionData.dealRoomUrl || null, // External deal room link
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // ============================================================================
    // MSA AUTO-DETECTION: Match county/state against acquisition markets
    // ============================================================================
    const msaStartTime = Date.now();
    console.log('\n🗺️ [MSA-AUTO-DETECT] Starting MSA matching for deal...');
    console.log(`⏱️ [TIMING] MSA matching started at ${new Date().toISOString()}`);
    
    try {
      let countyName = submissionData.county;
      let stateName = submissionData.state;
      
      // If county/state not provided in submission data, try to get from Geocodio
      if (!countyName && dealData.address && dealData.address !== 'TBD') {
        // CRITICAL FIX: Build full address with city/state context from dealData (not submissionData)
        // dealData has city/state preserved from parsing, while submissionData may have lost them
        let fullAddress = dealData.address;
        // Check for non-empty strings (empty string is falsy, but we need to exclude it explicitly)
        const hasCity = dealData.city && dealData.city.trim() !== '';
        const hasState = dealData.state && dealData.state.trim() !== '';
        
        if (hasCity || hasState) {
          const parts = [dealData.address];
          if (hasCity) parts.push(dealData.city);
          if (hasState) parts.push(dealData.state);
          fullAddress = parts.join(', ');
          console.log(`🔍 [MSA-AUTO-DETECT] County not provided, attempting Geocodio lookup with full context: "${fullAddress}"`);
          console.log(`   City from dealData: "${dealData.city}"`);
          console.log(`   State from dealData: "${dealData.state}"`);
        } else {
          console.log(`🔍 [MSA-AUTO-DETECT] County not provided, attempting Geocodio lookup (no city/state context): "${fullAddress}"`);
          console.log(`⚠️ WARNING: dealData.city and dealData.state are both empty - geocoding may return wrong location!`);
        }
        const geocodeResult = await geocodioService.geocodeAddress(fullAddress);
        
        if (geocodeResult.success && geocodeResult.county && geocodeResult.state) {
          countyName = geocodeResult.county;
          stateName = geocodeResult.state;
          console.log(`✅ [MSA-AUTO-DETECT] Geocodio returned: ${countyName}, ${stateName}`);
        } else {
          console.log(`⚠️ [MSA-AUTO-DETECT] Geocodio lookup failed or returned no county data`);
        }
      }
      
      // Match county/state against acquisition markets
      if (countyName && stateName) {
        console.log(`🔍 [MSA-AUTO-DETECT] Matching ${countyName}, ${stateName} against acquisition markets...`);
        
        const msaMatch = await MSAMatchingService.matchCountyToMarket(
          countyName,
          stateName,
          submissionData.productTypes
        );
        
        if (msaMatch.matched) {
          console.log(`✅ [MSA-AUTO-DETECT] MATCH FOUND!`, {
            msaName: msaMatch.msaName,
            county: msaMatch.county,
            state: msaMatch.state,
            productTypes: msaMatch.productTypes
          });
          
          // Update deal data with MSA information
          dealData.county = msaMatch.county;
          dealData.state = msaMatch.state;
          dealData.msaName = msaMatch.msaName;
          dealData.inTargetMarket = true;
          dealData.targetProductTypes = msaMatch.productTypes;
        } else {
          console.log(`❌ [MSA-AUTO-DETECT] No market match found for ${countyName}, ${stateName}`);
          
          // Still populate county/state even if not in target market
          dealData.county = countyName;
          dealData.state = stateName;
          dealData.inTargetMarket = false;
        }
      } else {
        console.log(`⚠️ [MSA-AUTO-DETECT] No county/state available for MSA matching`);
      }
    } catch (error) {
      console.error('❌ [MSA-AUTO-DETECT] Error during MSA matching:', error);
      console.error('❌ [MSA-AUTO-DETECT] Error stack:', error instanceof Error ? error.stack : 'No stack');
      // Don't fail deal creation if MSA matching fails - just log and continue
    }
    console.log(`⏱️ [TIMING] MSA matching completed in ${Date.now() - msaStartTime}ms`);
    
    // ============================================================================
    // DUPLICATE DEAL PREVENTION: Check if same address was submitted recently
    // ============================================================================
    const dupCheckStartTime = Date.now();
    console.log('\n🔍 [DUPLICATE-CHECK] Checking for recent deals with same address...');
    console.log(`⏱️ [TIMING] Duplicate check started at ${new Date().toISOString()}`);
    
    // Normalize address for comparison (remove extra spaces, lowercase, remove ZIP)
    const normalizedAddress = submissionData.address
      ?.trim()
      .toLowerCase()
      .replace(/,?\s+\d{5}(-\d{4})?$/, '') // Remove ZIP code at end
      .replace(/\s+/g, ' '); // Normalize whitespace
    
    if (normalizedAddress && normalizedAddress !== 'tbd') {
      try {
        // Query for recent deals (last 24 hours) with similar address
        const recentDeals = await db
          .select()
          .from(deals)
          .where(
            and(
              // Use SQL LOWER and TRIM to normalize address comparison
              sql`LOWER(TRIM(REGEXP_REPLACE(${deals.address}, ',?\\s+\\d{5}(-\\d{4})?$', ''))) = ${normalizedAddress}`,
              // Only check deals from last 24 hours
              sql`${deals.createdAt} > NOW() - INTERVAL '24 hours'`
            )
          )
          .limit(1);
        
        if (recentDeals && recentDeals.length > 0) {
          const existingDeal = recentDeals[0];
          const createdAt = existingDeal.createdAt || new Date();
          const minutesAgo = Math.round((Date.now() - new Date(createdAt).getTime()) / (1000 * 60));
          
          console.log(`⚠️ [DUPLICATE-DETECTED] Same address submitted ${minutesAgo} minutes ago!`);
          console.log(`   Existing deal ID: ${existingDeal.id}`);
          console.log(`   Address: ${existingDeal.address}`);
          console.log(`   Status: ${existingDeal.status}`);
          console.log(`   Classification: ${existingDeal.classification}`);
          console.log(`   Previous submission count: ${existingDeal.submissionCount || 1}`);
          
          // Increment submission counter to track resubmission patterns
          const newCount = (existingDeal.submissionCount || 1) + 1;
          await storage.updateDeal(existingDeal.id, {
            submissionCount: newCount,
            lastResubmittedAt: new Date()
          });
          
          console.log(`📊 [DUPLICATE-TRACKING] Incremented submission count to ${newCount}`);
          console.log(`✅ [DUPLICATE-PREVENTED] Returning existing deal instead of creating duplicate`);
          console.log(`🚫 [NO-EMAIL] Skipping confirmation email - broker already notified`);
          
          // Return updated deal with new count
          return { 
            deal: { ...existingDeal, submissionCount: newCount, lastResubmittedAt: new Date() }, 
            isDuplicate: true 
          };
        }
        
        console.log(`✅ [DUPLICATE-CHECK] No recent duplicates found - proceeding with creation`);
      } catch (dupCheckError) {
        console.error('❌ [DUPLICATE-CHECK] Error checking for duplicates:', dupCheckError);
        // Don't fail deal creation if duplicate check fails - just log and continue
      }
    } else {
      console.log(`⚠️ [DUPLICATE-CHECK] Skipping duplicate check - address is TBD or empty`);
    }
    
    console.log(`\n🚨🚨🚨 [CRITICAL-CHECKPOINT-1] ABOUT TO CREATE DEAL 🚨🚨🚨`);
    console.log(`💾 Creating deal record with address: "${dealData.address}"`);
    console.log(`📍 [DEAL-DATA] Full deal data object:`, JSON.stringify(dealData, null, 2));
    console.log(`📎 [DEBUG-CRITICAL] Document URLs being saved to database:`, {
      count: Array.isArray(dealData.documentUrls) ? dealData.documentUrls.length : 0,
      urls: dealData.documentUrls,
      type: typeof dealData.documentUrls,
      isArray: Array.isArray(dealData.documentUrls)
    });
    
    try {
      console.log(`🚨 [CRITICAL-CHECKPOINT-2] Calling storage.createDeal() NOW...`);
      const deal = await storage.createDeal(dealData);
      console.log(`🚨🚨🚨 [CRITICAL-SUCCESS] DEAL CREATED SUCCESSFULLY! 🚨🚨🚨`);
      console.log(`✅ Deal created with ID: ${deal.id}`);
      console.log(`✅ Deal Number: ${deal.dealNumber}`);
      console.log(`✅ Deal Address: ${deal.address}`);
      console.log(`📎 [DEBUG-CRITICAL] Deal created - document URLs in returned object:`, {
        count: Array.isArray(deal.documentUrls) ? deal.documentUrls.length : 0,
        urls: deal.documentUrls,
        type: typeof deal.documentUrls,
        isArray: Array.isArray(deal.documentUrls)
      });
      
      // VERIFICATION: Query the database to confirm files were actually saved
      const verifyDeal = await storage.getDeal(deal.id);
      console.log(`📎 [DEBUG-VERIFICATION] Database verification - documentUrls from DB:`, {
        count: Array.isArray(verifyDeal?.documentUrls) ? verifyDeal.documentUrls.length : 0,
        urls: verifyDeal?.documentUrls,
        type: typeof verifyDeal?.documentUrls
      });
      
      return { deal, isDuplicate: false };
    } catch (error) {
      console.error(`\n🚨🚨🚨 [CRITICAL-FAILURE] DEAL CREATION FAILED! 🚨🚨🚨`);
      console.error('❌ Error creating deal:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      throw new Error(`Deal creation failed: ${error}`);
    }
  }

  /**
   * Run HelloData comparable search and auto-classify deal
   * Classification Rules:
   * - Find comparables within 3-5 miles, built in last 5 years, matching property type
   * - If average price/sqft > $1.75 → classify as "reviewing" (yellow) and assign Austin Blondell
   * - If at least 1 qualifying comparable found → classify as "reviewing" (yellow)
   * - If no comparables found → classify as "clear_no" (red)
   * PUBLIC: Can be called to re-run analysis when deal data is updated
   */
  static async runComparableSearchAndClassify(deal: any, options?: {
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
  }): Promise<{
    classification: string;
    status: string;
    reasoning: string;
    shortRejectionReason: string | null; // SHORT reason for red deals only (NOT full analysis)
    assignedAnalyst: string | null;
    comparableData?: any;
    qctStatus?: string;
    censusTractFips?: string;
    comparableCount?: number;
    comparableNotes?: string;
    aiExplanatoryNotes?: string;
    comparablesJson?: any[]; // Structured comparables with lat/lng for map display (Dec 11, 2025)
    topRentPSF?: number;
    avgRentPSF?: number;
    topRentPerUnit?: number;
    avgRentPerUnit?: number;
  }> {
    try {
      console.log(`🏘️ Running NEW classification workflow for deal ${deal.id}: ${deal.address}`);
      
      // CRITICAL FIX (Dec 10, 2025): Run MSA matching BEFORE classification
      // Quick Deals created via /api/analyst/deals don't have inTargetMarket set
      // This was causing out-of-market deals to be marked as "Reviewing" instead of "Red"
      if (deal.inTargetMarket === null || deal.inTargetMarket === undefined) {
        console.log(`🗺️ [MSA-FIX] inTargetMarket is ${deal.inTargetMarket} - running MSA matching now...`);
        
        try {
          // Geocode to get county if not already set
          let countyForMatch = deal.county;
          let stateForMatch = deal.state;
          
          if (!countyForMatch) {
            const { GeocodioService } = await import('./geocodioService');
            const geocodio = new GeocodioService();
            
            // Dec 17, 2025: If coordinates are already set, use REVERSE geocoding
            // This handles deals submitted via Quick Add with coordinates instead of address
            if (deal.latitude && deal.longitude) {
              console.log(`📍 [MSA-FIX] Coordinates available (${deal.latitude}, ${deal.longitude}) - using reverse geocoding`);
              const reverseResult = await geocodio.reverseGeocode(deal.latitude, deal.longitude);
              
              console.log(`🔍 [MSA-FIX] Reverse geocode result:`, {
                success: reverseResult.success,
                county: reverseResult.county,
                state: reverseResult.state,
                city: reverseResult.city,
                error: reverseResult.error
              });
              
              if (reverseResult.success && reverseResult.county) {
                countyForMatch = reverseResult.county;
                stateForMatch = reverseResult.state || stateForMatch;
                // Also update deal with resolved location info
                deal.city = reverseResult.city || deal.city;
                deal.zip = reverseResult.zipCode || deal.zip;
                console.log(`✅ [MSA-FIX] Reverse geocoded county: ${countyForMatch}, ${stateForMatch}`);
              }
            } else {
              // No coordinates - use forward geocoding from address
              const fullAddress = [deal.address, deal.city, deal.state, deal.zip]
                .filter(p => p && p.trim())
                .join(', ');
              
              if (fullAddress) {
                const geocodeResult = await geocodio.geocodeAddress(fullAddress);
                
                // DEBUG (Dec 15, 2025): Log full geocode result to diagnose missing county
                console.log(`🔍 [MSA-FIX] Geocode result:`, {
                  success: geocodeResult.success,
                  county: geocodeResult.county,
                  state: geocodeResult.state,
                  error: geocodeResult.error
                });
                
                if (geocodeResult.success && geocodeResult.county) {
                  countyForMatch = geocodeResult.county;
                  stateForMatch = geocodeResult.state || stateForMatch;
                  console.log(`📍 [MSA-FIX] Geocoded county: ${countyForMatch}, ${stateForMatch}`);
                } else if (geocodeResult.success && !geocodeResult.county) {
                  console.log(`⚠️ [MSA-FIX] Geocoding succeeded but county is missing! Checking deal.state for fallback...`);
                }
              }
            }
          }
          
          // Run MSA matching
          if (countyForMatch && stateForMatch) {
            const msaMatch = await MSAMatchingService.matchCountyToMarket(
              countyForMatch, 
              stateForMatch
            );
            
            if (msaMatch.matched) {
              console.log(`✅ [MSA-FIX] IN TARGET MARKET: ${msaMatch.msaName} (${msaMatch.productTypes?.join(', ') || 'Unknown'})`);
              deal.inTargetMarket = true;
              deal.msaName = msaMatch.msaName;
              deal.county = msaMatch.county;
              deal.state = msaMatch.state;
              deal.targetProductTypes = msaMatch.productTypes || [];
            } else {
              // BUGFIX (Dec 16, 2025): Normalize county name - remove " County" suffix to prevent duplication
              const normalizedCounty = countyForMatch.replace(/\s*County\s*$/i, '').trim();
              console.log(`❌ [MSA-FIX] NOT IN TARGET MARKET: ${normalizedCounty}, ${stateForMatch}`);
              deal.inTargetMarket = false;
              deal.county = normalizedCounty;
              deal.state = stateForMatch;
            }
          } else {
            console.log(`⚠️ [MSA-FIX] Could not determine county/state for MSA matching`);
          }
        } catch (msaError) {
          console.error(`⚠️ [MSA-FIX] MSA matching failed:`, msaError);
          // Continue with classification - will be handled as unknown MSA status
        }
      }
      
      // Run the new AutoClassificationEngine
      // Pass through options (for forceHelloData and preloaded data from re-run endpoint)
      const classificationResult = await AutoClassificationEngine.classifyDeal(deal, options);
      
      // Map classification to status
      // - yellow → under_review (reviewing/potential)
      // - red → clear_no (rejected/passed)
      // - unclassified → pending_review (manual review needed)
      let status: string;
      if (classificationResult.classification === 'yellow') {
        status = 'under_review';
      } else if (classificationResult.classification === 'red') {
        status = 'clear_no';
      } else if (classificationResult.classification === 'unclassified') {
        status = 'pending_review'; // unclassified needs manual review
      } else {
        status = 'pending_review'; // fallback for any other value
      }
      const reasoning = classificationResult.rejectionReason || classificationResult.comparableNotes || 'Classified via new workflow';
      
      console.log(`📊 Classification complete: ${classificationResult.classificationDisplay}`);
      console.log(`   QCT Status: ${classificationResult.qctStatus}`);
      console.log(`   Comparable Count: ${classificationResult.comparableCount}`);
      
      return {
        classification: classificationResult.classification,
        status: status,
        reasoning: reasoning,
        // SHORT rejection reason for red deals ONLY - full analysis goes to comparableNotes
        // For yellow/unclassified deals, this should be null (no rejection)
        shortRejectionReason: classificationResult.classification === 'red' 
          ? (classificationResult.rejectionReason || 'Does not meet acquisition criteria')
          : null,
        // USER FIX (Dec 11): Austin assigned to ALL deals (green, yellow, red, unclassified)
        assignedAnalyst: 'Austin Blondell',
        qctStatus: classificationResult.qctStatus,
        censusTractFips: classificationResult.censusTractFips,
        comparableCount: classificationResult.comparableCount,
        comparableNotes: classificationResult.comparableNotes,
        aiExplanatoryNotes: classificationResult.aiExplanatoryNotes,
        comparablesJson: classificationResult.comparablesJson, // Structured comparables with lat/lng for map (Dec 11, 2025)
        topRentPSF: classificationResult.topRentPSF,
        avgRentPSF: classificationResult.avgRentPSF,
        topRentPerUnit: classificationResult.topRentPerUnit,
        avgRentPerUnit: classificationResult.avgRentPerUnit
      };
      
    } catch (error) {
      console.error('❌ Error during classification:', error);
      return {
        classification: 'unclassified',
        status: 'pending_review',
        reasoning: `Classification failed: ${error instanceof Error ? error.message : 'Unknown error'}. Manual review required.`,
        shortRejectionReason: null, // No rejection for unclassified - needs manual review
        assignedAnalyst: 'Austin Blondell' // USER FIX (Dec 11): Austin assigned to ALL deals
      };
    }
  }

  /**
   * Enrich deal with API data
   * AUTO-POPULATES: acreage from HelloData (no additional cost - already calling for comparables)
   * NOTE: Regrid removed to save ~$400/month - HelloData provides reliable acreage data
   */
  private static async enrichDealWithAPIs(deal: any): Promise<any> {
    try {
      console.log(`🔍 Enriching deal with API data for: ${deal.address}`);
      const enrichedData: any = {};
      
      if (!deal.address) {
        console.log(`⚠️ Cannot enrich - no address available`);
        return enrichedData;
      }
      
      // Use HelloData as PRIMARY source for lot size (acreage)
      // No additional cost - already calling HelloData for comparables anyway
      if (!deal.sizeAcres || deal.sizeAcres === null) {
        console.log(`\n📏 [HELLODATA] Attempting to fetch lot size from HelloData...`);
        
        try {
          // CRITICAL FIX (Dec 4, 2025): Pass city/state to prevent geocoding misinterpretation
          // Without this, "10333 Robinson church rd" in Charlotte gets geocoded as "Robinson, TX"
          const lotSizeResult = await hellodataService.getLotSize(deal.address, deal.city, deal.state);
          
          if (lotSizeResult.success && lotSizeResult.acres) {
            enrichedData.sizeAcres = lotSizeResult.acres.toString();
            enrichedData.ingestionNotes = (deal.ingestionNotes || '') + 
              `\n✅ Lot size auto-populated: ${lotSizeResult.acres} acres (Source: HelloData API)`;
            
            console.log(`✅ [HELLODATA] Successfully auto-populated: ${lotSizeResult.acres} acres`);
          } else {
            console.log(`⚠️ [HELLODATA] Could not retrieve lot size: ${lotSizeResult.error || 'Property not found'}`);
          }
        } catch (lotSizeError) {
          console.error(`❌ [HELLODATA] Error fetching lot size:`, lotSizeError);
        }
      } else {
        console.log(`✅ Acreage already provided by broker: ${deal.sizeAcres} acres`);
      }
      
      return enrichedData;
    } catch (error) {
      console.error('❌ Error during API enrichment:', error);
      return {};
    }
  }

  /**
   * Fetch demographics data from Geocodio API
   * Populates: population55Plus5Mile, income75Plus55Plus
   * Uses Geocodio ACS Census data for 55+ population and income brackets
   */
  private static async fetchDemographicsData(deal: any): Promise<any> {
    console.log(`\n`);
    console.log(`${'*'.repeat(80)}`);
    console.log(`****** DEMOGRAPHICS FETCH FUNCTION ENTERED ******`);
    console.log(`${'*'.repeat(80)}`);
    console.log(`🔍 [DEMOGRAPHICS-DEBUG] Starting demographics fetch...`);
    
    try {
      if (!deal.address) {
        console.log(`⚠️ [DEMOGRAPHICS-DEBUG] FAILED: No address available`);
        console.log(`   Deal ID: ${deal.id}`);
        console.log(`   Deal address field: ${JSON.stringify(deal.address)}`);
        return {};
      }

      console.log(`📊 [DEMOGRAPHICS-DEBUG] Deal ID: ${deal.id}`);
      console.log(`📊 [DEMOGRAPHICS-DEBUG] Address: "${deal.address}"`);
      console.log(`📊 [DEMOGRAPHICS-DEBUG] City: "${deal.city || 'N/A'}"`);
      console.log(`📊 [DEMOGRAPHICS-DEBUG] State: "${deal.state || 'N/A'}"`);
      console.log(`📊 [DEMOGRAPHICS-DEBUG] Importing Geocodio service...`);
      
      // Import Geocodio service
      const { geocodioService } = await import('./geocodioService');
      console.log(`📊 [DEMOGRAPHICS-DEBUG] Geocodio service imported successfully`);
      
      // Build full address for accurate geocoding (Dec 16, 2025 fix)
      const addressParts = [deal.address];
      if (deal.city) addressParts.push(deal.city);
      if (deal.state) addressParts.push(deal.state);
      if (deal.zip) addressParts.push(deal.zip);
      const fullAddress = addressParts.join(', ');
      console.log(`📊 [DEMOGRAPHICS-DEBUG] Full address for geocoding: "${fullAddress}"`);
      
      // Fetch demographics using Geocodio ACS data
      console.log(`📊 [DEMOGRAPHICS-DEBUG] Calling geocodioService.getDemographics()...`);
      const startTime = Date.now();
      const demographics = await geocodioService.getDemographics(fullAddress);
      const elapsed = Date.now() - startTime;
      
      console.log(`📊 [DEMOGRAPHICS-DEBUG] Geocodio response received in ${elapsed}ms`);
      console.log(`📊 [DEMOGRAPHICS-DEBUG] Raw response:`, JSON.stringify(demographics, null, 2));
      console.log(`📊 [DEMOGRAPHICS-DEBUG] demographics.success = ${demographics.success}`);
      console.log(`📊 [DEMOGRAPHICS-DEBUG] demographics.population55Plus = ${demographics.population55Plus} (type: ${typeof demographics.population55Plus})`);
      console.log(`📊 [DEMOGRAPHICS-DEBUG] demographics.income75kPlus = ${demographics.income75kPlus} (type: ${typeof demographics.income75kPlus})`);
      console.log(`📊 [DEMOGRAPHICS-DEBUG] Check: population55Plus != null = ${demographics.population55Plus != null}`);
      console.log(`📊 [DEMOGRAPHICS-DEBUG] Check: income75kPlus != null = ${demographics.income75kPlus != null}`);
      
      // Check for success - use != null to properly handle 0 values (which are valid data)
      if (demographics.success && (demographics.population55Plus != null || demographics.income75kPlus != null)) {
        console.log(`✅ [DEMOGRAPHICS-DEBUG] SUCCESS! Data found.`);
        
        const result = {
          population55Plus5Mile: demographics.population55Plus ?? null,
          income75Plus55Plus: demographics.income75kPlus ?? null,
          demographicsNotes: `Census Block Group data via Geocodio. ` +
            `Total population: ${demographics.totalPopulation?.toLocaleString() || 'N/A'}. ` +
            `${demographics.percentOver55 || 0}% are 55+. ` +
            `Median age: ${demographics.medianAge || 'N/A'}. ` +
            `Median household income: $${demographics.medianHouseholdIncome?.toLocaleString() || 'N/A'}.`
        };
        
        console.log(`✅ [DEMOGRAPHICS-DEBUG] Returning mapped result:`, JSON.stringify(result, null, 2));
        console.log(`${'='.repeat(60)}\n`);
        return result;
      } else {
        console.log(`⚠️ [DEMOGRAPHICS-DEBUG] FAILED: No demographic data`);
        console.log(`   demographics.success: ${demographics.success}`);
        console.log(`   demographics.error: ${demographics.error || 'No error message'}`);
        console.log(`${'='.repeat(60)}\n`);
        return {};
      }
      
    } catch (error) {
      console.error(`❌ [DEMOGRAPHICS-DEBUG] EXCEPTION CAUGHT:`);
      console.error(`   Error type: ${error?.constructor?.name}`);
      console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`   Stack trace:`, error instanceof Error ? error.stack : 'No stack');
      console.log(`${'='.repeat(60)}\n`);
      return {};
    }
  }

  /**
   * Handle missing information follow-up using enhanced analysis
   */
  private static async handleMissingInformationFollowup(deal: any, broker: any, submissionData: DealSubmissionData): Promise<void> {
    try {
      console.log(`📋 Analyzing deal ${deal.id} for missing/uncertain vital information...`);
      
      // Import FollowUpService for enhanced missing fields analysis
      const { FollowUpService } = await import('./followUpService');
      
      // CRITICAL FIX: Analyze ORIGINAL submission data, not enriched deal
      // Geocoding auto-fills ZIP code, but we need to check what broker actually provided
      const originalData = {
        address: submissionData.address,
        zip: submissionData.zip,
        askingPrice: submissionData.askingPrice,
        sizeAcres: submissionData.sizeAcres,
        id: deal.id  // Include ID for logging
      };
      
      console.log(`🔍 Analyzing original submission (before enrichment):`, {
        hasAddress: !!originalData.address,
        hasZip: !!originalData.zip,
        hasPrice: !!originalData.askingPrice,
        hasAcres: !!originalData.sizeAcres
      });
      
      // Analyze the ORIGINAL submission for missing or uncertain vital information
      const analysis = FollowUpService.analyzeMissingFields(originalData as any);
      
      console.log(`📊 Analysis results:`, {
        hasMissingFields: analysis.hasMissingFields,
        missingFields: analysis.missingFields,
        hasUncertainInfo: analysis.hasUncertainInfo,
        uncertainFields: analysis.uncertainFields,
        confidence: analysis.confidence,
        templateType: analysis.templateType
      });

      // Only send follow-up if we have missing fields, uncertain info, or very low confidence
      const needsFollowUp = analysis.hasMissingFields || 
                           analysis.hasUncertainInfo || 
                           analysis.confidence === 'low';

      if (!needsFollowUp) {
        console.log(`✅ Deal ${deal.id} has all vital information with good confidence - no follow-up needed`);
        return;
      }

      console.log(`🎯 Deal ${deal.id} needs follow-up for: ${analysis.missingFieldsText}`);

      // Check if we should actually send the follow-up (cooldown, existing communications, etc.)
      if (!broker || !broker.id) {
        console.log(`⏳ Skipping follow-up for deal ${deal.id}: No broker ID available`);
        return;
      }
      
      // CRITICAL FIX: Pass isRecentSubmission=true to bypass cooldown for fresh submissions
      const followUpCheck = await FollowUpService.shouldSendFollowUp(deal.id, broker.id, true);
      
      if (!followUpCheck.shouldSend) {
        console.log(`⏳ Skipping follow-up for deal ${deal.id}: ${followUpCheck.reason}`);
        return;
      }

      // Prepare template variables
      const brokerName = broker.firstName || 'there';
      
      // Get analyst information for the deal (matches followUpService.ts)
      let analystName = 'Catalyst Team';
      if (deal.assignedAnalyst) {
        try {
          const analyst = await storage.getUser(deal.assignedAnalyst);
          if (analyst) {
            const parts = [analyst.firstName, analyst.lastName].filter(Boolean);
            if (parts.length > 0) {
              analystName = parts.join(' ');
            }
          }
        } catch (error) {
          console.warn(`Could not fetch analyst for deal ${deal.id}:`, error);
        }
      }
      
      const templateVars = {
        brokerName,
        address: deal.address || 'your property',
        propertyAddress: deal.address || 'your property', // Fixed: Add both variable names for compatibility
        dealId: deal.id,
        missingFields: analysis.missingFieldsText,
        supportPhone: FollowUpService['testConfig'].SUPPORT_PHONE,
        analystName: analystName // FIX: Add missing analystName variable
      };

      // Send follow-up based on submission method and template type
      if (analysis.templateType) {
        const channel = broker.preferredContact === 'sms' || submissionData.submissionMethod === 'sms' ? 'sms' : 'email';
        
        console.log(`📤 Sending ${channel} follow-up using template: ${analysis.templateType}`);
        
        // Send the appropriate follow-up
        const success = await FollowUpService.sendFollowUpMessage(
          { broker, deal, channel, supportPhone: FollowUpService['testConfig'].SUPPORT_PHONE },
          analysis,
          'initial'
        );

        if (success) {
          console.log(`✅ Follow-up sent successfully for deal ${deal.id} via ${channel}`);
        } else {
          console.log(`❌ Failed to send follow-up for deal ${deal.id}`);
        }
      } else {
        console.log(`❓ No appropriate template found for deal ${deal.id} analysis`);
      }

    } catch (error) {
      console.error('❌ Error in missing information follow-up:', error);
    }
  }
}
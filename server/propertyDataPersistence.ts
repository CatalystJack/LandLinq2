import { storage } from './storage';
import { ValidatedPropertyData } from './dataValidationService';

/**
 * Comprehensive property data persistence service
 * Stores ALL validation data to propertyData table for complete audit trail
 */
export class PropertyDataPersistence {
  
  /**
   * Persist complete validation data to propertyData table
   */
  static async persistValidationData(dealId: string, validationResult: ValidatedPropertyData): Promise<void> {
    try {
      console.log(`💾 Persisting comprehensive validation data for deal ${dealId}`);
      
      const propertyData = {
        dealId: dealId,
        
        // Geographic data with confidence tracking
        coordinates: {
          latitude: validationResult.address.coordinates.latitude,
          longitude: validationResult.address.coordinates.longitude,
          confidence: validationResult.address.confidence,
          sources: validationResult.address.sources,
          discrepancies: validationResult.address.discrepancies
        },
        
        // Property area with multi-source validation
        area: validationResult.size.acres,
        
        // Complete demographics with confidence scores
        demographics: {
          totalPopulation: validationResult.demographics.totalPopulation,
          medianHouseholdIncome: validationResult.demographics.medianHouseholdIncome,
          population55Plus: validationResult.demographics.population55Plus,
          income75Plus55Plus: validationResult.demographics.income75Plus55Plus,
          medianAge: validationResult.demographics.medianAge,
          confidence: validationResult.demographics.confidence,
          sources: validationResult.demographics.sources,
          discrepancies: validationResult.demographics.discrepancies
        },
        
        // Rental market data with confidence tracking
        comparables: {
          averageRent: validationResult.rentData.averageRent,
          rentPerSquareFoot: validationResult.rentData.rentPerSquareFoot,
          medianGrossRent: validationResult.rentData.medianGrossRent,
          confidence: validationResult.rentData.confidence,
          sources: validationResult.rentData.sources,
          discrepancies: validationResult.rentData.discrepancies
        },
        
        // Market trends and valuation data
        marketTrends: {
          listingPrice: validationResult.valuation.listingPrice,
          assessedValue: validationResult.valuation.assessedValue,
          marketValue: validationResult.valuation.marketValue,
          pricePerAcre: validationResult.valuation.pricePerAcre,
          pricePerSquareFoot: validationResult.valuation.pricePerSquareFoot,
          confidence: validationResult.valuation.confidence,
          sources: validationResult.valuation.sources,
          discrepancies: validationResult.valuation.discrepancies
        },
        
        // Complete validation metadata for audit trail
        validationMetadata: {
          overallConfidence: validationResult.validation.overallConfidence,
          qualityScore: validationResult.validation.qualityScore,
          sourceCount: validationResult.validation.sourceCount,
          sourcesUsed: validationResult.validation.sourcesUsed,
          discrepancyCount: validationResult.validation.discrepancyCount,
          lastValidated: validationResult.validation.lastValidated,
          
          // Detailed validation results by category
          addressValidation: validationResult.address,
          sizeValidation: validationResult.size,
          valuationValidation: validationResult.valuation,
          detailsValidation: validationResult.details,
          demographicsValidation: validationResult.demographics,
          rentDataValidation: validationResult.rentData
        }
      };
      
      // Check if propertyData record already exists for this deal
      const existingPropertyData = await storage.getPropertyDataByDealId(dealId);
      
      if (existingPropertyData) {
        // Update existing record with new validation data
        await storage.updatePropertyData(existingPropertyData.id, propertyData);
        console.log(`✅ Updated existing propertyData record for deal ${dealId}`);
      } else {
        // Create new propertyData record
        await storage.createPropertyData(propertyData);
        console.log(`✅ Created new propertyData record for deal ${dealId}`);
      }
      
      console.log(`📊 Validation data persisted: ${validationResult.validation.sourceCount} sources, ${validationResult.validation.qualityScore}% quality score`);
      
      if (validationResult.validation.discrepancyCount > 0) {
        console.log(`⚠️ ${validationResult.validation.discrepancyCount} discrepancies persisted for manual review`);
      }
      
    } catch (error) {
      console.error(`❌ Error persisting validation data for deal ${dealId}:`, error);
      // Don't throw - validation data persistence shouldn't fail the deal pipeline
    }
  }
  
  /**
   * Retrieve complete validation data for a deal
   */
  static async getValidationData(dealId: string): Promise<ValidatedPropertyData | null> {
    try {
      const propertyData = await storage.getPropertyDataByDealId(dealId);
      
      if (!propertyData?.validationMetadata) {
        return null;
      }
      
      // Reconstruct ValidatedPropertyData from stored data
      return {
        address: propertyData.validationMetadata.addressValidation || {
          standardized: '',
          components: {},
          coordinates: { latitude: undefined, longitude: undefined },
          confidence: 0,
          sources: [],
          discrepancies: []
        },
        size: propertyData.validationMetadata.sizeValidation || {
          confidence: 0,
          sources: [],
          discrepancies: []
        },
        valuation: propertyData.validationMetadata.valuationValidation || {
          confidence: 0,
          sources: [],
          discrepancies: []
        },
        details: propertyData.validationMetadata.detailsValidation || {
          confidence: 0,
          sources: [],
          discrepancies: []
        },
        demographics: propertyData.validationMetadata.demographicsValidation || {
          confidence: 0,
          sources: [],
          discrepancies: []
        },
        rentData: propertyData.validationMetadata.rentDataValidation || {
          confidence: 0,
          sources: [],
          discrepancies: []
        },
        validation: {
          overallConfidence: propertyData.validationMetadata.overallConfidence || 0,
          sourceCount: propertyData.validationMetadata.sourceCount || 0,
          sourcesUsed: propertyData.validationMetadata.sourcesUsed || [],
          discrepancyCount: propertyData.validationMetadata.discrepancyCount || 0,
          lastValidated: new Date(propertyData.validationMetadata.lastValidated || Date.now()),
          qualityScore: propertyData.validationMetadata.qualityScore || 0
        }
      };
      
    } catch (error) {
      console.error(`❌ Error retrieving validation data for deal ${dealId}:`, error);
      return null;
    }
  }
}
/**
 * Intelligent Data Accuracy Service
 * Cross-references multiple API sources to find the most accurate, up-to-date property information
 * Solves the problem of conflicting data between HelloData and other sources
 */

interface PropertyDataPoint {
  value: any;
  source: string;
  confidence: number;
  lastUpdated: Date | null;
  metadata?: any;
}

interface PropertyDataSources {
  acreage?: PropertyDataPoint[];
  marketValue?: PropertyDataPoint[];
  assessedValue?: PropertyDataPoint[];
  zoning?: PropertyDataPoint[];
  sewerAvailable?: PropertyDataPoint[];
  yearBuilt?: PropertyDataPoint[];
  lotSize?: PropertyDataPoint[];
  parcelId?: PropertyDataPoint[];
}

interface AccuratePropertyData {
  acreage: number | null;
  marketValue: number | null;
  assessedValue: number | null;  
  zoning: string | null;
  sewerAvailable: boolean | null;
  yearBuilt: number | null;
  parcelId: string | null;
  standardizedAddress: string | null;
  dataQualityScore: number;
  sourcesUsed: string[];
  conflictsDetected: Array<{
    field: string;
    sources: Array<{ source: string; value: any; confidence: number }>;
    resolution: string;
  }>;
}

export class DataAccuracyService {
  
  /**
   * Get the most accurate property data by cross-referencing multiple sources
   */
  async getAccuratePropertyData(address: string): Promise<AccuratePropertyData> {
    console.log(`🎯 DataAccuracy: Finding most accurate data for ${address}`);
    
    const sources: PropertyDataSources = {};
    
    // Step 1: Gather data from all available sources
    await this.gatherFromHelloData(address, sources);
    await this.gatherFromBackupSources(address, sources);
    
    // Step 2: Resolve conflicts and pick best values
    const result = await this.resolveDataConflicts(sources);
    
    console.log(`✅ DataAccuracy: Final result - Quality Score: ${result.dataQualityScore}%, Sources: ${result.sourcesUsed.join(', ')}`);
    
    if (result.conflictsDetected.length > 0) {
      console.log(`⚠️ DataAccuracy: Resolved ${result.conflictsDetected.length} data conflicts:`, 
        result.conflictsDetected.map(c => `${c.field}: ${c.resolution}`));
    }
    
    return result;
  }
  
  
  /**
   * Gather data from HelloData API with quality scoring
   */
  private async gatherFromHelloData(address: string, sources: PropertyDataSources): Promise<void> {
    try {
      const { hellodataService } = await import('./hellodataService');
      const response = await hellodataService.getPropertyData(address);
      
      if (response?.success && response.data) {
        const property = response.data;
        
        // HelloData confidence varies based on data recency and type
        const hellodataConfidence = this.calculateHellodataConfidence(property);
        const lastUpdated = this.parseHellodataDate((property as any).lastUpdated);
        
        // Acreage from lot size
        if (property.lotSize) {
          if (!sources.acreage) sources.acreage = [];
          sources.acreage.push({
            value: (property.lotSize / 43560),
            source: 'HelloData.ai (Market Analysis)',
            confidence: hellodataConfidence,
            lastUpdated,
            metadata: { rawLotSize: property.lotSize, unit: 'sqft' }
          });
        }
        
        // Market Value
        if (property.marketValue) {
          if (!sources.marketValue) sources.marketValue = [];
          sources.marketValue.push({
            value: property.marketValue,
            source: 'HelloData.ai (Market Analysis)',
            confidence: hellodataConfidence,
            lastUpdated,
            metadata: { dataSource: 'multifamily_market' }
          });
        }
        
        // Assessed Value
        if (property.assessedValue) {
          if (!sources.assessedValue) sources.assessedValue = [];
          sources.assessedValue.push({
            value: property.assessedValue,
            source: 'HelloData.ai (Public Records)',
            confidence: hellodataConfidence - 0.1, // Slightly less confident than market value
            lastUpdated,
            metadata: { dataSource: 'public_records' }
          });
        }
        
        console.log(`✅ HelloData: Retrieved market data (${Math.round(hellodataConfidence * 100)}% confidence)`);
      }
    } catch (error) {
      console.log(`❌ HelloData error:`, error);
    }
  }
  
  /**
   * Gather data from backup/additional sources
   */
  private async gatherFromBackupSources(address: string, sources: PropertyDataSources): Promise<void> {
    // Future: Add Zillow, Redfin, CoreLogic, etc.
    // For now, this is a placeholder for extensibility
  }
  
  /**
   * Resolve conflicts between data sources and pick the most accurate values
   */
  private async resolveDataConflicts(sources: PropertyDataSources): Promise<AccuratePropertyData> {
    const result: AccuratePropertyData = {
      acreage: null,
      marketValue: null,
      assessedValue: null,
      zoning: null,
      sewerAvailable: null,
      yearBuilt: null,
      parcelId: null,
      standardizedAddress: null,
      dataQualityScore: 0,
      sourcesUsed: [],
      conflictsDetected: []
    };
    
    const fields = ['acreage', 'marketValue', 'assessedValue', 'zoning', 'yearBuilt', 'parcelId'] as const;
    
    for (const field of fields) {
      const dataPoints = sources[field];
      if (!dataPoints || dataPoints.length === 0) continue;
      
      if (dataPoints.length === 1) {
        // Single source - use it
        result[field] = dataPoints[0].value;
        if (!result.sourcesUsed.includes(dataPoints[0].source)) {
          result.sourcesUsed.push(dataPoints[0].source);
        }
      } else {
        // Multiple sources - resolve conflict
        const resolution = this.resolveFieldConflict(field, dataPoints);
        result[field] = resolution.selectedValue;
        
        if (!result.sourcesUsed.includes(resolution.selectedSource)) {
          result.sourcesUsed.push(resolution.selectedSource);
        }
        
        // Log conflict if values differ significantly
        if (resolution.hasConflict) {
          result.conflictsDetected.push({
            field,
            sources: dataPoints.map(dp => ({
              source: dp.source,
              value: dp.value,
              confidence: dp.confidence
            })),
            resolution: `Used ${resolution.selectedSource} (${resolution.reason})`
          });
        }
      }
    }
    
    // Calculate overall data quality score
    result.dataQualityScore = this.calculateOverallQualityScore(sources, result);
    
    return result;
  }
  
  /**
   * Resolve conflict for a specific field
   */
  private resolveFieldConflict(field: string, dataPoints: PropertyDataPoint[]): {
    selectedValue: any;
    selectedSource: string;
    hasConflict: boolean;
    reason: string;
  } {
    // Sort by confidence first, then by data freshness
    const sorted = [...dataPoints].sort((a, b) => {
      // Primary: Confidence score
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      
      // Secondary: Data freshness (more recent = better)
      if (a.lastUpdated && b.lastUpdated) {
        return b.lastUpdated.getTime() - a.lastUpdated.getTime();
      }
      
      // Tertiary: Source reliability (ATTOM > HelloData for official data)
      const sourceRanking = this.getSourceRanking(a.source) - this.getSourceRanking(b.source);
      return sourceRanking;
    });
    
    const best = sorted[0];
    const hasConflict = this.detectSignificantConflict(field, dataPoints);
    
    let reason = `highest confidence (${Math.round(best.confidence * 100)}%)`;
    if (best.lastUpdated) {
      reason += `, recent data (${best.lastUpdated.toLocaleDateString()})`;
    }
    
    return {
      selectedValue: best.value,
      selectedSource: best.source,
      hasConflict,
      reason
    };
  }
  
  /**
   * Detect if there's a significant conflict between data points
   */
  private detectSignificantConflict(field: string, dataPoints: PropertyDataPoint[]): boolean {
    if (dataPoints.length < 2) return false;
    
    const values = dataPoints.map(dp => dp.value);
    
    if (field === 'acreage' || field.includes('Value')) {
      // For numerical values, check if difference is > 15%
      const numbers = values.filter(v => typeof v === 'number' && v > 0);
      if (numbers.length < 2) return false;
      
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      const percentDiff = ((max - min) / min) * 100;
      
      return percentDiff > 15;
    } else {
      // For string values, check if they're different
      const uniqueValues = Array.from(new Set(values.filter(v => v != null)));
      return uniqueValues.length > 1;
    }
  }
  
  /**
   * Get source ranking for tiebreaking (lower number = higher priority)
   */
  private getSourceRanking(source: string): number {
    if (source.includes('ATTOM Data')) return 1; // Government/official data
    if (source.includes('HelloData')) return 2; // Market analysis
    return 3; // Other sources
  }
  
  /**
   * Calculate HelloData confidence based on data characteristics
   */
  private calculateHellodataConfidence(property: any): number {
    let confidence = 0.80; // Base confidence
    
    // Increase confidence if data seems recent
    if (property.lastUpdated) {
      const lastUpdate = new Date(property.lastUpdated);
      const monthsOld = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld < 6) confidence += 0.10; // Recent data
      else if (monthsOld > 24) confidence -= 0.15; // Old data
    }
    
    // Increase confidence if multiple data points available
    const dataPointCount = [property.marketValue, property.lotSize, property.units, property.rentData].filter(Boolean).length;
    if (dataPointCount >= 3) confidence += 0.05;
    
    return Math.min(confidence, 0.95); // Cap at 95%
  }
  
  
  /**
   * Parse HelloData date format
   */
  private parseHellodataDate(dateString: string | null): Date | null {
    if (!dateString) return null;
    try {
      return new Date(dateString);
    } catch {
      return null;
    }
  }
  
  /**
   * Calculate overall data quality score
   */
  private calculateOverallQualityScore(sources: PropertyDataSources, result: AccuratePropertyData): number {
    const totalFields = 6; // acreage, marketValue, assessedValue, zoning, yearBuilt, parcelId
    const filledFields = [result.acreage, result.marketValue, result.assessedValue, result.zoning, result.yearBuilt, result.parcelId]
      .filter(v => v !== null && v !== undefined).length;
    
    const completenessScore = (filledFields / totalFields) * 100;
    
    // Adjust for data quality and conflicts
    let qualityAdjustment = 0;
    if (result.conflictsDetected.length === 0) qualityAdjustment += 10; // No conflicts = higher quality
    // Quality scoring adjusted for available data sources
    
    return Math.min(Math.round(completenessScore + qualityAdjustment), 100);
  }
}

// Export singleton instance
export const dataAccuracyService = new DataAccuracyService();
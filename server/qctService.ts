import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface QCTRecord {
  fips: string;
  cbsa: string;
  statefp: string;
  cnty: string;
  stcnty: string;
  tract: string;
  splittr: string;
  qct_id: string;
}

class QCTService {
  private qctData: Set<string> = new Set();
  private initialized = false;

  private async initialize() {
    if (this.initialized) return;

    try {
      // When running from dist/, go up one level to reach server/data
      // Use current year's QCT data (update annually)
      const currentYear = new Date().getFullYear();
      let csvPath = join(__dirname, '..', 'server', 'data', `qct${currentYear}.csv`);
      console.log(`📂 Loading QCT data from: ${csvPath} (${currentYear} data)`);
      
      let csvContent: string;
      try {
        csvContent = readFileSync(csvPath, 'utf-8');
      } catch (fileError) {
        // Fallback to previous year if current year file doesn't exist
        console.log(`⚠️ ${currentYear} QCT file not found, trying ${currentYear - 1}...`);
        csvPath = join(__dirname, '..', 'server', 'data', `qct${currentYear - 1}.csv`);
        csvContent = readFileSync(csvPath, 'utf-8');
        console.log(`📂 Using ${currentYear - 1} QCT data as fallback`);
      }
      const lines = csvContent.split('\n');
      
      // Skip header row
      let loadedCount = 0;
      const sampleFips: string[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split(',');
        if (columns.length >= 8) {
          // Extract FIPS code (last column)
          const fips = columns[7].trim();
          if (fips) {
            this.qctData.add(fips);
            loadedCount++;
            
            // Collect sample Charlotte (37119) FIPS codes for debugging
            if (fips.startsWith('37119') && sampleFips.length < 5) {
              sampleFips.push(fips);
            }
          }
        }
      }
      
      console.log(`✅ QCT Service initialized with ${this.qctData.size} qualified census tracts`);
      console.log(`🔍 [QCT-DEBUG] Sample Charlotte (37119) QCT FIPS codes:`, sampleFips);
      console.log(`🔍 [QCT-DEBUG] Total Charlotte QCTs loaded:`, Array.from(this.qctData).filter(f => f.startsWith('37119')).length);
      this.initialized = true;
    } catch (error) {
      console.error('❌ Error loading QCT data:', error);
      throw new Error('Failed to initialize QCT service');
    }
  }

  async isQualifiedCensusTract(fipsCode: string): Promise<boolean> {
    await this.initialize();
    
    // Validate input FIPS code
    if (!fipsCode || typeof fipsCode !== 'string') {
      console.log(`⚠️ [QCT] Invalid FIPS code provided:`, fipsCode);
      return false;
    }
    
    // Normalize FIPS code — stored codes may be 15-digit census block FIPS;
    // QCT lookup uses 11-digit census tract FIPS (first 11 digits)
    const digits = fipsCode.replace(/\D/g, '');
    const normalizedFips = digits.length > 11
      ? digits.slice(0, 11)
      : digits.padStart(11, '0');
    
    // Additional validation: ensure we have a valid 11-digit FIPS after normalization
    if (normalizedFips.length !== 11) {
      console.log(`⚠️ [QCT] Invalid FIPS length after normalization: ${normalizedFips} (${normalizedFips.length} digits)`);
      return false;
    }
    
    const isQCT = this.qctData.has(normalizedFips);
    
    console.log(`🔍 [QCT-MATCH] FIPS Comparison:`, {
      inputFips: fipsCode,
      normalizedFips: normalizedFips,
      isInQCT: isQCT,
      totalQCTCount: this.qctData.size
    });
    
    return isQCT;
  }

  async checkQCTStatus(fipsCode: string): Promise<{ isQCT: boolean; fips: string }> {
    const isQCT = await this.isQualifiedCensusTract(fipsCode);
    return {
      isQCT,
      fips: fipsCode
    };
  }
}

export const qctService = new QCTService();

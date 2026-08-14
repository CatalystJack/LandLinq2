/**
 * DDA (Difficult Development Area) Service — 2026 HUD Designations
 *
 * DDAs are high-cost areas where it's difficult to develop affordable housing.
 * Properties in DDAs qualify for a 30% basis boost in LIHTC — meaning the
 * eligible tax credit basis is 130% of normal, yielding 30% more 9% credits.
 *
 * Two types:
 *   MDDA  — Metro DDA: designated by ZIP code (ZCTA) within metro areas
 *   NMDDA — Non-Metro DDA: designated by county FIPS for non-metro counties
 *
 * Data source: HUD 2026 DDA Excel file (hud-ddas-data-used-to-designate-2026.xlsx)
 * Pre-parsed to JSON at server/data/dda2026_mdda.json and server/data/dda2026_nmdda.json
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MDDARecord {
  dda: boolean;
  areaName: string;
  safmr: number | null;       // Small Area Fair Market Rent (2-bed)
  vlil: number | null;        // 4-Person Very Low Income Limit
  lihtcMaxRent: number | null; // LIHTC Maximum Rent (1/12 of 30% of 120% of VLIL)
  sddaRatio: number | null;   // SAFMR / LIHTC Max Rent ranking ratio
}

interface NMDDARecord {
  dda: boolean;
  areaName: string;
  fmr: number | null;         // Fair Market Rent (2-bed)
  vlil: number | null;        // 4-Person Very Low Income Limit
  lihtcMaxRent: number | null;
  ddaRatio: number | null;
}

export interface DDAResult {
  ddaStatus: 'MDDA' | 'NMDDA' | 'NO' | 'N/A';
  ddaType: 'MDDA' | 'NMDDA' | null;
  areaName: string | null;
  vlil: number | null;          // Very Low Income Limit (4-person household)
  lihtcMaxRent: number | null;  // Maximum rent that satisfies LIHTC income limits
  fmrOrSafmr: number | null;    // Fair Market Rent / Small Area FMR (2-bedroom)
  basisBoost: boolean;          // true → 30% basis boost available
}

class DDAService {
  private mddaMap: Record<string, MDDARecord> = {};
  private nmddaMap: Record<string, NMDDARecord> = {};
  private initialized = false;

  private initialize(): void {
    if (this.initialized) return;
    try {
      const mddaPath = join(__dirname, '..', 'server', 'data', 'dda2026_mdda.json');
      const nmddaPath = join(__dirname, '..', 'server', 'data', 'dda2026_nmdda.json');
      this.mddaMap = JSON.parse(readFileSync(mddaPath, 'utf-8'));
      this.nmddaMap = JSON.parse(readFileSync(nmddaPath, 'utf-8'));
      const mddaCount = Object.values(this.mddaMap).filter(v => v.dda).length;
      const nmddaCount = Object.values(this.nmddaMap).filter(v => v.dda).length;
      console.log(`✅ DDA Service: ${mddaCount} Metro DDAs (by ZIP) + ${nmddaCount} Non-Metro DDAs (by county FIPS) loaded`);
      this.initialized = true;
    } catch (err) {
      console.error('❌ DDA Service failed to initialize:', err);
    }
  }

  /**
   * Check DDA status for a deal.
   * @param zipCode — 5-digit ZIP code (for MDDA lookup)
   * @param censusTractFips — 11-digit census tract FIPS (first 5 digits = county FIPS for NMDDA)
   */
  checkDDAStatus(zipCode?: string | null, censusTractFips?: string | null): DDAResult {
    this.initialize();

    const notFound: DDAResult = {
      ddaStatus: 'N/A',
      ddaType: null,
      areaName: null,
      vlil: null,
      lihtcMaxRent: null,
      fmrOrSafmr: null,
      basisBoost: false,
    };

    // 1. Try MDDA lookup by ZIP code
    if (zipCode) {
      const zip = String(zipCode).replace(/\D/g, '').padStart(5, '0');
      const mdda = this.mddaMap[zip];
      if (mdda) {
        if (mdda.dda) {
          console.log(`✅ [DDA] ZIP ${zip} is an MDDA (${mdda.areaName}) — 30% basis boost available`);
          return {
            ddaStatus: 'MDDA',
            ddaType: 'MDDA',
            areaName: mdda.areaName,
            vlil: mdda.vlil,
            lihtcMaxRent: mdda.lihtcMaxRent,
            fmrOrSafmr: mdda.safmr,
            basisBoost: true,
          };
        } else {
          console.log(`ℹ️ [DDA] ZIP ${zip} is in the metro area (${mdda.areaName}) but NOT an MDDA`);
          return {
            ddaStatus: 'NO',
            ddaType: null,
            areaName: mdda.areaName,
            vlil: mdda.vlil,
            lihtcMaxRent: mdda.lihtcMaxRent,
            fmrOrSafmr: mdda.safmr,
            basisBoost: false,
          };
        }
      }
    }

    // 2. Fall back to NMDDA lookup by county FIPS (first 5 digits of 11-digit tract FIPS)
    if (censusTractFips) {
      const countyFips = String(censusTractFips).replace(/\D/g, '').substring(0, 5).padStart(5, '0');
      const nmdda = this.nmddaMap[countyFips];
      if (nmdda) {
        if (nmdda.dda) {
          console.log(`✅ [DDA] County FIPS ${countyFips} is an NMDDA (${nmdda.areaName}) — 30% basis boost available`);
          return {
            ddaStatus: 'NMDDA',
            ddaType: 'NMDDA',
            areaName: nmdda.areaName,
            vlil: nmdda.vlil,
            lihtcMaxRent: nmdda.lihtcMaxRent,
            fmrOrSafmr: nmdda.fmr,
            basisBoost: true,
          };
        } else {
          console.log(`ℹ️ [DDA] County FIPS ${countyFips} is NOT an NMDDA (${nmdda.areaName})`);
          return {
            ddaStatus: 'NO',
            ddaType: null,
            areaName: nmdda.areaName,
            vlil: nmdda.vlil,
            lihtcMaxRent: nmdda.lihtcMaxRent,
            fmrOrSafmr: nmdda.fmr,
            basisBoost: false,
          };
        }
      }
    }

    console.log(`ℹ️ [DDA] No DDA data found for ZIP=${zipCode || 'N/A'} / FIPS=${censusTractFips || 'N/A'}`);
    return notFound;
  }
}

export const ddaService = new DDAService();

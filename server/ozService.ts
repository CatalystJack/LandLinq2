/**
 * Opportunity Zone (OZ) Service
 * Checks if a census tract FIPS code is a federally-designated Qualified Opportunity Zone.
 * OZ designations were made in 2018 under IRC § 1400Z and are permanent through 2047.
 * Data source: HUD ArcGIS Feature Service for Opportunity Zones
 * Service was renamed from "QOZ" to "Opportunity_Zones" — layer ID is 13 (not 0).
 * GET queries return "Invalid URL"; POST queries work correctly.
 */

const OZ_ARCGIS_URL =
  'https://services.arcgis.com/VTyQ9soqVukalItT/ArcGIS/rest/services/Opportunity_Zones/FeatureServer/13/query';

class OZService {
  private ozData: Set<string> = new Set();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private async loadFromArcGIS(): Promise<void> {
    let offset = 0;
    const pageSize = 2000;
    let totalLoaded = 0;

    while (true) {
      const params = new URLSearchParams({
        where: '1=1',
        outFields: 'GEOID10',
        resultRecordCount: String(pageSize),
        resultOffset: String(offset),
        f: 'json',
      });

      const resp = await fetch(OZ_ARCGIS_URL, {
        method: 'POST',
        body: params,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status} from HUD ArcGIS OZ service`);

      const data = (await resp.json()) as any;

      if (!data.features || data.features.length === 0) break;

      for (const feature of data.features) {
        const geoid = feature.attributes?.GEOID10;
        if (geoid) {
          this.ozData.add(String(geoid).padStart(11, '0'));
          totalLoaded++;
        }
      }

      if (data.features.length < pageSize) break;
      offset += pageSize;
    }

    if (totalLoaded === 0) throw new Error('OZ service returned 0 tracts — URL or field name may have changed');
    console.log(`✅ OZ Service initialized with ${totalLoaded} designated Opportunity Zone tracts`);
  }

  private initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.loadFromArcGIS()
      .then(() => {
        this.initialized = true;
      })
      .catch((err) => {
        console.error('❌ OZ Service failed to initialize — all lookups will return N/A:', err?.message ?? err);
        this.initPromise = null;
      });

    return this.initPromise;
  }

  async checkOZStatus(fipsCode: string): Promise<{ isOZ: boolean; fips: string }> {
    if (!fipsCode) return { isOZ: false, fips: '' };

    try {
      await this.initialize();
    } catch {
      return { isOZ: false, fips: fipsCode };
    }

    if (!this.initialized) return { isOZ: false, fips: fipsCode };

    // Stored codes may be 15-digit census block FIPS; OZ lookup uses 11-digit tract FIPS
    const digits = fipsCode.replace(/\D/g, '');
    const normalizedFips = digits.length > 11 ? digits.slice(0, 11) : digits.padStart(11, '0');
    const isOZ = this.ozData.has(normalizedFips);

    console.log(`🔍 [OZ-MATCH] FIPS ${normalizedFips} → ${isOZ ? 'OPPORTUNITY ZONE ✅' : 'not OZ'}`);

    return { isOZ, fips: fipsCode };
  }
}

export const ozService = new OZService();

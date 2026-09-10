import { eq } from 'drizzle-orm';
import { db } from './db.js';
import { propertyData } from '../shared/schema.js';
import { fetchFemaFloodData, type FemaFloodData } from './femaFloodService.js';
import { fetchWetlandsData, type WetlandsData } from './wetlandsService.js';
import { fetchEpaEnvironmentalData, type EpaEnvironmentalData } from './epaEnvironmentalService.js';

export interface GovernmentEnrichmentInput {
  dealId: string;
  latitude: number | string | null | undefined;
  longitude: number | string | null | undefined;
}

export interface GovernmentEnrichmentResult {
  dealId: string;
  fema: FemaFloodData | null;
  wetlands: WetlandsData | null;
  epa: EpaEnvironmentalData | null;
  failures: string[];
}

function asFiniteNumber(value: number | string | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function enrichDealWithGovernmentData(
  input: GovernmentEnrichmentInput,
): Promise<GovernmentEnrichmentResult> {
  const latitude = asFiniteNumber(input.latitude);
  const longitude = asFiniteNumber(input.longitude);
  const empty: GovernmentEnrichmentResult = {
    dealId: input.dealId,
    fema: null,
    wetlands: null,
    epa: null,
    failures: ['missing_coordinates'],
  };
  if (latitude === null || longitude === null) return empty;

  const results = await Promise.allSettled([
    fetchFemaFloodData(latitude, longitude),
    fetchWetlandsData(latitude, longitude),
    fetchEpaEnvironmentalData(latitude, longitude),
  ]);
  const [femaResult, wetlandsResult, epaResult] = results;
  const failures: string[] = [];
  const fema = femaResult.status === 'fulfilled' ? femaResult.value : null;
  const wetlands = wetlandsResult.status === 'fulfilled' ? wetlandsResult.value : null;
  const epa = epaResult.status === 'fulfilled' ? epaResult.value : null;
  if (femaResult.status === 'rejected' || (femaResult.status === 'fulfilled' && !fema)) failures.push('fema');
  if (wetlandsResult.status === 'rejected' || (wetlandsResult.status === 'fulfilled' && !wetlands)) failures.push('wetlands');
  if (epaResult.status === 'rejected' || (epaResult.status === 'fulfilled' && !epa)) failures.push('epa');

  if (fema || wetlands || epa) {
    try {
      const [existing] = await db.select().from(propertyData)
        .where(eq(propertyData.dealId, input.dealId))
        .limit(1);
      const existingConstraints = existing?.environmentalConstraints &&
        typeof existing.environmentalConstraints === 'object'
        ? existing.environmentalConstraints as Record<string, unknown>
        : {};
      const updates: Record<string, unknown> = {
        coordinates: { lat: latitude, lng: longitude },
        environmentalConstraints: {
          ...existingConstraints,
          ...(fema ? { fema } : {}),
          ...(wetlands ? { wetlands } : {}),
          ...(epa ? { epa } : {}),
        },
        updatedAt: new Date(),
      };
      if (fema) updates.floodZone = fema.zoneCode;
      if (wetlands) updates.wetlands = wetlands.isWetland;

      if (existing) {
        await db.update(propertyData).set(updates as any)
          .where(eq(propertyData.id, existing.id));
      } else {
        await db.insert(propertyData).values({
          dealId: input.dealId,
          coordinates: { lat: latitude, lng: longitude },
          floodZone: fema?.zoneCode || null,
          wetlands: wetlands?.isWetland ?? false,
          environmentalConstraints: updates.environmentalConstraints,
        });
      }
    } catch (error) {
      failures.push('persistence');
      console.warn(`⚠️ [GOVERNMENT-ENRICHMENT] Deal ${input.dealId} could not save results:`, error instanceof Error ? error.message : error);
    }
  }

  if (failures.length) {
    console.warn(`⚠️ [GOVERNMENT-ENRICHMENT] Deal ${input.dealId} partial result; failed: ${failures.join(', ')}`);
  } else {
    console.log(`✅ [GOVERNMENT-ENRICHMENT] Deal ${input.dealId} FEMA, wetlands, and EPA results saved`);
  }
  return { dealId: input.dealId, fema, wetlands, epa, failures };
}
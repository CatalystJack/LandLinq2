import type { DeveloperProductType, DeveloperProfile } from "@shared/schema";
import { normalizeIndustrialCriteria } from "@shared/industrial-criteria";
import { normalizeRuralLandCriteria } from "@shared/rural-land-criteria";
import { hasConfiguredCriteria, normalizePurchaseCriteria } from "@shared/purchase-criteria";
import { resolveStateAwareCriteria } from "@shared/criteria-overrides";
import { countyTargetMatchesDeal } from "@shared/county-targets";
import { normalizeUsStateCode } from "@shared/us-states";

export type DealClassification = "passed" | "review" | "red" | "yellow" | "green";
export interface DeveloperClassificationResult {
  classification: DealClassification;
  matchedProductTypes: string[];
}

export interface DeveloperComparableCriteria {
  productType?: string;
  companyMinVintage?: number | null;
  companyMinUnits?: number | null;
  companyMinGrossRent?: number | null;
  companyMinRentPSF?: number | null;
}

/** Resolve one deterministic, conservative comparable profile. When a deal has
 * several matching product types, the highest applicable rent floor wins. */
export function resolveDeveloperComparableCriteria(
  deal: any,
  profile: DeveloperProfile,
  productTypes: DeveloperProductType[],
): DeveloperComparableCriteria {
  const requested = (Array.isArray(deal?.productTypes) ? deal.productTypes : [])
    .map((value: unknown) => String(value).trim().toLowerCase()).filter(Boolean);
  const active = productTypes.filter(type => type.isActive);
  const matching = active.filter(type => requested.some((name: string) =>
    name === String(type.name).trim().toLowerCase() ||
    name.includes(String(type.name).trim().toLowerCase()) ||
    String(type.name).trim().toLowerCase().includes(name),
  ));
  const candidates = (matching.length ? matching : active).slice().sort((a, b) => a.name.localeCompare(b.name));
  const selected = candidates[0];
  const state = deal?.state;
  const resolved = selected ? resolveStateAwareCriteria({
    minRentPsf: numericValue(selected.minRentPsf),
    minRentPerUnit: numericValue(selected.minRentPerUnit),
  }, selected.stateOverrides as any, state) : {};
  const rentValues = candidates.map(type => {
    const criteria = resolveStateAwareCriteria({
      minRentPsf: numericValue(type.minRentPsf),
      minRentPerUnit: numericValue(type.minRentPerUnit),
    }, type.stateOverrides as any, state);
    return profile.rentMetric === "psf" ? criteria.minRentPsf : criteria.minRentPerUnit;
  }).filter((value): value is number => value !== null && value !== undefined);
  return {
    productType: selected?.name,
    companyMinVintage: profile.compMinVintageYear,
    companyMinUnits: profile.compMinUnits,
    ...(profile.rentMetric === "psf"
      ? { companyMinRentPSF: rentValues.length ? Math.max(...rentValues) : (resolved as any).minRentPsf }
      : { companyMinGrossRent: rentValues.length ? Math.max(...rentValues) : (resolved as any).minRentPerUnit }),
  };
}

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

type AcquisitionRangeField = "minCapRate" | "maxCapRate" | "minPrice" | "maxPrice" |
  "minUnitCount" | "maxUnitCount" | "minYearBuilt" | "maxYearBuilt";

function acquisitionRangeResults(deal: any, profile: DeveloperProfile): { reasons: string[]; failed: boolean } {
  const checks: Array<{
    label: string; value: unknown; min: unknown; max: unknown;
    format: (value: number) => string;
  }> = [
    { label: "Cap rate", value: deal?.capRate, min: profile.minCapRate, max: profile.maxCapRate, format: (value) => `${value}%` },
    { label: "Price", value: deal?.askingPrice, min: profile.minPrice, max: profile.maxPrice, format: (value) => `$${Math.round(value).toLocaleString("en-US")}` },
    { label: "Unit count", value: deal?.unitCount, min: profile.minUnitCount, max: profile.maxUnitCount, format: (value) => Math.round(value).toLocaleString("en-US") },
    { label: "Year built", value: deal?.vintage ?? deal?.yearBuilt, min: profile.minYearBuilt, max: profile.maxYearBuilt, format: (value) => String(Math.round(value)) },
  ];
  const reasons: string[] = [];
  let failed = false;
  for (const check of checks) {
    const min = numericValue(check.min);
    const max = numericValue(check.max);
    if (min === null && max === null) continue;
    const value = numericValue(check.value);
    const range = min !== null && max !== null
      ? `${check.format(min)}–${check.format(max)}`
      : min !== null ? `≥ ${check.format(min)}` : `≤ ${check.format(max!)}`;
    if (value === null) {
      reasons.push(`Screening: ${check.label} UNKNOWN | deal value unavailable | range ${range}`);
      continue;
    }
    const inRange = (min === null || value >= min) && (max === null || value <= max);
    if (!inRange) failed = true;
    reasons.push(`Screening: ${check.label} ${inRange ? "PASS" : "FAIL"} | deal ${check.format(value)} | range ${range}`);
  }
  return { reasons, failed };
}

export function isDealInProfileMarket(deal: any, profile: DeveloperProfile): boolean {
  return (profile.targetCounties || []).some((target) =>
    countyTargetMatchesDeal(target, deal?.county, deal?.state),
  ) || (profile.targetStates || []).some((target) =>
    normalizeUsStateCode(target) === normalizeUsStateCode(deal?.state),
  );
}

function hasDesignation(
  deal: any,
  booleanField: "isQct" | "isDda" | "isOz",
  statusField: "qctStatus" | "ddaStatus" | "ozStatus",
  acceptedStatuses: string[],
): boolean {
  // The existing designation services populate the status fields. The boolean
  // fields are supported for new callers and future service write paths.
  return deal?.[booleanField] === true ||
    acceptedStatuses.includes(String(deal?.[statusField] ?? "").toUpperCase());
}

/**
 * Classify one deal against one Investment Company's criteria.
 *
 * "review" means the deal meets the profile's criteria (including a valid
 * affordable-housing rent override); "passed" means it does not. This is
 * intentionally separate from Catalyst's internal green/yellow/red grading.
 */
function classifyDealForProfileCore(
  deal: any,
  profile: DeveloperProfile,
  productTypes: DeveloperProductType[],
): DeveloperClassificationResult {
  if (profile.profileType === "general_sales") {
    return { classification: "passed", matchedProductTypes: [] };
  }
  const countyMatch = isDealInProfileMarket(deal, profile);
  const dealAcreage = numericValue(deal?.sizeAcres);
  const dealState = deal?.state;
  if (profile.assetClass === "rural_land") {
    const criteria = normalizeRuralLandCriteria(profile.ruralLandCriteria);
    if (!countyMatch || dealAcreage === null) {
      return {
        classification: "red",
        matchedProductTypes: [!countyMatch ? "Red: outside configured target market" : "Red: acreage not verified"],
      };
    }
    if (dealAcreage < criteria.yellowMinAcres) {
      return { classification: "red", matchedProductTypes: [`Red: below the ${criteria.yellowMinAcres} acre Yellow minimum`] };
    }
    return { classification: "yellow", matchedProductTypes: [`Yellow: meets the ${criteria.yellowMinAcres} acre minimum; mark Pursuing manually to set Green`] };
  }
  if (profile.assetClass === "industrial") {
    const industrialCriteria = normalizeIndustrialCriteria(profile.industrialCriteria);
    if (!countyMatch) {
      return {
        classification: "red",
        matchedProductTypes: ["Passed: outside configured target market"],
      };
    }

    if (dealAcreage === null) {
      return {
        classification: "red",
        matchedProductTypes: ["Passed: acreage not verified"],
      };
    }

    const matchedProductTypes = industrialCriteria.productTypes
      .filter((productType) => productType.name && productType.minAcres !== null)
      .filter((productType) => {
        const criteria = resolveStateAwareCriteria(
          { minAcres: productType.minAcres!, maxAcres: productType.maxAcres },
          productType.stateOverrides,
          dealState,
        );
        return dealAcreage >= criteria.minAcres &&
          (criteria.maxAcres === null || dealAcreage <= criteria.maxAcres);
      })
      .map((productType) => `${productType.name} candidate`);

    if (!matchedProductTypes.length) {
      return {
        classification: "red",
        matchedProductTypes: ["Passed: acreage does not meet any industrial product type"],
      };
    }

    // Market and acreage are the only current gates for yellow/review.
    // Geometry, slope, wetlands, access, utilities, entitlement, and labor
    // catchments remain review notes rather than additional classification gates.
    return {
      classification: "yellow",
      matchedProductTypes: [
        "Review: target market and acreage criteria met",
        ...matchedProductTypes,
        "Review: industrial site diligence required",
      ],
    };
  }
  const dealRent = profile.rentMetric === "psf"
    ? numericValue(deal?.topRentPSF)
    : numericValue(deal?.avgRentPerUnit);
  const qualifiesForOverride =
    (hasDesignation(deal, "isQct", "qctStatus", ["YES"]) &&
      profile.qctOverridesRentMinimum === true) ||
    (hasDesignation(deal, "isDda", "ddaStatus", ["MDDA", "NMDDA"]) &&
      profile.ddaOverridesRentMinimum === true) ||
    (hasDesignation(deal, "isOz", "ozStatus", ["YES"]) &&
      profile.ozOverridesRentMinimum === true);

  if (!countyMatch) {
    return { classification: "passed", matchedProductTypes: [] };
  }

  const purchaseCriteria = normalizePurchaseCriteria((profile as any).purchaseCriteria);
  const vintage = numericValue(deal?.vintage);
  const unitCount = numericValue(deal?.unitCount);
  const isExistingPurchase = (vintage !== null && vintage > 0) || (unitCount !== null && unitCount > 0);
  if (isExistingPurchase && hasConfiguredCriteria(purchaseCriteria.existing)) {
    const failures: string[] = [];
    const missing: string[] = [];
    const existing = purchaseCriteria.existing;
    if (existing.minVintageYear !== null || existing.maxVintageYear !== null) {
      if (vintage === null || vintage <= 0) missing.push("vintage is not verified");
      else {
        if (existing.minVintageYear !== null && vintage < existing.minVintageYear) failures.push(`Vintage ${vintage} is below minimum ${existing.minVintageYear}`);
        if (existing.maxVintageYear !== null && vintage > existing.maxVintageYear) failures.push(`Vintage ${vintage} is above maximum ${existing.maxVintageYear}`);
      }
    }
    if (existing.minUnits !== null || existing.maxUnits !== null) {
      if (unitCount === null) missing.push("unit count is not verified");
      else {
        if (existing.minUnits !== null && unitCount < existing.minUnits) failures.push(`Unit count ${unitCount} is below minimum ${existing.minUnits}`);
        if (existing.maxUnits !== null && unitCount > existing.maxUnits) failures.push(`Unit count ${unitCount} is above maximum ${existing.maxUnits}`);
      }
    }
    if (failures.length) return { classification: "passed", matchedProductTypes: [`Existing-property criteria not met: ${failures.join("; ")}`] };
    if (missing.length) return { classification: "review", matchedProductTypes: [`Existing property needs review: ${missing.join("; ")}`] };
    return { classification: "review", matchedProductTypes: ["Existing-property acquisition criteria met"] };
  }

  if (!isExistingPurchase && hasConfiguredCriteria(purchaseCriteria.land)) {
    const failures: string[] = [];
    const missing: string[] = [];
    const land = purchaseCriteria.land;
    if (land.minAcres !== null || land.maxAcres !== null) {
      if (dealAcreage === null) missing.push("acreage is not verified");
      else {
        if (land.minAcres !== null && dealAcreage < land.minAcres) failures.push(`Acreage ${dealAcreage} is below minimum ${land.minAcres}`);
        if (land.maxAcres !== null && dealAcreage > land.maxAcres) failures.push(`Acreage ${dealAcreage} is above maximum ${land.maxAcres}`);
      }
    }
    if (land.minUnits !== null || land.maxUnits !== null) {
      const units = numericValue(deal?.maxUnitsByZoning);
      if (units === null) missing.push("unit capacity is not verified");
      else {
        if (land.minUnits !== null && units < land.minUnits) failures.push(`Unit capacity ${units} is below minimum ${land.minUnits}`);
        if (land.maxUnits !== null && units > land.maxUnits) failures.push(`Unit capacity ${units} is above maximum ${land.maxUnits}`);
      }
    }
    if (failures.length) return { classification: "passed", matchedProductTypes: [`Land criteria not met: ${failures.join("; ")}`] };
    if (missing.length) return { classification: "review", matchedProductTypes: [`Land deal needs review: ${missing.join("; ")}`] };
  }

  const matchedProductTypes = productTypes
    .filter((productType) => productType.isActive)
    .filter((productType) => {
      const criteria = resolveStateAwareCriteria(
        {
          minAcres: numericValue(productType.minAcres),
          maxAcres: numericValue(productType.maxAcres),
          minRentPsf: numericValue(productType.minRentPsf),
          minRentPerUnit: numericValue(productType.minRentPerUnit),
        },
        productType.stateOverrides as Record<string, Partial<{
          minAcres: number;
          maxAcres: number;
          minRentPsf: number;
          minRentPerUnit: number;
        }>> | null | undefined,
        dealState,
      );
      const requiredAcreage = criteria.minAcres;
      const maxAcreage = criteria.maxAcres;
      const requiredRent = profile.rentMetric === "psf"
        ? criteria.minRentPsf
        : criteria.minRentPerUnit;
      const acreagePass =
        dealAcreage !== null &&
        requiredAcreage !== null &&
        dealAcreage >= requiredAcreage &&
        (maxAcreage === null || dealAcreage <= maxAcreage);
      const rentPass =
        qualifiesForOverride ||
        (requiredRent !== null && dealRent !== null && dealRent >= requiredRent);
      return acreagePass && rentPass;
    })
    .map((productType) => productType.name);

  return {
    classification: matchedProductTypes.length ? "review" : "passed",
    matchedProductTypes,
  };
}

export function classifyDealForProfile(
  deal: any,
  profile: DeveloperProfile,
  productTypes: DeveloperProductType[],
): DeveloperClassificationResult {
  const result = classifyDealForProfileCore(deal, profile, productTypes);
  if (profile.profileType === "general_sales") return result;
  const range = acquisitionRangeResults(deal, profile);
  if (!range.reasons.length) return result;
  const failureClassification: DealClassification =
    profile.assetClass === "industrial" || profile.assetClass === "rural_land"
      ? "red"
      : "passed";
  return {
    classification: range.failed ? failureClassification : result.classification,
    matchedProductTypes: [...result.matchedProductTypes, ...range.reasons],
  };
}
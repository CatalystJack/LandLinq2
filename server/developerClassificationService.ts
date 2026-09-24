import type { DeveloperProductType, DeveloperProfile } from "@shared/schema";
import { normalizeIndustrialCriteria } from "@shared/industrial-criteria";
import { resolveStateAwareCriteria } from "@shared/criteria-overrides";
import { countyTargetMatchesDeal } from "@shared/county-targets";
import { normalizeUsStateCode } from "@shared/us-states";

export type DealClassification = "passed" | "review" | "red" | "yellow";
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
export function classifyDealForProfile(
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
  if (profile.assetClass === "industrial") {
    const industrialCriteria = normalizeIndustrialCriteria(profile.industrialCriteria);
    const effectiveIndustrialCriteria = resolveStateAwareCriteria(
      industrialCriteria.default,
      industrialCriteria.stateOverrides,
      dealState,
    );
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

    if (dealAcreage < effectiveIndustrialCriteria.minSingleLoadAcres) {
      return {
        classification: "red",
        matchedProductTypes: [`Passed: below ${effectiveIndustrialCriteria.minSingleLoadAcres} acre minimum`],
      };
    }

    const matchedProductTypes = [
      "Review: target market and acreage minimum met",
      ...(dealAcreage >= effectiveIndustrialCriteria.minSingleLoadAcres ? ["Single-load candidate"] : []),
      ...(dealAcreage >= effectiveIndustrialCriteria.minCrossDockAcres ? ["Cross-dock candidate"] : []),
      "Review: industrial site diligence required",
    ];

    // Market and acreage are the only current gates for yellow/review.
    // Geometry, slope, wetlands, access, utilities, entitlement, and labor
    // catchments remain review notes rather than additional classification gates.
    return {
      classification: "yellow",
      matchedProductTypes,
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
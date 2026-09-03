import type { DeveloperProductType, DeveloperProfile } from "@shared/schema";

export type DealClassification = "passed" | "review";
export interface DeveloperClassificationResult {
  classification: DealClassification;
  matchedProductTypes: string[];
}

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isDealInProfileMarket(deal: any, profile: DeveloperProfile): boolean {
  const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
  const county = normalize(deal?.county);
  const state = normalize(deal?.state);
  return (profile.targetCounties || []).some((target) => normalize(target) === county) ||
    (profile.targetStates || []).some((target) => normalize(target) === state);
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
  const countyMatch = isDealInProfileMarket(deal, profile);
  const dealAcreage = numericValue(deal?.sizeAcres);
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
      const requiredAcreage = numericValue(productType.minAcres);
      const maxAcreage = numericValue(productType.maxAcres);
      const requiredRent = profile.rentMetric === "psf"
        ? numericValue(productType.minRentPsf)
        : numericValue(productType.minRentPerUnit);
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
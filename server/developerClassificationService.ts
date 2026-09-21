import type { DeveloperProductType, DeveloperProfile } from "@shared/schema";
import { normalizeIndustrialCriteria } from "@shared/industrial-criteria";

export type DealClassification = "passed" | "review" | "red" | "yellow";
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
  if (profile.profileType === "general_sales") {
    return { classification: "passed", matchedProductTypes: [] };
  }
  const countyMatch = isDealInProfileMarket(deal, profile);
  const dealAcreage = numericValue(deal?.sizeAcres);
  if (profile.assetClass === "industrial") {
    const industrialCriteria = normalizeIndustrialCriteria(profile.industrialCriteria);
    const hasLocation = Boolean(String(deal?.state ?? "").trim() || String(deal?.county ?? "").trim());

    if (!hasLocation && industrialCriteria.yellowMissingLocation) {
      return {
        classification: "yellow",
        matchedProductTypes: ["Yellow: location needs verification"],
      };
    }

    if (!countyMatch && industrialCriteria.redOutsideTargetMarket) {
      return {
        classification: "red",
        matchedProductTypes: ["Red: outside target market"],
      };
    }

    if (dealAcreage !== null &&
        dealAcreage < industrialCriteria.minSingleLoadAcres &&
        industrialCriteria.redBelowMinimumAcreage) {
      return {
        classification: "red",
        matchedProductTypes: [`Red: below ${industrialCriteria.minSingleLoadAcres} acre minimum`],
      };
    }

    const matchedProductTypes = [];
    if (dealAcreage === null && industrialCriteria.yellowMissingAcreage) {
      matchedProductTypes.push("Yellow: acreage needs verification");
    } else if (dealAcreage !== null) {
      if (dealAcreage >= industrialCriteria.minSingleLoadAcres) {
        matchedProductTypes.push("Single-load candidate");
      }
      if (dealAcreage >= industrialCriteria.minCrossDockAcres) {
        matchedProductTypes.push("Cross-dock candidate");
      }
    }
    if (industrialCriteria.yellowSiteEvidenceUnavailable) {
      matchedProductTypes.push("Yellow: industrial site diligence required");
    }

    // Current evidence supports market and acreage triage only. Geometry,
    // slope, wetlands, access, utilities, entitlement, and labor catchments
    // remain yellow/manual review until reliable site-level sources are connected.
    return {
      classification: "yellow",
      matchedProductTypes: matchedProductTypes.length ? matchedProductTypes : ["Yellow: industrial site review"],
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
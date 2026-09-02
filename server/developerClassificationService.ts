import type { DeveloperProfile } from "@shared/schema";

export type DealClassification = "passed" | "review";

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
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
): DealClassification {
  const countyMatch =
    (profile.targetCounties || []).includes(deal?.county) ||
    (profile.targetStates || []).includes(deal?.state);

  const overrides = (profile.acreageOverridesByProductType || {}) as Record<string, unknown>;
  const productType = deal?.productType ?? (
    Array.isArray(deal?.productTypes)
      ? deal.productTypes[0]
      : typeof deal?.productTypes === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(deal.productTypes);
              return Array.isArray(parsed) ? parsed[0] : parsed;
            } catch {
              return deal.productTypes;
            }
          })()
        : undefined
  );
  const requiredAcreage =
    numericValue(overrides[productType]) ??
    numericValue(profile.minAcres);
  const dealAcreage = numericValue(deal?.sizeAcres);
  const maxAcreage = numericValue(profile.maxAcres);
  const acreagePass =
    dealAcreage !== null &&
    requiredAcreage !== null &&
    dealAcreage >= requiredAcreage &&
    (maxAcreage === null || dealAcreage <= maxAcreage);

  // The primary rent metric drives classification. PSF uses the highest comp;
  // per-unit uses the average comp, matching the existing rent conventions.
  const requiredRent = profile.rentMetric === "psf"
    ? numericValue(profile.minRentPsf)
    : numericValue(profile.minRentPerUnit);
  const dealRent = profile.rentMetric === "psf"
    ? numericValue(deal?.topRentPSF)
    : numericValue(deal?.avgRentPerUnit);
  const rentPass =
    requiredRent !== null &&
    dealRent !== null &&
    dealRent >= requiredRent;

  if (countyMatch && acreagePass && rentPass) {
    return "review";
  }

  // A designation can rescue only a rent failure. Location and acreage must
  // still pass, so an override can never broaden the market or site criteria.
  if (countyMatch && acreagePass && !rentPass) {
    const qualifiesForOverride =
      (hasDesignation(deal, "isQct", "qctStatus", ["YES"]) &&
        profile.qctOverridesRentMinimum === true) ||
      (hasDesignation(deal, "isDda", "ddaStatus", ["MDDA", "NMDDA"]) &&
        profile.ddaOverridesRentMinimum === true) ||
      (hasDesignation(deal, "isOz", "ozStatus", ["YES"]) &&
        profile.ozOverridesRentMinimum === true);

    if (qualifiesForOverride) {
      return "review";
    }
  }

  return "passed";
}
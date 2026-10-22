export type PurchaseCriteria = {
  land: {
    minAcres: number | null;
    maxAcres: number | null;
    minUnits: number | null;
    maxUnits: number | null;
  };
  existing: {
    minVintageYear: number | null;
    maxVintageYear: number | null;
    minUnits: number | null;
    maxUnits: number | null;
  };
};

export const DEFAULT_PURCHASE_CRITERIA: PurchaseCriteria = {
  land: { minAcres: null, maxAcres: null, minUnits: null, maxUnits: null },
  existing: { minVintageYear: null, maxVintageYear: null, minUnits: null, maxUnits: null },
};

const FIELDS = {
  land: ["minAcres", "maxAcres", "minUnits", "maxUnits"],
  existing: ["minVintageYear", "maxVintageYear", "minUnits", "maxUnits"],
} as const;

export function normalizePurchaseCriteria(value: unknown): PurchaseCriteria {
  const source = value && typeof value === "object" ? value as Record<string, any> : {};
  const read = (section: "land" | "existing", field: string): number | null => {
    const raw = source[section]?.[field];
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  return {
    land: {
      minAcres: read("land", "minAcres"),
      maxAcres: read("land", "maxAcres"),
      minUnits: read("land", "minUnits"),
      maxUnits: read("land", "maxUnits"),
    },
    existing: {
      minVintageYear: read("existing", "minVintageYear"),
      maxVintageYear: read("existing", "maxVintageYear"),
      minUnits: read("existing", "minUnits"),
      maxUnits: read("existing", "maxUnits"),
    },
  };
}

export function validatePurchaseCriteria(value: unknown): PurchaseCriteria {
  const source = value && typeof value === "object" ? value as Record<string, any> : {};
  const criteria = normalizePurchaseCriteria(source);
  for (const section of ["land", "existing"] as const) {
    for (const field of FIELDS[section]) {
      const raw = source[section]?.[field];
      if (raw === null || raw === undefined || raw === "") continue;
      const number = Number(raw);
      if (!Number.isFinite(number) || number < 0 || (field !== "minAcres" && field !== "maxAcres" && !Number.isInteger(number))) {
        throw new Error(`${section === "land" ? "Land" : "Existing-property"} ${field} must be a valid non-negative ${field.includes("Vintage") || field.includes("Units") ? "whole number" : "number"}`);
      }
    }
  }
  if (criteria.land.minAcres !== null && criteria.land.maxAcres !== null && criteria.land.maxAcres < criteria.land.minAcres) {
    throw new Error("Land maximum acreage must be at least the minimum acreage");
  }
  if (criteria.land.minUnits !== null && criteria.land.maxUnits !== null && criteria.land.maxUnits < criteria.land.minUnits) {
    throw new Error("Land maximum units must be at least the minimum units");
  }
  if (criteria.existing.minVintageYear !== null && (criteria.existing.minVintageYear < 1800 || criteria.existing.minVintageYear > 2100)) {
    throw new Error("Minimum vintage year must be between 1800 and 2100");
  }
  if (criteria.existing.maxVintageYear !== null && (criteria.existing.maxVintageYear < 1800 || criteria.existing.maxVintageYear > 2100)) {
    throw new Error("Maximum vintage year must be between 1800 and 2100");
  }
  if (criteria.existing.minVintageYear !== null && criteria.existing.maxVintageYear !== null &&
      criteria.existing.maxVintageYear < criteria.existing.minVintageYear) {
    throw new Error("Maximum vintage year must be at least the minimum vintage year");
  }
  if (criteria.existing.minUnits !== null && criteria.existing.maxUnits !== null &&
      criteria.existing.maxUnits < criteria.existing.minUnits) {
    throw new Error("Existing-property maximum units must be at least the minimum units");
  }
  return criteria;
}

export function hasConfiguredCriteria(section: PurchaseCriteria["land"] | PurchaseCriteria["existing"]): boolean {
  return Object.values(section).some((value) => value !== null);
}

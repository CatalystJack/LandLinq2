export type DeveloperAssetClass = "multifamily" | "industrial";

export type IndustrialCriteria = {
  minSingleLoadAcres: number;
  minCrossDockAcres: number;
  notes: string;
};

export const DEFAULT_INDUSTRIAL_CRITERIA: IndustrialCriteria = {
  minSingleLoadAcres: 15,
  minCrossDockAcres: 30,
  notes: "",
};

export function normalizeIndustrialCriteria(value: unknown): IndustrialCriteria {
  const source = value && typeof value === "object" ? value as Partial<IndustrialCriteria> : {};
  const numberOrDefault = (key: keyof IndustrialCriteria) => {
    const raw = source[key];
    if (raw === null || raw === undefined) {
      return DEFAULT_INDUSTRIAL_CRITERIA[key] as number;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_INDUSTRIAL_CRITERIA[key] as number;
  };
  return {
    minSingleLoadAcres: numberOrDefault("minSingleLoadAcres"),
    minCrossDockAcres: numberOrDefault("minCrossDockAcres"),
    notes: typeof source.notes === "string" ? source.notes.trim() : "",
  };
}

export function validateIndustrialCriteria(criteria: IndustrialCriteria): IndustrialCriteria {
  if (criteria.minCrossDockAcres < criteria.minSingleLoadAcres) {
    throw new Error("Cross-dock minimum acreage cannot be lower than single-load minimum acreage");
  }
  return criteria;
}
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
    const parsed = Number(source[key]);
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
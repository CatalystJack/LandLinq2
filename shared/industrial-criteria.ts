export type DeveloperAssetClass = "multifamily" | "industrial";

export type IndustrialCriteria = {
  minSingleLoadAcres: number;
  minCrossDockAcres: number;
  redOutsideTargetMarket: boolean;
  redBelowMinimumAcreage: boolean;
  yellowMissingLocation: boolean;
  yellowMissingAcreage: boolean;
  yellowSiteEvidenceUnavailable: boolean;
  notes: string;
};

export const DEFAULT_INDUSTRIAL_CRITERIA: IndustrialCriteria = {
  minSingleLoadAcres: 15,
  minCrossDockAcres: 30,
  redOutsideTargetMarket: true,
  redBelowMinimumAcreage: true,
  yellowMissingLocation: true,
  yellowMissingAcreage: true,
  yellowSiteEvidenceUnavailable: true,
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
  const booleanOrDefault = (key: keyof IndustrialCriteria) =>
    typeof source[key] === "boolean"
      ? source[key] as boolean
      : DEFAULT_INDUSTRIAL_CRITERIA[key] as boolean;

  return {
    minSingleLoadAcres: numberOrDefault("minSingleLoadAcres"),
    minCrossDockAcres: numberOrDefault("minCrossDockAcres"),
    redOutsideTargetMarket: booleanOrDefault("redOutsideTargetMarket"),
    redBelowMinimumAcreage: booleanOrDefault("redBelowMinimumAcreage"),
    yellowMissingLocation: booleanOrDefault("yellowMissingLocation"),
    yellowMissingAcreage: booleanOrDefault("yellowMissingAcreage"),
    yellowSiteEvidenceUnavailable: booleanOrDefault("yellowSiteEvidenceUnavailable"),
    notes: typeof source.notes === "string" ? source.notes.trim() : "",
  };
}
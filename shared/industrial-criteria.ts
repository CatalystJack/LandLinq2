export type DeveloperAssetClass = "multifamily" | "industrial";

export type IndustrialCriteria = {
  minSingleLoadAcres: number;
  minCrossDockAcres: number;
  singleLoadWidthFt: number;
  singleLoadLengthFt: number;
  crossDockWidthFt: number;
  crossDockLengthFt: number;
  maxSlopePct: number;
  maxStreamCrossings: number;
  maxInterstateMiles: number;
  minPopulation30Min: number;
  minPopulation45Min: number;
  maxUnemploymentPct: number;
  minTechnicalColleges30Min: number;
  allowIndustrialZoning: boolean;
  allowIndustrialComprehensivePlan: boolean;
  allowAdjacentIndustrialYellow: boolean;
  requireUtilityReview: boolean;
  notes: string;
};

export const DEFAULT_INDUSTRIAL_CRITERIA: IndustrialCriteria = {
  minSingleLoadAcres: 15,
  minCrossDockAcres: 30,
  singleLoadWidthFt: 620,
  singleLoadLengthFt: 720,
  crossDockWidthFt: 1000,
  crossDockLengthFt: 1200,
  maxSlopePct: 8,
  maxStreamCrossings: 2,
  maxInterstateMiles: 3,
  minPopulation30Min: 250000,
  minPopulation45Min: 500000,
  maxUnemploymentPct: 3.5,
  minTechnicalColleges30Min: 1,
  allowIndustrialZoning: true,
  allowIndustrialComprehensivePlan: true,
  allowAdjacentIndustrialYellow: true,
  requireUtilityReview: true,
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
    singleLoadWidthFt: numberOrDefault("singleLoadWidthFt"),
    singleLoadLengthFt: numberOrDefault("singleLoadLengthFt"),
    crossDockWidthFt: numberOrDefault("crossDockWidthFt"),
    crossDockLengthFt: numberOrDefault("crossDockLengthFt"),
    maxSlopePct: numberOrDefault("maxSlopePct"),
    maxStreamCrossings: Math.round(numberOrDefault("maxStreamCrossings")),
    maxInterstateMiles: numberOrDefault("maxInterstateMiles"),
    minPopulation30Min: Math.round(numberOrDefault("minPopulation30Min")),
    minPopulation45Min: Math.round(numberOrDefault("minPopulation45Min")),
    maxUnemploymentPct: numberOrDefault("maxUnemploymentPct"),
    minTechnicalColleges30Min: Math.round(numberOrDefault("minTechnicalColleges30Min")),
    allowIndustrialZoning: source.allowIndustrialZoning !== false,
    allowIndustrialComprehensivePlan: source.allowIndustrialComprehensivePlan !== false,
    allowAdjacentIndustrialYellow: source.allowAdjacentIndustrialYellow !== false,
    requireUtilityReview: source.requireUtilityReview !== false,
    notes: typeof source.notes === "string" ? source.notes.trim() : "",
  };
}
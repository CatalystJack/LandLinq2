export type RuralLandCriteria = {
  yellowMinAcres: number;
};

export const DEFAULT_RURAL_LAND_CRITERIA: RuralLandCriteria = {
  yellowMinAcres: 0,
};

export function normalizeRuralLandCriteria(value: unknown): RuralLandCriteria {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const number = Number(source.yellowMinAcres);
  return {
    yellowMinAcres: Number.isFinite(number) && number >= 0
      ? number
      : DEFAULT_RURAL_LAND_CRITERIA.yellowMinAcres,
  };
}

export function validateRuralLandCriteria(value: unknown): RuralLandCriteria {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (source.yellowMinAcres === undefined || source.yellowMinAcres === null || source.yellowMinAcres === "") {
    throw new Error("Yellow minimum acreage is required");
  }
  const criteria = normalizeRuralLandCriteria(source);
  if (!Number.isFinite(Number(source.yellowMinAcres)) || Number(source.yellowMinAcres) < 0) {
    throw new Error("Yellow minimum acreage must be a non-negative number");
  }
  return criteria;
}

import {
  normalizeNumericStateOverrides,
  resolveStateAwareCriteria,
  type IndustrialCriteriaOverride,
} from "./criteria-overrides";

export type DeveloperAssetClass = "multifamily" | "industrial";

export type IndustrialCriteriaDefaults = {
  minSingleLoadAcres: number;
  minCrossDockAcres: number;
  notes: string;
};

export type IndustrialCriteria = {
  default: IndustrialCriteriaDefaults;
  stateOverrides: Record<string, IndustrialCriteriaOverride>;
};

export const DEFAULT_INDUSTRIAL_CRITERIA: IndustrialCriteria = {
  default: {
    minSingleLoadAcres: 15,
    minCrossDockAcres: 30,
    notes: "",
  },
  stateOverrides: {},
};

export function normalizeIndustrialCriteria(value: unknown, allowedStates?: readonly string[]): IndustrialCriteria {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const nestedDefault = source.default && typeof source.default === "object"
    ? source.default as Partial<IndustrialCriteriaDefaults>
    : {};
  const legacySource = source as Partial<IndustrialCriteriaDefaults>;
  const numberOrDefault = (key: keyof Pick<IndustrialCriteriaDefaults, "minSingleLoadAcres" | "minCrossDockAcres">) => {
    const raw = nestedDefault[key] ?? legacySource[key];
    if (raw === null || raw === undefined) {
      return DEFAULT_INDUSTRIAL_CRITERIA.default[key];
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_INDUSTRIAL_CRITERIA.default[key];
  };

  const rawOverrides = source.stateOverrides;
  const stateOverrides = normalizeNumericStateOverrides(
    rawOverrides,
    ["minSingleLoadAcres", "minCrossDockAcres"],
    allowedStates,
  ) as Record<string, IndustrialCriteriaOverride>;

  return {
    default: {
      minSingleLoadAcres: numberOrDefault("minSingleLoadAcres"),
      minCrossDockAcres: numberOrDefault("minCrossDockAcres"),
      notes: typeof nestedDefault.notes === "string"
        ? nestedDefault.notes.trim()
        : typeof legacySource.notes === "string" ? legacySource.notes.trim() : "",
    },
    stateOverrides,
  };
}

export function validateIndustrialCriteria(criteria: IndustrialCriteria): IndustrialCriteria {
  const normalized = normalizeIndustrialCriteria(criteria);
  if (normalized.default.minCrossDockAcres < normalized.default.minSingleLoadAcres) {
    throw new Error("Cross-dock minimum acreage cannot be lower than single-load minimum acreage");
  }
  for (const [state, override] of Object.entries(normalized.stateOverrides)) {
    const resolved = resolveStateAwareCriteria(normalized.default, { [state]: override }, state);
    if (resolved.minCrossDockAcres < resolved.minSingleLoadAcres) {
      throw new Error(`${state} cross-dock minimum acreage cannot be lower than its single-load minimum acreage`);
    }
  }
  return normalized;
}
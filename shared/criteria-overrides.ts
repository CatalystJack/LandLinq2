import { normalizeUsStateCode } from "./us-states";

export type MultifamilyCriteriaOverride = Partial<{
  minAcres: number;
  maxAcres: number;
  minRentPsf: number;
  minRentPerUnit: number;
}>;

export type IndustrialCriteriaOverride = Partial<{
  minSingleLoadAcres: number;
  minCrossDockAcres: number;
}>;

export type StateOverrideMap<T extends object> = Record<string, Partial<T>>;

export function normalizeStateKey(value: unknown): string {
  return normalizeUsStateCode(value);
}

export function resolveStateAwareCriteria<T extends object>(
  base: T,
  overrides: StateOverrideMap<T> | null | undefined,
  state: unknown,
): T {
  const stateKey = normalizeStateKey(state);
  if (!stateKey || !overrides || typeof overrides !== "object") return { ...base };
  const matchingKey = Object.keys(overrides).find((key) => normalizeStateKey(key) === stateKey);
  const override = matchingKey ? overrides[matchingKey] : undefined;
  return override && typeof override === "object"
    ? { ...base, ...override }
    : { ...base };
}

export function normalizeNumericStateOverrides(
  value: unknown,
  fields: readonly string[],
  allowedStates?: readonly string[],
): Record<string, Record<string, number>> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("State overrides must be an object");
  }

  const allowed = allowedStates?.map(normalizeStateKey).filter(Boolean);
  const allowedSet = allowed ? new Set(allowed) : null;
  const result: Record<string, Record<string, number>> = {};

  for (const [rawState, rawOverride] of Object.entries(value)) {
    const state = normalizeStateKey(rawState);
    if (!state) throw new Error("State override keys cannot be empty");
    if (allowedSet && !allowedSet.has(state)) {
      throw new Error(`State override ${rawState} must be one of the company's target states`);
    }
    if (!rawOverride || typeof rawOverride !== "object" || Array.isArray(rawOverride)) {
      throw new Error(`State override ${rawState} must be an object`);
    }

    const normalized: Record<string, number> = {};
    for (const [field, rawValue] of Object.entries(rawOverride)) {
      if (!fields.includes(field)) {
        throw new Error(`Unsupported state override field: ${field}`);
      }
      if (rawValue === null || rawValue === undefined || rawValue === "") continue;
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${rawState} ${field} must be a non-negative number`);
      }
      normalized[field] = parsed;
    }
    if (Object.keys(normalized).length) result[state] = normalized;
  }

  return result;
}
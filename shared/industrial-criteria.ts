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

export type IndustrialProductTypeCriteria = {
  key: string;
  name: string;
  minAcres: number | null;
  maxAcres: number | null;
  stateOverrides: Record<string, Partial<{ minAcres: number; maxAcres: number }>>;
};

export type IndustrialCriteria = {
  default: IndustrialCriteriaDefaults;
  stateOverrides: Record<string, IndustrialCriteriaOverride>;
  productTypes: IndustrialProductTypeCriteria[];
};

export const DEFAULT_INDUSTRIAL_CRITERIA: IndustrialCriteria = {
  default: {
    minSingleLoadAcres: 15,
    minCrossDockAcres: 30,
    notes: "",
  },
  stateOverrides: {},
  productTypes: [
    {
      key: "single-load",
      name: "Single Load",
      minAcres: 15,
      maxAcres: null,
      stateOverrides: {},
    },
    {
      key: "cross-dock",
      name: "Cross-dock",
      minAcres: 30,
      maxAcres: null,
      stateOverrides: {},
    },
  ],
};

function parseOptionalAcres(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return parsed;
}

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

  const legacyStateOverrides = normalizeNumericStateOverrides(
    source.stateOverrides,
    ["minSingleLoadAcres", "minCrossDockAcres"],
    allowedStates,
  ) as Record<string, IndustrialCriteriaOverride>;
  const legacyStateOverridesFor = (legacyField: "minSingleLoadAcres" | "minCrossDockAcres") =>
    Object.fromEntries(
      Object.entries(legacyStateOverrides)
        .filter(([, override]) => override[legacyField] !== undefined)
        .map(([state, override]) => [state, { minAcres: override[legacyField] as number }]),
    );
  const sourceHasProductTypes = Array.isArray(source.productTypes);
  const rawProductTypes = sourceHasProductTypes
    ? source.productTypes as unknown[]
    : [
        {
          key: "single-load",
          name: "Single Load",
          minAcres: numberOrDefault("minSingleLoadAcres"),
          stateOverrides: legacyStateOverridesFor("minSingleLoadAcres"),
        },
        {
          key: "cross-dock",
          name: "Cross-dock",
          minAcres: numberOrDefault("minCrossDockAcres"),
          stateOverrides: legacyStateOverridesFor("minCrossDockAcres"),
        },
      ];

  const productTypes = rawProductTypes.map((rawType, index): IndustrialProductTypeCriteria => {
    const type = rawType && typeof rawType === "object" && !Array.isArray(rawType)
      ? rawType as Record<string, unknown>
      : {};
    const name = typeof type.name === "string" ? type.name.trim() : "";
    const key = typeof type.key === "string" && type.key.trim()
      ? type.key.trim()
      : `industrial-product-${index + 1}`;
    const minAcres = parseOptionalAcres(type.minAcres, `${name || `Product type ${index + 1}`} minimum acreage`);
    const maxAcres = parseOptionalAcres(type.maxAcres, `${name || `Product type ${index + 1}`} maximum acreage`);
    const typeStateOverrides = normalizeNumericStateOverrides(
      type.stateOverrides,
      ["minAcres", "maxAcres"],
      allowedStates,
    ) as Record<string, Partial<{ minAcres: number; maxAcres: number }>>;

    return { key, name, minAcres, maxAcres, stateOverrides: typeStateOverrides };
  });

  const singleLoad = productTypes.find((type) => type.key === "single-load") || productTypes[0];
  const crossDock = productTypes.find((type) => type.key === "cross-dock") || productTypes[1] || singleLoad;
  const stateOverrides: Record<string, IndustrialCriteriaOverride> = { ...legacyStateOverrides };
  for (const state of new Set([
    ...Object.keys(singleLoad?.stateOverrides || {}),
    ...Object.keys(crossDock?.stateOverrides || {}),
  ])) {
    stateOverrides[state] = {
      ...(stateOverrides[state] || {}),
      ...(singleLoad?.stateOverrides[state]?.minAcres !== undefined
        ? { minSingleLoadAcres: singleLoad.stateOverrides[state].minAcres }
        : {}),
      ...(crossDock?.stateOverrides[state]?.minAcres !== undefined
        ? { minCrossDockAcres: crossDock.stateOverrides[state].minAcres }
        : {}),
    };
  }

  return {
    default: {
      minSingleLoadAcres: singleLoad?.minAcres ?? numberOrDefault("minSingleLoadAcres"),
      minCrossDockAcres: crossDock?.minAcres ?? numberOrDefault("minCrossDockAcres"),
      notes: typeof nestedDefault.notes === "string"
        ? nestedDefault.notes.trim()
        : typeof legacySource.notes === "string" ? legacySource.notes.trim() : "",
    },
    stateOverrides: sourceHasProductTypes ? stateOverrides : legacyStateOverrides,
    productTypes,
  };
}

export function validateIndustrialCriteria(criteria: IndustrialCriteria): IndustrialCriteria {
  const normalized = normalizeIndustrialCriteria(criteria);
  if (normalized.productTypes.length === 0) {
    throw new Error("Add at least one industrial product type");
  }
  const names = new Set<string>();
  for (const productType of normalized.productTypes) {
    const normalizedName = productType.name.trim().toLowerCase();
    if (!normalizedName) throw new Error("Every industrial product type needs a name");
    if (names.has(normalizedName)) throw new Error(`Industrial product type ${productType.name} is duplicated`);
    names.add(normalizedName);
    if (productType.minAcres === null) {
      throw new Error(`${productType.name} minimum acreage is required`);
    }
    if (productType.maxAcres !== null && productType.maxAcres < productType.minAcres) {
      throw new Error(`${productType.name} maximum acreage cannot be lower than its minimum`);
    }
    for (const [state, override] of Object.entries(productType.stateOverrides)) {
      const resolved = resolveStateAwareCriteria(
        { minAcres: productType.minAcres, maxAcres: productType.maxAcres },
        { [state]: override },
        state,
      );
      if (resolved.maxAcres !== null && resolved.maxAcres !== undefined && resolved.maxAcres < resolved.minAcres) {
        throw new Error(`${state} ${productType.name} maximum acreage cannot be lower than its minimum`);
      }
    }
  }

  const singleLoad = normalized.productTypes.find((type) => type.key === "single-load");
  const crossDock = normalized.productTypes.find((type) => type.key === "cross-dock");
  if (singleLoad && crossDock && crossDock.minAcres! < singleLoad.minAcres!) {
    throw new Error("Cross-dock minimum acreage cannot be lower than single-load minimum acreage");
  }
  if (singleLoad && crossDock) {
    for (const state of new Set([
      ...Object.keys(singleLoad.stateOverrides),
      ...Object.keys(crossDock.stateOverrides),
    ])) {
      const singleMinimum = singleLoad.stateOverrides[state]?.minAcres ?? singleLoad.minAcres!;
      const crossMinimum = crossDock.stateOverrides[state]?.minAcres ?? crossDock.minAcres!;
      if (crossMinimum < singleMinimum) {
        throw new Error(`${state} cross-dock minimum acreage cannot be lower than single-load minimum acreage`);
      }
    }
  }
  return normalized;
}
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  deals,
  developerProductTypes,
  partnerDeveloperSends,
} from "@shared/schema";
import { isAutomaticallyCoastal } from "@shared/coastal-counties";

export const PRESET_VERSION = "v22-other-income";

export type UnitMixRow = {
  pct: number;
  avgSF: number;
  monthlyRent: number;
};

export type YocPreset = {
  label: string;
  dua: number;
  hardCostPU: number;
  assumedLandCostPU: number;
  assumedLandCostPU_coastal: number;
  softCostPct: number;
  otherIncomePUM: number;
  fixedOpExPU: number;
  insurancePU_nc: number;
  insurancePU_coastal: number;
  vacancyPct: number;
  ltlPct: number;
  concessionPct: number;
  badDebtPct: number;
  mgmtFeePct: number;
  unitMix: UnitMixRow[];
};

// Keep this table in the server service as the canonical national fallback.
// The values are intentionally the same as the former analyst-dashboard model.
export const PRODUCT_TYPE_YOC_PRESETS: Record<string, YocPreset> = {
  "3-story-surface-park": {
    label: "3-Story SP",
    dua: 30,
    hardCostPU: 164000,
    assumedLandCostPU: 25000,
    assumedLandCostPU_coastal: 35000,
    softCostPct: 0.15,
    otherIncomePUM: 198,
    fixedOpExPU: 6101,
    insurancePU_nc: 550,
    insurancePU_coastal: 700,
    vacancyPct: 0.05,
    ltlPct: 0.01,
    concessionPct: 0.01,
    badDebtPct: 0,
    mgmtFeePct: 0.0275,
    unitMix: [
      { pct: 0.6, avgSF: 800, monthlyRent: 1600 },
      { pct: 0.4, avgSF: 1050, monthlyRent: 2200 },
    ],
  },
  "3-story-attainable": {
    label: "3-Story Att.",
    dua: 30,
    hardCostPU: 137000,
    assumedLandCostPU: 10000,
    assumedLandCostPU_coastal: 15000,
    softCostPct: 0.15,
    otherIncomePUM: 198,
    fixedOpExPU: 6101,
    insurancePU_nc: 550,
    insurancePU_coastal: 700,
    vacancyPct: 0.05,
    ltlPct: 0.01,
    concessionPct: 0.01,
    badDebtPct: 0,
    mgmtFeePct: 0.0275,
    unitMix: [
      { pct: 0.6, avgSF: 800, monthlyRent: 1400 },
      { pct: 0.4, avgSF: 1050, monthlyRent: 1900 },
    ],
  },
  "4-story-surface-park": {
    label: "4-Story SP",
    dua: 35,
    hardCostPU: 158000,
    assumedLandCostPU: 30000,
    assumedLandCostPU_coastal: 45000,
    softCostPct: 0.15,
    otherIncomePUM: 198,
    fixedOpExPU: 6101,
    insurancePU_nc: 600,
    insurancePU_coastal: 800,
    vacancyPct: 0.05,
    ltlPct: 0.01,
    concessionPct: 0.01,
    badDebtPct: 0,
    mgmtFeePct: 0.0275,
    unitMix: [
      { pct: 0.6, avgSF: 800, monthlyRent: 1650 },
      { pct: 0.4, avgSF: 1050, monthlyRent: 2300 },
    ],
  },
  "aa-3-story-flats": {
    label: "AA 3-Story",
    dua: 30,
    hardCostPU: 167200,
    assumedLandCostPU: 30000,
    assumedLandCostPU_coastal: 40000,
    softCostPct: 0.15,
    otherIncomePUM: 207,
    fixedOpExPU: 9500,
    insurancePU_nc: 575,
    insurancePU_coastal: 750,
    vacancyPct: 0.05,
    ltlPct: 0.01,
    concessionPct: 0.01,
    badDebtPct: 0,
    mgmtFeePct: 0.0275,
    unitMix: [
      { pct: 0.6, avgSF: 800, monthlyRent: 1750 },
      { pct: 0.4, avgSF: 1100, monthlyRent: 2200 },
    ],
  },
  "aa-4-story-flats": {
    label: "AA 4-Story",
    dua: 35,
    hardCostPU: 185500,
    assumedLandCostPU: 30000,
    assumedLandCostPU_coastal: 45000,
    softCostPct: 0.15,
    otherIncomePUM: 207,
    fixedOpExPU: 9500,
    insurancePU_nc: 625,
    insurancePU_coastal: 825,
    vacancyPct: 0.05,
    ltlPct: 0.01,
    concessionPct: 0.01,
    badDebtPct: 0,
    mgmtFeePct: 0.0275,
    unitMix: [
      { pct: 0.6, avgSF: 800, monthlyRent: 1750 },
      { pct: 0.4, avgSF: 1100, monthlyRent: 2200 },
    ],
  },
  "aa-cottages": {
    label: "AA Cottages",
    dua: 6,
    hardCostPU: 252500,
    assumedLandCostPU: 30000,
    assumedLandCostPU_coastal: 40000,
    softCostPct: 0.15,
    otherIncomePUM: 235,
    fixedOpExPU: 9500,
    insurancePU_nc: 750,
    insurancePU_coastal: 900,
    vacancyPct: 0.05,
    ltlPct: 0.01,
    concessionPct: 0.01,
    badDebtPct: 0,
    mgmtFeePct: 0.0275,
    unitMix: [
      { pct: 0.25, avgSF: 1200, monthlyRent: 2100 },
      { pct: 0.75, avgSF: 1400, monthlyRent: 2900 },
    ],
  },
  "btr-3-story-th": {
    label: "BTR TH",
    dua: 8,
    hardCostPU: 254000,
    assumedLandCostPU: 50000,
    assumedLandCostPU_coastal: 55000,
    softCostPct: 0.15,
    otherIncomePUM: 251,
    fixedOpExPU: 7014,
    insurancePU_nc: 750,
    insurancePU_coastal: 900,
    vacancyPct: 0.05,
    ltlPct: 0.01,
    concessionPct: 0.01,
    badDebtPct: 0,
    mgmtFeePct: 0.0275,
    unitMix: [
      { pct: 0.65, avgSF: 1659, monthlyRent: 2500 },
      { pct: 0.35, avgSF: 1996, monthlyRent: 2700 },
    ],
  },
  "btr-sfr-detached": {
    label: "BTR SFR",
    dua: 8,
    hardCostPU: 258000,
    assumedLandCostPU: 50000,
    assumedLandCostPU_coastal: 55000,
    softCostPct: 0.15,
    otherIncomePUM: 247,
    fixedOpExPU: 7014,
    insurancePU_nc: 800,
    insurancePU_coastal: 950,
    vacancyPct: 0.05,
    ltlPct: 0.01,
    concessionPct: 0.01,
    badDebtPct: 0,
    mgmtFeePct: 0.0275,
    unitMix: [
      { pct: 0.3, avgSF: 2020, monthlyRent: 2750 },
      { pct: 0.7, avgSF: 2600, monthlyRent: 3000 },
    ],
  },
  "btr-th-2-3br": {
    label: "BTR TH 2-3BR",
    dua: 10,
    hardCostPU: 230000,
    assumedLandCostPU: 50000,
    assumedLandCostPU_coastal: 55000,
    softCostPct: 0.15,
    otherIncomePUM: 251,
    fixedOpExPU: 7014,
    insurancePU_nc: 750,
    insurancePU_coastal: 900,
    vacancyPct: 0.05,
    ltlPct: 0.01,
    concessionPct: 0.01,
    badDebtPct: 0,
    mgmtFeePct: 0.0275,
    unitMix: [
      { pct: 0.6, avgSF: 1290, monthlyRent: 1850 },
      { pct: 0.4, avgSF: 1495, monthlyRent: 2200 },
    ],
  },
};

const RE_TAX_ADJUSTMENT_BY_STATE: Record<string, number> = { TN: 495 };
const RENT_MULT_BY_STATE: Record<string, number> = {
  NC: 0.82, GA: 0.9, TN: 1, FL: 1, SC: 1, VA: 0.95,
};
const RENT_MULT_DEFAULT = 0.95;
const LAND_COST_MULT_BY_STATE: Record<string, number> = {
  NC: 2.5, TN: 1.25, VA: 1.2, GA: 1.1, FL: 1, SC: 1,
};
const LAND_COST_MULT_DEFAULT = 1;
const NC_RESEARCH_TRIANGLE_CITIES = new Set([
  "RALEIGH", "DURHAM", "CHAPEL HILL", "CARY", "APEX", "WAKE FOREST",
  "MORRISVILLE", "FUQUAY-VARINA", "FUQUAY VARINA", "HOLLY SPRINGS",
  "GARNER", "PITTSBORO", "CARRBORO", "HILLSBOROUGH", "KNIGHTDALE",
  "WENDELL", "ZEBULON", "ANGIER", "MEBANE", "ROLESVILLE", "CLAYTON",
]);
const NC_CHARLOTTE_MSA_CITIES = new Set([
  "CHARLOTTE", "HUNTERSVILLE", "CORNELIUS", "DAVIDSON", "MOORESVILLE",
  "INDIAN TRAIL", "MATTHEWS", "MINT HILL", "MONROE", "WAXHAW",
  "STALLINGS", "PINEVILLE", "HARRISBURG", "MIDLAND", "BELMONT", "GASTONIA",
]);

const TARGET_TYPE_TO_PRESET_FALLBACK: Record<string, string[]> = {
  "Conventional Apartments": ["3-story-surface-park"],
  Conventional: ["3-story-surface-park"],
  "Active Adult": ["aa-3-story-flats"],
  "Active Adult Flats": ["aa-3-story-flats"],
  "Active Adult Cottages": ["aa-cottages"],
  "Student Housing": ["3-story-surface-park"],
  "Affordable Housing": ["3-story-attainable"],
  Attainable: ["3-story-attainable"],
  BTR: ["btr-3-story-th"],
  "Build-to-Rent": ["btr-3-story-th"],
  "BTR Townhome": ["btr-3-story-th"],
  "BTR TH": ["btr-3-story-th"],
  "BTR SFR": ["btr-sfr-detached"],
  "BTR SFR Detached": ["btr-sfr-detached"],
};

export type YocBreakdownType = {
  presetKey: string;
  presetLabel: string;
  dua: number;
  totalUnits: number;
  hardCostPU: number;
  softCostPct: number;
  fixedOpExPU: number;
  insurancePU: number;
  otherIncomePUM: number;
  reTaxAdjPU: number;
  blendedRent: number;
  autoBlendedRent: number;
  rentSource: string;
  rentMode: "hellodata-psf" | "hellodata-avgrent" | "preset";
  hellodataRentPSF: number | null;
  topCompAvgRent: number | null;
  weightedAvgSF: number;
  presetBlendedRent: number;
  rentHaircut: number;
  rentStateMult: number;
  gpr: number;
  otherIncome: number;
  totalGross: number;
  vacancyLoss: number;
  creditLoss: number;
  egi: number;
  mgmtFee: number;
  fixedOpEx: number;
  insurance: number;
  reTaxAdj: number;
  totalOpEx: number;
  noi: number;
  landCost: number;
  landCostPU: number;
  landStateMult: number;
  hasActualLandCost: boolean;
  hardCostTotal: number;
  softCostTotal: number;
  tdc: number;
  yoc: number;
};

export type YocBreakdown = {
  types: YocBreakdownType[];
  compsUsed: {
    name: string;
    avgRent: number | null;
    rentPSF: number | null;
    isQualifying: boolean;
    isTop: boolean;
  }[];
  state: string;
  city: string;
  isCoastal: boolean;
  rentStateMult: number;
  landStateMult: number;
} | null;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOverrides(raw: unknown): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => [key, toNumber(value)] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] !== null),
    );
  } catch {
    return {};
  }
}

function getOverride(
  overrides: Record<string, number>,
  dealId: string | undefined,
  field: string,
  fallback: number,
): number {
  const value = dealId ? overrides[`${dealId}.${field}`] : undefined;
  return value === undefined ? (overrides[field] ?? fallback) : value;
}

function normalizeUnitMix(value: unknown, fallback: UnitMixRow[]): UnitMixRow[] {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const rows = value
    .map((row: any) => ({
      pct: toNumber(row?.pct),
      avgSF: toNumber(row?.avgSF),
      monthlyRent: toNumber(row?.monthlyRent),
    }))
    .filter((row): row is UnitMixRow => (
      row.pct !== null && row.avgSF !== null && row.monthlyRent !== null &&
      row.pct >= 0 && row.avgSF > 0 && row.monthlyRent >= 0
    ));
  return rows.length > 0 ? rows : fallback;
}

export function mergeYocPreset(base: YocPreset, row: any | undefined): YocPreset {
  if (!row) return base;
  return {
    ...base,
    dua: toNumber(row.dua) ?? base.dua,
    hardCostPU: toNumber(row.hardCostPu) ?? base.hardCostPU,
    assumedLandCostPU: toNumber(row.assumedLandCostPu) ?? base.assumedLandCostPU,
    assumedLandCostPU_coastal: toNumber(row.assumedLandCostPuCoastal) ?? base.assumedLandCostPU_coastal,
    softCostPct: toNumber(row.softCostPct) ?? base.softCostPct,
    otherIncomePUM: toNumber(row.otherIncomePum) ?? base.otherIncomePUM,
    fixedOpExPU: toNumber(row.fixedOpExPu) ?? base.fixedOpExPU,
    insurancePU_nc: toNumber(row.insurancePuNc) ?? base.insurancePU_nc,
    insurancePU_coastal: toNumber(row.insurancePuCoastal) ?? base.insurancePU_coastal,
    vacancyPct: toNumber(row.vacancyPct) ?? base.vacancyPct,
    ltlPct: toNumber(row.ltlPct) ?? base.ltlPct,
    concessionPct: toNumber(row.concessionPct) ?? base.concessionPct,
    badDebtPct: toNumber(row.badDebtPct) ?? base.badDebtPct,
    mgmtFeePct: toNumber(row.mgmtFeePct) ?? base.mgmtFeePct,
    unitMix: normalizeUnitMix(row.unitMix, base.unitMix),
  };
}

export function resolveProductTypeKeys(
  productTypes: string[] = [],
  targetProductTypes: string[] = [],
): string[] {
  const direct = productTypes.filter((type) => PRODUCT_TYPE_YOC_PRESETS[type]);
  if (direct.length > 0) return direct;
  return targetProductTypes.flatMap((type) => TARGET_TYPE_TO_PRESET_FALLBACK[type] || []);
}

async function getEffectivePresets(
  typeKeys: string[],
  developerProfileId?: string,
  presetOverrides?: Record<string, YocPreset>,
): Promise<Record<string, YocPreset>> {
  if (!developerProfileId || typeKeys.length === 0) {
    return Object.fromEntries(typeKeys.map((key) => [
      key,
      presetOverrides?.[key] || PRODUCT_TYPE_YOC_PRESETS[key],
    ]));
  }
  const rows = await db.select().from(developerProductTypes).where(and(
    eq(developerProductTypes.developerProfileId, developerProfileId),
    eq(developerProductTypes.isActive, true),
  ));
  const byName = new Map(rows.map((row) => [row.name.trim().toLowerCase(), row]));
  return Object.fromEntries(typeKeys.map((key) => {
    const preset = PRODUCT_TYPE_YOC_PRESETS[key];
    const row = byName.get(key.toLowerCase()) || byName.get(preset.label.toLowerCase());
    return [key, mergeYocPreset(presetOverrides?.[key] || preset, row)];
  }));
}

function extractHellodataRentPSF(comparablesJson: any[]): number | null {
  if (!Array.isArray(comparablesJson) || comparablesJson.length === 0) return null;
  const qualifying = comparablesJson.filter((c) => c?.isQualifying && (c.rentPSF > 0 || c.avgRent > 0));
  const source = qualifying.length > 0 ? qualifying : comparablesJson.filter((c) => c?.rentPSF > 0 || c?.avgRent > 0);
  const psfs = source.map((c) => {
    if (c.rentPSF > 0) return Number(c.rentPSF);
    if (c.avgRent > 0 && c.avgSF > 0) return Number(c.avgRent) / Number(c.avgSF);
    return null;
  }).filter((value): value is number => value !== null && value > 0);
  return psfs.length > 0 ? Math.max(...psfs) : null;
}

function extractTopCompAvgRent(comparablesJson: any[]): number | null {
  if (!Array.isArray(comparablesJson) || comparablesJson.length === 0) return null;
  const qualifying = comparablesJson.filter((c) => c?.isQualifying && c.avgRent > 0);
  const source = qualifying.length > 0 ? qualifying : comparablesJson.filter((c) => c?.avgRent > 0);
  const rents = source.map((c) => Number(c.avgRent)).filter((value) => value > 0);
  return rents.length > 0 ? Math.max(...rents) : null;
}

export async function calculateYOCBreakdown(
  deal: any,
  developerProfileId?: string,
  presetOverrides?: Record<string, YocPreset>,
): Promise<YocBreakdown> {
  const productTypes = Array.isArray(deal.productTypes) ? deal.productTypes : [];
  const targetProductTypes = Array.isArray(deal.targetProductTypes) ? deal.targetProductTypes : [];
  const typeKeys = resolveProductTypeKeys(productTypes, targetProductTypes);
  if (typeKeys.length === 0) return null;

  const state = String(deal.state || "");
  const stateKey = state.toUpperCase();
  const city = String(deal.city || "");
  const cityKey = city.toUpperCase().trim();
  const isCoastal = deal.manualIsCoastal ?? isAutomaticallyCoastal(stateKey, deal.county);
  const reTaxAdjPU = RE_TAX_ADJUSTMENT_BY_STATE[stateKey] ?? 0;
  let rentStateMult = RENT_MULT_BY_STATE[stateKey] ?? RENT_MULT_DEFAULT;
  let landStateMult = LAND_COST_MULT_BY_STATE[stateKey] ?? LAND_COST_MULT_DEFAULT;

  if (stateKey === "NC") {
    if (NC_RESEARCH_TRIANGLE_CITIES.has(cityKey)) {
      rentStateMult = 0.93;
      landStateMult = 1.4;
    } else if (NC_CHARLOTTE_MSA_CITIES.has(cityKey)) {
      rentStateMult = 0.9;
      landStateMult = 1.65;
    }
  }

  const sizeAcres = toNumber(deal.sizeAcres) ?? 0;
  const dealUnitCount = Number.parseInt(
    String(deal.unitCount ?? deal.estimatedUnits ?? "0"),
    10,
  ) || 0;
  const comparablesJson = Array.isArray(deal.comparablesJson) ? deal.comparablesJson : [];
  const fallbackRentPsf = toNumber(deal.avgRentPsf) ?? toNumber(deal.topRentPsf);
  const hellodataRentPSF = extractHellodataRentPSF(comparablesJson) ??
    (fallbackRentPsf && fallbackRentPsf > 0 ? fallbackRentPsf : null);
  const topCompAvgRent = extractTopCompAvgRent(comparablesJson);
  const landCost = toNumber(deal.askingPrice) ?? 0;
  const hasActualLandCost = landCost > 0;
  const singleType = typeKeys.length === 1;
  const overrides = parseOverrides(deal.yocOverrides);
  const useActualUnits = singleType && dealUnitCount > 0;
  if ((!sizeAcres || sizeAcres <= 0) && !useActualUnits) return null;

  const presets = await getEffectivePresets(typeKeys, developerProfileId, presetOverrides);
  const types = typeKeys.map((typeKey) => {
    const preset = presets[typeKey];
    const totalUnits = getOverride(
      overrides,
      deal.id,
      "unitCount",
      useActualUnits ? dealUnitCount : sizeAcres * preset.dua,
    );
    const isBTR = typeKey === "btr-sfr-detached" || typeKey === "btr-3-story-th" || typeKey === "btr-th-2-3br";
    const isAA = typeKey === "aa-3-story-flats" || typeKey === "aa-4-story-flats" || typeKey === "aa-cottages";
    const presetBlendedRent = preset.unitMix.reduce((sum, row) => sum + row.pct * row.monthlyRent, 0);
    const weightedAvgSF = preset.unitMix.reduce((sum, row) => sum + row.pct * row.avgSF, 0);
    const effectiveRentMult = (isBTR || isAA) ? 1 : rentStateMult;
    let autoBlendedRent: number;
    let rentSource: string;
    let rentMode: YocBreakdownType["rentMode"];

    if (!isBTR && !isAA && hellodataRentPSF && hellodataRentPSF > 0) {
      autoBlendedRent = hellodataRentPSF * weightedAvgSF + 50;
      rentSource = `$${hellodataRentPSF.toFixed(2)}/SF${comparablesJson.length > 0 ? "+$50NC" : " (avg_rent_psf field)"}`;
      rentMode = "hellodata-psf";
    } else if (isBTR && topCompAvgRent && topCompAvgRent > 0) {
      autoBlendedRent = topCompAvgRent + 200;
      rentSource = `$${Math.round(topCompAvgRent).toLocaleString()}avg+$200BTR`;
      rentMode = "hellodata-avgrent";
    } else {
      autoBlendedRent = presetBlendedRent * 0.9 * effectiveRentMult;
      rentSource = `$${Math.round(presetBlendedRent).toLocaleString()} preset × 0.9 haircut × ${effectiveRentMult.toFixed(2)} state`;
      rentMode = "preset";
    }

    const blendedRent = getOverride(overrides, deal.id, `${typeKey}.blendedRent`, autoBlendedRent);
    const hardCostPU = getOverride(overrides, deal.id, `${typeKey}.hardCostPU`, preset.hardCostPU);
    const softCostPct = getOverride(overrides, deal.id, `${typeKey}.softCostPct`, preset.softCostPct * 100) / 100;
    const fixedOpExPU = getOverride(overrides, deal.id, `${typeKey}.fixedOpExPU`, preset.fixedOpExPU);
    const defaultInsurance = isCoastal ? preset.insurancePU_coastal : preset.insurancePU_nc;
    const insurancePU = getOverride(overrides, deal.id, `${typeKey}.insurancePU`, defaultInsurance);
    const otherIncomePUM = getOverride(overrides, deal.id, `${typeKey}.otherIncomePUM`, preset.otherIncomePUM);
    const vacancyPct = getOverride(overrides, deal.id, `${typeKey}.vacancyPct`, preset.vacancyPct);
    const ltlPct = getOverride(overrides, deal.id, `${typeKey}.ltlPct`, preset.ltlPct);
    const concessionPct = getOverride(overrides, deal.id, `${typeKey}.concessionPct`, preset.concessionPct);
    const badDebtPct = getOverride(overrides, deal.id, `${typeKey}.badDebtPct`, preset.badDebtPct);
    const mgmtFeePct = getOverride(overrides, deal.id, `${typeKey}.mgmtFeePct`, preset.mgmtFeePct);
    const landCostPU = isCoastal ? preset.assumedLandCostPU_coastal : preset.assumedLandCostPU;
    const overrideLandCost = getOverride(overrides, deal.id, "landCost", landCost);
    const effectiveHasActualLandCost = overrideLandCost > 0;
    const effectiveLandCost = effectiveHasActualLandCost
      ? overrideLandCost
      : totalUnits * landCostPU * landStateMult;
    const gpr = totalUnits * blendedRent * 12;
    const otherIncome = totalUnits * otherIncomePUM * 12;
    const totalGross = gpr + otherIncome;
    const vacancyLoss = totalGross * vacancyPct;
    const creditLoss = gpr * (ltlPct + concessionPct + badDebtPct);
    const egi = totalGross - vacancyLoss - creditLoss;
    const mgmtFee = egi * mgmtFeePct;
    const fixedOpEx = totalUnits * fixedOpExPU;
    const insurance = totalUnits * insurancePU;
    const reTaxAdj = totalUnits * reTaxAdjPU;
    const totalOpEx = mgmtFee + fixedOpEx + insurance + reTaxAdj;
    const noi = egi - totalOpEx;
    const hardCostTotal = totalUnits * hardCostPU;
    const softCostTotal = hardCostTotal * softCostPct;
    const tdc = effectiveLandCost + hardCostTotal + softCostTotal;
    const yoc = (noi / tdc) * 100;

    return {
      presetKey: typeKey,
      presetLabel: preset.label,
      dua: preset.dua,
      totalUnits,
      hardCostPU,
      softCostPct,
      fixedOpExPU,
      insurancePU,
      otherIncomePUM,
      reTaxAdjPU,
      blendedRent,
      autoBlendedRent,
      rentSource,
      rentMode,
      hellodataRentPSF,
      topCompAvgRent,
      weightedAvgSF,
      presetBlendedRent,
      rentHaircut: 0.9,
      rentStateMult: effectiveRentMult,
      gpr,
      otherIncome,
      totalGross,
      vacancyLoss,
      creditLoss,
      egi,
      mgmtFee,
      fixedOpEx,
      insurance,
      reTaxAdj,
      totalOpEx,
      noi,
      landCost: effectiveLandCost,
      landCostPU,
      landStateMult: effectiveHasActualLandCost ? 1 : landStateMult,
      hasActualLandCost: effectiveHasActualLandCost,
      hardCostTotal,
      softCostTotal,
      tdc,
      yoc,
    };
  }).filter((type) => Number.isFinite(type.yoc));

  if (types.length === 0) return null;
  const compsUsed = comparablesJson
    .filter((c: any) => c?.avgRent > 0 || c?.rentPSF > 0)
    .slice(0, 8)
    .map((c: any) => {
      const psf = c.rentPSF || (c.avgRent && c.avgSF ? c.avgRent / c.avgSF : null);
      return {
        name: c.propertyName || c.name || c.address || "Comp",
        avgRent: c.avgRent || null,
        rentPSF: psf || null,
        isQualifying: !!c.isQualifying,
        isTop: (hellodataRentPSF != null && psf != null && Math.abs(psf - hellodataRentPSF) < 0.005) ||
          (topCompAvgRent != null && c.avgRent != null && Math.abs(c.avgRent - topCompAvgRent) < 1),
      };
    });
  return { types, compsUsed, state, city, isCoastal, rentStateMult, landStateMult };
}

export async function calculateYOCForProductTypes(
  productTypes: string[],
  landCost: number,
  sizeAcres: number,
  comparablesJson: any[] = [],
  targetProductTypes: string[] = [],
  dealUnitCount?: number,
  state?: string,
  city?: string,
  fallbackRentPsf?: number | null,
  developerProfileId?: string,
  yocOverrides?: string | Record<string, number>,
): Promise<string | null> {
  const breakdown = await calculateYOCBreakdown({
    productTypes,
    targetProductTypes,
    askingPrice: landCost,
    sizeAcres,
    unitCount: dealUnitCount,
    state,
    city,
    comparablesJson,
    avgRentPsf: fallbackRentPsf,
    yocOverrides,
  }, developerProfileId);
  if (!breakdown) return null;
  const hasActualLandCost = (toNumber(landCost) ?? 0) > 0;
  const parts = breakdown.types.map((type) => {
    const yocLabel = hasActualLandCost ? type.yoc.toFixed(1) : `~${type.yoc.toFixed(1)}`;
    return `${type.presetLabel}: ${yocLabel}% (${type.rentMode === "preset" ? "preset" : type.rentSource})`;
  });
  if (parts.length > 1) {
    const best = Math.max(...breakdown.types.map((type) => type.yoc));
    parts.unshift(`BEST: ${hasActualLandCost ? best.toFixed(1) : `~${best.toFixed(1)}`}%`);
  }
  return parts.join(" | ");
}

async function getDeveloperProfileIdsForDeal(dealId: string): Promise<string[]> {
  const rows = await db.select({ developerProfileId: partnerDeveloperSends.developerProfileId })
    .from(partnerDeveloperSends)
    .where(eq(partnerDeveloperSends.dealId, dealId));
  return Array.from(new Set(
    rows.map((row) => row.developerProfileId).filter((id): id is string => Boolean(id)),
  ));
}

export async function recomputeDealYoc(
  dealId: string,
  developerProfileId?: string,
): Promise<any | undefined> {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) return undefined;
  const profileId = developerProfileId || (await getDeveloperProfileIdsForDeal(dealId))[0];
  const breakdown = await calculateYOCBreakdown(deal, profileId);
  if (!breakdown) {
    const [updated] = await db.update(deals).set({
      automatedYoc: null,
      updatedAt: new Date(),
    }).where(eq(deals.id, dealId)).returning();
    return updated;
  }

  const best = breakdown.types.reduce((winner, current) => current.yoc > winner.yoc ? current : winner);
  const hasActualLandCost = best.hasActualLandCost;
  const yocLabel = hasActualLandCost ? best.yoc.toFixed(1) : `~${best.yoc.toFixed(1)}`;
  const automatedYoc = breakdown.types.length > 1
    ? `BEST: ${yocLabel}% | ${breakdown.types.map((type) => `${type.presetLabel}: ${hasActualLandCost ? type.yoc.toFixed(1) : `~${type.yoc.toFixed(1)}`}% (${type.rentMode === "preset" ? "preset" : type.rentSource})`).join(" | ")}`
    : `${best.presetLabel}: ${yocLabel}% (${best.rentMode === "preset" ? "preset" : best.rentSource})`;
  const [updated] = await db.update(deals).set({
    automatedYoc,
    projectedNOI: best.noi.toFixed(2),
    totalProjectCost: best.tdc.toFixed(2),
    projectedGPR: best.gpr.toFixed(2),
    projectedEGI: best.egi.toFixed(2),
    projectedOpex: best.totalOpEx.toFixed(2),
    projectedHardCost: best.hardCostTotal.toFixed(2),
    projectedSoftCost: best.softCostTotal.toFixed(2),
    projectedVacancyLoss: best.vacancyLoss.toFixed(2),
    projectedRentPerUnit: best.blendedRent.toFixed(2),
    updatedAt: new Date(),
  }).where(eq(deals.id, dealId)).returning();
  return updated;
}

export async function recomputeDealsForDeveloperProfile(developerProfileId: string): Promise<number> {
  const rows = await db.select({ dealId: partnerDeveloperSends.dealId })
    .from(partnerDeveloperSends)
    .where(eq(partnerDeveloperSends.developerProfileId, developerProfileId));
  const dealIds = Array.from(new Set(rows.map((row) => row.dealId)));
  for (const dealId of dealIds) {
    await recomputeDealYoc(dealId, developerProfileId);
  }
  return dealIds.length;
}
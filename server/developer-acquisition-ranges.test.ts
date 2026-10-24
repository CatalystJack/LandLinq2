import test from "node:test";
import assert from "node:assert/strict";
import { classifyDealForProfile } from "./developerClassificationService";
import { developerAcquisitionRangesSchema } from "../shared/schema";

const profile: any = {
  profileType: "real_estate",
  assetClass: "multifamily",
  rentMetric: "psf",
  targetStates: ["NC"],
  targetCounties: [],
  purchaseCriteria: {
    land: { minAcres: null, maxAcres: null, minUnits: null, maxUnits: null },
    existing: { minVintageYear: null, maxVintageYear: null, minUnits: null, maxUnits: null },
  },
  minCapRate: "5",
  maxCapRate: "8",
  minPrice: "1000000",
  maxPrice: "3000000",
  minUnitCount: 50,
  maxUnitCount: 200,
  minYearBuilt: 1980,
  maxYearBuilt: 2020,
};
const productTypes: any[] = [{ name: "Test Multifamily", isActive: true, minAcres: "0", minRentPsf: "1" }];
const deal: any = {
  state: "NC", sizeAcres: "1", topRentPSF: "2", askingPrice: "2000000",
  capRate: "6.5", unitCount: 100, vintage: 2000,
};

test("all configured acquisition ranges report pass with deal values", () => {
  const result = classifyDealForProfile(deal, profile, productTypes);
  assert.equal(result.classification, "review");
  assert.equal(result.matchedProductTypes.filter((item) => item.includes("Screening:")).length, 4);
  assert.ok(result.matchedProductTypes.every((item) => !item.includes(" FAIL |")));
});

test("an out-of-range value fails without being confused with missing data", () => {
  const result = classifyDealForProfile({ ...deal, askingPrice: 4000000 }, profile, productTypes);
  assert.equal(result.classification, "passed");
  assert.ok(result.matchedProductTypes.some((item) => item.includes("Price FAIL")));
  assert.ok(result.matchedProductTypes.some((item) => item.includes("Cap rate PASS")));
});

test("missing data is unknown and does not reject an otherwise qualifying deal", () => {
  const result = classifyDealForProfile({ ...deal, capRate: null }, profile, productTypes);
  assert.equal(result.classification, "review");
  assert.ok(result.matchedProductTypes.some((item) => item.includes("Cap rate UNKNOWN")));
});

test("unset ranges preserve existing classification and min-only ranges are open ended", () => {
  const noRanges = { ...profile, minCapRate: null, maxCapRate: null, minPrice: null, maxPrice: null,
    minUnitCount: null, maxUnitCount: null, minYearBuilt: null, maxYearBuilt: null };
  const existing = classifyDealForProfile(deal, noRanges, productTypes);
  const configured = classifyDealForProfile({ ...deal, askingPrice: 2000000 },
    { ...noRanges, minPrice: "1000000" }, productTypes);
  assert.equal(existing.classification, configured.classification);
  assert.ok(configured.matchedProductTypes.some((item) => item.includes("range ≥ $1,000,000")));
});

test("range schema rejects reversed bounds and accepts one-sided limits", () => {
  const parsed = developerAcquisitionRangesSchema.safeParse({
    minCapRate: 8, maxCapRate: 5, minPrice: null, maxPrice: null,
    minUnitCount: null, maxUnitCount: null, minYearBuilt: null, maxYearBuilt: null,
  });
  assert.equal(parsed.success, false);
  const openEnded = developerAcquisitionRangesSchema.safeParse({
    minCapRate: null, maxCapRate: null, minPrice: 1000, maxPrice: null,
    minUnitCount: null, maxUnitCount: null, minYearBuilt: null, maxYearBuilt: null,
  });
  assert.equal(openEnded.success, true);
});

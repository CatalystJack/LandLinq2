import assert from "node:assert/strict";
import test from "node:test";
import { classifyDealForProfile } from "./developerClassificationService";

const profile = {
  profileType: "real_estate",
  assetClass: "multifamily",
  targetStates: ["NC"],
  targetCounties: [],
  rentMetric: "per_unit",
  purchaseCriteria: {
    land: { minAcres: 10, maxAcres: 80, minUnits: 50, maxUnits: 400 },
    existing: { minVintageYear: 1990, maxVintageYear: 2020, minUnits: 50, maxUnits: 300 },
  },
} as any;

test("existing-property criteria screen vintage and unit count independently of land rent criteria", () => {
  const result = classifyDealForProfile({ state: "NC", vintage: 2005, unitCount: 120 }, profile, []);
  assert.equal(result.classification, "review");
  assert.deepEqual(result.matchedProductTypes, ["Existing-property acquisition criteria met"]);
});

test("existing property outside configured vintage or unit limits does not qualify", () => {
  const result = classifyDealForProfile({ state: "NC", vintage: 1980, unitCount: 120 }, profile, []);
  assert.equal(result.classification, "passed");
  assert.match(result.matchedProductTypes[0], /Vintage 1980 is below minimum 1990/);
});

test("missing existing-property unit count is sent for review instead of rejected", () => {
  const result = classifyDealForProfile({ state: "NC", vintage: 2005 }, profile, []);
  assert.equal(result.classification, "review");
  assert.match(result.matchedProductTypes[0], /unit count is not verified/);
});

test("land unit capacity uses zoning capacity and applies saved land limits", () => {
  const tooSmall = classifyDealForProfile({ state: "NC", sizeAcres: 20, maxUnitsByZoning: 40 }, profile, []);
  assert.equal(tooSmall.classification, "passed");
  assert.match(tooSmall.matchedProductTypes[0], /Unit capacity 40 is below minimum 50/);

  const unknownCapacity = classifyDealForProfile({ state: "NC", sizeAcres: 20 }, profile, []);
  assert.equal(unknownCapacity.classification, "review");
  assert.match(unknownCapacity.matchedProductTypes[0], /unit capacity is not verified/);
});

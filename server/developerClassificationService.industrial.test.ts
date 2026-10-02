import assert from "node:assert/strict";
import test from "node:test";
import { classifyDealForProfile } from "./developerClassificationService";
import {
  DEFAULT_INDUSTRIAL_CRITERIA,
  updateIndustrialProductTypeCriteria,
} from "@shared/industrial-criteria";

test("industrial screening uses saved product ranges and state-specific overrides", () => {
  const withSingleLoad = updateIndustrialProductTypeCriteria(
    DEFAULT_INDUSTRIAL_CRITERIA,
    "single-load",
    {
      minAcres: 18,
      maxAcres: 50,
      stateOverrides: { NC: { minAcres: 25, maxAcres: 40 } },
    },
  );
  const criteria = updateIndustrialProductTypeCriteria(
    withSingleLoad,
    "cross-dock",
    { minAcres: 70, maxAcres: 90 },
  );
  const profile = {
    profileType: "real_estate",
    assetClass: "industrial",
    targetStates: ["NC"],
    targetCounties: [],
    industrialCriteria: criteria,
  } as any;

  const inStateRange = classifyDealForProfile(
    { state: "NC", sizeAcres: 30 },
    profile,
    [],
  );
  assert.equal(inStateRange.classification, "yellow");
  assert.ok(inStateRange.matchedProductTypes.includes("Single Load candidate"));

  const belowStateMinimum = classifyDealForProfile(
    { state: "NC", sizeAcres: 20 },
    profile,
    [],
  );
  assert.equal(belowStateMinimum.classification, "red");

  const aboveStateMaximum = classifyDealForProfile(
    { state: "NC", sizeAcres: 45 },
    profile,
    [],
  );
  assert.equal(aboveStateMaximum.classification, "red");
});
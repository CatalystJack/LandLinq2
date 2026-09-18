import assert from "node:assert/strict";
import {
  PRODUCT_TYPE_YOC_PRESETS,
  calculateAutomatedIrr,
  calculateYOCBreakdown,
  mergeYocPreset,
  solveIrrBisection,
} from "./yocUnderwritingService.js";

const fixtureDeal = {
  id: "yoc-fixture",
  productTypes: ["3-story-surface-park"],
  targetProductTypes: [],
  askingPrice: "10000000",
  sizeAcres: "4",
  unitCount: 120,
  state: "NC",
  city: "Charlotte",
  comparablesJson: [],
};

const national = await calculateYOCBreakdown(fixtureDeal);
assert.ok(national);
assert.ok(national.types[0].irr);
assert.equal(national.types.length, 1);
assert.equal(national.types[0].yoc, 4.309728085315029);
assert.equal(national.types[0].noi, 1406350.4688000001);
assert.equal(national.types[0].tdc, 32632000);

const customPreset = mergeYocPreset(
  PRODUCT_TYPE_YOC_PRESETS["3-story-surface-park"],
  { hardCostPu: "100000" },
);
const custom = await calculateYOCBreakdown(
  fixtureDeal,
  undefined,
  { "3-story-surface-park": customPreset },
);
assert.ok(custom);
assert.equal(custom.types[0].tdc, 23800000);
assert.ok(custom.types[0].yoc > national.types[0].yoc);

const manualOverride = await calculateYOCBreakdown({
  ...fixtureDeal,
  yocOverrides: JSON.stringify({
    "yoc-fixture.3-story-surface-park.hardCostPU": 100000,
  }),
});
assert.ok(manualOverride);
assert.equal(manualOverride.types[0].tdc, custom.types[0].tdc);
assert.equal(manualOverride.types[0].yoc, custom.types[0].yoc);

const simpleIrr = solveIrrBisection([-100, 110]);
assert.ok(simpleIrr !== null);
assert.ok(Math.abs(simpleIrr - 0.1) < 1e-8);
assert.equal(solveIrrBisection([-100, Number.NaN, 200]), null);
assert.equal(solveIrrBisection([100, 10]), null);
const negativeIrr = solveIrrBisection([-100, 90]);
assert.ok(negativeIrr !== null && negativeIrr < 0);
const highIrr = solveIrrBisection([-100, 500]);
assert.ok(highIrr !== null && Math.abs(highIrr - 4) < 1e-8);

const projectedIrr = calculateAutomatedIrr({
  tdc: 1_000_000,
  gpr: 100_000,
  otherIncome: 10_000,
  vacancyPct: 0.05,
  creditLossPct: 0.02,
  mgmtFeePct: 0.03,
  fixedOperatingExpenses: 20_000,
  rentGrowthPct: 0.03,
  otherIncomeGrowthPct: 0.02,
  expenseGrowthPct: 0.025,
  holdPeriodYears: 5,
  exitCapRatePct: 0.055,
});
assert.ok(projectedIrr);
assert.equal(projectedIrr.years.length, 5);
assert.equal(projectedIrr.cashFlows.length, 6);
assert.ok(projectedIrr.terminalSaleValue > 0);
assert.ok(projectedIrr.irr > 0);
assert.equal(calculateAutomatedIrr({
  tdc: 1_000_000,
  gpr: 100_000,
  otherIncome: 10_000,
  vacancyPct: 0.05,
  creditLossPct: 0.02,
  mgmtFeePct: 0.03,
  fixedOperatingExpenses: 20_000,
  rentGrowthPct: Number.NaN,
  otherIncomeGrowthPct: 0.02,
  expenseGrowthPct: 0.025,
  holdPeriodYears: 5,
  exitCapRatePct: 0.055,
}), null);

const irrOverride = await calculateYOCBreakdown({
  ...fixtureDeal,
  yocOverrides: JSON.stringify({
    "yoc-fixture.3-story-surface-park.rentGrowthPct": 0.08,
    "yoc-fixture.3-story-surface-park.holdPeriodYears": 7,
  }),
});
assert.ok(irrOverride);
assert.equal(irrOverride.types[0].irr.holdPeriodYears, 7);
assert.equal(irrOverride.types[0].irr.rentGrowthPct, 0.08);
assert.ok(irrOverride.types[0].irr.irr > national.types[0].irr!.irr);

const invalidExitCap = await calculateYOCBreakdown({
  ...fixtureDeal,
  yocOverrides: JSON.stringify({
    "yoc-fixture.3-story-surface-park.exitCapRatePct": 0,
  }),
});
assert.ok(invalidExitCap);
assert.ok(Number.isFinite(invalidExitCap.types[0].yoc));
assert.equal(invalidExitCap.types[0].irr, null);

console.log("yocUnderwritingService fixture assertions passed");
process.exit(0);
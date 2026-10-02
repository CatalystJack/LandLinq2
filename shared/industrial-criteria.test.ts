import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_INDUSTRIAL_CRITERIA,
  normalizeIndustrialCriteria,
  updateIndustrialProductTypeCriteria,
  validateIndustrialCriteria,
} from "./industrial-criteria";

test("industrial settings update the criteria consumed by screening", () => {
  const updated = updateIndustrialProductTypeCriteria(
    DEFAULT_INDUSTRIAL_CRITERIA,
    "single-load",
    {
      minAcres: 18,
      maxAcres: 60,
      stateOverrides: { NC: { minAcres: 22, maxAcres: 55 } },
    },
  );

  const normalized = normalizeIndustrialCriteria(updated);
  const singleLoad = normalized.productTypes.find((productType) => productType.key === "single-load");

  assert.equal(singleLoad?.minAcres, 18);
  assert.equal(singleLoad?.maxAcres, 60);
  assert.deepEqual(singleLoad?.stateOverrides, { NC: { minAcres: 22, maxAcres: 55 } });
  assert.equal(normalized.default.minSingleLoadAcres, 18);
  assert.deepEqual(normalized.stateOverrides.NC, { minSingleLoadAcres: 22 });
});

test("industrial criteria reject invalid product ranges and duplicate names", () => {
  assert.throws(
    () => validateIndustrialCriteria(updateIndustrialProductTypeCriteria(
      DEFAULT_INDUSTRIAL_CRITERIA,
      "single-load",
      { minAcres: 40, maxAcres: 30 },
    )),
    /maximum acreage cannot be lower than its minimum/,
  );

  const duplicateNames = updateIndustrialProductTypeCriteria(
    DEFAULT_INDUSTRIAL_CRITERIA,
    "cross-dock",
    { name: "Single Load" },
  );
  assert.throws(() => validateIndustrialCriteria(duplicateNames), /is duplicated/);
});

test("industrial state overrides are limited to company target states", () => {
  assert.throws(
    () => normalizeIndustrialCriteria(
      updateIndustrialProductTypeCriteria(
        DEFAULT_INDUSTRIAL_CRITERIA,
        "single-load",
        { stateOverrides: { NC: { minAcres: 20 } } },
      ),
      ["SC"],
    ),
    /must be one of the company's target states/,
  );
});
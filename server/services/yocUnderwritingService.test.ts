import assert from "node:assert/strict";
import {
  PRODUCT_TYPE_YOC_PRESETS,
  calculateYOCBreakdown,
  mergeYocPreset,
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

console.log("yocUnderwritingService fixture assertions passed");
process.exit(0);
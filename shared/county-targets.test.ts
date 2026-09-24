import assert from "node:assert/strict";
import {
  countyTargetMatchesDeal,
  formatCountyTarget,
  parseCountyTarget,
} from "./county-targets";

assert.equal(formatCountyTarget(" Mecklenburg ", "nc"), "Mecklenburg, NC");
assert.equal(formatCountyTarget("Mecklenburg", "North Carolina"), "Mecklenburg, NC");
assert.equal(formatCountyTarget("Mecklenburg", ""), "Mecklenburg");
assert.equal(formatCountyTarget("  ", "NC"), "");

assert.deepEqual(parseCountyTarget("Mecklenburg, NC"), {
  county: "Mecklenburg",
  state: "NC",
});
assert.deepEqual(parseCountyTarget("St. Louis, City, Missouri"), {
  county: "St. Louis, City",
  state: "Missouri",
});
assert.deepEqual(parseCountyTarget("  Mecklenburg County  "), {
  county: "Mecklenburg County",
  state: null,
});
assert.deepEqual(parseCountyTarget("Mecklenburg,"), {
  county: "Mecklenburg",
  state: null,
});

assert.equal(countyTargetMatchesDeal("Mecklenburg, NC", "mecklenburg", "North Carolina"), true);
assert.equal(countyTargetMatchesDeal("Mecklenburg, NC", "MECKLENBURG", "nc"), true);
assert.equal(countyTargetMatchesDeal("Mecklenburg, NC", "Mecklenburg", "SC"), false);
assert.equal(countyTargetMatchesDeal("Mecklenburg, NC", "Mecklenburg", null), false);
assert.equal(countyTargetMatchesDeal("Mecklenburg", "MECKLENBURG", "SC"), true);
assert.equal(countyTargetMatchesDeal("Mecklenburg", "Wake", "NC"), false);
assert.equal(countyTargetMatchesDeal("Mecklenburg", null, "NC"), false);

console.log("county target assertions passed");
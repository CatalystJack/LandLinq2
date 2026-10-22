import assert from "node:assert/strict";
import test from "node:test";
import { replaceBrokerCountyToken } from "./outreach-personalization";

test("replaces broker county tokens and the short county alias", () => {
  assert.equal(
    replaceBrokerCountyToken("{{broker.county}} / {{COUNTY}}", "Charleston County"),
    "Charleston County / Charleston County",
  );
});

test("escapes county content for email HTML", () => {
  assert.equal(
    replaceBrokerCountyToken("In {{broker.county}}", `<County & "Area">`, true),
    "In &lt;County &amp; &quot;Area&quot;&gt;",
  );
});

test("uses an empty value when county is unavailable and removes newlines", () => {
  assert.equal(replaceBrokerCountyToken("{{county}}", null), "");
  assert.equal(replaceBrokerCountyToken("{{county}}", "Charleston\nCounty"), "Charleston County");
});

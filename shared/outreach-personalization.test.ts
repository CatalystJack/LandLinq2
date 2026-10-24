import assert from "node:assert/strict";
import test from "node:test";
import {
  renderOutreachPreviewHtml,
  renderOutreachPreviewText,
  replaceBrokerCountyToken,
} from "./outreach-personalization";

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

test("renders preview tokens from an actual recipient without changing the draft", () => {
  const context = {
    recipient: {
      firstName: "Maya",
      lastName: "Jones",
      email: "maya@example.com",
      phone: "555-0100",
      brokerage: "Pine Realty",
      county: "Wake County",
    },
    companyName: "Acme Properties",
    targetMarket: "NC, Wake County",
  };
  assert.equal(
    renderOutreachPreviewText(
      "Hi {{broker.firstName}} {{brokerName}} in {{broker.county}}. {{targetMarket}} {{companyName}} {{sender.name}}",
      { name: "Alex Sender" },
      context,
    ),
    "Hi Maya Maya Jones in Wake County. NC, Wake County Acme Properties Alex Sender",
  );
  assert.equal(
    renderOutreachPreviewHtml("<p>{{broker.county}}</p>", undefined, {
      recipient: { county: `<Wake & "Area">` },
    }),
    '<p><span class="bg-blue-100 text-blue-800 px-1 rounded">&lt;Wake &amp; &quot;Area&quot;&gt;</span></p>',
  );
});

test("renders a missing recipient county as blank in the real-recipient preview", () => {
  assert.equal(
    renderOutreachPreviewText("In {{county}} — {{broker.county}}", undefined, {
      recipient: { firstName: "Sam" },
    }),
    "In  — ",
  );
});

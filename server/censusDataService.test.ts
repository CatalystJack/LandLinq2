import assert from "node:assert/strict";
import test from "node:test";
import { geocodeAddressWithCensus } from "./censusDataService";

test("Census address matching rejects state, county, ZIP, and coordinate ambiguity", async () => {
  const originalFetch = globalThis.fetch;
  let lastUrl: URL | null = null;

  const makeMatch = (
    county: string,
    zip: string,
    longitude: number,
  ) => ({
    matchedAddress: `100 TEST ROAD, RALEIGH, NC, ${zip}`,
    coordinates: { x: longitude, y: 35.78 },
    addressComponents: { state: "NC", zip },
    geographies: {
      States: [{ STUSAB: "NC" }],
      Counties: [{ BASENAME: county }],
    },
  });

  globalThis.fetch = (async (input: string | URL | Request) => {
    lastUrl = new URL(String(input));
    const requestedAddress = lastUrl.searchParams.get("address") || "";
    let addressMatches = [makeMatch("Wake", "27601", -78.64)];
    if (requestedAddress.includes("wrong county")) {
      addressMatches = [makeMatch("Durham", "27601", -78.64)];
    } else if (requestedAddress.includes("wrong zip")) {
      addressMatches = [makeMatch("Wake", "27602", -78.64)];
    } else if (requestedAddress.includes("wrong state")) {
      addressMatches = [{
        ...makeMatch("Wake", "27601", -78.64),
        addressComponents: { state: "SC", zip: "27601" },
        geographies: { States: [{ STUSAB: "SC" }], Counties: [{ BASENAME: "Wake" }] },
      }];
    } else if (requestedAddress.includes("ambiguous")) {
      addressMatches = [
        makeMatch("Wake", "27601", -78.64),
        makeMatch("Wake", "27601", -78.65),
      ];
    }

    return new Response(JSON.stringify({ result: { addressMatches } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await geocodeAddressWithCensus({
      address: "100 Test Road",
      city: "Raleigh",
      state: "NC",
      county: "Wake County",
      zip: "27601",
    });
    assert.equal(result?.latitude, 35.78);
    assert.equal(result?.longitude, -78.64);
    assert.equal(result?.source, "U.S. Census Geocoder");
    assert.equal(lastUrl?.searchParams.get("benchmark"), "Public_AR_Current");

    for (const address of ["wrong county", "wrong zip", "wrong state", "ambiguous"]) {
      assert.equal(await geocodeAddressWithCensus({
        address: `100 ${address} Road`,
        city: "Raleigh",
        state: "NC",
        county: "Wake County",
        zip: "27601",
      }), null);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
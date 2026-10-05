import assert from "node:assert/strict";
import test from "node:test";
import { lookupRaleighPropertyData } from "./raleighPropertyDataService";

function arcGisResponse(features: unknown[], extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ features, ...extra }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("Raleigh property lookup uses coordinate-only queries and returns sourced PIN and zoning effective date", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: URL[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requestedUrls.push(url);
    if (url.hostname === "maps.wake.gov") {
      return arcGisResponse([{
        attributes: { PIN_NUM: "1703790137", REID: "0179249" },
        geometry: {
          rings: [[
            [-78.641, 35.779],
            [-78.639, 35.779],
            [-78.639, 35.781],
            [-78.641, 35.781],
            [-78.641, 35.779],
          ]],
        },
      }]);
    }
    return arcGisResponse([{
      attributes: {
        ZONING: "DX-3",
        ZONE_TYPE_DECODE: "Downtown Mixed Use",
        EFF_DATE: Date.UTC(2025, 0, 15),
        ZONE_CASE: "Z-27B-2014",
        COND_LINK: null,
      },
    }]);
  }) as typeof fetch;

  try {
    const result = await lookupRaleighPropertyData({
      city: "Raleigh",
      state: "NC",
      latitude: 35.78,
      longitude: -78.64,
    });
    assert.equal(result.parcel.status, "available");
    assert.equal(result.parcel.parcelId, "1703790137");
    assert.equal(result.parcel.reid, "0179249");
    assert.equal(result.parcel.recordDate, null);
    assert.equal(result.zoning.status, "available");
    assert.equal(result.zoning.code, "DX-3");
    assert.equal(result.zoning.effectiveDate, "2025-01-15T00:00:00.000Z");
    assert.equal(requestedUrls.length, 2);
    assert.ok(requestedUrls.every((url) => !url.searchParams.has("address")));
    assert.ok(requestedUrls.some((url) => url.hostname === "maps.wake.gov"));
    assert.ok(requestedUrls.some((url) => url.hostname === "maps.raleighnc.gov"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Raleigh pilot does not query sources for other markets or unresolved coordinates", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return arcGisResponse([]);
  }) as typeof fetch;

  try {
    const outsidePilot = await lookupRaleighPropertyData({
      city: "Cary",
      state: "NC",
      latitude: 35.78,
      longitude: -78.64,
    });
    assert.equal(outsidePilot.parcel.reason, "outside_raleigh_pilot");
    assert.equal(outsidePilot.zoning.reason, "outside_raleigh_pilot");

    const unresolved = await lookupRaleighPropertyData({
      city: "Raleigh",
      state: "NC",
      latitude: null,
      longitude: null,
    });
    assert.equal(unresolved.parcel.reason, "location_unresolved");
    assert.equal(unresolved.zoning.reason, "location_unresolved");
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Raleigh lookup keeps parcel and zoning source failures separate from no-coverage results", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.hostname === "maps.wake.gov") return arcGisResponse([]);
    return new Response(JSON.stringify({ error: { message: "service unavailable" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await lookupRaleighPropertyData({
      city: "Raleigh",
      state: "NC",
      latitude: 35.78,
      longitude: -78.64,
    });
    assert.equal(result.parcel.status, "not_available");
    assert.equal(result.parcel.reason, "no_parcel_intersection");
    assert.equal(result.zoning.status, "error");
    assert.equal(result.zoning.reason, "source_query_failed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Raleigh parcel lookup rejects ambiguous or boundary matches instead of selecting an arbitrary PIN", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.hostname !== "maps.wake.gov") return arcGisResponse([]);
    const left = {
      attributes: { PIN_NUM: "PIN-LEFT", REID: "LEFT" },
      geometry: {
        rings: [[
          [-78.641, 35.779],
          [-78.64, 35.779],
          [-78.64, 35.781],
          [-78.641, 35.781],
          [-78.641, 35.779],
        ]],
      },
    };
    const right = {
      attributes: { PIN_NUM: "PIN-RIGHT", REID: "RIGHT" },
      geometry: {
        rings: [[
          [-78.64, 35.779],
          [-78.639, 35.779],
          [-78.639, 35.781],
          [-78.64, 35.781],
          [-78.64, 35.779],
        ]],
      },
    };
    return arcGisResponse([left, right]);
  }) as typeof fetch;

  try {
    const result = await lookupRaleighPropertyData({
      city: "Raleigh",
      state: "NC",
      latitude: 35.78,
      longitude: -78.64,
    });
    assert.equal(result.parcel.status, "not_available");
    assert.equal(result.parcel.reason, "coordinate_on_parcel_boundary");
    assert.equal(result.parcel.parcelId, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

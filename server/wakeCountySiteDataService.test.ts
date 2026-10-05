import assert from "node:assert/strict";
import test from "node:test";
import { lookupWakeCountySiteData } from "./wakeCountySiteDataService";

const originalFetch = globalThis.fetch;
const parcelGeometry = {
  rings: [[
    [-78.6394, 35.7798],
    [-78.6393, 35.7798],
    [-78.6393, 35.7799],
    [-78.6394, 35.7798],
  ]],
  spatialReference: { wkid: 4326 },
};

function response(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const wakeRaleighAddress = {
  address: "222 West Hargett Street, Raleigh, NC 27601",
  city: "Raleigh",
  county: "Wake County",
  state: "North Carolina",
};

test("matches one Wake parcel by exact structured situs address, then joins Raleigh zoning to its polygon", async (t) => {
  const requested: URL[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requested.push(url);
    if (url.pathname.includes("/Property/Parcels/")) {
      return response({
        features: [{
          attributes: {
            PIN_NUM: "1703588594",
            SITE_ADDRESS: "222 W HARGETT ST",
            CALC_AREA: 0.84212782,
            PLANNING_JURISDICTION: "RA",
          },
          geometry: parcelGeometry,
        }],
      });
    }
    assert.equal(url.pathname.includes("/Planning/Zoning/FeatureServer/23/query"), true);
    assert.equal(url.searchParams.get("geometryType"), "esriGeometryPolygon");
    assert.equal(url.searchParams.get("spatialRel"), "esriSpatialRelIntersects");
    assert.deepEqual(JSON.parse(url.searchParams.get("geometry") || "null"), parcelGeometry);
    return response({
      features: [{
        attributes: {
          ZONING: "DX-20-SH",
          ZONE_TYPE: "DX-",
          ZONE_TYPE_DECODE: "Downtown Mixed Use",
          EFF_DATE: Date.parse("2016-02-14T00:00:00Z"),
          ORDINANCE: "523ZC721",
          ZONE_CASE: "Z-27B-2014",
        },
      }],
    });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData(wakeRaleighAddress);

  assert.equal(requested.length, 2);
  assert.equal(
    requested[0].searchParams.get("where"),
    "STNUM = 222 AND upper(FULL_STREET_NAME) = 'W HARGETT ST'",
  );
  assert.match(requested[0].searchParams.get("outFields") || "", /PLANNING_JURISDICTION/);
  assert.equal(result.parcel.status, "available");
  assert.equal(result.parcel.parcelId, "1703588594");
  assert.equal(result.parcel.acreage, 0.84212782);
  assert.deepEqual(result.parcel.geometry, parcelGeometry);
  assert.equal(result.zoning.status, "available");
  assert.equal(result.zoning.districts[0].code, "DX-20-SH");
  assert.equal(result.zoning.districts[0].effectiveDate, "2016-02-14");
  assert.equal(result.utilities.status, "unknown");
  assert.match(result.utilities.message, /capacity/);
});

test("does not choose a parcel when an exact address returns multiple records", async (t) => {
  let zoningRequested = false;
  globalThis.fetch = (async () => response({
    features: [
      { attributes: { PIN_NUM: "1001" }, geometry: parcelGeometry },
      { attributes: { PIN_NUM: "1002" }, geometry: parcelGeometry },
    ],
  })) as typeof fetch;
  const parcelFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/Planning/Zoning/")) zoningRequested = true;
    return parcelFetch(input, init);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData(wakeRaleighAddress);
  assert.equal(result.parcel.status, "ambiguous");
  assert.equal(result.zoning.status, "not_checked");
  assert.equal(zoningRequested, false);
});

test("keeps source failure distinct from an empty parcel result", async (t) => {
  globalThis.fetch = (async () => {
    throw new Error("service timeout");
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData(wakeRaleighAddress);
  assert.equal(result.parcel.status, "error");
  assert.match(result.parcel.message, /service timeout/);
  assert.equal(result.zoning.status, "not_checked");
});

test("reports no match distinctly when the official parcel query returns zero features", async (t) => {
  globalThis.fetch = (async () => response({ features: [] })) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData(wakeRaleighAddress);
  assert.equal(result.parcel.status, "no_match");
  assert.equal(result.zoning.status, "not_checked");
});

test("does not query Wake GIS for a property outside the selected pilot", async (t) => {
  let requestCount = 0;
  globalThis.fetch = (async () => {
    requestCount += 1;
    return response({ features: [] });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData({
    ...wakeRaleighAddress,
    county: "Durham",
  });
  assert.equal(result.parcel.status, "not_covered");
  assert.equal(result.zoning.status, "not_covered");
  assert.equal(requestCount, 0);
});

test("does not call missing county or state data outside the pilot", async (t) => {
  let requestCount = 0;
  globalThis.fetch = (async () => {
    requestCount += 1;
    return response({ features: [] });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData({
    ...wakeRaleighAddress,
    county: null,
  });
  assert.equal(result.parcel.status, "not_checked");
  assert.equal(result.zoning.status, "not_checked");
  assert.equal(requestCount, 0);
});

test("marks Raleigh zoning as outside coverage for other Wake County municipalities", async (t) => {
  globalThis.fetch = (async () => response({
    features: [{
      attributes: {
        PIN_NUM: "1703588594",
        SITE_ADDRESS: "222 W HARGETT ST",
        CALC_AREA: 0.842,
      },
      geometry: parcelGeometry,
    }],
  })) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData({
    ...wakeRaleighAddress,
    city: "Cary",
  });
  assert.equal(result.parcel.status, "available");
  assert.equal(result.zoning.status, "not_covered");
  assert.equal(result.zoning.districts.length, 0);
});

test("uses the parcel source jurisdiction field to avoid applying Raleigh zoning outside its coverage", async (t) => {
  let zoningRequested = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes("/Planning/Zoning/")) zoningRequested = true;
    return response({
      features: [{
        attributes: {
          PIN_NUM: "1703588594",
          SITE_ADDRESS: "222 W HARGETT ST",
          CALC_AREA: 0.842,
          PLANNING_JURISDICTION: "CA",
        },
        geometry: parcelGeometry,
      }],
    });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData(wakeRaleighAddress);
  assert.equal(result.parcel.status, "available");
  assert.equal(result.zoning.status, "not_covered");
  assert.equal(zoningRequested, false);
});

test("does not infer Raleigh zoning coverage when the municipality is missing", async (t) => {
  let zoningRequested = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes("/Planning/Zoning/")) zoningRequested = true;
    return response({
      features: [{
        attributes: {
          PIN_NUM: "1703588594",
          SITE_ADDRESS: "222 W HARGETT ST",
          CALC_AREA: 0.842,
        },
        geometry: parcelGeometry,
      }],
    });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData({
    ...wakeRaleighAddress,
    city: null,
  });
  assert.equal(result.parcel.status, "available");
  assert.equal(result.zoning.status, "not_checked");
  assert.equal(zoningRequested, false);
});

test("keeps multiple zoning districts ambiguous instead of selecting one", async (t) => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes("/Property/Parcels/")) {
      return response({
        features: [{
          attributes: {
            PIN_NUM: "1703588594",
            SITE_ADDRESS: "222 W HARGETT ST",
            CALC_AREA: 0.842,
          },
          geometry: parcelGeometry,
        }],
      });
    }
    return response({
      features: [
        { attributes: { ZONING: "DX-3", EFF_DATE: Date.parse("2020-01-01T00:00:00Z") } },
        { attributes: { ZONING: "IX-3", EFF_DATE: Date.parse("2022-01-01T00:00:00Z") } },
      ],
    });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData(wakeRaleighAddress);
  assert.equal(result.parcel.status, "available");
  assert.equal(result.zoning.status, "ambiguous");
  assert.deepEqual(result.zoning.districts.map((district) => district.code), ["DX-3", "IX-3"]);
});

test("keeps zoning-source errors separate from a successful parcel match", async (t) => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes("/Property/Parcels/")) {
      return response({
        features: [{
          attributes: { PIN_NUM: "1703588594", SITE_ADDRESS: "222 W HARGETT ST" },
          geometry: parcelGeometry,
        }],
      });
    }
    return response({ error: { message: "zoning service unavailable" } });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await lookupWakeCountySiteData(wakeRaleighAddress);
  assert.equal(result.parcel.status, "available");
  assert.equal(result.zoning.status, "error");
  assert.match(result.zoning.message, /zoning service unavailable/);
});
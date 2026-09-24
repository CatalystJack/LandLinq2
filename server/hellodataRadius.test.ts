import assert from "node:assert/strict";
import test from "node:test";
import {
  countCoordinateComparablesWithinRadius,
  getComparableCoordinates,
  getSubjectDistanceWithinRadius,
  haversineDistanceMiles,
  resolveComparableWithinRadius,
  validateCachedComparablesWithinRadius,
} from "./hellodataRadius.js";

test("includes a comparable exactly on the Haversine radius boundary", () => {
  const boundaryComparable = { latitude: 0, longitude: 1 };
  const exactDistance = haversineDistanceMiles(0, 0, 0, 1);

  assert.equal(
    getSubjectDistanceWithinRadius(boundaryComparable, 0, 0, exactDistance),
    exactDistance,
  );
  assert.equal(
    getSubjectDistanceWithinRadius(boundaryComparable, 0, 0, exactDistance - 0.000001),
    null,
  );
});

test("rejects missing, blank, malformed, and out-of-range coordinates", () => {
  const invalidComparables = [
    null,
    undefined,
    {},
    { latitude: null, longitude: 0 },
    { lat: "", lon: "0" },
    { lat: "not-a-number", lon: 0 },
    { lat: 90.01, lon: 0 },
    { lat: 0, lon: 180.01 },
  ];

  for (const comparable of invalidComparables) {
    assert.equal(getComparableCoordinates(comparable), null);
    assert.equal(getSubjectDistanceWithinRadius(comparable, 0, 0, 5), null);
  }

  assert.equal(getSubjectDistanceWithinRadius({ lat: 0, lon: 0 }, 0, 0, 5), 0);
  assert.equal(getSubjectDistanceWithinRadius({ lat: 0, lon: 0 }, 91, 0, 5), null);
  assert.equal(getSubjectDistanceWithinRadius({ lat: 0, lon: 0 }, 0, 0, 0), null);
});

test("rejects an entire cached result when any comparable is outside the current radius", () => {
  const cachedComparables = [
    { latitude: 0, longitude: 0.01, distance: 500 },
    { latitude: 0, longitude: 0.2, distance: 0 },
  ];

  assert.equal(
    validateCachedComparablesWithinRadius(cachedComparables, 0, 0, 10),
    null,
  );
});

test("recomputes distances on accepted cache rows instead of keeping provider distances", () => {
  const cachedComparables = [
    { latitude: 0, longitude: 0.01, distance: 999 },
    { lat: 0, lon: 0.02, distance: 0 },
  ];

  const validated = validateCachedComparablesWithinRadius(
    cachedComparables,
    0,
    0,
    2,
  );

  assert.ok(validated);
  assert.equal(validated.length, 2);
  assert.equal(validated[0].distance, haversineDistanceMiles(0, 0, 0, 0.01));
  assert.equal(validated[1].distance, haversineDistanceMiles(0, 0, 0, 0.02));
});

test("normal detail enrichment uses detail coordinates and rejects a valid outside detail point", () => {
  const searchComparable = {
    lat: 0,
    lon: 0.5,
    distance_miles: 0.25,
  };
  const detailComparable = {
    latitude: 0,
    longitude: 0.01,
    distance: 400,
  };
  const enriched = resolveComparableWithinRadius(
    detailComparable,
    searchComparable,
    0,
    0,
    2,
  );

  assert.ok(enriched);
  assert.equal(enriched.latitude, 0);
  assert.equal(enriched.longitude, 0.01);
  assert.equal(enriched.distance, haversineDistanceMiles(0, 0, 0, 0.01));

  assert.equal(
    resolveComparableWithinRadius(
      { latitude: 0, longitude: 0.2 },
      searchComparable,
      0,
      0,
      2,
    ),
    null,
  );
});

test("detail-failure fallback validates the search result coordinates, not HelloData distance", () => {
  const searchComparable = {
    lat: 0,
    lon: 0.01,
    distance_miles: 900,
  };
  const fallback = resolveComparableWithinRadius(
    null,
    searchComparable,
    0,
    0,
    2,
  );

  assert.ok(fallback);
  assert.equal(fallback.longitude, 0.01);
  assert.equal(fallback.distance, haversineDistanceMiles(0, 0, 0, 0.01));
  assert.equal(
    resolveComparableWithinRadius(
      null,
      { lat: 0, lon: 0.2, distance_miles: 0 },
      0,
      0,
      2,
    ),
    null,
  );
});

test("map fallback uses search coordinates when detail coordinates are missing and counts only in-radius points", () => {
  const searchResults = [
    { id: "inside", lat: 0, lon: 0.01, distance: 100 },
    { id: "outside", lat: 0, lon: 0.2, distance: 0 },
    { id: "missing", distance: 0 },
  ];

  const mapFallback = resolveComparableWithinRadius(
    { latitude: "", longitude: "" },
    searchResults[0],
    0,
    0,
    2,
  );
  assert.ok(mapFallback);
  assert.equal(mapFallback.longitude, 0.01);
  assert.equal(mapFallback.distance, haversineDistanceMiles(0, 0, 0, 0.01));
  assert.equal(
    resolveComparableWithinRadius(null, searchResults[1], 0, 0, 2),
    null,
  );
  assert.equal(
    resolveComparableWithinRadius(null, searchResults[2], 0, 0, 2),
    null,
  );
  assert.equal(countCoordinateComparablesWithinRadius(searchResults, 0, 0, 2), 1);
});
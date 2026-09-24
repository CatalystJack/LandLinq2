export interface ComparableCoordinates {
  latitude: number;
  longitude: number;
}

export interface RadiusCheckedComparable extends ComparableCoordinates {
  distance: number;
}

export function haversineDistanceMiles(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const earthRadiusMiles = 3959;
  const deltaLatitude = (latitude2 - latitude1) * Math.PI / 180;
  const deltaLongitude = (longitude2 - longitude1) * Math.PI / 180;
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1 * Math.PI / 180) *
      Math.cos(latitude2 * Math.PI / 180) *
      Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getComparableCoordinates(comparable: unknown): ComparableCoordinates | null {
  const record = comparable && typeof comparable === "object"
    ? comparable as Record<string, unknown>
    : null;
  if (!record) return null;

  const latitudeValue = record.latitude ?? record.lat;
  const longitudeValue = record.longitude ?? record.lng ?? record.lon;
  if (
    latitudeValue === undefined ||
    latitudeValue === null ||
    String(latitudeValue).trim() === "" ||
    longitudeValue === undefined ||
    longitudeValue === null ||
    String(longitudeValue).trim() === ""
  ) return null;

  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) return null;

  return { latitude, longitude };
}

/**
 * Prefer enriched details, then the search result when details are missing or
 * have invalid coordinates. A valid detail coordinate outside the radius is
 * authoritative and must not fall back to a possibly stale search coordinate.
 */
export function resolveComparableWithinRadius(
  primaryComparable: unknown,
  fallbackComparable: unknown,
  subjectLatitude: number,
  subjectLongitude: number,
  radiusMiles: number,
): RadiusCheckedComparable | null {
  if (
    !Number.isFinite(subjectLatitude) ||
    !Number.isFinite(subjectLongitude) ||
    subjectLatitude < -90 ||
    subjectLatitude > 90 ||
    subjectLongitude < -180 ||
    subjectLongitude > 180 ||
    !Number.isFinite(radiusMiles) ||
    radiusMiles <= 0
  ) return null;

  const coordinates = getComparableCoordinates(primaryComparable)
    || getComparableCoordinates(fallbackComparable);
  if (!coordinates) return null;

  const distance = haversineDistanceMiles(
    subjectLatitude,
    subjectLongitude,
    coordinates.latitude,
    coordinates.longitude,
  );
  if (!Number.isFinite(distance) || distance > radiusMiles) return null;

  return { ...coordinates, distance };
}

export function getSubjectDistanceWithinRadius(
  comparable: unknown,
  subjectLatitude: number,
  subjectLongitude: number,
  radiusMiles: number,
): number | null {
  return resolveComparableWithinRadius(
    comparable,
    null,
    subjectLatitude,
    subjectLongitude,
    radiusMiles,
  )?.distance ?? null;
}

export function countCoordinateComparablesWithinRadius(
  comparables: readonly unknown[],
  subjectLatitude: number,
  subjectLongitude: number,
  radiusMiles: number,
): number {
  return comparables.filter((comparable) =>
    getSubjectDistanceWithinRadius(comparable, subjectLatitude, subjectLongitude, radiusMiles) !== null,
  ).length;
}

/**
 * Cached summaries describe the complete comparable set. Reject the whole row
 * if any property is invalid or outside the current subject's requested radius.
 */
export function validateCachedComparablesWithinRadius<T extends object>(
  comparables: unknown,
  subjectLatitude: number,
  subjectLongitude: number,
  radiusMiles: number,
): Array<T & { distance: number }> | null {
  if (!Array.isArray(comparables)) return null;

  const validated: Array<T & { distance: number }> = [];
  for (const comparable of comparables as T[]) {
    const checked = resolveComparableWithinRadius(
      comparable,
      null,
      subjectLatitude,
      subjectLongitude,
      radiusMiles,
    );
    if (!checked) return null;
    validated.push({ ...comparable, distance: checked.distance });
  }
  return validated;
}
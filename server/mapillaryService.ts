import { apiCallTracker } from "./apiCallTracker.js";

const MAPILLARY_ENDPOINT = "https://graph.mapillary.com/images";
const DEFAULT_RADIUS_METERS = 100;

export interface MapillaryImage {
  id: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  capturedAt: string | null;
  compassAngle: number | null;
  distanceMeters: number;
}

export interface MapillarySearchResult {
  configured: boolean;
  images: MapillaryImage[];
  radiusMeters: number;
  viewerToken?: string;
  message?: string;
}

interface MapillaryApiResponse {
  data?: Array<{
    id?: string;
    thumb_1024_url?: string;
    computed_geometry?: { coordinates?: [number, number] };
    geometry?: { coordinates?: [number, number] };
    captured_at?: string | number;
    compass_angle?: number;
  }>;
}

function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = toRadians(latitudeB - latitudeA);
  const deltaLng = toRadians(longitudeB - longitudeA);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(latitudeA))
    * Math.cos(toRadians(latitudeB))
    * Math.sin(deltaLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchMapillaryImages(
  latitude: number,
  longitude: number,
  requestedRadiusMeters = DEFAULT_RADIUS_METERS,
): Promise<MapillarySearchResult> {
  const accessToken = String(
    process.env.MAPILLARY_ACCESS_TOKEN
    || process.env.VITE_MAPILLARY_ACCESS_TOKEN
    || "",
  ).trim();
  const radiusMeters = Math.min(Math.max(requestedRadiusMeters, 50), 500);

  if (!accessToken) {
    return {
      configured: false,
      images: [],
      radiusMeters,
      message: "Mapillary access is not configured.",
    };
  }

  const latitudeDelta = radiusMeters / 111_000;
  const longitudeDelta = radiusMeters / (
    111_000 * Math.max(Math.cos(latitude * Math.PI / 180), 0.2)
  );
  const bbox = [
    longitude - longitudeDelta,
    latitude - latitudeDelta,
    longitude + longitudeDelta,
    latitude + latitudeDelta,
  ].join(",");
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,thumb_1024_url,computed_geometry,geometry,captured_at,compass_angle",
    bbox,
    limit: "50",
  });
  const startedAt = Date.now();

  try {
    const response = await fetch(`${MAPILLARY_ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json() as MapillaryApiResponse & {
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(payload.error?.message || `HTTP ${response.status}`);
    }

    const images = (payload.data || [])
      .flatMap((image) => {
        const coordinates = image.computed_geometry?.coordinates
          || image.geometry?.coordinates;
        if (!image.id || !image.thumb_1024_url || !coordinates) return [];
        const [imageLongitude, imageLatitude] = coordinates;
        const distance = distanceMeters(
          latitude,
          longitude,
          imageLatitude,
          imageLongitude,
        );
        if (!Number.isFinite(distance) || distance > radiusMeters) return [];
        return [{
          id: image.id,
          imageUrl: image.thumb_1024_url,
          latitude: imageLatitude,
          longitude: imageLongitude,
          capturedAt: image.captured_at
            ? new Date(image.captured_at).toISOString()
            : null,
          compassAngle: Number.isFinite(image.compass_angle)
            ? image.compass_angle as number
            : null,
          distanceMeters: Math.round(distance),
        }];
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 12);

    apiCallTracker.logCall(
      "Mapillary",
      "images/nearby",
      true,
      Date.now() - startedAt,
    );
    return {
      configured: true,
      images,
      radiusMeters,
      viewerToken: accessToken,
    };
  } catch (error) {
    apiCallTracker.logCall(
      "Mapillary",
      "images/nearby",
      false,
      Date.now() - startedAt,
      { errorMessage: error instanceof Error ? error.message : String(error) },
    );
    console.warn("[MAPILLARY] Image search failed:", error);
    return {
      configured: true,
      images: [],
      radiusMeters,
      message: "Mapillary imagery could not be loaded right now.",
    };
  }
}
import type { TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapTileProvider = "MapTiler" | "OpenStreetMap";

const mapTilerKey = String(import.meta.env.VITE_MAPTILER_API_KEY || "").trim();

export function getOpenStreetMapTileConfig(): {
  provider: "OpenStreetMap";
  url: string;
  attribution: string;
} {
  return {
    provider: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  };
}

export function getMapTileConfig(): {
  provider: MapTileProvider;
  url: string;
  attribution: string;
} {
  if (mapTilerKey) {
    return {
      provider: "MapTiler",
      url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encodeURIComponent(mapTilerKey)}`,
      attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    };
  }

  return getOpenStreetMapTileConfig();
}

export function trackMapUsage(
  service: MapTileProvider | "Mapillary",
  endpoint: string,
  success = true,
  responseTime = 0,
) {
  void fetch("/api/tracking/map-usage", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service, endpoint, success, responseTime }),
    keepalive: true,
  }).catch(() => {
    // Usage reporting must never interfere with map rendering.
  });
}

export function addTrackedTileEvents(
  layer: TileLayer,
  provider: MapTileProvider,
) {
  const startedAt = new WeakMap<object, number>();

  layer.on("tileloadstart", (event: unknown) => {
    if (event && typeof event === "object") {
      startedAt.set(event, performance.now());
    }
  });
  layer.on("tileload", (event: unknown) => {
    const duration = event && typeof event === "object"
      ? Math.round(performance.now() - (startedAt.get(event) || performance.now()))
      : 0;
    trackMapUsage(provider, "tile", true, duration);
  });
  layer.on("tileerror", (event: unknown) => {
    const duration = event && typeof event === "object"
      ? Math.round(performance.now() - (startedAt.get(event) || performance.now()))
      : 0;
    trackMapUsage(provider, "tile", false, duration);
  });
}

export function trackMapSession(provider: MapTileProvider) {
  trackMapUsage(provider, "session", true);
}
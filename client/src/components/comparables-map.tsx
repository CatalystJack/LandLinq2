import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type L from "leaflet";
import {
  addTrackedTileEvents,
  getMapTileConfig,
  trackMapSession,
} from "@/lib/map-tiles";

interface ComparableLocation {
  address: string;
  latitude: number;
  longitude: number;
  label?: string;
}

interface ComparablesMapProps {
  subjectLatitude?: number | null;
  subjectLongitude?: number | null;
  subjectAddress?: string;
  comparables: ComparableLocation[];
  height?: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function numberedIcon(L: any, text: string, color: string) {
  return L.divIcon({
    className: "comparable-map-marker",
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px">${text}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function ComparablesMap({
  subjectLatitude,
  subjectLongitude,
  subjectAddress,
  comparables,
  height = "300px",
}: ComparablesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    const container = mapRef.current;

    const validComparables = comparables.filter(
      comparable => Number.isFinite(comparable.latitude) && Number.isFinite(comparable.longitude),
    );
    const validSubject = Number.isFinite(subjectLatitude) && Number.isFinite(subjectLongitude)
      ? { lat: Number(subjectLatitude), lng: Number(subjectLongitude) }
      : null;

    if (!validSubject && validComparables.length === 0) {
      setError("No location data available");
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.isConnected) return;
      leafletMapRef.current?.remove();
      const locations: L.LatLngTuple[] = [
        ...(validSubject ? [[validSubject.lat, validSubject.lng] as L.LatLngTuple] : []),
        ...validComparables.map(comparable => [comparable.latitude, comparable.longitude] as L.LatLngTuple),
      ];
      const map = L.map(container, { zoomControl: true, scrollWheelZoom: true });
      leafletMapRef.current = map;
      const tileConfig = getMapTileConfig();
      const tileLayer = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: 20,
      }).addTo(map);
      addTrackedTileEvents(tileLayer, tileConfig.provider);
      trackMapSession(tileConfig.provider);

      if (validSubject) {
        L.marker([validSubject.lat, validSubject.lng], {
          icon: numberedIcon(L, "S", "#dc2626"),
          zIndexOffset: 1000,
          title: subjectAddress || "Subject property",
        })
          .addTo(map)
          .bindPopup(`<strong style="color:#dc2626">Subject property</strong><br/>${escapeHtml(subjectAddress || "Subject")}`);
      }

      validComparables.forEach((comparable, index) => {
        const marker = L.marker([comparable.latitude, comparable.longitude], {
          icon: numberedIcon(L, String(index + 1), "#2563eb"),
          title: comparable.address,
        }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:180px">
            <strong style="color:#1e3a5f">Comparable #${index + 1}</strong><br/>
            <span>${escapeHtml(comparable.address)}</span>
            ${comparable.label ? `<br/><small>${escapeHtml(comparable.label)}</small>` : ""}
          </div>
        `);
      });

      if (locations.length === 1) {
        map.setView(locations[0], 13);
      } else {
        map.fitBounds(L.latLngBounds(locations), { padding: [35, 35], maxZoom: 15 });
      }
      setIsLoading(false);
      setTimeout(() => map.invalidateSize(), 100);
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load the map");
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, [subjectLatitude, subjectLongitude, subjectAddress, comparables]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500" style={{ height }}>
        {error}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200" style={{ height }}>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading map...</span>
          </div>
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" />
      {!isLoading && (
        <>
          <div className="absolute bottom-2 left-2 z-[1000] rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full bg-red-600" />
                Subject
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full bg-blue-600" />
                Comparables ({validComparablesCount(comparables)})
              </span>
            </div>
          </div>
          <a
            href={`https://www.openstreetmap.org/?mlat=${subjectLatitude || comparables[0]?.latitude}&mlon=${subjectLongitude || comparables[0]?.longitude}#map=15/${subjectLatitude || comparables[0]?.latitude}/${subjectLongitude || comparables[0]?.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-2 top-2 z-[1000] flex items-center gap-1 rounded bg-white px-2 py-1 text-xs text-gray-700 shadow-sm hover:bg-gray-100"
          >
            Open in OpenStreetMap ↗
          </a>
        </>
      )}
    </div>
  );
}

function validComparablesCount(comparables: ComparableLocation[]) {
  return comparables.filter(
    comparable => Number.isFinite(comparable.latitude) && Number.isFinite(comparable.longitude),
  ).length;
}
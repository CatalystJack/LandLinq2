import { useEffect, useRef } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StreetViewPanel } from "@/components/street-view-panel";
import {
  addTrackedTileEvents,
  getMapTileConfig,
  trackMapSession,
} from "@/lib/map-tiles";
import type L from "leaflet";

interface GoogleMapProps {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  onBack?: () => void;
  onCorrectLocation?: () => void;
}

export default function GoogleMap({
  address,
  city,
  state,
  zip,
  latitude,
  longitude,
  onBack,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const lat = typeof latitude === "number" ? latitude : Number(latitude);
  const lng = typeof longitude === "number" ? longitude : Number(longitude);
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

  useEffect(() => {
    if (!mapRef.current || !hasValidCoords) return;
    let cancelled = false;
    const container = mapRef.current;

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.isConnected) return;
      leafletMapRef.current?.remove();
      const map = L.map(container, { zoomControl: true }).setView([lat, lng], 18);
      leafletMapRef.current = map;

      const tileConfig = getMapTileConfig();
      const tileLayer = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: 20,
      }).addTo(map);
      addTrackedTileEvents(tileLayer, tileConfig.provider);
      trackMapSession(tileConfig.provider);

      L.circleMarker([lat, lng], {
        radius: 10,
        color: "#ffffff",
        weight: 3,
        fillColor: "#dc2626",
        fillOpacity: 1,
      }).addTo(map).bindPopup(address || "Property location").openPopup();

      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, [lat, lng, hasValidCoords, address]);

  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {onBack && (
          <Button onClick={onBack} variant="outline" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            BACK TO TABLE VIEW
          </Button>
        )}
        {fullAddress && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">{address || fullAddress}</p>
            {(city || state || zip) && (
              <p className="text-xs text-gray-600">{[city, state, zip].filter(Boolean).join(", ")}</p>
            )}
          </div>
        )}
      </div>

      {hasValidCoords ? (
        <>
          <div className="relative h-[600px] overflow-hidden rounded-lg bg-gray-100">
            <div ref={mapRef} className="h-full w-full" />
            <div className="absolute bottom-2 left-2 z-[1000] rounded bg-white/90 px-2 py-1 text-[11px] text-slate-600 shadow">
              Leaflet map · OpenStreetMap/MapTiler
            </div>
          </div>
          <StreetViewPanel latitude={lat} longitude={lng} />
        </>
      ) : (
        <div className="flex h-56 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
          <MapPin className="mr-2 h-4 w-4" />
          No coordinates are available for this property.
        </div>
      )}
    </div>
  );
}
import { useEffect, useRef } from "react";
import type L from "leaflet";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StreetViewPanel } from "@/components/street-view-panel";
import {
  addTrackedTileEvents,
  getMapTileConfig,
  trackMapSession,
} from "@/lib/map-tiles";

interface PropertyLocationMapProps {
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
}

export function PropertyLocationMap({
  address,
  latitude,
  longitude,
}: PropertyLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

  useEffect(() => {
    if (!mapContainerRef.current || !hasCoordinates) return;
    let cancelled = false;
    const container = mapContainerRef.current;

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.isConnected) return;
      mapRef.current?.remove();
      const map = L.map(container, { zoomControl: true }).setView([lat, lng], 16);
      mapRef.current = map;
      const tileConfig = getMapTileConfig();
      const tileLayer = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: 20,
      }).addTo(map);
      addTrackedTileEvents(tileLayer, tileConfig.provider);
      trackMapSession(tileConfig.provider);

      L.circleMarker([lat, lng], {
        radius: 9,
        color: "#fff",
        weight: 3,
        fillColor: "#dc2626",
        fillOpacity: 1,
      }).addTo(map).bindPopup(address || "Property location").openPopup();

      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, hasCoordinates, address]);

  if (!hasCoordinates) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Property Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-64 overflow-hidden rounded-lg border border-slate-200">
          <div ref={mapContainerRef} className="h-full w-full" />
        </div>
        <StreetViewPanel latitude={lat} longitude={lng} />
      </CardContent>
    </Card>
  );
}
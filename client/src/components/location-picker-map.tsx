import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, MapPin, X } from "lucide-react";
import type L from "leaflet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addTrackedTileEvents,
  getMapTileConfig,
  trackMapSession,
} from "@/lib/map-tiles";

interface LocationPickerMapProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lat: number, lng: number, reason: string) => void;
  currentLatitude?: number | string | null;
  currentLongitude?: number | string | null;
  address: string;
  isSaving?: boolean;
}

const markerIcon = (color: string) => ({
  icon: (L: any) => L.divIcon({
    className: "location-picker-marker",
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>`,
    iconSize: [24, 24] as [number, number],
    iconAnchor: [12, 12] as [number, number],
  }),
});

export function LocationPickerMap({
  isOpen,
  onClose,
  onSave,
  currentLatitude,
  currentLongitude,
  address,
  isSaving = false,
}: LocationPickerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !mapRef.current) return;
    let cancelled = false;
    const container = mapRef.current;
    setIsLoading(true);
    setError(null);

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.isConnected) return;
      mapInstanceRef.current?.remove();
      markerRef.current = null;

      const numericLatitude = Number(currentLatitude);
      const numericLongitude = Number(currentLongitude);
      const hasCurrentPosition = Number.isFinite(numericLatitude) && Number.isFinite(numericLongitude);
      const initialLat = hasCurrentPosition ? numericLatitude : 35.5;
      const initialLng = hasCurrentPosition ? numericLongitude : -80;
      const map = L.map(container, { zoomControl: true }).setView(
        [initialLat, initialLng],
        hasCurrentPosition ? 15 : 8,
      );
      mapInstanceRef.current = map;
      const tileConfig = getMapTileConfig();
      const tileLayer = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: 20,
      }).addTo(map);
      addTrackedTileEvents(tileLayer, tileConfig.provider);
      trackMapSession(tileConfig.provider);

      const updatePosition = (lat: number, lng: number) => {
        setSelectedPosition({ lat, lng });
      };
      const addMarker = (lat: number, lng: number, color: string) => {
        markerRef.current?.remove();
        const marker = L.marker([lat, lng], {
          draggable: true,
          ...markerIcon(color).icon(L),
        }).addTo(map);
        marker.bindTooltip("Drag to adjust location");
        marker.on("dragend", () => {
          const position = marker.getLatLng();
          updatePosition(position.lat, position.lng);
        });
        markerRef.current = marker;
        updatePosition(lat, lng);
      };

      if (hasCurrentPosition) {
        addMarker(initialLat, initialLng, "#ef4444");
      }
      map.on("click", event => addMarker(event.latlng.lat, event.latlng.lng, "#22c55e"));
      setIsLoading(false);
      setTimeout(() => map.invalidateSize(), 100);
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load the map. Please try again.");
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [isOpen, currentLatitude, currentLongitude]);

  const handleSave = () => {
    if (selectedPosition) {
      onSave(selectedPosition.lat, selectedPosition.lng, "Manually corrected - geocoding was inaccurate");
    }
  };

  const hasPositionChanged = Boolean(
    selectedPosition
    && (
      selectedPosition.lat !== Number(currentLatitude)
      || selectedPosition.lng !== Number(currentLongitude)
    ),
  );

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[90vw] lg:max-w-[900px]" data-testid="dialog-location-picker">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Set Correct Location
          </DialogTitle>
          <DialogDescription>{address}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Click on the map to place the pin at the correct site location.</p>
            <p className="mt-1 text-xs">You can also drag the marker to adjust. Use the satellite imagery alternative if parcel context is needed.</p>
          </div>
        </div>

        {error ? (
          <div className="flex h-[450px] items-center justify-center rounded-lg bg-gray-100 text-red-500">{error}</div>
        ) : (
          <div className="relative h-[450px] overflow-hidden rounded-lg border border-gray-200">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-600">Loading map...</span>
              </div>
            )}
            <div ref={mapRef} className="h-full w-full" />
          </div>
        )}

        {selectedPosition && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span>Selected: {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}</span>
            {hasPositionChanged && <span className="font-medium text-green-600">(changed)</span>}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="mr-1 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedPosition || isSaving || !hasPositionChanged} className="bg-green-600 hover:bg-green-700">
            {isSaving ? (
              <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving...</>
            ) : (
              <><Check className="mr-1 h-4 w-4" />Save Location</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
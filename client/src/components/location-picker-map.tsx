import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, MapPin, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface LocationPickerMapProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lat: number, lng: number, reason: string) => void;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  address: string;
  isSaving?: boolean;
}

export function LocationPickerMap({
  isOpen,
  onClose,
  onSave,
  currentLatitude,
  currentLongitude,
  address,
  isSaving = false
}: LocationPickerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    const initialLat = currentLatitude || 35.5;
    const initialLng = currentLongitude || -80.0;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: initialLat, lng: initialLng },
      zoom: currentLatitude && currentLongitude ? 15 : 8,
      mapTypeId: 'hybrid',
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    mapInstanceRef.current = map;

    // Add current marker if coordinates exist
    if (currentLatitude && currentLongitude) {
      const marker = new window.google.maps.Marker({
        position: { lat: currentLatitude, lng: currentLongitude },
        map,
        draggable: true,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#ef4444',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: 'Click and drag to correct location',
      });

      markerRef.current = marker;
      setSelectedPosition({ lat: currentLatitude, lng: currentLongitude });

      // Handle marker drag
      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          setSelectedPosition({ lat: pos.lat(), lng: pos.lng() });
        }
      });
    }

    // Handle map click to place/move marker
    map.addListener('click', (e: any) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        
        if (markerRef.current) {
          markerRef.current.setPosition({ lat, lng });
        } else {
          const marker = new window.google.maps.Marker({
            position: { lat, lng },
            map,
            draggable: true,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: '#22c55e',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            },
            title: 'New location - drag to adjust',
          });
          markerRef.current = marker;

          marker.addListener('dragend', () => {
            const pos = marker.getPosition();
            if (pos) {
              setSelectedPosition({ lat: pos.lat(), lng: pos.lng() });
            }
          });
        }
        
        setSelectedPosition({ lat, lng });
      }
    });

    setIsLoading(false);
  }, [currentLatitude, currentLongitude]);

  useEffect(() => {
    if (!isOpen) return;

    // Load Google Maps if not already loaded
    if (window.google?.maps) {
      initializeMap();
    } else {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError('Google Maps API key not configured');
        setIsLoading(false);
        return;
      }

      // Check if script already exists but hasn't loaded yet
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        // Wait for existing script to load
        const checkGoogle = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(checkGoogle);
            initializeMap();
          }
        }, 100);
        
        // Timeout after 15 seconds
        setTimeout(() => {
          clearInterval(checkGoogle);
          if (!window.google?.maps) {
            setError('Failed to load Google Maps - please refresh the page');
            setIsLoading(false);
          }
        }, 15000);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => initializeMap();
      script.onerror = () => {
        setError('Failed to load Google Maps - check your internet connection');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current = null;
      }
    };
  }, [isOpen, initializeMap]);

  const handleSave = () => {
    if (selectedPosition) {
      onSave(
        selectedPosition.lat, 
        selectedPosition.lng, 
        'Manually corrected - geocoding was inaccurate'
      );
    }
  };

  const hasPositionChanged = selectedPosition && (
    selectedPosition.lat !== currentLatitude || 
    selectedPosition.lng !== currentLongitude
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] lg:max-w-[900px] max-h-[90vh]" data-testid="dialog-location-picker">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" />
            Set Correct Location
          </DialogTitle>
          <DialogDescription>
            {address}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Click on the map to place the pin at the correct site location.</p>
            <p className="text-xs mt-1">You can also drag the marker to adjust. Use satellite view to verify the exact parcel.</p>
          </div>
        </div>

        {error ? (
          <div className="flex items-center justify-center h-[400px] bg-gray-100 rounded-lg text-red-500">
            {error}
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height: '450px' }}>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-600">Loading map...</span>
              </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
          </div>
        )}

        {selectedPosition && (
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>
              Selected: {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
            </span>
            {hasPositionChanged && (
              <span className="text-green-600 font-medium">(changed)</span>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!selectedPosition || isSaving || !hasPositionChanged}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Save Location
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

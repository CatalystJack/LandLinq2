import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, AlertTriangle } from 'lucide-react';

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
  onCorrectLocation
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    // Validate coordinates - ensure they are valid finite numbers
    const lat = typeof latitude === 'number' ? latitude : parseFloat(String(latitude || '').trim());
    const lng = typeof longitude === 'number' ? longitude : parseFloat(String(longitude || '').trim());
    const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    
    console.log('[GoogleMap] Coordinates check:', { latitude, longitude, lat, lng, hasValidCoords, apiKey: !!apiKey });
    
    // Build Google Maps URL - prioritize exact coordinates over address search
    // Using interactive embed API instead of static image for zoom/pan capability
    let mapsUrl;
    if (hasValidCoords) {
      if (apiKey) {
        // Use Google Maps Embed API with place mode for interactive satellite view
        // This allows zoom/pan while showing the exact location
        mapsUrl = `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lng}&zoom=18&maptype=satellite`;
      } else {
        // Fallback without API key
        mapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=18&t=k&output=embed`;
      }
    } else if (address && apiKey) {
      // Use address search when no coordinates available
      const fullAddress = [address, city, state, zip]
        .filter(Boolean)
        .join(', ');
      mapsUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(fullAddress)}&zoom=18&maptype=satellite`;
    } else if (address) {
      const fullAddress = [address, city, state, zip]
        .filter(Boolean)
        .join(', ');
      mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&z=18&t=k&output=embed`;
    } else {
      return;
    }

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.width = '100%';
    iframe.height = '600';
    iframe.style.border = '0';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.src = mapsUrl;
    iframe.allowFullscreen = true;

    // Clear existing content and add iframe
    mapRef.current.innerHTML = '';
    mapRef.current.appendChild(iframe);

    return () => {
      if (mapRef.current) {
        mapRef.current.innerHTML = '';
      }
    };
  }, [address, city, state, zip, latitude, longitude]);

  return (
    <div className="space-y-4">
      {/* Back button and address info on same row - prevents overlap (Dec 11, 2025) */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            BACK TO TABLE VIEW
          </Button>
        )}
        {address && (
          <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm">
            <p className="text-sm font-semibold text-gray-900">{address}</p>
            {(city || state || zip) && (
              <p className="text-xs text-gray-600">
                {[city, state, zip].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="relative">
        <div ref={mapRef} className="w-full h-[600px] bg-gray-100 rounded-lg overflow-hidden" />
      </div>
    </div>
  );
}

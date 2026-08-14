import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

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

declare global {
  interface Window {
    google: any;
  }
}

// Track script loading globally to avoid duplicate loads
let googleMapsLoadPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  // If already loaded, return immediately
  if (window.google?.maps) {
    return Promise.resolve();
  }
  
  // If loading in progress, return existing promise
  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }
  
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    console.log('[MAPS-SCRIPT] Starting Google Maps script load...');
    console.log('[MAPS-SCRIPT] API key length:', apiKey?.length || 0);
    
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      console.log('[MAPS-SCRIPT] Existing script found, waiting for it to load...');
      // Wait for it to load
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          console.log('[MAPS-SCRIPT] Google Maps API now available from existing script');
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
      
      // Timeout after 3 seconds
      setTimeout(() => {
        clearInterval(checkLoaded);
        if (window.google?.maps) {
          resolve();
        } else {
          console.error('[MAPS-SCRIPT] Timeout waiting for existing script');
          reject(new Error('Google Maps API load timeout'));
        }
      }, 3000);
      return;
    }
    
    // Create and load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    console.log('[MAPS-SCRIPT] Loading script from:', script.src.substring(0, 80) + '...');
    
    script.onload = () => {
      console.log('[MAPS-SCRIPT] Script onload fired');
      // Wait a tick for google.maps to be fully available
      setTimeout(() => {
        console.log('[MAPS-SCRIPT] window.google:', typeof window.google);
        console.log('[MAPS-SCRIPT] window.google.maps:', typeof window.google?.maps);
        if (window.google?.maps) {
          console.log('[MAPS-SCRIPT] Google Maps API ready!');
          resolve();
        } else {
          console.error('[MAPS-SCRIPT] Script loaded but google.maps not available');
          reject(new Error('Google Maps API loaded but not available'));
        }
      }, 100);
    };
    
    script.onerror = (event) => {
      console.error('[MAPS-SCRIPT] Script load error:', event);
      googleMapsLoadPromise = null; // Allow retry
      // Remove the failed script from DOM so subsequent maps don't wait on it
      if (script.parentNode) script.parentNode.removeChild(script);
      reject(new Error('Failed to load Google Maps API script'));
    };
    
    document.head.appendChild(script);
    console.log('[MAPS-SCRIPT] Script element added to head');
  });
  
  return googleMapsLoadPromise;
}

export default function ComparablesMap({
  subjectLatitude,
  subjectLongitude,
  subjectAddress,
  comparables,
  height = '300px'
}: ComparablesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    console.log('[MAPS-DEBUG] Starting map initialization');
    console.log('[MAPS-DEBUG] API key present:', !!apiKey);
    console.log('[MAPS-DEBUG] API key length:', apiKey?.length || 0);
    console.log('[MAPS-DEBUG] Subject coords:', subjectLatitude, subjectLongitude);
    console.log('[MAPS-DEBUG] Comparables count:', comparables?.length || 0);
    
    if (!apiKey) {
      console.error('[MAPS-DEBUG] No API key configured!');
      setError('Google Maps API key not configured');
      setIsLoading(false);
      return;
    }

    if (comparables.length === 0 && (!subjectLatitude || !subjectLongitude)) {
      setError('No location data available');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initializeMap = () => {
      if (!isMounted || !mapRef.current || !window.google?.maps) {
        console.log('[MAPS] Cannot init - component unmounted or missing requirements');
        return;
      }

      // Already initialized
      if (mapInstanceRef.current) {
        console.log('[MAPS] Map already initialized');
        setIsLoading(false);
        return;
      }

      console.log('[MAPS] Initializing interactive Google Map...');

      const allLocations = [
        ...(subjectLatitude && subjectLongitude 
          ? [{ lat: subjectLatitude, lng: subjectLongitude }] 
          : []),
        ...comparables.map(c => ({ lat: c.latitude, lng: c.longitude }))
      ];

      if (allLocations.length === 0) {
        setError('No valid coordinates');
        setIsLoading(false);
        return;
      }

      const bounds = new window.google.maps.LatLngBounds();
      allLocations.forEach(loc => bounds.extend(loc));

      const center = bounds.getCenter();

      try {
        const map = new window.google.maps.Map(mapRef.current, {
          center: center,
          zoom: 12,
          mapTypeId: 'roadmap',
          gestureHandling: 'greedy',
          scrollwheel: true,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        mapInstanceRef.current = map;

        // Add subject property marker (red) - More prominent pin-style marker
        if (subjectLatitude && subjectLongitude) {
          // Create a custom red pin SVG path for subject property
          const subjectMarker = new window.google.maps.Marker({
            position: { lat: subjectLatitude, lng: subjectLongitude },
            map: map,
            title: subjectAddress || 'Subject Property',
            label: {
              text: 'S',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 'bold'
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 20,
              fillColor: '#DC2626',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 4
            },
            zIndex: 2000 // Higher than comparables to ensure visibility
          });
          
          // Add info window for subject property
          const subjectInfoWindow = new window.google.maps.InfoWindow({
            content: `<div style="padding: 8px; max-width: 220px;">
              <strong style="color: #DC2626;">📍 SUBJECT PROPERTY</strong><br/>
              <span style="font-size: 12px; color: #333;">${subjectAddress || 'Subject'}</span>
            </div>`
          });
          
          subjectMarker.addListener('click', () => {
            subjectInfoWindow.open(map, subjectMarker);
          });
          
          console.log('[MAPS] Subject marker added at:', subjectLatitude, subjectLongitude);
        }

        // Add comparable markers (blue with numbers)
        comparables.forEach((comp, index) => {
          const marker = new window.google.maps.Marker({
            position: { lat: comp.latitude, lng: comp.longitude },
            map: map,
            title: comp.address,
            label: {
              text: String(index + 1),
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 'bold'
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 18,
              fillColor: '#3B82F6',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 3
            },
            zIndex: 100
          });
          console.log('[MAPS] Comparable marker added at:', comp.latitude, comp.longitude, 'Index:', index + 1);

          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="padding: 8px; max-width: 200px;">
              <strong style="color: #1e3a5f;">#${index + 1}</strong><br/>
              <span style="font-size: 12px; color: #333;">${comp.address}</span>
              ${comp.label ? `<br/><span style="font-size: 11px; color: #666;">${comp.label}</span>` : ''}
            </div>`
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });
        });

        // Fit bounds if multiple locations
        if (allLocations.length > 1) {
          map.fitBounds(bounds);
          window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
            if (map.getZoom() > 15) {
              map.setZoom(15);
            }
          });
        }

        console.log('[MAPS] Interactive map initialized successfully');
        setIsLoading(false);
      } catch (mapError) {
        console.error('[MAPS] Error creating map:', mapError);
        setUseFallback(true);
        setIsLoading(false);
      }
    };

    // Load Google Maps script - 5 second timeout, falls back to static map
    const loadTimeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Map load timeout')), 5000)
    );
    
    Promise.race([loadGoogleMapsScript(apiKey), loadTimeout])
      .then(() => {
        console.log('[MAPS] Google Maps API loaded successfully');
        if (isMounted) {
          // Small delay to ensure DOM is ready
          setTimeout(() => initializeMap(), 100);
        }
      })
      .catch((err) => {
        console.warn('[MAPS] Falling back to static map:', err?.message || 'Load failed');
        if (isMounted) {
          setUseFallback(true);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, [subjectLatitude, subjectLongitude, subjectAddress, comparables]);

  if (error) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg text-gray-500 text-sm"
        style={{ height }}
      >
        {error}
      </div>
    );
  }

  // Fallback: Use Google Static Maps API with actual markers
  if (useFallback) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const centerLat = subjectLatitude || (comparables.length > 0 ? comparables[0].latitude : null);
    const centerLng = subjectLongitude || (comparables.length > 0 ? comparables[0].longitude : null);
    
    if (!centerLat || !centerLng) {
      return (
        <div 
          className="flex items-center justify-center bg-gray-100 rounded-lg text-gray-500 text-sm"
          style={{ height }}
        >
          No location data available
        </div>
      );
    }
    
    // Build Static Maps URL with markers
    let staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x400&maptype=roadmap&key=${apiKey}`;
    
    // Add subject marker (red)
    if (subjectLatitude && subjectLongitude) {
      staticMapUrl += `&markers=color:red%7Clabel:S%7C${subjectLatitude},${subjectLongitude}`;
    }
    
    // Add comparable markers (blue with numbers) - limit to first 9 for readability
    comparables.slice(0, 9).forEach((comp, index) => {
      staticMapUrl += `&markers=color:blue%7Clabel:${index + 1}%7C${comp.latitude},${comp.longitude}`;
    });
    
    console.log('[MAPS-FALLBACK] Using static map with markers');
    
    return (
      <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
        <img
          src={staticMapUrl}
          alt="Property location map with comparables"
          className="w-full h-full object-cover"
          style={{ minHeight: height }}
        />
        <div className="absolute bottom-2 left-2 bg-white/90 rounded-lg px-3 py-2 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm flex items-center justify-center text-[8px] font-bold text-white">S</div>
              <span className="text-gray-600">Subject</span>
            </div>
            {comparables.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                <span className="text-gray-600">Comparables ({comparables.length})</span>
              </div>
            )}
          </div>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${centerLat},${centerLng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 bg-white text-gray-700 hover:bg-gray-100 rounded px-2 py-1 text-xs shadow-sm flex items-center gap-1 cursor-pointer"
        >
          Open in Google Maps ↗
        </a>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading map...</span>
          </div>
        </div>
      )}
      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ minHeight: height }}
      />
      {!isLoading && (
        <>
          <div className="absolute bottom-2 left-2 bg-white/90 rounded-lg px-3 py-2 text-xs shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
                <span className="text-gray-600">Subject</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                <span className="text-gray-600">Comparables ({comparables.length})</span>
              </div>
            </div>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${subjectLatitude || comparables[0]?.latitude},${subjectLongitude || comparables[0]?.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 bg-white text-gray-700 hover:bg-gray-100 rounded px-2 py-1 text-xs shadow-sm flex items-center gap-1 cursor-pointer z-10"
          >
            Open in Google Maps ↗
          </a>
        </>
      )}
    </div>
  );
}

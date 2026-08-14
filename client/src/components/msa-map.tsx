import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MSALocation {
  id: string;
  msaName: string;
  county: string;
  state: string;
  productTypes: string[];
  latitude: number;
  longitude: number;
}

interface MSAMapProps {
  markets: MSALocation[];
  onMarkerClick?: (marketId: string) => void;
}

const PRODUCT_TYPE_COLORS: Record<string, string> = {
  "Active Adult": "#4A90E2",
  "BTR": "#22c55e",
  "Conventional Apartments": "#f97316",
  "Lot Development": "#eab308",
  "Multiple": "#dc2626"
};

const getMarkerColor = (productTypes: string[]): string => {
  if (productTypes.length > 1) return PRODUCT_TYPE_COLORS["Multiple"];
  return PRODUCT_TYPE_COLORS[productTypes[0]] || "#808080";
};

const createMarkerIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 14px;
      height: 14px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -7]
  });
};

export default function MSAMap({ markets, onMarkerClick }: MSAMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [39, -98],
        zoom: 4,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markets || markets.length === 0) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const validMarkets = markets.filter(
      (market) => market.latitude && market.longitude && 
                  !isNaN(market.latitude) && !isNaN(market.longitude)
    );

    if (validMarkets.length === 0) return;

    validMarkets.forEach((market) => {
      const color = getMarkerColor(market.productTypes);
      const icon = createMarkerIcon(color);

      const marker = L.marker([market.latitude, market.longitude], { icon })
        .addTo(mapRef.current!);

      const popupContent = `
        <div style="padding: 4px; min-width: 180px;">
          <h3 style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #1f2937;">${market.msaName}</h3>
          <p style="margin: 3px 0; font-size: 11px; color: #4b5563;"><strong>County:</strong> ${market.county}, ${market.state}</p>
          <p style="margin: 3px 0; font-size: 11px; color: #4b5563;"><strong>Product Types:</strong> ${market.productTypes.join(", ")}</p>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: true,
        className: 'msa-popup'
      });

      marker.on('click', () => {
        if (onMarkerClick) {
          onMarkerClick(market.id);
        }
      });

      markersRef.current.push(marker);
    });

  }, [markets, onMarkerClick]);

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border-2 border-gray-200">
      <div ref={mapContainerRef} className="w-full h-full" data-testid="msa-map-container" />
      
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs z-[1000]" data-testid="map-legend">
        <div className="font-bold mb-2 text-sm">Product Types</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#4A90E2] border-2 border-white shadow"></div>
            <span className="text-xs">Active Adult</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#22c55e] border-2 border-white shadow"></div>
            <span className="text-xs">BTR</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f97316] border-2 border-white shadow"></div>
            <span className="text-xs">Conventional Apartments</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#eab308] border-2 border-white shadow"></div>
            <span className="text-xs">Lot Development</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#dc2626] border-2 border-white shadow"></div>
            <span className="text-xs">Multiple Types</span>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2 z-[1000]" data-testid="market-count">
        <div className="text-sm font-semibold text-gray-700">
          {markets.length} Target Market{markets.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

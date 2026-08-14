import { useEffect, useRef } from "react";
import type L from "leaflet";

export interface DealForMap {
  id: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  classification?: string | null;
  dealNumber?: number | null;
  unitCount?: number | null;
  acres?: string | number | null;
}

const COLORS: Record<string, string> = {
  high_priority: "#16a34a",
  green:         "#16a34a",
  yellow:        "#d97706",
  potential:     "#d97706",
  red:           "#dc2626",
  clear_no:      "#dc2626",
};

const LABELS: Record<string, string> = {
  high_priority: "High Priority",
  green:         "High Priority",
  yellow:        "Potential",
  potential:     "Potential",
  red:           "Clear No",
  clear_no:      "Clear No",
  unclassified:  "Unclassified",
};

function getColor(cls?: string | null) {
  return COLORS[cls || ""] ?? "#6b7280";
}
function getLabel(cls?: string | null) {
  return LABELS[cls || ""] ?? "Unclassified";
}

interface DealOverviewMapProps {
  deals: DealForMap[];
  onDealClick?: (deal: DealForMap) => void;
}

export function DealOverviewMap({ deals, onDealClick }: DealOverviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const dealsWithCoords = deals.filter(
    d =>
      d.latitude != null &&
      d.longitude != null &&
      !isNaN(parseFloat(String(d.latitude))) &&
      !isNaN(parseFloat(String(d.longitude)))
  );
  const missingCount = deals.length - dealsWithCoords.length;

  const countBy = (keys: string[]) =>
    deals.filter(d => keys.includes(d.classification || "")).length;
  const unclassifiedCount = deals.filter(
    d => !d.classification || ["unclassified", ""].includes(d.classification)
  ).length;

  const legend = [
    { color: "#16a34a", label: "High Priority", count: countBy(["high_priority", "green"]) },
    { color: "#d97706", label: "Potential",      count: countBy(["yellow", "potential"]) },
    { color: "#dc2626", label: "Clear No",       count: countBy(["red", "clear_no"]) },
    { color: "#6b7280", label: "Unclassified",   count: unclassifiedCount },
  ];

  useEffect(() => {
    if (!mapContainerRef.current || dealsWithCoords.length === 0) return;

    // Dynamically import Leaflet so it never conflicts with React bundling
    import("leaflet").then((LeafletModule) => {
      const L = LeafletModule.default;

      // Import Leaflet CSS only once
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Destroy previous map instance before re-creating
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      if (!mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const latLngs: L.LatLngTuple[] = [];

      dealsWithCoords.forEach(deal => {
        const lat = parseFloat(String(deal.latitude));
        const lng = parseFloat(String(deal.longitude));
        const color = getColor(deal.classification);
        const label = getLabel(deal.classification);
        const fullAddress = [deal.address, deal.city, deal.state]
          .filter(Boolean)
          .join(", ");

        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          color: "white",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.9,
        });

        const popupHtml = `
          <div style="min-width:180px;font-family:sans-serif;font-size:13px;line-height:1.5">
            ${deal.dealNumber ? `<div style="color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.05em">Deal #${deal.dealNumber}</div>` : ""}
            <div style="font-weight:600;color:#111827;margin-bottom:3px">${fullAddress || "No address"}</div>
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
              <span style="color:${color};font-weight:500;font-size:11px">${label}</span>
            </div>
            ${deal.unitCount ? `<div style="color:#6b7280;font-size:11px">${deal.unitCount} units</div>` : ""}
            <button
              id="map-deal-${deal.id}"
              style="margin-top:6px;font-size:11px;color:#2563eb;background:none;border:none;cursor:pointer;padding:0;font-weight:500"
            >View on Google Maps →</button>
          </div>
        `;

        marker.bindPopup(popupHtml);

        marker.on("popupopen", () => {
          const btn = document.getElementById(`map-deal-${deal.id}`);
          if (btn && onDealClick) {
            btn.onclick = () => onDealClick(deal);
          }
        });

        marker.addTo(map);
        latLngs.push([lat, lng]);
      });

      // Force Leaflet to recalculate container size after the browser has painted
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
          if (latLngs.length === 1) {
            mapRef.current.setView(latLngs[0], 10);
          } else if (latLngs.length > 1) {
            mapRef.current.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], maxZoom: 12 });
          }
        }
      }, 100);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [dealsWithCoords.length]);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
        <span className="font-medium text-gray-700">
          {dealsWithCoords.length} of {deals.length} deals mapped
        </span>
        {legend.map(({ color, label, count }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                background: color,
                border: "1.5px solid white",
                outline: `1px solid ${color}`,
              }}
            />
            <span>
              {label} ({count})
            </span>
          </div>
        ))}
      </div>

      {/* Map container */}
      {dealsWithCoords.length === 0 ? (
        <div
          className="rounded-lg border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 text-gray-400"
          style={{ height: 520 }}
        >
          <svg
            className="h-10 w-10 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-sm">No deals have coordinates yet.</p>
          <p className="text-xs">Run AI analysis on deals to geocode their locations.</p>
        </div>
      ) : (
        <div
          ref={mapContainerRef}
          className="rounded-lg overflow-hidden border border-gray-200"
          style={{ height: 520 }}
        />
      )}

      {missingCount > 0 && (
        <p className="text-xs text-gray-400 text-center">
          {missingCount} deal{missingCount !== 1 ? "s" : ""} without coordinates
          are not shown on the map.
        </p>
      )}
    </div>
  );
}

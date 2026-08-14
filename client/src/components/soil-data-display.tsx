import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sprout, AlertTriangle, CheckCircle, MinusCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface SoilComponent {
  name: string;
  percentage: number;
  isMajor: boolean;
  drainageClass: string | null;
  hydricRating: string | null;
  landCapabilityClass: string | null;
  floodingFrequency: string | null;
  floodType: string | null;
  slope: number | null;
  taxClass: string | null;
  taxOrder: string | null;
}

type ConstructionSuitability = "Good" | "Moderate" | "Poor" | "Unknown";

interface SoilData {
  mapUnitName: string;
  dominantComponent: SoilComponent;
  allComponents: SoilComponent[];
  constructionSuitability: ConstructionSuitability;
  constructionNotes: string[];
  source: string;
}

interface Props {
  lat: number | string | null;
  lng: number | string | null;
  dealId: string;
}

function SuitabilityBadge({ suitability }: { suitability: ConstructionSuitability }) {
  if (suitability === "Good") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
        <CheckCircle size={10} /> Good
      </span>
    );
  }
  if (suitability === "Moderate") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800">
        <MinusCircle size={10} /> Moderate
      </span>
    );
  }
  if (suitability === "Poor") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">
        <XCircle size={10} /> Poor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
      Unknown
    </span>
  );
}

function LccBadge({ lcc }: { lcc: string | null }) {
  if (!lcc) return null;
  const n = parseInt(lcc);
  const color = n <= 4 ? "text-green-700 bg-green-50" : n <= 6 ? "text-yellow-700 bg-yellow-50" : "text-red-700 bg-red-50";
  return (
    <span className={`inline-block px-1.5 py-0 rounded text-[10px] font-semibold ${color}`}>
      Class {lcc}/8
    </span>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-2 text-xs py-0.5">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-800 text-right font-medium">{value}</span>
    </div>
  );
}

export function SoilDataDisplay({ lat, lng, dealId }: Props) {
  const [showAllComponents, setShowAllComponents] = useState(false);

  const latNum = lat ? parseFloat(String(lat)) : null;
  const lngNum = lng ? parseFloat(String(lng)) : null;
  const hasCoords = latNum !== null && lngNum !== null && !isNaN(latNum) && !isNaN(lngNum);

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ soilData: SoilData | null; message?: string }>({
    queryKey: ["/api/soil-data", latNum, lngNum],
    queryFn: async () => {
      const res = await fetch(`/api/soil-data?lat=${latNum}&lng=${lngNum}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: hasCoords,
    staleTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });

  if (!hasCoords) {
    return (
      <div className="text-xs text-gray-400 italic">
        No coordinates — soil data requires a geocoded address.
      </div>
    );
  }

  if (isLoading || isFetching) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
        <Loader2 size={13} className="animate-spin text-green-600" />
        Fetching USDA NRCS soil data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600 py-1">
        <AlertTriangle size={12} />
        Failed to load soil data.
        <button onClick={() => refetch()} className="underline hover:no-underline ml-1">Retry</button>
      </div>
    );
  }

  if (!data?.soilData) {
    return (
      <div className="text-xs text-gray-400 italic py-1">
        {data?.message ?? "No soil survey data available for this location."}
      </div>
    );
  }

  const soil = data.soilData;
  const dom = soil.dominantComponent;
  const others = soil.allComponents.slice(1);

  const hydricFlag = dom.hydricRating?.toLowerCase() === "yes";

  return (
    <div className="space-y-3">
      {/* Header: map unit name + suitability */}
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-gray-700 leading-snug">{soil.mapUnitName}</div>
        <SuitabilityBadge suitability={soil.constructionSuitability} />
      </div>

      {/* Dominant component */}
      <div className="bg-white border border-gray-100 rounded-lg p-2.5 space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5">
          Dominant Soil — {dom.name} ({dom.percentage}%)
        </div>
        <DataRow label="Drainage" value={dom.drainageClass} />
        <DataRow label="Flooding" value={dom.floodingFrequency || "None"} />
        <DataRow
          label="Hydric (Wetland)"
          value={hydricFlag ? <span className="text-amber-700 font-semibold">⚠️ Yes</span> : "No"}
        />
        <DataRow
          label="Land Capability"
          value={<LccBadge lcc={dom.landCapabilityClass} />}
        />
        {dom.slope !== null && dom.slope !== undefined && (
          <DataRow label="Slope" value={`${dom.slope}%`} />
        )}
        <DataRow label="Soil Order" value={dom.taxOrder} />
        <DataRow label="Taxonomy" value={dom.taxClass} />
      </div>

      {/* Construction flags */}
      {soil.constructionNotes.length > 0 && (
        <div className="space-y-1">
          {soil.constructionNotes.map((note, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-snug">
              <AlertTriangle size={10} className="mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Minor components */}
      {others.length > 0 && (
        <div>
          <button
            onClick={() => setShowAllComponents(!showAllComponents)}
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showAllComponents ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {showAllComponents ? "Hide" : "Show"} {others.length} minor component{others.length !== 1 ? "s" : ""}
          </button>
          {showAllComponents && (
            <div className="mt-1.5 space-y-1">
              {others.map((c, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 rounded px-2 py-1.5 text-[11px] space-y-0.5">
                  <div className="font-medium text-gray-700">
                    {c.name} <span className="text-gray-400 font-normal">({c.percentage}%)</span>
                    {c.hydricRating?.toLowerCase() === "yes" && (
                      <span className="ml-1 text-amber-700 text-[10px]">⚠️ Hydric</span>
                    )}
                  </div>
                  {c.drainageClass && <div className="text-gray-500">Drainage: {c.drainageClass}</div>}
                  {c.floodingFrequency && c.floodingFrequency.toLowerCase() !== "none" && (
                    <div className="text-gray-500">Flooding: {c.floodingFrequency}</div>
                  )}
                  {c.landCapabilityClass && <div className="text-gray-500">Land Cap: Class {c.landCapabilityClass}/8</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Source */}
      <div className="text-[9px] text-gray-400 text-right">{soil.source}</div>
    </div>
  );
}

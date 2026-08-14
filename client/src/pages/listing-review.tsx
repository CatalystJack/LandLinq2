import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, ExternalLink, MapPin, DollarSign, Ruler,
  Building2, Inbox, Search, Loader2, RefreshCw,
  SlidersHorizontal, ChevronDown, ChevronUp, Navigation2, Info,
} from "lucide-react";

type MarketState = { state: string; market_count: string };

type LoopNetListing = {
  listingId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  msa: string;
  propertyType: string;
  listingType: string;
  listingPrice: number | null;
  sizeAcres: number | null;
  squareFootage: number | null;
  daysOnMarket: number | null;
  description: string;
  listingBroker: string;
  brokerCompany: string;
  brokerEmail: string;
  sourceUrl: string;
  thumbnail: string;
  latitude: number | null;
  longitude: number | null;
  nearestMarketMiles: number | null;
  nearestMarketState: string | null;
};

type StagedListing = {
  id: string; stagedAt: string; status: string;
  address: string; city: string | null; state: string | null; zipCode: string | null;
  propertyType: string | null; listingType: string | null;
  listingPrice: string | null; sizeAcres: string | null;
  squareFootage: number | null; daysOnMarket: number | null;
  description: string | null; listingBroker: string | null;
  brokerCompany: string | null; brokerEmail: string | null;
  sourceUrl: string | null; dealId: string | null;
};

// All LoopNet property types from their "All Filters" panel
const LOOPNET_PROPERTY_TYPES = [
  "Office",
  "Industrial",
  "Retail",
  "Restaurant",
  "Shopping Center",
  "Multifamily",
  "Specialty",
  "Health Care",
  "Hospitality",
  "Sports & Entertainment",
  "Lab",
  "Land",
  "Residential Income",
];

function fmt$(v: number | string | null) {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function fmtAc(v: number | string | null) {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n) || n === 0) return "—";
  return `${n.toFixed(2)} ac`;
}

// ─── Pill button (no shadcn hover conflict) ───────────────────────────────────
function Btn({
  children, onClick, disabled, variant = "primary", size = "sm",
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "primary" | "ghost" | "outline"; size?: "sm" | "xs";
}) {
  const base = "inline-flex items-center justify-center font-medium transition-colors rounded-md disabled:opacity-50 disabled:pointer-events-none focus:outline-none";
  const sz = size === "xs" ? "px-2 py-1 text-xs gap-1" : "px-3 py-1.5 text-sm gap-1.5";
  const v =
    variant === "primary"
      ? "bg-[#4A90E2] text-white hover:bg-[#2f73c7] active:bg-[#2563b0]"
      : variant === "ghost"
      ? "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
      : "border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";
  return (
    <button className={`${base} ${sz} ${v}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────
function ListingCard({
  l, onAdd, onSkip, added, skipped, isPending,
}: {
  l: LoopNetListing; onAdd: () => void; onSkip: () => void;
  added: boolean; skipped: boolean; isPending: boolean;
}) {
  if (skipped) return null;
  const loopnetUrl = l.sourceUrl || (l.listingId ? `https://www.loopnet.com/Listing/${l.listingId}/` : '');
  const addressLine = [l.address, l.city, l.state, l.zipCode].filter(Boolean).join(', ');
  const mapThumb = l.thumbnail || (l.latitude && l.longitude
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${l.latitude},${l.longitude}&zoom=14&size=400x200&maptype=mapnik&markers=${l.latitude},${l.longitude},red-pushpin`
    : '');
  return (
    <Card className={`border shadow-sm transition-all ${added ? "opacity-60 border-green-300 dark:border-green-700" : "border-gray-200 dark:border-gray-800"}`}>
      <CardContent className="p-0 overflow-hidden">
        {/* Map thumbnail */}
        {mapThumb && (
          <a href={loopnetUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={mapThumb}
              alt={`Map for listing ${l.listingId}`}
              className="w-full h-28 object-cover bg-gray-100 dark:bg-gray-800"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </a>
        )}

        <div className="pt-3 pb-3 px-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* ID + type badge + LoopNet link */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {loopnetUrl ? (
                  <a href={loopnetUrl} target="_blank" rel="noopener noreferrer"
                    className="font-semibold text-[#4A90E2] hover:text-[#2f73c7] hover:underline text-sm font-mono flex items-center gap-1">
                    #{l.listingId}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                ) : (
                  <span className="font-semibold text-gray-800 dark:text-white text-sm font-mono">#{l.listingId}</span>
                )}
                {l.propertyType && (
                  <Badge variant="outline" className="text-xs">{l.propertyType}</Badge>
                )}
                {l.nearestMarketMiles !== null && l.nearestMarketMiles <= 75 && (
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                    <Navigation2 className="h-2.5 w-2.5 mr-0.5" />
                    {l.nearestMarketMiles}mi from market
                  </Badge>
                )}
              </div>

              {/* Real address from reverse geocoding */}
              <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1 mb-1 font-medium">
                <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
                {addressLine || (l.latitude && l.longitude ? `${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)}` : "Location unknown")}
              </p>

              {/* State / County */}
              {(l.state || l.county) && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mb-2 ml-4">
                  {[l.county ? `${l.county} County` : null, l.state].filter(Boolean).join(', ')}
                </p>
              )}

              {/* Metrics — price/acres/type/images link to LoopNet (API doesn't expose these) */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
                <a href={loopnetUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#4A90E2] hover:text-[#2f73c7] hover:underline">
                  <DollarSign className="h-3 w-3" />Price
                </a>
                <a href={loopnetUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#4A90E2] hover:text-[#2f73c7] hover:underline">
                  <Ruler className="h-3 w-3" />Acreage
                </a>
                <a href={loopnetUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#4A90E2] hover:text-[#2f73c7] hover:underline">
                  <Building2 className="h-3 w-3" />Land Use
                </a>
                <a href={loopnetUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#4A90E2] hover:text-[#2f73c7] hover:underline">
                  <ExternalLink className="h-3 w-3" />Photos
                </a>
              </div>

              {/* Nearest market context */}
              {l.msa && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Near: {l.msa}{l.county ? ` — ${l.county} County` : ""}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 shrink-0 items-end mt-0.5">
              {loopnetUrl && (
                <a href={loopnetUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 hover:text-orange-700 transition-colors mb-1 whitespace-nowrap">
                  <ExternalLink className="h-3 w-3" />
                  Open on LoopNet
                </a>
              )}
              {added ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs whitespace-nowrap">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> In Pipeline
                </Badge>
              ) : (
                <>
                  <Btn variant="primary" size="xs" disabled={isPending} onClick={onAdd}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Add
                  </Btn>
                  <Btn variant="ghost" size="xs" disabled={isPending} onClick={onSkip}>
                    <XCircle className="h-3.5 w-3.5" /> Skip
                  </Btn>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Staged Queue Card ────────────────────────────────────────────────────────
function StagedCard({ l, onApprove, onReject, isPending }: {
  l: StagedListing; onApprove: () => void; onReject: () => void; isPending: boolean;
}) {
  return (
    <Card className="border border-gray-200 dark:border-gray-800 shadow-sm">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-semibold text-gray-900 dark:text-white text-sm">{l.address}</span>
              {l.propertyType && <Badge variant="outline" className="text-xs">{l.propertyType}</Badge>}
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
              <MapPin className="h-3 w-3" />{[l.city, l.state, l.zipCode].filter(Boolean).join(", ") || "—"}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-gray-400" /><strong>{fmt$(l.listingPrice)}</strong></span>
              <span className="flex items-center gap-1"><Ruler className="h-3 w-3 text-gray-400" />{fmtAc(l.sizeAcres)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0 items-end">
            {l.sourceUrl && (
              <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#4A90E2] hover:text-[#2f73c7]">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {l.status === "approved" ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">In Pipeline</Badge>
            ) : (
              <>
                <Btn variant="primary" size="xs" disabled={isPending} onClick={onApprove}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Add
                </Btn>
                <Btn variant="ghost" size="xs" disabled={isPending} onClick={onReject}>
                  <XCircle className="h-3.5 w-3.5" /> Skip
                </Btn>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ListingReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Pre-search filters (sent to API) ───────────────────────────────────────
  const [selectedState, setSelectedState] = useState("");
  const [selectedPropTypes, setSelectedPropTypes] = useState<string[]>([]);

  // ── Search state ───────────────────────────────────────────────────────────
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LoopNetListing[] | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  // ── Post-search filters (client-side on results) ───────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [filterMsa, setFilterMsa] = useState("");
  const [filterCounty, setFilterCounty] = useState("");
  const [filterMaxMiles, setFilterMaxMiles] = useState("");

  // ── Staged queue ───────────────────────────────────────────────────────────
  const [stagedStatus, setStagedStatus] = useState<"pending" | "approved">("pending");

  // Market states
  const { data: marketData } = useQuery<{ states: MarketState[] }>({
    queryKey: ["/api/listings/market-states"],
    queryFn: () => fetch("/api/listings/market-states", { credentials: "include" }).then(r => r.json()),
  });
  const marketStates = marketData?.states ?? [];

  // Staged listings
  const { data: stagedData, isLoading: stagedLoading } = useQuery<{ listings: StagedListing[] }>({
    queryKey: ["/api/listings/staged", stagedStatus],
    queryFn: () => fetch(`/api/listings/staged?status=${stagedStatus}`, { credentials: "include" }).then(r => r.json()),
  });
  const stagedListings = stagedData?.listings ?? [];

  // Toggle property type selection
  const togglePropType = (t: string) => {
    setSelectedPropTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  // Client-side filters on search results
  const filteredResults = useMemo(() => {
    if (!searchResults) return null;
    return searchResults.filter(l => {
      // State selector filters to specific SE state when chosen
      if (selectedState && l.state && l.state !== selectedState) return false;
      if (filterMsa && !(l.msa || "").toLowerCase().includes(filterMsa.toLowerCase()) &&
          !(l.city || "").toLowerCase().includes(filterMsa.toLowerCase())) return false;
      if (filterCounty && !(l.county || "").toLowerCase().includes(filterCounty.toLowerCase())) return false;
      if (filterMaxMiles && l.nearestMarketMiles !== null &&
          l.nearestMarketMiles > parseInt(filterMaxMiles)) return false;
      // If post-search prop type filter active (user didn't pre-filter), apply here
      if (selectedPropTypes.length > 0 && l.propertyType &&
          !selectedPropTypes.some(t => l.propertyType.toLowerCase().includes(t.toLowerCase()))) return false;
      return true;
    });
  }, [searchResults, filterMsa, filterCounty, filterMaxMiles, selectedPropTypes]);

  const activePostFilterCount = [filterMsa, filterCounty, filterMaxMiles].filter(Boolean).length;

  function clearPostFilters() {
    setFilterMsa(""); setFilterCounty(""); setFilterMaxMiles("");
  }

  async function handleSearch() {
    setSearching(true); setSearchResults(null);
    setAddedIds(new Set()); setSkippedIds(new Set()); clearPostFilters();
    try {
      const res = await fetch("/api/listings/loopnet-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          state: selectedState,
          listingType: "sale",
          propertyType: selectedPropTypes.length === 1 ? selectedPropTypes[0] : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setSearchResults(data.listings ?? []);
      setSearchTotal(data.total ?? 0);
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  async function addToPipeline(l: LoopNetListing) {
    setAddingId(l.listingId);
    try {
      const payload = {
        listingId: l.listingId,
        address: l.address || `LoopNet Listing #${l.listingId}`,
        city: l.city,
        state: l.state,
        zipCode: l.zipCode,
        propertyType: l.propertyType,
        listingPrice: l.listingPrice,
        sizeAcres: l.sizeAcres,
        squareFootage: l.squareFootage,
        daysOnMarket: l.daysOnMarket,
        description: l.description || `LoopNet listing near ${l.msa || l.city} — ${l.county ? l.county + ' County, ' : ''}${l.state}`,
        listingBroker: l.listingBroker,
        brokerCompany: l.brokerCompany,
        brokerEmail: l.brokerEmail,
        sourceUrl: l.sourceUrl,
        latitude: l.latitude,
        longitude: l.longitude,
        listingType: l.listingType,
      };
      const res = await fetch("/api/listings/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAddedIds(prev => new Set([...prev, l.listingId]));
      toast({ title: "Added to pipeline", description: `Deal #${data.dealNumber ?? "—"} — View on LoopNet to see details` });
    } catch (e: any) {
      toast({ title: "Failed to add", description: e.message, variant: "destructive" });
    } finally {
      setAddingId(null);
    }
  }

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/listings/staged/${id}/approve`, { method: "POST", credentials: "include" });
      const j = await res.json(); if (!res.ok) throw new Error(j.error); return j;
    },
    onSuccess: d => { toast({ title: "Added to pipeline", description: `Deal #${d.dealNumber ?? "—"}` }); queryClient.invalidateQueries({ queryKey: ["/api/listings/staged"] }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/listings/staged/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { toast({ title: "Listing skipped" }); queryClient.invalidateQueries({ queryKey: ["/api/listings/staged"] }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const pendingCount = stagedListings.filter(l => l.status === "pending").length;
  const displayResults = filteredResults ?? searchResults ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">LoopNet Market Review</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Browse active LoopNet for-sale listings in NC, SC, FL, GA, TN, and VA. Click <strong>Open on LoopNet</strong> or the listing ID to see price, acreage, images, and land use. Click <strong>Add</strong> to push to your pipeline.
          </p>
          {/* API notice */}
          <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              LoopNet's API only returns listing IDs and coordinates — price, acreage, images, and land use are on the listing page itself. Click <strong>"Open on LoopNet"</strong> or the listing ID on any card to view the full details. Results are filtered to NC, SC, FL, GA, TN, and VA by coordinate.
            </span>
          </div>
        </div>

        <Tabs defaultValue="search">
          <TabsList className="mb-6">
            <TabsTrigger value="search" className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" /> Search Markets
            </TabsTrigger>
            <TabsTrigger value="staged" className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Staged Queue
              {pendingCount > 0 && (
                <Badge className="ml-1 bg-blue-500 text-white text-xs h-4 px-1.5">{pendingCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Search Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="search">
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4 text-[#4A90E2]" /> For-sale listings — SE markets
                </CardTitle>
                <CardDescription>Optionally filter by property type, then search. Results are limited to NC, SC, FL, GA, TN, and VA.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* State picker + search button */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Select value={selectedState || "ALL"} onValueChange={v => setSelectedState(v === "ALL" ? "" : v)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All SE states" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All SE states</SelectItem>
                        {marketStates
                          .filter(m => ["NC","SC","FL","GA","TN","VA"].includes(m.state))
                          .map(m => (
                            <SelectItem key={m.state} value={m.state}>
                              {m.state} <span className="text-gray-400 ml-1">({m.market_count} markets)</span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {selectedState && (
                      <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setSelectedState("")}>
                        ✕ Clear
                      </button>
                    )}
                  </div>
                  <Btn variant="primary" onClick={handleSearch} disabled={searching}>
                    {searching
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</>
                      : <><Search className="h-4 w-4" /> Search LoopNet</>}
                  </Btn>
                  {searchResults !== null && !searching && (
                    <span className="text-sm text-gray-500">
                      {searchTotal.toLocaleString()} listings found
                    </span>
                  )}
                </div>

                {/* Property type checkboxes — LoopNet's native types */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Property Type / Land Use
                    {selectedPropTypes.length > 0 && (
                      <button className="ml-2 text-[#4A90E2] hover:underline" onClick={() => setSelectedPropTypes([])}>
                        Clear ({selectedPropTypes.length})
                      </button>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {LOOPNET_PROPERTY_TYPES.map(t => (
                      <label key={t} className="flex items-center gap-1.5 cursor-pointer group">
                        <Checkbox
                          checked={selectedPropTypes.includes(t)}
                          onCheckedChange={() => togglePropType(t)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900">
                          {t}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Post-search result filters (MSA / county / miles) */}
            {searchResults !== null && !searching && (
              <Card className="mb-4">
                <CardContent className="pt-3 pb-3 px-4">
                  <button
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 w-full text-left"
                    onClick={() => setShowFilters(f => !f)}
                  >
                    <SlidersHorizontal className="h-4 w-4 text-[#4A90E2]" />
                    Filter results
                    {activePostFilterCount > 0 && (
                      <Badge className="bg-[#4A90E2] text-white text-xs h-4 px-1.5">{activePostFilterCount}</Badge>
                    )}
                    {showFilters ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
                  </button>

                  {showFilters && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">MSA / Metro</Label>
                        <Input placeholder="e.g. Charlotte" value={filterMsa}
                          onChange={e => setFilterMsa(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">County</Label>
                        <Input placeholder="e.g. Mecklenburg" value={filterCounty}
                          onChange={e => setFilterCounty(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Max Miles from Market</Label>
                        <Input type="number" placeholder="e.g. 25" value={filterMaxMiles}
                          onChange={e => setFilterMaxMiles(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="flex items-end">
                        <Btn variant="outline" size="xs" onClick={clearPostFilters}>Clear filters</Btn>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* States */}
            {!searchResults && !searching && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <Search className="h-10 w-10 opacity-30" />
                <div className="text-center">
                  <p className="text-sm font-medium">Click Search LoopNet to load listings</p>
                  <p className="text-xs mt-1 text-gray-400">Returns active for-sale listings in NC, SC, FL, GA, TN, and VA. Click "View" to see full details, "Add" to send to your pipeline.</p>
                </div>
              </div>
            )}
            {searching && (
              <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Fetching for-sale listings from LoopNet…</span>
              </div>
            )}
            {searchResults !== null && !searching && displayResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                <Inbox className="h-10 w-10 opacity-30" />
                <p className="text-sm">
                  {activePostFilterCount > 0
                    ? "No listings match your filters."
                    : "No for-sale listings found in NC, SC, FL, GA, TN, or VA. The API may be temporarily returning off-target data."}
                </p>
                {activePostFilterCount > 0 && <Btn variant="outline" size="xs" onClick={clearPostFilters}>Clear filters</Btn>}
              </div>
            )}

            {/* Results */}
            {searchResults !== null && !searching && displayResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">
                    <strong className="text-gray-700 dark:text-gray-300">{displayResults.length}</strong> listings
                    {activePostFilterCount > 0 && <span className="ml-1">(filtered from {searchResults.length})</span>}
                    {" — click "}
                    <strong>View</strong> to open on LoopNet, <strong>Add</strong> to pipeline, <strong>Skip</strong> to hide
                  </p>
                  <Btn variant="outline" size="xs" onClick={handleSearch}>
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Btn>
                </div>
                {displayResults.map(l => (
                  <ListingCard
                    key={l.listingId}
                    l={l}
                    added={addedIds.has(l.listingId)}
                    skipped={skippedIds.has(l.listingId)}
                    isPending={addingId === l.listingId}
                    onAdd={() => addToPipeline(l)}
                    onSkip={() => setSkippedIds(prev => new Set([...prev, l.listingId]))}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Staged Queue Tab ───────────────────────────────────────────── */}
          <TabsContent value="staged">
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#4A90E2]" /> Manually Staged Listings
                    </CardTitle>
                    <CardDescription>Listings staged from the Data Hub for review before pipeline.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Btn variant={stagedStatus === "pending" ? "primary" : "outline"} size="xs" onClick={() => setStagedStatus("pending")}>Pending</Btn>
                    <Btn variant={stagedStatus === "approved" ? "primary" : "outline"} size="xs" onClick={() => setStagedStatus("approved")}>Approved</Btn>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {stagedLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : stagedListings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <Inbox className="h-10 w-10 opacity-30" />
                <p className="text-sm">{stagedStatus === "pending" ? "No listings waiting for review." : "No approved listings yet."}</p>
                {stagedStatus === "pending" && (
                  <a href="/data-hub" className="text-[#4A90E2] hover:underline text-sm">→ Stage listings from Data Hub / Live Listings</a>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {stagedListings.map(l => (
                  <StagedCard key={l.id} l={l}
                    isPending={approveMutation.isPending || rejectMutation.isPending}
                    onApprove={() => approveMutation.mutate(l.id)}
                    onReject={() => rejectMutation.mutate(l.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

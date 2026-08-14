import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Brain, Building2, RefreshCw, Newspaper, AlertTriangle, TrendingUp,
  MapPin, ExternalLink, Trash2, Upload, FileText, CheckCircle,
  Clock, Search, ChevronDown, ChevronUp, Info, Loader2, Eye,
  EyeOff, DollarSign, Layers, Filter, Target, UserCheck, Copy,
  Archive, SlidersHorizontal, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZoningItem {
  id: string; market: string; meetingDate?: string; caseNumber?: string;
  applicantName?: string; developerName?: string; propertyAddress?: string;
  requestType?: string; currentZoning?: string; proposedZoning?: string;
  acreage?: string; projectDescription?: string; staffRecommendation?: string;
  status?: string; sourceUrl?: string; aiSummary?: string; alertLevel?: string;
  createdAt: string;
}

interface MarketListing {
  id: string; market: string; address?: string; city?: string;
  askingPrice?: number; acreage?: string; pricePerAcre?: number;
  daysOnMarket?: number; isExpired?: boolean; description?: string;
  brokerName?: string; sourceUrl?: string; aiSignal?: string;
  zoning?: string; fetchedAt: string;
}

interface PermitSignal {
  id: string; market: string; permitNumber?: string; propertyAddress?: string;
  ownerName?: string; applicantName?: string; permitType?: string;
  description?: string; issueDate?: string; lastActivityDate?: string;
  daysInactive?: number; estimatedCost?: number; signalType?: string;
  county?: string; aiSummary?: string; flaggedAt: string;
}

interface NewsItem {
  id: string; market?: string; headline: string; summary?: string;
  sourceUrl?: string; sourceName?: string; publishedAt?: string;
  relevanceScore?: number; signalType?: string; aiAnalysis?: string;
  isRead?: boolean; fetchedAt: string;
}

interface Opportunity {
  id: string; market: string; address?: string; city?: string;
  ownerName?: string; ownerType?: string;
  lastSaleDate?: string; yearsHeld?: string | number;
  acreage?: string | number; currentZoning?: string; landUse?: string;
  assessedValue?: number; parcelId?: string;
  latitude?: string; longitude?: string;
  source?: string; notes?: string; addedAt: string;
}

interface ParcelResult {
  parcelId: string; address: string; ownerName: string;
  ownerType: string; ownerLabel: string; isTarget: boolean;
  lastSaleDate: string | null; yearsHeld: number | null;
  acreage: number | null; currentZoning: string; landUse: string;
  assessedValue: number | null; latitude: number | null; longitude: number | null;
  source: string;
}

interface ScreenResult {
  inputAddress: string; geocodedAddress?: string;
  parcel?: ParcelResult; error?: string; skipped?: boolean; skipReason?: string;
}

interface MarketSummary {
  zoningCount: number; listingsCount: number; permitsCount: number;
  newsCount: number; unreadNews: number;
}

type MarketKey = "all" | "wilmington" | "raleigh_durham" | "charlotte" | "asheville";

// ── Market Config ─────────────────────────────────────────────────────────────

const MARKETS: { key: MarketKey; label: string; county: string; color: string }[] = [
  { key: "all", label: "All Markets", county: "NC", color: "bg-slate-600" },
  { key: "wilmington", label: "Wilmington", county: "New Hanover County", color: "bg-teal-600" },
  { key: "raleigh_durham", label: "Raleigh / Durham", county: "Wake + Durham County", color: "bg-blue-600" },
  { key: "charlotte", label: "Charlotte", county: "Mecklenburg County", color: "bg-purple-600" },
  { key: "asheville", label: "Asheville", county: "Buncombe County", color: "bg-orange-600" },
];

const PORTAL_LINKS: Record<string, { label: string; url: string }> = {
  wilmington: { label: "New Hanover County Permit Portal", url: "https://nhcpermitting.nhcgov.com" },
  raleigh_durham: { label: "Wake County Permits Online", url: "https://services.wakegov.com/permits" },
  charlotte: { label: "Charlotte Permits Online", url: "https://clt.permits.online" },
  asheville: { label: "Asheville Development Services", url: "https://www.ashevillenc.gov/department/development-services/building-safety/permits-inspections/" },
};

const ZONING_LINKS: Record<string, { label: string; url: string }[]> = {
  wilmington: [
    { label: "Wilmington Planning Commission", url: "https://www.wilmingtonnc.gov/government/boards-and-commissions/planning-commission" },
    { label: "New Hanover County Planning Board", url: "https://www.nhcgov.com/241/Planning-Board" },
    { label: "NHC iROCS Permit Portal", url: "https://nhcpermitting.nhcgov.com/EnerGov_Prod/SelfService" },
  ],
  raleigh_durham: [
    { label: "Raleigh Planning Commission", url: "https://raleighnc.gov/planning/planning-commission" },
    { label: "Durham Legistar (Agendas)", url: "https://durham.legistar.com/Calendar.aspx" },
    { label: "Wake County Rezoning Cases", url: "https://www.wake.gov/departments-government/planning-development-inspections/rezoning" },
  ],
  charlotte: [
    { label: "Charlotte Legistar (Agendas)", url: "https://charlotte.legistar.com/Calendar.aspx" },
    { label: "Charlotte Development Activity", url: "https://charlottenc.gov/Services/permit-and-development/Planning/development-activity" },
    { label: "Mecklenburg Planning", url: "https://www.mecknc.gov/LUESA/PlanningDepartment/Pages/Home.aspx" },
  ],
  asheville: [
    { label: "Asheville Planning & Zoning Commission", url: "https://www.ashevillenc.gov/government/boards-and-commissions/planning-and-zoning-commission/" },
    { label: "Buncombe County Planning", url: "https://www.buncombecounty.org/governing/depts/planning/planning.aspx" },
    { label: "Asheville Development Services", url: "https://www.ashevillenc.gov/department/development-services/" },
  ],
};

const OWNER_TYPE_COLORS: Record<string, string> = {
  individual: "bg-green-100 text-green-800",
  family_llc: "bg-green-100 text-green-800",
  small_llc: "bg-blue-100 text-blue-800",
  trust: "bg-purple-100 text-purple-800",
  developer: "bg-red-100 text-red-800",
  corporate: "bg-slate-100 text-slate-700",
  government: "bg-slate-100 text-slate-600",
  unknown: "bg-slate-100 text-slate-500",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n?: number | null) {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function alertColor(level?: string) {
  if (level === "high") return "bg-red-100 text-red-800 border-red-200";
  if (level === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-green-100 text-green-800 border-green-200";
}

function signalColor(type?: string) {
  if (!type) return "bg-slate-100 text-slate-700";
  if (type.includes("stalled") || type === "distress") return "bg-red-100 text-red-700";
  if (type === "new_issued" || type === "development_activity") return "bg-green-100 text-green-700";
  if (type === "rezoning" || type === "market_shift") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function scoreColor(score?: number) {
  if (!score) return "text-slate-400";
  if (score >= 80) return "text-green-600 font-bold";
  if (score >= 60) return "text-yellow-600 font-semibold";
  return "text-slate-500";
}

function marketLabel(key?: string) {
  return MARKETS.find((m) => m.key === key)?.label || key || "—";
}

function ownerTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    individual: "Individual",
    family_llc: "Family LLC",
    small_llc: "Small LLC",
    trust: "Trust / Estate",
    developer: "Developer",
    corporate: "Corporate",
    government: "Government",
    unknown: "Unknown",
  };
  return labels[type || "unknown"] || type || "Unknown";
}

function copyToClipboard(text: string, toast: any) {
  navigator.clipboard.writeText(text).then(() => {
    toast({ title: "Copied to clipboard" });
  });
}

function exportToCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketIntelligence() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMarket, setSelectedMarket] = useState<MarketKey>("all");
  const [activeTab, setActiveTab] = useState("zoning");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Upload dialogs
  const [zoningUploadOpen, setZoningUploadOpen] = useState(false);
  const [permitUploadOpen, setPermitUploadOpen] = useState(false);
  const [zoningText, setZoningText] = useState("");
  const [zoningUploadMarket, setZoningUploadMarket] = useState<MarketKey>("charlotte");
  const [permitUploadMarket, setPermitUploadMarket] = useState<MarketKey>("charlotte");
  const [zoningFile, setZoningFile] = useState<File | null>(null);
  const [permitFile, setPermitFile] = useState<File | null>(null);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState<Record<string, boolean>>({});
  const [zoningFilter, setZoningFilter] = useState({ alertLevel: "all", requestType: "all" });
  const [listingsFilter, setListingsFilter] = useState({ minDOM: "", maxPrice: "", minAcres: "", maxAcres: "" });
  const [permitsFilter, setPermitsFilter] = useState({ signalType: "all" });
  const [newsFilter, setNewsFilter] = useState({ minScore: "", signalType: "all" });

  // ── Opportunity Finder state ───────────────────────────────────────────────
  const [oppMarket, setOppMarket] = useState<Exclude<MarketKey, "all">>("raleigh_durham");
  const [oppMinAcres, setOppMinAcres] = useState("2");
  const [oppMaxAcres, setOppMaxAcres] = useState("");
  const [oppMinYears, setOppMinYears] = useState("5");
  const [oppOnlyTarget, setOppOnlyTarget] = useState(true);
  const [oppSearchResults, setOppSearchResults] = useState<ParcelResult[]>([]);
  const [oppSearchDone, setOppSearchDone] = useState(false);
  const [oppWarning, setOppWarning] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [screenResults, setScreenResults] = useState<ScreenResult[]>([]);
  const [screenDone, setScreenDone] = useState(false);
  const [showScreener, setShowScreener] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const marketParam = selectedMarket === "all" ? "" : `?market=${selectedMarket}`;

  const { data: summary = {} } = useQuery<Record<string, MarketSummary>>({
    queryKey: ["/api/market-intelligence/summary"],
  });

  const { data: zoningItems = [], isLoading: zoningLoading } = useQuery<ZoningItem[]>({
    queryKey: ["/api/market-intelligence/zoning", selectedMarket],
    queryFn: () => fetch(`/api/market-intelligence/zoning${marketParam}`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery<MarketListing[]>({
    queryKey: ["/api/market-intelligence/listings", selectedMarket],
    queryFn: () => fetch(`/api/market-intelligence/listings${marketParam}`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: permits = [], isLoading: permitsLoading } = useQuery<PermitSignal[]>({
    queryKey: ["/api/market-intelligence/permits", selectedMarket],
    queryFn: () => fetch(`/api/market-intelligence/permits${marketParam}`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: news = [], isLoading: newsLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/market-intelligence/news", selectedMarket],
    queryFn: () => fetch(`/api/market-intelligence/news${marketParam}`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: savedOpportunities = [], isLoading: oppLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/market-intelligence/opportunities", selectedMarket],
    queryFn: () => fetch(`/api/market-intelligence/opportunities${marketParam}`, { credentials: "include" }).then((r) => r.json()),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const zoningFetch = useMutation({
    mutationFn: (market: string) => apiRequest("POST", "/api/market-intelligence/zoning/fetch", { market }),
    onSuccess: (data: any) => {
      toast({ title: "Zoning scan complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/zoning"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/summary"] });
    },
    onError: (e: any) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const listingsFetch = useMutation({
    mutationFn: (market: string) => apiRequest("POST", "/api/market-intelligence/listings/refresh", { market }),
    onSuccess: (data: any) => {
      toast({ title: "Listings refreshed", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/summary"] });
    },
    onError: (e: any) => toast({ title: "Refresh failed", description: e.message, variant: "destructive" }),
  });

  const newsFetch = useMutation({
    mutationFn: (market: string) => apiRequest("POST", "/api/market-intelligence/news/refresh", { market }),
    onSuccess: (data: any) => {
      toast({ title: "News updated", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/summary"] });
    },
    onError: (e: any) => toast({ title: "Refresh failed", description: e.message, variant: "destructive" }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/market-intelligence/news/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/news"] }),
  });

  const deleteItem = useMutation({
    mutationFn: ({ type, id }: { type: string; id: string }) =>
      apiRequest("DELETE", `/api/market-intelligence/${type}/${id}`, {}),
    onSuccess: (_data, vars) => {
      toast({ title: "Deleted" });
      queryClient.invalidateQueries({ queryKey: [`/api/market-intelligence/${vars.type}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/summary"] });
    },
  });

  const zoningUpload = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("market", zoningUploadMarket);
      if (zoningFile) form.append("file", zoningFile);
      else form.append("rawText", zoningText);
      const res = await fetch("/api/market-intelligence/zoning/upload", {
        method: "POST", body: form, credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Upload complete", description: data.message });
      setZoningUploadOpen(false); setZoningText(""); setZoningFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/zoning"] });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const permitUpload = useMutation({
    mutationFn: async () => {
      if (!permitFile) throw new Error("No file selected");
      const form = new FormData();
      form.append("market", permitUploadMarket);
      form.append("file", permitFile);
      const res = await fetch("/api/market-intelligence/permits/upload", {
        method: "POST", body: form, credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Permits imported", description: data.message });
      setPermitUploadOpen(false); setPermitFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/permits"] });
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const oppSearch = useMutation({
    mutationFn: () => apiRequest("POST", "/api/market-intelligence/opportunities/search", {
      market: oppMarket,
      minAcres: parseFloat(oppMinAcres) || 2,
      maxAcres: oppMaxAcres ? parseFloat(oppMaxAcres) : undefined,
      minYears: parseFloat(oppMinYears) || 5,
      onlyTargetOwners: oppOnlyTarget,
      save: true,
    }),
    onSuccess: (data: any) => {
      setOppSearchResults(data.results || []);
      setOppWarning(data.warning || "");
      setOppSearchDone(true);
      if (data.total > 0) {
        toast({ title: `Found ${data.total} opportunities`, description: `Parcels saved to Opportunity list` });
        queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/opportunities"] });
      } else {
        toast({ title: "No results", description: data.warning || "No parcels matched your criteria", variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Search failed", description: e.message, variant: "destructive" }),
  });

  const oppScreen = useMutation({
    mutationFn: () => {
      const addresses = addressInput.split("\n").map((a) => a.trim()).filter(Boolean);
      return apiRequest("POST", "/api/market-intelligence/opportunities/screen", {
        market: oppMarket,
        addresses,
        minYears: parseFloat(oppMinYears) || 5,
      });
    },
    onSuccess: (data: any) => {
      setScreenResults(data.results || []);
      setScreenDone(true);
      const hits = (data.results || []).filter((r: ScreenResult) => !r.error && !r.skipped).length;
      toast({ title: `Screened ${data.screened} addresses`, description: `${hits} passed filters` });
    },
    onError: (e: any) => toast({ title: "Screening failed", description: e.message, variant: "destructive" }),
  });

  const saveOpp = useMutation({
    mutationFn: (p: ParcelResult) => apiRequest("POST", "/api/market-intelligence/opportunities", {
      market: oppMarket, address: p.address, ownerName: p.ownerName, ownerType: p.ownerType,
      lastSaleDate: p.lastSaleDate, yearsHeld: p.yearsHeld, acreage: p.acreage,
      currentZoning: p.currentZoning, assessedValue: p.assessedValue, parcelId: p.parcelId,
      latitude: p.latitude, longitude: p.longitude, landUse: p.landUse, source: p.source,
    }),
    onSuccess: () => {
      toast({ title: "Saved to opportunities" });
      queryClient.invalidateQueries({ queryKey: ["/api/market-intelligence/opportunities"] });
    },
  });

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filteredZoning = zoningItems.filter((z) => {
    if (zoningFilter.alertLevel !== "all" && z.alertLevel !== zoningFilter.alertLevel) return false;
    if (zoningFilter.requestType !== "all" && z.requestType !== zoningFilter.requestType) return false;
    return true;
  });

  const filteredListings = listings.filter((l) => {
    if (listingsFilter.minDOM && (l.daysOnMarket ?? 0) < parseInt(listingsFilter.minDOM)) return false;
    if (listingsFilter.maxPrice && l.askingPrice && l.askingPrice > parseInt(listingsFilter.maxPrice) * 1000) return false;
    if (listingsFilter.minAcres && parseFloat(l.acreage ?? "0") < parseFloat(listingsFilter.minAcres)) return false;
    if (listingsFilter.maxAcres && parseFloat(l.acreage ?? "0") > parseFloat(listingsFilter.maxAcres)) return false;
    return true;
  });

  const filteredPermits = permits.filter((p) => {
    if (permitsFilter.signalType !== "all" && p.signalType !== permitsFilter.signalType) return false;
    return true;
  });

  const filteredNews = news.filter((n) => {
    if (newsFilter.minScore && (n.relevanceScore ?? 0) < parseInt(newsFilter.minScore)) return false;
    if (newsFilter.signalType !== "all" && n.signalType !== newsFilter.signalType) return false;
    return true;
  });

  const zoningRequestTypes = [...new Set(zoningItems.map((z) => z.requestType).filter(Boolean))];

  const scanAllMarkets = async (type: "zoning" | "listings" | "news") => {
    const markets: Exclude<MarketKey, "all">[] = ["wilmington", "raleigh_durham", "charlotte", "asheville"];
    for (const m of markets) {
      if (type === "zoning") await zoningFetch.mutateAsync(m);
      else if (type === "listings") await listingsFetch.mutateAsync(m);
      else await newsFetch.mutateAsync(m);
    }
  };

  const targetMarkets: MarketKey[] =
    selectedMarket === "all" ? ["wilmington", "raleigh_durham", "charlotte", "asheville"] : [selectedMarket];

  const isBusy = zoningFetch.isPending || listingsFetch.isPending || newsFetch.isPending ||
    zoningUpload.isPending || permitUpload.isPending;

  function toggleFilter(tab: string) {
    setShowFilters((prev) => ({ ...prev, [tab]: !prev[tab] }));
  }

  function hasActiveFilter(tab: string) {
    if (tab === "zoning") return zoningFilter.alertLevel !== "all" || zoningFilter.requestType !== "all";
    if (tab === "listings") return !!(listingsFilter.minDOM || listingsFilter.maxPrice || listingsFilter.minAcres || listingsFilter.maxAcres);
    if (tab === "permits") return permitsFilter.signalType !== "all";
    if (tab === "news") return !!(newsFilter.minScore || newsFilter.signalType !== "all");
    return false;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Brain className="h-7 w-7 text-blue-700" />
              <h1 className="text-2xl font-bold text-slate-900">NC Market Intelligence</h1>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">Beta</Badge>
            </div>
            <p className="text-slate-500 text-sm">
              AI-powered land site sourcing across Wilmington, Raleigh/Durham, Charlotte & Asheville
            </p>
          </div>
        </div>

        {/* Market Selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {MARKETS.map((m) => {
            const s = summary[m.key];
            const isActive = selectedMarket === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMarket(m.key)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-700 text-white border-blue-700 shadow-md"
                    : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                {m.label}
                {m.key !== "all" && s && (s.zoningCount + s.listingsCount + s.permitsCount + s.newsCount) > 0 && (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-blue-600" : "bg-slate-100"}`}>
                    {s.zoningCount + s.listingsCount + s.permitsCount + s.newsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-3xl mb-6 bg-white border border-slate-200 shadow-sm">
            <TabsTrigger value="zoning" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Building2 className="h-4 w-4" /> Zoning
              {selectedMarket !== "all" && summary[selectedMarket]?.zoningCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{summary[selectedMarket].zoningCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="listings" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Search className="h-4 w-4" /> Listings
              {selectedMarket !== "all" && summary[selectedMarket]?.listingsCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{summary[selectedMarket].listingsCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="permits" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Layers className="h-4 w-4" /> Permits
              {selectedMarket !== "all" && summary[selectedMarket]?.permitsCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{summary[selectedMarket].permitsCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="news" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Newspaper className="h-4 w-4" /> News
              {selectedMarket !== "all" && summary[selectedMarket]?.unreadNews > 0 && (
                <Badge className="ml-1 text-xs bg-red-500 text-white">{summary[selectedMarket].unreadNews}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Finder</span>
              {savedOpportunities.length > 0 && (
                <Badge className="ml-1 text-xs bg-emerald-500 text-white">{savedOpportunities.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── ZONING TAB ───────────────────────────────────────────────────── */}
          <TabsContent value="zoning">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Zoning & Planning Agendas</h2>
                <p className="text-sm text-slate-500">AI scans Google News for zoning/rezoning activity, or paste/upload an agenda PDF directly.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleFilter("zoning")}
                  className={hasActiveFilter("zoning") ? "border-blue-400 text-blue-700" : ""}>
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Filter {hasActiveFilter("zoning") && <span className="ml-1 w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                </Button>
                <Dialog open={zoningUploadOpen} onOpenChange={setZoningUploadOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1.5" /> Upload Agenda</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Upload Zoning Agenda</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Market</Label>
                        <Select value={zoningUploadMarket} onValueChange={(v) => setZoningUploadMarket(v as MarketKey)}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MARKETS.filter((m) => m.key !== "all").map((m) => (
                              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Upload PDF or paste text</Label>
                        <Input type="file" accept=".pdf,.txt" className="mt-1"
                          onChange={(e) => setZoningFile(e.target.files?.[0] || null)} />
                      </div>
                      <div>
                        <Label>Or paste agenda text directly</Label>
                        <Textarea className="mt-1 h-32" placeholder="Paste agenda content here..."
                          value={zoningText} onChange={(e) => setZoningText(e.target.value)} />
                      </div>
                      <Button className="w-full" onClick={() => zoningUpload.mutate()} disabled={zoningUpload.isPending || (!zoningFile && !zoningText)}>
                        {zoningUpload.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : "Extract Agenda Items with AI"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button size="sm" onClick={() => selectedMarket === "all" ? scanAllMarkets("zoning") : zoningFetch.mutate(selectedMarket)}
                  disabled={zoningFetch.isPending}>
                  {zoningFetch.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                  Scan {selectedMarket === "all" ? "All" : ""}
                </Button>
              </div>
            </div>

            {/* Filter panel */}
            {showFilters.zoning && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs text-slate-500">Alert Level</Label>
                  <div className="flex gap-1.5 mt-1">
                    {["all", "high", "medium", "low"].map((l) => (
                      <button key={l} onClick={() => setZoningFilter((f) => ({ ...f, alertLevel: l }))}
                        className={`px-2.5 py-1 rounded text-xs font-medium border ${zoningFilter.alertLevel === l ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}>
                        {l === "all" ? "All" : l === "high" ? "🔴 High" : l === "medium" ? "🟡 Med" : "🟢 Low"}
                      </button>
                    ))}
                  </div>
                </div>
                {zoningRequestTypes.length > 0 && (
                  <div>
                    <Label className="text-xs text-slate-500">Request Type</Label>
                    <Select value={zoningFilter.requestType} onValueChange={(v) => setZoningFilter((f) => ({ ...f, requestType: v }))}>
                      <SelectTrigger className="mt-1 h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {zoningRequestTypes.map((t) => <SelectItem key={t!} value={t!}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="ml-auto flex items-end gap-2">
                  <span className="text-xs text-slate-400">{filteredZoning.length} of {zoningItems.length} items</span>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                    setZoningFilter({ alertLevel: "all", requestType: "all" });
                  }}>Clear</Button>
                </div>
              </div>
            )}

            {/* Zoning Links */}
            {selectedMarket !== "all" && ZONING_LINKS[selectedMarket] && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap gap-2 items-center">
                <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="text-sm text-blue-700 font-medium">Official Sources:</span>
                {ZONING_LINKS[selectedMarket].map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    {link.label} <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            )}

            {zoningLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : filteredZoning.length === 0 ? (
              <EmptyState
                icon={<Building2 className="h-10 w-10 text-slate-300" />}
                title={zoningItems.length > 0 ? "No items match your filters" : "No zoning items yet"}
                description={zoningItems.length > 0 ? "Try adjusting the filters above." : `Click "Scan" to search Google News for recent zoning/rezoning activity. Or copy an agenda from one of the official sources above and click "Upload Agenda".`}
              />
            ) : (
              <div className="space-y-3">
                {filteredZoning.map((item) => (
                  <Card key={item.id} className={`border-l-4 ${item.alertLevel === "high" ? "border-l-red-500" : item.alertLevel === "medium" ? "border-l-yellow-500" : "border-l-green-500"}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {item.alertLevel && (
                              <Badge className={`text-xs ${alertColor(item.alertLevel)}`}>
                                {item.alertLevel === "high" ? "🔴 High" : item.alertLevel === "medium" ? "🟡 Medium" : "🟢 Low"}
                              </Badge>
                            )}
                            {item.requestType && (
                              <Badge variant="outline" className="text-xs capitalize">{item.requestType.replace("_", " ")}</Badge>
                            )}
                            {item.status && item.status !== "pending" && (
                              <Badge variant="outline" className="text-xs capitalize">{item.status}</Badge>
                            )}
                            {selectedMarket === "all" && (
                              <span className="text-xs text-slate-400">{marketLabel(item.market)}</span>
                            )}
                          </div>
                          <p className="font-medium text-slate-800 text-sm leading-snug">
                            {item.aiSummary || item.propertyAddress || item.caseNumber || "No summary"}
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-slate-500">
                            {item.caseNumber && <span>Case: <span className="font-mono">{item.caseNumber}</span></span>}
                            {item.applicantName && <span>Applicant: {item.applicantName}</span>}
                            {item.acreage && <span>{item.acreage} ac</span>}
                            {item.meetingDate && <span>Meeting: {fmtDate(item.meetingDate)}</span>}
                            {item.currentZoning && item.proposedZoning && (
                              <span>{item.currentZoning} → {item.proposedZoning}</span>
                            )}
                          </div>
                          {expandedId === item.id && item.projectDescription && (
                            <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">{item.projectDescription}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {item.sourceUrl && (
                            <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          {item.projectDescription && (
                            <Button variant="ghost" size="sm" className="h-7 px-2"
                              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                              {expandedId === item.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400 hover:text-red-600"
                            onClick={() => deleteItem.mutate({ type: "zoning", id: item.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── LISTINGS TAB ─────────────────────────────────────────────────── */}
          <TabsContent value="listings">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Expired & Active Land Listings</h2>
                <p className="text-sm text-slate-500">Land listed on LoopNet. Listings 90+ days old signal motivated sellers.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleFilter("listings")}
                  className={hasActiveFilter("listings") ? "border-blue-400 text-blue-700" : ""}>
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Filter {hasActiveFilter("listings") && <span className="ml-1 w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => exportToCSV(filteredListings, "listings.csv")}>
                  <FileText className="h-3.5 w-3.5 mr-1.5" /> CSV
                </Button>
                <Button size="sm" onClick={() => selectedMarket === "all" ? scanAllMarkets("listings") : listingsFetch.mutate(selectedMarket)}
                  disabled={listingsFetch.isPending}>
                  {listingsFetch.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                  Refresh {selectedMarket === "all" ? "All" : ""}
                </Button>
              </div>
            </div>

            {/* Filter panel */}
            {showFilters.listings && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs text-slate-500">Min Days on Market</Label>
                  <Input className="mt-1 h-8 w-24 text-xs" placeholder="0" value={listingsFilter.minDOM}
                    onChange={(e) => setListingsFilter((f) => ({ ...f, minDOM: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Max Price ($K)</Label>
                  <Input className="mt-1 h-8 w-24 text-xs" placeholder="Any" value={listingsFilter.maxPrice}
                    onChange={(e) => setListingsFilter((f) => ({ ...f, maxPrice: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Min Acres</Label>
                  <Input className="mt-1 h-8 w-20 text-xs" placeholder="Any" value={listingsFilter.minAcres}
                    onChange={(e) => setListingsFilter((f) => ({ ...f, minAcres: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Max Acres</Label>
                  <Input className="mt-1 h-8 w-20 text-xs" placeholder="Any" value={listingsFilter.maxAcres}
                    onChange={(e) => setListingsFilter((f) => ({ ...f, maxAcres: e.target.value }))} />
                </div>
                <div className="ml-auto flex items-end gap-2">
                  <span className="text-xs text-slate-400">{filteredListings.length} of {listings.length}</span>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() =>
                    setListingsFilter({ minDOM: "", maxPrice: "", minAcres: "", maxAcres: "" })}>Clear</Button>
                </div>
              </div>
            )}

            {listingsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : filteredListings.length === 0 ? (
              <EmptyState
                icon={<Search className="h-10 w-10 text-slate-300" />}
                title={listings.length > 0 ? "No items match your filters" : "No listings yet"}
                description={listings.length > 0 ? "Adjust the filters above." : "Click Refresh to pull land listings from LoopNet for this market."}
              />
            ) : (
              <div className="space-y-3">
                {filteredListings.map((l) => (
                  <Card key={l.id} className={`border-l-4 ${l.isExpired ? "border-l-red-400" : l.daysOnMarket && l.daysOnMarket > 90 ? "border-l-yellow-400" : "border-l-green-400"}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {l.isExpired && <Badge className="bg-red-100 text-red-700 text-xs">Expired</Badge>}
                            {!l.isExpired && l.daysOnMarket && l.daysOnMarket > 90 && (
                              <Badge className="bg-yellow-100 text-yellow-700 text-xs">{l.daysOnMarket}d on market</Badge>
                            )}
                            {!l.isExpired && l.daysOnMarket && l.daysOnMarket <= 14 && (
                              <Badge className="bg-green-100 text-green-700 text-xs">New listing</Badge>
                            )}
                            {selectedMarket === "all" && (
                              <span className="text-xs text-slate-400">{marketLabel(l.market)}</span>
                            )}
                          </div>
                          <p className="font-medium text-slate-800 text-sm">{l.address || "Address not available"}{l.city ? `, ${l.city}` : ""}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                            {l.askingPrice && <span className="font-semibold text-slate-700">{fmt$(l.askingPrice)}</span>}
                            {l.acreage && <span>{l.acreage} acres</span>}
                            {l.pricePerAcre && <span>{fmt$(l.pricePerAcre)}/acre</span>}
                            {l.zoning && <span>Zoning: {l.zoning}</span>}
                            {l.brokerName && <span>Broker: {l.brokerName}</span>}
                          </div>
                          {l.aiSignal && (
                            <p className="mt-1.5 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">{l.aiSignal}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {l.sourceUrl && (
                            <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                              <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400 hover:text-red-600"
                            onClick={() => deleteItem.mutate({ type: "listings", id: l.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── PERMITS TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="permits">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Permit Signals</h2>
                <p className="text-sm text-slate-500">AI flags stalled permits (90+ days inactive) and newly issued development permits.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleFilter("permits")}
                  className={hasActiveFilter("permits") ? "border-blue-400 text-blue-700" : ""}>
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Filter {hasActiveFilter("permits") && <span className="ml-1 w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                </Button>
                <Dialog open={permitUploadOpen} onOpenChange={setPermitUploadOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Upload className="h-4 w-4 mr-1.5" /> Import Permits</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Import Permit Data</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                        Download a permit export CSV/Excel from your county portal, then upload it here. AI will automatically flag stalled and newly issued permits.
                      </div>
                      <div>
                        <Label>Market</Label>
                        <Select value={permitUploadMarket} onValueChange={(v) => setPermitUploadMarket(v as MarketKey)}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MARKETS.filter((m) => m.key !== "all").map((m) => (
                              <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Upload CSV or Excel file</Label>
                        <Input type="file" accept=".csv,.xlsx,.xls" className="mt-1"
                          onChange={(e) => setPermitFile(e.target.files?.[0] || null)} />
                      </div>
                      <Button className="w-full" onClick={() => permitUpload.mutate()} disabled={permitUpload.isPending || !permitFile}>
                        {permitUpload.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : "Import & Flag Signals"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Filter panel */}
            {showFilters.permits && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs text-slate-500">Signal Type</Label>
                  <div className="flex gap-1.5 mt-1">
                    {[
                      { v: "all", label: "All" },
                      { v: "stalled_180d", label: "🚨 Stalled 180d+" },
                      { v: "stalled_90d", label: "⚠️ Stalled 90d+" },
                      { v: "new_issued", label: "🆕 New" },
                    ].map(({ v, label }) => (
                      <button key={v} onClick={() => setPermitsFilter({ signalType: v })}
                        className={`px-2.5 py-1 rounded text-xs font-medium border ${permitsFilter.signalType === v ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ml-auto flex items-end gap-2">
                  <span className="text-xs text-slate-400">{filteredPermits.length} of {permits.length}</span>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setPermitsFilter({ signalType: "all" })}>Clear</Button>
                </div>
              </div>
            )}

            {/* County Portal Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {(selectedMarket === "all" ? ["wilmington", "raleigh_durham", "charlotte", "asheville"] : [selectedMarket]).map((m) => {
                const portal = PORTAL_LINKS[m];
                if (!portal) return null;
                return (
                  <a key={m} href={portal.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                    <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{portal.label}</p>
                      <p className="text-xs text-slate-400 capitalize">{marketLabel(m)}</p>
                    </div>
                  </a>
                );
              })}
            </div>

            {permitsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : filteredPermits.length === 0 ? (
              <EmptyState
                icon={<Layers className="h-10 w-10 text-slate-300" />}
                title={permits.length > 0 ? "No items match your filters" : "No permit signals yet"}
                description={permits.length > 0 ? "Adjust the filters above." : "Download a permit export from a county portal above, then click Import Permits to have AI flag stalled and new development activity."}
              />
            ) : (
              <div className="space-y-3">
                {filteredPermits.map((p) => (
                  <Card key={p.id} className={`border-l-4 ${p.signalType?.includes("stalled") ? "border-l-red-500" : "border-l-green-500"}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge className={`text-xs ${signalColor(p.signalType)}`}>
                              {p.signalType === "stalled_180d" ? "🚨 Stalled 180d+" :
                               p.signalType === "stalled_90d" ? "⚠️ Stalled 90d+" :
                               p.signalType === "new_issued" ? "🆕 New Permit" : p.signalType}
                            </Badge>
                            {p.permitType && <Badge variant="outline" className="text-xs">{p.permitType}</Badge>}
                            {selectedMarket === "all" && (
                              <span className="text-xs text-slate-400">{marketLabel(p.market)}</span>
                            )}
                          </div>
                          <p className="font-medium text-slate-800 text-sm">{p.aiSummary || p.propertyAddress || "No address"}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                            {p.permitNumber && <span>Permit: <span className="font-mono">{p.permitNumber}</span></span>}
                            {p.ownerName && <span>Owner: {p.ownerName}</span>}
                            {p.daysInactive != null && p.daysInactive > 0 && <span>{p.daysInactive} days inactive</span>}
                            {p.estimatedCost && <span>Est. cost: {fmt$(p.estimatedCost)}</span>}
                            {p.issueDate && <span>Issued: {fmtDate(p.issueDate)}</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400 hover:text-red-600 flex-shrink-0"
                          onClick={() => deleteItem.mutate({ type: "permits", id: p.id })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── NEWS TAB ─────────────────────────────────────────────────────── */}
          <TabsContent value="news">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">News & Market Alerts</h2>
                <p className="text-sm text-slate-500">AI scans local news feeds and scores each article for land acquisition relevance (0–100).</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleFilter("news")}
                  className={hasActiveFilter("news") ? "border-blue-400 text-blue-700" : ""}>
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Filter {hasActiveFilter("news") && <span className="ml-1 w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                </Button>
                <Button size="sm" onClick={() => selectedMarket === "all" ? scanAllMarkets("news") : newsFetch.mutate(selectedMarket)}
                  disabled={newsFetch.isPending}>
                  {newsFetch.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                  Refresh {selectedMarket === "all" ? "All" : ""}
                </Button>
              </div>
            </div>

            {/* Filter panel */}
            {showFilters.news && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs text-slate-500">Min Relevance Score</Label>
                  <Input className="mt-1 h-8 w-24 text-xs" placeholder="0" value={newsFilter.minScore}
                    onChange={(e) => setNewsFilter((f) => ({ ...f, minScore: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Signal Type</Label>
                  <Select value={newsFilter.signalType} onValueChange={(v) => setNewsFilter((f) => ({ ...f, signalType: v }))}>
                    <SelectTrigger className="mt-1 h-8 text-xs w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Signals</SelectItem>
                      <SelectItem value="rezoning">Rezoning</SelectItem>
                      <SelectItem value="development_activity">Development Activity</SelectItem>
                      <SelectItem value="distress">Distress</SelectItem>
                      <SelectItem value="market_shift">Market Shift</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto flex items-end gap-2">
                  <span className="text-xs text-slate-400">{filteredNews.length} of {news.length}</span>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setNewsFilter({ minScore: "", signalType: "all" })}>Clear</Button>
                </div>
              </div>
            )}

            {newsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : filteredNews.length === 0 ? (
              <EmptyState
                icon={<Newspaper className="h-10 w-10 text-slate-300" />}
                title={news.length > 0 ? "No items match your filters" : "No news items yet"}
                description={news.length > 0 ? "Try adjusting the filters above." : "Click Refresh to have AI scan local news feeds and score articles for land acquisition relevance."}
              />
            ) : (
              <div className="space-y-3">
                {filteredNews.map((n) => (
                  <Card key={n.id} className={`${n.isRead ? "opacity-60" : ""} transition-opacity`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {n.relevanceScore != null && (
                              <span className={`text-xs font-mono ${scoreColor(n.relevanceScore)}`}>
                                Score: {n.relevanceScore}/100
                              </span>
                            )}
                            {n.signalType && (
                              <Badge className={`text-xs ${signalColor(n.signalType)}`}>
                                {n.signalType.replace("_", " ")}
                              </Badge>
                            )}
                            {n.sourceName && <span className="text-xs text-slate-400">{n.sourceName}</span>}
                            {selectedMarket === "all" && n.market && (
                              <span className="text-xs text-slate-400">{marketLabel(n.market)}</span>
                            )}
                            {!n.isRead && <Badge className="bg-blue-100 text-blue-700 text-xs">Unread</Badge>}
                          </div>
                          <p className="font-medium text-slate-800 text-sm leading-snug">{n.headline}</p>
                          {n.aiAnalysis && (
                            <p className="mt-1 text-xs text-slate-600 italic">{n.aiAnalysis}</p>
                          )}
                          {n.publishedAt && (
                            <p className="mt-1 text-xs text-slate-400">{fmtDate(n.publishedAt)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {n.sourceUrl && (
                            <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                              <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer"
                                onClick={() => !n.isRead && markRead.mutate(n.id)}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          {!n.isRead && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400"
                              onClick={() => markRead.mutate(n.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400 hover:text-red-600"
                            onClick={() => deleteItem.mutate({ type: "news", id: n.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── OPPORTUNITY FINDER TAB ───────────────────────────────────────── */}
          <TabsContent value="opportunities">
            <div className="mb-5">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-600" /> Opportunity Finder
                  </h2>
                  <p className="text-sm text-slate-500">
                    Finds land parcels held 5+ years by non-developers — individuals, families, small LLCs, and trusts. These are your off-market leads.
                  </p>
                </div>
                {savedOpportunities.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => exportToCSV(savedOpportunities, "opportunities.csv")}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                  </Button>
                )}
              </div>
            </div>

            {/* Search Controls */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" /> Search Filters
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div>
                  <Label className="text-xs text-slate-500">County / Market</Label>
                  <Select value={oppMarket} onValueChange={(v) => setOppMarket(v as Exclude<MarketKey, "all">)}>
                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MARKETS.filter((m) => m.key !== "all").map((m) => (
                        <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Min Acres</Label>
                  <Input className="mt-1 h-8 text-sm" placeholder="2" value={oppMinAcres}
                    onChange={(e) => setOppMinAcres(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Max Acres</Label>
                  <Input className="mt-1 h-8 text-sm" placeholder="Any" value={oppMaxAcres}
                    onChange={(e) => setOppMaxAcres(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Owned At Least (years)</Label>
                  <Input className="mt-1 h-8 text-sm" placeholder="5" value={oppMinYears}
                    onChange={(e) => setOppMinYears(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={oppOnlyTarget} onChange={(e) => setOppOnlyTarget(e.target.checked)}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-700">Only show non-developers</span>
                  <span className="text-xs text-slate-400">(individuals, family LLCs, trusts)</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={() => oppSearch.mutate()} disabled={oppSearch.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  {oppSearch.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching County GIS...</> :
                    <><Search className="h-4 w-4 mr-2" /> Search County Parcels</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowScreener(!showScreener)}>
                  {showScreener ? <ChevronUp className="h-4 w-4 mr-1.5" /> : <ChevronDown className="h-4 w-4 mr-1.5" />}
                  Address Screener
                </Button>
              </div>

              {/* Address Screener */}
              {showScreener && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm text-slate-600 mb-2">
                    Paste addresses to screen — one per line. Uses county GIS to look up ownership, deed date, and acreage for each address.
                  </p>
                  <Textarea
                    className="h-32 text-sm font-mono"
                    placeholder={"123 Oak Farm Rd, Raleigh NC 27601\n456 Pine Hill Rd, Charlotte NC 28201\n..."}
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <Button onClick={() => oppScreen.mutate()} disabled={oppScreen.isPending || !addressInput.trim()} size="sm">
                      {oppScreen.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Screening...</> :
                        <><UserCheck className="h-4 w-4 mr-1.5" /> Screen {addressInput.split("\n").filter((a) => a.trim()).length} Addresses</>}
                    </Button>
                    {screenDone && (
                      <span className="text-xs text-slate-500">
                        {screenResults.filter((r) => !r.error && !r.skipped).length} passed ·{" "}
                        {screenResults.filter((r) => r.skipped).length} filtered ·{" "}
                        {screenResults.filter((r) => r.error).length} errors
                      </span>
                    )}
                  </div>

                  {/* Screen results */}
                  {screenDone && screenResults.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Screen Results</h4>
                      {screenResults.map((r, i) => (
                        <div key={i} className={`p-3 rounded-lg border text-sm ${r.error ? "bg-red-50 border-red-200" : r.skipped ? "bg-slate-50 border-slate-200 opacity-70" : "bg-emerald-50 border-emerald-200"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 text-xs truncate">{r.geocodedAddress || r.inputAddress}</p>
                              {r.error && <p className="text-xs text-red-600 mt-0.5">{r.error}</p>}
                              {r.skipped && <p className="text-xs text-slate-500 mt-0.5">Filtered: {r.skipReason}</p>}
                              {r.parcel && !r.skipped && (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-600">
                                  <span className="font-semibold text-emerald-700">{r.parcel.ownerLabel}</span>
                                  {r.parcel.ownerName && <span>{r.parcel.ownerName}</span>}
                                  {r.parcel.yearsHeld && <span>{r.parcel.yearsHeld.toFixed(1)} yrs held</span>}
                                  {r.parcel.acreage && <span>{r.parcel.acreage.toFixed(1)} ac</span>}
                                  {r.parcel.currentZoning && <span>{r.parcel.currentZoning}</span>}
                                </div>
                              )}
                            </div>
                            {r.parcel && !r.skipped && (
                              <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0"
                                onClick={() => saveOpp.mutate(r.parcel!)}>Save</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* County search results */}
            {oppSearchDone && (
              <div className="mb-5">
                {oppWarning ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">County GIS returned a warning</p>
                      <p>{oppWarning}</p>
                      <p className="mt-1 text-amber-600 text-xs">The county's ArcGIS service may be temporarily unavailable or the URL may have changed. Try the Address Screener above to screen specific addresses.</p>
                    </div>
                  </div>
                ) : oppSearchResults.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700">
                        County GIS Results — {oppSearchResults.length} parcels found in {marketLabel(oppMarket)}
                      </h3>
                      <Button size="sm" variant="outline" onClick={() => exportToCSV(oppSearchResults, "county-parcels.csv")}>
                        <FileText className="h-3.5 w-3.5 mr-1.5" /> Export
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {oppSearchResults.map((p, i) => (
                        <ParcelCard key={i} parcel={p} onSave={() => saveOpp.mutate(p)}
                          onCopy={() => copyToClipboard(formatParcelText(p), toast)} saving={saveOpp.isPending} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 text-center">
                    No parcels matched your criteria in the county GIS. Try reducing the min acres or min years held.
                  </div>
                )}
              </div>
            )}

            {/* Saved Opportunities */}
            {oppLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
            ) : savedOpportunities.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  Saved Opportunities ({savedOpportunities.length})
                </h3>
                <div className="space-y-2">
                  {savedOpportunities.map((opp) => (
                    <Card key={opp.id} className="border-l-4 border-l-emerald-400">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <Badge className={`text-xs ${OWNER_TYPE_COLORS[opp.ownerType || "unknown"] || "bg-slate-100 text-slate-600"}`}>
                                {ownerTypeLabel(opp.ownerType)}
                              </Badge>
                              {opp.yearsHeld && (
                                <span className="text-xs text-slate-500">
                                  <Clock className="h-3 w-3 inline mr-0.5" />
                                  {parseFloat(String(opp.yearsHeld)).toFixed(1)} yrs held
                                </span>
                              )}
                              {opp.acreage && <span className="text-xs text-slate-500">{parseFloat(String(opp.acreage)).toFixed(1)} ac</span>}
                              {selectedMarket === "all" && <span className="text-xs text-slate-400">{marketLabel(opp.market)}</span>}
                            </div>
                            <p className="font-medium text-slate-800 text-sm">{opp.address || "Address not available"}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
                              {opp.ownerName && <span>Owner: <span className="text-slate-700">{opp.ownerName}</span></span>}
                              {opp.currentZoning && <span>Zoning: {opp.currentZoning}</span>}
                              {opp.assessedValue && <span>Assessed: {fmt$(opp.assessedValue)}</span>}
                              {opp.lastSaleDate && <span>Last sold: {fmtDate(opp.lastSaleDate)}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400"
                              title="Copy info"
                              onClick={() => copyToClipboard(
                                `Address: ${opp.address}\nOwner: ${opp.ownerName} (${ownerTypeLabel(opp.ownerType)})\nYears Held: ${parseFloat(String(opp.yearsHeld || 0)).toFixed(1)}\nAcres: ${parseFloat(String(opp.acreage || 0)).toFixed(1)}\nZoning: ${opp.currentZoning || "—"}\nLast Sale: ${opp.lastSaleDate || "—"}`,
                                toast
                              )}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400 hover:text-red-600"
                              onClick={() => deleteItem.mutate({ type: "opportunities", id: opp.id })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : !oppSearchDone ? (
              <EmptyState
                icon={<Target className="h-10 w-10 text-slate-300" />}
                title="No saved opportunities yet"
                description='Set your filters above and click "Search County Parcels" to pull long-held non-developer land from the county GIS. Or use the Address Screener to screen a list of addresses you already have.'
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}

// ── Parcel Card ───────────────────────────────────────────────────────────────

function ParcelCard({
  parcel,
  onSave,
  onCopy,
  saving,
}: {
  parcel: {
    address: string; ownerName: string; ownerLabel: string; ownerType: string;
    yearsHeld: number | null; acreage: number | null; currentZoning: string;
    landUse: string; assessedValue: number | null; lastSaleDate: string | null;
    parcelId: string;
  };
  onSave: () => void;
  onCopy: () => void;
  saving: boolean;
}) {
  const fmt$ = (n?: number | null) => n ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n) : "—";

  return (
    <div className="p-3 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge className={`text-xs ${OWNER_TYPE_COLORS[parcel.ownerType] || "bg-slate-100 text-slate-600"}`}>
              {parcel.ownerLabel}
            </Badge>
            {parcel.yearsHeld != null && (
              <span className="text-xs text-slate-500 flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> {parcel.yearsHeld.toFixed(1)} yrs
              </span>
            )}
            {parcel.acreage != null && <span className="text-xs text-slate-500">{parcel.acreage.toFixed(2)} ac</span>}
            {parcel.currentZoning && <span className="text-xs text-slate-400">{parcel.currentZoning}</span>}
          </div>
          <p className="font-medium text-slate-800 text-sm">{parcel.address || "Address unavailable"}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-slate-500">
            {parcel.ownerName && <span>Owner: <span className="text-slate-700">{parcel.ownerName}</span></span>}
            {parcel.lastSaleDate && <span>Last sold: {new Date(parcel.lastSaleDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })}</span>}
            {parcel.assessedValue && <span>Assessed: {fmt$(parcel.assessedValue)}</span>}
            {parcel.landUse && <span>{parcel.landUse}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400" onClick={onCopy} title="Copy info">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatParcelText(p: {
  address: string; ownerName: string; ownerLabel: string;
  yearsHeld: number | null; acreage: number | null; currentZoning: string;
  assessedValue: number | null; lastSaleDate: string | null;
}): string {
  return [
    `Address: ${p.address}`,
    `Owner: ${p.ownerName} (${p.ownerLabel})`,
    `Years Held: ${p.yearsHeld?.toFixed(1) ?? "—"}`,
    `Acreage: ${p.acreage?.toFixed(2) ?? "—"} ac`,
    `Zoning: ${p.currentZoning || "—"}`,
    `Assessed Value: ${p.assessedValue ? "$" + p.assessedValue.toLocaleString() : "—"}`,
    `Last Sale: ${p.lastSaleDate || "—"}`,
  ].join("\n");
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-slate-600 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md mx-auto">{description}</p>
    </div>
  );
}

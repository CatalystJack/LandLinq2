import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { useLocation } from "wouter";
import {
  Building2,
  CheckCircle2,
  Columns3,
  Download,
  FileSpreadsheet,
  Loader2,
  Map as MapIcon,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Star,
  Table2,
  Upload,
} from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
import { PageHeader } from "@/components/ui/page-header";
import Footer from "@/components/footer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import DeveloperManualDealDialog from "@/components/developer-manual-deal-dialog";

type DealRecord = {
  id: string;
  address: string;
  city: string | null;
  county: string | null;
  state: string | null;
  zip?: string | null;
  sizeAcres: string | null;
  topRentPSF: string | null;
  avgRentPerUnit: string | null;
  askingPrice: string | null;
  parcelId?: string | null;
  zoning?: string | null;
  hasEntitlements?: boolean | null;
  sewerAvailable?: boolean | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  wetlandNotes?: string | null;
  addressConfidence?: string | null;
  productTypes: string[] | null;
  qctStatus?: string | null;
  ozStatus?: string | null;
  ddaStatus?: string | null;
  ddaFmr?: number | null;
  ddaVlil?: number | null;
  ddaLihtcMaxRent?: number | null;
  censusTractFips?: string | null;
  censusMedianIncome?: number | null;
  censusRenterRate?: string | number | null;
  hudData?: {
    status: "matched" | "not_configured" | "location_unresolved" | "unavailable";
    areaName: string | null;
    entityId: string | null;
    fmrTwoBedroom: number | null;
    medianIncome: number | null;
    lowIncomeLimitFourPerson: number | null;
    veryLowIncomeLimitFourPerson: number | null;
    lookedUpAt: string;
  };
};

type DeveloperDeal = {
  id: string;
  classification: "passed" | "review" | "red" | "yellow" | null;
  matchedProductTypes: string[] | null;
  matchedAt: string | null;
  sentAt: string | null;
  greenFlaggedByDeveloper: boolean;
  greenFlaggedAt: string | null;
  deal: DealRecord;
};

type ImportSummary = {
  inserted: number;
  updated: number;
  errorCount: number;
};

const IMPORT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "address", label: "Address", required: true },
  { key: "acreage", label: "Acreage", required: true },
  { key: "county", label: "County" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "rent", label: "Rent" },
  { key: "askingPrice", label: "Asking Price" },
  { key: "productType", label: "Product Type" },
];

function money(value: string | null): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(number);
}

function monthlyMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${money(String(value))}/mo`;
}

function isAffordabilityProgram(value: string | null | undefined): boolean {
  return ["yes", "true", "mdda", "nmdda", "qct", "oz"].includes(String(value || "").trim().toLowerCase());
}

function dealPrograms(deal: DealRecord): string[] {
  const programs: string[] = [];
  if (isAffordabilityProgram(deal.qctStatus)) programs.push("QCT");
  if (isAffordabilityProgram(deal.ddaStatus)) programs.push("DDA");
  if (isAffordabilityProgram(deal.ozStatus)) programs.push("OZ");
  return programs;
}

function DealStatus({ row, industrial }: { row: DeveloperDeal; industrial: boolean }) {
  if (row.greenFlaggedByDeveloper) {
    return (
      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <Star className="mr-1 h-3 w-3 fill-current" />
        Pursuing
      </Badge>
    );
  }
  if (industrial && row.classification === "red") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="border-red-200 bg-red-100 text-red-800 hover:bg-red-100">Passed</Badge>
        {(row.matchedProductTypes || []).map((reason) => (
          <Badge key={reason} variant="outline" className="border-red-200 bg-white text-red-700">
            {reason}
          </Badge>
        ))}
      </div>
    );
  }
  if (industrial) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">Review</Badge>
        {(row.matchedProductTypes || []).map((reason) => (
          <Badge key={reason} variant="outline" className="border-amber-200 bg-white text-amber-700">
            {reason}
          </Badge>
        ))}
      </div>
    );
  }
  if (row.classification === "review") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">Review</Badge>
        {(row.matchedProductTypes || []).map((productType) => (
          <Badge key={productType} variant="outline" className="border-slate-200 bg-white text-slate-600">
            {productType}
          </Badge>
        ))}
      </div>
    );
  }
  return <Badge className="border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">Passed</Badge>;
}

type DeveloperDealsResponse = {
  deals: DeveloperDeal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  summary: {
    total: number;
    review: number;
    passed: number;
    pursuing: number;
    red: number;
    yellow: number;
  };
  filterOptions: {
    productTypes: string[];
    markets: string[];
  };
};

export default function DeveloperDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profile = (user as any)?.developerProfile;
  const isGeneralSales = profile?.profileType === "general_sales";
  const isIndustrial = profile?.assetClass === "industrial";
  const primaryColor = profile?.primaryColor || "#0A2B4A";
  const secondaryColor = profile?.secondaryColor || "#4A90E2";

  useEffect(() => {
    if (isGeneralSales) {
      setLocation("/developer/crm");
    }
  }, [isGeneralSales, setLocation]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, any>[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importStep, setImportStep] = useState<"select" | "map">("select");
  const [parsing, setParsing] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [showColumns, setShowColumns] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rerunningDealId, setRerunningDealId] = useState<string | null>(null);
  const [manualDealOpen, setManualDealOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, productTypeFilter, programFilter]);

  const buildDealsUrl = (includeAll = false) => {
    const params = new URLSearchParams();
    if (includeAll) {
      params.set("all", "true");
    } else {
      params.set("page", String(page));
      params.set("limit", "25");
    }
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (productTypeFilter !== "all") params.set("productType", productTypeFilter);
    if (programFilter !== "all") params.set("program", programFilter);
    return `/api/developer-profile/me/deals?${params.toString()}`;
  };

  const dealsQuery = useQuery<DeveloperDealsResponse>({
    queryKey: ["/api/developer-profile/me/deals", page, debouncedSearch, statusFilter, productTypeFilter, programFilter],
    enabled: !isGeneralSales,
    queryFn: async () => {
      const response = await fetch(buildDealsUrl(), { credentials: "include" });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to load deals" }));
        throw new Error(error.error || "Failed to load deals");
      }
      return response.json();
    },
  });

  const pursueMutation = useMutation({
    mutationFn: async (sendId: string) => {
      const response = await fetch(`/api/developer-profile/me/deals/${encodeURIComponent(sendId)}/pursue`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to update deal" }));
        throw new Error(error.error || "Failed to update deal");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/deals"] });
      toast({ title: "Deal marked as pursuing" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not update deal", description: error.message, variant: "destructive" });
    },
  });

  const rerunAnalysisMutation = useMutation({
    mutationFn: async (dealId: string) => {
      setRerunningDealId(dealId);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 300000);

      try {
        const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/rerun-analysis`, {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: "Failed to re-run analysis" }));
          throw new Error(error.message || error.error || "Failed to re-run analysis");
        }
        return response.json();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("The refresh timed out. The analysis may still be processing in the background.");
        }
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    onSuccess: (data) => {
      setRerunningDealId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/deals"] });
      toast({
        title: "Deal data refreshed",
        description: `Latest analysis complete${data?.classification ? `: ${String(data.classification).toUpperCase()}` : "."}`,
      });
    },
    onError: (error: Error) => {
      setRerunningDealId(null);
      toast({
        title: "Could not refresh deal data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a CSV or Excel file");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("columnMapping", JSON.stringify(mapping));
      const response = await fetch("/api/developer-profile/me/import-deals", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Import failed" }));
        throw new Error(error.error || "Import failed");
      }
      return response.json() as Promise<ImportSummary>;
    },
    onSuccess: (summary) => {
      setImportSummary(summary);
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/deals"] });
      toast({
        title: "Import complete",
        description: `${summary.inserted} inserted, ${summary.updated} updated, ${summary.errorCount} skipped`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const parseFile = useCallback((selectedFile: File) => {
    setParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", raw: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Record<string, any>[];
        const nextHeaders = rows.length ? Object.keys(rows[0]) : [];
        setHeaders(nextHeaders);
        setSampleRows(rows.slice(0, 3));
        setRowCount(rows.length);

        const find = (patterns: RegExp[]) =>
          nextHeaders.find((header) => patterns.some((pattern) => pattern.test(header.toLowerCase()))) || "";
        setMapping({
          address: find([/^address$/, /property.*address/, /site.*address/, /street.*address/]),
          acreage: find([/acre/, /land.*size/, /lot.*size/]),
          county: find([/^county$/, /property.*county/]),
          state: find([/^state$/, /property.*state/]),
          city: find([/^city$/, /property.*city/]),
          rent: profile?.rentMetric === "per_unit"
            ? find([/rent.*unit/, /monthly.*rent/, /^rent$/])
            : find([/rent.*psf/, /rent.*sf/, /^rent$/]),
          askingPrice: find([/asking.*price/, /^price$/, /purchase.*price/]),
          productType: find([/product.*type/, /property.*type/, /asset.*type/]),
        });
        setImportStep("map");
      } catch (error) {
        toast({
          title: "Could not read file",
          description: error instanceof Error ? error.message : "Unsupported spreadsheet",
          variant: "destructive",
        });
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParsing(false);
      toast({ title: "Could not read file", variant: "destructive" });
    };
    reader.readAsArrayBuffer(selectedFile);
  }, [profile?.rentMetric, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setImportSummary(null);
    parseFile(selectedFile);
  };

  const resetImport = () => {
    setImportOpen(false);
    setFile(null);
    setHeaders([]);
    setSampleRows([]);
    setRowCount(0);
    setMapping({});
    setImportStep("select");
    setImportSummary(null);
    importMutation.reset();
  };

  const rows = dealsQuery.data?.deals || [];
  const filteredRows = rows;
  const productTypeOptions = dealsQuery.data?.filterOptions.productTypes || [];
  const counts = dealsQuery.data?.summary || {
    total: 0,
    review: 0,
    passed: 0,
    pursuing: 0,
    red: 0,
    yellow: 0,
  };

  const canImport = Boolean(file && mapping.address && mapping.acreage && rowCount > 0 && !parsing);

  const exportDeals = async () => {
    setExporting(true);
    try {
      const response = await fetch(buildDealsUrl(true), { credentials: "include" });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to export deals" }));
        throw new Error(error.error || "Failed to export deals");
      }
      const exportRows = (await response.json() as DeveloperDealsResponse).deals || [];
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = isIndustrial
      ? ["Property", "City", "County", "State", "Acreage", "Asking Price", "Parcel ID", "Zoning", "Entitlements", "Sewer", "Screen", "Screen Reasons"]
      : ["Property", "City", "County", "State", "Acreage", "Rent", "Status", "Product Type", "HUD FMR (2BR)", "HUD 4-Person Income Limit", "Programs"];
    const body = exportRows.map((row) => isIndustrial
      ? [
          row.deal.address,
          row.deal.city,
          row.deal.county,
          row.deal.state,
          row.deal.sizeAcres,
          row.deal.askingPrice,
          row.deal.parcelId,
          row.deal.zoning,
          row.deal.hasEntitlements == null ? "Unknown" : row.deal.hasEntitlements ? "Yes" : "No",
          row.deal.sewerAvailable == null ? "Unknown" : row.deal.sewerAvailable ? "Yes" : "No",
          row.greenFlaggedByDeveloper ? "Pursuing" : row.classification === "red" ? "Passed" : "Review",
          (row.matchedProductTypes || []).join(", "),
        ]
      : [
          row.deal.address,
          row.deal.city,
          row.deal.county,
          row.deal.state,
          row.deal.sizeAcres,
          rentText(row.deal),
          row.greenFlaggedByDeveloper ? "Pursuing" : row.classification === "review" ? "Review" : "Passed",
          (row.matchedProductTypes || row.deal.productTypes || []).join(", "),
          row.deal.hudData?.fmrTwoBedroom ?? "",
          row.deal.hudData?.lowIncomeLimitFourPerson ?? "",
          dealPrograms(row.deal).join(", "),
        ]);
    const csv = [header, ...body].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "landlinq-deals.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not load all matching deals.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const refreshDeals = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/deals"] });
    } finally {
      setRefreshing(false);
    }
  };

  const rentText = (deal: DealRecord) => {
    if (profile?.rentMetric === "per_unit") {
      return deal.avgRentPerUnit ? `${money(deal.avgRentPerUnit)}/unit` : "—";
    }
    const value = Number(deal.topRentPSF);
    return Number.isFinite(value) ? `$${value.toFixed(2)}/SF` : "—";
  };

  if (isGeneralSales) {
    return <div className="flex min-h-screen items-center justify-center bg-warm text-sm text-slate-500">Redirecting to CRM…</div>;
  }

  return (
    <div className="min-h-screen bg-warm">
      <DeveloperNavigation />
      <main className="mx-auto max-w-[1600px] px-3 py-5 sm:px-5 lg:px-6">
        <PageHeader
          title="Deal Dashboard"
          description={`Review, analyze, and manage deals shared with ${profile?.companyName || "your company"}.`}
          eyebrow="Investment Company Portal"
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => setManualDealOpen(true)} className="border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-white hover:text-sky-600">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Deal
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Import Deals
              </Button>
              <Button size="sm" variant="outline" onClick={exportDeals} disabled={exporting}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
              <Button size="sm" variant="outline" onClick={refreshDeals} disabled={refreshing}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </>
          }
        />

        <div className="section-gap-sm grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(isIndustrial
            ? [
                { label: "All sites", value: counts.total, icon: Building2, tone: "text-slate-700 bg-slate-100" },
                { label: "Passed", value: counts.red, icon: CheckCircle2, tone: "text-red-700 bg-red-100" },
                { label: "Review", value: counts.yellow, icon: Search, tone: "text-amber-700 bg-amber-100" },
                { label: "Pursuing", value: counts.pursuing, icon: Star, tone: "text-emerald-700 bg-emerald-100" },
              ]
            : [
                { label: "All deals", value: counts.total, icon: Building2, tone: "text-slate-700 bg-slate-100" },
                { label: "Review", value: counts.review, icon: Search, tone: "text-amber-700 bg-amber-100" },
                { label: "Passed", value: counts.passed, icon: CheckCircle2, tone: "text-blue-700 bg-blue-100" },
                { label: "Pursuing", value: counts.pursuing, icon: Star, tone: "text-emerald-700 bg-emerald-100" },
              ]
          ).map(({ label, value, icon: Icon, tone }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                const nextFilter = isIndustrial
                  ? label === "Passed" ? "red" : label === "Review" ? "yellow" : label.toLowerCase()
                  : label.toLowerCase();
                setStatusFilter(statusFilter === nextFilter ? "all" : nextFilter);
              }}
              className={`flex items-center justify-between rounded-md border bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-[#4A90E2] ${
                statusFilter === label.toLowerCase() ? "border-[#4A90E2] ring-1 ring-[#4A90E2]/20" : "border-slate-200"
              }`}
            >
              <CardContent className="flex w-full items-center justify-between p-0">
                <div>
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-0.5 font-serif text-3xl font-bold text-slate-950">{value}</p>
                </div>
                <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></div>
              </CardContent>
            </button>
          ))}
        </div>
        <DeveloperManualDealDialog
          open={manualDealOpen}
          onOpenChange={setManualDealOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/deals"] })}
        />

        <Card className="overflow-hidden border-slate-300 shadow-sm">
          <div className="border-b border-slate-300 bg-white p-2">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1 xl:max-w-md">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search deals, brokers, locations..."
                  className="h-9 pl-8 text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { value: "table" as const, label: "Table", icon: Table2 },
                  { value: "map" as const, label: "Map", icon: MapIcon },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={viewMode === value ? "default" : "outline"}
                    onClick={() => setViewMode(value)}
                    className={`h-8 px-2.5 text-xs ${viewMode === value ? "bg-[#4A90E2] text-white" : ""}`}
                  >
                    <Icon className="mr-1 h-3 w-3" />
                    {label}
                  </Button>
                ))}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-[108px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">{isIndustrial ? "All screens" : "All status"}</SelectItem>
                     {isIndustrial ? (
                       <>
                         <SelectItem value="red">Passed</SelectItem>
                         <SelectItem value="yellow">Review</SelectItem>
                       </>
                     ) : (
                       <>
                         <SelectItem value="review">Review</SelectItem>
                         <SelectItem value="passed">Passed</SelectItem>
                       </>
                     )}
                     <SelectItem value="pursuing">Pursuing</SelectItem>
                   </SelectContent>
                </Select>
                <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                  <SelectTrigger className="h-8 w-[124px] text-xs"><SelectValue placeholder="Product type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {productTypeOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
                 {!isIndustrial && <Select value={programFilter} onValueChange={setProgramFilter}>
                  <SelectTrigger className="h-8 w-[126px] text-xs"><SelectValue placeholder="Programs" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All programs</SelectItem>
                    <SelectItem value="QCT">QCT</SelectItem>
                    <SelectItem value="DDA">DDA</SelectItem>
                    <SelectItem value="OZ">Opportunity Zone</SelectItem>
                    <SelectItem value="none">No designation</SelectItem>
                  </SelectContent>
                 </Select>}
                <Button type="button" size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => setShowColumns((open) => !open)}>
                  <Columns3 className="mr-1 h-3 w-3" />
                  Columns
                </Button>
              </div>
            </div>
            {showColumns && (
              <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                <Columns3 className="h-3.5 w-3.5" />
                 {isIndustrial
                   ? "Showing parcel, zoning, entitlement, and utility columns"
                   : "Showing HUD FMR, HUD income limit, and program columns"}
              </div>
            )}
          </div>

          {viewMode === "map" ? (
            <div className="flex min-h-64 flex-col items-center justify-center bg-slate-50 px-6 text-center">
              <MapIcon className="mb-3 h-9 w-9 text-slate-300" />
              <h3 className="font-semibold text-slate-800">Market view</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Deal locations are shown below by market. Map coordinates are not available for every Investment Company deal yet.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {(dealsQuery.data?.filterOptions.markets || []).slice(0, 12).map((market) => (
                  <span key={market} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{market}</span>
                ))}
              </div>
            </div>
          ) : dealsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin" style={{ color: primaryColor }} />
            </div>
          ) : dealsQuery.isError ? (
            <div className="p-8 text-center text-sm text-red-600">{(dealsQuery.error as Error).message}</div>
          ) : filteredRows.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <FileSpreadsheet className="mb-3 h-10 w-10 text-slate-300" />
               <h3 className="font-semibold text-slate-800">{search || statusFilter !== "all" || productTypeFilter !== "all" || programFilter !== "all" ? "No matching deals" : "No deals yet"}</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                 {search || statusFilter !== "all" || productTypeFilter !== "all" || programFilter !== "all" ? "Try clearing a filter or changing your search." : "Shared and imported deals will appear here."}
              </p>
            </div>
          ) : (
            <div className="table-scroll-container">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-slate-300 hover:bg-slate-50">
                    <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Property</TableHead>
                    <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Market</TableHead>
                    <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Acreage</TableHead>
                    {isIndustrial ? (
                      <>
                        <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Asking Price</TableHead>
                        <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Parcel ID</TableHead>
                        <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Zoning</TableHead>
                        <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Entitlements</TableHead>
                        <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sewer</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rent</TableHead>
                        {showColumns && <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">HUD FMR</TableHead>}
                        {showColumns && <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">HUD Income Limit</TableHead>}
                        {showColumns && <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Programs</TableHead>}
                      </>
                    )}
                    <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                    <TableHead className="h-9 whitespace-nowrap text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id} className="border-slate-300 hover:bg-blue-50/30">
                      <TableCell className="py-2.5">
                        <div className="text-sm font-semibold text-slate-900">{row.deal.address}</div>
                        {row.deal.city && <div className="mt-0.5 text-xs text-slate-500">{row.deal.city}</div>}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex max-w-48 items-center gap-1.5 text-xs text-slate-700">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {[row.deal.county, row.deal.state].filter(Boolean).join(", ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2.5 text-xs">{row.deal.sizeAcres ? `${Number(row.deal.sizeAcres).toLocaleString()} ac` : "—"}</TableCell>
                      {isIndustrial ? (
                        <>
                          <TableCell className="whitespace-nowrap py-2.5 text-xs">{row.deal.askingPrice ? money(row.deal.askingPrice) : "—"}</TableCell>
                          <TableCell className="max-w-36 truncate py-2.5 text-xs" title={row.deal.parcelId || undefined}>{row.deal.parcelId || "—"}</TableCell>
                          <TableCell className="max-w-32 truncate py-2.5 text-xs" title={row.deal.zoning || undefined}>{row.deal.zoning || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap py-2.5 text-xs">{row.deal.hasEntitlements == null ? "Unknown" : row.deal.hasEntitlements ? "Yes" : "No"}</TableCell>
                          <TableCell className="whitespace-nowrap py-2.5 text-xs">{row.deal.sewerAvailable == null ? "Unknown" : row.deal.sewerAvailable ? "Yes" : "No"}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="whitespace-nowrap py-2.5 text-xs">{rentText(row.deal)}</TableCell>
                          {showColumns && <TableCell className="whitespace-nowrap py-2.5 text-xs">{monthlyMoney(row.deal.hudData?.fmrTwoBedroom)}</TableCell>}
                          {showColumns && <TableCell className="whitespace-nowrap py-2.5 text-xs">{monthlyMoney(row.deal.hudData?.lowIncomeLimitFourPerson)}</TableCell>}
                          {showColumns && (
                            <TableCell className="py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {dealPrograms(row.deal).length
                                  ? dealPrograms(row.deal).map((program) => <Badge key={program} variant="outline" className="text-[10px]">{program}</Badge>)
                                  : <span className="text-xs text-slate-400">—</span>}
                              </div>
                            </TableCell>
                          )}
                        </>
                      )}
                      <TableCell className="py-2.5"><DealStatus row={row} industrial={isIndustrial} /></TableCell>
                      <TableCell className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rerunningDealId !== null}
                            onClick={() => rerunAnalysisMutation.mutate(row.deal.id)}
                            className="h-7 whitespace-nowrap px-2.5 text-[11px]"
                            title={rerunningDealId === row.deal.id ? "Refreshing latest data…" : "Refresh latest deal data"}
                            aria-label={rerunningDealId === row.deal.id ? "Refreshing latest data" : "Refresh latest deal data"}
                          >
                            <RefreshCw className={`mr-1.5 h-3 w-3 ${rerunningDealId === row.deal.id ? "animate-spin" : ""}`} />
                            {rerunningDealId === row.deal.id ? "Refreshing…" : "Refresh data"}
                          </Button>
                        <Button
                          size="sm"
                          variant={row.greenFlaggedByDeveloper ? "outline" : "default"}
                          disabled={row.greenFlaggedByDeveloper || pursueMutation.isPending}
                          onClick={() => pursueMutation.mutate(row.id)}
                          className={`h-7 whitespace-nowrap px-2.5 text-[11px] ${row.greenFlaggedByDeveloper ? "" : "text-white"}`}
                          style={row.greenFlaggedByDeveloper ? undefined : { backgroundColor: primaryColor }}
                        >
                          {row.greenFlaggedByDeveloper ? "Pursuing" : "Mark as Pursuing"}
                        </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {dealsQuery.data && dealsQuery.data.pagination.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
              <span className="text-xs text-slate-500">
                Showing {((page - 1) * 25 + 1).toLocaleString()}–{Math.min(page * 25, dealsQuery.data.pagination.total).toLocaleString()} of {dealsQuery.data.pagination.total.toLocaleString()} deals
              </span>
              <div className="flex items-center gap-2">
                <span className="mr-1 text-xs text-slate-500">
                  Page {page.toLocaleString()} of {Math.max(dealsQuery.data.pagination.totalPages, 1).toLocaleString()}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  disabled={!dealsQuery.data.pagination.hasPrevPage || dealsQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  disabled={!dealsQuery.data.pagination.hasNextPage || dealsQuery.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>

      <Dialog open={importOpen} onOpenChange={(open) => (open ? setImportOpen(true) : resetImport())}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Deals</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file, then map its columns. Existing addresses are updated instead of duplicated.
            </DialogDescription>
          </DialogHeader>

          {importStep === "select" && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <FileSpreadsheet className="mx-auto mb-3 h-9 w-9 text-slate-400" />
                <Label htmlFor="developer-deal-file" className="cursor-pointer font-semibold text-slate-800">
                  Choose a CSV or Excel file
                </Label>
                <Input
                  id="developer-deal-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="mx-auto mt-4 max-w-sm bg-white"
                />
                <p className="mt-3 text-xs text-slate-500">Up to 20,000 rows and 25 MB.</p>
              </div>
              {parsing && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Reading spreadsheet…
                </div>
              )}
            </div>
          )}

          {importStep === "map" && (
            <div className="space-y-5 py-2">
              <p className="text-sm text-slate-600">
                {rowCount.toLocaleString()} rows detected. Map the required address and acreage fields, then any available deal details.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {IMPORT_FIELDS.map((field) => (
                  <div key={field.key}>
                    <Label className="text-xs">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Select
                      value={mapping[field.key] || "__none__"}
                      onValueChange={(value) =>
                        setMapping((current) => ({ ...current, [field.key]: value === "__none__" ? "" : value }))
                      }
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not mapped</SelectItem>
                        {headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {sampleRows.length > 0 && mapping.address && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="mb-1 font-semibold text-slate-800">First-row preview</p>
                  <p>Address: {sampleRows[0][mapping.address] || "—"}</p>
                  {mapping.acreage && <p>Acreage: {sampleRows[0][mapping.acreage] || "—"}</p>}
                  {mapping.rent && <p>Rent: {sampleRows[0][mapping.rent] || "—"}</p>}
                </div>
              )}

              {importSummary && (
                <Alert className="border-emerald-200 bg-emerald-50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  <AlertTitle className="text-emerald-900">Import complete</AlertTitle>
                  <AlertDescription className="text-emerald-800">
                    {importSummary.inserted} inserted, {importSummary.updated} updated, and {importSummary.errorCount} skipped for missing or invalid required data.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            {importStep === "map" && !importSummary && (
              <Button variant="outline" onClick={() => setImportStep("select")}>Back</Button>
            )}
            {importSummary ? (
              <Button onClick={resetImport} style={{ backgroundColor: primaryColor }} className="text-white">Done</Button>
            ) : (
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importStep !== "map" || !canImport || importMutation.isPending}
                style={{ backgroundColor: primaryColor }}
                className="text-white"
              >
                {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import Deals
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
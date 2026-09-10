import { useCallback, useEffect, useMemo, useState } from "react";
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
  SlidersHorizontal,
  Star,
  Table2,
  Upload,
} from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
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

type DealRecord = {
  id: string;
  address: string;
  city: string | null;
  county: string | null;
  state: string | null;
  sizeAcres: string | null;
  topRentPSF: string | null;
  avgRentPerUnit: string | null;
  askingPrice: string | null;
  productTypes: string[] | null;
};

type DeveloperDeal = {
  id: string;
  classification: "passed" | "review" | null;
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

function DealStatus({ row }: { row: DeveloperDeal }) {
  if (row.greenFlaggedByDeveloper) {
    return (
      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <Star className="mr-1 h-3 w-3 fill-current" />
        Pursuing
      </Badge>
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

export default function DeveloperDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profile = (user as any)?.developerProfile;
  const isGeneralSales = profile?.profileType === "general_sales";
  const primaryColor = profile?.primaryColor || "#0A2B4A";
  const secondaryColor = profile?.secondaryColor || "#4A90E2";

  useEffect(() => {
    if (isGeneralSales) {
      setLocation("/developer/crm");
    }
  }, [isGeneralSales, setLocation]);

  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, any>[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importStep, setImportStep] = useState<"select" | "map">("select");
  const [parsing, setParsing] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "pipeline" | "map">("table");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [showColumns, setShowColumns] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dealsQuery = useQuery<{ deals: DeveloperDeal[] }>({
    queryKey: ["/api/developer-profile/me/deals"],
    enabled: !isGeneralSales,
    queryFn: async () => {
      const response = await fetch("/api/developer-profile/me/deals", { credentials: "include" });
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
  const productTypeOptions = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((row) => {
      (row.matchedProductTypes || []).forEach((value) => values.add(value));
      (row.deal.productTypes || []).forEach((value) => values.add(value));
    });
    return Array.from(values).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !term || [row.deal.address, row.deal.city, row.deal.county, row.deal.state]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pursuing" && row.greenFlaggedByDeveloper) ||
        (statusFilter === "review" && row.classification === "review" && !row.greenFlaggedByDeveloper) ||
        (statusFilter === "passed" && row.classification !== "review" && !row.greenFlaggedByDeveloper);
      const productTypes = [...(row.matchedProductTypes || []), ...(row.deal.productTypes || [])];
      const matchesProductType = productTypeFilter === "all" || productTypes.includes(productTypeFilter);
      return matchesSearch && matchesStatus && matchesProductType;
    });
  }, [rows, search, statusFilter, productTypeFilter]);

  const counts = useMemo(() => ({
    total: rows.length,
    review: rows.filter((row) => row.classification === "review" && !row.greenFlaggedByDeveloper).length,
    passed: rows.filter((row) => row.classification !== "review" && !row.greenFlaggedByDeveloper).length,
    pursuing: rows.filter((row) => row.greenFlaggedByDeveloper).length,
  }), [rows]);

  const canImport = Boolean(file && mapping.address && mapping.acreage && rowCount > 0 && !parsing);

  const exportDeals = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Property", "City", "County", "State", "Acreage", "Rent", "Status", "Product Type"];
    const body = filteredRows.map((row) => [
      row.deal.address,
      row.deal.city,
      row.deal.county,
      row.deal.state,
      row.deal.sizeAcres,
      rentText(row.deal),
      row.greenFlaggedByDeveloper ? "Pursuing" : row.classification === "review" ? "Review" : "Passed",
      (row.matchedProductTypes || row.deal.productTypes || []).join(", "),
    ]);
    const csv = [header, ...body].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "landlinq-deals.csv";
    anchor.click();
    URL.revokeObjectURL(url);
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
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Redirecting to CRM…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-[1600px] px-3 py-5 sm:px-5 lg:px-6">
        <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: secondaryColor }}>
              Investment Company Portal
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Deal Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review, analyze, and manage deals shared with {profile?.companyName || "your company"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setImportOpen(true)} className="text-white shadow-sm" style={{ backgroundColor: primaryColor }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Import Deals
            </Button>
            <Button size="sm" variant="outline" onClick={exportDeals} className="border-[#4A90E2] text-[#2f73bb]">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={refreshDeals} disabled={refreshing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "All deals", value: counts.total, icon: Building2, tone: "text-slate-700 bg-slate-100", filter: "all" },
            { label: "Review", value: counts.review, icon: Search, tone: "text-amber-700 bg-amber-100", filter: "review" },
            { label: "Passed", value: counts.passed, icon: CheckCircle2, tone: "text-blue-700 bg-blue-100", filter: "passed" },
            { label: "Pursuing", value: counts.pursuing, icon: Star, tone: "text-emerald-700 bg-emerald-100", filter: "pursuing" },
          ].map(({ label, value, icon: Icon, tone }) => (
            <button
              key={label}
              type="button"
              onClick={() => setStatusFilter(statusFilter === label.toLowerCase() ? "all" : label.toLowerCase())}
              className={`flex items-center justify-between rounded-md border bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-[#4A90E2] ${
                statusFilter === label.toLowerCase() ? "border-[#4A90E2] ring-1 ring-[#4A90E2]/20" : "border-slate-200"
              }`}
            >
              <CardContent className="flex w-full items-center justify-between p-0">
                <div>
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-0.5 text-2xl font-bold text-slate-950">{value}</p>
                </div>
                <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></div>
              </CardContent>
            </button>
          ))}
        </div>

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
                  { value: "pipeline" as const, label: "Pipeline", icon: SlidersHorizontal },
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
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
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
                <Button type="button" size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => setShowColumns((open) => !open)}>
                  <Columns3 className="mr-1 h-3 w-3" />
                  Columns
                </Button>
              </div>
            </div>
            {showColumns && (
              <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                <Columns3 className="h-3.5 w-3.5" />
                Showing Property, Market, Acreage, Rent, Status, and Action columns
              </div>
            )}
          </div>

          {viewMode === "pipeline" ? (
            <div className="grid gap-3 bg-slate-50 p-3 md:grid-cols-3">
              {[
                { key: "review", label: "Review", tone: "border-amber-200 bg-amber-50" },
                { key: "passed", label: "Passed", tone: "border-blue-200 bg-blue-50" },
                { key: "pursuing", label: "Pursuing", tone: "border-emerald-200 bg-emerald-50" },
              ].map((stage) => {
                const stageRows = filteredRows.filter((row) =>
                  stage.key === "pursuing"
                    ? row.greenFlaggedByDeveloper
                    : stage.key === "review"
                      ? row.classification === "review" && !row.greenFlaggedByDeveloper
                      : row.classification !== "review" && !row.greenFlaggedByDeveloper,
                );
                return (
                  <div key={stage.key} className={`min-h-48 rounded-md border p-3 ${stage.tone}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">{stage.label}</h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{stageRows.length}</span>
                    </div>
                    <div className="space-y-2">
                      {stageRows.slice(0, 12).map((row) => (
                        <div key={row.id} className="rounded border border-white/80 bg-white p-2 text-xs shadow-sm">
                          <p className="font-medium text-slate-900">{row.deal.address}</p>
                          <p className="mt-1 text-slate-500">{[row.deal.city, row.deal.state].filter(Boolean).join(", ") || "Market unavailable"}</p>
                        </div>
                      ))}
                      {stageRows.length > 12 && <p className="pt-1 text-center text-xs text-slate-500">Showing first 12 deals</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === "map" ? (
            <div className="flex min-h-64 flex-col items-center justify-center bg-slate-50 px-6 text-center">
              <MapIcon className="mb-3 h-9 w-9 text-slate-300" />
              <h3 className="font-semibold text-slate-800">Market view</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Deal locations are shown below by market. Map coordinates are not available for every Investment Company deal yet.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {Array.from(new Set(filteredRows.map((row) => [row.deal.city, row.deal.state].filter(Boolean).join(", ")).filter(Boolean))).slice(0, 12).map((market) => (
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
              <h3 className="font-semibold text-slate-800">{search || statusFilter !== "all" || productTypeFilter !== "all" ? "No matching deals" : "No deals yet"}</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {search || statusFilter !== "all" || productTypeFilter !== "all" ? "Try clearing a filter or changing your search." : "Shared and imported deals will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-slate-300 hover:bg-slate-50">
                    <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Property</TableHead>
                    <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Market</TableHead>
                    <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Acreage</TableHead>
                    <TableHead className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rent</TableHead>
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
                      <TableCell className="whitespace-nowrap py-2.5 text-xs">{rentText(row.deal)}</TableCell>
                      <TableCell className="py-2.5"><DealStatus row={row} /></TableCell>
                      <TableCell className="py-2.5 text-right">
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
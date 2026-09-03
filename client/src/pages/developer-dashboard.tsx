import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Search,
  Star,
  Upload,
} from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profile = (user as any)?.developerProfile;
  const primaryColor = profile?.primaryColor || "#0A2B4A";
  const secondaryColor = profile?.secondaryColor || "#4A90E2";

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

  const dealsQuery = useQuery<{ deals: DeveloperDeal[] }>({
    queryKey: ["/api/developer-profile/me/deals"],
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
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(({ deal }) =>
      [deal.address, deal.city, deal.county, deal.state]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [rows, search]);

  const counts = useMemo(() => ({
    total: rows.length,
    review: rows.filter((row) => row.classification === "review" && !row.greenFlaggedByDeveloper).length,
    passed: rows.filter((row) => row.classification !== "review" && !row.greenFlaggedByDeveloper).length,
    pursuing: rows.filter((row) => row.greenFlaggedByDeveloper).length,
  }), [rows]);

  const canImport = Boolean(file && mapping.address && mapping.acreage && rowCount > 0 && !parsing);

  const rentText = (deal: DealRecord) => {
    if (profile?.rentMetric === "per_unit") {
      return deal.avgRentPerUnit ? `${money(deal.avgRentPerUnit)}/unit` : "—";
    }
    const value = Number(deal.topRentPSF);
    return Number.isFinite(value) ? `$${value.toFixed(2)}/SF` : "—";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: secondaryColor }}>
              Investment Company Portal
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Deal Dashboard</h1>
            <p className="mt-2 text-slate-500">Review every deal shared with {profile?.companyName || "your company"}.</p>
          </div>
          <Button
            onClick={() => setImportOpen(true)}
            className="text-white shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Deals
          </Button>
        </div>

        <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "All deals", value: counts.total, icon: Building2, tone: "text-slate-700 bg-slate-100" },
            { label: "Review", value: counts.review, icon: Search, tone: "text-amber-700 bg-amber-100" },
            { label: "Passed", value: counts.passed, icon: CheckCircle2, tone: "text-blue-700 bg-blue-100" },
            { label: "Pursuing", value: counts.pursuing, icon: Star, tone: "text-emerald-700 bg-emerald-100" },
          ].map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className="mt-1 text-3xl font-bold text-slate-950">{value}</p>
                </div>
                <div className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Your deal inbox</h2>
              <p className="text-sm text-slate-500">Most recently shared deals appear first.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search address or market"
                className="pl-9"
              />
            </div>
          </div>

          {dealsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin" style={{ color: primaryColor }} />
            </div>
          ) : dealsQuery.isError ? (
            <div className="p-8 text-center text-sm text-red-600">{(dealsQuery.error as Error).message}</div>
          ) : filteredRows.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <FileSpreadsheet className="mb-3 h-10 w-10 text-slate-300" />
              <h3 className="font-semibold text-slate-800">{search ? "No matching deals" : "No deals yet"}</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {search ? "Try a different address or market." : "Shared and imported deals will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Property</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Acreage</TableHead>
                    <TableHead>Rent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{row.deal.address}</div>
                        {row.deal.city && <div className="mt-1 text-xs text-slate-500">{row.deal.city}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {[row.deal.county, row.deal.state].filter(Boolean).join(", ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell>{row.deal.sizeAcres ? `${Number(row.deal.sizeAcres).toLocaleString()} ac` : "—"}</TableCell>
                      <TableCell>{rentText(row.deal)}</TableCell>
                      <TableCell><DealStatus row={row} /></TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={row.greenFlaggedByDeveloper ? "outline" : "default"}
                          disabled={row.greenFlaggedByDeveloper || pursueMutation.isPending}
                          onClick={() => pursueMutation.mutate(row.id)}
                          className={row.greenFlaggedByDeveloper ? "" : "text-white"}
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
    </div>
  );
}
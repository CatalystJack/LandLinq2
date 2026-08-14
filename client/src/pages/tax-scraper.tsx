import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Play,
  XCircle,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
} from "lucide-react";

// ── Column indices (0-based) ──────────────────────────────────────────────
const COL_PARCEL   = 15; // P
const FIRST_ROW    = 2;  // row 3 in Excel (0-based)
const LAST_ROW     = 226;

interface ParcelRow {
  rowIndex: number;         // 0-based index in sheet
  excelRow: number;         // 1-based display row (rowIndex + 1)
  parcelId: string;
  assessedValue: number | null;
  millageRate: number | null;
  directAssessments: number | null;
  interest: number | null;
  totalTaxBill: number | null;
  status: "pending" | "ok" | "error" | "skipped";
  error?: string;
}

type JobStatus = "idle" | "pending" | "running" | "done" | "error" | "cancelled";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtRate(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(4);
}

export default function TaxScraper() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParcelRow[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [completed, setCompleted] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [taxYear, setTaxYear] = useState<number>(2024);
  const [selectedMsa, setSelectedMsa] = useState<string>("");
  const [msaSearch, setMsaSearch] = useState<string>("");
  const [msaOpen, setMsaOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const msaDropdownRef = useRef<HTMLDivElement>(null);

  // MSA list
  const { data: msaData } = useQuery<{ success: boolean; markets: Array<{ msaName: string; county: string }> }>({
    queryKey: ["/api/msa/markets"],
  });
  const msaNames = useMemo(() => {
    if (!msaData?.markets) return [];
    const unique = Array.from(new Set(msaData.markets.map(m => m.msaName))).sort();
    return unique;
  }, [msaData]);
  const filteredMsas = useMemo(() =>
    msaSearch.trim()
      ? msaNames.filter(n => n.toLowerCase().includes(msaSearch.toLowerCase()))
      : msaNames,
    [msaNames, msaSearch]
  );

  // Close MSA dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (msaDropdownRef.current && !msaDropdownRef.current.contains(e.target as Node)) {
        setMsaOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Stop polling when finished
  useEffect(() => {
    if (["done", "error", "cancelled"].includes(jobStatus)) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
  }, [jobStatus]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Parse file client-side ──────────────────────────────────────────────
  const parseFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        // sheetRows limits how many rows XLSX even reads — makes parsing instant for large files
        const wb = XLSX.read(data, { type: "array", sheetRows: LAST_ROW + 1 });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const parsed: ParcelRow[] = [];
        // Direct cell access — much faster than sheet_to_json for targeted column reads
        for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c: COL_PARCEL })];
          if (!cell || cell.v == null) continue;
          const raw = cell.v;
          const pid = String(raw).trim().replace(/\.0$/, "").padStart(8, "0");
          if (!pid || pid === "00000000") continue;
          parsed.push({
            rowIndex: r,
            excelRow: r + 1,
            parcelId: pid,
            assessedValue: null,
            millageRate: null,
            directAssessments: null,
            interest: null,
            totalTaxBill: null,
            status: "pending",
          });
        }
        setRows(parsed);
      } catch {
        toast({ title: "Parse error", description: "Could not read parcel IDs from file", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(f);
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setJobId(null); setJobStatus("idle"); setCompleted(0); setErrorCount(0); setJobError(null); parseFile(f); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.match(/\.xlsx?$/i)) { setFile(f); setJobId(null); setJobStatus("idle"); setCompleted(0); setErrorCount(0); setJobError(null); parseFile(f); }
    else toast({ title: "Invalid file", description: "Please upload an .xlsx file", variant: "destructive" });
  };

  // ── Polling ─────────────────────────────────────────────────────────────
  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/tax-scraper/status/${id}`);
        if (!res.ok) return;
        const data = await res.json();

        setJobStatus(data.status);
        setCompleted(data.completed);
        if (data.errorMessage) setJobError(data.errorMessage);

        // Merge results into rows
        if (data.results?.length > 0) {
          setRows((prev) => {
            const updated = [...prev];
            for (const r of data.results) {
              const idx = updated.findIndex((row) => row.rowIndex === r.rowIndex);
              if (idx === -1) continue;
              updated[idx] = {
                ...updated[idx],
                assessedValue: r.assessedValue,
                millageRate: r.millageRate,
                directAssessments: r.directAssessments,
                interest: r.interest,
                totalTaxBill: r.totalTaxBill,
                status: r.skipped ? "skipped" : r.error ? "error" : "ok",
                error: r.error,
              };
            }
            return updated;
          });
          setErrorCount(data.results.filter((r: any) => r.error && !r.skipped).length);
        }
      } catch {}
    }, 2000);
  }, []);

  const handleStart = async () => {
    if (!file) return;
    setIsStarting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("taxYear", String(taxYear));
      if (selectedMsa) form.append("msaName", selectedMsa);
      const res = await fetch("/api/tax-scraper/start", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setJobId(data.jobId);
      setJobStatus("pending");
      setCompleted(0);
      setErrorCount(0);
      // Reset all rows to pending
      setRows((prev) => prev.map((r) => ({ ...r, status: "pending", assessedValue: null, millageRate: null, directAssessments: null, interest: null, totalTaxBill: null, error: undefined })));
      startPolling(data.jobId);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    await fetch(`/api/tax-scraper/cancel/${jobId}`, { method: "POST" });
    setJobStatus("cancelled");
    toast({ title: "Cancelled", description: "Scrape job stopped." });
  };

  const handleDownload = () => {
    if (!jobId) return;
    window.location.href = `/api/tax-scraper/download/${jobId}`;
  };

  const handleReset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null); setRows([]); setJobId(null); setJobStatus("idle"); setCompleted(0); setErrorCount(0); setJobError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isRunning  = jobStatus === "running" || jobStatus === "pending";
  const isDone     = jobStatus === "done";
  const isError    = jobStatus === "error";
  const isCancelled = jobStatus === "cancelled";
  const total      = rows.length;
  const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

  const totalDirect   = rows.reduce((s, r) => s + (r.directAssessments ?? 0), 0);
  const totalInterest = rows.reduce((s, r) => s + (r.interest ?? 0), 0);
  const totalTax      = rows.reduce((s, r) => s + (r.totalTaxBill ?? 0), 0);
  const hasTotals     = rows.some(r => r.status === "ok");

  // Status badge
  function StatusBadge({ row }: { row: ParcelRow }) {
    if (row.status === "ok")
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200"><CheckCircle2 className="h-3 w-3" />ok</span>;
    if (row.status === "error")
      return (
        <span title={row.error} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200 cursor-help">
          <AlertTriangle className="h-3 w-3" />error
        </span>
      );
    if (row.status === "skipped")
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">skipped</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">pending</span>;
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] print:bg-white">
      <Navigation />

      <div className="max-w-[1280px] mx-auto px-5 py-6 print:px-0">
        {/* Back link */}
        <div className="flex items-center gap-2 mb-5 print:hidden">
          <button onClick={() => setLocation("/launchpad")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Launchpad
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-800">Mecklenburg Tax Scraper</span>
        </div>

        <div className="flex gap-5 items-start">
          {/* ── Left sidebar ─────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 space-y-4 print:hidden">

            {/* Input Data */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-800 mb-0.5">Input Data</p>
              <p className="text-xs text-gray-400 mb-4">Upload your Excel file to begin</p>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  file ? "border-blue-300 bg-blue-50/60" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => !isRunning && fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="space-y-1.5">
                    <div className="mx-auto w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 break-all leading-snug">{file.name}</p>
                    <p className="text-xs text-blue-600 font-medium">{total > 0 ? `${total} parcels found` : "Reading…"}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Upload className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Drop .xlsx file here</p>
                    <p className="text-xs text-gray-300">or click to browse</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </div>

              {/* Expected columns note */}
              <div className="mt-3 text-xs text-gray-400 space-y-0.5">
                <p>• Column P: Parcel IDs (rows 3–227)</p>
                <p>• Fills J (Assessed), K (Millage), L (Direct), M (Interest), N (Total)</p>
              </div>

              {/* Tax Year */}
              <div className="mt-4">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Tax Year
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[2021, 2022, 2023, 2024, 2025].map(yr => (
                    <button
                      key={yr}
                      onClick={() => setTaxYear(yr)}
                      disabled={isRunning}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        taxYear === yr
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                      } disabled:opacity-40`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* MSA picker */}
              <div className="mt-4" ref={msaDropdownRef}>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                  <Building2 className="h-3.5 w-3.5" /> MSA / Market
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => { setMsaOpen(o => !o); setMsaSearch(""); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-left hover:border-blue-300 transition-colors disabled:opacity-40"
                  >
                    <span className={selectedMsa ? "text-gray-800 font-medium" : "text-gray-400"}>
                      {selectedMsa || "Select MSA…"}
                    </span>
                    {msaOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
                  </button>
                  {msaOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg">
                          <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <input
                            autoFocus
                            className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
                            placeholder="Search MSAs…"
                            value={msaSearch}
                            onChange={e => setMsaSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {selectedMsa && (
                          <button
                            className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:bg-gray-50 italic"
                            onClick={() => { setSelectedMsa(""); setMsaOpen(false); }}
                          >
                            Clear selection
                          </button>
                        )}
                        {filteredMsas.length === 0 && (
                          <p className="px-4 py-3 text-xs text-gray-400">No MSAs found</p>
                        )}
                        {filteredMsas.map(name => (
                          <button
                            key={name}
                            className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                              name === selectedMsa
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                            onClick={() => { setSelectedMsa(name); setMsaOpen(false); setMsaSearch(""); }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Start / Cancel */}
              <div className="mt-4 space-y-2">
                {!isRunning && !isDone && !isError && !isCancelled && (
                  <button
                    onClick={handleStart}
                    disabled={!file || total === 0 || isStarting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                  >
                    {isStarting ? <><RefreshCw className="h-4 w-4 animate-spin" /> Starting…</> : <><Play className="h-4 w-4" /> Start Scrape</>}
                  </button>
                )}
                {isRunning && (
                  <button onClick={handleCancel} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium border border-red-200 transition-colors">
                    <XCircle className="h-4 w-4" /> Cancel
                  </button>
                )}
                {(isDone || isError || isCancelled) && (
                  <button onClick={handleReset} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">
                    <RefreshCw className="h-4 w-4" /> Start Over
                  </button>
                )}
              </div>
            </div>

            {/* Job Status */}
            {jobStatus !== "idle" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">Job Status</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    isDone ? "bg-green-100 text-green-700" :
                    isRunning ? "bg-blue-100 text-blue-700" :
                    isError ? "bg-red-100 text-red-700" :
                    isCancelled ? "bg-gray-100 text-gray-600" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {isDone ? "done" : isError ? "error" : isCancelled ? "cancelled" : isRunning ? "running" : "pending"}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Progress</span>
                    <span className="font-medium text-gray-600">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isDone ? "bg-green-500" : isError ? "bg-red-400" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Completed</p>
                    <p className="text-lg font-bold text-gray-800">{completed}<span className="text-xs font-normal text-gray-400">/{total}</span></p>
                  </div>
                  <div className={`rounded-lg border p-3 ${errorCount > 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                    <p className={`text-xs mb-0.5 ${errorCount > 0 ? "text-red-500" : "text-gray-400"}`}>Errors</p>
                    <p className={`text-lg font-bold ${errorCount > 0 ? "text-red-600" : "text-gray-800"}`}>{errorCount}</p>
                  </div>
                </div>

                {isError && jobError && (
                  <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg p-2.5 border border-red-100">{jobError}</div>
                )}
                {isRunning && (
                  <p className="mt-3 text-xs text-blue-500 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Running with 3 parallel workers…
                  </p>
                )}
              </div>
            )}

            {/* Export Results */}
            {total > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-800 mb-0.5">Export Results</p>
                <p className="text-xs text-gray-400 mb-4">All scraped parcels</p>
                <div className="space-y-2">
                  <button
                    onClick={handleDownload}
                    disabled={!isDone}
                    className="w-full flex items-center gap-3 py-2.5 px-4 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-gray-700 font-medium transition-colors"
                  >
                    <div className="w-7 h-7 rounded bg-green-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-green-600" />
                    </div>
                    Export to Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="w-full flex items-center gap-3 py-2.5 px-4 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 font-medium transition-colors"
                  >
                    <div className="w-7 h-7 rounded bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Printer className="h-4 w-4 text-red-600" />
                    </div>
                    Export to PDF (Print)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Main: Results Explorer ────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Results Explorer</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {total > 0 ? `${total} parcels` : "Upload a file to see results"}
                  </p>
                </div>
                {total > 0 && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                      <Calendar className="h-3 w-3" />{taxYear}
                    </span>
                    {selectedMsa && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                        <Building2 className="h-3 w-3" />{selectedMsa}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {total === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                    <Upload className="h-6 w-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">Upload an Excel file to preview parcels</p>
                  <p className="text-xs text-gray-300 mt-1">Parcel IDs from column P will appear here</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[calc(100vh-240px)] print:overflow-visible print:max-h-none">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-14">Row</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Parcel ID</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Assessed Value</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Millage</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Direct Ass.</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Interest</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Tax</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((row) => (
                        <tr key={row.rowIndex} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{row.excelRow}</td>
                          <td className="px-4 py-3 font-mono font-medium text-gray-800 text-xs">{row.parcelId}</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-600">
                            {row.assessedValue !== null ? fmt(row.assessedValue) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-600">
                            {row.millageRate !== null ? fmtRate(row.millageRate) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-600">
                            {row.directAssessments !== null ? fmt(row.directAssessments) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-600">
                            {row.interest !== null ? fmt(row.interest) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">
                            {row.totalTaxBill !== null ? fmt(row.totalTaxBill) : <span className="text-gray-300 font-normal">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge row={row} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {hasTotals && (
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-gray-50">
                          <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Totals</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-gray-800">{fmt(totalDirect)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-gray-800">{fmt(totalInterest)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-blue-700">{fmt(totalTax)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          nav, .print\\:hidden { display: none !important; }
          table { font-size: 10px !important; width: 100% !important; }
          th, td { padding: 4px 6px !important; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ row }: { row: ParcelRow }) {
  if (row.status === "ok")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200"><CheckCircle2 className="h-3 w-3" />ok</span>;
  if (row.status === "error")
    return (
      <span title={row.error} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200 cursor-help">
        <AlertTriangle className="h-3 w-3" />error
      </span>
    );
  if (row.status === "skipped")
    return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200">skipped</span>;
  return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">pending</span>;
}

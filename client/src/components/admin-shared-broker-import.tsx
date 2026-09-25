import { useState } from "react";
import * as XLSX from "xlsx";
import { US_STATE_OPTIONS } from "@shared/us-states";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 20_000;
const CONFIRM_PREFIX = "IMPORT";

const fields = [
  { key: "fullName", label: "Full name", patterns: [/full.?name/, /^name$/] },
  { key: "firstName", label: "First name", patterns: [/first.*name/, /^first$/] },
  { key: "lastName", label: "Last name", patterns: [/last.*name/, /^last$/] },
  { key: "email", label: "Email", patterns: [/e-?mail/] },
  { key: "phone", label: "Phone", patterns: [/phone/, /mobile/, /cell/] },
  { key: "brokerage", label: "Brokerage / company", patterns: [/brokerage/, /firm/, /company/] },
  { key: "licenseNumber", label: "License number", patterns: [/licen[cs]e/, /lic #/] },
  { key: "stateRegion", label: "State in file (optional check)", patterns: [/^state$/, /mailing state/, /license state/] },
  { key: "county", label: "County", patterns: [/county/] },
  { key: "marketsCovered", label: "Markets covered", patterns: [/markets? covered/, /territory/] },
  { key: "sector", label: "Sector", patterns: [/sector/] },
  { key: "specialty", label: "Specialty", patterns: [/specialty/, /product type/] },
  { key: "confidence", label: "Confidence", patterns: [/confidence/] },
  { key: "sourceTags", label: "Shared source tags", patterns: [/db tags/, /database tags/, /source tags/, /^tags$/] },
] as const;

type FieldKey = typeof fields[number]["key"];
type Preview = {
  state: string;
  sourceRows: number;
  processedRows: number;
  skippedRows: number;
  duplicateRows: number;
  skippedReasons: Record<string, number>;
  updatedByLicense: number;
  updatedByEmail: number;
  inserted: number;
  sharedBrokersBefore: number;
  sharedBrokersAfter: number;
  stateBrokersBefore: number;
  stateBrokersAfter: number;
};
type Result = { state: string; inserted: number; updated: number; stateBrokersVerified: number };
type ParsedFile = { headers: string[]; rows: Record<string, unknown>[] };

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="text-2xl font-semibold tabular-nums text-[#102d4c]">{value.toLocaleString()}</div>
    <div className="mt-1 text-sm text-slate-600">{label}</div>
  </div>;
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

export default function AdminSharedBrokerImport() {
  const [state, setState] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewToken, setPreviewToken] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

  const resetPreview = () => {
    setPreview(null);
    setPreviewToken("");
    setConfirmation("");
    setResult(null);
    setError("");
  };

  const readFile = async (selected: File | null) => {
    resetPreview();
    setFile(null);
    setParsedFile(null);
    setMapping({});
    if (!selected) return;
    if (selected.size > MAX_FILE_BYTES) {
      setError("Choose a file that is 10 MB or smaller.");
      return;
    }
    if (!/\.(csv|xlsx)$/i.test(selected.name)) {
      setError("Choose a CSV or .xlsx file.");
      return;
    }
    try {
      const workbook = XLSX.read(new Uint8Array(await selected.arrayBuffer()), { type: "array", raw: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = sheet
        ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
        : [];
      const headers = rows.length ? Object.keys(rows[0]) : [];
      if (!headers.length || !rows.length) throw new Error("The first worksheet needs a header row and at least one contact.");
      if (headers.length > 100) throw new Error("The file has more than 100 columns.");
      if (rows.length > MAX_ROWS) throw new Error(`The file exceeds the ${MAX_ROWS.toLocaleString()}-row limit.`);
      const findHeader = (patterns: readonly RegExp[]) =>
        headers.find((header) => patterns.some((pattern) => pattern.test(header.toLowerCase()))) || "";
      setMapping(Object.fromEntries(fields.map((field) => [field.key, findHeader(field.patterns)])));
      setParsedFile({ headers, rows });
      setFile(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be read.");
    }
  };

  const onPreview = async () => {
    if (!file || !state) return;
    setBusy("preview");
    resetPreview();
    try {
      const body = new FormData();
      body.append("workbook", file);
      body.append("state", state);
      body.append("mapping", JSON.stringify(mapping));
      const response = await fetch("/api/admin/shared-broker-import/preview", {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
      setPreview(payload.preview);
      setPreviewToken(payload.previewToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview the shared list.");
    } finally {
      setBusy(null);
    }
  };

  const onApply = async () => {
    if (!preview || !previewToken) return;
    const expected = `${CONFIRM_PREFIX} ${preview.state} BROKERS`;
    if (confirmation !== expected) {
      setError(`Type "${expected}" exactly to continue.`);
      return;
    }
    setBusy("apply");
    setError("");
    try {
      const payload = await postJson("/api/admin/shared-broker-import/apply", { previewToken, confirmation });
      setResult(payload);
      setPreviewToken("");
      setConfirmation("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The shared import could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  return <div className="space-y-5">
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
      Upload a list for any U.S. state. Imported records go into the shared LandLinq broker directory, not one company’s private CRM. Developer companies see shared contacts according to their existing state, county, sector, and source-tag settings.
    </div>

    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-[#102d4c]">
          <FileSpreadsheet className="h-5 w-5" />
          Add a shared state broker list
        </CardTitle>
        <p className="text-sm text-slate-600">Upload a CSV or Excel workbook. The first worksheet is used; choose one state per file.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {!result && <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shared-broker-state">State for this list</Label>
              <select
                id="shared-broker-state"
                value={state}
                onChange={(event) => { setState(event.target.value); resetPreview(); }}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="">Select a state</option>
                {US_STATE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shared-broker-file">Broker list</Label>
              <Input id="shared-broker-file" type="file" accept=".csv,.xlsx" onChange={(event) => void readFile(event.target.files?.[0] || null)} />
              <p className="text-xs text-slate-500">Maximum 10 MB and 20,000 contacts. Keep license numbers formatted as text to preserve leading zeroes.</p>
            </div>
          </div>

          {parsedFile && file && <div className="space-y-4 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="font-medium text-slate-900">{file.name}</p><p className="text-xs text-slate-500">{parsedFile.rows.length.toLocaleString()} rows · first worksheet only</p></div>
              <Button type="button" variant="outline" onClick={() => void readFile(null)}>Remove file</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((field) => <div key={field.key}>
                <Label htmlFor={`shared-map-${field.key}`} className="text-xs">{field.label}</Label>
                <select
                  id={`shared-map-${field.key}`}
                  value={mapping[field.key] || ""}
                  onChange={(event) => { setMapping((current) => ({ ...current, [field.key]: event.target.value })); resetPreview(); }}
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                >
                  <option value="">Not mapped</option>
                  {parsedFile.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </div>)}
            </div>
            <p className="text-xs leading-5 text-slate-500">New contacts are matched by selected state plus license number, then by shared email. Company-private CRM notes, tags, and assignments are not changed.</p>
          </div>}

          {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
          <Button type="button" onClick={onPreview} disabled={!file || !state || busy !== null} className="bg-[#0A2B4A] text-white hover:border hover:border-[#498EDE] hover:bg-white hover:text-[#498EDE]">
            {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Preview shared import
          </Button>
        </>}

        {preview && !result && <div className="space-y-5 rounded-lg border border-blue-200 bg-white p-4">
          <div>
            <h3 className="font-semibold text-[#102d4c]">{preview.state} shared directory preview</h3>
            <p className="text-sm text-slate-600">This preview expires in 30 minutes and is bound to the current shared-broker snapshot.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Source rows" value={preview.sourceRows} />
            <Metric label="Ready after file deduplication" value={preview.processedRows} />
            <Metric label="Skipped rows" value={preview.skippedRows} />
            <Metric label="Duplicate rows merged" value={preview.duplicateRows} />
            <Metric label="Matched by state + license" value={preview.updatedByLicense} />
            <Metric label="Matched by shared email" value={preview.updatedByEmail} />
            <Metric label="New shared contacts" value={preview.inserted} />
            <Metric label={`${preview.state} shared contacts after import`} value={preview.stateBrokersAfter} />
          </div>
          {preview.skippedRows > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-semibold">Rows that will be skipped</p>
            <ul className="mt-1 list-inside list-disc">{Object.entries(preview.skippedReasons).map(([reason, count]) => <li key={reason}>{count.toLocaleString()} — {reason}</li>)}</ul>
          </div>}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Existing shared contacts for {preview.state}: {preview.stateBrokersBefore.toLocaleString()}. Shared directory total: {preview.sharedBrokersBefore.toLocaleString()} → {preview.sharedBrokersAfter.toLocaleString()}.
          </div>
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <Label htmlFor="shared-import-confirmation">To apply, type {`IMPORT ${preview.state} BROKERS`}</Label>
            <Input id="shared-import-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <Button type="button" onClick={onApply} disabled={confirmation !== `IMPORT ${preview.state} BROKERS` || busy !== null} className="bg-[#0A2B4A] text-white hover:border hover:border-[#498EDE] hover:bg-white hover:text-[#498EDE]">
              {busy === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Apply shared import
            </Button>
          </div>
        </div>}

        {result && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />Shared {result.state} list imported</div>
          <p className="mt-2 text-sm">Added {result.inserted.toLocaleString()} new shared contacts and updated {result.updated.toLocaleString()} matched contacts. {result.stateBrokersVerified.toLocaleString()} shared {result.state} contacts verified.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => { setFile(null); setParsedFile(null); setMapping({}); resetPreview(); }}>Start another import</Button>
        </div>}
      </CardContent>
    </Card>
  </div>;
}
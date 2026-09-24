import { useState } from "react";
import Navigation from "@/components/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Database, FileSpreadsheet, Loader2, ShieldCheck } from "lucide-react";

const confirmationText = "IMPORT NC AND TN BROKERS";

type Preview = {
  workbooks: Array<{ state: "NC" | "TN"; fileName: string; sourceRows: number }>;
  dedupedRowsBeforeCrossStateEmailMatch: number;
  crossStateEmailDuplicates: number;
  sharedBrokersBefore: number;
  sharedBrokersAfter: number;
  updatedByLicense: number;
  updatedByEmail: number;
  inserted: number;
  companyCrmRowsPreserved: number;
  usersUnchanged: number;
  dealsUnchanged: number;
  companyCrmRowsUnchanged: number;
  stateOptionsBefore: Array<{ state: "NC" | "TN"; brokers: number }>;
  stateOptionsAfter: Array<{ state: "NC" | "TN"; brokers: number }>;
};

type ImportResult = {
  success: boolean;
  message: string;
  result: Preview & {
    updated: number;
    inserted: number;
    stateOptionsVerified: Array<{ state: string; brokers: number }>;
  };
};

async function submitWorkbooks(
  endpoint: string,
  ncFile: File,
  tnFile: File,
  extra: Record<string, string> = {},
) {
  const formData = new FormData();
  formData.append("ncWorkbook", ncFile);
  formData.append("tnWorkbook", tnFile);
  for (const [key, value] of Object.entries(extra)) formData.append(key, value);

  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-2xl font-semibold tabular-nums text-[#102d4c]">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
    </div>
  );
}

export default function BrokerStateImportPage() {
  const [ncFile, setNcFile] = useState<File | null>(null);
  const [tnFile, setTnFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewToken, setPreviewToken] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

  const resetPreview = () => {
    setPreview(null);
    setPreviewToken("");
    setConfirmation("");
    setResult(null);
    setError("");
  };

  const onPreview = async () => {
    if (!ncFile || !tnFile) {
      setError("Choose both approved workbooks before previewing.");
      return;
    }
    setBusy("preview");
    resetPreview();
    try {
      const payload = await submitWorkbooks("/api/admin/broker-state-import/preview", ncFile, tnFile);
      setPreview(payload.preview);
      setPreviewToken(payload.previewToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview the workbooks.");
    } finally {
      setBusy(null);
    }
  };

  const onApply = async () => {
    if (!ncFile || !tnFile || !preview || !previewToken) return;
    if (confirmation !== confirmationText) {
      setError(`Type "${confirmationText}" exactly to continue.`);
      return;
    }
    setBusy("apply");
    setError("");
    try {
      const payload = await submitWorkbooks(
        "/api/admin/broker-state-import/apply",
        ncFile,
        tnFile,
        { previewToken, confirmation },
      );
      setResult(payload);
      setPreviewToken("");
      setConfirmation("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The import could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
        <PageHeader
          eyebrow="Platform admin"
          title="NC and TN broker import"
          description="A one-time, additive production import using the app’s existing database connection."
        />

        <div className="mb-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong>Production only.</strong> This tool is disabled in development. It accepts only the approved NC and TN workbooks, previews live production counts, and writes broker rows only after an explicit confirmation.
          </div>
        </div>

        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-[#102d4c]">
              <FileSpreadsheet className="h-5 w-5" />
              Select both approved workbooks
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nc-workbook">North Carolina workbook</Label>
              <Input
                id="nc-workbook"
                type="file"
                accept=".xlsx"
                onChange={(event) => {
                  setNcFile(event.target.files?.[0] ?? null);
                  resetPreview();
                }}
              />
              <p className="text-xs text-slate-500">The uploaded file must match the approved September 2026 NC workbook exactly.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tn-workbook">Tennessee workbook</Label>
              <Input
                id="tn-workbook"
                type="file"
                accept=".xlsx"
                onChange={(event) => {
                  setTnFile(event.target.files?.[0] ?? null);
                  resetPreview();
                }}
              />
              <p className="text-xs text-slate-500">The uploaded file must match the approved September 2026 TN workbook exactly.</p>
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                disabled={!ncFile || !tnFile || busy !== null || Boolean(result)}
                onClick={onPreview}
              >
                {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Preview production impact
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {preview && !result && (
          <Card className="mb-6 border-blue-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-[#102d4c]">Production preview</CardTitle>
              <p className="text-sm text-slate-600">This token expires in 30 minutes and is tied to these files and the current production broker snapshot.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {preview.workbooks.map((workbook) => (
                  <Metric key={workbook.state} label={`${workbook.state} source rows`} value={workbook.sourceRows} />
                ))}
                <Metric label="Matched by state + license" value={preview.updatedByLicense} />
                <Metric label="Matched by shared email" value={preview.updatedByEmail} />
                <Metric label="New shared brokers" value={preview.inserted} />
                <Metric label="Shared brokers after import" value={preview.sharedBrokersAfter} />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-2 font-semibold text-[#102d4c]">Records kept outside this import</h3>
                <p className="text-sm leading-6 text-slate-700">
                  Users: {preview.usersUnchanged.toLocaleString()} unchanged; deals: {preview.dealsUnchanged.toLocaleString()} unchanged; company CRM rows: {preview.companyCrmRowsUnchanged.toLocaleString()} unchanged.
                  {" "}{preview.companyCrmRowsPreserved.toLocaleString()} existing company CRM links on matched brokers will remain attached. The only table written is the shared broker directory.
                </p>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="mb-2 font-semibold text-emerald-950">State options expected after import</h3>
                <div className="flex flex-wrap gap-3 text-sm text-emerald-900">
                  {preview.stateOptionsAfter.map((state) => (
                    <span key={state.state} className="rounded-full border border-emerald-300 bg-white px-3 py-1">
                      {state.state}: {state.brokers.toLocaleString()} brokers
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-emerald-900">
                  Current production totals: {preview.stateOptionsBefore.map((state) => `${state.state} ${state.brokers.toLocaleString()}`).join(" · ")}.
                </p>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-5">
                <Label htmlFor="import-confirmation">To approve the broker-only production transaction, type {confirmationText}</Label>
                <Input
                  id="import-confirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  placeholder={confirmationText}
                />
                <p className="text-xs text-slate-500">The import runs in one transaction. If a write or state-count verification fails, the transaction rolls back.</p>
                <Button
                  type="button"
                  disabled={confirmation !== confirmationText || busy !== null}
                  onClick={onApply}
                >
                  {busy === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Apply this production import
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              {result.message}
            </div>
            <p className="mt-2 text-sm">
              Updated {result.result.updated.toLocaleString()} existing broker rows and inserted {result.result.inserted.toLocaleString()} new rows.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {result.result.stateOptionsVerified.map((state) => (
                <span key={state.state} className="rounded-full border border-emerald-300 bg-white px-3 py-1">
                  {state.state}: {state.brokers.toLocaleString()} brokers verified
                </span>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
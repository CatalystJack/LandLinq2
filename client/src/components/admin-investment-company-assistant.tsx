import { useRef, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { FileText, Loader2, MessageCircle, Sparkles, Upload } from "lucide-react";
import { investmentCompanyAssistantDraftSchema, type InvestmentCompanyAssistantDraft } from "@shared/company-profile-assistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  onUseDraft: (draft: InvestmentCompanyAssistantDraft) => void;
};

type CsvCriteriaRow = {
  companyName: string;
  criteriaText: string;
};

const MAX_CRITERIA_LENGTH = 30000;
const MAX_FILE_BYTES = 512_000;
const ACCEPTED_FILE_EXTENSIONS = [".txt", ".md", ".csv", ".json"];
const CSV_CRITERIA_COLUMNS = [
  "Buyer Profile",
  "Target Asset Types",
  "Target Size",
  "Target Deal Size",
  "Target Markets",
  "Strategy",
] as const;

function parseBuyerCriteriaCsv(text: string): CsvCriteriaRow[] {
  const workbook = XLSX.read(text, { type: "string" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("The CSV has no readable rows.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const companyHeader = Object.keys(rows[0] || {}).find((header) => normalizeHeader(header) === "owner sponsor");
  if (!companyHeader) throw new Error("This CSV needs an Owner / Sponsor column.");
  const criteriaHeaders: Array<{ label: string; key: string }> = [];
  for (const label of CSV_CRITERIA_COLUMNS) {
    const key = Object.keys(rows[0] || {}).find((header) => normalizeHeader(header) === normalizeHeader(label));
    if (key) criteriaHeaders.push({ label, key });
  }
  if (!criteriaHeaders.length) throw new Error("No supported acquisition-criteria columns were found.");

  return rows.flatMap((row) => {
    const rawCompanyName = String(row[companyHeader] || "").trim();
    if (!rawCompanyName) return [];
    const companyName = rawCompanyName.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const criteriaText = criteriaHeaders
      .map(({ label, key }) => {
        const value = String(row[key] || "").trim();
        return value ? `${label}: ${value}` : "";
      })
      .filter(Boolean)
      .join("\n");
    return criteriaText ? [{ companyName: companyName || "Company name needs review", criteriaText }] : [];
  });
}

function formatAmount(value: number | null | undefined): string {
  return value === null || value === undefined ? "not specified" : String(value);
}

export default function AdminInvestmentCompanyAssistant({ onUseDraft }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [criteriaText, setCriteriaText] = useState("");
  const [fileName, setFileName] = useState("");
  const [csvRows, setCsvRows] = useState<CsvCriteriaRow[]>([]);
  const [selectedCsvRow, setSelectedCsvRow] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState<InvestmentCompanyAssistantDraft | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCsvRows([]);
    setSelectedCsvRow("");
    setCriteriaText("");
    setFileName("");
    setDraft(null);
    const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    if (!ACCEPTED_FILE_EXTENSIONS.includes(extension)) {
      setError("Choose a plain-text, Markdown, CSV, or JSON file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("The selected file must be 500 KB or smaller.");
      return;
    }

    try {
      const text = await file.text();
      if (extension === ".csv") {
        const parsedRows = parseBuyerCriteriaCsv(text);
        if (!parsedRows.length) {
          setError("No rows with a company name and acquisition criteria were found.");
          return;
        }
        setCsvRows(parsedRows);
        setSelectedCsvRow("0");
        setCriteriaText(parsedRows[0].criteriaText);
      } else if (text.length > MAX_CRITERIA_LENGTH) {
        setError("Criteria text must be 30,000 characters or fewer.");
        return;
      } else {
        setCsvRows([]);
        setSelectedCsvRow("");
        setCriteriaText(text);
      }
      setFileName(file.name);
      setDraft(null);
      setError(null);
    } catch {
      setError("The selected file could not be read as text.");
    }
  };

  const prepareDraft = async () => {
    const text = criteriaText.trim();
    if (!text || isSending) return;
    if (text.length > MAX_CRITERIA_LENGTH) {
      setError("Criteria text must be 30,000 characters or fewer.");
      return;
    }

    setMessages((current) => [
      ...current,
      { role: "user", content: fileName ? `Prepare a profile from ${fileName}` : "Prepare a profile from the supplied criteria" },
    ]);
    setDraft(null);
    setError(null);
    setIsSending(true);

    try {
      const selectedRow = csvRows[Number(selectedCsvRow)];
      const response = await fetch("/api/admin/investment-companies/assistant/parse-criteria", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteriaText: text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The assistant could not prepare a profile draft.");

      const parsedDraft = investmentCompanyAssistantDraftSchema.parse(payload.draft);
      setDraft(selectedRow ? { ...parsedDraft, companyName: selectedRow.companyName } : parsedDraft);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: String(payload.answer || "I prepared a draft. Review the fields before saving."),
        },
      ]);
      setCriteriaText("");
      setFileName("");
      setCsvRows([]);
      setSelectedCsvRow("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not prepare a profile draft.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="mb-6 border-[#cbd9e8] shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base text-[#0A2B4A]">
            <Sparkles className="h-4 w-4 text-[#4A90E2]" />
            Company profile assistant
          </CardTitle>
          <CardDescription className="mt-1">
            Turn written criteria into a profile draft. Nothing is created until you review and save the profile form.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={() => setIsOpen((open) => !open)}>
          <MessageCircle className="mr-2 h-4 w-4" />
          {isOpen ? "Close assistant" : "Open assistant"}
        </Button>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-4 border-t border-slate-100 pt-4">
          <div className="max-h-44 space-y-2 overflow-y-auto" aria-live="polite">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                Paste criteria or upload a text file. I’ll extract profile fields and point out details that need review.
              </div>
            ) : messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${message.role === "user" ? "bg-[#0A2B4A] text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
                  {message.content}
                </p>
              </div>
            ))}
          </div>

          <Textarea
            value={criteriaText}
            onChange={(event) => {
              setCriteriaText(event.target.value);
              setCsvRows([]);
              setSelectedCsvRow("");
              setFileName("");
              setDraft(null);
              setError(null);
            }}
            rows={5}
            maxLength={MAX_CRITERIA_LENGTH + 1}
            placeholder="Paste acquisition criteria, target markets, product types, acreage, and rent requirements…"
            aria-label="Company criteria text"
            disabled={isSending}
          />
          {csvRows.length > 0 && (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <label className="text-sm font-medium text-slate-800" htmlFor="buyer-criteria-csv-row">Choose one company</label>
              <Select
                value={selectedCsvRow}
                onValueChange={(value) => {
                  const row = csvRows[Number(value)];
                  setSelectedCsvRow(value);
                  setCriteriaText(row?.criteriaText || "");
                  setDraft(null);
                  setError(null);
                }}
              >
                <SelectTrigger id="buyer-criteria-csv-row" className="bg-white">
                  <SelectValue placeholder="Select a company row" />
                </SelectTrigger>
                <SelectContent>
                  {csvRows.map((row, index) => (
                    <SelectItem key={`${index}-${row.companyName}`} value={String(index)}>
                      {row.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-600">Only buyer profile and acquisition-criteria columns are used. Contact names, emails, phone numbers, and CRM property fields are excluded.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
                onChange={handleFileSelection}
                className="sr-only"
                aria-label="Upload criteria text file"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSending}>
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV or text
              </Button>
              {fileName && (
                <span className="inline-flex max-w-48 items-center gap-1 truncate text-xs text-slate-500">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  {fileName}
                </span>
              )}
            </div>
            <Button
              type="button"
              onClick={prepareDraft}
              disabled={!criteriaText.trim() || isSending}
              className="bg-[#0A2B4A] text-white hover:bg-white hover:text-[#4A90E2] hover:ring-1 hover:ring-[#4A90E2]"
            >
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isSending ? "Preparing draft…" : "Prepare profile draft"}
            </Button>
          </div>
          <p className="text-xs text-slate-500">Files up to 500 KB. CSV uploads let you choose one company row; only the selected row’s criteria are sent for drafting. Nothing is created until you review and save the draft.</p>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}

          {draft && (
            <div className="space-y-3 rounded-xl border border-[#cbd9e8] bg-slate-50 p-4" data-testid="admin-profile-assistant-draft">
              <div>
                <p className="font-semibold text-slate-900">{draft.companyName || "Company name needs review"}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {draft.profileType === "general_sales" ? "General Sales" : `${draft.assetClass === "industrial" ? "Industrial" : draft.assetClass === "rural_land" ? "Rural Land" : "Multifamily"} real estate`}
                  {draft.slug ? ` · /developer/${draft.slug}/login` : ""}
                </p>
              </div>
              {!!draft.targetStates?.length && (
                <p className="text-sm text-slate-700"><span className="font-medium">Target states:</span> {draft.targetStates.join(", ")}</p>
              )}
              {!!draft.productTypes?.length && (
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-800">Product types</p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {draft.productTypes.map((productType, index) => (
                      <li key={`${productType.name || "product"}-${index}`}>
                        {productType.name || "Unnamed type"} · {formatAmount(productType.minAcres)} acres minimum · {draft.rentMetric === "psf" ? "$/SF" : "$/unit"} {formatAmount(draft.rentMetric === "psf" ? productType.minRentPsf : productType.minRentPerUnit)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!draft.warnings?.length && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Review these details</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {draft.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                  </ul>
                </div>
              )}
              <Button
                type="button"
                onClick={() => onUseDraft(draft)}
                className="bg-[#0A2B4A] text-white hover:bg-white hover:text-[#4A90E2] hover:ring-1 hover:ring-[#4A90E2]"
              >
                Review draft in profile form
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
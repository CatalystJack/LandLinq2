import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { AlertCircle, ChevronDown, ChevronUp, FileText, Mail, Search } from "lucide-react";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { isPlatformAdminEmail } from "@shared/admin-auth";

type UnknownRecord = Record<string, any>;
interface AuditResponse { items: UnknownRecord[]; total: number; page: number; limit: number; }

const text = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
  return String(value);
};

// Email markup is deliberately converted to text, rather than rendered, so an
// inbound email can never execute markup in the audit interface.
const readableEmail = (value: unknown) => {
  const source = String(value || "");
  if (!source) return "No email body was retained.";
  const doc = new DOMParser().parseFromString(source, "text/html");
  return (doc.body.textContent || source).replace(/\n[ \t]*\n[ \t]*/g, "\n\n").trim();
};

const dateText = (value: unknown) => {
  try { return value ? format(new Date(String(value)), "MMM d, yyyy p") : "—"; } catch { return text(value); }
};

function ComparisonTable({ comparisons }: { comparisons: any }) {
  const entries: [string, any][] = Array.isArray(comparisons)
    ? comparisons.map((item: any) => [item.field || item.key || "Field", item])
    : Object.entries(comparisons || {});
  if (!entries.length) return <p className="text-sm text-muted-foreground">No extracted-to-final comparison was recorded.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-muted/50 text-left"><tr><th className="p-2">Field</th><th className="p-2">Extracted</th><th className="p-2">Final deal value</th></tr></thead>
        <tbody>
          {entries.map(([field, value]) => {
            const row = typeof value === "object" && value !== null ? value : { extracted: value };
             const extracted = row.extracted ?? row.parsed ?? row.intake ?? row.intakeValue ?? row.source;
             const finalValue = row.final ?? row.deal ?? row.dealValue ?? row.value ?? row.destination;
            const mismatch = row.mismatch === true || row.matches === false ||
              (extracted !== undefined && finalValue !== undefined && text(extracted) !== text(finalValue));
            return <tr key={field} className={mismatch ? "bg-amber-50 text-amber-950" : "border-t"}><td className="p-2 font-medium">{field}{mismatch && <Badge className="ml-2 bg-amber-200 text-amber-900 hover:bg-amber-200">Mismatch</Badge>}</td><td className="p-2 whitespace-pre-wrap">{text(extracted)}</td><td className="p-2 whitespace-pre-wrap">{text(finalValue)}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function AuditItem({ item }: { item: UnknownRecord }) {
  const [open, setOpen] = useState(false);
  const dealId = item.dealId || item.deal?.id || item.resultingDealId;
   const { data: detail, isLoading } = useQuery<UnknownRecord>({
    queryKey: ["/api/admin/intake-audit/deals", dealId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/intake-audit/deals/${dealId}`, { credentials: "include" });
      if (response.status === 404) return {};
      if (!response.ok) throw new Error("Unable to load intake audit detail");
      return response.json();
    },
     enabled: open && !!dealId,
  });
   const intake = detail?.intake || item.intake || item;
  const deal = detail?.deal || item.deal || {};
  const attachments = intake.attachments || intake.attachmentNames || [];
  const attachmentList = Array.isArray(attachments) ? attachments : [];
  const status = item.status || intake.status || "unknown";

  return <Card className="overflow-hidden">
    <CardContent className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{text(status)}</Badge><span className="text-xs text-muted-foreground">{dateText(item.createdAt || intake.createdAt)}</span></div>
          <h2 className="mt-2 font-semibold text-catalyst-navy">{text(intake.subject || item.subject || deal.address || item.address)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">From {text(intake.fromEmail || intake.sender || item.fromEmail)} · {text(deal.address || item.address || intake.parsedAddress)}</p>
           <p className="mt-2 text-sm"><span className="font-medium">Source:</span> {text(intake.routingReason || item.routingReason || intake.channel || "Email intake")} {(intake.overallConfidence ?? intake.confidence) != null && <> · <span className="font-medium">Confidence:</span> {text(intake.overallConfidence ?? intake.confidence)}</>}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {dealId && <Link href={`/deals/${dealId}`}><Button size="sm" variant="outline">View deal</Button></Link>}
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}{open ? "Hide" : "Audit"}</Button>
        </div>
      </div>
      {open && <div className="mt-4 space-y-5 border-t pt-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading intake record…</p> : <>
           <div className="grid gap-3 text-sm sm:grid-cols-2"><div><span className="font-medium">Sender:</span> {text(intake.fromName ? `${intake.fromName} <${intake.fromEmail}>` : intake.fromEmail || intake.sender)}</div><div><span className="font-medium">Routing reason:</span> {text(intake.routingReason)}</div><div><span className="font-medium">Confidence:</span> {text(intake.overallConfidence ?? intake.confidence)}</div><div><span className="font-medium">Attachments:</span> {attachmentList.length ? attachmentList.map(text).join(", ") : text(intake.attachmentCount ? `${intake.attachmentCount} attachment(s)` : null)}</div></div>
          {intake.reviewNotes && <div><p className="mb-1 text-sm font-medium">Review notes</p><p className="whitespace-pre-wrap text-sm">{text(intake.reviewNotes)}</p></div>}
          <div><p className="mb-1 flex items-center gap-1 text-sm font-medium"><Mail className="h-4 w-4" /> Full email body</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-sm">{readableEmail(intake.emailHtml || intake.html || intake.emailBody || intake.rawText || intake.body)}</pre></div>
           <div><p className="mb-2 flex items-center gap-1 text-sm font-medium"><FileText className="h-4 w-4" /> Extracted versus final</p><ComparisonTable comparisons={detail?.comparisons || item.comparisons} /></div>
        </>}
      </div>}
    </CardContent>
  </Card>;
}

export default function IntakeAudit() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const email = String((user as any)?.claims?.email || (user as any)?.email || "");
  const allowed = isPlatformAdminEmail(email);
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) params.set("status", status); if (fromDate) params.set("fromDate", fromDate); if (toDate) params.set("toDate", toDate); if (appliedSearch) params.set("search", appliedSearch);
  const { data, isLoading, isError } = useQuery<AuditResponse>({ queryKey: ["/api/admin/intake-audit", status, fromDate, toDate, appliedSearch, page], queryFn: async () => { const r = await fetch(`/api/admin/intake-audit?${params}`, { credentials: "include" }); if (!r.ok) throw new Error("Unable to load intake audit"); return r.json(); }, enabled: allowed });
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 20)));
  return <div className="min-h-screen bg-gray-50 flex flex-col"><Navigation /><main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6">
    {!allowed ? <Card className="max-w-md mx-auto"><CardContent className="p-6 text-center"><AlertCircle className="mx-auto mb-3 text-red-500" /><h1 className="font-semibold">Access denied</h1><p className="mt-1 text-sm text-muted-foreground">Intake Audit is available to platform administrators only.</p></CardContent></Card> : <>
      <div className="mb-6"><h1 className="text-2xl font-bold text-catalyst-navy">Intake Audit</h1><p className="mt-1 text-sm text-muted-foreground">Review email sourcing, extraction, and final deal values. Results are newest first.</p></div>
      <Card className="mb-5"><CardContent className="p-4"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={e => { e.preventDefault(); setPage(1); setAppliedSearch(search); }}><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sender, subject, deal" /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><Input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} aria-label="From date" /><Input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} aria-label="To date" /><Button type="submit"><Search className="mr-2 h-4 w-4" />Search</Button></form></CardContent></Card>
      <p className="mb-3 text-sm text-muted-foreground">{data?.total ?? 0} audit record{data?.total === 1 ? "" : "s"}</p>
      {isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading audit records…</p> : isError ? <p className="py-12 text-center text-sm text-red-600">Unable to load intake audit records.</p> : !data?.items.length ? <p className="py-12 text-center text-sm text-muted-foreground">No intake records match these filters.</p> : <div className="space-y-3">{data.items.map((item, index) => <AuditItem key={item.id || item.dealId || index} item={item} />)}</div>}
      <div className="mt-5 flex items-center justify-between"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button></div>
    </>}</main><Footer /></div>;
}
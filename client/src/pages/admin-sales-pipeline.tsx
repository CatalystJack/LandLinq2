import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarClock, Check, ChevronRight, FileText, Mail, MessageSquare, Plus, RefreshCw, Send, Users } from "lucide-react";
import Navigation from "@/components/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isPlatformAdminEmail } from "@shared/admin-auth";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Stage = { id: string; name: string; sortOrder: number; isActive: boolean };
type Prospect = {
  id: string;
  companyName: string;
  website: string | null;
  industry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stageId: string;
  stageName: string | null;
  estimatedValue: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  notes: string | null;
  updatedAt: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
};
type Template = { id: string; name: string; subject: string; body: string };
type Detail = {
  prospect: Prospect;
  activities: { id: string; type: string; subject: string | null; body: string | null; createdAt: string }[];
  documents: { id: string; name: string; documentType: string | null; status: string; url: string | null }[];
  emails: { id: string; toEmail: string; subject: string; sentAt: string }[];
};
type PipelineResponse = {
  stages: Stage[];
  prospects: Prospect[];
  templates: Template[];
  owners: { id: string; email: string; firstName: string | null; lastName: string | null }[];
  stats: { total: number; open: number; followUpsDue: number; estimatedValue: number };
};

const emptyProspect = {
  companyName: "",
  website: "",
  industry: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  estimatedValue: "",
  nextFollowUpAt: "",
  ownerId: "",
  notes: "",
};

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(prospect: Prospect) {
  return (prospect.companyName || "P").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function AdminSalesPipeline() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const email = String((user as any)?.claims?.email || (user as any)?.email || "").toLowerCase();
  const isPlatformAdmin = isAuthenticated && isPlatformAdminEmail(email);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newProspect, setNewProspect] = useState(emptyProspect);
  const [activity, setActivity] = useState({ type: "note", subject: "", body: "" });
  const [document, setDocument] = useState({ name: "", url: "", documentType: "agreement" });
  const [newStage, setNewStage] = useState("");
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", body: "" });

  const pipelineQuery = useQuery<PipelineResponse>({
    queryKey: ["/api/admin/sales-pipeline"],
    enabled: isPlatformAdmin,
  });
  const selected = pipelineQuery.data?.prospects.find((prospect) => prospect.id === selectedId) || null;
  const detailQuery = useQuery<Detail>({
    queryKey: [`/api/admin/sales-pipeline/prospects/${selectedId}`],
    enabled: Boolean(isPlatformAdmin && selectedId),
  });
  const detail = detailQuery.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sales-pipeline"] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: [`/api/admin/sales-pipeline/prospects/${selectedId}`] });
  };

  const mutation = useMutation({
    mutationFn: async ({ method, url, body }: { method: string; url: string; body?: unknown }) => {
      const response = await apiRequest(method, url, body);
      return response.json().catch(() => ({}));
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Saved", description: "The sales workspace was updated." });
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });

  const stageGroups = useMemo(() => pipelineQuery.data?.stages.filter((stage) => stage.isActive) || [], [pipelineQuery.data?.stages]);

  const createProspect = () => {
    if (!newProspect.companyName.trim()) return;
    mutation.mutate({
      method: "POST",
      url: "/api/admin/sales-pipeline/prospects",
      body: { ...newProspect, stageId: stageGroups[0]?.id },
    });
    setNewProspect(emptyProspect);
    setShowNew(false);
  };

  const addActivity = () => {
    if (!selectedId || !activity.body.trim()) return;
    mutation.mutate({ method: "POST", url: `/api/admin/sales-pipeline/prospects/${selectedId}/activities`, body: activity });
    setActivity({ type: "note", subject: "", body: "" });
  };

  const addDocument = () => {
    if (!selectedId || !document.name.trim()) return;
    mutation.mutate({ method: "POST", url: `/api/admin/sales-pipeline/prospects/${selectedId}/documents`, body: document });
    setDocument({ name: "", url: "", documentType: "agreement" });
  };

  const sendEmail = (templateId: string) => {
    if (!selectedId || !selected?.contactEmail) {
      toast({ title: "Contact email required", description: "Add a valid contact email before sending.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Send this follow-up to ${selected.contactEmail}?`)) return;
    mutation.mutate({ method: "POST", url: `/api/admin/sales-pipeline/prospects/${selectedId}/send-email`, body: { templateId } });
  };

  if (!isPlatformAdmin) {
    return <div className="min-h-screen bg-[#f6f2eb]"><Navigation /><main className="mx-auto max-w-xl px-6 py-24 text-center"><Building2 className="mx-auto mb-4 h-12 w-12 text-slate-300" /><h1 className="text-2xl font-bold text-[#102d4c]">Platform administrators only</h1><p className="mt-2 text-slate-500">This workspace is restricted to LandLinq platform administrators.</p></main></div>;
  }

  return (
    <div className="min-h-screen bg-[#f6f2eb]">
      <Navigation />
      <main className="mx-auto max-w-[1700px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#5da9df]"><Users className="h-4 w-4" /> LandLinq sales</div>
            <h1 className="font-serif text-4xl font-bold tracking-tight text-[#102d4c]">Company pipeline</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#52677d]">Manage prospective companies, next steps, follow-up emails, and signing-ready documents in one internal workspace.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-[#b8cee5] bg-white" onClick={() => refresh()} disabled={pipelineQuery.isFetching}><RefreshCw className={`h-4 w-4 ${pipelineQuery.isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
            <Button className="gap-2 bg-[#0a2b4a] hover:bg-white hover:text-[#5da9df] hover:border-[#5da9df]" onClick={() => setShowNew((value) => !value)}><Plus className="h-4 w-4" /> Add prospect</Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total prospects", pipelineQuery.data?.stats.total ?? 0, "text-[#102d4c]"],
            ["Open opportunities", pipelineQuery.data?.stats.open ?? 0, "text-[#2f7d6a]"],
            ["Follow-ups due", pipelineQuery.data?.stats.followUpsDue ?? 0, "text-[#c77d35]"],
            ["Estimated value", `$${(pipelineQuery.data?.stats.estimatedValue ?? 0).toLocaleString()}`, "text-[#102d4c]"],
          ].map(([label, value, tone]) => <Card key={String(label)} className="border-[#d8e4ee] bg-white/90 shadow-sm"><CardContent className="p-5"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7890a5]">{label}</div><div className={`mt-2 text-3xl font-bold ${tone}`}>{value}</div></CardContent></Card>)}
        </div>

        {showNew && <Card className="mb-6 border-[#b8cee5] bg-white shadow-sm"><CardHeader><CardTitle className="font-serif text-2xl text-[#102d4c]">Add prospective company</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
          {[
            ["companyName", "Company name", "Acme Development"],
            ["website", "Website", "https://"],
            ["industry", "Industry", "Multifamily development"],
            ["contactName", "Primary contact", "Name"],
            ["contactEmail", "Contact email", "name@company.com"],
            ["contactPhone", "Contact phone", "(555) 555-5555"],
            ["estimatedValue", "Estimated value", "50000"],
            ["nextFollowUpAt", "Next follow-up", ""],
          ].map(([key, label, placeholder]) => <div key={key}><Label>{label}</Label><Input className="mt-1" type={key === "nextFollowUpAt" ? "date" : key === "estimatedValue" ? "number" : "text"} placeholder={placeholder} value={(newProspect as any)[key]} onChange={(event) => setNewProspect((current) => ({ ...current, [key]: event.target.value }))} /></div>)}
          <div><Label>Owner / assignee</Label><select className="mt-1 h-10 w-full rounded-md border border-[#c5d5e2] bg-white px-3 text-sm" value={newProspect.ownerId} onChange={(event) => setNewProspect((current) => ({ ...current, ownerId: event.target.value }))}><option value="">Unassigned</option>{(pipelineQuery.data?.owners || []).map((owner) => <option key={owner.id} value={owner.id}>{[owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email}</option>)}</select></div>
          <div className="md:col-span-3"><Label>Notes</Label><Textarea className="mt-1" value={newProspect.notes} onChange={(event) => setNewProspect((current) => ({ ...current, notes: event.target.value }))} placeholder="Context, source, or qualification notes" /></div>
          <div className="flex gap-2 md:col-span-3"><Button onClick={createProspect} disabled={!newProspect.companyName.trim() || mutation.isPending}>Create prospect</Button><Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button></div>
        </CardContent></Card>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(380px,0.8fr)]">
          <div className="min-w-0 overflow-x-auto pb-2">
            <div className="flex min-w-[1050px] gap-4">
              {stageGroups.map((stage) => {
                const prospects = (pipelineQuery.data?.prospects || []).filter((prospect) => prospect.stageId === stage.id);
                return <section key={stage.id} className="w-[230px] shrink-0 rounded-xl border border-[#d8e4ee] bg-[#edf3f7]/75 p-3">
                  <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-[#102d4c]">{stage.name}</h2><span className="text-xs text-[#7890a5]">{prospects.length} prospect{prospects.length === 1 ? "" : "s"}</span></div><Badge variant="outline" className="border-[#b8cee5] bg-white text-[#5a7187]">{stage.sortOrder}</Badge></div>
                  <div className="space-y-3">
                    {prospects.map((prospect) => <button key={prospect.id} className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#5da9df] ${selectedId === prospect.id ? "border-[#5da9df] ring-2 ring-[#5da9df]/20" : "border-[#d8e4ee]"}`} onClick={() => setSelectedId(prospect.id)}>
                      <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcecf6] text-xs font-bold text-[#17628b]">{initials(prospect)}</div><div className="min-w-0"><div className="truncate font-semibold text-[#102d4c]">{prospect.companyName}</div><div className="mt-0.5 truncate text-xs text-[#7890a5]">{prospect.contactName || prospect.industry || "No contact yet"}</div></div></div>
                      <div className="mt-3 flex items-center justify-between text-xs"><span className="font-medium text-[#52677d]">{prospect.estimatedValue ? `$${Number(prospect.estimatedValue).toLocaleString()}` : "Value TBD"}</span><span className={prospect.nextFollowUpAt && new Date(prospect.nextFollowUpAt) <= new Date() ? "font-semibold text-[#c77d35]" : "text-[#7890a5]"}>{prospect.nextFollowUpAt ? dateLabel(prospect.nextFollowUpAt) : "No follow-up"}</span></div>
                    </button>)}
                    {!prospects.length && <div className="rounded-lg border border-dashed border-[#c5d5e2] p-5 text-center text-xs text-[#7890a5]">No prospects here</div>}
                  </div>
                </section>;
              })}
            </div>
          </div>

          <Card className="min-h-[620px] border-[#d8e4ee] bg-white shadow-sm">
            {!selected ? <CardContent className="flex min-h-[620px] flex-col items-center justify-center p-8 text-center"><Building2 className="mb-4 h-12 w-12 text-[#b8cee5]" /><h2 className="font-serif text-2xl font-bold text-[#102d4c]">Select a prospect</h2><p className="mt-2 max-w-xs text-sm text-[#7890a5]">Choose a company from the pipeline to see its activity, documents, and follow-up actions.</p></CardContent> :
              <><CardHeader className="border-b border-[#e5edf3]"><div className="flex items-start justify-between gap-3"><div><CardTitle className="font-serif text-2xl text-[#102d4c]">{selected.companyName}</CardTitle><p className="mt-1 text-sm text-[#7890a5]">{selected.contactName || "No primary contact"}{selected.contactEmail ? ` · ${selected.contactEmail}` : ""}</p></div><Badge className="bg-[#dcecf6] text-[#17628b] hover:bg-[#dcecf6]">{selected.stageName}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-[#7890a5]">Next follow-up</span><div className="font-semibold text-[#102d4c]">{dateLabel(selected.nextFollowUpAt)}</div></div><div><span className="text-[#7890a5]">Last contacted</span><div className="font-semibold text-[#102d4c]">{dateLabel(selected.lastContactedAt)}</div></div></div></CardHeader>
                <CardContent className="space-y-6 p-5">
                  <div className="flex flex-wrap gap-2">
                    {stageGroups.filter((stage) => stage.id !== selected.stageId).map((stage) => <Button key={stage.id} size="sm" variant="outline" className="border-[#b8cee5] text-xs" onClick={() => mutation.mutate({ method: "PATCH", url: `/api/admin/sales-pipeline/prospects/${selected.id}`, body: { stageId: stage.id } })}>Move to {stage.name}<ChevronRight className="ml-1 h-3 w-3" /></Button>)}
                  </div>
                  {selected.notes && <div className="rounded-lg bg-[#f7faff] p-3 text-sm leading-6 text-[#52677d]">{selected.notes}</div>}

                  <div><div className="mb-2 flex items-center gap-2 font-semibold text-[#102d4c]"><MessageSquare className="h-4 w-4 text-[#5da9df]" /> Add activity</div><div className="grid gap-2"><div className="flex gap-2"><select className="h-10 rounded-md border border-[#c5d5e2] bg-white px-3 text-sm" value={activity.type} onChange={(event) => setActivity((current) => ({ ...current, type: event.target.value }))}><option value="note">Note</option><option value="call">Call</option><option value="meeting">Meeting</option></select><Input placeholder="Subject (optional)" value={activity.subject} onChange={(event) => setActivity((current) => ({ ...current, subject: event.target.value }))} /></div><Textarea placeholder="What happened?" value={activity.body} onChange={(event) => setActivity((current) => ({ ...current, body: event.target.value }))} /><Button size="sm" className="w-fit" onClick={addActivity} disabled={!activity.body.trim()}>Log activity</Button></div></div>

                  <div><div className="mb-2 flex items-center gap-2 font-semibold text-[#102d4c]"><Mail className="h-4 w-4 text-[#5da9df]" /> Follow-up email</div><div className="space-y-2">{(pipelineQuery.data?.templates || []).map((template) => <div key={template.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e5edf3] p-3"><div className="min-w-0"><div className="truncate text-sm font-semibold text-[#102d4c]">{template.name}</div><div className="truncate text-xs text-[#7890a5]">{template.subject}</div></div><Button size="sm" variant="outline" className="shrink-0 gap-1 border-[#b8cee5]" onClick={() => sendEmail(template.id)}><Send className="h-3 w-3" /> Send</Button></div>)}{!(pipelineQuery.data?.templates || []).length && <p className="text-sm text-[#7890a5]">Create a template below to enable follow-ups.</p>}</div></div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 font-semibold text-[#102d4c]"><FileText className="h-4 w-4 text-[#5da9df]" /> Documents & signing status</div>
                    <div className="space-y-2">
                      {(detail?.documents || []).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e5edf3] p-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#102d4c]">{item.name}</div>
                            {item.url && <a className="text-xs text-[#3b86b2] underline" href={item.url} target="_blank" rel="noreferrer">Open document</a>}
                          </div>
                          <select className="h-9 rounded-md border border-[#c5d5e2] bg-white px-2 text-xs" value={item.status} onChange={(event) => mutation.mutate({ method: "PATCH", url: `/api/admin/sales-pipeline/documents/${item.id}`, body: { status: event.target.value } })}>
                            <option value="draft">Draft</option><option value="sent">Sent</option><option value="viewed">Viewed</option><option value="signed">Signed</option><option value="declined">Declined</option>
                          </select>
                        </div>
                      ))}
                      <div className="grid gap-2 rounded-lg bg-[#f7faff] p-3">
                        <Input placeholder="Document name" value={document.name} onChange={(event) => setDocument((current) => ({ ...current, name: event.target.value }))} />
                        <Input placeholder="Document URL (optional)" value={document.url} onChange={(event) => setDocument((current) => ({ ...current, url: event.target.value }))} />
                        <Button size="sm" variant="outline" className="w-fit" onClick={addDocument} disabled={!document.name.trim()}>Track document</Button>
                      </div>
                    </div>
                  </div>

                  <div><div className="mb-2 flex items-center gap-2 font-semibold text-[#102d4c]"><CalendarClock className="h-4 w-4 text-[#5da9df]" /> Activity timeline</div><div className="space-y-3">{(detail?.activities || []).slice(0, 8).map((item) => <div key={item.id} className="flex gap-3 border-l-2 border-[#d8e4ee] pl-3"><div className="text-xs font-semibold uppercase tracking-wide text-[#5da9df]">{item.type.replace("_", " ")}</div><div className="min-w-0"><div className="text-sm text-[#102d4c]">{item.subject || item.body}</div><div className="text-xs text-[#7890a5]">{dateLabel(item.createdAt)}</div></div></div>)}{!(detail?.activities || []).length && <p className="text-sm text-[#7890a5]">No activity recorded yet.</p>}</div></div>
                </CardContent></>}
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="border-[#d8e4ee] bg-white shadow-sm"><CardHeader><CardTitle className="font-serif text-xl text-[#102d4c]">Pipeline stages</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{(pipelineQuery.data?.stages || []).map((stage) => <Badge key={stage.id} variant="outline" className="gap-2 border-[#c5d5e2] py-1.5 text-[#52677d]">{stage.name}{stage.isActive ? <Check className="h-3 w-3 text-[#2f7d6a]" /> : null}</Badge>)}</div><div className="mt-4 flex gap-2"><Input placeholder="Add a stage" value={newStage} onChange={(event) => setNewStage(event.target.value)} /><Button variant="outline" className="gap-1 border-[#b8cee5]" disabled={!newStage.trim()} onClick={() => { mutation.mutate({ method: "POST", url: "/api/admin/sales-pipeline/stages", body: { name: newStage } }); setNewStage(""); }}><Plus className="h-4 w-4" /> Add</Button></div></CardContent></Card>
          <Card className="border-[#d8e4ee] bg-white shadow-sm"><CardHeader><CardTitle className="font-serif text-xl text-[#102d4c]">Email templates</CardTitle></CardHeader><CardContent><div className="space-y-2">{(pipelineQuery.data?.templates || []).map((template) => <div key={template.id} className="rounded-lg border border-[#e5edf3] p-3"><div className="font-semibold text-[#102d4c]">{template.name}</div><div className="text-xs text-[#7890a5]">{template.subject}</div></div>)}<div className="grid gap-2 rounded-lg bg-[#f7faff] p-3"><Input placeholder="Template name" value={newTemplate.name} onChange={(event) => setNewTemplate((current) => ({ ...current, name: event.target.value }))} /><Input placeholder="Subject — use {{companyName}}" value={newTemplate.subject} onChange={(event) => setNewTemplate((current) => ({ ...current, subject: event.target.value }))} /><Textarea placeholder="Email body — use {{companyName}}, {{contactName}}, {{website}}" value={newTemplate.body} onChange={(event) => setNewTemplate((current) => ({ ...current, body: event.target.value }))} /><Button size="sm" className="w-fit" disabled={!newTemplate.name || !newTemplate.subject || !newTemplate.body} onClick={() => { mutation.mutate({ method: "POST", url: "/api/admin/sales-pipeline/templates", body: newTemplate }); setNewTemplate({ name: "", subject: "", body: "" }); }}>Create template</Button></div></div></CardContent></Card>
        </div>
      </main>
    </div>
  );
}
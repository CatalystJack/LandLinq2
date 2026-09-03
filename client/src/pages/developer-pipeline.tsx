import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DeveloperNavigation from "@/components/developer-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, BriefcaseBusiness, Edit3, Loader2, Plus, Settings2, Trash2 } from "lucide-react";

type Stage = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  brokerage?: string | null;
};

type Opportunity = {
  id: string;
  contactId: string;
  stageId: string;
  stageName: string;
  stageIsActive: boolean;
  title?: string | null;
  value?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string | null;
};

async function apiRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.message || "Something went wrong");
  return body;
}

const contactName = (contact: any) =>
  [contact.contactFirstName ?? contact.firstName, contact.contactLastName ?? contact.lastName]
    .filter(Boolean).join(" ") || "Unnamed contact";

const money = (value?: string | null) =>
  value === null || value === undefined || value === "" ? "—" : `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function DeveloperPipeline() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [stageFilter, setStageFilter] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [newOpen, setNewOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [form, setForm] = useState({ contactId: "", stageId: "", title: "", value: "", notes: "" });

  const stagesQuery = useQuery<{ stages: Stage[] }>({
    queryKey: ["/api/developer-profile/me/pipeline/stages"],
    queryFn: () => apiRequest("/api/developer-profile/me/pipeline/stages"),
  });
  const opportunitiesQuery = useQuery<{ opportunities: Opportunity[] }>({
    queryKey: ["/api/developer-profile/me/pipeline/opportunities", stageFilter, sort],
    queryFn: () => apiRequest(`/api/developer-profile/me/pipeline/opportunities?sort=${encodeURIComponent(sort)}${stageFilter !== "all" ? `&stageId=${encodeURIComponent(stageFilter)}` : ""}`),
  });
  const contactsQuery = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/developer-profile/me/contacts"],
    queryFn: () => apiRequest("/api/developer-profile/me/contacts"),
  });

  const stages = stagesQuery.data?.stages || [];
  const activeStages = stages.filter((stage) => stage.isActive);
  const opportunities = opportunitiesQuery.data?.opportunities || [];
  const contacts = contactsQuery.data?.contacts || [];
  const filteredContacts = useMemo(() => {
    const search = contactSearch.trim().toLowerCase();
    if (!search) return contacts;
    return contacts.filter((contact) =>
      `${contact.firstName} ${contact.lastName} ${contact.email || ""} ${contact.brokerage || ""}`.toLowerCase().includes(search),
    );
  }, [contacts, contactSearch]);

  const invalidatePipeline = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/pipeline/stages"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/pipeline/opportunities"] });
  };

  const opportunityMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiRequest("/api/developer-profile/me/pipeline/opportunities", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
    onSuccess: () => {
      setNewOpen(false);
      setForm({ contactId: "", stageId: activeStages[0]?.id || "", title: "", value: "", notes: "" });
      invalidatePipeline();
      toast({ title: "Opportunity created", description: "The opportunity was added to your pipeline." });
    },
    onError: (error: Error) => toast({ title: "Could not create opportunity", description: error.message, variant: "destructive" }),
  });

  const updateOpportunityMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => apiRequest(`/api/developer-profile/me/pipeline/opportunities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
    onSuccess: invalidatePipeline,
    onError: (error: Error) => toast({ title: "Could not update opportunity", description: error.message, variant: "destructive" }),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => apiRequest(`/api/developer-profile/me/pipeline/stages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
    onSuccess: invalidatePipeline,
    onError: (error: Error) => toast({ title: "Could not update stage", description: error.message, variant: "destructive" }),
  });

  const addStageMutation = useMutation({
    mutationFn: () => apiRequest("/api/developer-profile/me/pipeline/stages", {
      method: "POST",
      body: JSON.stringify({ name: newStageName.trim(), sortOrder: stages.length ? Math.max(...stages.map((stage) => stage.sortOrder)) + 1 : 1 }),
    }),
    onSuccess: () => {
      setNewStageName("");
      invalidatePipeline();
      toast({ title: "Stage added" });
    },
    onError: (error: Error) => toast({ title: "Could not add stage", description: error.message, variant: "destructive" }),
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/developer-profile/me/pipeline/stages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidatePipeline();
      toast({ title: "Stage deleted" });
    },
    onError: (error: Error) => toast({ title: "Stage could not be deleted", description: error.message, variant: "destructive" }),
  });

  const openNewOpportunity = () => {
    setForm({ contactId: "", stageId: activeStages[0]?.id || "", title: "", value: "", notes: "" });
    setContactSearch("");
    setNewOpen(true);
  };

  const submitOpportunity = () => {
    if (!form.contactId || !form.stageId) {
      toast({ title: "Contact and stage are required", variant: "destructive" });
      return;
    }
    opportunityMutation.mutate(form);
  };

  const moveStage = (stage: Stage, direction: -1 | 1) => {
    const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((item) => item.id === stage.id);
    const swap = sorted[index + direction];
    if (!swap) return;
    stageMutation.mutate({ id: stage.id, payload: { sortOrder: swap.sortOrder } });
    stageMutation.mutate({ id: swap.id, payload: { sortOrder: stage.sortOrder } });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4A90E2]">Sales workspace</p>
            <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold text-[#0A2B4A]"><BriefcaseBusiness className="h-8 w-8 text-[#4A90E2]" />Pipeline</h1>
            <p className="mt-2 text-slate-600">Track opportunities from first contact through close, independent of deal classification.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setManageOpen(true)}><Settings2 className="mr-2 h-4 w-4" />Manage Stages</Button>
            <Button onClick={openNewOpportunity} disabled={!activeStages.length} style={{ backgroundColor: "#0A2B4A" }}><Plus className="mr-2 h-4 w-4" />New Opportunity</Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{opportunities.length} {opportunities.length === 1 ? "opportunity" : "opportunities"}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="All stages" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All stages</SelectItem>{activeStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="createdAt">Newest first</SelectItem><SelectItem value="value">Highest value</SelectItem><SelectItem value="contactName">Contact name</SelectItem></SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {opportunitiesQuery.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#4A90E2]" /></div> : opportunities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-6 py-16 text-center"><BriefcaseBusiness className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 font-semibold text-slate-800">No opportunities yet</h2><p className="mt-1 text-sm text-slate-500">Create your first opportunity to start tracking sales activity.</p></div>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3 text-right">Value</th><th className="px-3 py-3">Last updated</th></tr></thead><tbody>
                {opportunities.map((opportunity) => <tr key={opportunity.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-4"><p className="font-medium text-slate-800">{contactName(opportunity)}</p><p className="text-xs text-slate-500">{opportunity.contactEmail || "No email"}</p></td>
                  <td className="px-3 py-4 text-slate-700">{opportunity.title || "Untitled opportunity"}</td>
                  <td className="px-3 py-4"><Select value={opportunity.stageId} onValueChange={(stageId) => updateOpportunityMutation.mutate({ id: opportunity.id, payload: { stageId } })}><SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger><SelectContent>{activeStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>)}{!opportunity.stageIsActive && <SelectItem value={opportunity.stageId}>{opportunity.stageName} (inactive)</SelectItem>}</SelectContent></Select></td>
                  <td className="px-3 py-4 text-right font-medium text-slate-800">{money(opportunity.value)}</td>
                  <td className="px-3 py-4 text-slate-500">{opportunity.updatedAt ? new Date(opportunity.updatedAt).toLocaleDateString() : "—"}</td>
                </tr>)}
              </tbody></table></div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Opportunity</DialogTitle><DialogDescription>Add a CRM contact to your sales pipeline.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-3">
            <div><Label>Contact</Label><Input className="mt-2" placeholder="Search contacts…" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} /><Select value={form.contactId} onValueChange={(value) => setForm({ ...form, contactId: value })}><SelectTrigger className="mt-2"><SelectValue placeholder={contacts.length ? "Choose a contact" : "No CRM contacts available"} /></SelectTrigger><SelectContent>{filteredContacts.slice(0, 100).map((contact) => <SelectItem key={contact.id} value={contact.id}>{contactName(contact)}{contact.email ? ` — ${contact.email}` : ""}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Title</Label><Input className="mt-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Enterprise renewal" /></div><div><Label>Initial stage</Label><Select value={form.stageId} onValueChange={(value) => setForm({ ...form, stageId: value })}><SelectTrigger className="mt-2"><SelectValue placeholder="Choose a stage" /></SelectTrigger><SelectContent>{activeStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>)}</SelectContent></Select></div></div>
            <div><Label>Value</Label><Input className="mt-2" type="number" min="0" step="0.01" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} placeholder="Optional" /></div>
            <div><Label>Notes</Label><Textarea className="mt-2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Add context for your team…" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button onClick={submitOpportunity} disabled={opportunityMutation.isPending || !activeStages.length}>{opportunityMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create opportunity</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Manage Pipeline Stages</DialogTitle><DialogDescription>Rename, reorder, deactivate, or delete stages. Existing opportunities keep their stage when a stage is renamed or reordered.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-3">
            {[...stages].sort((a, b) => a.sortOrder - b.sortOrder).map((stage, index) => <div key={stage.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3"><div className="flex flex-col"><Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => moveStage(stage, -1)}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === stages.length - 1} onClick={() => moveStage(stage, 1)}><ArrowDown className="h-4 w-4" /></Button></div><Input defaultValue={stage.name} onBlur={(event) => event.target.value.trim() && event.target.value.trim() !== stage.name && stageMutation.mutate({ id: stage.id, payload: { name: event.target.value.trim() } })} className="flex-1" /><Badge variant={stage.isActive ? "default" : "secondary"}>{stage.isActive ? "Active" : "Inactive"}</Badge><Button variant="outline" size="sm" onClick={() => stageMutation.mutate({ id: stage.id, payload: { isActive: !stage.isActive } })}><Edit3 className="mr-1 h-3.5 w-3.5" />{stage.isActive ? "Deactivate" : "Activate"}</Button><Button variant="ghost" size="icon" onClick={() => deleteStageMutation.mutate(stage.id)} aria-label={`Delete ${stage.name}`}><Trash2 className="h-4 w-4 text-slate-400" /></Button></div>)}
            <div className="flex gap-2 border-t border-slate-100 pt-4"><Input value={newStageName} onChange={(event) => setNewStageName(event.target.value)} placeholder="New stage name" /><Button onClick={() => addStageMutation.mutate()} disabled={!newStageName.trim() || addStageMutation.isPending}><Plus className="mr-1 h-4 w-4" />Add stage</Button></div>
          </div>
          <DialogFooter><Button onClick={() => setManageOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
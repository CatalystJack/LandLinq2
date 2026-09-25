import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DeveloperNavigation from "@/components/developer-navigation";
import { PageHeader } from "@/components/ui/page-header";
import Footer from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, BriefcaseBusiness, Edit3, GripVertical, Loader2, Plus, Settings2, Trash2 } from "lucide-react";

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
  const [draggingOpportunityId, setDraggingOpportunityId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [debouncedContactSearch, setDebouncedContactSearch] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [form, setForm] = useState({ contactId: "", stageId: "", title: "", value: "", notes: "" });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedContactSearch(contactSearch.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [contactSearch]);

  const stagesQuery = useQuery<{ stages: Stage[] }>({
    queryKey: ["/api/developer-profile/me/pipeline/stages"],
    queryFn: () => apiRequest("/api/developer-profile/me/pipeline/stages"),
  });
  const opportunitiesQuery = useQuery<{ opportunities: Opportunity[] }>({
    queryKey: ["/api/developer-profile/me/pipeline/opportunities", sort],
    queryFn: () => apiRequest(`/api/developer-profile/me/pipeline/opportunities?sort=${encodeURIComponent(sort)}`),
  });
  const contactsQuery = useQuery<{
    contacts: Contact[];
    pagination: { total: number; limit: number; hasNextPage: boolean };
  }>({
    queryKey: ["/api/developer-profile/me/contacts", debouncedContactSearch],
    queryFn: () => {
      const params = new URLSearchParams({ search: debouncedContactSearch, limit: "100" });
      return apiRequest(`/api/developer-profile/me/contacts?${params.toString()}`);
    },
    enabled: newOpen,
  });

  const stages = stagesQuery.data?.stages || [];
  const activeStages = stages.filter((stage) => stage.isActive);
  const allOpportunities = opportunitiesQuery.data?.opportunities || [];
  const boardStages = useMemo(() => {
    const ordered = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
    const stagesWithInactiveOpportunities = new Set(
      allOpportunities.filter((opportunity) => !opportunity.stageIsActive).map((opportunity) => opportunity.stageId),
    );
    return ordered.filter((stage) => stage.isActive || stagesWithInactiveOpportunities.has(stage.id))
      .filter((stage) => stageFilter === "all" || stage.id === stageFilter);
  }, [stages, allOpportunities, stageFilter]);
  const opportunities = useMemo(
    () => stageFilter === "all"
      ? allOpportunities
      : allOpportunities.filter((opportunity) => opportunity.stageId === stageFilter),
    [allOpportunities, stageFilter],
  );
  const pipelineStats = useMemo(() => ({
    totalCount: allOpportunities.length,
    totalValue: allOpportunities.reduce((sum, opportunity) => {
      const value = Number(opportunity.value);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0),
    wonCount: allOpportunities.filter((opportunity) => /(?:won|final)/i.test(opportunity.stageName || "")).length,
  }), [allOpportunities]);
  const contacts = contactsQuery.data?.contacts || [];
  const filteredContacts = contacts;

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

  const deleteOpportunityMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/developer-profile/me/pipeline/opportunities/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      invalidatePipeline();
      toast({ title: "Opportunity deleted" });
    },
    onError: (error: Error) => toast({ title: "Opportunity could not be deleted", description: error.message, variant: "destructive" }),
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

  const reorderStageMutation = useMutation({
    mutationFn: (stageIds: string[]) => apiRequest("/api/developer-profile/me/pipeline/stages/reorder", {
      method: "POST",
      body: JSON.stringify({ stageIds }),
    }),
    scope: { id: "developer-pipeline-stage-reorder" },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/developer-profile/me/pipeline/stages"], data);
      invalidatePipeline();
    },
    onError: (error: Error) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/pipeline/stages"] });
      toast({ title: "Could not reorder stages", description: error.message, variant: "destructive" });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/developer-profile/me/pipeline/stages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidatePipeline();
      toast({ title: "Stage deleted" });
    },
    onError: (error: Error) => toast({ title: "Stage could not be deleted", description: error.message, variant: "destructive" }),
  });

  const openNewOpportunity = (stageId?: string) => {
    setForm({ contactId: "", stageId: stageId || activeStages[0]?.id || "", title: "", value: "", notes: "" });
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
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;
    [sorted[index], sorted[targetIndex]] = [sorted[targetIndex], sorted[index]];
    const reordered = sorted.map((item, sortIndex) => ({ ...item, sortOrder: sortIndex + 1 }));
    queryClient.setQueryData(["/api/developer-profile/me/pipeline/stages"], { stages: reordered });
    reorderStageMutation.mutate(reordered.map((item) => item.id));
  };

  const handleStageDrop = (event: React.DragEvent<HTMLElement>, stage: Stage) => {
    event.preventDefault();
    setDraggingOpportunityId(null);
    if (!stage.isActive) return;
    const opportunityId = event.dataTransfer.getData("text/plain");
    const opportunity = allOpportunities.find((item) => item.id === opportunityId);
    if (!opportunity || opportunity.stageId === stage.id) return;
    updateOpportunityMutation.mutate({ id: opportunity.id, payload: { stageId: stage.id } });
  };

  return (
    <div className="min-h-screen bg-warm">
      <DeveloperNavigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Pipeline"
          description="Track opportunities from first contact through close, independent of deal classification."
          eyebrow="Sales workspace"
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />{activeStages.length ? "Manage Stages" : "Configure Stages"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => openNewOpportunity()} disabled={!activeStages.length}>
                <Plus className="mr-2 h-4 w-4" />New Opportunity
              </Button>
            </>
          }
        />

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-2xl font-bold tracking-tight text-[#0A2B4A]">{pipelineStats.totalCount}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Total opportunities</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-2xl font-bold tracking-tight text-[#0A2B4A]">{money(pipelineStats.totalValue.toString())}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Total value</p>
              </div>
              <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-1">
                <p className="text-2xl font-bold tracking-tight text-[#0A2B4A]">{pipelineStats.wonCount}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Final / won</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
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
            {opportunitiesQuery.isLoading || stagesQuery.isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#4A90E2]" /></div>
            ) : boardStages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-6 py-16 text-center">
                <Settings2 className="mx-auto h-10 w-10 text-slate-300" />
                <h2 className="mt-3 font-semibold text-slate-800">Set up your pipeline stages</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Add the stages your team uses to track opportunities. They will become the columns on this board.</p>
                <Button
                  className="mt-4 border border-[#4A90E2] bg-[#4A90E2] text-white hover:border-[#4A90E2] hover:bg-white hover:text-[#4A90E2]"
                  onClick={() => setManageOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />Configure stages
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto pb-3">
                <div className="flex min-h-72 items-start gap-4">
                  {boardStages.map((stage) => {
                    const stageOpportunities = opportunities.filter((opportunity) => opportunity.stageId === stage.id);
                    return (
                      <section
                        key={stage.id}
                        aria-label={`${stage.name} stage`}
                        className={`w-[290px] shrink-0 rounded-xl border p-3 transition-colors ${
                          stage.isActive ? "border-slate-200 bg-slate-50/80" : "border-amber-200 bg-amber-50/50"
                        }`}
                        onDragOver={stage.isActive ? (event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        } : undefined}
                        onDrop={stage.isActive ? (event) => handleStageDrop(event, stage) : undefined}
                      >
                        <header className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-slate-900">{stage.name}</h2>
                            <p className="mt-1 text-xs text-slate-500">
                              {stageOpportunities.length} {stageOpportunities.length === 1 ? "opportunity" : "opportunities"}
                            </p>
                          </div>
                          {!stage.isActive && <Badge variant="secondary" className="shrink-0">Inactive</Badge>}
                        </header>

                        <div className="space-y-3">
                          {stageOpportunities.map((opportunity) => (
                            <article
                              key={opportunity.id}
                              className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-opacity ${
                                draggingOpportunityId === opportunity.id ? "opacity-40" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="break-words text-sm font-semibold text-slate-900">
                                    {opportunity.title || "Untitled opportunity"}
                                  </h3>
                                  <p className="mt-1 text-sm text-slate-700">{contactName(opportunity)}</p>
                                  <p className="break-all text-xs text-slate-500">{opportunity.contactEmail || "No email"}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  draggable
                                  className="h-8 w-8 shrink-0 cursor-grab text-slate-400 active:cursor-grabbing"
                                  aria-label={`Drag ${opportunity.title || "opportunity"} to another stage`}
                                  title="Drag to another stage"
                                  onDragStart={(event) => {
                                    event.dataTransfer.setData("text/plain", opportunity.id);
                                    event.dataTransfer.effectAllowed = "move";
                                    setDraggingOpportunityId(opportunity.id);
                                  }}
                                  onDragEnd={() => setDraggingOpportunityId(null)}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                                <span className="text-sm font-semibold text-[#0A2B4A]">{money(opportunity.value)}</span>
                                <span className="text-xs text-slate-500">
                                  {opportunity.updatedAt ? new Date(opportunity.updatedAt).toLocaleDateString() : "—"}
                                </span>
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <Select
                                  value={opportunity.stageId}
                                  onValueChange={(stageId) => updateOpportunityMutation.mutate({ id: opportunity.id, payload: { stageId } })}
                                >
                                  <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label={`Move ${opportunity.title || "opportunity"} to stage`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {activeStages.map((activeStage) => (
                                      <SelectItem key={activeStage.id} value={activeStage.id}>{activeStage.name}</SelectItem>
                                    ))}
                                    {!opportunity.stageIsActive && (
                                      <SelectItem value={opportunity.stageId}>{opportunity.stageName} (inactive)</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  disabled={deleteOpportunityMutation.isPending}
                                  onClick={() => window.confirm(`Delete ${opportunity.title || "this opportunity"}? This cannot be undone.`) && deleteOpportunityMutation.mutate(opportunity.id)}
                                  aria-label={`Delete ${opportunity.title || "opportunity"}`}
                                >
                                  <Trash2 className="h-4 w-4 text-slate-400" />
                                </Button>
                              </div>
                            </article>
                          ))}
                          {stageOpportunities.length === 0 && (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-7 text-center text-xs text-slate-500">
                              Drop an opportunity here or add one to this stage.
                            </div>
                          )}
                        </div>

                        {stage.isActive && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-3 w-full justify-start text-slate-600"
                            onClick={() => openNewOpportunity(stage.id)}
                          >
                            <Plus className="mr-1.5 h-4 w-4" />Add opportunity
                          </Button>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Opportunity</DialogTitle><DialogDescription>Add a CRM contact to your sales pipeline.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-3">
            <div>
              <Label>Contact</Label>
              <Input className="mt-2" placeholder="Search contacts…" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} />
              <Select value={form.contactId} onValueChange={(value) => setForm({ ...form, contactId: value })}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={contactsQuery.isLoading ? "Searching contacts…" : contacts.length ? "Choose a contact" : "No matching contacts"} />
                </SelectTrigger>
                <SelectContent>{filteredContacts.map((contact) => <SelectItem key={contact.id} value={contact.id}>{contactName(contact)}{contact.email ? ` — ${contact.email}` : ""}</SelectItem>)}</SelectContent>
              </Select>
              {contactsQuery.isError && <p role="alert" className="mt-2 text-xs text-red-600">{(contactsQuery.error as Error).message}</p>}
              {contactsQuery.data && contactsQuery.data.pagination.total > contacts.length && <p className="mt-2 text-xs text-slate-500">Showing the first {contacts.length} of {contactsQuery.data.pagination.total} matching contacts. Refine your search to narrow results.</p>}
            </div>
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
            {[...stages].sort((a, b) => a.sortOrder - b.sortOrder).map((stage, index) => <div key={stage.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3"><div className="flex flex-col"><Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => moveStage(stage, -1)}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === stages.length - 1} onClick={() => moveStage(stage, 1)}><ArrowDown className="h-4 w-4" /></Button></div><Input defaultValue={stage.name} onBlur={(event) => event.target.value.trim() && event.target.value.trim() !== stage.name && stageMutation.mutate({ id: stage.id, payload: { name: event.target.value.trim() } })} className="flex-1" /><Badge variant={stage.isActive ? "default" : "secondary"}>{stage.isActive ? "Active" : "Inactive"}</Badge><Button variant="outline" size="sm" onClick={() => stageMutation.mutate({ id: stage.id, payload: { isActive: !stage.isActive } })}><Edit3 className="mr-1 h-3.5 w-3.5" />{stage.isActive ? "Deactivate" : "Activate"}</Button><Button variant="ghost" size="icon" onClick={() => window.confirm(`Delete the ${stage.name} stage? This cannot be undone.`) && deleteStageMutation.mutate(stage.id)} aria-label={`Delete ${stage.name}`}><Trash2 className="h-4 w-4 text-slate-400" /></Button></div>)}
            <div className="flex gap-2 border-t border-slate-100 pt-4"><Input value={newStageName} onChange={(event) => setNewStageName(event.target.value)} placeholder="New stage name" /><Button onClick={() => addStageMutation.mutate()} disabled={!newStageName.trim() || addStageMutation.isPending}><Plus className="mr-1 h-4 w-4" />Add stage</Button></div>
          </div>
          <DialogFooter><Button onClick={() => setManageOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
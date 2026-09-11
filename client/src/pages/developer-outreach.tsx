import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Edit3, Loader2, Mail, MapPin, MessageSquare, Plus, Rocket, Send, Sparkles, Tag, Users } from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
import Footer from "@/components/footer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SenderAccount = {
  id: string;
  name: string;
  email: string;
  outlookConnected: boolean;
  hasRefreshToken?: boolean;
  microsoftTokenExpiry?: string | null;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  subject: string;
  content: string;
  dayNumber: number;
  enrollmentCount: number;
  triggerTag?: string;
  created_at?: string;
  createdAt?: string;
};

type CampaignForm = {
  name: string;
  subject: string;
  content: string;
  triggerTag: string;
  dayNumber: number;
  status: "paused" | "active";
};

type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

type SuggestedDraft = {
  subject: string;
  content: string;
};

const emptyForm: CampaignForm = {
  name: "",
  subject: "",
  content: "Hi {{firstName}},\n\n",
  triggerTag: "",
  dayNumber: 0,
  status: "paused",
};

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

export default function DeveloperOutreach() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profile = (user as any)?.developerProfile;
  const secondaryColor = profile?.secondaryColor || "#4A90E2";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiSuggestedDraft, setAiSuggestedDraft] = useState<SuggestedDraft | null>(null);

  const senderQuery = useQuery<{ sender: SenderAccount | null }>({
    queryKey: ["/api/developer-profile/me/outreach/sender"],
    queryFn: () => jsonRequest("/api/developer-profile/me/outreach/sender"),
  });
  const campaignsQuery = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["/api/developer-profile/me/outreach/campaigns"],
    queryFn: () => jsonRequest("/api/developer-profile/me/outreach/campaigns"),
  });
  const targetsQuery = useQuery<{ contacts: any[]; count: number; targetStates: string[]; targetCounties: string[] }>({
    queryKey: ["/api/developer-profile/me/outreach/targets"],
    queryFn: () => jsonRequest("/api/developer-profile/me/outreach/targets"),
  });
  const aiConversationQuery = useQuery<{ messages: AiMessage[]; suggestedDraft: SuggestedDraft | null }>({
    queryKey: ["/api/developer-profile/me/outreach/ai-conversation", editing?.id],
    queryFn: () => jsonRequest(`/api/developer-profile/me/outreach/campaigns/${editing!.id}/ai-conversations/0`),
    enabled: Boolean(dialogOpen && editing),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "outlook_connected") {
      toast({ title: "Outlook connected", description: "Campaign email will send from your connected account." });
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/outreach/sender"] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("error")) {
      toast({ title: "Outlook connection failed", description: params.get("error") || "Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [queryClient, toast]);

  useEffect(() => {
    if (!editing || !dialogOpen || !aiConversationQuery.data) return;
    setAiMessages(aiConversationQuery.data.messages || []);
    setAiSuggestedDraft(aiConversationQuery.data.suggestedDraft || null);
  }, [aiConversationQuery.data, dialogOpen, editing]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const prepared = await jsonRequest("/api/developer-profile/me/outreach/sender", { method: "POST" });
      return jsonRequest(`/api/outreach/senders/${prepared.sender.id}/connect-outlook`, { method: "POST" });
    },
    onSuccess: (data) => {
      if (!data.authUrl) throw new Error("Microsoft did not return an authorization URL");
      window.location.href = data.authUrl;
    },
    onError: (error: Error) => toast({ title: "Could not connect Outlook", description: error.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: () => jsonRequest(
      editing
        ? `/api/developer-profile/me/outreach/campaigns/${editing.id}`
        : "/api/developer-profile/me/outreach/campaigns",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      },
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/outreach/campaigns"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Campaign updated" : "Campaign created" });
    },
    onError: (error: Error) => toast({ title: "Could not save campaign", description: error.message, variant: "destructive" }),
  });

  const launchMutation = useMutation({
    mutationFn: (campaignId: string) => jsonRequest(`/api/developer-profile/me/outreach/campaigns/${campaignId}/launch`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/outreach/campaigns"] });
      toast({ title: "Campaign launched", description: `${data.enrolled} contacts enrolled; ${data.skipped} already enrolled.` });
    },
    onError: (error: Error) => toast({ title: "Could not launch campaign", description: error.message, variant: "destructive" }),
  });

  const aiDraftMutation = useMutation({
    mutationFn: () => jsonRequest(`/api/developer-profile/me/outreach/campaigns/${editing!.id}/ai-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepKey: "0",
        messages: aiMessages,
        userMessage: aiInput,
        currentDraft: { subject: form.subject, content: form.content },
      }),
    }),
    onSuccess: (data: { reply: string; messages: AiMessage[]; suggestedDraft: SuggestedDraft }) => {
      setAiMessages(data.messages || []);
      setAiSuggestedDraft(data.suggestedDraft || null);
      setAiInput("");
    },
    onError: (error: Error) => toast({ title: "Assistant unavailable", description: error.message, variant: "destructive" }),
  });

  const sender = senderQuery.data?.sender;
  const campaigns = campaignsQuery.data?.campaigns || [];
  const scopeLabel = useMemo(() => {
    const states = targetsQuery.data?.targetStates || [];
    const counties = targetsQuery.data?.targetCounties || [];
    if (!states.length && !counties.length) return "All available contacts";
    return [...states, ...counties].join(", ");
  }, [targetsQuery.data]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setAiMessages([]);
    setAiInput("");
    setAiSuggestedDraft(null);
    setDialogOpen(true);
  };
  const openEdit = (campaign: Campaign) => {
    setEditing(campaign);
    setForm({
      name: campaign.name,
      subject: campaign.subject || "",
      content: campaign.content || "",
      triggerTag: campaign.triggerTag || "",
      dayNumber: Number(campaign.dayNumber || 0),
      status: campaign.status === "active" ? "active" : "paused",
    });
    setAiMessages([]);
    setAiInput("");
    setAiSuggestedDraft(null);
    setDialogOpen(true);
  };

  const insertSuggestedDraft = (replace: boolean) => {
    if (!aiSuggestedDraft) return;
    setForm((current) => ({
      ...current,
      subject: replace || !current.subject.trim()
        ? aiSuggestedDraft.subject
        : current.subject,
      content: replace || !current.content.trim()
        ? aiSuggestedDraft.content
        : `${current.content.trim()}\n\n${aiSuggestedDraft.content}`,
    }));
    toast({
      title: replace ? "Draft replaced" : "Draft inserted",
      description: replace
        ? "The assistant suggestion replaced the email fields. Save when ready."
        : "The assistant suggestion was added below your current message. Save when ready.",
    });
  };

  const submitAiMessage = () => {
    if (!editing || !aiInput.trim() || aiDraftMutation.isPending) return;
    aiDraftMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">Campaigns</h1>
            <p className="mt-2 text-slate-500">Build drip campaigns for your approved contact audience.</p>
          </div>
          <Button variant="brand" onClick={openCreate} disabled={!sender?.outlookConnected}>
            <Plus className="mr-2 h-4 w-4" />New Campaign
          </Button>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Mail className="h-5 w-5" />Sending account</CardTitle></CardHeader>
            <CardContent>
              {senderQuery.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : sender?.outlookConnected ? (
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="font-semibold text-slate-900">{sender.email}</p></div><p className="mt-1 text-sm text-slate-500">Campaigns send through this Microsoft Outlook account.</p></div>
                  <Button variant="outline" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>Reconnect</Button>
                </div>
              ) : (
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div><p className="font-semibold text-slate-900">Connect your Outlook account</p><p className="mt-1 text-sm text-slate-500">You must connect your own mailbox before creating or launching campaigns.</p></div>
                  <Button variant="brand" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>{connectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Connect Outlook</Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" />Target audience</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-slate-950">{targetsQuery.data?.count ?? "—"}</p><p className="mt-1 text-sm text-slate-500">Eligible owned and shared contacts</p><div className="mt-3 flex items-start gap-2 text-xs text-slate-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{scopeLabel}</span></div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b border-slate-100"><CardTitle className="text-lg">Your campaigns</CardTitle></CardHeader>
          <CardContent className="p-0">
            {campaignsQuery.isLoading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : campaigns.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center"><Send className="mb-3 h-10 w-10 text-slate-300" /><p className="font-semibold text-slate-800">No campaigns yet</p><p className="mt-1 text-sm text-slate-500">{sender?.outlookConnected ? "Create your first email campaign." : "Connect Outlook to get started."}</p></div>
            ) : (
              <div className="divide-y divide-slate-100">{campaigns.map((campaign) => (
                <div key={campaign.id} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{campaign.name}</p><Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status}</Badge>{campaign.status === "active" && campaign.triggerTag && <Badge variant="outline" className="gap-1 font-normal"><Tag className="h-3 w-3" />{campaign.triggerTag}</Badge>}</div>
                    <p className="mt-1 text-sm text-slate-500">{campaign.subject}</p>
                    <p className="mt-2 text-xs text-slate-400">{campaign.enrollmentCount || 0} enrolled · starts {campaign.dayNumber ? `after ${campaign.dayNumber} day${campaign.dayNumber === 1 ? "" : "s"}` : "immediately"}</p>
                  </div>
                  <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => openEdit(campaign)}><Edit3 className="mr-1.5 h-4 w-4" />Edit</Button><Button variant="brand" size="sm" onClick={() => launchMutation.mutate(campaign.id)} disabled={launchMutation.isPending || !sender?.outlookConnected}><Rocket className="mr-1.5 h-4 w-4" />Launch</Button></div>
                </div>
              ))}</div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit campaign" : "Create campaign"}</DialogTitle><DialogDescription>Email will send only from your connected Outlook account. Launching uses your saved target geography; tagged contacts can also enroll automatically.</DialogDescription></DialogHeader>
          <div className="grid gap-6 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <div className="grid content-start gap-4">
              <div><Label htmlFor="campaign-name">Campaign name</Label><Input id="campaign-name" className="mt-1.5" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Broker introduction" /></div>
              <div><Label htmlFor="campaign-subject">Subject line</Label><Input id="campaign-subject" className="mt-1.5" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="A quick introduction" /></div>
              <div><Label htmlFor="campaign-trigger-tag">Auto-enrollment tag</Label><Input id="campaign-trigger-tag" className="mt-1.5" value={form.triggerTag} onChange={(event) => setForm({ ...form, triggerTag: event.target.value })} placeholder="Interested Broker" /><p className="mt-1 text-xs text-slate-500">Contacts owned by your company are enrolled when this exact CRM tag is added. Geography targeting remains available when you launch the campaign.</p></div>
              <div><Label htmlFor="campaign-content">Email message</Label><Textarea id="campaign-content" className="mt-1.5 min-h-52" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /><p className="mt-1 text-xs text-slate-500">Use {"{{firstName}}"} to personalize the greeting. Your edits stay in place until you choose an assistant action.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="campaign-delay">Send delay in days</Label><Input id="campaign-delay" type="number" min={0} max={365} className="mt-1.5" value={form.dayNumber} onChange={(event) => setForm({ ...form, dayNumber: Number(event.target.value) })} /></div><div><Label htmlFor="campaign-status">Status</Label><select id="campaign-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "paused" | "active" })} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="paused">Draft / paused</option><option value="active">Active</option></select></div></div>
            </div>
            <Card className="flex min-h-[520px] flex-col border-slate-200 bg-slate-50/70">
              <CardHeader className="border-b border-slate-200 pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" style={{ color: secondaryColor }} />Writing assistant</CardTitle>
                <p className="text-xs font-normal text-slate-500">Ask for a rewrite, tone change, shorter copy, or a follow-up. The assistant uses this company’s saved criteria and current draft.</p>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                {aiConversationQuery.isLoading ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Restoring conversation…</div>
                ) : !editing ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-5 text-center text-sm text-slate-500"><MessageSquare className="mb-2 h-7 w-7 text-slate-300" /><p>Save the campaign first, then refine its first step here.</p></div>
                ) : (
                  <>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {aiMessages.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">Try “Make this warmer and keep it under 100 words.”</div>
                      ) : aiMessages.map((message, index) => (
                        <div key={`${message.role}-${index}`} className={`rounded-lg px-3 py-2 text-sm ${message.role === "user" ? "ml-5 bg-slate-900 text-white" : "mr-5 border border-slate-200 bg-white text-slate-700"}`}>
                          {message.content}
                        </div>
                      ))}
                    </div>
                    {aiSuggestedDraft && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Suggested draft</p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{aiSuggestedDraft.subject}</p>
                        <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-slate-600">{aiSuggestedDraft.content}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" variant="brand" size="sm" onClick={() => insertSuggestedDraft(false)}>Insert into email</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => insertSuggestedDraft(true)}>Replace draft</Button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <Textarea
                        aria-label="Ask the writing assistant"
                        value={aiInput}
                        onChange={(event) => setAiInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault();
                            submitAiMessage();
                          }
                        }}
                        placeholder="e.g. Make it more direct…"
                        className="min-h-20 resize-none bg-white"
                        disabled={aiDraftMutation.isPending}
                      />
                      <Button type="button" variant="brand" size="icon" onClick={submitAiMessage} disabled={!aiInput.trim() || aiDraftMutation.isPending} className="shrink-0" aria-label="Send to writing assistant">
                        {aiDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-400">Ctrl/⌘ + Enter to send. Suggestions never change the email until you choose an action.</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant="brand" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim() || !form.subject.trim() || !form.content.trim()}>{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Campaign</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
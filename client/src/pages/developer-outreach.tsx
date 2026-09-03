import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Edit3, Loader2, Mail, MapPin, Plus, Rocket, Send, Tag, Users } from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
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
  const primaryColor = profile?.primaryColor || "#0A2B4A";
  const secondaryColor = profile?.secondaryColor || "#4A90E2";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);

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
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: secondaryColor }}>Email Outreach</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Campaigns</h1>
            <p className="mt-2 text-slate-500">Build drip campaigns for your approved contact audience.</p>
          </div>
          <Button onClick={openCreate} disabled={!sender?.outlookConnected} style={{ backgroundColor: primaryColor }} className="text-white">
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
                  <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending} style={{ backgroundColor: primaryColor }} className="text-white">{connectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Connect Outlook</Button>
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
                  <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => openEdit(campaign)}><Edit3 className="mr-1.5 h-4 w-4" />Edit</Button><Button size="sm" onClick={() => launchMutation.mutate(campaign.id)} disabled={launchMutation.isPending || !sender?.outlookConnected} style={{ backgroundColor: primaryColor }} className="text-white"><Rocket className="mr-1.5 h-4 w-4" />Launch</Button></div>
                </div>
              ))}</div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit campaign" : "Create campaign"}</DialogTitle><DialogDescription>Email will send only from your connected Outlook account. Launching uses your saved target geography; tagged contacts can also enroll automatically.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div><Label htmlFor="campaign-name">Campaign name</Label><Input id="campaign-name" className="mt-1.5" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Broker introduction" /></div>
            <div><Label htmlFor="campaign-subject">Subject line</Label><Input id="campaign-subject" className="mt-1.5" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="A quick introduction" /></div>
            <div><Label htmlFor="campaign-trigger-tag">Auto-enrollment tag</Label><Input id="campaign-trigger-tag" className="mt-1.5" value={form.triggerTag} onChange={(event) => setForm({ ...form, triggerTag: event.target.value })} placeholder="Interested Broker" /><p className="mt-1 text-xs text-slate-500">Contacts owned by your company are enrolled when this exact CRM tag is added. Geography targeting remains available when you launch the campaign.</p></div>
            <div><Label htmlFor="campaign-content">Email message</Label><Textarea id="campaign-content" className="mt-1.5 min-h-44" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /><p className="mt-1 text-xs text-slate-500">Use {"{{firstName}}"} to personalize the greeting.</p></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="campaign-delay">Send delay in days</Label><Input id="campaign-delay" type="number" min={0} max={365} className="mt-1.5" value={form.dayNumber} onChange={(event) => setForm({ ...form, dayNumber: Number(event.target.value) })} /></div><div><Label htmlFor="campaign-status">Status</Label><select id="campaign-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "paused" | "active" })} className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="paused">Draft / paused</option><option value="active">Active</option></select></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim() || !form.subject.trim() || !form.content.trim()} style={{ backgroundColor: primaryColor }} className="text-white">{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Campaign</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
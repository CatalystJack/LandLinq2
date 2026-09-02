import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Edit3, KeyRound, Loader2, LockKeyhole, Mail, Plus, Upload, Users } from "lucide-react";

type Overrides = Record<string, number>;

interface InvestmentCompany {
  id: string;
  companyName: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  isInternal: boolean | null;
  knownEmailDomains: string[] | null;
  rentMetric: "psf" | "per_unit";
  minRentPsf: string | null;
  minRentPerUnit: string | null;
  minAcres: string;
  maxAcres: string | null;
  acreageOverridesByProductType: Overrides | null;
  qctOverridesRentMinimum: boolean | null;
  ddaOverridesRentMinimum: boolean | null;
  ozOverridesRentMinimum: boolean | null;
  targetStates: string[];
  targetCounties: string[];
  isActive: boolean;
  teamMemberCount: number;
}

interface CompanyForm {
  companyName: string;
  slug: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  isInternal: boolean;
  knownEmailDomains: string[];
  rentMetric: "psf" | "per_unit";
  minRentPsf: string;
  minRentPerUnit: string;
  minAcres: string;
  maxAcres: string;
  acreageOverridesByProductType: Overrides;
  qctOverridesRentMinimum: boolean;
  ddaOverridesRentMinimum: boolean;
  ozOverridesRentMinimum: boolean;
  targetStates: string[];
  targetCounties: string[];
  isActive: boolean;
}

const blankForm: CompanyForm = {
  companyName: "",
  slug: "",
  logoUrl: "",
  primaryColor: "#0A2B4A",
  secondaryColor: "#4A90E2",
  isInternal: false,
  knownEmailDomains: [],
  rentMetric: "psf",
  minRentPsf: "",
  minRentPerUnit: "",
  minAcres: "",
  maxAcres: "",
  acreageOverridesByProductType: {},
  qctOverridesRentMinimum: false,
  ddaOverridesRentMinimum: false,
  ozOverridesRentMinimum: false,
  targetStates: [],
  targetCounties: [],
  isActive: true,
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.message || "Request failed");
  return body;
}

function TagsField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string }) {
  const [entry, setEntry] = useState("");
  const commit = () => {
    const additions = entry.split(",").map((value) => value.trim()).filter(Boolean);
    if (additions.length) onChange(Array.from(new Set([...values, ...additions])));
    setEntry("");
  };
  return <div className="space-y-2"><Label>{label}</Label><div className="rounded-md border bg-white p-2"><div className="mb-2 flex flex-wrap gap-1.5">{values.map((value) => <Badge key={value} variant="secondary" className="gap-1">{value}<button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Remove ${value}`}>×</button></Badge>)}</div><Input value={entry} onChange={(event) => setEntry(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); commit(); } }} onBlur={commit} placeholder={placeholder} className="border-0 px-1 shadow-none focus-visible:ring-0" /></div><p className="text-xs text-slate-500">Press Enter or comma after each entry.</p></div>;
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border p-3"><div><p className="font-medium text-slate-900">{label}</p><p className="text-xs text-slate-500">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>;
}

export default function AdminInvestmentCompanies() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const email = String((user as any)?.claims?.email || (user as any)?.email || "").toLowerCase();
  const isPlatformAdmin = isAuthenticated && email.endsWith("@apexresi.com");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentCompany | null>(null);
  const [form, setForm] = useState<CompanyForm>(blankForm);
  const [overrideName, setOverrideName] = useState("");
  const [loginCompany, setLoginCompany] = useState<InvestmentCompany | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const companiesQuery = useQuery<{ profiles: InvestmentCompany[] }>({
    queryKey: ["/api/admin/investment-companies"],
    queryFn: () => requestJson("/api/admin/investment-companies"),
    enabled: isPlatformAdmin,
  });

  useEffect(() => {
    if (!formOpen) return;
    setForm(editing ? {
      companyName: editing.companyName,
      slug: editing.slug,
      logoUrl: editing.logoUrl || "",
      primaryColor: editing.primaryColor || "#0A2B4A",
      secondaryColor: editing.secondaryColor || "#4A90E2",
      isInternal: editing.isInternal === true,
      knownEmailDomains: editing.knownEmailDomains || [],
      rentMetric: editing.rentMetric,
      minRentPsf: editing.minRentPsf || "",
      minRentPerUnit: editing.minRentPerUnit || "",
      minAcres: editing.minAcres || "",
      maxAcres: editing.maxAcres || "",
      acreageOverridesByProductType: editing.acreageOverridesByProductType || {},
      qctOverridesRentMinimum: editing.qctOverridesRentMinimum === true,
      ddaOverridesRentMinimum: editing.ddaOverridesRentMinimum === true,
      ozOverridesRentMinimum: editing.ozOverridesRentMinimum === true,
      targetStates: editing.targetStates || [],
      targetCounties: editing.targetCounties || [],
      isActive: editing.isActive,
    } : { ...blankForm, knownEmailDomains: [], targetStates: [], targetCounties: [], acreageOverridesByProductType: {} });
  }, [editing, formOpen]);

  const saveMutation = useMutation({
    mutationFn: () => requestJson(editing ? `/api/admin/investment-companies/${editing.id}` : "/api/admin/investment-companies", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, logoUrl: form.logoUrl || null, minRentPsf: form.minRentPsf || null, minRentPerUnit: form.minRentPerUnit || null, maxAcres: form.maxAcres || null }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/investment-companies"] });
      setFormOpen(false);
      toast({ title: editing ? "Investment Company updated" : "Investment Company created" });
    },
    onError: (error: Error) => toast({ title: "Could not save profile", description: error.message, variant: "destructive" }),
  });

  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("logo", file);
      return requestJson("/api/admin/investment-companies/logo", { method: "POST", body });
    },
    onSuccess: ({ logoUrl }) => setForm((current) => ({ ...current, logoUrl })),
    onError: (error: Error) => toast({ title: "Logo upload failed", description: error.message, variant: "destructive" }),
  });

  const loginMutation = useMutation({
    mutationFn: () => requestJson(`/api/admin/investment-companies/${loginCompany?.id}/initial-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: contactName, email: contactEmail }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/investment-companies"] });
      setLoginCompany(null); setContactName(""); setContactEmail("");
      toast({ title: "Initial login sent", description: "The temporary credentials and company login link were emailed successfully." });
    },
    onError: (error: Error) => toast({ title: "Could not create login", description: error.message, variant: "destructive" }),
  });

  const sortedProfiles = useMemo(() => [...(companiesQuery.data?.profiles || [])].sort((a, b) => a.companyName.localeCompare(b.companyName)), [companiesQuery.data]);
  const update = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (profile: InvestmentCompany) => { setEditing(profile); setFormOpen(true); };

  if (!isPlatformAdmin) return <div className="min-h-screen bg-slate-50"><Navigation /><div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center"><LockKeyhole className="mb-4 h-12 w-12 text-slate-300" /><h1 className="text-2xl font-bold text-slate-900">Apex Resi administrators only</h1><p className="mt-2 text-slate-500">This page is restricted to authenticated @apexresi.com accounts.</p></div></div>;

  return <div className="min-h-screen bg-slate-50">
    <Navigation />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold uppercase tracking-wider text-[#4A90E2]">Platform administration</p><h1 className="mt-1 text-3xl font-bold text-[#0A2B4A]">Development Partners</h1><p className="mt-2 text-slate-600">Create Investment Company portals, configure acquisition criteria, and invite partner contacts by email.</p></div><Button onClick={openCreate} style={{ backgroundColor: "#0A2B4A" }}><Plus className="mr-2 h-4 w-4" />Create New Development Partner</Button></div>
      {companiesQuery.isLoading ? <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#4A90E2]" /></div> : companiesQuery.isError ? <Card><CardContent className="py-12 text-center text-red-600">Unable to load Investment Company profiles.</CardContent></Card> : !sortedProfiles.length ? <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center"><Building2 className="mb-4 h-12 w-12 text-slate-300" /><h2 className="text-xl font-semibold text-[#0A2B4A]">No Investment Companies yet</h2><p className="mt-2 max-w-md text-slate-500">Create the first profile when your team is ready. No company records are created automatically.</p><Button className="mt-6" onClick={openCreate} style={{ backgroundColor: "#0A2B4A" }}><Plus className="mr-2 h-4 w-4" />Create profile</Button></CardContent></Card> :
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{sortedProfiles.map((profile) => <Card key={profile.id} className="overflow-hidden"><div className="h-2" style={{ background: `linear-gradient(90deg, ${profile.primaryColor || "#0A2B4A"}, ${profile.secondaryColor || "#4A90E2"})` }} /><CardHeader><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3">{profile.logoUrl ? <img src={profile.logoUrl} alt="" className="h-12 w-12 rounded-lg border object-contain p-1" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100"><Building2 className="h-6 w-6 text-slate-400" /></div>}<div className="min-w-0"><CardTitle className="truncate">{profile.companyName}</CardTitle><p className="truncate text-sm text-slate-500">/developer/{profile.slug}/login</p></div></div><Badge variant={profile.isActive ? "default" : "secondary"}>{profile.isActive ? "Active" : "Inactive"}</Badge></div></CardHeader><CardContent><div className="mb-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Team members</p><p className="mt-1 flex items-center gap-1 font-semibold"><Users className="h-4 w-4" />{profile.teamMemberCount}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Primary rent</p><p className="mt-1 font-semibold">{profile.rentMetric === "psf" ? `$${profile.minRentPsf || "—"}/SF` : `$${profile.minRentPerUnit || "—"}/unit`}</p></div></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => openEdit(profile)}><Edit3 className="mr-2 h-4 w-4" />Manage</Button><Button className="flex-1" onClick={() => setLoginCompany(profile)}><KeyRound className="mr-2 h-4 w-4" />Initial Login</Button></div></CardContent></Card>)}</div>}
    </main>

     <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? `Manage ${editing.companyName}` : "Create New Development Partner"}</DialogTitle><DialogDescription>Set up an Investment Company portal with branding, acquisition criteria, targeting, and portal availability.</DialogDescription></DialogHeader>
      <div className="space-y-7 py-2">
        <section><h3 className="mb-3 font-semibold">Company and branding</h3><div className="grid gap-4 sm:grid-cols-2"><div><Label>Company name</Label><Input value={form.companyName} onChange={(e) => { update("companyName", e.target.value); if (!editing) update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></div><div><Label>Login slug</Label><Input value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase())} placeholder="company-name" /></div><div><Label>Primary color</Label><div className="flex gap-2"><Input type="color" value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="w-14 p-1" /><Input value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} /></div></div><div><Label>Secondary color</Label><div className="flex gap-2"><Input type="color" value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} className="w-14 p-1" /><Input value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} /></div></div><div className="sm:col-span-2"><Label>Company logo</Label><div className="mt-1 flex items-center gap-3 rounded-lg border p-3">{form.logoUrl ? <img src={form.logoUrl} alt="Logo preview" className="h-14 w-20 object-contain" /> : <Building2 className="h-10 w-10 text-slate-300" />}<label className="cursor-pointer"><Input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && logoMutation.mutate(e.target.files[0])} /><span className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium"><Upload className="mr-2 h-4 w-4" />{logoMutation.isPending ? "Uploading…" : "Upload logo"}</span></label>{form.logoUrl && <Button variant="ghost" size="sm" onClick={() => update("logoUrl", "")}>Remove</Button>}</div><p className="mt-1 text-xs text-slate-500">PNG, JPG, or WebP. Maximum 5 MB.</p></div></div></section>
        <section><h3 className="mb-3 font-semibold">Rent thresholds</h3><div className="grid gap-4 sm:grid-cols-3"><div><Label>Primary rent metric</Label><Select value={form.rentMetric} onValueChange={(value: "psf" | "per_unit") => update("rentMetric", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="psf">Rent per square foot</SelectItem><SelectItem value="per_unit">Rent per unit</SelectItem></SelectContent></Select></div><div><Label>Minimum rent $/SF {form.rentMetric === "psf" ? "(primary)" : "(secondary)"}</Label><Input type="number" min="0" step="0.01" value={form.minRentPsf} onChange={(e) => update("minRentPsf", e.target.value)} /></div><div><Label>Minimum rent $/unit {form.rentMetric === "per_unit" ? "(primary)" : "(secondary)"}</Label><Input type="number" min="0" step="1" value={form.minRentPerUnit} onChange={(e) => update("minRentPerUnit", e.target.value)} /></div></div></section>
        <section><h3 className="mb-3 font-semibold">Acreage criteria</h3><div className="grid gap-4 sm:grid-cols-2"><div><Label>Minimum acres</Label><Input type="number" min="0" step="0.1" value={form.minAcres} onChange={(e) => update("minAcres", e.target.value)} /></div><div><Label>Maximum acres</Label><Input type="number" min="0" step="0.1" value={form.maxAcres} onChange={(e) => update("maxAcres", e.target.value)} placeholder="No maximum" /></div></div><div className="mt-4 rounded-lg border p-4"><Label>Minimum-acre overrides by product type</Label><div className="mt-3 space-y-2">{Object.entries(form.acreageOverridesByProductType).map(([product, acres]) => <div key={product} className="flex items-center gap-2"><Input value={product} disabled /><Input type="number" min="0" step="0.1" value={acres} onChange={(e) => update("acreageOverridesByProductType", { ...form.acreageOverridesByProductType, [product]: Number(e.target.value) })} className="w-36" /><Button variant="ghost" size="sm" onClick={() => { const next = { ...form.acreageOverridesByProductType }; delete next[product]; update("acreageOverridesByProductType", next); }}>Remove</Button></div>)}</div><div className="mt-3 flex gap-2"><Input value={overrideName} onChange={(e) => setOverrideName(e.target.value)} placeholder="Product type, e.g. Active Adult" /><Button type="button" variant="outline" onClick={() => { const name = overrideName.trim(); if (name) { update("acreageOverridesByProductType", { ...form.acreageOverridesByProductType, [name]: Number(form.minAcres) || 0 }); setOverrideName(""); } }}>Add override</Button></div></div></section>
        <section><h3 className="mb-3 font-semibold">Affordable housing overrides</h3><div className="grid gap-3 sm:grid-cols-3"><ToggleRow label="QCT override" description="QCT status may override the rent minimum." checked={form.qctOverridesRentMinimum} onChange={(value) => update("qctOverridesRentMinimum", value)} /><ToggleRow label="DDA override" description="DDA status may override the rent minimum." checked={form.ddaOverridesRentMinimum} onChange={(value) => update("ddaOverridesRentMinimum", value)} /><ToggleRow label="OZ override" description="Opportunity Zone status may override rent." checked={form.ozOverridesRentMinimum} onChange={(value) => update("ozOverridesRentMinimum", value)} /></div></section>
        <section><h3 className="mb-3 font-semibold">Markets and identity</h3><div className="grid gap-4 sm:grid-cols-2"><TagsField label="Target states" values={form.targetStates} onChange={(values) => update("targetStates", values)} placeholder="NC, SC, GA" /><TagsField label="Target counties" values={form.targetCounties} onChange={(values) => update("targetCounties", values)} placeholder="Wake, Mecklenburg" /><div className="sm:col-span-2"><TagsField label="Known email domains" values={form.knownEmailDomains} onChange={(values) => update("knownEmailDomains", values.map((value) => value.toLowerCase().replace(/^@/, "")))} placeholder="company.com" /></div></div></section>
        <section className="grid gap-3 sm:grid-cols-2"><ToggleRow label="Internal company" description="Marks this as a LandLinq/Catalyst internal profile." checked={form.isInternal} onChange={(value) => update("isInternal", value)} /><ToggleRow label="Profile active" description="Allows assigned users to enter the company portal." checked={form.isActive} onChange={(value) => update("isActive", value)} /></section>
       </div><DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || logoMutation.isPending}>{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save changes" : "Create Development Partner"}</Button></DialogFooter>
    </DialogContent></Dialog>

     <Dialog open={!!loginCompany} onOpenChange={(open) => !open && setLoginCompany(null)}><DialogContent><DialogHeader><DialogTitle>Invite Development Partner Contact</DialogTitle><DialogDescription>Create the first developer account for {loginCompany?.companyName}. A temporary password and branded login link will be emailed to the contact.</DialogDescription></DialogHeader><div className="space-y-4 py-3"><div><Label>Contact name</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="First and last name" /></div><div><Label>Email</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@company.com" /></div><div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><p>The account will be assigned the DEVELOPER role and must choose a new password at first sign-in.</p></div></div><DialogFooter><Button variant="outline" onClick={() => setLoginCompany(null)}>Cancel</Button><Button onClick={() => loginMutation.mutate()} disabled={loginMutation.isPending}>{loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account and send invitation</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
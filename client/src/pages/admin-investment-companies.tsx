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
import { Building2, Edit3, KeyRound, Loader2, LockKeyhole, Mail, Plus, Trash2, Upload, Users, X } from "lucide-react";

type ProductType = {
  id?: string;
  name: string;
  minAcres: string;
  maxAcres: string | null;
  minRentPsf: string | null;
  minRentPerUnit: string | null;
  isActive: boolean;
};

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
  qctOverridesRentMinimum: boolean | null;
  ddaOverridesRentMinimum: boolean | null;
  ozOverridesRentMinimum: boolean | null;
  targetStates: string[];
  targetCounties: string[];
  productTypes: ProductType[];
  countyMarketLabels: Record<string, string>;
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
  qctOverridesRentMinimum: boolean;
  ddaOverridesRentMinimum: boolean;
  ozOverridesRentMinimum: boolean;
  targetStates: string[];
  targetCounties: string[];
  productTypes: ProductType[];
  countyMarketLabels: Record<string, string>;
  isActive: boolean;
}

interface InviteRow {
  id: string;
  name: string;
  email: string;
}

interface InviteResult {
  invited: number;
  failed: Array<{ email: string; reason: string }>;
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
  qctOverridesRentMinimum: false,
  ddaOverridesRentMinimum: false,
  ozOverridesRentMinimum: false,
  targetStates: [],
  targetCounties: [],
  productTypes: [{ name: "", minAcres: "", maxAcres: "", minRentPsf: "", minRentPerUnit: "", isActive: true }],
  countyMarketLabels: {},
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

function CountyMarketEditor({ values, labels, onCountiesChange, onLabelsChange }: {
  values: string[];
  labels: Record<string, string>;
  onCountiesChange: (values: string[]) => void;
  onLabelsChange: (labels: Record<string, string>) => void;
}) {
  const groups = values.reduce<Record<string, string[]>>((result, county) => {
    const market = labels[county]?.trim() || "Other markets";
    (result[market] ||= []).push(county);
    return result;
  }, {});
  const removeCounty = (county: string) => {
    onCountiesChange(values.filter((value) => value !== county));
    const next = { ...labels };
    delete next[county];
    onLabelsChange(next);
  };
  return <div className="space-y-3">
    <TagsField
      label="Target counties"
      values={values}
      onChange={(next) => {
        onCountiesChange(next);
        onLabelsChange(Object.fromEntries(Object.entries(labels).filter(([county]) => next.includes(county))));
      }}
      placeholder="Wake, Mecklenburg"
    />
    {values.length > 0 && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">County groups</p>
      <div className="space-y-4">
        {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([market, counties]) => (
          <div key={market}>
            <p className="mb-2 text-xs font-semibold text-slate-700">{market}</p>
            <div className="space-y-2">
              {counties.map((county) => (
                <div key={county} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <span className="text-sm font-medium text-slate-800">{county}</span>
                  <Input value={labels[county] || ""} onChange={(event) => onLabelsChange({ ...labels, [county]: event.target.value })} placeholder="Market label, e.g. CLT" aria-label={`${county} market label`} className="h-8 bg-white" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeCounty(county)} aria-label={`Remove ${county}`}><Trash2 className="h-4 w-4 text-slate-400" /></Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>}
  </div>;
}

function NumberField({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <div><Label>{label}{required && <span className="text-red-500"> *</span>}</Label><Input className="mt-1" type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
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
  const [loginCompany, setLoginCompany] = useState<InvestmentCompany | null>(null);
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([]);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);

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
      qctOverridesRentMinimum: editing.qctOverridesRentMinimum === true,
      ddaOverridesRentMinimum: editing.ddaOverridesRentMinimum === true,
      ozOverridesRentMinimum: editing.ozOverridesRentMinimum === true,
      targetStates: editing.targetStates || [],
      targetCounties: editing.targetCounties || [],
      productTypes: (editing.productTypes?.length ? editing.productTypes : [{
        name: "General",
        minAcres: editing.minAcres || "",
        maxAcres: editing.maxAcres || "",
        minRentPsf: editing.minRentPsf || "",
        minRentPerUnit: editing.minRentPerUnit || "",
        isActive: true,
      }]).map((productType) => ({
        ...productType,
        minAcres: productType.minAcres || "",
        maxAcres: productType.maxAcres || "",
        minRentPsf: productType.minRentPsf || "",
        minRentPerUnit: productType.minRentPerUnit || "",
        isActive: productType.isActive !== false,
      })),
      countyMarketLabels: editing.countyMarketLabels || {},
      isActive: editing.isActive,
    } : {
      ...blankForm,
      knownEmailDomains: [],
      targetStates: [],
      targetCounties: [],
      productTypes: [{ name: "", minAcres: "", maxAcres: "", minRentPsf: "", minRentPerUnit: "", isActive: true }],
      countyMarketLabels: {},
    });
  }, [editing, formOpen]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const activeProductTypes = form.productTypes.filter((productType) => productType.isActive);
      const firstActive = activeProductTypes[0];
      if (!firstActive) throw new Error("At least one active product type is required");
      for (let index = 0; index < form.productTypes.length; index++) {
        const productType = form.productTypes[index];
        if (!productType.name.trim()) throw new Error(`Product type ${index + 1} needs a name`);
        if (productType.minAcres === "" || Number(productType.minAcres) < 0) throw new Error(`${productType.name}: minimum acreage is required`);
        if (productType.maxAcres && Number(productType.maxAcres) < Number(productType.minAcres)) throw new Error(`${productType.name}: maximum acreage must be at least the minimum`);
        const rent = form.rentMetric === "psf" ? productType.minRentPsf : productType.minRentPerUnit;
        if (productType.isActive && (!rent || Number(rent) <= 0)) throw new Error(`${productType.name}: minimum ${form.rentMetric === "psf" ? "$/SF" : "$/Unit"} is required`);
      }
      return requestJson(editing ? `/api/admin/investment-companies/${editing.id}` : "/api/admin/investment-companies", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          logoUrl: form.logoUrl || null,
          minAcres: firstActive.minAcres,
          maxAcres: firstActive.maxAcres || null,
          minRentPsf: firstActive.minRentPsf || null,
          minRentPerUnit: firstActive.minRentPerUnit || null,
          productTypes: form.productTypes.map(({ id: _id, ...productType }) => ({
            ...productType,
            name: productType.name.trim(),
            maxAcres: productType.maxAcres || null,
            minRentPsf: productType.minRentPsf || null,
            minRentPerUnit: productType.minRentPerUnit || null,
          })),
        }),
      });
    },
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
    mutationFn: () => requestJson(`/api/admin/investment-companies/${loginCompany?.id}/initial-login/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteRows.filter((row) => row.name.trim() || row.email.trim()).map(({ name, email }) => ({ name, email }))),
    }),
    onSuccess: (result: InviteResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/investment-companies"] });
      setInviteResult(result);
      if (result.failed.length) {
        const failedEmails = new Set(result.failed.map((failure) => failure.email.toLowerCase()));
        setInviteRows((current) => current.filter((row) => failedEmails.has(row.email.trim().toLowerCase())));
      } else {
        setInviteRows([]);
      }
      toast({
        title: result.failed.length ? "Some invitations need attention" : "Initial logins sent",
        description: result.failed.length
          ? `${result.invited} invited, ${result.failed.length} failed. Correct the failed rows and retry.`
          : `${result.invited} team member${result.invited === 1 ? "" : "s"} invited successfully.`,
      });
    },
    onError: (error: Error) => toast({ title: "Could not create login", description: error.message, variant: "destructive" }),
  });

  const sortedProfiles = useMemo(() => [...(companiesQuery.data?.profiles || [])].sort((a, b) => a.companyName.localeCompare(b.companyName)), [companiesQuery.data]);
  const update = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateProductType = (index: number, patch: Partial<ProductType>) =>
    update("productTypes", form.productTypes.map((productType, productIndex) => productIndex === index ? { ...productType, ...patch } : productType));
  const addProductType = () =>
    update("productTypes", [...form.productTypes, { name: "", minAcres: "", maxAcres: "", minRentPsf: "", minRentPerUnit: "", isActive: true }]);
  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (profile: InvestmentCompany) => { setEditing(profile); setFormOpen(true); };
  const openInvite = (profile: InvestmentCompany) => {
    setLoginCompany(profile);
    setInviteRows([{ id: crypto.randomUUID(), name: "", email: "" }]);
    setInviteResult(null);
  };
  const closeInvite = () => {
    setLoginCompany(null);
    setInviteRows([]);
    setInviteResult(null);
  };
  const updateInviteRow = (id: string, field: "name" | "email", value: string) =>
    setInviteRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  const addInviteRow = () =>
    setInviteRows((current) => [...current, { id: crypto.randomUUID(), name: "", email: "" }]);
  const removeInviteRow = (id: string) =>
    setInviteRows((current) => current.filter((row, index) => index === 0 || row.id !== id));
  const submitInvites = () => {
    const filledRows = inviteRows.filter((row) => row.name.trim() || row.email.trim());
    if (!filledRows.length) {
      toast({ title: "Add at least one team member", variant: "destructive" });
      return;
    }
    loginMutation.mutate();
  };

  if (!isPlatformAdmin) return <div className="min-h-screen bg-slate-50"><Navigation /><div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center"><LockKeyhole className="mb-4 h-12 w-12 text-slate-300" /><h1 className="text-2xl font-bold text-slate-900">Apex Resi administrators only</h1><p className="mt-2 text-slate-500">This page is restricted to authenticated @apexresi.com accounts.</p></div></div>;

  return <div className="min-h-screen bg-slate-50">
    <Navigation />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold uppercase tracking-wider text-[#4A90E2]">Platform administration</p><h1 className="mt-1 text-3xl font-bold text-[#0A2B4A]">Development Partners</h1><p className="mt-2 text-slate-600">Create Investment Company portals, configure acquisition criteria, and invite partner contacts by email.</p></div><Button onClick={openCreate} style={{ backgroundColor: "#0A2B4A" }}><Plus className="mr-2 h-4 w-4" />Create New Development Partner</Button></div>
      {companiesQuery.isLoading ? <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#4A90E2]" /></div> : companiesQuery.isError ? <Card><CardContent className="py-12 text-center text-red-600">Unable to load Investment Company profiles.</CardContent></Card> : !sortedProfiles.length ? <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center"><Building2 className="mb-4 h-12 w-12 text-slate-300" /><h2 className="text-xl font-semibold text-[#0A2B4A]">No Investment Companies yet</h2><p className="mt-2 max-w-md text-slate-500">Create the first profile when your team is ready. No company records are created automatically.</p><Button className="mt-6" onClick={openCreate} style={{ backgroundColor: "#0A2B4A" }}><Plus className="mr-2 h-4 w-4" />Create profile</Button></CardContent></Card> :
       <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{sortedProfiles.map((profile) => { const activeProductTypeCount = (profile.productTypes || []).filter((productType) => productType.isActive).length; return <Card key={profile.id} className="overflow-hidden"><div className="h-2" style={{ background: `linear-gradient(90deg, ${profile.primaryColor || "#0A2B4A"}, ${profile.secondaryColor || "#4A90E2"})` }} /><CardHeader><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3">{profile.logoUrl ? <img src={profile.logoUrl} alt="" className="h-12 w-12 rounded-lg border object-contain p-1" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100"><Building2 className="h-6 w-6 text-slate-400" /></div>}<div className="min-w-0"><CardTitle className="truncate">{profile.companyName}</CardTitle><p className="truncate text-sm text-slate-500">/developer/{profile.slug}/login</p></div></div><Badge variant={profile.isActive ? "default" : "secondary"}>{profile.isActive ? "Active" : "Inactive"}</Badge></div></CardHeader><CardContent><div className="mb-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Team members</p><p className="mt-1 flex items-center gap-1 font-semibold"><Users className="h-4 w-4" />{profile.teamMemberCount}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Product types</p><p className="mt-1 font-semibold">{activeProductTypeCount} active {activeProductTypeCount === 1 ? "type" : "types"}</p></div></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => openEdit(profile)}><Edit3 className="mr-2 h-4 w-4" />Manage</Button><Button className="flex-1" onClick={() => openInvite(profile)}><KeyRound className="mr-2 h-4 w-4" />Initial Login</Button></div></CardContent></Card>; })}</div>}
    </main>

     <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? `Manage ${editing.companyName}` : "Create New Development Partner"}</DialogTitle><DialogDescription>Set up an Investment Company portal with branding, acquisition criteria, targeting, and portal availability.</DialogDescription></DialogHeader>
      <div className="space-y-7 py-2">
        <section><h3 className="mb-3 font-semibold">Company and branding</h3><div className="grid gap-4 sm:grid-cols-2"><div><Label>Company name</Label><Input value={form.companyName} onChange={(e) => { update("companyName", e.target.value); if (!editing) update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></div><div><Label>Login slug</Label><Input value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase())} placeholder="company-name" /></div><div><Label>Primary color</Label><div className="flex gap-2"><Input type="color" value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="w-14 p-1" /><Input value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} /></div></div><div><Label>Secondary color</Label><div className="flex gap-2"><Input type="color" value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} className="w-14 p-1" /><Input value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} /></div></div><div className="sm:col-span-2"><Label>Company logo</Label><div className="mt-1 flex items-center gap-3 rounded-lg border p-3">{form.logoUrl ? <img src={form.logoUrl} alt="Logo preview" className="h-14 w-20 object-contain" /> : <Building2 className="h-10 w-10 text-slate-300" />}<label className="cursor-pointer"><Input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && logoMutation.mutate(e.target.files[0])} /><span className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium"><Upload className="mr-2 h-4 w-4" />{logoMutation.isPending ? "Uploading…" : "Upload logo"}</span></label>{form.logoUrl && <Button variant="ghost" size="sm" onClick={() => update("logoUrl", "")}>Remove</Button>}</div><p className="mt-1 text-xs text-slate-500">PNG, JPG, or WebP. Maximum 5 MB.</p></div></div></section>
         <section><h3 className="mb-3 font-semibold">Acquisition criteria</h3><div className="max-w-sm"><Label>Primary rent metric</Label><Select value={form.rentMetric} onValueChange={(value: "psf" | "per_unit") => update("rentMetric", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="psf">Rent per square foot</SelectItem><SelectItem value="per_unit">Rent per unit</SelectItem></SelectContent></Select></div></section>
         <section><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Product types</h3><p className="text-sm text-slate-500">Define acreage and {form.rentMetric === "psf" ? "$/SF" : "$/Unit"} thresholds for each active product type.</p></div><Button type="button" variant="outline" size="sm" onClick={addProductType}><Plus className="mr-1 h-4 w-4" />Add product type</Button></div>{form.productTypes.length === 0 ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Add at least one active product type before saving.</div> : <div className="space-y-3">{form.productTypes.map((productType, index) => <div key={productType.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto] lg:items-end"><div><Label>Product type <span className="text-red-500">*</span></Label><Input className="mt-1 bg-white" value={productType.name} onChange={(event) => updateProductType(index, { name: event.target.value })} placeholder="e.g. 3-Story Garden" /></div><NumberField label="Min acres" value={productType.minAcres} onChange={(value) => updateProductType(index, { minAcres: value })} required /><NumberField label="Max acres" value={productType.maxAcres || ""} onChange={(value) => updateProductType(index, { maxAcres: value })} placeholder="No maximum" /><NumberField label={form.rentMetric === "psf" ? "Min rent $/SF" : "Min rent $/Unit"} value={form.rentMetric === "psf" ? productType.minRentPsf || "" : productType.minRentPerUnit || ""} onChange={(value) => updateProductType(index, form.rentMetric === "psf" ? { minRentPsf: value } : { minRentPerUnit: value })} required /><Button type="button" size="icon" variant="ghost" onClick={() => update("productTypes", form.productTypes.filter((_, productIndex) => productIndex !== index))} aria-label={`Remove ${productType.name || "product type"}`}><Trash2 className="h-4 w-4 text-slate-400" /></Button></div></div>)}</div>}</section>
        <section><h3 className="mb-3 font-semibold">Affordable housing overrides</h3><div className="grid gap-3 sm:grid-cols-3"><ToggleRow label="QCT override" description="QCT status may override the rent minimum." checked={form.qctOverridesRentMinimum} onChange={(value) => update("qctOverridesRentMinimum", value)} /><ToggleRow label="DDA override" description="DDA status may override the rent minimum." checked={form.ddaOverridesRentMinimum} onChange={(value) => update("ddaOverridesRentMinimum", value)} /><ToggleRow label="OZ override" description="Opportunity Zone status may override rent." checked={form.ozOverridesRentMinimum} onChange={(value) => update("ozOverridesRentMinimum", value)} /></div></section>
         <section><h3 className="mb-3 font-semibold">Markets and identity</h3><div className="grid gap-4 sm:grid-cols-2"><TagsField label="Target states" values={form.targetStates} onChange={(values) => update("targetStates", values)} placeholder="NC, SC, GA" /><CountyMarketEditor values={form.targetCounties} labels={form.countyMarketLabels} onCountiesChange={(values) => update("targetCounties", values)} onLabelsChange={(labels) => update("countyMarketLabels", labels)} /><div className="sm:col-span-2"><TagsField label="Known email domains" values={form.knownEmailDomains} onChange={(values) => update("knownEmailDomains", values.map((value) => value.toLowerCase().replace(/^@/, "")))} placeholder="company.com" /></div></div></section>
        <section className="grid gap-3 sm:grid-cols-2"><ToggleRow label="Internal company" description="Marks this as a LandLinq/Catalyst internal profile." checked={form.isInternal} onChange={(value) => update("isInternal", value)} /><ToggleRow label="Profile active" description="Allows assigned users to enter the company portal." checked={form.isActive} onChange={(value) => update("isActive", value)} /></section>
       </div><DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || logoMutation.isPending}>{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save changes" : "Create Development Partner"}</Button></DialogFooter>
    </DialogContent></Dialog>

      <Dialog open={!!loginCompany} onOpenChange={(open) => !open && closeInvite()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Invite Development Partner Contact</DialogTitle><DialogDescription>Invite one or more team members to the {loginCompany?.companyName} portal. Each person will receive a temporary password and branded login link.</DialogDescription></DialogHeader><div className="space-y-4 py-3">{inviteResult && <div className={`rounded-lg border p-3 text-sm ${inviteResult.failed.length ? "border-amber-200 bg-amber-50 text-amber-950" : "border-green-200 bg-green-50 text-green-900"}`}><p className="font-semibold">{inviteResult.invited} invitation{inviteResult.invited === 1 ? "" : "s"} sent</p>{inviteResult.failed.length > 0 && <div className="mt-2 space-y-1"><p className="font-medium">{inviteResult.failed.length} failed:</p>{inviteResult.failed.map((failure, index) => <p key={`${failure.email}-${index}`} className="text-xs"><span className="font-medium">{failure.email || "Blank email"}:</span> {failure.reason}</p>)}</div>}</div>}<div className="space-y-3">{inviteRows.map((row, index) => <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><div><Label>Name</Label><Input value={row.name} onChange={(e) => updateInviteRow(row.id, "name", e.target.value)} placeholder="First and last name" /></div><div><Label>Email</Label><Input type="email" value={row.email} onChange={(e) => updateInviteRow(row.id, "email", e.target.value)} placeholder="contact@company.com" /></div>{index > 0 ? <Button type="button" variant="ghost" size="icon" className="mb-0.5" onClick={() => removeInviteRow(row.id)} aria-label="Remove team member"><X className="h-4 w-4" /></Button> : <div className="w-10" />}</div>)}</div><Button type="button" variant="outline" onClick={addInviteRow}><Plus className="mr-2 h-4 w-4" />Add another team member</Button><div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><p>Each account will be assigned the DEVELOPER role and must choose a new password at first sign-in.</p></div></div><DialogFooter><Button variant="outline" onClick={closeInvite}>{inviteResult ? "Done" : "Cancel"}</Button><Button onClick={submitInvites} disabled={loginMutation.isPending || !inviteRows.some((row) => row.name.trim() || row.email.trim())}>{loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{inviteResult?.failed.length ? "Retry failed invitations" : "Create account and send invitation"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
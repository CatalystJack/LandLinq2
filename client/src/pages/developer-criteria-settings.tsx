import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Profile = {
  companyName: string;
  profileType: "real_estate" | "general_sales";
  primaryColor: string | null;
  secondaryColor: string | null;
  targetStates: string[];
  targetCounties: string[];
  rentMetric: "psf" | "per_unit";
  compSearchRadiusMiles: string;
  productTypes: ProductType[];
  countyMarketLabels: Record<string, string>;
  qctOverridesRentMinimum: boolean;
  ddaOverridesRentMinimum: boolean;
  ozOverridesRentMinimum: boolean;
};

type ProductType = {
  id?: string;
  name: string;
  minAcres: string;
  maxAcres: string | null;
  minRentPsf: string | null;
  minRentPerUnit: string | null;
  isActive: boolean;
};

type TeamMember = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
};

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

function TagEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [entry, setEntry] = useState("");
  const addEntry = () => {
    const next = entry.trim().replace(/,$/, "").trim();
    if (next && !values.some((value) => value.toLowerCase() === next.toLowerCase())) {
      onChange([...values, next]);
    }
    setEntry("");
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 min-h-10 rounded-md border border-slate-200 bg-white p-2 focus-within:ring-2 focus-within:ring-slate-300">
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1 bg-slate-100 text-slate-700">
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                className="rounded-full text-slate-400 hover:text-slate-900"
                aria-label={`Remove ${value}`}
              >
                ×
              </button>
            </Badge>
          ))}
          <input
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addEntry();
              }
            }}
            onBlur={addEntry}
            placeholder={values.length ? "Add another…" : placeholder}
            className="min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">Press Enter or comma after each entry.</p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>{label} {required && <span className="text-red-500">*</span>}</Label>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 bg-white"
      />
    </div>
  );
}

function CountyMarketEditor({
  values,
  labels,
  onCountiesChange,
  onLabelsChange,
}: {
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
    const nextLabels = { ...labels };
    delete nextLabels[county];
    onLabelsChange(nextLabels);
  };

  return (
    <div className="space-y-3">
      <TagEditor
        label="Target counties"
        values={values}
        onChange={(counties) => {
          onCountiesChange(counties);
          onLabelsChange(Object.fromEntries(Object.entries(labels).filter(([county]) => counties.includes(county))));
        }}
        placeholder="e.g. Mecklenburg"
      />
      {values.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">County groups</p>
          <div className="space-y-4">
            {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([market, counties]) => (
              <div key={market}>
                <p className="mb-2 text-xs font-semibold text-slate-700">{market}</p>
                <div className="space-y-2">
                  {counties.map((county) => (
                    <div key={county} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                      <span className="text-sm font-medium text-slate-800">{county}</span>
                      <Input
                        value={labels[county] || ""}
                        onChange={(event) => onLabelsChange({ ...labels, [county]: event.target.value })}
                        placeholder="Market label, e.g. CLT"
                        aria-label={`${county} market label`}
                        className="h-8 bg-white"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeCounty(county)} aria-label={`Remove ${county}`}>
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeveloperCriteriaSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Profile | null>(null);
  const [overridesOpen, setOverridesOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);

  const profileQuery = useQuery<{ profile: Profile }>({
    queryKey: ["/api/developer-profile/me"],
    queryFn: () => jsonRequest("/api/developer-profile/me"),
  });
  const teamQuery = useQuery<{ team: TeamMember[] }>({
    queryKey: ["/api/developer-profile/me/team"],
    queryFn: () => jsonRequest("/api/developer-profile/me/team"),
  });

  useEffect(() => {
    if (profileQuery.data?.profile) {
      const profile = profileQuery.data.profile;
      setForm({
        ...profile,
        targetStates: profile.targetStates || [],
        targetCounties: profile.targetCounties || [],
        productTypes: (profile.productTypes || []).map((productType) => ({
          ...productType,
          minAcres: productType.minAcres || "",
          maxAcres: productType.maxAcres || "",
          minRentPsf: productType.minRentPsf || "",
          minRentPerUnit: productType.minRentPerUnit || "",
          isActive: productType.isActive !== false,
        })),
        countyMarketLabels: profile.countyMarketLabels || {},
        compSearchRadiusMiles: profile.compSearchRadiusMiles || "3",
      });
    }
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Profile>) =>
      jsonRequest("/api/developer-profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/developer-profile/me"], data);
      setForm(data.profile);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Settings saved", description: "Your company criteria are up to date." });
    },
    onError: (error: Error) => toast({ title: "Could not save settings", description: error.message, variant: "destructive" }),
  });

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((current) => current ? { ...current, [key]: value } : current);

  const save = () => {
    if (!form) return;
    if (form.profileType === "general_sales") {
      saveMutation.mutate({ profileType: "general_sales" });
      return;
    }
    if (!form.productTypes.length || !form.productTypes.some((productType) => productType.isActive)) {
      toast({ title: "Add at least one active product type before saving", variant: "destructive" });
      return;
    }
    if (!form.compSearchRadiusMiles || Number(form.compSearchRadiusMiles) <= 0) {
      toast({ title: "Comparable search radius must be greater than zero", variant: "destructive" });
      return;
    }
    for (let index = 0; index < form.productTypes.length; index++) {
      const productType = form.productTypes[index];
      if (!productType.name.trim()) {
        toast({ title: `Product type ${index + 1} needs a name`, variant: "destructive" });
        return;
      }
      if (productType.minAcres === "" || Number(productType.minAcres) < 0) {
        toast({ title: `${productType.name}: minimum acreage is required`, variant: "destructive" });
        return;
      }
      if (productType.maxAcres && Number(productType.maxAcres) < Number(productType.minAcres)) {
        toast({ title: `${productType.name}: maximum acreage must be at least the minimum`, variant: "destructive" });
        return;
      }
      const rent = form.rentMetric === "psf" ? productType.minRentPsf : productType.minRentPerUnit;
      if (productType.isActive && (!rent || Number(rent) <= 0)) {
        toast({ title: `${productType.name}: minimum ${form.rentMetric === "psf" ? "$/SF" : "$/Unit"} is required`, variant: "destructive" });
        return;
      }
    }
    saveMutation.mutate({
      targetStates: form.targetStates,
      targetCounties: form.targetCounties,
      rentMetric: form.rentMetric,
      compSearchRadiusMiles: form.compSearchRadiusMiles,
      productTypes: form.productTypes.map(({ id: _id, ...productType }) => ({
        ...productType,
        name: productType.name.trim(),
        maxAcres: productType.maxAcres || null,
        minRentPsf: productType.minRentPsf || null,
        minRentPerUnit: productType.minRentPerUnit || null,
      })),
      countyMarketLabels: form.countyMarketLabels,
      qctOverridesRentMinimum: form.qctOverridesRentMinimum,
      ddaOverridesRentMinimum: form.ddaOverridesRentMinimum,
      ozOverridesRentMinimum: form.ozOverridesRentMinimum,
    });
  };

  const addProductType = () => {
    if (!form) return;
    update("productTypes", [
      ...form.productTypes,
      {
        name: "",
        minAcres: "",
        maxAcres: "",
        minRentPsf: "",
        minRentPerUnit: "",
        isActive: true,
      },
    ]);
  };
  const updateProductType = (index: number, patch: Partial<ProductType>) => {
    if (!form) return;
    update("productTypes", form.productTypes.map((productType, productIndex) =>
      productIndex === index ? { ...productType, ...patch } : productType,
    ));
  };

  if (profileQuery.isLoading || !form) {
    return (
      <div className="min-h-screen bg-slate-50">
        <DeveloperNavigation />
        <div className="flex min-h-96 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-slate-500" /></div>
      </div>
    );
  }
  if (profileQuery.isError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <DeveloperNavigation />
        <div className="mx-auto max-w-3xl px-6 py-16 text-center text-red-600">{(profileQuery.error as Error).message}</div>
      </div>
    );
  }

  const primaryColor = form.primaryColor || "#0A2B4A";
  const secondaryColor = form.secondaryColor || "#4A90E2";
  const isPsf = form.rentMetric === "psf";

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: secondaryColor }}>Company Settings</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">{form.profileType === "general_sales" ? "Company settings" : "Acquisition criteria"}</h1>
            <p className="mt-2 text-slate-500">{form.profileType === "general_sales" ? `Manage ${form.companyName} team access and account settings.` : `Control how ${form.companyName} evaluates and receives deals.`}</p>
          </div>
          <Button onClick={save} disabled={saveMutation.isPending} style={{ backgroundColor: primaryColor }} className="text-white">
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save settings
          </Button>
        </div>

        <div className="space-y-6">
          {form.profileType === "real_estate" && <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2" style={{ backgroundColor: `${secondaryColor}18`, color: primaryColor }}><Settings2 className="h-5 w-5" /></div>
                <div><CardTitle>Criteria</CardTitle><CardDescription>These rules determine each deal’s profile-specific classification.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                <TagEditor label="Target states" values={form.targetStates} onChange={(value) => update("targetStates", value)} placeholder="e.g. North Carolina" />
                <CountyMarketEditor
                  values={form.targetCounties}
                  labels={form.countyMarketLabels}
                  onCountiesChange={(value) => update("targetCounties", value)}
                  onLabelsChange={(value) => update("countyMarketLabels", value)}
                />
              </div>

              <div>
                <Label>Rent metric</Label>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  {[
                    { value: "psf" as const, title: "Rent Comps — Min $/SF", description: "Use minimum rent per square foot as the primary test." },
                    { value: "per_unit" as const, title: "Rent Comps — Min $/Unit (Avg)", description: "Use average minimum rent per unit as the primary test." },
                  ].map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => update("rentMetric", option.value)}
                      className={`rounded-lg border p-4 text-left transition ${form.rentMetric === option.value ? "border-2 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                      style={form.rentMetric === option.value ? { borderColor: secondaryColor } : undefined}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-900">{option.title}</span>
                        {form.rentMetric === option.value && <Check className="h-4 w-4 shrink-0" style={{ color: secondaryColor }} />}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <NumberField
                  label="Comparable search radius (miles)"
                  value={form.compSearchRadiusMiles}
                  onChange={(value) => update("compSearchRadiusMiles", value)}
                  placeholder="3"
                  required
                />
              </div>

              <div className="border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div><h3 className="font-semibold text-slate-900">Product types</h3><p className="text-sm text-slate-500">A deal is marked Review when it clears the acreage and rent criteria for any active product type.</p></div>
                  <Button type="button" variant="outline" size="sm" onClick={addProductType}><Plus className="mr-1 h-4 w-4" />Add product type</Button>
                </div>
                {form.productTypes.length === 0 ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Add at least one active product type before saving.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.productTypes.map((productType, index) => (
                      <div key={productType.id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto] lg:items-end">
                          <div>
                            <Label>Product type <span className="text-red-500">*</span></Label>
                            <Input
                              value={productType.name}
                              onChange={(event) => updateProductType(index, { name: event.target.value })}
                              placeholder="e.g. 3-Story Garden"
                              className="mt-2 bg-white"
                            />
                          </div>
                          <NumberField
                            label="Min acres"
                            value={productType.minAcres}
                            onChange={(value) => updateProductType(index, { minAcres: value })}
                            required
                          />
                          <NumberField
                            label="Max acres"
                            value={productType.maxAcres || ""}
                            onChange={(value) => updateProductType(index, { maxAcres: value })}
                            placeholder="No maximum"
                          />
                          <NumberField
                            label={isPsf ? "Min rent $/SF" : "Min rent $/Unit"}
                            value={isPsf ? productType.minRentPsf || "" : productType.minRentPerUnit || ""}
                            onChange={(value) => updateProductType(index, isPsf ? { minRentPsf: value } : { minRentPerUnit: value })}
                            required
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => update("productTypes", form.productTypes.filter((_, productIndex) => productIndex !== index))}
                            aria-label={`Remove ${productType.name || "product type"}`}
                          >
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>}

          {form.profileType === "real_estate" && <Card className="border-slate-200 shadow-sm">
            <CardHeader className="cursor-pointer" onClick={() => setOverridesOpen((open) => !open)}>
              <div className="flex items-center justify-between">
                <div><CardTitle>Rent minimum overrides</CardTitle><CardDescription>Allow qualifying public programs to bypass rent minimums.</CardDescription></div>
                {overridesOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </div>
            </CardHeader>
            {overridesOpen && <CardContent className="grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-3">
              {[
                ["qctOverridesRentMinimum", "Qualified Census Tract (QCT)"],
                ["ddaOverridesRentMinimum", "Difficult Development Area (DDA)"],
                ["ozOverridesRentMinimum", "Opportunity Zone (OZ)"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
                  <Checkbox checked={Boolean(form[key as keyof Profile])} onCheckedChange={(checked) => update(key as keyof Profile, checked === true as never)} />
                  <span className="text-sm font-medium leading-5 text-slate-700">{label} can override rent minimum</span>
                </label>
              ))}
              <p className="text-xs text-slate-500 md:col-span-3">Overrides only rescue rent failures. County/state and acreage criteria still apply.</p>
            </CardContent>}
          </Card>}

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="cursor-pointer" onClick={() => setTeamOpen((open) => !open)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Users className="h-5 w-5" /></div><div><CardTitle>Team</CardTitle><CardDescription>LandLinq/Apex approves and creates all company accounts.</CardDescription></div></div>
                {teamOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </div>
            </CardHeader>
            {teamOpen && <CardContent className="border-t border-slate-100 pt-5">
              <div className="mb-4 flex justify-end">
                <Button asChild style={{ backgroundColor: primaryColor }} className="text-white">
                  <a href="mailto:help@landlinq.ai?subject=Team%20member%20addition%20request&body=Requested%20teammate%20name%3A%0ARequested%20teammate%20email%3A%0AReason%20for%20access%3A%0A%0APlease%20review%20and%20approve%20this%20addition.">Request Team Member</a>
                </Button>
              </div>
              {teamQuery.isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : (teamQuery.data?.team || []).length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No team members found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3 font-semibold">Name</th><th className="px-3 py-3 font-semibold">Email</th><th className="px-3 py-3 font-semibold">Date added</th></tr></thead>
                    <tbody>{teamQuery.data?.team.map((member) => <tr key={member.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-medium text-slate-800">{[member.firstName, member.lastName].filter(Boolean).join(" ") || "—"}</td><td className="px-3 py-3 text-slate-600">{member.email}</td><td className="px-3 py-3 text-slate-500">{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "—"}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </CardContent>}
          </Card>
        </div>
      </main>

    </div>
  );
}
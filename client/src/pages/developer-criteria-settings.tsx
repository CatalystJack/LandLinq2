import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Profile = {
  companyName: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  targetStates: string[];
  targetCounties: string[];
  rentMetric: "psf" | "per_unit";
  minRentPsf: string | null;
  minRentPerUnit: string | null;
  compSearchRadiusMiles: string;
  minAcres: string;
  maxAcres: string | null;
  acreageOverridesByProductType: Record<string, number> | null;
  qctOverridesRentMinimum: boolean;
  ddaOverridesRentMinimum: boolean;
  ozOverridesRentMinimum: boolean;
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

export default function DeveloperCriteriaSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Profile | null>(null);
  const [overridesOpen, setOverridesOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

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
        acreageOverridesByProductType: profile.acreageOverridesByProductType || {},
        minRentPsf: profile.minRentPsf || "",
        minRentPerUnit: profile.minRentPerUnit || "",
        compSearchRadiusMiles: profile.compSearchRadiusMiles || "3",
        maxAcres: profile.maxAcres || "",
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

  const addMemberMutation = useMutation({
    mutationFn: () =>
      jsonRequest("/api/developer-profile/me/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: memberName, email: memberEmail }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/team"] });
      setMemberOpen(false);
      setMemberName("");
      setMemberEmail("");
      toast({
        title: "Team member added",
        description: data.emailSent === false
          ? "The account was created, but the invitation email could not be sent."
          : "An invitation with a temporary password was sent.",
      });
    },
    onError: (error: Error) => toast({ title: "Could not add team member", description: error.message, variant: "destructive" }),
  });

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((current) => current ? { ...current, [key]: value } : current);

  const save = () => {
    if (!form) return;
    if (!form.minAcres || Number(form.minAcres) < 0) {
      toast({ title: "Minimum acreage is required", variant: "destructive" });
      return;
    }
    if (!form.compSearchRadiusMiles || Number(form.compSearchRadiusMiles) <= 0) {
      toast({ title: "Comparable search radius must be greater than zero", variant: "destructive" });
      return;
    }
    if (form.rentMetric === "psf" && !form.minRentPsf) {
      toast({ title: "Minimum $/SF is required for this rent metric", variant: "destructive" });
      return;
    }
    if (form.rentMetric === "per_unit" && !form.minRentPerUnit) {
      toast({ title: "Minimum $/Unit is required for this rent metric", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      targetStates: form.targetStates,
      targetCounties: form.targetCounties,
      rentMetric: form.rentMetric,
      minRentPsf: form.minRentPsf || null,
      minRentPerUnit: form.minRentPerUnit || null,
      compSearchRadiusMiles: form.compSearchRadiusMiles,
      minAcres: form.minAcres,
      maxAcres: form.maxAcres || null,
      acreageOverridesByProductType: form.acreageOverridesByProductType || {},
      qctOverridesRentMinimum: form.qctOverridesRentMinimum,
      ddaOverridesRentMinimum: form.ddaOverridesRentMinimum,
      ozOverridesRentMinimum: form.ozOverridesRentMinimum,
    });
  };

  const addAcreageOverride = () =>
    update("acreageOverridesByProductType", {
      ...(form?.acreageOverridesByProductType || {}),
      "": 0,
    });
  const overrideEntries = Object.entries(form?.acreageOverridesByProductType || {});

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
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Acquisition criteria</h1>
            <p className="mt-2 text-slate-500">Control how {form.companyName} evaluates and receives deals.</p>
          </div>
          <Button onClick={save} disabled={saveMutation.isPending} style={{ backgroundColor: primaryColor }} className="text-white">
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save settings
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2" style={{ backgroundColor: `${secondaryColor}18`, color: primaryColor }}><Settings2 className="h-5 w-5" /></div>
                <div><CardTitle>Criteria</CardTitle><CardDescription>These rules determine each deal’s profile-specific classification.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                <TagEditor label="Target states" values={form.targetStates} onChange={(value) => update("targetStates", value)} placeholder="e.g. North Carolina" />
                <TagEditor label="Target counties" values={form.targetCounties} onChange={(value) => update("targetCounties", value)} placeholder="e.g. Mecklenburg" />
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
                  label={isPsf ? "Minimum rent $/SF" : "Minimum rent $/Unit (Avg)"}
                  value={isPsf ? form.minRentPsf || "" : form.minRentPerUnit || ""}
                  onChange={(value) => update(isPsf ? "minRentPsf" : "minRentPerUnit", value)}
                  placeholder={isPsf ? "e.g. 1.75" : "e.g. 1,400"}
                  required
                />
                <NumberField
                  label={isPsf ? "Secondary reference $/Unit (optional)" : "Secondary reference $/SF (optional)"}
                  value={isPsf ? form.minRentPerUnit || "" : form.minRentPsf || ""}
                  onChange={(value) => update(isPsf ? "minRentPerUnit" : "minRentPsf", value)}
                  placeholder="Stored for reference only"
                />
                <NumberField
                  label="Comparable search radius (miles)"
                  value={form.compSearchRadiusMiles}
                  onChange={(value) => update("compSearchRadiusMiles", value)}
                  placeholder="3"
                  required
                />
                <NumberField label="Minimum acreage" value={form.minAcres} onChange={(value) => update("minAcres", value)} required />
                <NumberField label="Maximum acreage (optional)" value={form.maxAcres || ""} onChange={(value) => update("maxAcres", value)} placeholder="No maximum" />
              </div>

              <div className="border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div><h3 className="font-semibold text-slate-900">Product-type acreage overrides</h3><p className="text-sm text-slate-500">Use a different minimum acreage for specific product types.</p></div>
                  <Button type="button" variant="outline" size="sm" onClick={addAcreageOverride}><Plus className="mr-1 h-4 w-4" />Add override</Button>
                </div>
                {overrideEntries.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">No overrides configured. The flat minimum applies to every product type.</p>
                ) : (
                  <div className="space-y-2">
                    {overrideEntries.map(([key, value], index) => (
                      <div key={`${key}-${index}`} className="flex gap-2">
                        <Input
                          value={key}
                          placeholder="Product type, e.g. garden_style"
                          onChange={(event) => {
                            const next = { ...(form.acreageOverridesByProductType || {}) };
                            delete next[key];
                            next[event.target.value] = value;
                            update("acreageOverridesByProductType", next);
                          }}
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-36"
                          value={value}
                          onChange={(event) => update("acreageOverridesByProductType", { ...(form.acreageOverridesByProductType || {}), [key]: Number(event.target.value) })}
                          aria-label={`${key || "Product type"} minimum acres`}
                        />
                        <Button type="button" size="icon" variant="ghost" onClick={() => {
                          const next = { ...(form.acreageOverridesByProductType || {}) };
                          delete next[key];
                          update("acreageOverridesByProductType", next);
                        }} aria-label="Remove override"><Trash2 className="h-4 w-4 text-slate-400" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
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
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="cursor-pointer" onClick={() => setTeamOpen((open) => !open)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Users className="h-5 w-5" /></div><div><CardTitle>Team</CardTitle><CardDescription>Everyone on your company profile can manage these settings.</CardDescription></div></div>
                {teamOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
              </div>
            </CardHeader>
            {teamOpen && <CardContent className="border-t border-slate-100 pt-5">
              <div className="mb-4 flex justify-end"><Button onClick={() => setMemberOpen(true)} style={{ backgroundColor: primaryColor }} className="text-white"><Plus className="mr-2 h-4 w-4" />Add Team Member</Button></div>
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

      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add team member</DialogTitle><DialogDescription>A new developer account will receive a temporary password and must set a new password at first sign-in.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label htmlFor="member-name">Name</Label><Input id="member-name" value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Alex Morgan" className="mt-2" /></div>
            <div><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="alex@company.com" className="mt-2" /></div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500"><Mail className="mt-0.5 h-4 w-4 shrink-0" />The invitation includes the company login path and temporary credentials.</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberOpen(false)}>Cancel</Button>
            <Button onClick={() => addMemberMutation.mutate()} disabled={!memberName.trim() || !memberEmail.trim() || addMemberMutation.isPending} style={{ backgroundColor: primaryColor }} className="text-white">
              {addMemberMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
import Footer from "@/components/footer";
import YocAssumptionsPanel, {
  getNationalYocDefaults,
  YOC_ASSUMPTION_KEYS,
  type YocAssumptionsValue,
} from "@/components/yoc-assumptions-panel";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import IndustrialCriteriaFields from "@/components/industrial-criteria-fields";
import StateCriteriaOverrides, { type CriteriaOverrideValue } from "@/components/state-criteria-overrides";
import SharedContactAccessEditor, {
  type ContactCountyOption,
  type ContactFilterOption,
} from "@/components/shared-contact-access-editor";
import {
  DEFAULT_INDUSTRIAL_CRITERIA,
  type DeveloperAssetClass,
  type IndustrialCriteria,
} from "@shared/industrial-criteria";
import { getUsStateLabel, normalizeUsStateCode, US_STATE_OPTIONS } from "@shared/us-states";

type Profile = {
  companyName: string;
  profileType: "real_estate" | "general_sales";
  assetClass: DeveloperAssetClass;
  industrialCriteria: IndustrialCriteria;
  primaryColor: string | null;
  secondaryColor: string | null;
  outreachTestModeEnabled: boolean;
  emailUnsubscribeEnabled: boolean;
  targetStates: string[];
  targetCounties: string[];
  rentMetric: "psf" | "per_unit";
  compSearchRadiusMiles: string;
  productTypes: ProductType[];
  countyMarketLabels: Record<string, string>;
  qctOverridesRentMinimum: boolean;
  ddaOverridesRentMinimum: boolean;
  ozOverridesRentMinimum: boolean;
  crmContactSectors: string[];
  crmContactStates: string[];
  crmContactCounties: string[];
  crmContactProductTypes: string[];
  crmContactSourceTags: string[];
};

type ContactFilterOptions = {
  sourceTags: string[];
  states: ContactFilterOption[];
  counties: ContactCountyOption[];
  sectors: ContactFilterOption[];
};

type ProductType = {
  id?: string;
  name: string;
  minAcres: string;
  maxAcres: string | null;
  minRentPsf: string | null;
  minRentPerUnit: string | null;
  stateOverrides: CriteriaOverrideValue;
  dua: string | null;
  hardCostPu: string | null;
  assumedLandCostPu: string | null;
  assumedLandCostPuCoastal: string | null;
  softCostPct: string | null;
  otherIncomePum: string | null;
  fixedOpExPu: string | null;
  insurancePuNc: string | null;
  insurancePuCoastal: string | null;
  vacancyPct: string | null;
  ltlPct: string | null;
  concessionPct: string | null;
  badDebtPct: string | null;
  mgmtFeePct: string | null;
  rentGrowthPct: string | null;
  otherIncomeGrowthPct: string | null;
  expenseGrowthPct: string | null;
  holdPeriodYears: string | null;
  exitCapRatePct: string | null;
  unitMix: Array<{ pct: number; avgSF: number; monthlyRent: number }> | null;
  isActive: boolean;
};

type TeamMember = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
};

type NotificationSender = {
  id: string;
  name: string;
  email: string;
  outlookConnected: boolean;
  hasMicrosoftToken?: boolean;
  isNotificationSender?: boolean;
  isActive?: boolean;
};

type EffectiveSender = {
  name: string;
  email: string;
  source: "company_outlook" | "platform_fallback";
};

type DeveloperQuickLink = {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
  isActive: boolean;
};

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

function StateMultiSelect({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const selectedCodes = Array.from(new Set(values.map(normalizeUsStateCode).filter(Boolean)));
  return (
    <div>
      <Label>{label}</Label>
      <select
        multiple
        size={6}
        value={selectedCodes}
        onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}
        className="mt-2 min-h-36 w-full rounded-md border border-slate-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        aria-label={label}
      >
        {US_STATE_OPTIONS.map((state) => (
          <option key={state.code} value={state.code}>{state.name}</option>
        ))}
      </select>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {selectedCodes.length > 0 ? selectedCodes.map((code) => (
          <Badge key={code} variant="outline" className="border-catalyst-blue/20 bg-catalyst-blue/10 text-catalyst-navy">
            {getUsStateLabel(code)} ({code})
          </Badge>
        )) : <span className="text-xs text-slate-500">Select one or more states.</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">Use Ctrl/Cmd-click or Shift-click to select multiple states.</p>
    </div>
  );
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
            <Badge key={value} variant="outline" className="gap-1 border-catalyst-blue/20 bg-catalyst-blue/10 text-catalyst-navy">
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
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [overridesOpen, setOverridesOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const [quickLinkLabel, setQuickLinkLabel] = useState("");
  const [quickLinkUrl, setQuickLinkUrl] = useState("");
  const [editingQuickLinkId, setEditingQuickLinkId] = useState<string | null>(null);
  const [quickLinksOpen, setQuickLinksOpen] = useState(false);
  const [assumptionsOpenIndex, setAssumptionsOpenIndex] = useState<number | null>(null);

  const profileQuery = useQuery<{ profile: Profile }>({
    queryKey: ["/api/developer-profile/me"],
    queryFn: () => jsonRequest("/api/developer-profile/me"),
  });
  const sourceTagsQuery = useQuery<ContactFilterOptions>({
    queryKey: ["/api/crm/source-tags"],
    queryFn: () => jsonRequest("/api/crm/source-tags"),
  });
  const teamQuery = useQuery<{ team: TeamMember[] }>({
    queryKey: ["/api/developer-profile/me/team"],
    queryFn: () => jsonRequest("/api/developer-profile/me/team"),
  });
  const senderQuery = useQuery<{
    sender: NotificationSender | null;
    effectiveSender: EffectiveSender;
  }>({
    queryKey: ["/api/developer-profile/me/outreach/sender"],
    queryFn: () => jsonRequest("/api/developer-profile/me/outreach/sender"),
  });
  const senderListQuery = useQuery<{ senders: NotificationSender[] }>({
    queryKey: ["/api/developer-profile/me/outreach/senders"],
    queryFn: () => jsonRequest("/api/developer-profile/me/outreach/senders"),
  });
  const quickLinksQuery = useQuery<{ links: DeveloperQuickLink[] }>({
    queryKey: ["/api/developer/quick-links"],
    queryFn: () => jsonRequest("/api/developer/quick-links"),
  });
  const notificationSenderMutation = useMutation({
    mutationFn: (senderId: string) =>
      jsonRequest("/api/developer-profile/me/outreach/notification-sender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId }),
      }),
    onSuccess: () => {
      toast({ title: "Notification sender updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/outreach/sender"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/outreach/senders"] });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to update notification sender", description: error.message, variant: "destructive" });
    },
  });

  const connectedNotificationSenders = (senderListQuery.data?.senders || []).filter(
    (sender) => sender.outlookConnected && sender.hasMicrosoftToken && sender.isActive !== false,
  );
  const selectedNotificationSender =
    connectedNotificationSenders.find((sender) => sender.isNotificationSender) ||
    connectedNotificationSenders.find((sender) => sender.email === senderQuery.data?.effectiveSender?.email) ||
    connectedNotificationSenders[0];

  useEffect(() => {
    if (profileQuery.data?.profile) {
      const profile = profileQuery.data.profile;
      setForm({
        ...profile,
        assetClass: profile.assetClass || "multifamily",
        industrialCriteria: profile.industrialCriteria || DEFAULT_INDUSTRIAL_CRITERIA,
        targetStates: Array.from(new Set((profile.targetStates || []).map(normalizeUsStateCode).filter(Boolean))),
        targetCounties: profile.targetCounties || [],
        productTypes: (profile.productTypes || []).map((productType) => ({
          ...productType,
          minAcres: productType.minAcres || "",
          maxAcres: productType.maxAcres || "",
          minRentPsf: productType.minRentPsf || "",
          minRentPerUnit: productType.minRentPerUnit || "",
          stateOverrides: productType.stateOverrides || {},
          dua: productType.dua || "",
          hardCostPu: productType.hardCostPu || "",
          assumedLandCostPu: productType.assumedLandCostPu || "",
          assumedLandCostPuCoastal: productType.assumedLandCostPuCoastal || "",
          softCostPct: productType.softCostPct || "",
          otherIncomePum: productType.otherIncomePum || "",
          fixedOpExPu: productType.fixedOpExPu || "",
          insurancePuNc: productType.insurancePuNc || "",
          insurancePuCoastal: productType.insurancePuCoastal || "",
          vacancyPct: productType.vacancyPct || "",
          ltlPct: productType.ltlPct || "",
          concessionPct: productType.concessionPct || "",
          badDebtPct: productType.badDebtPct || "",
          mgmtFeePct: productType.mgmtFeePct || "",
          rentGrowthPct: productType.rentGrowthPct || "",
          otherIncomeGrowthPct: productType.otherIncomeGrowthPct || "",
          expenseGrowthPct: productType.expenseGrowthPct || "",
          holdPeriodYears: productType.holdPeriodYears?.toString() || "",
          exitCapRatePct: productType.exitCapRatePct || "",
          unitMix: productType.unitMix || null,
          isActive: productType.isActive !== false,
        })),
        countyMarketLabels: profile.countyMarketLabels || {},
        crmContactSectors: profile.crmContactSectors || [],
        crmContactStates: profile.crmContactStates || [],
        crmContactCounties: profile.crmContactCounties || [],
        crmContactProductTypes: profile.crmContactProductTypes || [],
        crmContactSourceTags: profile.crmContactSourceTags || [],
        compSearchRadiusMiles: profile.compSearchRadiusMiles || "3",
         emailUnsubscribeEnabled: Boolean(profile.emailUnsubscribeEnabled),
      });
      setAssumptionsOpenIndex(null);
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

  const outreachTestModeMutation = useMutation({
    mutationFn: (enabled: boolean) => jsonRequest("/api/developer-profile/me/outreach/test-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),
    onSuccess: (data: { outreachTestModeEnabled: boolean }) => {
      queryClient.setQueryData(["/api/developer-profile/me"], (current: any) => current
        ? { ...current, profile: { ...current.profile, outreachTestModeEnabled: data.outreachTestModeEnabled } }
        : current);
      setForm((current) => current
        ? { ...current, outreachTestModeEnabled: data.outreachTestModeEnabled }
        : current);
      toast({
        title: data.outreachTestModeEnabled ? "Outreach Test mode enabled" : "Outreach Live mode enabled",
        description: data.outreachTestModeEnabled
          ? "Recurring outreach will be recorded without delivering messages."
          : "Recurring outreach can deliver messages normally.",
      });
    },
    onError: (error: Error) => toast({
      title: "Could not update outreach mode",
      description: error.message,
      variant: "destructive",
    }),
  });

  const emailUnsubscribeMutation = useMutation({
    mutationFn: (enabled: boolean) => jsonRequest("/api/developer-profile/me/outreach/unsubscribe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),
    onSuccess: (data: { emailUnsubscribeEnabled: boolean }) => {
      queryClient.setQueryData(["/api/developer-profile/me"], (current: any) => current
        ? { ...current, profile: { ...current.profile, emailUnsubscribeEnabled: data.emailUnsubscribeEnabled } }
        : current);
      setForm((current) => current
        ? { ...current, emailUnsubscribeEnabled: data.emailUnsubscribeEnabled }
        : current);
      toast({
        title: data.emailUnsubscribeEnabled ? "Unsubscribe links enabled" : "Unsubscribe links disabled",
        description: data.emailUnsubscribeEnabled
          ? "Organization emails will include a one-click unsubscribe link."
          : "Organization emails will no longer include the automatic unsubscribe link.",
      });
    },
    onError: (error: Error) => toast({
      title: "Could not update unsubscribe setting",
      description: error.message,
      variant: "destructive",
    }),
  });

  const testEmailMutation = useMutation({
    mutationFn: (testEmail: string) => jsonRequest("/api/send-test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testEmail }),
    }),
    onSuccess: () => {
      toast({
        title: "Test email sent",
        description: `Check ${testRecipientEmail.trim()} for the current outreach email.`,
      });
    },
    onError: (error: Error) => toast({
      title: "Could not send test email",
      description: error.message,
      variant: "destructive",
    }),
  });

  const quickLinkMutation = useMutation({
    mutationFn: (payload: { id?: string; label: string; url: string }) =>
      jsonRequest(payload.id ? `/api/developer/quick-links/${payload.id}` : "/api/developer/quick-links", {
        method: payload.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: payload.label, url: payload.url }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/quick-links"] });
      setQuickLinkLabel("");
      setQuickLinkUrl("");
      setEditingQuickLinkId(null);
      setQuickLinksOpen(false);
      toast({ title: "Quick link saved" });
    },
    onError: (error: Error) => toast({
      title: "Could not save quick link",
      description: error.message,
      variant: "destructive",
    }),
  });

  const deleteQuickLinkMutation = useMutation({
    mutationFn: (id: string) => jsonRequest(`/api/developer/quick-links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/quick-links"] });
      if (editingQuickLinkId) {
        setQuickLinkLabel("");
        setQuickLinkUrl("");
        setEditingQuickLinkId(null);
        setQuickLinksOpen(false);
      }
      toast({ title: "Quick link deleted" });
    },
    onError: (error: Error) => toast({
      title: "Could not delete quick link",
      description: error.message,
      variant: "destructive",
    }),
  });

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((current) => current ? { ...current, [key]: value } : current);

  const save = () => {
    if (!form) return;
    if (form.profileType === "general_sales") {
      saveMutation.mutate({
        profileType: "general_sales",
        crmContactSectors: form.crmContactSectors,
        crmContactStates: form.crmContactStates,
        crmContactCounties: form.crmContactCounties,
        crmContactProductTypes: form.crmContactProductTypes,
        crmContactSourceTags: form.crmContactSourceTags,
      });
      return;
    }
    if (form.assetClass === "industrial") {
      saveMutation.mutate({
        assetClass: "industrial",
        industrialCriteria: form.industrialCriteria,
        targetStates: form.targetStates,
        targetCounties: form.targetCounties,
        countyMarketLabels: form.countyMarketLabels,
        productTypes: [],
        crmContactSectors: form.crmContactSectors,
        crmContactStates: form.crmContactStates,
        crmContactCounties: form.crmContactCounties,
        crmContactProductTypes: form.crmContactProductTypes,
        crmContactSourceTags: form.crmContactSourceTags,
      });
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
        stateOverrides: productType.stateOverrides || {},
        ...Object.fromEntries(YOC_ASSUMPTION_KEYS.map((key) => [
          key,
          productType[key] === "" || productType[key] === undefined ? null : productType[key],
        ])),
        unitMix: productType.unitMix || null,
      })),
      crmContactSectors: form.crmContactSectors,
      crmContactStates: form.crmContactStates,
      crmContactCounties: form.crmContactCounties,
      crmContactProductTypes: form.crmContactProductTypes,
      crmContactSourceTags: form.crmContactSourceTags,
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
        stateOverrides: {},
        dua: "",
        hardCostPu: "",
        assumedLandCostPu: "",
        assumedLandCostPuCoastal: "",
        softCostPct: "",
        otherIncomePum: "",
        fixedOpExPu: "",
        insurancePuNc: "",
        insurancePuCoastal: "",
        vacancyPct: "",
        ltlPct: "",
        concessionPct: "",
        badDebtPct: "",
        mgmtFeePct: "",
        rentGrowthPct: "",
        otherIncomeGrowthPct: "",
        expenseGrowthPct: "",
        holdPeriodYears: "",
        exitCapRatePct: "",
        unitMix: null,
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
        <Footer />
      </div>
    );
  }
  if (profileQuery.isError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <DeveloperNavigation />
        <div className="mx-auto max-w-3xl px-6 py-16 text-center text-red-600">{(profileQuery.error as Error).message}</div>
        <Footer />
      </div>
    );
  }

  const primaryColor = form.primaryColor || "#0A2B4A";
  const secondaryColor = form.secondaryColor || "#4A90E2";
  const isPsf = form.rentMetric === "psf";

  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title={form.profileType === "general_sales" ? "Company settings" : "Settings"}
          actions={
            <Button onClick={save} disabled={saveMutation.isPending} style={{ backgroundColor: primaryColor }} className="text-white">
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save settings
            </Button>
          }
        />

        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Shared broker contacts</CardTitle>
              <CardDescription>
                LandLinq contacts are shared across Investment Companies. Choose which directory records this company can see. Your CRM tags, notes, assignments, and outreach history remain private.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 border-t border-slate-100 pt-5">
              <SharedContactAccessEditor
                sectors={form.crmContactSectors}
                states={form.crmContactStates}
                counties={form.crmContactCounties}
                sourceTags={form.crmContactSourceTags}
                sectorOptions={sourceTagsQuery.data?.sectors || []}
                stateOptions={sourceTagsQuery.data?.states || []}
                countyOptions={sourceTagsQuery.data?.counties || []}
                sourceTagOptions={sourceTagsQuery.data?.sourceTags || []}
                optionsLoading={sourceTagsQuery.isLoading}
                optionsError={sourceTagsQuery.isError}
                onSectorsChange={(values) => update("crmContactSectors", values)}
                onStatesChange={(values) => update("crmContactStates", values)}
                onCountiesChange={(values) => update("crmContactCounties", values)}
                onSourceTagsChange={(values) => update("crmContactSourceTags", values)}
              />
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2" style={{ backgroundColor: `${secondaryColor}18`, color: primaryColor }}>
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Broker notifications</CardTitle>
                  <CardDescription>
                    Deal received, approved, and rejected messages use your connected Outlook sender.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="border-t border-slate-100 pt-5">
              {senderQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading sender…
                </div>
              ) : senderQuery.isError ? (
                <p className="text-sm text-red-600">Unable to load the broker notification sender.</p>
              ) : senderQuery.data?.effectiveSender?.email ? (
                connectedNotificationSenders.length >= 2 ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="notification-sender-select" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Sender address
                      </Label>
                      <Select
                        value={selectedNotificationSender?.id || ""}
                        onValueChange={(senderId) => notificationSenderMutation.mutate(senderId)}
                        disabled={notificationSenderMutation.isPending || !selectedNotificationSender}
                      >
                        <SelectTrigger id="notification-sender-select" className="mt-1 bg-white">
                          <SelectValue placeholder="Select a connected sender" />
                        </SelectTrigger>
                        <SelectContent>
                          {connectedNotificationSenders.map((sender) => (
                            <SelectItem key={sender.id} value={sender.id}>
                              {sender.name} — {sender.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge variant="secondary" className="w-fit bg-emerald-50 text-emerald-700">
                      Outlook connected
                    </Badge>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sender address</p>
                      <p className="mt-1 font-semibold text-slate-900">{senderQuery.data.effectiveSender.email}</p>
                      <p className="mt-1 text-xs text-slate-500">{senderQuery.data.effectiveSender.name}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={senderQuery.data.effectiveSender.source === "company_outlook"
                        ? "w-fit bg-emerald-50 text-emerald-700"
                        : "w-fit bg-amber-50 text-amber-700"}
                    >
                      {senderQuery.data.effectiveSender.source === "company_outlook" ? "Outlook connected" : "Platform fallback"}
                    </Badge>
                  </div>
                )
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No connected Outlook sender is configured. Connect Outlook in Outreach to enable broker notification delivery from your company mailbox.
                </div>
              )}
              {senderQuery.data?.effectiveSender?.source === "platform_fallback" && (
                <p className="mt-3 text-xs text-amber-700">
                  {senderQuery.data.sender
                    ? "Your company Outlook sender is not connected, so broker notifications currently come from the platform address above."
                    : "No company Outlook sender is configured, so broker notifications currently come from the platform address above."}
                </p>
              )}
              {connectedNotificationSenders.length <= 1 ? (
                <p className="mt-3 text-xs text-slate-500">
                  This is display-only. Manage the connected account from Outreach.
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Choose which connected mailbox sends broker notifications.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2" style={{ backgroundColor: `${secondaryColor}18`, color: primaryColor }}>
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Outreach sending mode</CardTitle>
                  <CardDescription>
                    Test mode runs this company’s recurring outreach without delivering messages. Live mode sends to eligible brokers.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {form.outreachTestModeEnabled ? "Test mode" : "Live mode"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {form.outreachTestModeEnabled
                      ? "Messages are recorded as dry runs and are not delivered."
                      : "Messages may be delivered according to the outreach schedule."}
                  </p>
                </div>
                <Switch
                  checked={Boolean(form.outreachTestModeEnabled)}
                  onCheckedChange={(checked) => outreachTestModeMutation.mutate(checked)}
                  disabled={outreachTestModeMutation.isPending}
                  aria-label="Toggle outreach Test mode"
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
                <div>
                  <p className="font-medium text-slate-900">One-click unsubscribe link</p>
                  <p className="max-w-2xl text-sm text-slate-500">
                    Add an unsubscribe link to every email sent from this company’s connected Outlook senders.
                    Clicking it immediately marks the contact inactive and stops future outreach.
                  </p>
                </div>
                <Switch
                  checked={Boolean(form.emailUnsubscribeEnabled)}
                  onCheckedChange={(checked) => emailUnsubscribeMutation.mutate(checked)}
                  disabled={emailUnsubscribeMutation.isPending}
                  aria-label="Toggle one-click unsubscribe links"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="outreach-test-recipient">Send a live test email</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="outreach-test-recipient"
                    type="email"
                    value={testRecipientEmail}
                    onChange={(event) => setTestRecipientEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="sm:flex-1"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      const recipient = testRecipientEmail.trim();
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
                        toast({ title: "Enter a valid recipient email", variant: "destructive" });
                        return;
                      }
                      testEmailMutation.mutate(recipient);
                    }}
                    disabled={!testRecipientEmail.trim() || testEmailMutation.isPending}
                  >
                    {testEmailMutation.isPending ? "Sending…" : "Send live test email"}
                  </Button>
                </div>
                <p className="text-sm text-slate-500">
                  Sends the company’s current outreach template from its configured outreach sender to this address.
                </p>
              </div>
            </CardContent>
          </Card>

          </div>

          {form.profileType === "real_estate" && form.assetClass === "multifamily" && <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2" style={{ backgroundColor: `${secondaryColor}18`, color: primaryColor }}><Settings2 className="h-5 w-5" /></div>
                <div><CardTitle>Criteria</CardTitle><CardDescription>These rules determine each deal’s profile-specific classification.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                <StateMultiSelect label="Target states" values={form.targetStates} onChange={(value) => update("targetStates", value)} />
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
                      <div key={productType.id || index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                        <div className="mt-4">
                          <StateCriteriaOverrides
                            targetStates={form.targetStates}
                            value={productType.stateOverrides}
                            fields={[
                              { key: "minAcres", label: "Minimum acreage", suffix: "acres" },
                              { key: "maxAcres", label: "Maximum acreage", suffix: "acres" },
                              { key: "minRentPsf", label: "Minimum rent $/SF", suffix: "$/SF" },
                              { key: "minRentPerUnit", label: "Minimum rent $/Unit", suffix: "$/Unit" },
                            ]}
                            onChange={(stateOverrides) => updateProductType(index, { stateOverrides })}
                          />
                        </div>
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAssumptionsOpenIndex((current) => current === index ? null : index)}
                          >
                            <Settings2 className="mr-2 h-4 w-4" />
                            {assumptionsOpenIndex === index ? "Hide underwriting assumptions" : "Underwriting assumptions"}
                            {assumptionsOpenIndex === index
                              ? <ChevronUp className="ml-2 h-4 w-4" />
                              : <ChevronDown className="ml-2 h-4 w-4" />}
                          </Button>
                          {assumptionsOpenIndex === index && (
                            <YocAssumptionsPanel
                              productType={{ id: productType.id, name: productType.name }}
                              nationalDefaults={getNationalYocDefaults(productType.name)}
                              value={productType}
                              onChange={(assumptions: YocAssumptionsValue) => updateProductType(index, assumptions)}
                              otherProductTypes={form.productTypes
                                .filter((_, productIndex) => productIndex !== index)
                                .map((otherProductType) => ({
                                  id: otherProductType.id,
                                  name: otherProductType.name,
                                  value: otherProductType,
                                }))}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>}

          {form.profileType === "real_estate" && form.assetClass === "industrial" && <Card className="rounded-2xl border-amber-200 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-amber-950">Industrial site-screening criteria</CardTitle>
              <CardDescription className="text-amber-900">
                Configure the site requirements used to find and review industrial opportunities. Automated multifamily rent and YOC underwriting is not available for industrial profiles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 border-t border-amber-200 pt-5">
              <IndustrialCriteriaFields
                value={form.industrialCriteria}
                onChange={(value) => update("industrialCriteria", value)}
                 targetStates={form.targetStates}
              />
              <div className="grid gap-5 border-t border-amber-200 pt-5 md:grid-cols-2">
                <StateMultiSelect label="Target states" values={form.targetStates} onChange={(value) => update("targetStates", value)} />
                <CountyMarketEditor
                  values={form.targetCounties}
                  labels={form.countyMarketLabels}
                  onCountiesChange={(value) => update("targetCounties", value)}
                  onLabelsChange={(value) => update("countyMarketLabels", value)}
                />
              </div>
            </CardContent>
          </Card>}

          {form.profileType === "real_estate" && form.assetClass === "multifamily" && <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
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

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-xl p-2" style={{ backgroundColor: `${secondaryColor}18`, color: primaryColor }}>
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Quick Links</CardTitle>
                    <CardDescription>Save the software and resources your team uses most.</CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setEditingQuickLinkId(null);
                    setQuickLinkLabel("");
                    setQuickLinkUrl("");
                    setQuickLinksOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />Add link
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 border-t border-slate-100 pt-5">
              {quickLinksQuery.isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : (quickLinksQuery.data?.links || []).length > 0 ? (
                <div className="space-y-2">
                  {quickLinksQuery.data?.links.map((link) => (
                    <div key={link.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{link.label}</p>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500 hover:underline"
                        >
                          <span className="truncate">{link.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingQuickLinkId(link.id);
                            setQuickLinkLabel(link.label);
                            setQuickLinkUrl(link.url);
                            setQuickLinksOpen(true);
                          }}
                          aria-label={`Edit ${link.label}`}
                        >
                          <Pencil className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteQuickLinkMutation.mutate(link.id)}
                          disabled={deleteQuickLinkMutation.isPending}
                          aria-label={`Delete ${link.label}`}
                        >
                          <Trash2 className="h-4 w-4 text-slate-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">No quick links saved yet.</p>
              )}

              {quickLinksOpen && <div className="border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {editingQuickLinkId ? "Edit link" : "Add link"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingQuickLinkId(null);
                      setQuickLinkLabel("");
                      setQuickLinkUrl("");
                      setQuickLinksOpen(false);
                    }}
                  >
                    Close
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] md:items-end">
                  <div>
                    <Label htmlFor="quick-link-label">Label</Label>
                    <Input
                      id="quick-link-label"
                      value={quickLinkLabel}
                      onChange={(event) => setQuickLinkLabel(event.target.value)}
                      placeholder="e.g. CoStar"
                      className="mt-2 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quick-link-url">URL</Label>
                    <Input
                      id="quick-link-url"
                      type="url"
                      value={quickLinkUrl}
                      onChange={(event) => setQuickLinkUrl(event.target.value)}
                      placeholder="https://example.com"
                      className="mt-2 bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        const label = quickLinkLabel.trim();
                        const url = quickLinkUrl.trim();
                        if (!label || !url) {
                          toast({ title: "Label and URL are required", variant: "destructive" });
                          return;
                        }
                        quickLinkMutation.mutate({
                          id: editingQuickLinkId || undefined,
                          label,
                          url,
                        });
                      }}
                      disabled={quickLinkMutation.isPending}
                      style={{ backgroundColor: primaryColor }}
                      className="text-white"
                    >
                      {quickLinkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save
                    </Button>
                  </div>
                </div>
              </div>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="cursor-pointer" onClick={() => setTeamOpen((open) => !open)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2 text-slate-600"><Users className="h-5 w-5" /></div><div><CardTitle>Team</CardTitle><CardDescription>LandLinq/Apex approves and creates all company accounts.</CardDescription></div></div>
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
                <div className="table-scroll-container">
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

      <Footer />
    </div>
  );
}
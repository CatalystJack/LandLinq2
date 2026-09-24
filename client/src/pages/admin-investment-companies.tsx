import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import YocAssumptionsPanel, {
  createEmptyYocAssumptions,
  getNationalYocDefaults,
  YOC_ASSUMPTION_KEYS,
  type YocAssumptionsValue,
} from "@/components/yoc-assumptions-panel";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Building2, CheckCircle2, ChevronDown, ChevronUp, Edit3, KeyRound, Loader2, LockKeyhole, Mail, MapPin, Plus, RotateCcw, Search, Settings2, Target, Trash2, Upload, Users, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { isPlatformAdminEmail } from "@shared/admin-auth";
import IndustrialCriteriaFields from "@/components/industrial-criteria-fields";
import StateCriteriaOverrides, { type CriteriaOverrideValue } from "@/components/state-criteria-overrides";
import ProductTypeNameField from "@/components/product-type-name-field";
import AdminInvestmentCompanyAssistant from "@/components/admin-investment-company-assistant";
import SharedContactAccessEditor, {
  type ContactCountyOption,
  type ContactFilterOption,
} from "@/components/shared-contact-access-editor";
import {
  DEFAULT_INDUSTRIAL_CRITERIA,
  type DeveloperAssetClass,
  type IndustrialCriteria,
} from "@shared/industrial-criteria";
import type { InvestmentCompanyAssistantDraft } from "@shared/company-profile-assistant";

type ProductType = YocAssumptionsValue & {
  id?: string;
  name: string;
  minAcres: string;
  maxAcres: string | null;
  minRentPsf: string | null;
  minRentPerUnit: string | null;
  stateOverrides: CriteriaOverrideValue;
  isActive: boolean;
};

interface InvestmentCompany {
  id: string;
  companyName: string;
  slug: string;
  profileType: "real_estate" | "general_sales";
  assetClass: DeveloperAssetClass;
  industrialCriteria: IndustrialCriteria;
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
  crmContactSectors: string[];
  crmContactStates: string[];
  crmContactCounties: string[];
  crmContactProductTypes: string[];
  crmContactSourceTags: string[];
  productTypes: ProductType[];
  countyMarketLabels: Record<string, string>;
  isActive: boolean;
  teamMemberCount: number;
}

interface CompanyForm {
  companyName: string;
  slug: string;
  profileType: "real_estate" | "general_sales";
  assetClass: DeveloperAssetClass;
  industrialCriteria: IndustrialCriteria;
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
  crmContactSectors: string[];
  crmContactStates: string[];
  crmContactCounties: string[];
  crmContactProductTypes: string[];
  crmContactSourceTags: string[];
  productTypes: ProductType[];
  countyMarketLabels: Record<string, string>;
  isActive: boolean;
}

type ContactFilterOptions = {
  sourceTags: string[];
  states: ContactFilterOption[];
  counties: ContactCountyOption[];
  sectors: ContactFilterOption[];
};

interface InviteRow {
  id: string;
  name: string;
  email: string;
}

interface InviteResult {
  invited: number;
  failed: Array<{ email: string; reason: string }>;
}

type EntryContact = { id: string; firstName?: string | null; lastName?: string | null; email?: string | null; brokerage?: string | null };
type EntryStage = { id: string; name: string; sortOrder?: number; isActive?: boolean };
type EntryOptions = {
  profile: InvestmentCompany;
  productTypes?: ProductType[];
  contacts?: EntryContact[];
  stages?: EntryStage[];
};

const entryContactName = (contact: EntryContact) => [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "Unnamed contact";
const entryMoney = (value: string) => value === "" ? undefined : Number(value);

function hexColorLuminance(value: string | null | undefined): number | null {
  const normalized = value?.trim().replace(/^#/, "");
  if (!normalized || !/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return null;
  const hex = normalized.length === 3
    ? normalized.split("").map((character) => `${character}${character}`).join("")
    : normalized;
  const [red, green, blue] = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linearize = (channel: number) => channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function darkestBrandColor(primaryColor: string | null | undefined, secondaryColor: string | null | undefined): string {
  const colors = [primaryColor, secondaryColor]
    .filter((color): color is string => Boolean(color && hexColorLuminance(color) !== null));
  if (!colors.length) return "#0A2B4A";
  return colors.reduce((darkest, color) =>
    (hexColorLuminance(color) ?? 1) < (hexColorLuminance(darkest) ?? 1) ? color : darkest,
  );
}

const blankForm: CompanyForm = {
  companyName: "",
  slug: "",
  profileType: "real_estate",
  assetClass: "multifamily",
  industrialCriteria: DEFAULT_INDUSTRIAL_CRITERIA,
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
  crmContactSectors: [],
  crmContactStates: [],
  crmContactCounties: [],
  crmContactProductTypes: [],
  crmContactSourceTags: [],
  productTypes: [{ ...createEmptyYocAssumptions(), name: "", minAcres: "", maxAcres: "", minRentPsf: "", minRentPerUnit: "", stateOverrides: {}, isActive: true }],
  countyMarketLabels: {},
  isActive: true,
};

function slugifyCompanyName(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function companyFormFromAssistantDraft(draft: InvestmentCompanyAssistantDraft): CompanyForm {
  const profileType = draft.profileType || "real_estate";
  const assetClass: DeveloperAssetClass = profileType === "general_sales"
    ? "multifamily"
    : draft.assetClass || "multifamily";
  const industrialDraft = draft.industrialCriteria as Partial<IndustrialCriteria> | undefined;
  const industrialDefault = industrialDraft?.default && typeof industrialDraft.default === "object"
    ? industrialDraft.default
    : {};
  const industrialOverrides = industrialDraft?.stateOverrides && typeof industrialDraft.stateOverrides === "object"
    ? industrialDraft.stateOverrides
    : {};
  const industrialCriteria: IndustrialCriteria = {
    ...DEFAULT_INDUSTRIAL_CRITERIA,
    ...industrialDraft,
    default: { ...DEFAULT_INDUSTRIAL_CRITERIA.default, ...industrialDefault },
    stateOverrides: { ...DEFAULT_INDUSTRIAL_CRITERIA.stateOverrides, ...industrialOverrides },
  };
  const parsedProductTypes = profileType === "real_estate" && assetClass === "multifamily"
    ? (draft.productTypes || []).map((productType) => ({
        ...createEmptyYocAssumptions(),
        name: productType.name || "",
        minAcres: productType.minAcres === null || productType.minAcres === undefined ? "" : String(productType.minAcres),
        maxAcres: productType.maxAcres === null || productType.maxAcres === undefined ? "" : String(productType.maxAcres),
        minRentPsf: productType.minRentPsf === null || productType.minRentPsf === undefined ? "" : String(productType.minRentPsf),
        minRentPerUnit: productType.minRentPerUnit === null || productType.minRentPerUnit === undefined ? "" : String(productType.minRentPerUnit),
        stateOverrides: productType.stateOverrides || {},
        isActive: productType.isActive !== false,
      }))
    : [];
  const productTypes = parsedProductTypes.length
    ? parsedProductTypes
    : profileType === "real_estate" && assetClass === "multifamily"
      ? [{ ...createEmptyYocAssumptions(), name: "", minAcres: "", maxAcres: "", minRentPsf: "", minRentPerUnit: "", stateOverrides: {}, isActive: true }]
      : [];
  const firstActive = productTypes.find((productType) => productType.isActive);
  const companyName = draft.companyName || "";

  return {
    ...blankForm,
    companyName,
    slug: draft.slug || (companyName ? slugifyCompanyName(companyName) : ""),
    profileType,
    assetClass,
    industrialCriteria,
    knownEmailDomains: draft.knownEmailDomains || [],
    rentMetric: draft.rentMetric || "psf",
    minAcres: firstActive?.minAcres || "",
    maxAcres: firstActive?.maxAcres || "",
    minRentPsf: firstActive?.minRentPsf || "",
    minRentPerUnit: firstActive?.minRentPerUnit || "",
    targetStates: draft.targetStates || [],
    targetCounties: draft.targetCounties || [],
    productTypes,
    countyMarketLabels: {},
  };
}

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
  return <div className="space-y-2"><Label>{label}</Label><div className="rounded-md border bg-white p-2"><div className="mb-2 flex flex-wrap gap-1.5">{values.map((value) => <Badge key={value} variant="secondary" className="gap-1">{value}<Button type="button" variant="ghost" size="iconSm" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Remove ${value}`} className="h-4 w-4 text-slate-500">×</Button></Badge>)}</div><Input value={entry} onChange={(event) => setEntry(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); commit(); } }} onBlur={commit} placeholder={placeholder} className="border-0 px-1 shadow-none focus-visible:ring-0" /></div><p className="text-xs text-slate-500">Press Enter or comma after each entry.</p></div>;
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

function ProductTypeEditorRow({
  productType,
  index,
  rentMetric,
  targetStates,
  allProductTypes,
  assumptionsOpen,
  onToggleAssumptions,
  onChange,
  onRemove,
}: {
  productType: ProductType;
  index: number;
  rentMetric: "psf" | "per_unit";
  targetStates: string[];
  allProductTypes: ProductType[];
  assumptionsOpen: boolean;
  onToggleAssumptions: () => void;
  onChange: (patch: Partial<ProductType>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Label>Product type <span className="text-red-500">*</span></Label>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">Normal (default)</span>
          </div>
          <ProductTypeNameField
            id={`admin-product-type-${index}`}
            value={productType.name}
            onChange={(name) => onChange({ name })}
            className="mt-1 bg-white"
          />
        </div>
        <NumberField label="Min acres" value={productType.minAcres} onChange={(value) => onChange({ minAcres: value })} required />
        <NumberField label="Max acres" value={productType.maxAcres || ""} onChange={(value) => onChange({ maxAcres: value })} placeholder="No maximum" />
        <NumberField
          label="Min rent $/SF"
          value={productType.minRentPsf || ""}
          onChange={(value) => onChange({ minRentPsf: value })}
          required={rentMetric === "psf"}
        />
        <NumberField
          label="Min rent $/Unit"
          value={productType.minRentPerUnit || ""}
          onChange={(value) => onChange({ minRentPerUnit: value })}
          required={rentMetric === "per_unit"}
        />
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label={`Remove ${productType.name || "product type"}`}>
          <Trash2 className="h-4 w-4 text-slate-400" />
        </Button>
      </div>
      <div className="mt-4 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onToggleAssumptions}>
          <Settings2 className="mr-2 h-4 w-4" />
          {assumptionsOpen ? "Hide underwriting assumptions" : "Underwriting assumptions"}
          {assumptionsOpen ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
        </Button>
        {assumptionsOpen && (
          <YocAssumptionsPanel
            productType={{ id: productType.id, name: productType.name }}
            nationalDefaults={getNationalYocDefaults(productType.name)}
            value={productType}
            onChange={(assumptions: YocAssumptionsValue) => onChange(assumptions)}
            otherProductTypes={allProductTypes
              .filter((_, productIndex) => productIndex !== index)
              .map((otherProductType) => ({
                id: otherProductType.id,
                name: otherProductType.name,
                value: otherProductType,
              }))}
          />
        )}
        <div className="mt-4">
          <StateCriteriaOverrides
            targetStates={targetStates}
            value={productType.stateOverrides}
            fields={[
              { key: "minAcres", label: "Minimum acreage", suffix: "acres" },
              { key: "maxAcres", label: "Maximum acreage", suffix: "acres" },
              { key: "minRentPsf", label: "Minimum rent $/SF", suffix: "$/SF" },
              { key: "minRentPerUnit", label: "Minimum rent $/Unit", suffix: "$/Unit" },
            ]}
            onChange={(stateOverrides) => onChange({ stateOverrides })}
          />
        </div>
      </div>
    </div>
  );
}

function ManualEntryDialog({ company, open, onOpenChange }: { company: InvestmentCompany | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"deal" | "opportunity">("deal");
  const [contactSearch, setContactSearch] = useState("");
  const [form, setForm] = useState({ address: "", city: "", state: "", county: "", sizeAcres: "", productTypeId: "", rent: "", askingPrice: "", qctDesignation: false, ddaDesignation: false, opportunityZone: false, contactId: "", stageId: "", title: "", value: "", notes: "" });
  const [result, setResult] = useState<{ classification?: string; send?: boolean; matchedProductTypes?: string[] } | null>(null);
  const optionsQuery = useQuery<EntryOptions>({
    queryKey: ["/api/admin/investment-companies", company?.id, "entry-options"],
    queryFn: () => requestJson(`/api/admin/investment-companies/${company?.id}/entry-options`),
    enabled: open && Boolean(company?.id),
  });
  const options = optionsQuery.data;
  const isRealEstate = company?.profileType === "real_estate";
  const isIndustrial = company?.assetClass === "industrial";
  const products = (options?.productTypes || company?.productTypes || []).filter((product) => product.isActive !== false);
  const stages = (options?.stages || []).filter((stage) => stage.isActive !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const contacts = options?.contacts || [];
  const filteredContacts = useMemo(() => {
    const needle = contactSearch.trim().toLowerCase();
    return !needle ? contacts : contacts.filter((contact) => `${entryContactName(contact)} ${contact.email || ""} ${contact.brokerage || ""}`.toLowerCase().includes(needle));
  }, [contacts, contactSearch]);
  const update = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => {
    setForm({ address: "", city: "", state: "", county: "", sizeAcres: "", productTypeId: products[0]?.id || "", rent: "", askingPrice: "", qctDesignation: false, ddaDesignation: false, opportunityZone: false, contactId: "", stageId: stages[0]?.id || "", title: "", value: "", notes: "" });
    setContactSearch("");
    setResult(null);
  };
  useEffect(() => { if (open && company) { setMode(company.profileType === "real_estate" ? "deal" : "opportunity"); reset(); } }, [open, company?.id, options?.productTypes, options?.stages]);
  const entryMutation = useMutation({
    mutationFn: () => {
      if (!company) throw new Error("Company is required");
      if (isRealEstate) return requestJson(`/api/admin/investment-companies/${company.id}/deals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: form.address.trim(), city: form.city.trim(), state: form.state.trim(), county: form.county.trim(), sizeAcres: entryMoney(form.sizeAcres), productTypeId: form.productTypeId, rent: entryMoney(form.rent), askingPrice: entryMoney(form.askingPrice), qctDesignation: form.qctDesignation, ddaDesignation: form.ddaDesignation, opportunityZone: form.opportunityZone }) });
      return requestJson(`/api/admin/investment-companies/${company.id}/pipeline/opportunities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: form.contactId, stageId: form.stageId, title: form.title.trim(), value: entryMoney(form.value), notes: form.notes.trim() }) });
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/investment-companies"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
      if (isRealEstate) setResult({ classification: data.classification || data.deal?.classification, send: data.send, matchedProductTypes: data.matchedProductTypes });
      else { toast({ title: "Opportunity created", description: "The opportunity is now in the company pipeline." }); onOpenChange(false); }
    },
    onError: (error: Error) => toast({ title: isRealEstate ? "Could not add deal" : "Could not create opportunity", description: error.message, variant: "destructive" }),
  });
  const submit = () => {
    if (isRealEstate) {
      if (!form.address.trim() || !form.city.trim() || !form.state.trim() || !form.county.trim() || !form.sizeAcres || (!isIndustrial && (!form.productTypeId || !form.rent))) {
        toast({
          title: "Complete the required deal fields",
          description: isIndustrial ? "Address, location, and acreage are required." : "Address, location, acreage, product type, and rent are required.",
          variant: "destructive",
        });
        return;
      }
      if (Number(form.sizeAcres) < 0 || (!isIndustrial && Number(form.rent) < 0)) { toast({ title: "Enter valid deal values", variant: "destructive" }); return; }
    } else if (!form.contactId || !form.stageId || !form.title.trim()) { toast({ title: "Contact, stage, and title are required", variant: "destructive" }); return; }
    entryMutation.mutate();
  };
  const isRed = isIndustrial && result?.classification?.toLowerCase() === "red";
  const isYellow = isIndustrial && !isRed;
  const isReview = (isIndustrial && result?.classification?.toLowerCase() === "yellow")
    || (!isIndustrial && (result?.classification?.toLowerCase() === "green" || result?.classification?.toLowerCase() === "review"));
  const resultLabel = isIndustrial ? (isRed ? "Passed" : "Review") : (isReview ? "Review" : "Passed");
  return <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle className="text-[#0A2B4A]">Add {company?.profileType === "general_sales" ? "pipeline opportunity" : "deal / opportunity"}</DialogTitle><DialogDescription>Enter a record directly into {company?.companyName}. Company-specific rules and stages are applied on submission.</DialogDescription></DialogHeader>
      {!company ? null : result ? <div className="space-y-5 py-4">
         <div className={`rounded-xl border p-5 ${isRed ? "border-red-200 bg-red-50" : isYellow ? "border-amber-200 bg-amber-50" : isReview ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="flex items-start gap-3">{isRed ? <AlertCircle className="mt-0.5 h-6 w-6 text-red-600" /> : isReview ? <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-6 w-6 text-amber-600" />}<div><p className={`text-lg font-semibold ${isRed ? "text-red-900" : isReview ? "text-emerald-900" : "text-amber-900"}`}>{resultLabel}</p><p className="mt-1 text-sm text-slate-700">{isIndustrial ? (isRed ? "This industrial site passed the current automated screen." : "This industrial site is saved for manual review.") : isReview ? "This deal met the company’s current criteria and is ready for review." : "This deal did not match the company’s current criteria, but was saved successfully."}</p></div></div></div>
        {result.matchedProductTypes?.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matched product types</p><p className="mt-2 text-sm font-medium text-slate-800">{result.matchedProductTypes.join(", ")}</p></div> : null}
         <DialogFooter><Button className="border border-catalyst-blue bg-[#0A2B4A] text-white hover:bg-white hover:text-catalyst-blue" onClick={() => { reset(); onOpenChange(false); }}>Done</Button></DialogFooter>
       </div> : optionsQuery.isLoading ? <div className="flex justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-catalyst-blue" /></div> : optionsQuery.isError ? <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">Entry options could not be loaded. Close this dialog and try again.</div> : <div className="space-y-5 py-2">
        {mode === "deal" ? <><div className="flex items-center gap-2 border-b border-slate-100 pb-3"><MapPin className="h-4 w-4 text-[#4A90E2]" /><p className="text-sm font-semibold text-[#0A2B4A]">Property details</p><span className="ml-auto text-xs text-slate-500">Required fields marked *</span></div><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label>Address *</Label><Input className="mt-1" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Street address" /></div><div><Label>City *</Label><Input className="mt-1" value={form.city} onChange={(e) => update("city", e.target.value)} /></div><div><Label>State *</Label><Input className="mt-1" value={form.state} onChange={(e) => update("state", e.target.value)} placeholder="NC" /></div><div><Label>County *</Label><Input className="mt-1" value={form.county} onChange={(e) => update("county", e.target.value)} /></div><div><Label>Size (acres) *</Label><Input className="mt-1" type="number" min="0" step="0.01" value={form.sizeAcres} onChange={(e) => update("sizeAcres", e.target.value)} /></div><div><Label>Product type *</Label><Select value={form.productTypeId} onValueChange={(value) => update("productTypeId", value)}><SelectTrigger className="mt-1"><SelectValue placeholder="Choose product type" /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.id || product.name} value={product.id || product.name}>{product.name}</SelectItem>)}</SelectContent></Select></div><div><Label>{company.rentMetric === "per_unit" ? "Rent / unit *" : "Rent / SF *"}</Label><Input className="mt-1" type="number" min="0" step="0.01" value={form.rent} onChange={(e) => update("rent", e.target.value)} placeholder={company.rentMetric === "per_unit" ? "Monthly average" : "Monthly average"}/></div><div><Label>Asking price</Label><Input className="mt-1" type="number" min="0" step="0.01" value={form.askingPrice} onChange={(e) => update("askingPrice", e.target.value)} /></div></div><div className="grid gap-2 sm:grid-cols-3">{[["qctDesignation", "QCT designation"], ["ddaDesignation", "DDA designation"], ["opportunityZone", "Opportunity Zone"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(form[key as keyof typeof form])} onChange={(e) => update(key, e.target.checked)} className="h-4 w-4 accent-[#4A90E2]" />{label}</label>)}</div></> : <><div className="flex items-center gap-2 border-b border-slate-100 pb-3"><Target className="h-4 w-4 text-[#4A90E2]" /><p className="text-sm font-semibold text-[#0A2B4A]">Pipeline details</p></div><div><Label>Contact *</Label><div className="relative mt-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search by name, email, or brokerage" /></div><Select value={form.contactId} onValueChange={(value) => update("contactId", value)}><SelectTrigger className="mt-2"><SelectValue placeholder={contacts.length ? "Choose a contact" : "No contacts available"} /></SelectTrigger><SelectContent>{filteredContacts.slice(0, 100).map((contact) => <SelectItem key={contact.id} value={contact.id}>{entryContactName(contact)}{contact.email ? ` — ${contact.email}` : ""}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Title *</Label><Input className="mt-1" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Opportunity title" /></div><div><Label>Stage *</Label><Select value={form.stageId} onValueChange={(value) => update("stageId", value)}><SelectTrigger className="mt-1"><SelectValue placeholder="Choose a stage" /></SelectTrigger><SelectContent>{stages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>)}</SelectContent></Select></div></div><div><Label>Value</Label><Input className="mt-1" type="number" min="0" step="0.01" value={form.value} onChange={(e) => update("value", e.target.value)} /></div><div><Label>Notes</Label><Textarea className="mt-1 min-h-24" value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Add useful context for the team" /></div></>}
      </div>}
        {!result && !optionsQuery.isLoading && !optionsQuery.isError && <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={entryMutation.isPending || (mode === "deal" ? (!isIndustrial && !products.length) : !stages.length)} className="border border-catalyst-blue bg-[#0A2B4A] text-white hover:bg-white hover:text-catalyst-blue">{entryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === "deal" ? "Submit deal" : "Create opportunity"}</Button></DialogFooter>}
    </DialogContent>
  </Dialog>;
}

export default function AdminInvestmentCompanies() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const email = String((user as any)?.claims?.email || (user as any)?.email || "").toLowerCase();
  const isPlatformAdmin = isAuthenticated && isPlatformAdminEmail(email);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentCompany | null>(null);
  const [form, setForm] = useState<CompanyForm>(blankForm);
  const pendingAssistantDraftRef = useRef<CompanyForm | null>(null);
  const [loginCompany, setLoginCompany] = useState<InvestmentCompany | null>(null);
  const [deactivatingCompany, setDeactivatingCompany] = useState<InvestmentCompany | null>(null);
  const [deactivationConfirmation, setDeactivationConfirmation] = useState("");
  const [permanentlyDeletingCompany, setPermanentlyDeletingCompany] = useState<InvestmentCompany | null>(null);
  const [permanentDeletionConfirmation, setPermanentDeletionConfirmation] = useState("");
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([]);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [entryCompany, setEntryCompany] = useState<InvestmentCompany | null>(null);
  const [assumptionsOpenIndex, setAssumptionsOpenIndex] = useState<number | null>(null);

  const companiesQuery = useQuery<{ profiles: InvestmentCompany[] }>({
    queryKey: ["/api/admin/investment-companies"],
    queryFn: () => requestJson("/api/admin/investment-companies"),
    enabled: isPlatformAdmin,
  });
  const sourceTagsQuery = useQuery<ContactFilterOptions>({
    queryKey: ["/api/crm/source-tags"],
    queryFn: () => requestJson("/api/crm/source-tags"),
    enabled: isPlatformAdmin,
  });

  useEffect(() => {
    if (!formOpen) return;
    setForm(editing ? {
      companyName: editing.companyName,
      slug: editing.slug,
      profileType: editing.profileType || "real_estate",
      assetClass: editing.assetClass || "multifamily",
      industrialCriteria: editing.industrialCriteria || DEFAULT_INDUSTRIAL_CRITERIA,
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
      crmContactSectors: editing.crmContactSectors || [],
      crmContactStates: editing.crmContactStates || [],
      crmContactCounties: editing.crmContactCounties || [],
      crmContactProductTypes: editing.crmContactProductTypes || [],
      crmContactSourceTags: editing.crmContactSourceTags || [],
      productTypes: (editing.productTypes?.length ? editing.productTypes : [{
        ...createEmptyYocAssumptions(),
        name: "General",
        minAcres: editing.minAcres || "",
        maxAcres: editing.maxAcres || "",
        minRentPsf: editing.minRentPsf || "",
        minRentPerUnit: editing.minRentPerUnit || "",
         stateOverrides: {},
        isActive: true,
      }]).map((productType) => ({
        ...createEmptyYocAssumptions(),
        ...productType,
        minAcres: productType.minAcres || "",
        maxAcres: productType.maxAcres || "",
        minRentPsf: productType.minRentPsf || "",
        minRentPerUnit: productType.minRentPerUnit || "",
        stateOverrides: productType.stateOverrides || {},
        ...Object.fromEntries(YOC_ASSUMPTION_KEYS.map((key) => [
          key,
          productType[key] === undefined ? null : productType[key],
        ])),
        unitMix: productType.unitMix || null,
        isActive: productType.isActive !== false,
      })),
      countyMarketLabels: editing.countyMarketLabels || {},
      isActive: editing.isActive,
    } : pendingAssistantDraftRef.current || {
      ...blankForm,
      knownEmailDomains: [],
      targetStates: [],
      targetCounties: [],
      crmContactSectors: [],
      crmContactStates: [],
      crmContactCounties: [],
      crmContactProductTypes: [],
      crmContactSourceTags: [],
       productTypes: [{ ...createEmptyYocAssumptions(), name: "", minAcres: "", maxAcres: "", minRentPsf: "", minRentPerUnit: "", stateOverrides: {}, isActive: true }],
      countyMarketLabels: {},
    });
    pendingAssistantDraftRef.current = null;
    setAssumptionsOpenIndex(null);
  }, [editing, formOpen]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const isGeneralSales = form.profileType === "general_sales";
      const isIndustrial = form.assetClass === "industrial";
      const activeProductTypes = form.productTypes.filter((productType) => productType.isActive);
      const firstActive = activeProductTypes[0];
      if (!isGeneralSales && !isIndustrial) {
        if (!firstActive) throw new Error("At least one active product type is required");
        for (let index = 0; index < form.productTypes.length; index++) {
          const productType = form.productTypes[index];
          if (!productType.name.trim()) throw new Error(`Product type ${index + 1} needs a name`);
          if (productType.minAcres === "" || Number(productType.minAcres) < 0) throw new Error(`${productType.name}: minimum acreage is required`);
          if (productType.maxAcres && Number(productType.maxAcres) < Number(productType.minAcres)) throw new Error(`${productType.name}: maximum acreage must be at least the minimum`);
          const rent = form.rentMetric === "psf" ? productType.minRentPsf : productType.minRentPerUnit;
          if (productType.isActive && (!rent || Number(rent) <= 0)) throw new Error(`${productType.name}: minimum ${form.rentMetric === "psf" ? "$/SF" : "$/Unit"} is required`);
        }
      }
      return requestJson(editing ? `/api/admin/investment-companies/${editing.id}` : "/api/admin/investment-companies", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          profileType: form.profileType,
          assetClass: form.assetClass,
          industrialCriteria: form.industrialCriteria,
          logoUrl: form.logoUrl || null,
          minAcres: isGeneralSales || isIndustrial ? "0" : firstActive?.minAcres,
          maxAcres: isGeneralSales || isIndustrial ? null : firstActive?.maxAcres || null,
          minRentPsf: isGeneralSales || isIndustrial ? null : firstActive?.minRentPsf || null,
          minRentPerUnit: isGeneralSales || isIndustrial ? null : firstActive?.minRentPerUnit || null,
          targetStates: isGeneralSales ? [] : form.targetStates,
          targetCounties: isGeneralSales ? [] : form.targetCounties,
          productTypes: isGeneralSales || isIndustrial ? [] : form.productTypes.map(({ id: _id, ...productType }) => ({
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

  const companyStatusMutation = useMutation({
    mutationFn: ({ profile, isActive }: { profile: InvestmentCompany; isActive: boolean }) =>
      requestJson(`/api/admin/investment-companies/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (_result, { profile, isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/investment-companies"] });
      setDeactivatingCompany(null);
      setDeactivationConfirmation("");
      toast({
        title: isActive ? `${profile.companyName} reactivated` : `${profile.companyName} deactivated`,
        description: isActive
          ? "Company team members can sign in again."
          : "All company logins are blocked. Existing records have been preserved.",
      });
    },
    onError: (error: Error) => toast({ title: "Could not update company access", description: error.message, variant: "destructive" }),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (profile: InvestmentCompany) => requestJson(`/api/admin/investment-companies/${profile.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: permanentDeletionConfirmation }),
    }),
    onSuccess: (_result, profile) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/investment-companies"] });
      setPermanentlyDeletingCompany(null);
      setPermanentDeletionConfirmation("");
      toast({
        title: `${profile.companyName} permanently deleted`,
        description: "Canonical deals and shared CRM records were preserved.",
      });
    },
    onError: (error: Error) => toast({ title: "Could not permanently delete company", description: error.message, variant: "destructive" }),
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
     update("productTypes", [...form.productTypes, { ...createEmptyYocAssumptions(), name: "", minAcres: "", maxAcres: "", minRentPsf: "", minRentPerUnit: "", stateOverrides: {}, isActive: true }]);
  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (profile: InvestmentCompany) => { setEditing(profile); setFormOpen(true); };
  const openAssistantDraft = (draft: InvestmentCompanyAssistantDraft) => {
    const initialForm = companyFormFromAssistantDraft(draft);
    if (formOpen && !editing) {
      setForm(initialForm);
      return;
    }
    pendingAssistantDraftRef.current = initialForm;
    setEditing(null);
    setFormOpen(true);
  };
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

  if (!isPlatformAdmin) return <div className="min-h-screen bg-warm"><Navigation /><div className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center"><LockKeyhole className="mb-4 h-12 w-12 text-slate-300" /><h1 className="font-serif text-3xl font-bold text-slate-900">Platform administrators only</h1><p className="mt-2 text-slate-500">This page is restricted to authenticated platform administrator accounts.</p></div></div>;

  return <div className="min-h-screen bg-warm">
    <Navigation />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
       <PageHeader
         eyebrow="Platform administration"
         title="Development Partners"
         description="Create Investment Company portals, configure acquisition criteria, and invite partner contacts by email."
         actions={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Create New Development Partner</Button>}
       />
      <AdminInvestmentCompanyAssistant onUseDraft={openAssistantDraft} />
      {companiesQuery.isLoading ? <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#4A90E2]" /></div> : companiesQuery.isError ? <Card><CardContent className="py-12 text-center text-red-600">Unable to load Investment Company profiles.</CardContent></Card> : !sortedProfiles.length ? <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center"><Building2 className="mb-4 h-12 w-12 text-slate-300" /><h2 className="text-xl font-semibold text-[#0A2B4A]">No Investment Companies yet</h2><p className="mt-2 max-w-md text-slate-500">Create the first profile when your team is ready. No company records are created automatically.</p><Button className="mt-6" onClick={openCreate} style={{ backgroundColor: "#0A2B4A" }}><Plus className="mr-2 h-4 w-4" />Create profile</Button></CardContent></Card> :
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{sortedProfiles.map((profile) => { const activeProductTypeCount = (profile.productTypes || []).filter((productType) => productType.isActive).length; const isGeneralSales = profile.profileType === "general_sales"; const logoBackground = darkestBrandColor(profile.primaryColor, profile.secondaryColor); return <Card key={profile.id} className={`overflow-hidden ${profile.isActive ? "" : "opacity-75"}`}><div className="h-2" style={{ background: `linear-gradient(90deg, ${profile.primaryColor || "#0A2B4A"}, ${profile.secondaryColor || "#4A90E2"})` }} /><CardHeader><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3">{profile.logoUrl ? <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border p-1" style={{ backgroundColor: logoBackground }}><img src={profile.logoUrl} alt="" className="h-full w-full object-contain" /></div> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border" style={{ backgroundColor: logoBackground }}><Building2 className="h-6 w-6 text-white" /></div>}<div className="min-w-0"><CardTitle className="truncate">{profile.companyName}</CardTitle><p className="truncate text-sm text-slate-500">/developer/{profile.slug}/login</p><Badge variant="outline" className="mt-2">{isGeneralSales ? "General Sales" : "Real Estate"}</Badge></div></div><Badge variant={profile.isActive ? "default" : "secondary"}>{profile.isActive ? "Active" : "Inactive"}</Badge></div></CardHeader><CardContent><div className="mb-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Team members</p><p className="mt-1 flex items-center gap-1 font-semibold"><Users className="h-4 w-4" />{profile.teamMemberCount}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">{isGeneralSales ? "Capabilities" : "Product types"}</p><p className="mt-1 font-semibold">{isGeneralSales ? "CRM & Outreach" : `${activeProductTypeCount} active ${activeProductTypeCount === 1 ? "type" : "types"}`}</p></div></div><div className="mb-2"><Button disabled={!profile.isActive} onClick={() => setEntryCompany(profile)} className="w-full border border-[#4A90E2] bg-[#0A2B4A] text-white hover:bg-white hover:text-[#4A90E2]"><Plus className="mr-2 h-4 w-4" />Add {isGeneralSales ? "Opportunity" : "Deal / Opportunity"}</Button></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => openEdit(profile)}><Edit3 className="mr-2 h-4 w-4" />Manage</Button>{profile.isActive ? <><Button className="flex-1" onClick={() => openInvite(profile)}><KeyRound className="mr-2 h-4 w-4" />Initial Login</Button><Button variant="outline" size="icon" className="shrink-0 border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700" onClick={() => { setDeactivatingCompany(profile); setDeactivationConfirmation(""); }} aria-label={`Deactivate ${profile.companyName}`} title="Deactivate company"><Trash2 className="h-4 w-4" /></Button></> : <><Button className="flex-1" onClick={() => companyStatusMutation.mutate({ profile, isActive: true })} disabled={companyStatusMutation.isPending}><RotateCcw className="mr-2 h-4 w-4" />Reactivate</Button><Button variant="outline" className="border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700" onClick={() => { setPermanentlyDeletingCompany(profile); setPermanentDeletionConfirmation(""); }}><Trash2 className="mr-2 h-4 w-4" />Delete permanently</Button></>}</div></CardContent></Card>; })}</div>}
    </main>

     <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? `Manage ${editing.companyName}` : "Create New Development Partner"}</DialogTitle><DialogDescription>Set up an Investment Company portal with branding, acquisition criteria, targeting, and portal availability.</DialogDescription></DialogHeader>
        <div className="space-y-7 py-2">
          <section><h3 className="mb-3 font-semibold">Profile type</h3><div className="grid min-w-0 gap-3 sm:grid-cols-2"><Button type="button" variant="outline" onClick={() => !editing && update("profileType", "real_estate")} className={`h-auto min-w-0 items-start justify-start whitespace-normal rounded-lg border p-4 text-left transition ${form.profileType === "real_estate" ? "border-[#4A90E2] bg-blue-50" : "border-slate-200 bg-white"} ${editing ? "cursor-default opacity-80" : "hover:border-slate-300"}`}><div className="min-w-0"><p className="break-words font-semibold text-slate-900">Real Estate Investment Company</p><p className="mt-1 break-words text-sm text-slate-500">Deal Dashboard, acquisition criteria, CRM, Outreach, and Analytics.</p></div></Button><Button type="button" variant="outline" onClick={() => !editing && update("profileType", "general_sales")} className={`h-auto min-w-0 items-start justify-start whitespace-normal rounded-lg border p-4 text-left transition ${form.profileType === "general_sales" ? "border-[#4A90E2] bg-blue-50" : "border-slate-200 bg-white"} ${editing ? "cursor-default opacity-80" : "hover:border-slate-300"}`}><div className="min-w-0"><p className="break-words font-semibold text-slate-900">General Sales</p><p className="mt-1 break-words text-sm text-slate-500">CRM, Outreach, Analytics, and team access without deal criteria.</p></div></Button></div>{editing && <p className="mt-2 text-xs text-slate-500">Profile type is set when the profile is created.</p>}</section>
         <section><h3 className="mb-3 font-semibold">Company and branding</h3><div className="grid gap-4 sm:grid-cols-2"><div><Label>Company name</Label><Input value={form.companyName} onChange={(e) => { update("companyName", e.target.value); if (!editing) update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></div><div><Label>Login slug</Label><Input value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase())} placeholder="company-name" /></div><div><Label>Primary color</Label><div className="flex gap-2"><Input type="color" value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="w-14 p-1" /><Input value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} /></div></div><div><Label>Secondary color</Label><div className="flex gap-2"><Input type="color" value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} className="w-14 p-1" /><Input value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} /></div></div><div className="sm:col-span-2"><Label>Company logo</Label><div className="mt-1 flex items-center gap-3 rounded-lg border p-3">{form.logoUrl ? <img src={form.logoUrl} alt="Logo preview" className="h-14 w-20 object-contain" /> : <Building2 className="h-10 w-10 text-slate-300" />}<label className="cursor-pointer"><Input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => e.target.files?.[0] && logoMutation.mutate(e.target.files[0])} /><span className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium"><Upload className="mr-2 h-4 w-4" />{logoMutation.isPending ? "Uploading…" : "Upload logo"}</span></label>{form.logoUrl && <Button variant="ghost" size="sm" onClick={() => update("logoUrl", "")}>Remove</Button>}</div><p className="mt-1 text-xs text-slate-500">PNG, JPG, or WebP. Maximum 5 MB.</p></div></div></section>
          {form.profileType === "real_estate" && <section><h3 className="mb-3 font-semibold">Asset class</h3><div className="grid min-w-0 gap-3 sm:grid-cols-2"><Button type="button" variant="outline" onClick={() => update("assetClass", "multifamily")} className={`h-auto min-w-0 items-start justify-start whitespace-normal rounded-lg border p-4 text-left ${form.assetClass === "multifamily" ? "border-[#4A90E2] bg-blue-50" : "border-slate-200 bg-white"}`}><div className="min-w-0"><p className="break-words font-semibold text-slate-900">Multifamily</p><p className="mt-1 break-words text-sm text-slate-500">Rent, product type, and automated YOC criteria.</p></div></Button><Button type="button" variant="outline" onClick={() => update("assetClass", "industrial")} className={`h-auto min-w-0 items-start justify-start whitespace-normal rounded-lg border p-4 text-left ${form.assetClass === "industrial" ? "border-[#4A90E2] bg-blue-50" : "border-slate-200 bg-white"}`}><div className="min-w-0"><p className="break-words font-semibold text-slate-900">Industrial</p><p className="mt-1 break-words text-sm text-slate-500">Site-screening criteria only. No automated YOC.</p></div></Button></div></section>}
         {form.profileType === "real_estate" && form.assetClass === "multifamily" && <><section><h3 className="mb-3 font-semibold">Acquisition criteria</h3><div className="max-w-sm"><Label>Primary rent metric</Label><Select value={form.rentMetric} onValueChange={(value: "psf" | "per_unit") => update("rentMetric", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="psf">Rent per square foot</SelectItem><SelectItem value="per_unit">Rent per unit</SelectItem></SelectContent></Select></div></section>
           <section>
             <div className="mb-3 flex items-center justify-between gap-3">
               <div><h3 className="font-semibold">Product types</h3><p className="text-sm text-slate-500">Define acreage and {form.rentMetric === "psf" ? "$/SF" : "$/Unit"} thresholds for each active product type.</p></div>
               <Button type="button" variant="outline" size="sm" onClick={addProductType}><Plus className="mr-1 h-4 w-4" />Add product type</Button>
             </div>
             {form.productTypes.length === 0 ? (
               <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Add at least one active product type before saving.</div>
             ) : (
               <div className="space-y-3">
                 {form.productTypes.map((productType, index) => (
                   <ProductTypeEditorRow
                     key={productType.id || index}
                     productType={productType}
                     index={index}
                     rentMetric={form.rentMetric}
                      targetStates={form.targetStates}
                     allProductTypes={form.productTypes}
                     assumptionsOpen={assumptionsOpenIndex === index}
                     onToggleAssumptions={() => setAssumptionsOpenIndex((current) => current === index ? null : index)}
                     onChange={(patch) => updateProductType(index, patch)}
                     onRemove={() => update("productTypes", form.productTypes.filter((_, productIndex) => productIndex !== index))}
                   />
                 ))}
               </div>
             )}
           </section>
         <section><h3 className="mb-3 font-semibold">Affordable housing overrides</h3><div className="grid gap-3 sm:grid-cols-3"><ToggleRow label="QCT override" description="QCT status may override the rent minimum." checked={form.qctOverridesRentMinimum} onChange={(value) => update("qctOverridesRentMinimum", value)} /><ToggleRow label="DDA override" description="DDA status may override the rent minimum." checked={form.ddaOverridesRentMinimum} onChange={(value) => update("ddaOverridesRentMinimum", value)} /><ToggleRow label="OZ override" description="Opportunity Zone status may override rent." checked={form.ozOverridesRentMinimum} onChange={(value) => update("ozOverridesRentMinimum", value)} /></div></section>
         <section><h3 className="mb-3 font-semibold">Markets and identity</h3><div className="grid gap-4 sm:grid-cols-2"><TagsField label="Target states" values={form.targetStates} onChange={(values) => update("targetStates", values)} placeholder="NC, SC, GA" /><CountyMarketEditor values={form.targetCounties} labels={form.countyMarketLabels} onCountiesChange={(values) => update("targetCounties", values)} onLabelsChange={(labels) => update("countyMarketLabels", labels)} /><div className="sm:col-span-2"><TagsField label="Known email domains" values={form.knownEmailDomains} onChange={(values) => update("knownEmailDomains", values.map((value) => value.toLowerCase().replace(/^@/, "")))} placeholder="company.com" /></div></div></section></>}
          {form.profileType === "real_estate" && form.assetClass === "industrial" && <><section className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">Industrial site-screening criteria</h3><p className="mt-1 text-sm text-amber-900">These values drive the initial site search and manual review queue. Automated multifamily YOC and rent underwriting are intentionally disabled for this company.</p><div className="mt-5"><IndustrialCriteriaFields value={form.industrialCriteria} onChange={(value) => update("industrialCriteria", value)} targetStates={form.targetStates} compact /></div></section><section><h3 className="mb-3 font-semibold">Markets and identity</h3><div className="grid gap-4 sm:grid-cols-2"><TagsField label="Target states" values={form.targetStates} onChange={(values) => update("targetStates", values)} placeholder="NC, SC, GA" /><CountyMarketEditor values={form.targetCounties} labels={form.countyMarketLabels} onCountiesChange={(values) => update("targetCounties", values)} onLabelsChange={(labels) => update("countyMarketLabels", labels)} /><div className="sm:col-span-2"><TagsField label="Known email domains" values={form.knownEmailDomains} onChange={(values) => update("knownEmailDomains", values.map((value) => value.toLowerCase().replace(/^@/, "")))} placeholder="company.com" /></div></div></section></>}
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">Shared broker contact access</h3>
            <p className="mt-1 text-sm text-slate-600">Choose which shared LandLinq contacts this company can see.</p>
            <div className="mt-4">
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
            </div>
          </section>
         {form.profileType === "general_sales" && <section className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><p className="font-semibold">General Sales profile</p><p className="mt-1">This profile has no Deal Dashboard, acquisition criteria, geographic targeting, product types, or affordable housing overrides. Team members will use CRM, Outreach, Analytics, and Settings.</p></section>}
        <section className="grid gap-3 sm:grid-cols-2"><ToggleRow label="Internal company" description="Marks this as a LandLinq/Catalyst internal profile." checked={form.isInternal} onChange={(value) => update("isInternal", value)} /><ToggleRow label="Profile active" description="Allows assigned users to enter the company portal." checked={form.isActive} onChange={(value) => update("isActive", value)} /></section>
       </div><DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || logoMutation.isPending}>{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save changes" : "Create Development Partner"}</Button></DialogFooter>
    </DialogContent></Dialog>

      <Dialog open={!!loginCompany} onOpenChange={(open) => !open && closeInvite()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Invite Development Partner Contact</DialogTitle><DialogDescription>Invite one or more team members to the {loginCompany?.companyName} portal. Each person will receive a temporary password and branded login link.</DialogDescription></DialogHeader><div className="space-y-4 py-3">{inviteResult && <div className={`rounded-lg border p-3 text-sm ${inviteResult.failed.length ? "border-amber-200 bg-amber-50 text-amber-950" : "border-green-200 bg-green-50 text-green-900"}`}><p className="font-semibold">{inviteResult.invited} invitation{inviteResult.invited === 1 ? "" : "s"} sent</p>{inviteResult.failed.length > 0 && <div className="mt-2 space-y-1"><p className="font-medium">{inviteResult.failed.length} failed:</p>{inviteResult.failed.map((failure, index) => <p key={`${failure.email}-${index}`} className="text-xs"><span className="font-medium">{failure.email || "Blank email"}:</span> {failure.reason}</p>)}</div>}</div>}<div className="space-y-3">{inviteRows.map((row, index) => <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><div><Label>Name</Label><Input value={row.name} onChange={(e) => updateInviteRow(row.id, "name", e.target.value)} placeholder="First and last name" /></div><div><Label>Email</Label><Input type="email" value={row.email} onChange={(e) => updateInviteRow(row.id, "email", e.target.value)} placeholder="contact@company.com" /></div>{index > 0 ? <Button type="button" variant="ghost" size="icon" className="mb-0.5" onClick={() => removeInviteRow(row.id)} aria-label="Remove team member"><X className="h-4 w-4" /></Button> : <div className="w-10" />}</div>)}</div><Button type="button" variant="outline" onClick={addInviteRow}><Plus className="mr-2 h-4 w-4" />Add another team member</Button><div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><p>Each account will be assigned the DEVELOPER role and must choose a new password at first sign-in.</p></div></div><DialogFooter><Button variant="outline" onClick={closeInvite}>{inviteResult ? "Done" : "Cancel"}</Button><Button onClick={submitInvites} disabled={loginMutation.isPending || !inviteRows.some((row) => row.name.trim() || row.email.trim())}>{loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{inviteResult?.failed.length ? "Retry failed invitations" : "Create account and send invitation"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!deactivatingCompany} onOpenChange={(open) => { if (!open && !companyStatusMutation.isPending) { setDeactivatingCompany(null); setDeactivationConfirmation(""); } }}><DialogContent><DialogHeader><DialogTitle>Deactivate {deactivatingCompany?.companyName}?</DialogTitle><DialogDescription>This immediately blocks every team member from signing in. CRM contacts, Pipeline opportunities, deals, campaigns, analytics, settings, and account history will be preserved. You can reactivate the company later.</DialogDescription></DialogHeader><div className="space-y-2 py-3"><Label htmlFor="deactivate-company-confirmation">Type <span className="font-semibold text-slate-900">{deactivatingCompany?.companyName}</span> to confirm</Label><Input id="deactivate-company-confirmation" value={deactivationConfirmation} onChange={(event) => setDeactivationConfirmation(event.target.value)} autoComplete="off" /></div><DialogFooter><Button variant="outline" onClick={() => { setDeactivatingCompany(null); setDeactivationConfirmation(""); }} disabled={companyStatusMutation.isPending}>Cancel</Button><Button variant="destructive" onClick={() => deactivatingCompany && companyStatusMutation.mutate({ profile: deactivatingCompany, isActive: false })} disabled={!deactivatingCompany || deactivationConfirmation !== deactivatingCompany.companyName || companyStatusMutation.isPending}>{companyStatusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Deactivate company</Button></DialogFooter></DialogContent></Dialog>
       <Dialog open={!!permanentlyDeletingCompany} onOpenChange={(open) => { if (!open && !permanentDeleteMutation.isPending) { setPermanentlyDeletingCompany(null); setPermanentDeletionConfirmation(""); } }}><DialogContent><DialogHeader><DialogTitle>Permanently delete {permanentlyDeletingCompany?.companyName}?</DialogTitle><DialogDescription>This cannot be undone. The company profile, logins, tenant routing, campaigns, pipeline records, and settings will be removed. Canonical deals, shared contacts, and comparable cache records will be preserved.</DialogDescription></DialogHeader><div className="space-y-2 py-3"><Label htmlFor="permanent-delete-company-confirmation">Type <span className="font-semibold text-slate-900">{permanentlyDeletingCompany?.companyName}</span> to confirm</Label><Input id="permanent-delete-company-confirmation" value={permanentDeletionConfirmation} onChange={(event) => setPermanentDeletionConfirmation(event.target.value)} autoComplete="off" /></div><DialogFooter><Button variant="outline" onClick={() => { setPermanentlyDeletingCompany(null); setPermanentDeletionConfirmation(""); }} disabled={permanentDeleteMutation.isPending}>Cancel</Button><Button variant="destructive" onClick={() => permanentlyDeletingCompany && permanentDeleteMutation.mutate(permanentlyDeletingCompany)} disabled={!permanentlyDeletingCompany || permanentDeletionConfirmation !== permanentlyDeletingCompany.companyName || permanentDeleteMutation.isPending}>{permanentDeleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete permanently</Button></DialogFooter></DialogContent></Dialog>
       <ManualEntryDialog company={entryCompany} open={Boolean(entryCompany)} onOpenChange={(open) => { if (!open) setEntryCompany(null); }} />
  </div>;
}
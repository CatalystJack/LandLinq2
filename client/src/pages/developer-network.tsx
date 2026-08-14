import { useState } from "react";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, MapPin, Phone, Mail, User, Briefcase,
  DollarSign, Ruler, Zap, TrendingUp, CheckCircle,
  Users, ChevronDown, ChevronUp, Home, Warehouse,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const SE_STATES = ["AL","AR","FL","GA","KY","LA","MS","NC","SC","TN","TX","VA","WV"];
const PRODUCT_TYPES_LIST = [
  "Conventional 3-Story Walk-Up",
  "Conventional 4-Story Mid-Rise",
  "Attainable / Workforce Housing",
  "Active Adult 3-Story Flats (55+)",
  "Active Adult 4-Story Flats (55+)",
  "Active Adult Cottages (55+)",
  "BTR Townhomes",
  "BTR Single-Family Detached",
];

const formSchema = z.object({
  companyName: z.string().min(2, "Company name required"),
  contactName: z.string().min(2, "Contact name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  dealPreference: z.string().min(1, "Select a deal type preference"),
  targetStates: z.array(z.string()).min(1, "Select at least one state"),
  targetMsas: z.array(z.string()).optional(),
  targetCounties: z.array(z.string()).optional(),
  qctInterest: z.boolean().optional(),
  productTypes: z.array(z.string()).optional(),
  minAcres: z.string().optional(),
  maxAcres: z.string().optional(),
  minUnits: z.string().optional(),
  maxUnits: z.string().optional(),
  maxAskingPricePerAcre: z.string().optional(),
  minRentPsf: z.string().optional(),
  minRentPerUnit: z.string().optional(),
  minVintageYear: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4 pb-3 border-b border-gray-100">
      <div className="w-8 h-8 rounded-lg bg-catalyst-navy/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-catalyst-navy text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-catalyst-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function DeveloperNetworkPage() {
  const { toast } = useToast();
  const [expandedStates, setExpandedStates] = useState<string[]>([]);

  const { data: msaData } = useQuery<{ success: boolean; msasByState: Record<string, string[]>; countiesByMsa: Record<string, string[]> }>({
    queryKey: ["/api/public/msas-by-state"],
  });
  const msasByState = msaData?.msasByState || {};
  const countiesByMsa = msaData?.countiesByMsa || {};

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "", contactName: "", email: "", phone: "",
      dealPreference: "",
      targetStates: [], targetMsas: [], targetCounties: [],
      qctInterest: false,
      productTypes: [],
      minAcres: "", maxAcres: "", minUnits: "", maxUnits: "",
      maxAskingPricePerAcre: "", minRentPsf: "", minRentPerUnit: "",
      minVintageYear: "", notes: "",
    },
  });

  const watchedStates = form.watch("targetStates");
  const watchedMsas = form.watch("targetMsas") || [];
  const watchedCounties = form.watch("targetCounties") || [];
  const watchedDealPref = form.watch("dealPreference");

  const toggleState = (state: string) => {
    const current = form.getValues("targetStates");
    const isSelected = current.includes(state);
    const next = isSelected ? current.filter(s => s !== state) : [...current, state];
    form.setValue("targetStates", next, { shouldValidate: true });
    if (isSelected) {
      // Cascade-remove MSAs and counties for deselected state
      const stateMsas = msasByState[state] || [];
      const currentMsas = form.getValues("targetMsas") || [];
      const remainingMsas = currentMsas.filter(m => !stateMsas.includes(m));
      form.setValue("targetMsas", remainingMsas);
      const removedMsaCounties = stateMsas.flatMap(m => countiesByMsa[m] || []);
      const currentCounties = form.getValues("targetCounties") || [];
      form.setValue("targetCounties", currentCounties.filter(c => !removedMsaCounties.includes(c)));
      setExpandedStates(prev => prev.filter(s => s !== state));
    } else {
      setExpandedStates(prev => prev.includes(state) ? prev : [...prev, state]);
    }
  };

  const toggleMsa = (msa: string) => {
    const currentMsas = form.getValues("targetMsas") || [];
    const currentCounties = form.getValues("targetCounties") || [];
    const msaCounties = countiesByMsa[msa] || [];
    if (currentMsas.includes(msa)) {
      form.setValue("targetMsas", currentMsas.filter(m => m !== msa));
      form.setValue("targetCounties", currentCounties.filter(c => !msaCounties.includes(c)));
    } else {
      form.setValue("targetMsas", [...currentMsas, msa]);
      form.setValue("targetCounties", Array.from(new Set([...currentCounties, ...msaCounties])));
    }
  };

  const toggleCounty = (county: string) => {
    const current = form.getValues("targetCounties") || [];
    form.setValue("targetCounties", current.includes(county)
      ? current.filter(c => c !== county)
      : [...current, county]);
  };

  const toggleStateExpand = (state: string) => {
    setExpandedStates(prev =>
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiRequest("POST", "/api/partner-developers", {
        ...data,
        minAcres: data.minAcres || undefined,
        maxAcres: data.maxAcres || undefined,
        minUnits: data.minUnits ? parseInt(data.minUnits) : undefined,
        maxUnits: data.maxUnits ? parseInt(data.maxUnits) : undefined,
        maxAskingPricePerAcre: data.maxAskingPricePerAcre || undefined,
        minRentPsf: data.minRentPsf || undefined,
        minRentPerUnit: data.minRentPerUnit || undefined,
        minVintageYear: data.minVintageYear ? parseInt(data.minVintageYear) : undefined,
        targetMsas: data.targetMsas?.length ? data.targetMsas : undefined,
        targetCounties: data.targetCounties?.length ? data.targetCounties : undefined,
      }),
    onSuccess: () => {
      toast({ title: "Registration received!", description: "We'll reach out when a deal matches your criteria." });
      form.reset();
      setExpandedStates([]);
    },
    onError: (err: any) => {
      const msg = err?.message || "Please try again.";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = form.handleSubmit(
    (data) => mutation.mutate(data),
    (errors) => {
      // Build a human-readable list of what's missing
      const missing: string[] = [];
      if (errors.companyName) missing.push("Company Name");
      if (errors.contactName) missing.push("Contact Name");
      if (errors.email) missing.push("Email");
      if (errors.dealPreference) missing.push("Deal Type Preference");
      if (errors.targetStates) missing.push("Target States");
      if (errors.productTypes) missing.push("Product Types");

      toast({
        title: "Please complete required fields",
        description: missing.length
          ? `Missing: ${missing.join(", ")}`
          : "Check the form for errors above.",
        variant: "destructive",
      });

      // Scroll to the first visible error
      setTimeout(() => {
        const firstError = document.querySelector("[data-error='true'], .text-red-500");
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    }
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navigation />

      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
            Register Your Buy Box
          </h1>
          <p className="text-xl sm:text-2xl text-gray-200 leading-relaxed max-w-3xl mx-auto">
            Tell us what you're looking for and we'll send matching opportunities directly to you.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 bg-catalyst-gray-50 border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: <Briefcase className="w-5 h-5 text-catalyst-navy" />, title: "Define Your Criteria", desc: "Set your target markets, product types, size, and financial thresholds." },
              { icon: <Zap className="w-5 h-5 text-catalyst-navy" />, title: "We Match Automatically", desc: "Our AI classification engine flags deals that fit your box in real time." },
              { icon: <TrendingUp className="w-5 h-5 text-catalyst-navy" />, title: "Get First Look", desc: "Receive broker-sourced, pre-screened deals across the Southeast before they hit the open market." },
            ].map(item => (
              <div key={item.title} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-catalyst-navy/10 flex items-center justify-center mb-3">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-catalyst-navy text-sm mb-1.5">{item.title}</h3>
                <p className="text-xs text-catalyst-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 flex-1">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            {mutation.isSuccess ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-catalyst-navy mb-3">You're in the network!</h2>
                <p className="text-catalyst-gray-600 max-w-sm leading-relaxed mb-6">
                  We've saved your criteria. When a deal matches your buy box, our acquisitions team will reach out directly.
                </p>
                <Button variant="outline" onClick={() => { mutation.reset(); form.reset(); setExpandedStates([]); }}>
                  Register Another Company
                </Button>
              </div>
            ) : (
              <Card className="shadow-lg border border-gray-100">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-catalyst-navy mb-1">Acquisition Criteria Form</h2>
                  <p className="text-sm text-catalyst-gray-600 mb-8">Fields marked * are required. Takes about 3 minutes.</p>

                  <form onSubmit={handleSubmit} className="space-y-8">

                    {/* ── SECTION 1: Company Info ── */}
                    <div className="space-y-4">
                      <SectionHeader
                        icon={<Briefcase className="w-4 h-4 text-catalyst-navy" />}
                        title="Company & Contact"
                        subtitle="Who we'll reach out to when a deal matches"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> Company Name *
                          </Label>
                          <Input {...form.register("companyName")} placeholder="Acme Development LLC" />
                          {form.formState.errors.companyName && (
                            <p className="text-red-500 text-xs">{form.formState.errors.companyName.message}</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide flex items-center gap-1">
                            <User className="w-3 h-3" /> Contact Name *
                          </Label>
                          <Input {...form.register("contactName")} placeholder="Jane Smith" />
                          {form.formState.errors.contactName && (
                            <p className="text-red-500 text-xs">{form.formState.errors.contactName.message}</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Email *
                          </Label>
                          <Input {...form.register("email")} type="email" placeholder="jane@acme.com" />
                          {form.formState.errors.email && (
                            <p className="text-red-500 text-xs">{form.formState.errors.email.message}</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide flex items-center gap-1">
                            <Phone className="w-3 h-3" /> Phone
                          </Label>
                          <Input {...form.register("phone")} placeholder="(704) 555-0100" />
                        </div>
                      </div>
                    </div>

                    {/* ── SECTION 2: Deal Scope ── */}
                    <div className="space-y-3">
                      <SectionHeader
                        icon={<Home className="w-4 h-4 text-catalyst-navy" />}
                        title="Deal Type Preference *"
                        subtitle="Are you looking for land/development opportunities, value-add acquisitions, or both?"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { value: "land", label: "Land / Development", desc: "Raw or entitled land for new construction" },
                          { value: "acquisition", label: "Value-Add Acquisition", desc: "Existing multifamily properties" },
                          { value: "both", label: "Both", desc: "Open to either deal type" },
                        ].map(opt => {
                          const selected = watchedDealPref === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => form.setValue("dealPreference", opt.value, { shouldValidate: true })}
                              className={`p-4 rounded-xl border-2 text-left transition-all ${
                                selected
                                  ? "border-catalyst-navy bg-catalyst-navy/5"
                                  : "border-gray-200 hover:border-catalyst-navy/40"
                              }`}
                            >
                              <div className={`text-sm font-semibold mb-1 ${selected ? "text-catalyst-navy" : "text-gray-700"}`}>
                                {opt.label}
                              </div>
                              <div className="text-xs text-gray-500 leading-relaxed">{opt.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                      {form.formState.errors.dealPreference && (
                        <p className="text-red-500 text-xs">{form.formState.errors.dealPreference.message}</p>
                      )}
                    </div>

                    {/* ── SECTION 3: Target Markets ── */}
                    <div className="space-y-4">
                      <SectionHeader
                        icon={<MapPin className="w-4 h-4 text-catalyst-navy" />}
                        title="Target Markets *"
                        subtitle="Select states, then choose specific MSAs — or leave MSAs blank for any market in that state"
                      />

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">States *</Label>
                        <div className="flex flex-wrap gap-2">
                          {SE_STATES.map(state => {
                            const selected = watchedStates.includes(state);
                            const stateMsas = msasByState[state] || [];
                            const selectedMsaCount = watchedMsas.filter(m => stateMsas.includes(m)).length;
                            return (
                              <button
                                key={state}
                                type="button"
                                onClick={() => toggleState(state)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                  selected
                                    ? "bg-catalyst-navy text-white border-catalyst-navy"
                                    : "bg-white text-catalyst-gray-600 border-catalyst-gray-200 hover:border-catalyst-navy hover:text-catalyst-navy"
                                }`}
                              >
                                {state}
                                {selected && selectedMsaCount > 0 && (
                                  <span className="ml-1 bg-white/20 rounded-full px-1">{selectedMsaCount}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {form.formState.errors.targetStates && (
                          <p className="text-red-500 text-xs">{form.formState.errors.targetStates.message}</p>
                        )}
                      </div>

                      {/* MSA sub-selector — only shown for selected states */}
                      {watchedStates.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">
                            Specific MSAs <span className="text-gray-400 font-normal normal-case">(optional — select all that apply)</span>
                          </Label>
                          <div className="space-y-2">
                            {watchedStates.map(state => {
                              const stateMsas = msasByState[state] || [];
                              const isExpanded = expandedStates.includes(state);
                              const selectedInState = watchedMsas.filter(m => stateMsas.includes(m));

                              return (
                                <div key={state} className="border border-gray-200 rounded-xl overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => toggleStateExpand(state)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-catalyst-navy">{state}</span>
                                      {selectedInState.length > 0 && (
                                        <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-catalyst-navy/10 text-catalyst-navy">
                                          {selectedInState.length} selected
                                        </Badge>
                                      )}
                                      {stateMsas.length === 0 && (
                                        <span className="text-[10px] text-gray-400">No specific MSAs loaded — all markets in {state}</span>
                                      )}
                                    </div>
                                    {stateMsas.length > 0 && (
                                      isExpanded
                                        ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    )}
                                  </button>
                                  {isExpanded && stateMsas.length > 0 && (
                                    <div className="bg-white">
                                      {/* MSA chips */}
                                      <div className="px-4 py-3 flex flex-wrap gap-2">
                                        {stateMsas.map(msa => {
                                          const isMsaSelected = watchedMsas.includes(msa);
                                          return (
                                            <button
                                              key={msa}
                                              type="button"
                                              onClick={() => toggleMsa(msa)}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                                isMsaSelected
                                                  ? "bg-catalyst-navy text-white border-catalyst-navy"
                                                  : "bg-white text-gray-600 border-gray-200 hover:border-catalyst-navy/50 hover:text-catalyst-navy"
                                              }`}
                                            >
                                              {msa}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {/* County chips — shown for each selected MSA that has counties */}
                                      {stateMsas.filter(msa => watchedMsas.includes(msa) && (countiesByMsa[msa] || []).length > 0).map(msa => {
                                        const msaCounties = countiesByMsa[msa] || [];
                                        return (
                                          <div key={msa} className="px-4 pb-3 border-t border-gray-100 pt-2">
                                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                                              {msa} — Counties
                                              <span className="ml-2 text-gray-400 font-normal normal-case">click to include/exclude</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              {msaCounties.map(county => {
                                                const countySelected = watchedCounties.includes(county);
                                                return (
                                                  <button
                                                    key={county}
                                                    type="button"
                                                    onClick={() => toggleCounty(county)}
                                                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                                                      countySelected
                                                        ? "bg-blue-50 text-blue-700 border-blue-300 hover:bg-red-50 hover:text-red-500 hover:border-red-300"
                                                        : "bg-white text-gray-400 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                                                    }`}
                                                  >
                                                    {county} Co.
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* QCT interest */}
                      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <input
                          type="checkbox"
                          id="qctInterest"
                          {...form.register("qctInterest")}
                          className="mt-0.5 w-4 h-4 rounded border-amber-400 text-amber-600 cursor-pointer"
                        />
                        <label htmlFor="qctInterest" className="text-xs leading-relaxed text-amber-900 cursor-pointer">
                          <span className="font-semibold">Open to QCT/Affordable deals</span>
                          <span className="text-amber-700"> — I'm interested in Qualified Census Tract or affordable housing opportunities, even outside my primary MSA targets</span>
                        </label>
                      </div>
                    </div>

                    {/* ── SECTION 4: Product Types ── */}
                    <div className="space-y-3">
                      <SectionHeader
                        icon={<Building2 className="w-4 h-4 text-catalyst-navy" />}
                        title="Product Types"
                        subtitle="Select all product types you actively pursue"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {PRODUCT_TYPES_LIST.map(pt => {
                          const selected = form.watch("productTypes").includes(pt);
                          return (
                            <button
                              key={pt}
                              type="button"
                              onClick={() => {
                                const current = form.getValues("productTypes");
                                form.setValue(
                                  "productTypes",
                                  selected ? current.filter(p => p !== pt) : [...current, pt],
                                  { shouldValidate: true }
                                );
                              }}
                              className={`px-3 py-3 rounded-xl text-xs font-semibold border-2 transition-all text-left ${
                                selected
                                  ? "bg-catalyst-navy text-white border-catalyst-navy"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-catalyst-navy/50 hover:text-catalyst-navy"
                              }`}
                            >
                              {pt}
                            </button>
                          );
                        })}
                      </div>
                      {form.formState.errors.productTypes && (
                        <p className="text-red-500 text-xs">{form.formState.errors.productTypes.message}</p>
                      )}
                    </div>

                    {/* ── SECTION 5: Size Requirements ── */}
                    <div className="space-y-4">
                      <SectionHeader
                        icon={<Ruler className="w-4 h-4 text-catalyst-navy" />}
                        title="Size Requirements"
                        subtitle="Min/max acreage and unit count — leave blank for no restriction"
                      />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">Min Acres</Label>
                          <Input {...form.register("minAcres")} type="number" min="0" step="0.5" placeholder="e.g. 4" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">Max Acres</Label>
                          <Input {...form.register("maxAcres")} type="number" min="0" step="0.5" placeholder="e.g. 50" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">Min Units</Label>
                          <Input {...form.register("minUnits")} type="number" min="0" placeholder="e.g. 100" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">Max Units</Label>
                          <Input {...form.register("maxUnits")} type="number" min="0" placeholder="e.g. 400" />
                        </div>
                      </div>
                    </div>

                    {/* ── SECTION 6: Financial & Market Criteria ── */}
                    <div className="space-y-4">
                      <SectionHeader
                        icon={<DollarSign className="w-4 h-4 text-catalyst-navy" />}
                        title="Financial & Market Criteria"
                        subtitle="Set your price ceiling and minimum rent comp thresholds"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">Max $/Acre</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <Input {...form.register("maxAskingPricePerAcre")} type="number" min="0" placeholder="150,000" className="pl-6" />
                          </div>
                          <p className="text-[10px] text-gray-400">Maximum land asking price per acre</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">Min Rent PSF</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <Input {...form.register("minRentPsf")} type="number" min="0" step="0.01" placeholder="1.75" className="pl-6" />
                          </div>
                          <p className="text-[10px] text-gray-400">Min market rent $/SF within 3-mile radius</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">Min Rent / Unit</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <Input {...form.register("minRentPerUnit")} type="number" min="0" placeholder="2,000" className="pl-6" />
                          </div>
                          <p className="text-[10px] text-gray-400">Min monthly rent/unit (BTR/lot comps)</p>
                        </div>
                      </div>
                    </div>

                    {/* ── SECTION 7: Acquisition-Specific ── */}
                    {(watchedDealPref === "acquisition" || watchedDealPref === "both") && (
                      <div className="space-y-4">
                        <SectionHeader
                          icon={<Warehouse className="w-4 h-4 text-catalyst-navy" />}
                          title="Acquisition-Specific Criteria"
                          subtitle="For value-add acquisition deals — minimum acceptable vintage year"
                        />
                        <div className="space-y-1.5 max-w-[200px]">
                          <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">Min Year Built</Label>
                          <Input
                            {...form.register("minVintageYear")}
                            type="number"
                            min="1950"
                            max="2024"
                            placeholder="e.g. 2000"
                          />
                          <p className="text-[10px] text-gray-400">We auto-reject acquisitions built before 2000</p>
                        </div>
                      </div>
                    )}

                    {/* ── SECTION 8: Notes ── */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-catalyst-gray-700 uppercase tracking-wide">
                        Additional Notes
                      </Label>
                      <Textarea
                        {...form.register("notes")}
                        placeholder="Specific submarkets, zoning preferences, deal structures, equity requirements, etc."
                        className="resize-none h-24"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-9 text-sm font-semibold"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? "Submitting..." : "Register My Buy Box"}
                    </Button>

                    <p className="text-xs text-center text-catalyst-gray-500">
                      This is a referral network only. We retain no fee for routing leads.
                      Standard broker commission arrangements between buyer and listing broker apply.
                    </p>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

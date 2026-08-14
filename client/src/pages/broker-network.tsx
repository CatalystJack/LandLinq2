import { useState } from "react";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle, MapPin, Handshake, TrendingUp, FileText,
  Mail, Phone, User, Building2, Lock, ChevronDown, ChevronUp, BarChart2
} from "lucide-react";

const SE_STATES = ["AL","AR","FL","GA","KY","LA","MS","NC","SC","TN","TX","VA","WV"];
const ALL_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const formSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  brokerage: z.string().optional(),
  targetStates: z.array(z.string()).min(1, "Select at least one state"),
  targetMsas: z.array(z.string()).optional(),
  targetCounties: z.array(z.string()).optional(),
});
type FormValues = z.infer<typeof formSchema>;

const BENEFITS = [
  {
    icon: <BarChart2 className="w-5 h-5 text-[#0d2d4e]" />,
    title: "Full Underwriting Model",
    desc: "Access our complete underwriting model for every deal, including yield-on-cost analysis, rent comps, and pro-forma projections.",
  },
  {
    icon: <FileText className="w-5 h-5 text-[#0d2d4e]" />,
    title: "Investment Memo",
    desc: "Receive a polished investment memo for every deal in your markets, summarizing financials, site details, and key metrics.",
  },
  {
    icon: <TrendingUp className="w-5 h-5 text-[#0d2d4e]" />,
    title: "First Look at Deals",
    desc: "Get notified the moment a qualifying deal hits our pipeline.",
  },
  {
    icon: <Handshake className="w-5 h-5 text-[#0d2d4e]" />,
    title: "Direct Relationship",
    desc: "Work directly with our team, not through layers of intermediaries.",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Register Below", desc: "Tell us your markets and contact info. Your account is reviewed within 24 hours." },
  { step: "02", title: "Get Approved", desc: "Once approved you'll receive login credentials for the LandLinq Broker Portal." },
  { step: "03", title: "View & Download", desc: "Browse deals in your markets and download full underwritings instantly." },
];

export default function BrokerNetworkPage() {
  const [submitted, setSubmitted] = useState(false);
  const [expandedStates, setExpandedStates] = useState<string[]>([]);
  const [showAllStates, setShowAllStates] = useState(false);

  const { data: msaData } = useQuery<{ success: boolean; msasByState: Record<string, string[]>; countiesByMsa: Record<string, string[]> }>({
    queryKey: ["/api/public/msas-by-state"],
  });
  const msasByState = msaData?.msasByState || {};
  const countiesByMsa = msaData?.countiesByMsa || {};

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", password: "",
      phone: "", brokerage: "",
      targetStates: [], targetMsas: [], targetCounties: [],
    },
  });

  const watchedStates = form.watch("targetStates");
  const watchedMsas = form.watch("targetMsas") || [];
  const watchedCounties = form.watch("targetCounties") || [];

  const toggleState = (state: string) => {
    const current = form.getValues("targetStates");
    const isSelected = current.includes(state);
    const next = isSelected ? current.filter(s => s !== state) : [...current, state];
    form.setValue("targetStates", next, { shouldValidate: true });
    if (isSelected) {
      const stateMsas = msasByState[state] || [];
      const currentMsas = form.getValues("targetMsas") || [];
      form.setValue("targetMsas", currentMsas.filter(m => !stateMsas.includes(m)));
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
      apiRequest("POST", "/api/broker-portal/register", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
        brokerage: data.brokerage || undefined,
        targetStates: data.targetStates,
        targetMsas: data.targetMsas?.length ? data.targetMsas : [],
        targetCounties: data.targetCounties?.length ? data.targetCounties : [],
      }),
    onSuccess: () => setSubmitted(true),
  });

  const displayedStates = showAllStates ? ALL_STATES : SE_STATES;

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center py-24 px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#0d2d4e] mb-3">Application Received!</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Thanks for applying to the LandLinq Partner Broker Program. Our team will review your application and send your portal access within 24 hours.
            </p>
            <p className="text-sm text-gray-400">
              Questions? Email us at{" "}
              <a href="mailto:deals@landlinq.com" className="text-[#0d2d4e] font-medium hover:underline">
                deals@landlinq.com
              </a>
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navigation />

      {/* Hero */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#C5A028]/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5 tracking-tight leading-tight">
            Partner With LandLinq
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
            Get first access to off-market land deals in your markets, with full underwritings and direct support from our acquisitions team.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 bg-gray-50 border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {BENEFITS.map(b => (
              <div key={b.title} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <div className="w-9 h-9 rounded-lg bg-[#0d2d4e]/5 flex items-center justify-center mb-3">
                  {b.icon}
                </div>
                <h3 className="font-semibold text-[#0d2d4e] text-sm mb-1.5">{b.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-8">
            <h2 className="text-2xl font-bold text-[#0d2d4e] mb-2">How It Works</h2>
            <p className="text-sm text-gray-500">Simple, fast, and no commitments required.</p>
          </div>
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map(s => (
              <div key={s.step} className="text-center">
                <div className="text-4xl font-black text-[#0d2d4e]/10 mb-2">{s.step}</div>
                <h3 className="font-semibold text-[#0d2d4e] text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration form */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-[#0d2d4e] mb-2">Apply to Join</h2>
              <p className="text-sm text-gray-500">Your application is reviewed within 24 hours.</p>
            </div>

            <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-7">

              {/* Contact info */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-lg bg-[#0d2d4e]/8 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-[#0d2d4e]" />
                  </div>
                  <h3 className="font-semibold text-[#0d2d4e] text-sm">Contact Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Name *</label>
                    <Input {...form.register("firstName")} placeholder="Jane" className="h-10" />
                    {form.formState.errors.firstName && (
                      <p className="text-xs text-red-500 mt-1">{form.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Name *</label>
                    <Input {...form.register("lastName")} placeholder="Smith" className="h-10" />
                    {form.formState.errors.lastName && (
                      <p className="text-xs text-red-500 mt-1">{form.formState.errors.lastName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email *</label>
                    <Input {...form.register("email")} type="email" placeholder="jane@realty.com" className="h-10" />
                    {form.formState.errors.email && (
                      <p className="text-xs text-red-500 mt-1">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone</label>
                    <Input {...form.register("phone")} type="tel" placeholder="(555) 000-0000" className="h-10" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Brokerage / Company</label>
                    <Input {...form.register("brokerage")} placeholder="e.g. CBRE, Marcus & Millichap, Independent" className="h-10" />
                  </div>
                </div>
              </div>

              {/* Portal credentials */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-lg bg-[#0d2d4e]/8 flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5 text-[#0d2d4e]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0d2d4e] text-sm">Portal Password</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">You'll use this to log into the broker portal once approved.</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Choose a Password *</label>
                  <Input {...form.register("password")} type="password" placeholder="Min 8 characters" className="h-10" />
                  {form.formState.errors.password && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.password.message}</p>
                  )}
                </div>
              </div>

              {/* Target markets */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-lg bg-[#0d2d4e]/8 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-[#0d2d4e]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0d2d4e] text-sm">Target Markets *</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Select the states where you actively work deals.</p>
                  </div>
                </div>

                {/* States */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">States</p>
                  <div className="flex flex-wrap gap-1.5">
                    {displayedStates.map(state => {
                      const selected = watchedStates.includes(state);
                      const stateMsas = msasByState[state] || [];
                      const isExpanded = expandedStates.includes(state);
                      return (
                        <div key={state} className="inline-flex flex-col">
                          <button
                            type="button"
                            onClick={() => toggleState(state)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                              selected
                                ? "bg-[#0d2d4e] text-white border-[#0d2d4e]"
                                : "bg-white text-gray-600 border-gray-200 hover:border-[#0d2d4e]/50 hover:text-[#0d2d4e]"
                            }`}
                          >
                            {state}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAllStates(v => !v)}
                    className="mt-2 text-xs text-[#0d2d4e] font-medium hover:underline flex items-center gap-1"
                  >
                    {showAllStates ? (
                      <><ChevronUp className="w-3 h-3" /> Show Southeast states only</>
                    ) : (
                      <><ChevronDown className="w-3 h-3" /> Show all US states</>
                    )}
                  </button>

                  {form.formState.errors.targetStates && (
                    <p className="text-xs text-red-500 mt-2">{form.formState.errors.targetStates.message}</p>
                  )}
                </div>

                {/* MSAs for selected states */}
                {watchedStates.length > 0 && Object.keys(msasByState).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      Specific MSAs <span className="font-normal normal-case text-gray-400">(optional — leave blank for all markets in selected states)</span>
                    </p>
                    <div className="space-y-3">
                      {watchedStates.map(state => {
                        const msas = msasByState[state] || [];
                        if (!msas.length) return null;
                        const isExpanded = expandedStates.includes(state);
                        return (
                          <div key={state} className="border border-gray-100 rounded-xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleStateExpand(state)}
                              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                              <span className="text-xs font-semibold text-gray-700">{state} MSAs</span>
                              <div className="flex items-center gap-2">
                                {watchedMsas.filter(m => (msasByState[state] || []).includes(m)).length > 0 && (
                                  <span className="text-[10px] bg-[#0d2d4e] text-white px-1.5 py-0.5 rounded-full font-bold">
                                    {watchedMsas.filter(m => (msasByState[state] || []).includes(m)).length} selected
                                  </span>
                                )}
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="px-3 py-3 flex flex-col gap-2">
                                {msas.map(msa => {
                                  const counties = countiesByMsa[msa] || [];
                                  const selected = watchedMsas.includes(msa);
                                  return (
                                    <div key={msa}>
                                      <button
                                        type="button"
                                        onClick={() => toggleMsa(msa)}
                                        className={`px-2.5 py-1 rounded-lg text-xs border transition-all font-medium ${
                                          selected
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700"
                                        }`}
                                      >
                                        {msa}
                                      </button>
                                      {selected && counties.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
                                          {counties.map(county => {
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
                                      )}
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
              </div>

              {/* Submit */}
              {mutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {(mutation.error as any)?.message?.includes("already exists")
                    ? "An account with this email already exists. Try logging in at the broker portal."
                    : "Something went wrong. Please try again or email deals@landlinq.com."}
                </div>
              )}

              <Button
                type="submit"
                disabled={mutation.isPending}
                className="w-full h-9 bg-[#4A90E2] hover:bg-white border-2 border-[#4A90E2] text-white hover:text-[#4A90E2] font-semibold text-sm rounded-xl transition-all duration-200"
              >
                {mutation.isPending ? "Submitting..." : "Apply to Partner Broker Program"}
              </Button>

              <p className="text-center text-xs text-gray-400">
                Already have an account?{" "}
                <a href="/broker-portal" className="text-[#0d2d4e] font-medium hover:underline">
                  Sign in to the broker portal
                </a>
              </p>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

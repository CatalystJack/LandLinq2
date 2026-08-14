import { useState, useMemo } from "react";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, MapPin, Users, DollarSign, Ruler, Mail,
  Phone, ChevronDown, ChevronUp, AlertTriangle, ExternalLink,
  Search, CheckCircle, XCircle, AlertCircle, Pencil, Trash2, X, Network, Loader2,
  Zap, ZapOff, Send, FileText, Inbox, Clock, CheckCheck, Table2
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type OutboxRecord = {
  id: string;
  status: "pending" | "sent";
  sentAt: string | null;
  matchedAt: string | null;
  zoningOverride: string | null;
  summaryOverride: string | null;
  wetlandOverride: string | null;
  developerId: string;
  dealId: string;
  devCompanyName: string;
  devContactName: string;
  devEmail: string;
  devPhone: string | null;
  devAutoSend: boolean;
  devTargetStates: string[] | null;
  devProductTypes: string[] | null;
  devMinAcres: string | null;
  devMaxAcres: string | null;
  devMinUnits: number | null;
  devMaxUnits: number | null;
  devMaxAskingPricePerAcre: string | null;
  devQctInterest: boolean | null;
  dealAddress: string | null;
  dealCity: string | null;
  dealState: string | null;
  dealClassification: string | null;
  dealSizeAcres: string | null;
  dealEstimatedUnits: number | null;
  dealAskingPrice: string | null;
  dealImageUrls: any;
  dealUnderContract: boolean | null;
  dealProductTypes: any;
  dealZoning: string | null;
  dealDeveloperSummary: string | null;
  dealWetlandNotes: string | null;
  dealExcelModelUrl: string | null;
  dealInvestmentMemoUrl: string | null;
  dealTopRentPSF: string | null;
  dealTopRentPerUnit: string | null;
  dealAvgRentPSF: string | null;
  dealAvgRentPerUnit: string | null;
  dealAutomatedYoc: string | null;
  dealVintage: string | null;
  dealType: string | null;
  dealCounty: string | null;
  dealQctStatus: string | null;
  dealOzStatus: string | null;
  dealDdaStatus: string | null;
  dealDdaAreaName: string | null;
  dealDdaVlil: number | null;
  dealDdaFmr: number | null;
  dealDdaLihtcMaxRent: number | null;
  dealNmtcStatus: string | null;
  dealComparableCount: number | null;
  dealComparablesJson: any;
  dealComparableNotes: string | null;
  dealCensusMedianIncome: number | null;
  dealCensusTotalPopulation: number | null;
  dealCensusRenterRate: string | null;
  dealCensusMedianAge: string | null;
  dealAiExplanatoryNotes: string | null;
  dealApex: boolean | null;
};

type PartnerDeveloper = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  dealPreference?: string;
  targetStates?: string[];
  targetMsas?: string[];
  qctInterest?: boolean;
  productTypes?: string[];
  minAcres?: string;
  maxAcres?: string;
  minUnits?: number;
  maxUnits?: number;
  maxAskingPricePerAcre?: string;
  minRentPsf?: string;
  minRentPerUnit?: string;
  minVintageYear?: number;
  notes?: string;
  isActive: boolean;
  autoSendEnabled: boolean;
  createdAt: string;
};

type MatchingDeal = {
  id: string;
  address: string;
  city?: string;
  state?: string;
  classification: string;
  productTypes?: any;
  sizeAcres?: string;
  estimatedUnits?: number;
  askingPrice?: string;
  createdAt: string;
  automatedYoc?: string | null;
  investmentMemoUrl?: string | null;
  topRentPSF?: string | null;
  rentsPerUnit?: string | null;
  vintage?: string | null;
  dealType?: string | null;
  zoning?: string | null;
  developerSummary?: string | null;
  matchReasons: string[];
};

type DealRoutingEntry = {
  developer: PartnerDeveloper;
  matchingDeals: MatchingDeal[];
};

function classificationBadge(c: string) {
  if (c === "red") return <Badge className="bg-red-100 text-red-700 border-red-200 font-semibold text-xs">RED</Badge>;
  if (c === "yellow") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 font-semibold text-xs">YELLOW</Badge>;
  if (c === "green") return <Badge className="bg-green-100 text-green-700 border-green-200 font-semibold text-xs">GREEN</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">{c || "Unclassified"}</Badge>;
}

// ── Compose + Send Dialog ────────────────────────────────────────────────────
function ComposeSendDialog({
  deal,
  recipients,
  label,
  onClose,
}: {
  deal: MatchingDeal;
  recipients: string[];
  label: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [zoning, setZoning] = useState(deal.zoning || "");
  const [summary, setSummary] = useState(deal.developerSummary || "");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/partner-developers/send-deal-email", {
        developerEmails: recipients,
        dealData: deal,
        zoning: zoning || undefined,
        summary: summary || undefined,
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: `Sent to ${json.sent} recipient${json.sent !== 1 ? "s" : ""}`,
          description: deal.investmentMemoUrl ? "Deal info + investment memo attached." : "Deal info email sent.",
        });
        onClose();
      } else {
        toast({ title: "Failed to send", description: json.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not send email", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const addr = [deal.address, deal.city, deal.state].filter(Boolean).join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-catalyst-navy text-sm">{label}</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{addr}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Zoning</label>
            <Input
              value={zoning}
              onChange={e => setZoning(e.target.value)}
              placeholder="e.g. R-MF, MX-2, PUD…"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Summary (optional)</label>
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Brief summary for the developer…"
              rows={4}
              className="text-sm resize-none"
            />
            {deal.developerSummary && !summary && (
              <p className="text-xs text-teal-600 mt-1">
                Pre-filled from stored developer summary.
              </p>
            )}
          </div>
          <div className="text-xs text-gray-400">
            Sending to: <span className="text-gray-600 font-medium">{recipients.join(", ")}</span>
            {deal.investmentMemoUrl && (
              <span className="ml-2 text-teal-700 font-medium">📎 Memo attached</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-100">
          <Button variant="outline" onClick={onClose} className="h-8 text-sm">Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="h-8 text-sm bg-catalyst-navy hover:bg-catalyst-navy/90 text-white gap-1.5"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── DealRow — one matching deal inside an expanded developer ─────────────────
function DealRow({ deal, devEmail, devContactName }: { deal: MatchingDeal; devEmail: string; devContactName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <ComposeSendDialog
          deal={deal}
          recipients={[devEmail]}
          label={`Send to ${devContactName}`}
          onClose={() => setOpen(false)}
        />
      )}
      <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {classificationBadge(deal.classification)}
            <span className="text-xs font-medium text-catalyst-navy truncate">
              {deal.address}{deal.city ? `, ${deal.city}` : ""}{deal.state ? `, ${deal.state}` : ""}
            </span>
            {deal.investmentMemoUrl && (
              <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium">📎 Memo</span>
            )}
            {deal.developerSummary && (
              <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-medium">📝 Summary</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {deal.sizeAcres && (
              <span className="text-xs text-gray-500">{parseFloat(deal.sizeAcres).toFixed(1)} ac</span>
            )}
            {deal.estimatedUnits && (
              <span className="text-xs text-gray-500">{deal.estimatedUnits} units</span>
            )}
            {deal.askingPrice && (
              <span className="text-xs text-gray-500">${parseInt(deal.askingPrice).toLocaleString()}</span>
            )}
            {deal.topRentPSF && deal.topRentPSF !== "0" && (
              <span className="text-xs text-gray-500">${parseFloat(deal.topRentPSF).toFixed(2)}/SF</span>
            )}
            {deal.matchReasons.map(r => (
              <span key={r} className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium">{r}</span>
            ))}
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-catalyst-navy hover:bg-catalyst-navy/90 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Mail className="w-3 h-3" />
          {deal.investmentMemoUrl ? "Send + Memo" : "Send"}
        </button>
      </div>
    </>
  );
}

// ── Auto-send toggle ──────────────────────────────────────────────────────────
function AutoSendToggle({ dev }: { dev: PartnerDeveloper }) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("PATCH", `/api/partner-developers/${dev.id}/auto-send`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-developers"] });
    },
    onError: () => toast({ title: "Failed to update auto-send", variant: "destructive" }),
  });

  const enabled = dev.autoSendEnabled;
  return (
    <button
      onClick={e => { e.stopPropagation(); mutation.mutate(!enabled); }}
      disabled={mutation.isPending}
      title={enabled ? "Auto-send ON — click to disable" : "Auto-send OFF — click to enable"}
      className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
        enabled
          ? "bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100"
          : "bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100"
      }`}
    >
      {mutation.isPending ? (
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
      ) : enabled ? (
        <Zap className="w-2.5 h-2.5" />
      ) : (
        <ZapOff className="w-2.5 h-2.5" />
      )}
      {enabled ? "Auto-send ON" : "Auto-send OFF"}
    </button>
  );
}

// ── Developer row with expand ─────────────────────────────────────────────────
function DeveloperRow({ dev, routingData, onEdit, onDelete }: {
  dev: PartnerDeveloper;
  routingData?: MatchingDeal[];
  onEdit: (d: PartnerDeveloper) => void;
  onDelete: (d: PartnerDeveloper) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const redCount = routingData?.filter(d => d.classification === "red").length ?? 0;
  const yellowCount = routingData?.filter(d => d.classification === "yellow").length ?? 0;
  const greenCount = routingData?.filter(d => d.classification === "green").length ?? 0;
  const unclassifiedCount = routingData?.filter(d => !d.classification || d.classification === "unclassified").length ?? 0;
  const totalCount = (routingData?.length ?? 0);

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${expanded ? "bg-blue-50/30" : ""}`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="font-semibold text-catalyst-navy text-sm leading-tight">{dev.companyName}</div>
          <div className="text-xs text-gray-500 mt-0.5">{dev.contactName}</div>
        </td>
        <td className="px-4 py-3">
          <a href={`mailto:${dev.email}`} onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate max-w-[200px]">
            <Mail className="w-3 h-3 flex-shrink-0" />{dev.email}
          </a>
          {dev.phone && (
            <span className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <Phone className="w-3 h-3" />{dev.phone}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {(dev.targetStates ?? []).slice(0, 5).map(s => (
              <span key={s} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">{s}</span>
            ))}
            {(dev.targetStates ?? []).length > 5 && (
              <span className="text-[10px] text-gray-400">+{(dev.targetStates ?? []).length - 5}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {(dev.productTypes ?? []).slice(0, 2).map(pt => (
              <span key={pt} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{pt}</span>
            ))}
            {(dev.productTypes ?? []).length > 2 && (
              <span className="text-[10px] text-gray-400">+{(dev.productTypes ?? []).length - 2}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          {dev.dealPreference && (
            <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium capitalize">
              {dev.dealPreference === "both" ? "Land + Acq" : dev.dealPreference}
            </span>
          )}
        </td>
        {/* Match counts */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {greenCount > 0 && <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">{greenCount} G</span>}
            {yellowCount > 0 && <span className="text-xs font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">{yellowCount} Y</span>}
            {redCount > 0 && <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{redCount} R</span>}
            {unclassifiedCount > 0 && <span className="text-xs font-bold text-gray-600 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full">{unclassifiedCount} U</span>}
            {totalCount === 0 && <span className="text-xs text-gray-400">—</span>}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1 items-start" onClick={e => e.stopPropagation()}>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dev.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {dev.isActive ? "Active" : "Inactive"}
            </span>
            <AutoSendToggle dev={dev} />
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(dev)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(dev)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-gray-100 bg-blue-50/20">
          <td colSpan={8} className="px-6 py-4">
            <div className="space-y-4">
              {/* Criteria pills */}
              <div className="flex flex-wrap gap-1.5">
                {dev.minAcres && <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium"><Ruler className="w-2.5 h-2.5" />≥{dev.minAcres} ac</span>}
                {dev.maxAcres && <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium"><Ruler className="w-2.5 h-2.5" />≤{dev.maxAcres} ac</span>}
                {dev.minUnits && <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium"><Users className="w-2.5 h-2.5" />≥{dev.minUnits} units</span>}
                {dev.maxUnits && <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium"><Users className="w-2.5 h-2.5" />≤{dev.maxUnits} units</span>}
                {dev.maxAskingPricePerAcre && <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium"><DollarSign className="w-2.5 h-2.5" />≤${parseInt(dev.maxAskingPricePerAcre).toLocaleString()}/ac</span>}
                {dev.minRentPsf && <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium"><DollarSign className="w-2.5 h-2.5" />≥${dev.minRentPsf}/SF rent</span>}
                {dev.minRentPerUnit && <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium"><DollarSign className="w-2.5 h-2.5" />≥${parseInt(dev.minRentPerUnit).toLocaleString()}/unit</span>}
                {dev.minVintageYear && <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">≥{dev.minVintageYear} vintage</span>}
                {dev.qctInterest && <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">QCT open</span>}
              </div>

              {(dev.targetMsas ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Target MSAs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(dev.targetMsas ?? []).map(msa => (
                      <span key={msa} className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 text-xs px-2 py-0.5 rounded-full border border-slate-200">
                        <MapPin className="w-2.5 h-2.5" />{msa}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {dev.notes && (
                <p className="text-xs text-gray-600"><span className="font-semibold">Notes:</span> {dev.notes}</p>
              )}

              {/* All matching deals — grouped by classification */}
              {routingData && routingData.length === 0 && (
                <p className="text-xs text-gray-400 italic">No matching deals in the system yet.</p>
              )}

              {routingData && routingData.filter(d => d.classification === "green").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Green Deals
                  </p>
                  {routingData.filter(d => d.classification === "green").map(deal => (
                    <DealRow key={deal.id} deal={deal} devEmail={dev.email} devContactName={dev.contactName} />
                  ))}
                </div>
              )}

              {routingData && routingData.filter(d => d.classification === "yellow").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Yellow Deals
                  </p>
                  {routingData.filter(d => d.classification === "yellow").map(deal => (
                    <DealRow key={deal.id} deal={deal} devEmail={dev.email} devContactName={dev.contactName} />
                  ))}
                </div>
              )}

              {routingData && routingData.filter(d => d.classification === "red").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Red Deals
                  </p>
                  {routingData.filter(d => d.classification === "red").map(deal => (
                    <DealRow key={deal.id} deal={deal} devEmail={dev.email} devContactName={dev.contactName} />
                  ))}
                </div>
              )}

              {routingData && routingData.filter(d => !d.classification || d.classification === "unclassified").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />Unclassified
                  </p>
                  {routingData.filter(d => !d.classification || d.classification === "unclassified").map(deal => (
                    <DealRow key={deal.id} deal={deal} devEmail={dev.email} devContactName={dev.contactName} />
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── "Email All" button for a deal — compose dialog ───────────────────────────
function EmailAllButton({ deal, developers, className }: { deal: MatchingDeal; developers: PartnerDeveloper[]; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <ComposeSendDialog
          deal={deal}
          recipients={developers.map(d => d.email)}
          label={`Email All (${developers.length})`}
          onClose={() => setOpen(false)}
        />
      )}
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${className}`}
      >
        <Mail className="w-3 h-3" />
        {deal.investmentMemoUrl ? `Email All + Memo (${developers.length})` : `Email All (${developers.length})`}
      </button>
    </>
  );
}

function extractBestYoc(yocText: string | null | undefined): number {
  if (!yocText) return 0;
  const best = yocText.match(/BEST:\s*~?(\d+\.?\d*)\s*%/i);
  if (best) return parseFloat(best[1]);
  const plain = yocText.match(/(\d+\.?\d*)\s*%/);
  return plain ? parseFloat(plain[1]) : 0;
}

// ── All-deals routing tab ─────────────────────────────────────────────────────
function AllDealRoutingTab({ routingData }: { routingData: DealRoutingEntry[] }) {
  const dealMap = new Map<string, { deal: MatchingDeal; developers: PartnerDeveloper[] }>();
  routingData.forEach(({ developer, matchingDeals }) => {
    matchingDeals.forEach(deal => {
      if (!dealMap.has(deal.id)) dealMap.set(deal.id, { deal, developers: [] });
      dealMap.get(deal.id)!.developers.push(developer);
    });
  });
  const entries = Array.from(dealMap.values()).sort((a, b) => {
    const order: Record<string, number> = { green: 0, yellow: 1, red: 2 };
    return (order[a.deal.classification] ?? 3) - (order[b.deal.classification] ?? 3);
  });

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-gray-200" />
        <p className="font-medium text-gray-500">No matching deals yet.</p>
        <p className="text-sm mt-1">Deals that match any registered developer's buy box will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Property</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Size / Price</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rents</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Matched Developers</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ deal, developers }) => (
            <tr key={deal.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {classificationBadge(deal.classification)}
                  <span className="font-medium text-catalyst-navy text-xs">
                    {deal.address}{deal.city ? `, ${deal.city}` : ""}{deal.state ? `, ${deal.state}` : ""}
                  </span>
                  {deal.investmentMemoUrl && (
                    <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium">📎 Memo</span>
                  )}
                  {deal.developerSummary && (
                    <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-medium">📝 Summary</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {deal.sizeAcres ? `${parseFloat(deal.sizeAcres).toFixed(1)} ac` : "—"}
                {deal.estimatedUnits ? ` / ${deal.estimatedUnits} units` : ""}
                {deal.askingPrice && <div>${parseInt(deal.askingPrice).toLocaleString()}</div>}
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {deal.topRentPSF && deal.topRentPSF !== "0" ? `$${parseFloat(deal.topRentPSF).toFixed(2)}/SF` : "—"}
                {deal.rentsPerUnit && deal.rentsPerUnit !== "0" && <div>${parseFloat(deal.rentsPerUnit).toFixed(0)}/unit</div>}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {developers.map(dev => (
                    <span key={dev.id} className="text-xs bg-white border border-gray-200 text-catalyst-navy px-2 py-0.5 rounded-full font-medium">
                      {dev.companyName}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <EmailAllButton deal={deal} developers={developers} className="text-white bg-catalyst-navy hover:bg-catalyst-navy/90" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditDeveloperModal({ dev, onClose }: { dev: PartnerDeveloper; onClose: () => void }) {
  const PRODUCT_TYPE_OPTIONS = [
    "Conventional 3-Story Walk-Up","Conventional 4-Story Mid-Rise","Attainable / Workforce Housing",
    "Active Adult 3-Story Flats (55+)","Active Adult 4-Story Flats (55+)","Active Adult Cottages (55+)",
    "BTR Townhomes","BTR Single-Family Detached",
  ];
  const STATE_OPTIONS = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
  const [msaSearch, setMsaSearch] = useState("");

  const { data: msaData } = useQuery<{ success: boolean; msasByState: Record<string, string[]> }>({
    queryKey: ["/api/public/msas-by-state"],
    staleTime: 1000 * 60 * 10,
  });

  const [form, setForm] = useState({
    companyName: dev.companyName || "", contactName: dev.contactName || "",
    email: dev.email || "", phone: dev.phone || "",
    dealPreference: dev.dealPreference || "",
    targetStates: dev.targetStates || [], targetMsas: dev.targetMsas || [],
    qctInterest: dev.qctInterest ?? false,
    productTypes: dev.productTypes || [],
    minAcres: dev.minAcres || "", maxAcres: dev.maxAcres || "",
    minUnits: dev.minUnits?.toString() || "", maxUnits: dev.maxUnits?.toString() || "",
    maxAskingPricePerAcre: dev.maxAskingPricePerAcre || "",
    minRentPsf: dev.minRentPsf || "", minRentPerUnit: dev.minRentPerUnit || "",
    minVintageYear: dev.minVintageYear?.toString() || "",
    notes: dev.notes || "", isActive: dev.isActive,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/partner-developers/${dev.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner-developers"] }); onClose(); },
  });

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...form,
      minUnits: form.minUnits ? parseInt(form.minUnits) : null,
      maxUnits: form.maxUnits ? parseInt(form.maxUnits) : null,
      minVintageYear: form.minVintageYear ? parseInt(form.minVintageYear) : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-catalyst-navy text-base">Edit Developer Profile</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Company Name *</label><Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} required className="h-8 text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Contact Name *</label><Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} required className="h-8 text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="h-8 text-sm" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-8 text-sm" /></div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Deal Preference</label>
            <div className="flex gap-2">
              {["land","acquisition","both"].map(opt => (
                <button key={opt} type="button" onClick={() => setForm(f => ({ ...f, dealPreference: opt }))}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${form.dealPreference === opt ? "bg-catalyst-navy text-white border-catalyst-navy" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                  {opt === "both" ? "Land + Acq" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Target States</label>
            <div className="flex flex-wrap gap-1">
              {STATE_OPTIONS.map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, targetStates: toggleArrayItem(f.targetStates, s) }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${form.targetStates.includes(s) ? "bg-catalyst-navy text-white border-catalyst-navy" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Target Markets (MSAs) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-600">
                Target Markets
                {form.targetMsas.length > 0 && (
                  <span className="ml-2 bg-catalyst-navy text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {form.targetMsas.length}
                  </span>
                )}
              </label>
              {form.targetMsas.length > 0 && (
                <button type="button" onClick={() => setForm(f => ({ ...f, targetMsas: [] }))}
                  className="text-[10px] text-red-500 hover:text-red-700 font-medium">
                  Clear all
                </button>
              )}
            </div>

            {/* Selected markets chips */}
            {form.targetMsas.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2 p-2 bg-teal-50 border border-teal-100 rounded-lg">
                {form.targetMsas.map(msa => (
                  <button key={msa} type="button"
                    onClick={() => setForm(f => ({ ...f, targetMsas: f.targetMsas.filter(m => m !== msa) }))}
                    className="flex items-center gap-1 bg-catalyst-navy text-white text-[10px] font-medium px-2 py-0.5 rounded-full hover:bg-red-600 transition-colors group">
                    {msa}
                    <X className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}

            {/* Search + available markets */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={msaSearch}
                  onChange={e => setMsaSearch(e.target.value)}
                  placeholder={form.targetStates.length ? "Search markets…" : "Select states above to see available markets"}
                  className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
                {msaSearch && (
                  <button type="button" onClick={() => setMsaSearch("")} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto p-2 space-y-3">
                {(() => {
                  const msasByState = msaData?.msasByState ?? {};
                  const statesToShow = form.targetStates.length > 0
                    ? form.targetStates.filter(s => msasByState[s])
                    : Object.keys(msasByState).sort();

                  if (statesToShow.length === 0) {
                    return (
                      <p className="text-xs text-gray-400 text-center py-4">
                        {form.targetStates.length > 0
                          ? "No markets found for selected states"
                          : "No market data available"}
                      </p>
                    );
                  }

                  const q = msaSearch.toLowerCase();
                  const sections = statesToShow.map(state => ({
                    state,
                    msas: (msasByState[state] ?? []).filter(m =>
                      !q || m.toLowerCase().includes(q)
                    ),
                  })).filter(s => s.msas.length > 0);

                  if (sections.length === 0) {
                    return <p className="text-xs text-gray-400 text-center py-4">No markets match "{msaSearch}"</p>;
                  }

                  return sections.map(({ state, msas }) => (
                    <div key={state}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">{state}</p>
                      <div className="flex flex-wrap gap-1">
                        {msas.map(msa => {
                          const selected = form.targetMsas.includes(msa);
                          return (
                            <button key={msa} type="button"
                              onClick={() => setForm(f => ({ ...f, targetMsas: toggleArrayItem(f.targetMsas, msa) }))}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                                selected
                                  ? "bg-catalyst-navy text-white border-catalyst-navy"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-catalyst-navy hover:text-catalyst-navy"
                              }`}>
                              {msa}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {form.targetStates.length > 0
                ? `Showing markets for: ${form.targetStates.join(", ")}`
                : "Select states above to filter markets by state"}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Product Types</label>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TYPE_OPTIONS.map(pt => (
                <button key={pt} type="button" onClick={() => setForm(f => ({ ...f, productTypes: toggleArrayItem(f.productTypes, pt) }))}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${form.productTypes.includes(pt) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                  {pt}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Min Acres</label><Input type="number" value={form.minAcres} onChange={e => setForm(f => ({ ...f, minAcres: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 5" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Max Acres</label><Input type="number" value={form.maxAcres} onChange={e => setForm(f => ({ ...f, maxAcres: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 50" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Min Units</label><Input type="number" value={form.minUnits} onChange={e => setForm(f => ({ ...f, minUnits: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 100" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Max Units</label><Input type="number" value={form.maxUnits} onChange={e => setForm(f => ({ ...f, maxUnits: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 400" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Max Asking $/Acre</label><Input type="number" value={form.maxAskingPricePerAcre} onChange={e => setForm(f => ({ ...f, maxAskingPricePerAcre: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 200000" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Min Rent PSF</label><Input type="number" step="0.01" value={form.minRentPsf} onChange={e => setForm(f => ({ ...f, minRentPsf: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 1.50" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Min Rent/Unit</label><Input type="number" value={form.minRentPerUnit} onChange={e => setForm(f => ({ ...f, minRentPerUnit: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 1200" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Min Vintage Year</label><Input type="number" value={form.minVintageYear} onChange={e => setForm(f => ({ ...f, minVintageYear: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 2010" /></div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-catalyst-navy/30" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded accent-catalyst-navy" />
            <label htmlFor="isActive" className="text-sm text-gray-700 font-medium">Active</label>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose} className="h-8 text-sm">Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending} className="h-8 text-sm bg-catalyst-navy hover:bg-catalyst-navy/90 text-white">
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
          {updateMutation.isError && <p className="text-xs text-red-600 text-right">Failed to save. Please try again.</p>}
        </form>
      </div>
    </div>
  );
}

// ── Outbox row — one pending/sent match ──────────────────────────────────────
function OutboxRow({ rec, onSent, onDismiss }: {
  rec: OutboxRecord;
  onSent: () => void;
  onDismiss: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [zoning, setZoning] = useState(rec.zoningOverride ?? rec.dealZoning ?? "");
  const [summary, setSummary] = useState(rec.summaryOverride ?? rec.dealDeveloperSummary ?? "");
  const [wetland, setWetland] = useState(rec.wetlandOverride ?? rec.dealWetlandNotes ?? "");
  const [dirty, setDirty] = useState(false);

  const addr = [rec.dealAddress, rec.dealCity, rec.dealState].filter(Boolean).join(", ");
  const productTypes = Array.isArray(rec.dealProductTypes)
    ? rec.dealProductTypes.join(", ")
    : typeof rec.dealProductTypes === "string"
      ? (() => { try { return JSON.parse(rec.dealProductTypes).join(", "); } catch { return rec.dealProductTypes; } })()
      : "—";

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/partner-developers/outbox/${rec.id}`, { zoningOverride: zoning || null, summaryOverride: summary || null, wetlandOverride: wetland || null }),
    onSuccess: () => { setDirty(false); queryClient.invalidateQueries({ queryKey: ["/api/partner-developers/outbox"] }); },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/partner-developers/outbox/${rec.id}/send`),
    onSuccess: () => {
      toast({ title: `Sent to ${rec.devCompanyName}`, description: addr });
      queryClient.invalidateQueries({ queryKey: ["/api/partner-developers/outbox"] });
      onSent();
    },
    onError: (e: any) => toast({ title: "Failed to send", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/partner-developers/outbox/${rec.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner-developers/outbox"] }); onDismiss(); },
    onError: () => toast({ title: "Failed to dismiss", variant: "destructive" }),
  });

  const handleSaveAndSend = async () => {
    if (!isComplete) {
      const proceed = window.confirm(
        `This deal packet is missing: ${missingFields.join(", ")}. Send anyway?`
      );
      if (!proceed) return;
    }
    if (dirty) await saveMutation.mutateAsync();
    sendMutation.mutate();
  };

  const isSent = rec.status === "sent";
  const sending = sendMutation.isPending || saveMutation.isPending;

  const missingFields: string[] = [];
  if (!(zoning || rec.dealZoning)) missingFields.push("Zoning");
  if (!(wetland || rec.dealWetlandNotes)) missingFields.push("Wetland/Environmental Notes");
  if (!(summary || rec.dealDeveloperSummary)) missingFields.push("Developer Summary");
  if (!rec.dealExcelModelUrl) missingFields.push("Underwriting Model (OneDrive link)");
  const isComplete = missingFields.length === 0;

  // Mirrors the "Why This Matches Your Buy Box" section in the actual email
  const matchReasons: string[] = [];
  if (rec.devTargetStates?.length && rec.dealState) {
    matchReasons.push(`Location: ${rec.dealState} is in target market(s) (${rec.devTargetStates.join(", ")})`);
  }
  if (rec.devMinAcres && rec.dealSizeAcres) {
    matchReasons.push(`Acreage: ${parseFloat(rec.dealSizeAcres).toFixed(2)} ac meets minimum of ${parseFloat(rec.devMinAcres).toFixed(2)} ac`);
  }
  if (rec.devMinUnits && rec.dealEstimatedUnits) {
    matchReasons.push(`Units: ${rec.dealEstimatedUnits} units meets minimum of ${rec.devMinUnits}`);
  }
  if (rec.devMaxAskingPricePerAcre && rec.dealAskingPrice && rec.dealSizeAcres && parseFloat(rec.dealSizeAcres) > 0) {
    const ppa = parseFloat(rec.dealAskingPrice) / parseFloat(rec.dealSizeAcres);
    matchReasons.push(`Price/Acre: $${Math.round(ppa).toLocaleString()}/ac is within ceiling of $${parseInt(rec.devMaxAskingPricePerAcre).toLocaleString()}/ac`);
  }
  if (rec.devQctInterest && rec.dealQctStatus === "YES") {
    matchReasons.push(`QCT: Property is in a Qualified Census Tract — matches affordable housing interest`);
  }

  const dealImages: string[] = Array.isArray(rec.dealImageUrls)
    ? rec.dealImageUrls
    : (typeof rec.dealImageUrls === "string" ? (() => { try { return JSON.parse(rec.dealImageUrls); } catch { return []; } })() : []);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isSent ? "border-gray-200 bg-gray-50/50 opacity-70" : "border-gray-200 bg-white shadow-sm"}`}>
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Classification dot */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          rec.dealClassification === "green" ? "bg-green-500" :
          rec.dealClassification === "yellow" ? "bg-yellow-400" :
          rec.dealClassification === "red" ? "bg-red-500" : "bg-gray-300"
        }`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-catalyst-navy text-sm truncate">{addr || "Unknown address"}</span>
            {rec.dealExcelModelUrl && (
              <a href={rec.dealExcelModelUrl} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded font-semibold hover:bg-green-100 transition-colors">
                📊 Excel
              </a>
            )}
            {rec.dealInvestmentMemoUrl && (
              <span className="text-[10px] text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-semibold">📎 Memo</span>
            )}
            {!isSent && (
              isComplete ? (
                <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded font-semibold">✓ Packet Complete</span>
              ) : (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold" title={`Missing: ${missingFields.join(", ")}`}>
                  ⚠ {missingFields.length} field{missingFields.length > 1 ? "s" : ""} missing
                </span>
              )
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500">{productTypes}</span>
            {rec.dealSizeAcres && <span className="text-xs text-gray-400">{parseFloat(rec.dealSizeAcres).toFixed(1)} ac</span>}
            {rec.dealAskingPrice && <span className="text-xs text-gray-400">${parseInt(rec.dealAskingPrice).toLocaleString()}</span>}
            <span className="text-xs text-purple-700 font-medium">→ {rec.devCompanyName}</span>
            {rec.dealZoning && !rec.zoningOverride && <span className="text-xs text-gray-400">Zoning: {rec.dealZoning}</span>}
            {rec.zoningOverride && <span className="text-xs text-blue-600 font-medium">Zoning: {rec.zoningOverride} ✎</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isSent ? (
            <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
              <CheckCheck className="w-3 h-3" />
              Sent {rec.sentAt ? new Date(rec.sentAt).toLocaleDateString() : ""}
            </span>
          ) : (
            <>
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-xs text-gray-500 hover:text-catalyst-navy px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              >
                {expanded ? "Collapse ▲" : "Edit ▼"}
              </button>
              <button
                onClick={handleSaveAndSend}
                disabled={sending}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-catalyst-navy hover:bg-catalyst-navy/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {sending ? "Sending…" : "Send"}
              </button>
              <button
                onClick={() => dismissMutation.mutate()}
                disabled={dismissMutation.isPending}
                className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                title="Dismiss"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded edit panel */}
      {expanded && !isSent && (
        <div className="border-t border-gray-100 px-4 py-4 bg-slate-50 space-y-4">
          {!isComplete && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">Deal packet incomplete.</span> Missing: {missingFields.join(", ")}.
                Fill these in on the analyst dashboard before sending for a complete packet.
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Recipient &amp; Buy Box ({rec.devCompanyName})</label>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <div className="text-gray-500">Contact: <span className="font-medium text-gray-800">{rec.devContactName || "—"}</span></div>
              <div className="text-gray-500">Email: <span className="font-medium text-gray-800">{rec.devEmail || "—"}</span></div>
              <div className="text-gray-500">Phone: <span className="font-medium text-gray-800">{rec.devPhone || "Not provided"}</span></div>
              <div className="text-gray-500">Auto-send: <span className={`font-medium ${rec.devAutoSend ? "text-teal-700" : "text-gray-800"}`}>{rec.devAutoSend ? "On" : "Off"}</span></div>
              <div className="text-gray-500">Target States: <span className="font-medium text-gray-800">{rec.devTargetStates?.length ? rec.devTargetStates.join(", ") : "Any"}</span></div>
              <div className="text-gray-500">Product Types: <span className="font-medium text-gray-800">{rec.devProductTypes?.length ? rec.devProductTypes.join(", ") : "Any"}</span></div>
              <div className="text-gray-500">Acreage Range: <span className="font-medium text-gray-800">{rec.devMinAcres || rec.devMaxAcres ? `${rec.devMinAcres ? parseFloat(rec.devMinAcres).toFixed(2) : "0"}–${rec.devMaxAcres ? parseFloat(rec.devMaxAcres).toFixed(2) : "∞"} ac` : "Any"}</span></div>
              <div className="text-gray-500">Unit Range: <span className="font-medium text-gray-800">{rec.devMinUnits || rec.devMaxUnits ? `${rec.devMinUnits ?? "0"}–${rec.devMaxUnits ?? "∞"}` : "Any"}</span></div>
              <div className="text-gray-500">Max $/Acre: <span className="font-medium text-gray-800">{rec.devMaxAskingPricePerAcre ? `$${parseInt(rec.devMaxAskingPricePerAcre).toLocaleString()}` : "No limit"}</span></div>
              <div className="text-gray-500">QCT Interest: <span className="font-medium text-gray-800">{rec.devQctInterest ? "Yes" : "No"}</span></div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Why This Matches ({rec.devCompanyName}'s Buy Box)</label>
            {matchReasons.length > 0 ? (
              <ul className="bg-white border border-gray-200 rounded-lg px-3 py-2 space-y-1 text-xs text-gray-700 list-disc list-inside">
                {matchReasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400 italic">
                No specific buy-box criteria matched — deal may have been queued manually or via broad match.
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Property Images {dealImages.length > 0 ? `(${dealImages.length})` : ""}</label>
            {dealImages.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dealImages.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                    <img src={url} alt={`Property ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400 italic">
                No images uploaded for this deal.
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                Zoning
                {rec.dealZoning && <span className="text-gray-400 font-normal">(deal: {rec.dealZoning})</span>}
              </label>
              <Input
                value={zoning}
                onChange={e => { setZoning(e.target.value); setDirty(true); }}
                placeholder={rec.dealZoning || "e.g. R-MF, MX-2, PUD…"}
                className="h-8 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
                Wetland / Environmental Notes
                {rec.dealWetlandNotes && <span className="text-gray-400 font-normal">(deal: pre-filled)</span>}
              </label>
              <Textarea
                value={wetland}
                onChange={e => { setWetland(e.target.value); setDirty(true); }}
                placeholder={rec.dealWetlandNotes || "e.g. No wetlands identified on Phase I ESA…"}
                rows={2}
                className="text-sm resize-none bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Deal Details (everything that could be included in the email)</label>
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 space-y-1.5">

                {/* Property basics — always shown, dash when missing */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Property Details</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                    <div className="text-gray-500">Acreage: <span className="font-medium text-gray-800">{rec.dealSizeAcres ? `${parseFloat(rec.dealSizeAcres).toFixed(2)} ac` : "—"}</span></div>
                    <div className="text-gray-500">Units: <span className="font-medium text-gray-800">{rec.dealEstimatedUnits ?? "—"}</span></div>
                    <div className="text-gray-500">Price: <span className="font-medium text-gray-800">{rec.dealAskingPrice ? `$${parseInt(rec.dealAskingPrice).toLocaleString()}` : "—"}</span></div>
                    <div className="text-gray-500">$/Acre: <span className="font-medium text-gray-800">{rec.dealAskingPrice && rec.dealSizeAcres && parseFloat(rec.dealSizeAcres) > 0 ? `$${Math.round(parseFloat(rec.dealAskingPrice) / parseFloat(rec.dealSizeAcres)).toLocaleString()}` : "—"}</span></div>
                    <div className="text-gray-500">Vintage: <span className="font-medium text-gray-800">{rec.dealVintage || "—"}</span></div>
                    <div className="text-gray-500">Type: <span className="font-medium text-gray-800 capitalize">{rec.dealType || "—"}</span></div>
                    <div className="text-gray-500">County: <span className="font-medium text-gray-800">{rec.dealCounty || "—"}</span></div>
                    <div className="text-gray-500">Yield on Cost: <span className="font-medium text-gray-800">{rec.dealAutomatedYoc && rec.dealAutomatedYoc !== "0" ? `${parseFloat(rec.dealAutomatedYoc).toFixed(2)}%` : "—"}</span></div>
                    <div className="text-gray-500">Under Contract: <span className={`font-medium ${rec.dealUnderContract ? "text-amber-700" : "text-gray-800"}`}>{rec.dealUnderContract ? "Yes" : "No"}</span></div>
                  </div>
                </div>

                {/* Rent comps — always shown */}
                <div className="border-t border-gray-100 pt-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Market Rent Comps</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                    <div className="text-gray-500">Top Rent PSF: <span className="font-medium text-gray-800">{rec.dealTopRentPSF && rec.dealTopRentPSF !== "0" ? `$${parseFloat(rec.dealTopRentPSF).toFixed(2)}/SF` : "—"}</span></div>
                    <div className="text-gray-500">Top Rent/Unit: <span className="font-medium text-gray-800">{rec.dealTopRentPerUnit && rec.dealTopRentPerUnit !== "0" ? `$${parseFloat(rec.dealTopRentPerUnit).toFixed(0)}/mo` : "—"}</span></div>
                    <div className="text-gray-500">Avg Rent PSF: <span className="font-medium text-gray-800">{rec.dealAvgRentPSF && rec.dealAvgRentPSF !== "0" ? `$${parseFloat(rec.dealAvgRentPSF).toFixed(2)}/SF` : "—"}</span></div>
                    <div className="text-gray-500">Avg Rent/Unit: <span className="font-medium text-gray-800">{rec.dealAvgRentPerUnit && rec.dealAvgRentPerUnit !== "0" ? `$${parseFloat(rec.dealAvgRentPerUnit).toFixed(0)}/mo` : "—"}</span></div>
                    <div className="text-gray-500"># Comps: <span className="font-medium text-gray-800">{rec.dealComparableCount ?? "—"}</span></div>
                  </div>
                </div>

                {/* Individual comparable properties */}
                <div className="border-t border-gray-100 pt-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Comparable Properties</div>
                  {Array.isArray(rec.dealComparablesJson) && rec.dealComparablesJson.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-left font-medium pr-2 pb-1">Property</th>
                            <th className="text-center font-medium px-2 pb-1">Vintage</th>
                            <th className="text-center font-medium px-2 pb-1">Units</th>
                            <th className="text-center font-medium px-2 pb-1">Distance</th>
                            <th className="text-right font-medium px-2 pb-1">Rent PSF</th>
                            <th className="text-right font-medium pl-2 pb-1">Rent/Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rec.dealComparablesJson as any[]).map((c: any, i: number) => {
                            const name = c.propertyName || c.name || c.address || `Comp ${i + 1}`;
                            const compVintage = c.yearBuilt || c.vintage || '—';
                            const compUnits = c.unitCount || c.units || '—';
                            const dist = c.distance != null ? `${parseFloat(c.distance).toFixed(2)} mi` : '—';
                            const rentPsfVal = c.rentPSF != null && c.rentPSF > 0 ? `$${parseFloat(c.rentPSF).toFixed(2)}` : '—';
                            const rentUnit = c.rentPerUnit != null && c.rentPerUnit > 0 ? `$${parseInt(c.rentPerUnit).toLocaleString()}` : '—';
                            return (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="text-gray-800 font-medium py-1 pr-2 truncate max-w-[140px]" title={c.address || name}>{name}</td>
                                <td className="text-center text-gray-600 px-2 py-1">{compVintage}</td>
                                <td className="text-center text-gray-600 px-2 py-1">{compUnits}</td>
                                <td className="text-center text-gray-600 px-2 py-1">{dist}</td>
                                <td className="text-right text-gray-600 px-2 py-1">{rentPsfVal}</td>
                                <td className="text-right text-gray-600 pl-2 py-1">{rentUnit}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : rec.dealComparableNotes ? (
                    <p className="text-xs text-gray-600 whitespace-pre-wrap">{rec.dealComparableNotes}</p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No comparable data available.</p>
                  )}
                </div>

                {/* Status badges — always shown */}
                <div className="border-t border-gray-100 pt-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Affordable Housing / Incentive Status</div>
                  <div className="flex flex-wrap gap-1">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${rec.dealQctStatus === "YES" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-400"}`}>QCT: {rec.dealQctStatus || "—"}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${rec.dealOzStatus === "YES" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-400"}`}>OZ: {rec.dealOzStatus || "—"}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${(rec.dealDdaStatus === "MDDA" || rec.dealDdaStatus === "NMDDA") ? "bg-pink-100 text-pink-800" : "bg-gray-100 text-gray-400"}`}>DDA: {rec.dealDdaStatus || "—"}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${rec.dealNmtcStatus === "YES" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-400"}`}>NMTC: {rec.dealNmtcStatus || "—"}</span>
                  </div>
                </div>

                {/* DDA details — always shown when property has DDA status */}
                {(rec.dealDdaStatus === "MDDA" || rec.dealDdaStatus === "NMDDA") && (
                  <div className="border-t border-gray-100 pt-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">DDA / Affordable Housing Details</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                      <div className="text-gray-500">HUD Area: <span className="font-medium text-gray-800">{rec.dealDdaAreaName || "—"}</span></div>
                      <div className="text-gray-500">VLIL (4-Person): <span className="font-medium text-gray-800">{rec.dealDdaVlil ? `$${rec.dealDdaVlil.toLocaleString()}` : "—"}</span></div>
                      <div className="text-gray-500">FMR (2-BR): <span className="font-medium text-gray-800">{rec.dealDdaFmr ? `$${rec.dealDdaFmr.toLocaleString()}/mo` : "—"}</span></div>
                      <div className="text-gray-500">Max LIHTC Rent: <span className="font-medium text-gray-800">{rec.dealDdaLihtcMaxRent ? `$${rec.dealDdaLihtcMaxRent.toLocaleString()}/mo` : "—"}</span></div>
                    </div>
                  </div>
                )}

                {/* Demographics — always shown */}
                <div className="border-t border-gray-100 pt-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Market Demographics</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                    <div className="text-gray-500">Median Income: <span className="font-medium text-gray-800">{rec.dealCensusMedianIncome ? `$${rec.dealCensusMedianIncome.toLocaleString()}` : "—"}</span></div>
                    <div className="text-gray-500">Population: <span className="font-medium text-gray-800">{rec.dealCensusTotalPopulation ? rec.dealCensusTotalPopulation.toLocaleString() : "—"}</span></div>
                    <div className="text-gray-500">Renter Rate: <span className="font-medium text-gray-800">{rec.dealCensusRenterRate ? `${parseFloat(rec.dealCensusRenterRate).toFixed(1)}%` : "—"}</span></div>
                    <div className="text-gray-500">Median Age: <span className="font-medium text-gray-800">{rec.dealCensusMedianAge ? `${parseFloat(rec.dealCensusMedianAge).toFixed(1)} yrs` : "—"}</span></div>
                  </div>
                </div>

                {/* AI notes — always shown */}
                <div className="border-t border-gray-100 pt-1.5">
                  <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">AI Classification Notes</div>
                  {rec.dealAiExplanatoryNotes ? (
                    <div className="text-xs text-gray-600 leading-relaxed line-clamp-3">{rec.dealAiExplanatoryNotes}</div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">No AI notes generated for this deal.</div>
                  )}
                </div>

                {/* Documents — always shown */}
                <div className="border-t border-gray-100 pt-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Documents</div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div>Excel / Financial Model: <span className={`font-medium ${rec.dealExcelModelUrl ? "text-green-700" : "text-amber-600"}`}>{rec.dealExcelModelUrl ? "Attached" : "Not provided — will not be sent"}</span></div>
                    <div>Investment Memo (PDF): <span className={`font-medium ${rec.dealInvestmentMemoUrl ? "text-teal-700" : "text-gray-400"}`}>{rec.dealInvestmentMemoUrl ? "Attached" : "Not provided"}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
              Summary for Developer
              {rec.dealDeveloperSummary && <span className="text-gray-400 font-normal">(pre-filled from deal)</span>}
            </label>
            <Textarea
              value={summary}
              onChange={e => { setSummary(e.target.value); setDirty(true); }}
              placeholder="Write a brief summary of this deal for the developer…"
              rows={4}
              className="text-sm resize-none bg-white"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {rec.dealExcelModelUrl && (
              <a href={rec.dealExcelModelUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                📊 View Excel / Financial Model
              </a>
            )}
            {rec.dealInvestmentMemoUrl && (
              <a href={rec.dealInvestmentMemoUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors">
                📎 View Investment Memo
              </a>
            )}
            {dirty && (
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 hover:border-catalyst-navy hover:text-catalyst-navy px-3 py-1.5 rounded-lg transition-colors ml-auto"
              >
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save draft
              </button>
            )}
            <button
              onClick={handleSaveAndSend}
              disabled={sending}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-catalyst-navy hover:bg-catalyst-navy/90 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-60 ml-auto"
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {sending ? "Sending…" : `Send to ${rec.devCompanyName}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Outbox Tab ────────────────────────────────────────────────────────────────
function OutboxTab() {
  const { toast } = useToast();
  const [showSent, setShowSent] = useState(false);
  const { data, isLoading, refetch } = useQuery<{ success: boolean; outbox: OutboxRecord[] }>({
    queryKey: ["/api/partner-developers/outbox"],
    refetchInterval: 30000,
  });

  const backfillMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/partner-developers/outbox/backfill"),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-developers/outbox"] });
      if (result.queued === 0) {
        toast({ title: "No new matches found", description: `Scanned ${result.dealsScanned} deals — all matches already in outbox.` });
      } else {
        toast({ title: `${result.queued} deal${result.queued === 1 ? "" : "s"} queued`, description: `Scanned ${result.dealsScanned} classified deals across ${result.developers} developer buy boxes.` });
      }
    },
    onError: (e: any) => toast({ title: "Backfill failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const all = (data?.outbox ?? []).filter(r => r.dealApex === true);
  const pending = all.filter(r => r.status === "pending");
  const sent = all.filter(r => r.status === "sent");
  const display = showSent ? all : pending;

  if (isLoading) return <div className="text-center py-16 text-gray-400">Loading outbox…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-600">
            When a deal matches a developer's buy box, it appears here for review before sending.
            Edit the zoning or summary, attach an Excel model, then send.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Developers with <span className="font-semibold text-teal-700">Auto-send ON</span> are emailed automatically — those matches show as "Sent" immediately.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sent.length > 0 && (
            <button
              onClick={() => setShowSent(s => !s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${showSent ? "bg-gray-100 border-gray-300 text-gray-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
            >
              {showSent ? "Hide sent" : `Show sent (${sent.length})`}
            </button>
          )}
          <button
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-catalyst-navy hover:bg-catalyst-navy/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {backfillMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            {backfillMutation.isPending ? "Scanning…" : "Scan Existing Deals"}
          </button>
        </div>
      </div>

      {pending.length === 0 && !showSent ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <h3 className="font-semibold text-gray-500 mb-1">Outbox is empty</h3>
          <p className="text-sm text-gray-400 mb-4">
            Click <span className="font-semibold text-catalyst-navy">Scan Existing Deals</span> to match your 300+ deals against developer buy boxes.
            Going forward, new deals will queue automatically once classified.
          </p>
          <button
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-catalyst-navy hover:bg-catalyst-navy/90 px-4 py-2 rounded-lg transition-colors disabled:opacity-60 mx-auto"
          >
            {backfillMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {backfillMutation.isPending ? "Scanning 300+ deals…" : "Scan Existing Deals"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {display.map(rec => (
            <OutboxRow
              key={rec.id}
              rec={rec}
              onSent={() => refetch()}
              onDismiss={() => refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PartnerDevelopersAdmin() {
  const [tab, setTab] = useState<"buyers" | "routing" | "outbox">("outbox");
  const [search, setSearch] = useState("");
  const [editingDev, setEditingDev] = useState<PartnerDeveloper | null>(null);
  const [deletingDev, setDeletingDev] = useState<PartnerDeveloper | null>(null);

  const { data: devData, isLoading: devLoading } = useQuery<{ success: boolean; developers: PartnerDeveloper[] }>({
    queryKey: ["/api/partner-developers"],
  });

  const { data: routingData, isLoading: routingLoading } = useQuery<{ success: boolean; routing: DealRoutingEntry[] }>({
    queryKey: ["/api/partner-developers/routing"],
  });

  const { data: outboxData } = useQuery<{ success: boolean; outbox: OutboxRecord[] }>({
    queryKey: ["/api/partner-developers/outbox"],
    refetchInterval: 30000,
  });

  const developers = devData?.developers ?? [];
  const routing = routingData?.routing ?? [];
  const pendingCount = (outboxData?.outbox ?? []).filter(r => r.dealApex === true && r.status === "pending").length;

  const totalMatchCount = (() => {
    const seen = new Set<string>();
    routing.forEach(r => r.matchingDeals.forEach(d => seen.add(d.id)));
    return seen.size;
  })();

  const filtered = useMemo(() => {
    if (!search.trim()) return developers;
    const q = search.toLowerCase();
    return developers.filter(d =>
      d.companyName.toLowerCase().includes(q) ||
      d.contactName.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      (d.targetStates ?? []).some(s => s.toLowerCase().includes(q)) ||
      (d.productTypes ?? []).some(pt => pt.toLowerCase().includes(q))
    );
  }, [developers, search]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/partner-developers/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/partner-developers"] }); setDeletingDev(null); },
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />

      {editingDev && <EditDeveloperModal dev={editingDev} onClose={() => setEditingDev(null)} />}

      {deletingDev && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-catalyst-navy text-base mb-2">Delete Developer</h2>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete <span className="font-semibold">{deletingDev.companyName}</span>? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingDev(null)} className="h-8 text-sm">Cancel</Button>
              <Button onClick={() => deleteMutation.mutate(deletingDev.id)} disabled={deleteMutation.isPending}
                className="h-8 text-sm bg-red-600 hover:bg-red-700 text-white border-0">
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-bold text-catalyst-navy leading-tight">Partner Developers</h1>
              <p className="text-xs text-gray-500">Buy box registrations & automatic deal routing</p>
            </div>
            <div className="hidden sm:flex items-center gap-5 text-center">
              <div>
                <div className="text-lg font-bold text-catalyst-navy leading-tight">{developers.length}</div>
                <div className="text-[11px] text-gray-500">Registered</div>
              </div>
              <div className="w-px h-7 bg-gray-200" />
              <div>
                <div className="text-lg font-bold text-teal-600 leading-tight">{developers.filter(d => d.autoSendEnabled && d.isActive).length}</div>
                <div className="text-[11px] text-gray-500">Auto-send ON</div>
              </div>
              <div className="w-px h-7 bg-gray-200" />
              <div>
                <div className={`text-lg font-bold leading-tight ${pendingCount > 0 ? "text-amber-600" : "text-gray-400"}`}>{pendingCount}</div>
                <div className="text-[11px] text-gray-500">Pending Send</div>
              </div>
            </div>
          </div>

          <div className="flex gap-1 mt-4 border-b border-gray-200 -mb-px">
            <button onClick={() => setTab("outbox")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === "outbox" ? "border-catalyst-navy text-catalyst-navy" : "border-transparent text-gray-500 hover:text-catalyst-navy"}`}>
              <Inbox className="w-3.5 h-3.5" />
              Outbox
              {pendingCount > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {pendingCount}
                </span>
              )}
            </button>
            <button onClick={() => setTab("buyers")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "buyers" ? "border-catalyst-navy text-catalyst-navy" : "border-transparent text-gray-500 hover:text-catalyst-navy"}`}>
              Developers ({developers.length})
            </button>
            <button onClick={() => setTab("routing")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === "routing" ? "border-catalyst-navy text-catalyst-navy" : "border-transparent text-gray-500 hover:text-catalyst-navy"}`}>
              Deal Routing
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-5 flex-1">
        {tab === "outbox" && <OutboxTab />}

        {tab === "buyers" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search developers, states, types…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-teal-600" />
                Deals auto-send to active developers whose buy box matches — no manual action needed.
              </p>
            </div>

            {devLoading ? (
              <div className="text-center py-16 text-gray-400">Loading registered developers…</div>
            ) : developers.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <Network className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <h3 className="font-semibold text-gray-600 mb-1">No developers registered yet</h3>
                <p className="text-sm text-gray-400 mb-4">Share the registration page with potential partner developers.</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open("/developer-network", "_blank")}>
                  <ExternalLink className="w-3.5 h-3.5" /> Open Registration Page
                </Button>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Company / Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Info</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">States</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product Types</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Deal Pref</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Matches</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(dev => {
                      const devRouting = routing.find(r => r.developer.id === dev.id);
                      return (
                        <DeveloperRow
                          key={dev.id}
                          dev={dev}
                          routingData={devRouting?.matchingDeals}
                          onEdit={setEditingDev}
                          onDelete={setDeletingDev}
                        />
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && search && (
                  <div className="text-center py-8 text-gray-400 text-sm">No developers match "{search}"</div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "routing" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              All deals that match at least one developer's buy box criteria — regardless of classification.
              Deals are auto-emailed at the time of classification. Use the buttons below to manually route a deal.
            </p>
            {routingLoading ? (
              <div className="text-center py-16 text-gray-400">Loading routing data…</div>
            ) : (
              <AllDealRoutingTab routingData={routing} />
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

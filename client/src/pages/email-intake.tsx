import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import {
  CheckCircle, XCircle, Mail, Paperclip, ChevronDown, ChevronUp,
  Edit2, Clock, AlertTriangle, RefreshCw, BookOpen, TrendingUp,
  Trash2, Brain, Star, PlusCircle, Info
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface IntakeItem {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  emailBody: string | null;
  attachmentCount: number;
  attachmentNames: string[];
  parsedDealType: string | null;
  parsedPropertyName: string | null;
  parsedAddress: string | null;
  parsedCity: string | null;
  parsedState: string | null;
  parsedZip: string | null;
  parsedAcres: string | null;
  parsedPrice: number | null;
  parsedUnitCount: number | null;
  parsedVintage: number | null;
  parsedBrokerName: string | null;
  parsedBrokerEmail: string | null;
  parsedBrokerPhone: string | null;
  parsedNotes: string | null;
  parsedZoning: string | null;
  overallConfidence: string | null;
  fieldConfidences: Record<string, number> | null;
  status: "pending" | "approved" | "rejected";
  dealId: string | null;
  reviewedAt: string | null;
  correctionCount?: number;
  isTrainingExample?: boolean;
  groupId?: string | null;
  groupIndex?: number | null;
  groupTotal?: number | null;
  createdAt: string;
}

interface TrainingStats {
  totalApproved: number;
  totalWithCorrections: number;
  avgCorrectionsPerEmail: number;
  fieldCorrectionRates: Record<string, number>;
  trainingExampleCount: number;
  recentAccuracyTrend: { label: string; accuracy: number }[];
}

interface TrainingExample {
  id: string;
  intakeId: string | null;
  subject: string | null;
  fromEmail: string | null;
  label: string;
  useInPrompt: boolean;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function confidenceBadge(score: number | string | null | undefined) {
  const n = Number(score ?? 0);
  if (n >= 75) return <Badge className="bg-green-100 text-green-800 border-green-200">{n}% confidence</Badge>;
  if (n >= 40) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">{n}% confidence</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200">{n}% confidence</Badge>;
}

function fieldConf(confidences: Record<string, number> | null, field: string) {
  if (!confidences) return null;
  const n = confidences[field];
  if (n == null) return null;
  const color = n >= 75 ? "text-green-600" : n >= 40 ? "text-yellow-600" : "text-red-500";
  return <span className={`text-[10px] ${color} ml-1`}>{n}%</span>;
}

function formatPrice(p: number | null | undefined) {
  if (!p) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p);
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ item, open, onClose, onApprove }: {
  item: IntakeItem; open: boolean; onClose: () => void;
  onApprove: (overrides: Record<string, any>) => void;
}) {
  const [fields, setFields] = useState({
    dealType: item.parsedDealType ?? "unknown",
    propertyName: item.parsedPropertyName ?? "",
    address: item.parsedAddress ?? "",
    city: item.parsedCity ?? "",
    state: item.parsedState ?? "",
    zip: item.parsedZip ?? "",
    acres: item.parsedAcres ?? "",
    price: item.parsedPrice ? String(item.parsedPrice) : "",
    unitCount: item.parsedUnitCount ? String(item.parsedUnitCount) : "",
    vintage: item.parsedVintage ? String(item.parsedVintage) : "",
    brokerName: item.parsedBrokerName ?? "",
    brokerEmail: item.parsedBrokerEmail ?? "",
    brokerPhone: item.parsedBrokerPhone ?? "",
    notes: item.parsedNotes ?? "",
    zoning: item.parsedZoning ?? "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields(f => ({ ...f, [k]: e.target.value }));

  const handleApprove = () => {
    const overrides: Record<string, any> = {};
    if (fields.address) overrides.address = fields.address;
    if (fields.city) overrides.city = fields.city;
    if (fields.state) overrides.state = fields.state;
    if (fields.zip) overrides.zip = fields.zip;
    if (fields.acres) overrides.acres = parseFloat(fields.acres);
    if (fields.price) overrides.price = parseInt(fields.price.replace(/[^0-9]/g, ""));
    if (fields.unitCount) overrides.unitCount = parseInt(fields.unitCount);
    if (fields.vintage) overrides.vintage = parseInt(fields.vintage);
    if (fields.brokerName) overrides.brokerName = fields.brokerName;
    if (fields.brokerEmail) overrides.brokerEmail = fields.brokerEmail;
    if (fields.brokerPhone) overrides.brokerPhone = fields.brokerPhone;
    if (fields.dealType) overrides.dealType = fields.dealType;
    if (fields.propertyName) overrides.propertyName = fields.propertyName;
    if (fields.notes) overrides.notes = fields.notes;
    if (fields.zoning) overrides.zoning = fields.zoning;
    onApprove(overrides);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Review & Edit — {item.subject || item.fromEmail}</DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            Corrections you make here are automatically saved as AI training data.
          </p>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
          <div className="col-span-2">
            <Label className="text-xs text-gray-500">Deal Type</Label>
            <div className="flex gap-2 mt-1">
              {[
                { value: "land_development", label: "🏗️ Land / Development Site" },
                { value: "existing_multifamily", label: "🏢 Existing Multifamily Sale" },
                { value: "unknown", label: "❓ Unknown" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFields(f => ({ ...f, dealType: opt.value }))}
                  className={`flex-1 text-xs py-1.5 px-2 rounded border transition-colors ${
                    fields.dealType === opt.value
                      ? opt.value === "land_development"
                        ? "bg-green-100 border-green-400 text-green-800 font-medium"
                        : opt.value === "existing_multifamily"
                        ? "bg-blue-100 border-blue-400 text-blue-800 font-medium"
                        : "bg-gray-100 border-gray-400 text-gray-700 font-medium"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-gray-500">Property / Listing Name</Label>
            <Input value={fields.propertyName} onChange={set("propertyName")} placeholder="Eastwood Village Phase 2" className="mt-1 h-8 text-sm" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-gray-500">Street Address</Label>
            <Input value={fields.address} onChange={set("address")} placeholder="123 Main St" className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">City</Label>
            <Input value={fields.city} onChange={set("city")} className="mt-1 h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">State</Label>
              <Input value={fields.state} onChange={set("state")} placeholder="NC" maxLength={2} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">ZIP</Label>
              <Input value={fields.zip} onChange={set("zip")} className="mt-1 h-8 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Acreage</Label>
            <Input value={fields.acres} onChange={set("acres")} placeholder="12.5" className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Asking Price ($)</Label>
            <Input value={fields.price} onChange={set("price")} placeholder="1500000" className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Unit Count</Label>
            <Input value={fields.unitCount} onChange={set("unitCount")} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Vintage (Year Built)</Label>
            <Input value={fields.vintage} onChange={set("vintage")} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Zoning</Label>
            <Input value={fields.zoning} onChange={set("zoning")} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Broker Name</Label>
            <Input value={fields.brokerName} onChange={set("brokerName")} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Broker Email</Label>
            <Input value={fields.brokerEmail} onChange={set("brokerEmail")} className="mt-1 h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Broker Phone</Label>
            <Input value={fields.brokerPhone} onChange={set("brokerPhone")} className="mt-1 h-8 text-sm" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-gray-500">Notes</Label>
            <Textarea value={fields.notes} onChange={set("notes")} rows={3} className="mt-1 text-sm resize-none" />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleApprove}>
            <CheckCircle className="w-4 h-4 mr-1" /> Approve & Create Deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Training Stats Panel ─────────────────────────────────────────────────────

function TrainingStatsPanel() {
  const { data: stats, isLoading } = useQuery<TrainingStats>({
    queryKey: ["/api/email-intake/training-stats"],
    queryFn: async () => {
      const res = await fetch("/api/email-intake/training-stats", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: examples = [], refetch: refetchExamples } = useQuery<TrainingExample[]>({
    queryKey: ["/api/email-intake/training-examples"],
    queryFn: async () => {
      const res = await fetch("/api/email-intake/training-examples", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, useInPrompt }: { id: string; useInPrompt: boolean }) => {
      const res = await fetch(`/api/email-intake/training-examples/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ useInPrompt }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-intake/training-examples"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-intake/training-stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/email-intake/training-examples/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-intake/training-examples"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-intake/training-stats"] });
    },
  });

  const fields = ['address', 'city', 'state', 'zip', 'acres', 'price', 'unitCount', 'vintage', 'brokerName', 'notes'];
  const rates = stats?.fieldCorrectionRates ?? {};

  if (isLoading) return <div className="text-center py-12 text-gray-400 text-sm">Loading training data…</div>;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Approved", value: stats?.totalApproved ?? 0, icon: CheckCircle, color: "text-green-600" },
          { label: "Had AI Corrections", value: stats?.totalWithCorrections ?? 0, icon: Edit2, color: "text-yellow-600" },
          { label: "Avg Fields Corrected", value: stats?.avgCorrectionsPerEmail ?? 0, icon: TrendingUp, color: "text-blue-600" },
          { label: "Training Examples Active", value: stats?.trainingExampleCount ?? 0, icon: Brain, color: "text-purple-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border border-gray-200">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <div className="text-2xl font-semibold text-gray-800">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* How it works callout */}
      <Card className="border border-blue-100 bg-blue-50/40">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-start gap-2">
            <Brain className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-800">
              <span className="font-semibold">How continuous learning works:</span> Every time you approve an email, the AI output and your final values are saved as a training example. If you corrected any fields, those corrections are stored as a "correction" example. The next time an email arrives, the AI is shown the 5 most recent high-quality examples and told "here's what the correct output looks like." Over time, this drives the AI's parse accuracy toward 100% — no manual re-training required.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-field correction rates */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700">Field Accuracy (% of approved emails where AI was correct)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {fields.map(field => {
              const corrRate = rates[field] ?? 0;
              const accuracy = 100 - corrRate;
              const barColor = accuracy >= 90 ? "bg-green-500" : accuracy >= 70 ? "bg-yellow-500" : "bg-red-500";
              return (
                <div key={field} className="flex items-center gap-3 text-xs">
                  <span className="w-20 text-gray-500 capitalize shrink-0">{field}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${accuracy}%` }} />
                  </div>
                  <span className={`w-10 text-right font-medium ${accuracy >= 90 ? "text-green-700" : accuracy >= 70 ? "text-yellow-700" : "text-red-700"}`}>
                    {accuracy}%
                  </span>
                </div>
              );
            })}
          </div>
          {stats?.totalApproved === 0 && (
            <p className="text-xs text-gray-400 mt-3 italic">Approve some emails to start generating accuracy data.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent accuracy trend */}
      {(stats?.recentAccuracyTrend?.length ?? 0) > 0 && (
        <Card className="border border-gray-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700">Parse Accuracy Trend (% perfect, no corrections needed)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end gap-3 h-16">
              {stats!.recentAccuracyTrend.map(({ label, accuracy }) => (
                <div key={label} className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-full bg-gray-100 rounded relative" style={{ height: "48px" }}>
                    <div
                      className="bg-blue-500 rounded absolute bottom-0 w-full transition-all"
                      style={{ height: `${accuracy}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Training examples list */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-600" />
            Training Examples Used in AI Prompt ({examples.filter(e => e.useInPrompt).length} active)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {examples.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No training examples yet. Approve emails to start building the example bank.</p>
          ) : (
            <div className="space-y-2">
              {examples.map(ex => (
                <div key={ex.id} className={`flex items-center gap-3 text-xs border rounded px-3 py-2 ${ex.useInPrompt ? "border-purple-200 bg-purple-50/30" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-700 truncate">{ex.subject || "(No subject)"}</div>
                    <div className="text-gray-400">{ex.fromEmail} · {timeAgo(ex.createdAt)}</div>
                  </div>
                  <Badge className={`shrink-0 ${ex.label === "correction" ? "bg-yellow-100 text-yellow-800 border-yellow-200" : "bg-green-100 text-green-800 border-green-200"}`}>
                    {ex.label === "correction" ? "correction" : "positive"}
                  </Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={ex.useInPrompt}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: ex.id, useInPrompt: v })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(ex.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Single card ──────────────────────────────────────────────────────────────

function IntakeCard({ item, onApprove, onReject, onSaveTraining, approving, rejecting, savingTraining, onReparsed }: {
  item: IntakeItem;
  onApprove: (id: string, overrides: Record<string, any>) => void;
  onReject: (id: string) => void;
  onSaveTraining: (id: string) => void;
  onReparsed: () => void;
  approving: boolean;
  rejecting: boolean;
  savingTraining: boolean;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const conf = item.fieldConfidences;

  const reparseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/email-intake/${item.id}/reparse`, { method: 'POST', credentials: 'include' });
      if (!res.ok) { const j = await res.json(); throw new Error(j.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Re-parsed", description: "AI extracted fresh data — fields updated." });
      onReparsed();
    },
    onError: (e: any) => toast({ title: "Re-parse failed", description: e.message, variant: "destructive" }),
  });

  const fullAddress = [item.parsedAddress, item.parsedCity, item.parsedState, item.parsedZip]
    .filter(Boolean).join(", ");

  const isPending = item.status === "pending";

  return (
    <Card className={`border ${item.status === "approved" ? "border-green-200 bg-green-50/30" : item.status === "rejected" ? "border-red-200 bg-red-50/30 opacity-60" : "border-gray-200"}`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-800 truncate">{item.fromEmail}</span>
              {item.attachmentCount > 0 && (
                <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
                  <Paperclip className="w-3 h-3" />{item.attachmentCount}
                </span>
              )}
              {confidenceBadge(item.overallConfidence)}
              {item.status === "approved" && (
                <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
                  <CheckCircle className="w-3 h-3" /> Approved
                  {item.correctionCount != null && item.correctionCount > 0 && (
                    <span className="ml-1 text-yellow-700">· {item.correctionCount} corrected</span>
                  )}
                </Badge>
              )}
              {item.status === "rejected" && (
                <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
                  <XCircle className="w-3 h-3" /> Rejected
                </Badge>
              )}
              {item.isTrainingExample && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 gap-1">
                  <Star className="w-3 h-3" /> Training
                </Badge>
              )}
              {item.groupTotal && item.groupTotal > 1 && (
                <Badge
                  className="bg-amber-100 text-amber-800 border-amber-200 gap-1"
                  title="This email listed multiple properties — each was split into its own review entry"
                >
                  <Mail className="w-3 h-3" /> {item.groupIndex} of {item.groupTotal} properties
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 truncate">
              {item.subject || "(No subject)"} · {timeAgo(item.createdAt)}
            </div>
          </div>
          {isPending && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm" variant="outline"
                className="h-7 px-2 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                disabled={reparseMutation.isPending}
                onClick={() => reparseMutation.mutate()}
                title="Re-run AI extraction with latest prompt"
              >
                <RefreshCw className={`w-3 h-3 ${reparseMutation.isPending ? "animate-spin" : ""}`} />
                {reparseMutation.isPending ? "Parsing…" : "Re-Parse"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setEditOpen(true)}>
                <Edit2 className="w-3 h-3" /> Edit
              </Button>
              <Button
                size="sm"
                className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                disabled={approving}
                onClick={() => onApprove(item.id, {})}
              >
                <CheckCircle className="w-3 h-3" />
                {approving ? "Creating…" : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                disabled={rejecting}
                onClick={() => onReject(item.id)}
              >
                <XCircle className="w-3 h-3" />
                {rejecting ? "…" : "Reject"}
              </Button>
            </div>
          )}
          {item.status === "approved" && (
            <div className="flex items-center gap-2 shrink-0">
              {item.dealId && (
                <a href={`/dashboard?dealId=${item.dealId}`} className="text-xs text-blue-600 hover:underline">
                  View Deal →
                </a>
              )}
              {!item.isTrainingExample && (
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200 hover:text-purple-800 gap-1 shadow-none"
                  disabled={savingTraining}
                  onClick={() => onSaveTraining(item.id)}
                >
                  <Star className="w-3 h-3" />
                  {savingTraining ? "Saving…" : "Save for AI"}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {item.parsedDealType === "land_development" && (
            <span className="text-[11px] font-medium bg-green-100 text-green-800 border border-green-200 rounded px-2 py-0.5">
              🏗️ Land / Development Site
            </span>
          )}
          {item.parsedDealType === "existing_multifamily" && (
            <span className="text-[11px] font-medium bg-blue-100 text-blue-800 border border-blue-200 rounded px-2 py-0.5">
              🏢 Existing Multifamily Sale
            </span>
          )}
          {item.parsedPropertyName && (
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 truncate max-w-xs">
              {item.parsedPropertyName}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs mb-2">
          <div>
            <span className="text-gray-400">Address</span>
            {fieldConf(conf, "address")}
            <div className="font-medium text-gray-800 truncate">
              {fullAddress || <span className="text-red-400 italic">Not found</span>}
            </div>
          </div>
          <div>
            <span className="text-gray-400">Acreage</span>
            {fieldConf(conf, "acres")}
            <div className="font-medium text-gray-800">
              {item.parsedAcres ? `${parseFloat(item.parsedAcres).toFixed(2)} ac` : <span className="italic text-gray-400">—</span>}
            </div>
          </div>
          <div>
            <span className="text-gray-400">Asking Price</span>
            {fieldConf(conf, "price")}
            <div className="font-medium text-gray-800">
              {formatPrice(item.parsedPrice) || <span className="italic text-gray-400">—</span>}
            </div>
          </div>
          <div>
            <span className="text-gray-400">Units / Vintage</span>
            <div className="font-medium text-gray-800">
              {item.parsedUnitCount ? `${item.parsedUnitCount}u` : "—"}{item.parsedVintage ? ` · ${item.parsedVintage}` : ""}
            </div>
          </div>
        </div>

        {item.parsedNotes && (
          <p className="text-xs text-gray-600 italic border-l-2 border-gray-200 pl-2 mb-2 line-clamp-2">{item.parsedNotes}</p>
        )}
        {item.attachmentNames?.length > 0 && (
          <div className="text-[11px] text-gray-500 mb-2">
            <Paperclip className="w-3 h-3 inline mr-1" />{item.attachmentNames.join(", ")}
          </div>
        )}

        <button
          className="text-[11px] text-blue-500 hover:text-blue-700 flex items-center gap-1"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide" : "Show"} original email
        </button>
        {expanded && (
          <pre className="mt-2 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded p-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans">
            {item.emailBody || "(empty)"}
          </pre>
        )}
      </CardContent>

      {editOpen && (
        <EditModal
          item={item}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onApprove={(overrides) => { setEditOpen(false); onApprove(item.id, overrides); }}
        />
      )}
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

// ── Manual Submit Modal ──────────────────────────────────────────────────────

function ManualSubmitModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/email-intake/manual-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ from, subject, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Submission failed");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Email submitted", description: "AI is parsing it now — check the Pending tab." });
      setFrom(""); setSubject(""); setText("");
      onClose();
      onSuccess();
    },
    onError: (e: any) => toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-blue-600" /> Manually Submit an Email
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            Paste any deal email here and the AI will parse it instantly — same as if it was forwarded to deals@catalyst.landlinq.ai.
          </p>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">SendGrid webhook not firing?</span> Make sure your SendGrid Inbound Parse is set to forward emails to:<br />
            <code className="bg-amber-100 px-1 rounded mt-1 inline-block font-mono text-[11px]">
              https://landlinq.replit.app/api/inbound-email
            </code>
            <br />and that MX records for <code className="font-mono">landlinq.ai</code> point to <code className="font-mono">mx.sendgrid.net</code>.
          </div>
        </div>

        <div className="space-y-3 mt-1">
          <div>
            <Label className="text-xs text-gray-500">From (broker's email address)</Label>
            <Input
              value={from}
              onChange={e => setFrom(e.target.value)}
              placeholder="jdnicholas225@gmail.com"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Nashville — Riverside Apartments (180 Units)"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Email Body — paste the full text of the email</Label>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={"Hey Jack —\nWanted to run another deal by you...\n\nRiverside Apartments — 1200 River Rd, Nashville, TN (~12.5 acres, 180 units, 2001)"}
              rows={8}
              className="mt-1 text-sm font-mono resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!from.trim() || !text.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Parsing…" : "Submit for AI Parsing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Bulk Re-Parse Button ─────────────────────────────────────────────────────

function BulkReparseButton({ count, onDone }: { count: number; onDone: () => void }) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/email-intake/bulk-reparse', { method: 'POST', credentials: 'include' });
      if (!res.ok) { const j = await res.json(); throw new Error(j.message); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Re-parsing in progress",
        description: `${data.processing} emails queued. Refresh in ~${Math.ceil(data.processing * 3 / 60)} minute(s) to see updated results.`,
      });
      setTimeout(() => onDone(), 8000);
    },
    onError: (e: any) => toast({ title: "Bulk re-parse failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Button
      variant="outline" size="sm"
      className="gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      title={`Re-run AI extraction on all ${count} pending emails using the latest improved prompt`}
    >
      <Brain className={`w-3.5 h-3.5 ${mutation.isPending ? "animate-pulse" : ""}`} />
      {mutation.isPending ? "Queuing…" : `Re-Parse All (${count})`}
    </Button>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function EmailIntakePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "training">("pending");
  const [actionItem, setActionItem] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const { data: items = [], isLoading, refetch } = useQuery<IntakeItem[]>({
    queryKey: ["/api/email-intake", tab],
    queryFn: async () => {
      if (tab === "training") return [];
      const res = await fetch(`/api/email-intake?status=${tab}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    refetchInterval: 30000,
    enabled: tab !== "training",
  });

  const pendingCount = useQuery<{ count: number }>({
    queryKey: ["/api/email-intake/count"],
    queryFn: async () => {
      const res = await fetch("/api/email-intake/count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, overrides }: { id: string; overrides: Record<string, any> }) => {
      setActionItem(id);
      const res = await fetch(`/api/email-intake/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ overrides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Approval failed");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Deal created", description: "Deal created from email and training example saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/email-intake"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
    },
    onError: (e: any) => toast({ title: "Approval failed", description: e.message, variant: "destructive" }),
    onSettled: () => setActionItem(null),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      setActionItem(id);
      const res = await fetch(`/api/email-intake/${id}/reject`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Rejection failed");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Email rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/email-intake"] });
    },
    onError: (e: any) => toast({ title: "Rejection failed", description: e.message, variant: "destructive" }),
    onSettled: () => setActionItem(null),
  });

  const saveTrainingMutation = useMutation({
    mutationFn: async (id: string) => {
      setActionItem(id);
      const res = await fetch(`/api/email-intake/${id}/save-training`, { method: "POST", credentials: "include" });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try { msg = JSON.parse(text)?.message || text; } catch {}
        throw new Error(msg || "Save failed");
      }
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => {
      toast({ title: "Saved for AI training", description: "This example will be used to improve future parses." });
      queryClient.invalidateQueries({ queryKey: ["/api/email-intake"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-intake/training-stats"] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
    onSettled: () => setActionItem(null),
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />

      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Email Intake Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Emails to <span className="font-mono text-xs bg-gray-100 px-1 rounded">deals@catalyst.landlinq.ai</span> are AI-parsed here. Approve to create a deal. Every approval auto-trains the AI.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pendingCount.data?.count != null && pendingCount.data.count > 0 && (
              <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {pendingCount.data.count} pending
              </Badge>
            )}
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={() => setManualOpen(true)}>
              <PlusCircle className="w-3.5 h-3.5" /> Submit Email
            </Button>
            {tab === "pending" && pendingCount.data?.count != null && pendingCount.data.count > 0 && (
              <BulkReparseButton count={pendingCount.data.count} onDone={() => refetch()} />
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/launchpad"} className="gap-1.5">
              ← Launchpad
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mb-5">
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Pending
              {pendingCount.data?.count != null && pendingCount.data.count > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                  {pendingCount.data.count}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Rejected
            </TabsTrigger>
            <TabsTrigger value="training" className="gap-1.5">
              <Brain className="w-3.5 h-3.5" /> AI Training
            </TabsTrigger>
          </TabsList>

          {tab === "training" ? (
            <TabsContent value="training">
              <TrainingStatsPanel />
            </TabsContent>
          ) : (
            <TabsContent value={tab}>
              {isLoading ? (
                <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
              ) : items.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No {tab} emails.</p>
                  {tab === "pending" && (
                    <p className="text-xs mt-1">Broker emails sent to deals@catalyst.landlinq.ai will appear here.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => (
                    <IntakeCard
                      key={item.id}
                      item={item}
                      onApprove={(id, overrides) => approveMutation.mutate({ id, overrides })}
                      onReject={(id) => rejectMutation.mutate(id)}
                      onSaveTraining={(id) => saveTrainingMutation.mutate(id)}
                      onReparsed={() => refetch()}
                      approving={approveMutation.isPending && actionItem === item.id}
                      rejecting={rejectMutation.isPending && actionItem === item.id}
                      savingTraining={saveTrainingMutation.isPending && actionItem === item.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      <ManualSubmitModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSuccess={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/email-intake/count"] }); }}
      />

      <Footer />
    </div>
  );
}

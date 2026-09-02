import { useState } from "react";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Pencil, Trash2, X, Search,
  CheckCircle, Clock, XCircle, Mail, Phone,
  Building2, ShieldCheck, ShieldOff, TrendingUp
} from "lucide-react";

type BrokerAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  brokerage?: string;
  phone?: string;
  status: "active" | "pending" | "inactive";
  targetStates: string[];
  targetMsas: string[];
  targetCities: string[];
  notes?: string;
  lastLoginAt?: string;
  createdAt: string;
};

type QueueDeal = {
  id: string;
  address: string;
  city: string;
  state: string;
  property_name?: string;
  asking_price?: string;
  unit_count?: number;
  max_units_by_zoning?: number;
  size_acres?: string;
  product_types?: string[];
  yield_on_cost?: string;
  broker_portal_approved: boolean;
  bestYoc: number;
  created_at: string;
  broker_first_name?: string;
  broker_last_name?: string;
  broker_email?: string;
  broker_brokerage?: string;
  broker_company?: string;
  document_urls?: string[];
  analyst_document_urls?: string[];
  investment_memo_url?: string | null;
};

const STATE_OPTIONS = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const DEFAULT_FORM = {
  firstName: "", lastName: "", email: "", password: "",
  brokerage: "", phone: "", status: "active" as const,
  targetStates: [] as string[], targetMsas: [] as string[],
  targetCities: [] as string[], notes: "",
};

function statusBadge(status: string) {
  if (status === "active") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-2.5 h-2.5" /> Active
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
      <Clock className="w-2.5 h-2.5" /> Pending
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
      <XCircle className="w-2.5 h-2.5" /> Inactive
    </span>
  );
}

function AccountModal({
  account,
  onClose,
}: {
  account: BrokerAccount | null;
  onClose: () => void;
}) {
  const isEdit = !!account;
  const [form, setForm] = useState(
    account
      ? {
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          password: "",
          brokerage: account.brokerage || "",
          phone: account.phone || "",
          status: account.status,
          targetStates: account.targetStates || [],
          targetMsas: account.targetMsas || [],
          targetCities: account.targetCities || [],
          notes: account.notes || "",
        }
      : { ...DEFAULT_FORM }
  );
  const [msaInput, setMsaInput] = useState("");
  const [cityInput, setCityInput] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit
        ? apiRequest("PUT", `/api/broker-portal/accounts/${account!.id}`, data)
        : apiRequest("POST", "/api/broker-portal/accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker-portal/accounts"] });
      onClose();
    },
  });

  const toggleState = (s: string) =>
    setForm(f => ({
      ...f,
      targetStates: f.targetStates.includes(s)
        ? f.targetStates.filter(x => x !== s)
        : [...f.targetStates, s],
    }));

  const addMsa = () => {
    const v = msaInput.trim();
    if (v && !form.targetMsas.includes(v)) {
      setForm(f => ({ ...f, targetMsas: [...f.targetMsas, v] }));
    }
    setMsaInput("");
  };

  const addCity = () => {
    const v = cityInput.trim();
    if (v && !form.targetCities.includes(v)) {
      setForm(f => ({ ...f, targetCities: [...f.targetCities, v] }));
    }
    setCityInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (isEdit && !payload.password) delete payload.password;
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="font-bold text-catalyst-navy text-base">
            {isEdit ? "Edit Broker Account" : "Create Broker Account"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
              <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required className="h-8 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
              <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required className="h-8 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="h-8 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {isEdit ? "New Password (leave blank to keep)" : "Password *"}
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required={!isEdit}
                minLength={8}
                className="h-8 text-sm"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Brokerage</label>
              <Input value={form.brokerage} onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))} className="h-8 text-sm" placeholder="Company name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
            <div className="flex gap-2">
              {(["active", "pending", "inactive"] as const).map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors capitalize ${form.status === s ? "bg-catalyst-navy text-white border-catalyst-navy" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Target States</label>
            <div className="flex flex-wrap gap-1">
              {STATE_OPTIONS.map(s => (
                <button key={s} type="button" onClick={() => toggleState(s)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${form.targetStates.includes(s) ? "bg-catalyst-navy text-white border-catalyst-navy" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Target MSAs</label>
              <div className="flex gap-1 mb-2">
                <Input
                  value={msaInput}
                  onChange={e => setMsaInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addMsa())}
                  placeholder="e.g. Raleigh-Durham"
                  className="h-7 text-xs"
                />
                <Button type="button" onClick={addMsa} variant="outline" size="sm" className="h-7 px-2 text-xs">Add</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.targetMsas.map(m => (
                  <span key={m} className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {m}
                    <button type="button" onClick={() => setForm(f => ({ ...f, targetMsas: f.targetMsas.filter(x => x !== m) }))}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Target Cities</label>
              <div className="flex gap-1 mb-2">
                <Input
                  value={cityInput}
                  onChange={e => setCityInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCity())}
                  placeholder="e.g. Charlotte"
                  className="h-7 text-xs"
                />
                <Button type="button" onClick={addCity} variant="outline" size="sm" className="h-7 px-2 text-xs">Add</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.targetCities.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                    {c}
                    <button type="button" onClick={() => setForm(f => ({ ...f, targetCities: f.targetCities.filter(x => x !== c) }))}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Internal Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-catalyst-navy/30"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose} className="h-8 text-sm">Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="h-8 text-sm bg-catalyst-navy hover:bg-catalyst-navy/90 text-white">
              {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Account"}
            </Button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600 text-right">Failed to save. The email may already be in use.</p>
          )}
        </form>
      </div>
    </div>
  );
}

function DealApprovalsTab() {
  const { toast } = useToast();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const { data: deals = [], isLoading } = useQuery<QueueDeal[]>({
    queryKey: ["/api/admin/broker-portal/deal-queue"],
  });

  const approveMutation = useMutation({
    mutationFn: ({ dealId, approved }: { dealId: string; approved: boolean }) =>
      apiRequest("PATCH", `/api/admin/broker-portal/deals/${dealId}/approve`, { approved }).then(r => r.json()),
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broker-portal/deal-queue"] });
      setApprovingId(null);
      if (variables.approved) {
        const desc = data.emailsSent > 0
          ? `Deal added to broker portal. ${data.emailsSent} broker${data.emailsSent !== 1 ? "s" : ""} emailed.`
          : "Deal added to broker portal.";
        toast({ title: "Deal Approved", description: desc });
      } else {
        toast({ title: "Deal Removed", description: "Deal removed from broker portal." });
      }
    },
    onError: (err: any) => {
      setApprovingId(null);
      toast({ title: "Error", description: err?.message || "Failed to update deal", variant: "destructive" });
    },
  });

  const approvedDeals = deals.filter(d => d.broker_portal_approved);
  const pendingDeals = deals.filter(d => !d.broker_portal_approved);

  const fmt$ = (v: any) => v ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";

  const DealRow = ({ deal }: { deal: QueueDeal }) => {
    const isApproved = deal.broker_portal_approved;
    const isPending = approvingId === deal.id;
    const title = deal.property_name || deal.address || "Unknown";
    const location = [deal.city, deal.state].filter(Boolean).join(", ");
    const units = deal.unit_count ?? deal.max_units_by_zoning;
    const brokerName = [deal.broker_first_name, deal.broker_last_name].filter(Boolean).join(" ");
    const company = deal.broker_brokerage || deal.broker_company || null;

    return (
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="font-medium text-catalyst-navy text-sm leading-tight">{title}</div>
          <div className="text-xs text-gray-500 mt-0.5">{location}</div>
        </td>
        <td className="px-4 py-3">
          {brokerName ? (
            <>
              <div className="text-sm text-gray-700 font-medium leading-tight">{brokerName}</div>
              {company && <div className="text-xs text-gray-500 mt-0.5">{company}</div>}
              {deal.broker_email && (
                <a href={`mailto:${deal.broker_email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5">
                  <Mail className="w-3 h-3" />{deal.broker_email}
                </a>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400 italic">No broker</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-600">
          {units ? `${Number(units).toLocaleString()} units` : deal.size_acres ? `${Number(deal.size_acres).toFixed(1)} ac` : "—"}
        </td>
        <td className="px-4 py-3 text-xs text-gray-600">{fmt$(deal.asking_price)}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${deal.bestYoc >= 7 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            <TrendingUp className="w-3 h-3" />
            {deal.bestYoc.toFixed(1)}%
          </span>
        </td>
        <td className="px-4 py-3">
          {isApproved ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-2.5 h-2.5" /> In Portal
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              <ShieldOff className="w-2.5 h-2.5" /> Not Approved
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              disabled={isPending}
              onClick={() => {
                setApprovingId(deal.id);
                approveMutation.mutate({ dealId: deal.id, approved: !isApproved });
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                isApproved
                  ? "border-red-300 text-red-600 hover:bg-red-50"
                  : "border-green-500 text-green-700 bg-green-50 hover:bg-green-100"
              }`}
            >
              {isPending ? "..." : isApproved ? "Remove" : "Approve & Notify"}
            </button>
          </div>
        </td>
      </tr>
    );
  };

  if (isLoading) return <div className="text-center py-16 text-gray-400">Loading deals...</div>;

  if (deals.length === 0) return (
    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
      <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-200" />
      <h3 className="font-semibold text-gray-600 mb-1">No qualifying deals yet</h3>
      <p className="text-sm text-gray-400">Deals with a YOC of 6%+ will appear here for approval.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            <span className="text-gray-600">{approvedDeals.length} in portal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />
            <span className="text-gray-600">{pendingDeals.length} awaiting approval</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">All Qualifying Deals (YOC ≥ 6%)</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Property</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Broker</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Size</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Asking</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">YOC</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody>
            {deals.map(deal => <DealRow key={deal.id} deal={deal} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PartnerBrokersAdmin() {
  const [tab, setTab] = useState<"accounts" | "approvals">("accounts");
  const [search, setSearch] = useState("");
  const [editingAccount, setEditingAccount] = useState<BrokerAccount | null | "new">(null);
  const [deletingAccount, setDeletingAccount] = useState<BrokerAccount | null>(null);

  const { data: accounts = [], isLoading } = useQuery<BrokerAccount[]>({
    queryKey: ["/api/broker-portal/accounts"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/broker-portal/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker-portal/accounts"] });
      setDeletingAccount(null);
    },
  });

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    return !q || [a.firstName, a.lastName, a.email, a.brokerage || ""].some(s => s.toLowerCase().includes(q));
  });

  const activeCount = accounts.filter(a => a.status === "active").length;
  const pendingCount = accounts.filter(a => a.status === "pending").length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />

      {(editingAccount === "new" || (editingAccount && editingAccount !== "new")) && (
        <AccountModal
          account={editingAccount === "new" ? null : editingAccount as BrokerAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}

      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-catalyst-navy text-base mb-2">Delete Account</h2>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete <span className="font-semibold">{deletingAccount.firstName} {deletingAccount.lastName}</span>? This will immediately revoke their portal access.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingAccount(null)} className="h-8 text-sm">Cancel</Button>
              <Button
                onClick={() => deleteMutation.mutate(deletingAccount.id)}
                disabled={deleteMutation.isPending}
                className="h-8 text-sm bg-red-600 hover:bg-red-700 text-white border-0"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
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
              <h1 className="text-lg font-bold text-catalyst-navy leading-tight">Partner Broker Portal</h1>
              <p className="text-xs text-gray-500">Manage broker accounts and approve deals for the portal</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-5 text-center">
                <div>
                  <div className="text-lg font-bold text-catalyst-navy leading-tight">{accounts.length}</div>
                  <div className="text-[11px] text-gray-500">Total</div>
                </div>
                <div className="w-px h-7 bg-gray-200" />
                <div>
                  <div className="text-lg font-bold text-green-600 leading-tight">{activeCount}</div>
                  <div className="text-[11px] text-gray-500">Active</div>
                </div>
                {pendingCount > 0 && (
                  <>
                    <div className="w-px h-7 bg-gray-200" />
                    <div>
                      <div className="text-lg font-bold text-yellow-600 leading-tight">{pendingCount}</div>
                      <div className="text-[11px] text-gray-500">Pending</div>
                    </div>
                  </>
                )}
              </div>
              {tab === "accounts" && (
                <Button
                  onClick={() => setEditingAccount("new")}
                  className="h-8 text-sm bg-catalyst-navy hover:bg-catalyst-navy/90 text-white gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Broker
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-4 border-b border-gray-200 -mb-px">
            <button
              onClick={() => setTab("accounts")}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "accounts" ? "border-catalyst-navy text-catalyst-navy" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <Users className="w-4 h-4" /> Broker Accounts
            </button>
            <button
              onClick={() => setTab("approvals")}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "approvals" ? "border-catalyst-navy text-catalyst-navy" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <Building2 className="w-4 h-4" /> Deal Approvals
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-5 flex-1">
        {tab === "approvals" ? (
          <DealApprovalsTab />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search brokers..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <a
                href="/broker-portal"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-catalyst-navy font-medium hover:underline border border-catalyst-navy/30 px-3 py-1.5 rounded-lg hover:bg-catalyst-navy/5 transition-colors"
              >
                Preview Broker Portal ↗
              </a>
            </div>

            {isLoading ? (
              <div className="text-center py-16 text-gray-400">Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <h3 className="font-semibold text-gray-600 mb-1">No broker accounts yet</h3>
                <p className="text-sm text-gray-400 mb-4">Create accounts to give partner brokers access to the portal.</p>
                <Button size="sm" onClick={() => setEditingAccount("new")} className="gap-1.5 bg-catalyst-navy text-white hover:bg-catalyst-navy/90">
                  <Plus className="w-3.5 h-3.5" /> Add First Broker
                </Button>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name / Brokerage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Markets</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Login</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No accounts match your search.</td>
                      </tr>
                    ) : (
                      filtered.map(account => (
                        <tr key={account.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-catalyst-navy text-sm leading-tight">
                              {account.firstName} {account.lastName}
                            </div>
                            {account.brokerage && (
                              <div className="text-xs text-gray-500 mt-0.5">{account.brokerage}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <a href={`mailto:${account.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate max-w-[180px]">
                              <Mail className="w-3 h-3 flex-shrink-0" />{account.email}
                            </a>
                            {account.phone && (
                              <span className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <Phone className="w-3 h-3" />{account.phone}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(account.targetStates || []).slice(0, 4).map(s => (
                                <span key={s} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">{s}</span>
                              ))}
                              {(account.targetStates || []).length > 4 && (
                                <span className="text-[10px] text-gray-400">+{account.targetStates.length - 4}</span>
                              )}
                              {(account.targetMsas || []).slice(0, 2).map(m => (
                                <span key={m} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{m}</span>
                              ))}
                            </div>
                            {account.targetStates.length === 0 && account.targetMsas.length === 0 && account.targetCities.length === 0 && (
                              <span className="text-xs text-gray-400 italic">No markets set</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{statusBadge(account.status)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {account.lastLoginAt
                              ? new Date(account.lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : <span className="text-gray-300">Never</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingAccount(account)}
                                className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingAccount(account)}
                                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Key, Plus, Copy, Trash2, ShieldOff, ShieldCheck, RefreshCw,
  Zap, FileText, AlertTriangle, CheckCircle, Clock, ExternalLink,
  Code2, Globe, ChevronDown, ChevronUp, Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  keyPlaintext?: string;
  environment: "live" | "test";
  isActive: boolean;
  createdBy?: string;
  lastUsedAt?: string;
  totalCalls: number;
  createdAt: string;
  revokedAt?: string;
  notes?: string;
}

interface NewKeyResult extends ApiKeyRow {
  key: string;
  warning: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s?: string | null) {
  if (!s) return "Never";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(s?: string | null) {
  if (!s) return null;
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function EnvBadge({ env }: { env: string }) {
  if (env === "test") return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">🧪 Sandbox</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">🚀 Live</Badge>;
}

// ── Endpoint reference ─────────────────────────────────────────────────────────

const ENDPOINTS = [
  {
    method: "POST", path: "/api/v1/leads", desc: "Create a new lead",
    body: `{
  "sender_name":     "Jane Smith",
  "sender_email":    "jane@brokerfirm.com",
  "sender_phone":    "+17045550123",
  "property_address":"1234 Oak Farm Rd, Charlotte NC 28201",
  "property_type":   "land",
  "size_acres":      12.5,
  "asking_price":    850000,
  "zoning_notes":    "R-4 — up to 40 units/acre",
  "notes":           "Full original email body goes here"
}`,
    returns: `{
  "ok": true,
  "lead": {
    "id": "uuid-...",
    "deal_number": 1042,
    "status": "pending_review",
    "address": "1234 Oak Farm Rd, Charlotte NC 28201",
    "created_at": "2026-07-20T...",
    "sandbox": false
  },
  "_links": {
    "self": "/api/v1/leads/uuid-...",
    "attachments": "/api/v1/leads/uuid-.../attachments"
  }
}`,
  },
  {
    method: "POST", path: "/api/v1/leads/:id/attachments", desc: "Upload PDF or document to a lead",
    body: `multipart/form-data
field name: "files"  (up to 10 files, 25 MB each)`,
    returns: `{
  "ok": true,
  "attachments": [
    { "id": "uuid-...", "filename": "om.pdf", "size_bytes": 204800, "stored": true }
  ]
}`,
  },
  {
    method: "GET", path: "/api/v1/leads/:id", desc: "Check status of a lead",
    body: null,
    returns: `{
  "ok": true,
  "lead": {
    "id": "uuid-...",
    "deal_number": 1042,
    "status": "pending_review",
    "classification": null,
    "attachment_count": 2
  }
}`,
  },
  {
    method: "GET", path: "/api/v1/ping", desc: "Health check — no auth required",
    body: null,
    returns: `{ "ok": true, "version": "v1", "service": "LandLinq API" }`,
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApiKeysAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEnv, setNewEnv] = useState<"live" | "test">("test");
  const [newNotes, setNewNotes] = useState("");
  const [revealed, setRevealed] = useState<NewKeyResult | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: keys = [], isLoading } = useQuery<ApiKeyRow[]>({
    queryKey: ["/api/admin/api-keys"],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createKey = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/api-keys", {
      name: newName, environment: newEnv, notes: newNotes,
    }),
    onSuccess: (data: NewKeyResult) => {
      setRevealed(data);
      setCreateOpen(false);
      setNewName(""); setNewNotes(""); setNewEnv("test");
      qc.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
    onError: (e: any) => toast({ title: "Failed to create key", description: e.message, variant: "destructive" }),
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/api-keys/${id}/revoke`, {}),
    onSuccess: () => {
      toast({ title: "Key revoked" });
      qc.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
  });

  const activateKey = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/api-keys/${id}/activate`, {}),
    onSuccess: () => {
      toast({ title: "Key reactivated" });
      qc.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/api-keys/${id}`, {}),
    onSuccess: () => {
      toast({ title: "Key deleted" });
      qc.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
  });

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied to clipboard` });
    });
  }

  const activeKeys = keys.filter((k) => k.isActive);
  const revokedKeys = keys.filter((k) => !k.isActive);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navigation />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Key className="h-7 w-7 text-slate-700" />
              <h1 className="text-2xl font-bold text-slate-900">LandLinq API Keys</h1>
            </div>
            <p className="text-slate-500 text-sm">
              Generate and manage API keys for external integrations (Make.com, Zapier, custom automations).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDocs(!showDocs)}>
              <Code2 className="h-4 w-4 mr-1.5" /> {showDocs ? "Hide" : "API"} Reference
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-slate-800 hover:bg-slate-700">
                  <Plus className="h-4 w-4 mr-1.5" /> New API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Generate New API Key</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <strong>Important:</strong> The full key is shown only once after creation. Store it immediately.
                  </div>
                  <div>
                    <Label>Key name <span className="text-red-500">*</span></Label>
                    <Input className="mt-1" placeholder="e.g. Make.com Production" value={newName}
                      onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Environment</Label>
                    <Select value={newEnv} onValueChange={(v) => setNewEnv(v as "live" | "test")}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="test">🧪 Sandbox — leads created with [SANDBOX TEST] prefix, safe for testing</SelectItem>
                        <SelectItem value="live">🚀 Live — creates real leads in the pipeline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notes (optional)</Label>
                    <Textarea className="mt-1 h-20" placeholder="e.g. Connected to Make.com scenario #1234"
                      value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={() => createKey.mutate()} disabled={createKey.isPending || !newName.trim()}>
                    {createKey.isPending ? "Generating..." : "Generate Key"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Newly created key — show once */}
        {revealed && (
          <div className="mb-6 p-5 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-emerald-800 mb-1">API key created — save it now!</p>
                <p className="text-sm text-emerald-700 mb-3">This key will not be shown again. Copy it and store it in your secrets manager or automation tool.</p>
                <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-lg px-3 py-2 font-mono text-sm break-all">
                  <span className="flex-1">{revealed.key}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 flex-shrink-0"
                    onClick={() => copyToClipboard(revealed.key, "API key")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex gap-3 mt-3 text-xs text-emerald-700">
                  <span><strong>Name:</strong> {revealed.name}</span>
                  <span><strong>Environment:</strong> {revealed.environment}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="flex-shrink-0 text-emerald-600"
                onClick={() => setRevealed(null)}>✕</Button>
            </div>
          </div>
        )}

        {/* API Reference */}
        {showDocs && (
          <div className="mb-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Code2 className="h-5 w-5 text-slate-500" />
              <h2 className="font-semibold text-slate-800">API Reference</h2>
              <Badge variant="outline" className="text-xs">v1</Badge>
            </div>
            <div className="p-5 space-y-2">
              {/* Auth */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm font-semibold text-slate-700 mb-1">Authentication</p>
                <p className="text-xs text-slate-500 mb-2">Send your API key in the <code className="bg-slate-200 px-1 rounded">X-API-Key</code> header on every request (except <code>/ping</code>).</p>
                <pre className="text-xs bg-slate-800 text-green-300 rounded p-2 overflow-x-auto">{`X-API-Key: llq_live_abc123...`}</pre>
              </div>

              {/* Base URL */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" /> Base URL
                </p>
                <code className="text-xs text-slate-600">https://your-app.replit.app</code>
                <p className="text-xs text-slate-400 mt-1">All endpoints are relative to this base. Use your Replit deployment URL.</p>
              </div>

              {/* Endpoints */}
              {ENDPOINTS.map((ep, i) => (
                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedEndpoint(expandedEndpoint === i ? null : i)}
                  >
                    <Badge className={`text-xs flex-shrink-0 ${
                      ep.method === "GET" ? "bg-green-100 text-green-800" :
                      ep.method === "POST" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                    }`}>{ep.method}</Badge>
                    <code className="text-sm font-mono text-slate-800 flex-1">{ep.path}</code>
                    <span className="text-xs text-slate-400 hidden sm:inline">{ep.desc}</span>
                    {expandedEndpoint === i ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                  </button>
                  {expandedEndpoint === i && (
                    <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
                      <p className="text-sm text-slate-600">{ep.desc}</p>
                      {ep.body && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Request Body</p>
                          <pre className="text-xs bg-slate-800 text-amber-300 rounded p-3 overflow-x-auto whitespace-pre-wrap">{ep.body}</pre>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Response</p>
                        <pre className="text-xs bg-slate-800 text-green-300 rounded p-3 overflow-x-auto whitespace-pre-wrap">{ep.returns}</pre>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => copyToClipboard(`${ep.method} ${ep.path}`, "Endpoint")}>
                          <Copy className="h-3 w-3 mr-1" /> Copy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Make.com tip */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-800 mb-1 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Make.com Setup
                </p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Add an <strong>HTTP → Make a request</strong> module</li>
                  <li>Method: <code className="bg-blue-100 px-1 rounded">POST</code>, URL: <code className="bg-blue-100 px-1 rounded">/api/v1/leads</code></li>
                  <li>Headers → Add: <code className="bg-blue-100 px-1 rounded">X-API-Key: {"{{your_key}}"}</code></li>
                  <li>Body type: <strong>Raw / JSON</strong> — map your email parser fields to the JSON fields above</li>
                  <li>Use a 🧪 Sandbox key to test first, then switch to 🚀 Live</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{activeKeys.length}</p>
                  <p className="text-xs text-slate-500">Active keys</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {keys.reduce((s, k) => s + (k.totalCalls ?? 0), 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">Total API calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{revokedKeys.length}</p>
                  <p className="text-xs text-slate-500">Revoked keys</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Keys */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading keys...</div>
        ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
          <div className="text-center py-16">
            <Key className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-slate-500 mb-2">No API keys yet</h3>
            <p className="text-sm text-slate-400 mb-4">Create your first key to start connecting external automations.</p>
            <Button onClick={() => setCreateOpen(true)} className="bg-slate-800 hover:bg-slate-700">
              <Plus className="h-4 w-4 mr-1.5" /> Generate First Key
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active */}
            {activeKeys.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Active Keys ({activeKeys.length})
                </h2>
                <div className="space-y-3">
                  {activeKeys.map((k) => (
                    <ApiKeyCard
                      key={k.id}
                      apiKey={k}
                      onRevoke={() => revokeKey.mutate(k.id)}
                      onDelete={() => deleteKey.mutate(k.id)}
                      onCopy={() => copyToClipboard(k.keyPlaintext ?? k.keyPrefix, "API key")}
                      revoking={revokeKey.isPending}
                      deleting={deleteKey.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Revoked */}
            {revokedKeys.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ShieldOff className="h-4 w-4" /> Revoked Keys ({revokedKeys.length})
                </h2>
                <div className="space-y-2 opacity-60">
                  {revokedKeys.map((k) => (
                    <ApiKeyCard
                      key={k.id}
                      apiKey={k}
                      onActivate={() => activateKey.mutate(k.id)}
                      onDelete={() => deleteKey.mutate(k.id)}
                      onCopy={() => {}}
                      revoking={false}
                      deleting={deleteKey.isPending}
                      activating={activateKey.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// ── API Key Card ───────────────────────────────────────────────────────────────

function ApiKeyCard({
  apiKey: k,
  onRevoke,
  onActivate,
  onDelete,
  onCopy,
  revoking,
  deleting,
  activating,
}: {
  apiKey: ApiKeyRow;
  onRevoke?: () => void;
  onActivate?: () => void;
  onDelete: () => void;
  onCopy: () => void;
  revoking: boolean;
  deleting: boolean;
  activating?: boolean;
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  return (
    <Card className={`border ${k.isActive ? "border-slate-200 shadow-sm" : "border-slate-100 bg-slate-50"}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-semibold text-slate-800 text-sm">{k.name}</span>
              <EnvBadge env={k.environment} />
              {!k.isActive && <Badge className="bg-red-100 text-red-700 text-xs">Revoked</Badge>}
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <code className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded font-mono select-all">
                {k.keyPlaintext ?? k.keyPrefix}
              </code>
              {k.isActive && (
                <button
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded px-2 py-0.5 transition-colors"
                  onClick={onCopy}
                  title="Copy full key"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" /> {(k.totalCalls ?? 0).toLocaleString()} calls
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last used: {k.lastUsedAt ? fmtRelative(k.lastUsedAt) : "Never"}
              </span>
              <span>Created: {fmtDate(k.createdAt)}</span>
              {k.revokedAt && <span className="text-red-400">Revoked: {fmtDate(k.revokedAt)}</span>}
              {k.createdBy && <span>By: {k.createdBy}</span>}
            </div>
            {k.notes && (
              <p className="mt-1.5 text-xs text-slate-400 italic">{k.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {k.isActive && onRevoke && (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={onRevoke} disabled={revoking}>
                <ShieldOff className="h-3.5 w-3.5 mr-1" /> Revoke
              </Button>
            )}
            {!k.isActive && onActivate && (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                onClick={onActivate} disabled={activating}>
                <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Reactivate
              </Button>
            )}
            {showConfirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-600">Sure?</span>
                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                  onClick={() => { onDelete(); setShowConfirmDelete(false); }} disabled={deleting}>
                  Yes, delete
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  onClick={() => setShowConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400 hover:text-red-600"
                onClick={() => setShowConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

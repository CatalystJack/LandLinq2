import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Users, Tag, Mail, Phone, MapPin, Building2, MessageSquare,
  Calendar, ChevronRight, ChevronLeft, X, Plus, Send, FileText, TrendingUp,
  CheckCircle, XCircle, Clock, AlertCircle, MoreHorizontal, RefreshCw,
  MessageCircle, Filter, Inbox, Upload, UserCheck, Megaphone, Trash2, GitMerge, Settings2, Loader2, AlertTriangle
} from "lucide-react";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  brokerage?: string;
  marketsCovered?: string[];
  smsOptIn?: boolean;
  isActive?: boolean;
  crmTags?: string[];
  crmNotes?: string;
  lastContactedAt?: string;
  createdAt?: string;
  dealCount?: number;
  assignedTo?: string;
}

interface ActivityData {
  broker: Contact;
  deals: any[];
  communications: any[];
  enrollments: any[];
}

const TAG_COLORS: Record<string, string> = {
  "hot-lead": "bg-red-100 text-red-700 border-red-200",
  "warm": "bg-orange-100 text-orange-700 border-orange-200",
  "follow-up": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "active": "bg-green-100 text-green-700 border-green-200",
  "vip": "bg-purple-100 text-purple-700 border-purple-200",
  "new": "bg-blue-100 text-blue-700 border-blue-200",
  "inactive": "bg-gray-100 text-gray-600 border-gray-200",
  "do-not-contact": "bg-red-200 text-red-800 border-red-300",
};

function tagColor(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] || "bg-indigo-50 text-indigo-700 border-indigo-200";
}

function classificationBadge(c: string) {
  if (c === "green") return <span className="inline-flex items-center gap-1 text-green-700 font-medium text-[10px]"><CheckCircle size={10} />High Priority</span>;
  if (c === "yellow") return <span className="inline-flex items-center gap-1 text-yellow-600 font-medium text-[10px]"><AlertCircle size={10} />Potential</span>;
  if (c === "red") return <span className="inline-flex items-center gap-1 text-red-600 font-medium text-[10px]"><XCircle size={10} />Clear No</span>;
  return <span className="text-gray-400 text-[10px]">{c || "—"}</span>;
}

export default function CRMPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("");
  const [smsFilter, setSmsFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [msaFilter, setMsaFilter] = useState("all");
  const [countyFilter, setCountyFilter] = useState("all");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [multiCampaignTagFilter, setMultiCampaignTagFilter] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editFields, setEditFields] = useState({ firstName: "", lastName: "", email: "", phone: "", brokerage: "" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollTargetId, setEnrollTargetId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState("");
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagAction, setBulkTagAction] = useState<"add" | "remove">("add");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<{ identifier: string; assignedTo: string }[]>([]);
  const [importResult, setImportResult] = useState<{ matched: number; unmatched: string[] } | null>(null);
  const [showContactImportModal, setShowContactImportModal] = useState(false);
  const [contactImportPreview, setContactImportPreview] = useState<any[]>([]);
  const [contactImportResult, setContactImportResult] = useState<{ inserted: number; updated: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: "", lastName: "", email: "", phone: "", brokerage: "", assignedTo: "", crmNotes: "" });
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  useEffect(() => {
    setEditFields({
      firstName: selectedContact?.firstName || "",
      lastName: selectedContact?.lastName || "",
      email: selectedContact?.email || "",
      phone: selectedContact?.phone || "",
      brokerage: selectedContact?.brokerage || "",
    });
  }, [selectedContact?.id]);

  const tagDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tagDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [tagDropdownOpen]);

  const contactsQuery = useQuery<{ contacts: Contact[]; pagination: any }>({
    queryKey: ["/api/crm/contacts", page, limit, search, tagFilter, marketFilter, smsFilter, stateFilter, msaFilter, countyFilter, assignedToFilter, multiCampaignTagFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: limit === "all" ? "9999" : String(limit) });
      if (search) params.set("search", search);
      if (tagFilter && tagFilter !== "all") params.set("tag", tagFilter);
      if (marketFilter) params.set("market", marketFilter);
      if (smsFilter && smsFilter !== "all") params.set("sms", smsFilter);
      if (stateFilter && stateFilter !== "all") params.set("state", stateFilter);
      if (msaFilter && msaFilter !== "all") params.set("msa", msaFilter);
      if (countyFilter && countyFilter !== "all") params.set("county", countyFilter);
      if (assignedToFilter && assignedToFilter !== "all") params.set("assignedTo", assignedToFilter);
      if (multiCampaignTagFilter) params.set("multiCampaignTag", "true");
      return fetch(`/api/crm/contacts?${params}`).then(r => r.json());
    },
  });

  const geoOptionsQuery = useQuery<{
    states: string[];
    msasByState: Record<string, string[]>;
    countiesByMsa: Record<string, string[]>;
    counties: string[];
    assignedTos: string[];
  }>({ queryKey: ["/api/crm/geo-options"] });

  const tagsQuery = useQuery<string[]>({ queryKey: ["/api/crm/tags"] });

  const outreachTagsQuery = useQuery<{ id: string; name: string; tag: string; senderId: string | null; senderName: string | null }[]>({
    queryKey: ["/api/crm/outreach-tags"],
  });

  const activityQuery = useQuery<ActivityData>({
    queryKey: ["/api/crm/contacts", selectedContact?.id, "activity"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/contacts/${selectedContact!.id}/activity`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    enabled: !!selectedContact,
  });

  const campaignsQuery = useQuery<any[]>({ queryKey: ["/api/crm/campaigns"] });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/crm/contacts/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      qc.invalidateQueries({ queryKey: ["/api/crm/tags"] });
      toast({ title: "Contact updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ id, templateId, senderId }: { id: string; templateId: string; senderId?: string | null }) =>
      apiRequest("POST", `/api/crm/contacts/${id}/enroll`, { templateId, senderId, targetState: stateFilter !== "all" ? stateFilter : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts", selectedContact?.id, "activity"] });
      setShowEnrollModal(false);
      toast({ title: "Contact enrolled in campaign" });
    },
    onError: (err: any) => {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("already enrolled")) {
        toast({ title: "Already enrolled in this campaign" });
      } else {
        toast({ title: "Enrollment failed", variant: "destructive" });
      }
    },
  });

  const cancelEnrollmentMutation = useMutation({
    mutationFn: (enrollmentId: string) => apiRequest("DELETE", `/api/crm/enrollments/${enrollmentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts", selectedContact?.id, "activity"] });
      toast({ title: "Enrollment cancelled" });
    },
  });

  const bulkTagMutation = useMutation({
    mutationFn: ({ ids, tag, action }: { ids: string[]; tag: string; action: "add" | "remove" }) =>
      apiRequest("POST", "/api/crm/bulk-tag", { brokerIds: ids, tag, action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setSelectedIds(new Set());
      setShowBulkTagModal(false);
      setBulkTagInput("");
      toast({ title: "Tags updated" });
    },
  });

  const createContactMutation = useMutation({
    mutationFn: (data: typeof newContact) => apiRequest("POST", "/api/crm/contacts", data).then(r => r.json()),
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setShowNewContactModal(false);
      setNewContact({ firstName: "", lastName: "", email: "", phone: "", brokerage: "", assignedTo: "", crmNotes: "" });
      toast({ title: `Contact created`, description: `${created.firstName} ${created.lastName} added to CRM` });
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to create contact";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/crm/contacts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setSelectedContact(null);
      setConfirmDeleteId(null);
      toast({ title: "Contact deleted" });
    },
    onError: () => toast({ title: "Failed to delete contact", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiRequest("DELETE", "/api/crm/contacts/bulk", { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      setSelectedContact(null);
      toast({ title: "Contacts deleted" });
    },
    onError: () => toast({ title: "Failed to delete contacts", variant: "destructive" }),
  });

  const importAssignmentsMutation = useMutation({
    mutationFn: (assignments: { identifier: string; assignedTo: string }[]) =>
      apiRequest("POST", "/api/crm/import-assignments", { assignments }).then(r => r.json()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      setImportResult({ matched: data.matched, unmatched: data.unmatched || [] });
      setImportPreview([]);
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const importContactsMutation = useMutation({
    mutationFn: (contacts: any[]) =>
      apiRequest("POST", "/api/crm/import-contacts", { contacts }).then(r => r.json()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      qc.invalidateQueries({ queryKey: ["/api/crm/tags"] });
      setContactImportResult({ inserted: data.inserted, updated: data.updated });
      setContactImportPreview([]);
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const createTagMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/crm/tag-registry", { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/tags"] });
      setNewTagName("");
      toast({ title: "Tag created" });
    },
    onError: () => toast({ title: "Failed to create tag", variant: "destructive" }),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (tag: string) => apiRequest("DELETE", `/api/crm/tags/${encodeURIComponent(tag)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/tags"] });
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: "Tag deleted" });
    },
    onError: () => toast({ title: "Failed to delete tag", variant: "destructive" }),
  });

  const normalizeNamesMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/crm/normalize-names").then(r => r.json()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: `Names normalized — ${data.updated ?? 0} contacts updated` });
    },
    onError: () => toast({ title: "Failed to normalize names", variant: "destructive" }),
  });

  const backfillAssignedToMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/crm/backfill-assigned-to").then(r => r.json()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: `Assigned To backfilled — ${data.updated ?? 0} contacts updated` });
    },
    onError: () => toast({ title: "Failed to backfill Assigned To", variant: "destructive" }),
  });

  const stripMiddleNamesMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/crm/contacts/strip-middle-names").then(r => r.json()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({ title: `Middle names removed — ${data.updated ?? 0} contacts updated` });
    },
    onError: () => toast({ title: "Failed to strip middle names", variant: "destructive" }),
  });

  const deduplicateEmailMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/brokers/deduplicate-email").then(r => r.json()),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      toast({
        title: "Duplicates merged",
        description: data.message || `Removed ${data.brokersRemoved ?? 0} duplicate contacts`,
      });
    },
    onError: () => toast({ title: "Merge failed", variant: "destructive" }),
  });

  const handleExcelFile = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) {
        toast({ title: "File is empty or missing rows.", variant: "destructive" });
        return;
      }

      // Detect column indices from headers (row 0)
      const headerRow = (rows[0] as any[]).map(h => String(h ?? "").toLowerCase().trim());
      const findCol = (...terms: string[]) => headerRow.findIndex(h => terms.some(t => h.includes(t)));

      // Prefer email as identifier; fall back to full-name or col 0
      const identCol   = findCol("email") !== -1 ? findCol("email") : findCol("phone") !== -1 ? findCol("phone") : findCol("name") !== -1 ? findCol("name") : 0;
      // Detect assignment column: "assigned to", "assign", "brian or aj", "brian", "rep", "owner" — fallback col 1
      const assignCol  = findCol("assign", "brian", "rep", "owner", "agent") !== -1 ? findCol("assign", "brian", "rep", "owner", "agent") : 1;

      const assignments = rows
        .slice(1)
        .filter((r: any[]) => r[identCol] && r[assignCol])
        .map((r: any[]) => ({
          identifier: String(r[identCol]).trim(),
          assignedTo: String(r[assignCol]).trim(),
        }));

      if (!assignments.length) {
        toast({ title: "No valid rows found. Check the file format.", variant: "destructive" });
        return;
      }
      setImportPreview(assignments);
      setImportResult(null);
      setShowImportModal(true);
    } catch (err) {
      toast({ title: "Could not read file", variant: "destructive" });
    }
  };

  const handleContactImportFile = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      // Find the best sheet: prefer one whose first row contains recognizable column headers
      let bestRows: any[][] | null = null;
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) continue;
        const firstRow = (rows[0] as any[]).map(h => String(h ?? "").toLowerCase().trim());
        const hasHeaders = firstRow.some(h => h.includes("email") || h.includes("first") || h.includes("last"));
        if (hasHeaders) { bestRows = rows; break; }
      }

      // Fall back to first sheet if no sheet had recognizable headers
      if (!bestRows) {
        const ws = wb.Sheets[wb.SheetNames[0]];
        bestRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      }

      const rows = bestRows;
      if (rows.length < 2) { toast({ title: "File is empty or missing header row", variant: "destructive" }); return; }
      const header = (rows[0] as string[]).map(h => String(h || "").toLowerCase().trim());
      const col = (name: string) => header.findIndex(h => h.includes(name));
      const fnIdx = col("first"); const lnIdx = col("last"); const emailIdx = col("email");
      const phoneIdx = col("phone"); const coIdx = col("brokerage") !== -1 ? col("brokerage") : col("company");
      const assignIdx = col("assign"); const tagsIdx = col("tag");
      const stateIdx = col("state");
      const parsed = rows.slice(1).map((r: any[]) => ({
        firstName: String(r[fnIdx] ?? "").trim(),
        lastName: String(r[lnIdx] ?? "").trim(),
        email: String(r[emailIdx] ?? "").trim(),
        phone: String(r[phoneIdx] ?? "").trim(),
        brokerage: String(r[coIdx] ?? "").trim(),
        stateRegion: stateIdx !== -1 ? String(r[stateIdx] ?? "").trim() : "",
        assignedTo: String(r[assignIdx] ?? "").trim(),
        tags: [String(r[tagsIdx] ?? "").trim(), String(r[col("secondary") !== -1 ? col("secondary") : -1] ?? "").trim()].filter(Boolean).join("; "),
      })).filter(r => r.firstName || r.lastName || r.email);
      if (!parsed.length) { toast({ title: "No valid rows found. Check column headers.", variant: "destructive" }); return; }
      setContactImportPreview(parsed);
      setContactImportResult(null);
      setShowContactImportModal(true);
    } catch {
      toast({ title: "Could not read file", variant: "destructive" });
    }
  };

  const downloadContactTemplate = () => {
    const csv = [
      "First Name,Last Name,Email,Phone,Brokerage,State/Region,Assigned To,Tags",
      "Jane,Doe,jane.doe@example.com,910-555-1234,Intracoastal Realty,NC,Jack,Jack - Unknown Sophisticated",
      "John,Smith,john.smith@example.com,910-555-5678,Intracoastal Realty,NC,Jack,Jack - Unknown Sophisticated",
    ].join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "crm-import-template-jack.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const contacts = contactsQuery.data?.contacts || [];
  const pagination = contactsQuery.data?.pagination;

  const allSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(contacts.map(c => c.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addTagToContact = (contact: Contact, tag: string) => {
    const current = contact.crmTags || [];
    if (current.includes(tag)) return;
    const next = [...current, tag];
    updateContactMutation.mutate({ id: contact.id, data: { crmTags: next } });
    if (selectedContact?.id === contact.id) setSelectedContact({ ...contact, crmTags: next });
  };

  const removeTagFromContact = (contact: Contact, tag: string) => {
    const next = (contact.crmTags || []).filter(t => t !== tag);
    updateContactMutation.mutate({ id: contact.id, data: { crmTags: next } });
    if (selectedContact?.id === contact.id) setSelectedContact({ ...contact, crmTags: next });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navigation />
      <div className="flex flex-1 overflow-hidden min-h-0">
      {/* LEFT: Contacts List */}
      <div className={`flex flex-col ${selectedContact ? 'w-[58%]' : 'w-full'} transition-all duration-200 border-r border-gray-200 bg-white`}>

        {/* Header */}
        <div className="shrink-0 border-b border-gray-100 px-5 py-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#07172A]" />
              <h1 className="text-base font-semibold text-[#07172A]">CRM — Contacts</h1>
              {pagination && (
                <span className="text-xs text-gray-400 font-normal">
                  {pagination.total.toLocaleString()} total
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setBulkTagAction("add"); setShowBulkTagModal(true); }}
                  >
                    <Tag size={12} className="mr-1" />Add Tag
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setBulkTagAction("remove"); setShowBulkTagModal(true); }}
                  >
                    <Tag size={12} className="mr-1" />Remove Tag
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowEnrollModal(true); setEnrollTargetId(null); }}>
                    <Send size={12} className="mr-1" />Enroll in Campaign
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                  >
                    <Trash2 size={12} className="mr-1" />Delete
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                onClick={() => {
                  if (confirm("This will convert all contact names to Title Case (e.g. BETHANY TERRY → Bethany Terry). Continue?")) {
                    normalizeNamesMutation.mutate();
                  }
                }}
                disabled={normalizeNamesMutation.isPending}
              >
                <Tag size={12} className="mr-1" />
                {normalizeNamesMutation.isPending ? "Normalizing..." : "Fix Name Casing"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white hover:border-purple-600"
                onClick={() => {
                  if (confirm("This will remove middle names and middle initials from all contacts' first names (e.g. 'Monica Anne Young' → first name becomes 'Monica'). Cannot be undone. Continue?")) {
                    stripMiddleNamesMutation.mutate();
                  }
                }}
                disabled={stripMiddleNamesMutation.isPending}
              >
                {stripMiddleNamesMutation.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <X size={12} className="mr-1" />}
                {stripMiddleNamesMutation.isPending ? "Stripping..." : "Strip Middle Names"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-600 hover:text-white hover:border-orange-600"
                onClick={() => {
                  if (confirm("This will set 'Assigned To' for all contacts that have a per-rep tag (e.g. 'AJ - Unknown Sophisticated' → AJ Klenk) but no assigned rep yet. Continue?")) {
                    backfillAssignedToMutation.mutate();
                  }
                }}
                disabled={backfillAssignedToMutation.isPending}
              >
                {backfillAssignedToMutation.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <UserCheck size={12} className="mr-1" />}
                {backfillAssignedToMutation.isPending ? "Fixing..." : "Fix Assignments"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                onClick={() => {
                  if (confirm("This will merge all contacts that share the same email address into one record. This cannot be undone. Continue?")) {
                    deduplicateEmailMutation.mutate();
                  }
                }}
                disabled={deduplicateEmailMutation.isPending}
              >
                <GitMerge size={12} className="mr-1" />
                {deduplicateEmailMutation.isPending ? "Merging..." : "Merge Duplicates"}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white border-0"
                onClick={() => setShowNewContactModal(true)}
              >
                <Plus size={12} className="mr-1" />New Contact
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) { handleContactImportFile(e.target.files[0]); e.target.value = ""; } }}
                />
                <Button size="sm" className="h-7 text-xs bg-[#07172A] hover:bg-[#0d2d4e] text-white border-0" asChild>
                  <span><Upload size={12} className="mr-1" />Import Contacts</span>
                </Button>
              </label>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleExcelFile(e.target.files[0])}
                />
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <span><Upload size={12} className="mr-1" />Import Assignments</span>
                </Button>
              </label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] })}>
                <RefreshCw size={12} />
              </Button>
            </div>
          </div>

          {/* Filters — Row 1: search + tags + sms */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[280px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search name, email, phone..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 h-7 text-xs"
              />
            </div>
            {/* Custom tag filter with inline delete */}
            <div ref={tagDropdownRef} className="relative">
              <button
                onClick={() => setTagDropdownOpen(v => !v)}
                className={`h-7 px-2.5 flex items-center gap-1.5 rounded border text-xs w-[170px] justify-between transition-colors ${
                  tagFilter !== "all"
                    ? "border-violet-400 bg-violet-50 text-violet-800"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="truncate">{tagFilter === "all" ? "All tags" : tagFilter}</span>
                <ChevronRight size={11} className={`shrink-0 transition-transform ${tagDropdownOpen ? "rotate-90" : ""}`} />
              </button>
              {tagDropdownOpen && (
                <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
                  <button
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 ${tagFilter === "all" ? "font-semibold text-violet-700" : "text-gray-700"}`}
                    onClick={() => { setTagFilter("all"); setPage(1); setTagDropdownOpen(false); }}
                  >
                    {tagFilter === "all" && <CheckCircle size={10} className="text-violet-500 shrink-0" />}
                    <span>All tags</span>
                  </button>
                  {(tagsQuery.data || []).map(t => (
                    <div key={t} className="flex items-center group hover:bg-gray-50">
                      <button
                        className={`flex-1 text-left px-3 py-1.5 text-xs flex items-center gap-1.5 min-w-0 ${tagFilter === t ? "font-semibold text-violet-700" : "text-gray-700"}`}
                        onClick={() => { setTagFilter(t); setPage(1); setTagDropdownOpen(false); }}
                      >
                        {tagFilter === t && <CheckCircle size={10} className="text-violet-500 shrink-0" />}
                        <span className="truncate">{t}</span>
                      </button>
                      <button
                        className="pr-2 pl-1 py-1.5 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all shrink-0"
                        title={`Delete tag "${t}"`}
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`Delete tag "${t}"? This will remove it from all contacts.`)) {
                            if (tagFilter === t) { setTagFilter("all"); setPage(1); }
                            deleteTagMutation.mutate(t);
                          }
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setManageTagsOpen(true)}
              className="h-7 px-2 flex items-center gap-1 rounded border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-xs"
              title="Create or delete tags"
            >
              <Plus size={11} />
              Tag
            </button>
            <Select value={smsFilter} onValueChange={v => { setSmsFilter(v); setPage(1); }}>
              <SelectTrigger className="h-7 text-xs w-[120px]">
                <SelectValue placeholder="SMS status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SMS</SelectItem>
                <SelectItem value="opted_in">SMS Opted In</SelectItem>
                <SelectItem value="opted_out">SMS Opted Out</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => { setMultiCampaignTagFilter(v => !v); setPage(1); }}
              title="Show contacts tagged with more than 1 outreach campaign"
              className={`h-7 px-2 flex items-center gap-1 rounded border text-xs font-medium transition-colors ${
                multiCampaignTagFilter
                  ? "bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200"
                  : "border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              }`}
            >
              <AlertTriangle size={11} />
              Multi-campaign
            </button>
            {/* Clear all geo filters button */}
            {(stateFilter !== "all" || msaFilter !== "all" || countyFilter !== "all" || assignedToFilter !== "all") && (
              <button
                onClick={() => { setStateFilter("all"); setMsaFilter("all"); setCountyFilter("all"); setAssignedToFilter("all"); setPage(1); }}
                className="h-7 px-2 flex items-center gap-1 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-medium"
              >
                <X size={11} /> Clear geo
              </button>
            )}
          </div>

          {/* Filters — Row 2: geographic segmentation */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <MapPin size={12} className="text-gray-400 shrink-0" />
            {/* State */}
            <Select value={stateFilter} onValueChange={v => { setStateFilter(v); setMsaFilter("all"); setCountyFilter("all"); setPage(1); }}>
              <SelectTrigger className={`h-7 text-xs w-[100px] ${stateFilter !== "all" ? "border-blue-400 bg-blue-50 text-blue-800" : ""}`}>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {(geoOptionsQuery.data?.states || []).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* MSA — filtered to selected state if one is chosen */}
            <Select value={msaFilter} onValueChange={v => { setMsaFilter(v); setCountyFilter("all"); setPage(1); }}>
              <SelectTrigger className={`h-7 text-xs w-[220px] ${msaFilter !== "all" ? "border-blue-400 bg-blue-50 text-blue-800" : ""}`}>
                <SelectValue placeholder="MSA / Market" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All MSAs</SelectItem>
                {(stateFilter !== "all"
                  ? geoOptionsQuery.data?.msasByState?.[stateFilter] || []
                  : Object.values(geoOptionsQuery.data?.msasByState || {}).flat()
                ).filter((v, i, a) => a.indexOf(v) === i).sort().map(msa => (
                  <SelectItem key={msa} value={msa}>{msa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* County — filtered to selected MSA if one is chosen */}
            <Select value={countyFilter} onValueChange={v => { setCountyFilter(v); setPage(1); }}>
              <SelectTrigger className={`h-7 text-xs w-[160px] ${countyFilter !== "all" ? "border-blue-400 bg-blue-50 text-blue-800" : ""}`}>
                <SelectValue placeholder="County" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Counties</SelectItem>
                {(msaFilter !== "all"
                  ? geoOptionsQuery.data?.countiesByMsa?.[msaFilter] || []
                  : geoOptionsQuery.data?.counties || []
                ).map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Assigned To */}
            <Select value={assignedToFilter} onValueChange={v => { setAssignedToFilter(v); setPage(1); }}>
              <SelectTrigger className={`h-7 text-xs w-[150px] ${assignedToFilter !== "all" ? "border-blue-400 bg-blue-50 text-blue-800" : ""}`}>
                <SelectValue placeholder="Assigned to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {(geoOptionsQuery.data?.assignedTos || []).map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse table-fixed">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                <th className="w-8 px-3 py-2 text-left shrink-0">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="w-[180px] max-w-[180px] px-3 py-2 text-left text-gray-500 font-medium">Name</th>
                <th className="w-[200px] max-w-[200px] px-3 py-2 text-left text-gray-500 font-medium">Contact</th>
                <th className="w-[130px] px-3 py-2 text-left text-gray-500 font-medium hidden md:table-cell">Brokerage</th>
                <th className="w-[150px] px-3 py-2 text-left text-gray-500 font-medium hidden lg:table-cell">Tags</th>
                <th className="w-[120px] px-3 py-2 text-left text-gray-500 font-medium hidden xl:table-cell">Assigned To</th>
                <th className="w-16 px-3 py-2 text-center text-gray-500 font-medium">Deals</th>
                <th className="w-[80px] px-3 py-2 text-left text-gray-500 font-medium hidden xl:table-cell">Added</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {contactsQuery.isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td colSpan={8} className="px-3 py-3">
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <Inbox size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No contacts found</p>
                  </td>
                </tr>
              ) : contacts.map(contact => {
                const isSelected = selectedIds.has(contact.id);
                const isActive = selectedContact?.id === contact.id;
                return (
                  <tr
                    key={contact.id}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(contact.id)}
                      />
                    </td>
                    <td className="px-3 py-2 w-[180px] max-w-[180px]">
                      <div className="font-medium text-gray-800 truncate">
                        {contact.firstName} {contact.lastName}
                      </div>
                      {!contact.isActive && <span className="text-[10px] text-gray-400">Inactive</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 w-[200px] max-w-[200px]">
                      {contact.email && <div className="flex items-center gap-1 truncate"><Mail size={10} className="shrink-0" /><span className="truncate">{contact.email}</span></div>}
                      {contact.phone && <div className="flex items-center gap-1 text-gray-400"><Phone size={10} className="shrink-0" />{contact.phone}</div>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 hidden md:table-cell max-w-[140px] truncate">
                      {contact.brokerage || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {contact.smsOptIn && (
                          <span className="inline-flex items-center gap-0.5 bg-green-50 text-green-600 border border-green-200 rounded px-1 py-0.5 text-[10px]">
                            <MessageCircle size={9} />SMS
                          </span>
                        )}
                        {(contact.crmTags || []).slice(0, 2).map(t => (
                          <span key={t} className={`inline-block rounded px-1 py-0.5 text-[10px] border ${tagColor(t)}`}>{t}</span>
                        ))}
                        {(contact.crmTags || []).length > 2 && (
                          <span className="text-[10px] text-gray-400">+{contact.crmTags!.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden xl:table-cell">
                      {contact.assignedTo ? (
                        <div className="flex items-center gap-1 text-xs text-indigo-700">
                          <UserCheck size={11} className="shrink-0" />
                          <span className="truncate max-w-[110px]">{contact.assignedTo}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-semibold ${(contact.dealCount || 0) > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                        {contact.dealCount || 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 hidden xl:table-cell whitespace-nowrap">
                      {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <ChevronRight size={14} className={`text-gray-400 ${isActive ? 'text-blue-500' : ''}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination && (
          <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-2 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {limit === "all" || pagination.totalPages <= 1
                ? `Showing all ${pagination.total.toLocaleString()} contacts`
                : `Showing ${contacts.length} of ${pagination.total.toLocaleString()} contacts`}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage(p => p - 1)}
              >
                ‹ Previous
              </Button>
              {pagination.totalPages > 1 && Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-7 w-7 rounded text-xs font-medium transition-colors ${
                      page === p
                        ? 'bg-[#07172A] text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              {pagination.totalPages > 7 && page > 4 && (
                <span className="text-xs text-gray-400">…{page > 4 && page < pagination.totalPages - 2 ? page : ''}</span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage(p => p + 1)}
              >
                Next ›
              </Button>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-xs text-gray-400">Show:</span>
              <Select
                value={String(limit)}
                onValueChange={v => { setLimit(v === "all" ? "all" : Number(v)); setPage(1); }}
              >
                <SelectTrigger className="h-7 text-xs w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Contact Detail Panel */}
      {selectedContact && (
        <div className="w-[42%] flex flex-col bg-white border-l border-gray-200 overflow-hidden">
          {/* Panel Header */}
          <div className="shrink-0 border-b border-gray-100 px-5 py-4 flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-2 space-y-1">
              <div className="flex gap-1">
                <input
                  value={editFields.firstName}
                  placeholder="First name"
                  className="font-semibold text-gray-800 text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none w-[45%] min-w-0"
                  onChange={e => setEditFields(f => ({ ...f, firstName: e.target.value }))}
                  onBlur={e => {
                    const val = e.target.value.trim();
                    if (val !== (selectedContact.firstName || "")) {
                      updateContactMutation.mutate({ id: selectedContact.id, data: { firstName: val } });
                      setSelectedContact({ ...selectedContact, firstName: val });
                    }
                  }}
                />
                <input
                  value={editFields.lastName}
                  placeholder="Last name"
                  className="font-semibold text-gray-800 text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none flex-1 min-w-0"
                  onChange={e => setEditFields(f => ({ ...f, lastName: e.target.value }))}
                  onBlur={e => {
                    const val = e.target.value.trim();
                    if (val !== (selectedContact.lastName || "")) {
                      updateContactMutation.mutate({ id: selectedContact.id, data: { lastName: val } });
                      setSelectedContact({ ...selectedContact, lastName: val });
                    }
                  }}
                />
              </div>
              <input
                value={editFields.brokerage}
                placeholder="Brokerage"
                className="text-xs text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none w-full"
                onChange={e => setEditFields(f => ({ ...f, brokerage: e.target.value }))}
                onBlur={e => {
                  const val = e.target.value.trim();
                  if (val !== (selectedContact.brokerage || "")) {
                    updateContactMutation.mutate({ id: selectedContact.id, data: { brokerage: val } });
                    setSelectedContact({ ...selectedContact, brokerage: val });
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Prev / Next navigation */}
              {(() => {
                const idx = contacts.findIndex(c => c.id === selectedContact.id);
                const hasPrev = idx > 0;
                const hasNext = idx >= 0 && idx < contacts.length - 1;
                return (
                  <>
                    <button
                      onClick={() => hasPrev && setSelectedContact(contacts[idx - 1])}
                      disabled={!hasPrev}
                      title="Previous contact"
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[10px] text-gray-300 select-none">{idx >= 0 ? `${idx + 1}/${contacts.length}` : ""}</span>
                    <button
                      onClick={() => hasNext && setSelectedContact(contacts[idx + 1])}
                      disabled={!hasNext}
                      title="Next contact"
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                );
              })()}
              <button
                onClick={() => setConfirmDeleteId(selectedContact.id)}
                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                title="Delete contact"
              >
                <Trash2 size={14} />
              </button>
              <button onClick={() => setSelectedContact(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Contact Info */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Contact Info</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-1.5 col-span-2">
                  <Mail size={12} className="text-gray-400 shrink-0" />
                  <input
                    value={editFields.email}
                    placeholder="Email address"
                    type="email"
                    className="flex-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none text-xs text-gray-600 truncate"
                    onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))}
                    onBlur={e => {
                      const val = e.target.value.trim();
                      if (val !== (selectedContact.email || "")) {
                        updateContactMutation.mutate({ id: selectedContact.id, data: { email: val } });
                        setSelectedContact({ ...selectedContact, email: val });
                      }
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <Phone size={12} className="text-gray-400 shrink-0" />
                  <input
                    value={editFields.phone}
                    placeholder="Phone number"
                    type="tel"
                    className="flex-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none text-xs text-gray-600"
                    onChange={e => setEditFields(f => ({ ...f, phone: e.target.value }))}
                    onBlur={e => {
                      const val = e.target.value.trim();
                      if (val !== (selectedContact.phone || "")) {
                        updateContactMutation.mutate({ id: selectedContact.id, data: { phone: val } });
                        setSelectedContact({ ...selectedContact, phone: val });
                      }
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageCircle size={12} className={selectedContact.smsOptIn ? "text-green-500" : "text-gray-400"} />
                  <span className={selectedContact.smsOptIn ? "text-green-600" : "text-gray-400"}>
                    {selectedContact.smsOptIn ? "SMS Opted In" : "SMS Opted Out"}
                  </span>
                </div>
                {(selectedContact.marketsCovered || []).length > 0 && (
                  <div className="flex items-start gap-1.5 col-span-2">
                    <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                    <span className="text-gray-500">{(selectedContact.marketsCovered || []).join(", ")}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 col-span-2">
                  <UserCheck size={12} className="text-gray-400 shrink-0" />
                  <Input
                    placeholder="Assign to team member..."
                    defaultValue={selectedContact.assignedTo || ""}
                    className="h-6 text-[11px] flex-1"
                    onBlur={e => {
                      if (e.target.value !== (selectedContact.assignedTo || "")) {
                        updateContactMutation.mutate({ id: selectedContact.id, data: { assignedTo: e.target.value } });
                        setSelectedContact({ ...selectedContact, assignedTo: e.target.value || undefined });
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Tags</p>

              {/* Applied tags */}
              {(selectedContact.crmTags || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(selectedContact.crmTags || []).map(tag => {
                    const isOutreach = (outreachTagsQuery.data || []).some(ot => ot.tag === tag);
                    return (
                      <span key={tag} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border ${isOutreach ? "bg-violet-50 text-violet-700 border-violet-200" : tagColor(tag)}`}>
                        {isOutreach && <Megaphone size={9} />}
                        {tag}
                        <button onClick={() => removeTagFromContact(selectedContact, tag)} className="hover:opacity-70 ml-0.5">
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Outreach campaign tags */}
              {(outreachTagsQuery.data || []).length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-violet-500 flex items-center gap-1">
                      <Megaphone size={9} /> Outreach Campaigns — click to assign &amp; enroll
                    </p>
                    {(() => {
                      const outreachTagNames = new Set((outreachTagsQuery.data || []).map(ot => ot.tag));
                      const appliedOutreachTags = (selectedContact.crmTags || []).filter(t => outreachTagNames.has(t));
                      if (appliedOutreachTags.length > 1) {
                        return (
                          <span
                            title={`This contact has ${appliedOutreachTags.length} outreach campaign tags: ${appliedOutreachTags.join(", ")}`}
                            className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 text-[10px] font-semibold cursor-default"
                          >
                            <AlertTriangle size={9} />
                            {appliedOutreachTags.length} campaign tags
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(outreachTagsQuery.data || []).map(ot => {
                      const applied = (selectedContact.crmTags || []).includes(ot.tag);
                      const activeEnrollment = (activityQuery.data?.enrollments || []).find(
                        (e: any) => e.template_id === ot.id && ["pending", "in_progress"].includes(e.status)
                      );
                      const enrolled = !!activeEnrollment;
                      return applied ? (
                        <span
                          key={ot.id}
                          className="inline-flex items-center rounded-full border bg-violet-600 text-white border-violet-600 shadow-sm text-[11px] font-medium overflow-hidden"
                        >
                          <span className="flex items-center gap-1 pl-2.5 pr-1.5 py-1">
                            <Megaphone size={9} />
                            {ot.name}
                            {enrolled && (
                              <span className="bg-green-500 text-white rounded-full px-1 text-[9px] font-semibold">
                                Active
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => removeTagFromContact(selectedContact, ot.tag)}
                            title={`Remove "${ot.name}" tag`}
                            className="pr-2 pl-0.5 py-1 hover:bg-violet-800 transition-colors self-stretch flex items-center"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ) : (
                        <button
                          key={ot.id}
                          title={ot.senderName ? `Sender: ${ot.senderName} — click to tag & enroll` : "No sender assigned — click to tag"}
                          onClick={() => {
                            addTagToContact(selectedContact, ot.tag);
                            enrollMutation.mutate({
                              id: selectedContact.id,
                              templateId: ot.id,
                              senderId: ot.senderId,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] border transition-all font-medium bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                        >
                          <Megaphone size={9} />
                          {ot.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-gray-400">
                    Selecting a campaign tags the contact and enrolls them in the drip sequence.
                  </p>
                </div>
              )}

              {/* Custom tag input */}
              <div className="space-y-1">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Custom Tag</p>
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="Add tag..."
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newTagInput.trim()) {
                        addTagToContact(selectedContact, newTagInput.trim().toLowerCase().replace(/\s+/g, "-"));
                        setNewTagInput("");
                      }
                    }}
                    className="h-6 text-[11px] w-28 px-2"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2"
                    disabled={!newTagInput.trim()}
                    onClick={() => {
                      if (newTagInput.trim()) {
                        addTagToContact(selectedContact, newTagInput.trim().toLowerCase().replace(/\s+/g, "-"));
                        setNewTagInput("");
                      }
                    }}
                  >
                    <Plus size={11} />
                  </Button>
                </div>
                {(tagsQuery.data || []).filter(t => !(outreachTagsQuery.data || []).some(ot => ot.tag === t)).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {(tagsQuery.data || [])
                      .filter(t => !(outreachTagsQuery.data || []).some(ot => ot.tag === t))
                      .map(t => (
                        <button
                          key={t}
                          className={`text-[10px] border rounded-full px-2 py-0.5 hover:opacity-80 ${tagColor(t)}`}
                          onClick={() => addTagToContact(selectedContact, t)}
                        >
                          {t}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Notes</p>
              <Textarea
                key={selectedContact.id}
                placeholder="Add internal notes about this contact..."
                defaultValue={selectedContact.crmNotes || ""}
                rows={3}
                className="text-xs resize-none"
                onBlur={e => {
                  if (e.target.value !== (selectedContact.crmNotes || "")) {
                    updateContactMutation.mutate({ id: selectedContact.id, data: { crmNotes: e.target.value } });
                  }
                }}
              />
            </div>

            {/* Campaign Enrollments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Campaign Enrollments</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] px-2"
                  onClick={() => { setEnrollTargetId(selectedContact.id); setShowEnrollModal(true); }}
                >
                  <Plus size={11} className="mr-1" />Enroll
                </Button>
              </div>
              {activityQuery.isLoading ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse" />
              ) : activityQuery.isError ? (
                <p className="text-xs text-red-400 italic">Could not load enrollments</p>
              ) : (activityQuery.data?.enrollments || []).length === 0 ? (
                <p className="text-xs text-gray-400 italic">Not enrolled in any campaigns</p>
              ) : (
                <div className="space-y-1.5">
                  {(activityQuery.data?.enrollments || []).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 border border-gray-100">
                      <div>
                        <p className="text-xs font-medium text-gray-700">{e.template_name || "Campaign"}</p>
                        <p className="text-[10px] text-gray-400">
                          Step {(e.current_step_index || 0) + 1} · {e.status}
                          {e.next_send_at && ` · Next: ${new Date(e.next_send_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      {(e.status === "pending" || e.status === "in_progress") && (
                        <button
                          onClick={() => cancelEnrollmentMutation.mutate(e.id)}
                          className="text-red-400 hover:text-red-600 text-[10px]"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deals */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Deals ({activityQuery.data?.deals?.length || 0})
              </p>
              {activityQuery.isLoading ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse" />
              ) : activityQuery.isError ? (
                <p className="text-xs text-red-400 italic">Could not load deals</p>
              ) : (activityQuery.data?.deals || []).length === 0 ? (
                <p className="text-xs text-gray-400 italic">No deals submitted</p>
              ) : (
                <div className="space-y-1.5">
                  {(activityQuery.data?.deals || []).map((deal: any) => (
                    <div key={deal.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 border border-gray-100">
                      <div>
                        <p className="text-xs font-medium text-gray-700">
                          #{deal.dealNumber} — {deal.address}, {deal.city}, {deal.state}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {classificationBadge(deal.classification)}
                          <span className="text-[10px] text-gray-400">
                            {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </div>
                      <a href={`/analyst-dashboard?deal=${deal.id}`} target="_blank" className="text-blue-400 hover:text-blue-600">
                        <ChevronRight size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Communication Timeline */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Recent Communications
              </p>
              {activityQuery.isLoading ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse" />
              ) : activityQuery.isError ? (
                <p className="text-xs text-red-400 italic">Could not load communications</p>
              ) : (activityQuery.data?.communications || []).length === 0 ? (
                <p className="text-xs text-gray-400 italic">No communications recorded</p>
              ) : (
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {(activityQuery.data?.communications || []).map((c: any) => (
                    <div key={c.id} className="flex gap-2 text-xs text-gray-600">
                      <div className="shrink-0 mt-0.5">
                        {c.type === "email" ? (
                          <Mail size={12} className={c.direction === "outbound" ? "text-blue-500" : "text-gray-400"} />
                        ) : (
                          <MessageSquare size={12} className={c.direction === "outbound" ? "text-green-500" : "text-gray-400"} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{c.subject || (c.type === "sms" ? "SMS" : "Email")}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                        {c.body && typeof c.body === "string" && (
                          <p className="text-[10px] text-gray-400 truncate">{c.body.substring(0, 80)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      </div> {/* end inner flex row */}

      {/* Excel Import Modal */}
      <Dialog open={showImportModal} onOpenChange={v => { setShowImportModal(v); if (!v) { setImportPreview([]); setImportResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload size={16} />
              Import Contact Assignments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {importResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle size={18} className="text-green-600 shrink-0" />
                  <div>
                    <p className="font-medium text-green-800 text-sm">{importResult.matched} contact{importResult.matched !== 1 ? "s" : ""} assigned successfully</p>
                  </div>
                </div>
                {importResult.unmatched.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-red-700">{importResult.unmatched.length} unmatched (not found in system):</p>
                    <div className="max-h-32 overflow-y-auto bg-red-50 border border-red-100 rounded p-2 space-y-0.5">
                      {importResult.unmatched.map((id, i) => (
                        <p key={i} className="text-[11px] text-red-600">{id}</p>
                      ))}
                    </div>
                  </div>
                )}
                <Button className="w-full" onClick={() => { setShowImportModal(false); setImportResult(null); }}>Done</Button>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700 space-y-1">
                  <p className="font-medium">Accepted formats:</p>
                  <p>• Any CSV/Excel with an <strong>Email</strong> column and an assignment column named <strong>Assigned To</strong>, <strong>Brian or AJ</strong>, <strong>Rep</strong>, or <strong>Owner</strong></p>
                  <p>• Or a 2-column file: Column A = identifier, Column B = assignee</p>
                  <p className="text-blue-500">Row 1 is treated as a header and skipped.</p>
                </div>
                <div className="border border-gray-200 rounded overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                    <p className="text-xs font-medium text-gray-600">Preview — {importPreview.length} row{importPreview.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400">
                          <th className="px-3 py-1.5 text-left font-normal">Identifier</th>
                          <th className="px-3 py-1.5 text-left font-normal">Assign To</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-3 py-1.5 text-gray-700">{r.identifier}</td>
                            <td className="px-3 py-1.5 text-indigo-700 font-medium">{r.assignedTo}</td>
                          </tr>
                        ))}
                        {importPreview.length > 50 && (
                          <tr><td colSpan={2} className="px-3 py-1.5 text-gray-400 italic">...and {importPreview.length - 50} more rows</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={importAssignmentsMutation.isPending || importPreview.length === 0}
                  onClick={() => importAssignmentsMutation.mutate(importPreview)}
                >
                  {importAssignmentsMutation.isPending ? "Importing..." : `Import ${importPreview.length} Assignment${importPreview.length !== 1 ? "s" : ""}`}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enroll in Campaign Modal */}
      <Dialog open={showEnrollModal} onOpenChange={setShowEnrollModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enroll in Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-gray-500">
              {enrollTargetId
                ? "Select a campaign to enroll this contact in."
                : `Enrolling ${selectedIds.size} selected contact(s) in a campaign.`}
            </p>
            {campaignsQuery.isLoading ? (
              <div className="h-20 bg-gray-100 rounded animate-pulse" />
            ) : (campaignsQuery.data || []).length === 0 ? (
              <p className="text-xs text-gray-400 italic">No active campaign templates found. Create one in Outreach Management.</p>
            ) : (
              <div className="space-y-2">
                {(campaignsQuery.data || []).map((c: any) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    onClick={() => {
                      const targetId = enrollTargetId || (selectedIds.size === 1 ? Array.from(selectedIds)[0] : null);
                      const geoState = stateFilter !== "all" ? stateFilter : undefined;
                      if (targetId) {
                        enrollMutation.mutate({ id: targetId, templateId: c.id });
                      } else {
                        // Bulk enroll
                        const ids = Array.from(selectedIds);
                        Promise.all(ids.map(id => apiRequest("POST", `/api/crm/contacts/${id}/enroll`, { templateId: c.id, targetState: geoState })))
                          .then(() => {
                            qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
                            setShowEnrollModal(false);
                            toast({ title: `${ids.length} contacts enrolled${geoState ? ` (${geoState} campaign)` : ""}` });
                          });
                      }
                    }}
                    disabled={enrollMutation.isPending}
                  >
                    <div className="font-medium text-sm text-gray-800">{c.name}</div>
                    <div className="text-[11px] text-gray-400">{c.step_count} step{c.step_count !== 1 ? "s" : ""}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Tag Modal */}
      <Dialog open={showBulkTagModal} onOpenChange={setShowBulkTagModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{bulkTagAction === "add" ? "Tag" : "Untag"} {selectedIds.size} Contacts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">

            {/* Outreach campaign tags — shown first and most prominently */}
            {(outreachTagsQuery.data || []).length > 0 && bulkTagAction === "add" && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 flex items-center gap-1">
                  <Megaphone size={10} /> Assign to Outreach Campaign
                </p>
                <p className="text-[11px] text-gray-500">
                  Tags the selected contacts and enrolls them in the drip campaign.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(outreachTagsQuery.data || []).map(ot => (
                    <button
                      key={ot.id}
                      title={ot.senderName ? `Sender: ${ot.senderName}` : undefined}
                      onClick={async () => {
                        const ids = Array.from(selectedIds);
                        // Tag all contacts
                        await apiRequest("POST", "/api/crm/bulk-tag", { brokerIds: ids, tag: ot.tag, action: "add" });
                        // Enroll all contacts (pass geo state if a state filter is active)
                        const geoState = stateFilter !== "all" ? stateFilter : undefined;
                        await Promise.allSettled(ids.map(id =>
                          apiRequest("POST", `/api/crm/contacts/${id}/enroll`, { templateId: ot.id, senderId: ot.senderId, targetState: geoState })
                        ));
                        qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
                        setSelectedIds(new Set());
                        setShowBulkTagModal(false);
                        toast({ title: `${ids.length} contacts tagged & enrolled in "${ot.name}"${geoState ? ` [${geoState}]` : ""}` });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 transition-all"
                    >
                      <Megaphone size={10} />
                      {ot.name}
                      {ot.senderName && <span className="text-violet-400">· {ot.senderName.split(" ")[0]}</span>}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-2" />
              </div>
            )}

            {/* Custom tag input */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Custom Tag</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag name (e.g. hot-lead, follow-up)"
                  value={bulkTagInput}
                  onChange={e => setBulkTagInput(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  onKeyDown={e => {
                    if (e.key === "Enter" && bulkTagInput.trim()) {
                      bulkTagMutation.mutate({ ids: Array.from(selectedIds), tag: bulkTagInput.trim(), action: bulkTagAction });
                    }
                  }}
                />
                <Button
                  disabled={!bulkTagInput.trim() || bulkTagMutation.isPending}
                  onClick={() => bulkTagMutation.mutate({ ids: Array.from(selectedIds), tag: bulkTagInput.trim(), action: bulkTagAction })}
                >
                  {bulkTagAction === "add" ? "Add" : "Remove"}
                </Button>
              </div>
              {(tagsQuery.data || []).filter(t => !(outreachTagsQuery.data || []).some(ot => ot.tag === t)).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(tagsQuery.data || [])
                    .filter(t => !(outreachTagsQuery.data || []).some(ot => ot.tag === t))
                    .map(t => (
                      <button
                        key={t}
                        className={`text-[11px] border rounded-full px-2 py-0.5 hover:opacity-80 ${tagColor(t)}`}
                        onClick={() => setBulkTagInput(t)}
                      >
                        {t}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Contacts Modal */}
      <Dialog open={showContactImportModal} onOpenChange={v => { setShowContactImportModal(v); if (!v) { setContactImportPreview([]); setContactImportResult(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload size={16} />Import Contacts
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {contactImportResult ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                  <CheckCircle size={28} className="text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-green-800 text-sm">Import complete</p>
                  <p className="text-xs text-green-700 mt-1">
                    {contactImportResult.inserted} new contacts added · {contactImportResult.updated} existing contacts updated
                  </p>
                </div>
                <Button className="w-full" variant="outline" onClick={() => { setShowContactImportModal(false); setContactImportResult(null); }}>Close</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">{contactImportPreview.length} contacts parsed from file. Review below then click Import.</p>
                  <button className="text-xs text-blue-600 underline hover:no-underline" onClick={downloadContactTemplate}>Download template</button>
                </div>
                <div className="border rounded-md overflow-auto max-h-64">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 border-b sticky top-0">
                      <tr>
                        {["First Name","Last Name","Email","Phone","Brokerage","State/Region","Assigned To","Tags"].map(h => (
                          <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contactImportPreview.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-2 py-1">{r.firstName}</td>
                          <td className="px-2 py-1">{r.lastName}</td>
                          <td className="px-2 py-1 text-blue-600">{r.email}</td>
                          <td className="px-2 py-1 text-gray-500">{r.phone}</td>
                          <td className="px-2 py-1">{r.brokerage}</td>
                          <td className="px-2 py-1 text-gray-500">{r.stateRegion}</td>
                          <td className="px-2 py-1 font-medium">{r.assignedTo}</td>
                          <td className="px-2 py-1 text-gray-500">{r.tags}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-gray-400">
                  Existing contacts (matched by email) will have their assignment and tags updated. New contacts will be created. Tags use semicolon separation (e.g. CRE Broker;HNW Equity).
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowContactImportModal(false)}>Cancel</Button>
                  <Button
                    disabled={importContactsMutation.isPending}
                    className="bg-[#07172A] hover:bg-[#0d2d4e] text-white"
                    onClick={() => importContactsMutation.mutate(contactImportPreview)}
                  >
                    <Upload size={13} className="mr-1.5" />
                    {importContactsMutation.isPending ? "Importing..." : `Import ${contactImportPreview.length} Contacts`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Single Contact Confirm */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Contact?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-1">
            This will permanently remove the contact and all their associated data. This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteContactMutation.isPending}
              onClick={() => confirmDeleteId && deleteContactMutation.mutate(confirmDeleteId)}
            >
              <Trash2 size={14} className="mr-1" />
              {deleteContactMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Tags Dialog */}
      <Dialog open={manageTagsOpen} onOpenChange={setManageTagsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag size={16} /> Tags
            </DialogTitle>
            <DialogDescription>
              Create tags to segment and filter your contacts. Tags can be applied to individual contacts from the contact detail panel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Create new tag */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Create new tag</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Family Office, BTR Buyer, Hot Lead..."
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newTagName.trim()) {
                      createTagMutation.mutate(newTagName.trim());
                    }
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={!newTagName.trim() || createTagMutation.isPending}
                  onClick={() => createTagMutation.mutate(newTagName.trim())}
                  className="shrink-0"
                >
                  {createTagMutation.isPending ? (
                    <Loader2 size={13} className="animate-spin mr-1" />
                  ) : (
                    <Plus size={13} className="mr-1" />
                  )}
                  Create
                </Button>
              </div>
              <p className="text-[11px] text-gray-400">Press Enter or click Create to add.</p>
            </div>

            {/* Existing tags list */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Existing tags
                </label>
                <span className="text-xs text-gray-400">{(tagsQuery.data || []).length} total</span>
              </div>
              <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                {(tagsQuery.data || []).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">No tags yet — create one above</p>
                )}
                {(tagsQuery.data || []).map(tag => (
                  <div key={tag} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag size={11} className="text-gray-400 shrink-0" />
                      <span className="text-sm truncate">{tag}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Delete tag "${tag}"? This will remove it from all contacts.`)) {
                          deleteTagMutation.mutate(tag);
                        }
                      }}
                      disabled={deleteTagMutation.isPending}
                      className="ml-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all shrink-0"
                      title={`Delete "${tag}"`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">Hover a tag and click the trash icon to delete it. Deleting removes it from all contacts.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Contacts?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-1">
            This will permanently remove {selectedIds.size} contacts and all their associated data. This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            >
              <Trash2 size={14} className="mr-1" />
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedIds.size} Contacts`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Contact Dialog */}
      <Dialog open={showNewContactModal} onOpenChange={open => { setShowNewContactModal(open); if (!open) setNewContact({ firstName: "", lastName: "", email: "", phone: "", brokerage: "", assignedTo: "", crmNotes: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus size={16} className="text-green-600" />New Contact</DialogTitle>
            <DialogDescription>Add a contact to your CRM manually.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">First Name <span className="text-red-500">*</span></label>
                <Input
                  placeholder="Jane"
                  value={newContact.firstName}
                  onChange={e => setNewContact(p => ({ ...p, firstName: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Last Name <span className="text-red-500">*</span></label>
                <Input
                  placeholder="Smith"
                  value={newContact.lastName}
                  onChange={e => setNewContact(p => ({ ...p, lastName: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Email</label>
              <Input
                type="email"
                placeholder="jane@example.com"
                value={newContact.email}
                onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Phone</label>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={newContact.phone}
                onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Brokerage / Company</label>
              <Input
                placeholder="ABC Realty"
                value={newContact.brokerage}
                onChange={e => setNewContact(p => ({ ...p, brokerage: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Assigned To</label>
              <Input
                placeholder="e.g. AJ Klenk"
                value={newContact.assignedTo}
                onChange={e => setNewContact(p => ({ ...p, assignedTo: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Notes</label>
              <Textarea
                placeholder="Internal notes about this contact..."
                value={newContact.crmNotes}
                onChange={e => setNewContact(p => ({ ...p, crmNotes: e.target.value }))}
                className="text-sm resize-none"
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowNewContactModal(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!newContact.firstName.trim() || !newContact.lastName.trim() || createContactMutation.isPending}
              onClick={() => createContactMutation.mutate(newContact)}
            >
              {createContactMutation.isPending ? <><Loader2 size={14} className="mr-1 animate-spin" />Saving...</> : <><Plus size={14} className="mr-1" />Create Contact</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

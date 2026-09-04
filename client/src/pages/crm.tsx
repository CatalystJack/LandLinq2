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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Users, Tag, Mail, Phone, MapPin, Building2, MessageSquare,
  Calendar, ChevronRight, ChevronLeft, X, Plus, Send, FileText, TrendingUp,
  CheckCircle, XCircle, Clock, AlertCircle, MoreHorizontal, RefreshCw,
  MessageCircle, Filter, Inbox, Upload, Megaphone, Trash2, Settings2, Loader2, AlertTriangle, Pencil, Save, ChevronDown
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
  companyMemberCount?: number;
}

interface ActivityData {
  broker: Contact;
  deals: any[];
  communications: any[];
  enrollments: any[];
}

interface ContactsResponse {
  contacts: Contact[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return asStringArray(parsed);
  } catch {
    // Legacy rows may store comma- or semicolon-delimited text instead of JSON.
  }

  return value.split(/[;,]/).map(item => item.trim()).filter(Boolean);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`${response.status}: ${message}`);
  }
  return response.json();
}

function normalizeContactsResponse(value: unknown): ContactsResponse {
  const payload = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawContacts = asArray<unknown>(payload.contacts).filter(
    (contact): contact is Record<string, unknown> => Boolean(contact) && typeof contact === "object",
  );
  const rawPagination = payload.pagination && typeof payload.pagination === "object"
    ? payload.pagination as Record<string, unknown>
    : undefined;

  const numberOr = (input: unknown, fallback: number) => {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    contacts: rawContacts.map(contact => ({
      ...contact,
      id: String(contact.id || ""),
      firstName: String(contact.firstName || ""),
      lastName: String(contact.lastName || ""),
      crmTags: asStringArray(contact.crmTags),
      marketsCovered: asStringArray(contact.marketsCovered),
      dealCount: numberOr(contact.dealCount, 0),
    } as Contact)),
    pagination: rawPagination ? {
      page: numberOr(rawPagination.page, 1),
      limit: numberOr(rawPagination.limit, rawContacts.length),
      total: numberOr(rawPagination.total, rawContacts.length),
      totalPages: numberOr(rawPagination.totalPages, 1),
      hasNextPage: rawPagination.hasNextPage === true,
      hasPrevPage: rawPagination.hasPrevPage === true,
    } : undefined,
  };
}

function normalizeActivityResponse(value: unknown): ActivityData {
  const payload = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawBroker = payload.broker && typeof payload.broker === "object"
    ? payload.broker as Record<string, unknown>
    : {};

  return {
    broker: {
      ...rawBroker,
      id: String(rawBroker.id || ""),
      firstName: String(rawBroker.firstName || ""),
      lastName: String(rawBroker.lastName || ""),
      crmTags: asStringArray(rawBroker.crmTags),
      marketsCovered: asStringArray(rawBroker.marketsCovered),
      dealCount: Number.isFinite(Number(rawBroker.dealCount)) ? Number(rawBroker.dealCount) : 0,
    } as Contact,
    deals: asArray(payload.deals),
    communications: asArray(payload.communications),
    enrollments: asArray(payload.enrollments),
  };
}

const TAG_COLORS: Record<string, string> = {
  "hot-lead": "bg-red-100 text-red-700 border-red-200",
  "warm": "bg-orange-100 text-orange-700 border-orange-200",
  "follow-up": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "active": "bg-green-100 text-green-700 border-green-200",
  "vip": "bg-[#e7f0ff] text-[#1554a3] border-[#b9d2f5]",
  "new": "bg-blue-100 text-blue-700 border-blue-200",
  "inactive": "bg-gray-100 text-gray-600 border-gray-200",
  "do-not-contact": "bg-red-200 text-red-800 border-red-300",
};

function tagColor(tag: unknown) {
  const normalizedTag = String(tag || "").toLowerCase();
  return TAG_COLORS[normalizedTag] || "bg-indigo-50 text-indigo-700 border-indigo-200";
}

function classificationBadge(c: string) {
  if (c === "green") return <span className="inline-flex items-center gap-1 text-green-700 font-medium text-[10px]"><CheckCircle size={10} />High Priority</span>;
  if (c === "yellow") return <span className="inline-flex items-center gap-1 text-yellow-600 font-medium text-[10px]"><AlertCircle size={10} />Potential</span>;
  if (c === "red") return <span className="inline-flex items-center gap-1 text-red-600 font-medium text-[10px]"><XCircle size={10} />Clear No</span>;
  return <span className="text-gray-400 text-[10px]">{c || "—"}</span>;
}

function contactStatus(contact: Contact) {
  if (!contact.isActive) return { label: "Inactive", className: "bg-slate-100 text-slate-500 border-slate-200" };
  const tags = asStringArray(contact.crmTags).map(tag => tag.toLowerCase());
  if (tags.some(tag => tag.includes("hot") || tag === "vip")) return { label: "Priority", className: "bg-[#e7f0ff] text-[#1554a3] border-[#b9d2f5]" };
  if (tags.some(tag => tag.includes("follow") || tag === "warm")) return { label: "Follow-up", className: "bg-[#fff4dc] text-[#8a5b08] border-[#f2d394]" };
  return { label: "Active", className: "bg-[#e5f6f2] text-[#167465] border-[#b8e5db]" };
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
  const [companyFilter, setCompanyFilter] = useState("all");
  const [multiCampaignTagFilter, setMultiCampaignTagFilter] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "activity">("overview");
  const [editFields, setEditFields] = useState({ firstName: "", lastName: "", email: "", phone: "", brokerage: "", assignedTo: "", crmNotes: "" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollTargetId, setEnrollTargetId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState("");
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagAction, setBulkTagAction] = useState<"add" | "remove">("add");
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
  const contactImportInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setEditFields({
      firstName: selectedContact?.firstName || "",
      lastName: selectedContact?.lastName || "",
      email: selectedContact?.email || "",
      phone: selectedContact?.phone || "",
      brokerage: selectedContact?.brokerage || "",
      assignedTo: selectedContact?.assignedTo || "",
      crmNotes: selectedContact?.crmNotes || "",
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

  const contactsQuery = useQuery<ContactsResponse>({
    queryKey: ["/api/crm/contacts", page, limit, search, tagFilter, marketFilter, smsFilter, stateFilter, msaFilter, countyFilter, assignedToFilter, companyFilter, multiCampaignTagFilter],
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
      if (companyFilter && companyFilter !== "all") params.set("brokerage", companyFilter);
      if (multiCampaignTagFilter) params.set("multiCampaignTag", "true");
      return fetchJson(`/api/crm/contacts?${params}`).then(normalizeContactsResponse);
    },
  });

  const geoOptionsQuery = useQuery<{
    states: string[];
    msasByState: Record<string, string[]>;
    countiesByMsa: Record<string, string[]>;
    counties: string[];
    assignedTos: string[];
    brokerages: string[];
  }>({
    queryKey: ["/api/crm/geo-options"],
    queryFn: async () => {
      const value = await fetchJson("/api/crm/geo-options");
      const payload = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const rawMsas = payload.msasByState && typeof payload.msasByState === "object"
        ? payload.msasByState as Record<string, unknown>
        : {};
      const rawCounties = payload.countiesByMsa && typeof payload.countiesByMsa === "object"
        ? payload.countiesByMsa as Record<string, unknown>
        : {};
      return {
        states: asStringArray(payload.states),
        msasByState: Object.fromEntries(Object.entries(rawMsas).map(([key, item]) => [key, asStringArray(item)])),
        countiesByMsa: Object.fromEntries(Object.entries(rawCounties).map(([key, item]) => [key, asStringArray(item)])),
        counties: asStringArray(payload.counties),
        assignedTos: asStringArray(payload.assignedTos),
        brokerages: asStringArray(payload.brokerages),
      };
    },
  });

  const tagsQuery = useQuery<string[]>({
    queryKey: ["/api/crm/tags"],
    queryFn: () => fetchJson("/api/crm/tags").then(asStringArray),
  });

  const outreachTagsQuery = useQuery<{ id: string; name: string; tag: string; senderId: string | null; senderName: string | null }[]>({
    queryKey: ["/api/crm/outreach-tags"],
    queryFn: () => fetchJson("/api/crm/outreach-tags").then(value => asArray<any>(value).map(item => ({
      id: String(item?.id || ""),
      name: String(item?.name || ""),
      tag: String(item?.tag || ""),
      senderId: item?.senderId ? String(item.senderId) : null,
      senderName: item?.senderName ? String(item.senderName) : null,
    })).filter(item => item.id && item.tag)),
  });

  const activityQuery = useQuery<ActivityData>({
    queryKey: ["/api/crm/contacts", selectedContact?.id, "activity"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/contacts/${selectedContact!.id}/activity`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json().then(normalizeActivityResponse);
    },
    enabled: !!selectedContact,
  });

  const campaignsQuery = useQuery<any[]>({
    queryKey: ["/api/crm/campaigns"],
    queryFn: () => fetchJson("/api/crm/campaigns").then(asArray),
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/crm/contacts/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      qc.invalidateQueries({ queryKey: ["/api/crm/tags"] });
      toast({ title: "Contact updated" });
    },
    onError: (error: Error) => toast({
      title: "Update failed",
      description: error.message,
      variant: "destructive",
    }),
  });

  const hasUnsavedContactChanges = !!selectedContact && (
    editFields.firstName.trim() !== (selectedContact.firstName || "") ||
    editFields.lastName.trim() !== (selectedContact.lastName || "") ||
    editFields.email.trim() !== (selectedContact.email || "") ||
    editFields.phone.trim() !== (selectedContact.phone || "") ||
    editFields.brokerage.trim() !== (selectedContact.brokerage || "") ||
    editFields.assignedTo.trim() !== (selectedContact.assignedTo || "") ||
    editFields.crmNotes !== (selectedContact.crmNotes || "")
  );

  const saveContactChanges = () => {
    if (!selectedContact || !hasUnsavedContactChanges) return;
    const data = {
      firstName: editFields.firstName.trim(),
      lastName: editFields.lastName.trim(),
      email: editFields.email.trim(),
      phone: editFields.phone.trim(),
      brokerage: editFields.brokerage.trim(),
      assignedTo: editFields.assignedTo.trim(),
      crmNotes: editFields.crmNotes,
    };
    updateContactMutation.mutate(
      { id: selectedContact.id, data },
      {
        onSuccess: () => {
          setSelectedContact(current => current ? { ...current, ...data } : current);
        },
      },
    );
  };

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

  const contacts = asArray<Contact>(contactsQuery.data?.contacts);
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
    updateContactMutation.mutate({ id: contact.id, data: { addTag: tag } });
    if (selectedContact?.id === contact.id) setSelectedContact({ ...contact, crmTags: next });
  };

  const removeTagFromContact = (contact: Contact, tag: string) => {
    const next = (contact.crmTags || []).filter(t => t !== tag);
    updateContactMutation.mutate({ id: contact.id, data: { removeTag: tag } });
    if (selectedContact?.id === contact.id) setSelectedContact({ ...contact, crmTags: next });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#edf3f8] text-[#18334e]">
      <Navigation />
      <div className="flex min-h-0 flex-1 overflow-hidden bg-[#edf3f8]">
      {/* LEFT: Contacts List */}
      <div className={`flex flex-col ${selectedContact ? 'hidden' : 'w-full'} transition-all duration-200 border-r border-[#d4e0eb] bg-[#f7fafd]`}>

        {/* Header */}
        <div className="shrink-0 border-b border-[#d4e0eb] bg-[#f7fafd] px-5 py-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b3159] text-[#b9dcff] shadow-sm">
                <Users size={17} />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-[-0.02em] text-[#102b49]">Contacts</h1>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7590ad]">Relationship directory</p>
              </div>
              {pagination && (
                <span className="mt-1 rounded-full bg-[#e4edf8] px-2 py-1 text-[11px] font-semibold text-[#406384]">
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
              <input
                ref={contactImportInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) { handleContactImportFile(e.target.files[0]); e.target.value = ""; } }}
              />
              <Button
                size="sm"
                className="h-7 border-0 bg-[#0b3159] text-xs text-white hover:bg-[#164b7d]"
                onClick={() => setShowNewContactModal(true)}
              >
                <Plus size={12} className="mr-1" />New Contact
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-[#c6d9ea] text-xs text-[#1554a3] hover:border-[#1554a3] hover:bg-[#1554a3] hover:text-white"
                  >
                    <Settings2 size={12} className="mr-1" />
                    CRM Tools
                    <ChevronDown size={12} className="ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Import & refresh</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => contactImportInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Contacts
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => qc.invalidateQueries({ queryKey: ["/api/crm/contacts"] })}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Contacts
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Filters — Row 1: search + tags + sms */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-[360px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f84aa]" />
              <Input
                placeholder="Search name, email, phone..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 rounded-lg border-[#c9d9e9] bg-white text-xs shadow-[0_1px_2px_rgba(21,57,91,0.04)] placeholder:text-[#8aa0b8] focus:border-[#4a90e2] focus:ring-2 focus:ring-[#4a90e2]/20"
              />
            </div>
            {/* Custom tag filter with inline delete */}
            <div ref={tagDropdownRef} className="relative">
              <button
                onClick={() => setTagDropdownOpen(v => !v)}
                className={`h-9 px-3 flex items-center gap-1.5 rounded-lg border text-xs w-[170px] justify-between transition-colors ${
                  tagFilter !== "all"
                    ? "border-[#8eafd0] bg-[#e7f0ff] text-[#1554a3]"
                    : "border-[#c9d9e9] bg-white text-[#45627f] hover:border-[#8ab1d8] hover:bg-[#f3f8fe]"
                }`}
              >
                <span className="truncate">{tagFilter === "all" ? "All tags" : tagFilter}</span>
                <ChevronRight size={11} className={`shrink-0 transition-transform ${tagDropdownOpen ? "rotate-90" : ""}`} />
              </button>
              {tagDropdownOpen && (
                <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
                  <button
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 ${tagFilter === "all" ? "font-semibold text-[#1554a3]" : "text-gray-700"}`}
                    onClick={() => { setTagFilter("all"); setPage(1); setTagDropdownOpen(false); }}
                  >
                    {tagFilter === "all" && <CheckCircle size={10} className="text-[#3278c7] shrink-0" />}
                    <span>All tags</span>
                  </button>
                  {(tagsQuery.data || []).map(t => (
                    <div key={t} className="flex items-center group hover:bg-gray-50">
                      <button
                        className={`flex-1 text-left px-3 py-1.5 text-xs flex items-center gap-1.5 min-w-0 ${tagFilter === t ? "font-semibold text-[#1554a3]" : "text-gray-700"}`}
                        onClick={() => { setTagFilter(t); setPage(1); setTagDropdownOpen(false); }}
                      >
                        {tagFilter === t && <CheckCircle size={10} className="text-[#3278c7] shrink-0" />}
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
                  ? "border-[#8eafd0] bg-[#e7f0ff] text-[#1554a3] hover:bg-[#dceaff]"
                  : "border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              }`}
            >
              <AlertTriangle size={11} />
              Multi-campaign
            </button>
            {/* Clear all geo filters button */}
            {(stateFilter !== "all" || msaFilter !== "all" || countyFilter !== "all" || assignedToFilter !== "all" || companyFilter !== "all") && (
              <button
                onClick={() => { setStateFilter("all"); setMsaFilter("all"); setCountyFilter("all"); setAssignedToFilter("all"); setCompanyFilter("all"); setPage(1); }}
                className="h-7 rounded border border-[#c6d9ea] bg-[#e7f0ff] px-2 text-xs font-medium text-[#1554a3] transition-colors hover:bg-[#dceaff] flex items-center gap-1"
              >
                <X size={11} /> Clear filters
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
            <Select value={companyFilter} onValueChange={v => { setCompanyFilter(v); setPage(1); }}>
              <SelectTrigger className={`h-7 text-xs w-[220px] ${companyFilter !== "all" ? "border-blue-400 bg-blue-50 text-blue-800" : ""}`}>
                <Building2 size={12} className="mr-1.5 shrink-0" />
                <SelectValue placeholder="Company profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {(geoOptionsQuery.data?.brokerages || []).map(company => (
                  <SelectItem key={company} value={company}>{company}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {contactsQuery.isError && (
          <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3">
            <span>Contacts could not be loaded. The rest of the CRM is still available.</span>
            <Button size="sm" variant="outline" onClick={() => contactsQuery.refetch()}>
              <RefreshCw size={12} className="mr-1" /> Try again
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto px-3 pb-3 sm:px-5">
          <table className="w-full min-w-[720px] text-xs border-separate border-spacing-y-1.5 table-fixed">
            <thead className="sticky top-0 bg-[#f8fbff] z-10">
              <tr>
                <th className="w-10 px-3 py-3 text-left shrink-0">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="w-[210px] max-w-[210px] px-3 py-3 text-left text-[#66829e] font-semibold uppercase tracking-[0.1em] text-[10px]">Contact</th>
                <th className="w-[220px] max-w-[220px] px-3 py-3 text-left text-[#66829e] font-semibold uppercase tracking-[0.1em] text-[10px]">Reach</th>
                <th className="w-[150px] px-3 py-3 text-left text-[#66829e] font-semibold uppercase tracking-[0.1em] text-[10px] hidden md:table-cell">Organization</th>
                <th className="w-[180px] px-3 py-3 text-left text-[#66829e] font-semibold uppercase tracking-[0.1em] text-[10px] hidden lg:table-cell">Signals</th>
                <th className="w-[130px] px-3 py-3 text-left text-[#66829e] font-semibold uppercase tracking-[0.1em] text-[10px] hidden xl:table-cell">Owner</th>
                <th className="w-16 px-3 py-3 text-center text-[#66829e] font-semibold uppercase tracking-[0.1em] text-[10px]">Deals</th>
                <th className="w-[90px] px-3 py-3 text-left text-[#66829e] font-semibold uppercase tracking-[0.1em] text-[10px] hidden xl:table-cell">Added</th>
                <th className="w-10 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {contactsQuery.isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="rounded-lg bg-white px-3 py-4 shadow-sm">
                      <div className="h-3 bg-[#e4edf7] rounded animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : contacts.length === 0 ? (
                <tr>
                    <td colSpan={9} className="rounded-xl bg-white px-6 py-16 text-center text-[#7690aa] shadow-sm">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f0ff] text-[#3278c7]">
                      <Inbox size={22} />
                    </div>
                    <p className="font-semibold text-[#284866]">No contacts found</p>
                    <p className="mt-1 text-xs text-[#89a0b6]">Try widening your search or clearing a filter.</p>
                  </td>
                </tr>
              ) : contacts.map(contact => {
                const isSelected = selectedIds.has(contact.id);
                const isActive = selectedContact?.id === contact.id;
                return (
                  <tr
                    key={contact.id}
                    className={`group cursor-pointer transition-all duration-150 ${
                      isActive ? 'bg-[#e7f0ff] shadow-[inset_3px_0_0_#3278c7]' : isSelected ? 'bg-[#edf5ff]' : 'bg-white shadow-sm hover:bg-[#f4f9ff] hover:shadow-[0_3px_10px_rgba(28,79,126,0.08)]'
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <td className="rounded-l-lg px-3 py-3" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(contact.id)}
                      />
                    </td>
                    <td className="px-3 py-3 w-[210px] max-w-[210px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dcecff] text-[11px] font-bold text-[#245c99] ring-1 ring-[#c4daf2]">
                          {(contact.firstName?.[0] || "").toUpperCase()}{(contact.lastName?.[0] || "").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                        <div className="font-semibold text-[#173654] truncate">
                        {contact.firstName} {contact.lastName}
                        </div>
                        <span className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${contactStatus(contact).className}`}>
                          {contactStatus(contact).label}
                        </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[#55718e] w-[220px] max-w-[220px]">
                      {contact.email && <div className="flex items-center gap-1.5 truncate"><Mail size={11} className="shrink-0 text-[#78a1c8]" /><span className="truncate">{contact.email}</span></div>}
                      {contact.phone && <div className="mt-1 flex items-center gap-1.5 text-[#89a1b8]"><Phone size={11} className="shrink-0 text-[#78a1c8]" />{contact.phone}</div>}
                    </td>
                    <td className="px-3 py-3 text-[#55718e] hidden md:table-cell max-w-[150px] truncate">
                      {contact.brokerage || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
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
                    <td className="px-3 py-3 hidden xl:table-cell">
                      {contact.assignedTo ? (
                        <div className="flex items-center gap-1 text-xs text-indigo-700">
                          <UserCheck size={11} className="shrink-0" />
                          <span className="truncate max-w-[110px]">{contact.assignedTo}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-semibold ${(contact.dealCount || 0) > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                        {contact.dealCount || 0}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#8aa1b7] hidden xl:table-cell whitespace-nowrap">
                      {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                    </td>
                    <td className="rounded-r-lg px-3 py-3">
                      <ChevronRight size={14} className={`text-[#a2b8cd] transition-transform group-hover:translate-x-0.5 ${isActive ? 'text-[#3278c7]' : ''}`} />
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
      {selectedContact && (<>
        <div className="w-full flex flex-col bg-[#eef3f8] overflow-hidden">
          {/* Contact record header */}
          <div className="shrink-0 bg-[#0b3159] text-white px-5 sm:px-8 pt-3 pb-6 shadow-[0_5px_18px_rgba(8,23,41,0.12)]">
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setSelectedContact(null)}
                className="inline-flex items-center gap-1.5 text-xs text-blue-100 hover:text-white transition-colors"
              >
                <ChevronLeft size={14} /> Back to contacts
              </button>
              <div className="flex items-center gap-1">
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
                        className="p-1.5 rounded text-blue-100 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span className="text-[10px] text-blue-100/70 select-none">{idx >= 0 ? `${idx + 1} of ${contacts.length}` : ""}</span>
                      <button
                        onClick={() => hasNext && setSelectedContact(contacts[idx + 1])}
                        disabled={!hasNext}
                        title="Next contact"
                        className="p-1.5 rounded text-blue-100 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={15} />
                      </button>
                      <button
                        onClick={() => setSelectedContact(null)}
                        title="Close contact"
                        className="ml-1 p-1.5 rounded text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <X size={15} />
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-5">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-[#2b82cf] border border-blue-200/50 flex items-center justify-center text-base font-semibold shrink-0 shadow-inner shadow-white/10">
                  {(selectedContact.firstName?.[0] || "").toUpperCase()}{(selectedContact.lastName?.[0] || "").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      id="crm-contact-first-name"
                      value={editFields.firstName}
                      placeholder="First name"
                      className="font-semibold text-2xl tracking-[-0.03em] bg-transparent border-b border-transparent hover:border-blue-200 focus:border-white focus:outline-none min-w-0 w-[45%] text-white placeholder:text-blue-200"
                      onChange={e => setEditFields(f => ({ ...f, firstName: e.target.value }))}
                    />
                    <input
                      value={editFields.lastName}
                      placeholder="Last name"
                      className="font-semibold text-2xl tracking-[-0.03em] bg-transparent border-b border-transparent hover:border-blue-200 focus:border-white focus:outline-none min-w-0 flex-1 text-white placeholder:text-blue-200"
                      onChange={e => setEditFields(f => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-blue-100">
                    <input
                      value={editFields.brokerage}
                      placeholder="Company / brokerage"
                      list="crm-company-profiles"
                      className="bg-transparent border-b border-transparent hover:border-blue-200 focus:border-white focus:outline-none min-w-0 max-w-[280px] text-blue-100 placeholder:text-blue-200"
                      onChange={e => setEditFields(f => ({ ...f, brokerage: e.target.value }))}
                    />
                    <span className="text-blue-200/70">•</span>
                    <span>{selectedContact.assignedTo || "Unassigned"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(selectedContact.crmTags || []).slice(0, 3).map(tag => (
                      <span key={tag} className="rounded bg-white/15 border border-white/20 px-2 py-0.5 text-[10px] text-blue-50">{tag}</span>
                    ))}
                    {!selectedContact.isActive && <span className="rounded bg-white/10 border border-white/20 px-2 py-0.5 text-[10px] text-blue-100">Inactive</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {selectedContact.email && (
                  <a
                    href={`mailto:${selectedContact.email}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/40 bg-white/[0.08] px-3 py-2 text-xs font-medium text-white hover:bg-white/15 transition-colors"
                  >
                    <Mail size={13} /> Email
                  </a>
                )}
                {selectedContact.phone && (
                  <a
                    href={`tel:${selectedContact.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/40 bg-white/[0.08] px-3 py-2 text-xs font-medium text-white hover:bg-white/15 transition-colors"
                  >
                    <Phone size={13} /> Call
                  </a>
                )}
                <button
                  onClick={() => document.getElementById("crm-contact-first-name")?.focus()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/40 bg-white/[0.08] px-3 py-2 text-xs font-medium text-white hover:bg-white/15 transition-colors"
                >
                  <Pencil size={13} /> Edit
                </button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!hasUnsavedContactChanges || updateContactMutation.isPending}
                  onClick={saveContactChanges}
                  className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                    hasUnsavedContactChanges
                      ? "border-[#9dd0f1] bg-[#2b82cf] text-white hover:bg-[#1f6fae]"
                      : "border-blue-200/30 bg-white/5 text-blue-200/60"
                  }`}
                >
                  {updateContactMutation.isPending ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
                  {updateContactMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
                <button
                  onClick={() => setConfirmDeleteId(selectedContact.id)}
                  title="Delete contact"
                  className="p-2 rounded-lg border border-red-200/30 bg-white/5 text-red-200 hover:bg-red-500/30 hover:text-white transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-3 mt-6 pt-4 border-t border-blue-200/20">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-blue-200/70 font-semibold">Phone</p>
                <p className="mt-1 text-xs font-medium text-white">{selectedContact.phone || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-blue-200/70 font-semibold">Email</p>
                <p className="mt-1 text-xs font-medium text-white truncate">{selectedContact.email || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-blue-200/70 font-semibold">Company</p>
                <p className="mt-1 text-xs font-medium text-white truncate">{selectedContact.brokerage || "—"}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-blue-200/70 font-semibold">Last contacted</p>
                <p className="mt-1 text-xs font-medium text-white">{selectedContact.lastContactedAt ? new Date(selectedContact.lastContactedAt).toLocaleDateString() : "—"}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">
             <aside className="w-full lg:w-[30%] lg:min-w-[280px] lg:max-w-[380px] shrink-0 overflow-visible lg:overflow-y-auto bg-[#f8fbfd] border-b lg:border-b-0 lg:border-r border-[#d6e2ec] px-5 py-6">
              {/* Contact Details */}
               <div className="border border-[#d6e2ec] rounded-xl bg-white shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                 <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e4edf4]">
                   <div>
                     <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7891a9]">Record</p>
                     <p className="mt-0.5 text-sm font-semibold text-[#173b5d]">Contact details</p>
                   </div>
                  <button
                    onClick={() => document.getElementById("crm-contact-first-name")?.focus()}
                    className="text-[11px] font-medium text-[#1683c5] hover:text-[#0a3769]"
                  >
                    Edit
                  </button>
                </div>
                 <div className="px-4 divide-y divide-[#edf2f6]">
                  <div className="py-3">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Name</p>
                    <p className="mt-1 text-xs font-medium text-gray-800">{selectedContact.firstName} {selectedContact.lastName}</p>
                  </div>
                  <div className="py-3">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Email</p>
                    <input
                      value={editFields.email}
                      placeholder="Email address"
                      type="email"
                      className="mt-1 w-full bg-transparent border-b border-gray-200 focus:border-[#1683c5] focus:outline-none text-xs text-[#1683c5] pb-1"
                      onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="py-3">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Phone</p>
                    <input
                      value={editFields.phone}
                      placeholder="Phone number"
                      type="tel"
                      className="mt-1 w-full bg-transparent border-b border-gray-200 focus:border-[#1683c5] focus:outline-none text-xs text-[#1683c5] pb-1"
                      onChange={e => setEditFields(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div className="py-3">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Account / Company</p>
                     {selectedContact.brokerage ? (
                       <button
                         type="button"
                         className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-[#dbe7f0] bg-[#f7fafd] px-3 py-2 text-left transition-colors hover:border-[#9fc2df] hover:bg-[#eef6fc]"
                         onClick={() => {
                           setCompanyFilter(selectedContact.brokerage || "all");
                           setPage(1);
                           setSelectedContact(null);
                         }}
                       >
                         <span className="min-w-0">
                           <span className="block truncate text-xs font-semibold text-[#173b5d]">{selectedContact.brokerage}</span>
                           <span className="mt-0.5 block text-[10px] text-[#7891a9]">
                             {selectedContact.companyMemberCount || 1} {(selectedContact.companyMemberCount || 1) === 1 ? "person" : "people"} at this company
                           </span>
                         </span>
                         <ChevronRight size={13} className="shrink-0 text-[#7891a9]" />
                       </button>
                     ) : (
                       <p className="mt-1 text-xs text-gray-500">No company assigned</p>
                     )}
                  </div>
                  <div className="py-3">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Assigned to</p>
                    <Input
                      placeholder="Assign to team member..."
                       value={editFields.assignedTo}
                      className="mt-1 h-7 text-xs px-0 border-0 border-b border-gray-200 rounded-none focus-visible:ring-0 focus-visible:border-[#1683c5]"
                       onChange={e => setEditFields(f => ({ ...f, assignedTo: e.target.value }))}
                    />
                  </div>
                  <div className="py-3">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Contact type</p>
                    <span className="inline-flex mt-1 rounded bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600">
                      {(selectedContact.crmTags || [])[0] || "Broker contact"}
                    </span>
                  </div>
                  <div className="py-3">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Lead source</p>
                    <p className="mt-1 text-xs text-gray-500">—</p>
                  </div>
                  <div className="py-3">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Last contacted</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedContact.lastContactedAt ? new Date(selectedContact.lastContactedAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="py-3">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Created date</p>
                    <p className="mt-1 text-xs text-gray-700">
                      {selectedContact.createdAt ? new Date(selectedContact.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact metadata rail */}
               <div className="mt-4 border border-[#d6e2ec] rounded-xl bg-white p-4 space-y-3.5 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                <div className="flex items-center justify-between">
                   <div>
                     <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7891a9]">Preferences</p>
                     <p className="mt-0.5 text-sm font-semibold text-[#173b5d]">Contact preferences</p>
                   </div>
                  <MessageCircle size={14} className={selectedContact.smsOptIn ? "text-green-500" : "text-gray-300"} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">SMS status</span>
                  <span className={selectedContact.smsOptIn ? "text-green-600 font-medium" : "text-gray-400"}>
                    {selectedContact.smsOptIn ? "Opted in" : "Opted out"}
                  </span>
                </div>
                {(selectedContact.marketsCovered || []).length > 0 && (
                  <div className="text-xs">
                    <p className="text-gray-400 mb-1">Markets covered</p>
                    <p className="text-gray-700">{(selectedContact.marketsCovered || []).join(", ")}</p>
                  </div>
                )}
              </div>
            </aside>

             <main className="flex-1 min-w-0 overflow-visible lg:overflow-y-auto bg-[#eef3f8]">
               <div className="sticky top-0 z-10 flex items-center gap-7 h-14 px-5 sm:px-8 bg-white/95 backdrop-blur border-b border-[#d6e2ec]">
                <button
                  onClick={() => setDetailTab("overview")}
                   className={`h-full border-b-2 text-xs font-semibold transition-colors ${detailTab === "overview" ? "border-[#1683c5] text-[#126da9]" : "border-transparent text-[#71869a] hover:text-[#173b5d]"}`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setDetailTab("activity")}
                   className={`h-full border-b-2 text-xs font-semibold transition-colors ${detailTab === "activity" ? "border-[#1683c5] text-[#126da9]" : "border-transparent text-[#71869a] hover:text-[#173b5d]"}`}
                >
                  Activity
                </button>
              </div>

               <div className="p-5 sm:p-8">
                {detailTab === "overview" ? (
                  <>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="bg-white border border-[#d6e2ec] rounded-xl p-4 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-[#7891a9] font-semibold">Created</p>
                        <p className="mt-1 text-xs font-semibold text-gray-800">
                          {selectedContact.createdAt ? new Date(selectedContact.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </p>
                      </div>
                      <div className="bg-white border border-[#d6e2ec] rounded-xl p-4 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-[#7891a9] font-semibold">Type</p>
                        <p className="mt-1 text-xs font-semibold text-gray-800">{(selectedContact.crmTags || [])[0] || "Broker contact"}</p>
                      </div>
                      <div className="bg-white border border-[#d6e2ec] rounded-xl p-4 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-[#7891a9] font-semibold">Deals</p>
                        <p className="mt-1 text-xs font-semibold text-gray-800">{selectedContact.dealCount || 0}</p>
                      </div>
                      <div className="bg-white border border-[#d6e2ec] rounded-xl p-4 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                        <p className="text-[9px] uppercase tracking-[0.14em] text-[#7891a9] font-semibold">Campaigns</p>
                        <p className="mt-1 text-xs font-semibold text-gray-800">{activityQuery.data?.enrollments?.length || 0}</p>
                      </div>
                    </div>

                    <div className="mt-5 bg-[#f8fbfd] border border-[#d6e2ec] rounded-xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#e7f0ff] flex items-center justify-center shrink-0">
                        <UserCheck size={14} className="text-[#1b6aa6]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#294c6b]">Contact created</p>
                        <p className="text-[11px] text-[#7891a9] mt-0.5">
                          Added via manual entry · {selectedContact.createdAt ? new Date(selectedContact.createdAt).toLocaleDateString() : "date unavailable"}
                        </p>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="mt-5 bg-white border border-[#d6e2ec] rounded-xl p-5 space-y-3.5 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7891a9]">Organization</p>
                          <p className="mt-0.5 text-sm font-semibold text-[#173b5d]">Tags</p>
                        </div>
                        <span className="rounded-full bg-[#edf4fa] px-2 py-1 text-[10px] font-semibold text-[#5d7892]">{(selectedContact.crmTags || []).length} applied</span>
                      </div>
                      {(selectedContact.crmTags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedContact.crmTags || []).map(tag => {
                            const isOutreach = (outreachTagsQuery.data || []).some(ot => ot.tag === tag);
                            return (
                              <span key={tag} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border ${isOutreach ? "bg-[#e7f0ff] text-[#1554a3] border-[#c6d9ea]" : tagColor(tag)}`}>
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
                          className="h-7 text-[11px] max-w-[180px]"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
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
                    </div>

                    {(outreachTagsQuery.data || []).length > 0 && (
                      <div className="mt-5 bg-[#f8fbfd] border border-[#c9ddeb] rounded-xl p-5 space-y-3.5">
                        <div>
                         <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7891a9]">Outreach</p>
                         <p className="mt-0.5 text-sm font-semibold text-[#173b5d]">Campaigns</p>
                         <p className="text-[11px] text-[#7891a9] mt-1">Select a campaign to tag and enroll this contact.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(outreachTagsQuery.data || []).map(ot => {
                            const applied = (selectedContact.crmTags || []).includes(ot.tag);
                            const activeEnrollment = (activityQuery.data?.enrollments || []).find(
                              (e: any) => e.template_id === ot.id && ["pending", "in_progress"].includes(e.status)
                            );
                            return applied ? (
                              <span key={ot.id} className="inline-flex items-center overflow-hidden rounded-full border border-[#1554a3] bg-[#1554a3] text-[11px] font-medium text-white">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1">
                                  <Megaphone size={9} />{ot.name}
                                  {activeEnrollment && <span className="rounded-full bg-green-500 px-1 text-[9px]">Active</span>}
                                </span>
                                <button
                                  onClick={() => removeTagFromContact(selectedContact, ot.tag)}
                                  title={`Remove "${ot.name}" tag`}
                                  className="self-stretch px-2 hover:bg-[#0b3159]"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ) : (
                              <button
                                key={ot.id}
                                onClick={() => {
                                  addTagToContact(selectedContact, ot.tag);
                                  enrollMutation.mutate({ id: selectedContact.id, templateId: ot.id, senderId: ot.senderId });
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-[#c6d9ea] bg-[#e7f0ff] px-2.5 py-1 text-[11px] font-medium text-[#1554a3] hover:bg-[#dceaff]"
                              >
                                <Megaphone size={9} />{ot.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="mt-5 bg-white border border-[#d6e2ec] rounded-xl p-5 space-y-2.5 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7891a9]">Private workspace</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#173b5d]">Notes</p>
                      </div>
                      <Textarea
                        placeholder="Add internal notes about this contact..."
                        value={editFields.crmNotes}
                        rows={3}
                        className="text-xs resize-none"
                        onChange={e => setEditFields(f => ({ ...f, crmNotes: e.target.value }))}
                      />
                    </div>

                    {/* Campaign Enrollments */}
                    <div className="mt-5 bg-white border border-[#d6e2ec] rounded-xl p-5 space-y-3.5 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                      <div className="flex items-center justify-between">
                         <div>
                           <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7891a9]">Sequences</p>
                           <p className="mt-0.5 text-sm font-semibold text-[#173b5d]">Campaign enrollments</p>
                         </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] px-2"
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
                             <div key={e.id} className="flex items-center justify-between bg-[#f5f9fc] rounded-lg px-3 py-2.5 border border-[#e2ebf2]">
                              <div>
                                <p className="text-xs font-medium text-gray-700">{e.template_name || "Campaign"}</p>
                                <p className="text-[10px] text-gray-400">
                                  Step {(e.current_step_index || 0) + 1} · {e.status}
                                  {e.next_send_at && ` · Next: ${new Date(e.next_send_at).toLocaleDateString()}`}
                                </p>
                              </div>
                              {(e.status === "pending" || e.status === "in_progress") && (
                                <button onClick={() => cancelEnrollmentMutation.mutate(e.id)} className="text-red-400 hover:text-red-600 text-[10px]">Cancel</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Deals */}
                    <div className="mt-5 bg-white border border-[#d6e2ec] rounded-xl p-5 space-y-3.5 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7891a9]">Pipeline</p>
                        <p className="mt-0.5 text-sm font-semibold text-[#173b5d]">Deals <span className="text-[#7891a9]">({activityQuery.data?.deals?.length || 0})</span></p>
                      </div>
                      {activityQuery.isLoading ? (
                        <div className="h-8 bg-gray-100 rounded animate-pulse" />
                      ) : activityQuery.isError ? (
                        <p className="text-xs text-red-400 italic">Could not load deals</p>
                      ) : (activityQuery.data?.deals || []).length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No deals submitted</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(activityQuery.data?.deals || []).map((deal: any) => (
                           <div key={deal.id} className="flex items-center justify-between bg-[#f5f9fc] rounded-lg px-3 py-2.5 border border-[#e2ebf2]">
                              <div>
                                <p className="text-xs font-medium text-gray-700">#{deal.dealNumber} — {deal.address}, {deal.city}, {deal.state}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {classificationBadge(deal.classification)}
                                  <span className="text-[10px] text-gray-400">{deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : ""}</span>
                                </div>
                              </div>
                              <a href={`/analyst-dashboard?deal=${deal.id}`} target="_blank" className="text-blue-400 hover:text-blue-600"><ChevronRight size={14} /></a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                   <div className="bg-white border border-[#d6e2ec] rounded-xl p-5 shadow-[0_2px_8px_rgba(28,67,101,0.04)]">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                         <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7891a9]">Engagement</p>
                         <p className="mt-0.5 text-sm font-semibold text-[#173b5d]">Activity timeline</p>
                         <p className="text-[11px] text-[#7891a9] mt-1">Recent emails and SMS activity for this contact</p>
                       </div>
                       <span className="rounded-full bg-[#edf4fa] px-2 py-1 text-[10px] font-semibold text-[#5d7892]">{(activityQuery.data?.communications || []).length} records</span>
                    </div>
                    {activityQuery.isLoading ? (
                      <div className="h-20 bg-gray-100 rounded animate-pulse" />
                    ) : activityQuery.isError ? (
                      <p className="text-xs text-red-400 italic">Could not load communications</p>
                    ) : (activityQuery.data?.communications || []).length === 0 ? (
                      <div className="py-12 text-center">
                        <MessageSquare size={24} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-xs text-gray-400">No communications recorded</p>
                      </div>
                    ) : (
                      <div className="space-y-0 divide-y divide-gray-100">
                        {(activityQuery.data?.communications || []).map((c: any) => (
                          <div key={c.id} className="flex gap-3 py-3 first:pt-0 last:pb-0 text-xs text-gray-600">
                             <div className="w-8 h-8 rounded-lg bg-[#edf4fa] flex items-center justify-center shrink-0">
                              {c.type === "email" ? (
                                <Mail size={12} className={c.direction === "outbound" ? "text-blue-500" : "text-gray-400"} />
                              ) : (
                                <MessageSquare size={12} className={c.direction === "outbound" ? "text-green-500" : "text-gray-400"} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">{c.subject || (c.type === "sms" ? "SMS" : "Email")}</span>
                                <span className="text-[10px] text-gray-400 shrink-0">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}</span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">{c.direction === "outbound" ? "Sent" : "Received"} · {c.type === "sms" ? "SMS" : "Email"}</p>
                              {c.body && typeof c.body === "string" && <p className="text-[11px] text-gray-500 mt-1">{c.body.substring(0, 180)}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
          {false && (
          <div>
            {/* Legacy contact detail layout retained temporarily during the visual migration. */}
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
                    value={editFields.assignedTo}
                    className="h-6 text-[11px] flex-1"
                    onChange={e => setEditFields(f => ({ ...f, assignedTo: e.target.value }))}
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
                      <span key={tag} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border ${isOutreach ? "bg-[#e7f0ff] text-[#1554a3] border-[#c6d9ea]" : tagColor(tag)}`}>
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
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[#3278c7] flex items-center gap-1">
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
                          className="inline-flex items-center rounded-full border border-[#1554a3] bg-[#1554a3] text-white shadow-sm text-[11px] font-medium overflow-hidden"
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
                            className="pr-2 pl-0.5 py-1 hover:bg-[#0b3159] transition-colors self-stretch flex items-center"
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
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] border border-[#c6d9ea] bg-[#e7f0ff] text-[#1554a3] transition-all font-medium hover:bg-[#dceaff]"
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
                placeholder="Add internal notes about this contact..."
                value={editFields.crmNotes}
                rows={3}
                className="text-xs resize-none"
                onChange={e => setEditFields(f => ({ ...f, crmNotes: e.target.value }))}
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
          )}
      </>)}

      </div> {/* end inner flex row */}

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
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#3278c7] flex items-center gap-1">
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
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#c6d9ea] bg-[#e7f0ff] px-3 py-1.5 text-[12px] font-medium text-[#1554a3] transition-all hover:bg-[#dceaff]"
                    >
                      <Megaphone size={10} />
                      {ot.name}
                      {ot.senderName && <span className="text-[#78a1c8]">· {ot.senderName.split(" ")[0]}</span>}
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
      <datalist id="crm-company-profiles">
        {(geoOptionsQuery.data?.brokerages || []).map(company => <option key={company} value={company} />)}
      </datalist>
      <Dialog open={showNewContactModal} onOpenChange={open => { setShowNewContactModal(open); if (!open) setNewContact({ firstName: "", lastName: "", email: "", phone: "", brokerage: "", assignedTo: "", crmNotes: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus size={16} className="text-[#1554a3]" />New Contact</DialogTitle>
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
              <label className="text-xs font-medium text-gray-700">Company profile</label>
              <Input
                placeholder="Choose an existing company or enter a new one"
                list="crm-company-profiles"
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
              className="bg-[#0b3159] text-white hover:bg-[#164b7d]"
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

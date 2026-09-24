import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import * as XLSX from "xlsx";
import { Building2, ChevronDown, FileSpreadsheet, Loader2, Search, Upload, Users, RefreshCw, UserRound, Pencil, Plus, X, Trash2 } from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
import { PageHeader } from "@/components/ui/page-header";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import ContactDetailDialog, { type Contact } from "@/components/contact-detail-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

type ContactAvatarPerson = {
  label: string;
  role: string;
};

const AVATAR_COLORS = ["#498EDE", "#081729"];

function getInitials(label: string) {
  const initials = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return initials || "?";
}

function getContactAvatarPeople(contact: Contact): ContactAvatarPerson[] {
  const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown contact";
  const people: ContactAvatarPerson[] = [{ label: contactName, role: "Contact" }];

  if (contact.assignedTo?.trim()) {
    people.push({ label: contact.assignedTo.trim(), role: "Assigned relationship owner" });
  }
  if (contact.ownerDeveloperProfileId) {
    people.push({ label: "You", role: "Company-owned relationship" });
  }

  const seen = new Set<string>();
  return people.filter((person) => {
    const key = person.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const FIELDS = [
  { key: "firstName", label: "First Name", patterns: [/first.*name/, /^first$/] },
  { key: "lastName", label: "Last Name", patterns: [/last.*name/, /^last$/] },
  { key: "email", label: "Email", patterns: [/e-?mail/] },
  { key: "phone", label: "Phone", patterns: [/phone/, /mobile/, /cell/] },
  { key: "brokerage", label: "Brokerage / Company", patterns: [/broker/, /company/, /firm/] },
  { key: "stateRegion", label: "State / Region", patterns: [/state/, /region/] },
  { key: "assignedTo", label: "Assigned To", patterns: [/assign/, /owner/, /rep/] },
  { key: "tags", label: "Tags", patterns: [/tag/] },
];

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

function ContactTableSkeleton({ adminMode }: { adminMode: boolean }) {
  return (
    <div className="table-scroll-container">
      <Table className="min-w-[1120px]">
        <TableHeader>
          <TableRow className="border-[#e3e9ee] bg-[#f8fafb] hover:bg-[#f8fafb]">
            {!adminMode && <TableHead className="h-11 w-12 pl-5" />}
            <TableHead className="h-11 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Name</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Email</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Phone</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Brokerage</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Region</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Tags</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Source tags</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="border-[#e8edf1]">
              {!adminMode && (
                <TableCell className="pl-5">
                  <Skeleton className="h-4 w-4 rounded-sm bg-[#e4ebf0]" />
                </TableCell>
              )}
              <TableCell className="pl-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full bg-[#dfe8ee]" />
                  <Skeleton className="h-4 w-28 bg-[#e4ebf0]" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-4 w-40 bg-[#e4ebf0]" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28 bg-[#e4ebf0]" /></TableCell>
              <TableCell><Skeleton className="h-4 w-36 bg-[#e4ebf0]" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16 bg-[#e4ebf0]" /></TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-6 w-16 rounded-full bg-[#e4ebf0]" />
                  <Skeleton className="h-6 w-12 rounded-full bg-[#e4ebf0]" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-6 w-24 rounded-full bg-[#e4ebf0]" /></TableCell>
              <TableCell><Skeleton className="h-6 w-24 rounded-full bg-[#e4ebf0]" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type DeveloperCrmProps = {
  adminMode?: boolean;
};

type AdminCompanyProfile = {
  id: string;
  companyName: string;
  profileType: string;
  isActive: boolean;
};

export default function DeveloperCrm({ adminMode = false }: DeveloperCrmProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profile = (user as any)?.developerProfile;
  const primaryColor = "#081729";
  const secondaryColor = "#498EDE";
  const [selectedAdminProfileId, setSelectedAdminProfileId] = useState("");
  const [clearCompanyCrmOpen, setClearCompanyCrmOpen] = useState(false);
  const adminProfilesQuery = useQuery<{ profiles: AdminCompanyProfile[] }>({
    queryKey: ["/api/admin/investment-companies"],
    queryFn: () => requestJson("/api/admin/investment-companies"),
    enabled: adminMode,
  });
  const selectedAdminProfile = (adminProfilesQuery.data?.profiles || [])
    .find((company) => company.id === selectedAdminProfileId);
  const contactsQueryKey = adminMode
    ? `/api/crm/contacts?developerProfileId=${encodeURIComponent(selectedAdminProfileId)}`
    : "/api/developer-profile/me/contacts";
  const contactsEndpoint = adminMode
    ? selectedAdminProfileId
      ? `/api/crm/contacts?page=1&limit=9999&developerProfileId=${encodeURIComponent(selectedAdminProfileId)}`
      : ""
    : "/api/developer-profile/me/contacts";
  const importEndpoint = adminMode
    ? "/api/crm/import-contacts"
    : "/api/developer-profile/me/import-contacts";
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sourceTagFilter, setSourceTagFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [removeConfirmationIds, setRemoveConfirmationIds] = useState<string[] | null>(null);
  const [tagEditor, setTagEditor] = useState<{ contactIds: string[]; action: "add" | "remove"; initialTag?: string } | null>(null);
  const [tagValue, setTagValue] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameOldTag, setRenameOldTag] = useState("");
  const [renameNewTag, setRenameNewTag] = useState("");
  const [createTagValue, setCreateTagValue] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null);

  const contactsQuery = useQuery<{ contacts: Contact[] }>({
    queryKey: [contactsQueryKey],
    queryFn: () => requestJson(contactsEndpoint),
    enabled: !adminMode || Boolean(selectedAdminProfileId),
  });

  const tagsQuery = useQuery<string[]>({
    queryKey: ["/api/developer-profile/me/crm-tags"],
    queryFn: () => requestJson("/api/developer-profile/me/crm-tags"),
    enabled: !adminMode,
  });

  const importMutation = useMutation({
    mutationFn: () => requestJson(importEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contacts: rows.map((row) => Object.fromEntries(
          FIELDS.map(({ key }) => [key, mapping[key] ? row[mapping[key]] : ""]),
        )),
      }),
    }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: [contactsQueryKey] });
      toast({ title: "Contacts imported", description: `${data.inserted} inserted, ${data.updated} updated.` });
    },
    onError: (error: Error) => toast({ title: "Import failed", description: error.message, variant: "destructive" }),
  });

  const tagMutation = useMutation({
    mutationFn: ({ contactIds, tag, action }: { contactIds: string[]; tag: string; action: "add" | "remove" }) => requestJson("/api/developer-profile/me/crm-tags/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds, tag, action }),
    }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [contactsQueryKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/crm-tags"] });
      setSelectedContactIds([]);
      setTagEditor(null);
      setTagValue("");
      toast({
        title: variables.action === "add" ? "Tag added" : "Tag removed",
        description: `${variables.action === "add" ? "Added" : "Removed"} “${variables.tag}” ${data.updatedCount === 1 ? "on 1 contact" : `on ${data.updatedCount} contacts`}.`,
      });
    },
    onError: (error: Error) => toast({ title: "Tag update failed", description: error.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ oldTag, newTag }: { oldTag: string; newTag: string }) => requestJson("/api/developer-profile/me/crm-tags/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldTag, newTag }),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [contactsQueryKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/crm-tags"] });
      setRenameOpen(false);
      setRenameOldTag("");
      setRenameNewTag("");
      setSelectedTags((current) => Array.from(new Set(current.map((tag) => tag === data.oldTag ? data.newTag : tag))));
      toast({ title: "Tag renamed", description: `Updated “${data.oldTag}” on ${data.updatedCount} contacts.` });
    },
    onError: (error: Error) => toast({ title: "Tag rename failed", description: error.message, variant: "destructive" }),
  });

  const removeContactsMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const batchSize = 500;
      const batches = Array.from(
        { length: Math.ceil(contactIds.length / batchSize) },
        (_, index) => contactIds.slice(index * batchSize, (index + 1) * batchSize),
      );
      let removedCount = 0;
      const removedIds: string[] = [];

      for (const batch of batches) {
        const data = await requestJson("/api/developer-profile/me/contacts/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactIds: batch }),
        });
        removedCount += data.removedCount || 0;
        removedIds.push(...(data.removedIds || []));
      }

      return { removedCount, removedIds };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [contactsQueryKey] });
      setSelectedContactIds([]);
      setSelectedContact(null);
      toast({ title: "Contacts removed", description: `Removed ${data.removedCount} ${data.removedCount === 1 ? "contact" : "contacts"} from your CRM. Other companies can still see shared contacts.` });
    },
    onError: (error: Error) => toast({ title: "Contact removal failed", description: error.message, variant: "destructive" }),
  });

  const clearCompanyCrmMutation = useMutation({
    mutationFn: (profileId: string) => requestJson(`/api/admin/investment-companies/${encodeURIComponent(profileId)}/clear-crm`, {
      method: "POST",
    }),
    onSuccess: (data, profileId) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/crm/contacts?developerProfileId=${encodeURIComponent(profileId)}`],
      });
      setClearCompanyCrmOpen(false);
      setSelectedContact(null);
      setSelectedContactIds([]);
      toast({
        title: "Company CRM cleared",
        description: `Removed ${data.clearedCount} ${data.clearedCount === 1 ? "contact" : "contacts"} from ${selectedAdminProfile?.companyName || "the selected company's"} CRM. Shared records and other companies' CRM were preserved.`,
      });
    },
    onError: (error: Error) => toast({ title: "Company CRM cleanup failed", description: error.message, variant: "destructive" }),
  });

  const createTagMutation = useMutation({
    mutationFn: (name: string) => requestJson("/api/developer-profile/me/crm-tags/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/crm-tags"] });
      setCreateTagValue("");
      toast({ title: data.created ? "Tag created" : "Tag already exists", description: `“${data.name}” is available in your CRM.` });
    },
    onError: (error: Error) => toast({ title: "Tag creation failed", description: error.message, variant: "destructive" }),
  });

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const contacts = contactsQuery.data?.contacts || [];
    return contacts.filter((contact) => {
      const matchesCompany = companyFilter === "all" || contact.brokerage?.trim().toLowerCase() === companyFilter;
      const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => contact.crmTags?.includes(tag));
      const matchesSourceTag = sourceTagFilter === "all" || contact.sourceTags?.includes(sourceTagFilter);
      const matchesState = stateFilter === "all" || contact.stateRegion?.trim() === stateFilter;
      const matchesAssignedTo = assignedToFilter === "all" || contact.assignedTo?.trim() === assignedToFilter;
      if (!matchesCompany) return false;
      if (!matchesTags || !matchesSourceTag || !matchesState || !matchesAssignedTo) return false;
      if (!term) return true;
      return [contact.firstName, contact.lastName, contact.email, contact.phone, contact.brokerage, contact.stateRegion]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [contactsQuery.data?.contacts, search, companyFilter, selectedTags, sourceTagFilter, stateFilter, assignedToFilter]);

  const availableTags = useMemo(() => {
    if (!adminMode) return (tagsQuery.data || []).map((tag) => tag.trim()).filter(Boolean);
    return Array.from(new Set((contactsQuery.data?.contacts || []).flatMap((contact) => contact.crmTags || []).map((tag) => tag.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [adminMode, tagsQuery.data, contactsQuery.data?.contacts]);

  const availableSourceTags = useMemo(() => Array.from(new Set(
    (contactsQuery.data?.contacts || [])
      .flatMap((contact) => contact.sourceTags || [])
      .map((tag) => tag.trim())
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b)), [contactsQuery.data?.contacts]);

  const availableStates = useMemo(() => Array.from(new Set(
    (contactsQuery.data?.contacts || [])
      .map((contact) => contact.stateRegion?.trim())
      .filter((value): value is string => Boolean(value)),
  )).sort((a, b) => a.localeCompare(b)), [contactsQuery.data?.contacts]);

  const availableAssignedTo = useMemo(() => Array.from(new Set(
    (contactsQuery.data?.contacts || [])
      .map((contact) => contact.assignedTo?.trim())
      .filter((value): value is string => Boolean(value)),
  )).sort((a, b) => a.localeCompare(b)), [contactsQuery.data?.contacts]);

  const visibleContactIds = filteredContacts.map((contact) => contact.id);
  const allVisibleSelected = visibleContactIds.length > 0 && visibleContactIds.every((id) => selectedContactIds.includes(id));
  const someVisibleSelected = visibleContactIds.some((id) => selectedContactIds.includes(id));
  const openTagEditor = (contactIds: string[], action: "add" | "remove", initialTag = "") => {
    setTagEditor({ contactIds, action, initialTag });
    setTagValue(initialTag);
  };
  const toggleAllVisible = (checked: boolean) => {
    setSelectedContactIds((current) => checked
      ? Array.from(new Set([...current, ...visibleContactIds]))
      : current.filter((id) => !visibleContactIds.includes(id)));
  };
  const toggleContact = (contactId: string, checked: boolean) => {
    setSelectedContactIds((current) => checked
      ? Array.from(new Set([...current, contactId]))
      : current.filter((id) => id !== contactId));
  };

  const hasActiveFilters = companyFilter !== "all" || selectedTags.length > 0 || sourceTagFilter !== "all" || stateFilter !== "all" || assignedToFilter !== "all";
  const clearFilters = () => {
    setCompanyFilter("all");
    setSelectedTags([]);
    setSourceTagFilter("all");
    setStateFilter("all");
    setAssignedToFilter("all");
  };

  const companyProfiles = useMemo(() => {
    const profiles = new Map<string, { name: string; people: number }>();
    for (const contact of contactsQuery.data?.contacts || []) {
      const company = contact.brokerage?.trim();
      if (company) {
        const key = company.toLowerCase();
        const existing = profiles.get(key);
        profiles.set(key, { name: existing?.name || company, people: (existing?.people || 0) + 1 });
      }
    }
    return Array.from(profiles.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contactsQuery.data?.contacts]);

  const readFile = (selected: File) => {
    setParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: "array", raw: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as Record<string, any>[];
        const nextHeaders = parsed.length ? Object.keys(parsed[0]) : [];
        if (!nextHeaders.length || !parsed.length) throw new Error("File is empty or missing a header row");
        setFile(selected);
        setHeaders(nextHeaders);
        setRows(parsed);
        const find = (patterns: RegExp[]) => nextHeaders.find((header) => patterns.some((pattern) => pattern.test(header.toLowerCase()))) || "";
        setMapping(Object.fromEntries(FIELDS.map((field) => [field.key, find(field.patterns)])));
      } catch (error) {
        toast({ title: "Could not read file", description: error instanceof Error ? error.message : "Unsupported file", variant: "destructive" });
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParsing(false);
      toast({ title: "Could not read file", variant: "destructive" });
    };
    reader.readAsArrayBuffer(selected);
  };

  const reset = () => {
    setImportOpen(false);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    importMutation.reset();
  };

  return (
    <div className="min-h-[100dvh] bg-[#f3f6f9] text-[#172b3d]">
      {adminMode ? <Navigation /> : <DeveloperNavigation />}
      <main className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <PageHeader
          title="Company contacts"
          eyebrow={adminMode ? "Relationship management" : undefined}
          actions={
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />Import Contacts
            </Button>
          }
        />

        <Card className="overflow-hidden rounded-2xl border-[#dce5eb] bg-[#fbfcfd] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#e3e9ee] bg-[#f8fafb] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: primaryColor }}><Users className="h-5 w-5" /></div>
              <div>
                <h2 className="font-semibold text-[#1d3448]">Contacts</h2>
                <p className="text-xs text-[#7b8d9b]">
                  {adminMode
                    ? selectedAdminProfile
                      ? `${contactsQuery.data?.contacts.length || 0} contacts in ${selectedAdminProfile.companyName}'s CRM`
                      : "Select a company to view its CRM"
                    : `${contactsQuery.data?.contacts.length || 0} available contacts`}
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-[360px]">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#91a2af]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, company…" className="h-10 rounded-lg border-[#d7e2e9] bg-white pl-10 text-sm shadow-none focus-visible:ring-1" style={{ "--tw-ring-color": secondaryColor } as CSSProperties} />
            </div>
          </div>
          {adminMode && (
            <div className="flex flex-col gap-3 border-b border-[#e3e9ee] bg-white px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full max-w-xl">
                <label htmlFor="admin-crm-company" className="mb-1.5 block text-xs font-semibold text-[#405a70]">
                  Organization, developer, or sales company
                </label>
                <select
                  id="admin-crm-company"
                  value={selectedAdminProfileId}
                  disabled={adminProfilesQuery.isLoading}
                  onChange={(event) => {
                    setSelectedAdminProfileId(event.target.value);
                    setSelectedContact(null);
                    setSelectedContactIds([]);
                    setSearch("");
                    setCompanyFilter("all");
                    setSelectedTags([]);
                    setSourceTagFilter("all");
                    setStateFilter("all");
                    setAssignedToFilter("all");
                  }}
                  className="h-10 w-full rounded-md border border-[#d7e2e9] bg-white px-3 text-sm font-medium text-[#405a70] outline-none focus-visible:ring-1 focus-visible:ring-[#498EDE] disabled:opacity-60"
                >
                  <option value="">Select a company</option>
                  {(adminProfilesQuery.data?.profiles || []).map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.companyName} · {company.profileType.replace(/[_-]+/g, " ")}{company.isActive ? "" : " · inactive"}
                    </option>
                  ))}
                </select>
                {adminProfilesQuery.isError && (
                  <p role="alert" className="mt-1.5 text-xs text-red-600">
                    {(adminProfilesQuery.error as Error).message}
                    <button type="button" className="ml-2 font-semibold underline" onClick={() => adminProfilesQuery.refetch()}>Try again</button>
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedAdminProfile || clearCompanyCrmMutation.isPending}
                onClick={() => setClearCompanyCrmOpen(true)}
                className="h-10 shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear company CRM
              </Button>
            </div>
          )}
           <div className="flex flex-wrap items-center gap-2 border-b border-[#e6edf1] px-5 py-3 text-xs text-[#718493]">
             <span className="mr-1 font-medium">Filters</span>
             <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              <select
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
                className="h-8 max-w-[260px] rounded-md border border-[#d7e2e9] bg-white px-2.5 text-xs font-medium text-[#405a70] outline-none"
              >
                <option value="all">All companies ({companyProfiles.length})</option>
                {companyProfiles.map((company) => (
                  <option key={company.name} value={company.name.toLowerCase()}>{company.name} ({company.people})</option>
                ))}
              </select>
            </div>
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d7e2e9] bg-white px-2.5 text-xs font-medium text-[#405a70] outline-none hover:bg-[#f5f8fa]">
                   Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ""}<ChevronDown className="h-3.5 w-3.5 text-[#8195a5]" />
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="start" className="w-56">
                 <DropdownMenuLabel>Match any selected tag</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 {availableTags.length ? availableTags.map((tag) => (
                   <DropdownMenuCheckboxItem
                     key={tag}
                     checked={selectedTags.includes(tag)}
                     onSelect={(event) => event.preventDefault()}
                     onCheckedChange={(checked) => setSelectedTags((current) => checked === true ? [...current, tag] : current.filter((value) => value !== tag))}
                   >
                     <span className="max-w-[190px] truncate">{tag}</span>
                   </DropdownMenuCheckboxItem>
                 )) : (
                   <div className="px-2 py-2 text-xs text-[#7b8d9b]">{tagsQuery.isLoading ? "Loading tags…" : "No tags on your contacts"}</div>
                 )}
               </DropdownMenuContent>
             </DropdownMenu>
              <select
                value={sourceTagFilter}
                onChange={(event) => setSourceTagFilter(event.target.value)}
                aria-label="Source tag filter"
                className="h-8 max-w-[220px] rounded-md border border-[#d7e2e9] bg-white px-2.5 text-xs font-medium text-[#405a70] outline-none"
              >
                <option value="all">Source tags: All</option>
                {availableSourceTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
             <select
               value={stateFilter}
               onChange={(event) => setStateFilter(event.target.value)}
               aria-label="State or region filter"
               className="h-8 max-w-[180px] rounded-md border border-[#d7e2e9] bg-white px-2.5 text-xs font-medium text-[#405a70] outline-none"
             >
               <option value="all">State: All</option>
               {availableStates.map((state) => <option key={state} value={state}>{state}</option>)}
             </select>
             <select
               value={assignedToFilter}
               onChange={(event) => setAssignedToFilter(event.target.value)}
               aria-label="Assigned team member filter"
               className="h-8 max-w-[220px] rounded-md border border-[#d7e2e9] bg-white px-2.5 text-xs font-medium text-[#405a70] outline-none"
             >
               <option value="all">Rep: All</option>
               {availableAssignedTo.map((person) => <option key={person} value={person}>{person}</option>)}
             </select>
             {hasActiveFilters && <button type="button" onClick={clearFilters} className="h-8 rounded-md px-2 text-xs font-medium text-catalyst-blue hover:bg-[#edf4fa]">Clear filters</button>}
              {!adminMode && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameOldTag(availableTags[0] || "");
                      setRenameNewTag("");
                      setRenameOpen(true);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d7e2e9] bg-white px-2.5 text-xs font-medium text-[#405a70] outline-none hover:bg-[#f5f8fa]"
                  >
                    <Pencil className="h-3.5 w-3.5" />Manage tags
                  </button>
                  {selectedContactIds.length > 0 && (
                    <>
                      <span className="mx-1 h-5 w-px bg-[#dfe7ec]" />
                      <span className="font-medium text-[#405a70]">{selectedContactIds.length} selected</span>
                      <button type="button" onClick={() => openTagEditor(selectedContactIds, "add")} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d7e2e9] bg-white px-2.5 text-xs font-medium text-[#405a70] hover:bg-[#f5f8fa]">
                        <Plus className="h-3.5 w-3.5" />Add tag
                      </button>
                      <button type="button" onClick={() => openTagEditor(selectedContactIds, "remove")} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d7e2e9] bg-white px-2.5 text-xs font-medium text-[#405a70] hover:bg-[#f5f8fa]">
                        <X className="h-3.5 w-3.5" />Remove tag
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveConfirmationIds(selectedContactIds)}
                        disabled={removeContactsMutation.isPending}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        <UserRound className="h-3.5 w-3.5" />Remove contact
                      </button>
                    </>
                  )}
                </>
              )}
             <span className="ml-auto hidden sm:inline">{filteredContacts.length} shown · search updates as you type</span>
          </div>
            {adminMode && !selectedAdminProfileId ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#eaf0f4] text-[#718493]"><Building2 className="h-5 w-5" /></div>
                <h3 className="font-semibold text-[#243b4e]">Select a company CRM</h3>
                <p className="mt-1 max-w-md text-sm text-[#7b8d9b]">Choose an organization above to review only that company’s contacts and CRM details.</p>
              </div>
            ) : contactsQuery.isLoading ? (
             <ContactTableSkeleton adminMode={adminMode} />
          ) : contactsQuery.isError ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><p className="text-sm font-medium text-[#9b4545]">{(contactsQuery.error as Error).message}</p><Button variant="outline" className="mt-4 h-9" onClick={() => contactsQuery.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Try again</Button></div>
           ) : filteredContacts.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#eaf0f4] text-[#718493]"><Users className="h-5 w-5" /></div><h3 className="font-semibold text-[#243b4e]">{search.trim() || hasActiveFilters ? "No matching contacts" : adminMode ? "No contacts in this company CRM" : "No contacts yet"}</h3><p className="mt-1 text-sm text-[#7b8d9b]">{search.trim() || hasActiveFilters ? "Try clearing a filter or broadening your search." : adminMode ? "This company has no visible CRM contacts. Shared directory additions can still appear based on its access settings." : "Import a contact list to get started."}</p>{(search.trim() || hasActiveFilters) && <Button variant="outline" onClick={() => { setSearch(""); clearFilters(); }} className="mt-4 h-9">Clear search and filters</Button>}</div>
          ) : (
            <div className="table-scroll-container">
               <Table className="min-w-[1280px]">
                 <TableHeader>
                   <TableRow className="border-[#e3e9ee] bg-[#f8fafb] hover:bg-[#f8fafb]">
                     {!adminMode && <TableHead className="h-11 w-12 pl-5"><Checkbox aria-label="Select all visible contacts" checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false} onCheckedChange={(checked) => toggleAllVisible(checked === true)} /></TableHead>}
                     <TableHead className="h-11 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Name</TableHead>
                     <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Email</TableHead>
                     <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Phone</TableHead>
                     <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Brokerage</TableHead>
                     <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Region</TableHead>
                     <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Tags</TableHead>
                     <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Source tags</TableHead>
                     <TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Source</TableHead>
                   </TableRow>
                 </TableHeader>
                <TableBody>{filteredContacts.map((contact) => (
                   <TableRow
                     key={contact.id}
                     className="cursor-pointer border-[#e8edf1] transition-colors hover:bg-[#f4f8fa]"
                     tabIndex={0}
                     onClick={() => setSelectedContact(contact)}
                     onKeyDown={(event) => {
                       if (event.key === "Enter" || event.key === " ") {
                         event.preventDefault();
                         setSelectedContact(contact);
                       }
                     }}
                     aria-label={`Open profile for ${[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "contact"}`}
                   >
                      {!adminMode && <TableCell className="pl-5" onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Select ${[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "contact"}`} checked={selectedContactIds.includes(contact.id)} onCheckedChange={(checked) => toggleContact(contact.id, checked === true)} /></TableCell>}
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex shrink-0 items-center -space-x-2"
                          aria-label={getContactAvatarPeople(contact).map((person) => `${person.role}: ${person.label}`).join(", ")}
                        >
                          {getContactAvatarPeople(contact).map((person, index) => (
                            <div
                              key={`${person.label}-${person.role}`}
                              className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#fbfcfd] text-[10px] font-bold text-white shadow-sm"
                              style={{
                                backgroundColor: index === 0 ? `${secondaryColor}` : AVATAR_COLORS[(index - 1) % AVATAR_COLORS.length],
                                zIndex: getContactAvatarPeople(contact).length - index,
                              }}
                              title={`${person.role}: ${person.label}`}
                            >
                              {getInitials(person.label)}
                            </div>
                          ))}
                        </div>
                         <span className="font-semibold text-[#21394c]">{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#5f7382]">{contact.email || "—"}</TableCell>
                    <TableCell className="text-sm text-[#5f7382]">{contact.phone || "—"}</TableCell>
                    <TableCell className="max-w-[210px] text-sm text-[#5f7382]">
                      {contact.brokerage ? (
                         <button
                          type="button"
                          className="group flex max-w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-[#eaf1f6]"
                           onClick={(event) => {
                             event.stopPropagation();
                             setCompanyFilter(contact.brokerage?.trim().toLowerCase() || "all");
                           }}
                        >
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-[#8195a5]" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[#405a70]">{contact.brokerage}</span>
                            <span className="block text-[10px] text-[#8a9ba8]">{companyProfiles.find(company => company.name.toLowerCase() === contact.brokerage?.trim().toLowerCase())?.people || 1} people</span>
                          </span>
                        </button>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-[#5f7382]">{contact.stateRegion || "—"}</TableCell>
                     <TableCell className="max-w-[300px]">
                       <div className="flex flex-wrap items-center gap-1.5">
                         {(contact.crmTags || []).filter(Boolean).map((tag, index) => adminMode ? (
                           <span key={`${tag}-${index}`} className="inline-flex max-w-[140px] items-center rounded-full border border-[#d8e6ee] bg-[#f4f8fb] px-2 py-1 text-[10px] font-medium text-[#405a70]">
                             <span className="truncate">{tag}</span>
                           </span>
                         ) : (
                           <button
                             key={`${tag}-${index}`}
                             type="button"
                             title={`Remove ${tag}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openTagEditor([contact.id], "remove", tag);
                              }}
                             className="inline-flex max-w-[140px] items-center gap-1 rounded-full border border-[#d8e6ee] bg-[#f4f8fb] px-2 py-1 text-[10px] font-medium text-[#405a70] hover:border-[#b8d0df] hover:bg-[#eaf3f8]"
                           >
                             <span className="truncate">{tag}</span>
                             <X className="h-3 w-3 shrink-0 text-[#8298a8]" />
                           </button>
                         ))}
                          {!adminMode && <button type="button" onClick={(event) => { event.stopPropagation(); openTagEditor([contact.id], "add"); }} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-catalyst-blue hover:bg-[#edf4fa]"><Plus className="h-3 w-3" />Add</button>}
                         {!contact.crmTags?.length && adminMode && <span className="text-sm text-[#9aa9b4]">—</span>}
                       </div>
                     </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(contact.sourceTags || []).filter(Boolean).map((tag, index) => (
                            <span
                              key={`${tag}-${index}`}
                              title="Shared tag from the broker workbook"
                              className="inline-flex max-w-[150px] items-center rounded-full border border-[#d7e7d7] bg-[#f2f8f1] px-2 py-1 text-[10px] font-medium text-[#4d7351]"
                            >
                              <span className="truncate">{tag}</span>
                            </span>
                          ))}
                          {!contact.sourceTags?.length && <span className="text-sm text-[#9aa9b4]">—</span>}
                        </div>
                      </TableCell>
                    <TableCell>{contact.ownerDeveloperProfileId ? <Badge variant="secondary" className="border px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${secondaryColor}15`, color: primaryColor, borderColor: `${secondaryColor}35` }}><UserRound className="mr-1 h-3 w-3" />Your contact</Badge> : <Badge variant="outline" className="border-[#d7e1e7] bg-[#f8fafb] text-[10px] text-[#718493]">Shared network</Badge>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </Card>
      </main>

      <ContactDetailDialog
        contact={selectedContact}
        adminMode={adminMode}
        onOpenChange={(open) => { if (!open) setSelectedContact(null); }}
        onRemove={(contactId) => setRemoveConfirmationIds([contactId])}
        onContactUpdated={(contactId, changes) => {
          setSelectedContact((current) => current?.id === contactId ? { ...current, ...changes } : current);
        }}
        isRemoving={removeContactsMutation.isPending}
      />

      <Dialog open={Boolean(removeConfirmationIds)} onOpenChange={(open) => { if (!open) setRemoveConfirmationIds(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from your CRM?</DialogTitle>
            <DialogDescription>
              Remove {removeConfirmationIds?.length || 0} {removeConfirmationIds?.length === 1 ? "contact" : "contacts"} from your CRM? Shared contacts will remain available to other companies.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveConfirmationIds(null)} disabled={removeContactsMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={removeContactsMutation.isPending}
              onClick={() => {
                if (!removeConfirmationIds?.length) return;
                const ids = removeConfirmationIds;
                setRemoveConfirmationIds(null);
                removeContactsMutation.mutate(ids);
              }}
            >
              {removeContactsMutation.isPending ? "Removing…" : "Remove contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearCompanyCrmOpen} onOpenChange={(open) => {
        if (!clearCompanyCrmMutation.isPending) setClearCompanyCrmOpen(open);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Clear {selectedAdminProfile?.companyName || "company"} CRM?</DialogTitle>
            <DialogDescription>
              This removes all contacts currently visible in this company’s CRM and clears its private tags, notes, assignments, and last-contacted dates. Shared broker identities, deal records, and other companies’ CRM remain unchanged. Future shared-directory additions can still appear according to this company’s access settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClearCompanyCrmOpen(false)} disabled={clearCompanyCrmMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={!selectedAdminProfileId || clearCompanyCrmMutation.isPending}
              onClick={() => selectedAdminProfileId && clearCompanyCrmMutation.mutate(selectedAdminProfileId)}
            >
              {clearCompanyCrmMutation.isPending ? "Clearing…" : "Clear company CRM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => (open ? setImportOpen(true) : reset())}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Import Contacts</DialogTitle><DialogDescription>Upload a CSV or Excel file and map its columns. Email matches update only contacts owned by your company.</DialogDescription></DialogHeader>
          {!file ? (
            <div className="space-y-4 py-4">
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center"><FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-400" /><Label htmlFor="developer-contact-file" className="cursor-pointer font-semibold text-slate-800">Choose a CSV or Excel file</Label><Input id="developer-contact-file" type="file" accept=".csv,.xlsx,.xls" className="mx-auto mt-4 max-w-sm bg-white" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} /><p className="mt-3 text-xs text-slate-500">First row should contain column headers.</p></div>
              {parsing && <div className="flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Reading spreadsheet…</div>}
            </div>
          ) : result ? (
            <div className="py-8 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</div><h3 className="font-semibold text-slate-900">Import complete</h3><p className="mt-2 text-sm text-slate-500">{result.inserted} inserted and {result.updated} updated.</p></div>
          ) : (
            <div className="space-y-5 py-2">
              <p className="text-sm text-slate-600">{rows.length.toLocaleString()} rows detected. Map any available fields below.</p>
              <div className="grid gap-3 sm:grid-cols-2">{FIELDS.map((field) => (
                <div key={field.key}><Label className="text-xs">{field.label}</Label><select value={mapping[field.key] || ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="">Not mapped</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></div>
              ))}</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><p className="mb-1 font-semibold text-slate-800">Preview</p><p>{mapping.firstName ? rows[0]?.[mapping.firstName] : ""} {mapping.lastName ? rows[0]?.[mapping.lastName] : ""}</p><p>{mapping.email ? rows[0]?.[mapping.email] || "No email" : "Email not mapped"}</p></div>
            </div>
          )}
          <DialogFooter>{result ? <Button onClick={reset} style={{ backgroundColor: primaryColor }} className="text-white">Done</Button> : <Button onClick={() => importMutation.mutate()} disabled={!file || !rows.length || importMutation.isPending} style={{ backgroundColor: primaryColor }} className="text-white">{importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import Contacts</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      {!adminMode && (
        <>
          <Dialog open={Boolean(tagEditor)} onOpenChange={(open) => { if (!open && !tagMutation.isPending) { setTagEditor(null); setTagValue(""); } }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{tagEditor?.action === "add" ? "Add tag" : "Remove tag"}</DialogTitle>
                <DialogDescription>
                  {tagEditor?.action === "add"
                    ? `${tagEditor.contactIds.length === 1 ? "Add a tag to this contact." : `Add a tag to ${tagEditor.contactIds.length} selected contacts.`} Type a new value to create it.`
                    : `Remove a tag from ${tagEditor?.contactIds.length === 1 ? "this contact" : `${tagEditor?.contactIds.length} selected contacts`}.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="crm-tag-value">Tag name</Label>
                  <Input
                    id="crm-tag-value"
                    autoFocus
                    value={tagValue}
                    onChange={(event) => setTagValue(event.target.value)}
                    placeholder={tagEditor?.action === "add" ? "e.g. Land Broker" : "Choose or type a tag"}
                    className="mt-1.5"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && tagValue.trim() && tagEditor) {
                        tagMutation.mutate({ contactIds: tagEditor.contactIds, tag: tagValue.trim(), action: tagEditor.action });
                      }
                    }}
                  />
                </div>
                {availableTags.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8195a5]">Existing tags</p>
                    <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                      {availableTags.map((tag) => (
                        <button key={tag} type="button" onClick={() => setTagValue(tag)} className="rounded-full border border-[#d8e6ee] bg-[#f4f8fb] px-2.5 py-1 text-xs font-medium text-[#405a70] hover:border-[#b8d0df] hover:bg-[#eaf3f8]">{tag}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setTagEditor(null); setTagValue(""); }} disabled={tagMutation.isPending}>Cancel</Button>
                <Button
                  onClick={() => tagEditor && tagMutation.mutate({ contactIds: tagEditor.contactIds, tag: tagValue.trim(), action: tagEditor.action })}
                  disabled={!tagEditor || !tagValue.trim() || tagMutation.isPending}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  {tagMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tagEditor?.action === "add" ? "Add tag" : "Remove tag"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={renameOpen} onOpenChange={(open) => { if (!open && !renameMutation.isPending) setRenameOpen(false); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Manage CRM tags</DialogTitle>
                <DialogDescription>
                  Create or rename private tags for your company. These actions do not affect another company’s contacts or shared source tags.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-lg border border-[#d7e2e9] bg-[#f8fafb] p-3">
                  <Label htmlFor="crm-create-tag">Create a new tag</Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      id="crm-create-tag"
                      value={createTagValue}
                      onChange={(event) => setCreateTagValue(event.target.value)}
                      placeholder="e.g. Priority Land Broker"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && createTagValue.trim()) createTagMutation.mutate(createTagValue.trim());
                      }}
                    />
                    <Button
                      onClick={() => createTagMutation.mutate(createTagValue.trim())}
                      disabled={!createTagValue.trim() || createTagMutation.isPending}
                      style={{ backgroundColor: primaryColor }}
                      className="shrink-0 text-white"
                    >
                      {createTagMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">The tag will appear in the Tags filter and can be applied to contacts.</p>
                </div>
                <div className="border-t border-slate-200 pt-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                  Renaming is company-wide. Every contact in this company with the old tag will receive the new tag.
                </div>
                <div>
                  <Label htmlFor="crm-old-tag">Existing tag</Label>
                   <select id="crm-old-tag" value={renameOldTag} onChange={(event) => setRenameOldTag(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-[#d7e2e9] bg-white px-3 text-sm text-[#405a70] outline-none">
                     <option value="">Choose a tag</option>
                     {availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                   </select>
                </div>
                <div>
                  <Label htmlFor="crm-new-tag">New tag name</Label>
                  <Input id="crm-new-tag" value={renameNewTag} onChange={(event) => setRenameNewTag(event.target.value)} placeholder="e.g. Priority Land Broker" className="mt-1.5" />
                </div>
                </div>
              </div>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={renameMutation.isPending}>Cancel</Button>
                <Button
                  onClick={() => renameMutation.mutate({ oldTag: renameOldTag.trim(), newTag: renameNewTag.trim() })}
                   disabled={!renameOldTag.trim() || !renameNewTag.trim() || renameOldTag.trim() === renameNewTag.trim() || renameMutation.isPending}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                >
                  {renameMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Rename everywhere
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      <Footer />
    </div>
  );
}
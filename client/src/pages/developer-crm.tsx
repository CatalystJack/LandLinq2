import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import * as XLSX from "xlsx";
import { Building2, FileSpreadsheet, Loader2, Search, Upload, Users, RefreshCw, UserRound, SlidersHorizontal } from "lucide-react";
import DeveloperNavigation from "@/components/developer-navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  stateRegion: string | null;
  assignedTo: string | null;
  crmTags: string[] | null;
  ownerDeveloperProfileId: string | null;
  createdAt: string | null;
};

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

export default function DeveloperCrm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profile = (user as any)?.developerProfile;
  const primaryColor = profile?.primaryColor || "#0A2B4A";
  const secondaryColor = profile?.secondaryColor || "#4A90E2";
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null);

  const contactsQuery = useQuery<{ contacts: Contact[] }>({
    queryKey: ["/api/developer-profile/me/contacts"],
    queryFn: () => requestJson("/api/developer-profile/me/contacts"),
  });

  const importMutation = useMutation({
    mutationFn: () => requestJson("/api/developer-profile/me/import-contacts", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/contacts"] });
      toast({ title: "Contacts imported", description: `${data.inserted} inserted, ${data.updated} updated.` });
    },
    onError: (error: Error) => toast({ title: "Import failed", description: error.message, variant: "destructive" }),
  });

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const contacts = contactsQuery.data?.contacts || [];
    return contacts.filter((contact) => {
      const matchesCompany = companyFilter === "all" || contact.brokerage?.trim().toLowerCase() === companyFilter;
      if (!matchesCompany) return false;
      if (!term) return true;
      return [contact.firstName, contact.lastName, contact.email, contact.phone, contact.brokerage, contact.stateRegion]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [contactsQuery.data?.contacts, search, companyFilter]);

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
      <DeveloperNavigation />
      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: secondaryColor }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: secondaryColor }} /> Relationship management
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#10283b] sm:text-4xl">Company contacts</h1>
            <p className="mt-2 max-w-xl text-sm text-[#6e8192]">A focused directory for the relationships your team is building across the LandLinq network.</p>
          </div>
          <Button onClick={() => setImportOpen(true)} style={{ backgroundColor: primaryColor }} className="h-10 rounded-lg px-4 text-white shadow-sm hover:opacity-90">
            <Upload className="mr-2 h-4 w-4" />Import Contacts
          </Button>
        </div>

        <Card className="overflow-hidden rounded-xl border-[#dce5eb] bg-[#fbfcfd] shadow-[0_12px_30px_rgba(25,53,74,0.06)]">
          <div className="flex flex-col gap-4 border-b border-[#e3e9ee] bg-[#f8fafb] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: primaryColor }}><Users className="h-5 w-5" /></div>
              <div><h2 className="font-semibold text-[#1d3448]">Contacts</h2><p className="text-xs text-[#7b8d9b]">{contactsQuery.data?.contacts.length || 0} available contacts</p></div>
            </div>
            <div className="relative w-full sm:w-[360px]">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#91a2af]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, company…" className="h-10 rounded-lg border-[#d7e2e9] bg-white pl-10 text-sm shadow-none focus-visible:ring-1" style={{ "--tw-ring-color": secondaryColor } as CSSProperties} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[#e6edf1] px-5 py-3 text-xs text-[#718493]">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="font-medium">Directory view</span>
            <div className="ml-1 flex items-center gap-2">
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
            <span className="ml-auto hidden sm:inline">Search updates as you type</span>
          </div>
          {contactsQuery.isLoading ? (
            <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#eef2f5]" />)}</div>
          ) : contactsQuery.isError ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><p className="text-sm font-medium text-[#9b4545]">{(contactsQuery.error as Error).message}</p><Button variant="outline" className="mt-4 h-9" onClick={() => contactsQuery.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Try again</Button></div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#eaf0f4] text-[#718493]"><Users className="h-5 w-5" /></div><h3 className="font-semibold text-[#243b4e]">{search ? "No matching contacts" : "No contacts yet"}</h3><p className="mt-1 text-sm text-[#7b8d9b]">{search ? "Try a broader name, email, or company search." : "Import a contact list to get started."}</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader><TableRow className="border-[#e3e9ee] bg-[#f8fafb] hover:bg-[#f8fafb]"><TableHead className="h-11 pl-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Name</TableHead><TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Email</TableHead><TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Phone</TableHead><TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Brokerage</TableHead><TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Region</TableHead><TableHead className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d909f]">Source</TableHead></TableRow></TableHeader>
                <TableBody>{filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className="border-[#e8edf1] transition-colors hover:bg-[#f4f8fa]">
                    <TableCell className="pl-5"><div className="flex items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: `${secondaryColor}18`, color: primaryColor }}>{(contact.firstName?.[0] || "").toUpperCase()}{(contact.lastName?.[0] || "").toUpperCase()}</div><span className="font-semibold text-[#21394c]">{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"}</span></div></TableCell>
                    <TableCell className="text-sm text-[#5f7382]">{contact.email || "—"}</TableCell>
                    <TableCell className="text-sm text-[#5f7382]">{contact.phone || "—"}</TableCell>
                    <TableCell className="max-w-[210px] text-sm text-[#5f7382]">
                      {contact.brokerage ? (
                        <button
                          type="button"
                          className="group flex max-w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-[#eaf1f6]"
                          onClick={() => setCompanyFilter(contact.brokerage?.trim().toLowerCase() || "all")}
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
                    <TableCell>{contact.ownerDeveloperProfileId ? <Badge variant="secondary" className="border px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${secondaryColor}15`, color: primaryColor, borderColor: `${secondaryColor}35` }}><UserRound className="mr-1 h-3 w-3" />Your contact</Badge> : <Badge variant="outline" className="border-[#d7e1e7] bg-[#f8fafb] text-[10px] text-[#718493]">Shared network</Badge>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </Card>
      </main>

      <Dialog open={importOpen} onOpenChange={(open) => (open ? setImportOpen(true) : reset())}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Import Contacts</DialogTitle><DialogDescription>Upload a CSV or Excel file and map its columns. Email matches update only contacts owned by your company.</DialogDescription></DialogHeader>
          {!file ? (
            <div className="space-y-4 py-4">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-400" /><Label htmlFor="developer-contact-file" className="cursor-pointer font-semibold text-slate-800">Choose a CSV or Excel file</Label><Input id="developer-contact-file" type="file" accept=".csv,.xlsx,.xls" className="mx-auto mt-4 max-w-sm bg-white" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} /><p className="mt-3 text-xs text-slate-500">First row should contain column headers.</p></div>
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
    </div>
  );
}
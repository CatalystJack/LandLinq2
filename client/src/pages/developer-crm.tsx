import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Loader2, Search, Upload, Users } from "lucide-react";
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
    if (!term) return contacts;
    return contacts.filter((contact) =>
      [contact.firstName, contact.lastName, contact.email, contact.phone, contact.brokerage, contact.stateRegion]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [contactsQuery.data?.contacts, search]);

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
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: secondaryColor }}>Relationship Management</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">CRM</h1>
            <p className="mt-2 text-slate-500">Manage your company’s contacts alongside the shared LandLinq network.</p>
          </div>
          <Button onClick={() => setImportOpen(true)} style={{ backgroundColor: primaryColor }} className="text-white">
            <Upload className="mr-2 h-4 w-4" />Import Contacts
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Users className="h-5 w-5" /></div>
              <div><h2 className="font-semibold text-slate-900">Contacts</h2><p className="text-sm text-slate-500">{contactsQuery.data?.contacts.length || 0} available contacts</p></div>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contacts" className="pl-9" />
            </div>
          </div>
          {contactsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: primaryColor }} /></div>
          ) : contactsQuery.isError ? (
            <div className="p-8 text-center text-sm text-red-600">{(contactsQuery.error as Error).message}</div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><Users className="mb-3 h-10 w-10 text-slate-300" /><h3 className="font-semibold text-slate-800">{search ? "No matching contacts" : "No contacts yet"}</h3><p className="mt-1 text-sm text-slate-500">Import a contact list to get started.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="bg-slate-50"><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Brokerage</TableHead><TableHead>Region</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
                <TableBody>{filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium text-slate-900">{[contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown"}</TableCell>
                    <TableCell className="text-slate-600">{contact.email || "—"}</TableCell>
                    <TableCell className="text-slate-600">{contact.phone || "—"}</TableCell>
                    <TableCell className="text-slate-600">{contact.brokerage || "—"}</TableCell>
                    <TableCell className="text-slate-600">{contact.stateRegion || "—"}</TableCell>
                    <TableCell>{contact.ownerDeveloperProfileId ? <Badge variant="secondary" className="bg-blue-50 text-blue-700">Your contact</Badge> : <Badge variant="outline">Shared network</Badge>}</TableCell>
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
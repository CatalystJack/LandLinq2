import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Save,
  UserRound,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  brokerage: string | null;
  contactCategory?: string | null;
  mailingAddress?: string | null;
  city?: string | null;
  postalCode?: string | null;
  stateRegion: string | null;
  assignedTo: string | null;
  crmTags: string[] | null;
  sourceTags: string[] | null;
  smsOptIn: boolean | null;
  ownerDeveloperProfileId: string | null;
  createdAt: string | null;
  crmNotes?: string | null;
  lastContactedAt?: string | null;
};

type ContactDeal = {
  id: string;
  dealNumber: number | null;
  address: string;
  city: string | null;
  state: string | null;
  classification: string | null;
  status: string | null;
  createdAt: string | null;
};

type ContactCommunication = {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  direction: string;
  status: string | null;
  createdAt: string | null;
};

type ContactCampaign = {
  id: string;
  status: string;
  current_step_index?: number | null;
  currentStepIndex?: number | null;
  next_send_at?: string | null;
  nextSendAt?: string | null;
  total_steps_sent?: number | null;
  totalStepsSent?: number | null;
  created_at?: string | null;
  createdAt?: string | null;
  template_name?: string | null;
  templateName?: string | null;
};

type ContactActivity = {
  broker?: Partial<Contact>;
  deals?: ContactDeal[];
  communications?: ContactCommunication[];
  enrollments?: ContactCampaign[];
};

type ContactDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  brokerage: string;
  contactCategory: string;
  mailingAddress: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  assignedTo: string;
  lastContactedAt: string;
};

type TimelineItem = {
  id: string;
  kind: "communication" | "deal";
  title: string;
  detail: string;
  createdAt: string | null;
};

type ContactDetailDialogProps = {
  contact: Contact | null;
  adminMode: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (contactId: string) => void;
  onContactUpdated: (contactId: string, changes: Partial<Contact>) => void;
  isRemoving: boolean;
};

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

function formatDate(value?: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || "?";
}

function campaignName(campaign: ContactCampaign) {
  return campaign.template_name || campaign.templateName || "Outreach campaign";
}

function campaignCreatedAt(campaign: ContactCampaign) {
  return campaign.created_at || campaign.createdAt || null;
}

function DetailValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="break-words text-sm font-medium text-slate-800">{children}</div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function ContactTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return <EmptyState title="No activity yet" detail="Deals and logged communications will appear here." />;
  }

  return (
    <ol className="space-y-0">
      {items.map((item, index) => {
        const Icon = item.kind === "deal" ? BriefcaseBusiness : item.title.toLowerCase().includes("email") ? Mail : MessageSquare;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < items.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-8 w-px bg-slate-200" />}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dce8f0] bg-white text-[#498EDE]">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-semibold text-[#21394c]">{item.title}</p>
                <time className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</time>
              </div>
              <p className="mt-1 break-words text-sm leading-5 text-slate-600">{item.detail || "No additional details."}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function ContactDetailDialog({
  contact,
  adminMode,
  onOpenChange,
  onRemove,
  onContactUpdated,
  isRemoving,
}: ContactDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const activityQuery = useQuery<ContactActivity>({
    queryKey: ["/api/crm/contacts", contact?.id, "activity"],
    queryFn: () => requestJson(`/api/crm/contacts/${contact?.id}/activity`),
    enabled: Boolean(contact?.id),
  });

  const details = contact
    ? { ...contact, ...(activityQuery.data?.broker || {}) }
    : null;
  const savedNotes = details?.crmNotes || "";
  const canEditIdentity = Boolean(adminMode || contact?.ownerDeveloperProfileId);

  useEffect(() => {
    setIsEditing(false);
    setDraft(null);
    setNotesDraft(savedNotes);
  }, [contact?.id, savedNotes]);

  const invalidateContactData = (contactId: string) => {
    void queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", contactId, "activity"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/developer-profile/me/contacts"] });
  };

  const saveContactMutation = useMutation({
    mutationFn: (changes: Record<string, string | null>) => requestJson(`/api/crm/contacts/${contact!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }),
    onSuccess: (_data, changes) => {
      onContactUpdated(contact!.id, changes as Partial<Contact>);
      setIsEditing(false);
      setDraft(null);
      invalidateContactData(contact!.id);
      toast({ title: "Contact updated", description: "Your changes have been saved." });
    },
    onError: (error: Error) => toast({ title: "Contact update failed", description: error.message, variant: "destructive" }),
  });

  const saveNotesMutation = useMutation({
    mutationFn: (crmNotes: string) => requestJson(`/api/crm/contacts/${contact!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crmNotes: crmNotes || null }),
    }),
    onSuccess: (_data, crmNotes) => {
      onContactUpdated(contact!.id, { crmNotes: crmNotes || null });
      invalidateContactData(contact!.id);
      toast({ title: "Notes saved", description: "Your private CRM note has been updated." });
    },
    onError: (error: Error) => toast({ title: "Notes could not be saved", description: error.message, variant: "destructive" }),
  });

  const timelineItems = useMemo(() => {
    const deals = (activityQuery.data?.deals || []).map((deal): TimelineItem => ({
      id: `deal-${deal.id}`,
      kind: "deal",
      title: deal.dealNumber ? `Deal #${deal.dealNumber} received` : "Deal received",
      detail: [
        [deal.address, deal.city, deal.state].filter(Boolean).join(", "),
        deal.status || deal.classification,
      ].filter(Boolean).join(" · "),
      createdAt: deal.createdAt,
    }));
    const communications = (activityQuery.data?.communications || []).map((communication): TimelineItem => {
      const channel = communication.type ? communication.type.charAt(0).toUpperCase() + communication.type.slice(1) : "Message";
      const direction = communication.direction === "inbound" ? "received" : "sent";
      const body = (communication.body || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        id: `communication-${communication.id}`,
        kind: "communication",
        title: `${channel} ${direction}`,
        detail: communication.subject || body.slice(0, 180) || communication.status || "Communication logged",
        createdAt: communication.createdAt,
      };
    });
    return [...deals, ...communications].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [activityQuery.data?.communications, activityQuery.data?.deals]);

  const enrollments = activityQuery.data?.enrollments || [];
  const activeCampaignCount = enrollments.filter((campaign) => !["completed", "cancelled", "failed"].includes(campaign.status.toLowerCase())).length;

  const startEditing = () => {
    if (!details) return;
    setDraft({
      firstName: details.firstName || "",
      lastName: details.lastName || "",
      email: details.email || "",
      phone: details.phone || "",
      brokerage: details.brokerage || "",
      contactCategory: details.contactCategory || "other",
      mailingAddress: details.mailingAddress || "",
      city: details.city || "",
      stateRegion: details.stateRegion || "",
      postalCode: details.postalCode || "",
      assignedTo: details.assignedTo || "",
      lastContactedAt: dateInputValue(details.lastContactedAt),
    });
    setIsEditing(true);
  };

  const saveContactDetails = () => {
    if (!draft || !contact) return;
    const changes: Record<string, string | null> = {
      assignedTo: draft.assignedTo.trim() || null,
      lastContactedAt: draft.lastContactedAt
        ? new Date(`${draft.lastContactedAt}T12:00:00`).toISOString()
        : null,
    };
    if (canEditIdentity) {
      changes.firstName = draft.firstName.trim() || null;
      changes.lastName = draft.lastName.trim() || null;
      changes.email = draft.email.trim() || null;
      changes.phone = draft.phone.trim() || null;
      changes.brokerage = draft.brokerage.trim() || null;
      changes.contactCategory = draft.contactCategory;
      changes.mailingAddress = draft.mailingAddress.trim() || null;
      changes.city = draft.city.trim() || null;
      changes.stateRegion = draft.stateRegion.trim() || null;
      changes.postalCode = draft.postalCode.trim() || null;
    }
    saveContactMutation.mutate(changes);
  };

  const updateDraft = (key: keyof ContactDraft, value: string) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  if (!contact || !details) {
    return (
      <Dialog open={Boolean(contact)} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl">
          {contact && <p className="text-sm text-slate-500">Loading contact profile…</p>}
        </DialogContent>
      </Dialog>
    );
  }

  const relationship = details.ownerDeveloperProfileId ? "Your company contact" : "Shared network contact";
  const name = [details.firstName, details.lastName].filter(Boolean).join(" ") || "Contact profile";
  const crmTags = details.crmTags || [];
  const sourceTags = details.sourceTags || [];

  return (
    <Dialog open={Boolean(contact)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 pr-12 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Back to contacts"
                onClick={() => onOpenChange(false)}
                className="shrink-0 border-slate-200 text-slate-600"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eaf3fb] text-sm font-semibold text-[#245c8d]">
                {getInitials(details.firstName || "", details.lastName || "")}
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate text-xl text-[#21394c]">{name}</DialogTitle>
                <DialogDescription className="mt-1 truncate">
                  {details.brokerage || "Broker contact"}{details.stateRegion ? ` · ${details.stateRegion}` : ""}
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {details.email && (
                <a
                  href={`mailto:${details.email}`}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-[#8ec7ff] hover:bg-white hover:text-[#498EDE]"
                >
                  <Mail className="h-4 w-4" />Email
                </a>
              )}
              {details.phone && (
                <a
                  href={`tel:${details.phone}`}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-[#8ec7ff] hover:bg-white hover:text-[#498EDE]"
                >
                  <Phone className="h-4 w-4" />Call
                </a>
              )}
              {!isEditing ? (
                <Button type="button" variant="outline" onClick={startEditing} className="border-slate-200">
                  <Pencil className="mr-2 h-4 w-4" />Edit
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => { setIsEditing(false); setDraft(null); }} disabled={saveContactMutation.isPending}>
                    <X className="mr-2 h-4 w-4" />Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={saveContactDetails}
                    disabled={saveContactMutation.isPending}
                    className="border border-[#081729] bg-[#081729] text-white hover:border-[#8ec7ff] hover:bg-white hover:text-[#498EDE]"
                  >
                    <Save className="mr-2 h-4 w-4" />{saveContactMutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-800">{details.phone || "Not provided"}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Email</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-800">{details.email || "Not provided"}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Company</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-800">{details.brokerage || "Not provided"}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Last contacted</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-800">{formatDate(details.lastContactedAt)}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="max-h-52 overflow-y-auto border-b border-slate-200 bg-[#f8fafb] p-5 md:max-h-none md:border-b-0 md:border-r">
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Record</p>
              <h3 className="mt-1 text-sm font-semibold text-[#21394c]">Contact details</h3>
            </div>
            <div className="space-y-5">
              {isEditing && draft ? (
                <>
                  {canEditIdentity ? (
                    <>
                      <div className="space-y-1.5"><Label htmlFor="contact-first-name">First name</Label><Input id="contact-first-name" value={draft.firstName} onChange={(event) => updateDraft("firstName", event.target.value)} /></div>
                      <div className="space-y-1.5"><Label htmlFor="contact-last-name">Last name</Label><Input id="contact-last-name" value={draft.lastName} onChange={(event) => updateDraft("lastName", event.target.value)} /></div>
                      <div className="space-y-1.5"><Label htmlFor="contact-email">Email</Label><Input id="contact-email" type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></div>
                      <div className="space-y-1.5"><Label htmlFor="contact-phone">Phone</Label><Input id="contact-phone" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} /></div>
                      <div className="space-y-1.5"><Label htmlFor="contact-company">Company</Label><Input id="contact-company" value={draft.brokerage} onChange={(event) => updateDraft("brokerage", event.target.value)} /></div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-category">Contact category</Label>
                        <select id="contact-category" value={draft.contactCategory} onChange={(event) => updateDraft("contactCategory", event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                          <option value="broker">Broker</option>
                          <option value="attorney">Attorney / Lawyer</option>
                          <option value="general_contractor">General Contractor</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1.5"><Label htmlFor="contact-address">Address</Label><Input id="contact-address" value={draft.mailingAddress} onChange={(event) => updateDraft("mailingAddress", event.target.value)} /></div>
                      <div className="space-y-1.5"><Label htmlFor="contact-city">City</Label><Input id="contact-city" value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} /></div>
                      <div className="space-y-1.5"><Label htmlFor="contact-state-region">State / region</Label><Input id="contact-state-region" value={draft.stateRegion} onChange={(event) => updateDraft("stateRegion", event.target.value)} /></div>
                      <div className="space-y-1.5"><Label htmlFor="contact-postal-code">Postal code</Label><Input id="contact-postal-code" value={draft.postalCode} onChange={(event) => updateDraft("postalCode", event.target.value)} /></div>
                    </>
                  ) : (
                    <DetailValue label="Contact identity">Managed by the shared network</DetailValue>
                  )}
                  <div className="space-y-1.5"><Label htmlFor="contact-assigned-to">Assigned to</Label><Input id="contact-assigned-to" value={draft.assignedTo} onChange={(event) => updateDraft("assignedTo", event.target.value)} placeholder="Unassigned" /></div>
                  <div className="space-y-1.5"><Label htmlFor="contact-last-contacted">Last contacted</Label><Input id="contact-last-contacted" type="date" value={draft.lastContactedAt} onChange={(event) => updateDraft("lastContactedAt", event.target.value)} /></div>
                </>
              ) : (
                <>
                  <DetailValue label="Name">{name}</DetailValue>
                  <DetailValue label="Email">{details.email || "Not provided"}</DetailValue>
                  <DetailValue label="Phone">{details.phone || "Not provided"}</DetailValue>
                  <DetailValue label="Account / company">{details.brokerage || "Not provided"}</DetailValue>
                  <DetailValue label="Contact category">{(details.contactCategory || "other").replace(/[_-]+/g, " ")}</DetailValue>
                  <DetailValue label="Address">{details.mailingAddress || "Not provided"}</DetailValue>
                  <DetailValue label="City / state / postal">{[details.city, details.stateRegion, details.postalCode].filter(Boolean).join(", ") || "Not provided"}</DetailValue>
                  <DetailValue label="Assigned to">{details.assignedTo || "Unassigned"}</DetailValue>
                  <DetailValue label="Contact type">Broker contact</DetailValue>
                  <DetailValue label="Relationship">{relationship}</DetailValue>
                  <DetailValue label="Created">{formatDate(details.createdAt)}</DetailValue>
                  <DetailValue label="Last contacted">{formatDate(details.lastContactedAt)}</DetailValue>
                </>
              )}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {activityQuery.isError ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Activity could not be loaded. Contact details remain available.
              </div>
            ) : null}
            {activityQuery.isLoading ? (
              <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4 animate-pulse" />Loading contact activity…</div>
            ) : null}

            <Tabs key={contact.id} defaultValue="overview" className="space-y-5">
              <TabsList className="grid h-auto w-full grid-cols-4 rounded-none border-b border-slate-200 bg-transparent p-0">
                <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-[#498EDE] data-[state=active]:bg-transparent data-[state=active]:text-[#081729] data-[state=active]:shadow-none">Overview</TabsTrigger>
                <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-[#498EDE] data-[state=active]:bg-transparent data-[state=active]:text-[#081729] data-[state=active]:shadow-none">Activity</TabsTrigger>
                <TabsTrigger value="deals" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-[#498EDE] data-[state=active]:bg-transparent data-[state=active]:text-[#081729] data-[state=active]:shadow-none">Deals</TabsTrigger>
                <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent py-3 data-[state=active]:border-[#498EDE] data-[state=active]:bg-transparent data-[state=active]:text-[#081729] data-[state=active]:shadow-none">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Created</p><p className="mt-2 text-sm font-semibold text-[#21394c]">{formatDate(details.createdAt)}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Type</p><p className="mt-2 text-sm font-semibold text-[#21394c]">Broker contact</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Deals</p><p className="mt-2 text-sm font-semibold text-[#21394c]">{activityQuery.data?.deals?.length || 0}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Active campaigns</p><p className="mt-2 text-sm font-semibold text-[#21394c]">{activeCampaignCount}</p></div>
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-[#498EDE]" /><h3 className="text-sm font-semibold text-[#21394c]">Recent activity</h3></div>
                  <ContactTimeline items={timelineItems.slice(0, 4)} />
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2"><UserRound className="h-4 w-4 text-[#498EDE]" /><h3 className="text-sm font-semibold text-[#21394c]">Tags</h3></div>
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-500">Your CRM tags</p>
                      {crmTags.length ? <div className="flex flex-wrap gap-2">{crmTags.map((tag, index) => <Badge key={`${tag}-${index}`} variant="outline" className="border-[#d8e6ee] bg-[#f4f8fb] text-[#405a70]">{tag}</Badge>)}</div> : <p className="text-sm text-slate-500">No company CRM tags.</p>}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-500">Shared source tags</p>
                      {sourceTags.length ? <div className="flex flex-wrap gap-2">{sourceTags.map((tag, index) => <Badge key={`${tag}-${index}`} variant="secondary" className="bg-[#f2f8f1] text-[#4d7351]">{tag}</Badge>)}</div> : <p className="text-sm text-slate-500">No source tags.</p>}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#498EDE]" /><h3 className="text-sm font-semibold text-[#21394c]">Outreach campaigns</h3></div>
                  {enrollments.length ? (
                    <div className="divide-y divide-slate-100">
                      {enrollments.map((campaign) => (
                        <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                          <div><p className="text-sm font-medium text-slate-800">{campaignName(campaign)}</p><p className="mt-1 text-xs text-slate-500">Added {formatDate(campaignCreatedAt(campaign))}</p></div>
                          <Badge variant="outline" className="capitalize">{campaign.status.replace(/_/g, " ")}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">No campaign activity for this contact.</p>}
                </section>
              </TabsContent>

              <TabsContent value="activity" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-5 flex items-center gap-2"><Activity className="h-4 w-4 text-[#498EDE]" /><h3 className="text-sm font-semibold text-[#21394c]">Activity history</h3></div>
                <ContactTimeline items={timelineItems} />
              </TabsContent>

              <TabsContent value="deals" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-5 flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-[#498EDE]" /><h3 className="text-sm font-semibold text-[#21394c]">Deals</h3></div>
                {(activityQuery.data?.deals || []).length ? (
                  <div className="divide-y divide-slate-100">
                    {activityQuery.data!.deals!.map((deal) => (
                      <div key={deal.id} className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{deal.address || (deal.dealNumber ? `Deal #${deal.dealNumber}` : "Deal")}</p>
                          <p className="mt-1 text-sm text-slate-500">{[deal.city, deal.state].filter(Boolean).join(", ") || "Location not provided"}</p>
                          <p className="mt-1 text-xs text-slate-500">{deal.classification || "Unclassified"} · {formatDate(deal.createdAt)}</p>
                        </div>
                        <Badge variant="outline" className="w-fit capitalize">{(deal.status || "Received").replace(/_/g, " ")}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState title="No deals yet" detail="Deals connected to this contact will appear here." />}
              </TabsContent>

              <TabsContent value="notes" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-[#498EDE]" /><h3 className="text-sm font-semibold text-[#21394c]">Private CRM notes</h3></div>
                <p className="mb-3 text-sm text-slate-500">Visible only to your company for shared network contacts.</p>
                <Textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  className="min-h-[220px] border-slate-200 focus-visible:border-[#498EDE] focus-visible:text-slate-800"
                  placeholder="Add context about this relationship, preferences, or follow-up..."
                  aria-label="Private CRM notes"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{notesDraft.length} characters</p>
                  <Button
                    type="button"
                    onClick={() => saveNotesMutation.mutate(notesDraft)}
                    disabled={saveNotesMutation.isPending || notesDraft === savedNotes}
                    className="border border-[#081729] bg-[#081729] text-white hover:border-[#8ec7ff] hover:bg-white hover:text-[#498EDE]"
                  >
                    {saveNotesMutation.isPending ? <Clock3 className="mr-2 h-4 w-4 animate-pulse" /> : <Check className="mr-2 h-4 w-4" />}
                    {saveNotesMutation.isPending ? "Saving…" : "Save notes"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>

        {!adminMode && (
          <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-5 py-3 sm:px-7">
            <Button
              type="button"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={isRemoving}
              onClick={() => onRemove(contact.id)}
            >
              <UserRound className="mr-2 h-4 w-4" />Remove from my CRM
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
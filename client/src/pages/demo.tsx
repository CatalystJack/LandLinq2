/**
 * Public demo page — no auth required.
 * Shows three tabs: Deal Dashboard · Outreach Campaigns · CRM
 * All data is fictional.
 */
import { useState } from "react";
import { Link } from "wouter";
import {
  Building, ArrowRight, X, Zap, CheckCircle, XCircle,
  AlertCircle, Clock, ChevronRight, BarChart2, Mail,
  MessageSquare, Users, Play, Pause, Edit, Phone,
  Search, Filter, Plus, Send, TrendingUp, Activity,
  Calendar, Star, Inbox, RefreshCw, Eye, Tag,
  ChevronDown, MoreHorizontal, Bell, Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ─────────────────────────────────────────────────────────────────

type DealStatus = "Accepted" | "Rejected" | "Needs Review" | "New" | "In Review";
type Priority = "A" | "B" | "C";

interface DemoDeal {
  id: string; address: string; city: string; state: string;
  acres: number; price: string; units: number; yoc: number | null;
  type: string; qct: boolean; dda: boolean; oz: boolean; lihtc: number | null;
  status: DealStatus; priority: Priority; step: string;
  aiReason: string; comps: DemoComp[];
  rejectionReason?: string;
}

interface DemoComp {
  name: string; city: string; units: number; yearBuilt: number;
  rentPerUnit: number; rentPSF: number; occupancy: number; distance: string;
}

interface DemoCampaign {
  id: number; name: string; status: "active" | "paused";
  cadence: string; channels: string[]; scheduleWeek: string;
  sendHour: string; totalRuns: number; totalSent: number;
  successRate: number; nextRunAt: string; lastRun: string;
  emailSent: number; smsSent: number;
}

interface DemoContact {
  id: number; firstName: string; lastName: string;
  email: string; phone: string; brokerage: string;
  smsOptIn: boolean; tags: string[]; dealCount: number;
  assignedTo: string; addedDate: string; markets: string[];
  notes: string; isActive: boolean;
  enrollments: { campaign: string; step: string; status: string; nextSend: string }[];
  deals: { num: string; address: string; classification: string }[];
}

// ─── Fake Data ──────────────────────────────────────────────────────────────

const DEMO_DEALS: DemoDeal[] = [
  {
    id: "CCP-0041", address: "1847 Parkway Dr", city: "Charlotte", state: "NC",
    acres: 12.4, price: "$2.8M", units: 85, yoc: 9.1, type: "3-Story Surface Park",
    qct: true, dda: true, oz: false, lihtc: 72, status: "Accepted", priority: "A",
    step: "Letter of Intent",
    aiReason: "Strong QCT/DDA overlap with 9.1% YOC exceeds our 8.5% floor. Comparable rents in South End support $1.42/PSF. 85-unit count hits 80-unit minimum. LIHTC score of 72 is competitive for the 2026 QAP. Recommend proceeding to LOI.",
    comps: [
      { name: "Parkway Commons", city: "Charlotte", units: 96, yearBuilt: 2021, rentPerUnit: 1180, rentPSF: 1.44, occupancy: 97, distance: "0.4 mi" },
      { name: "South End Flats", city: "Charlotte", units: 72, yearBuilt: 2019, rentPerUnit: 1145, rentPSF: 1.39, occupancy: 95, distance: "0.9 mi" },
    ],
  },
  {
    id: "CCP-0038", address: "324 Commerce Blvd", city: "Raleigh", state: "NC",
    acres: 6.8, price: "$1.9M", units: 72, yoc: 8.7, type: "Affordable",
    qct: true, dda: true, oz: true, lihtc: 81, status: "Accepted", priority: "A",
    step: "Due Diligence",
    aiReason: "Triple-overlay (QCT + DDA + OZ) site with 81 LIHTC points — highest scored deal this quarter. 8.7% YOC at current rents with upside as area median income grows. OZ deferral adds meaningful equity yield. Accelerate to due diligence.",
    comps: [
      { name: "Midtown Affordable", city: "Raleigh", units: 80, yearBuilt: 2020, rentPerUnit: 1090, rentPSF: 1.31, occupancy: 98, distance: "0.6 mi" },
      { name: "Commerce Place", city: "Raleigh", units: 64, yearBuilt: 2018, rentPerUnit: 1060, rentPSF: 1.28, occupancy: 96, distance: "1.2 mi" },
    ],
  },
  {
    id: "CCP-0044", address: "5012 Industrial Way", city: "Durham", state: "NC",
    acres: 18.3, price: "$4.2M", units: 96, yoc: 7.8, type: "BTR SFR Detached",
    qct: false, dda: false, oz: false, lihtc: null, status: "Needs Review", priority: "B",
    step: "Initial Review",
    aiReason: "BTR SFR at 7.8% YOC falls below our 8.5% threshold on a non-QCT/DDA site. Lot premium is high for Durham submarket. Comparable detached SFR rents suggest limited upside. Flagged for senior review before passing — site has good bones if seller adjusts to $3.7M.",
    comps: [
      { name: "Durham BTR Phase I", city: "Durham", units: 88, yearBuilt: 2022, rentPerUnit: 1620, rentPSF: 1.08, occupancy: 94, distance: "1.1 mi" },
    ],
  },
  {
    id: "CCP-0039", address: "881 Mountain View Rd", city: "Asheville", state: "NC",
    acres: 9.2, price: "$1.5M", units: 60, yoc: 9.8, type: "Garden Style",
    qct: true, dda: false, oz: true, lihtc: 68, status: "Accepted", priority: "A",
    step: "Term Sheet",
    aiReason: "QCT + OZ combination with best-in-class 9.8% YOC. Mountain View micro-market has <3% rental vacancy. 60 units is on the smaller side but the OZ equity story more than compensates. LIHTC at 68 is borderline — recommend QAP consultant review before finalizing.",
    comps: [
      { name: "Asheville Gardens", city: "Asheville", units: 68, yearBuilt: 2020, rentPerUnit: 1240, rentPSF: 1.55, occupancy: 98, distance: "0.7 mi" },
      { name: "Blue Ridge Flats", city: "Asheville", units: 54, yearBuilt: 2021, rentPerUnit: 1265, rentPSF: 1.58, occupancy: 97, distance: "1.3 mi" },
    ],
  },
  {
    id: "CCP-0042", address: "2200 Cary Pkwy", city: "Cary", state: "NC",
    acres: 7.6, price: "$2.1M", units: 78, yoc: 8.2, type: "Mixed-Income",
    qct: false, dda: true, oz: false, lihtc: 59, status: "Rejected", priority: "B",
    step: "Closed",
    rejectionReason: "YOC below threshold on non-QCT site",
    aiReason: "DDA-only site with 8.2% YOC misses our combined 8.5% floor for non-QCT properties. Cary submarket rents have plateaued post-2024. LIHTC score of 59 is too low to be competitive in the 9% credit round. Clear pass unless seller drops to $1.75M.",
    comps: [
      { name: "Cary Town Center Apts", city: "Cary", units: 90, yearBuilt: 2021, rentPerUnit: 1380, rentPSF: 1.38, occupancy: 95, distance: "0.5 mi" },
    ],
  },
  {
    id: "CCP-0045", address: "710 Concord Mills Blvd", city: "Concord", state: "NC",
    acres: 14.1, price: "$3.0M", units: 110, yoc: 8.9, type: "Affordable",
    qct: true, dda: false, oz: false, lihtc: 74, status: "Accepted", priority: "A",
    step: "Closing",
    aiReason: "110-unit QCT affordable deal at 8.9% YOC with strong LIHTC score. Concord is a growing submarket with tight affordable supply. This one checks every box — recommend expediting closing timeline.",
    comps: [
      { name: "Concord Affordable Hsg", city: "Concord", units: 120, yearBuilt: 2019, rentPerUnit: 985, rentPSF: 1.23, occupancy: 99, distance: "0.8 mi" },
      { name: "Mills Park Residences", city: "Concord", units: 96, yearBuilt: 2020, rentPerUnit: 1010, rentPSF: 1.26, occupancy: 97, distance: "1.0 mi" },
    ],
  },
  {
    id: "CCP-0046", address: "390 Port City Blvd", city: "Wilmington", state: "NC",
    acres: 11.0, price: "$2.4M", units: 80, yoc: 8.6, type: "3-Story Surface Park",
    qct: false, dda: false, oz: true, lihtc: null, status: "In Review", priority: "B",
    step: "Initial Review",
    aiReason: "OZ-only deal with solid 8.6% YOC. Wilmington coastal market is high-demand but non-QCT/DDA limits LIHTC competitiveness. Worth underwriting at current ask if OZ equity investors are in the capital stack. Waiting on market comp pull from HelloData.",
    comps: [],
  },
  {
    id: "CCP-0047", address: "1555 Apex Peakway", city: "Apex", state: "NC",
    acres: 5.4, price: "$1.2M", units: 52, yoc: 11.2, type: "Garden Style",
    qct: true, dda: true, oz: false, lihtc: 77, status: "Accepted", priority: "A",
    step: "Due Diligence",
    aiReason: "Exceptional 11.2% YOC on a QCT+DDA site — highest YOC in current pipeline. Small at 52 units but the economics are outstanding. LIHTC 77 is strong. Apex submarket vacancy is sub-2%. Fast-track due diligence.",
    comps: [
      { name: "Apex Commons", city: "Apex", units: 60, yearBuilt: 2022, rentPerUnit: 1310, rentPSF: 1.64, occupancy: 99, distance: "0.3 mi" },
    ],
  },
  {
    id: "CCP-0043", address: "2900 Western Blvd", city: "Raleigh", state: "NC",
    acres: 8.8, price: "$1.8M", units: 68, yoc: 7.2, type: "Affordable",
    qct: true, dda: false, oz: false, lihtc: 55, status: "Rejected", priority: "C",
    step: "Closed",
    rejectionReason: "YOC too low; LIHTC score not competitive",
    aiReason: "7.2% YOC is well below our 8.5% floor even with QCT status. LIHTC score of 55 would not be competitive in 4% or 9% round. Western Blvd corridor has seen cap rate compression — seller pricing reflects market froth. Hard pass.",
    comps: [
      { name: "Western Village Apts", city: "Raleigh", units: 76, yearBuilt: 2018, rentPerUnit: 1020, rentPSF: 1.28, occupancy: 93, distance: "0.9 mi" },
    ],
  },
  {
    id: "CCP-0048", address: "4401 Liberty St", city: "Winston-Salem", state: "NC",
    acres: 10.5, price: "$2.0M", units: 76, yoc: null, type: "Mixed-Income",
    qct: null as any, dda: null as any, oz: null as any, lihtc: null, status: "New", priority: "B",
    step: "Pending Classification",
    aiReason: "",
    comps: [],
  },
];

const DEMO_CAMPAIGNS: DemoCampaign[] = [
  {
    id: 1, name: "Monthly Email Outreach", status: "active",
    cadence: "Monthly", channels: ["email"], scheduleWeek: "1st Monday",
    sendHour: "9:00 AM EST", totalRuns: 24, totalSent: 4832,
    successRate: 94.2, nextRunAt: "Aug 4, 2026 9:00 AM",
    lastRun: "Jul 7, 2026", emailSent: 4832, smsSent: 0,
  },
  {
    id: 2, name: "Deal Opportunities Blast", status: "active",
    cadence: "Monthly", channels: ["email", "sms"], scheduleWeek: "3rd Monday",
    sendHour: "10:00 AM EST", totalRuns: 12, totalSent: 2156,
    successRate: 97.1, nextRunAt: "Aug 18, 2026 10:00 AM",
    lastRun: "Jul 21, 2026", emailSent: 1420, smsSent: 736,
  },
  {
    id: 3, name: "SMS Quick Deal Alert", status: "active",
    cadence: "Monthly", channels: ["sms"], scheduleWeek: "3rd Monday",
    sendHour: "11:00 AM EST", totalRuns: 18, totalSent: 1920,
    successRate: 91.8, nextRunAt: "Aug 18, 2026 11:00 AM",
    lastRun: "Jul 21, 2026", emailSent: 0, smsSent: 1920,
  },
  {
    id: 4, name: "Market Updates Newsletter", status: "paused",
    cadence: "Monthly", channels: ["email"], scheduleWeek: "1st Monday",
    sendHour: "8:00 AM EST", totalRuns: 6, totalSent: 890,
    successRate: 88.5, nextRunAt: "Paused",
    lastRun: "Apr 1, 2026", emailSent: 890, smsSent: 0,
  },
];

const RECENT_RUNS = [
  { campaign: "Monthly Email Outreach", date: "Jul 7, 2026 9:04 AM", emailSent: 201, smsSent: 0, failures: 3, status: "Completed" },
  { campaign: "Deal Opportunities Blast", date: "Jul 21, 2026 10:02 AM", emailSent: 118, smsSent: 61, failures: 1, status: "Completed" },
  { campaign: "SMS Quick Deal Alert", date: "Jul 21, 2026 11:05 AM", emailSent: 0, smsSent: 160, failures: 4, status: "Completed" },
  { campaign: "Monthly Email Outreach", date: "Jun 2, 2026 9:01 AM", emailSent: 198, smsSent: 0, failures: 2, status: "Completed" },
  { campaign: "Deal Opportunities Blast", date: "Jun 16, 2026 10:00 AM", emailSent: 114, smsSent: 58, failures: 0, status: "Completed" },
];

const DEMO_CONTACTS: DemoContact[] = [
  {
    id: 1, firstName: "Marcus", lastName: "Webb", email: "mwebb@trianglere.com", phone: "(919) 555-0142",
    brokerage: "Triangle Real Estate Group", smsOptIn: true, tags: ["Top Producer", "Multifamily"], dealCount: 4,
    assignedTo: "Sarah K.", addedDate: "Jan 12, 2025", markets: ["Raleigh", "Durham"],
    notes: "Prefers early morning calls. Focus on affordable multifamily. Has a pipeline of 3-4 deals expected Q3.",
    isActive: true,
    enrollments: [
      { campaign: "Monthly Email Outreach", step: "Step 3", status: "in_progress", nextSend: "Aug 4, 2026" },
      { campaign: "SMS Quick Deal Alert", step: "Step 1", status: "in_progress", nextSend: "Aug 18, 2026" },
    ],
    deals: [
      { num: "CCP-0038", address: "324 Commerce Blvd, Raleigh", classification: "High Priority" },
      { num: "CCP-0043", address: "2900 Western Blvd, Raleigh", classification: "Clear No" },
    ],
  },
  {
    id: 2, firstName: "Tamara", lastName: "Okafor", email: "tokafor@cltsouth.com", phone: "(704) 555-0287",
    brokerage: "CLT South Advisors", smsOptIn: true, tags: ["High Volume", "QCT Specialist"], dealCount: 6,
    assignedTo: "James L.", addedDate: "Mar 5, 2025", markets: ["Charlotte", "Concord"],
    notes: "Sends 2-3 deals per month. Very responsive via SMS. Best source for South End and NoDa properties.",
    isActive: true,
    enrollments: [
      { campaign: "Monthly Email Outreach", step: "Step 5", status: "in_progress", nextSend: "Aug 4, 2026" },
      { campaign: "Deal Opportunities Blast", step: "Step 2", status: "in_progress", nextSend: "Aug 18, 2026" },
    ],
    deals: [
      { num: "CCP-0041", address: "1847 Parkway Dr, Charlotte", classification: "High Priority" },
    ],
  },
  {
    id: 3, firstName: "Derek", lastName: "Pham", email: "dpham@apexcre.com", phone: "(919) 555-0364",
    brokerage: "Apex Commercial RE", smsOptIn: false, tags: ["Affordable Housing"], dealCount: 3,
    assignedTo: "Sarah K.", addedDate: "Feb 18, 2025", markets: ["Apex", "Cary"],
    notes: "Only responds to email. Specializes in affordable / LIHTC plays in western Wake County.",
    isActive: true,
    enrollments: [
      { campaign: "Monthly Email Outreach", step: "Step 4", status: "in_progress", nextSend: "Aug 4, 2026" },
    ],
    deals: [
      { num: "CCP-0047", address: "1555 Apex Peakway, Apex", classification: "High Priority" },
      { num: "CCP-0042", address: "2200 Cary Pkwy, Cary", classification: "Clear No" },
    ],
  },
  {
    id: 4, firstName: "Brittany", lastName: "Simmons", email: "bsimmons@asheville-prop.com", phone: "(828) 555-0511",
    brokerage: "Asheville Property Partners", smsOptIn: true, tags: ["OZ Deals", "Mountain Markets"], dealCount: 2,
    assignedTo: "James L.", addedDate: "Apr 2, 2025", markets: ["Asheville"],
    notes: "OZ-focused. Strong relationships with Mountain market landowners. Reliable and quick to respond.",
    isActive: true,
    enrollments: [
      { campaign: "Deal Opportunities Blast", step: "Step 1", status: "in_progress", nextSend: "Aug 18, 2026" },
    ],
    deals: [
      { num: "CCP-0039", address: "881 Mountain View Rd, Asheville", classification: "High Priority" },
    ],
  },
  {
    id: 5, firstName: "James", lastName: "Holloway", email: "jholloway@piedmont-land.com", phone: "(336) 555-0198",
    brokerage: "Piedmont Land & Dev", smsOptIn: true, tags: ["New Broker"], dealCount: 1,
    assignedTo: "Sarah K.", addedDate: "Jun 15, 2026", markets: ["Winston-Salem", "High Point"],
    notes: "Referred by Marcus Webb. First deal submitted (CCP-0048). Very eager. Send deal criteria PDF.",
    isActive: true,
    enrollments: [
      { campaign: "Monthly Email Outreach", step: "Step 1", status: "in_progress", nextSend: "Aug 4, 2026" },
    ],
    deals: [
      { num: "CCP-0048", address: "4401 Liberty St, Winston-Salem", classification: "Pending" },
    ],
  },
  {
    id: 6, firstName: "Carla", lastName: "Nguyen", email: "cnguyen@wilm-commercial.com", phone: "(910) 555-0322",
    brokerage: "Wilmington Commercial", smsOptIn: false, tags: ["Coastal Markets"], dealCount: 1,
    assignedTo: "James L.", addedDate: "May 8, 2026", markets: ["Wilmington"],
    notes: "Coastal market specialist. Submitted Port City deal. Follow up on OZ equity interest.",
    isActive: true,
    enrollments: [],
    deals: [
      { num: "CCP-0046", address: "390 Port City Blvd, Wilmington", classification: "Potential" },
    ],
  },
  {
    id: 7, firstName: "Robert", lastName: "Eaton", email: "reaton@durhamland.com", phone: "(919) 555-0477",
    brokerage: "Durham Land Co.", smsOptIn: true, tags: ["BTR", "Multifamily"], dealCount: 2,
    assignedTo: "Sarah K.", addedDate: "Nov 3, 2024", markets: ["Durham"],
    notes: "BTR SFR specialist in Durham. Knows every large-lot owner in the county.",
    isActive: true,
    enrollments: [
      { campaign: "SMS Quick Deal Alert", step: "Step 2", status: "in_progress", nextSend: "Aug 18, 2026" },
    ],
    deals: [
      { num: "CCP-0044", address: "5012 Industrial Way, Durham", classification: "Potential" },
    ],
  },
  {
    id: 8, firstName: "Yvonne", lastName: "Castillo", email: "ycastillo@concord-re.com", phone: "(704) 555-0633",
    brokerage: "Concord Realty Group", smsOptIn: true, tags: ["High Volume", "Affordable Housing"], dealCount: 5,
    assignedTo: "James L.", addedDate: "Dec 1, 2024", markets: ["Concord", "Charlotte"],
    notes: "One of our most active brokers. Fast turnaround. Strong affordable pipeline from Cabarrus County.",
    isActive: true,
    enrollments: [
      { campaign: "Monthly Email Outreach", step: "Step 6", status: "in_progress", nextSend: "Aug 4, 2026" },
    ],
    deals: [
      { num: "CCP-0045", address: "710 Concord Mills Blvd, Concord", classification: "High Priority" },
    ],
  },
  {
    id: 9, firstName: "Paul", lastName: "Merritt", email: "pmerritt@nclandbrokers.com", phone: "(919) 555-0819",
    brokerage: "NC Land Brokers", smsOptIn: false, tags: ["Land Only"], dealCount: 0,
    assignedTo: "Sarah K.", addedDate: "Jul 10, 2026", markets: ["Raleigh", "Durham", "Chapel Hill"],
    notes: "Primarily land disposition. Not focused on multifamily but has a few sites that could work.",
    isActive: true,
    enrollments: [],
    deals: [],
  },
  {
    id: 10, firstName: "Gwendolyn", lastName: "Marsh", email: "gmarsh@trianglere.com", phone: "(919) 555-0256",
    brokerage: "Triangle Real Estate Group", smsOptIn: true, tags: ["Inactive"], dealCount: 1,
    assignedTo: "James L.", addedDate: "Aug 22, 2024", markets: ["Raleigh"],
    notes: "No response in 90+ days. Keep on monthly email; remove from SMS if no response after next send.",
    isActive: false,
    enrollments: [
      { campaign: "Monthly Email Outreach", step: "Step 8", status: "pending", nextSend: "Aug 4, 2026" },
    ],
    deals: [],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DealStatus }) {
  const map: Record<DealStatus, { label: string; cls: string }> = {
    Accepted: { label: "✓ Accepted", cls: "bg-green-100 text-green-700 border-green-200" },
    Rejected: { label: "✗ Rejected", cls: "bg-red-100 text-red-700 border-red-200" },
    "Needs Review": { label: "⚠ Needs Review", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    "In Review": { label: "◎ In Review", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    New: { label: "★ New", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  };
  const { label, cls } = map[status];
  return <Badge className={`${cls} text-[11px] font-medium px-2 py-0.5 border`}>{label}</Badge>;
}

function PriorityDot({ priority }: { priority: Priority }) {
  const colors: Record<Priority, string> = { A: "bg-green-500", B: "bg-amber-400", C: "bg-gray-400" };
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${colors[priority]}`} />
      <span className="text-xs font-medium text-gray-700">{priority}</span>
    </span>
  );
}

function YesNo({ val }: { val: boolean | null }) {
  if (val === null) return <span className="text-gray-300 text-xs">—</span>;
  return val
    ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 border">YES</Badge>
    : <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px] px-1.5 border">NO</Badge>;
}

// ─── Deal Tab ───────────────────────────────────────────────────────────────

function DealTab() {
  const [deals, setDeals] = useState<DemoDeal[]>(DEMO_DEALS);
  const [selectedDeal, setSelectedDeal] = useState<DemoDeal | null>(null);
  const [detailTab, setDetailTab] = useState<"ai" | "comps">("ai");
  const [classifying, setClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState<"Accepted" | "Rejected" | null>(null);

  const accepted = deals.filter(d => d.status === "Accepted").length;
  const rejected = deals.filter(d => d.status === "Rejected").length;
  const inReview = deals.filter(d => ["In Review", "Needs Review"].includes(d.status)).length;

  function classify(dealId: string, decision: "Accepted" | "Rejected") {
    setClassifying(true);
    setClassifyResult(null);
    setTimeout(() => {
      setClassifyResult(decision);
      setClassifying(false);
      setDeals(prev => prev.map(d =>
        d.id === dealId
          ? {
              ...d,
              status: decision,
              yoc: decision === "Accepted" ? 8.8 : d.yoc,
              lihtc: decision === "Accepted" ? 71 : d.lihtc,
              aiReason: decision === "Accepted"
                ? "AI classification complete. QCT-eligible site with 8.8% projected YOC. Comparable rents in Winston-Salem MSA support $1.28/PSF. 76-unit count meets minimum threshold. LIHTC score of 71 is competitive for the 2026 NC QAP 9% round. Recommend proceeding to initial review."
                : "AI classification complete. Site falls outside QCT/DDA boundaries and projected YOC of 7.9% is below our 8.5% floor for market-rate deals. Winston-Salem submarket rent growth has slowed. Recommend passing at current ask.",
            }
          : d
      ));
    }, 1800);
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-xl bg-[#07172A] text-white p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A90E2] mb-2 flex items-center gap-1.5">
              <Zap size={11} /> AI-POWERED DEAL REVIEW
            </p>
            <h2 className="text-xl font-bold mb-2">From inbox to decision in minutes, not days.</h2>
            <p className="text-sm text-gray-300 leading-relaxed mb-4">
              Every deal is automatically scored against QCT/DDA/OZ designations, yield on cost, comparable rents, LIHTC eligibility, and 40+ other signals.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Automated HUD 2026 QCT/DDA lookup", "Live rent comps via HelloData", "NC QAP LIHTC scoring engine"].map(f => (
                <span key={f} className="text-[10px] bg-white/10 rounded-full px-3 py-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4A90E2]" />{f}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-64">
            {[
              { icon: Eye, label: "Deals Reviewed", val: "1,200+" },
              { icon: Clock, label: "Avg. Review Time", val: "4 min" },
              { icon: CheckCircle, label: "Accepted Rate", val: "31%" },
              { icon: TrendingUp, label: "Time Saved / Deal", val: "2.5 hrs" },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="bg-white/10 rounded-lg p-3 text-center">
                <Icon size={14} className="text-[#4A90E2] mx-auto mb-1" />
                <p className="text-base font-bold">{val}</p>
                <p className="text-[10px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Deals", val: deals.length, cls: "text-gray-900" },
          { label: "Accepted", val: accepted, cls: "text-green-600" },
          { label: "Rejected", val: rejected, cls: "text-red-500" },
          { label: "In Review", val: inReview, cls: "text-amber-600" },
        ].map(({ label, val, cls }) => (
          <Card key={label} className="text-center py-4">
            <p className={`text-2xl font-bold ${cls}`}>{val}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </Card>
        ))}
      </div>

      {/* Deal table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity size={14} className="text-[#4A90E2]" /> Active Deal Pipeline
            <Badge className="bg-[#4A90E2]/10 text-[#4A90E2] text-[10px]">{deals.length} deals</Badge>
          </CardTitle>
          <span className="text-[11px] text-gray-400">Click any row to view AI analysis &amp; comparables</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-[11px]">
                  {["#", "Status", "Priority", "Property", "Acres", "Price", "Units", "YOC", "Type", "QCT", "DDA", "OZ", "LIHTC", "Step", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deals.map(deal => (
                  <tr
                    key={deal.id}
                    className="border-b hover:bg-blue-50/40 cursor-pointer transition-colors"
                    onClick={() => { setSelectedDeal(deal); setDetailTab("ai"); setClassifyResult(null); setClassifying(false); }}
                  >
                    <td className="px-3 py-2.5 text-gray-500 font-mono">{deal.id}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={deal.status} /></td>
                    <td className="px-3 py-2.5"><PriorityDot priority={deal.priority} /></td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900">{deal.address}</p>
                      <p className="text-gray-400">{deal.city}, {deal.state}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{deal.acres} ac</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{deal.price}</td>
                    <td className="px-3 py-2.5 text-gray-700">{deal.units}</td>
                    <td className={`px-3 py-2.5 font-bold ${deal.yoc && deal.yoc >= 8.5 ? "text-green-600" : deal.yoc ? "text-amber-600" : "text-gray-300"}`}>
                      {deal.yoc ? `${deal.yoc}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{deal.type}</td>
                    <td className="px-3 py-2.5"><YesNo val={deal.qct ?? null} /></td>
                    <td className="px-3 py-2.5"><YesNo val={deal.dda ?? null} /></td>
                    <td className="px-3 py-2.5"><YesNo val={deal.oz ?? null} /></td>
                    <td className="px-3 py-2.5">
                      {deal.lihtc
                        ? <span className={`font-bold ${deal.lihtc >= 70 ? "text-green-600" : "text-amber-600"}`}>{deal.lihtc}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{deal.step}</td>
                    <td className="px-3 py-2.5"><ChevronRight size={13} className="text-gray-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-[#07172A] to-[#0d2540] text-white">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base mb-1">Ready to submit a deal?</h3>
            <p className="text-sm text-gray-300">We review every submission. Brokers with accepted deals get a direct line to our acquisition team.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/submit-deal">
              <Button className="bg-white text-[#07172A] hover:bg-gray-100 font-semibold text-xs">
                Submit a Deal <ArrowRight size={13} className="ml-1.5" />
              </Button>
            </Link>
            <Link href="/criteria">
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 text-xs">
                Our Criteria
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Deal detail modal */}
      <Dialog open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedDeal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="font-mono text-gray-500 text-sm">{selectedDeal.id}</span>
                  <span className="text-gray-900">{selectedDeal.address}, {selectedDeal.city}</span>
                  <StatusBadge status={selectedDeal.status} />
                </DialogTitle>
              </DialogHeader>

              {/* Key stats */}
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: "Price", val: selectedDeal.price },
                  { label: "Units", val: selectedDeal.units },
                  { label: "YOC", val: selectedDeal.yoc ? `${selectedDeal.yoc}%` : "—" },
                  { label: "LIHTC", val: selectedDeal.lihtc ?? "—" },
                  { label: "Acres", val: `${selectedDeal.acres} ac` },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2">
                    <p className="font-bold text-sm text-gray-900">{val}</p>
                    <p className="text-[10px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex border-b">
                {(["ai", "comps"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setDetailTab(t)}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${detailTab === t ? "border-[#4A90E2] text-[#4A90E2]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    {t === "ai" ? "AI Analysis" : "Comparables"}
                  </button>
                ))}
              </div>

              {detailTab === "ai" && (
                <div className="space-y-3">
                  {selectedDeal.status === "New" ? (
                    <div className="space-y-3">
                      {classifyResult ? (
                        <div className={`rounded-lg p-4 ${classifyResult === "Accepted" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                          <p className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                            {classifyResult === "Accepted"
                              ? <><CheckCircle size={14} className="text-green-600" /> Accepted</>
                              : <><XCircle size={14} className="text-red-500" /> Rejected</>}
                          </p>
                          <p className="text-xs text-gray-600 leading-relaxed">{selectedDeal.aiReason}</p>
                        </div>
                      ) : (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                          {classifying ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#4A90E2] animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-3 h-3 rounded-full bg-[#4A90E2] animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-3 h-3 rounded-full bg-[#4A90E2] animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                              <p className="text-xs text-gray-500">Running AI classification… checking QCT/DDA/OZ, pulling comps, scoring LIHTC…</p>
                            </div>
                          ) : (
                            <>
                              <p className="text-xs text-gray-600 mb-3">This deal hasn't been classified yet. Trigger the AI engine to evaluate it now.</p>
                              <div className="flex justify-center gap-2">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs h-8" onClick={() => classify(selectedDeal.id, "Accepted")}>
                                  <CheckCircle size={12} className="mr-1" /> Accept
                                </Button>
                                <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white text-xs h-8" onClick={() => classify(selectedDeal.id, "Rejected")}>
                                  <XCircle size={12} className="mr-1" /> Reject
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`rounded-lg p-4 ${selectedDeal.status === "Accepted" ? "bg-green-50 border border-green-200" : selectedDeal.status === "Rejected" ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
                      <p className="font-semibold text-xs mb-2 text-gray-700 uppercase tracking-wide">AI Recommendation</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{selectedDeal.aiReason}</p>
                      {selectedDeal.rejectionReason && (
                        <p className="text-[10px] text-red-500 mt-2 font-medium">Primary reason: {selectedDeal.rejectionReason}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {detailTab === "comps" && (
                <div>
                  {selectedDeal.comps.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No comps available yet.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-gray-500 text-[11px]">
                          {["Property", "Distance", "Units", "Built", "Rent/Unit", "PSF", "Occ."].map(h => (
                            <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDeal.comps.map((c, i) => (
                          <tr key={i} className="border-b">
                            <td className="px-2 py-2 font-medium text-gray-900">{c.name}<br /><span className="text-gray-400">{c.city}</span></td>
                            <td className="px-2 py-2 text-gray-600">{c.distance}</td>
                            <td className="px-2 py-2">{c.units}</td>
                            <td className="px-2 py-2">{c.yearBuilt}</td>
                            <td className="px-2 py-2 font-medium">${c.rentPerUnit.toLocaleString()}</td>
                            <td className="px-2 py-2 font-medium text-[#4A90E2]">${c.rentPSF.toFixed(2)}</td>
                            <td className="px-2 py-2 text-green-600 font-medium">{c.occupancy}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Outreach Tab ───────────────────────────────────────────────────────────

function OutreachTab() {
  const [campaigns, setCampaigns] = useState<DemoCampaign[]>(DEMO_CAMPAIGNS);
  const [messagingOn, setMessagingOn] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", channels: [] as string[], scheduleWeek: "1st_monday", hour: "9" });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const totalSent = campaigns.reduce((a, c) => a + c.totalSent, 0);
  const avgSuccess = (campaigns.reduce((a, c) => a + c.successRate, 0) / campaigns.length).toFixed(1);
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;

  function toggleStatus(id: number) {
    setCampaigns(prev => prev.map(c =>
      c.id === id ? { ...c, status: c.status === "active" ? "paused" : "active" } : c
    ));
  }

  function handleCreate() {
    if (!newCampaign.name.trim() || newCampaign.channels.length === 0) return;
    setCreating(true);
    setTimeout(() => {
      setCreating(false);
      setCreated(true);
      setCampaigns(prev => [...prev, {
        id: prev.length + 1,
        name: newCampaign.name,
        status: "active",
        cadence: "Monthly",
        channels: newCampaign.channels,
        scheduleWeek: newCampaign.scheduleWeek === "1st_monday" ? "1st Monday" : "3rd Monday",
        sendHour: `${newCampaign.hour}:00 AM EST`,
        totalRuns: 0, totalSent: 0, successRate: 0,
        nextRunAt: "Scheduled",
        lastRun: "Not yet run",
        emailSent: 0, smsSent: 0,
      }]);
      setTimeout(() => { setShowCreate(false); setCreated(false); setCreating(false); setNewCampaign({ name: "", channels: [], scheduleWeek: "1st_monday", hour: "9" }); }, 1200);
    }, 1600);
  }

  function toggleChannel(ch: string) {
    setNewCampaign(prev => ({
      ...prev,
      channels: prev.channels.includes(ch) ? prev.channels.filter(c => c !== ch) : [...prev.channels, ch],
    }));
  }

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Activity, label: "Active Campaigns", val: String(activeCampaigns), color: "text-green-600" },
          { icon: Send, label: "Total Sent", val: totalSent.toLocaleString(), color: "text-[#4A90E2]" },
          { icon: CheckCircle, label: "Avg Success Rate", val: `${avgSuccess}%`, color: "text-green-600" },
          { icon: Calendar, label: "Next Scheduled", val: "Aug 4, 2026", color: "text-gray-700" },
        ].map(({ icon: Icon, label, val, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={color} />
                <span className="text-[11px] text-gray-500">{label}</span>
              </div>
              <p className={`text-xl font-bold ${color}`}>{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm font-semibold">Campaigns</CardTitle>
              <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${messagingOn ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-100 border-gray-200 text-gray-500"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${messagingOn ? "bg-green-500" : "bg-gray-400"}`} />
                Messaging {messagingOn ? "ON" : "OFF"}
                <button onClick={() => setMessagingOn(p => !p)} className="ml-1 underline text-[10px]">
                  {messagingOn ? "Pause all" : "Enable"}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search campaigns…" className="pl-7 h-8 text-xs w-48" />
              </div>
              <Button size="sm" className="bg-[#4A90E2] hover:bg-[#3a7bc8] text-white h-8 text-xs" onClick={() => setShowCreate(true)}>
                <Plus size={12} className="mr-1" /> Create Campaign
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map(campaign => (
              <div key={campaign.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${campaign.status === "active" ? "bg-green-500" : "bg-gray-300"}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{campaign.name}</p>
                    <p className="text-[11px] text-gray-400">{campaign.cadence} · {campaign.scheduleWeek} · {campaign.sendHour}</p>
                  </div>
                </div>

                {/* Channels */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {campaign.channels.includes("email") && (
                    <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-2 py-0.5">
                      <Mail size={10} /> Email
                    </span>
                  )}
                  {campaign.channels.includes("sms") && (
                    <span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-600 border border-green-200 rounded px-2 py-0.5">
                      <MessageSquare size={10} /> SMS
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-center shrink-0">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{campaign.totalRuns}</p>
                    <p className="text-[10px] text-gray-400">Runs</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{campaign.totalSent.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">Sent</p>
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${campaign.successRate >= 90 ? "text-green-600" : campaign.successRate >= 80 ? "text-amber-600" : "text-red-500"}`}>
                      {campaign.totalRuns > 0 ? `${campaign.successRate}%` : "—"}
                    </p>
                    <p className="text-[10px] text-gray-400">Success</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-gray-700">{campaign.nextRunAt}</p>
                    <p className="text-[10px] text-gray-400">Next Run</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className={`text-[10px] ${campaign.status === "active" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"} border`}>
                    {campaign.status === "active" ? "Active" : "Paused"}
                  </Badge>
                  <button
                    title={campaign.status === "active" ? "Pause" : "Resume"}
                    onClick={() => toggleStatus(campaign.id)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                  >
                    {campaign.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Edit size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw size={14} className="text-[#4A90E2]" /> Recent Runs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {RECENT_RUNS.map((run, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-gray-900">{run.campaign}</p>
                  <p className="text-gray-400">{run.date}</p>
                </div>
                <div className="flex items-center gap-4 text-center">
                  {run.emailSent > 0 && (
                    <span className="flex items-center gap-1 text-blue-600"><Mail size={11} /> {run.emailSent}</span>
                  )}
                  {run.smsSent > 0 && (
                    <span className="flex items-center gap-1 text-green-600"><MessageSquare size={11} /> {run.smsSent}</span>
                  )}
                  {run.failures > 0 && (
                    <span className="flex items-center gap-1 text-red-400"><AlertCircle size={11} /> {run.failures}</span>
                  )}
                  <Badge className="bg-green-100 text-green-700 border-green-200 border text-[10px]">{run.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create campaign modal */}
      <Dialog open={showCreate} onOpenChange={v => { if (!creating) setShowCreate(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Create Campaign</DialogTitle>
          </DialogHeader>
          {created ? (
            <div className="text-center py-6">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-900">Campaign created!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Campaign Name</label>
                <Input
                  value={newCampaign.name}
                  onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Q3 Broker Outreach"
                  className="text-sm h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-2">Channels</label>
                <div className="flex gap-2">
                  {[{ key: "email", label: "Email", icon: Mail }, { key: "sms", label: "SMS", icon: MessageSquare }].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => toggleChannel(key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${newCampaign.channels.includes(key) ? "bg-[#4A90E2] text-white border-[#4A90E2]" : "bg-white text-gray-600 border-gray-200 hover:border-[#4A90E2]"}`}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Schedule Week</label>
                  <select
                    value={newCampaign.scheduleWeek}
                    onChange={e => setNewCampaign(p => ({ ...p, scheduleWeek: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-2 bg-white"
                  >
                    <option value="1st_monday">1st Monday (Email)</option>
                    <option value="3rd_monday">3rd Monday (SMS)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Send Hour EST</label>
                  <select
                    value={newCampaign.hour}
                    onChange={e => setNewCampaign(p => ({ ...p, hour: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-2 bg-white"
                  >
                    {["8", "9", "10", "11"].map(h => <option key={h} value={h}>{h}:00 AM</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="text-xs">Cancel</Button>
                <Button
                  size="sm"
                  disabled={!newCampaign.name.trim() || newCampaign.channels.length === 0 || creating}
                  className="bg-[#4A90E2] hover:bg-[#3a7bc8] text-white text-xs"
                  onClick={handleCreate}
                >
                  {creating ? "Creating…" : "Create Campaign"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── CRM Tab ────────────────────────────────────────────────────────────────

function CrmTab() {
  const [contacts] = useState<DemoContact[]>(DEMO_CONTACTS);
  const [selected, setSelected] = useState<DemoContact | null>(null);
  const [search, setSearch] = useState("");
  const [detailSection, setDetailSection] = useState<"info" | "campaigns" | "deals">("info");

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return (
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.brokerage.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  const totalContacts = contacts.length;
  const activeContacts = contacts.filter(c => c.isActive).length;
  const smsOptIn = contacts.filter(c => c.smsOptIn).length;
  const totalDeals = contacts.reduce((a, c) => a + c.dealCount, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Total Contacts", val: String(totalContacts), color: "text-gray-900" },
          { icon: Activity, label: "Active", val: String(activeContacts), color: "text-green-600" },
          { icon: MessageSquare, label: "SMS Opted In", val: String(smsOptIn), color: "text-blue-600" },
          { icon: Building, label: "Total Deals", val: String(totalDeals), color: "text-[#4A90E2]" },
        ].map(({ icon: Icon, label, val, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={color} />
                <span className="text-[11px] text-gray-500">{label}</span>
              </div>
              <p className={`text-xl font-bold ${color}`}>{val}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Contacts list */}
        <Card className={`${selected ? "hidden sm:block sm:flex-1" : "flex-1"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users size={14} className="text-[#4A90E2]" /> Contacts
                <Badge className="bg-[#4A90E2]/10 text-[#4A90E2] text-[10px]">{contacts.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-7 h-7 text-xs w-40" />
                </div>
                <Button size="sm" className="h-7 text-xs bg-[#4A90E2] hover:bg-[#3a7bc8] text-white">
                  <Plus size={11} className="mr-1" /> New
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-[11px]">
                  <th className="px-3 py-2.5 text-left font-medium">Name</th>
                  <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">Contact</th>
                  <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Brokerage</th>
                  <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Tags</th>
                  <th className="px-3 py-2.5 text-left font-medium">Deals</th>
                  <th className="px-3 py-2.5 text-left font-medium hidden xl:table-cell">Added</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(contact => (
                  <tr
                    key={contact.id}
                    className={`border-b hover:bg-blue-50/40 cursor-pointer transition-colors ${selected?.id === contact.id ? "bg-blue-50" : ""}`}
                    onClick={() => { setSelected(contact); setDetailSection("info"); }}
                  >
                    <td className="px-3 py-2.5">
                      <p className={`font-medium ${!contact.isActive ? "text-gray-400" : "text-gray-900"}`}>
                        {contact.firstName} {contact.lastName}
                        {!contact.isActive && <span className="ml-1 text-[10px] text-gray-400">(inactive)</span>}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <p className="text-gray-600">{contact.email}</p>
                      <p className="text-gray-400">{contact.phone}</p>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-gray-600">{contact.brokerage}</td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {contact.smsOptIn && <Badge className="text-[9px] bg-blue-50 text-blue-600 border-blue-200 border px-1">SMS</Badge>}
                        {contact.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} className="text-[9px] bg-gray-100 text-gray-500 border-gray-200 border px-1">{tag}</Badge>
                        ))}
                        {contact.tags.length > 2 && <span className="text-[9px] text-gray-400">+{contact.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-gray-700">{contact.dealCount}</td>
                    <td className="px-3 py-2.5 hidden xl:table-cell text-gray-400">{contact.addedDate}</td>
                    <td className="px-3 py-2.5"><ChevronRight size={12} className="text-gray-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Contact detail panel */}
        {selected && (
          <Card className="w-full sm:w-80 shrink-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-gray-900">{selected.firstName} {selected.lastName}</p>
                  <p className="text-[11px] text-gray-400">{selected.brokerage}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <div className="flex border-b mt-2">
                {(["info", "campaigns", "deals"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setDetailSection(s)}
                    className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${detailSection === s ? "border-[#4A90E2] text-[#4A90E2]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    {s === "info" ? "Info" : s === "campaigns" ? "Campaigns" : "Deals"}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-3 pt-0">
              {detailSection === "info" && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail size={12} className="text-gray-400" /> {selected.email}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone size={12} className="text-gray-400" /> {selected.phone}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Calendar size={12} className="text-gray-400" /> Added {selected.addedDate}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Users size={12} className="text-gray-400" /> Assigned to {selected.assignedTo}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Markets</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.markets.map(m => <Badge key={m} className="text-[10px] bg-gray-100 text-gray-600 border-gray-200 border">{m}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.smsOptIn && <Badge className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 border">SMS Opt-In</Badge>}
                      {selected.tags.map(t => <Badge key={t} className="text-[10px] bg-gray-100 text-gray-500 border-gray-200 border">{t}</Badge>)}
                    </div>
                  </div>
                  {selected.notes && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Notes</p>
                      <p className="text-gray-600 leading-relaxed">{selected.notes}</p>
                    </div>
                  )}
                </>
              )}
              {detailSection === "campaigns" && (
                <div className="space-y-2">
                  {selected.enrollments.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">Not enrolled in any campaigns.</p>
                  ) : selected.enrollments.map((e, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                      <p className="font-medium text-gray-900 mb-0.5">{e.campaign}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{e.step}</span>
                        <Badge className={`text-[9px] border ${e.status === "in_progress" ? "bg-green-50 text-green-600 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {e.status === "in_progress" ? "Active" : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-gray-400 mt-0.5">Next: {e.nextSend}</p>
                    </div>
                  ))}
                </div>
              )}
              {detailSection === "deals" && (
                <div className="space-y-2">
                  {selected.deals.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No deals yet.</p>
                  ) : selected.deals.map((d, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono text-gray-500 text-[10px]">{d.num}</span>
                        <Badge className={`text-[9px] border ${d.classification === "High Priority" ? "bg-green-50 text-green-600 border-green-200" : d.classification === "Clear No" ? "bg-red-50 text-red-500 border-red-200" : "bg-amber-50 text-amber-600 border-amber-200"}`}>
                          {d.classification}
                        </Badge>
                      </div>
                      <p className="text-gray-700">{d.address}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Main Demo Page ─────────────────────────────────────────────────────────

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<"deals" | "outreach" | "crm">("deals");
  const [showBanner, setShowBanner] = useState(true);

  const tabs: { key: typeof activeTab; label: string; icon: typeof Building }[] = [
    { key: "deals", label: "Deal Dashboard", icon: Building },
    { key: "outreach", label: "Outreach Campaigns", icon: Send },
    { key: "crm", label: "CRM", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top demo banner */}
      {showBanner && (
        <div className="bg-[#07172A] text-white text-[12px] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-[#4A90E2]" />
            <span>This is a <strong>live demo</strong> — all data is fictional. Explore the platform, then submit a real deal.</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/submit-deal" className="text-[#4A90E2] hover:underline font-semibold">
              Submit a real deal →
            </Link>
            <button onClick={() => setShowBanner(false)} className="text-gray-400 hover:text-white">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#07172A] flex items-center justify-center">
              <Building size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Deal Intelligence Platform</h1>
              <p className="text-[10px] text-gray-400">Interactive Demo — Catalyst Capital Partners</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700 border-green-200 border text-[10px]">● Live Demo</Badge>
            <Link href="/submit-deal">
              <Button size="sm" className="bg-[#4A90E2] hover:bg-[#3a7bc8] text-white text-xs h-8">
                Submit a Deal <ArrowRight size={12} className="ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? "border-[#4A90E2] text-[#4A90E2]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "deals" && <DealTab />}
        {activeTab === "outreach" && <OutreachTab />}
        {activeTab === "crm" && <CrmTab />}
      </div>
    </div>
  );
}

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Calculator, TrendingUp, Building2, DollarSign,
  RefreshCw, Info, ChevronDown, ChevronUp, Download, Plus, Trash2, Check, Loader2,
} from "lucide-react";

// ─── Product presets ─────────────────────────────────────────────────────────
interface UnitMixRow { type: string; pct: number; avgSF: number; monthlyRent: number; }

interface ProductPreset {
  label: string;
  templateType: string;
  dua: number;
  hardCostPerUnit: number;
  // Excel export: construction cost per rentable SF (null = formula-driven, skip write)
  constructionCostPSF: number | null;
  // Excel export: sitework cost per unit
  siteworkPU: number;
  unitMix: UnitMixRow[];
  // ── YOC training defaults (v15) ─────────────────────────────────────────────
  // Verified against 7 Catalyst Excel models (March 2026):
  //   Conventional/AA: 2.75% mgmt (Lenox Village, Hiro), $550 insurance
  //   BTR/SFR:         3.00% mgmt (Starwood BTR & SFR), $750 insurance (coastal premium)
  //   Coastal 3-Story: 2.75% mgmt, $750 insurance (Water Tower Road, N. Myrtle Beach SC)
  defaultMgmtPct: number;    // % of EGI
  defaultInsurancePU: number; // $/unit/yr
}

// Hard costs verified against actual Excel template cells (March 2026):
//   Apartment (3-story/4-story): F67 = construction $/SF (RAW INPUT), E70 = sitework/unit
//   4-Story AA:                  F69 = construction $/SF,              E72 = sitework/unit
//   BTR/SFR/Coastal: construction cost is formula-driven — we skip writing it (constructionCostPSF: null)
// PRESET_VERSION: v15-yoc-training (March 2026) — mgmtPct/insurancePU per product type from 7 models
const PRESETS: ProductPreset[] = [
  {
    // Verified: Lenox Village Nashville TN (250 units) — $164k hard/unit ✓, 2.75% mgmt ✓
    // Template: F67=160 $/SF × 900 SF avg + $20k sitework = $164k/unit total hard ✓
    label: "3-Story Walk-Up (Conventional)", templateType: "3story-conventional",
    dua: 25, hardCostPerUnit: 164000, constructionCostPSF: 160, siteworkPU: 20000,
    defaultMgmtPct: 2.75, defaultInsurancePU: 550,
    unitMix: [
      { type: "1BR / 1BA", pct: 0.60, avgSF: 800,  monthlyRent: 1600 },
      { type: "2BR / 2BA", pct: 0.40, avgSF: 1050, monthlyRent: 2200 },
    ],
  },
  {
    // Template: F67=130 $/SF × 900 SF avg + $20k sitework = $137k/unit total hard
    label: "3-Story Walk-Up (Attainable)", templateType: "3story-attainable",
    dua: 25, hardCostPerUnit: 137000, constructionCostPSF: 130, siteworkPU: 20000,
    defaultMgmtPct: 2.75, defaultInsurancePU: 550,
    unitMix: [
      { type: "1BR / 1BA", pct: 0.60, avgSF: 800,  monthlyRent: 1400 },
      { type: "2BR / 2BA", pct: 0.40, avgSF: 1050, monthlyRent: 1900 },
    ],
  },
  {
    // Verified: Hiro Apartments Orlando FL (324 units) — same $164k hard/unit as 3-story ✓
    // Template: F67=175 $/SF × 900 SF avg + $0 sitework = $157.5k/unit total hard
    label: "4-Story Surface-Parked (Conventional)", templateType: "4story-conventional",
    dua: 35, hardCostPerUnit: 158000, constructionCostPSF: 175, siteworkPU: 0,
    defaultMgmtPct: 2.75, defaultInsurancePU: 550,
    unitMix: [
      { type: "1BR / 1BA", pct: 0.60, avgSF: 800,  monthlyRent: 1650 },
      { type: "2BR / 2BA", pct: 0.40, avgSF: 1050, monthlyRent: 2300 },
    ],
  },
  {
    // Template: F69=180 $/SF × 920 SF avg + $20k sitework ≈ $186k/unit total hard
    label: "4-Story Active Adult", templateType: "4story-active-adult",
    dua: 35, hardCostPerUnit: 186000, constructionCostPSF: 180, siteworkPU: 20000,
    defaultMgmtPct: 2.75, defaultInsurancePU: 550,
    unitMix: [
      { type: "1BR / 1BA", pct: 0.60, avgSF: 800,  monthlyRent: 1950 },
      { type: "2BR / 2BA", pct: 0.40, avgSF: 1100, monthlyRent: 2500 },
    ],
  },
  {
    // 4-Story Wrap uses 4-story-conventional template; deck parking premium ~$55k/unit above surface-park
    label: "4-Story Wrap (Deck Parking)", templateType: "4story-conventional",
    dua: 55, hardCostPerUnit: 215000, constructionCostPSF: 190, siteworkPU: 0,
    defaultMgmtPct: 2.75, defaultInsurancePU: 550,
    unitMix: [
      { type: "1BR / 1BA", pct: 0.60, avgSF: 800,  monthlyRent: 1750 },
      { type: "2BR / 2BA", pct: 0.40, avgSF: 1050, monthlyRent: 2450 },
    ],
  },
  {
    // Verified: Starwood BTR Nashville TN (174 units) — $254k hard/unit ✓, 3.00% mgmt ✓, $750 insurance ✓
    // Template: total hard ≈ $254k/unit (construction formula-driven + $50k sitework)
    // Unit mix from template: 3BR/3.5BA 65% 1659 SF $2500/mo, 4BR/3.5BA 35% 1996 SF $2700/mo
    label: "BTR Townhome (3-Story)", templateType: "btr",
    dua: 8, hardCostPerUnit: 254000, constructionCostPSF: null, siteworkPU: 50000,
    defaultMgmtPct: 3.00, defaultInsurancePU: 750,
    unitMix: [
      { type: "3BR / 3.5BA", pct: 0.65, avgSF: 1659, monthlyRent: 2500 },
      { type: "4BR / 3.5BA", pct: 0.35, avgSF: 1996, monthlyRent: 2700 },
    ],
  },
  // Indices 6–9 intentionally preserve original order so existing preset selections are unchanged.
  {
    // Verified: Starwood SFR Nashville TN (61 units) — $258k hard/unit ✓, 3.00% mgmt ✓, $750 insurance ✓
    // Template: total hard ≈ $258k/unit (construction formula-driven + $50k sitework)
    // Unit mix from template: 3BR 30% 2020 SF $2750/mo, 4BR 70% 2600 SF $3000/mo
    label: "BTR SFR Detached", templateType: "sfr",
    dua: 8, hardCostPerUnit: 258000, constructionCostPSF: null, siteworkPU: 50000,
    defaultMgmtPct: 3.00, defaultInsurancePU: 750,
    unitMix: [
      { type: "3BR / 2.5BA", pct: 0.30, avgSF: 2020, monthlyRent: 2750 },
      { type: "4BR / 3.5BA", pct: 0.70, avgSF: 2600, monthlyRent: 3000 },
    ],
  },
  {
    // Detached AA cottages — verified against AA Cottage Development Template:
    // F67=150 PSF, E70=$50k sitework, G4=total units, H/I/J mix cols
    // Hard cost: 150 PSF × 1350 avg SF + $50k sitework ≈ $252,500/unit
    label: "AA Cottages Detached", templateType: "aa-cottages",
    dua: 6, hardCostPerUnit: 252500, constructionCostPSF: 150, siteworkPU: 50000,
    defaultMgmtPct: 2.75, defaultInsurancePU: 550,
    unitMix: [
      { type: "1BR / 1.5BA", pct: 0.25, avgSF: 1200, monthlyRent: 2400 },
      { type: "2BR / 2.0BA", pct: 0.75, avgSF: 1400, monthlyRent: 3400 },
    ],
  },
  {
    // 3-Story Active Adult — verified against 3-Story AA Template:
    // Same cell layout as 4-Story AA but F69=160 PSF (vs 180), DUA=25 (vs 35)
    // Hard cost: 160 PSF × 920 avg SF + $20k sitework ≈ $167,200/unit
    label: "3-Story Active Adult", templateType: "3story-active-adult",
    dua: 25, hardCostPerUnit: 167200, constructionCostPSF: 160, siteworkPU: 20000,
    defaultMgmtPct: 2.75, defaultInsurancePU: 550,
    unitMix: [
      { type: "1BR / 1BA", pct: 0.60, avgSF: 800,  monthlyRent: 1950 },
      { type: "2BR / 2BA", pct: 0.40, avgSF: 1100, monthlyRent: 2500 },
    ],
  },
  {
    // 2-3BR Townhome — smaller units typical of entitled land deals (1,200–1,500 SF)
    label: "BTR Townhome (2-3BR Mix)", templateType: "btr",
    dua: 10, hardCostPerUnit: 230000, constructionCostPSF: null, siteworkPU: 50000,
    defaultMgmtPct: 3.00, defaultInsurancePU: 750,
    unitMix: [
      { type: "2BR / 2BA",   pct: 0.60, avgSF: 1290, monthlyRent: 1850 },
      { type: "3BR / 2.5BA", pct: 0.40, avgSF: 1495, monthlyRent: 2200 },
    ],
  },
  {
    // NEW (v15): Coastal 3-Story Walk-Up — verified against Water Tower Road, N. Myrtle Beach SC (154 units)
    // Construction: $204,260/unit (43% premium over non-coastal $144k) — coastal codes, pilings, wind rating
    // Sitework: $50,000/unit (vs $20k non-coastal) — coastal infrastructure premium
    // Total hard: $254,260/unit. Insurance: $750/unit (coastal carrier premium vs $550 inland).
    // Mgmt: 2.75% (same as conventional). SC RE tax: $2,162/unit ($1,971 base + ~$191 SC adj).
    label: "3-Story Walk-Up (Coastal)", templateType: "3story-conventional",
    dua: 25, hardCostPerUnit: 254000, constructionCostPSF: null, siteworkPU: 50000,
    defaultMgmtPct: 2.75, defaultInsurancePU: 750,
    unitMix: [
      { type: "1BR / 1BA", pct: 0.60, avgSF: 800,  monthlyRent: 2000 },
      { type: "2BR / 2BA", pct: 0.40, avgSF: 1050, monthlyRent: 2700 },
    ],
  },
];

// ─── Dashboard product-type → PRESET index mapping ────────────────────────────
// Keys match what the analyst dashboard stores on deal.productTypes[]
const DASHBOARD_KEY_TO_PRESET_IDX: Record<string, number> = {
  '3-story-surface-park':  0,
  '3-story-attainable':    1,
  '4-story-surface-park':  2,
  'aa-4-story-flats':      3,  // 4-Story Active Adult (DUA=35)
  'aa-3-story-flats':      8,  // 3-Story Active Adult (DUA=25) — separate preset/template
  'aa-cottages':           7,  // AA Cottages Detached
  'btr-3-story-th':        5,
  'btr-sfr-detached':      6,
  'btr-th-2-3br':          9,
  'coastal-3-story':       10, // Coastal 3-Story Walk-Up (Water Tower, N. Myrtle Beach SC)
};

// Assumed land cost per unit when no asking price is provided (matches dashboard assumptions)
const ASSUMED_LAND_COST_PU: Record<string, number> = {
  '3-story-surface-park': 25000,
  '3-story-attainable':   10000,
  '4-story-surface-park': 30000,
  'aa-3-story-flats':     30000,
  'aa-4-story-flats':     30000,
  'aa-cottages':          30000,
  'btr-3-story-th':       50000,
  'btr-sfr-detached':     50000,
  'btr-th-2-3br':         50000,
  'coastal-3-story':      35000, // coastal land premium over inland 3-story ($25k)
};

// Land cost per unit by PRESET index (keeps the underwriter consistent with dashboard assumptions)
const LAND_COST_PU_BY_PRESET: number[] = [
  25000, // 0:  3-Story Walk-Up Conventional
  10000, // 1:  3-Story Walk-Up Attainable
  30000, // 2:  4-Story Surface-Parked Conventional
  30000, // 3:  4-Story Active Adult
  30000, // 4:  4-Story Wrap (Deck Parking)
  50000, // 5:  BTR Townhome (3-Story, 3-4BR)
  50000, // 6:  BTR SFR Detached
  30000, // 7:  AA Cottages Detached
  30000, // 8:  3-Story Active Adult
  50000, // 9:  BTR Townhome (2-3BR Mix)
  35000, // 10: Coastal 3-Story Walk-Up (Water Tower Road SC — coastal land premium)
];

// ─── Phase state ──────────────────────────────────────────────────────────────
interface Phase {
  id: string;
  label: string;
  presetIdx: number;
  acreage: string;
  dua: string;
  hardCostPU: string;
  softCostPct: string;
  mix: UnitMixRow[];
}

const PHASE_COLORS = [
  { border: "border-blue-300",   header: "bg-blue-50",    badge: "bg-blue-100 text-blue-800",    accent: "text-blue-700"    },
  { border: "border-emerald-300",header: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-800",accent: "text-emerald-700"},
  { border: "border-violet-300", header: "bg-violet-50",  badge: "bg-violet-100 text-violet-800", accent: "text-violet-700" },
  { border: "border-amber-300",  header: "bg-amber-50",   badge: "bg-amber-100 text-amber-800",   accent: "text-amber-700"  },
];

function makePhase(presetIdx = 0, acreage = "5", label = ""): Phase {
  const p = PRESETS[presetIdx];
  return {
    id: Math.random().toString(36).slice(2),
    label: label || `Phase ${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
    presetIdx,
    acreage,
    dua: String(p.dua),
    hardCostPU: String(p.hardCostPerUnit),
    softCostPct: "15",
    mix: p.unitMix.map(r => ({ ...r })),
  };
}

// ─── Shared assumptions ───────────────────────────────────────────────────────
interface SharedInputs {
  landCost: string;
  vacancyPct: string; ltlPct: string; concessionPct: string;
  mgmtPct: string; reTaxesPU: string; insurancePU: string; utilitiesPU: string;
  contractsPU: string; makeReadyPU: string; rmPU: string; marketingPU: string;
  payrollPU: string; officePU: string; gaPU: string;
  otherGeneralPUM: string; cableInternetPUM: string; valetTrashPUM: string;
  pestControlPUM: string; waterSewerPUM: string; storagePUM: string;
  exitCapRate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function n(v: string | number) { return parseFloat(String(v)) || 0; }
function fmt(v: number, d = 0) { return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtD(v: number) { return "$" + fmt(v); }
function fmtPct(v: number, d = 2) { return fmt(v, d) + "%"; }

function calcPhase(phase: Phase, shared: SharedInputs) {
  const totalUnits = Math.round(n(phase.acreage) * n(phase.dua));
  const pctSum = phase.mix.reduce((sum, r) => sum + r.pct, 0);
  const wtdRent = pctSum > 0 ? phase.mix.reduce((sum, r) => sum + r.pct * r.monthlyRent, 0) / pctSum : 0;
  const wtdSF   = pctSum > 0 ? phase.mix.reduce((sum, r) => sum + r.pct * r.avgSF, 0) / pctSum : 0;

  const gpr = totalUnits * wtdRent * 12;
  const otherIncPUM = n(shared.otherGeneralPUM) + n(shared.cableInternetPUM) + n(shared.valetTrashPUM) + n(shared.pestControlPUM) + n(shared.waterSewerPUM) + n(shared.storagePUM);
  const otherIncome = totalUnits * 12 * otherIncPUM;
  const totalGross = gpr + otherIncome;
  const vacancyLoss    = totalGross * (n(shared.vacancyPct) / 100);
  const ltlLoss        = gpr * (n(shared.ltlPct) / 100);
  const concessionLoss = gpr * (n(shared.concessionPct) / 100);
  const badDebt        = gpr * 0.005;
  const totalLoss      = vacancyLoss + ltlLoss + concessionLoss + badDebt;
  const egi = totalGross - totalLoss;

  const mgmtFee   = egi * (n(shared.mgmtPct) / 100);
  const reTaxes   = totalUnits * n(shared.reTaxesPU);
  const insurance = totalUnits * n(shared.insurancePU);
  const utilities = totalUnits * n(shared.utilitiesPU);
  const contracts = totalUnits * n(shared.contractsPU);
  const makeReady = totalUnits * n(shared.makeReadyPU);
  const rm        = totalUnits * n(shared.rmPU);
  const marketing = totalUnits * n(shared.marketingPU);
  const payroll   = totalUnits * n(shared.payrollPU);
  const office    = totalUnits * n(shared.officePU);
  const ga        = totalUnits * n(shared.gaPU);
  const totalOpEx = mgmtFee + reTaxes + insurance + utilities + contracts + makeReady + rm + marketing + payroll + office + ga;
  const noi       = egi - totalOpEx;
  const noiMargin = egi > 0 ? (noi / egi) * 100 : 0;

  const hardCosts = totalUnits * n(phase.hardCostPU);
  const softCosts = hardCosts * (n(phase.softCostPct) / 100);
  const constructionCosts = hardCosts + softCosts;

  return { totalUnits, wtdRent, wtdSF, gpr, otherIncome, egi, noi, noiMargin, hardCosts, softCosts, constructionCosts, totalOpEx };
}

function yieldColor(yoc: number) {
  if (yoc >= 7.5) return "text-green-600";
  if (yoc >= 6.5) return "text-emerald-500";
  if (yoc >= 5.5) return "text-yellow-600";
  return "text-red-500";
}
function yieldBadge(yoc: number) {
  if (yoc >= 7.5) return { label: "Strong",           cls: "bg-green-100 text-green-800"    };
  if (yoc >= 6.5) return { label: "Good",             cls: "bg-emerald-100 text-emerald-800"};
  if (yoc >= 5.5) return { label: "Fair",             cls: "bg-yellow-100 text-yellow-800"  };
  return           { label: "Below Threshold",        cls: "bg-red-100 text-red-800"        };
}

function NumInput({ label, value, onChange, prefix, suffix, step = "1", note }: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; step?: string; note?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-600">{label}</Label>
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-2.5 text-gray-400 text-xs z-10">{prefix}</span>}
        <Input type="number" step={step} min="0" value={value}
          onChange={e => onChange(e.target.value)}
          className={`text-sm h-8 ${prefix ? "pl-6" : ""} ${suffix ? "pr-10" : ""}`} />
        {suffix && <span className="absolute right-2 text-gray-400 text-xs whitespace-nowrap">{suffix}</span>}
      </div>
      {note && <p className="text-xs text-gray-400">{note}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UnderwritingPage() {
  const searchString = useSearch();
  const urlDealId = new URLSearchParams(searchString).get("dealId") || "";
  const [selectedDealId, setSelectedDealId] = useState(urlDealId);
  const [phases, setPhases] = useState<Phase[]>([
    makePhase(0, "5", "Phase A"),
    makePhase(5, "5", "Phase B"),
  ]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showOpex, setShowOpex] = useState(false);
  const [totalSiteAcres, setTotalSiteAcres] = useState("10");
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only auto-save after applyDeal has run for the current deal (prevents defaults from being persisted)
  const uwAppliedRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const [shared, setShared] = useState<SharedInputs>({
    landCost: "6250000",
    vacancyPct: "5.00", ltlPct: "2.00", concessionPct: "1.00",
    mgmtPct: "2.75", reTaxesPU: "1971", insurancePU: "550", utilitiesPU: "538",
    contractsPU: "780", makeReadyPU: "250", rmPU: "250", marketingPU: "350",
    payrollPU: "1612", officePU: "200", gaPU: "150",
    otherGeneralPUM: "65", cableInternetPUM: "70", valetTrashPUM: "25",
    pestControlPUM: "5", waterSewerPUM: "30", storagePUM: "7",
    exitCapRate: "5.25",
  });

  const setS = (key: keyof SharedInputs) => (v: string) =>
    setShared(prev => ({ ...prev, [key]: v }));

  const { data: dealsData } = useQuery<{ deals: any[] }>({
    queryKey: ["/api/deals"],
    queryFn: async () => {
      const res = await fetch("/api/deals?limit=200&offset=0");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const deals = dealsData?.deals || [];
  const selectedDeal = deals.find((d: any) => d.id === selectedDealId);

  // Auto-apply deal data when navigated from dashboard with ?dealId=
  useEffect(() => {
    if (urlDealId && selectedDeal) {
      applyDeal(selectedDeal);
    }
  // Only run once when the deal loads for the first time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDealId, selectedDeal?.id]);

  // Extract avg rent PSF from HelloData comparables stored on the deal (same logic as dashboard)
  function extractDealRentPSF(comparablesJson: any[]): number | null {
    if (!Array.isArray(comparablesJson) || comparablesJson.length === 0) return null;
    const qualifying = comparablesJson.filter(c => c.isQualifying && (c.rentPSF > 0 || c.avgRent > 0));
    const source = qualifying.length > 0 ? qualifying : comparablesJson.filter(c => c.rentPSF > 0 || c.avgRent > 0);
    if (source.length === 0) return null;
    const psfs = source.map(c => {
      if (c.rentPSF && c.rentPSF > 0) return c.rentPSF;
      if (c.avgRent && c.avgSF && c.avgSF > 0) return c.avgRent / c.avgSF;
      return null;
    }).filter((v): v is number => v !== null && v > 0);
    if (psfs.length === 0) return null;
    return psfs.reduce((sum, v) => sum + v, 0) / psfs.length;
  }

  function applyDeal(deal: any) {
    const asking = parseFloat(String(deal.askingPrice || 0));
    const sizeAcres = parseFloat(String(deal.sizeAcres || deal.acreage || 0));
    const dealUnitCount = parseFloat(String(deal.unitCount || 0));
    const productTypes: string[] = Array.isArray(deal.productTypes) ? deal.productTypes : [];

    // Filter to types that have a known preset mapping
    const mappedTypes = productTypes.filter(t => DASHBOARD_KEY_TO_PRESET_IDX[t] !== undefined);
    const numTypes = Math.max(1, Math.min(mappedTypes.length, 4)); // cap at 4 phases

    // ── Restore saved underwriting state — only if presets match current product types ──
    // This prevents stale/default state (e.g. Conventional + BTR TH) from being restored
    // when the deal is tagged with a completely different product type.
    if (deal.underwritingState) {
      try {
        const saved = JSON.parse(deal.underwritingState);
        if (saved.phases && Array.isArray(saved.phases) && saved.phases.length > 0 && saved.shared) {
          const expectedPresets = mappedTypes.slice(0, 4).map(t => DASHBOARD_KEY_TO_PRESET_IDX[t]);
          const savedPresets: number[] = saved.phases.map((p: any) => p.presetIdx);
          // Restore only if: (a) no product types → any saved state is fine,
          //                  (b) OR saved presets exactly match the deal's tagged product types
          const presetsMatch = expectedPresets.length === 0 ||
            (expectedPresets.length === savedPresets.length &&
             expectedPresets.every((pi, i) => pi === savedPresets[i]));
          if (presetsMatch) {
            setPhases(saved.phases);
            setShared(saved.shared);
            if (saved.totalSiteAcres) setTotalSiteAcres(saved.totalSiteAcres);
            uwAppliedRef.current = deal.id;
            return;
          }
          // Preset mismatch → fall through and recompute from current product types
        }
      } catch {
        // Corrupt JSON — fall through to fresh computation
      }
    }

    // ── Build phases ────────────────────────────────────────────────────────
    let newPhases: Phase[];
    if (mappedTypes.length > 0) {
      newPhases = mappedTypes.slice(0, 4).map((t, i) => {
        const presetIdx = DASHBOARD_KEY_TO_PRESET_IDX[t];
        const preset = PRESETS[presetIdx];
        const phaseLabel = String.fromCharCode(65 + i); // A, B, C, D

        // Determine acreage: prefer sizeAcres / numTypes, fall back to unitCount/numTypes/dua
        let phaseAcreage: number;
        if (sizeAcres > 0) {
          phaseAcreage = sizeAcres / numTypes;
        } else if (dealUnitCount > 0) {
          phaseAcreage = (dealUnitCount / numTypes) / preset.dua;
        } else {
          phaseAcreage = 5; // default
        }

        return makePhase(presetIdx, String(Math.round(phaseAcreage * 10) / 10), `Phase ${phaseLabel}`);
      });
    } else {
      // No product types set — update acreage on existing phases, keep their presets
      if (sizeAcres > 0) {
        const share = sizeAcres / phases.length;
        newPhases = phases.map(p => ({ ...p, acreage: String(Math.round(share * 10) / 10) }));
      } else {
        newPhases = phases;
      }
    }

    // ── Land cost ───────────────────────────────────────────────────────────
    let landCost = 0;
    if (asking > 0) {
      landCost = asking;
    } else if (mappedTypes.length > 0 && (sizeAcres > 0 || dealUnitCount > 0)) {
      // Sum assumed land cost across all phases: phaseUnits × assumedLandCostPU
      landCost = mappedTypes.slice(0, 4).reduce((sum, t) => {
        const presetIdx = DASHBOARD_KEY_TO_PRESET_IDX[t];
        const preset = PRESETS[presetIdx];
        let phaseAcreage: number;
        if (sizeAcres > 0) {
          phaseAcreage = sizeAcres / numTypes;
        } else {
          phaseAcreage = (dealUnitCount / numTypes) / preset.dua;
        }
        const phaseUnits = Math.round(phaseAcreage * preset.dua);
        return sum + phaseUnits * (ASSUMED_LAND_COST_PU[t] ?? 30000);
      }, 0);
    }

    // ── Scale rents from HelloData comparables ──────────────────────────────
    // BTR types (SFR Detached = idx 6, Townhome 3-4BR = idx 5, Townhome 2-3BR = idx 9) use preset
    // rents — HelloData fetches multifamily apartment comps whose $/SF doesn't scale to BTR homes.
    const BTR_PRESET_INDICES = new Set([5, 6, 9]);
    const comparablesJson = Array.isArray(deal.comparablesJson) ? deal.comparablesJson : [];
    const hellodataRentPSF = extractDealRentPSF(comparablesJson);
    if (hellodataRentPSF && hellodataRentPSF > 0) {
      newPhases = newPhases.map(phase => {
        if (BTR_PRESET_INDICES.has(phase.presetIdx)) return phase; // BTR: keep preset rents
        return {
          ...phase,
          mix: phase.mix.map(r => ({
            ...r,
            monthlyRent: Math.round(hellodataRentPSF * r.avgSF),
          })),
        };
      });
    }

    // ── Apply to state ──────────────────────────────────────────────────────
    setPhases(newPhases);
    if (sizeAcres > 0) setTotalSiteAcres(String(sizeAcres));
    if (landCost > 0) setShared(p => ({ ...p, landCost: String(Math.round(landCost)) }));
    uwAppliedRef.current = deal.id; // Mark as applied — auto-save may now proceed
  }

  function addPhase() {
    const label = String.fromCharCode(65 + phases.length);
    setPhases(prev => [...prev, makePhase(0, "5", `Phase ${label}`)]);
  }
  function removePhase(id: string) {
    setPhases(prev => prev.filter(p => p.id !== id));
  }
  function updatePhase(id: string, updates: Partial<Phase>) {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }

  // When one phase's acreage is edited, distribute the remaining site to other phases.
  // With 2 phases: Phase B = totalSite - Phase A. With 3+: remainder splits equally.
  function updatePhaseAcreage(editedId: string, newAcreage: string) {
    const editedAc = parseFloat(newAcreage) || 0;
    const totalAc  = parseFloat(totalSiteAcres) || 0;
    if (totalAc <= 0 || phases.length <= 1) {
      updatePhase(editedId, { acreage: newAcreage });
      return;
    }
    const remaining = Math.max(0, totalAc - editedAc);
    const otherIds  = phases.filter(p => p.id !== editedId);
    const perOther  = otherIds.length > 0 ? remaining / otherIds.length : 0;
    setPhases(prev => prev.map(p => {
      if (p.id === editedId) return { ...p, acreage: newAcreage };
      return { ...p, acreage: String(Math.round(perOther * 10) / 10) };
    }));
  }

  function applyPreset(id: string, presetIdx: number) {
    const p = PRESETS[presetIdx];
    updatePhase(id, { presetIdx, dua: String(p.dua), hardCostPU: String(p.hardCostPerUnit), softCostPct: "15", mix: p.unitMix.map(r => ({ ...r })) });

    // ── Apply preset-specific opex defaults (verified against 7 Catalyst Excel models) ──
    // mgmtPct: 2.75% conventional/AA/coastal (Lenox Village, Hiro) | 3.00% BTR/SFR (Starwood)
    // insurancePU: $550 conventional/AA | $750 BTR/SFR/coastal (Starwood & Water Tower)
    // BTR other income: valetTrash $30 (+$5), waterSewer $35 (+$5), storage $10 (+$3) vs conventional
    const isBTR = ["btr", "sfr"].includes(p.templateType);
    setShared(prev => ({
      ...prev,
      mgmtPct:      String(p.defaultMgmtPct),
      insurancePU:  String(p.defaultInsurancePU),
      // BTR other income premiums: landscaping folded into waterSewer, higher valet & storage
      valetTrashPUM: isBTR ? "30" : "25",
      waterSewerPUM: isBTR ? "35" : "30",
      storagePUM:    isBTR ? "10" : "7",
    }));

    // Recompute land cost: use preset $/unit assumptions across all phases
    // (apply the new preset for the changed phase, keep current values for others)
    const newPhases = phases.map(ph =>
      ph.id === id ? { ...ph, presetIdx, dua: String(p.dua) } : ph
    );
    const suggested = newPhases.reduce((sum, ph) => {
      const units = Math.round(n(ph.acreage) * n(ph.dua));
      return sum + units * (LAND_COST_PU_BY_PRESET[ph.presetIdx] ?? 30000);
    }, 0);
    if (suggested > 0) setShared(prev => ({ ...prev, landCost: String(Math.round(suggested)) }));
  }
  function updateMix(id: string, i: number, field: keyof UnitMixRow, val: string) {
    setPhases(prev => prev.map(phase => {
      if (phase.id !== id) return phase;
      const mix = phase.mix.map((r, idx) => {
        if (idx !== i) return r;
        if (field === "type") return { ...r, type: val };
        return { ...r, [field]: parseFloat(val) || 0 };
      });
      return { ...phase, mix };
    }));
  }

  function addMixRow(id: string) {
    setPhases(prev => prev.map(phase => {
      if (phase.id !== id) return phase;
      return { ...phase, mix: [...phase.mix, { type: "New Type", pct: 0, avgSF: 1000, monthlyRent: 1500 }] };
    }));
  }

  function removeMixRow(id: string, i: number) {
    setPhases(prev => prev.map(phase => {
      if (phase.id !== id) return phase;
      if (phase.mix.length <= 1) return phase; // keep at least one row
      return { ...phase, mix: phase.mix.filter((_, idx) => idx !== i) };
    }));
  }

  // Per-phase calculations
  const phaseResults = useMemo(() =>
    phases.map(p => ({ id: p.id, ...calcPhase(p, shared) })),
    [phases, shared]
  );

  // Combined deal totals
  const combined = useMemo(() => {
    const totalUnits    = phaseResults.reduce((s, r) => s + r.totalUnits, 0);
    const totalNOI      = phaseResults.reduce((s, r) => s + r.noi, 0);
    const totalConstruction = phaseResults.reduce((s, r) => s + r.constructionCosts, 0);
    const land          = n(shared.landCost);
    const totalTDC      = land + totalConstruction;
    const yoc           = totalTDC > 0 ? (totalNOI / totalTDC) * 100 : 0;
    const exitCap       = n(shared.exitCapRate) / 100;
    const exitValue     = exitCap > 0 ? totalNOI / exitCap : 0;
    const tdcPPU        = totalUnits > 0 ? totalTDC / totalUnits : 0;
    const noiPPU        = totalUnits > 0 ? totalNOI / totalUnits : 0;
    const totalAcreage  = phases.reduce((s, p) => s + n(p.acreage), 0);
    const totalEGI      = phaseResults.reduce((s, r) => s + r.egi, 0);
    const noiMargin     = totalEGI > 0 ? (totalNOI / totalEGI) * 100 : 0;
    const blendedRent   = totalUnits > 0
      ? phaseResults.reduce((s, r) => s + r.wtdRent * r.totalUnits, 0) / totalUnits
      : 0;
    return { totalUnits, totalNOI, totalConstruction, land, totalTDC, yoc, exitValue, tdcPPU, noiPPU, totalAcreage, totalEGI, noiMargin, blendedRent };
  }, [phaseResults, shared]);

  const badge = yieldBadge(combined.yoc);

  // Suggested land cost = sum of (units × model $/unit) for each phase
  const suggestedLandCost = useMemo(() =>
    phases.reduce((sum, ph) => {
      const units = Math.round(n(ph.acreage) * n(ph.dua));
      return sum + units * (LAND_COST_PU_BY_PRESET[ph.presetIdx] ?? 30000);
    }, 0),
  [phases]);

  // Serialized key: fires whenever any phase or shared assumption changes
  const uwStateStr = useMemo(
    () => JSON.stringify({ phases, shared, totalSiteAcres }),
    [phases, shared, totalSiteAcres]
  );

  // ─── Auto-save: any change to phases / shared assumptions → persist to deal ─
  const saveDealMutation = useMutation({
    mutationFn: async (data: { dealId: string; automatedYoc: string; underwritingState: string }) => {
      const res = await fetch(`/api/deals/${data.dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automatedYoc: data.automatedYoc, underwritingState: data.underwritingState }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setTimeout(() => setSaveStatus("idle"), 2500);
    },
    onError: () => {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  useEffect(() => {
    // Only save after applyDeal has been called for this deal.
    // This prevents default phases (Conventional + BTR TH) from being
    // persisted before the deal's actual product types are applied.
    if (!selectedDealId || uwAppliedRef.current !== selectedDealId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");

    saveTimerRef.current = setTimeout(() => {
      // YOC display string for the dashboard Auto YOC column
      const yocStr = combined.yoc > 0
        ? (phases.length === 1
            ? `${PRESETS[phases[0].presetIdx].label}: ${combined.yoc.toFixed(1)}%`
            : phases.map((p, i) => {
                const res = phaseResults[i];
                const phaseLand = combined.totalAcreage > 0
                  ? n(shared.landCost) * (n(p.acreage) / combined.totalAcreage)
                  : 0;
                const phaseTDC = phaseLand + res.constructionCosts;
                const phaseYOC = phaseTDC > 0 ? (res.noi / phaseTDC) * 100 : 0;
                return `${String.fromCharCode(65 + i)}(${PRESETS[p.presetIdx].label}): ${phaseYOC.toFixed(1)}%`;
              }).join(" | "))
        : "";

      saveDealMutation.mutate({
        dealId: selectedDealId,
        automatedYoc: yocStr,
        underwritingState: uwStateStr,
      });
    }, 1500);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uwStateStr, selectedDealId]);
  // ─────────────────────────────────────────────────────────────────────────

  async function downloadExcel(phase: Phase) {
    const res = phaseResults.find(r => r.id === phase.id);
    if (!res) return;
    setDownloading(phase.id);
    try {
      const preset = PRESETS[phase.presetIdx];
      const body = {
        templateType: preset.templateType,
        propertyName: selectedDeal?.address || "Deal",
        address: selectedDeal?.address || "",
        cityState: selectedDeal?.city && selectedDeal?.state ? `${selectedDeal.city}, ${selectedDeal.state}` : "",
        zip: selectedDeal?.zipCode || "",
        market: selectedDeal?.market || selectedDeal?.city || "",
        county: selectedDeal?.county || "",
        totalUnits: res.totalUnits,
        unitMix: phase.mix.map(r => ({ pct: r.pct, avgSF: r.avgSF, monthlyRent: r.monthlyRent })),
        landCost: n(shared.landCost) * (n(phase.acreage) / (combined.totalAcreage || 1)),
        // Pass construction cost inputs so the backend can write the correct template cells
        constructionCostPSF: preset.constructionCostPSF,
        siteworkPU: preset.siteworkPU,
      };
      const response = await fetch("/api/underwriting/generate-excel", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(selectedDeal?.address || "Deal").replace(/[^a-zA-Z0-9]/g, "_")}_${phase.label}_${preset.label.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to generate Excel file.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/analyst-dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-600 h-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Button>
        </Link>
        <div className="h-4 w-px bg-gray-200" />
        <Calculator className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-bold text-gray-900">Deal Underwriter</span>
        <Badge className="text-xs bg-blue-100 text-blue-700 border-0">Mixed-Use</Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">{phases.length} phase{phases.length !== 1 ? "s" : ""}</span>
          <Button size="sm" className="h-8 gap-1.5" onClick={addPhase} disabled={phases.length >= 4}>
            <Plus className="h-3.5 w-3.5" /> Add Phase
          </Button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-5 space-y-5">

        {/* Deal selector */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1">
                <Label className="text-xs text-gray-500 mb-1.5 block">Load deal data (optional)</Label>
                <Select value={selectedDealId} onValueChange={setSelectedDealId}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select a deal…" /></SelectTrigger>
                  <SelectContent>
                    {deals.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        #{d.dealNumber} — {d.address}{d.city ? `, ${d.city}` : ""}{d.state ? `, ${d.state}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedDeal && (
                <div className="flex items-center gap-2 shrink-0">
                  {saveStatus === 'saving' && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Check className="h-3 w-3" /> Saved
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-xs text-red-500">Save failed</span>
                  )}
                  <Button size="sm" className="h-8 gap-1.5" onClick={() => applyDeal(selectedDeal)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Apply Deal Data
                  </Button>
                </div>
              )}
            </div>
            {selectedDeal && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500 bg-gray-50 rounded p-2">
                {selectedDeal.sizeAcres && parseFloat(String(selectedDeal.sizeAcres)) > 0 &&
                  <span>Acreage: <strong>{parseFloat(String(selectedDeal.sizeAcres)).toFixed(1)} ac</strong></span>}
                {selectedDeal.unitCount && parseFloat(String(selectedDeal.unitCount)) > 0 &&
                  <span>Unit Count: <strong>{selectedDeal.unitCount} units</strong></span>}
                {selectedDeal.askingPrice && parseFloat(String(selectedDeal.askingPrice)) > 0 &&
                  <span>Asking Price: <strong>{fmtD(parseFloat(String(selectedDeal.askingPrice)))}</strong></span>}
                {(!selectedDeal.askingPrice || parseFloat(String(selectedDeal.askingPrice)) === 0) &&
                  Array.isArray(selectedDeal.productTypes) && selectedDeal.productTypes.length > 0 &&
                  <span className="text-amber-600">Land Cost: <strong>estimated (no asking price)</strong></span>}
                {Array.isArray(selectedDeal.productTypes) && selectedDeal.productTypes.length > 0 &&
                  <span>Product Types: <strong>{(selectedDeal.productTypes as string[]).join(', ')}</strong></span>}
                {selectedDeal.avgRentPSF && parseFloat(String(selectedDeal.avgRentPSF)) > 0 &&
                  <span>HelloData Rent PSF: <strong>${parseFloat(String(selectedDeal.avgRentPSF)).toFixed(2)}/SF</strong></span>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Blended YOC hero ── */}
        <Card className="border-2 border-gray-200">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {/* Big number */}
              <div className="text-center md:text-left md:border-r md:pr-8">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Blended Yield on Cost</div>
                <div className={`text-6xl font-black leading-none ${yieldColor(combined.yoc)}`}>
                  {fmtPct(combined.yoc)}
                </div>
                <div className="mt-2">
                  <Badge className={`text-xs border-0 ${badge.cls}`}>{badge.label}</Badge>
                </div>
              </div>

              {/* Key metrics grid */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {[
                  { label: "Total Units",     val: fmt(combined.totalUnits) },
                  { label: "Total Site",      val: fmt(combined.totalAcreage, 1) + " ac" },
                  { label: "Blended NOI",     val: fmtD(combined.totalNOI) },
                  { label: "Total Dev Cost",  val: fmtD(combined.totalTDC) },
                  { label: "Land Cost",       val: fmtD(combined.land) },
                  { label: "Construction",    val: fmtD(combined.totalConstruction) },
                  { label: "TDC / Unit",      val: fmtD(combined.tdcPPU) },
                  { label: `Exit Value (${shared.exitCapRate}%)`, val: fmtD(combined.exitValue) },
                ].map(m => (
                  <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm font-semibold text-gray-800">{m.val}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Shared site inputs ── */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <button className="flex items-center justify-between w-full" onClick={() => setShowOpex(!showOpex)}>
              <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                <Info className="h-3.5 w-3.5" /> Shared Deal Assumptions
                <span className="text-gray-400 font-normal normal-case">— land cost, losses, OpEx apply to all phases</span>
              </CardTitle>
              {showOpex ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <NumInput
                label="Total Site (ac)"
                value={totalSiteAcres}
                onChange={v => {
                  setTotalSiteAcres(v);
                  // Re-distribute all phases equally when total site changes
                  const totalAc = parseFloat(v) || 0;
                  if (totalAc > 0 && phases.length > 0) {
                    const share = Math.round((totalAc / phases.length) * 10) / 10;
                    setPhases(prev => prev.map(p => ({ ...p, acreage: String(share) })));
                  }
                }}
                step="0.5"
                note={`${phases.length} phase${phases.length !== 1 ? 's' : ''} · ${combined.totalAcreage.toFixed(1)} ac used`}
              />
              <NumInput
                label="Total Land / Asking Price"
                value={shared.landCost}
                onChange={setS("landCost")}
                prefix="$"
                step="50000"
                note={combined.totalUnits > 0 ? (() => {
                  const actualPU  = Math.round(combined.land / combined.totalUnits);
                  const suggestPU = combined.totalUnits > 0 ? Math.round(suggestedLandCost / combined.totalUnits) : 0;
                  const showHint  = suggestedLandCost > 0 && Math.abs(combined.land - suggestedLandCost) > 10000;
                  return showHint
                    ? `${fmtD(actualPU)}/unit · model suggests ${fmtD(suggestPU)}/unit`
                    : `${fmtD(actualPU)}/unit`;
                })() : undefined}
              />
              <NumInput label="Exit Cap Rate" value={shared.exitCapRate} onChange={setS("exitCapRate")} suffix="%" step="0.25" />
              <NumInput label="Vacancy" value={shared.vacancyPct} onChange={setS("vacancyPct")} suffix="%" step="0.25" />
              <NumInput label="LTL" value={shared.ltlPct} onChange={setS("ltlPct")} suffix="%" step="0.25" />
              <NumInput label="Concessions" value={shared.concessionPct} onChange={setS("concessionPct")} suffix="%" step="0.25" />
            </div>

            {showOpex && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Other Income ($/unit/mo)</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <NumInput label="General"     value={shared.otherGeneralPUM}  onChange={setS("otherGeneralPUM")}  prefix="$" step="5" />
                    <NumInput label="Cable/WiFi"  value={shared.cableInternetPUM} onChange={setS("cableInternetPUM")} prefix="$" step="5" />
                    <NumInput label="Valet Trash" value={shared.valetTrashPUM}    onChange={setS("valetTrashPUM")}    prefix="$" step="5" />
                    <NumInput label="Pest Ctrl"   value={shared.pestControlPUM}   onChange={setS("pestControlPUM")}   prefix="$" step="1" />
                    <NumInput label="Water/Sewer" value={shared.waterSewerPUM}    onChange={setS("waterSewerPUM")}    prefix="$" step="5" />
                    <NumInput label="Storage"     value={shared.storagePUM}       onChange={setS("storagePUM")}       prefix="$" step="1" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Operating Expenses</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    <NumInput label="Mgmt Fee"      value={shared.mgmtPct}      onChange={setS("mgmtPct")}      suffix="% EGI" step="0.25" />
                    <NumInput label="RE Taxes/unit" value={shared.reTaxesPU}    onChange={setS("reTaxesPU")}    prefix="$" step="100" />
                    <NumInput label="Insurance/u"   value={shared.insurancePU}  onChange={setS("insurancePU")}  prefix="$" step="25" />
                    <NumInput label="Utilities/u"   value={shared.utilitiesPU}  onChange={setS("utilitiesPU")}  prefix="$" step="25" />
                    <NumInput label="Contracts/u"   value={shared.contractsPU}  onChange={setS("contractsPU")}  prefix="$" step="25" />
                    <NumInput label="Make-Ready/u"  value={shared.makeReadyPU}  onChange={setS("makeReadyPU")}  prefix="$" step="25" />
                    <NumInput label="R&M/u"         value={shared.rmPU}         onChange={setS("rmPU")}         prefix="$" step="25" />
                    <NumInput label="Marketing/u"   value={shared.marketingPU}  onChange={setS("marketingPU")}  prefix="$" step="25" />
                    <NumInput label="Payroll/u"     value={shared.payrollPU}    onChange={setS("payrollPU")}    prefix="$" step="50" />
                    <NumInput label="Office/u"      value={shared.officePU}     onChange={setS("officePU")}     prefix="$" step="25" />
                    <NumInput label="G&A/u"         value={shared.gaPU}         onChange={setS("gaPU")}         prefix="$" step="25" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Phase cards ── */}
        <div className={`grid gap-4 ${phases.length === 1 ? "grid-cols-1 max-w-sm" : phases.length === 2 ? "grid-cols-1 md:grid-cols-2" : phases.length === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2 xl:grid-cols-4"}`}>
          {phases.map((phase, pi) => {
            const color = PHASE_COLORS[pi % PHASE_COLORS.length];
            const res = phaseResults.find(r => r.id === phase.id);
            const phaseLandCost = combined.totalAcreage > 0
              ? n(shared.landCost) * (n(phase.acreage) / combined.totalAcreage)
              : 0;
            const phaseTDC = phaseLandCost + (res?.constructionCosts || 0);
            const phaseYOC = phaseTDC > 0 ? ((res?.noi || 0) / phaseTDC) * 100 : 0;

            return (
              <div key={phase.id} className={`border-2 ${color.border} rounded-xl overflow-hidden flex flex-col`}>
                {/* Phase header */}
                <div className={`${color.header} px-4 py-3 flex items-center gap-2`}>
                  <Badge className={`text-xs border-0 font-semibold ${color.badge}`}>{phase.label}</Badge>
                  <input
                    value={phase.label}
                    onChange={e => updatePhase(phase.id, { label: e.target.value })}
                    className="flex-1 bg-transparent text-xs font-medium text-gray-700 border-0 outline-none min-w-0"
                    placeholder="Phase name"
                  />
                  {phases.length > 1 && (
                    <button onClick={() => removePhase(phase.id)} className="text-gray-400 hover:text-red-500 ml-auto shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3 bg-white flex-1">
                  {/* Phase stats */}
                  {res && (
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-sm font-bold">{fmt(res.totalUnits)}</div>
                        <div className="text-xs text-gray-400">Units</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-sm font-bold">{fmtD(res.noi)}</div>
                        <div className="text-xs text-gray-400">Phase NOI</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className={`text-sm font-bold ${yieldColor(phaseYOC)}`}>{fmtPct(phaseYOC)}</div>
                        <div className="text-xs text-gray-400">Stand-alone</div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Acreage + DUA + Units — editing any one auto-balances the others */}
                  <div className="grid grid-cols-3 gap-2">
                    <NumInput
                      label="Acreage (ac)"
                      value={phase.acreage}
                      onChange={v => updatePhaseAcreage(phase.id, v)}
                      step="0.5"
                    />
                    <NumInput label="DUA" value={phase.dua} onChange={v => updatePhase(phase.id, { dua: v })} step="1" />
                    <NumInput
                      label="Units"
                      value={String(Math.round(n(phase.acreage) * n(phase.dua)))}
                      step="1"
                      onChange={v => {
                        const units = parseFloat(v);
                        const dua = n(phase.dua);
                        if (dua > 0 && units > 0) {
                          updatePhaseAcreage(phase.id, String(Math.round((units / dua) * 10) / 10));
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Product Type</Label>
                    <Select value={String(phase.presetIdx)} onValueChange={v => applyPreset(phase.id, parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRESETS.map((p, i) => <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="Hard Cost/Unit" value={phase.hardCostPU} onChange={v => updatePhase(phase.id, { hardCostPU: v })} prefix="$" step="5000" />
                    <NumInput label="Soft Costs" value={phase.softCostPct} onChange={v => updatePhase(phase.id, { softCostPct: v })} suffix="% hard" step="1" />
                  </div>

                  <Separator />

                  {/* Unit mix */}
                  <div>
                    <div className="grid gap-1 text-xs text-gray-400 mb-1" style={{gridTemplateColumns:"1fr 2.5rem 3rem 4rem 1.2rem"}}>
                      <span>Type</span><span className="text-center">Mix%</span><span className="text-center">SF</span><span className="text-center">Rent</span><span/>
                    </div>
                    {phase.mix.map((row, i) => (
                      <div key={i} className="grid gap-1 mb-1 items-center" style={{gridTemplateColumns:"1fr 2.5rem 3rem 4rem 1.2rem"}}>
                        <input
                          type="text"
                          value={row.type}
                          onChange={e => updateMix(phase.id, i, "type", e.target.value)}
                          className="h-7 text-xs border rounded px-1 w-full truncate"
                          placeholder="Type"
                        />
                        <input type="number" step="5" min="0" max="100" value={Math.round(row.pct * 100)}
                          onChange={e => updateMix(phase.id, i, "pct", String(parseFloat(e.target.value) / 100))}
                          className="h-7 text-xs text-center border rounded px-0.5 w-full" />
                        <input type="number" step="50" min="0" value={row.avgSF}
                          onChange={e => updateMix(phase.id, i, "avgSF", e.target.value)}
                          className="h-7 text-xs text-center border rounded px-0.5 w-full" />
                        <div className="relative flex items-center">
                          <span className="absolute left-1 text-gray-400 text-xs">$</span>
                          <input type="number" step="25" min="0" value={row.monthlyRent}
                            onChange={e => updateMix(phase.id, i, "monthlyRent", e.target.value)}
                            className="h-7 text-xs pl-3.5 border rounded w-full" />
                        </div>
                        <button
                          onClick={() => removeMixRow(phase.id, i)}
                          disabled={phase.mix.length <= 1}
                          className="text-gray-300 hover:text-red-400 disabled:opacity-20 flex items-center justify-center"
                          title="Remove row"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addMixRow(phase.id)}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1"
                    >
                      <Plus className="h-3 w-3" /> Add unit type
                    </button>
                    {res && <div className="text-xs text-gray-400 text-right mt-0.5">Avg: {fmt(res.wtdSF, 0)} SF · ${fmt(res.wtdRent, 0)}/mo</div>}
                  </div>

                  <Separator />

                  <Button className="w-full h-8 text-xs gap-1.5" variant="outline"
                    onClick={() => downloadExcel(phase)} disabled={downloading === phase.id}>
                    {downloading === phase.id
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <Download className="h-3.5 w-3.5" />}
                    Download Excel Model
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Phase breakdown table ── */}
        {phases.length > 1 && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Phase Breakdown & Combined Totals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs font-medium text-gray-500 pr-4 min-w-[140px]">Metric</th>
                      {phases.map((p, pi) => {
                        const color = PHASE_COLORS[pi % PHASE_COLORS.length];
                        return (
                          <th key={p.id} className={`text-right py-2 text-xs px-3 font-semibold ${color.accent}`}>
                            {p.label}<br />
                            <span className="font-normal text-gray-400">{PRESETS[p.presetIdx].label}</span>
                          </th>
                        );
                      })}
                      <th className="text-right py-2 text-xs px-3 font-bold text-gray-800 bg-gray-50 rounded">
                        Combined
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        { label: "Acreage",         custom: (p: Phase) => fmt(n(p.acreage), 1) + " ac",               combined: fmt(combined.totalAcreage, 1) + " ac" },
                        { label: "Units",            key: "totalUnits",         fmt: (v: number) => fmt(v),             combined: fmt(combined.totalUnits) },
                        null,
                        { label: "GPR",              key: "gpr",                fmt: fmtD,                             combined: fmtD(phaseResults.reduce((s,r)=>s+r.gpr,0)) },
                        { label: "EGI",              key: "egi",                fmt: fmtD,                             combined: fmtD(combined.totalEGI) },
                        { label: "OpEx",             key: "totalOpEx",          fmt: fmtD,                             combined: fmtD(phaseResults.reduce((s,r)=>s+r.totalOpEx,0)) },
                        { label: "Phase NOI",        key: "noi",                fmt: fmtD,  bold: true,                combined: fmtD(combined.totalNOI), boldCombined: true },
                        { label: "NOI Margin",       key: "noiMargin",          fmt: (v:number)=>fmtPct(v,1),          combined: fmtPct(combined.noiMargin, 1) },
                        null,
                        { label: "Hard Costs",       key: "hardCosts",          fmt: fmtD,                             combined: fmtD(phaseResults.reduce((s,r)=>s+r.hardCosts,0)) },
                        { label: "Soft Costs",       key: "softCosts",          fmt: fmtD,                             combined: fmtD(phaseResults.reduce((s,r)=>s+r.softCosts,0)) },
                        { label: "Land (pro-rata)",  custom: (_: Phase, pi: number) => {
                          const ac = n(phases[pi].acreage);
                          const share = combined.totalAcreage > 0 ? ac / combined.totalAcreage : 0;
                          return fmtD(Math.round(n(shared.landCost) * share));
                        },                                                                                              combined: fmtD(combined.land) },
                        { label: "Phase TDC",        custom: (_: Phase, pi: number) => {
                          const res = phaseResults[pi];
                          const ac = n(phases[pi].acreage);
                          const share = combined.totalAcreage > 0 ? ac / combined.totalAcreage : 0;
                          const landShare = n(shared.landCost) * share;
                          return fmtD(Math.round(res.constructionCosts + landShare));
                        },                                                                                              combined: fmtD(combined.totalTDC), boldCombined: true },
                        null,
                        { label: "Stand-alone YOC",  custom: (_: Phase, pi: number) => {
                          const res = phaseResults[pi];
                          const ac = n(phases[pi].acreage);
                          const share = combined.totalAcreage > 0 ? ac / combined.totalAcreage : 0;
                          const phaseTDC = res.constructionCosts + n(shared.landCost) * share;
                          const yoc = phaseTDC > 0 ? (res.noi / phaseTDC) * 100 : 0;
                          return <span className={yieldColor(yoc)}>{fmtPct(yoc)}</span>;
                        },                                                                                              combinedEl: <span className={`font-black ${yieldColor(combined.yoc)}`}>{fmtPct(combined.yoc)}</span>, boldCombined: true },
                      ] as any[]
                    ).map((row: any, ri: number) => {
                      if (!row) return <tr key={ri}><td colSpan={phases.length + 2} className="py-1" /></tr>;
                      return (
                        <tr key={ri} className="border-b last:border-0 hover:bg-gray-50/60">
                          <td className={`py-1.5 pr-4 text-xs ${row.bold ? "font-semibold text-gray-800" : "text-gray-500"}`}>{row.label}</td>
                          {phases.map((p, pi) => {
                            const res = phaseResults[pi];
                            let val: any;
                            if (row.custom) {
                              val = row.custom(p, pi);
                            } else if (row.key && res) {
                              const raw = (res as any)[row.key];
                              val = row.fmt ? row.fmt(raw) : String(raw);
                            } else {
                              val = "—";
                            }
                            return (
                              <td key={p.id} className={`py-1.5 text-right px-3 font-mono text-xs ${row.bold ? "font-semibold text-gray-700" : "text-gray-600"}`}>
                                {val}
                              </td>
                            );
                          })}
                          <td className={`py-1.5 text-right px-3 font-mono text-xs bg-gray-50 ${row.boldCombined ? "font-bold text-gray-900" : "text-gray-700"}`}>
                            {row.combinedEl ?? row.combined ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

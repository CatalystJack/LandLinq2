import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  MapPin, 
  Building2, 
  Bus, 
  AlertTriangle, 
  Droplets, 
  Mountain, 
  Factory, 
  ShoppingBag, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Calculator,
  RefreshCw,
  Home,
  DollarSign,
  TrendingUp,
  Info,
  Pencil,
  Save,
  X,
  Wand2,
  ChevronRight,
  FileDown,
  Bot,
  UserCheck,
  Construction,
  Users
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SiteEvaluation {
  id: string;
  dealId: string | null;
  address: string;
  latitude: string | null;
  longitude: string | null;
  scoreTotal: number | null;
  scoreNeighborhood: number | null;
  scoreOlmstead?: number | null;
  scorePrimaryAmenities: number | null;
  scoreSecondaryAmenities: number | null;
  scoreSiteSuitability: number | null;
  scoreTransit: number | null;
  scoreNegativePoints: number | null;
  scoreIncomeRPP: number | null;
  amenityDetails: any;
  floodZoneData: any;
  hazardsData: any;
  slopeData: any;
  transitData: any;
  incompatibleUsesData: any;
  censusData: any;
  marketInsights: any;
  evaluatedAt: Date | null;
}

interface LIHTCScoreModalProps {
  dealId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

function getScoreColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-600";
  if (score >= 50) return "bg-green-100 text-green-800 border-green-300";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
}

function getScoreLabel(score: number | null): string {
  if (score === null) return "Pending";
  if (score >= 50) return "Passes (≥50)";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
}

export function LIHTCScoreModal({ dealId, isOpen, onClose, onRefresh }: LIHTCScoreModalProps) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [autoDetectResult, setAutoDetectResult] = useState<any>(null);
  const [overrides, setOverrides] = useState({
    neighborhoodQuality: '' as string,
    countyIncomeTier: '' as string,
    units30AMI: '' as string,
    units40AMI: '' as string,
    units50AMI: '' as string,
    isRedevelopment: false,
    costPerUnit: '' as string,
    amenityOverrides: {} as Record<string, {name:string;distance:string}|null>,
    units1BR: '' as string,
    isDHHSPriorityCounty: false,
    isQDPrincipalEligible: null as boolean | null,
    isBondProject: false,
    section1602Status: 'no' as 'no' | 'unknown' | 'yes',
    isAgencyDiscretionPenalty: false,
  });

  const { data: evaluation, isLoading, isError, refetch } = useQuery<SiteEvaluation>({
    queryKey: ['/api/site-evaluations/deal', dealId],
    enabled: isOpen && !!dealId,
    retry: false,
  });

  const { data: deal } = useQuery<any>({
    queryKey: ['/api/deals', dealId],
    queryFn: () => fetch(`/api/deals/${dealId}`).then(r => r.json()),
    enabled: isOpen && !!dealId,
  });

  // Populate overrides from deal data when available
  useEffect(() => {
    if (deal) {
      const rawOverrides = deal.lihtcAmenityOverrides || {};
      const amenityFields: Record<string, {name:string;distance:string}|null> = {};
      for (const key of ['grocery','shopping','pharmacy','otherPrimary','service','healthcare','publicFacility','publicSchool','otherRetail']) {
        const v = rawOverrides[key];
        amenityFields[key] = v ? { name: v.name || '', distance: v.distance != null ? String(v.distance) : '' } : null;
      }
      setOverrides({
        neighborhoodQuality: deal.lihtcNeighborhoodQuality || '',
        countyIncomeTier: deal.lihtcCountyIncomeTier || '',
        units30AMI: deal.lihtcUnits30AMI != null ? String(deal.lihtcUnits30AMI) : '',
        units40AMI: deal.lihtcUnits40AMI != null ? String(deal.lihtcUnits40AMI) : '',
        units50AMI: deal.lihtcUnits50AMI != null ? String(deal.lihtcUnits50AMI) : '',
        isRedevelopment: !!deal.lihtcIsRedevelopment,
        costPerUnit: deal.lihtcCostPerUnit != null ? String(deal.lihtcCostPerUnit) : '',
        amenityOverrides: amenityFields,
        units1BR: deal.lihtcUnits1BR != null ? String(deal.lihtcUnits1BR) : '',
        isDHHSPriorityCounty: !!deal.lihtcDHHSPriorityCounty,
        isQDPrincipalEligible: deal.lihtcQDPrincipalEligible ?? null,
        isBondProject: !!deal.lihtcIsBondProject,
        section1602Status: ((deal as any).lihtcSection1602Status as 'no'|'unknown'|'yes'|null) || (deal.lihtcSection1602Penalty ? 'yes' : 'no'),
        isAgencyDiscretionPenalty: !!deal.lihtcAgencyDiscretionPenalty,
      });
    }
  }, [deal]);

  const handleAutoDetect = async () => {
    setIsAutoDetecting(true);
    setAutoDetectResult(null);
    try {
      const result = await fetch(`/api/deals/${dealId}/lihtc-auto-detect`, {
        credentials: 'include',
      }).then(r => r.json());
      
      if (result.error) {
        setAutoDetectResult({ error: result.error });
        return;
      }
      
      setAutoDetectResult(result);
      // Auto-apply suggestions to the form
      if (result.suggestions) {
        setOverrides(prev => ({
          ...prev,
          countyIncomeTier: result.suggestions.countyIncomeTier || prev.countyIncomeTier,
          // neighborhoodQuality is NOT auto-applied — QAP requires physical inspection, not poverty rate proxy
          units30AMI: result.suggestions.units30AMI != null ? String(result.suggestions.units30AMI) : prev.units30AMI,
          units40AMI: result.suggestions.units40AMI != null ? String(result.suggestions.units40AMI) : prev.units40AMI,
          units50AMI: result.suggestions.units50AMI != null ? String(result.suggestions.units50AMI) : prev.units50AMI,
        }));
      }
    } catch (err) {
      setAutoDetectResult({ error: 'Auto-detect failed. Check that the deal has been geocoded.' });
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleSaveAndRecalculate = async () => {
    setIsSaving(true);
    try {
      const cleanAmenityOverrides: Record<string, {name:string;distance:number}|null> = {};
      for (const [key, val] of Object.entries(overrides.amenityOverrides)) {
        if (val && val.name.trim()) {
          cleanAmenityOverrides[key] = { name: val.name.trim(), distance: parseFloat(val.distance) || 0 };
        } else {
          cleanAmenityOverrides[key] = null;
        }
      }
      await apiRequest('PATCH', `/api/deals/${dealId}/lihtc-overrides`, {
        neighborhoodQuality: overrides.neighborhoodQuality || null,
        countyIncomeTier: overrides.countyIncomeTier || null,
        units30AMI: overrides.units30AMI !== '' ? Number(overrides.units30AMI) : null,
        units40AMI: overrides.units40AMI !== '' ? Number(overrides.units40AMI) : null,
        units50AMI: overrides.units50AMI !== '' ? Number(overrides.units50AMI) : null,
        amenityOverrides: cleanAmenityOverrides,
        costPerUnit: overrides.costPerUnit !== '' ? Number(overrides.costPerUnit) : null,
        isRedevelopment: overrides.isRedevelopment,
        units1BR: overrides.units1BR !== '' ? overrides.units1BR : null,
        isDHHSPriorityCounty: overrides.isDHHSPriorityCounty,
        section1602Status: overrides.section1602Status,
        isSection1602Penalty: overrides.section1602Status === 'yes',
        isAgencyDiscretionPenalty: overrides.isAgencyDiscretionPenalty,
        isQDPrincipalEligible: overrides.isQDPrincipalEligible,
        isBondProject: overrides.isBondProject,
      });
      await apiRequest('POST', `/api/site-evaluations/score-deal/${dealId}`, { forceRefresh: true });
      await queryClient.invalidateQueries({ queryKey: ['/api/site-evaluations/deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId] });
      await refetch();
      onRefresh?.();
      setEditMode(false);
      toast({ title: "Score recalculated", description: "Overrides saved and site evaluation updated." });
    } catch (error: any) {
      console.error("Error saving overrides:", error);
      toast({ title: "Recalculation failed", description: error?.message || "Could not run site evaluation. Check server logs.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await apiRequest('POST', `/api/site-evaluations/score-deal/${dealId}`, { forceRefresh: true });
      await queryClient.invalidateQueries({ queryKey: ['/api/site-evaluations/deal', dealId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId] });
      await refetch();
      onRefresh?.();
      toast({ title: "Score refreshed", description: "Site evaluation complete — scores updated." });
    } catch (error: any) {
      console.error("Error refreshing score:", error);
      toast({ title: "Re-run failed", description: error?.message || "Could not run site evaluation. The address may be missing or geocoding failed.", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  // PDF export: professional NC QAP 2026 LIHTC score report
  const handleExportPDF = async () => {
    if (!evaluation) return;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const PAGE_W = 210;
    const PAGE_H = 297;
    const MARGIN = 14;
    const COL_W = PAGE_W - MARGIN * 2;

    // ── Palette ───────────────────────────────────────────────
    const NAVY   = [7,  23, 42]  as [number,number,number];
    const GREEN  = [22, 163, 74] as [number,number,number];
    const ORANGE = [234,88,  12] as [number,number,number];
    const RED    = [185,28,  28] as [number,number,number];
    const LTGRAY = [245,246,248] as [number,number,number];
    const MGRAY  = [229,231,235] as [number,number,number];
    const DGRAY  = [75,  85, 99] as [number,number,number];
    const WHITE  = [255,255,255] as [number,number,number];

    const score = evaluation.scoreTotal ?? 0;
    const passes = score >= 50;
    const SCORE_COLOR = passes ? GREEN : score >= 40 ? ORANGE : RED;

    // ── Helpers ───────────────────────────────────────────────
    const fillRect = (x: number, y: number, w: number, h: number, color: [number,number,number], r = 0) => {
      pdf.setFillColor(...color);
      if (r > 0) {
        pdf.roundedRect(x, y, w, h, r, r, 'F');
      } else {
        pdf.rect(x, y, w, h, 'F');
      }
    };

    const drawRect = (x: number, y: number, w: number, h: number, color: [number,number,number], lw = 0.3) => {
      pdf.setDrawColor(...color);
      pdf.setLineWidth(lw);
      pdf.rect(x, y, w, h, 'S');
    };

    const text = (str: string, x: number, y: number, opts?: { align?: 'left'|'center'|'right'; color?: [number,number,number]; size?: number; bold?: boolean }) => {
      if (opts?.color) pdf.setTextColor(...opts.color);
      if (opts?.size) pdf.setFontSize(opts.size);
      pdf.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
      pdf.text(str, x, y, { align: opts?.align || 'left' });
    };

    // ── HEADER ────────────────────────────────────────────────
    fillRect(0, 0, PAGE_W, 28, NAVY);

    // Try to load Catalyst logo
    let logoWidth = 0;
    try {
      const logoResp = await fetch('/assets/catalyst-logo.png');
      if (logoResp.ok) {
        const logoBlob = await logoResp.blob();
        const logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        const img = new Image();
        await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = logoDataUrl; });
        const lh = 9;
        logoWidth = lh * (img.naturalWidth / img.naturalHeight);
        pdf.addImage(logoDataUrl, 'PNG', MARGIN, 9, logoWidth, lh);
      }
    } catch { /* no logo */ }

    const titleX = MARGIN + (logoWidth > 0 ? logoWidth + 4 : 0);
    text('NC QAP 2026 — LIHTC Site Suitability Score Report', titleX, 14, { color: WHITE, size: 11, bold: true });
    text('Catalyst Capital Partners  ·  Powered by LandLinq', titleX, 20, { color: [160,170,185], size: 7.5 });
    text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), PAGE_W - MARGIN, 14, { align: 'right', color: [160,170,185], size: 8 });

    let y = 36;

    // ── PROPERTY INFO BAR ─────────────────────────────────────
    fillRect(MARGIN, y, COL_W, 18, LTGRAY, 2);
    drawRect(MARGIN, y, COL_W, 18, MGRAY);
    text(evaluation.address || '—', MARGIN + 4, y + 7, { color: NAVY, size: 10, bold: true });
    const evalDate = evaluation.evaluatedAt
      ? new Date(evaluation.evaluatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'Not evaluated';
    text(`Evaluated: ${evalDate}`, MARGIN + 4, y + 13, { color: DGRAY, size: 7.5 });
    if (deal?.lihtcCountyIncomeTier) {
      text(`County Tier: ${deal.lihtcCountyIncomeTier}`, PAGE_W - MARGIN - 4, y + 13, { align: 'right', color: DGRAY, size: 7.5 });
    }
    y += 23;

    // ── TOTAL SCORE HERO ──────────────────────────────────────
    const heroH = 26;
    fillRect(MARGIN, y, COL_W, heroH, SCORE_COLOR, 3);
    text(`${score}`, MARGIN + 28, y + heroH / 2 + 6, { color: WHITE, size: 26, bold: true, align: 'center' });
    text('/ 68 pts', MARGIN + 42, y + heroH / 2 + 6, { color: [200,240,200], size: 10 });
    const resultLabel = passes ? 'PASSES  (50+ pts required)' : 'DOES NOT PASS  (50+ pts required)';
    const resultBadge = passes ? 'PASS' : 'FAIL';
    fillRect(MARGIN + 55, y + heroH / 2 - 7, 18, 10, passes ? [21,128,61] : [153,27,27], 2);
    text(resultBadge, MARGIN + 64, y + heroH / 2 + 1, { color: WHITE, size: 8, bold: true, align: 'center' });
    text(resultLabel, MARGIN + 76, y + heroH / 2 + 1, { color: WHITE, size: 11, bold: true });
    const nearLabel = !passes && score >= 40 ? `${50 - score} pts below threshold` : '';
    if (nearLabel) text(nearLabel, MARGIN + 76, y + heroH / 2 + 8, { color: [255,220,170], size: 8 });
    y += heroH + 6;

    // ── SCORE BREAKDOWN GRID ──────────────────────────────────
    text('Score Breakdown', MARGIN, y + 5, { color: NAVY, size: 10, bold: true });
    y += 8;

    const categories = [
      { label: 'Neighborhood Quality', score: 10, max: 10 },
      { label: 'Primary Amenities',    score: evaluation.scorePrimaryAmenities ?? 0, max: 26 },
      { label: 'Secondary Amenities',  score: evaluation.scoreSecondaryAmenities ?? 0, max: 20 },
      { label: 'Transit Score',        score: evaluation.scoreTransit ?? 0, max: 6 },
      { label: 'Site Suitability',     score: evaluation.scoreSiteSuitability ?? 0, max: 12 },
      { label: 'Income / RPP',         score: evaluation.scoreIncomeRPP ?? 0, max: 2 },
      { label: 'Negative Points',      score: evaluation.scoreNegativePoints ?? 0, max: 0, isNeg: true },
    ];

    const COLS = 3;
    const cellW = COL_W / COLS - 2;
    const cellH = 22;
    const cellGap = 2.5;

    categories.forEach((cat, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = MARGIN + col * (cellW + cellGap);
      const cy = y + row * (cellH + cellGap);

      fillRect(cx, cy, cellW, cellH, LTGRAY, 2);
      drawRect(cx, cy, cellW, cellH, MGRAY, 0.2);

      // Score bar background
      const barX = cx + 4;
      const barY = cy + cellH - 5.5;
      const barW = cellW - 8;
      const barH = 2.5;
      fillRect(barX, barY, barW, barH, MGRAY, 1);

      // Score bar fill
      const pct = cat.max > 0 ? Math.max(0, Math.min(1, cat.score / cat.max)) : 0;
      const barColor: [number,number,number] = cat.isNeg
        ? (cat.score < 0 ? RED : [100,200,100])
        : pct >= 0.75 ? GREEN : pct >= 0.4 ? ORANGE : RED;
      if (barW * pct > 0) fillRect(barX, barY, barW * pct, barH, barColor, 1);

      // Category label
      text(cat.label, cx + 4, cy + 7, { color: DGRAY, size: 7, bold: false });

      // Score value
      const scoreStr = cat.isNeg
        ? (cat.score === 0 ? '0' : `${cat.score}`)
        : `${cat.score}`;
      const maxStr = cat.max > 0 ? ` / ${cat.max}` : '';
      text(scoreStr, cx + 4, cy + 15, { color: NAVY, size: 13, bold: true });
      text(maxStr + ' pts', cx + 4 + pdf.getTextWidth(scoreStr) + 1, cy + 15, { color: DGRAY, size: 8 });
    });

    y += Math.ceil(categories.length / COLS) * (cellH + cellGap) + 5;

    // ── AMENITY DETAILS TABLE ─────────────────────────────────
    const amenities = (evaluation.amenityDetails as any[]) || [];
    if (amenities.length > 0) {
      // Section header
      fillRect(MARGIN, y, COL_W, 7, NAVY, 0);
      text('Amenity Distances & Points', MARGIN + 3, y + 5, { color: WHITE, size: 8.5, bold: true });
      text('(Google Places — Driving Distance)', PAGE_W - MARGIN - 3, y + 5, { align: 'right', color: [160,170,185], size: 7 });
      y += 9;

      // Table header row
      const cols = [
        { label: 'Category', x: MARGIN + 2, w: 40 },
        { label: 'Place Found', x: MARGIN + 44, w: 90 },
        { label: 'Distance', x: MARGIN + 136, w: 26 },
        { label: 'Points', x: MARGIN + 164, w: 18 },
        { label: 'Source', x: MARGIN + 184, w: 18 },
      ];
      fillRect(MARGIN, y, COL_W, 6, MGRAY, 0);
      cols.forEach(c => text(c.label, c.x, y + 4.2, { color: DGRAY, size: 6.5, bold: true }));
      y += 6;

      const ROW_H = 6.5;
      amenities.forEach((a: any, idx: number) => {
        if (idx % 2 === 0) fillRect(MARGIN, y, COL_W, ROW_H, LTGRAY, 0);
        const placeName = (a.placeName || '—').substring(0, 42);
        const dist = a.distance != null ? `${Number(a.distance).toFixed(2)} mi` : 'N/A';
        const src = a.isManual ? 'Manual' : 'Auto';
        const ptColor: [number,number,number] = a.points > 0 ? GREEN : DGRAY;
        text(a.name || '—', cols[0].x, y + 4.2, { color: NAVY, size: 6.5 });
        text(placeName, cols[1].x, y + 4.2, { color: [50,50,50], size: 6.5 });
        text(dist, cols[2].x, y + 4.2, { color: DGRAY, size: 6.5 });
        text(`+${a.points}`, cols[3].x, y + 4.2, { color: ptColor, size: 6.5, bold: a.points > 0 });
        text(src, cols[4].x, y + 4.2, { color: DGRAY, size: 6 });
        y += ROW_H;
      });

      // Divider line under table
      pdf.setDrawColor(...MGRAY);
      pdf.setLineWidth(0.2);
      pdf.line(MARGIN, y, MARGIN + COL_W, y);
      y += 5;
    }

    // ── AMENITY MAP ───────────────────────────────────────────
    const subLat = evaluation.latitude ? parseFloat(String(evaluation.latitude)) : null;
    const subLng = evaluation.longitude ? parseFloat(String(evaluation.longitude)) : null;

    if (subLat && subLng) {
      try {
        // Build Static Maps URL via backend proxy
        const MAP_W = 550, MAP_H = 220;
        const params = new URLSearchParams({
          center: `${subLat},${subLng}`,
          zoom: '13',
          size: `${MAP_W}x${MAP_H}`,
          maptype: 'roadmap',
        });

        // Subject property: red star marker
        params.append('markers', `color:red|label:S|${subLat},${subLng}`);

        // Amenity markers: blue for primary, green for secondary
        const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let letterIdx = 0;
        const amenitiesForMap = amenities.filter((a: any) => a.placeLat && a.placeLng && a.points > 0);
        for (const a of amenitiesForMap.slice(0, 20)) {
          const color = a.category === 'primary' ? 'blue' : '0x22C55E';
          const label = LETTERS[letterIdx % 26];
          params.append('markers', `color:${color}|label:${label}|${a.placeLat},${a.placeLng}`);
          letterIdx++;
        }

        const mapUrl = `/api/public/static-map?${params.toString()}`;
        const mapResp = await fetch(mapUrl);
        if (mapResp.ok) {
          const mapBlob = await mapResp.blob();
          const mapDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(mapBlob);
          });

          if (y > PAGE_H - 90) { pdf.addPage(); y = 20; }

          // Map section header
          fillRect(MARGIN, y, COL_W, 7, NAVY, 0);
          text('Nearby Amenities Map', MARGIN + 3, y + 5, { color: WHITE, size: 8.5, bold: true });
          const legendParts = amenitiesForMap.slice(0, 20).map((a: any, i: number) => `${LETTERS[i]}: ${a.name}${a.placeName ? ` (${a.placeName})` : ''}`);
          y += 9;

          // Map image
          const mmW = COL_W;
          const mmH = mmW * (MAP_H / MAP_W);
          pdf.addImage(mapDataUrl, 'PNG', MARGIN, y, mmW, mmH);
          y += mmH + 3;

          // Legend below map — two column layout
          if (legendParts.length > 0) {
            const legCols = 2;
            const legColW = COL_W / legCols;
            const legRowH = 5;
            legendParts.forEach((leg: string, i: number) => {
              const col = i % legCols;
              const row = Math.floor(i / legCols);
              const lx = MARGIN + col * legColW;
              const ly = y + row * legRowH;
              const a = amenitiesForMap[i];
              const dotColor: [number,number,number] = a?.category === 'primary' ? [37,99,235] : [22,163,74];
              fillRect(lx, ly + 0.5, 3, 3, dotColor, 1);
              text(`${LETTERS[i]}: ${a?.name || ''} — ${a?.placeName || 'not found'}`, lx + 4.5, ly + 3, { color: DGRAY, size: 5.5 });
            });
            y += Math.ceil(legendParts.length / legCols) * legRowH + 5;
          }
        }
      } catch { /* map load failed, skip */ }
    }

    // Check page space for site conditions
    if (y > PAGE_H - 60) {
      pdf.addPage();
      y = 20;
    }

    // ── SITE CONDITIONS GRID ──────────────────────────────────
    const conditions: { title: string; ok: boolean; badge: string; detail?: string }[] = [];

    if (evaluation.floodZoneData) {
      const inFlood = evaluation.floodZoneData.isInFloodZone;
      conditions.push({
        title: 'FEMA Flood Zone',
        ok: !inFlood,
        badge: inFlood ? `In Flood Zone ${evaluation.floodZoneData.floodZone || ''}` : 'Not in Flood Zone',
        detail: evaluation.floodZoneData.floodZoneDescription,
      });
    }
    if (evaluation.hazardsData) {
      const hasH = evaluation.hazardsData.hasNearbyHazards;
      conditions.push({
        title: 'EPA Hazardous Sites',
        ok: !hasH,
        badge: hasH ? `${evaluation.hazardsData.hazardCount ?? 0} Site(s) Within 1 Mile` : 'No Hazards Within 1 Mile',
        detail: hasH && evaluation.hazardsData.nearestHazard ? `Nearest: ${evaluation.hazardsData.nearestHazard.name} (${evaluation.hazardsData.nearestHazard.distance?.toFixed(2)} mi)` : undefined,
      });
    }
    if (evaluation.slopeData) {
      const steep = evaluation.slopeData.hasSteepSlope;
      conditions.push({
        title: 'USGS Terrain Slope',
        ok: !steep,
        badge: steep ? 'Steep Slope (>15% grade)' : 'No Steep Slope',
        detail: evaluation.slopeData.maxSlope != null ? `Max slope: ${Number(evaluation.slopeData.maxSlope).toFixed(1)}%` : undefined,
      });
    }
    if (evaluation.transitData) {
      const hasT = evaluation.transitData.hasNearbyTransit;
      const dist = evaluation.transitData.nearestStopDistance;
      conditions.push({
        title: 'Public Transit',
        ok: hasT,
        badge: hasT ? `Stop within 0.25 mi` : 'No Transit Within 0.25 mi',
        detail: dist != null ? `Nearest stop: ${Number(dist).toFixed(2)} mi` : undefined,
      });
    }

    if (conditions.length > 0) {
      fillRect(MARGIN, y, COL_W, 7, NAVY, 0);
      text('Site Conditions', MARGIN + 3, y + 5, { color: WHITE, size: 8.5, bold: true });
      y += 9;

      const cCols = 2;
      const cW = (COL_W - (cCols - 1) * 3) / cCols;
      const cH = 18;
      conditions.forEach((c, i) => {
        const col = i % cCols;
        const row = Math.floor(i / cCols);
        const cx = MARGIN + col * (cW + 3);
        const cy = y + row * (cH + 3);

        fillRect(cx, cy, cW, cH, LTGRAY, 2);
        const borderColor: [number,number,number] = c.ok ? [134,239,172] : [252,165,165];
        drawRect(cx, cy, cW, cH, borderColor, 0.5);

        // Status pill
        const pillColor: [number,number,number] = c.ok ? [220,252,231] : [254,226,226];
        const pillTextColor: [number,number,number] = c.ok ? [21,128,61] : [185,28,28];
        fillRect(cx + 4, cy + 2.5, cW - 8, 5, pillColor, 2);
        text(c.badge, cx + cW / 2, cy + 6.5, { align: 'center', color: pillTextColor, size: 6.5, bold: true });

        text(c.title, cx + 4, cy + 12, { color: DGRAY, size: 6.5 });
        if (c.detail) text(c.detail.substring(0, 50), cx + 4, cy + 16, { color: [130,130,130], size: 6 });
      });
      y += Math.ceil(conditions.length / cCols) * (cH + 3) + 5;
    }

    // ── NOTES (redevelopment flag, cost per unit) ─────────────
    const notes: string[] = [];
    if (deal?.lihtcIsRedevelopment) notes.push('Project flagged as REDEVELOPMENT — neighborhood auto-set to Good (10 pts).');
    if (deal?.lihtcCostPerUnit) notes.push(`PDC Cost/Unit: $${Number(deal.lihtcCostPerUnit).toLocaleString()} — ${Number(deal.lihtcCostPerUnit) > 135000 ? 'exceeds $135K threshold → −10 pts' : 'within threshold'}.`);
    if (notes.length > 0) {
      if (y > PAGE_H - 30) { pdf.addPage(); y = 20; }
      fillRect(MARGIN, y, COL_W, notes.length * 7 + 6, [255,251,235], 2);
      drawRect(MARGIN, y, COL_W, notes.length * 7 + 6, [251,191,36], 0.4);
      notes.forEach((n, i) => text(`ℹ  ${n}`, MARGIN + 4, y + 5 + i * 7, { color: [92,62,0], size: 7 }));
      y += notes.length * 7 + 10;
    }

    // ── FOOTER ────────────────────────────────────────────────
    const footerY = PAGE_H - 10;
    pdf.setDrawColor(...MGRAY);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, footerY - 3, PAGE_W - MARGIN, footerY - 3);
    text('NC QAP 2026 Scoring  ·  Pass threshold: 50 / 68 pts', MARGIN, footerY, { color: DGRAY, size: 6.5 });
    text(`Generated by LandLinq  ·  ${new Date().toLocaleDateString()}`, PAGE_W - MARGIN, footerY, { align: 'right', color: DGRAY, size: 6.5 });

    // ── SAVE ──────────────────────────────────────────────────
    const safeName = (evaluation.address || 'site').replace(/[^a-z0-9]/gi, '_').substring(0, 40);
    pdf.save(`QAP-Score-${safeName}.pdf`);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="modal-lihtc-score">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="modal-title-lihtc-score">
            <Calculator className="w-5 h-5 text-blue-600" />
            NC 2026 QAP Site Score
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading evaluation...</span>
          </div>
        ) : (!evaluation || isError) ? (
          <div className="text-center py-12">
            <Calculator className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-2">Site Not Scored Yet</p>
            <p className="text-gray-500 text-sm mb-6">Click below to run the full LIHTC site suitability evaluation</p>
            <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-blue-600 hover:bg-blue-700" data-testid="button-run-evaluation">
              {isRefreshing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scoring Site...</> : <><Calculator className="w-4 h-4 mr-2" />Run Site Evaluation</>}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {evaluation.address}
                </p>
                {evaluation.evaluatedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Evaluated: {new Date(evaluation.evaluatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)} title="Edit/override score inputs">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} data-testid="button-refresh-score" title="Re-run evaluation">
                  {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} title="Export QAP score sheet" disabled={!evaluation}>
                  <FileDown className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <Badge className={`${getScoreColor(evaluation.scoreTotal)} text-xl px-4 py-2`} data-testid="badge-total-score">
                    {evaluation.scoreTotal ?? '—'} pts
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">{getScoreLabel(evaluation.scoreTotal)}</p>
                </div>
              </div>
            </div>

            {/* Edit Panel */}
            {editMode && (
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                      <Pencil className="w-4 h-4" />
                      Override Score Inputs
                    </h3>
                    <p className="text-[10px] text-blue-600 mt-0.5">Neighborhood quality, income tier, and AMI units are auto-detected when you refresh. Set overrides here to override the auto-detected values.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setEditMode(false); setAutoDetectResult(null); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Auto-detect results banner */}
                {autoDetectResult && !autoDetectResult.error && (
                  <div className="bg-purple-50 border border-purple-200 rounded-md px-3 py-2 space-y-1.5">
                    <p className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Census Data Applied — {autoDetectResult.countyName}
                    </p>
                    <div className="space-y-0.5">
                      {autoDetectResult.medianIncome && (
                        <p className="text-[11px] text-purple-700">
                          <span className="font-medium">County MHI:</span> ${autoDetectResult.medianIncome.toLocaleString()}
                          {autoDetectResult.suggestions?.countyIncomeTier && (
                            <span className="ml-1 text-purple-600">→ <strong>{autoDetectResult.suggestions.countyIncomeTier}</strong> income tier</span>
                          )}
                        </p>
                      )}
                      {autoDetectResult.povertyRate != null && (
                        <p className="text-[11px] text-purple-700">
                          <span className="font-medium">Poverty rate:</span> {autoDetectResult.povertyRate}%
                          <span className="ml-1 text-orange-600">(reference only — neighborhood score requires physical inspection)</span>
                        </p>
                      )}
                      {autoDetectResult.suggestions?.amiNote && (
                        <p className="text-[11px] text-purple-600 italic">{autoDetectResult.suggestions.amiNote}</p>
                      )}
                    </div>
                    <p className="text-[10px] text-purple-500">Review and adjust below, then click Save & Recalculate</p>
                  </div>
                )}
                {autoDetectResult?.error && (
                  <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    <p className="text-xs text-red-700"><span className="font-medium">Auto-detect failed:</span> {autoDetectResult.error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Neighborhood Quality */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-700">
                      Neighborhood Quality
                      <span className="ml-1 text-gray-400 font-normal">(Well Maintained=10pts, Deteriorating=5pts, Blighted=0pts)</span>
                    </Label>
                    <Select value={overrides.neighborhoodQuality || 'none'} onValueChange={v => setOverrides(o => ({ ...o, neighborhoodQuality: v === 'none' ? '' : v }))}>
                      <SelectTrigger className="h-8 text-sm bg-white">
                        <SelectValue placeholder="Not assessed — analyst must complete" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not assessed (0 pts)</SelectItem>
                        <SelectItem value="Well Maintained">Well Maintained (10 pts)</SelectItem>
                        <SelectItem value="Deteriorating">Deteriorating (5 pts)</SelectItem>
                        <SelectItem value="Blighted">Blighted (0 pts)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" />Poverty rate shown for reference only — score must reflect physical condition of structures within 0.5 miles.
                    </p>
                  </div>

                  {/* County Income Tier */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-700">
                      County Income Tier
                      <span className="ml-1 text-gray-400 font-normal">(determines target AMI)</span>
                    </Label>
                    <Select value={overrides.countyIncomeTier || 'none'} onValueChange={v => setOverrides(o => ({ ...o, countyIncomeTier: v === 'none' ? '' : v }))}>
                      <SelectTrigger className="h-8 text-sm bg-white">
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        <SelectItem value="High">High (targets 30% AMI)</SelectItem>
                        <SelectItem value="Moderate">Moderate (targets 40% AMI)</SelectItem>
                        <SelectItem value="Low">Low (targets 50% AMI)</SelectItem>
                      </SelectContent>
                    </Select>
                    {autoDetectResult?.suggestions?.incomeTierReason && (
                      <p className="text-[10px] text-purple-600 flex items-center gap-1">
                        <Wand2 className="w-2.5 h-2.5" />{autoDetectResult.suggestions.incomeTierReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* AMI Unit Counts */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-700">
                    Income Targeting — Units at Each AMI Level
                    <span className="ml-1 text-gray-400 font-normal">(≥25% at target AMI = 2 pts, ≥15% = 1 pt)</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Units at 30% AMI", key: 'units30AMI' as const },
                      { label: "Units at 40% AMI", key: 'units40AMI' as const },
                      { label: "Units at 50% AMI", key: 'units50AMI' as const },
                    ].map(({ label, key }) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-[10px] text-gray-500">{label}</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={overrides[key]}
                          onChange={e => setOverrides(o => ({ ...o, [key]: e.target.value }))}
                          className="h-8 text-sm bg-white"
                        />
                      </div>
                    ))}
                  </div>
                  {autoDetectResult?.suggestions?.amiNote && (
                    <p className="text-[10px] text-purple-600 flex items-center gap-1">
                      <Wand2 className="w-2.5 h-2.5" />{autoDetectResult.suggestions.amiNote}
                    </p>
                  )}
                </div>

                {/* Redevelopment Flag + PDC Cost */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-700">Project Type</Label>
                    <div
                      className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer bg-white hover:bg-gray-50 transition-colors ${overrides.isRedevelopment ? 'border-green-400 bg-green-50' : ''}`}
                      onClick={() => setOverrides(o => ({ ...o, isRedevelopment: !o.isRedevelopment }))}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${overrides.isRedevelopment ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                        {overrides.isRedevelopment && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-xs text-gray-700">Redevelopment Project</span>
                    </div>
                    {overrides.isRedevelopment && (
                      <p className="text-[10px] text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" />QAP exception: auto-qualifies as "Good" neighborhood (10 pts)
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-gray-700">
                      Construction Cost / Unit
                      <span className="ml-1 text-gray-400 font-normal">(&gt;$135k = −10 pts)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 120000"
                        value={overrides.costPerUnit}
                        onChange={e => setOverrides(o => ({ ...o, costPerUnit: e.target.value }))}
                        className="h-8 text-sm bg-white pl-6"
                      />
                    </div>
                    {overrides.costPerUnit && parseInt(overrides.costPerUnit) > 135000 && (
                      <p className="text-[10px] text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />Exceeds $135,000 threshold — −10 pts will be applied
                      </p>
                    )}
                  </div>
                </div>

                {/* Olmstead + Eligibility Inputs */}
                <div className="space-y-3 border border-blue-100 rounded-lg p-3 bg-blue-50/40">
                  <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Olmstead & Eligibility</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-700">
                        1-Bedroom Units
                        <span className="ml-1 text-gray-400 font-normal">(for Olmstead scoring)</span>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 10"
                        value={overrides.units1BR}
                        onChange={e => setOverrides(o => ({ ...o, units1BR: e.target.value }))}
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-700">QD Principal Eligibility</Label>
                      <Select
                        value={overrides.isQDPrincipalEligible === null ? 'unknown' : overrides.isQDPrincipalEligible ? 'yes' : 'no'}
                        onValueChange={v => setOverrides(o => ({ ...o, isQDPrincipalEligible: v === 'unknown' ? null : v === 'yes' }))}
                      >
                        <SelectTrigger className="h-8 text-sm bg-white">
                          <SelectValue placeholder="Not checked" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unknown">Not checked</SelectItem>
                          <SelectItem value="yes">Yes — eligible (2017–2025)</SelectItem>
                          <SelectItem value="no">No — not eligible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer bg-white hover:bg-gray-50 transition-colors ${overrides.isDHHSPriorityCounty ? 'border-blue-400 bg-blue-50' : ''}`}
                      onClick={() => setOverrides(o => ({ ...o, isDHHSPriorityCounty: !o.isDHHSPriorityCounty }))}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${overrides.isDHHSPriorityCounty ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                        {overrides.isDHHSPriorityCounty && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-xs text-gray-700">DHHS Priority County (+1 Olmstead pt)</span>
                    </div>
                    <div
                      className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer bg-white hover:bg-gray-50 transition-colors ${overrides.isBondProject ? 'border-blue-400 bg-blue-50' : ''}`}
                      onClick={() => setOverrides(o => ({ ...o, isBondProject: !o.isBondProject }))}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${overrides.isBondProject ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                        {overrides.isBondProject && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-xs text-gray-700">Bond Project (1BR ≥ 10% required)</span>
                    </div>
                  </div>
                </div>

                {/* Negative Point Flags */}
                <div className="space-y-2 border border-red-100 rounded-lg p-3 bg-red-50/30">
                  <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Negative Point Flags (Manual)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Section 1602 — tri-state: No / Unknown / Yes */}
                    <div className={`border rounded-md p-2 bg-white space-y-1 ${overrides.section1602Status === 'yes' ? 'border-red-400 bg-red-50' : overrides.section1602Status === 'unknown' ? 'border-amber-400 bg-amber-50' : ''}`}>
                      <span className="text-xs text-gray-700 block leading-tight font-medium">Section 1602 Noncompliance</span>
                      <p className="text-[10px] text-gray-400 leading-snug">Is any Principal involved in a Section 1602 Exchange project with uncorrected noncompliance?</p>
                      <Select value={overrides.section1602Status} onValueChange={v => setOverrides(o => ({ ...o, section1602Status: v as 'no'|'unknown'|'yes' }))}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No — no penalty</SelectItem>
                          <SelectItem value="unknown">Unknown — verify (no pts deducted)</SelectItem>
                          <SelectItem value="yes">Yes — −40 pts</SelectItem>
                        </SelectContent>
                      </Select>
                      {overrides.section1602Status === 'yes' && <span className="text-[10px] text-red-600 font-semibold">−40 pts applied</span>}
                      {overrides.section1602Status === 'unknown' && <span className="text-[10px] text-amber-600">⚠ Must verify before submission</span>}
                    </div>
                    <div
                      className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer bg-white hover:bg-gray-50 transition-colors ${overrides.isAgencyDiscretionPenalty ? 'border-red-400 bg-red-50' : ''}`}
                      onClick={() => setOverrides(o => ({ ...o, isAgencyDiscretionPenalty: !o.isAgencyDiscretionPenalty }))}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${overrides.isAgencyDiscretionPenalty ? 'bg-red-600 border-red-600' : 'border-gray-300'}`}>
                        {overrides.isAgencyDiscretionPenalty && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <span className="text-xs text-gray-700 block leading-tight">Agency Discretion Penalty</span>
                        <span className="text-[10px] text-red-600">−3 pts</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amenity Overrides Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-700">
                      Amenity Overrides
                      <span className="ml-1 text-gray-400 font-normal">(leave blank to use auto-detected)</span>
                    </Label>
                  </div>
                  <p className="text-[10px] text-gray-500">Override any amenity the system got wrong. Name must match a QAP-approved store. Distance is driving miles.</p>
                  <div className="space-y-1.5">
                    {[
                      { key: 'grocery', label: 'Grocery', hint: 'Food Lion, Harris Teeter, Aldi…' },
                      { key: 'shopping', label: 'Shopping', hint: 'Dollar General, Target, Walmart…' },
                      { key: 'pharmacy', label: 'Pharmacy', hint: 'CVS, Walgreens, Rite Aid…' },
                      { key: 'otherPrimary', label: 'Other Primary', hint: '2nd grocery/shopping/pharmacy' },
                      { key: 'service', label: 'Service', hint: 'Restaurant, bank, gas station' },
                      { key: 'healthcare', label: 'Healthcare', hint: 'Hospital, urgent care, dentist' },
                      { key: 'publicFacility', label: 'Public Facility', hint: 'Park, library, rec center' },
                      { key: 'publicSchool', label: 'Public School', hint: 'Elem, middle, or high school' },
                      { key: 'otherRetail', label: 'Other Retail', hint: 'Strip center, any grocery/merchandise' },
                    ].map(({ key, label, hint }) => {
                      const val = overrides.amenityOverrides[key] || { name: '', distance: '' };
                      return (
                        <div key={key} className="grid grid-cols-[90px_1fr_80px_24px] gap-1.5 items-center">
                          <span className="text-[11px] text-gray-600 font-medium">{label}</span>
                          <Input
                            placeholder={hint}
                            value={val.name}
                            onChange={e => setOverrides(o => ({
                              ...o,
                              amenityOverrides: { ...o.amenityOverrides, [key]: { ...(o.amenityOverrides[key] || { name:'', distance:'' }), name: e.target.value } }
                            }))}
                            className="h-7 text-[11px] bg-white"
                          />
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="mi"
                            value={val.distance}
                            onChange={e => setOverrides(o => ({
                              ...o,
                              amenityOverrides: { ...o.amenityOverrides, [key]: { ...(o.amenityOverrides[key] || { name:'', distance:'' }), distance: e.target.value } }
                            }))}
                            className="h-7 text-[11px] bg-white"
                          />
                          {val.name ? (
                            <button
                              onClick={() => setOverrides(o => ({ ...o, amenityOverrides: { ...o.amenityOverrides, [key]: null } }))}
                              className="text-gray-400 hover:text-red-500"
                              title="Clear override"
                            ><X className="w-3.5 h-3.5" /></button>
                          ) : <div />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button onClick={handleSaveAndRecalculate} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 h-8 text-sm">
                    {isSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving & Recalculating...</> : <><Save className="w-3.5 h-3.5 mr-1.5" />Save & Recalculate</>}
                  </Button>
                  <p className="text-xs text-gray-500">Saves all overrides then re-runs the full site evaluation</p>
                </div>
              </div>
            )}

            {/* Hard Threshold Eligibility Badges */}
            {(() => {
              const totalUnits = deal?.unitCount || deal?.estimatedUnits || 0;
              const units1BR = deal?.lihtcUnits1BR ?? null;
              const pct1BR = totalUnits > 0 && units1BR !== null ? units1BR / totalUnits : null;
              const isBondProject = !!deal?.lihtcIsBondProject;
              const isQDEligible = deal?.lihtcQDPrincipalEligible;
              const hasAnyData = isQDEligible !== undefined || totalUnits > 200 || (isBondProject && pct1BR !== null);
              if (!hasAnyData) return null;
              return (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mr-1">Eligibility Gates:</span>
                  {isQDEligible !== null && isQDEligible !== undefined && (
                    <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${isQDEligible ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>
                      {isQDEligible ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      QD Principal {isQDEligible ? 'Eligible' : 'NOT ELIGIBLE'}
                    </div>
                  )}
                  {isBondProject && pct1BR !== null && (
                    <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${pct1BR >= 0.10 ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>
                      {pct1BR >= 0.10 ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      1BR: {(pct1BR * 100).toFixed(1)}% {pct1BR >= 0.10 ? '≥ 10% ✓' : '< 10% (bond req. not met)'}
                    </div>
                  )}
                  {totalUnits > 200 && (
                    <div className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border bg-yellow-50 border-yellow-300 text-yellow-700">
                      <AlertTriangle className="w-3 h-3" />
                      {totalUnits} units — exceeds 200 (Agency pre-approval required)
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Score Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ScoreCard
                icon={<Building2 className="w-4 h-4" />}
                label="Neighborhood"
                score={10}
                maxScore={10}
                tooltip="NC QAP 2026 §IV(A)(1)(b)(i): Neighborhood character score. Always awarded full 10 pts (Well Maintained) per team standard for NC 2026 QAP submissions."
                detail="Well Maintained (10 pts — team default)"
                isManual={false}
                isAuto={true}
              />
              <ScoreCard
                icon={<ShoppingBag className="w-4 h-4" />}
                label="Primary Amenities"
                isAuto
                score={evaluation.scorePrimaryAmenities}
                maxScore={26}
                tooltip="Grocery (up to 12 pts), Shopping Center (up to 7 pts), Pharmacy (up to 7 pts). Auto-fetched from Google Places. Points depend on walking distance."
                detail="Grocery · Shopping · Pharmacy"
              />
              <ScoreCard
                icon={<Home className="w-4 h-4" />}
                label="Secondary Amenities"
                isAuto
                score={evaluation.scoreSecondaryAmenities}
                maxScore={20}
                tooltip="NC QAP 2026: Other Primary Amenity (5pts), Service (2pts), Healthcare (3pts), Public Facility (3pts), Public School (3pts), Other Retail (3pts). Driving distances via Google Maps. Secondary amenities: ≤2.0mi=3pts, ≤2.5mi=2pts, ≤3.0mi=1pt, >3.0mi=0pts (standard); ≤3.5mi=3pts, ≤4.0mi=2pts, ≤4.5mi=1pt, >4.5mi=0pts (small town)."
                detail={
                  evaluation.marketInsights?.municipalityInfo
                    ? evaluation.marketInsights.municipalityInfo.bandNote
                    : "6 categories · driving distance"
                }
              />
              <ScoreCard
                icon={<Bus className="w-4 h-4" />}
                label="Transit Score"
                isAuto
                score={evaluation.scoreTransit}
                maxScore={6}
                tooltip="NC QAP 2026 §IV(A)(1)(b)(ii): Transit threshold is ALWAYS ≤0.25 miles WALKING (no small-town expansion). 6 pts = covered waiting area/shelter; 2 pts = no covered area. Auto-detection conservatively returns 2 pts — upgrade to 6 pts via manual override if the stop has a covered shelter."
                detail={
                  evaluation.transitData?.nearestStopDistance != null
                    ? `Nearest: ${evaluation.transitData.nearestStopDistance.toFixed(2)} mi${evaluation.transitData.stops?.[0]?.name ? ` — ${evaluation.transitData.stops[0].name}` : ''}`
                    : evaluation.transitData?.stops?.length > 0
                    ? `${evaluation.transitData.stops.length} stop(s) found`
                    : "No transit stops found within 0.25 mi"
                }
              />
              <ScoreCard
                icon={<CheckCircle className="w-4 h-4" />}
                label="Site Suitability"
                isAuto
                score={evaluation.scoreSiteSuitability}
                maxScore={12}
                tooltip="NC QAP 2026: 3 pts (no incompatible uses) + 3 pts (no flood/slope) + 3 pts visibility (assumed) + 3 pts traffic safety (assumed). FEMA/EPA/USGS auto-checked."
                detail={buildSiteSuitabilityDetail(evaluation)}
              />
              <ScoreCard
                icon={<DollarSign className="w-4 h-4" />}
                label="Income/RPP"
                score={evaluation.scoreIncomeRPP}
                maxScore={2}
                tooltip="NC QAP 2026 Income/RPP scoring by county tier — High county: 2pts if ≥25% units at 30 AMI, 1pt if ≥15%. Moderate county: 3pts if ≥20% at 30 AMI, 2pts if ≥40% at 50 AMI, else 1pt. Low county: 3pts if ≥50% at 50 AMI, 2pts if ≥30% at 50 AMI, else 1pt. County tier auto-detected from NC QAP 2026 official county designations, override via ✏️."
                detail={
                  deal?.lihtcCountyIncomeTier
                    ? `${deal.lihtcCountyIncomeTier} county tier`
                    : "Click ✏️ to set income tier & units"
                }
                isManual={!!(deal?.lihtcUnits30AMI != null || deal?.lihtcUnits40AMI != null || deal?.lihtcUnits50AMI != null || deal?.lihtcCountyIncomeTier)}
                isAuto={!(deal?.lihtcUnits30AMI != null || deal?.lihtcUnits40AMI != null || deal?.lihtcUnits50AMI != null || deal?.lihtcCountyIncomeTier)}
              />
              <ScoreCard
                icon={<AlertTriangle className="w-4 h-4" />}
                label="Negative Points"
                score={evaluation.scoreNegativePoints}
                maxScore={0}
                tooltip="−10 pts if construction cost/unit exceeds $135k (set via ✏️). −40 pts for Section 1602 noncompliance (manual flag). −3 pts for Agency discretion penalty (manual flag). Note: flood/slope presence removes the +3 site suitability point — it does NOT add a separate −3 deduction."
                isNegative
                isManual={!!(deal?.lihtcCostPerUnit || deal?.lihtcSection1602Penalty || deal?.lihtcAgencyDiscretionPenalty)}
                detail={
                  evaluation.scoreNegativePoints && evaluation.scoreNegativePoints < 0
                    ? `Deductions: ${evaluation.scoreNegativePoints} pts`
                    : "No deductions"
                }
              />
              <ScoreCard
                icon={<Users className="w-4 h-4" />}
                label="Olmstead"
                score={evaluation.scoreOlmstead ?? 0}
                maxScore={4}
                tooltip="NC QAP §IV(F)(5): 1BR units ≥7.5% of total = 1pt; ≥10% = 2pts; ≥15% = 3pts; +1pt for DHHS priority county. Maximum 4 pts. Enter 1-bedroom unit count via ✏️."
                detail={
                  deal?.lihtcUnits1BR != null
                    ? `${deal.lihtcUnits1BR} 1BR / ${deal.unitCount || deal.estimatedUnits || '?'} total`
                    : "Enter 1BR count via ✏️"
                }
                isManual={deal?.lihtcUnits1BR != null}
                isAuto={deal?.lihtcUnits1BR == null}
              />
            </div>

            {/* Site Suitability Breakdown */}
            <Card className="border" data-testid="card-site-suitability">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-600" />
                  Site Suitability Breakdown (max 12 pts)
                  <span className="text-[10px] font-normal text-gray-400 ml-auto">NC QAP 2026 §5</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-2">
                {(() => {
                  const noIncompat = !evaluation.floodZoneData?.isInFloodZone
                    && !evaluation.hazardsData?.hasNearbyHazards
                    && !evaluation.incompatibleUsesData?.hasIncompatibleUses;
                  const noNeg = !evaluation.floodZoneData?.isInFloodZone && !evaluation.slopeData?.hasSteepSlope;

                  const rows: { label: string; pts: number; max: number; source: string; detail?: string }[] = [
                    {
                      label: "No incompatible uses within ½ mile",
                      pts: noIncompat ? 3 : 0,
                      max: 3,
                      source: "Auto — EPA Facility Registry / USGS hazard data",
                      detail: evaluation.hazardsData?.hasNearbyHazards
                        ? `⚠ ${evaluation.hazardsData.hazardCount ?? ''} hazard site(s) within 1 mi${evaluation.hazardsData.nearestHazard ? ` — nearest: ${evaluation.hazardsData.nearestHazard.name} (${Number(evaluation.hazardsData.nearestHazard.distance).toFixed(2)} mi)` : ''}`
                        : evaluation.incompatibleUsesData?.hasIncompatibleUses
                        ? "⚠ Incompatible use detected nearby"
                        : "✓ No hazards or incompatible uses found",
                    },
                    {
                      label: "No flood zone / steep slope / physical barriers",
                      pts: noNeg ? 3 : 0,
                      max: 3,
                      source: "Auto — FEMA NFHL flood data + slope analysis",
                      detail: evaluation.floodZoneData?.isInFloodZone
                        ? `⚠ In FEMA flood zone ${evaluation.floodZoneData.floodZone || ''}${evaluation.floodZoneData.floodZoneDescription ? ` (${evaluation.floodZoneData.floodZoneDescription})` : ''}`
                        : evaluation.slopeData?.hasSteepSlope
                        ? `⚠ Steep slope detected — max ${Number(evaluation.slopeData.maxSlope ?? 0).toFixed(1)}%`
                        : `✓ Not in flood zone${evaluation.slopeData?.maxSlope != null ? ` · max slope ${Number(evaluation.slopeData.maxSlope).toFixed(1)}%` : ''}`,
                    },
                    {
                      label: "Visibility — within 500 ft of residential or commercial",
                      pts: 3,
                      max: 3,
                      source: "Assumed — no automated API check (NC QAP §5.2c)",
                      detail: "NC QAP requires visible from a public road within 500 ft of residential or commercial uses. Assumed passing — verify on-site.",
                    },
                    {
                      label: "Traffic safety — direct access to a public road",
                      pts: 3,
                      max: 3,
                      source: "Assumed — no automated API check (NC QAP §5.2d)",
                      detail: "NC QAP requires safe vehicular access without passing through existing residential neighborhoods. Assumed passing — verify on-site.",
                    },
                  ];

                  return rows.map((row, i) => (
                    <div key={i} className={`flex items-start gap-3 rounded-lg p-2.5 ${row.pts === row.max ? 'bg-emerald-50 border border-emerald-100' : row.pts > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-red-50 border border-red-100'}`}>
                      <div className={`shrink-0 w-11 text-center font-bold text-base leading-none mt-0.5 ${row.pts === row.max ? 'text-emerald-700' : row.pts > 0 ? 'text-amber-700' : 'text-red-700'}`}>
                        {row.pts}<span className="text-[10px] font-normal text-gray-400">/{row.max}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 leading-tight">{row.label}</p>
                        {row.detail && <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{row.detail}</p>}
                        <p className="text-[10px] text-gray-400 italic mt-0.5">{row.source}</p>
                      </div>
                      <div className="shrink-0">
                        {row.pts === row.max
                          ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                          : <XCircle className="w-4 h-4 text-red-400" />}
                      </div>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>

            {/* Amenity Details Table */}
            {evaluation.amenityDetails && evaluation.amenityDetails.length > 0 ? (
              <Card className="border" data-testid="card-amenities">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-green-600" />
                    Amenity Distances & Points (Google Places)
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  {/* Primary Amenities */}
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Primary (max 26 pts) — Driving Distance</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                      {(evaluation.amenityDetails as Array<{name: string; category?: string; placeName?: string; distance: number | null; points: number}>)
                        .filter(a => !a.category || a.category === 'primary')
                        .map((amenity, idx) => (
                        <div key={idx} className={`flex flex-col p-2 rounded text-xs gap-0.5 ${(amenity as any).isManual ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-gray-700 font-medium text-[11px]">{amenity.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {(amenity as any).isManual && <span className="text-[8px] bg-purple-100 text-purple-700 rounded px-1">✏️</span>}
                              <Badge className={amenity.points > 0 ? "bg-green-100 text-green-800 text-[10px]" : "bg-gray-100 text-gray-500 text-[10px]"}>
                                +{amenity.points}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-gray-400 truncate">
                            {amenity.placeName ? <span className="text-gray-500 text-[10px]">{amenity.placeName}</span> : <span className="italic text-[10px]">not found</span>}
                            {amenity.distance !== null ? <span className="ml-1 text-blue-500 text-[10px]">{amenity.distance.toFixed(2)} mi</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Secondary Amenities */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Secondary (max 20 pts) — Driving Distance</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                      {(evaluation.amenityDetails as Array<{name: string; category?: string; placeName?: string; distance: number | null; points: number}>)
                        .filter(a => a.category === 'secondary')
                        .map((amenity, idx) => (                        <div key={idx} className={`flex flex-col p-2 rounded text-xs gap-0.5 ${(amenity as any).isManual ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-gray-700 font-medium text-[11px]">{amenity.name}</span>
                            <Badge className={amenity.points > 0 ? "bg-green-100 text-green-800 text-[10px]" : "bg-gray-100 text-gray-500 text-[10px]"}>
                              +{amenity.points}
                            </Badge>
                          </div>
                          <div className="text-gray-400 truncate">
                            {amenity.placeName ? <span className="text-gray-500">{amenity.placeName}</span> : <span className="italic">not found</span>}
                            {amenity.distance !== null ? <span className="ml-1 text-blue-500">{amenity.distance.toFixed(2)} mi drive</span> : null}
                          </div>
                          {amenity.name === 'Service' && amenity.placeName && (
                            <span className="text-[9px] text-amber-600 mt-0.5">⚠️ Verify permanent establishment — food trucks/carts don't qualify</span>
                          )}
                          {amenity.name === 'Healthcare' && amenity.placeName && (
                            <span className="text-[9px] text-blue-500 mt-0.5">ℹ️ Verify general/family practice — specialty-only may not qualify</span>
                          )}
                          {amenity.name === 'Public Facility' && amenity.placeName && (
                            <span className="text-[9px] text-blue-500 mt-0.5">ℹ️ Must be public — gov park, library, or rec/senior center</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-xs text-gray-400 bg-gray-50 border border-dashed rounded px-3 py-2 flex items-center gap-2">
                <Info className="w-3 h-3 flex-shrink-0" />
                Hit the refresh button to run a full evaluation — this fetches real grocery, pharmacy, school, and transit distances from Google Places and auto-calculates all amenity scores.
              </div>
            )}

            {/* Government API Detail Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evaluation.floodZoneData && (
                <Card className="border" data-testid="card-flood-zone">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-500" />
                      FEMA Flood Zone
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 space-y-2">
                    <div>
                      {evaluation.floodZoneData.isInFloodZone ? (
                        <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />In Special Flood Hazard Area</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Not in Flood Zone</Badge>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs text-gray-600">
                      {evaluation.floodZoneData.floodZone && <p><span className="font-medium">Zone:</span> {evaluation.floodZoneData.floodZone}</p>}
                      {evaluation.floodZoneData.floodZoneDescription && <p><span className="font-medium">Risk:</span> {evaluation.floodZoneData.floodZoneDescription}</p>}
                      <p className="text-gray-400 italic">Source: {evaluation.floodZoneData.source || 'FEMA National Flood Hazard Layer'}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {evaluation.hazardsData && (
                <Card className="border" data-testid="card-hazards">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Factory className="w-4 h-4 text-orange-500" />
                      EPA Hazardous Sites
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 space-y-2">
                    <div>
                      {evaluation.hazardsData.hasNearbyHazards ? (
                        <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />{evaluation.hazardsData.hazardCount ?? 0} Site(s) Within 1 Mile</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />No Hazards Within 1 Mile</Badge>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs text-gray-600">
                      {evaluation.hazardsData.nearestHazard && (
                        <p><span className="font-medium">Nearest:</span> {evaluation.hazardsData.nearestHazard.name} ({evaluation.hazardsData.nearestHazard.distance?.toFixed(2)} mi) — {evaluation.hazardsData.nearestHazard.type}</p>
                      )}
                      {evaluation.hazardsData.hazards?.length > 1 && <p className="text-gray-500">+{evaluation.hazardsData.hazards.length - 1} more site(s)</p>}
                      <p className="text-gray-400 italic">Searches EPA TRI Toxics + RCRA Hazardous Waste databases</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {evaluation.slopeData && (
                <Card className="border" data-testid="card-slope">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mountain className="w-4 h-4 text-green-600" />
                      USGS Terrain Slope
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 space-y-2">
                    <div>
                      {evaluation.slopeData.hasSteepSlope ? (
                        <Badge className="bg-amber-100 text-amber-800"><AlertTriangle className="w-3 h-3 mr-1" />Steep Slope (&gt;15% grade)</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Acceptable Slope (≤15% grade)</Badge>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs text-gray-600">
                      {(evaluation.slopeData.avgSlope ?? evaluation.slopeData.averageSlope) != null && (
                        <p><span className="font-medium">Avg slope:</span> {(evaluation.slopeData.avgSlope ?? evaluation.slopeData.averageSlope).toFixed(1)}%</p>
                      )}
                      {evaluation.slopeData.maxSlope != null && (
                        <p><span className="font-medium">Max slope:</span> {evaluation.slopeData.maxSlope.toFixed(1)}%</p>
                      )}
                      {evaluation.slopeData.elevationPoints && (
                        <p className="text-gray-400 italic">Sampled {evaluation.slopeData.elevationPoints.length} elevation points via USGS National Map</p>
                      )}
                      <p className="text-amber-600 text-[10px] mt-1">⚠️ USGS elevation sampling may be inaccurate for small parcels — verify with a civil engineer or topographic survey before scoring.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {evaluation.transitData && (
                <Card className="border" data-testid="card-transit">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bus className="w-4 h-4 text-purple-500" />
                      Transit Access
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 space-y-2">
                    <div>
                      <Badge className={evaluation.transitData.transitScore >= 6 ? "bg-green-100 text-green-800" : evaluation.transitData.transitScore >= 2 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-600"}>
                        {evaluation.transitData.transitScore} pts
                      </Badge>
                    </div>
                    <div className="space-y-0.5 text-xs text-gray-600">
                      {evaluation.transitData.nearestStopDistance != null ? (
                        <p><span className="font-medium">Nearest stop:</span> {evaluation.transitData.nearestStopDistance.toFixed(2)} mi{evaluation.transitData.stops?.[0]?.name ? ` — ${evaluation.transitData.stops[0].name}` : ''}</p>
                      ) : (
                        <p className="text-gray-500">No transit stops found within search radius</p>
                      )}
                      {evaluation.transitData.stops?.slice(1, 3).map((stop: any, i: number) => (
                        <p key={i} className="text-gray-500">• {stop.name} ({stop.distance?.toFixed(2)} mi)</p>
                      ))}
                      {evaluation.transitData.stops?.length > 3 && <p className="text-gray-400">+{evaluation.transitData.stops.length - 3} more stops</p>}
                      <p className="text-gray-400 italic pt-0.5">Scoring: ≤0.5 mi = 6 pts · ≤1 mi = 2 pts · beyond = 0 pts</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {evaluation.incompatibleUsesData && (
                <Card className="border" data-testid="card-incompatible-uses">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Factory className="w-4 h-4 text-gray-600" />
                      Incompatible Uses
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 space-y-2">
                    <div>
                      {evaluation.incompatibleUsesData.hasIncompatibleUses ? (
                        <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Incompatible Uses Found</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />No Incompatible Uses</Badge>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs text-gray-600">
                      {evaluation.incompatibleUsesData.issues?.map((issue: string, i: number) => (
                        <p key={i} className="text-red-600">• {issue}</p>
                      ))}
                      {evaluation.incompatibleUsesData.nearbyAirports?.length > 0 && (
                        <p><span className="font-medium">Airports within 3 mi:</span> {evaluation.incompatibleUsesData.nearbyAirports.map((a: any) => `${a.name} (${a.distance?.toFixed(1)} mi)`).join(', ')}</p>
                      )}
                      {evaluation.incompatibleUsesData.nearbyIndustrial?.length > 0 && (
                        <p><span className="font-medium">Industrial within 0.25 mi:</span> {evaluation.incompatibleUsesData.nearbyIndustrial.slice(0, 2).map((a: any) => a.name).join(', ')}</p>
                      )}
                      <p className="text-gray-400 italic">Checks: airports (3 mi), industrial/storage (0.25 mi)</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {evaluation.censusData && (
                <Card className="border" data-testid="card-census">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      Census & Income Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 space-y-1 text-xs">
                    {evaluation.censusData.isQCT && <Badge className="bg-purple-100 text-purple-800 mb-1">Qualified Census Tract (QCT)</Badge>}
                    {evaluation.censusData.city && evaluation.censusData.state && <p className="text-gray-700 font-medium">{evaluation.censusData.city}, {evaluation.censusData.state}</p>}
                    {evaluation.censusData.county && <p className="text-gray-600"><span className="font-medium">County:</span> {evaluation.censusData.county}</p>}
                    {evaluation.censusData.tract && <p className="text-gray-600"><span className="font-medium">Census Tract:</span> {evaluation.censusData.tract}</p>}
                    {evaluation.censusData.medianIncome && <p className="text-gray-600"><span className="font-medium">Median Income:</span> ${evaluation.censusData.medianIncome.toLocaleString()}</p>}
                    {evaluation.censusData.povertyRate != null && <p className="text-gray-600"><span className="font-medium">Poverty Rate:</span> {evaluation.censusData.povertyRate}%</p>}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Score Formula */}
            <Card className="border bg-gray-50" data-testid="card-formula">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-gray-600" />
                  Score Calculation (NC 2026 QAP)
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 text-xs text-gray-600">
                {/* Per-category breakdown cells */}
                <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 mb-3">
                  {[
                    { label: "Neighborhood", val: 10, max: 10 },
                    { label: "Primary Amenities", val: evaluation.scorePrimaryAmenities ?? 0, max: 26 },
                    { label: "Secondary Amenities", val: evaluation.scoreSecondaryAmenities ?? 0, max: 20 },
                    { label: "Transit", val: evaluation.scoreTransit ?? 0, max: 6 },
                    { label: "Site Suitability", val: evaluation.scoreSiteSuitability ?? 0, max: 12 },
                    { label: "Olmstead", val: (evaluation as any).scoreOlmstead ?? 0, max: 4 },
                    { label: "Income/RPP", val: evaluation.scoreIncomeRPP ?? 0, max: 2 },
                    { label: "Deductions", val: evaluation.scoreNegativePoints ?? 0, max: 0 },
                  ].map(({ label, val, max }) => (
                    <div key={label} className="bg-white border rounded p-1.5 text-center">
                      <p className={`font-bold text-sm ${val > 0 ? 'text-gray-800' : val < 0 ? 'text-red-600' : 'text-gray-400'}`}>{val > 0 ? `+${val}` : val}</p>
                      <p className="text-gray-500 text-[9px] leading-tight mt-0.5">{label}</p>
                      {max > 0 && <p className="text-gray-300 text-[8px]">/ {max}</p>}
                    </div>
                  ))}
                </div>

                {/* Site score subtotal — the 50-pt threshold is based on this */}
                {(() => {
                  const siteSubtotal = 10 + (evaluation.scorePrimaryAmenities ?? 0) + (evaluation.scoreSecondaryAmenities ?? 0) + (evaluation.scoreSiteSuitability ?? 0);
                  const sitePass = siteSubtotal >= 50;
                  return (
                    <div className={`flex items-center justify-between rounded px-2 py-1.5 mb-1 ${sitePass ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Site Score Subtotal</p>
                        <p className="text-[9px] text-gray-400">Neighborhood + Amenities + Site Suitability · min 50 pts required</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${sitePass ? 'text-emerald-700' : 'text-red-700'}`}>{siteSubtotal} / 68</span>
                        <Badge className={`ml-2 text-[9px] px-1.5 py-0.5 ${sitePass ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{sitePass ? '✓ PASS' : '✗ FAIL'}</Badge>
                      </div>
                    </div>
                  );
                })()}

                {/* Auto-scoreable total */}
                <div className="flex items-center justify-between border-t pt-2">
                  <div>
                    <p className="font-bold text-sm">Auto-Scoreable Total</p>
                    <p className="text-[9px] text-gray-400">All automated categories · max 80 pts</p>
                  </div>
                  <Badge className={`${getScoreColor(evaluation.scoreTotal)} text-sm px-3 py-1`}>
                    {evaluation.scoreTotal ?? 0} / 80 pts
                  </Badge>
                </div>

                {/* Manual categories not yet scored */}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <div className="bg-gray-50 border border-dashed rounded p-2 text-center">
                    <p className="text-xs font-medium text-gray-500">Design Standards</p>
                    <p className="text-sm font-bold text-gray-300">— / 30</p>
                    <p className="text-[9px] text-gray-400">Requires architect drawings</p>
                  </div>
                  <div className="bg-gray-50 border border-dashed rounded p-2 text-center">
                    <p className="text-xs font-medium text-gray-500">Applicant Bonus</p>
                    <p className="text-sm font-bold text-gray-300">— / 1</p>
                    <p className="text-[9px] text-gray-400">Analyst-controlled</p>
                  </div>
                </div>
                <p className="text-gray-400 text-[10px] mt-2 leading-snug">Total possible = 111 pts (80 auto-scoreable + 30 Design Standards + 1 Applicant Bonus). Competitive 4% bond applications in NC typically score 90–110+. Design standards require architect drawings at full application and cannot be estimated at this stage.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function buildSiteSuitabilityDetail(evaluation: SiteEvaluation): string {
  const noIncompat = !evaluation.floodZoneData?.isInFloodZone && !evaluation.hazardsData?.hasNearbyHazards && !evaluation.incompatibleUsesData?.hasIncompatibleUses;
  const noNeg = !evaluation.floodZoneData?.isInFloodZone && !evaluation.slopeData?.hasSteepSlope;
  const pts = [noIncompat ? 3 : 0, noNeg ? 3 : 0, 3, 3];
  return `${pts[0]}+${pts[1]}+3+3 pts — ${pts.reduce((a,b)=>a+b,0)}/12 scored`;
}

function ScoreCard({ icon, label, score, maxScore, tooltip, detail, isNegative = false, isManual = false, isAuto = false }: {
  icon: React.ReactNode; label: string; score: number | null; maxScore: number;
  tooltip: string; detail?: string; isNegative?: boolean; isManual?: boolean; isAuto?: boolean;
}) {
  const displayScore = score ?? 0;
  const scoreColor = isNegative
    ? (displayScore < 0 ? "text-red-600" : "text-green-600")
    : (maxScore === 0 ? "text-green-600" : displayScore >= maxScore * 0.7 ? "text-green-600" : displayScore >= maxScore * 0.4 ? "text-amber-600" : "text-red-600");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="bg-white border rounded-lg p-3 cursor-help hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">{icon}</span>
              <span className="text-xs font-medium text-gray-700 leading-tight">{label}</span>
            </div>
            {isManual && (
              <span className="text-[9px] bg-purple-100 text-purple-700 border border-purple-200 rounded px-1 py-0.5 flex items-center gap-0.5 shrink-0" title="Manually overridden by analyst">
                ✏️ manual
              </span>
            )}
            {isAuto && !isManual && (
              <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1 py-0.5 flex items-center gap-0.5 shrink-0" title="Auto-detected by API">
                🤖 auto
              </span>
            )}
          </div>
          <div className="text-center">
            <span className={`text-2xl font-bold ${scoreColor}`}>{displayScore}</span>
            <span className="text-xs text-gray-400">/{maxScore}</span>
          </div>
          {detail && <p className="text-[10px] text-gray-400 text-center mt-1 leading-tight">{detail}</p>}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px]">
        <p className="font-medium mb-1">{label}</p>
        <p className="text-xs">{tooltip}</p>
        {isManual && <p className="text-xs text-purple-600 mt-1">✏️ Manually overridden by analyst</p>}
        {isAuto && !isManual && <p className="text-xs text-blue-500 mt-1">🤖 Auto-detected via APIs</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function LIHTCScoreBadge({ dealId, score, onClick }: { dealId: string; score: number | null; onClick: () => void; }) {
  if (score === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="bg-gray-100 text-gray-500 border border-gray-300 cursor-pointer hover:bg-gray-200 text-xs px-1.5 py-0.5" onClick={onClick} data-testid={`badge-lihtc-score-${dealId}`}>
            <Calculator className="w-3 h-3 mr-1" />—
          </Badge>
        </TooltipTrigger>
        <TooltipContent><p>No LIHTC evaluation yet</p><p className="text-xs">Click to run evaluation</p></TooltipContent>
      </Tooltip>
    );
  }

  const bgColor = score >= 50 ? "bg-green-100 text-green-800 border-green-300" : score >= 40 ? "bg-yellow-100 text-yellow-800 border-yellow-300" : "bg-red-100 text-red-800 border-red-300";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`${bgColor} cursor-pointer hover:opacity-80 text-xs px-1.5 py-0.5 border`} onClick={onClick} data-testid={`badge-lihtc-score-${dealId}`}>
          <Calculator className="w-3 h-3 mr-1" />{score}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>LIHTC Score: {score} pts</p>
        <p className="text-xs">{score >= 50 ? "Passes (≥50)" : score >= 40 ? "Borderline" : "Needs Improvement"} — Click for details</p>
      </TooltipContent>
    </Tooltip>
  );
}

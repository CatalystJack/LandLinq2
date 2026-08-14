import { useState } from "react";
import { Building2, MapPin, Calendar, Home, DollarSign, CheckCircle, XCircle, TrendingUp, Star, Filter, AlertTriangle, Database, Users, User, Hammer, BarChart2, Navigation, Info, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type FilterType = 'all' | 'met' | 'qualifying';

interface ComparableProperty {
  isQualifying: boolean;
  isTopRent?: boolean;
  meetsVintageUnits?: boolean;
  propertyName?: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  rentPerSqft: number;
  vintage: number;
  units: number;
  distance: number;
  avgRentPerUnit?: number;
  latitude?: number | null;
  longitude?: number | null;
  propertyType?: string | null;
  vacancyRate?: number | null;
  developer?: string | null;
  owner?: string | null;
  buildingSize?: number | null;
  stories?: number | null;
  unitMix?: Array<{ unitType: string; avgRent: number; avgSqft: number; rentPSF: number; count: number }> | null;
  leasedPct?: number | null;
  leasedPctChange?: number | null;
  exposure?: number | null;
  exposureChange?: number | null;
  unitsVacant?: number | null;
  unitsExposed?: number | null;
  websiteUrl?: string | null;
}

interface ParsedComparables {
  summary: {
    totalFound: number;
    metCriteria: number;
    qualifying: number;
    isAreaFallback?: boolean;
    fallbackNote?: string;
    noApartmentsFound?: boolean;
    residentialCount?: number;
  };
  allCandidatesMetrics?: {
    topRentPSF: number;
    avgRentPSF: number;
    topRentPerUnit: number;
    avgRentPerUnit: number;
  };
  qualifyingMetrics?: {
    topRentPSF: number;
    avgRentPSF: number;
    topRentPerUnit: number;
    avgRentPerUnit: number;
  };
  properties: ComparableProperty[];
}

function parseComparableNotes(notes: string, criteria?: ClassificationCriteria): ParsedComparables | null {
  const minVintage = criteria?.minVintage ?? 2020;
  const minUnits = criteria?.minUnits ?? 150;
  if (!notes) return null;

  // Detect known listing formats. Return null only for pure AI reasoning / QCT messages.
  const hasPropertyListings =
    (notes.includes('Address:') && notes.includes('Rent/sqft:')) ||   // classic format
    notes.includes('[ACQUISITION COMPARABLES') ||                       // Tucker inline format
    notes.includes('MULTIFAMILY PROPERTIES IN AREA') ||                // Kissimmee area format
    notes.includes('OTHER APARTMENTS IN AREA') ||
    /Found \d+ (total )?comparable/.test(notes);                       // any "Found X comparable…"
  if (!hasPropertyListings) return null;

  const result: ParsedComparables = {
    summary: {
      totalFound: 0,
      metCriteria: 0,
      qualifying: 0
    },
    properties: []
  };

  // Check for area fallback
  if (notes.includes('[AREA COMPARABLES]') || notes.includes('[ZIP CENTER]')) {
    result.summary.isAreaFallback = true;
    const noteMatch = notes.match(/Note: ([^\n]+)/);
    if (noteMatch) {
      result.summary.fallbackNote = noteMatch[1];
    }
  }

  // Parse summary stats - support multiple note formats
  const totalMatch =
    notes.match(/Found (\d+) total comparables/) ||
    notes.match(/Found (\d+) comparable propert/) ||   // "properties" or "property"
    notes.match(/(\d+) total properties checked/);
  const criteriaMatch = notes.match(/(\d+) met vintage\/units criteria/);
  const qualifyMatch = notes.match(/(\d+) qualify with rent/) || notes.match(/(\d+) qualifying comparables? found/);

  // Track which counts came from regex (vs. defaulted to 0) so post-processing
  // doesn't overwrite correctly-parsed header values.
  const totalFromRegex = !!totalMatch;
  const criteriaFromRegex = !!criteriaMatch;
  const qualifyFromRegex = !!qualifyMatch;

  if (totalMatch) result.summary.totalFound = parseInt(totalMatch[1]);
  if (criteriaMatch) result.summary.metCriteria = parseInt(criteriaMatch[1]);
  if (qualifyMatch) result.summary.qualifying = parseInt(qualifyMatch[1]);

  // If qualifying count is known but total isn't, use qualifying as minimum total
  if (result.summary.qualifying > 0 && result.summary.totalFound === 0) {
    result.summary.totalFound = result.summary.qualifying;
  }
  if (result.summary.metCriteria > 0 && result.summary.totalFound === 0) {
    result.summary.totalFound = result.summary.metCriteria;
  }

  // Parse ALL CANDIDATES metrics
  const allCandidatesSection = notes.match(/ALL CANDIDATES RENT METRICS:([\s\S]*?)(?=QUALIFYING|NON-QUALIFYING|$)/);
  if (allCandidatesSection) {
    const section = allCandidatesSection[1];
    const topPSF = section.match(/Top Rent PSF: \$?([\d.]+)/);
    const avgPSF = section.match(/Avg Rent PSF: \$?([\d.]+)/);
    const topUnit = section.match(/Top Rent\/Unit: \$?([\d,]+)/);
    const avgUnit = section.match(/Avg Rent\/Unit: \$?([\d,]+)/);
    
    result.allCandidatesMetrics = {
      topRentPSF: topPSF ? parseFloat(topPSF[1]) : 0,
      avgRentPSF: avgPSF ? parseFloat(avgPSF[1]) : 0,
      topRentPerUnit: topUnit ? parseFloat(topUnit[1].replace(',', '')) : 0,
      avgRentPerUnit: avgUnit ? parseFloat(avgUnit[1].replace(',', '')) : 0
    };
  }

  // Parse QUALIFYING COMPARABLES metrics
  const qualifyingSection = notes.match(/QUALIFYING COMPARABLES METRICS:([\s\S]*?)(?=\d+\.\s*QUALIFIES|NON-QUALIFYING|$)/);
  if (qualifyingSection) {
    const section = qualifyingSection[1];
    const topPSF = section.match(/Top Rent PSF: \$?([\d.]+)/);
    const avgPSF = section.match(/Avg Rent PSF: \$?([\d.]+)/);
    const topUnit = section.match(/Top Rent\/Unit: \$?([\d,]+)/);
    const avgUnit = section.match(/Avg Rent\/Unit: \$?([\d,]+)/);
    
    result.qualifyingMetrics = {
      topRentPSF: topPSF ? parseFloat(topPSF[1]) : 0,
      avgRentPSF: avgPSF ? parseFloat(avgPSF[1]) : 0,
      topRentPerUnit: topUnit ? parseFloat(topUnit[1].replace(',', '')) : 0,
      avgRentPerUnit: avgUnit ? parseFloat(avgUnit[1].replace(',', '')) : 0
    };
  }

  // Parse individual properties (both qualifying and non-qualifying)
  // Dec 16, 2025: Fixed regex to allow leading whitespace before "Property:" (HelloData outputs "   Property:")
  const propertyPattern = /(\d+)\.\s*(QUALIFIES|DOES NOT QUALIFY)(\s*\[TOP RENT\])?[\s\S]*?(?:\s*Property:\s*([^\n]+)\n)?[\s\S]*?Address:\s*([^\n]+)\n[\s\S]*?Rent\/sqft:\s*\$?([\d.]+)[\s\S]*?Vintage:\s*(\d+)[\s\S]*?Units:\s*(\d+)[\s\S]*?Distance:\s*([\d.]+)/g;
  
  let match;
  while ((match = propertyPattern.exec(notes)) !== null) {
    const vintage = parseInt(match[7]);
    const units = parseInt(match[8]);
    result.properties.push({
      isQualifying: match[2] === 'QUALIFIES',
      isTopRent: !!match[3],
      meetsVintageUnits: vintage >= minVintage && units >= minUnits,
      propertyName: match[4]?.trim(),
      address: match[5].trim(),
      rentPerSqft: parseFloat(match[6]),
      vintage,
      units,
      distance: parseFloat(match[9])
    });
  }

  // Also parse MULTIFAMILY PROPERTIES IN AREA section (for properties that don't meet criteria)
  // These show up when no properties meet the strict 2020+/150+ criteria
  const multifamilySection = notes.match(/MULTIFAMILY PROPERTIES IN AREA[^:]*:([\s\S]*?)(?=\.\.\.and \d+ more|$)/);
  if (multifamilySection) {
    // Jan 1, 2026: Fixed regex to handle optional ", Rent: $X.XX/sqft" on the Vintage/Units line
    const multifamilyPattern = /(\d+)\.\s*([^\n]+)\n\s*Address:\s*([^\n]+)\n\s*Vintage:\s*(\d+),?\s*Units:\s*(\d+)(?:,\s*Rent:\s*\$?([\d.]+)\/sqft)?\n\s*Distance:\s*([\d.]+)/g;
    let mfMatch;
    while ((mfMatch = multifamilyPattern.exec(multifamilySection[1])) !== null) {
      const vintage = parseInt(mfMatch[4]);
      const units = parseInt(mfMatch[5]);
      const rentPsf = mfMatch[6] ? parseFloat(mfMatch[6]) : 0;
      result.properties.push({
        isQualifying: false,
        meetsVintageUnits: vintage >= minVintage && units >= minUnits,
        propertyName: mfMatch[2]?.trim(),
        address: mfMatch[3].trim(),
        rentPerSqft: rentPsf,
        vintage,
        units,
        distance: parseFloat(mfMatch[7])
      });
    }
  }
  
  // Parse OTHER APARTMENTS IN AREA section (apartments not meeting vintage/units criteria)
  const otherApartmentsSection = notes.match(/OTHER APARTMENTS IN AREA \((\d+)\):([\s\S]*?)(?=\.\.\.and \d+ more|Classification:|$)/);
  if (otherApartmentsSection) {
    // Jan 1, 2026: Fixed regex to handle optional ", Rent: $X.XX/sqft" on the Vintage/Units line
    const otherPattern = /(\d+)\.\s*([^\n]+)\n\s*Address:\s*([^\n]+)\n\s*Vintage:\s*(\d+),?\s*Units:\s*(\d+)(?:,\s*Rent:\s*\$?([\d.]+)\/sqft)?\n\s*Distance:\s*([\d.]+)/g;
    let otherMatch;
    while ((otherMatch = otherPattern.exec(otherApartmentsSection[2])) !== null) {
      const vintage = parseInt(otherMatch[4]);
      const units = parseInt(otherMatch[5]);
      const rentPsf = otherMatch[6] ? parseFloat(otherMatch[6]) : 0;
      result.properties.push({
        isQualifying: false,
        meetsVintageUnits: false, // These explicitly don't meet criteria
        propertyName: otherMatch[2]?.trim(),
        address: otherMatch[3].trim(),
        rentPerSqft: rentPsf,
        vintage,
        units,
        distance: parseFloat(otherMatch[7])
      });
    }
  }

  // Parse Tucker / acquisition inline format:
  // "[ACQUISITION COMPARABLES — 4-mile radius]\nFound 7 comparable properties\n1. Name — 0.1 mi\n   1983 vintage | 264 units | $1,544/unit | $1.50/sqft"
  // Only run when no properties have been parsed yet (avoid double-counting)
  if (result.properties.length === 0 && notes.includes('[ACQUISITION COMPARABLES')) {
    const acquisitionPattern = /(\d+)\.\s*([^\n]+?)\s*—\s*([\d.]+)\s*mi\s*\n\s*(\d{4})\s*vintage\s*\|\s*(\d+)\s*units(?:\s*\|\s*\$[\d,]+\/unit)?\s*(?:\|\s*\$?([\d.]+)\/sqft)?/g;
    let acqMatch;
    while ((acqMatch = acquisitionPattern.exec(notes)) !== null) {
      const vintage = parseInt(acqMatch[4]);
      const units = parseInt(acqMatch[5]);
      const rentPsf = acqMatch[6] ? parseFloat(acqMatch[6]) : 0;
      const meetsVU = vintage >= minVintage && units >= minUnits;
      result.properties.push({
        isQualifying: meetsVU && (criteria?.rentMetric === 'psf' ? rentPsf >= (criteria?.minRentValue ?? 1.75) : rentPsf > 0),
        meetsVintageUnits: meetsVU,
        propertyName: acqMatch[2].trim(),
        address: acqMatch[2].trim(),  // inline format has no separate address line
        rentPerSqft: rentPsf,
        vintage,
        units,
        distance: parseFloat(acqMatch[3])
      });
    }
    // Parse AVG/HIGH summary from this format
    const avgRentPSFMatch = notes.match(/AVG RENT\/SQFT:\s*\$?([\d.]+)/i);
    const highRentPSFMatch = notes.match(/AVG RENT\/SQFT:[^|]+\|\s*HIGH:\s*\$?([\d.]+)/i);
    const avgRentUnitMatch = notes.match(/AVG RENT\/UNIT:\s*\$?([\d,]+)/i);
    const highRentUnitMatch = notes.match(/AVG RENT\/UNIT:[^|]+\|\s*HIGH:\s*\$?([\d,]+)/i);
    if (avgRentPSFMatch) {
      result.allCandidatesMetrics = {
        avgRentPSF: parseFloat(avgRentPSFMatch[1]),
        topRentPSF: highRentPSFMatch ? parseFloat(highRentPSFMatch[1]) : 0,
        avgRentPerUnit: avgRentUnitMatch ? parseFloat(avgRentUnitMatch[1].replace(',', '')) : 0,
        topRentPerUnit: highRentUnitMatch ? parseFloat(highRentUnitMatch[1].replace(',', '')) : 0,
      };
    }
  }

  // Parse summary for "No apartment buildings found" case
  // Format: "Total Properties: X\nApartment Buildings: 0\nResidential Properties: X"
  const noApartmentsMatch = notes.match(/Total Properties:\s*(\d+)\nApartment Buildings:\s*0\nResidential Properties:\s*(\d+)/);
  if (noApartmentsMatch) {
    result.summary.totalFound = parseInt(noApartmentsMatch[1]);
    result.summary.metCriteria = 0;
    result.summary.qualifying = 0;
    result.summary.noApartmentsFound = true;
    result.summary.residentialCount = parseInt(noApartmentsMatch[2]);
  }

  // ── Post-processing: derive counts from parsed properties ONLY when regex didn't find them ──
  // Never overwrite a correctly-parsed header value — that would replace e.g. "1 qualifying"
  // with a count derived from per-property isQualifying flags (which may be stale/incorrect).
  if (result.properties.length > 0) {
    if (!totalFromRegex && result.summary.totalFound === 0) {
      result.summary.totalFound = result.properties.length;
    }
    if (!criteriaFromRegex) {
      result.summary.metCriteria = result.properties.filter(p => p.meetsVintageUnits).length;
    }
    if (!qualifyFromRegex) {
      // qualifying must be a subset of met criteria — cap it accordingly
      const qualCount = result.properties.filter(p => p.isQualifying && p.meetsVintageUnits).length;
      result.summary.qualifying = Math.min(qualCount, result.summary.metCriteria);
    }
  }

  // Final sanity: qualifying can never exceed met criteria
  result.summary.qualifying = Math.min(result.summary.qualifying, result.summary.metCriteria);

  return result;
}

interface SubjectProperty {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  acres?: number;
  proposedUnits?: number;
}

interface ClassificationCriteria {
  minVintage: number;
  minUnits: number;
  rentMetric: 'psf' | 'gross';
  minRentValue: number;
  vintageUnitsLabel: string;
  rentLabel: string;
}

function isBtrType(productType?: string): boolean {
  if (!productType) return false;
  const pt = productType.toLowerCase();
  return pt.includes('btr') || pt.includes('build-to-rent') || pt.includes('lot') ||
         pt.includes('townhome') || pt.includes('single family');
}

function getCriteria(productType?: string): ClassificationCriteria {
  if (isBtrType(productType)) {
    return {
      minVintage: 2015,
      minUnits: 25,
      rentMetric: 'gross',
      minRentValue: 2000,
      vintageUnitsLabel: '2015+ / 25+ units',
      rentLabel: '+ $2,000+/unit',
    };
  }
  return {
    minVintage: 2020,
    minUnits: 150,
    rentMetric: 'psf',
    minRentValue: 1.75,
    vintageUnitsLabel: '2020+ / 150+ units',
    rentLabel: '+ $1.75+/sqft',
  };
}

function isLegitPreamble(text: string): boolean {
  const t = text.trim();
  return (
    t.includes('OUTSIDE target acquisition markets') ||
    t.includes('QCT OVERRIDE') ||
    t.includes('NOTE:') ||
    t.startsWith('⚠️') ||
    t.startsWith('🏘️') ||
    t.startsWith('ℹ️') ||
    (t.length < 350 && !t.startsWith('SUBJECT PROPERTY:') && !/^(The property|Based on|Classification:)/i.test(t))
  );
}

interface ComparablesDisplayProps {
  notes: string;
  isError?: boolean;
  subjectProperty?: SubjectProperty;
  comparablesJson?: any[];
  productType?: string;
  dataAsOf?: Date | string | null;
}

function buildFromComparablesJson(comparablesJson: any[], criteria: ClassificationCriteria): ParsedComparables {
  const result: ParsedComparables = {
    summary: { totalFound: comparablesJson.length, metCriteria: 0, qualifying: 0 },
    properties: []
  };
  for (const comp of comparablesJson) {
    const vintage = comp.yearBuilt || 0;
    const units = comp.units || comp.unitCount || 0;
    const rentPsf = comp.rentPSF || comp.pricePerSqFt || comp.rent_per_sqft || 0;
    const avgRentPerUnit = comp.avgRent || comp.avgRentPerUnit || 0;
    const meetsVU = vintage >= criteria.minVintage && units >= criteria.minUnits;
    let qualifies: boolean;
    if (meetsVU) {
      if (criteria.rentMetric === 'gross') {
        const hasRentData = avgRentPerUnit > 0;
        qualifies = hasRentData ? avgRentPerUnit >= criteria.minRentValue : comp.isQualifying === true;
      } else {
        const hasRentData = rentPsf > 0;
        qualifies = hasRentData ? rentPsf >= criteria.minRentValue : comp.isQualifying === true;
      }
    } else {
      qualifies = false;
    }
    result.properties.push({
      isQualifying: qualifies,
      meetsVintageUnits: meetsVU,
      propertyName: comp.propertyName || comp.name || undefined,
      address: comp.address || '',
      city: comp.city || null,
      state: comp.state || null,
      zipCode: comp.zipCode || null,
      rentPerSqft: rentPsf,
      vintage,
      units,
      distance: comp.distance || 0,
      avgRentPerUnit,
      latitude: comp.latitude ?? null,
      longitude: comp.longitude ?? null,
      propertyType: comp.propertyType || null,
      vacancyRate: comp.vacancyRate ?? null,
      developer: comp.developer || null,
      owner: comp.owner || null,
      buildingSize: comp.buildingSize || null,
      stories: comp.stories ?? null,
      unitMix: comp.unitMix ?? null,
      leasedPct: comp.leasedPct ?? null,
      leasedPctChange: comp.leasedPctChange ?? null,
      exposure: comp.exposure ?? null,
      exposureChange: comp.exposureChange ?? null,
      unitsVacant: comp.unitsVacant ?? null,
      unitsExposed: comp.unitsExposed ?? null,
      websiteUrl: comp.websiteUrl ?? null
    } as any);
  }
  result.summary.metCriteria = result.properties.filter(p => p.meetsVintageUnits).length;
  result.summary.qualifying = result.properties.filter(p => p.isQualifying).length;

  // Compute rent metrics from candidate and qualifying subsets
  const candidates = result.properties.filter(p => p.meetsVintageUnits);
  const qualifying = result.properties.filter(p => p.isQualifying);

  if (candidates.length > 0) {
    const psfs = candidates.map(p => p.rentPerSqft).filter(v => v > 0);
    const units = candidates.map(p => (p as any).avgRentPerUnit || 0).filter(v => v > 0);
    result.allCandidatesMetrics = {
      topRentPSF: psfs.length > 0 ? Math.max(...psfs) : 0,
      avgRentPSF: psfs.length > 0 ? psfs.reduce((a, b) => a + b, 0) / psfs.length : 0,
      topRentPerUnit: units.length > 0 ? Math.max(...units) : 0,
      avgRentPerUnit: units.length > 0 ? units.reduce((a, b) => a + b, 0) / units.length : 0,
    };
  }

  if (qualifying.length > 0) {
    const psfs = qualifying.map(p => p.rentPerSqft).filter(v => v > 0);
    const units = qualifying.map(p => (p as any).avgRentPerUnit || 0).filter(v => v > 0);
    result.qualifyingMetrics = {
      topRentPSF: psfs.length > 0 ? Math.max(...psfs) : 0,
      avgRentPSF: psfs.length > 0 ? psfs.reduce((a, b) => a + b, 0) / psfs.length : 0,
      topRentPerUnit: units.length > 0 ? Math.max(...units) : 0,
      avgRentPerUnit: units.length > 0 ? units.reduce((a, b) => a + b, 0) / units.length : 0,
    };
  }

  return result;
}

export function ComparablesDisplay({ notes, isError, subjectProperty, comparablesJson, productType, dataAsOf }: ComparablesDisplayProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedProp, setSelectedProp] = useState<ComparableProperty | null>(null);
  const criteria = getCriteria(productType);
  let parsed = parseComparableNotes(notes, criteria);

  // Extract a "notes preamble" — any content before the first property listing or summary line.
  // This captures MSA warnings, QCT notices, etc. so they can be shown as a banner even when
  // the rest of the display is driven by comparablesJson.
  const hasCompsJsonFallback = comparablesJson && comparablesJson.length > 0;
  let notesPreamble: string | null = null;
  if (notes && notes.trim()) {
    // The verbose listing always begins with "Found X total comparables" or a property block
    const listingStartPattern = /(?:Found \d+ total comparables?|Found \d+ comparable propert|\d+\.\s+(?:QUALIFIES|DOES NOT QUALIFY)|ALL CANDIDATES|QUALIFYING COMPARABLES METRICS)/;
    const listingStart = notes.search(listingStartPattern);
    if (listingStart > 0) {
      const preamble = notes.substring(0, listingStart).trim();
      // Only surface the preamble as an "Analysis Note" banner when it's a legitimate notice
      // (MSA warning, QCT override, emoji-prefixed note), NOT when it's AI reasoning text
      // ("SUBJECT PROPERTY: ..." or "The property meets...") — those would mislead analysts.
      if (preamble.length > 0 && isLegitPreamble(preamble)) notesPreamble = preamble;
    } else if (!notes.includes('Address:') && !notes.includes('Rent/sqft:')) {
      // Entire notes is non-listing content. Only show as a preamble banner when it's an
      // EXPLICIT structured notice (MSA warning, QCT override, ⚠️ flags, etc.).
      const candidate = notes.trim();
      const isExplicitNotice =
        candidate.includes('OUTSIDE target acquisition markets') ||
        candidate.includes('QCT OVERRIDE') ||
        candidate.includes('NOTE:') ||
        candidate.startsWith('⚠️') ||
        candidate.startsWith('🏘️') ||
        candidate.startsWith('ℹ️');

      if (isExplicitNotice) {
        // Always show explicit structured notices regardless of comparablesJson
        notesPreamble = candidate;
      } else if (!hasCompsJsonFallback && isLegitPreamble(candidate)) {
        // No comparablesJson to fall back on — show any recognisable non-AI-reasoning text
        // (e.g. "No comparables found within 4 miles")
        notesPreamble = candidate;
      }
      // If comparablesJson is driving the display, suppress non-explicit text entirely —
      // it is likely legacy AI reasoning that would mislead the analyst.
    }
  }

  // Always prefer comparablesJson for the property card list — it has all the enriched fields
  // (vacancy, developer, owner, propertyType). The text notes provide summary stats only.
  // When notes fail to parse (AI reasoning, acquisition format, etc.), comparablesJson is the fallback.
  if (comparablesJson && comparablesJson.length > 0) {
    const jsonParsed = buildFromComparablesJson(comparablesJson, criteria);
    if (!parsed) {
      // Notes failed to parse (non-listing content) — use JSON as fallback
      parsed = jsonParsed;
    } else {
      // Keep text-derived summary stats (more accurate counts), but use json for property cards
      parsed.properties = jsonParsed.properties;
      if (!parsed.allCandidatesMetrics && jsonParsed.allCandidatesMetrics) parsed.allCandidatesMetrics = jsonParsed.allCandidatesMetrics;
      if (!parsed.qualifyingMetrics && jsonParsed.qualifyingMetrics) parsed.qualifyingMetrics = jsonParsed.qualifyingMetrics;
    }
  } else if (parsed && parsed.properties.length === 0) {
    // No comparablesJson at all — nothing extra to merge
  }

  // If error, show error state with raw notes
  if (isError) {
    return (
      <div className="text-sm whitespace-pre-wrap leading-relaxed text-amber-800">
        {notes}
      </div>
    );
  }

  // If no notes or parsing fails, try to build from comparablesJson fallback
  if (!notes || !notes.trim() || !parsed) {
    if (comparablesJson && comparablesJson.length > 0) {
      parsed = buildFromComparablesJson(comparablesJson, criteria);
    } else {
      // If we have notes text (even non-parseable), show it as a contextual message
      // This handles cases like acquisition deal notes ("No comparable properties found within 4 miles")
      // that don't match the standard "Address: / Rent/sqft:" format
      const hasRawNotes = notes && notes.trim().length > 0;
      const noCompsPattern = /no comparable properties found|no comparables found|0 comparable|no apartment buildings found/i;
      const isExplicitNoComps = hasRawNotes && noCompsPattern.test(notes);
      // Detect legacy AI reasoning stored in comparableNotes before Feb 2026 fix.
      // These notes start with "SUBJECT PROPERTY:" or "Based on" / "Classification:" — they
      // are not actual HelloData listings and should not be rendered as "Comparable Search Result".
      const isAIReasoning = hasRawNotes && (
        notes.startsWith('SUBJECT PROPERTY:') ||
        /^(The property|Based on|Classification:)/i.test(notes.trim()) ||
        (notes.includes('Classification:') && !notes.includes('Address:') && !notes.includes('Rent/sqft:'))
      );

      return (
        <div className="space-y-4">
          {hasRawNotes ? (
            isAIReasoning ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold mb-1">
                  <Database className="h-4 w-4" />
                  Comparable Data Unavailable
                </div>
                <p className="text-amber-600 text-xs">
                  This deal was analyzed before detailed comparable data was stored separately. Re-run analysis to fetch current property-level comparables.
                </p>
              </div>
            ) : (
            <div className={`border rounded-lg p-4 ${isExplicitNoComps ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className={`flex items-center gap-2 text-sm font-semibold mb-2 ${isExplicitNoComps ? 'text-amber-700' : 'text-gray-700'}`}>
                <Database className="h-4 w-4" />
                {isExplicitNoComps ? 'No Comparable Properties Found' : 'Comparable Search Result'}
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-wrap text-gray-600">{notes}</p>
              <p className={`text-xs mt-2 ${isExplicitNoComps ? 'text-amber-600' : 'text-gray-500'}`}>
                {isExplicitNoComps
                  ? 'No matching properties were found. Try re-running analysis or searching manually.'
                  : 'Re-run analysis to fetch fresh comparable data.'}
              </p>
            </div>
            )
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
                <Database className="h-5 w-5" />
                No HelloData Coverage
              </div>
              <p className="text-red-600 text-sm mt-2">
                HelloData does not have apartment data indexed for this area. This doesn't mean there are no apartments nearby - just that HelloData's database lacks coverage here.
              </p>
              <p className="text-red-500 text-xs mt-2">
                Try running "Re-Run Analysis" to fetch fresh data, or manually search for comparables in this market.
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">0</div>
              <div className="text-xs text-gray-600">Total Found</div>
            </div>
            <div className="bg-blue-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-800">0</div>
              <div className="text-xs text-blue-600">Met Criteria</div>
              <div className="text-[10px] text-blue-500">{criteria.vintageUnitsLabel}</div>
            </div>
            <div className="bg-green-100 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-800">0</div>
              <div className="text-xs text-green-600">Qualifying</div>
              <div className="text-[10px] text-green-500">{criteria.rentLabel}</div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Filter properties into three tiers
  const allProperties = parsed.properties;
  const metCriteriaProperties = parsed.properties.filter(p => p.meetsVintageUnits);
  const qualifyingProperties = parsed.properties.filter(p => p.isQualifying);

  // Get filtered properties based on active filter
  const getFilteredProperties = () => {
    switch (activeFilter) {
      case 'qualifying':
        return qualifyingProperties;
      case 'met':
        return metCriteriaProperties;
      case 'all':
      default:
        return allProperties;
    }
  };

  const filteredProperties = getFilteredProperties();
  // Use actual property counts when available, fall back to parsed summary counts
  const totalCount = allProperties.length || parsed.summary.totalFound;
  const metCount = metCriteriaProperties.length || parsed.summary.metCriteria;
  const qualifyingCount = qualifyingProperties.length || parsed.summary.qualifying;

  // Only show "No Coverage" when HelloData truly had no data (not when it searched and found nothing qualifying)
  const noHelloDataCoverage = totalCount === 0 && parsed.summary.totalFound === 0 && !(notes || '').includes('total properties checked') && !(notes || '').includes('qualifying comparables found');

  // Reliable signal that notes contain an actual HelloData verbose listing (not AI reasoning).
  // Real HelloData summaries say "Found X total comparables"; AI reasoning says "Found X qualifying comparables".
  const hasActualListingHeader = (notes || '').includes('total comparables') || (notes || '').includes('total properties checked');

  const dataAsOfLabel = dataAsOf
    ? (() => {
        const d = dataAsOf instanceof Date ? dataAsOf : new Date(dataAsOf);
        return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      })()
    : null;

  return (
    <div className="space-y-4">
      {/* Data freshness timestamp */}
      {dataAsOfLabel && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <Clock className="h-3 w-3 flex-shrink-0" />
          <span>Data pulled: {dataAsOfLabel}</span>
        </div>
      )}

      {/* HelloData Coverage Warning */}
      {noHelloDataCoverage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
            <Database className="h-4 w-4" />
            No HelloData Coverage
          </div>
          <p className="text-red-600 text-xs mt-1">
            HelloData does not have apartment data indexed for this area. This doesn't mean there are no apartments nearby - just that HelloData's database lacks coverage here.
          </p>
        </div>
      )}

      {/* Notes preamble banner — shows MSA warnings, QCT notices, etc. that precede the actual listing */}
      {notesPreamble && !noHelloDataCoverage && allProperties.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium mb-1">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            Analysis Note
          </div>
          <p className="text-amber-700 text-xs leading-relaxed whitespace-pre-wrap">{notesPreamble}</p>
        </div>
      )}

      {/* Summary-only note (no individual property details parsed from a real HelloData listing) */}
      {!noHelloDataCoverage && allProperties.length === 0 && parsed.summary.totalFound > 0 && hasActualListingHeader && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            {parsed.summary.qualifying > 0 
              ? `${parsed.summary.qualifying} Qualifying Comparable${parsed.summary.qualifying > 1 ? 's' : ''} Found`
              : 'No Qualifying Comparables'}
          </div>
          <p className="text-amber-600 text-xs mt-1">
            {parsed.summary.totalFound} propert{parsed.summary.totalFound === 1 ? 'y' : 'ies'} checked
            {parsed.summary.metCriteria > 0 ? `, ${parsed.summary.metCriteria} met vintage/units criteria` : ''}
            {parsed.summary.qualifying === 0 ? ' but none met rent requirements' : ''}.
            {' '}Re-run analysis to fetch detailed comparable data.
          </p>
        </div>
      )}

      {/* Legacy AI reasoning note — count from AI text, not actual property listings */}
      {!noHelloDataCoverage && allProperties.length === 0 && parsed.summary.totalFound > 0 && !hasActualListingHeader && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            Comparable Data Unavailable
          </div>
          <p className="text-amber-600 text-xs mt-1">
            This deal was analyzed before individual property details were stored separately. Re-run analysis to fetch current property-level comparables.
          </p>
        </div>
      )}

      {/* Area Fallback Notice */}
      {parsed.summary.isAreaFallback && (
        <div className="bg-orange-100 border border-orange-300 rounded-lg p-3">
          <div className="flex items-center gap-2 text-orange-800 text-sm font-medium">
            <MapPin className="h-4 w-4" />
            Area-Based Search
          </div>
          {parsed.summary.fallbackNote && (
            <p className="text-orange-700 text-xs mt-1">{parsed.summary.fallbackNote}</p>
          )}
        </div>
      )}

      {/* Clickable Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <button 
          onClick={() => setActiveFilter('all')}
          className={`rounded-lg p-3 text-center transition-all cursor-pointer ${
            activeFilter === 'all' 
              ? 'bg-gray-200 ring-2 ring-gray-400 shadow-sm' 
              : 'bg-gray-100 hover:bg-gray-150'
          }`}
          data-testid="stat-all"
        >
          <div className="text-2xl font-bold text-gray-800">{totalCount}</div>
          <div className="text-xs text-gray-600">Total Found</div>
          {activeFilter === 'all' && <div className="text-[10px] text-gray-500 mt-1">▼ Showing</div>}
        </button>
        <button 
          onClick={() => setActiveFilter('met')}
          className={`rounded-lg p-3 text-center transition-all cursor-pointer ${
            activeFilter === 'met' 
              ? 'bg-blue-200 ring-2 ring-blue-400 shadow-sm' 
              : 'bg-blue-100 hover:bg-blue-150'
          }`}
          data-testid="stat-met-criteria"
        >
          <div className="text-2xl font-bold text-blue-800">{metCount}</div>
          <div className="text-xs text-blue-600">Met Criteria</div>
          <div className="text-[10px] text-blue-500">{criteria.vintageUnitsLabel}</div>
          {activeFilter === 'met' && <div className="text-[10px] text-blue-600 mt-1">▼ Showing</div>}
        </button>
        <button 
          onClick={() => setActiveFilter('qualifying')}
          className={`rounded-lg p-3 text-center transition-all cursor-pointer ${
            activeFilter === 'qualifying' 
              ? 'bg-green-200 ring-2 ring-green-400 shadow-sm' 
              : 'bg-green-100 hover:bg-green-150'
          }`}
          data-testid="stat-qualifying"
        >
          <div className="text-2xl font-bold text-green-800">{qualifyingCount}</div>
          <div className="text-xs text-green-600">Qualifying</div>
          <div className="text-[10px] text-green-500">{criteria.rentLabel}</div>
          {activeFilter === 'qualifying' && <div className="text-[10px] text-green-600 mt-1">▼ Showing</div>}
        </button>
      </div>

      {/* Rent Metrics Comparison */}
      {(parsed.allCandidatesMetrics || parsed.qualifyingMetrics) && (
        <div className="grid grid-cols-2 gap-3">
          {parsed.allCandidatesMetrics && (
            <Card className="bg-gray-50 border-gray-200">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  All Candidates
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Top PSF:</span>
                    <span className="ml-1 font-semibold">${parsed.allCandidatesMetrics.topRentPSF.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg PSF:</span>
                    <span className="ml-1 font-semibold">${parsed.allCandidatesMetrics.avgRentPSF.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Top/Unit:</span>
                    <span className="ml-1 font-semibold">${parsed.allCandidatesMetrics.topRentPerUnit.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg/Unit:</span>
                    <span className="ml-1 font-semibold">${parsed.allCandidatesMetrics.avgRentPerUnit.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {parsed.qualifyingMetrics && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-semibold text-green-700 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Qualifying Only
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-green-600">Top PSF:</span>
                    <span className="ml-1 font-semibold text-green-800">${parsed.qualifyingMetrics.topRentPSF.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-green-600">Avg PSF:</span>
                    <span className="ml-1 font-semibold text-green-800">${parsed.qualifyingMetrics.avgRentPSF.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-green-600">Top/Unit:</span>
                    <span className="ml-1 font-semibold text-green-800">${parsed.qualifyingMetrics.topRentPerUnit.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-green-600">Avg/Unit:</span>
                    <span className="ml-1 font-semibold text-green-800">${parsed.qualifyingMetrics.avgRentPerUnit.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Subject Property Card */}
      {subjectProperty && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Home className="h-4 w-4 text-red-600" />
            <h4 className="text-sm font-semibold text-red-800">Subject Property</h4>
          </div>
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-red-900">{subjectProperty.address}</span>
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px] py-0">
                Subject
              </Badge>
            </div>
            <div className="text-gray-600 text-xs mt-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {[subjectProperty.city, subjectProperty.state, subjectProperty.zip].filter(Boolean).join(', ')}
            </div>
            <div className="flex gap-3 text-xs text-gray-600 mt-2">
              {subjectProperty.proposedUnits && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {subjectProperty.proposedUnits} proposed units
                </span>
              )}
              {subjectProperty.acres && (
                <span className="flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  {subjectProperty.acres} acres
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtered Properties List */}
      {filteredProperties.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2">
            {activeFilter === 'qualifying' && <CheckCircle className="h-4 w-4 text-green-600" />}
            {activeFilter === 'met' && <Filter className="h-4 w-4 text-blue-600" />}
            {activeFilter === 'all' && <Building2 className="h-4 w-4 text-gray-600" />}
            <h4 className={`text-sm font-semibold ${
              activeFilter === 'qualifying' ? 'text-green-800' : 
              activeFilter === 'met' ? 'text-blue-800' : 'text-gray-800'
            }`}>
              {activeFilter === 'qualifying' && `Qualifying Properties (${filteredProperties.length})`}
              {activeFilter === 'met' && `Met Criteria (${filteredProperties.length}) — ${criteria.vintageUnitsLabel}`}
              {activeFilter === 'all' && `All Properties (${filteredProperties.length})`}
            </h4>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredProperties.map((prop, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedProp(prop)}
                className={`bg-white border rounded-lg p-2 text-xs cursor-pointer transition-shadow hover:shadow-md ${
                  prop.isQualifying && prop.meetsVintageUnits
                    ? 'border-green-300 bg-green-50 hover:border-green-400' 
                    : prop.meetsVintageUnits 
                      ? 'border-blue-200 bg-blue-50 hover:border-blue-300' 
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {prop.propertyName && (
                      <span className="font-semibold text-gray-900">{prop.propertyName}</span>
                    )}
                    {prop.isQualifying && prop.meetsVintageUnits && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] py-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Qualifying
                      </Badge>
                    )}
                    {prop.meetsVintageUnits && !prop.isQualifying && (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px] py-0">
                        Met Criteria
                      </Badge>
                    )}
                    {!prop.meetsVintageUnits && (
                      <Badge variant="outline" className="text-[10px] py-0 text-gray-500">
                        Below Threshold
                      </Badge>
                    )}
                    {prop.isTopRent && (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-[10px] py-0">
                        <Star className="h-3 w-3 mr-1 fill-yellow-500" />
                        Top Rent
                      </Badge>
                    )}
                  </div>
                  <span className="text-gray-500">{prop.distance.toFixed(1)} mi</span>
                </div>
                <div className="text-gray-600 mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {prop.address}
                </div>
                <div className="flex gap-3 mt-1 text-gray-500 flex-wrap">
                  {!prop.meetsVintageUnits ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-gray-400 italic text-xs cursor-help">No rent data</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Pricing is only fetched for properties meeting age/size criteria ({criteria.minVintage}+ vintage, {criteria.minUnits}+ units). This property doesn't meet those thresholds.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : prop.rentPerSqft > 0 ? (
                    <span className={prop.isQualifying ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      ${prop.rentPerSqft.toFixed(2)}/sf
                      {(prop.avgRentPerUnit ?? 0) > 0 && (
                        <span className="text-gray-500 font-normal ml-1">(${(prop.avgRentPerUnit!).toLocaleString()}/mo)</span>
                      )}
                    </span>
                  ) : (prop.avgRentPerUnit ?? 0) > 0 ? (
                    <span className={prop.isQualifying ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      ${(prop.avgRentPerUnit!).toLocaleString()}/mo
                    </span>
                  ) : (
                    <span className="text-gray-400 italic text-xs">No rent data</span>
                  )}
                  <span>Built {prop.vintage || 'N/A'}</span>
                  <span>{prop.units || 'N/A'} units</span>
                  {prop.propertyType && (
                    <span className="capitalize text-gray-400">{prop.propertyType}</span>
                  )}
                  {prop.vacancyRate !== null && prop.vacancyRate !== undefined && (
                    <span className={prop.vacancyRate > 10 ? "text-amber-600" : "text-gray-500"}>
                      {prop.vacancyRate.toFixed(1)}% vacant
                    </span>
                  )}
                </div>
                {(prop.developer || prop.owner) && (
                  <div className="flex gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                    {prop.developer && (
                      <span><span className="font-medium text-gray-500">Dev:</span> {prop.developer}</span>
                    )}
                    {prop.owner && (
                      <span><span className="font-medium text-gray-500">Owner:</span> {prop.owner}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for filter */}
      {filteredProperties.length === 0 && totalCount > 0 && (
        <div className="border-t pt-3">
          <div className={`text-center py-4 rounded-lg ${
            activeFilter === 'qualifying' ? 'bg-green-50 text-green-700' : 
            activeFilter === 'met' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'
          }`}>
            <AlertTriangle className="h-5 w-5 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">
              {activeFilter === 'qualifying' && `No properties meet all qualifying criteria (${criteria.rentLabel.replace('+ ', '')})`}
              {activeFilter === 'met' && `No properties meet vintage/units criteria (${criteria.vintageUnitsLabel})`}
              {activeFilter === 'all' && 'No properties found'}
            </p>
            <p className="text-xs mt-1 opacity-75">
              Click another tab to see available properties
            </p>
          </div>
        </div>
      )}

      {/* If no properties parsed, show criteria note */}
      {parsed.properties.length === 0 && parsed.summary.totalFound > 0 && (
        <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-600">
          <p className="font-medium">Criteria: {criteria.minVintage}+ vintage, {criteria.minUnits}+ units, {criteria.rentMetric === 'psf' ? `$${criteria.minRentValue}/sqft` : `$${criteria.minRentValue.toLocaleString()}/unit`} rent</p>
          <p className="text-xs mt-1">
            {parsed.summary.metCriteria} properties met vintage/units criteria but 
            {parsed.summary.qualifying === 0 ? ` none met the ${criteria.rentMetric === 'psf' ? `$${criteria.minRentValue}/sqft` : `$${criteria.minRentValue.toLocaleString()}/unit`} rent threshold.` : ""}
          </p>
        </div>
      )}

      {/* Comparable Detail Dialog */}
      <Dialog open={!!selectedProp} onOpenChange={(open) => { if (!open) setSelectedProp(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-gray-600" />
              {selectedProp?.propertyName || 'Comparable Property'}
            </DialogTitle>
          </DialogHeader>
          {selectedProp && (
            <div className="space-y-4 text-sm overflow-y-auto pr-1">
              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                {selectedProp.isQualifying && selectedProp.meetsVintageUnits && (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Qualifying Comp
                  </Badge>
                )}
                {selectedProp.meetsVintageUnits && !selectedProp.isQualifying && (
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Met Criteria</Badge>
                )}
                {!selectedProp.meetsVintageUnits && (
                  <Badge variant="outline" className="text-gray-500">Below Threshold</Badge>
                )}
                {selectedProp.isTopRent && (
                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                    <Star className="h-3 w-3 mr-1 fill-yellow-500" />
                    Top Rent
                  </Badge>
                )}
              </div>

              {/* Location */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</p>
                <div className="flex items-start gap-2 text-gray-700">
                  <MapPin className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
                  <div>
                    <div>{selectedProp.address || '—'}</div>
                    {(selectedProp.city || selectedProp.state) && (
                      <div className="text-gray-500 text-xs mt-0.5">
                        {[selectedProp.city, selectedProp.state, selectedProp.zipCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                {(selectedProp.latitude || selectedProp.longitude) && (
                  <div className="flex items-center gap-2 text-gray-400 text-xs ml-6">
                    <Navigation className="h-3 w-3" />
                    <span>{selectedProp.latitude?.toFixed(5)}, {selectedProp.longitude?.toFixed(5)}</span>
                  </div>
                )}
                {selectedProp.websiteUrl && (
                  <div className="flex items-center gap-2 text-xs ml-6">
                    <span className="text-gray-400">🔗</span>
                    <a
                      href={selectedProp.websiteUrl.startsWith('http') ? selectedProp.websiteUrl : `https://${selectedProp.websiteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline truncate max-w-[280px]"
                    >
                      {selectedProp.websiteUrl}
                    </a>
                  </div>
                )}
              </div>

              {/* Property Details */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Property Details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Year Built</span>
                    <span className="font-medium ml-auto">{selectedProp.vintage || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Home className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Units</span>
                    <span className="font-medium ml-auto">{selectedProp.units || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Type</span>
                    <span className="font-medium ml-auto capitalize">{selectedProp.propertyType || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Navigation className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Distance</span>
                    <span className="font-medium ml-auto">{selectedProp.distance.toFixed(2)} mi</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Stories</span>
                    <span className="font-medium ml-auto">{selectedProp.stories ? `${selectedProp.stories} fl.` : '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Home className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Bldg Size</span>
                    <span className="font-medium ml-auto">
                      {(selectedProp.buildingSize ?? 0) > 0 ? `${(selectedProp.buildingSize!).toLocaleString()} sf` : '—'}
                    </span>
                  </div>
                  {(selectedProp.buildingSize ?? 0) > 0 && selectedProp.units > 0 && (
                    <div className="flex items-center gap-2 text-gray-700 col-span-2">
                      <Home className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-500 text-xs">Avg Unit Size</span>
                      <span className="font-medium ml-auto">~{Math.round(selectedProp.buildingSize! / selectedProp.units).toLocaleString()} sf/unit</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rent / Financials */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rent / Financials</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2 text-gray-700">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Rent PSF</span>
                    <span className={`font-medium ml-auto ${selectedProp.rentPerSqft >= (criteria.rentMetric === 'psf' ? criteria.minRentValue : 0) ? 'text-green-600' : selectedProp.rentPerSqft > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {selectedProp.rentPerSqft > 0 ? `$${selectedProp.rentPerSqft.toFixed(2)}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Avg Rent/Unit</span>
                    <span className={`font-medium ml-auto ${(selectedProp.avgRentPerUnit ?? 0) > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                      {(selectedProp.avgRentPerUnit ?? 0) > 0 ? `$${(selectedProp.avgRentPerUnit ?? 0).toLocaleString()}/mo` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <BarChart2 className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Vacancy</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`font-medium ml-auto cursor-help flex items-center gap-1 ${selectedProp.vacancyRate != null && selectedProp.vacancyRate > 10 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {selectedProp.vacancyRate != null ? `${selectedProp.vacancyRate.toFixed(1)}%` : '—'}
                            {((selectedProp as any).unitsVacant != null || (selectedProp as any).unitsExposed != null || (selectedProp as any).exposureChange != null) && (
                              <Info className="h-3 w-3 text-gray-400" />
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs space-y-1 max-w-[220px]">
                          {(selectedProp as any).unitsVacant != null && (
                            <div>Vacant units: <strong>{(selectedProp as any).unitsVacant}</strong></div>
                          )}
                          {(selectedProp as any).unitsExposed != null && (
                            <div>Units exposed (6 mo): <strong>{(selectedProp as any).unitsExposed}</strong></div>
                          )}
                          {(selectedProp as any).exposureChange != null && (
                            <div>
                              30-day change:{' '}
                              <strong className={(selectedProp as any).exposureChange > 0 ? 'text-red-400' : 'text-green-400'}>
                                {(selectedProp as any).exposureChange > 0 ? '+' : ''}{((selectedProp as any).exposureChange as number).toFixed(1)}%
                              </strong>
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 text-xs">Leased</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`font-medium ml-auto cursor-help flex items-center gap-1 ${selectedProp.leasedPct == null ? 'text-gray-400' : selectedProp.leasedPct < 90 ? 'text-amber-600' : 'text-green-600'}`}>
                            {selectedProp.leasedPct != null ? `${selectedProp.leasedPct.toFixed(1)}%` : '—'}
                            {(selectedProp as any).leasedPctChange != null && (
                              <Info className="h-3 w-3 text-gray-400" />
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs space-y-1 max-w-[220px]">
                          {(selectedProp as any).leasedPctChange != null && (
                            <div>
                              30-day change:{' '}
                              <strong className={(selectedProp as any).leasedPctChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                                {(selectedProp as any).leasedPctChange >= 0 ? '+' : ''}{((selectedProp as any).leasedPctChange as number).toFixed(1)}%
                              </strong>
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              {/* Unit Mix */}
              {selectedProp.unitMix && selectedProp.unitMix.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Mix</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b">
                        <th className="text-left py-1 font-medium">Type</th>
                        <th className="text-right py-1 font-medium"># Units</th>
                        <th className="text-right py-1 font-medium">Avg Rent</th>
                        <th className="text-right py-1 font-medium">Avg SF</th>
                        <th className="text-right py-1 font-medium">PSF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProp.unitMix.map((row) => (
                        <tr key={row.unitType} className="border-b border-gray-50">
                          <td className="py-1 font-medium text-gray-700">{row.unitType}</td>
                          <td className="py-1 text-right text-gray-500">{row.count > 0 ? row.count : '—'}</td>
                          <td className="py-1 text-right text-gray-700">${row.avgRent.toLocaleString()}</td>
                          <td className="py-1 text-right text-gray-500">{row.avgSqft > 0 ? `${row.avgSqft.toLocaleString()} sf` : '—'}</td>
                          <td className="py-1 text-right text-gray-500">{row.rentPSF > 0 ? `$${row.rentPSF.toFixed(2)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit Mix</p>
                  <p className="text-xs text-gray-400 italic">
                    Not available in HelloData for this property
                  </p>
                </div>
              )}

              {/* Missing fields notice — shown when HelloData has limited data for this comparable */}
              {(selectedProp.stories == null && selectedProp.leasedPct == null && selectedProp.vacancyRate == null && (selectedProp.buildingSize ?? 0) === 0) && (
                <div className={`rounded-md p-2 text-xs border ${selectedProp.rentPerSqft > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {selectedProp.rentPerSqft > 0
                    ? 'Stories, Building Size, Leased %, and Vacancy are not available in HelloData for this property. Rent data was successfully captured.'
                    : 'Detailed operating data (rent, vacancy, leased %) is not available for this property in HelloData — it may predate the data collection window.'}
                </div>
              )}

              {/* Ownership */}
              {(selectedProp.developer || selectedProp.owner) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ownership</p>
                  <div className="space-y-1">
                    {selectedProp.developer && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Hammer className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-500 text-xs">Developer</span>
                        <span className="font-medium ml-auto text-right">{selectedProp.developer}</span>
                      </div>
                    )}
                    {selectedProp.owner && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-500 text-xs">Owner</span>
                        <span className="font-medium ml-auto text-right">{selectedProp.owner}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Qualifying threshold reminder */}
              <div className="bg-gray-50 rounded-md p-2 text-xs text-gray-500 border">
                Qualifying threshold: {criteria.minVintage}+ vintage · {criteria.minUnits}+ units · {criteria.rentMetric === 'psf' ? `$${criteria.minRentValue}/sqft` : `$${criteria.minRentValue.toLocaleString()}/unit`} rent
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

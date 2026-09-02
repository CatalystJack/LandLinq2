import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, Link } from "wouter";
import Navigation from "@/components/navigation";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FastTextarea } from "@/components/ui/fast-textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { formatDateEST } from "@/utils/timezone";
import { formatFullAddress } from "@/utils/addressFormatter";
import { 
  FileText, 
  Download, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  Edit2,
  ArrowUpDown,
  Save,
  Search,
  Calculator,
  Plus,
  X,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  Zap,
  Loader2,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Info,
  Flag,
  Timer,
  Globe,
  Lock,
  DollarSign,
  BarChart3,
  ExternalLink,
  CheckCircle2,
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Map,
  Table2,
  MapPin,
  Mail,
  Building,
  User,
  Users,
  Paperclip,
  File,
  Image as ImageIcon,
  Settings,
  Filter,
  Check,
  List,
  Upload,
  FileUp,
  ClipboardPaste,
  Brain,
  FileSpreadsheet,
  GripVertical
} from "lucide-react";
import type { Deal, Broker, PublicListingData } from "@shared/schema";
import { formatDealNumber } from "@shared/schema";
import QuickDealAddition from "@/components/quick-property-evaluation";
import PropertyDataPanel from "@/components/property-data-panel";
import ComparablesMap from "@/components/comparables-map";
import { ComparablesDisplay } from "@/components/comparables-display";
import { SoilDataDisplay } from "@/components/soil-data-display";
import { LocationPickerMap } from "@/components/location-picker-map";
import ApiSafetyBanner from "@/components/api-safety-banner";
import { LIHTCScoreModal } from "@/components/lihtc-score-modal";
import { DealOverviewMap } from "@/components/deal-overview-map";

interface DealWithBroker extends Omit<Deal, 'publicListings'> {
  broker: Broker;
  publicListings?: PublicListingData;
  coordinates?: { lat: number; lng: number } | null;
}


// Column visibility configuration
const ALL_COLUMNS = [
  { key: 'id', label: 'ID', defaultVisible: true },
  { key: 'colStatus', label: 'Status', defaultVisible: true },
  { key: 'colApex', label: 'Apex', defaultVisible: true },
  { key: 'colApexNotes', label: 'Apex Notes', defaultVisible: true },
  { key: 'colPriority', label: 'Priority', defaultVisible: true },
  { key: 'colNext', label: 'Next', defaultVisible: true },
  { key: 'colStep', label: 'Step', defaultVisible: true },
  { key: 'propertyAddress', label: 'Property Address', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'yieldOnCost', label: 'YOC', defaultVisible: true },
  { key: 'automatedYoc', label: 'Auto YOC', defaultVisible: true },
  { key: 'irr', label: 'IRR', defaultVisible: true },
  { key: 'excelModel', label: 'Excel', defaultVisible: true },
  { key: 'reason', label: 'AI Reason', defaultVisible: true },
  { key: 'dealType', label: 'Deal', defaultVisible: true },
  { key: 'productTypes', label: 'Type', defaultVisible: true },
  { key: 'analystNotes', label: 'Analyst Notes', defaultVisible: true },
  { key: 'dealSummary', label: 'Summary', defaultVisible: true },
  { key: 'developerNotes', label: 'Developer Notes', defaultVisible: true },
  { key: 'notes', label: 'Broker Notes', defaultVisible: true },
  { key: 'topRentPerUnit', label: 'Top Rent/Unit', defaultVisible: true },
  { key: 'topRentPSF', label: 'Top Rent PSF', defaultVisible: true },
  { key: 'lihtc', label: 'LIHTC', defaultVisible: false },
  { key: 'qct', label: 'QCT', defaultVisible: true },
  { key: 'dda', label: 'DDA', defaultVisible: true },
  { key: 'oz', label: 'OZ', defaultVisible: true },
  { key: 'date', label: 'Date', defaultVisible: true },
  { key: 'brokerDocs', label: 'Broker Docs', defaultVisible: false },
  { key: 'analystDocs', label: 'Analyst Docs', defaultVisible: false },
  { key: 'comps', label: 'Comps', defaultVisible: true },
  { key: 'ncOnemap', label: 'NC Tax', defaultVisible: false },
  { key: 'pop55', label: '55+ Pop', defaultVisible: false },
  { key: 'income75k', label: '$75K+', defaultVisible: false },
  { key: 'juniorAnalyst', label: 'Junior Analyst', defaultVisible: false },
  { key: 'analyst', label: 'Analyst', defaultVisible: true },
  { key: 'dev', label: 'Dev', defaultVisible: false },
  { key: 'partner', label: 'Partner', defaultVisible: false },
  { key: 'price', label: 'Price', defaultVisible: true },
  { key: 'units', label: 'Units', defaultVisible: true },
  { key: 'maxUnitsZoning', label: 'Max Zoning Units', defaultVisible: true },
  { key: 'vintage', label: 'Vintage', defaultVisible: true },
  { key: 'acres', label: 'Acres', defaultVisible: true },
  { key: 'netDevelopableAcres', label: 'Net Dev Acres', defaultVisible: false },
  { key: 'dua', label: 'DUA', defaultVisible: false },
  { key: 'zoning', label: 'Zoning', defaultVisible: false },
  { key: 'wetlandNotes', label: 'Wetland/Environmental Notes', defaultVisible: false },
  { key: 'developerSummary', label: 'Developer Summary', defaultVisible: false },
  { key: 'entitlements', label: 'Entitlements', defaultVisible: false },
  { key: 'pricePerUnit', label: 'Price/Unit', defaultVisible: false },
  { key: 'sewer', label: 'Sewer', defaultVisible: false },
  { key: 'brokerName', label: 'Broker Name', defaultVisible: true },
  { key: 'brokerEmail', label: 'Broker Email', defaultVisible: false },
  { key: 'brokerPhone', label: 'Broker Phone', defaultVisible: true },
] as const;

type ColumnKey = typeof ALL_COLUMNS[number]['key'];

// Fixed columns always shown first, not user-reorderable
const FIXED_COLUMN_KEYS: readonly ColumnKey[] = [
  'id', 'colStatus', 'colApex', 'colApexNotes', 'colPriority', 'colNext', 'colStep', 'propertyAddress'
] as const;

// Reorderable columns — everything not in the fixed set
const REORDERABLE_COLUMNS = ALL_COLUMNS.filter(c => !(FIXED_COLUMN_KEYS as readonly string[]).includes(c.key));
type ReorderableColumnKey = Exclude<ColumnKey, 'id'|'colStatus'|'colApex'|'colApexNotes'|'colPriority'|'colNext'|'colStep'|'propertyAddress'>;

function getDefaultColumnOrder(): ReorderableColumnKey[] {
  try {
    const saved = localStorage.getItem('deal-table-column-order');
    if (saved) {
      const parsed = JSON.parse(saved) as ColumnKey[];
      const validKeys = new Set(REORDERABLE_COLUMNS.map(c => c.key));
      const filtered = parsed.filter((k): k is ReorderableColumnKey => validKeys.has(k));
      // append any new columns not in saved order
      const missing = REORDERABLE_COLUMNS.map(c => c.key as ReorderableColumnKey).filter(k => !filtered.includes(k));
      return [...filtered, ...missing];
    }
  } catch {}
  return REORDERABLE_COLUMNS.map(c => c.key as ReorderableColumnKey);
}

function getDefaultVisibleColumns(): Set<ColumnKey> {
  try {
    const saved = localStorage.getItem('deal-table-visible-columns');
    if (saved) {
      const parsed = JSON.parse(saved) as ColumnKey[];
      return new Set(parsed);
    }
  } catch {}
  return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
}

// Team members for dropdowns by role
const analysts = [
  "Austin Blondell"
];

const developers = [
  "John Bell",
  "Steve Hillebrand", 
  "Mallie Colavita"
];

const partners = [
  "AJ Klenk",
  "Brian Ford",
  "Ian Wagoner"
];

// Helper function to make URLs clickable in text
function linkifyText(text: string): JSX.Element[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex for next match
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part.length > 50 ? part.substring(0, 50) + '...' : part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

// AI Analysis Cell Component - shows AI-generated analysis for a deal
function AIAnalysisCell({ dealId }: { dealId: string }) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await fetch(`/api/ai-analysis/${dealId}`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setAnalysis(data);
        }
      } catch (error) {
        console.log('Could not fetch AI analysis:', error);
      }
    };
    fetchAnalysis();
  }, [dealId]);

  const generateAnalysis = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/ai-analysis/${dealId}/generate`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
        toast({ title: 'AI Analysis Generated', description: 'Analysis complete' });
      } else {
        toast({ title: 'Error', description: 'Could not generate analysis', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate analysis', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!analysis) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] transition-colors"
        onClick={generateAnalysis}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <><Loader2 size={10} className="mr-1 animate-spin" /> Analyzing</>
        ) : (
          <>Analyze</>
        )}
      </Button>
    );
  }

  const scoreColor = analysis.overallScore >= 70 ? 'text-green-600 bg-green-100' : 
                     analysis.overallScore >= 40 ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100';
  
  const recColors: Record<string, string> = {
    'pursue': 'bg-green-600',
    'high_priority': 'bg-green-600',
    'needs_review': 'bg-yellow-600',
    'pass': 'bg-red-600'
  };

  const isStale = analysis.generatedAt && analysis.dealUpdatedAt && 
    new Date(analysis.dealUpdatedAt) > new Date(analysis.generatedAt);

  return (
    <Dialog open={showPopover} onOpenChange={setShowPopover}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-6 px-2 text-xs flex items-center gap-1 ${scoreColor} border-0 cursor-pointer`}
        >
          <Brain size={10} />
          {analysis.overallScore}/100
          {isStale && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-1" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Brain size={18} className="text-blue-600" />
              AI Analysis
            </span>
            <div className="flex items-center gap-2">
              <Badge className={`${scoreColor} border-0 text-sm px-2 py-1`}>
                Score: {analysis.overallScore}/100
              </Badge>
              <Badge className={`${recColors[analysis.recommendation] || 'bg-gray-500'} text-white text-sm`}>
                {analysis.recommendation?.toUpperCase().replace('_', ' ') || 'N/A'}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isStale && (
          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
            <p className="text-sm text-orange-700">
              Deal data has been updated since this analysis was generated.
            </p>
            <Button
              size="sm"
              className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => { setShowPopover(false); generateAnalysis(); }}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Brain size={12} className="mr-1" />}
              Re-Analyze
            </Button>
          </div>
        )}

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            {analysis.quickSummary && (
              <p className="text-sm text-gray-700 italic bg-gray-50 p-3 rounded-lg border">
                {analysis.quickSummary}
              </p>
            )}

            {analysis.keyConsiderations?.length > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <h4 className="font-semibold text-sm text-[#07172A] mb-2">Key Considerations</h4>
                <ul className="space-y-1">
                  {analysis.keyConsiderations.map((k: string, i: number) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5 shrink-0">•</span> {k}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {analysis.pros?.length > 0 && (
              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <h4 className="font-semibold text-sm text-green-700 mb-2">Pros</h4>
                <ul className="space-y-2">
                  {analysis.pros.map((p: string, i: number) => {
                    const match = p.match(/^(.*?)\s*\[Evidence:\s*(.*?)\]$/s);
                    return (
                      <li key={i} className="text-sm text-gray-700">
                        <div className="flex items-start gap-1">
                          <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                          <span>{match ? match[1] : p}</span>
                        </div>
                        {match && match[2] && (
                          <div className="ml-4 mt-0.5 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded inline-block">
                            {match[2]}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {analysis.cons?.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                <h4 className="font-semibold text-sm text-yellow-700 mb-2">Cons</h4>
                <ul className="space-y-2">
                  {analysis.cons.map((c: string, i: number) => {
                    const match = c.match(/^(.*?)\s*\[Evidence:\s*(.*?)\]$/s);
                    return (
                      <li key={i} className="text-sm text-gray-700">
                        <div className="flex items-start gap-1">
                          <span className="text-yellow-500 mt-0.5 shrink-0">⚠</span>
                          <span>{match ? match[1] : c}</span>
                        </div>
                        {match && match[2] && (
                          <div className="ml-4 mt-0.5 text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded inline-block">
                            {match[2]}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {analysis.risks?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <h4 className="font-semibold text-sm text-red-700 mb-2">Risks</h4>
                <ul className="space-y-2">
                  {analysis.risks.map((r: string, i: number) => {
                    const match = r.match(/^(.*?)\s*\[Evidence:\s*(.*?)\]$/s);
                    return (
                      <li key={i} className="text-sm text-gray-700">
                        <div className="flex items-start gap-1">
                          <span className="text-red-500 mt-0.5 shrink-0">✕</span>
                          <span>{match ? match[1] : r}</span>
                        </div>
                        {match && match[2] && (
                          <div className="ml-4 mt-0.5 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded inline-block">
                            {match[2]}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {analysis.confidenceLevel && (
            <p className="text-xs text-gray-500 text-right">
              Confidence: {analysis.confidenceLevel}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to build Outlook search string with multiple fields
function buildOutlookSearchString(deal: any): string {
  const searchParts: string[] = [];
  
  // Add property address (street only)
  if (deal.address) {
    const streetAddress = deal.address.split(',')[0]?.trim();
    if (streetAddress) {
      searchParts.push(`"${streetAddress}"`);
    }
  }
  
  // Add property name if available (project name equivalent)
  if (deal.propertyName) {
    searchParts.push(`"${deal.propertyName}"`);
  }
  
  // Add broker email with from: prefix (exclude temp emails)
  if (deal.broker?.email && !deal.broker.email.includes('@temp.landlinq.ai')) {
    searchParts.push(`from:${deal.broker.email}`);
  }
  
  // Add broker name if available (firstName + lastName)
  const brokerName = [deal.broker?.firstName, deal.broker?.lastName].filter(Boolean).join(' ');
  if (brokerName) {
    searchParts.push(`"${brokerName}"`);
  }
  
  // Combine with OR for broader matching
  return searchParts.join(' OR ');
}

// Extract all numeric YOC values from an automatedYoc display string.
// Handles formats like "AA Cottages: 7.2% (preset)" and "A(3-Story): 5.4% | B(BTR): 7.6%"
function extractAutoYocNumbers(yocStr: string): number[] {
  const matches = yocStr.match(/~?(\d+\.?\d*)%/g) || [];
  return matches.map(m => parseFloat(m.replace(/[~%]/g, ''))).filter(n => !isNaN(n));
}

// Helper function to copy text to clipboard
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

export default function AnalystDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [filterClassifications, setFilterClassifications] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterDealTypes, setFilterDealTypes] = useState<string[]>([]);
  const [filterApex, setFilterApex] = useState<string[]>([]);
  const [filterNextAssignees, setFilterNextAssignees] = useState<string[]>([]);
  const [filterDealSteps, setFilterDealSteps] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [autoYocMin, setAutoYocMin] = useState<string>('');
  const [autoYocMax, setAutoYocMax] = useState<string>('');
  const [downloadingExcelDealId, setDownloadingExcelDealId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9999);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<{[key: string]: any}>({});
  const [editingCell, setEditingCell] = useState<{dealId: string, field: string} | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');
  const [brokerSuggestions, setBrokerSuggestions] = useState<any[]>([]);
  const [showBrokerSuggestions, setShowBrokerSuggestions] = useState(false);
  const brokerSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Refs to track current editing state for blur handlers (avoids stale closure)
  const editingCellRef = useRef<{dealId: string, field: string} | null>(null);
  const cellEditValueRef = useRef<string>('');
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [dealScores, setDealScores] = useState<{[dealId: string]: any}>({});
  const [showRejectionDialog, setShowRejectionDialog] = useState<{dealId: string; dealAddress: string; productTypes?: string[]} | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState("");
  const [selectedRejectionReason, setSelectedRejectionReason] = useState("");
  const [selectedDealForProperty, setSelectedDealForProperty] = useState<string | null>(null);
  
  // Auto-population state
  const [autoPopulatedDeals, setAutoPopulatedDeals] = useState<Set<string>>(new Set());
  const [autoPopulationInProgress, setAutoPopulationInProgress] = useState<Set<string>>(new Set());
  
  // Flagging system state
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>("all");
  const [showOnlyFlagged, setShowOnlyFlagged] = useState<boolean>(false);
  const [selectedDealWarnings, setSelectedDealWarnings] = useState<string | null>(null);
  const [warningDetails, setWarningDetails] = useState<any>(null);
  const [showFlaggingDialog, setShowFlaggingDialog] = useState<{dealId: string; dealAddress: string} | null>(null);
  const [reviewingDeal, setReviewingDeal] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<{dealId: string; dealAddress: string} | null>(null);

  // Pipeline view slide-out panel
  const [pipelinePanel, setPipelinePanel] = useState<DealWithBroker | null>(null);
  // Pipeline view proper state (replaces window-global hack)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [pipelineSort, setPipelineSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'createdAt', dir: 'desc' });
  const [pipelineSearch, setPipelineSearch] = useState('');
  const pipelineSearchInputRef = useRef<HTMLInputElement>(null);
  const pipelineSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePipelineSearchChange = (value: string) => {
    if (pipelineSearchDebounceRef.current) clearTimeout(pipelineSearchDebounceRef.current);
    pipelineSearchDebounceRef.current = setTimeout(() => setPipelineSearch(value), 200);
  };
  const clearPipelineSearch = () => {
    setPipelineSearch('');
    if (pipelineSearchInputRef.current) pipelineSearchInputRef.current.value = '';
    if (pipelineSearchDebounceRef.current) clearTimeout(pipelineSearchDebounceRef.current);
  };

  // Quick Deal Addition state
  const [showQuickAddition, setShowQuickAddition] = useState(false);

  // Import Deal modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'email' | 'pdf'>('email');
  const [importContent, setImportContent] = useState('');
  const [importParsing, setImportParsing] = useState(false);
  const [importParsedData, setImportParsedData] = useState<any>(null);
  const [importConfidence, setImportConfidence] = useState<any>(null);

  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [showRawEmail, setShowRawEmail] = useState(false); // Toggle for viewing raw original email

  // Reason details dialog state
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonDialogContent, setReasonDialogContent] = useState<{title: string, content: string, type: 'acceptance' | 'rejection'} | null>(null);
  const [reasonDialogDeal, setReasonDialogDeal] = useState<any | null>(null);
  const [resolvingParcel, setResolvingParcel] = useState(false);

  // Quick Deal modal state (for viewing manual submissions)
  const [quickDealModalOpen, setQuickDealModalOpen] = useState(false);
  const [selectedQuickDeal, setSelectedQuickDeal] = useState<DealWithBroker | null>(null);


  // Column visibility state - persisted to localStorage
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => getDefaultVisibleColumns());
  const [colPickerOpen, setColPickerOpen] = useState(false);
  // Column order state - persisted to localStorage
  const [columnOrder, setColumnOrder] = useState<ReorderableColumnKey[]>(() => getDefaultColumnOrder());
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);

  const isVisible = (key: ColumnKey) => visibleColumns.has(key);

  // Dynamic sticky left offsets — recalculated whenever column visibility changes
  const stickyLeft = useMemo(() => {
    const STICKY_COLS = [
      { key: 'id', width: 40 },
      { key: 'colStatus', width: 50 },
      { key: 'colApex', width: 45 },
      { key: 'colPriority', width: 55 },
      { key: 'colNext', width: 90 },
      { key: 'colStep', width: 100 },
    ] as const;
    const result: Record<string, number> = {};
    let left = 0;
    for (const col of STICKY_COLS) {
      result[col.key] = left;
      if (visibleColumns.has(col.key as ColumnKey)) left += col.width;
    }
    result['propertyAddress'] = left;
    return result;
  }, [visibleColumns]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      try { localStorage.setItem('deal-table-visible-columns', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const saveColumnOrder = (order: ReorderableColumnKey[]) => {
    setColumnOrder(order);
    try { localStorage.setItem('deal-table-column-order', JSON.stringify(order)); } catch {}
  };

  const sortColumnsAlphabetically = () => {
    const sorted = [...columnOrder].sort((a, b) => {
      const la = ALL_COLUMNS.find(c => c.key === a)?.label ?? '';
      const lb = ALL_COLUMNS.find(c => c.key === b)?.label ?? '';
      return la.localeCompare(lb);
    });
    saveColumnOrder(sorted);
  };

  const resetColumnOrder = () => {
    saveColumnOrder(REORDERABLE_COLUMNS.map(c => c.key as ReorderableColumnKey));
  };

  const resetColumns = () => {
    const defaults = new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
    setVisibleColumns(defaults);
    try { localStorage.setItem('deal-table-visible-columns', JSON.stringify([...defaults])); } catch {}
    resetColumnOrder();
  };

  // Map view toggle state
  const [viewMode, setViewMode] = useState<'table' | 'map' | 'cards'>('table');
  const [scrollToDealId, setScrollToDealId] = useState<string | null>(null);

  // Address edit dialog state
  const [editAddressDialog, setEditAddressDialog] = useState<{dealId: string; address: string; city: string; state: string; zip: string; lat: string; lng: string} | null>(null);

  // Expanded documents state - tracks which deals have expanded document lists
  const [expandedBrokerDocs, setExpandedBrokerDocs] = useState<Set<string>>(new Set());
  const [expandedAnalystDocs, setExpandedAnalystDocs] = useState<Set<string>>(new Set());

  // HelloData modal state (Dec 11, 2025: Added suggestedAddress and suggestedDistance for API errors)
  const [helloDataModal, setHelloDataModal] = useState<{dealId: string; address: string; city?: string; state?: string; zip?: string; comparableNotes: string; isError: boolean; suggestedAddress?: string; suggestedDistance?: number; latitude?: number | null; longitude?: number | null; acres?: number; proposedUnits?: number; comparablesJson?: any[]; productType?: string; statusUpdatedAt?: Date | string | null} | null>(null);
  const [ncOneMapModal, setNcOneMapModal] = useState<{dealId: string; address: string; city?: string; state?: string; zip?: string; county?: string} | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  
  // Comparable locations for map (Dec 11, 2025)
  const [comparableLocations, setComparableLocations] = useState<{
    subjectLatitude: number | null;
    subjectLongitude: number | null;
    subjectAddress?: string;
    comparables: Array<{address: string; latitude: number; longitude: number; label?: string}>;
  } | null>(null);
  const [loadingComparableLocations, setLoadingComparableLocations] = useState(false);
  const [runningForceComparables, setRunningForceComparables] = useState(false);

  // Broker Notes and Analyst Notes modal state (Dec 11, 2025)
  const [brokerNotesModal, setBrokerNotesModal] = useState<{dealId: string; address: string; notes: string; isEditing: boolean} | null>(null);
  const [analystNotesModal, setAnalystNotesModal] = useState<{dealId: string; address: string; notes: string; isEditing: boolean} | null>(null);
  const [dealSummaryModal, setDealSummaryModal] = useState<{dealId: string; address: string; notes: string; isEditing: boolean} | null>(null);
  const dealSummaryEditRef = useRef('');
  const [wetlandNotesModal, setWetlandNotesModal] = useState<{dealId: string; address: string; notes: string; isEditing: boolean} | null>(null);
  const wetlandNotesEditRef = useRef('');
  const [developerNotesModal, setDeveloperNotesModal] = useState<{dealId: string; address: string; notes: string; isEditing: boolean} | null>(null);
  const [apexNotesModal, setApexNotesModal] = useState<{dealId: string; address: string; notes: string; isEditing: boolean} | null>(null);
  const [openProductTypePopover, setOpenProductTypePopover] = useState<string | null>(null);

  // File Viewer modal state (Dec 15, 2025) - View files inline without downloading
  const [fileViewerModal, setFileViewerModal] = useState<{url: string; fileName: string; fileType: string} | null>(null);

  // LIHTC Score modal state (Dec 23, 2025) - Site suitability scoring
  const [lihtcScoreModal, setLihtcScoreModal] = useState<{dealId: string} | null>(null);

  // Performance optimization state
  const [saveStates, setSaveStates] = useState<{[dealId: string]: {[field: string]: 'idle' | 'saving' | 'saved' | 'error'}}>({});
  const [optimisticUpdates, setOptimisticUpdates] = useState<{[dealId: string]: any}>({});
  const debouncedSaves = useRef<{[key: string]: NodeJS.Timeout}>({});
  
  // Sticky scrollbar refs for synchronized horizontal scrolling
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const stickyScrollbarRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  // Fetch original email for a deal - Enhanced with comprehensive error handling
  const fetchOriginalEmail = async (dealId: string) => {
    console.log(`👁️ [EMAIL-VIEWER] Fetching original message for deal: ${dealId}`);
    setLoadingEmail(true);
    setShowRawEmail(false); // Reset raw view toggle when loading new email
    setEmailModalOpen(true); // Open modal immediately to show loading
    
    try {
      const response = await fetch(`/api/deals/${dealId}/original-email`, {
        credentials: 'include'
      });
      
      console.log(`👁️ [EMAIL-VIEWER] Response status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const emailData = await response.json();
        console.log(`✅ [EMAIL-VIEWER] Successfully fetched message data:`, {
          id: emailData.id,
          channel: emailData.channel,
          subject: emailData.subject,
          email: emailData.email,
          phone: emailData.phone,
          hasRawText: !!emailData.rawText,
          hasMessage: !!emailData.message,
          hasBody: !!emailData.body,
          rawTextLength: emailData.rawText?.length || 0,
          messageLength: emailData.message?.length || 0,
          bodyLength: emailData.body?.length || 0,
          allFields: Object.keys(emailData)
        });
        
        // Validate that we have SOME content to display (check all possible content fields)
        if (!emailData.rawText && !emailData.message && !emailData.body) {
          console.warn(`⚠️ [EMAIL-VIEWER] No content found in any field (rawText/message/body) for deal ${dealId}`);
          toast({
            title: "No Content Available",
            description: "The original message was found but has no displayable content. This may be a data issue.",
            variant: "destructive"
          });
          return;
        }
        
        console.log('📧 [EMAIL-VIEWER] Setting selected email data');
        setSelectedEmail(emailData);
        console.log('✅ [EMAIL-VIEWER] Email data loaded successfully');
      } else {
        // Parse error response for better messaging
        let errorMessage = "No original email/SMS submission found for this deal";
        try {
          const errorData = await response.json();
          console.log(`❌ [EMAIL-VIEWER] Error response:`, errorData);
          
          if (errorData.message) {
            errorMessage = errorData.message;
          }
          
          // Provide helpful context if available
          if (errorData.debug) {
            console.log(`📋 [EMAIL-VIEWER] Debug info:`, errorData.debug);
            if (errorData.debug.hint) {
              errorMessage += `. ${errorData.debug.hint}`;
            }
          }
        } catch (parseError) {
          console.error(`⚠️ [EMAIL-VIEWER] Could not parse error response:`, parseError);
        }
        
        // Use informational styling instead of error styling
        toast({
          title: "No Original Message",
          description: errorMessage,
          // No variant = default blue informational toast instead of red error
        });
      }
    } catch (error) {
      console.error(`❌ [EMAIL-VIEWER] Network or fetch error:`, error);
      toast({
        title: "Error Loading Message",
        description: "Failed to fetch original message due to a network error. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingEmail(false);
    }
  };

  // Handle broker selection - auto-populate broker details
  const handleBrokerSelection = (brokerId: string) => {
    const selectedBroker = brokers.find((b: any) => b.id === brokerId);
    if (selectedBroker) {
      setEditData({
        ...editData,
        brokerId: selectedBroker.id,
        brokerFirstName: selectedBroker.firstName,
        brokerLastName: selectedBroker.lastName,
        brokerEmail: selectedBroker.email || '',
        brokerPhone: selectedBroker.phone || '',
        marketsCovered: Array.isArray(selectedBroker.marketsCovered) 
          ? selectedBroker.marketsCovered.join(', ') 
          : (selectedBroker.marketsCovered || '')
      });
    }
  };

  // Fetch deals data with pagination and flagging filters - optimized for fast pagination
  const { data: dealsData, isLoading, isFetching } = useQuery({
    queryKey: ['/api/deals', currentPage, pageSize, filterClassifications.join(','), filterPriorities.join(','), filterDealTypes.join(','), filterApex.join(','), searchQuery, filterRiskLevel, showOnlyFlagged, sortColumn, sortDirection],
    queryFn: async ({ signal }) => {
      // Use flagged deals endpoint if only showing flagged deals
      const endpoint = showOnlyFlagged ? '/api/deals/flagged' : '/api/deals';
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(filterClassifications.length > 0 && { classifications: filterClassifications.join(',') }),
        ...(filterPriorities.length > 0 && { priorities: filterPriorities.join(',') }),
        ...(filterDealTypes.length > 0 && { dealTypes: filterDealTypes.join(',') }),
            ...(filterApex.length > 0 && { apex: filterApex.join(',') }),
        ...(searchQuery && { search: searchQuery }),
        ...(filterRiskLevel !== 'all' && { riskLevel: filterRiskLevel }),
        ...(showOnlyFlagged && { sortBy: 'flaggedAt', sortOrder: 'desc' }),
        // Only add sorting params if user has explicitly chosen to sort
        ...(sortColumn && { sortBy: sortColumn, sortOrder: sortDirection }),
        // If no explicit sorting and not flagged, preserve natural order
        ...(!sortColumn && !showOnlyFlagged && { naturalOrder: 'true' })
      });
      
      const response = await fetch(`${endpoint}?${params}`, {
        credentials: 'include',
        signal: signal // Enable request cancellation for fast page switching
      });
      if (!response.ok) {
        throw new Error('Failed to fetch deals');
      }
      return await response.json();
    },
    placeholderData: (previousData) => previousData, // Keep previous data while loading
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Prevent unexpected refetches
  });

  const deals = dealsData?.deals || [];
  const totalPages = dealsData?.pagination?.totalPages || 1;
  const totalDeals = dealsData?.pagination?.total || 0;
  const hasNextPage = dealsData?.pagination?.hasNextPage || false;
  const hasPrevPage = dealsData?.pagination?.hasPrevPage || false;

  
  // Prefetch adjacent pages for instant navigation
  useEffect(() => {
    if (!dealsData) return; // Don't prefetch until we have initial data
    
    const baseQueryKey = ['/api/deals', pageSize, filterClassifications.join(','), filterPriorities.join(','), filterDealTypes.join(','), filterApex.join(','), searchQuery, filterRiskLevel, showOnlyFlagged, sortColumn, sortDirection];
    
    // Prefetch next page if it exists
    if (currentPage < totalPages) {
      const nextPageKey = ['/api/deals', currentPage + 1, ...baseQueryKey.slice(1)];
      queryClient.prefetchQuery({
        queryKey: nextPageKey,
        queryFn: async ({ signal }) => {
          const endpoint = showOnlyFlagged ? '/api/deals/flagged' : '/api/deals';
          const params = new URLSearchParams({
            page: (currentPage + 1).toString(),
            limit: pageSize.toString(),
            ...(filterClassifications.length > 0 && { classifications: filterClassifications.join(',') }),
            ...(filterPriorities.length > 0 && { priorities: filterPriorities.join(',') }),
            ...(filterDealTypes.length > 0 && { dealTypes: filterDealTypes.join(',') }),
            ...(filterApex.length > 0 && { apex: filterApex.join(',') }),
            ...(searchQuery && { search: searchQuery }),
            ...(filterRiskLevel !== 'all' && { riskLevel: filterRiskLevel }),
            ...(showOnlyFlagged && { sortBy: 'flaggedAt', sortOrder: 'desc' })
          });
          const response = await fetch(`${endpoint}?${params}`, {
            credentials: 'include',
            signal: signal
          });
          if (!response.ok) throw new Error('Failed to fetch deals');
          return await response.json();
        },
        staleTime: 30 * 1000,
      });
    }

    // Prefetch previous page if it exists
    if (currentPage > 1) {
      const prevPageKey = ['/api/deals', currentPage - 1, ...baseQueryKey.slice(1)];
      queryClient.prefetchQuery({
        queryKey: prevPageKey,
        queryFn: async ({ signal }) => {
          const endpoint = showOnlyFlagged ? '/api/deals/flagged' : '/api/deals';
          const params = new URLSearchParams({
            page: (currentPage - 1).toString(),
            limit: pageSize.toString(),
            ...(filterClassifications.length > 0 && { classifications: filterClassifications.join(',') }),
            ...(filterPriorities.length > 0 && { priorities: filterPriorities.join(',') }),
            ...(filterDealTypes.length > 0 && { dealTypes: filterDealTypes.join(',') }),
            ...(filterApex.length > 0 && { apex: filterApex.join(',') }),
            ...(searchQuery && { search: searchQuery }),
            ...(filterRiskLevel !== 'all' && { riskLevel: filterRiskLevel }),
            ...(showOnlyFlagged && { sortBy: 'flaggedAt', sortOrder: 'desc' })
          });
          const response = await fetch(`${endpoint}?${params}`, {
            credentials: 'include',
            signal: signal
          });
          if (!response.ok) throw new Error('Failed to fetch deals');
          return await response.json();
        },
        staleTime: 30 * 1000,
      });
    }
  }, [currentPage, totalPages, queryClient, pageSize, filterClassifications, filterDealTypes, filterApex, searchQuery, filterRiskLevel, showOnlyFlagged, dealsData]);

  // Handle scrolling to a deal when switching from map view
  useEffect(() => {
    if (viewMode === 'table' && scrollToDealId) {
      // Wait for table to render, then scroll to deal
      setTimeout(() => {
        const dealElement = document.getElementById(`deal-${scrollToDealId}`);
        if (dealElement) {
          dealElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Clear the scroll target
          setScrollToDealId(null);
        }
      }, 100);
    }
  }, [viewMode, scrollToDealId]);
  
  // Sticky scrollbar synchronization and ResizeObserver
  useEffect(() => {
    if (viewMode !== 'table') {
      // Cleanup when switching away from table view
      if (tableContainerRef.current && stickyScrollbarRef.current) {
        // Reset scroll positions
        tableContainerRef.current.scrollLeft = 0;
        stickyScrollbarRef.current.scrollLeft = 0;
      }
      return;
    }
    
    const tableContainer = tableContainerRef.current;
    const stickyScrollbar = stickyScrollbarRef.current;
    
    if (!tableContainer || !stickyScrollbar) return;
    
    // Sync sticky scrollbar width with table container's scrollWidth
    // FIX: Measure scrollWidth directly from the scroll container, not from child elements
    const updateScrollbarWidth = () => {
      const scrollWidth = tableContainer.scrollWidth;
      const clientWidth = tableContainer.clientWidth;
      const stickyContent = stickyScrollbar.firstElementChild as HTMLElement;
      
      console.log('[SCROLL-DEBUG] Updating scrollbar width:', { scrollWidth, clientWidth });
      
      if (stickyContent && scrollWidth > 0) {
        // Ensure the sticky scrollbar content is at least as wide as the table's full scrollable width
        stickyContent.style.width = `${scrollWidth}px`;
        stickyContent.style.minWidth = `${scrollWidth}px`;
        console.log('[SCROLL-DEBUG] Set sticky scrollbar width to:', scrollWidth);
      }
    };
    
    // Initial width sync with small delay to ensure DOM is ready
    setTimeout(updateScrollbarWidth, 50);
    
    // ResizeObserver to track container width changes
    const resizeObserver = new ResizeObserver(() => {
      updateScrollbarWidth();
    });
    
    // Observe the table container itself (always exists, contains the scrollable content)
    resizeObserver.observe(tableContainer);
    
    // Window resize listener as fallback
    const handleWindowResize = () => {
      updateScrollbarWidth();
    };
    window.addEventListener('resize', handleWindowResize);
    
    // Scroll event handlers with guard to prevent feedback loops
    const handleTableScroll = () => {
      if (isSyncingScroll.current) return;
      isSyncingScroll.current = true;
      requestAnimationFrame(() => {
        if (stickyScrollbar && tableContainer) {
          stickyScrollbar.scrollLeft = tableContainer.scrollLeft;
        }
        isSyncingScroll.current = false;
      });
    };
    
    const handleStickyScroll = () => {
      if (isSyncingScroll.current) return;
      isSyncingScroll.current = true;
      requestAnimationFrame(() => {
        if (tableContainer && stickyScrollbar) {
          tableContainer.scrollLeft = stickyScrollbar.scrollLeft;
        }
        isSyncingScroll.current = false;
      });
    };
    
    tableContainer.addEventListener('scroll', handleTableScroll);
    stickyScrollbar.addEventListener('scroll', handleStickyScroll);
    
    // Cleanup on unmount or viewMode change
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (tableContainer) {
        tableContainer.removeEventListener('scroll', handleTableScroll);
      }
      if (stickyScrollbar) {
        stickyScrollbar.removeEventListener('scroll', handleStickyScroll);
      }
    };
  }, [viewMode, deals]); // Re-run when viewMode or deals data changes

  // Recalculate sticky scrollbar width when column visibility changes
  useEffect(() => {
    if (viewMode !== 'table') return;
    const timer = setTimeout(() => {
      const tableContainer = tableContainerRef.current;
      const stickyScrollbar = stickyScrollbarRef.current;
      if (!tableContainer || !stickyScrollbar) return;
      const stickyContent = stickyScrollbar.firstElementChild as HTMLElement;
      if (stickyContent) {
        stickyContent.style.width = `${tableContainer.scrollWidth}px`;
        stickyContent.style.minWidth = `${tableContainer.scrollWidth}px`;
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [visibleColumns, viewMode, expandedBrokerDocs, expandedAnalystDocs]);

  // Fetch comparable locations when HelloData modal opens (Dec 11, 2025)
  // Always fetch, even for "error" cases - we may still have subject coordinates
  useEffect(() => {
    if (helloDataModal && helloDataModal.dealId) {
      setLoadingComparableLocations(true);
      setComparableLocations(null);
      
      fetch(`/api/deals/${helloDataModal.dealId}/comparable-locations`, {
        credentials: 'include'
      })
        .then(response => response.json())
        .then(data => {
          setComparableLocations(data);
          setLoadingComparableLocations(false);
        })
        .catch(error => {
          console.error('Failed to fetch comparable locations:', error);
          setLoadingComparableLocations(false);
        });
    } else {
      setComparableLocations(null);
      setLoadingComparableLocations(false);
    }
  }, [helloDataModal?.dealId]);

  // Fetch NC OneMap parcel data when NC OneMap modal opens
  const [ncParcelData, setNcParcelData] = useState<any>(null);
  const [ncParcelLoading, setNcParcelLoading] = useState(false);
  useEffect(() => {
    if (!ncOneMapModal) {
      setNcParcelData(null);
      return;
    }
    setNcParcelLoading(true);
    setNcParcelData(null);
    const params = new URLSearchParams();
    if (ncOneMapModal.address) params.set('address', ncOneMapModal.address);
    if (ncOneMapModal.city) params.set('city', ncOneMapModal.city);
    if (ncOneMapModal.state) params.set('state', ncOneMapModal.state);
    if (ncOneMapModal.zip) params.set('zip', ncOneMapModal.zip);
    if (ncOneMapModal.county) params.set('county', ncOneMapModal.county);
    fetch(`/api/nc-parcel?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setNcParcelData(data); setNcParcelLoading(false); })
      .catch(() => setNcParcelLoading(false));
  }, [ncOneMapModal?.dealId]);

  // Fetch brokers for dropdown selection
  const { data: brokersData } = useQuery<{ brokers: Broker[] }>({
    queryKey: ['/api/brokers'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  const brokers = brokersData?.brokers || [];

  // Extract classification summary from API response
  const classificationSummary = dealsData?.classificationSummary || {
    green: 0,
    yellow: 0,
    red: 0,
    unclassified: 0,
    total: 0
  };

  // Reset to page 1 when filters change
  const resetToFirstPage = () => {
    setCurrentPage(1);
  };

  // Update search query and reset page - debounced so typing feels instant
  // (searchQuery drives the /api/deals queryKey, so every change triggers a network refetch
  // and a re-render of this large dashboard; debounce prevents that from firing per keystroke)
  const handleSearchChange = (query: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(query);
      setCurrentPage(1);
    }, 300);
  };

  // Update classification filter and reset page - now supports multi-select
  const handleClassificationFilter = (classification: string) => {
    if (classification === "all") {
      // "All" clears all filters
      setFilterClassifications([]);
    } else {
      setFilterClassifications(prev => {
        if (prev.includes(classification)) {
          // Remove if already selected
          return prev.filter(c => c !== classification);
        } else {
          // Add to selection
          return [...prev, classification];
        }
      });
    }
    setCurrentPage(1);
  };

  // Update priority filter and reset page - supports multi-select
  const handlePriorityFilter = (priority: string) => {
    if (priority === "all") {
      setFilterPriorities([]);
    } else {
      setFilterPriorities(prev => {
        if (prev.includes(priority)) {
          return prev.filter(p => p !== priority);
        } else {
          return [...prev, priority];
        }
      });
    }
    setCurrentPage(1);
  };

  // Deal type filter handler (Land/Acquisition)
  const handleDealTypeFilter = (dealType: string) => {
    if (dealType === "all") {
      setFilterDealTypes([]);
    } else {
      setFilterDealTypes(prev => {
        if (prev.includes(dealType)) {
          return prev.filter(d => d !== dealType);
        } else {
          return [...prev, dealType];
        }
      });
    }
    setCurrentPage(1);
  };

  // Apex filter handler (Yes/No)
  const handleApexFilter = (value: string) => {
    if (value === "all") {
      setFilterApex([]);
    } else {
      setFilterApex(prev => {
        if (prev.includes(value)) {
          return prev.filter(v => v !== value);
        } else {
          return [...prev, value];
        }
      });
    }
    setCurrentPage(1);
  };

  // Next Assignee filter handler
  const handleNextAssigneeFilter = (assignee: string) => {
    if (assignee === "all") {
      setFilterNextAssignees([]);
    } else {
      setFilterNextAssignees(prev => {
        if (prev.includes(assignee)) {
          return prev.filter(a => a !== assignee);
        } else {
          return [...prev, assignee];
        }
      });
    }
    setCurrentPage(1);
  };

  // Deal Step filter handler
  const handleDealStepFilter = (step: string) => {
    if (step === "all") {
      setFilterDealSteps([]);
    } else {
      setFilterDealSteps(prev => {
        if (prev.includes(step)) {
          return prev.filter(s => s !== step);
        } else {
          return [...prev, step];
        }
      });
    }
    setCurrentPage(1);
  };

  // Rental data refresh mutation
  const refreshRentalDataMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const response = await apiRequest("POST", `/api/deals/${dealId}/refresh-rental-data`, {});
      return await response.json();
    },
    onSuccess: (data: any, dealId: string) => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/deals' });
      if (data.success) {
        toast({
          title: "Rental Data Refreshed",
          description: `Updated ${data.updatedFields.join(', ')} with ${data.rentalData.confidence}% confidence from ${data.rentalData.comparableCount} comparables.`,
        });
      } else {
        toast({
          title: "Rental Data Refresh",
          description: data.message || "No reliable rental data found from comparable properties.",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to refresh rental data. Please try again.",
        variant: "destructive"
      });
      console.error("Rental refresh error:", error);
    },
  });

  // Auto-population mutation for missing rent data
  const autoPopulateMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const response = await apiRequest("POST", `/api/deals/${dealId}/auto-populate`, {});
      return await response.json();
    },
    onSuccess: (data: any, dealId: string) => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/deals' });
      setAutoPopulatedDeals(prev => new Set([...Array.from(prev), dealId]));
      setAutoPopulationInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(dealId);
        return newSet;
      });
      
      if (data.success) {
        console.log(`Auto-populated rent data for deal ${dealId}:`, data.updatedFields);
      }
    },
    onError: (error, dealId) => {
      setAutoPopulationInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(dealId);
        return newSet;
      });
      console.error(`Auto-population failed for deal ${dealId}:`, error);
    },
  });

  // Helper function to normalize boolean values from strings
  const normalizeBooleanValue = (value: any): boolean | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.toLowerCase().trim();
      if (normalized === 'yes' || normalized === 'true' || normalized === '1') return true;
      if (normalized === 'no' || normalized === 'false' || normalized === '0') return false;
    }
    return undefined;
  };

  // Performance optimization: Debounced save function for text inputs
  const debouncedSave = useCallback((dealId: string, field: string, value: any, isTextInput: boolean = false) => {
    const saveKey = `${dealId}-${field}`;
    
    // Clear existing timeout
    if (debouncedSaves.current[saveKey]) {
      clearTimeout(debouncedSaves.current[saveKey]);
    }

    // Set save state to saving
    setSaveStates(prev => ({
      ...prev,
      [dealId]: { ...(prev[dealId] || {}), [field]: 'saving' }
    }));

    // Apply optimistic update immediately for responsive UI
    setOptimisticUpdates(prev => ({
      ...prev,
      [dealId]: { ...(prev[dealId] || {}), [field]: value }
    }));

    const saveFunction = () => {
      // Send field names directly - vintage and yearBuilt are separate columns in the database
      cellUpdateMutation.mutate({
        dealId,
        [field]: value
      });
    };

    if (isTextInput) {
      // Debounce text inputs by 500ms
      debouncedSaves.current[saveKey] = setTimeout(saveFunction, 500);
    } else {
      // Save immediately for dropdowns and other controls
      saveFunction();
    }
  }, []);

  // Helper to update save state
  const updateSaveState = useCallback((dealId: string, field: string, state: 'idle' | 'saving' | 'saved' | 'error') => {
    setSaveStates(prev => ({
      ...prev,
      [dealId]: { ...(prev[dealId] || {}), [field]: state }
    }));

    // Auto-clear 'saved' state after 2 seconds
    if (state === 'saved') {
      setTimeout(() => {
        setSaveStates(prev => ({
          ...prev,
          [dealId]: { ...(prev[dealId] || {}), [field]: 'idle' }
        }));
      }, 2000);
    }
  }, []);

  // Get current deal data with optimistic updates applied
  const getDealWithOptimisticUpdates = useCallback((deal: any) => {
    const optimisticData = optimisticUpdates[deal.id] || {};
    return { ...deal, ...optimisticData };
  }, [optimisticUpdates]);

  // Debounced mutation function to prevent rapid successive calls
  const debouncedMutationRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  // Tracks which deal IDs have already had Auto YOC computed this session (avoids duplicate mutations)
  const autoYocProcessedRef = useRef<Set<string>>(new Set());
  const [yocRefreshKey, setYocRefreshKey] = useState(0);
  const [yocRefreshing, setYocRefreshing] = useState(false);

  // ─── Underwriting Presets (validated from actual analyst Excel models) ───
  // softCostPct: 15% for all types
  // otherIncomePUM: $198/unit/month conventional        (v22 — confirmed $197-$199 across 10 models: #161, #119,
  //                                                      #118, #172, #87, #202, #58, #180, #55, #257 avg $198.1)
  //                 $207/unit/month AA flats             (confirmed #247 Verdin Rd $209, #45 Orphanage $207)
  //                 $247-$251/unit/month BTR             (v22 — confirmed from BTR model analysis: TH $251, SFR $247)
  // fixedOpExPU: $6,101/unit/year conventional          (EXCLUDES insurance — computed dynamically by type+coastal)
  //              sum: reTax $1,971 + utilities $538 + contracts $780 + makeReady $250 + rm $250
  //              + marketing $350 + payroll $1,612 + office $200 + ga $150 = $6,101
  //              $9,500/unit/year AA flats non-coastal   (EXCLUDES insurance — back-solved from #247 Verdin Rd NC,
  //              #45 Orphanage NC, #48 Eagle Rd NC; non-coastal avg $9,666, v22 uses $9,500 as conservative)
  //              $11,600/unit/year AA flats coastal SC   (v22 — coastal SC (Charleston/MB) has RE taxes $4,098-
  //              $5,192/unit vs NC $2,064-$2,984; back-solved from #150 River Landing $11,760 and
  //              #151 Savannah Hwy $11,575 → avg $11,668; rounded to $11,600)
  //              $7,014/unit/year BTR                    (EXCLUDES insurance — from #171 model)
  // NOTE: AA types do NOT use HelloData PSF — HD comps are conventional apartments which run 10-20%
  //       ABOVE age-restricted AA rents. Using HD PSF for AA caused #150 Charleston to show 10.7% auto
  //       YOC vs actual 5.9%. AA types always fall back to preset rents.
  // insurancePU_nc / insurancePU_coastal: per analyst insurance schedule (non-coastal / coastal)
  //   Coastal states: FL, SC
  // RE tax adjustments applied on top for markets with known higher taxes:
  //   TN (Nashville verified from Excel model): +$495/unit above default $1,971
  // Coastal SC AA note: RE taxes are higher ($4,098-$5,192/unit vs NC $2,064-$2,984), BUT coastal AA rents
  //   are also much higher ($2,372-$2,560/mo vs preset $1,737). Both sides underestimate equally → no opex adj.
  // Bump this constant whenever any preset value changes.
  // The batch processedRef keys include this version so all deals re-run automatically.
  const PRESET_VERSION = 'v22-other-income';

  // Coastal states — FL and SC always coastal at the state level.
  // Specific coastal cities in NC and GA also carry elevated insurance (hurricane/flood exposure).
  const COASTAL_STATES = new Set(['FL', 'SC']);
  const COASTAL_CITIES_NC = new Set([
    'WILMINGTON', 'CAROLINA BEACH', 'WRIGHTSVILLE BEACH', 'KURE BEACH',
    'OAK ISLAND', 'SOUTHPORT', 'HOLDEN BEACH', 'OCEAN ISLE BEACH', 'SUNSET BEACH',
    'SURF CITY', 'TOPSAIL BEACH', 'SNEADS FERRY', 'SWANSBORO',
    'MOREHEAD CITY', 'BEAUFORT', 'NEW BERN', 'JACKSONVILLE',
  ]);
  const COASTAL_CITIES_GA = new Set([
    'SAVANNAH', 'BRUNSWICK', 'ST. SIMONS ISLAND', 'ST SIMONS ISLAND',
    'TYBEE ISLAND', 'JEKYLL ISLAND', 'DARIEN', 'WOODBINE', 'KINGSLAND', 'RICHMOND HILL',
  ]);

  // Market-level RE tax adjustments above the $1,971/unit default baked into fixedOpExPU.
  // Only populated where verified from actual deal Excel models.
  const RE_TAX_ADJUSTMENT_BY_STATE: Record<string, number> = {
    'TN': 495, // Nashville Excel (#66 Lenox Village): $2,466/unit vs $1,971 default → +$495
  };

  // State-level rent multipliers applied to BOTH HelloData and preset blended rents.
  // Accounts for regional rent variation from the national preset baseline.
  // Active markets: NC, SC, TN, VA, GA, FL only.
  // Calibrated from analyst Excel models vs auto YOC comparisons:
  //   NC secondary markets (#196 High Point, #209 Concord, #45/#48 AA deals):
  //     preset rents run 10-12% above what analysts actually underwrite → 0.82×
  //   GA (Atlanta suburbs like Tucker, Warner Robins, Morrow, Douglasville):
  //     rents ~10% below national preset baseline → 0.90×
  //   TN (Nashville): well-calibrated from #66/#87 models → 1.00×
  //   FL, SC (coastal): preset at/above market, coastal handling sufficient → 1.00×
  //   VA: modest discount vs national baseline → 0.95×
  const RENT_MULT_BY_STATE: Record<string, number> = {
    'NC': 0.82, // NC secondary markets (Concord, Greensboro, High Point) — back-solved from #45/#48 AA deals
    'GA': 0.90,
    'TN': 1.00,
    'FL': 1.00,
    'SC': 1.00,
    'VA': 0.95,
  };
  const RENT_MULT_DEFAULT = 0.95; // conservative fallback for any unlisted state

  // State-level assumed land cost multipliers for deals WITHOUT an actual asking price.
  // Applied on top of preset.assumedLandCostPU when hasActualLandCost is false.
  // NC suburban land commands a significant premium relative to its rental rates —
  // secondary cities (High Point, Concord, Greensboro) have expensive land but lower rents
  // than Raleigh-Durham, making ground-up yields harder to achieve.
  // Calibrated: AA deals #45 (Concord) and #48 (Greensboro) both show ~3-4% actual YOC
  // vs preset-driven auto YOC, implying assumed land is too cheap relative to reality.
  const LAND_COST_MULT_BY_STATE: Record<string, number> = {
    'NC': 2.50, // NC secondary-market default (Greensboro, High Point, Burlington, Asheboro) — back-solved from #45/#48 AA deals
    'TN': 1.25, // Nashville land has appreciated; non-asked deals need higher assumption
    'VA': 1.20,
    'GA': 1.10,
    'FL': 1.00, // coastal tier already handles FL
    'SC': 1.00, // coastal tier already handles SC
  };
  const LAND_COST_MULT_DEFAULT = 1.00;

  // NC sub-market tiers — override the NC state default (0.82 rent / 2.50 land) for primary markets.
  // The state default is calibrated for secondary NC (Greensboro, High Point, Asheboro, Burlington).
  // Research Triangle and Charlotte MSA have higher rents and more moderate land costs relative to rents.
  // Calibrated from analyst Excel models: #58 Holly Springs 5.99%, #55 Charlotte 5.89%,
  // #118/#119 Durham 5.3-5.8%, #202 Chapel Hill 7.4% — all well above the secondary-market default.
  const NC_RESEARCH_TRIANGLE_CITIES = new Set([
    'RALEIGH', 'DURHAM', 'CHAPEL HILL', 'CARY', 'APEX', 'WAKE FOREST',
    'MORRISVILLE', 'FUQUAY-VARINA', 'FUQUAY VARINA', 'HOLLY SPRINGS',
    'GARNER', 'PITTSBORO', 'CARRBORO', 'HILLSBOROUGH', 'KNIGHTDALE',
    'WENDELL', 'ZEBULON', 'ANGIER', 'MEBANE', 'ROLESVILLE', 'CLAYTON',
  ]);
  const NC_CHARLOTTE_MSA_CITIES = new Set([
    'CHARLOTTE', 'HUNTERSVILLE', 'CORNELIUS', 'DAVIDSON', 'MOORESVILLE',
    'INDIAN TRAIL', 'MATTHEWS', 'MINT HILL', 'MONROE', 'WAXHAW',
    'STALLINGS', 'PINEVILLE', 'HARRISBURG', 'MIDLAND', 'BELMONT', 'GASTONIA',
  ]);

  const PRODUCT_TYPE_YOC_PRESETS: Record<string, {
    label: string;
    dua: number;
    hardCostPU: number;
    assumedLandCostPU: number;          // Non-coastal estimated land $/unit (no asking price)
    assumedLandCostPU_coastal: number;  // Coastal (FL, SC) estimated land $/unit — land is more expensive
    softCostPct: number;
    otherIncomePUM: number;
    fixedOpExPU: number;          // EXCLUDES insurance — insurance computed separately by coastal status
    insurancePU_nc: number;    // Non-coastal insurance $/unit/year
    insurancePU_coastal: number; // Coastal insurance $/unit/year
    unitMix: { pct: number; avgSF: number; monthlyRent: number }[];
  }> = {
    // 3-Story Walk-Up (Conventional Garden) — 30 u/a (analyst Q13: avg 30 u/a), 60% 1BR/800SF + 40% 2BR/1,050SF
    // hardCostPU $164k validated: #58 model $54.1M / 330 units = $164k, #180 $53.2M / 324 = $164k
    '3-story-surface-park': {
      label: '3-Story SP',
      dua: 30, hardCostPU: 164000, assumedLandCostPU: 25000, assumedLandCostPU_coastal: 35000,
      softCostPct: 0.15, otherIncomePUM: 198, fixedOpExPU: 6101,
      insurancePU_nc: 550, insurancePU_coastal: 700,
      unitMix: [{ pct: 0.60, avgSF: 800, monthlyRent: 1600 }, { pct: 0.40, avgSF: 1050, monthlyRent: 2200 }],
    },
    // 3-Story Attainable — 30 u/a (analyst Q13: avg 30 u/a), same unit mix as WU
    '3-story-attainable': {
      label: '3-Story Att.',
      dua: 30, hardCostPU: 137000, assumedLandCostPU: 10000, assumedLandCostPU_coastal: 15000,
      softCostPct: 0.15, otherIncomePUM: 198, fixedOpExPU: 6101,
      insurancePU_nc: 550, insurancePU_coastal: 700,
      unitMix: [{ pct: 0.60, avgSF: 800, monthlyRent: 1400 }, { pct: 0.40, avgSF: 1050, monthlyRent: 1900 }],
    },
    // 4-Story Surface-Parked (Conventional Mid-Rise) — 35 u/a, same 60/40 split
    // coastal $45K: back-solved from deal #180 Kissimmee FL (5.99% actual YOC)
    '4-story-surface-park': {
      label: '4-Story SP',
      dua: 35, hardCostPU: 158000, assumedLandCostPU: 30000, assumedLandCostPU_coastal: 45000,
      softCostPct: 0.15, otherIncomePUM: 198, fixedOpExPU: 6101,
      insurancePU_nc: 600, insurancePU_coastal: 800,
      unitMix: [{ pct: 0.60, avgSF: 800, monthlyRent: 1650 }, { pct: 0.40, avgSF: 1050, monthlyRent: 2300 }],
    },
    // Active Adult 3-Story (conditioned interior corridors) — 30 u/a (analyst Q13: avg 30 u/a), 2BR at 1,100 SF per PDF
    // Rent calibration: SE secondary markets (NC/GA) AA rents are $1,650-1,750/1BR, $2,100-2,200/2BR.
    // Prior presets ($1,950/$2,500) were calibrated for primary/Sun Belt markets (Nashville, FL)
    // and ran 10-15% above what analysts actually underwrite in NC/GA — corrected here.
    // fixedOpExPU $9,500: v21 — AA carries resident activities ($450), 3× payroll vs conventional,
    //   2× utilities for expanded common areas. Non-coastal avg $9,666 (#45 NC, #48 NC, #247 SC-upstate).
    //   NOTE: Coastal SC AA deals (#150 River Landing, #151 Savannah Hwy) show higher opex ($11,600/unit)
    //   due to RE taxes $4,098-$5,192/unit, but they also have much higher rents ($2,372-$2,560/month vs
    //   preset $1,737). Both sides are underestimated equally → a rent multiplier is the correct fix, not
    //   an opex adjustment. Raising fixedOpExPU for coastal AA would make YOC lower, not higher.
    // otherIncomePUM $207: v21 — confirmed from #247 Verdin Rd ($209) and #45 Orphanage Rd ($207).
    // NOTE: AA types do NOT use HelloData PSF — see comments above presets block.
    'aa-3-story-flats': {
      label: 'AA 3-Story',
      dua: 30, hardCostPU: 167200, assumedLandCostPU: 30000, assumedLandCostPU_coastal: 40000,
      softCostPct: 0.15, otherIncomePUM: 207, fixedOpExPU: 9500,
      insurancePU_nc: 575, insurancePU_coastal: 750,
      unitMix: [{ pct: 0.60, avgSF: 800, monthlyRent: 1750 }, { pct: 0.40, avgSF: 1100, monthlyRent: 2200 }],
    },
    // Active Adult 4-Story Surface-Parked — 35 u/a, 2BR at 1,100 SF per PDF
    // hardCostPU $185,500: v21 — construction+sitework+contingency=$195K/unit across all 5 AA models;
    //   effective HC $195K, soft costs ~40%; auto formula uses $185.5K × 1.15 = $213K ≈ 80% of actual TDC.
    //   Both NOI and TDC ~80% of actual → YOC ratio cancels; Verdin Rd auto 4.47% vs actual 4.48% ✅.
    // fixedOpExPU $9,500: v21 — same AA opex premium as 3-Story (see above).
    // otherIncomePUM $207: v21 — confirmed from AA models (see above).
    // NOTE: AA types do NOT use HelloData PSF — see comments above presets block.
    'aa-4-story-flats': {
      label: 'AA 4-Story',
      dua: 35, hardCostPU: 185500, assumedLandCostPU: 30000, assumedLandCostPU_coastal: 45000,
      softCostPct: 0.15, otherIncomePUM: 207, fixedOpExPU: 9500,
      insurancePU_nc: 625, insurancePU_coastal: 825,
      unitMix: [{ pct: 0.60, avgSF: 800, monthlyRent: 1750 }, { pct: 0.40, avgSF: 1100, monthlyRent: 2200 }],
    },
    // AA Cottages — 6 u/a; UW template: 1BR/1.5BA 25%@1,200SF, 2BR/2.0BA 75%@1,400SF
    // Rents reduced to match SE market reality (prior $2,400/$3,400 was Sun Belt premium)
    // fixedOpExPU $9,500: v21 — AA amenity/activity cost applies equally to cottage product.
    // NOTE: AA types do NOT use HelloData PSF — see comments above presets block.
    'aa-cottages': {
      label: 'AA Cottages',
      dua: 6, hardCostPU: 252500, assumedLandCostPU: 30000, assumedLandCostPU_coastal: 40000,
      softCostPct: 0.15, otherIncomePUM: 235, fixedOpExPU: 9500,
      insurancePU_nc: 750, insurancePU_coastal: 900,
      unitMix: [{ pct: 0.25, avgSF: 1200, monthlyRent: 2100 }, { pct: 0.75, avgSF: 1400, monthlyRent: 2900 }],
    },
    // BTR Townhome 3-Story — 8 u/a; PDF: 3BR/3.5BA 65%@1,659SF@$120psf + 4BR/3.5BA 35%@1,996SF@$107psf
    // hardCostPU = (0.65×$199,080 + 0.35×$213,572) + $50k sitework = $204,152 + $50k = $254,152 ✓
    // Validated: #171 model $39.2M / 154 units = $254,260/unit
    // BTR TH coastal $55K: back-solved from deal #171 N.Myrtle Beach SC (5.56% actual at 154 units)
    // otherIncomePUM $251: v22 — confirmed from BTR TH models (#119 Grandale BTR, #202 BTR, #118 Hopson BTR)
    'btr-3-story-th': {
      label: 'BTR TH',
      dua: 8, hardCostPU: 254000, assumedLandCostPU: 50000, assumedLandCostPU_coastal: 55000,
      softCostPct: 0.15, otherIncomePUM: 251, fixedOpExPU: 7014,
      insurancePU_nc: 750, insurancePU_coastal: 900,
      unitMix: [{ pct: 0.65, avgSF: 1659, monthlyRent: 2500 }, { pct: 0.35, avgSF: 1996, monthlyRent: 2700 }],
    },
    // BTR SFR Detached — 8 u/a; construction formula-driven + $50k sitework ≈ $258k/unit
    // Unit mix from UW template: 3BR/2.5BA 30%@2,020SF@$2,750/mo, 4BR/3.5BA 70%@2,600SF@$3,000/mo
    // otherIncomePUM $247: v22 — confirmed from SFR model analysis (#172 Sneads Ferry SFR)
    'btr-sfr-detached': {
      label: 'BTR SFR',
      dua: 8, hardCostPU: 258000, assumedLandCostPU: 50000, assumedLandCostPU_coastal: 55000,
      softCostPct: 0.15, otherIncomePUM: 247, fixedOpExPU: 7014,
      insurancePU_nc: 800, insurancePU_coastal: 950,
      unitMix: [{ pct: 0.30, avgSF: 2020, monthlyRent: 2750 }, { pct: 0.70, avgSF: 2600, monthlyRent: 3000 }],
    },
    // BTR TH 2-3BR — 10 u/a (smaller attached TH product)
    // otherIncomePUM $251: v22 — same as BTR TH 3-Story (confirmed from model data)
    'btr-th-2-3br': {
      label: 'BTR TH 2-3BR',
      dua: 10, hardCostPU: 230000, assumedLandCostPU: 50000, assumedLandCostPU_coastal: 55000,
      softCostPct: 0.15, otherIncomePUM: 251, fixedOpExPU: 7014,
      insurancePU_nc: 750, insurancePU_coastal: 900,
      unitMix: [{ pct: 0.60, avgSF: 1290, monthlyRent: 1850 }, { pct: 0.40, avgSF: 1495, monthlyRent: 2200 }],
    },
  };

  // Maps dashboard product type keys → Excel template parameters for one-click UW download.
  const PRODUCT_TYPE_EXCEL_CONFIG: Record<string, { templateType: string; constructionCostPSF: number | null; siteworkPU: number }> = {
    '3-story-surface-park': { templateType: '3story-conventional',   constructionCostPSF: 160, siteworkPU: 20000 },
    '3-story-attainable':   { templateType: '3story-attainable',     constructionCostPSF: 130, siteworkPU: 20000 },
    '4-story-surface-park': { templateType: '4story-conventional',   constructionCostPSF: 175, siteworkPU: 0 },
    'aa-3-story-flats':     { templateType: '3story-active-adult',   constructionCostPSF: 160, siteworkPU: 20000 },
    'aa-4-story-flats':     { templateType: '4story-active-adult',   constructionCostPSF: 180, siteworkPU: 20000 },
    'aa-cottages':          { templateType: 'aa-cottages',           constructionCostPSF: 150, siteworkPU: 50000 },
    'btr-3-story-th':       { templateType: 'btr',                   constructionCostPSF: null, siteworkPU: 50000 },
    'btr-sfr-detached':     { templateType: 'sfr',                   constructionCostPSF: null, siteworkPU: 50000 },
    'btr-th-2-3br':         { templateType: 'btr',                   constructionCostPSF: null, siteworkPU: 50000 },
  };

  // Returns average rent PSF from HelloData comps — used for conventional/AA types where
  // we multiply PSF × weighted-avg unit SF to get monthly rent.
  function extractHellodataRentPSF(comparablesJson: any[]): number | null {
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
    // Use the top (highest) comp PSF — new construction commands a premium over the comp set
    return Math.max(...psfs);
  }

  // Returns the TOP (highest) avg monthly rent from HelloData comps — used for BTR types.
  // Analysts use the best apartment comp as a proxy for the 2BR market rate, then add $200
  // as a new-construction BTR premium (private entry, garage, yard vs. apartment).
  // Prefers qualifying comps; falls back to all comps with avgRent data.
  // Returns null when no rent data is available.
  function extractTopCompAvgRent(comparablesJson: any[]): number | null {
    if (!Array.isArray(comparablesJson) || comparablesJson.length === 0) return null;
    const qualifying = comparablesJson.filter(c => c.isQualifying && c.avgRent > 0);
    const source = qualifying.length > 0 ? qualifying : comparablesJson.filter(c => c.avgRent > 0);
    if (source.length === 0) return null;
    const rents = source.map(c => c.avgRent).filter((v): v is number => v > 0);
    if (rents.length === 0) return null;
    return Math.max(...rents);
  }

  // Maps high-level MSA category names (from targetProductTypes) to specific preset keys.
  // Used when the analyst hasn't selected a specific building type (productTypes is empty).
  // Conventional → 3-Story SP (most common at 25 u/a); Active Adult → AA 3-Story; BTR → BTR TH.
  const TARGET_TYPE_TO_PRESET_FALLBACK: Record<string, string[]> = {
    'Conventional Apartments':  ['3-story-surface-park'],
    'Conventional':             ['3-story-surface-park'],
    'Active Adult':             ['aa-3-story-flats'],
    'Active Adult Flats':       ['aa-3-story-flats'],
    'Active Adult Cottages':    ['aa-cottages'],
    'Student Housing':          ['3-story-surface-park'],
    'Affordable Housing':       ['3-story-attainable'],
    'Attainable':               ['3-story-attainable'],
    'BTR':                      ['btr-3-story-th'],
    'Build-to-Rent':            ['btr-3-story-th'],
    'BTR Townhome':             ['btr-3-story-th'],
    'BTR TH':                   ['btr-3-story-th'],
    'BTR SFR':                  ['btr-sfr-detached'],
    'BTR SFR Detached':         ['btr-sfr-detached'],
  };

  // Returns the effective preset keys for a deal. Prefers analyst-selected productTypes;
  // falls back to mapping targetProductTypes (MSA category) when productTypes is empty.
  function resolveProductTypeKeys(productTypes: string[], targetProductTypes?: string[]): string[] {
    const direct = (productTypes || []).filter(t => PRODUCT_TYPE_YOC_PRESETS[t]);
    if (direct.length > 0) return direct;
    if (!targetProductTypes || targetProductTypes.length === 0) return [];
    return targetProductTypes.flatMap(t => TARGET_TYPE_TO_PRESET_FALLBACK[t] || []);
  }

  function calculateYOCForProductTypes(
    productTypes: string[],
    landCost: number,
    sizeAcres: number,
    comparablesJson?: any[], // HelloData comparables from the deal
    targetProductTypes?: string[], // MSA-level category fallback
    dealUnitCount?: number, // Actual unit count from the deal (overrides sizeAcres × preset.dua when single type)
    state?: string, // US state abbreviation — drives coastal insurance tier and market tax adjustments
    city?: string,  // City name — used for NC sub-market tier override (Research Triangle vs Charlotte MSA vs secondary)
    fallbackRentPsf?: number | null  // Scalar avg_rent_psf from the deal row — used when comparablesJson has no PSF data
  ): string | null {
    // Rental loss assumptions (PDF Reference Guide, Section 04):
    //   Vacancy 5% of Gross Potential Income (GPR + other income)
    //   LTL 1% + Concessions market-based (1%) + Bad Debt 0%
    // OpEx: management fee 2.75% of EGI + per-preset fixed OpEx (varies by product type)
    // Soft costs: per-preset % of hard costs (conv 28%, BTR 25% — derived from actual models)
    const VACANCY = 0.05;
    const LTL = 0.01, CONCESSION = 0.01, BAD_DEBT = 0.00;
    const MGMT_PCT = 0.0275;

    // Coastal insurance tier: FL/SC always coastal; specific NC/GA cities also qualify
    const isCoastal = state ? (
      COASTAL_STATES.has(state.toUpperCase()) ||
      (state.toUpperCase() === 'NC' && !!city && COASTAL_CITIES_NC.has(city.toUpperCase().trim())) ||
      (state.toUpperCase() === 'GA' && !!city && COASTAL_CITIES_GA.has(city.toUpperCase().trim()))
    ) : false;

    // Market-level RE tax adjustment (above default $1,971 baked into fixedOpExPU)
    const reTaxAdjPU = state ? (RE_TAX_ADJUSTMENT_BY_STATE[state.toUpperCase()] ?? 0) : 0;

    // State-level rent multiplier — accounts for regional rent levels vs national preset baseline.
    // Applied to both HelloData and preset rents. NOT applied to BTR types (their presets are
    // calibrated independently and don't use HelloData comps).
    const stateKey = state ? state.toUpperCase() : '';
    let rentStateMult = stateKey
      ? (RENT_MULT_BY_STATE[stateKey] ?? RENT_MULT_DEFAULT)
      : RENT_MULT_DEFAULT;

    // State-level assumed land cost multiplier — only applied when no actual asking price exists.
    // Accounts for states where land values are high relative to the preset baseline.
    let landStateMult = stateKey
      ? (LAND_COST_MULT_BY_STATE[stateKey] ?? LAND_COST_MULT_DEFAULT)
      : LAND_COST_MULT_DEFAULT;

    // NC city-level sub-market override:
    // The NC state defaults (0.82 rent / 2.50 land) are calibrated for secondary markets
    // (Greensboro, High Point, Burlington). Research Triangle and Charlotte MSA have
    // significantly higher rent potential and more moderate land costs → override for those cities.
    if (stateKey === 'NC' && city) {
      const cityUpper = city.toUpperCase().trim();
      if (NC_RESEARCH_TRIANGLE_CITIES.has(cityUpper)) {
        rentStateMult = 0.93; // Research Triangle: rents materially stronger than secondary NC
        landStateMult = 1.40; // Land expensive but not secondary-market extreme
      } else if (NC_CHARLOTTE_MSA_CITIES.has(cityUpper)) {
        rentStateMult = 0.90; // Charlotte MSA: mid-tier rents, moderately above secondary NC
        landStateMult = 1.65; // Land moderately elevated vs non-NC default
      }
      // else: keep NC state defaults (0.82 / 2.50) for secondary markets
    }

    const typesWithPresets = resolveProductTypeKeys(productTypes, targetProductTypes);
    if (typesWithPresets.length === 0) return null;

    // Pull HelloData rent PSF — used for conventional/AA types only.
    // Conventional/AA: use top comp PSF × unit SF + $50 new-construction premium.
    // BTR: use top comp avgRent + $200 (analysts take the best apt comp as a 2BR proxy,
    //      then add $200 premium for private entry, garage, yard vs. apartment).
    //      Falls back to preset when no comps exist.
    // Pull PSF from comparablesJson first; if empty/null fall back to the scalar avg_rent_psf
    // stored directly on the deal (populated when HelloData returns a PSF but the individual
    // comp records are not stored in comparables_json, or for older deals analysed before
    // per-comp storage was added).
    const hellodataRentPSF =
      (comparablesJson ? extractHellodataRentPSF(comparablesJson) : null) ??
      (fallbackRentPsf && fallbackRentPsf > 0 ? fallbackRentPsf : null);
    const topCompAvgRent = comparablesJson ? extractTopCompAvgRent(comparablesJson) : null;
    const hasActualLandCost = landCost > 0;

    // When there's exactly one product type AND the deal has a stored unit count, use it.
    // This prevents the preset DUA from over-counting units on constrained sites (e.g., a
    // 10-acre parcel entitled for 200 units at 20 DUA, not the 35-DUA preset = 350 units).
    const singleType = typesWithPresets.length === 1;
    const useActualUnits = singleType && dealUnitCount && dealUnitCount > 0;

    // Require acreage when using DUA-based unit count. Skip requirement when
    // useActualUnits is true — dealUnitCount fully drives totals without needing acres.
    if ((!sizeAcres || sizeAcres <= 0) && !useActualUnits) return null;

    const parts: string[] = [];
    const yocValues: number[] = [];
    for (const t of typesWithPresets) {
      const preset = PRODUCT_TYPE_YOC_PRESETS[t];
      const totalUnits = useActualUnits ? dealUnitCount! : sizeAcres * preset.dua;

      // Use actual asking price if available; otherwise fall back to assumed $/unit land cost.
      // Coastal states (FL, SC) carry a land premium — use the coastal tier when isCoastal.
      // When no asking price: also apply state-level land cost multiplier to correct for
      // markets where preset land assumptions are below actual market land values.
      const landCostPU = isCoastal ? preset.assumedLandCostPU_coastal : preset.assumedLandCostPU;
      const effectiveLandCost = hasActualLandCost
        ? landCost
        : totalUnits * landCostPU * landStateMult;

      // Blended rent:
      //   Conventional / Attainable → HelloData PSF × weighted unit SF when available
      //   AA types → always use preset rents (HD comps are conventional apts, not age-restricted;
      //     conventional PSF values overstate AA rents by 10-20% and caused #150 Charleston to
      //     show 10.7% auto YOC vs actual 5.9% when HD returned $3.08/SF from conventional comps)
      //   BTR → always use assumption rents (HelloData returns apartment comps, not BTR comps)
      const isBTR = t === 'btr-sfr-detached' || t === 'btr-3-story-th' || t === 'btr-th-2-3br';
      const isAA = t === 'aa-3-story-flats' || t === 'aa-4-story-flats' || t === 'aa-cottages';
      const presetBlendedRent = preset.unitMix.reduce((sum, r) => sum + r.pct * r.monthlyRent, 0);
      let blendedRent: number;
      let rentSource: string;

      // Comp-based path: use top comp PSF exactly (new construction commands the best comps
      // as the highest-quality product in the market) then add $50/unit new-construction premium.
      // Preset path: apply 10% haircut + state-level multiplier to regionalize national baselines.
      const RENT_HAIRCUT = 0.90;
      // BTR and AA preset rents are calibrated per-deal and don't use HelloData, so no state mult.
      const effectiveRentMult = (isBTR || isAA) ? 1.0 : rentStateMult;

      if (!isBTR && !isAA && hellodataRentPSF && hellodataRentPSF > 0) {
        // Conventional only: top comp PSF × weighted avg SF + $50 new-construction premium.
        const weightedAvgSF = preset.unitMix.reduce((sum, r) => sum + r.pct * r.avgSF, 0);
        blendedRent = hellodataRentPSF * weightedAvgSF + 50;
        rentSource = `$${hellodataRentPSF.toFixed(2)}/SF+$50NC`;
      } else if (isBTR && topCompAvgRent && topCompAvgRent > 0) {
        // BTR: top apt comp avg rent + $200 BTR premium (private entry, garage, yard).
        // Analysts use the best apartment comp as a 2BR market proxy — the $200 spread
        // accounts for the quality premium BTR commands over garden apartments.
        blendedRent = topCompAvgRent + 200;
        rentSource = `$${Math.round(topCompAvgRent).toLocaleString()}avg+$200BTR`;
      } else {
        // Preset rents are national baselines — apply state-level correction to regionalize them.
        blendedRent = presetBlendedRent * RENT_HAIRCUT * effectiveRentMult;
        rentSource = 'preset';
      }

      // Revenue model (mirrors Excel vetting model structure):
      //   GPI = GPR + other income (cable, trash, pet, storage)
      //   Losses = vacancy % × GPI  +  (LTL + concessions + bad debt) × GPR
      //   EGI = GPI − losses
      const gpr = totalUnits * blendedRent * 12;
      const otherIncome = totalUnits * preset.otherIncomePUM * 12;
      const totalGross = gpr + otherIncome;
      const losses = totalGross * VACANCY + gpr * (LTL + CONCESSION + BAD_DEBT);
      const egi = totalGross - losses;
      const insurancePU = isCoastal ? preset.insurancePU_coastal : preset.insurancePU_nc;
      const totalOpEx = egi * MGMT_PCT + totalUnits * (preset.fixedOpExPU + insurancePU + reTaxAdjPU);
      const noi = egi - totalOpEx;

      // TDC = land + hard costs × (1 + softCostPct)
      const constructionCost = totalUnits * preset.hardCostPU * (1 + preset.softCostPct);
      const tdc = effectiveLandCost + constructionCost;
      const yoc = (noi / tdc) * 100;
      if (isFinite(yoc)) {
        const yocLabel = hasActualLandCost ? yoc.toFixed(1) : `~${yoc.toFixed(1)}`;
        parts.push(`${preset.label}: ${yocLabel}% (${rentSource})`);
        yocValues.push(yoc);
      }
    }
    if (parts.length === 0) return null;
    // When multiple product types, prepend the BEST (max) YOC as the headline —
    // this represents the optimal development scenario the analyst would actually pursue.
    if (yocValues.length > 1) {
      const best = Math.max(...yocValues);
      const bestLabel = hasActualLandCost ? best.toFixed(1) : `~${best.toFixed(1)}`;
      parts.unshift(`BEST: ${bestLabel}%`);
    }
    return parts.join(' | ');
  }

  // ─── Auto YOC formula breakdown — for the popover ────────────────────────────
  // Returns a structured object with every intermediate value so the UI can display
  // exactly what drove the YOC number (comps used, preset values, losses, TDC, etc.)
  function calculateYOCBreakdown(deal: any): {
    types: {
      presetKey: string; presetLabel: string; dua: number; totalUnits: number;
      hardCostPU: number; softCostPct: number; fixedOpExPU: number; insurancePU: number;
      otherIncomePUM: number; reTaxAdjPU: number;
      blendedRent: number; rentSource: string; rentMode: 'hellodata-psf' | 'hellodata-avgrent' | 'preset';
      hellodataRentPSF: number | null; topCompAvgRent: number | null; weightedAvgSF: number;
      presetBlendedRent: number;
      rentHaircut: number; rentStateMult: number;
      gpr: number; otherIncome: number; totalGross: number;
      vacancyLoss: number; creditLoss: number; egi: number;
      mgmtFee: number; fixedOpEx: number; insurance: number; reTaxAdj: number; totalOpEx: number; noi: number;
      landCost: number; landCostPU: number; landStateMult: number; hasActualLandCost: boolean;
      hardCostTotal: number; softCostTotal: number; tdc: number; yoc: number;
    }[];
    compsUsed: { name: string; avgRent: number | null; rentPSF: number | null; isQualifying: boolean; isTop: boolean }[];
    state: string; city: string; isCoastal: boolean;
    rentStateMult: number; landStateMult: number;
  } | null {
    const productTypes = deal.productTypes || [];
    const targetProductTypes = deal.targetProductTypes || [];
    const landCost = parseFloat(deal.askingPrice || '0');
    const sizeAcres = parseFloat(deal.sizeAcres || '0');
    const comparablesJson: any[] = Array.isArray(deal.comparablesJson) ? deal.comparablesJson : [];
    const state = deal.state || '';
    const city = deal.city || '';
    const dealUnitCount = parseInt(deal.unitCount?.toString() || deal.estimatedUnits?.toString() || '0') || 0;

    const typesWithPresets = resolveProductTypeKeys(productTypes, targetProductTypes);
    if (typesWithPresets.length === 0) return null;

    const isCoastal = state ? (
      COASTAL_STATES.has(state.toUpperCase()) ||
      (state.toUpperCase() === 'NC' && !!city && COASTAL_CITIES_NC.has(city.toUpperCase().trim())) ||
      (state.toUpperCase() === 'GA' && !!city && COASTAL_CITIES_GA.has(city.toUpperCase().trim()))
    ) : false;
    const stateKey = state.toUpperCase();
    const reTaxAdjPU = stateKey ? (RE_TAX_ADJUSTMENT_BY_STATE[stateKey] ?? 0) : 0;
    let rentStateMult = stateKey ? (RENT_MULT_BY_STATE[stateKey] ?? RENT_MULT_DEFAULT) : RENT_MULT_DEFAULT;
    let landStateMult = stateKey ? (LAND_COST_MULT_BY_STATE[stateKey] ?? LAND_COST_MULT_DEFAULT) : LAND_COST_MULT_DEFAULT;

    if (stateKey === 'NC' && city) {
      const cityUpper = city.toUpperCase().trim();
      if (NC_RESEARCH_TRIANGLE_CITIES.has(cityUpper)) { rentStateMult = 0.93; landStateMult = 1.40; }
      else if (NC_CHARLOTTE_MSA_CITIES.has(cityUpper)) { rentStateMult = 0.90; landStateMult = 1.65; }
    }

    // Fall back to scalar avg_rent_psf on the deal when comparables_json is empty
    const fallbackRentPsf: number | null = (deal.avgRentPsf && parseFloat(deal.avgRentPsf) > 0)
      ? parseFloat(deal.avgRentPsf)
      : (deal.topRentPsf && parseFloat(deal.topRentPsf) > 0 ? parseFloat(deal.topRentPsf) : null);
    const hellodataRentPSF =
      extractHellodataRentPSF(comparablesJson) ?? fallbackRentPsf;
    const topCompAvgRent = extractTopCompAvgRent(comparablesJson);
    const hasActualLandCost = landCost > 0;
    const singleType = typesWithPresets.length === 1;
    const useActualUnits = singleType && dealUnitCount > 0;
    if ((!sizeAcres || sizeAcres <= 0) && !useActualUnits) return null;

    const VACANCY = 0.05, LTL = 0.01, CONCESSION = 0.01, BAD_DEBT = 0.00, MGMT_PCT = 0.0275, RENT_HAIRCUT = 0.90;

    const types = typesWithPresets.map(t => {
      const preset = PRODUCT_TYPE_YOC_PRESETS[t];
      const totalUnits = useActualUnits ? dealUnitCount : sizeAcres * preset.dua;
      const landCostPU = isCoastal ? preset.assumedLandCostPU_coastal : preset.assumedLandCostPU;
      const effectiveLandCost = hasActualLandCost ? landCost : totalUnits * landCostPU * landStateMult;
      const isBTR = t === 'btr-sfr-detached' || t === 'btr-3-story-th' || t === 'btr-th-2-3br';
      const isAA = t === 'aa-3-story-flats' || t === 'aa-4-story-flats' || t === 'aa-cottages';
      const presetBlendedRent = preset.unitMix.reduce((s, r) => s + r.pct * r.monthlyRent, 0);
      const weightedAvgSF = preset.unitMix.reduce((s, r) => s + r.pct * r.avgSF, 0);
      const effectiveRentMult = (isBTR || isAA) ? 1.0 : rentStateMult;
      let blendedRent: number, rentSource: string;
      let rentMode: 'hellodata-psf' | 'hellodata-avgrent' | 'preset';

      if (!isBTR && !isAA && hellodataRentPSF && hellodataRentPSF > 0) {
        blendedRent = hellodataRentPSF * weightedAvgSF + 50;
        const psfSource = comparablesJson.length > 0 ? 'top comp' : 'avg_rent_psf field';
        rentSource = `$${hellodataRentPSF.toFixed(2)}/SF (${psfSource}) × ${Math.round(weightedAvgSF).toLocaleString()}SF + $50NC`;
        rentMode = 'hellodata-psf';
      } else if (isBTR && topCompAvgRent && topCompAvgRent > 0) {
        blendedRent = topCompAvgRent + 200;
        rentSource = `$${Math.round(topCompAvgRent).toLocaleString()} top comp + $200 BTR premium`;
        rentMode = 'hellodata-avgrent';
      } else {
        blendedRent = presetBlendedRent * RENT_HAIRCUT * effectiveRentMult;
        rentSource = `$${Math.round(presetBlendedRent).toLocaleString()} preset × ${RENT_HAIRCUT} haircut × ${effectiveRentMult.toFixed(2)} state`;
        rentMode = 'preset';
      }

      const insurancePU = isCoastal ? preset.insurancePU_coastal : preset.insurancePU_nc;
      const gpr = totalUnits * blendedRent * 12;
      const otherIncome = totalUnits * preset.otherIncomePUM * 12;
      const totalGross = gpr + otherIncome;
      const vacancyLoss = totalGross * VACANCY;
      const creditLoss = gpr * (LTL + CONCESSION + BAD_DEBT);
      const egi = totalGross - vacancyLoss - creditLoss;
      const mgmtFee = egi * MGMT_PCT;
      const fixedOpEx = totalUnits * preset.fixedOpExPU;
      const insurance = totalUnits * insurancePU;
      const reTaxAdj = totalUnits * reTaxAdjPU;
      const totalOpEx = mgmtFee + fixedOpEx + insurance + reTaxAdj;
      const noi = egi - totalOpEx;
      const hardCostTotal = totalUnits * preset.hardCostPU;
      const softCostTotal = hardCostTotal * preset.softCostPct;
      const tdc = effectiveLandCost + hardCostTotal + softCostTotal;
      const yoc = (noi / tdc) * 100;

      return {
        presetKey: t, presetLabel: preset.label, dua: preset.dua, totalUnits,
        hardCostPU: preset.hardCostPU, softCostPct: preset.softCostPct, fixedOpExPU: preset.fixedOpExPU,
        insurancePU, otherIncomePUM: preset.otherIncomePUM, reTaxAdjPU,
        blendedRent, rentSource, rentMode, hellodataRentPSF, topCompAvgRent, weightedAvgSF, presetBlendedRent,
        rentHaircut: RENT_HAIRCUT, rentStateMult: effectiveRentMult,
        gpr, otherIncome, totalGross, vacancyLoss, creditLoss, egi,
        mgmtFee, fixedOpEx, insurance, reTaxAdj, totalOpEx, noi,
        landCost: effectiveLandCost, landCostPU, landStateMult: hasActualLandCost ? 1 : landStateMult,
        hasActualLandCost, hardCostTotal, softCostTotal, tdc, yoc,
      };
    });

    // Build comps summary — show up to 6 comps with which was "top"
    const compsUsed = comparablesJson
      .filter(c => c.avgRent > 0 || c.rentPSF > 0)
      .slice(0, 8)
      .map(c => {
        const psf = c.rentPSF || (c.avgRent && c.avgSF ? c.avgRent / c.avgSF : null);
        const isTopPSF = hellodataRentPSF != null && psf != null && Math.abs(psf - hellodataRentPSF) < 0.005;
        const isTopAvg = topCompAvgRent != null && c.avgRent != null && Math.abs(c.avgRent - topCompAvgRent) < 1;
        return {
          name: c.propertyName || c.name || c.address || 'Comp',
          avgRent: c.avgRent || null,
          rentPSF: psf || null,
          isQualifying: !!c.isQualifying,
          isTop: isTopPSF || isTopAvg,
        };
      });

    return { types, compsUsed, state, city, isCoastal, rentStateMult, landStateMult };
  }

  // ─── One-click UW Excel download from Auto YOC cell ──────────────────────────
  async function downloadDealExcel(deal: any) {
    console.log('[Excel download] Starting for deal:', deal.id, 'productTypes:', deal.productTypes, 'targetProductTypes:', deal.targetProductTypes);
    const resolved = resolveProductTypeKeys(deal.productTypes || [], deal.targetProductTypes || []);
    if (resolved.length === 0) { console.warn('[Excel download] No resolved product types'); return; }
    // Use the first resolved product type for the Excel template
    const typeKey = resolved[0];
    console.log('[Excel download] typeKey:', typeKey);
    const excelCfg = PRODUCT_TYPE_EXCEL_CONFIG[typeKey];
    if (!excelCfg) { console.warn('[Excel download] No Excel config for typeKey:', typeKey); return; }
    const preset = PRODUCT_TYPE_YOC_PRESETS[typeKey];
    if (!preset) { console.warn('[Excel download] No preset for typeKey:', typeKey); return; }

    const sizeAcres = parseFloat(deal.sizeAcres || '0');
    const dealUnitCount = parseInt(deal.unitCount?.toString() || deal.estimatedUnits?.toString() || '0') || 0;
    // Use explicit unit count if available, regardless of how many product types are selected.
    // Fall back to DUA × acres only when no unit count is provided.
    const totalUnits = dealUnitCount > 0
      ? dealUnitCount
      : Math.round(sizeAcres * preset.dua);
    if (totalUnits <= 0) { console.warn('[Excel download] totalUnits is 0, sizeAcres:', sizeAcres, 'dealUnitCount:', dealUnitCount); return; }

    const body = {
      templateType: excelCfg.templateType,
      propertyName: deal.propertyName || deal.address || 'Deal',
      address: deal.address || '',
      cityState: deal.city && deal.state ? `${deal.city}, ${deal.state}` : (deal.city || deal.state || ''),
      zip: deal.zip || deal.zipCode || '',
      market: deal.market || deal.city || '',
      county: deal.county || '',
      totalUnits,
      unitMix: preset.unitMix.map((r: any) => ({ pct: r.pct, avgSF: r.avgSF, monthlyRent: r.monthlyRent })),
      landCost: parseFloat(deal.askingPrice || '0'),
      constructionCostPSF: excelCfg.constructionCostPSF,
      siteworkPU: excelCfg.siteworkPU,
    };

    setDownloadingExcelDealId(deal.id);
    try {
      const response = await fetch('/api/underwriting/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error('[Excel download] Server error:', errText);
        throw new Error(errText);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (deal.address || deal.propertyName || 'Deal').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `${safeName}_${preset.label.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Excel download] Failed:', err);
    } finally {
      setDownloadingExcelDealId(null);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const draftSummaryMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const response = await apiRequest("POST", `/api/deals/${dealId}/draft-summary`, {});
      const result = await response.json();
      return result.draft as string;
    },
  });

  // Optimized cell update mutation with debouncing and optimistic updates
  const cellUpdateMutation = useMutation({
    mutationKey: ['updateDealCell'],
    retry: false, // Don't retry to prevent conflicts
    mutationFn: async (data: { 
      dealId: string; 
      classification?: string; 
      analystNotes?: string; 
      status?: string;
      rejectionReason?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      propertyName?: string;
      unitCount?: number;
      vintage?: number;
      sizeAcres?: number;
      qctStatus?: string;
      topRentPSF?: string;
      projectedRentPerSF?: number;
      developer?: string;
      partner?: string;
      assignedDeveloper?: string;
      assignedPartner?: string;
      nextSteps?: string;
      assignedAnalyst?: string;
      assignedJrAnalyst?: string;
      population55Plus5Mile?: number;
      income75Plus55Plus?: number;
      demographicsNotes?: string;
      yieldOnCost?: string;
      irr?: string;
      automatedYoc?: string;
      productTypes?: string[];
      hasEntitlements?: boolean;
      sewerAvailable?: boolean;
      underContract?: boolean;
      loiSubmitted?: boolean;
      apex?: boolean;
      apexNotes?: string | null;
      nextAssignee?: string | null;
      dealStep?: string | null;
      priority?: string | null;
      brokerName?: string;
      brokerFirstName?: string;
      brokerLastName?: string;
      brokerId?: string;
      brokerNotes?: string;
      brokerEmail?: string;
      brokerPhone?: string;
      marketsCovered?: string;
      dealType?: string;
      yearBuilt?: number;
      triggerReclassification?: boolean;
      excelModelUrl?: string | null;
      ozStatus?: string | null;
      wetlandNotes?: string | null;
      developerSummary?: string | null;
      dealSummary?: string | null;
      netDevelopableAcres?: number | null;
      maxUnitsByZoning?: number | null;
    }) => {
      console.log('🔄 cellUpdateMutation called with:', data);
      
      // Normalize boolean fields
      const normalizedData = { ...data };
      if ('hasEntitlements' in normalizedData) {
        normalizedData.hasEntitlements = normalizeBooleanValue(normalizedData.hasEntitlements);
      }
      if ('sewerAvailable' in normalizedData) {
        normalizedData.sewerAvailable = normalizeBooleanValue(normalizedData.sewerAvailable);
      }
      
      console.log('📤 Making PATCH request to:', `/api/deals/${data.dealId}`, 'with data:', normalizedData);
      
      try {
        const response = await apiRequest("PATCH", `/api/deals/${data.dealId}`, normalizedData);
        const result = await response.json();
        
        console.log('✅ PATCH response received:', result);
        return { ...result, dealId: data.dealId, updatedField: Object.keys(data).find(key => key !== 'dealId') };
      } catch (error) {
        console.error('❌ PATCH request failed:', error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log('✅ cellUpdateMutation success for deal:', variables.dealId, 'Updated data:', data);
      
      const field = Object.keys(variables).find(key => key !== 'dealId');
      
      // Update save state to saved
      if (field) {
        updateSaveState(variables.dealId, field, 'saved');
      }

      // Show toast for Excel/SharePoint link saves, then extract underwriting data
      if (field === 'excelModelUrl') {
        if ((variables as any).excelModelUrl) {
          toast({
            title: "SharePoint link saved — extracting UW data…",
            description: "Parsing your Excel model and saving the underwriting data.",
          });
          // Small delay to ensure the DB write has committed before we read back the deal
          setTimeout(() => extractExcelUW({ id: variables.dealId }), 800);
        } else {
          toast({
            title: "SharePoint link cleared",
            description: "The link has been removed.",
          });
        }
      }

      // Poll for reclassification completion when deal type changes
      if (data.reclassificationPending) {
        console.log('🔄 Reclassification pending for deal:', variables.dealId, '- starting poll...');
        const originalClassification = data.classification;
        let pollCount = 0;
        const maxPolls = 10; // Max 10 polls (20 seconds total)
        
        const pollForClassification = async () => {
          pollCount++;
          if (pollCount > maxPolls) {
            console.log('⚠️ Reclassification poll timeout for deal:', variables.dealId);
            return;
          }
          
          try {
            const response = await fetch(`/api/deals/${variables.dealId}`, { credentials: 'include' });
            if (response.ok) {
              const updatedDeal = await response.json();
              if (updatedDeal.classification !== originalClassification) {
                console.log('✅ Reclassification complete:', variables.dealId, 'New classification:', updatedDeal.classification);
                // Update the cache with new classification
                queryClient.setQueryData(
                  ['/api/deals', currentPage, pageSize, filterClassifications.join(','), filterPriorities.join(','), filterDealTypes.join(','), filterApex.join(','), searchQuery, filterRiskLevel, showOnlyFlagged, sortColumn, sortDirection],
                  (oldData: any) => {
                    if (!oldData) return oldData;
                    return {
                      ...oldData,
                      deals: oldData.deals.map((deal: any) => 
                        deal.id === variables.dealId ? { ...deal, ...updatedDeal } : deal
                      )
                    };
                  }
                );
                return; // Done polling
              }
            }
          } catch (error) {
            console.error('Poll error:', error);
          }
          
          // Continue polling after 2 seconds
          setTimeout(pollForClassification, 2000);
        };
        
        // Start polling after 2 seconds (give backend time to process)
        setTimeout(pollForClassification, 2000);
      }

      // Automatic team assignment when product type is changed
      if (field === 'productTypes' && variables.productTypes && variables.productTypes.length > 0) {
        const productType = variables.productTypes[0];
        console.log('🎯 Product type changed to:', productType, 'automatically assigning team...');
        
        // Get current deal data to check location
        const currentDeal = (queryClient.getQueryData(['/api/deals', currentPage, pageSize, filterClassifications.join(','), filterPriorities.join(','), filterDealTypes.join(','), filterApex.join(','), searchQuery, filterRiskLevel, showOnlyFlagged, sortColumn, sortDirection]) as any)?.deals?.find((d: any) => d.id === variables.dealId);
        const dealAddress = currentDeal?.address || '';
        
        // Check if location is in North or South Carolina
        const isNorthOrSouthCarolina = dealAddress.toLowerCase().includes('nc') || 
                                      dealAddress.toLowerCase().includes('sc') || 
                                      dealAddress.toLowerCase().includes('north carolina') || 
                                      dealAddress.toLowerCase().includes('south carolina') ||
                                      dealAddress.toLowerCase().includes('charlotte') ||
                                      dealAddress.toLowerCase().includes('raleigh') ||
                                      dealAddress.toLowerCase().includes('columbia');
        
        // Define team assignments based on product type and location
        const getTeamAssignment = (productType: string) => {
          const baseAssignments = {
            assignedJrAnalyst: 'Sheng',
            assignedAnalyst: 'Austin Blondell'
          };
          
          const isAAType = productType.startsWith('aa-') || productType === 'active-adult';
          const isBTRSubtype = productType.startsWith('btr-') || productType === 'btr';
          const isSurfacePark = productType === '3-story-surface-park' || productType === '4-story-surface-park';

          if (isAAType) {
            return {
              ...baseAssignments,
              assignedDeveloper: 'John Bell',
              assignedPartner: 'AJ Klenk'
            };
          }
          if (isBTRSubtype) {
            return {
              ...baseAssignments,
              assignedDeveloper: isNorthOrSouthCarolina ? 'Steve Hillebrand' : 'John Bell',
              assignedPartner: 'Brian Ford'
            };
          }
          if (isSurfacePark || productType === 'conventional') {
            return {
              ...baseAssignments,
              assignedDeveloper: isNorthOrSouthCarolina ? 'Steve Hillebrand' : 'John Bell',
              assignedPartner: 'AJ Klenk'
            };
          }
          if (productType === 'lot') {
            return {
              ...baseAssignments,
              assignedDeveloper: 'Mallie Colavita',
              assignedPartner: 'Brian Ford'
            };
          }
          return baseAssignments;
        };

        const assignment = getTeamAssignment(productType);
        console.log('🎯 Location detected:', isNorthOrSouthCarolina ? 'North/South Carolina' : 'Other', 'for address:', dealAddress);
        console.log('🎯 Applying team assignment:', assignment);
        
        // Make a follow-up API call to update team assignments
        cellUpdateMutation.mutate({
          dealId: variables.dealId,
          ...assignment
        });

        // Auto-calculate Automated YOC using HelloData comparable rents + underwriting presets
        // Runs even when no asking price — falls back to assumed land cost $/unit by product type
        const landCost = parseFloat(currentDeal?.askingPrice || '0');
        const sizeAcres = parseFloat(currentDeal?.sizeAcres || '0');
        const dealUnitCount = parseInt(currentDeal?.unitCount?.toString() || currentDeal?.estimatedUnits?.toString() || '0') || 0;
        if (sizeAcres > 0 || dealUnitCount > 0) {
          const comparablesJson = currentDeal?.comparablesJson || [];
          const autoYoc = calculateYOCForProductTypes(
            variables.productTypes || [],
            landCost,
            sizeAcres,
            Array.isArray(comparablesJson) ? comparablesJson : [],
            currentDeal?.targetProductTypes || [],
            dealUnitCount > 0 ? dealUnitCount : undefined,
            currentDeal?.state || undefined,
            currentDeal?.city || undefined
          );
          if (autoYoc) {
            console.log('📊 [AUTO-YOC] Calculated:', autoYoc, 'for deal:', variables.dealId);
            cellUpdateMutation.mutate({ dealId: variables.dealId, automatedYoc: autoYoc });
          }
        } else {
          console.log('📊 [AUTO-YOC] Skipped — missing acreage for deal:', variables.dealId);
        }
      }

      // Clear optimistic update for this field since we have real data
      setOptimisticUpdates(prev => {
        const updated = { ...prev };
        if (updated[variables.dealId] && field) {
          const { [field]: removed, ...rest } = updated[variables.dealId];
          if (Object.keys(rest).length === 0) {
            delete updated[variables.dealId];
          } else {
            updated[variables.dealId] = rest;
          }
        }
        return updated;
      });
      
      // Optimized query invalidation - only invalidate current page query
      // Special handling for broker fields that need to update deal.broker.* instead of deal.*
      const brokerFields = ['marketsCovered', 'brokerEmail', 'brokerPhone', 'brokerFirstName', 'brokerLastName', 'brokerName'];
      const hasBrokerFields = brokerFields.some(f => f in variables);
      
      queryClient.setQueryData(
        ['/api/deals', currentPage, pageSize, filterClassifications.join(','), filterPriorities.join(','), filterDealTypes.join(','), filterApex.join(','), searchQuery, filterRiskLevel, showOnlyFlagged, sortColumn, sortDirection],
        (oldData: any) => {
          if (!oldData) return oldData;

          // A broker's contact info is shared across every deal from that broker
          // (they all point at the same brokers-table row via brokerId). Figure out
          // which brokerId this edit affects so we can keep every visible deal row
          // from that same broker in sync, not just the one that was edited.
          const editedDeal = oldData.deals.find((d: any) => d.id === variables.dealId);
          const newBrokerIdFromResponse = (data as any)?.brokerId;
          const affectedBrokerId = editedDeal?.brokerId || newBrokerIdFromResponse;

          return {
            ...oldData,
            deals: oldData.deals.map((deal: any) => {
              const isEditedDeal = deal.id === variables.dealId;
              const sharesBroker = hasBrokerFields && affectedBrokerId && deal.brokerId === affectedBrokerId;

              if (!isEditedDeal && !sharesBroker) return deal;
              
              // Handle broker field updates - update the broker sub-object
              // NOTE: deal.broker may be null/undefined if the deal had no broker yet
              // (e.g. first time entering a phone number creates a new broker server-side).
              // We must still build/attach the sub-object in that case, otherwise the UI
              // silently fails to reflect the save until a full refetch happens.
              if (hasBrokerFields) {
                const updatedBroker = { ...(deal.broker || {}) };
                
                // Map all broker fields from the variables
                if ('brokerFirstName' in variables) {
                  updatedBroker.firstName = (variables as any).brokerFirstName;
                }
                if ('brokerLastName' in variables) {
                  updatedBroker.lastName = (variables as any).brokerLastName;
                }
                if ('brokerEmail' in variables) {
                  updatedBroker.email = (variables as any).brokerEmail;
                }
                if ('brokerPhone' in variables) {
                  updatedBroker.phone = (variables as any).brokerPhone;
                }
                if ('marketsCovered' in variables) {
                  updatedBroker.marketsCovered = (variables as any).marketsCovered;
                }
                // Handle brokerName - split into firstName/lastName if provided
                if ('brokerName' in variables && !('brokerFirstName' in variables)) {
                  const names = ((variables as any).brokerName || '').trim().split(' ');
                  updatedBroker.firstName = names[0] || '';
                  updatedBroker.lastName = names.slice(1).join(' ') || '';
                }
                
                // If the server created a brand-new broker (deal had no brokerId before),
                // the PATCH response includes the freshly assigned brokerId - carry it over
                // along with a generated id fallback so subsequent edits find the broker.
                if (newBrokerIdFromResponse && !updatedBroker.id) {
                  updatedBroker.id = newBrokerIdFromResponse;
                }
                
                return {
                  ...deal,
                  brokerId: isEditedDeal ? (newBrokerIdFromResponse || deal.brokerId) : deal.brokerId,
                  broker: updatedBroker
                };
              }
              
              // Handle regular deal field updates (only ever applies to the edited deal)
              return { 
                ...deal, 
                [field || '']: field && field in data ? (data as any)[field] : (variables as any)[field || '']
              };
            })
          };
        }
      );
      
      console.log('🔄 Optimized query cache update completed for cellUpdateMutation');
    },
    onError: (error, variables) => {
      console.error('❌ cellUpdateMutation error for deal:', variables.dealId, error);
      
      const field = Object.keys(variables).find(key => key !== 'dealId');
      
      // Update save state to error
      if (field) {
        updateSaveState(variables.dealId, field, 'error');
      }

      // Clear optimistic update on error
      setOptimisticUpdates(prev => {
        const updated = { ...prev };
        if (updated[variables.dealId] && field) {
          const { [field]: removed, ...rest } = updated[variables.dealId];
          if (Object.keys(rest).length === 0) {
            delete updated[variables.dealId];
          } else {
            updated[variables.dealId] = rest;
          }
        }
        return updated;
      });
      
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ─── Batch Auto YOC on deals load ─────────────────────────────────────────
  // Computes and saves AutoYOC for every deal with enough data (product type + acreage).
  // Falls back to MSA-level targetProductTypes when the analyst hasn't picked a specific
  // building type. Force-recalculates all deals each session so formula updates are
  // applied automatically. The processedRef prevents duplicate runs per session.
  useEffect(() => {
    if (!deals || deals.length === 0) return;

    const pending = (deals as any[]).filter(deal => {
      if (autoYocProcessedRef.current.has(`${deal.id}:${PRESET_VERSION}`)) return false;
      // Auto YOC always recalculates regardless of step or underwriting state —
      // it's a formula-driven reference number, not the analyst's manual underwrite.
      const resolved = resolveProductTypeKeys(
        deal.productTypes || [],
        deal.targetProductTypes || []
      );
      const hasSizeAcres = parseFloat(deal.sizeAcres || '0') > 0;
      const dealUnitCount = parseInt(deal.unitCount?.toString() || deal.estimatedUnits?.toString() || '0') || 0;
      const singleType = resolved.length === 1;
      const canCalculate = resolved.length > 0 && (hasSizeAcres || (dealUnitCount > 0 && singleType));
      // Also include deals with stale/negative stored automatedYoc so we can clear them
      const hasStaleNegative = typeof deal.automatedYoc === 'string' && deal.automatedYoc.includes('-');
      return canCalculate || hasStaleNegative;
    });

    if (pending.length === 0) return;

    // Stagger mutations 600ms apart to avoid rate-limit collisions with manual edits.
    // Skip saving if the computed value matches what's already stored — most refreshes
    // produce identical numbers and don't need a round-trip.
    pending.forEach((deal: any, idx: number) => {
      autoYocProcessedRef.current.add(`${deal.id}:${PRESET_VERSION}`);
      setTimeout(() => {
        try {
          const landCost = parseFloat(deal.askingPrice || '0');
          const sizeAcres = parseFloat(deal.sizeAcres || '0');
          const comparablesJson = Array.isArray(deal.comparablesJson) ? deal.comparablesJson : [];
          const dealUnitCount = parseInt(deal.unitCount?.toString() || deal.estimatedUnits?.toString() || '0') || 0;
          const batchFallbackPsf = parseFloat(deal.avgRentPsf || deal.topRentPsf || '0') || null;
          const yoc = calculateYOCForProductTypes(
            deal.productTypes || [],
            landCost,
            sizeAcres,
            comparablesJson,
            deal.targetProductTypes || [],
            dealUnitCount > 0 ? dealUnitCount : undefined,
            deal.state || undefined,
            deal.city || undefined,
            batchFallbackPsf
          );
          // Save new value when changed; clear stale values (including old negatives) when formula returns null
          if (yoc !== null && yoc !== deal.automatedYoc) {
            cellUpdateMutation.mutate(
              { dealId: deal.id, automatedYoc: yoc },
              { onError: () => { /* silent — batch saves are best-effort */ } }
            );
          } else if (yoc === null && deal.automatedYoc) {
            // Formula returned null — wipe stale stored value so cell shows "—" instead of bad data
            cellUpdateMutation.mutate(
              { dealId: deal.id, automatedYoc: '' },
              { onError: () => { /* silent */ } }
            );
          }
        } catch {
          // Calculation errors are non-fatal — skip silently
        }
      }, idx * 600);
    });
    // When a manual refresh fires, clear the spinner once all timeouts have had a chance to start
    if (yocRefreshKey > 0 && pending.length > 0) {
      setTimeout(() => setYocRefreshing(false), pending.length * 600 + 500);
    } else if (yocRefreshKey > 0) {
      setYocRefreshing(false);
    }
  }, [deals, yocRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // ─────────────────────────────────────────────────────────────────────────────

  // Full deal update mutation for complete row saves (resets editing state)
  const updateDealMutation = useMutation({
    mutationFn: async (data: { 
      dealId: string; 
      classification?: string; 
      analystNotes?: string; 
      status?: string;
      rejectionReason?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      propertyName?: string;
      unitCount?: number;
      vintage?: number;
      sizeAcres?: number;
      qctStatus?: string;
      topRentPSF?: string;
      projectedRentPerSF?: number;
      developer?: string;
      partner?: string;
      assignedDeveloper?: string;
      assignedPartner?: string;
      nextSteps?: string;
      assignedAnalyst?: string;
      assignedJrAnalyst?: string;
      population55Plus5Mile?: number;
      income75Plus55Plus?: number;
      demographicsNotes?: string;
      yieldOnCost?: string;
      irr?: string;
      productTypes?: string[];
      hasEntitlements?: boolean;
      sewerAvailable?: boolean;
      documentUrls?: string[];
      analystDocumentUrls?: string[];
      isNewDeal?: boolean;
      brokerName?: string;
      brokerFirstName?: string;
      brokerLastName?: string;
      brokerNotes?: string;
      brokerEmail?: string;
      brokerPhone?: string;
      marketsCovered?: string;
      dealType?: string;
      yearBuilt?: number;
      brokerData?: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        marketsCovered?: string;
      };
    }) => {
      console.log('🔄 updateDealMutation called with:', data);
      
      // Normalize boolean fields
      const normalizedData = { ...data };
      if ('hasEntitlements' in normalizedData) {
        normalizedData.hasEntitlements = normalizeBooleanValue(normalizedData.hasEntitlements);
      }
      if ('sewerAvailable' in normalizedData) {
        normalizedData.sewerAvailable = normalizeBooleanValue(normalizedData.sewerAvailable);
      }
      
      let response;
      if (data.isNewDeal) {
        console.log('📤 Making POST request to: /api/analyst/deals with data:', normalizedData);
        response = await apiRequest("POST", `/api/analyst/deals`, normalizedData);
      } else {
        console.log('📤 Making PATCH request to:', `/api/deals/${data.dealId}`, 'with data:', normalizedData);
        response = await apiRequest("PATCH", `/api/deals/${data.dealId}`, normalizedData);
      }
      
      const result = await response.json();
      console.log('✅ updateDealMutation response received:', result);
      return result;
    },
    onSuccess: (data, variables) => {
      console.log('✅ updateDealMutation success for deal:', variables.dealId);
      // More specific query invalidation to avoid cancelling other mutations
      queryClient.setQueryData(['/api/deals', currentPage, pageSize, filterClassifications.join(','), filterPriorities.join(','), filterDealTypes.join(','), filterApex.join(','), searchQuery, filterRiskLevel, showOnlyFlagged, sortColumn, sortDirection], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          deals: oldData.deals.map((deal: any) => 
            deal.id === variables.dealId ? { ...deal, ...data } : deal
          )
        };
      });
      toast({
        title: "Deal Updated",
        description: "Deal has been successfully updated.",
      });
      setEditingRow(null);
      setEditData({});
      setEditingCell(null);
      setCellEditValue('');
    },
    onError: (error, variables) => {
      console.error('❌ updateDealMutation error for deal:', variables.dealId, error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-classification mutation
  const autoClassifyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/analyst/auto-classify`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/deals' });
      toast({
        title: "Auto-Classification Complete",
        description: `Classified ${data.processedDeals || 0} deals using AI analysis`,
      });
    },
    onError: (error) => {
      toast({
        title: "Auto-Classification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk operations mutation
  const bulkOperationMutation = useMutation({
    mutationFn: async ({ dealIds, operation, data }: { dealIds: string[], operation: string, data?: any }) => {
      return await apiRequest("POST", `/api/analyst/deals/bulk`, { dealIds, operation, data });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/deals' });
      toast({
        title: "Bulk Operation Complete",
        description: `Successfully updated ${selectedDeals.length} deals`,
      });
      setSelectedDeals([]);
    },
    onError: (error) => {
      toast({
        title: "Bulk Operation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [qctOzRunning, setQctOzRunning] = useState(false);
  const [qctOzResult, setQctOzResult] = useState<string | null>(null);

  const backfillQctOzMutation = useMutation({
    mutationFn: async () => {
      setQctOzRunning(true);
      setQctOzResult(null);
      // Run sequentially to avoid database contention
      const qctData = await apiRequest("POST", "/api/admin/backfill-qct-status", {}).then(r => r.json());
      const ozData = await apiRequest("POST", "/api/admin/backfill-oz-status", {}).then(r => r.json());
      return { qct: qctData, oz: ozData };
    },
    onSuccess: (data: any) => {
      setQctOzRunning(false);
      const msg = `QCT: ${data?.qct?.message || 'done'} | OZ: ${data?.oz?.message || 'done'}`;
      setQctOzResult(msg);
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      setTimeout(() => setQctOzResult(null), 8000);
    },
    onError: (err: any) => {
      setQctOzRunning(false);
      const msg = err?.message ? `Backfill failed: ${err.message}` : 'Backfill failed — check console';
      setQctOzResult(msg);
      setTimeout(() => setQctOzResult(null), 8000);
    },
  });

  const exportToExcelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/deals/export/csv', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'text/csv',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Export failed';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `landlinq-deals-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Export Successful",
        description: "Deal data has been exported to CSV file.",
      });
    },
    onError: (error: any) => {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data. Please check your permissions.",
        variant: "destructive",
      });
    },
  });

  const batchScoreMutation = useMutation({
    mutationFn: async (dealIds: string[]) => {
      return await apiRequest("POST", `/api/deals/score-batch`, { dealIds });
    },
    onSuccess: (data: any) => {
      const newScores: {[key: string]: any} = {};
      data.results.forEach((result: any) => {
        newScores[result.dealId] = result.score;
      });
      setDealScores(prev => ({ ...prev, ...newScores }));
      
      toast({
        title: "Batch Scoring Complete",
        description: `Scored ${data.processedCount} deals successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Batch Scoring Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ─── Auto YOC editable breakdown dialog ───────────────────────────────────────
  const [yocBreakdownDeal, setYocBreakdownDeal] = useState<any | null>(null);
  // Per-deal input overrides: key = `${dealId}.${field}`, value = number
  // These are local/session-only — they let analysts do what-if calculations without saving.
  const [yocOverrides, setYocOverrides] = useState<Record<string, number>>({});

  // Get a numeric override for a specific field/deal, falling back to the preset value
  function getYocField(dealId: string, field: string, presetValue: number): number {
    const k = `${dealId}.${field}`;
    return k in yocOverrides ? yocOverrides[k] : presetValue;
  }
  function setYocField(dealId: string, field: string, value: number) {
    setYocOverrides(prev => ({ ...prev, [`${dealId}.${field}`]: value }));
  }

  // Compute live YOC from overrides for the open dialog deal (per product type)
  function computeLiveYocForDialog(deal: any, typeKey: string) {
    if (!deal) return null;
    const preset = PRODUCT_TYPE_YOC_PRESETS[typeKey];
    if (!preset) return null;
    const _stk = (deal.state || '').toUpperCase();
    const _cty = (deal.city || '').toUpperCase().trim();
    const isCoastal = COASTAL_STATES.has(_stk) ||
      (_stk === 'NC' && COASTAL_CITIES_NC.has(_cty)) ||
      (_stk === 'GA' && COASTAL_CITIES_GA.has(_cty));
    const stateKey = _stk;
    const reTaxAdjPU = RE_TAX_ADJUSTMENT_BY_STATE[stateKey] ?? 0;
    let rentStateMult = RENT_MULT_BY_STATE[stateKey] ?? RENT_MULT_DEFAULT;
    let landStateMult = LAND_COST_MULT_BY_STATE[stateKey] ?? LAND_COST_MULT_DEFAULT;
    if (stateKey === 'NC' && deal.city) {
      const cu = deal.city.toUpperCase().trim();
      if (NC_RESEARCH_TRIANGLE_CITIES.has(cu)) { rentStateMult = 0.93; landStateMult = 1.40; }
      else if (NC_CHARLOTTE_MSA_CITIES.has(cu)) { rentStateMult = 0.90; landStateMult = 1.65; }
    }

    const comparablesJson: any[] = Array.isArray(deal.comparablesJson) ? deal.comparablesJson : [];
    const scalarPsf = parseFloat(deal.avgRentPsf || deal.topRentPsf || '0') || null;
    const hellodataRentPSF = extractHellodataRentPSF(comparablesJson) ?? (scalarPsf && scalarPsf > 0 ? scalarPsf : null);
    const topCompAvgRent = extractTopCompAvgRent(comparablesJson);
    const isBTR = typeKey === 'btr-sfr-detached' || typeKey === 'btr-3-story-th' || typeKey === 'btr-th-2-3br';
    const presetBlendedRent = preset.unitMix.reduce((s: number, r: any) => s + r.pct * r.monthlyRent, 0);
    const weightedAvgSF = preset.unitMix.reduce((s: number, r: any) => s + r.pct * r.avgSF, 0);
    const effectiveRentMult = isBTR ? 1.0 : rentStateMult;

    // Read override values
    const id = deal.id;
    const hardCostPU = getYocField(id, `${typeKey}.hardCostPU`, preset.hardCostPU);
    const softCostPct = getYocField(id, `${typeKey}.softCostPct`, preset.softCostPct * 100) / 100;
    const fixedOpExPU = getYocField(id, `${typeKey}.fixedOpExPU`, preset.fixedOpExPU);
    const insurancePU = getYocField(id, `${typeKey}.insurancePU`, isCoastal ? preset.insurancePU_coastal : preset.insurancePU_nc);
    const otherIncomePUM = getYocField(id, `${typeKey}.otherIncomePUM`, preset.otherIncomePUM);
    const overrideLandCost = getYocField(id, 'landCost', parseFloat(deal.askingPrice || '0'));

    let autoBlendedRent: number;
    let rentMode: string;
    if (!isBTR && hellodataRentPSF && hellodataRentPSF > 0) {
      autoBlendedRent = hellodataRentPSF * weightedAvgSF + 50;
      rentMode = 'hellodata-psf';
    } else if (isBTR && topCompAvgRent && topCompAvgRent > 0) {
      autoBlendedRent = topCompAvgRent + 200;
      rentMode = 'hellodata-avgrent';
    } else {
      autoBlendedRent = presetBlendedRent * 0.90 * effectiveRentMult;
      rentMode = 'preset';
    }
    const blendedRent = getYocField(id, `${typeKey}.blendedRent`, autoBlendedRent);

    const sizeAcres = parseFloat(deal.sizeAcres || '0');
    const dealUnitCount = parseInt(deal.unitCount?.toString() || deal.estimatedUnits?.toString() || '0') || 0;
    const resolvedKeys = resolveProductTypeKeys(deal.productTypes || [], deal.targetProductTypes || []);
    const singleType = resolvedKeys.length === 1;
    const useActualUnits = singleType && dealUnitCount > 0;
    const unitCountOverride = getYocField(id, 'unitCount', 0);
    const totalUnits = unitCountOverride > 0
      ? unitCountOverride
      : (useActualUnits ? dealUnitCount : sizeAcres * preset.dua);

    const hasActualLandCost = overrideLandCost > 0;
    const landCostPU = isCoastal ? preset.assumedLandCostPU_coastal : preset.assumedLandCostPU;
    const effectiveLandCost = hasActualLandCost ? overrideLandCost : totalUnits * landCostPU * landStateMult;

    const VACANCY = 0.05, LTL = 0.01, CONCESSION = 0.01, MGMT_PCT = 0.0275;
    const gpr = totalUnits * blendedRent * 12;
    const otherIncome = totalUnits * otherIncomePUM * 12;
    const totalGross = gpr + otherIncome;
    const vacancyLoss = totalGross * VACANCY;
    const creditLoss = gpr * (LTL + CONCESSION);
    const egi = totalGross - vacancyLoss - creditLoss;
    const mgmtFee = egi * MGMT_PCT;
    const fixedOpEx = totalUnits * fixedOpExPU;
    const insurance = totalUnits * insurancePU;
    const reTaxAdj = totalUnits * reTaxAdjPU;
    const totalOpEx = mgmtFee + fixedOpEx + insurance + reTaxAdj;
    const noi = egi - totalOpEx;
    const hardCostTotal = totalUnits * hardCostPU;
    const softCostTotal = hardCostTotal * softCostPct;
    const tdc = effectiveLandCost + hardCostTotal + softCostTotal;
    const yoc = tdc > 0 ? (noi / tdc) * 100 : 0;

    return {
      totalUnits, hardCostPU, softCostPct, fixedOpExPU, insurancePU, otherIncomePUM,
      blendedRent, autoBlendedRent, rentMode, hellodataRentPSF, topCompAvgRent,
      presetBlendedRent, weightedAvgSF, effectiveRentMult,
      gpr, otherIncome, totalGross, vacancyLoss, creditLoss, egi,
      mgmtFee, fixedOpEx, insurance, reTaxAdj, totalOpEx, noi,
      effectiveLandCost, landCostPU, landStateMult, hasActualLandCost, overrideLandCost,
      hardCostTotal, softCostTotal, tdc, yoc,
      isCoastal, rentStateMult, isBTR, reTaxAdjPU,
    };
  }

  // Track which specific deal is being re-analyzed
  const [rerunningDealId, setRerunningDealId] = useState<string | null>(null);
  // Track which deal is being re-scored for LIHTC
  const [rescoringLihtcDealId, setRescoringLihtcDealId] = useState<string | null>(null);
  
  // Track which deal is generating PDF report
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
  
  // Track which deal is extracting UW data from uploaded Excel
  const [extractingExcelId, setExtractingExcelId] = useState<string | null>(null);

  // Extract UW data from analyst's uploaded Excel and save it to deal fields
  const extractExcelUW = async (deal: any) => {
    setExtractingExcelId(deal.id);
    try {
      const res = await fetch(`/api/deals/${deal.id}/parse-excel-uw`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Extract Failed', description: data.message || 'Could not parse Excel', variant: 'destructive' });
        return;
      }
      const e = data.extracted;
      const parts: string[] = [];
      if (e.noi)     parts.push(`NOI: $${Number(e.noi).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
      if (e.tdc)     parts.push(`TDC: $${Number(e.tdc).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
      if (e.yocPct)  parts.push(`YOC: ${Number(e.yocPct).toFixed(2)}%`);
      toast({ title: '✅ UW Data Extracted', description: parts.join(' · ') || 'Saved to deal' });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
    } catch (err: any) {
      toast({ title: 'Extract Failed', description: err.message || 'Network error', variant: 'destructive' });
    } finally {
      setExtractingExcelId(null);
    }
  };


  // Generate one-page PDF report for a deal
  const generateDealReport = async (deal: any) => {
    if (!deal) return;
    setGeneratingReportId(deal.id);
    
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      
      // Header background - Catalyst branding (draw first)
      pdf.setFillColor(7, 23, 42); // #07172A - Catalyst navy
      pdf.rect(0, 0, 210, 24, 'F');
      
      // Try to load and add Catalyst logo - much smaller to avoid overlap
      let logoWidth = 0;
      try {
        const logoResponse = await fetch('/assets/catalyst-logo.png');
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });
          // Load image to get natural dimensions and preserve aspect ratio
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.src = logoDataUrl;
          });
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          // Very small logo - 8mm height
          const logoHeight = 8;
          logoWidth = logoHeight * aspectRatio;
          pdf.addImage(logoDataUrl, 'PNG', 8, 8, logoWidth, logoHeight);
        }
      } catch (logoError) {
        console.log('Could not load logo, using text only');
      }
      
      // Text positioned after logo with clear spacing
      const textStart = logoWidth > 0 ? 10 + logoWidth + 5 : 15;
      
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Deal Summary Report', textStart, 13);
      pdf.setFontSize(8);
      pdf.setTextColor(180, 180, 180);
      pdf.text('Powered by LandLinq', textStart, 18);
      
      // Deal number and date on right side
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`Deal #${deal.dealNumber || 'N/A'}`, 195, 11, { align: 'right' });
      pdf.text(new Date().toLocaleDateString(), 195, 17, { align: 'right' });
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);
      let yPos = 30;
      
      // Helper to parse numbers that may have commas or be strings
      const parseNum = (val: any): number | null => {
        if (val === null || val === undefined || val === '') return null;
        const cleaned = String(val).replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };
      
      const formatCurrency = (val: any): string | null => {
        const num = parseNum(val);
        return num !== null ? '$' + num.toLocaleString() : null;
      };
      
      // Track rows added per section to control spacing
      let rowsAddedInSection = 0;
      
      const addRow = (label: string, value: string | number | null | undefined, forceShow = false) => {
        if (!value && value !== 0 && !forceShow) return false;
        pdf.setFont('helvetica', 'bold');
        pdf.text(label + ':', 20, yPos);
        pdf.setFont('helvetica', 'normal');
        const displayValue = value ? String(value) : 'Not provided';
        pdf.text(displayValue, 75, yPos);
        yPos += 6;
        rowsAddedInSection++;
        return true;
      };
      
      const addSectionHeader = (title: string) => {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(15, yPos - 4, 180, 8, 'F');
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(7, 23, 42); // Navy
        pdf.text(title, 20, yPos + 1);
        pdf.setTextColor(0, 0, 0);
        yPos += 10;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        rowsAddedInSection = 0;
      };
      
      // Classification badge - improved pill design
      const classification = deal.classification || 'unclassified';
      const classLabels: Record<string, string> = {
        green: 'HIGH PRIORITY',
        yellow: 'POTENTIAL',
        red: 'CLEAR NO',
        unclassified: 'PENDING'
      };
      const classColors: Record<string, [number, number, number]> = {
        green: [22, 163, 74],
        yellow: [202, 138, 4],
        red: [220, 38, 38],
        unclassified: [107, 114, 128]
      };
      const color = classColors[classification] || classColors.unclassified;
      const labelText = classLabels[classification] || 'PENDING';
      const badgeWidth = pdf.getTextWidth(labelText) + 16;
      
      pdf.setFillColor(...color);
      pdf.roundedRect(15, yPos - 5, badgeWidth, 9, 3, 3, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(labelText, 15 + badgeWidth / 2, yPos + 1, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      yPos += 12;
      
      // Property Information Section - always show with fallbacks
      addSectionHeader('Property Information');
      
      // Smart address handling - show proper address or meaningful fallback
      const hasStreetAddress = deal.address && !deal.address.toLowerCase().includes('coordinates');
      if (hasStreetAddress) {
        addRow('Address', deal.address);
      } else if (deal.latitude && deal.longitude) {
        addRow('Location', `GPS: ${parseFloat(deal.latitude).toFixed(4)}, ${parseFloat(deal.longitude).toFixed(4)}`);
      }
      
      if (deal.propertyName) addRow('Property Name', deal.propertyName);
      
      const locationParts = [deal.city, deal.state].filter(Boolean);
      if (locationParts.length > 0) {
        addRow('City/State', locationParts.join(', '));
      }
      if (deal.county) addRow('County', deal.county);
      if (deal.zip) addRow('ZIP Code', deal.zip);
      
      if (deal.msaId) addRow('MSA', deal.msaId);
      if (deal.productTypes?.length) addRow('Product Types', deal.productTypes.join(', '));
      if (deal.dealType) addRow('Deal Type', deal.dealType);
      
      // Add submission date and status
      if (deal.createdAt) {
        const submittedDate = new Date(deal.createdAt).toLocaleDateString();
        addRow('Date Submitted', submittedDate);
      }
      if (deal.status) addRow('Status', deal.status);
      if (deal.assignedAnalyst) addRow('Assigned Analyst', deal.assignedAnalyst);
      if (deal.sourceType) addRow('Source', deal.sourceType);
      
      if (rowsAddedInSection === 0) {
        pdf.setTextColor(128, 128, 128);
        pdf.text('No property details available', 20, yPos);
        pdf.setTextColor(0, 0, 0);
        yPos += 6;
      }
      yPos += 4;
      
      // Financial Details - only show if we have financial data
      const askingPriceFormatted = formatCurrency(deal.askingPrice);
      const sizeAcresNum = parseNum(deal.sizeAcres);
      const unitCountNum = parseNum(deal.unitCount);
      const yearBuiltNum = parseNum(deal.vintage) || parseNum(deal.yearBuilt);
      const pricePerAcreFormatted = formatCurrency(deal.pricePerAcre);
      const pricePerUnitFormatted = formatCurrency(deal.pricePerUnit);
      const grossRentNum = parseNum(deal.grossRentPerUnit);
      const avgSFNum = parseNum(deal.avgSquareFeet);
      const totalRentNum = parseNum(deal.totalMonthlyRent);
      
      const hasFinancials = askingPriceFormatted || sizeAcresNum !== null || unitCountNum !== null || 
                           yearBuiltNum !== null || pricePerAcreFormatted || pricePerUnitFormatted ||
                           grossRentNum !== null || avgSFNum !== null || totalRentNum !== null;
      
      if (hasFinancials) {
        addSectionHeader('Financial Details');
        if (askingPriceFormatted) addRow('Asking Price', askingPriceFormatted);
        if (sizeAcresNum !== null) addRow('Acreage', sizeAcresNum.toFixed(2) + ' acres');
        if (unitCountNum !== null) addRow('Units', unitCountNum);
        if (yearBuiltNum !== null) addRow('Year Built', yearBuiltNum);
        if (pricePerAcreFormatted) addRow('Price/Acre', pricePerAcreFormatted);
        if (pricePerUnitFormatted) addRow('Price/Unit', pricePerUnitFormatted);
        if (grossRentNum !== null) addRow('Gross Rent/Unit', '$' + grossRentNum.toLocaleString());
        if (avgSFNum !== null) addRow('Avg Square Feet', avgSFNum.toLocaleString() + ' SF');
        if (totalRentNum !== null) addRow('Total Monthly Rent', '$' + totalRentNum.toLocaleString());
        if (deal.zoningInfo) addRow('Zoning', deal.zoningInfo);
        if (deal.waterAvailable != null) addRow('Water Available', deal.waterAvailable ? 'Yes' : 'No');
        if (deal.sewerAvailable != null) addRow('Sewer Available', deal.sewerAvailable ? 'Yes' : 'No');
        yPos += 4;
      }
      
      // Broker Information - only show if we have broker data
      const brokerName = [deal.broker?.firstName, deal.broker?.lastName].filter(Boolean).join(' ');
      const brokerEmail = deal.broker?.email && !deal.broker.email.includes('@temp.landlinq') ? deal.broker.email : null;
      const hasBrokerInfo = brokerName || brokerEmail || deal.broker?.phone || deal.broker?.company;
      
      if (hasBrokerInfo) {
        addSectionHeader('Broker Information');
        if (brokerName) addRow('Name', brokerName);
        if (deal.broker?.company) addRow('Company', deal.broker.company);
        if (brokerEmail) addRow('Email', brokerEmail);
        if (deal.broker?.phone) addRow('Phone', deal.broker.phone);
        if (deal.broker?.preferredMarkets?.length) {
          addRow('Markets', deal.broker.preferredMarkets.slice(0, 3).join(', '));
        }
        yPos += 4;
      }
      
      // Parse comparables from deal.comparablesJson (the actual stored field)
      let comps: any[] = [];
      let helloDataStats: any = null;
      
      // First try comparablesJson which is where the actual data is stored
      const comparablesData = deal.comparablesJson || deal.helloDataResponse;
      if (comparablesData) {
        try {
          let parsedData = typeof comparablesData === 'string' 
            ? JSON.parse(comparablesData) 
            : comparablesData;
          
          // comparablesJson is typically an array of comparables directly
          if (Array.isArray(parsedData)) {
            comps = parsedData;
          } else {
            // Handle nested response shapes
            comps = parsedData?.properties 
              || parsedData?.results 
              || parsedData?.comparables 
              || parsedData?.comps 
              || parsedData?.data?.properties 
              || parsedData?.data?.comparables
              || [];
          }
          
          console.log(`[PDF] Found ${comps.length} comparables from deal data`);
        } catch (parseError) {
          console.log('Could not parse comparables data:', parseError);
        }
      }
      
      // FIX (Jan 15, 2026): Parse comparableNotes TEXT as fallback when comparablesJson is empty
      // This handles older deals that have notes but no structured JSON
      if (comps.length === 0 && deal.comparableNotes) {
        const notes = deal.comparableNotes;
        // Parse summary stats from notes text
        const totalMatch = notes.match(/Found (\d+) total comparables/);
        const criteriaMatch = notes.match(/(\d+) met vintage\/units criteria/);
        const qualifyMatch = notes.match(/(\d+) qualify with rent/);
        
        // Parse individual properties from notes (QUALIFIES or DOES NOT QUALIFY sections)
        const propertyPattern = /(\d+)\.\s*(QUALIFIES|DOES NOT QUALIFY)[\s\S]*?(?:\s*Property:\s*([^\n]+)\n)?[\s\S]*?Address:\s*([^\n]+)\n[\s\S]*?Rent\/sqft:\s*\$?([\d.]+)[\s\S]*?Vintage:\s*(\d+)[\s\S]*?Units:\s*(\d+)[\s\S]*?Distance:\s*([\d.]+)/g;
        
        let match;
        while ((match = propertyPattern.exec(notes)) !== null) {
          comps.push({
            propertyName: match[3]?.trim() || `Property ${match[1]}`,
            address: match[4]?.trim() || '',
            rent_per_sqft: parseFloat(match[5]) || 0,
            yearBuilt: parseInt(match[6]) || 0,
            units: parseInt(match[7]) || 0,
            distance: parseFloat(match[8]) || 0,
            isQualifying: match[2] === 'QUALIFIES'
          });
        }
        
        console.log(`[PDF] Parsed ${comps.length} comparables from comparableNotes text`);
        
        // Override stats with parsed values from notes
        if (totalMatch || criteriaMatch || qualifyMatch) {
          helloDataStats = {
            totalFound: totalMatch ? parseInt(totalMatch[1]) : comps.length,
            metCriteria: criteriaMatch ? parseInt(criteriaMatch[1]) : comps.length,
            qualifying: qualifyMatch ? parseInt(qualifyMatch[1]) : (parseNum(deal.comparableCount) || 0),
            allCandidates: {
              topRentPSF: parseNum(deal.topRentPSF) || 0,
              avgRentPSF: parseNum(deal.avgRentPSF) || 0,
              topRentPerUnit: parseNum(deal.topRentPerUnit) || 0,
              avgRentPerUnit: parseNum(deal.avgRentPerUnit) || 0
            }
          };
        }
      }
      
      // Build stats from deal fields (these are stored separately)
      if (!helloDataStats) {
        helloDataStats = {
          totalFound: comps.length,
          metCriteria: comps.length, // All stored comps met criteria
          qualifying: parseNum(deal.comparableCount) || 0,
          allCandidates: {
            topRentPSF: parseNum(deal.topRentPSF) || 0,
            avgRentPSF: parseNum(deal.avgRentPSF) || 0,
            topRentPerUnit: parseNum(deal.topRentPerUnit) || 0,
            avgRentPerUnit: parseNum(deal.avgRentPerUnit) || 0
          }
        };
      }
      
      // Use deal fields as fallback for stats
      const topRentNum = parseNum(deal.topRentPSF);
      const avgRentNum = parseNum(deal.avgRentPSF);
      const comparableCountNum = parseNum(deal.comparableCount);
      const pop55Num = parseNum(deal.population55Plus5Mile);
      const income75Num = parseNum(deal.income75Plus55Plus);
      const qctFlag = deal.isQCT;
      const medianIncome = parseNum(deal.medianHouseholdIncome5Mile);
      
      // Census Bureau demographics
      const censusPop = parseNum((deal as any).censusTotalPopulation);
      const censusIncome = parseNum((deal as any).censusMedianIncome);
      const censusAge = parseNum((deal as any).censusMedianAge);
      const censusVacancy = parseNum((deal as any).censusVacancyRate);
      const censusRenter = parseNum((deal as any).censusRenterRate);
      
      // Demographics section (non-comparable data)
      const hasDemographics = pop55Num !== null || income75Num !== null || qctFlag || medianIncome !== null || censusPop !== null || censusIncome !== null;
      if (hasDemographics) {
        addSectionHeader('Demographics');
        if (censusPop !== null) addRow('Total Population', censusPop.toLocaleString());
        if (censusIncome !== null) addRow('Median HH Income', '$' + censusIncome.toLocaleString());
        if (censusAge !== null) addRow('Median Age', censusAge.toFixed(1));
        if (censusVacancy !== null) addRow('Housing Vacancy Rate', censusVacancy.toFixed(1) + '%');
        if (censusRenter !== null) addRow('Renter Occupancy Rate', censusRenter.toFixed(1) + '%');
        if (pop55Num !== null) addRow('55+ Population (5mi)', pop55Num.toLocaleString());
        if (income75Num !== null) addRow('$75K+ Households (55+)', income75Num.toLocaleString());
        if (qctFlag) addRow('QCT Status', 'Qualified Census Tract');
        yPos += 4;
      }
      
      // Comparable Analysis Section - comprehensive stats like HelloData UI
      const hasCompData = comps.length > 0 || helloDataStats?.totalFound > 0 || comparableCountNum !== null;
      if (hasCompData) {
        // Check if we need a new page
        if (yPos > 180) {
          pdf.addPage();
          yPos = 20;
        }
        
        addSectionHeader('Comparable Analysis');
        
        // Summary counts row with colored boxes
        pdf.setFontSize(9);
        const boxWidth = 55;
        const boxHeight = 22;
        const boxY = yPos;
        
        // Total Found box (gray)
        pdf.setFillColor(245, 245, 245);
        pdf.rect(20, boxY, boxWidth, boxHeight, 'F');
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(74, 144, 226); // Blue
        const totalFound = helloDataStats?.totalFound || comps.length || 0;
        pdf.text(totalFound.toString(), 20 + boxWidth/2, boxY + 10, { align: 'center' });
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Total Found', 20 + boxWidth/2, boxY + 17, { align: 'center' });
        
        // Met Criteria box (light green)
        pdf.setFillColor(236, 253, 245);
        pdf.rect(80, boxY, boxWidth, boxHeight, 'F');
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(22, 163, 74); // Green
        const metCriteria = helloDataStats?.metCriteria || 0;
        pdf.text(metCriteria.toString(), 80 + boxWidth/2, boxY + 10, { align: 'center' });
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        // Show criteria based on product type
        const isBTR = deal.productTypes?.some((p: string) => (p.toLowerCase().startsWith('btr') || ['Townhome', 'Lot', 'SFR'].includes(p)));
        const criteriaText = isBTR ? '2015+ / 25+ units' : '2020+ / 150+ units';
        pdf.text(`Met Criteria`, 80 + boxWidth/2, boxY + 15, { align: 'center' });
        pdf.setFontSize(6);
        pdf.text(criteriaText, 80 + boxWidth/2, boxY + 19, { align: 'center' });
        
        // Qualifying box (green)
        pdf.setFillColor(220, 252, 231);
        pdf.rect(140, boxY, boxWidth, boxHeight, 'F');
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(22, 163, 74); // Green
        const qualifying = helloDataStats?.qualifying || comparableCountNum || 0;
        pdf.text(qualifying.toString(), 140 + boxWidth/2, boxY + 10, { align: 'center' });
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        const rentCriteria = isBTR ? '+ $2,000+ gross' : '+ $1.75+/sqft';
        pdf.text('Qualifying', 140 + boxWidth/2, boxY + 15, { align: 'center' });
        pdf.setFontSize(6);
        pdf.text(rentCriteria, 140 + boxWidth/2, boxY + 19, { align: 'center' });
        
        yPos = boxY + boxHeight + 6;
        
        // All Candidates vs Qualifying metrics side by side
        const allTopPSF = helloDataStats?.allCandidates?.topRentPSF || topRentNum || 0;
        const allAvgPSF = helloDataStats?.allCandidates?.avgRentPSF || avgRentNum || 0;
        const allTopUnit = helloDataStats?.allCandidates?.topRentPerUnit || 0;
        const allAvgUnit = helloDataStats?.allCandidates?.avgRentPerUnit || 0;
        
        // Calculate qualifying-only metrics from comps
        const qualifyingComps = comps.filter((c: any) => {
          const yr = parseInt(c.year_built || c.yearBuilt || '0');
          const units = parseInt(c.number_units || c.units || c.unitCount || '0');
          const rentPSF = parseFloat(c.effective_rent || c.avg_rent || c.rent_per_sqft || '0');
          const rentThreshold = isBTR ? 0 : 1.75;
          const yearThreshold = isBTR ? 2015 : 2020;
          const unitThreshold = isBTR ? 25 : 150;
          return yr >= yearThreshold && units >= unitThreshold && rentPSF >= rentThreshold;
        });
        
        const qualTopPSF = qualifyingComps.length > 0 ? Math.max(...qualifyingComps.map((c: any) => parseFloat(c.effective_rent || c.avg_rent || c.rent_per_sqft || '0'))) : 0;
        const qualAvgPSF = qualifyingComps.length > 0 ? qualifyingComps.reduce((sum: number, c: any) => sum + parseFloat(c.effective_rent || c.avg_rent || c.rent_per_sqft || '0'), 0) / qualifyingComps.length : 0;
        const qualTopUnit = qualifyingComps.length > 0 ? Math.max(...qualifyingComps.map((c: any) => parseFloat(c.rent_per_unit || c.rentPerUnit || c.avg_rent_per_unit || '0'))) : 0;
        const qualAvgUnit = qualifyingComps.length > 0 ? qualifyingComps.reduce((sum: number, c: any) => sum + parseFloat(c.rent_per_unit || c.rentPerUnit || c.avg_rent_per_unit || '0'), 0) / qualifyingComps.length : 0;
        
        if (allTopPSF > 0 || allAvgPSF > 0) {
          pdf.setFontSize(8);
          
          // All Candidates box
          pdf.setFillColor(250, 250, 250);
          pdf.rect(20, yPos, 85, 28, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text('All Candidates', 25, yPos + 6);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          pdf.text(`Top PSF: $${allTopPSF.toFixed(2)}`, 25, yPos + 12);
          pdf.text(`Avg PSF: $${allAvgPSF.toFixed(2)}`, 60, yPos + 12);
          if (allTopUnit > 0) pdf.text(`Top/Unit: $${allTopUnit.toLocaleString()}`, 25, yPos + 18);
          if (allAvgUnit > 0) pdf.text(`Avg/Unit: $${allAvgUnit.toLocaleString()}`, 60, yPos + 18);
          
          // Qualifying Only box
          pdf.setFillColor(236, 253, 245);
          pdf.rect(110, yPos, 85, 28, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setTextColor(22, 163, 74);
          pdf.text('Qualifying Only', 115, yPos + 6);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(7);
          if (qualTopPSF > 0) pdf.text(`Top PSF: $${qualTopPSF.toFixed(2)}`, 115, yPos + 12);
          if (qualAvgPSF > 0) pdf.text(`Avg PSF: $${qualAvgPSF.toFixed(2)}`, 150, yPos + 12);
          if (qualTopUnit > 0) pdf.text(`Top/Unit: $${qualTopUnit.toLocaleString()}`, 115, yPos + 18);
          if (qualAvgUnit > 0) pdf.text(`Avg/Unit: $${qualAvgUnit.toLocaleString()}`, 150, yPos + 18);
          
          yPos += 32;
        }
        
        // Subject Property coordinates
        const subjectLatForDisplay = parseFloat(deal.latitude);
        const subjectLngForDisplay = parseFloat(deal.longitude);
        if (!isNaN(subjectLatForDisplay) && !isNaN(subjectLngForDisplay)) {
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(220, 38, 38); // Red
          pdf.text('Subject Property', 20, yPos + 4);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`Coordinates: ${subjectLatForDisplay.toFixed(6)}, ${subjectLngForDisplay.toFixed(6)}`, 55, yPos + 4);
          yPos += 8;
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
      }
      
      // Helper to calculate distance between two coordinates (Haversine formula)
      const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      
      // Map section disabled
      
      // HelloData Comparables Section - comprehensive property details
      if (Array.isArray(comps) && comps.length > 0) {
        // Check if we need a new page - raised threshold to fit more on page 1
        if (yPos > 220) {
          pdf.addPage();
          yPos = 20;
        }
        
        addSectionHeader(`All Properties (${comps.length})`);
        
        // Determine criteria for "Qualifying" badge based on product type
        const isBTRDeal = deal.productTypes?.some((p: string) => (p.toLowerCase().startsWith('btr') || ['Townhome', 'Lot', 'SFR'].includes(p)));
        const yearThreshold = isBTRDeal ? 2015 : 2020;
        const unitThreshold = isBTRDeal ? 25 : 150;
        const rentThreshold = isBTRDeal ? 0 : 1.75;
        
        // Find top rent PSF for "Top Rent" badge
        const validRents = comps.map((c: any) => parseFloat(c.effective_rent || c.avg_rent || c.rent_per_sqft || '0')).filter((r: number) => r > 0);
        const topRentValue = validRents.length > 0 ? Math.max(...validRents) : 0;
        
        // Show each comparable with full details - two lines per property
        comps.forEach((comp: any, idx: number) => {
          // Check if we need a new page (need space for 2 lines per property)
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
            // Re-add section title
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(7, 23, 42);
            pdf.text('All Properties (continued)', 20, yPos);
            pdf.setTextColor(0, 0, 0);
            yPos += 8;
          }
          
          // Extract all fields
          const compName = (comp.building_name || comp.property_name || comp.propertyName || comp.name || comp.community_name || comp.apartment_name || `Property ${idx + 1}`);
          const compAddress = comp.address || comp.street_address || '';
          const compCity = comp.city || '';
          const compState = comp.state || '';
          const compZip = comp.zipCode || comp.zip_code || comp.zip || '';
          const compUnits = comp.number_units || comp.units || comp.unitCount || comp.total_units || '';
          const compYear = comp.year_built || comp.yearBuilt || comp.vintage || '';
          const compRentPSF = comp.effective_rent || comp.avg_rent || comp.rent_per_sqft || comp.rentPSF || comp.pricePerSqFt || '';
          
          // Distance: use provided value, or calculate from coordinates
          let compDistance = comp.distance || comp.distance_miles || comp.distanceMiles || '';
          if (!compDistance && hasValidCoords) {
            const compLat = parseFloat(comp.latitude || comp.lat);
            const compLng = parseFloat(comp.longitude || comp.lng || comp.lon);
            if (!isNaN(compLat) && !isNaN(compLng) && compLat !== 0 && compLng !== 0) {
              compDistance = calculateDistance(subjectLat, subjectLng, compLat, compLng);
            }
          }
          
          // Parse numeric values
          const unitsNum = parseFloat(String(compUnits));
          const yearNum = parseInt(String(compYear), 10);
          const rentNum = parseFloat(String(compRentPSF));
          const distNum = parseFloat(String(compDistance));
          
          // Determine badges
          const meetsYear = !isNaN(yearNum) && yearNum >= yearThreshold;
          const meetsUnits = !isNaN(unitsNum) && unitsNum >= unitThreshold;
          const meetsRent = !isNaN(rentNum) && rentNum >= rentThreshold;
          const isQualifying = meetsYear && meetsUnits && meetsRent;
          const isTopRent = rentNum === topRentValue && topRentValue > 0;
          
          // Background for alternating rows
          if (idx % 2 === 0) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(15, yPos - 2, 180, 14, 'F');
          }
          
          // Line 1: Property name with badges and distance
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setTextColor(0, 0, 0);
          const displayName = compName.length > 40 ? compName.substring(0, 40) + '...' : compName;
          pdf.text(displayName, 20, yPos + 2);
          
          // Badges after name
          let badgeX = 20 + pdf.getTextWidth(displayName) + 3;
          
          if (isQualifying) {
            pdf.setFillColor(22, 163, 74); // Green
            const badgeText = 'Qualifying';
            const badgeWidth = pdf.getTextWidth(badgeText) + 4;
            pdf.roundedRect(badgeX, yPos - 1, badgeWidth, 5, 1, 1, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(6);
            pdf.text(badgeText, badgeX + 2, yPos + 2);
            badgeX += badgeWidth + 2;
          }
          
          if (isTopRent) {
            pdf.setFillColor(202, 138, 4); // Yellow/gold
            const badgeText = 'Top Rent';
            const badgeWidth = pdf.getTextWidth(badgeText) + 4;
            pdf.roundedRect(badgeX, yPos - 1, badgeWidth, 5, 1, 1, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(6);
            pdf.text(badgeText, badgeX + 2, yPos + 2);
          }
          
          // Distance on right side of line 1
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          const distStr = (!isNaN(distNum) && isFinite(distNum)) ? distNum.toFixed(1) + ' mi' : '';
          if (distStr) {
            pdf.text(distStr, 190, yPos + 2, { align: 'right' });
          }
          
          yPos += 6;
          
          // Line 2: Address + metrics
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(7);
          const fullAddress = [compAddress, compCity, compState, compZip].filter(Boolean).join(', ');
          const shortAddress = fullAddress.length > 50 ? fullAddress.substring(0, 50) + '...' : fullAddress;
          pdf.text(shortAddress || 'Address not available', 20, yPos + 1);
          
          // Metrics on right side: $X.XX/sf | Built YYYY | XXX units
          const metrics: string[] = [];
          if (!isNaN(rentNum) && rentNum > 0) metrics.push(`$${rentNum.toFixed(2)}/sf`);
          if (!isNaN(yearNum) && yearNum >= 1900) metrics.push(`Built ${yearNum}`);
          if (!isNaN(unitsNum) && unitsNum > 0) metrics.push(`${Math.round(unitsNum)} units`);
          
          pdf.setTextColor(0, 0, 0);
          pdf.text(metrics.join('  |  '), 190, yPos + 1, { align: 'right' });
          
          yPos += 8;
        });
        
        yPos += 4;
      }
      
      // Classification Notes
      if (deal.aiExplanatoryNotes || deal.rejectionReason) {
        // Check if we need a new page
        if (yPos > 240) {
          pdf.addPage();
          yPos = 20;
        }
        
        addSectionHeader('Analysis Notes');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        
        const notes = deal.aiExplanatoryNotes || deal.rejectionReason || '';
        const splitNotes = pdf.splitTextToSize(notes, 170);
        pdf.text(splitNotes, 20, yPos);
        yPos += splitNotes.length * 4 + 4;
      }
      
      // AI Training Analysis Section - fetch and display AI-generated insights
      try {
        const aiResponse = await fetch(`/api/ai-analysis/${deal.id}`, { credentials: 'include' });
        if (aiResponse.ok) {
          const aiAnalysis = await aiResponse.json();
          
          if (aiAnalysis && (aiAnalysis.pros?.length || aiAnalysis.cons?.length || aiAnalysis.risks?.length || aiAnalysis.quickSummary)) {
            // Check if we need a new page
            if (yPos > 180) {
              pdf.addPage();
              yPos = 20;
            }
            
            // AI Analysis Header with score badge
            pdf.setFillColor(239, 246, 255); // Light blue background
            pdf.rect(15, yPos - 4, 180, 10, 'F');
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 64, 175); // Blue text
            pdf.text('AI-Trained Analysis', 20, yPos + 2);
            
            // Score badge on right
            if (aiAnalysis.overallScore) {
              const scoreColor: [number, number, number] = aiAnalysis.overallScore >= 70 ? [22, 163, 74] : 
                                aiAnalysis.overallScore >= 40 ? [202, 138, 4] : [220, 38, 38];
              pdf.setFillColor(...scoreColor);
              const scoreText = `Score: ${aiAnalysis.overallScore}/100`;
              const scoreBadgeWidth = pdf.getTextWidth(scoreText) + 10;
              pdf.roundedRect(190 - scoreBadgeWidth, yPos - 3, scoreBadgeWidth, 8, 2, 2, 'F');
              pdf.setTextColor(255, 255, 255);
              pdf.setFontSize(8);
              pdf.text(scoreText, 190 - scoreBadgeWidth + 5, yPos + 2);
            }
            
            pdf.setTextColor(0, 0, 0);
            yPos += 14;
            
            // Quick Summary
            if (aiAnalysis.quickSummary) {
              pdf.setFontSize(9);
              pdf.setFont('helvetica', 'italic');
              pdf.setTextColor(80, 80, 80);
              const summaryLines = pdf.splitTextToSize(aiAnalysis.quickSummary, 170);
              pdf.text(summaryLines, 20, yPos);
              yPos += summaryLines.length * 4 + 4;
            }
            
            // Recommendation badge
            if (aiAnalysis.recommendation) {
              const recColors: Record<string, [number, number, number]> = {
                'pursue': [22, 163, 74],
                'high_priority': [22, 163, 74],
                'needs_review': [202, 138, 4],
                'pass': [220, 38, 38]
              };
              const recLabels: Record<string, string> = {
                'pursue': 'PURSUE',
                'high_priority': 'HIGH PRIORITY',
                'needs_review': 'NEEDS REVIEW',
                'pass': 'PASS'
              };
              const recColor = recColors[aiAnalysis.recommendation] || [107, 114, 128];
              const recLabel = recLabels[aiAnalysis.recommendation] || aiAnalysis.recommendation.toUpperCase();
              
              pdf.setFillColor(...recColor);
              const recBadgeWidth = pdf.getTextWidth(recLabel) + 12;
              pdf.roundedRect(20, yPos - 3, recBadgeWidth, 7, 2, 2, 'F');
              pdf.setTextColor(255, 255, 255);
              pdf.setFontSize(8);
              pdf.setFont('helvetica', 'bold');
              pdf.text(recLabel, 26, yPos + 1);
              
              // Confidence level
              if (aiAnalysis.confidenceLevel) {
                pdf.setTextColor(100, 100, 100);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`(${aiAnalysis.confidenceLevel} confidence)`, 25 + recBadgeWidth, yPos + 1);
              }
              yPos += 10;
            }
            
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
            
            // Three-column layout for pros, cons, risks
            const colWidth = 58;
            const startY = yPos;
            let maxColHeight = 0;
            
            // Pros column
            if (aiAnalysis.pros?.length > 0) {
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(22, 163, 74); // Green
              pdf.text('PROS', 20, yPos);
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(0, 0, 0);
              let prosY = yPos + 5;
              aiAnalysis.pros.slice(0, 5).forEach((pro: string) => {
                const lines = pdf.splitTextToSize('• ' + pro, colWidth - 5);
                pdf.text(lines, 20, prosY);
                prosY += lines.length * 3.5;
              });
              maxColHeight = Math.max(maxColHeight, prosY - startY);
            }
            
            // Cons column
            if (aiAnalysis.cons?.length > 0) {
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(202, 138, 4); // Yellow
              pdf.text('CONS', 80, yPos);
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(0, 0, 0);
              let consY = yPos + 5;
              aiAnalysis.cons.slice(0, 5).forEach((con: string) => {
                const lines = pdf.splitTextToSize('• ' + con, colWidth - 5);
                pdf.text(lines, 80, consY);
                consY += lines.length * 3.5;
              });
              maxColHeight = Math.max(maxColHeight, consY - startY);
            }
            
            // Risks column
            if (aiAnalysis.risks?.length > 0) {
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(220, 38, 38); // Red
              pdf.text('RISKS', 140, yPos);
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(0, 0, 0);
              let risksY = yPos + 5;
              aiAnalysis.risks.slice(0, 4).forEach((risk: string) => {
                const lines = pdf.splitTextToSize('• ' + risk, colWidth - 5);
                pdf.text(lines, 140, risksY);
                risksY += lines.length * 3.5;
              });
              maxColHeight = Math.max(maxColHeight, risksY - startY);
            }
            
            yPos = startY + maxColHeight + 4;
            
            // Key Considerations
            if (aiAnalysis.keyConsiderations?.length > 0) {
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(30, 64, 175); // Blue
              pdf.text('KEY CONSIDERATIONS:', 20, yPos);
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(0, 0, 0);
              yPos += 5;
              aiAnalysis.keyConsiderations.slice(0, 3).forEach((item: string) => {
                const lines = pdf.splitTextToSize('→ ' + item, 170);
                pdf.text(lines, 20, yPos);
                yPos += lines.length * 3.5;
              });
              yPos += 4;
            }
            
            pdf.setTextColor(0, 0, 0);
          }
        }
      } catch (aiError) {
        console.log('Could not fetch AI analysis:', aiError);
      }
      
      // Footer
      pdf.setFillColor(240, 240, 240);
      pdf.rect(0, 275, 210, 22, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Generated by LandLinq - Catalyst Capital Partners', 105, 282, { align: 'center' });
      pdf.text(`Report generated on ${new Date().toLocaleString()}`, 105, 288, { align: 'center' });
      
      // Save the PDF
      const filename = `Deal_${deal.dealNumber || deal.id}_Report.pdf`;
      pdf.save(filename);
      
      toast({
        title: 'Report Downloaded',
        description: `${filename} has been saved`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Report Failed',
        description: 'Could not generate PDF report',
        variant: 'destructive',
      });
    } finally {
      setGeneratingReportId(null);
    }
  };

  // Re-run analysis mutation - only one deal at a time
  const rerunAnalysisMutation = useMutation({
    mutationFn: async (dealId: string) => {
      setRerunningDealId(dealId);
      
      // Add timeout to prevent hanging - increased to 5 min for slow HelloData responses
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
      
      try {
        const response = await fetch(`/api/deals/${dealId}/rerun-analysis`, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`${response.status}: ${errorText || response.statusText}`);
        }
        
        return response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if ((error as Error).name === 'AbortError') {
          throw new Error('Request timed out after 5 minutes. The analysis may still be processing in the background.');
        }
        throw error;
      }
    },
    onSuccess: (data, dealId) => {
      setRerunningDealId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: "✅ Analysis Complete",
        description: `Classification: ${data.classification?.toUpperCase() || 'Updated'}`,
        duration: 5000,
      });
    },
    onError: (error) => {
      setRerunningDealId(null);
      toast({
        title: "Re-Run Failed",
        description: (error as Error).message || 'Unknown error occurred',
        variant: "destructive",
      });
    },
  });

  // Force comparables search (Dec 11, 2025) - runs coordinate-based search when property lookup fails
  const handleForceComparables = async (dealId: string) => {
    setRunningForceComparables(true);
    try {
      const response = await fetch(`/api/deals/${dealId}/force-comparables`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Comparables Found",
          description: data.message,
        });
        // Close modal and refresh deals
        setHelloDataModal(null);
        queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      } else {
        toast({
          title: "No Comparables Found",
          description: data.message || "No qualifying comparables found in search radius",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Search Failed",
        description: (error as Error).message || "Failed to run comparable search",
        variant: "destructive",
      });
    } finally {
      setRunningForceComparables(false);
    }
  };

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      console.log("🗑️ Starting DELETE API request for deal:", dealId);
      
      // Check authentication state first
      if (!isAuthenticated) {
        throw new Error("You must be logged in to delete deals. Please refresh the page and log in.");
      }
      
      try {
        const response = await apiRequest("DELETE", `/api/deals/${dealId}`);
        console.log("🗑️ DELETE API response:", response);
        
        // Handle 204 No Content response properly
        if (response.status === 204) {
          return { success: true, dealId };
        }
        
        return response;
      } catch (error) {
        console.error("🗑️ DELETE API error:", error);
        
        // Enhanced error handling for authentication issues
        if ((error as Error).message.includes('401') || (error as Error).message.includes('Unauthorized')) {
          throw new Error("Authentication failed. Please refresh the page and log in again to delete deals.");
        }
        
        throw error;
      }
    },
    onSuccess: (data, dealId) => {
      console.log("🗑️ Delete mutation success for deal:", dealId);
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/deals' });
      toast({
        title: "Deal Deleted",
        description: "Deal has been successfully deleted",
      });
    },
    onError: (error, dealId) => {
      console.error("🗑️ Delete mutation error for deal:", dealId, error);
      
      // Provide specific error messages based on error type
      const errorObj = error as Error;
      let errorMessage = errorObj.message;
      
      if (errorObj.message.includes('Authentication failed') || errorObj.message.includes('logged in')) {
        errorMessage = errorObj.message;
      } else if (errorObj.message.includes('401') || errorObj.message.includes('Unauthorized')) {
        errorMessage = "Authentication required. Please refresh the page and log in to delete deals.";
      } else if (errorObj.message.includes('403') || errorObj.message.includes('Forbidden')) {
        errorMessage = "You don't have permission to delete deals. Please contact an administrator.";
      } else if (errorObj.message.includes('404') || errorObj.message.includes('not found')) {
        errorMessage = "Deal not found. It may have already been deleted.";
      }
      
      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Handle delete with confirmation
  const handleDeleteDeal = (dealId: string, address: string) => {
    console.log("🗑️ Delete button clicked for deal:", dealId, address);
    
    // Check authentication state first
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to delete deals. Please refresh the page and log in.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      if (window.confirm(`Are you sure you want to delete the deal for "${address}"? This action cannot be undone.\n\nClick OK to proceed with deletion.`)) {
        console.log("🗑️ User confirmed delete, calling mutation...");
        deleteDealMutation.mutate(dealId);
      } else {
        console.log("🗑️ User canceled delete");
      }
    } catch (error) {
      console.error("🗑️ Error in handleDeleteDeal:", error);
      toast({
        title: "Delete Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Memoized utility functions for performance
  const getClassificationColor = useCallback((classification: string) => {
    switch (classification) {
      case 'green': return 'bg-green-500 text-white border-green-500';
      case 'yellow': return 'bg-yellow-500 text-white border-yellow-500';
      case 'red': return 'bg-red-500 text-white border-red-500';
      case 'dead': return 'bg-black text-white border-black';
      case 'lost': return 'bg-slate-600 text-white border-slate-600';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }, []);

  const getClassificationLabel = useCallback((classification: string) => {
    switch (classification) {
      case 'green': return 'Pursuing';
      case 'yellow': return 'Reviewing';
      case 'red': return 'Passed';
      case 'dead': return 'Dead';
      case 'lost': return 'Lost';
      default: return 'Unclassified';
    }
  }, []);

  // Get single letter for compact classification display
  const getClassificationLetter = useCallback((classification: string) => {
    switch (classification) {
      case 'green': return 'P'; // Pursuing
      case 'yellow': return 'R'; // Reviewing
      case 'red': return 'X'; // Passed (X for rejected)
      case 'dead': return 'D'; // Dead
      case 'lost': return 'L'; // Lost
      default: return '?'; // Unclassified
    }
  }, []);

  // Derive a human-readable explanation for WHY a deal is still unclassified ("?")
  const getUnclassifiedReason = useCallback((deal: any): string => {
    const st = (deal.status || '').toLowerCase();
    const hasAddress = !!(deal.address && deal.address.trim().length > 0);
    const hasCoords = !!(deal.latitude && deal.longitude) || !!(deal.manualLatitude && deal.manualLongitude);
    const inTargetMarket = deal.inTargetMarket;
    const missingQCT = !deal.censusTractFips && deal.qctStatus === 'N/A';

    if (!hasAddress) {
      return 'No property address provided — automated classification cannot run without a valid location. Add the street address and click Re-Run Analysis.';
    }
    if (!hasCoords && hasAddress) {
      const isParcelId = /^Parcel ID:/i.test(deal.address || '');
      if (isParcelId) {
        return 'This deal was submitted with only a parcel ID, not a street address. Click "Lookup Parcel" to resolve the parcel number to a real address and coordinates via Regrid, then click Re-Run Analysis to classify.';
      }
      return 'Address could not be geocoded. The property location may be ambiguous or the address format is non-standard. Try Re-Run Analysis, or enter coordinates manually in the deal detail panel.';
    }
    if (hasCoords && missingQCT) {
      return 'Coordinates are on file but the census tract (FIPS) could not be resolved — this is common for rural or non-standard addresses. Re-Run Analysis to retry, or verify the address includes city and state.';
    }
    if (inTargetMarket === false) {
      return 'Property is outside Catalyst target acquisition markets. Re-run analysis to confirm MSA rejection and store the classification.';
    }

    // Classification DID run and produced a specific reason — surface that instead of a generic
    // "not run yet" message. This covers cases like HelloData having no coverage in the area,
    // a geocoding failure during comparable search, or other explicit manual-review triggers.
    if (deal.rejectionReason && deal.rejectionReason.trim()) {
      return `AI classification ran and flagged this for manual review: ${deal.rejectionReason.trim()}${deal.comparableNotes ? `\n\n${deal.comparableNotes.trim()}` : ''}`;
    }
    if (deal.comparableNotes && deal.comparableNotes.trim()) {
      return `AI classification ran and flagged this for manual review:\n\n${deal.comparableNotes.trim()}`;
    }

    // Build a specific list of missing required fields
    if (st === 'pending_info') {
      const missing: string[] = [];
      if (!deal.address || !deal.address.trim()) missing.push('Street address');
      if (!deal.city || !deal.city.trim()) missing.push('City');
      if (!deal.state || !deal.state.trim()) missing.push('State');
      if (!deal.county || !deal.county.trim()) missing.push('County');
      if (!deal.unitCount || parseInt(deal.unitCount) <= 0) missing.push('Unit count');
      if (!deal.vintage || parseInt(deal.vintage) <= 0) missing.push('Vintage (year built)');
      if (!deal.sizeAcres || parseFloat(deal.sizeAcres) <= 0) missing.push('Site acreage');

      if (missing.length > 0) {
        return `The following required fields are missing and must be provided before the AI can classify this deal:\n\n• ${missing.join('\n• ')}\n\nReply to the broker to collect this information, or fill it in manually on the deal, then click Re-Run Analysis.`;
      }
      return 'Additional property information is needed. Review the deal fields and confirm address, unit count, vintage, and acreage are all populated, then click Re-Run Analysis.';
    }

    if (st === 'pending_review' || st === 'under_review') {
      return 'Flagged for manual analyst review — automated AI classification was not run. Click Re-Run Analysis to trigger automated classification, or manually set the classification using the dropdown.';
    }
    if (st === 'submitted') {
      return 'Deal was submitted but the AI classification pipeline has not yet processed it. Click Re-Run Analysis to classify now.';
    }
    if (deal.comparableCount === 0 && !deal.aiReasoning) {
      return 'AI classification was attempted but no comparable properties were found within the search radius and vintage window. Manual review is recommended — check if comparable properties exist in the area.';
    }
    return 'AI classification has not been run on this deal yet. Click Re-Run Analysis on the deal detail panel to trigger automated classification.';
  }, []);

  // Save state indicator component
  const SaveStateIndicator = useCallback(({ dealId, field }: { dealId: string, field: string }) => {
    const saveState = saveStates[dealId]?.[field] || 'idle';
    
    switch (saveState) {
      case 'saving':
        return (
          <div className="flex items-center text-blue-600 text-xs ml-1" title="Saving...">
            <Loader2 className="w-3 h-3 animate-spin" />
          </div>
        );
      case 'saved':
        return (
          <div className="flex items-center text-green-600 text-xs ml-1" title="Saved">
            <CheckCircle2 className="w-3 h-3" />
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-600 text-xs ml-1" title="Save failed">
            <AlertCircle className="w-3 h-3" />
          </div>
        );
      default:
        return null;
    }
  }, [saveStates]);

  // Public listing helper functions
  const getPublicListingIcon = (isPubliclyListed: boolean, confidence: string) => {
    if (!isPubliclyListed) {
      return <Lock className="w-3 h-3" />;
    }
    
    switch (confidence) {
      case 'high': return <Globe className="w-3 h-3 text-red-600" />;
      case 'medium': return <Globe className="w-3 h-3 text-amber-600" />;
      case 'low': return <Globe className="w-3 h-3 text-yellow-600" />;
      default: return <Globe className="w-3 h-3 text-gray-600" />;
    }
  };


  const getPriceComparisonBadge = (priceComparison: any) => {
    if (!priceComparison?.hasComparison) {
      return null;
    }

    const { assessment, differencePercent } = priceComparison;
    const diff = Math.abs(differencePercent);
    
    if (assessment === 'underpriced') {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs px-1 py-0.5">
          <TrendingUp className="w-3 h-3 mr-1" />
          -{diff.toFixed(0)}%
        </Badge>
      );
    } else if (assessment === 'overpriced') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-300 text-xs px-1 py-0.5">
          <DollarSign className="w-3 h-3 mr-1" />
          +{diff.toFixed(0)}%
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-gray-100 text-gray-800 border-gray-300 text-xs px-1 py-0.5">
        <BarChart3 className="w-3 h-3 mr-1" />
        Market
      </Badge>
    );
  };

  const getPublicListingTooltip = (deal: any) => {
    const publicListings = deal.publicListings || {};
    
    if (!publicListings.validationSuccess) {
      return "Public listing validation not available";
    }

    if (!publicListings.isPubliclyListed) {
      return `Off-market exclusive opportunity ${publicListings.exclusivityStatus?.brokerExclusivity ? '(broker exclusive)' : ''}`;
    }

    const platforms = publicListings.platformsFound?.join(', ') || 'Unknown platforms';
    const priceInfo = publicListings.priceComparison?.hasComparison 
      ? ` | Price difference: ${publicListings.priceComparison.differencePercent.toFixed(1)}%`
      : '';
    
    return `Found on: ${platforms} | Market exposure: ${publicListings.marketExposure}${priceInfo}`;
  };

  // =============================================
  // FLAGGING SYSTEM MUTATIONS AND HELPERS
  // =============================================

  // Flag deal mutation
  const flagDealMutation = useMutation({
    mutationFn: async ({ dealId, riskLevel, flaggingReason, specificWarnings, estimatedReviewTime }: {
      dealId: string;
      riskLevel: string;
      flaggingReason: string;
      specificWarnings?: any[];
      estimatedReviewTime?: number;
    }) => {
      return await apiRequest("POST", `/api/deals/${dealId}/flag`, {
        riskLevel,
        flaggingReason,
        specificWarnings,
        estimatedReviewTime
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/deals' });
      toast({
        title: "Deal Flagged",
        description: "Deal has been flagged for review",
      });
      setShowFlaggingDialog(null);
    },
    onError: (error) => {
      toast({
        title: "Flagging Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Review deal mutation
  const reviewDealMutation = useMutation({
    mutationFn: async ({ dealId, reviewStatus, reviewNotes, timeSpentMinutes, dataCorrections, keepFlagged }: {
      dealId: string;
      reviewStatus: string;
      reviewNotes?: string;
      timeSpentMinutes?: number;
      dataCorrections?: any;
      keepFlagged?: boolean;
    }) => {
      return await apiRequest("PATCH", `/api/deals/${dealId}/review`, {
        reviewStatus,
        reviewNotes,
        timeSpentMinutes,
        dataCorrections,
        keepFlagged
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/deals' });
      toast({
        title: "Review Updated",
        description: "Deal review status has been updated",
      });
      setReviewingDeal(null);
    },
    onError: (error) => {
      toast({
        title: "Review Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk review mutation
  const bulkReviewMutation = useMutation({
    mutationFn: async ({ dealIds, operation, data }: { dealIds: string[], operation: string, data?: any }) => {
      return await apiRequest("POST", `/api/analyst/deals/bulk-review`, { dealIds, operation, data });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/deals' });
      toast({
        title: "Bulk Review Complete",
        description: `Successfully processed ${selectedDeals.length} deals`,
      });
      setSelectedDeals([]);
    },
    onError: (error) => {
      toast({
        title: "Bulk Review Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch warning details mutation
  const { data: warningDetailsData } = useQuery({
    queryKey: [`/api/deals/${selectedDealWarnings}/warnings`],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${selectedDealWarnings}/warnings`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch warning details');
      return await response.json();
    },
    enabled: !!selectedDealWarnings
  });

  // Risk level helper functions
  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'bg-red-500 text-white border-red-500';
      case 'medium': return 'bg-yellow-500 text-white border-yellow-500';
      case 'low': return 'bg-blue-500 text-white border-blue-500';
      case 'clean': return 'bg-green-500 text-white border-green-500';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRiskLevelIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return <ShieldAlert className="w-4 h-4" />;
      case 'medium': return <Shield className="w-4 h-4" />;
      case 'low': return <Info className="w-4 h-4" />;
      case 'clean': return <ShieldCheck className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getRiskLevelLabel = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'High Risk';
      case 'medium': return 'Medium Risk';
      case 'low': return 'Low Risk';
      case 'clean': return 'Clean';
      default: return 'Unknown';
    }
  };

  // Helper function to identify deals missing rent data
  const needsRentDataAutoPopulation = useCallback((deal: DealWithBroker) => {
    return (
      !deal.topRentPSF && 
      (!deal.projectedRentPerSF || Number(deal.projectedRentPerSF) === 0) &&
      !autoPopulatedDeals.has(deal.id) &&
      !autoPopulationInProgress.has(deal.id)
    );
  }, [autoPopulatedDeals, autoPopulationInProgress]);

  // Auto-populate rent data for deals missing it when deals are loaded - DISABLED per user request
  // useEffect(() => {
  //   if (!isLoading && deals.length > 0) {
  //     const dealsNeedingAutoPopulation = deals.filter(needsRentDataAutoPopulation);
  //     
  //     if (dealsNeedingAutoPopulation.length > 0) {
  //       console.log(`Auto-populating rent data for ${dealsNeedingAutoPopulation.length} deals`);
  //       
  //       // Batch process deals to avoid overwhelming the API
  //       dealsNeedingAutoPopulation.slice(0, 5).forEach((deal: DealWithBroker) => {
  //         setAutoPopulationInProgress(prev => new Set([...Array.from(prev), deal.id]));
  //         autoPopulateMutation.mutate(deal.id);
  //       });
  //     }
  //   }
  // }, [deals, isLoading, needsRentDataAutoPopulation, autoPopulateMutation]);

  // Memoized deals list with optimistic updates for performance
  const optimizedDeals = useMemo(() => {
    return deals.map((deal: DealWithBroker) => getDealWithOptimisticUpdates(deal));
  }, [deals, getDealWithOptimisticUpdates]);

  // Apply client-side filters for Next Assignee and Deal Step (server handles other filters)
  const filteredAndSortedDeals = useMemo(() => {
    let result = optimizedDeals || [];
    
    // Filter by Next Assignee
    if (filterNextAssignees.length > 0) {
      result = result.filter((deal: DealWithBroker) => 
        deal.nextAssignee && filterNextAssignees.includes(deal.nextAssignee)
      );
    }
    
    // Filter by Deal Step
    if (filterDealSteps.length > 0) {
      result = result.filter((deal: DealWithBroker) => 
        deal.dealStep && filterDealSteps.includes(deal.dealStep)
      );
    }

    // Filter by Auto YOC range (client-side, since automatedYoc is stored as text)
    if (autoYocMin !== '' || autoYocMax !== '') {
      const min = autoYocMin !== '' ? parseFloat(autoYocMin) : -Infinity;
      const max = autoYocMax !== '' ? parseFloat(autoYocMax) : Infinity;
      result = result.filter((deal: any) => {
        const yocStr = deal.automatedYoc as string | undefined;
        if (!yocStr) return false;
        const nums = extractAutoYocNumbers(yocStr);
        if (nums.length === 0) return false;
        // A deal passes if ANY of its phases is within the range
        return nums.some(n => n >= min && n <= max);
      });
    }
    
    return result;
  }, [optimizedDeals, filterNextAssignees, filterDealSteps, autoYocMin, autoYocMax]);

  const formatPrice = (price: string | null) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(parseFloat(price));
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    return formatDateEST.date(date);
  };

  // Handle bulk operations
  const handleBulkOperation = (operation: string) => {
    if (selectedDeals.length === 0) {
      toast({
        title: "No Deals Selected",
        description: "Please select deals to perform bulk operations",
        variant: "destructive",
      });
      return;
    }

    const operationData: { [key: string]: any } = {
      'approve-all': { classification: 'green', status: 'high_priority' },
      'review-all': { classification: 'unclassified', status: 'pending_review' },
      'reject-all': { classification: 'red', status: 'clear_no' },
      'delete-all': { operation: 'delete' },
      'auto-fill-all': { operation: 'auto-fill' },
    };

    // Special handling for delete operation with confirmation
    if (operation === 'delete-all') {
      const confirmed = window.confirm(
        `Are you sure you want to delete ${selectedDeals.length} selected deals? This action cannot be undone.`
      );
      if (!confirmed) return;
    }

    if (operationData[operation]) {
      bulkOperationMutation.mutate({
        dealIds: selectedDeals,
        operation,
        data: operationData[operation]
      });
    }
  };

  // Toggle deal selection
  const toggleDealSelection = (dealId: string) => {
    setSelectedDeals(prev => 
      prev.includes(dealId) 
        ? prev.filter(id => id !== dealId)
        : [...prev, dealId]
    );
  };

  // Select all deals on current page
  const selectAllDeals = () => {
    const allDealIds = deals.map((deal: DealWithBroker) => deal.id);
    setSelectedDeals(allDealIds);
  };

  // Pagination navigation - memoized for performance
  const goToNextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  }, [hasNextPage, currentPage]);

  const goToPrevPage = useCallback(() => {
    if (hasPrevPage) {
      setCurrentPage(currentPage - 1);
    }
  }, [hasPrevPage, currentPage]);

  // Instant prefetch on hover for even faster navigation
  const handleNextPageHover = useCallback(() => {
    if (hasNextPage) {
      const nextPageKey = ['/api/deals', currentPage + 1, pageSize, filterClassifications.join(','), filterPriorities.join(','), filterDealTypes.join(','), filterApex.join(','), searchQuery, filterRiskLevel, showOnlyFlagged];
      queryClient.prefetchQuery({
        queryKey: nextPageKey,
        queryFn: async ({ signal }) => {
          const endpoint = showOnlyFlagged ? '/api/deals/flagged' : '/api/deals';
          const params = new URLSearchParams({
            page: (currentPage + 1).toString(),
            limit: pageSize.toString(),
            ...(filterClassifications.length > 0 && { classifications: filterClassifications.join(',') }),
            ...(filterPriorities.length > 0 && { priorities: filterPriorities.join(',') }),
            ...(filterDealTypes.length > 0 && { dealTypes: filterDealTypes.join(',') }),
            ...(filterApex.length > 0 && { apex: filterApex.join(',') }),
            ...(searchQuery && { search: searchQuery }),
            ...(filterRiskLevel !== 'all' && { riskLevel: filterRiskLevel }),
            ...(showOnlyFlagged && { sortBy: 'flaggedAt', sortOrder: 'desc' })
          });
          const response = await fetch(`${endpoint}?${params}`, {
            credentials: 'include',
            signal: signal
          });
          if (!response.ok) throw new Error('Failed to fetch deals');
          return await response.json();
        },
        staleTime: 30 * 1000,
      });
    }
  }, [hasNextPage, currentPage, pageSize, filterClassifications, filterPriorities, filterDealTypes, filterApex, searchQuery, filterRiskLevel, showOnlyFlagged, queryClient]);

  const handlePrevPageHover = useCallback(() => {
    if (hasPrevPage) {
      const prevPageKey = ['/api/deals', currentPage - 1, pageSize, filterClassifications.join(','), filterPriorities.join(','), filterDealTypes.join(','), filterApex.join(','), searchQuery, filterRiskLevel, showOnlyFlagged];
      queryClient.prefetchQuery({
        queryKey: prevPageKey,
        queryFn: async ({ signal }) => {
          const endpoint = showOnlyFlagged ? '/api/deals/flagged' : '/api/deals';
          const params = new URLSearchParams({
            page: (currentPage - 1).toString(),
            limit: pageSize.toString(),
            ...(filterClassifications.length > 0 && { classifications: filterClassifications.join(',') }),
            ...(filterPriorities.length > 0 && { priorities: filterPriorities.join(',') }),
            ...(filterDealTypes.length > 0 && { dealTypes: filterDealTypes.join(',') }),
            ...(filterApex.length > 0 && { apex: filterApex.join(',') }),
            ...(searchQuery && { search: searchQuery }),
            ...(filterRiskLevel !== 'all' && { riskLevel: filterRiskLevel }),
            ...(showOnlyFlagged && { sortBy: 'flaggedAt', sortOrder: 'desc' })
          });
          const response = await fetch(`${endpoint}?${params}`, {
            credentials: 'include',
            signal: signal
          });
          if (!response.ok) throw new Error('Failed to fetch deals');
          return await response.json();
        },
        staleTime: 30 * 1000,
      });
    }
  }, [hasPrevPage, currentPage, pageSize, filterClassifications, filterPriorities, filterDealTypes, filterApex, searchQuery, filterRiskLevel, showOnlyFlagged, queryClient]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Clear selection - memoized
  const clearSelection = useCallback(() => {
    setSelectedDeals([]);
  }, []);

  // Generate AI suggestions
  const generateAiSuggestions = async () => {
    try {
      const response = await apiRequest("POST", `/api/analyst/ai-suggestions`) as any;
      toast({
        title: "AI Suggestions Generated",
        description: "Smart recommendations are now available for your deals",
      });
    } catch (error) {
      toast({
        title: "AI Suggestions Failed",
        description: "Could not generate AI recommendations",
        variant: "destructive",
      });
    }
  };

  // Use server response for counts from classificationSummary
  const pursuingCount = classificationSummary.green || 0;
  const reviewingCount = classificationSummary.yellow || 0;
  const passedCount = classificationSummary.red || 0;
  const underReviewCount = classificationSummary.unclassified || 0;
  const pendingAddressCount = classificationSummary.pending_address || 0;

  // Helper functions for editing
  const startRowEdit = (dealId: string, dealData: any) => {
    setEditingRow(dealId);
    setEditData({
      classification: dealData.classification || '',
      analystNotes: dealData.analystNotes || '',
      rejectionReason: dealData.rejectionReason || '',
      nextSteps: dealData.nextSteps || '',
      assignedAnalyst: dealData.assignedAnalyst || '',
      assignedJrAnalyst: dealData.assignedJrAnalyst || '',
      developer: dealData.developer || '',
      partner: dealData.partner || '',
      propertyName: dealData.propertyName || '',
      productTypes: dealData.productTypes || [],
      unitCount: dealData.unitCount || '',
      maxUnitsByZoning: dealData.maxUnitsByZoning || '',
      sizeAcres: dealData.sizeAcres || '',
      topRentPSF: dealData.topRentPSF || '',
      yieldOnCost: dealData.yieldOnCost || '',
      irr: dealData.irr || '',
      projectedRentPerSF: dealData.projectedRentPerSF || '',
      hasEntitlements: dealData.hasEntitlements,
      sewerAvailable: dealData.sewerAvailable,
      zoning: dealData.zoning || '',
      population55Plus5Mile: dealData.population55Plus5Mile || '',
      income75Plus55Plus: dealData.income75Plus55Plus || '',
      demographicsNotes: dealData.demographicsNotes || '',
      address: dealData.address || '',
    });
  };

  const saveRowEdit = () => {
    if (!editingRow) return;
    
    const updatedData = {
      dealId: editingRow,
      ...editData,
      // Convert string numbers back to numbers
      unitCount: editData.unitCount ? parseInt(editData.unitCount) : undefined,
      maxUnitsByZoning: editData.maxUnitsByZoning ? parseInt(editData.maxUnitsByZoning) : undefined,
      sizeAcres: editData.sizeAcres ? parseFloat(editData.sizeAcres) : undefined,
      yieldOnCost: editData.yieldOnCost || undefined,
      irr: editData.irr || undefined,
      projectedRentPerSF: editData.projectedRentPerSF ? parseFloat(editData.projectedRentPerSF) : undefined,
      population55Plus5Mile: editData.population55Plus5Mile ? parseInt(editData.population55Plus5Mile) : undefined,
      income75Plus55Plus: editData.income75Plus55Plus ? parseInt(editData.income75Plus55Plus) : undefined,
      // FIX (Jan 15, 2026): Convert vintage to number
      vintage: editData.vintage ? parseInt(editData.vintage) : undefined,
    };
    
    updateDealMutation.mutate(updatedData);
  };

  const cancelRowEdit = () => {
    setEditingRow(null);
    setEditData({});
  };

  // Cell editing functions
  const startCellEdit = (dealId: string, field: string, value: any) => {
    const cellInfo = { dealId, field };
    const valueStr = value?.toString() || '';
    setEditingCell(cellInfo);
    setCellEditValue(valueStr);
    // Sync refs for blur handler (avoids stale closure)
    editingCellRef.current = cellInfo;
    cellEditValueRef.current = valueStr;
  };

  const saveCellEdit = (e?: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement> | React.MouseEvent | { target: { value: string } }) => {
    // Use refs to get current values (avoids stale closure issue)
    const currentEditingCell = editingCellRef.current;
    // CRITICAL FIX: Get value from event target first, fallback to ref, then state
    // This ensures we always have the most current value even if ref wasn't updated
    const targetValue = e && 'target' in e && e.target && 'value' in (e.target as any) ? (e.target as any).value : undefined;
    const currentValue = targetValue ?? cellEditValueRef.current ?? cellEditValue;
    
    console.log('🔧 saveCellEdit called - editingCellRef:', currentEditingCell, 'value:', currentValue, 'from event:', !!e?.target);
    if (!currentEditingCell) {
      console.log('❌ saveCellEdit early return - no editingCell in ref');
      return;
    }
    
    const { dealId, field } = currentEditingCell;
    console.log('📝 Saving cell edit - dealId:', dealId, 'field:', field, 'value:', currentValue);
    let processedValue: any = currentValue;
    
    // Type conversion for numeric fields - parse commas first for financial fields
    if (['unitCount', 'maxUnitsByZoning', 'population55Plus5Mile', 'income75Plus55Plus', 'vintage'].includes(field)) {
      const cleanValue = parseNumberWithCommas(currentValue);
      processedValue = cleanValue ? parseInt(cleanValue) : null;
    } else if (['sizeAcres', 'projectedRentPerSF'].includes(field)) {
      const cleanValue = parseNumberWithCommas(currentValue);
      processedValue = cleanValue ? parseFloat(cleanValue) : null;
    } else if (field === 'askingPrice') {
      const cleanValue = parseNumberWithCommas(currentValue);
      processedValue = cleanValue ? parseFloat(cleanValue) : null;
    } else if (field === 'yieldOnCost' || field === 'irr') {
      processedValue = currentValue || null;
    }
    
    console.log('🚀 Calling cellUpdateMutation.mutate with:', { dealId, [field]: processedValue });
    
    // Send field names directly - vintage and yearBuilt are separate columns in the database
    // Use cellUpdateMutation for inline cell edits (including address)
    cellUpdateMutation.mutate({
      dealId,
      [field]: processedValue
    });
    
    // Clear editing state and refs immediately for responsive UI
    editingCellRef.current = null;
    cellEditValueRef.current = '';
    setEditingCell(null);
    setCellEditValue('');
  };

  const handleCellKeyPress = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      // Pass a synthetic event with the target value
      saveCellEdit({ target: { value: (e.target as HTMLInputElement | HTMLTextAreaElement).value } });
    } else if (e.key === 'Escape') {
      // Cancel editing without saving
      editingCellRef.current = null;
      cellEditValueRef.current = '';
      setEditingCell(null);
      setCellEditValue('');
    }
  };

  // Optimized auto-save function with debouncing for text fields
  const autoSaveField = useCallback((dealId: string, field: string, value: any) => {
    console.log('💾 Auto-saving field:', field, 'for deal:', dealId, 'value:', value);
    
    let processedValue: any = value;
    
    // Handle financial fields with comma parsing
    const financialFields = ['constructionCostPerSF', 'totalProjectCost', 'projectedNOI'];
    
    if (financialFields.includes(field)) {
      // Parse comma-separated numbers for financial fields
      processedValue = value ? parseNumberWithCommas(value.toString()) : null;
      if (processedValue && !isNaN(parseFloat(processedValue))) {
        processedValue = parseFloat(processedValue).toString();
      }
    } else if (['unitCount', 'maxUnitsByZoning', 'population55Plus5Mile', 'income75Plus55Plus', 'vintage'].includes(field)) {
      // Regular numeric fields - parse commas first
      const cleanValue = value ? parseNumberWithCommas(value.toString()) : '';
      processedValue = cleanValue ? parseInt(cleanValue) : null;
    } else if (['sizeAcres', 'projectedRentPerSF'].includes(field)) {
      const cleanValue = value ? parseNumberWithCommas(value.toString()) : '';
      processedValue = cleanValue ? parseFloat(cleanValue) : null;
    } else if (field === 'yieldOnCost' || field === 'irr') {
      processedValue = value ? value.toString() : null;
    }
    
    // Determine if this is a text input field for debouncing
    const textInputFields = ['address', 'city', 'state', 'zip', 'propertyName', 'analystNotes', 'nextSteps', 'demographicsNotes', 'topRentPSF', 'yieldOnCost', 'irr'];
    const isTextInput = textInputFields.includes(field);
    
    // Use debounced save for performance optimization
    debouncedSave(dealId, field, processedValue, isTextInput);
  }, [debouncedSave]);

  // Handle key press for row editing mode (Enter to auto-save)
  const handleRowEditKeyPress = (e: React.KeyboardEvent, dealId: string, field: string, value: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      autoSaveField(dealId, field, value);
      // Move focus to next input or blur current one
      (e.target as HTMLInputElement).blur();
    }
  };

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Add new deal function - toggle Quick Deal Addition section
  const addNewDeal = () => {
    setShowQuickAddition(!showQuickAddition);
  };

  const saveNewDeal = () => {
    // Structure broker data as the server expects (brokerData object)
    const brokerData = (editData.brokerFirstName || editData.brokerLastName || editData.brokerEmail || editData.brokerPhone) ? {
      firstName: editData.brokerFirstName || '',
      lastName: editData.brokerLastName || '',
      email: editData.brokerEmail || '',
      phone: editData.brokerPhone || '',
      marketsCovered: editData.marketsCovered || '',
    } : undefined;
    
    const newDealData = {
      dealId: 'new-deal-temp',
      isNewDeal: true,
      ...editData,
      // Structure broker data for server API
      brokerData,
      // Convert string numbers back to numbers
      unitCount: editData.unitCount ? parseInt(editData.unitCount) : undefined,
      sizeAcres: editData.sizeAcres ? parseFloat(editData.sizeAcres) : undefined,
      yieldOnCost: editData.yieldOnCost || undefined,
      projectedRentPerSF: editData.projectedRentPerSF ? parseFloat(editData.projectedRentPerSF) : undefined,
      population55Plus5Mile: editData.population55Plus5Mile ? parseInt(editData.population55Plus5Mile) : undefined,
      income75Plus55Plus: editData.income75Plus55Plus ? parseInt(editData.income75Plus55Plus) : undefined,
    };
    
    updateDealMutation.mutate(newDealData);
  };

  // Helper function to check if field is empty or needs attention
  const isFieldEmpty = (value: any): boolean => {
    return value === null || value === undefined || value === '' || value === 0;
  };

  // Helper function to get initials from a full name
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.split(' ').map(part => part.charAt(0).toUpperCase()).join('');
  };

  // Financial formatting helpers
  const formatNumberWithCommas = (value: string | number): string => {
    if (!value && value !== 0) return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US');
  };

  const parseNumberWithCommas = (value: string): string => {
    if (!value) return '';
    return value.replace(/,/g, '');
  };

  // Handle input change for financial fields with comma formatting
  const handleFinancialInputChange = (
    e: React.ChangeEvent<HTMLInputElement>, 
    fieldName: string, 
    setFunction: (data: any) => void
  ) => {
    const rawValue = e.target.value;
    const numericValue = parseNumberWithCommas(rawValue);
    
    // Update the state with the raw numeric value (no commas)
    setFunction((prev: any) => ({ ...prev, [fieldName]: numericValue }));
    
    // Format display value with commas
    const formatted = formatNumberWithCommas(numericValue);
    e.target.value = formatted;
  };

  // Handle quick classification changes with optimized saving
  const handleQuickClassification = useCallback((dealId: string, classification: string) => {
    console.log('🚀 Quick classification change:', dealId, classification);
    if (classification === 'red') {
      // For rejections, show the rejection dialog with product types for filtering
      const deal = deals?.find((d: any) => d.id === dealId);
      if (deal) {
        setSelectedRejectionReason(''); // Reset selection
        setRejectionFeedback(''); // Reset feedback
        setShowRejectionDialog({
          dealId,
          dealAddress: deal.address || 'Unknown Address',
          productTypes: deal.productTypes || []
        });
      }
    } else {
      // For green/yellow, update using optimized debounced save (immediate for dropdowns)
      console.log('🔄 Using optimized save for classification:', dealId, classification);
      debouncedSave(dealId, 'classification', classification, false); // false = immediate save for dropdown
    }
  }, [deals, debouncedSave]);

  // Submit rejection with feedback
  const submitRejection = () => {
    if (!showRejectionDialog || !rejectionFeedback.trim()) return;
    
    updateDealMutation.mutate({
      dealId: showRejectionDialog.dealId,
      classification: 'red',
      rejectionReason: rejectionFeedback.trim()
    });
    
    setShowRejectionDialog(null);
    setRejectionFeedback('');
  };

  // Handle file upload for broker documents (saves to documentUrls)
  // UPDATED Dec 11, 2025: Preserves original filename in object storage path
  const handleBrokerFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, dealId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Use object storage presigned URL flow for persistent storage
      // Pass original filename to preserve it in the path
      const uploadRes = await fetch('/api/deals/upload-url', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      const uploadData = await uploadRes.json();
      
      if (!uploadData.uploadURL || !uploadData.objectPath) {
        throw new Error('Failed to get upload URL');
      }

      // Upload file to object storage
      await fetch(uploadData.uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      
      // Get current deal to preserve existing broker documents
      const currentDeal = deals?.find((d: any) => d.id === dealId);
      const currentBrokerDocs = (currentDeal?.documentUrls as string[]) || [];
      
      // Add new document URL to broker documents (use objectPath for persistent storage)
      const updatedBrokerDocs = [...currentBrokerDocs, uploadData.objectPath];
      
      // Update deal with new broker document
      updateDealMutation.mutate({
        dealId,
        documentUrls: updatedBrokerDocs
      });
      
      toast({
        title: "Broker Document Uploaded",
        description: `${file.name} has been uploaded successfully`,
      });
    } catch (error) {
      console.error('Broker upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    }
    
    // Clear the input
    event.target.value = '';
  };

  // Handle file upload for analyst documents (saves to analystDocumentUrls)
  // UPDATED Dec 11, 2025: Preserves original filename in object storage path
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, dealId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Use object storage presigned URL flow for persistent storage
      // Pass original filename to preserve it in the path
      const uploadRes = await fetch('/api/deals/upload-url', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      const uploadData = await uploadRes.json();
      
      if (!uploadData.uploadURL || !uploadData.objectPath) {
        throw new Error('Failed to get upload URL');
      }

      // Upload file to object storage
      await fetch(uploadData.uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      
      // Get current deal to preserve existing analyst documents
      const currentDeal = deals?.find((d: any) => d.id === dealId);
      const currentAnalystDocs = ((currentDeal as any)?.analystDocumentUrls as string[]) || [];
      
      // Add new document URL to analyst documents (use objectPath for persistent storage)
      const updatedAnalystDocs = [...currentAnalystDocs, uploadData.objectPath];
      
      // Update deal with new analyst document
      updateDealMutation.mutate({
        dealId,
        analystDocumentUrls: updatedAnalystDocs
      });
      
      toast({
        title: "Analyst Document Uploaded",
        description: `${file.name} has been uploaded successfully`,
      });
    } catch (error) {
      console.error('Analyst upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    }
    
    // Clear the input
    event.target.value = '';
  };

  // Handle file delete for broker documents
  const handleDeleteBrokerFile = async (dealId: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    const currentDeal = deals?.find((d: any) => d.id === dealId);
    const currentBrokerDocs = (currentDeal?.documentUrls as string[]) || [];
    const updatedBrokerDocs = currentBrokerDocs.filter(url => url !== fileUrl);
    
    updateDealMutation.mutate({
      dealId,
      documentUrls: updatedBrokerDocs
    });
    
    toast({
      title: "File Deleted",
      description: "The file has been removed from the deal",
    });
  };

  // Handle file delete for analyst documents
  const handleDeleteAnalystFile = async (dealId: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    const currentDeal = deals?.find((d: any) => d.id === dealId);
    const currentAnalystDocs = ((currentDeal as any)?.analystDocumentUrls as string[]) || [];
    const updatedAnalystDocs = currentAnalystDocs.filter(url => url !== fileUrl);
    
    updateDealMutation.mutate({
      dealId,
      analystDocumentUrls: updatedAnalystDocs
    });
    
    toast({
      title: "File Deleted",
      description: "The file has been removed from the deal",
    });
  };

  // Open file in inline viewer (Dec 15, 2025) - View files without downloading
  // Modified: Auto-open files directly instead of showing modal for most file types
  const openFileViewer = (url: string) => {
    const fileName = url.split('/').pop() || 'Document';
    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
    
    // Determine file type for appropriate rendering
    let fileType = 'other';
    if (['pdf'].includes(fileExt)) fileType = 'pdf';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExt)) fileType = 'image';
    else if (['doc', 'docx'].includes(fileExt)) fileType = 'word';
    else if (['xls', 'xlsx', 'csv'].includes(fileExt)) fileType = 'excel';
    else if (['txt', 'log', 'json', 'xml'].includes(fileExt)) fileType = 'text';
    
    // Auto-open files directly instead of showing modal
    if (fileType === 'pdf' || fileType === 'word' || fileType === 'excel' || fileType === 'other') {
      // Open in new tab immediately
      window.open(url, '_blank');
      return;
    }
    
    // Only show modal for images and text files that can be previewed inline
    setFileViewerModal({ url, fileName, fileType });
  };

  // Handle file rename
  const handleRenameFile = async (dealId: string, oldUrl: string, isBrokerDoc: boolean) => {
    const currentFileName = oldUrl.split('/').pop() || '';
    const fileExt = currentFileName.split('.').pop() || '';
    const baseName = currentFileName.replace(`.${fileExt}`, '');
    
    const newName = prompt('Enter new file name:', baseName);
    if (!newName || newName === baseName) return;
    
    const currentDeal = deals?.find((d: any) => d.id === dealId);
    
    if (isBrokerDoc) {
      const currentDocs = (currentDeal?.documentUrls as string[]) || [];
      const newUrl = oldUrl.replace(currentFileName, `${newName}.${fileExt}`);
      const updatedDocs = currentDocs.map(url => url === oldUrl ? newUrl : url);
      
      // Call backend to rename the file in object storage
      try {
        await fetch('/api/deals/rename-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: oldUrl, newPath: newUrl })
        });
        
        updateDealMutation.mutate({
          dealId,
          documentUrls: updatedDocs
        });
        
        toast({
          title: "File Renamed",
          description: `File renamed to ${newName}.${fileExt}`,
        });
      } catch (error) {
        toast({
          title: "Rename Failed",
          description: "Could not rename file. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      const currentDocs = ((currentDeal as any)?.analystDocumentUrls as string[]) || [];
      const newUrl = oldUrl.replace(currentFileName, `${newName}.${fileExt}`);
      const updatedDocs = currentDocs.map(url => url === oldUrl ? newUrl : url);
      
      try {
        await fetch('/api/deals/rename-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: oldUrl, newPath: newUrl })
        });
        
        updateDealMutation.mutate({
          dealId,
          analystDocumentUrls: updatedDocs
        });
        
        toast({
          title: "File Renamed",
          description: `File renamed to ${newName}.${fileExt}`,
        });
      } catch (error) {
        toast({
          title: "Rename Failed",
          description: "Could not rename file. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Handle batch scoring for selected deals
  const handleBatchScore = async () => {
    if (selectedDeals.length === 0) {
      toast({
        title: "No Deals Selected",
        description: "Please select deals to score",
        variant: "destructive",
      });
      return;
    }

    await batchScoreMutation.mutateAsync(selectedDeals);
  };

  // Handle re-run analysis for a single deal
  const handleRescoreLihtc = async (dealId: string) => {
    setRescoringLihtcDealId(dealId);
    try {
      await apiRequest('POST', `/api/site-evaluations/score-deal/${dealId}`, { forceRefresh: true });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === '/api/deals' });
      queryClient.invalidateQueries({ queryKey: ['/api/site-evaluations/deal', dealId] });
    } catch (e: any) {
      console.error('[LIHTC-RESCORE]', e.message);
    } finally {
      setRescoringLihtcDealId(null);
    }
  };

  const handleRerunAnalysis = async (dealId: string) => {
    await rerunAnalysisMutation.mutateAsync(dealId);
  };

  // ─── Column render helpers (used for dynamic column ordering) ──────────────
  const thBase = "text-left px-3 py-1 font-semibold text-xs text-gray-700 border-r border-gray-200";
  const renderHeaderCell = (key: ReorderableColumnKey): JSX.Element | null => {
    const vis = isVisible(key);
    const sortBtn = (label: string, sortKey: string) => (
      <button onClick={() => handleSort(sortKey)} className="flex items-center space-x-1 hover:text-[#07172A]">
        <span>{label}</span><ArrowUpDown size={12} />
      </button>
    );
    switch (key) {
      case 'name': return <th key={key} className={`${thBase} min-w-[140px]`} style={{display: vis?'':'none'}}><span>Name</span></th>;
      case 'yieldOnCost': return <th key={key} className={thBase} style={{display: vis?'':'none'}}>{sortBtn('YOC','yieldOnCost')}</th>;
      case 'automatedYoc': return <th key={key} className={thBase} style={{display: vis?'':'none'}}>{sortBtn('Auto YOC','automatedYoc')}</th>;
      case 'irr': return <th key={key} className={`${thBase} min-w-[90px]`} style={{display: vis?'':'none'}}>{sortBtn('IRR','irr')}</th>;
      case 'excelModel': return <th key={key} className={`${thBase} min-w-[70px]`} style={{display: vis?'':'none'}}><span>Excel</span></th>;
      case 'reason': return <th key={key} className={`${thBase} min-w-[80px]`} style={{display: vis?'':'none'}}><span>Reason</span></th>;
      case 'dealType': return <th key={key} className={`${thBase} w-[70px] min-w-[70px]`} style={{display: vis?'':'none'}}>{sortBtn('Deal','dealType')}</th>;
      case 'productTypes': return <th key={key} className={thBase} style={{display: vis?'':'none'}}>{sortBtn('Type','productTypes')}</th>;
      case 'analystNotes': return <th key={key} className={`${thBase} min-w-[52px]`} style={{display: vis?'':'none'}}><span>Analyst Notes</span></th>;
      case 'dealSummary': return <th key={key} className={`${thBase} min-w-[160px]`} style={{display: vis?'':'none'}}><span>Summary</span></th>;
      case 'developerNotes': return <th key={key} className={`${thBase} min-w-[52px]`} style={{display: vis?'':'none'}}><span>Dev Notes</span></th>;
      case 'notes': return <th key={key} className={`${thBase} w-[70px] max-w-[70px]`} style={{display: vis?'':'none'}}><span>Broker Notes</span></th>;
      case 'topRentPerUnit': return <th key={key} className={`${thBase} min-w-[52px]`} style={{display: vis?'':'none'}}>{sortBtn('Top Rent/Unit','topRentPerUnit')}</th>;
      case 'topRentPSF': return <th key={key} className={`${thBase} min-w-[52px]`} style={{display: vis?'':'none'}}>{sortBtn('Top Rent PSF','topRentPSF')}</th>;
      case 'lihtc': return <th key={key} className={`${thBase} min-w-[60px]`} style={{display: vis?'':'none'}}>{sortBtn('LIHTC','lihtcScoreTotal')}</th>;
      case 'qct': return <th key={key} className={`${thBase} min-w-[45px]`} style={{display: vis?'':'none'}}>{sortBtn('QCT','qctStatus')}</th>;
      case 'dda': return <th key={key} className={`${thBase} min-w-[55px]`} style={{display: vis?'':'none'}}><button onClick={() => handleSort('ddaStatus')} className="flex items-center space-x-1 hover:text-[#07172A]" title="Difficult Development Area (HUD 2026) — MDDA = Metropolitan, NMDDA = Non-Metropolitan"><span>DDA</span><ArrowUpDown size={12} /></button></th>;
      case 'oz': return <th key={key} className={`${thBase} min-w-[45px]`} style={{display: vis?'':'none'}}>{sortBtn('OZ','ozStatus')}</th>;
      case 'date': return <th key={key} className={`${thBase} min-w-[65px]`} style={{display: vis?'':'none'}}>{sortBtn('Date','createdAt')}</th>;
      case 'brokerDocs': return <th key={key} className={`${thBase} ${expandedBrokerDocs.size>0?'w-[260px]':'w-[110px] max-w-[110px]'}`} style={{display: vis?'':'none'}}><span>Broker Docs</span></th>;
      case 'analystDocs': return <th key={key} className={`${thBase} ${expandedAnalystDocs.size>0?'w-[260px]':'w-[130px] max-w-[130px]'}`} style={{display: vis?'':'none'}}><span>Analyst Docs</span></th>;
      case 'comps': return <th key={key} className={`${thBase} min-w-[50px]`} style={{display: vis?'':'none'}}><span>Comps</span></th>;
      case 'ncOnemap': return <th key={key} className={`${thBase} min-w-[80px]`} style={{display: vis?'':'none'}}><span>NC Tax</span></th>;
      case 'pop55': return <th key={key} className={`${thBase} min-w-[60px]`} style={{display: vis?'':'none'}}><span>55+ Pop</span></th>;
      case 'income75k': return <th key={key} className={`${thBase} min-w-[60px]`} style={{display: vis?'':'none'}}><span>$75K+</span></th>;
      case 'juniorAnalyst': return null;
      case 'analyst': return <th key={key} className={`${thBase} min-w-[45px]`} style={{display: vis?'':'none'}}><span>Analyst</span></th>;
      case 'dev': return <th key={key} className={`${thBase} min-w-[35px]`} style={{display: vis?'':'none'}}><span>Dev</span></th>;
      case 'partner': return <th key={key} className={`${thBase} min-w-[45px]`} style={{display: vis?'':'none'}}><span>Partner</span></th>;
      case 'price': return <th key={key} className={`${thBase} min-w-[100px]`} style={{display: vis?'':'none'}}>{sortBtn('Price','askingPrice')}</th>;
      case 'units': return <th key={key} className={`${thBase} min-w-[70px]`} style={{display: vis?'':'none'}}>{sortBtn('Units','unitCount')}</th>;
      case 'maxUnitsZoning': return <th key={key} className={`${thBase} min-w-[80px]`} style={{display: vis?'':'none'}}><span>Max Zoning</span></th>;
      case 'vintage': return <th key={key} className={`${thBase} min-w-[55px]`} style={{display: vis?'':'none'}}>{sortBtn('Vintage','vintage')}</th>;
      case 'acres': return <th key={key} className={`${thBase} min-w-[55px]`} style={{display: vis?'':'none'}}>{sortBtn('Acres','sizeAcres')}</th>;
      case 'netDevelopableAcres': return <th key={key} className={`${thBase} min-w-[70px]`} style={{display: vis?'':'none'}}>{sortBtn('Net Dev Acres','netDevelopableAcres')}</th>;
      case 'dua': return <th key={key} className={`${thBase} min-w-[50px]`} style={{display: vis?'':'none'}}><span>DUA</span></th>;
      case 'zoning': return <th key={key} className={`${thBase} min-w-[80px]`} style={{display: vis?'':'none'}}>{sortBtn('Zoning','zoning')}</th>;
      case 'wetlandNotes': return <th key={key} className={`${thBase} min-w-[140px]`} style={{display: vis?'':'none'}}><span>Wetland/Environmental Notes</span></th>;
      case 'developerSummary': return <th key={key} className={`${thBase} min-w-[140px]`} style={{display: vis?'':'none'}}><span>Developer Summary</span></th>;
      case 'entitlements': return <th key={key} className={`${thBase} min-w-[80px]`} style={{display: vis?'':'none'}}>{sortBtn('Entitlements','hasEntitlements')}</th>;
      case 'pricePerUnit': return <th key={key} className={`${thBase} min-w-[50px]`} style={{display: vis?'':'none'}}><span>Price/Unit</span></th>;
      case 'sewer': return <th key={key} className={`${thBase} min-w-[70px]`} style={{display: vis?'':'none'}}><span>Sewer</span></th>;
      case 'brokerName': return <th key={key} className={`${thBase} min-w-[55px]`} style={{display: vis?'':'none'}}>{sortBtn('Broker Name','broker.firstName')}</th>;
      case 'brokerEmail': return <th key={key} className={`${thBase} min-w-[55px]`} style={{display: vis?'':'none'}}><span>Broker Email</span></th>;
      case 'brokerPhone': return <th key={key} className={`${thBase} min-w-[52px]`} style={{display: vis?'':'none'}}><span>Broker Phone</span></th>;
      default: return null;
    }
  };

  const renderBodyCell = (deal: DealWithBroker, key: ReorderableColumnKey): JSX.Element | null => {
    const vis = isVisible(key);
    const d = deal as any;
    switch (key) {
      case 'name': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId === deal.id && editingCell?.field === 'propertyName' ? (
            <Input defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current = e.target.value; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Property name..." autoFocus />
          ) : (
            <div className={`cursor-pointer text-xs break-words whitespace-normal leading-snug ${!deal.propertyName?'':'hover:bg-gray-100'}`} onClick={() => startCellEdit(deal.id,'propertyName',deal.propertyName||'')}>
              {deal.propertyName || <span className="text-gray-400 italic text-xs">Click to add...</span>}
            </div>
          )}
        </td>
      );
      case 'yieldOnCost': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId === deal.id && editingCell?.field === 'yieldOnCost' ? (
            <Input type="text" defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current = e.target.value; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs w-full" placeholder="e.g. 8.5%" autoFocus />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 min-h-[28px] flex items-center" onClick={() => startCellEdit(deal.id,'yieldOnCost',d.yieldOnCost?.toString()||'')} title={d.yieldOnCost?d.yieldOnCost:'Click to add YOC'}>
              {d.yieldOnCost ? <span className="font-medium text-indigo-700">{d.yieldOnCost}</span> : <span className="text-gray-300 italic text-[11px]">+ add</span>}
            </div>
          )}
        </td>
      );
      case 'automatedYoc': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {(() => {
            const scalarPsf = parseFloat(d.avgRentPsf||d.topRentPsf||'0')||null;
            const liveYoc = calculateYOCForProductTypes(d.productTypes||[],parseFloat(d.askingPrice||'0'),parseFloat(d.sizeAcres||'0'),Array.isArray(d.comparablesJson)?d.comparablesJson:[],d.targetProductTypes||[],(() => { const u = parseInt(d.unitCount?.toString()||d.estimatedUnits?.toString()||'0')||0; return u>0?u:undefined; })(),d.state||undefined,d.city||undefined,scalarPsf);
            const displayYoc = liveYoc??d.automatedYoc;
            if(!displayYoc) { if(d.productTypes?.length>0&&!parseFloat(d.sizeAcres||'0')) return <span className="text-amber-500 italic text-[11px]">no acres</span>; return <span className="text-gray-300 italic text-[11px]">—</span>; }
            const BTR_KEYS = new Set(['btr-sfr-detached','btr-3-story-th','btr-th-2-3br']);
            const resolvedKeys = resolveProductTypeKeys(d.productTypes||[],d.targetProductTypes||[]);
            const allBTR = resolvedKeys.length>0&&resolvedKeys.every((k: string) => BTR_KEYS.has(k));
            const hasStoredComps = (Array.isArray(d.comparablesJson)&&d.comparablesJson.length>0)||(scalarPsf&&scalarPsf>0);
            const isPresetOnly = !allBTR&&!hasStoredComps&&typeof displayYoc==='string'&&(displayYoc as string).includes('preset')&&!(displayYoc as string).includes('/SF');
            const breakdown = calculateYOCBreakdown(d);
            return (
              <div className="flex items-start gap-0.5">
                <button className={`px-1 py-0.5 text-left flex-1 rounded transition-colors ${isPresetOnly?'hover:bg-red-50':'hover:bg-emerald-50'}`} title="View / edit YOC formula breakdown" onClick={() => { setYocBreakdownDeal(deal); setYocOverrides(deal.yocOverrides?(() => { try { return JSON.parse(deal.yocOverrides); } catch { return {}; } })():{}); }}>
                  {(displayYoc as string).split(' | ').filter((part: string) => { const m = part.match(/([-\d.]+)%/); return !m||parseFloat(m[1])>=0; }).map((part: string, i: number) => { const isBest = part.startsWith('BEST:'); const isPartPreset = part.includes('preset')&&!part.includes('/SF'); return (<div key={i} className={`flex items-center gap-1 leading-snug ${isBest?'border-b border-red-200 pb-0.5 mb-0.5':''}`}><span className={`text-[11px] underline-offset-2 hover:underline ${isBest?isPartPreset?'font-bold text-red-700':'font-bold text-emerald-800':isPartPreset?'font-semibold text-red-600':`font-semibold ${part.includes('~')?'text-amber-600':'text-emerald-700'}`}`}>{part}</span></div>); })}
                  {isPresetOnly && <div className="text-[10px] text-red-500 font-medium mt-0.5">⚠ no comps</div>}
                </button>
                <div className="flex flex-col gap-0.5">
                  {breakdown && (<button title="Open in Underwriter" className="flex-shrink-0 p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" onClick={(e) => { e.stopPropagation(); setLocation(`/underwriting?dealId=${deal.id}`); }}><ExternalLink size={11} /></button>)}
                  {resolveProductTypeKeys(d.productTypes||[],d.targetProductTypes||[]).length>0 && (<button title="Download UW Excel" className="flex-shrink-0 p-0.5 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" disabled={downloadingExcelDealId===deal.id} onClick={(e) => { e.stopPropagation(); downloadDealExcel(deal); }}>{downloadingExcelDealId===deal.id?<span className="text-[9px] text-emerald-500 animate-pulse">…</span>:<Download size={11} />}</button>)}
                </div>
              </div>
            );
          })()}
        </td>
      );
      case 'irr': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700 min-w-[90px]" style={{display: vis?'':'none'}}>
          {editingCell?.dealId === deal.id && editingCell?.field === 'irr' ? (
            <Input type="text" defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current = e.target.value; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs w-full" placeholder="e.g. 14.5%" autoFocus />
          ) : (
            <div className="cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 min-h-[28px] flex items-center" onClick={() => startCellEdit(deal.id,'irr',d.irr?.toString()||'')} title={d.irr?d.irr:'Click to add IRR'}>
              {d.irr ? <span className="font-medium text-violet-700">{d.irr}</span> : <span className="text-gray-300 italic text-[11px]">+ add</span>}
            </div>
          )}
        </td>
      );
      case 'excelModel': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId === deal.id && editingCell?.field === 'excelModelUrl' ? (
            <div className="flex items-center gap-1 min-w-[180px]">
              <input autoFocus type="text" className="flex-1 text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400" placeholder="Paste SharePoint URL..." defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current = e.target.value; }} onKeyDown={(e) => { if(e.key==='Enter'){e.preventDefault();saveCellEdit({target:{value:(e.target as HTMLInputElement).value}} as any);} if(e.key==='Escape'){setEditingCell(null);setCellEditValue('');editingCellRef.current=null;cellEditValueRef.current='';} }} />
              <button title="Save link" className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded bg-green-500 hover:bg-green-600 text-white text-xs font-bold" onMouseDown={(e) => { e.preventDefault(); saveCellEdit({target:{value:cellEditValueRef.current}} as any); }}>✓</button>
              <button title="Cancel" className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded bg-gray-300 hover:bg-gray-400 text-gray-700 text-xs font-bold" onMouseDown={(e) => { e.preventDefault(); setEditingCell(null);setCellEditValue('');editingCellRef.current=null;cellEditValueRef.current=''; }}>✗</button>
            </div>
          ) : d.excelModelUrl ? (
            <div className="flex items-center gap-1">
              <a href={d.excelModelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-7 px-2 text-xs rounded border bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-[#4A90E2] transition-colors" title="Open Excel model">Excel</a>
              <button className="text-gray-400 hover:text-gray-600 p-0.5" title="Edit link" onClick={() => { setEditingCell({dealId:deal.id,field:'excelModelUrl'}); setCellEditValue(d.excelModelUrl||''); editingCellRef.current={dealId:deal.id,field:'excelModelUrl'}; cellEditValueRef.current=d.excelModelUrl||''; }}><Edit2 size={10} /></button>
            </div>
          ) : (
            <button className="inline-flex items-center h-7 px-2 text-xs rounded border bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-[#4A90E2] transition-colors opacity-50 hover:opacity-100" onClick={() => { setEditingCell({dealId:deal.id,field:'excelModelUrl'}); setCellEditValue(''); editingCellRef.current={dealId:deal.id,field:'excelModelUrl'}; cellEditValueRef.current=''; }} title="Add SharePoint link">Excel</button>
          )}
        </td>
      );
      case 'reason': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {(deal.aiExplanatoryNotes||deal.rejectionReason) ? (
            <Button variant="outline" size="sm" className={`h-7 px-3 text-xs border transition-colors ${deal.status==='rejected'?'bg-red-500 text-white hover:bg-white hover:text-red-600 border-red-500':'bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-[#4A90E2]'}`} title={deal.aiExplanatoryNotes||deal.rejectionReason||''} onClick={() => { setReasonDialogOpen(true); setReasonDialogContent({title:deal.status==='rejected'?`Rejection Reason — ${deal.address}`:`AI Notes — ${deal.address}`,content:deal.aiExplanatoryNotes||deal.rejectionReason||'',type:deal.status==='rejected'?'rejection':'acceptance'}); }}>Reason</Button>
          ) : (!deal.classification||deal.classification==='unclassified') ? (
            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 hover:border-gray-400 transition-colors" title="Click to see why this deal is unclassified" onClick={() => { setReasonDialogOpen(true); setReasonDialogDeal(deal); setReasonDialogContent({title:`Why is this deal unclassified? — ${deal.address}`,content:getUnclassifiedReason(deal),type:'rejection'}); }}>Why?</Button>
          ) : <span className="text-gray-300 text-[10px]">—</span>}
        </td>
      );
      case 'dealType': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700 w-[70px] min-w-[70px]" style={{display: vis?'':'none'}}>
          <Select value={d.dealType||'land'} onValueChange={(value) => { cellUpdateMutation.mutate({dealId:deal.id,dealType:value,triggerReclassification:true}); }}>
            <SelectTrigger className="h-7 text-xs w-[50px] border-0 bg-transparent hover:bg-gray-100 px-0"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="land">Land</SelectItem><SelectItem value="acquisition">Acq</SelectItem></SelectContent>
          </Select>
        </td>
      );
      case 'productTypes': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {(() => {
            const PRODUCT_TYPES = [{value:'lot',label:'Lot'},{value:'3-story-surface-park',label:'3 Story Surface Park'},{value:'4-story-surface-park',label:'4 Story Surface Park'},{value:'3-story-attainable',label:'3-Story Attainable'},{value:'affordable',label:'Affordable'},{value:'aa-3-story-flats',label:'AA 3 Story Flats'},{value:'aa-4-story-flats',label:'AA 4 Story Flats'},{value:'aa-cottages',label:'AA Cottages'},{value:'btr-3-story-th',label:'BTR 3 Story TH'},{value:'btr-sfr-detached',label:'BTR SFR Detached'},{value:'btr-th-2-3br',label:'BTR TH 2-3BR Mix'}];
            const currentTypes: string[] = editingRow===deal.id?(editData.productTypes as string[]||[]):((deal.productTypes as string[])||[]);
            const typeLabel = (t: string) => { if(t==='lot'||t==='lot-development')return'Lot'; if(t==='3-story-surface-park')return'3 Story SP'; if(t==='4-story-surface-park')return'4 Story SP'; if(t==='3-story-attainable')return'3 Story Attainable'; if(t==='conventional'||t==='3-story-walk-up'||t==='4-story-elevatored'||t==='wrap-podium')return'Conventional'; if(t==='affordable')return'Affordable'; if(t==='aa-3-story-flats')return'AA 3 Story'; if(t==='aa-4-story-flats')return'AA 4 Story'; if(t==='aa-cottages')return'AA Cottages'; if(t==='btr')return'BTR'; if(t==='btr-3-story-th')return'BTR 3 Story TH'; if(t==='btr-sfr-detached')return'BTR SFR'; if(t==='btr-th-2-3br')return'BTR TH 2-3BR'; if(t==='active-adult')return'Active Adult'; return t; };
            const handleToggle = (value: string, checked: boolean) => { const next = checked?[...currentTypes,value]:currentTypes.filter(t=>t!==value); if(editingRow===deal.id)setEditData({...editData,productTypes:next}); cellUpdateMutation.mutate({dealId:deal.id,productTypes:next}); };
            return (
              <Popover open={openProductTypePopover===deal.id} onOpenChange={(open) => setOpenProductTypePopover(open?deal.id:null)}>
                <PopoverTrigger asChild><button className="w-full text-left text-xs min-h-[28px] px-1 py-0.5 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors flex items-center gap-1 flex-wrap">{currentTypes.length>0?currentTypes.map(t => <span key={t} className="inline-flex items-center bg-sky-100 text-sky-800 text-[10px] font-semibold px-1.5 py-0.5 rounded">{typeLabel(t)}</span>):<span className="text-gray-300 italic text-[11px]">+ select types</span>}</button></PopoverTrigger>
                <PopoverContent className="w-44 p-2" align="start" side="bottom">
                  <div className="space-y-0.5">{PRODUCT_TYPES.map(({value,label}) => (<label key={value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1.5 text-xs select-none"><input type="checkbox" checked={currentTypes.includes(value)} onChange={(e) => handleToggle(value,e.target.checked)} className="h-3.5 w-3.5 cursor-pointer accent-[#4A90E2]" /><span className="font-medium text-gray-700">{label}</span></label>))}{currentTypes.length>0&&(<div className="pt-1 mt-1 border-t border-gray-100"><button className="w-full text-left text-[11px] text-red-400 hover:text-red-600 px-1.5 py-0.5" onClick={() => { if(editingRow===deal.id)setEditData({...editData,productTypes:[]}); cellUpdateMutation.mutate({dealId:deal.id,productTypes:[]}); }}>Clear all</button></div>)}</div>
                  {deal.suggestedDevelopmentType&&(<div className="mt-2 pt-2 border-t border-gray-100"><Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs py-0 px-1"><Zap className="mr-1" size={10} />{deal.suggestedDevelopmentType}</Badge></div>)}
                </PopoverContent>
              </Popover>
            );
          })()}
        </td>
      );
      case 'analystNotes': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {deal.analystNotes ? (
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex items-center justify-center gap-1 transition-colors bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:scale-100 transform-gpu" onClick={() => setAnalystNotesModal({dealId:deal.id,address:deal.address||'Property',notes:deal.analystNotes||'',isEditing:false})} data-testid={`button-view-analyst-notes-${deal.id}`}><FileText size={12} />Notes</Button>
          ) : (
            <div className="text-gray-400 italic text-xs cursor-pointer px-1" onClick={() => setAnalystNotesModal({dealId:deal.id,address:deal.address||'Property',notes:'',isEditing:true})} data-testid={`button-add-analyst-notes-${deal.id}`}>Click to add...</div>
          )}
        </td>
      );
      case 'dealSummary': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {d.dealSummary ? (
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex items-center justify-center gap-1 transition-colors bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:scale-100 transform-gpu" onClick={() => setDealSummaryModal({dealId:deal.id,address:deal.address||'Property',notes:d.dealSummary||'',isEditing:false})}><FileText size={12} />Summary</Button>
          ) : (
            <div className="text-gray-400 italic text-xs cursor-pointer px-1" onClick={() => { dealSummaryEditRef.current=''; setDealSummaryModal({dealId:deal.id,address:deal.address||'Property',notes:'',isEditing:true}); }}>Click to add...</div>
          )}
        </td>
      );
      case 'developerNotes': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {d.developerNotes ? (
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex items-center justify-center gap-1 transition-colors bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:scale-100 transform-gpu" onClick={() => setDeveloperNotesModal({dealId:deal.id,address:deal.address||'Property',notes:d.developerNotes||'',isEditing:false})}><Building size={12} />Dev</Button>
          ) : (
            <div className="text-gray-400 italic text-xs cursor-pointer px-1" onClick={() => setDeveloperNotesModal({dealId:deal.id,address:deal.address||'Property',notes:'',isEditing:true})}>Click to add...</div>
          )}
        </td>
      );
      case 'notes': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700 bg-gray-50 w-[70px] max-w-[70px]" style={{display: vis?'':'none'}}>
          {deal.brokerNotes ? (
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] transition-colors" onClick={() => setBrokerNotesModal({dealId:deal.id,address:deal.address||'Property',notes:deal.brokerNotes||'',isEditing:false})} data-testid={`button-view-broker-notes-${deal.id}`}>Notes</Button>
          ) : (
            <span className="text-gray-400 italic text-xs" data-testid={`text-broker-notes-empty-${deal.id}`}>No notes</span>
          )}
        </td>
      );
      case 'topRentPerUnit': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          <div className={!deal.topRentPerUnit||Number(deal.topRentPerUnit)===0?'text-gray-400':''}>{deal.topRentPerUnit&&Number(deal.topRentPerUnit)>0?`$${Math.round(Number(deal.topRentPerUnit))}/mo`:'-'}</div>
        </td>
      );
      case 'topRentPSF': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          <div className={!deal.topRentPSF?'text-gray-400':''}>{deal.topRentPSF?`$${Number(deal.topRentPSF).toFixed(2)}`:'-'}</div>
        </td>
      );
      case 'lihtc': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {(['NC','North Carolina','NORTH CAROLINA'].includes(d.state||'')) ? (
            <div className="flex items-center gap-1">
              {d.lihtcScoreTotal!=null ? (
                <button onClick={() => setLihtcScoreModal({dealId:deal.id})} title={d.lihtcScorePreliminary?'Preliminary score — click to view breakdown':'Confirmed score — click to view breakdown'} className={`inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded text-xs transition-colors hover:opacity-80 ${d.lihtcScoreTotal>=60?'bg-emerald-100 text-emerald-800 border border-emerald-200':d.lihtcScoreTotal>=40?'bg-amber-100 text-amber-800 border border-amber-200':'bg-red-100 text-red-700 border border-red-200'}`}>{d.lihtcScoreTotal}{d.lihtcScorePreliminary&&<span className="text-[8px] font-normal opacity-60 ml-0.5">~</span>}</button>
              ) : (
                <button onClick={() => setLihtcScoreModal({dealId:deal.id})} className="text-[10px] text-gray-400 hover:text-[#4A90E2] transition-colors px-1 py-0.5 rounded hover:bg-blue-50" title="Run NC 2026 QAP score">Score</button>
              )}
              <button onClick={() => handleRescoreLihtc(deal.id)} disabled={rescoringLihtcDealId===deal.id} title="Re-run NC 2026 QAP scoring" className="p-0.5 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-40"><RefreshCw size={10} className={rescoringLihtcDealId===deal.id?'animate-spin text-blue-500':''} /></button>
            </div>
          ) : <span className="text-gray-300 text-[10px]">—</span>}
        </td>
      );
      case 'qct': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" data-testid={`cell-qct-${deal.id}`} style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='qctStatus' ? (
            <Select value={cellEditValue||(d.qctStatus||'N/A')} onValueChange={(value) => { setCellEditValue(value); const {dealId,field}=editingCell; cellUpdateMutation.mutate({dealId,[field]:value}); setEditingCell(null); setCellEditValue(''); }} open={true} onOpenChange={(open) => { if(!open){setEditingCell(null);setCellEditValue('');} }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Yes" className="text-xs">Yes</SelectItem><SelectItem value="No" className="text-xs">No</SelectItem><SelectItem value="N/A" className="text-xs">N/A</SelectItem></SelectContent>
            </Select>
          ) : (
            <div className="cursor-pointer hover:bg-gray-100" onClick={() => startCellEdit(deal.id,'qctStatus',d.qctStatus||'N/A')}>
              <Badge variant="outline" className={`text-xs px-2 py-0 ${(d.qctStatus==='YES'||d.qctStatus==='Yes')?'bg-green-50 text-green-700 border-green-200':(d.qctStatus==='NO'||d.qctStatus==='No')?'bg-gray-50 text-gray-700 border-gray-200':'bg-gray-100 text-gray-500'}`}>{d.qctStatus||'N/A'}</Badge>
            </div>
          )}
        </td>
      );
      case 'dda': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {d.ddaStatus&&d.ddaStatus!=='N/A' ? (
            <Badge variant="outline" className={`text-xs px-2 py-0 ${d.ddaStatus==='MDDA'?'bg-purple-50 text-purple-700 border-purple-200':d.ddaStatus==='NMDDA'?'bg-blue-50 text-blue-700 border-blue-200':d.ddaStatus==='NO'?'bg-gray-50 text-gray-500 border-gray-200':'bg-gray-100 text-gray-400'}`} title={d.ddaStatus==='MDDA'?'Metropolitan Difficult Development Area (HUD 2026)':d.ddaStatus==='NMDDA'?'Non-Metropolitan Difficult Development Area (HUD 2026)':'Not a Difficult Development Area'}>{d.ddaStatus}</Badge>
          ) : <span className="text-gray-300 text-[10px]">—</span>}
        </td>
      );
      case 'oz': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='ozStatus' ? (
            <Select value={cellEditValue||(d.ozStatus||'N/A')} onValueChange={(value) => { setCellEditValue(value); const {dealId,field}=editingCell; cellUpdateMutation.mutate({dealId,[field]:value}); setEditingCell(null); setCellEditValue(''); }} open={true} onOpenChange={(open) => { if(!open){setEditingCell(null);setCellEditValue('');} }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="YES" className="text-xs">YES</SelectItem><SelectItem value="NO" className="text-xs">NO</SelectItem><SelectItem value="N/A" className="text-xs">N/A</SelectItem></SelectContent>
            </Select>
          ) : (
            <div className="cursor-pointer hover:bg-gray-100" onClick={() => startCellEdit(deal.id,'ozStatus',d.ozStatus||'N/A')}>
              <Badge variant="outline" className={`text-xs px-2 py-0 ${d.ozStatus==='YES'?'bg-amber-50 text-amber-700 border-amber-300':d.ozStatus==='NO'?'bg-gray-50 text-gray-500 border-gray-200':'bg-gray-100 text-gray-400'}`}>{d.ozStatus||'N/A'}</Badge>
            </div>
          )}
        </td>
      );
      case 'date': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          <div className="text-xs">{formatDate(deal.createdAt)}</div>
        </td>
      );
      case 'brokerDocs': return (
        <td key={key} className={`px-1 py-1 text-xs border-r border-gray-200 text-gray-700 ${expandedBrokerDocs.size>0?'w-[260px]':'w-[110px] max-w-[110px]'}`} style={{display: vis?'':'none'}}>
          <div className="space-y-1">
            {Array.isArray(deal.documentUrls)&&deal.documentUrls.length>0&&(
              <div className="flex flex-col gap-1">{(() => { const docs=deal.documentUrls as string[]; const isExpanded=expandedBrokerDocs.has(deal.id); return (<>{!isExpanded&&(<Button onClick={() => { const s=new Set(expandedBrokerDocs); s.add(deal.id); setExpandedBrokerDocs(s); }} size="sm" variant="outline" className="h-7 px-1 text-xs bg-blue-50 hover:bg-blue-500 hover:text-white border-blue-200 text-blue-700" data-testid={`button-expand-broker-docs-${deal.id}`}>{docs.length} Doc{docs.length!==1?'s':''}<ChevronDown size={12} className="ml-1" /></Button>)}{isExpanded&&(<><Button onClick={() => { const s=new Set(expandedBrokerDocs); s.delete(deal.id); setExpandedBrokerDocs(s); }} size="sm" variant="ghost" className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 w-full justify-center mb-1" data-testid={`button-collapse-broker-docs-${deal.id}`}><ChevronUp size={12} className="mr-1" />Hide {docs.length} document{docs.length!==1?'s':''}</Button>{docs.map((docUrl: string,index: number) => { const fileName=docUrl.split('/').pop()||`Document ${index+1}`; const fileExt=fileName.split('.').pop()?.toLowerCase()||''; const isPdf=fileExt==='pdf'; const isExcel=['xlsx','xls','csv'].includes(fileExt); return (<div key={index} className="flex items-center gap-1 max-w-full overflow-hidden"><Button onClick={() => openFileViewer(docUrl)} size="sm" variant="outline" className="h-7 px-2 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 hover:text-blue-700 flex-1 min-w-0 overflow-hidden" title={`View ${fileName}`} data-testid={`button-view-broker-doc-${deal.id}-${index}`}>{isPdf?<FileText size={12} className="mr-1 shrink-0" />:isExcel?<BarChart3 size={12} className="mr-1 shrink-0" />:<Eye size={12} className="mr-1 shrink-0" />}<span className="truncate">{fileName}</span></Button><Button onClick={() => handleRenameFile(deal.id,docUrl,true)} size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50" title="Rename file" data-testid={`button-rename-broker-doc-${deal.id}-${index}`}><Edit2 size={12} /></Button><Button onClick={() => handleDeleteBrokerFile(deal.id,docUrl)} size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-gray-500 hover:text-red-600 hover:bg-red-50" title="Delete file" data-testid={`button-delete-broker-doc-${deal.id}-${index}`}><Trash2 size={12} /></Button></div>); })}</>)}</>); })()}</div>
            )}
            <div><input type="file" id={`broker-file-upload-${deal.id}`} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg" onChange={(e) => handleBrokerFileUpload(e,deal.id)} data-testid={`input-broker-file-upload-${deal.id}`} /><Button onClick={() => document.getElementById(`broker-file-upload-${deal.id}`)?.click()} size="sm" variant="outline" className="h-7 px-2 text-xs bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] transition-colors" title="Upload broker document" data-testid={`button-upload-broker-doc-${deal.id}`}>Upload</Button></div>
          </div>
        </td>
      );
      case 'analystDocs': return (
        <td key={key} className={`px-1 py-1 text-xs border-r border-gray-200 text-gray-700 ${expandedAnalystDocs.size>0?'w-[260px]':'w-[130px] max-w-[130px]'}`} style={{display: vis?'':'none'}}>
          <div className="space-y-1">
            {Array.isArray(d.analystDocumentUrls)&&d.analystDocumentUrls.length>0&&(
              <div className="flex flex-col gap-1">{(() => { const docs=d.analystDocumentUrls as string[]; const isExpanded=expandedAnalystDocs.has(deal.id); return (<>{!isExpanded&&(<Button onClick={() => { const s=new Set(expandedAnalystDocs); s.add(deal.id); setExpandedAnalystDocs(s); }} size="sm" variant="outline" className="h-7 px-2 text-xs bg-green-50 hover:bg-green-500 hover:text-white border-green-200 text-green-700" data-testid={`button-expand-analyst-docs-${deal.id}`}><FileText size={12} className="mr-1" />{docs.length} Doc{docs.length!==1?'s':''}<ChevronDown size={12} className="ml-1" /></Button>)}{isExpanded&&(<><Button onClick={() => { const s=new Set(expandedAnalystDocs); s.delete(deal.id); setExpandedAnalystDocs(s); }} size="sm" variant="ghost" className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 w-full justify-center mb-1" data-testid={`button-collapse-analyst-docs-${deal.id}`}><ChevronUp size={12} className="mr-1" />Hide {docs.length} document{docs.length!==1?'s':''}</Button>{docs.map((docUrl: string,index: number) => { const fileName=docUrl.split('/').pop()||`Document ${index+1}`; const fileExt=fileName.split('.').pop()?.toLowerCase()||''; const isPdf=fileExt==='pdf'; const isExcel=['xlsx','xls','csv'].includes(fileExt); return (<div key={index} className="flex items-center gap-1 max-w-full overflow-hidden"><Button onClick={() => openFileViewer(docUrl)} size="sm" variant="outline" className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 border-green-200 text-green-700 hover:text-green-700 flex-1 min-w-0 overflow-hidden" title={`View ${fileName}`} data-testid={`button-view-analyst-doc-${deal.id}-${index}`}>{isPdf?<FileText size={12} className="mr-1 shrink-0" />:isExcel?<BarChart3 size={12} className="mr-1 shrink-0" />:<Eye size={12} className="mr-1 shrink-0" />}<span className="truncate">{fileName}</span></Button><Button onClick={() => handleRenameFile(deal.id,docUrl,false)} size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50" title="Rename file" data-testid={`button-rename-analyst-doc-${deal.id}-${index}`}><Edit2 size={12} /></Button><Button onClick={() => handleDeleteAnalystFile(deal.id,docUrl)} size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-gray-500 hover:text-red-600 hover:bg-red-50" title="Delete file" data-testid={`button-delete-analyst-doc-${deal.id}-${index}`}><Trash2 size={12} /></Button></div>); })}</>)}</>); })()}</div>
            )}
            <div><input type="file" id={`analyst-file-upload-${deal.id}`} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg" onChange={(e) => handleFileUpload(e,deal.id)} data-testid={`input-analyst-file-upload-${deal.id}`} /><Button onClick={() => document.getElementById(`analyst-file-upload-${deal.id}`)?.click()} size="sm" variant="outline" className="h-7 px-3 text-xs bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] transition-colors" title="Upload analyst document" data-testid={`button-upload-analyst-doc-${deal.id}`}>Upload</Button></div>
          </div>
        </td>
      );
      case 'comps': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {(() => {
            const notes=deal.comparableNotes||''; const notesLC=notes.toLowerCase(); let parsedCompsJson: any[]|undefined;
            if(deal.comparablesJson){try{const raw=typeof deal.comparablesJson==='string'?JSON.parse(deal.comparablesJson):deal.comparablesJson; parsedCompsJson=Array.isArray(raw)?raw:undefined;}catch{}}
            const hasData=notes.trim().length>0||(parsedCompsJson&&parsedCompsJson.length>0);
            if(!hasData) return <span className="text-xs text-gray-400" data-testid={`text-no-comparables-${deal.id}`}>No comparables data</span>;
            const isZipCenter=notesLC.includes('[zip center]');
            const isError=!isZipCenter&&((notesLC.includes('error')&&!notesLC.includes('no qualifying'))||notesLC.includes('unavailable')||(notesLC.includes('failed')&&!notesLC.includes('no qualifying'))||notesLC.includes('unable to geocode')||notesLC.includes('api failure'));
            const isOnlyAiPrefix=notes.startsWith('SUBJECT PROPERTY:')&&!notes.includes('QUALIFIES')&&!notes.includes('Found ')&&!notes.includes('ALL CANDIDATES')&&!(parsedCompsJson&&parsedCompsJson.length>0);
            const isNoData=!isError&&(!!notes.match(/found 0 total comparables/i)||!!notes.match(/no comparable properties found/i)||!!notes.match(/no comparables found/i)||isOnlyAiPrefix)&&!(parsedCompsJson&&parsedCompsJson.length>0);
            const btnClass=isZipCenter?'bg-orange-500 text-white hover:bg-white hover:text-orange-600 border-orange-500':(isError||isNoData)?'bg-red-500 text-white hover:bg-white hover:text-red-600 border-red-500':'bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-[#4A90E2]';
            const btnLabel=isZipCenter?'NO COMPS':isNoData?'No Data':isError?'API Error':'COMPS';
            return (<Button variant="outline" size="sm" className={`h-7 px-3 text-xs border transition-colors ${btnClass}`} onClick={() => { let suggestedAddress: string|undefined; let suggestedDistance: number|undefined; const am=notes.match(/Suggested closest address:\s*([^\n]+)/i); if(am)suggestedAddress=am[1].trim(); const dm=notes.match(/\((\d+\.?\d*)\s*miles?\s*(?:from|away)/i); if(dm)suggestedDistance=parseFloat(dm[1]); const dpt=Array.isArray(deal.productTypes)?deal.productTypes:(typeof deal.productTypes==='string'?[deal.productTypes]:[]); setHelloDataModal({dealId:deal.id,address:deal.address||'Property',city:deal.city||'',state:deal.state||'',zip:deal.zip||'',comparableNotes:notes,isError,suggestedAddress,suggestedDistance,latitude:deal.latitude?parseFloat(deal.latitude.toString()):null,longitude:deal.longitude?parseFloat(deal.longitude.toString()):null,acres:deal.sizeAcres?parseFloat(deal.sizeAcres.toString()):undefined,proposedUnits:deal.estimatedUnits||deal.unitCount||undefined,comparablesJson:parsedCompsJson,productType:dpt[0] as string|undefined,statusUpdatedAt:deal.statusUpdatedAt}); }} data-testid={`button-toggle-comparables-${deal.id}`}>{btnLabel}</Button>);
          })()}
        </td>
      );
      case 'ncOnemap': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {deal.state?.toUpperCase()==='NC' ? (
            <Button variant="outline" size="sm" className="h-7 px-3 text-xs border transition-colors bg-emerald-600 text-white hover:bg-white hover:text-emerald-700 border-emerald-600" onClick={() => setNcOneMapModal({dealId:deal.id,address:deal.address||'',city:deal.city||'',state:deal.state||'NC',zip:deal.zip||'',county:d.county||''})} data-testid={`button-nc-onemap-${deal.id}`}>NC Tax</Button>
          ) : <span className="text-xs text-gray-400">NC only</span>}
        </td>
      );
      case 'pop55': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          <Collapsible>
            <CollapsibleTrigger asChild><Button variant="outline" size="sm" className="w-full h-7 px-3 text-xs flex items-center justify-between gap-1 bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] transition-colors" data-testid={`button-toggle-population-${deal.id}`}><span>{d.population55Plus5Mile?(d.population55Plus5Mile as number).toLocaleString():'0'}</span><ChevronDown size={14} className="collapsible-icon" /></Button></CollapsibleTrigger>
            <CollapsibleContent className="mt-2"><div className="bg-blue-50 border border-blue-200 rounded p-2">
              {editingCell?.dealId===deal.id&&editingCell?.field==='population55Plus5Mile' ? (
                <Input type="text" defaultValue={formatNumberWithCommas(cellEditValue)} onChange={(e) => { const n=parseNumberWithCommas(e.target.value); const f=formatNumberWithCommas(n); if(e.target.value!==f)e.target.value=f; cellEditValueRef.current=n; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-7 text-xs" placeholder="Population..." autoFocus />
              ) : (
                <div className={`text-xs font-medium cursor-pointer hover:bg-blue-100 p-1 rounded ${isFieldEmpty(d.population55Plus5Mile)?'text-gray-400':'text-blue-900'}`} onClick={() => startCellEdit(deal.id,'population55Plus5Mile',d.population55Plus5Mile?.toString()||'')} title="Click to edit 55+ population">55+ Pop: {d.population55Plus5Mile?(d.population55Plus5Mile as number).toLocaleString():'0'}</div>
              )}
              {(d.censusTotalPopulation||d.censusMedianIncome||d.censusMedianAge||d.censusVacancyRate||d.censusRenterRate)&&(<div className="mt-2 pt-2 border-t border-blue-200 text-xs text-gray-600"><div className="font-semibold text-gray-700 mb-1">Census Data:</div>{d.censusTotalPopulation&&<div>Pop: {Number(d.censusTotalPopulation).toLocaleString()}</div>}{d.censusMedianIncome&&<div>Med Income: ${Number(d.censusMedianIncome).toLocaleString()}</div>}{d.censusMedianAge&&<div>Med Age: {Number(d.censusMedianAge).toFixed(1)}</div>}{d.censusVacancyRate&&<div>Vacancy: {Number(d.censusVacancyRate).toFixed(1)}%</div>}{d.censusRenterRate&&<div>Renter: {Number(d.censusRenterRate).toFixed(1)}%</div>}</div>)}
            </div></CollapsibleContent>
          </Collapsible>
        </td>
      );
      case 'income75k': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          <Collapsible>
            <CollapsibleTrigger asChild><Button variant="outline" size="sm" className="w-full h-7 px-3 text-xs flex items-center justify-between gap-1 bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] transition-colors" data-testid={`button-toggle-income-${deal.id}`}><span>$ {d.income75Plus55Plus?(d.income75Plus55Plus as number).toLocaleString():'0'}</span><ChevronDown size={14} className="collapsible-icon" /></Button></CollapsibleTrigger>
            <CollapsibleContent className="mt-2"><div className="bg-blue-50 border border-blue-200 rounded p-2">
              {editingCell?.dealId===deal.id&&editingCell?.field==='income75Plus55Plus' ? (
                <Input type="text" defaultValue={formatNumberWithCommas(cellEditValue)} onChange={(e) => { const n=parseNumberWithCommas(e.target.value); const f=formatNumberWithCommas(n); if(e.target.value!==f)e.target.value=f; cellEditValueRef.current=n; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-7 text-xs" placeholder="Income..." autoFocus />
              ) : (
                <div className={`text-xs font-medium cursor-pointer hover:bg-blue-100 p-1 rounded ${isFieldEmpty(d.income75Plus55Plus)?'text-gray-400':'text-blue-900'}`} onClick={() => startCellEdit(deal.id,'income75Plus55Plus',d.income75Plus55Plus?.toString()||'')} title="Click to edit 75K+ income population">$75K+ Income: {d.income75Plus55Plus?(d.income75Plus55Plus as number).toLocaleString():'0'}</div>
              )}
            </div></CollapsibleContent>
          </Collapsible>
        </td>
      );
      case 'juniorAnalyst': return null;
      case 'analyst': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingRow===deal.id ? (
            <Select value={editData.assignedAnalyst||''} onValueChange={(value) => { const v=value==='none'?null:value; setEditData({...editData,assignedAnalyst:v}); debouncedSave(deal.id,'assignedAnalyst',v,false); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select analyst..." /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem>{analysts.map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          ) : editingCell?.dealId===deal.id&&editingCell?.field==='assignedAnalyst' ? (
            <Select value={cellEditValue} onValueChange={(value) => { const v=value==='none'?null:value; setCellEditValue(value); debouncedSave(editingCell.dealId,'assignedAnalyst',v,false); setEditingCell(null); setCellEditValue(''); }} open={true}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select analyst..." /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem>{analysts.map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div className={`whitespace-nowrap cursor-pointer hover:bg-gray-100 px-1 rounded ${isFieldEmpty(d.assignedAnalyst)?'text-gray-400 italic':''}`} onClick={() => startCellEdit(deal.id,'assignedAnalyst',d.assignedAnalyst)} title={isFieldEmpty(d.assignedAnalyst)?'Click to assign analyst':(d.assignedAnalyst||'')}>
              {d.assignedAnalyst?getInitials(d.assignedAnalyst):<span className="text-gray-400 italic text-xs">-</span>}
            </div>
          )}
        </td>
      );
      case 'dev': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingRow===deal.id ? (
            <Select value={editData.developer||''} onValueChange={(value) => { const v=value==='none'?null:value; setEditData({...editData,developer:v}); debouncedSave(deal.id,'assignedDeveloper',v,false); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select developer..." /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem>{developers.map((dev: string) => <SelectItem key={dev} value={dev}>{dev}</SelectItem>)}</SelectContent>
            </Select>
          ) : editingCell?.dealId===deal.id&&editingCell?.field==='developer' ? (
            <Select value={cellEditValue} onValueChange={(value) => { const v=value==='none'?null:value; setCellEditValue(value); debouncedSave(editingCell.dealId,'assignedDeveloper',v,false); setEditingCell(null); setCellEditValue(''); }} open={true}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select developer..." /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem>{developers.map((dev: string) => <SelectItem key={dev} value={dev}>{dev}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div className={`cursor-pointer ${isFieldEmpty(d.assignedDeveloper)?'':'hover:bg-gray-100'}`} onClick={() => startCellEdit(deal.id,'developer',d.assignedDeveloper)} title={isFieldEmpty(d.assignedDeveloper)?'Click to assign developer':(d.assignedDeveloper||'')}>
              {d.assignedDeveloper?getInitials(d.assignedDeveloper):<span className="text-gray-400 italic text-xs">-</span>}
            </div>
          )}
        </td>
      );
      case 'partner': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingRow===deal.id ? (
            <Select value={editData.partner||''} onValueChange={(value) => { const v=value==='none'?null:value; setEditData({...editData,partner:v}); debouncedSave(deal.id,'assignedPartner',v,false); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select partner..." /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem>{partners.map((p: string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          ) : editingCell?.dealId===deal.id&&editingCell?.field==='partner' ? (
            <Select value={cellEditValue} onValueChange={(value) => { const v=value==='none'?null:value; setCellEditValue(value); debouncedSave(editingCell.dealId,'assignedPartner',v,false); setEditingCell(null); setCellEditValue(''); }} open={true}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select partner..." /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem>{partners.map((p: string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div className={`cursor-pointer ${isFieldEmpty(d.assignedPartner)?'':'hover:bg-gray-100'}`} onClick={() => startCellEdit(deal.id,'partner',d.assignedPartner)} title={isFieldEmpty(d.assignedPartner)?'Click to assign partner':(d.assignedPartner||'')}>
              {d.assignedPartner?getInitials(d.assignedPartner):<span className="text-gray-400 italic text-xs">-</span>}
            </div>
          )}
        </td>
      );
      case 'price': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='askingPrice' ? (
            <Input type="text" defaultValue={formatNumberWithCommas(cellEditValue)} onChange={(e) => { const n=parseNumberWithCommas(e.target.value); const f=formatNumberWithCommas(n); if(e.target.value!==f)e.target.value=f; cellEditValueRef.current=n; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Price..." autoFocus />
          ) : (
            <div className={`cursor-pointer ${!d.askingPrice?'':'hover:bg-gray-100'}`} onClick={() => startCellEdit(deal.id,'askingPrice',d.askingPrice?.toString()||'')} title={d.askingPrice?formatPrice(d.askingPrice.toString()):'Click to add price'}>
              {formatPrice(d.askingPrice?.toString()||'')==='N/A'?<span className="text-gray-400 italic text-xs">Click to add...</span>:formatPrice(d.askingPrice?.toString()||'')}
            </div>
          )}
        </td>
      );
      case 'units': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='unitCount' ? (
            <Input type="text" defaultValue={formatNumberWithCommas(cellEditValue)} onChange={(e) => { const n=parseNumberWithCommas(e.target.value); const f=formatNumberWithCommas(n); if(e.target.value!==f)e.target.value=f; cellEditValueRef.current=n; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Units..." autoFocus />
          ) : (
            <div className={`cursor-pointer ${!deal.unitCount?'':'hover:bg-gray-100'}`} onClick={() => startCellEdit(deal.id,'unitCount',deal.unitCount?.toString()||'')}>
              {deal.unitCount||<span className="text-gray-400 italic text-xs">Click to add...</span>}
            </div>
          )}
        </td>
      );
      case 'maxUnitsZoning': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='maxUnitsByZoning' ? (
            <Input type="text" defaultValue={formatNumberWithCommas(cellEditValue)} onChange={(e) => { const n=parseNumberWithCommas(e.target.value); const f=formatNumberWithCommas(n); if(e.target.value!==f)e.target.value=f; cellEditValueRef.current=n; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Max units..." autoFocus />
          ) : (
            <div className="cursor-pointer hover:bg-gray-100" onClick={() => startCellEdit(deal.id,'maxUnitsByZoning',deal.maxUnitsByZoning?.toString()||'')}>
              {deal.maxUnitsByZoning?deal.maxUnitsByZoning.toLocaleString():<span className="text-gray-400 italic text-xs">Click to add...</span>}
            </div>
          )}
        </td>
      );
      case 'vintage': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='vintage' ? (
            <Input type="text" inputMode="numeric" defaultValue={cellEditValue} onChange={(e) => { const v=e.target.value.replace(/[^0-9]/g,''); if(e.target.value!==v)e.target.value=v; cellEditValueRef.current=v; if(v&&v.length===4){setTimeout(()=>{if(cellEditValueRef.current===v)autoSaveField(deal.id,'vintage',v);},300);} }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Year..." autoFocus />
          ) : (
            <div className={`cursor-pointer ${!(deal.vintage||d.yearBuilt)?'':'hover:bg-gray-100'}`} onClick={() => startCellEdit(deal.id,'vintage',(deal.vintage||d.yearBuilt)?.toString()||'')}>
              {deal.vintage||d.yearBuilt||<span className="text-gray-400 italic text-xs">Click to add...</span>}
            </div>
          )}
        </td>
      );
      case 'acres': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='sizeAcres' ? (
            <Input type="number" step="0.1" defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current=e.target.value; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Acres..." autoFocus />
          ) : (
            <div className={`cursor-pointer ${!deal.sizeAcres?'':'hover:bg-gray-100'}`} onClick={() => startCellEdit(deal.id,'sizeAcres',deal.sizeAcres?.toString()||'')} title={deal.sizeAcres?String(deal.sizeAcres):'Click to add acres'}>
              {deal.sizeAcres||<span className="text-gray-400 italic text-xs">Click to add...</span>}
            </div>
          )}
        </td>
      );
      case 'netDevelopableAcres': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='netDevelopableAcres' ? (
            <Input type="number" step="0.1" defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current=e.target.value; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Net acres..." autoFocus />
          ) : (
            <div className={`cursor-pointer ${!d.netDevelopableAcres?'':'hover:bg-gray-100'}`} onClick={() => startCellEdit(deal.id,'netDevelopableAcres',d.netDevelopableAcres?.toString()||'')} title={d.netDevelopableAcres?String(d.netDevelopableAcres):'Click to add net developable acres'}>
              {d.netDevelopableAcres||<span className="text-gray-400 italic text-xs">Click to add...</span>}
            </div>
          )}
        </td>
      );
      case 'dua': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          <div className="text-center">{deal.unitCount&&deal.sizeAcres&&parseFloat(deal.sizeAcres.toString())>0?(parseInt(deal.unitCount.toString())/parseFloat(deal.sizeAcres.toString())).toFixed(1):'--'}</div>
        </td>
      );
      case 'zoning': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingRow===deal.id ? (
            <Input type="text" value={editData.zoning||''} onChange={(e) => setEditData({...editData,zoning:e.target.value})} onBlur={(e) => autoSaveField(deal.id,'zoning',e.target.value)} onKeyDown={(e) => handleRowEditKeyPress(e,deal.id,'zoning',(e.target as HTMLInputElement).value)} className="h-8 text-xs" placeholder="Zoning..." />
          ) : editingCell?.dealId===deal.id&&editingCell?.field==='zoning' ? (
            <Input type="text" defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current=e.target.value; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Zoning..." autoFocus />
          ) : (
            <div className={`cursor-pointer ${!deal.zoning?'':'hover:bg-gray-100'}`} onClick={() => startCellEdit(deal.id,'zoning',deal.zoning||'')} title={deal.zoning?deal.zoning:'Click to add zoning'}>
              {deal.zoning||<span className="text-gray-400 italic text-xs">Click to add...</span>}
            </div>
          )}
        </td>
      );
      case 'wetlandNotes': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {d.wetlandNotes ? (
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex items-center justify-center gap-1 transition-colors bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:scale-100 transform-gpu" onClick={() => setWetlandNotesModal({dealId:deal.id,address:deal.address||'Property',notes:d.wetlandNotes||'',isEditing:false})}><FileText size={12} />Notes</Button>
          ) : (
            <div className="text-gray-400 italic text-xs cursor-pointer px-1" onClick={() => { wetlandNotesEditRef.current=''; setWetlandNotesModal({dealId:deal.id,address:deal.address||'Property',notes:'',isEditing:true}); }}>Click to add...</div>
          )}
        </td>
      );
      case 'developerSummary': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='developerSummary' ? (
            <Textarea defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current=e.target.value; }} onBlur={saveCellEdit} onKeyDown={(e) => { if(e.key==='Escape')setEditingCell(null); }} className="min-h-[60px] text-xs w-[220px]" placeholder="Deal summary for developers..." autoFocus />
          ) : (
            <div className="flex flex-col gap-1">
              <div className={`cursor-pointer whitespace-pre-wrap ${d.developerSummary?'hover:bg-gray-100':''}`} onClick={() => startCellEdit(deal.id,'developerSummary',d.developerSummary||'')} title={d.developerSummary||'Click to add a developer summary'}>{d.developerSummary?<span className="line-clamp-2">{d.developerSummary}</span>:<span className="text-gray-400 italic text-xs">Click to add...</span>}</div>
              <button type="button" className="text-[10px] text-[#009BA7] hover:underline text-left disabled:opacity-50" disabled={draftSummaryMutation.isPending&&draftSummaryMutation.variables===deal.id} onClick={async(e) => { e.stopPropagation(); try{const draft=await draftSummaryMutation.mutateAsync(deal.id); startCellEdit(deal.id,'developerSummary',draft||'');}catch(err){console.error('Failed to draft AI summary:',err);} }}>{draftSummaryMutation.isPending&&draftSummaryMutation.variables===deal.id?'Drafting…':'✨ AI Draft'}</button>
            </div>
          )}
        </td>
      );
      case 'entitlements': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingRow===deal.id ? (
            <Select value={editData.hasEntitlements===true?'with':editData.hasEntitlements===false?'without':'none'} onValueChange={(value) => { const v=value==='with'?true:value==='without'?false:undefined; setEditData({...editData,hasEntitlements:v}); cellUpdateMutation.mutate({dealId:deal.id,hasEntitlements:v}); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem><SelectItem value="with">With Entitlements</SelectItem><SelectItem value="without">Without Entitlements</SelectItem></SelectContent>
            </Select>
          ) : editingCell?.dealId===deal.id&&editingCell?.field==='hasEntitlements' ? (
            <Select value={cellEditValue} onValueChange={(value) => { setCellEditValue(value); const {dealId,field}=editingCell; const v=value==='with'?true:value==='without'?false:undefined; cellUpdateMutation.mutate({dealId,[field]:v}); setEditingCell(null); setCellEditValue(''); }} open={true}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem><SelectItem value="with">With Entitlements</SelectItem><SelectItem value="without">Without Entitlements</SelectItem></SelectContent>
            </Select>
          ) : (
            <div className="cursor-pointer hover:bg-gray-100" onClick={() => startCellEdit(deal.id,'hasEntitlements',deal.hasEntitlements===true?'with':deal.hasEntitlements===false?'without':'with')}>
              <span className={`px-2 py-1 rounded text-xs ${deal.hasEntitlements===true?'bg-green-100 text-green-700':deal.hasEntitlements===false?'bg-red-100 text-red-700':'bg-gray-50 text-gray-500'}`}>{deal.hasEntitlements===true?'With Entitlements':deal.hasEntitlements===false?'Without Entitlements':<span className="text-gray-400">-</span>}</span>
            </div>
          )}
        </td>
      );
      case 'pricePerUnit': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          <div className="text-center">{d.askingPrice&&deal.unitCount?formatPrice((parseFloat(d.askingPrice.toString())/parseInt(deal.unitCount.toString())).toString()):'--'}</div>
        </td>
      );
      case 'sewer': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingRow===deal.id ? (
            <Select value={editData.sewerAvailable===true?'yes':editData.sewerAvailable===false?'no':'unknown'} onValueChange={(value) => { const v=value==='yes'?true:value==='no'?false:value==='none'?undefined:undefined; setEditData({...editData,sewerAvailable:v}); cellUpdateMutation.mutate({dealId:deal.id,sewerAvailable:v}); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem><SelectItem value="unknown">Unknown</SelectItem></SelectContent>
            </Select>
          ) : editingCell?.dealId===deal.id&&editingCell?.field==='sewerAvailable' ? (
            <Select value={cellEditValue} onValueChange={(value) => { setCellEditValue(value); const {dealId,field}=editingCell; const sv=value==='yes'?true:value==='no'?false:null; cellUpdateMutation.mutate({dealId,[field]:sv}); setEditingCell(null); setCellEditValue(''); }} open={true}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none" className="text-gray-500 italic">Clear Selection</SelectItem><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem><SelectItem value="unknown">Unknown</SelectItem></SelectContent>
            </Select>
          ) : (
            <div className="cursor-pointer hover:bg-gray-100" onClick={() => startCellEdit(deal.id,'sewerAvailable',deal.sewerAvailable===true?'yes':deal.sewerAvailable===false?'no':'none')}>
              {deal.sewerAvailable===true?<span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">Yes</span>:deal.sewerAvailable===false?<span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">No</span>:<span className="text-gray-400 italic text-xs">Click to add...</span>}
            </div>
          )}
        </td>
      );
      case 'brokerName': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingRow===deal.id||(editingCell?.dealId===deal.id&&editingCell?.field==='brokerName') ? (
            <div className="relative">
              <Input value={editingRow===deal.id?(`${editData.brokerFirstName||''} ${editData.brokerLastName||''}`.trim()||`${deal.broker?.firstName||''} ${deal.broker?.lastName||''}`.trim()):cellEditValue} onChange={(e) => { const fn=e.target.value; if(editingRow===deal.id){const ns=fn.split(' '); setEditData({...editData,brokerFirstName:ns[0]||'',brokerLastName:ns.slice(1).join(' ')||'',brokerId:''});}else{setCellEditValue(fn);} if(brokerSearchTimerRef.current)clearTimeout(brokerSearchTimerRef.current); if(fn.length>=2){brokerSearchTimerRef.current=setTimeout(async()=>{try{const r=await fetch(`/api/brokers/search?query=${encodeURIComponent(fn)}`); const data=await r.json(); setBrokerSuggestions(Array.isArray(data)?data:[]); setShowBrokerSuggestions(Array.isArray(data)&&data.length>0);}catch{setBrokerSuggestions([]);setShowBrokerSuggestions(false);}},220);}else{setBrokerSuggestions([]);setShowBrokerSuggestions(false);} }} onBlur={() => { setTimeout(()=>{ setShowBrokerSuggestions(false); if(editingCell?.dealId===deal.id&&editingCell?.field==='brokerName'){const ns=cellEditValue.split(' '); cellUpdateMutation.mutate({dealId:deal.id,brokerName:cellEditValue,brokerFirstName:ns[0]||'',brokerLastName:ns.slice(1).join(' ')||''}); setEditingCell(null); setCellEditValue(''); }},150); }} onKeyDown={(e) => { if(e.key==='Escape'){setShowBrokerSuggestions(false);setEditingCell(null);setCellEditValue('');return;} if(e.key==='Enter'&&!showBrokerSuggestions&&editingCell?.dealId===deal.id){const ns=cellEditValue.split(' '); cellUpdateMutation.mutate({dealId:deal.id,brokerName:cellEditValue,brokerFirstName:ns[0]||'',brokerLastName:ns.slice(1).join(' ')||''}); setEditingCell(null); setCellEditValue('');} }} className="h-8 text-xs" placeholder="Type to search CRM..." data-testid="input-broker-name" autoFocus={editingCell?.dealId===deal.id} />
              {showBrokerSuggestions&&brokerSuggestions.length>0&&(<div className="absolute top-full left-0 z-[200] mt-0.5 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">{brokerSuggestions.map((b: any) => { const nm=`${b.firstName||''} ${b.lastName||''}`.trim()||b.email||'(no name)'; return (<div key={b.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0" onMouseDown={(e) => { e.preventDefault(); setShowBrokerSuggestions(false); setBrokerSuggestions([]); if(editingRow===deal.id){setEditData({...editData,brokerFirstName:b.firstName||'',brokerLastName:b.lastName||'',brokerId:b.id,brokerEmail:b.email||''});}else{cellUpdateMutation.mutate({dealId:deal.id,brokerName:nm,brokerFirstName:b.firstName||'',brokerLastName:b.lastName||'',brokerId:b.id,brokerEmail:b.email||''});setEditingCell(null);setCellEditValue('');} }}><div className="text-xs font-semibold text-gray-800">{nm}</div>{b.email&&<div className="text-xs text-gray-400 truncate">{b.email}</div>}{b.brokerage&&<div className="text-xs text-gray-400 truncate">{b.brokerage}</div>}</div>); })}</div>)}
            </div>
          ) : (
            <div className="max-w-[140px] truncate cursor-pointer hover:bg-gray-100 px-1 rounded" onClick={() => startCellEdit(deal.id,'brokerName',`${deal.broker?.firstName||''} ${deal.broker?.lastName||''}`.trim())} title={deal.broker?.firstName||deal.broker?.lastName?'Click to edit broker name':'Click to add broker name'}>
              {deal.broker?.firstName||deal.broker?.lastName?`${deal.broker?.firstName||''} ${deal.broker?.lastName||''}`.trim():<span className="text-gray-400 italic text-xs">Click to add</span>}
            </div>
          )}
        </td>
      );
      case 'brokerEmail': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='brokerEmail' ? (
            <Input defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current=e.target.value; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Enter broker email" data-testid="input-broker-email" autoFocus />
          ) : (() => {
            const rawEmail=deal.broker?.email; const isTemp=rawEmail?.includes('@temp.landlinq.ai');
            const crmBroker=(!rawEmail||isTemp)&&deal.brokerId?brokers.find((b: any) => b.id===deal.brokerId):null;
            const crmEmail=crmBroker?.email?.includes('@temp.landlinq.ai')?null:crmBroker?.email||null;
            const displayEmail=(!rawEmail||isTemp)?crmEmail:rawEmail;
            return (<div className="max-w-[140px] truncate cursor-pointer hover:bg-gray-100 px-1 rounded" onClick={() => startCellEdit(deal.id,'brokerEmail',displayEmail||'')} title={displayEmail?'Click to edit':'Click to add email'}>{displayEmail||<span className="text-gray-400 italic text-xs">Click to add</span>}</div>);
          })()}
        </td>
      );
      case 'brokerPhone': return (
        <td key={key} className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: vis?'':'none'}}>
          {editingCell?.dealId===deal.id&&editingCell?.field==='brokerPhone' ? (
            <Input defaultValue={cellEditValue} onChange={(e) => { cellEditValueRef.current=e.target.value; }} onBlur={saveCellEdit} onKeyDown={handleCellKeyPress} className="h-8 text-xs" placeholder="Enter broker phone" data-testid="input-broker-phone" autoFocus />
          ) : (
            <div className="max-w-[100px] truncate cursor-pointer hover:bg-gray-100 px-1 rounded" onClick={() => startCellEdit(deal.id,'brokerPhone',deal.broker?.phone||'')} title={deal.broker?.phone?'Click to edit':'Click to add phone'}>
              {deal.broker?.phone||<span className="text-gray-400 italic text-xs">Click to add</span>}
            </div>
          )}
        </td>
      );
      default: return null;
    }
  };
  // ─── End column render helpers ─────────────────────────────────────────────

  return (
    <TooltipProvider>
      <SEO 
        title="Analyst Dashboard - Deal Management"
        description="LandLinq analyst dashboard for reviewing and managing land deals. Automated classification, comparable analysis, and comprehensive deal tracking for multifamily development."
        keywords="deal management, analyst dashboard, land deal review, property analysis, development tracking, deal classification"
        url="https://landlinq.ai/analyst-dashboard"
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
        <Navigation />
      
      <main className="pt-20 pb-16 px-4">
        <div className="max-w-[2200px] mx-auto">
          {/* Header */}
          <header className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#07172A] tracking-tight">
                  Analyst Dashboard
                </h1>
                <p className="text-base md:text-lg text-gray-600 mt-2">
                  Review, analyze, and manage incoming land deals with AI-powered insights
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  onClick={addNewDeal}
                  className="w-full sm:w-auto font-bold uppercase tracking-wider bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:border-[#4A90E2] transition-all duration-200"
                  data-testid="button-add-deal"
                >
                  <Plus size={16} className="mr-2" />
                  Add New Deal
                </Button>
                <div className="hidden lg:block">
                  <Button
                    onClick={() => exportToExcelMutation.mutate()}
                    disabled={exportToExcelMutation.isPending}
                    className="font-bold uppercase tracking-wider bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:border-[#4A90E2] transition-all duration-200"
                    data-testid="button-export-excel"
                  >
                    <Download size={16} className="mr-2" />
                    {exportToExcelMutation.isPending ? 'Exporting...' : 'Export CSV'}
                  </Button>
                </div>
                <div className="hidden lg:block">
                  <Button
                    onClick={() => {
                      autoYocProcessedRef.current.clear();
                      setYocRefreshing(true);
                      setYocRefreshKey(k => k + 1);
                    }}
                    disabled={yocRefreshing}
                    variant="outline"
                    className="font-bold uppercase tracking-wider border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all duration-200"
                    title="Recalculate Auto YOC for all deals using the current formula rules — does not re-fetch Hello Data"
                    data-testid="button-refresh-auto-yoc"
                  >
                    <RefreshCw size={16} className={`mr-2 ${yocRefreshing ? 'animate-spin' : ''}`} />
                    {yocRefreshing ? 'Recalculating…' : 'Refresh Auto YOC'}
                  </Button>
                </div>
                <div className="hidden lg:block relative">
                  <Button
                    onClick={() => backfillQctOzMutation.mutate()}
                    disabled={qctOzRunning}
                    variant="outline"
                    className="font-bold uppercase tracking-wider border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-800 transition-all duration-200"
                    title="Run QCT + OZ census tract lookup for all deals that are missing these values"
                  >
                    <RefreshCw size={16} className={`mr-2 ${qctOzRunning ? 'animate-spin' : ''}`} />
                    {qctOzRunning ? 'Running…' : 'Run QCT + OZ'}
                  </Button>
                  {qctOzResult && (
                    <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded shadow-lg p-2 text-xs text-gray-600 z-50 max-w-xs whitespace-normal">
                      {qctOzResult}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* API Safety System Status Banner */}
          <ApiSafetyBanner />

          {/* Quick Deal Addition */}
          {showQuickAddition && (
            <div className="mb-6">
              <QuickDealAddition defaultOpen={true} />
            </div>
          )}

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4 md:p-6">
              <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search deals, brokers, locations..."
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10 h-11"
                      data-testid="input-search-deals"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Table/Cards/Map Toggle */}
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-[#4A90E2] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        data-testid="toggle-table"
                      >
                        <Table2 className="h-3.5 w-3.5" />
                        Table
                      </button>
                      <button
                        onClick={() => setViewMode('cards')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border-x border-gray-300 transition-colors ${viewMode === 'cards' ? 'bg-[#4A90E2] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        data-testid="toggle-cards"
                      >
                        <List className="h-3.5 w-3.5" />
                        Pipeline
                      </button>
                      <button
                        onClick={() => setViewMode('map')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'map' ? 'bg-[#4A90E2] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        data-testid="toggle-map"
                      >
                        <Map className="h-3.5 w-3.5" />
                        Map
                      </button>
                    </div>

                    {/* Column Visibility Picker - only shown in table mode */}
                    {viewMode === 'table' && (
                      <Popover open={colPickerOpen} onOpenChange={setColPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium border-[#4A90E2] text-[#4A90E2] hover:bg-[#4A90E2] hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M3 21h18"/><rect x="10" y="6" width="4" height="12" rx="1" fill="currentColor" fillOpacity=".2"/></svg>
                            Columns
                            {visibleColumns.size < ALL_COLUMNS.length && (
                              <span className="ml-0.5 rounded-full bg-[#4A90E2] text-white text-[10px] px-1.5 py-0">{visibleColumns.size}/{ALL_COLUMNS.length}</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-72 p-3">
                          {/* Header row */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-700">Columns</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={sortColumnsAlphabetically}
                                className="text-[11px] text-gray-500 hover:text-[#4A90E2] hover:underline flex items-center gap-0.5"
                                title="Sort columns A→Z"
                              >
                                A→Z
                              </button>
                              <button onClick={resetColumns} className="text-[11px] text-[#4A90E2] hover:underline">Reset</button>
                            </div>
                          </div>

                          {/* Fixed columns (not draggable) */}
                          <div className="mb-1.5">
                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">Fixed</div>
                            <div className="space-y-0.5">
                              {FIXED_COLUMN_KEYS.map(key => {
                                const col = ALL_COLUMNS.find(c => c.key === key)!;
                                return (
                                  <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none group px-1">
                                    <Checkbox
                                      checked={visibleColumns.has(key)}
                                      onCheckedChange={() => toggleColumn(key)}
                                      className="h-3.5 w-3.5 opacity-60"
                                    />
                                    <span className="text-xs text-gray-400">{col.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <div className="border-t border-gray-100 mb-1.5" />

                          {/* Reorderable columns with drag handles */}
                          <div className="mb-1">
                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">Reorderable — drag to reorder</div>
                          </div>
                          <div className="space-y-0.5 max-h-64 overflow-y-auto pr-0.5">
                            {columnOrder.map((key, index) => {
                              const col = ALL_COLUMNS.find(c => c.key === key)!;
                              return (
                                <div
                                  key={key}
                                  className={`flex items-center gap-1 rounded px-0.5 py-0.5 transition-colors ${dragColIdx === index ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                                  draggable
                                  onDragStart={(e) => {
                                    setDragColIdx(index);
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', String(index));
                                  }}
                                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                    if (fromIndex === index) { setDragColIdx(null); return; }
                                    const newOrder = [...columnOrder];
                                    const [moved] = newOrder.splice(fromIndex, 1);
                                    newOrder.splice(index, 0, moved);
                                    saveColumnOrder(newOrder);
                                    setDragColIdx(null);
                                  }}
                                  onDragEnd={() => setDragColIdx(null)}
                                >
                                  <GripVertical size={12} className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0 flex-none" />
                                  <label className="flex items-center gap-1.5 cursor-pointer select-none flex-1 min-w-0">
                                    <Checkbox
                                      checked={visibleColumns.has(key)}
                                      onCheckedChange={() => toggleColumn(key)}
                                      className="h-3.5 w-3.5 shrink-0"
                                    />
                                    <span className="text-xs text-gray-700 truncate">{col.label}</span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Classification Multi-Select Dropdown */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`font-semibold transition-all duration-200 min-w-[140px] justify-between ${
                              filterClassifications.length > 0 
                                ? "bg-[#07172A] text-white border-[#07172A]" 
                                : "border-gray-300 text-gray-700"
                            }`}
                            data-testid="dropdown-classification-filter"
                          >
                            <span className="flex items-center gap-1">
                              <Filter className="h-3 w-3" />
                              Status {filterClassifications.length > 0 && `(${filterClassifications.length})`}
                            </span>
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                          <div className="space-y-1">
                            <div 
                              className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                              onClick={() => handleClassificationFilter("all")}
                            >
                              <Checkbox 
                                checked={filterClassifications.length === 0} 
                                className="pointer-events-none"
                              />
                              <span className="text-sm font-medium">All ({totalDeals || 0})</span>
                            </div>
                            <div 
                              className="flex items-center space-x-2 p-2 hover:bg-blue-50 rounded cursor-pointer"
                              onClick={() => handleClassificationFilter("unclassified")}
                            >
                              <Checkbox 
                                checked={filterClassifications.includes("unclassified")} 
                                className="pointer-events-none border-blue-600 data-[state=checked]:bg-blue-600"
                              />
                              <span className="text-sm font-medium text-blue-700">Unclassified ({underReviewCount})</span>
                            </div>
                            <div 
                              className="flex items-center space-x-2 p-2 hover:bg-green-50 rounded cursor-pointer"
                              onClick={() => handleClassificationFilter("green")}
                            >
                              <Checkbox 
                                checked={filterClassifications.includes("green")} 
                                className="pointer-events-none border-green-600 data-[state=checked]:bg-green-600"
                              />
                              <span className="text-sm font-medium text-green-700">Pursuing ({pursuingCount})</span>
                            </div>
                            <div 
                              className="flex items-center space-x-2 p-2 hover:bg-yellow-50 rounded cursor-pointer"
                              onClick={() => handleClassificationFilter("yellow")}
                            >
                              <Checkbox 
                                checked={filterClassifications.includes("yellow")} 
                                className="pointer-events-none border-yellow-600 data-[state=checked]:bg-yellow-600"
                              />
                              <span className="text-sm font-medium text-yellow-700">Reviewing ({reviewingCount})</span>
                            </div>
                            <div 
                              className="flex items-center space-x-2 p-2 hover:bg-red-50 rounded cursor-pointer"
                              onClick={() => handleClassificationFilter("red")}
                            >
                              <Checkbox 
                                checked={filterClassifications.includes("red")} 
                                className="pointer-events-none border-red-600 data-[state=checked]:bg-red-600"
                              />
                              <span className="text-sm font-medium text-red-700">Passed ({passedCount})</span>
                            </div>
                            <div 
                              className="flex items-center space-x-2 p-2 hover:bg-orange-50 rounded cursor-pointer"
                              onClick={() => handleClassificationFilter("pending_address")}
                            >
                              <Checkbox 
                                checked={filterClassifications.includes("pending_address")} 
                                className="pointer-events-none border-orange-500 data-[state=checked]:bg-orange-500"
                              />
                              <span className="text-sm font-medium text-orange-600">Pending Address ({pendingAddressCount || 0})</span>
                            </div>
                            <div 
                              className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                              onClick={() => handleClassificationFilter("dead")}
                            >
                              <Checkbox 
                                checked={filterClassifications.includes("dead")} 
                                className="pointer-events-none border-gray-500 data-[state=checked]:bg-gray-500"
                              />
                              <span className="text-sm font-medium text-gray-600">Dead</span>
                            </div>
                            <div 
                              className="flex items-center space-x-2 p-2 hover:bg-purple-50 rounded cursor-pointer"
                              onClick={() => handleClassificationFilter("lost")}
                            >
                              <Checkbox 
                                checked={filterClassifications.includes("lost")} 
                                className="pointer-events-none border-purple-500 data-[state=checked]:bg-purple-500"
                              />
                              <span className="text-sm font-medium text-purple-600">Lost</span>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    {/* Priority Multi-Select Dropdown */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`font-semibold transition-all duration-200 min-w-[110px] justify-between ${
                            filterPriorities.length > 0 
                              ? "bg-gray-700 text-white border-gray-700" 
                              : "border-gray-300 text-gray-700"
                          }`}
                          data-testid="dropdown-priority-filter"
                        >
                          <span className="flex items-center gap-1">
                            Priority {filterPriorities.length > 0 && `(${filterPriorities.length})`}
                          </span>
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-2" align="start">
                        <div className="space-y-1">
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                            onClick={() => handlePriorityFilter("all")}
                          >
                            <Checkbox 
                              checked={filterPriorities.length === 0} 
                              className="pointer-events-none"
                            />
                            <span className="text-sm font-medium">All</span>
                          </div>
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-red-50 rounded cursor-pointer"
                            onClick={() => handlePriorityFilter("1")}
                          >
                            <Checkbox 
                              checked={filterPriorities.includes("1")} 
                              className="pointer-events-none border-red-500 data-[state=checked]:bg-red-500"
                            />
                            <span className="text-sm font-bold text-red-600">Priority 1</span>
                          </div>
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-orange-50 rounded cursor-pointer"
                            onClick={() => handlePriorityFilter("2")}
                          >
                            <Checkbox 
                              checked={filterPriorities.includes("2")} 
                              className="pointer-events-none border-orange-400 data-[state=checked]:bg-orange-400"
                            />
                            <span className="text-sm font-bold text-orange-500">Priority 2</span>
                          </div>
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-yellow-50 rounded cursor-pointer"
                            onClick={() => handlePriorityFilter("3")}
                          >
                            <Checkbox 
                              checked={filterPriorities.includes("3")} 
                              className="pointer-events-none border-yellow-400 data-[state=checked]:bg-yellow-400"
                            />
                            <span className="text-sm font-bold text-yellow-600">Priority 3</span>
                          </div>
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-lime-50 rounded cursor-pointer"
                            onClick={() => handlePriorityFilter("4")}
                          >
                            <Checkbox 
                              checked={filterPriorities.includes("4")} 
                              className="pointer-events-none border-lime-400 data-[state=checked]:bg-lime-400"
                            />
                            <span className="text-sm font-bold text-lime-600">Priority 4</span>
                          </div>
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-green-50 rounded cursor-pointer"
                            onClick={() => handlePriorityFilter("5")}
                          >
                            <Checkbox 
                              checked={filterPriorities.includes("5")} 
                              className="pointer-events-none border-green-500 data-[state=checked]:bg-green-500"
                            />
                            <span className="text-sm font-bold text-green-600">Priority 5</span>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                      
                    {/* Deal Type Multi-Select Dropdown */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`font-semibold transition-all duration-200 min-w-[90px] justify-between ${
                            filterDealTypes.length > 0 
                              ? "bg-sky-600 text-white border-sky-600" 
                              : "border-gray-300 text-gray-700"
                          }`}
                          data-testid="dropdown-dealtype-filter"
                        >
                          <span className="flex items-center gap-1">
                            Type {filterDealTypes.length > 0 && `(${filterDealTypes.length})`}
                          </span>
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-2" align="start">
                        <div className="space-y-1">
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                            onClick={() => handleDealTypeFilter("all")}
                          >
                            <Checkbox 
                              checked={filterDealTypes.length === 0} 
                              className="pointer-events-none"
                            />
                            <span className="text-sm font-medium">All</span>
                          </div>
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={() => handleDealTypeFilter("land")}
                          >
                            <Checkbox 
                              checked={filterDealTypes.includes("land")} 
                              className="pointer-events-none border-gray-500 data-[state=checked]:bg-gray-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Land</span>
                          </div>
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={() => handleDealTypeFilter("acquisition")}
                          >
                            <Checkbox 
                              checked={filterDealTypes.includes("acquisition")} 
                              className="pointer-events-none border-gray-500 data-[state=checked]:bg-gray-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Acquisition</span>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Apex Multi-Select Dropdown */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`font-semibold transition-all duration-200 min-w-[90px] justify-between ${
                            filterApex.length > 0 
                              ? "bg-indigo-600 text-white border-indigo-600" 
                              : "border-gray-300 text-gray-700"
                          }`}
                          data-testid="dropdown-apex-filter"
                        >
                          <span className="flex items-center gap-1">
                            Apex {filterApex.length > 0 && `(${filterApex.length})`}
                          </span>
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-2" align="start">
                        <div className="space-y-1">
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                            onClick={() => handleApexFilter("all")}
                          >
                            <Checkbox 
                              checked={filterApex.length === 0} 
                              className="pointer-events-none"
                            />
                            <span className="text-sm font-medium">All</span>
                          </div>
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-indigo-50 rounded cursor-pointer"
                            onClick={() => handleApexFilter("yes")}
                          >
                            <Checkbox 
                              checked={filterApex.includes("yes")} 
                              className="pointer-events-none border-indigo-600 data-[state=checked]:bg-indigo-600"
                            />
                            <span className="text-sm font-medium text-indigo-700">Apex</span>
                          </div>
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={() => handleApexFilter("no")}
                          >
                            <Checkbox 
                              checked={filterApex.includes("no")} 
                              className="pointer-events-none border-gray-500 data-[state=checked]:bg-gray-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Not Apex</span>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    
                    {/* Next Assignee Multi-Select Dropdown */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`font-semibold transition-all duration-200 min-w-[90px] justify-between ${
                            filterNextAssignees.length > 0 
                              ? "bg-gray-700 text-white border-gray-700" 
                              : "border-gray-300 text-gray-700"
                          }`}
                          data-testid="dropdown-next-filter"
                        >
                          <span className="flex items-center gap-1">
                            Next {filterNextAssignees.length > 0 && `(${filterNextAssignees.length})`}
                          </span>
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-2" align="start">
                        <div className="space-y-1">
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                            onClick={() => handleNextAssigneeFilter("all")}
                          >
                            <Checkbox 
                              checked={filterNextAssignees.length === 0} 
                              className="pointer-events-none"
                            />
                            <span className="text-sm font-medium">All</span>
                          </div>
                          {["AJ Klenk", "Austin Blondell", "Brian Ford", "Ian Wagoner", "Jack Berg", "John Bell", "Steve Hillebrand", "Ted Hill"].map((assignee) => (
                            <div 
                              key={assignee}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                              onClick={() => handleNextAssigneeFilter(assignee)}
                            >
                              <Checkbox 
                                checked={filterNextAssignees.includes(assignee)} 
                                className="pointer-events-none border-gray-500 data-[state=checked]:bg-gray-500"
                              />
                              <span className="text-sm font-medium text-gray-700">{assignee}</span>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    
                    {/* Deal Step Multi-Select Dropdown */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`font-semibold transition-all duration-200 min-w-[90px] justify-between ${
                            filterDealSteps.length > 0 
                              ? "bg-gray-700 text-white border-gray-700" 
                              : "border-gray-300 text-gray-700"
                          }`}
                          data-testid="dropdown-step-filter"
                        >
                          <span className="flex items-center gap-1">
                            Step {filterDealSteps.length > 0 && `(${filterDealSteps.length})`}
                          </span>
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-2" align="start">
                        <div className="space-y-1">
                          <div 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                            onClick={() => handleDealStepFilter("all")}
                          >
                            <Checkbox 
                              checked={filterDealSteps.length === 0} 
                              className="pointer-events-none"
                            />
                            <span className="text-sm font-medium">All</span>
                          </div>
                          {["Initial Analysis", "LOI", "Initial UW", "Full UW", "UW", "Call Broker/Owner", "UW - Reviewing"].map((step) => (
                            <div 
                              key={step}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                              onClick={() => handleDealStepFilter(step)}
                            >
                              <Checkbox 
                                checked={filterDealSteps.includes(step)} 
                                className="pointer-events-none border-gray-500 data-[state=checked]:bg-gray-500"
                              />
                              <span className="text-sm font-medium text-gray-700">{step}</span>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              
              {selectedDeals.length > 0 && (
                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300 mt-4 mb-4">
                  <span className="text-xs text-gray-600 font-medium">
                    {selectedDeals.length} selected:
                  </span>
                  <Button
                    onClick={() => handleBulkOperation('approve-all')}
                    disabled={bulkOperationMutation.isPending}
                    className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:border-[#4A90E2] rounded transition-all duration-200 flex items-center space-x-1"
                    data-testid="button-bulk-approve"
                  >
                    <CheckCircle className="h-3 w-3" />
                    <span>Approve</span>
                  </Button>
                  <Button
                    onClick={() => handleBulkOperation('review-all')}
                    disabled={bulkOperationMutation.isPending}
                    className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-yellow-600 text-white hover:bg-white hover:text-yellow-600 hover:border hover:border-yellow-600 rounded transition-all duration-200 flex items-center space-x-1"
                    data-testid="button-bulk-review"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Review</span>
                  </Button>
                  <Button
                    onClick={() => handleBulkOperation('reject-all')}
                    disabled={bulkOperationMutation.isPending}
                    className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-red-600 text-white hover:bg-white hover:text-red-600 hover:border hover:border-red-600 rounded transition-all duration-200 flex items-center space-x-1"
                    data-testid="button-bulk-reject"
                  >
                    <XCircle className="h-3 w-3" />
                    <span>Reject</span>
                  </Button>
                  <Button
                    onClick={() => handleBulkOperation('delete-all')}
                    disabled={bulkOperationMutation.isPending || !isAuthenticated}
                    className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-red-800 text-white hover:bg-white hover:text-red-800 hover:border hover:border-red-800 rounded transition-all duration-200 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="button-bulk-delete"
                    title={!isAuthenticated ? "Login required to delete deals" : "Delete selected deals"}
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </Button>
                  <Button
                    onClick={clearSelection}
                    className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-gray-600 text-white hover:bg-white hover:text-gray-600 hover:border hover:border-gray-600 rounded transition-all duration-200"
                    data-testid="button-clear-selection"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleBatchScore}
                    disabled={batchScoreMutation.isPending || selectedDeals.length === 0}
                    className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-[#07172A] text-white hover:bg-white hover:text-[#07172A] hover:border hover:border-[#07172A] rounded transition-all duration-200"
                    data-testid="button-batch-score"
                  >
                    {batchScoreMutation.isPending ? (
                      <>
                        <Activity className="animate-spin h-3 w-3 mr-1" />
                        Scoring...
                      </>
                    ) : (
                      <>
                        <Calculator size={12} className="mr-1" />
                        Score {selectedDeals.length} Deals
                      </>
                    )}
                  </Button>
                  {/* DEBUG: Test cellUpdateMutation */}
                  <Button
                    onClick={() => {
                      // Test cellUpdateMutation with first deal
                      const firstDeal = deals[0];
                      if (firstDeal) {
                        console.log('🧪 TESTING cellUpdateMutation with deal:', firstDeal.id);
                        cellUpdateMutation.mutate({
                          dealId: firstDeal.id,
                          analystNotes: `Test update - ${new Date().toISOString()}`
                        });
                      }
                    }}
                    disabled={cellUpdateMutation.isPending || deals.length === 0}
                    className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-purple-600 text-white hover:bg-white hover:text-purple-600 hover:border hover:border-purple-600 rounded transition-all duration-200"
                    data-testid="button-test-mutation"
                  >
                    {cellUpdateMutation.isPending ? (
                      <>
                        <Activity className="animate-spin h-3 w-3 mr-1" />
                        Testing...
                      </>
                    ) : (
                      <>
                        🧪 Test Mutation
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              <div className="lg:hidden mt-4 pt-3 border-t">
                <Button
                  onClick={() => exportToExcelMutation.mutate()}
                  disabled={exportToExcelMutation.isPending}
                  className="w-full h-11 font-bold uppercase tracking-wider bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:border-[#4A90E2] transition-all duration-200"
                  data-testid="button-export-excel-mobile"
                >
                  <Download size={16} className="mr-2" />
                  {exportToExcelMutation.isPending ? 'Exporting...' : 'Export CSV'}
                </Button>
              </div>
              </div>
            </CardContent>
          </Card>

          {/* Map View */}
          {viewMode === 'map' ? (
            <Card>
              <CardContent className="p-6">
                <DealOverviewMap
                    deals={deals}
                    onDealClick={() => {}}
                  />
              </CardContent>
            </Card>
          ) : viewMode === 'cards' ? (
          (() => {
            const pipelineGroups = [
              { keys: ['high_priority', 'green'], label: 'High Priority', accentColor: '#16a34a', lightBg: '#f0fdf4', badgeBg: '#dcfce7', badgeText: '#15803d', barColor: '#22c55e', dotColor: 'bg-emerald-500' },
              { keys: ['yellow', 'potential'],    label: 'Potential',     accentColor: '#ca8a04', lightBg: '#fefce8', badgeBg: '#fef9c3', badgeText: '#a16207', barColor: '#eab308', dotColor: 'bg-amber-400' },
              { keys: ['red', 'clear_no'],        label: 'Clear No',      accentColor: '#dc2626', lightBg: '#fff7f7', badgeBg: '#fee2e2', badgeText: '#b91c1c', barColor: '#ef4444', dotColor: 'bg-red-500' },
              { keys: ['unclassified', null, undefined, ''], label: 'Unclassified', accentColor: '#6b7280', lightBg: '#f9fafb', badgeBg: '#f3f4f6', badgeText: '#374151', barColor: '#9ca3af', dotColor: 'bg-gray-400' },
            ];

            // Search filter
            const searchLower = pipelineSearch.toLowerCase();
            const filteredDeals = pipelineSearch
              ? deals.filter(d =>
                  (d.address || '').toLowerCase().includes(searchLower) ||
                  (d.city || '').toLowerCase().includes(searchLower) ||
                  (d.state || '').toLowerCase().includes(searchLower) ||
                  (d.broker?.firstName || '').toLowerCase().includes(searchLower) ||
                  (d.broker?.lastName || '').toLowerCase().includes(searchLower) ||
                  String(d.dealNumber || '').includes(searchLower)
                )
              : deals;

            // Sort helper
            const sortDeals = (arr: DealWithBroker[]) => {
              return [...arr].sort((a, b) => {
                let av: any, bv: any;
                if (pipelineSort.col === 'createdAt') { av = new Date(a.createdAt || 0).getTime(); bv = new Date(b.createdAt || 0).getTime(); }
                else if (pipelineSort.col === 'units') { av = a.unitCount || 0; bv = b.unitCount || 0; }
                else if (pipelineSort.col === 'vintage') { av = a.vintage || 0; bv = b.vintage || 0; }
                else if (pipelineSort.col === 'rent') { av = Number(a.topRentPerUnit || 0); bv = Number(b.topRentPerUnit || 0); }
                else if (pipelineSort.col === 'price') { av = Number(a.askingPrice || 0); bv = Number(b.askingPrice || 0); }
                else if (pipelineSort.col === 'assignee') { av = a.nextAssignee || ''; bv = b.nextAssignee || ''; }
                else { av = 0; bv = 0; }
                if (av < bv) return pipelineSort.dir === 'asc' ? -1 : 1;
                if (av > bv) return pipelineSort.dir === 'asc' ? 1 : -1;
                return 0;
              });
            };

            const SortHeader = ({ col, label, className }: { col: string; label: string; className?: string }) => (
              <button
                onClick={() => setPipelineSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })}
                className={`flex items-center justify-end gap-0.5 text-[11px] font-semibold text-gray-400 hover:text-gray-700 uppercase tracking-wide transition-colors group/sort ${className || ''}`}
              >
                {label}
                <span className="ml-0.5 opacity-0 group-hover/sort:opacity-100 transition-opacity">
                  {pipelineSort.col === col ? (pipelineSort.dir === 'asc' ? '↑' : '↓') : '↕'}
                </span>
                {pipelineSort.col === col && <span className="text-[#4A90E2]">{pipelineSort.dir === 'asc' ? '↑' : '↓'}</span>}
              </button>
            );

            // Summary totals
            const totalDeals = filteredDeals.length;
            const hpCount = filteredDeals.filter(d => ['high_priority','green'].includes(d.classification as string)).length;
            const potCount = filteredDeals.filter(d => ['yellow','potential'].includes(d.classification as string)).length;
            const noCount  = filteredDeals.filter(d => ['red','clear_no'].includes(d.classification as string)).length;
            const unCount  = filteredDeals.filter(d => !d.classification || ['unclassified',''].includes(d.classification as string)).length;

            return (
              <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 240px)' }}>

                {/* Summary bar + search */}
                <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-white flex items-center gap-3 flex-wrap shrink-0">
                  {/* Summary chips */}
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <span className="text-xs text-gray-400 font-medium">{totalDeals} total</span>
                    <span className="h-3 w-px bg-gray-200" />
                    {[
                      { count: hpCount, label: 'High Priority', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                      { count: potCount, label: 'Potential', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                      { count: noCount, label: 'Clear No', color: 'text-red-600 bg-red-50 border-red-200' },
                      { count: unCount, label: 'Unclassified', color: 'text-gray-500 bg-gray-50 border-gray-200' },
                    ].map(({ count, label, color }) => (
                      <span key={label} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
                        {count} {label}
                      </span>
                    ))}
                  </div>
                  {/* Search */}
                  <div className="relative shrink-0">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input
                      type="text"
                      placeholder="Search deals…"
                      ref={pipelineSearchInputRef}
                      onChange={e => handlePipelineSearchChange(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-1 focus:ring-[#4A90E2] focus:border-[#4A90E2] bg-gray-50"
                    />
                    {pipelineSearch && (
                      <button onClick={clearPipelineSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Column headers */}
                <div className="flex items-center px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
                  <div className="w-2.5 shrink-0" />
                  <div className="flex-1 min-w-0 pl-3">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Deal / Address</span>
                  </div>
                  <div className="hidden lg:flex items-center gap-0 ml-auto shrink-0">
                    <span className="w-16 flex justify-end"><SortHeader col="units" label="Units" /></span>
                    <span className="w-20 flex justify-end"><SortHeader col="vintage" label="Vintage" /></span>
                    <span className="w-16 flex justify-end text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Acres</span>
                    <span className="w-20 flex justify-end text-[11px] font-semibold text-gray-400 uppercase tracking-wide">PSF</span>
                    <span className="w-28 flex justify-end"><SortHeader col="rent" label="Top Rent/Mo" /></span>
                    <span className="w-24 flex justify-end"><SortHeader col="price" label="Ask Price" /></span>
                    <span className="w-32 flex justify-end"><SortHeader col="assignee" label="Assignee" /></span>
                    <span className="w-20 shrink-0 flex justify-end"><SortHeader col="createdAt" label="Date" /></span>
                    <span className="w-24 shrink-0 ml-1 border-l border-gray-100" />
                  </div>
                </div>

                {/* Groups — scrollable */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {pipelineGroups.map((group) => {
                    const rawGroupDeals = filteredDeals.filter(d => (group.keys as any[]).includes(d.classification as any));
                    const groupDeals = sortDeals(rawGroupDeals);
                    const pct = totalDeals > 0 ? Math.round((rawGroupDeals.length / totalDeals) * 100) : 0;
                    const isCollapsed = collapsedGroups.has(group.label);

                    // Aggregate stats
                    const withUnits = groupDeals.filter(d => d.unitCount);
                    const withRent  = groupDeals.filter(d => d.topRentPerUnit);
                    const withPrice = groupDeals.filter(d => d.askingPrice);
                    const avgUnits = withUnits.length ? Math.round(withUnits.reduce((s,d) => s + Number(d.unitCount||0), 0) / withUnits.length) : null;
                    const avgRent  = withRent.length  ? Math.round(withRent.reduce((s,d) => s + Number(d.topRentPerUnit||0), 0) / withRent.length) : null;
                    const totalAsk = withPrice.length ? withPrice.reduce((s,d) => s + Number(d.askingPrice||0), 0) : null;

                    return (
                      <div key={group.label} className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                        {/* Group Header */}
                        <div
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none hover:brightness-95 transition-all"
                          style={{ background: group.lightBg, borderLeft: `4px solid ${group.accentColor}` }}
                          onClick={() => setCollapsedGroups(prev => {
                            const next = new Set(prev);
                            next.has(group.label) ? next.delete(group.label) : next.add(group.label);
                            return next;
                          })}
                        >
                          <svg className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} style={{ color: group.accentColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>

                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm font-bold text-gray-800">{group.label}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: group.badgeBg, color: group.badgeText }}>
                              {groupDeals.length}
                            </span>
                            {/* Inline aggregate stats */}
                            {!isCollapsed && (avgUnits || avgRent || totalAsk) && (
                              <span className="hidden sm:flex items-center gap-3 ml-2 text-[11px] text-gray-500">
                                {avgUnits && <span>avg <b className="text-gray-700">{avgUnits}</b> units</span>}
                                {avgRent  && <span>avg rent <b className="text-gray-700">${avgRent.toLocaleString()}</b></span>}
                                {totalAsk && <span>total ask <b className="text-gray-700">${(totalAsk/1000000).toFixed(1)}M</b></span>}
                              </span>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-gray-400 w-7 text-right">{pct}%</span>
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: group.barColor }} />
                            </div>
                          </div>
                        </div>

                        {/* Rows */}
                        {!isCollapsed && (
                          <div className="divide-y divide-gray-50">
                            {groupDeals.length === 0 && (
                              <div className="px-4 py-5 text-center text-xs text-gray-400 italic">
                                {pipelineSearch ? 'No matching deals in this category' : 'No deals in this category'}
                              </div>
                            )}
                            {groupDeals.map((deal) => (
                              <div
                                key={deal.id}
                                className="flex items-center gap-2 px-4 py-2.5 hover:bg-blue-50/40 transition-colors group cursor-pointer"
                                onClick={() => setPipelinePanel(deal)}
                              >
                                {/* Status dot */}
                                <div className={`w-2 h-2 rounded-full shrink-0 ${group.dotColor}`} />

                                {/* Address / name */}
                                <div className="flex-1 min-w-0 pl-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-gray-400 font-mono shrink-0">#{deal.dealNumber}</span>
                                    <span className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#07172A]">{deal.address || '—'}</span>
                                    {(deal as any).qctStatus === 'YES' && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold shrink-0">QCT</span>
                                    )}
                                    {(deal as any).ozStatus === 'YES' && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold shrink-0">OZ</span>
                                    )}
                                    {deal.priority && deal.priority !== 'normal' && deal.priority !== 'medium' && (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase shrink-0 ${deal.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {deal.priority}
                                      </span>
                                    )}
                                    {deal.dealStep && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#07172A] text-white font-semibold shrink-0">{deal.dealStep}</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-gray-400 truncate mt-0.5">
                                    {[deal.city, deal.state].filter(Boolean).join(', ')}
                                    {(deal as any).msaName && <span className="ml-1.5 text-gray-300">·</span>}
                                    {(deal as any).msaName && <span className="ml-1 text-blue-400 font-medium">{(deal as any).msaName}</span>}
                                    {deal.broker && <span className="ml-2 text-gray-400">· {deal.broker.firstName} {deal.broker.lastName}</span>}
                                  </div>
                                </div>

                                {/* Right-side metrics */}
                                <div className="hidden lg:flex items-center gap-0 ml-auto shrink-0" onClick={e => e.stopPropagation()}>
                                  <span className="w-16 text-right text-xs text-gray-600">
                                    {deal.unitCount ? <span className="font-semibold">{deal.unitCount.toLocaleString()}</span> : <span className="text-gray-300">—</span>}
                                  </span>
                                  <span className="w-20 text-right text-xs text-gray-600">
                                    {deal.vintage ? <span>{deal.vintage}</span> : <span className="text-gray-300">—</span>}
                                  </span>
                                  <span className="w-16 text-right text-xs text-gray-500">
                                    {deal.sizeAcres ? <span>{Number(deal.sizeAcres).toFixed(1)}ac</span> : <span className="text-gray-300">—</span>}
                                  </span>
                                  <span className="w-20 text-right text-xs">
                                    {deal.topRentPSF ? <span className="font-medium text-teal-700">${Number(deal.topRentPSF).toFixed(2)}</span> : <span className="text-gray-300">—</span>}
                                  </span>
                                  <span className="w-28 text-right text-xs">
                                    {deal.topRentPerUnit ? <span className="font-semibold text-emerald-700">${Math.round(Number(deal.topRentPerUnit)).toLocaleString()}</span> : <span className="text-gray-300">—</span>}
                                  </span>
                                  <span className="w-24 text-right text-xs">
                                    {deal.askingPrice ? <span className="font-semibold text-indigo-700">${(Number(deal.askingPrice)/1000000).toFixed(1)}M</span> : <span className="text-gray-300">—</span>}
                                  </span>
                                  <span className="w-32 text-right text-xs text-gray-500 truncate pl-2">
                                    {deal.nextAssignee
                                      ? <span className="font-medium">{deal.nextAssignee.split(' ')[0]}</span>
                                      : <span className="text-gray-300 italic text-[10px]">Unassigned</span>
                                    }
                                  </span>
                                  <span className="w-20 shrink-0 text-right text-[11px] text-gray-400">
                                    {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : ''}
                                  </span>
                                  {/* Actions — always-visible View, hover-reveal Edit */}
                                  <div className="w-24 shrink-0 flex items-center justify-end gap-1 pl-3 ml-1 border-l border-gray-100">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setPipelinePanel(deal); }}
                                      className="text-[11px] text-white bg-[#4A90E2] hover:bg-[#07172A] font-medium px-2.5 py-1 rounded transition-colors"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setViewMode('table'); setScrollToDealId(deal.id); setEditingRow(deal.id); }}
                                      className="text-[11px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 px-1.5 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                      title="Edit in Table"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>

                                {/* Mobile chevron */}
                                <div className="flex lg:hidden items-center shrink-0">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 group-hover:text-gray-500 transition-colors"><path d="M9 18l6-6-6-6"/></svg>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="h-4" />
                </div>
              </div>
            );
          })()
          
          ) : (
          <Card data-testid="table-view">
            <CardContent className="p-0 relative">
              <div 
                ref={tableContainerRef}
                className="table-scroll-container" 
                style={{
                  overflowX: 'auto',
                  overflowY: 'auto',
                  position: 'relative',
                  maxHeight: 'calc(100vh - 280px)',
                  minHeight: '500px',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <div style={{ display: 'inline-block', minWidth: '100%', paddingRight: '50px' }}>
                <table className="min-w-max" style={{ marginBottom: '10px' }}>
                    <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-30" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <tr>
                        <th className="text-left px-3 py-1 font-semibold text-xs text-gray-700 border-r border-gray-200 min-w-[40px] bg-gray-100 z-40 shadow-lg" style={{display: isVisible('id') ? '' : 'none', position: 'sticky', left: stickyLeft['id']}}>
                          <button
                            onClick={() => handleSort('dealNumber')}
                            className="flex items-center space-x-1 hover:text-[#07172A]"
                          >
                            <span>ID</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th className="text-left px-3 py-1 font-semibold text-xs text-gray-700 border-r border-gray-200 min-w-[50px] bg-gray-100 z-40 shadow-lg" style={{display: isVisible('colStatus') ? '' : 'none', position: 'sticky', left: stickyLeft['colStatus']}}>
                          <button
                            onClick={() => handleSort('classification')}
                            className="flex items-center space-x-1 hover:text-[#07172A]"
                          >
                            <span>Status</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th className="text-center px-1 py-1 font-semibold text-xs text-gray-700 border-r border-gray-200 min-w-[45px] bg-gray-100 z-40 shadow-lg" style={{display: isVisible('colApex') ? '' : 'none', position: 'sticky', left: stickyLeft['colApex']}}>
                          <span>Apex</span>
                        </th>
                        <th className="text-left px-2 py-1 font-semibold text-xs text-gray-700 border-r border-gray-200 min-w-[140px] bg-gray-100" style={{display: isVisible('colApexNotes') ? '' : 'none'}}>
                          <span>Apex Notes</span>
                        </th>
                        <th className="text-left px-3 py-1 font-semibold text-xs text-gray-700 border-r border-gray-200 min-w-[55px] bg-gray-100 z-40 shadow-lg" style={{display: isVisible('colPriority') ? '' : 'none', position: 'sticky', left: stickyLeft['colPriority']}}>
                          <button
                            onClick={() => handleSort('priority')}
                            className="flex items-center space-x-1 hover:text-[#07172A]"
                          >
                            <span>Priority</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        <th className="text-left px-3 py-1 font-semibold text-xs text-gray-700 border-r border-gray-200 min-w-[90px] bg-gray-100 z-40 shadow-lg" style={{display: isVisible('colNext') ? '' : 'none', position: 'sticky', left: stickyLeft['colNext']}}>
                          <span>Next</span>
                        </th>
                        <th className="text-left px-3 py-1 font-semibold text-xs text-gray-700 border-r border-gray-200 min-w-[100px] bg-gray-100 z-40 shadow-lg" style={{display: isVisible('colStep') ? '' : 'none', position: 'sticky', left: stickyLeft['colStep']}}>
                          <span>Step</span>
                        </th>
                        <th className="text-left px-3 py-1 font-semibold text-xs text-gray-700 border-r border-gray-200 min-w-[160px] bg-gray-100 z-40 shadow-lg" style={{display: isVisible('propertyAddress') ? '' : 'none', position: 'sticky', left: stickyLeft['propertyAddress']}}>
                          <button
                            onClick={() => handleSort('address')}
                            className="flex items-center space-x-1 hover:text-[#07172A]"
                          >
                            <span>Property Address</span>
                            <ArrowUpDown size={12} />
                          </button>
                        </th>
                        {/* Dynamic reorderable columns */}
                        {columnOrder.map(k => renderHeaderCell(k))}
                        <th className="text-center px-1 py-1 font-semibold text-xs text-gray-700 min-w-[60px]">
                          <span>Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Loading State - only show when no cached data */}
                      {isLoading && (
                        <tr>
                          <td colSpan={34} className="p-8 text-center text-gray-500">
                            <div className="flex items-center justify-center space-x-2">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#4A90E2]"></div>
                              <span>Loading deals...</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      {/* Subtle loading indicator for pagination while showing cached data */}
                      {isFetching && !isLoading && (
                        <tr>
                          <td colSpan={34} className="p-0">
                            <div className="w-full h-1 bg-gray-100 overflow-hidden">
                              <div className="h-full bg-[#4A90E2] animate-pulse"></div>
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      {/* Add New Deal Row (when editing) */}
                      {!isLoading && editingRow === 'new-deal-temp' && (
                        <tr className="bg-blue-50 border-b border-blue-200">
                          <td className="px-1 py-1 text-xs border-r border-gray-200 sticky left-0 bg-blue-50 z-10 shadow-lg">
                            <div className="w-4 h-4 bg-blue-400 rounded"></div>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 sticky left-[40px] bg-blue-50 z-10 shadow-lg">
                            <Select 
                              value={editData.classification || ''} 
                              onValueChange={(value) => {
                                setEditData({...editData, classification: value});
                                if (value === 'red') {
                                  handleQuickClassification('new-deal-temp', value);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select classification..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unclassified">Unclassified</SelectItem>
                                <SelectItem value="green">Pursuing</SelectItem>
                                <SelectItem value="yellow">Reviewing</SelectItem>
                                <SelectItem value="red">Passed</SelectItem>
                                <SelectItem value="dead">Dead</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700 sticky left-[90px] bg-blue-50 z-10 shadow-lg">
                            <Input
                              value={editData.address || ''}
                              onChange={(e) => setEditData({...editData, address: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'address', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Property address..."
                            />
                            <Input
                              value={(editData as any).parcelId || ''}
                              onChange={(e) => setEditData({...editData, parcelId: e.target.value} as any)}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'parcelId', e.target.value)}
                              className="h-7 text-xs mt-0.5 bg-blue-50/80"
                              placeholder="Parcel ID (optional)"
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.propertyName || ''}
                              onChange={(e) => setEditData({...editData, propertyName: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'propertyName', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Property name..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Select 
                              value={(editData as any).dealType || 'land'} 
                              onValueChange={(value) => setEditData({...editData, dealType: value} as any)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Deal type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="land">Land</SelectItem>
                                <SelectItem value="acquisition">Acquisition</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.nextSteps || ''}
                              onChange={(e) => setEditData({...editData, nextSteps: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'nextSteps', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Next steps..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.assignedAnalyst || ''}
                              onChange={(e) => setEditData({...editData, assignedAnalyst: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'assignedAnalyst', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Analyst name..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.developer || ''}
                              onChange={(e) => setEditData({...editData, developer: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'assignedDeveloper', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Developer name..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.partner || ''}
                              onChange={(e) => setEditData({...editData, partner: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'assignedPartner', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Partner name..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Select 
                              value={Array.isArray(editData.productTypes) ? editData.productTypes[0] || '' : ''} 
                              onValueChange={(value) => {
                                // Update local state immediately for UI feedback
                                setEditData({...editData, productTypes: [value]});
                                
                                // Auto-save for new deals by immediately saving the entire deal
                                if (editingRow === 'new-deal-temp') {
                                  const newDealData = {
                                    dealId: 'new-deal-temp',
                                    isNewDeal: true,
                                    ...editData,
                                    productTypes: [value], // Use the new value
                                    // Convert string numbers back to numbers
                                    unitCount: editData.unitCount ? parseInt(editData.unitCount) : undefined,
                                    sizeAcres: editData.sizeAcres ? parseFloat(editData.sizeAcres) : undefined,
                                    yieldOnCost: editData.yieldOnCost || undefined,
                                    population55Plus5Mile: editData.population55Plus5Mile ? parseInt(editData.population55Plus5Mile) : undefined,
                                    income75Plus55Plus: editData.income75Plus55Plus ? parseInt(editData.income75Plus55Plus) : undefined,
                                  };
                                  
                                  // Only auto-save if we have the minimum required fields
                                  if (editData.address || editData.propertyName) {
                                    updateDealMutation.mutate(newDealData);
                                  }
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="lot">Lot</SelectItem>
                                <SelectItem value="btr">BTR</SelectItem>
                                <SelectItem value="conventional">Conventional</SelectItem>
                                <SelectItem value="active-adult">Active Adult</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="number"
                              value={editData.unitCount || ''}
                              onChange={(e) => setEditData({...editData, unitCount: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'unitCount', e.target.value)}
                              onKeyDown={(e) => handleRowEditKeyPress(e, 'new-deal-temp', 'unitCount', (e.target as HTMLInputElement).value)}
                              className="h-8 text-xs"
                              placeholder="Units..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="number"
                              value={editData.vintage || ''}
                              onChange={(e) => setEditData({...editData, vintage: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'vintage', e.target.value)}
                              onKeyDown={(e) => handleRowEditKeyPress(e, 'new-deal-temp', 'vintage', (e.target as HTMLInputElement).value)}
                              className="h-8 text-xs"
                              placeholder="Year..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="number"
                              step="0.1"
                              value={editData.sizeAcres || ''}
                              onChange={(e) => setEditData({...editData, sizeAcres: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'sizeAcres', e.target.value)}
                              onKeyDown={(e) => handleRowEditKeyPress(e, 'new-deal-temp', 'sizeAcres', (e.target as HTMLInputElement).value)}
                              className="h-8 text-xs"
                              placeholder="Acres..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700" style={{display: isVisible('netDevelopableAcres') ? '' : 'none'}}>
                            <Input
                              type="number"
                              step="0.1"
                              value={(editData as any).netDevelopableAcres || ''}
                              onChange={(e) => setEditData({...editData, netDevelopableAcres: e.target.value} as any)}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'netDevelopableAcres', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Net acres..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <div className="text-center text-xs text-gray-500">
                              {editData.unitCount && editData.sizeAcres && parseFloat(editData.sizeAcres) > 0 ? 
                                (parseInt(editData.unitCount) / parseFloat(editData.sizeAcres)).toFixed(1) 
                                : '--'}
                            </div>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Select 
                              value={editData.hasEntitlements ? 'with' : 'without'} 
                              onValueChange={(value) => setEditData({...editData, hasEntitlements: value === 'with'})}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="with">With Entitlements</SelectItem>
                                <SelectItem value="without">Without Entitlements</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="number"
                              value={editData.totalProjectCost || ''}
                              onChange={(e) => setEditData({...editData, totalProjectCost: e.target.value})}
                              onBlur={(e) => autoSaveField('new-deal-temp', 'totalProjectCost', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Price..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <div className="text-center text-xs text-gray-500">
                              {editData.totalProjectCost && editData.unitCount ? 
                                formatPrice((parseFloat(editData.totalProjectCost) / parseInt(editData.unitCount)).toString())
                                : '--'}
                            </div>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="number"
                              value={editData.topRentPSF || ''}
                              onChange={(e) => setEditData({...editData, topRentPSF: e.target.value})}
                              className="h-8 text-xs"
                              placeholder="Rent/unit..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="number"
                              step="0.01"
                              value={editData.projectedRentPerSF || ''}
                              onChange={(e) => setEditData({...editData, projectedRentPerSF: e.target.value})}
                              className="h-8 text-xs"
                              placeholder="Rent PSF..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="text"
                              value={editData.yieldOnCost || ''}
                              onChange={(e) => setEditData({...editData, yieldOnCost: e.target.value})}
                              className="h-8 text-xs"
                              placeholder="e.g. 8.5% or notes..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="text"
                              value={editData.irr || ''}
                              onChange={(e) => setEditData({...editData, irr: e.target.value})}
                              className="h-8 text-xs"
                              placeholder="e.g. 14.5%"
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Select 
                              value={editData.sewerAvailable ? 'yes' : 'no'} 
                              onValueChange={(value) => setEditData({...editData, sewerAvailable: value === 'yes'})}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="number"
                              value={editData.population55Plus5Mile || ''}
                              onChange={(e) => setEditData({...editData, population55Plus5Mile: e.target.value})}
                              className="h-8 text-xs"
                              placeholder="Population..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              type="number"
                              value={editData.income75Plus55Plus || ''}
                              onChange={(e) => setEditData({...editData, income75Plus55Plus: e.target.value})}
                              className="h-8 text-xs"
                              placeholder="Income..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.demographicsNotes || ''}
                              onChange={(e) => setEditData({...editData, demographicsNotes: e.target.value})}
                              className="h-8 text-xs"
                              placeholder="Demographics notes..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <div className="flex flex-col gap-1">
                              <Select 
                                value={editData.brokerId || ''} 
                                onValueChange={handleBrokerSelection}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select Existing Broker">
                                    {editData.brokerId 
                                      ? `${editData.brokerFirstName || ''} ${editData.brokerLastName || ''}`.trim() 
                                      : 'Select Existing Broker'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {brokers.map((broker: any) => (
                                    <SelectItem key={broker.id} value={broker.id}>
                                      {broker.firstName} {broker.lastName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="text-xs text-gray-500">or type new:</div>
                              <div className="flex gap-1">
                                <Input
                                  value={editData.brokerFirstName || ''}
                                  onChange={(e) => {
                                    setEditData({
                                      ...editData, 
                                      brokerFirstName: e.target.value,
                                      brokerId: '' // Clear selection when typing
                                    });
                                  }}
                                  className="h-8 text-xs"
                                  placeholder="First name"
                                />
                                <Input
                                  value={editData.brokerLastName || ''}
                                  onChange={(e) => {
                                    setEditData({
                                      ...editData, 
                                      brokerLastName: e.target.value,
                                      brokerId: '' // Clear selection when typing
                                    });
                                  }}
                                  className="h-8 text-xs"
                                  placeholder="Last name"
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.brokerEmail || ''}
                              onChange={(e) => setEditData({...editData, brokerEmail: e.target.value})}
                              className={`h-8 text-xs ${editData.brokerId ? 'bg-gray-50' : ''}`}
                              placeholder={editData.brokerId ? "Auto-populated" : "Broker email"}
                              readOnly={!!editData.brokerId}
                              title={editData.brokerId ? "Auto-populated from broker profile" : "Enter broker email"}
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.brokerPhone || ''}
                              onChange={(e) => setEditData({...editData, brokerPhone: e.target.value})}
                              className={`h-8 text-xs ${editData.brokerId ? 'bg-gray-50' : ''}`}
                              placeholder={editData.brokerId ? "Auto-populated" : "Broker phone"}
                              readOnly={!!editData.brokerId}
                              title={editData.brokerId ? "Auto-populated from broker profile" : "Enter broker phone"}
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.marketsCovered || ''}
                              onChange={(e) => setEditData({...editData, marketsCovered: e.target.value})}
                              className={`h-8 text-xs ${editData.brokerId ? 'bg-gray-50' : ''}`}
                              placeholder={editData.brokerId ? "Auto-populated" : "Markets covered"}
                              readOnly={!!editData.brokerId}
                              title={editData.brokerId ? "Auto-populated from broker profile" : "Enter markets covered"}
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <div className="text-center text-xs text-gray-500">New Deal</div>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <span className="text-gray-400 text-xs">No documents</span>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.analystNotes || ''}
                              onChange={(e) => setEditData({...editData, analystNotes: e.target.value})}
                              className="h-8 text-xs"
                              placeholder="Analyst notes..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <span className="text-xs text-gray-400">No comparables yet</span>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-gray-700">
                            <Input
                              value={editData.rejectionReason || ''}
                              onChange={(e) => setEditData({...editData, rejectionReason: e.target.value})}
                              className="h-8 text-xs"
                              placeholder="Why was this deal rejected..."
                            />
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-center">
                            <span className="text-xs text-gray-500">--</span>
                          </td>
                          <td className="px-1 py-1 text-xs border-r border-gray-200 text-center">
                            <span className="text-xs text-gray-500">--</span>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={saveNewDeal}
                                size="sm"
                                disabled={updateDealMutation.isPending}
                                className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                data-testid="button-save-new-deal"
                              >
                                <Save size={12} />
                              </Button>
                              <Button
                                onClick={cancelRowEdit}
                                size="sm"
                                variant="outline"
                                className="text-xs px-2 py-1"
                                data-testid="button-cancel-new-deal"
                              >
                                <X size={12} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      {/* Empty State Row when no deals and not loading */}
                      {!isLoading && filteredAndSortedDeals.length === 0 && editingRow !== 'new-deal-temp' && (
                        <tr className="border-b">
                          <td colSpan={34} className="p-8 text-center text-gray-500">
                            <div className="flex flex-col items-center space-y-4">
                              <FileText className="h-12 w-12 text-gray-400" />
                              <div>
                                <div className="font-semibold text-lg text-gray-600">No deals found</div>
                                <div className="text-sm text-gray-500">
                                  {searchQuery || filterClassifications.length > 0
                                    ? 'Try adjusting your filters or search terms'
                                    : 'Deals will appear here once brokers start submitting them'}
                                </div>
                              </div>
                              <Button
                                onClick={addNewDeal}
                                className="font-bold uppercase tracking-wider bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:border-[#4A90E2] transition-all duration-200"
                                data-testid="button-add-deal-empty-state"
                              >
                                <Plus size={16} className="mr-2" />
                                Add First Deal
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                      
                      {/* Regular Deal Rows */}
                      {!isLoading && filteredAndSortedDeals.map((deal: DealWithBroker) => (
                        <tr key={deal.id} id={`deal-${deal.id}`} className="border-b hover:bg-gray-50 transition-colors duration-150">
                          {/* 1. Deal ID - Click to copy search terms and open Outlook */}
                          <td className="px-1 py-1 text-xs border-r border-gray-200 bg-white z-10 shadow-lg" style={{display: isVisible('id') ? '' : 'none', position: 'sticky', left: stickyLeft['id']}}>
                            {(() => {
                              const searchString = buildOutlookSearchString(deal);
                              const dealId = deal.dealNumber ? formatDealNumber(deal.dealNumber) : 'N/A';
                              
                              // Click handler: copy search terms to clipboard and open Outlook
                              const handleOutlookClick = async (e: React.MouseEvent) => {
                                e.preventDefault();
                                
                                // Log for debugging
                                const brokerFullName = [deal.broker?.firstName, deal.broker?.lastName].filter(Boolean).join(' ');
                                console.group('📧 Outlook Search - Copy & Open');
                                console.log('Deal ID:', dealId);
                                console.log('Search String:', searchString);
                                console.log('Property Address:', deal.address);
                                console.log('Property Name:', deal.propertyName);
                                console.log('Broker Name:', brokerFullName);
                                console.log('Broker Email:', deal.broker?.email);
                                console.groupEnd();
                                
                                // Copy search string to clipboard
                                const copied = await copyToClipboard(searchString);
                                
                                if (copied) {
                                  toast({
                                    title: "Search copied to clipboard!",
                                    description: (
                                      <div className="space-y-2">
                                        <p className="text-sm">Paste in Outlook search box (Ctrl+V):</p>
                                        <code className="block text-xs bg-gray-100 p-2 rounded break-all">{searchString}</code>
                                      </div>
                                    ),
                                    duration: 8000,
                                  });
                                }
                                
                                // Open Outlook in new tab
                                window.open('https://outlook.office.com/mail', '_blank');
                              };
                              
                              if (searchString) {
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={handleOutlookClick}
                                        className="font-mono font-semibold text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                        data-testid={`link-deal-emails-${deal.id}`}
                                      >
                                        {dealId}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Copy search & open Outlook</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              }
                              
                              return (
                                <span
                                  className="font-mono font-semibold text-sm text-gray-700"
                                  data-testid={`text-deal-${deal.id}`}
                                >
                                  {dealId}
                                </span>
                              );
                            })()}
                          </td>
                          
                          {/* 2. Classification */}
                          <td className="px-1 py-1 text-xs border-r border-gray-200 bg-white z-10 shadow-lg" style={{display: isVisible('colStatus') ? '' : 'none', position: 'sticky', left: stickyLeft['colStatus']}}> 
                            {editingRow === deal.id ? (
                              <Select 
                                value={editData.classification || ''} 
                                onValueChange={(value) => {
                                  // Update local state for immediate UI feedback
                                  setEditData({...editData, classification: value});
                                  
                                  // Check for rejection dialog first
                                  if (value === 'red') {
                                    handleQuickClassification(deal.id, value);
                                    return; // Don't proceed with normal update, let rejection dialog handle it
                                  }
                                  
                                  // Clear any existing timeout for this deal+field
                                  const timeoutKey = `${deal.id}-classification-edit`;
                                  if (debouncedMutationRefs.current[timeoutKey]) {
                                    clearTimeout(debouncedMutationRefs.current[timeoutKey]);
                                  }
                                  
                                  // Set optimistic update immediately for UI responsiveness
                                  setOptimisticUpdates(prev => ({
                                    ...prev,
                                    [deal.id]: { ...prev[deal.id], classification: value }
                                  }));
                                  
                                  // Debounce the actual mutation call
                                  debouncedMutationRefs.current[timeoutKey] = setTimeout(() => {
                                    cellUpdateMutation.mutate({
                                      dealId: deal.id,
                                      classification: value
                                    });
                                    delete debouncedMutationRefs.current[timeoutKey];
                                  }, 300); // 300ms debounce
                                  
                                  // DON'T close the editing state - allow continued row editing
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select classification..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unclassified">Unclassified</SelectItem>
                                  <SelectItem value="green">Pursuing</SelectItem>
                                  <SelectItem value="yellow">Reviewing</SelectItem>
                                  <SelectItem value="red">Passed</SelectItem>
                                  <SelectItem value="dead">Dead</SelectItem>
                                  <SelectItem value="lost">Lost</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {/* Auto-save dropdown for classification - works outside editing mode */}
                                  <Select 
                                    value={deal.classification || ''} 
                                    onValueChange={(value) => {
                                      console.log('🎯 Auto-save classification change:', deal.id, value);
                                      
                                      // Check for rejection dialog first
                                      if (value === 'red') {
                                        handleQuickClassification(deal.id, value);
                                        return; // Don't proceed with normal update, let rejection dialog handle it
                                      }
                                      
                                      // Clear any existing timeout for this deal+field
                                      const timeoutKey = `${deal.id}-classification`;
                                      if (debouncedMutationRefs.current[timeoutKey]) {
                                        clearTimeout(debouncedMutationRefs.current[timeoutKey]);
                                      }
                                      
                                      // Set optimistic update immediately for UI responsiveness
                                      setOptimisticUpdates(prev => ({
                                        ...prev,
                                        [deal.id]: { ...prev[deal.id], classification: value }
                                      }));
                                      
                                      // Debounce the actual mutation call
                                      debouncedMutationRefs.current[timeoutKey] = setTimeout(() => {
                                        cellUpdateMutation.mutate({
                                          dealId: deal.id,
                                          classification: value
                                        });
                                        delete debouncedMutationRefs.current[timeoutKey];
                                      }, 300); // 300ms debounce
                                    }}
                                  >
                                    <SelectTrigger 
                                      className={`h-8 w-8 text-sm ${getClassificationColor(deal.classification || '')} border-2 font-bold rounded-md flex items-center justify-center p-0`}
                                      title={getClassificationLabel(deal.classification || '')}
                                    >
                                      <span className="flex items-center justify-center w-full">{getClassificationLetter(deal.classification || '')}</span>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unclassified">Unclassified</SelectItem>
                                      <SelectItem value="green">Pursuing</SelectItem>
                                      <SelectItem value="yellow">Reviewing</SelectItem>
                                      <SelectItem value="red">Passed</SelectItem>
                                      <SelectItem value="dead">Dead</SelectItem>
                                      <SelectItem value="lost">Lost</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {/* Public Listing Indicators */}
                                <div className="flex items-center gap-1" title={getPublicListingTooltip(deal)}>
                                  {getPriceComparisonBadge(deal.publicListings?.priceComparison)}
                                  {deal.publicListings?.requiresAnalystReview && (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs px-1 py-0.5">
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      Review
                                    </Badge>
                                  )}
                                  {deal.publicListings?.platformsFound?.length && deal.publicListings.platformsFound.length > 0 && (
                                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs px-1 py-0.5">
                                      <ExternalLink className="w-3 h-3 mr-1" />
                                      {deal.publicListings.platformsFound.length}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          
                          {/* 2b. Apex Checkbox */}
                          <td className="px-1 py-1 text-center border-r border-gray-200 bg-white z-10 shadow-lg" style={{display: isVisible('colApex') ? '' : 'none', position: 'sticky', left: stickyLeft['colApex']}}>
                            <input
                              type="checkbox"
                              checked={!!(optimisticUpdates[deal.id]?.apex !== undefined ? optimisticUpdates[deal.id].apex : deal.apex)}
                              onChange={() => {
                                const newVal = !(optimisticUpdates[deal.id]?.apex !== undefined ? optimisticUpdates[deal.id].apex : deal.apex);
                                setOptimisticUpdates(prev => ({ ...prev, [deal.id]: { ...prev[deal.id], apex: newVal } }));
                                cellUpdateMutation.mutate({ dealId: deal.id, apex: newVal });
                              }}
                              className="w-4 h-4 cursor-pointer accent-purple-600"
                              title={deal.apex ? 'Apex deal — uncheck to remove' : 'Mark as Apex deal'}
                            />
                          </td>

                          {/* 2c. Apex Notes - Popup like Analyst Notes */}
                          <td className="px-1 py-1 border-r border-gray-200" style={{display: isVisible('colApexNotes') ? '' : 'none'}}>
                            {(optimisticUpdates[deal.id]?.apexNotes !== undefined ? optimisticUpdates[deal.id].apexNotes : deal.apexNotes) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs flex items-center justify-center gap-1 transition-colors bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border border-[#4A90E2] hover:scale-100 transform-gpu"
                                onClick={() => setApexNotesModal({
                                  dealId: deal.id,
                                  address: deal.address || 'Property',
                                  notes: (optimisticUpdates[deal.id]?.apexNotes !== undefined ? optimisticUpdates[deal.id].apexNotes : deal.apexNotes) || '',
                                  isEditing: false
                                })}
                                data-testid={`button-view-apex-notes-${deal.id}`}
                              >
                                <FileText size={12} />
                                Notes
                              </Button>
                            ) : (
                              <div
                                className="text-gray-400 italic text-xs cursor-pointer px-1"
                                onClick={() => setApexNotesModal({
                                  dealId: deal.id,
                                  address: deal.address || 'Property',
                                  notes: '',
                                  isEditing: true
                                })}
                                data-testid={`button-add-apex-notes-${deal.id}`}
                              >
                                Click to add...
                              </div>
                            )}
                          </td>

                          {/* 3. Priority Dropdown - Sticky after Classification */}
                          <td className="px-1 py-1 text-xs border-r border-gray-200 bg-white z-10 shadow-lg" style={{display: isVisible('colPriority') ? '' : 'none', position: 'sticky', left: stickyLeft['colPriority']}}>
                            <Select 
                              value={deal.priority || ''} 
                              onValueChange={(value) => {
                                const newPriority = value === 'none' ? null : value;
                                setOptimisticUpdates(prev => ({
                                  ...prev,
                                  [deal.id]: { ...prev[deal.id], priority: newPriority }
                                }));
                                cellUpdateMutation.mutate({ dealId: deal.id, priority: newPriority });
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-[50px] px-1 font-bold bg-white text-gray-700">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-gray-500 italic">Clear</SelectItem>
                                <SelectItem value="1" className="bg-red-100 text-red-800 font-bold">1 - Urgent</SelectItem>
                                <SelectItem value="2" className="bg-orange-100 text-orange-800 font-bold">2 - High</SelectItem>
                                <SelectItem value="3" className="bg-yellow-100 text-yellow-800 font-bold">3 - Medium</SelectItem>
                                <SelectItem value="4" className="bg-lime-100 text-lime-800 font-bold">4 - Low</SelectItem>
                                <SelectItem value="5" className="bg-green-100 text-green-800 font-bold">5 - Backlog</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          
                          {/* 4. Next Assignee Dropdown - Sticky after Priority */}
                          <td className="px-1 py-1 text-xs border-r border-gray-200 bg-white z-10 shadow-lg" style={{display: isVisible('colNext') ? '' : 'none', position: 'sticky', left: stickyLeft['colNext']}}>
                            <Select 
                              value={deal.nextAssignee || ''} 
                              onValueChange={(value) => {
                                const newValue = value === 'none' ? null : value;
                                setOptimisticUpdates(prev => ({
                                  ...prev,
                                  [deal.id]: { ...prev[deal.id], nextAssignee: newValue }
                                }));
                                cellUpdateMutation.mutate({ dealId: deal.id, nextAssignee: newValue });
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-[100px] px-1">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-gray-500 italic">Clear</SelectItem>
                                <SelectItem value="AJ Klenk">AJ Klenk</SelectItem>
                                <SelectItem value="Austin Blondell">Austin Blondell</SelectItem>
                                <SelectItem value="Brian Ford">Brian Ford</SelectItem>
                                <SelectItem value="Ian Wagoner">Ian Wagoner</SelectItem>
                                <SelectItem value="Jack Berg">Jack Berg</SelectItem>
                                <SelectItem value="John Bell">John Bell</SelectItem>
                                <SelectItem value="Steve Hillebrand">Steve Hillebrand</SelectItem>
                                <SelectItem value="Ted Hill">Ted Hill</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          
                          {/* 5. Deal Step Dropdown - Sticky after Next */}
                          <td className="px-1 py-1 text-xs border-r border-gray-200 bg-white z-10 shadow-lg" style={{display: isVisible('colStep') ? '' : 'none', position: 'sticky', left: stickyLeft['colStep']}}>
                            <Select 
                              value={deal.dealStep || ''} 
                              onValueChange={(value) => {
                                const newValue = value === 'none' ? null : value;
                                setOptimisticUpdates(prev => ({
                                  ...prev,
                                  [deal.id]: { ...prev[deal.id], dealStep: newValue }
                                }));
                                cellUpdateMutation.mutate({ dealId: deal.id, dealStep: newValue });
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-[120px] px-1">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-gray-500 italic">Clear</SelectItem>
                                <SelectItem value="Initial Analysis">Initial Analysis</SelectItem>
                                <SelectItem value="LOI">LOI</SelectItem>
                                <SelectItem value="Initial UW">Initial UW</SelectItem>
                                <SelectItem value="Full UW">Full UW</SelectItem>
                                <SelectItem value="UW">UW</SelectItem>
                                <SelectItem value="Call Broker/Owner">Call Broker/Owner</SelectItem>
                                <SelectItem value="UW - Reviewing">UW - Reviewing</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          
                          {/* 6. Property Address - Sticky after Step */}
                          <td className="px-1 py-1 text-xs border-r border-gray-200 font-medium text-gray-900 bg-white z-10 shadow-lg" style={{display: isVisible('propertyAddress') ? '' : 'none', position: 'sticky', left: stickyLeft['propertyAddress'], maxWidth: '200px'}}>
                            {editingCell?.dealId === deal.id && editingCell?.field === 'address' ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  defaultValue={cellEditValue}
                                  onChange={(e) => { cellEditValueRef.current = e.target.value; }}
                                  onBlur={saveCellEdit}
                                  onKeyDown={handleCellKeyPress}
                                  className="h-8 text-xs flex-1"
                                  placeholder="Property address..."
                                  autoFocus
                                  data-testid={`input-edit-address-${deal.id}`}
                                />
                                <Button
                                  onClick={saveCellEdit}
                                  size="sm"
                                  className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-white"
                                  data-testid={`button-save-address-${deal.id}`}
                                >
                                  <Save size={14} />
                                </Button>
                                <Button
                                  onClick={() => {
                                    setEditingCell(null);
                                    setCellEditValue('');
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2"
                                  data-testid={`button-cancel-address-${deal.id}`}
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  className="text-left text-blue-600 hover:underline cursor-pointer flex-1"
                                  title="Click to view on Google Maps"
                                  onClick={() => {
                                    setViewMode('map');
                                  }}
                                  data-testid={`button-view-map-${deal.id}`}
                                >
                                  <div className="flex flex-col leading-tight">
                                    <span>
                                      {deal.address || (() => {
                                        const lat = deal.manualLatitude ?? deal.latitude;
                                        const lng = deal.manualLongitude ?? deal.longitude;
                                        return (lat && lng)
                                          ? `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}`
                                          : 'No address';
                                      })()}
                                    </span>
                                    <span>
                                      {[deal.city, deal.state, deal.zip].filter(Boolean).join(', ')}
                                    </span>
                                  </div>
                                </button>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditAddressDialog({
                                          dealId: deal.id,
                                          address: deal.address || '',
                                          city: deal.city || '',
                                          state: deal.state || '',
                                          zip: deal.zip || '',
                                          lat: String((deal as any).manualLatitude || (deal as any).latitude || ''),
                                          lng: String((deal as any).manualLongitude || (deal as any).longitude || ''),
                                        });
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 hover:bg-gray-200"
                                      data-testid={`button-edit-address-${deal.id}`}
                                    >
                                      <Edit size={14} className="text-gray-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit address</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </td>
                          
                          {/* Dynamic reorderable body cells */}
                          {columnOrder.map(k => renderBodyCell(deal, k))}
                          
                          {/* 34. Actions (Delete + Re-Run Analysis) */}
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {editingRow === deal.id ? (
                                <>
                                  <Button
                                    onClick={saveRowEdit}
                                    size="sm"
                                    disabled={updateDealMutation.isPending}
                                    className="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-white hover:border-blue-500 hover:text-blue-500 border border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    data-testid={`button-save-${deal.id}`}
                                  >
                                    <Save size={12} />
                                  </Button>
                                  <Button
                                    onClick={cancelRowEdit}
                                    size="sm"
                                    variant="outline"
                                    className="text-xs px-2 py-1"
                                    data-testid={`button-cancel-${deal.id}`}
                                  >
                                    <X size={12} />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {/* Extract UW from Excel — show when deal has uploaded Excel OR a SharePoint/OneDrive URL */}
                                  {((deal as any).excelModelUrl || (Array.isArray(deal.analystDocumentUrls) && deal.analystDocumentUrls.some((u: string) => /\.(xlsx|xls)$/i.test(u)))) && (
                                    <Button
                                      onClick={() => extractExcelUW(deal)}
                                      size="sm"
                                      variant="outline"
                                      disabled={extractingExcelId === deal.id}
                                      className={`text-xs px-2 py-1 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                        deal.projectedNOI && deal.totalProjectCost
                                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 hover:bg-emerald-100'
                                          : 'bg-white border-orange-400 text-orange-600 hover:bg-orange-50'
                                      }`}
                                      title={deal.projectedNOI && deal.totalProjectCost
                                        ? `UW extracted: NOI $${Number(deal.projectedNOI).toLocaleString(undefined,{maximumFractionDigits:0})} · TDC $${Number(deal.totalProjectCost).toLocaleString(undefined,{maximumFractionDigits:0})} — click to re-extract`
                                        : 'Extract UW numbers from analyst Excel'}
                                    >
                                      {extractingExcelId === deal.id ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <FileSpreadsheet size={12} />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    onClick={() => handleRerunAnalysis(deal.id)}
                                    size="sm"
                                    variant="outline"
                                    disabled={rerunningDealId !== null}
                                    className="text-xs px-2 py-1 bg-white border border-blue-500 text-blue-500 hover:bg-blue-50 hover:border-blue-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    data-testid={`button-rerun-analysis-${deal.id}`}
                                  >
                                    <RefreshCw size={12} className={`mr-1 ${rerunningDealId === deal.id ? 'animate-spin' : ''}`} />
                                    {rerunningDealId === deal.id ? 'Processing...' : 'RE-RUN'}
                                  </Button>
                                  <Button
                                    onClick={() => handleDeleteDeal(deal.id, deal.address || 'Unknown Address')}
                                    disabled={deleteDealMutation.isPending}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                                    title="Delete Deal"
                                    data-testid={`button-delete-${deal.id}`}
                                  >
                                    {deleteDealMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
            </CardContent>
          </Card>
          )}
          
          {/* Pagination Controls */}
          {totalDeals > 0 && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {pageSize === 9999
                      ? `Showing all ${totalDeals} deals`
                      : `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, totalDeals)} of ${totalDeals} deals`
                    }
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPrevPage}
                      onMouseEnter={handlePrevPageHover}
                      disabled={!hasPrevPage}
                      className="flex items-center space-x-1"
                      data-testid="button-prev-page"
                    >
                      <span>‹</span>
                      <span>Previous</span>
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = currentPage <= 3 
                          ? i + 1
                          : currentPage >= totalPages - 2
                          ? totalPages - 4 + i
                          : currentPage - 2 + i;
                        
                        if (pageNum > totalPages || pageNum < 1) return null;
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            className="w-8 h-8 p-0"
                            data-testid={`button-page-${pageNum}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      onMouseEnter={handleNextPageHover}
                      disabled={!hasNextPage}
                      className="flex items-center space-x-1"
                      data-testid="button-next-page"
                    >
                      <span>Next</span>
                      <span>›</span>
                    </Button>
                    
                    {/* Page Size Selector */}
                    <div className="flex items-center space-x-2 ml-4 border-l pl-4">
                      <span className="text-sm text-gray-600">Show:</span>
                      <Select
                        value={pageSize === 9999 ? "all" : pageSize.toString()}
                        onValueChange={(value) => {
                          setPageSize(value === "all" ? 9999 : Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[80px] h-8" data-testid="select-page-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Property Data Panel Modal */}
      {selectedDealForProperty && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSelectedDealForProperty(null)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Property Analysis - Deal {(() => {
                    const selectedDeal = deals?.find((d: any) => d.id === selectedDealForProperty);
                    return selectedDeal?.dealNumber ? formatDealNumber(selectedDeal.dealNumber) : 'N/A';
                  })()}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDealForProperty(null)}
                  className="text-gray-500 hover:text-gray-700"
                  data-testid="button-close-property-panel"
                >
                  <X size={20} />
                </Button>
              </div>
              <div className="p-6">
                <PropertyDataPanel
                  dealId={selectedDealForProperty}
                  address={deals?.find((d: any) => d.id === selectedDealForProperty)?.address || ''}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Dialog */}
      {showRejectionDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowRejectionDialog(null)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Reject Deal
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRejectionDialog(null)}
                    className="text-gray-400 hover:text-gray-600"
                    data-testid="button-close-rejection-dialog"
                  >
                    <X size={20} />
                  </Button>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Why doesn't this deal work?
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Address: {showRejectionDialog.dealAddress}
                    {showRejectionDialog.productTypes && showRejectionDialog.productTypes.length > 0 && (
                      <span className="ml-2 text-blue-600">
                        ({showRejectionDialog.productTypes.join(', ')})
                      </span>
                    )}
                  </p>
                  
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <FastTextarea
                    value={rejectionFeedback}
                    onChange={(val) => setRejectionFeedback(val)}
                    placeholder="Explain why this deal isn't suitable (e.g., cap rate too low, deferred maintenance concerns, wrong location, zoning issues, etc.)"
                    className="min-h-[100px] resize-none"
                    data-testid="textarea-rejection-reason"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Required: Provide a detailed explanation for rejecting this deal.
                  </p>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectionDialog(null)}
                    data-testid="button-cancel-rejection"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={submitRejection}
                    disabled={!rejectionFeedback.trim()}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    data-testid="button-submit-rejection"
                  >
                    Reject Deal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Deal Detail Slide-out Panel */}
      {pipelinePanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setPipelinePanel(null)}
          />
          {/* Slide-out drawer */}
          <div className="fixed top-0 right-0 h-full w-full max-w-[680px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {/* Classification badge */}
                  {(() => {
                    const cls = pipelinePanel.classification;
                    const cfg: Record<string, { label: string; color: string }> = {
                      green: { label: 'High Priority', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
                      high_priority: { label: 'High Priority', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
                      yellow: { label: 'Potential', color: 'bg-amber-100 text-amber-700 border border-amber-200' },
                      potential: { label: 'Potential', color: 'bg-amber-100 text-amber-700 border border-amber-200' },
                      red: { label: 'Clear No', color: 'bg-red-100 text-red-600 border border-red-200' },
                      clear_no: { label: 'Clear No', color: 'bg-red-100 text-red-600 border border-red-200' },
                    };
                    const c = cls ? (cfg[cls] ?? { label: 'Unclassified', color: 'bg-gray-100 text-gray-500 border border-gray-200' }) : { label: 'Unclassified', color: 'bg-gray-100 text-gray-500 border border-gray-200' };
                    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.color}`}>{c.label}</span>;
                  })()}
                  {pipelinePanel.qctStatus === 'YES' && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">QCT</span>
                  )}
                  {(pipelinePanel as any).ozStatus === 'YES' && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">OZ</span>
                  )}
                  {(pipelinePanel as any).ddaStatus === 'MDDA' && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">Metro DDA</span>
                  )}
                  {(pipelinePanel as any).ddaStatus === 'NMDDA' && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-300">Non-Metro DDA</span>
                  )}
                  {(pipelinePanel as any).nmtcStatus === 'YES' && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300">NMTC</span>
                  )}
                  {pipelinePanel.inTargetMarket && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Target Market</span>
                  )}
                </div>
                <h2 className="text-base font-bold text-[#07172A] leading-snug">{pipelinePanel.address}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {[pipelinePanel.city, pipelinePanel.state, pipelinePanel.zip].filter(Boolean).join(', ')}
                  {pipelinePanel.county ? ` · ${pipelinePanel.county} County` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setViewMode('table'); setScrollToDealId(pipelinePanel.id); setEditingRow(pipelinePanel.id); setPipelinePanel(null); }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setPipelinePanel(null)}
                  className="text-gray-400 hover:text-gray-700 transition-colors p-1"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Key Metrics row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Units', value: pipelinePanel.unitCount != null ? pipelinePanel.unitCount.toLocaleString() : '—' },
                  { label: 'Vintage', value: pipelinePanel.vintage ?? '—' },
                  { label: 'Acres', value: pipelinePanel.sizeAcres != null ? Number(pipelinePanel.sizeAcres).toFixed(2) : '—' },
                  { label: 'Ask Price', value: pipelinePanel.askingPrice != null ? `$${Number(pipelinePanel.askingPrice).toLocaleString()}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-[#07172A]">{String(value)}</p>
                  </div>
                ))}
              </div>

              {/* Rent Metrics */}
              {(pipelinePanel.topRentPerUnit != null || pipelinePanel.avgRentPerUnit != null || pipelinePanel.topRentPSF != null || pipelinePanel.avgRentPSF != null) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Rent Metrics</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Top Rent/Unit', value: pipelinePanel.topRentPerUnit != null ? `$${Number(pipelinePanel.topRentPerUnit).toLocaleString()}` : null },
                      { label: 'Avg Rent/Unit', value: pipelinePanel.avgRentPerUnit != null ? `$${Number(pipelinePanel.avgRentPerUnit).toLocaleString()}` : null },
                      { label: 'Top Rent PSF', value: pipelinePanel.topRentPSF != null ? `$${Number(pipelinePanel.topRentPSF).toFixed(2)}` : null },
                      { label: 'Avg Rent PSF', value: pipelinePanel.avgRentPSF != null ? `$${Number(pipelinePanel.avgRentPSF).toFixed(2)}` : null },
                    ].filter(m => m.value != null).map(({ label, value }) => (
                      <div key={label} className="bg-blue-50 rounded-lg px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400 mb-0.5">{label}</p>
                        <p className="text-sm font-bold text-blue-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Market & Location */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Market & Location</p>
                <div className="bg-gray-50 rounded-lg px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2">
                  {[
                    { label: 'MSA', value: pipelinePanel.msaName ?? '—' },
                    { label: 'Target Market', value: pipelinePanel.inTargetMarket ? 'Yes' : 'No' },
                    { label: 'QCT Status', value: pipelinePanel.qctStatus ?? '—' },
                    { label: 'OZ Status', value: (pipelinePanel as any).ozStatus ?? '—' },
                    { label: 'County', value: pipelinePanel.county ?? '—' },
                    { label: 'State', value: pipelinePanel.state ?? '—' },
                    { label: 'ZIP', value: pipelinePanel.zip ?? '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-xs font-semibold text-[#07172A] text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Affordable Housing Designations */}
              {(() => {
                const p = pipelinePanel as any;
                const hasDDA = p.ddaStatus && p.ddaStatus !== 'N/A';
                const hasOzEligible = p.ozEligible && p.ozEligible !== 'N/A' && p.ozEligible !== 'NO';
                const hasNMTC = p.nmtcStatus === 'YES';
                const lihtcNearby: any[] = Array.isArray(p.lihtcNearbyJson) ? p.lihtcNearbyJson : [];
                if (!hasDDA && !hasOzEligible && !hasNMTC && lihtcNearby.length === 0) return null;
                return (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Affordable Housing Designations</p>
                    <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 space-y-3">

                      {/* DDA */}
                      {hasDDA && (
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${p.ddaStatus === 'MDDA' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-teal-100 text-teal-700 border-teal-300'}`}>
                              {p.ddaStatus === 'MDDA' ? 'Metro DDA' : 'Non-Metro DDA'}
                            </span>
                            <span className="text-[11px] font-semibold text-green-800">30% LIHTC Basis Boost</span>
                          </div>
                          {p.ddaAreaName && (
                            <p className="text-[11px] text-green-700 mb-1">{p.ddaAreaName}</p>
                          )}
                          <div className="grid grid-cols-3 gap-2">
                            {p.ddaVlil != null && (
                              <div className="bg-white rounded px-2 py-1.5 border border-green-200">
                                <p className="text-[9px] font-semibold uppercase tracking-wide text-green-500 mb-0.5">VLIL</p>
                                <p className="text-xs font-bold text-green-800">${Number(p.ddaVlil).toLocaleString()}</p>
                              </div>
                            )}
                            {p.ddaLihtcMaxRent != null && (
                              <div className="bg-white rounded px-2 py-1.5 border border-green-200">
                                <p className="text-[9px] font-semibold uppercase tracking-wide text-green-500 mb-0.5">Max LIHTC Rent</p>
                                <p className="text-xs font-bold text-green-800">${Number(p.ddaLihtcMaxRent).toLocaleString()}</p>
                              </div>
                            )}
                            {p.ddaFmr != null && (
                              <div className="bg-white rounded px-2 py-1.5 border border-green-200">
                                <p className="text-[9px] font-semibold uppercase tracking-wide text-green-500 mb-0.5">FMR</p>
                                <p className="text-xs font-bold text-green-800">${Number(p.ddaFmr).toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* OZ Eligible */}
                      {hasOzEligible && (
                        <div className="flex items-start gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${p.ozEligible === 'CONTIGUOUS' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-orange-100 text-orange-700 border-orange-300'}`}>
                            {p.ozEligible === 'CONTIGUOUS' ? 'OZ Contiguous' : 'OZ LIC Eligible'}
                          </span>
                          <p className="text-[11px] text-green-700 leading-snug">Tract is OZ-eligible but not yet designated. Could qualify for Opportunity Zone investment if nominated.</p>
                        </div>
                      )}

                      {/* NMTC */}
                      {hasNMTC && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-300">NMTC</span>
                            <span className="text-[11px] font-semibold text-green-800">New Markets Tax Credit</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {p.nmtcAmount != null && (
                              <div className="bg-white rounded px-2 py-1.5 border border-green-200">
                                <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-500 mb-0.5">NMTC Amount</p>
                                <p className="text-xs font-bold text-blue-800">${(Number(p.nmtcAmount) / 1_000_000).toFixed(1)}M</p>
                              </div>
                            )}
                            {p.nmtcPurpose && (
                              <div className="bg-white rounded px-2 py-1.5 border border-green-200">
                                <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-500 mb-0.5">Purpose</p>
                                <p className="text-xs font-bold text-blue-800 truncate">{p.nmtcPurpose}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* LIHTC Nearby */}
                      {lihtcNearby.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-green-800 mb-1.5">LIHTC Projects Nearby ({lihtcNearby.length})</p>
                          <div className="space-y-1.5">
                            {lihtcNearby.slice(0, 3).map((proj: any, i: number) => (
                              <div key={i} className="bg-white rounded px-2.5 py-1.5 border border-green-200 flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-green-900 truncate">{proj.name || proj.projectName || 'LIHTC Project'}</p>
                                  {proj.units && <p className="text-[10px] text-green-600">{proj.units} units</p>}
                                </div>
                                {proj.distanceMeters != null && (
                                  <span className="text-[10px] text-green-500 shrink-0">{(proj.distanceMeters / 1609.34).toFixed(2)} mi</span>
                                )}
                              </div>
                            ))}
                            {lihtcNearby.length > 3 && (
                              <p className="text-[10px] text-green-500 pl-1">+{lihtcNearby.length - 3} more nearby projects</p>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })()}

              {/* Broker Info */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Broker</p>
                <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#07172A] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {pipelinePanel.broker?.name ? pipelinePanel.broker.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#07172A]">{pipelinePanel.broker?.name ?? '—'}</p>
                      {pipelinePanel.broker?.company && <p className="text-xs text-gray-500">{pipelinePanel.broker.company}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
                    {pipelinePanel.broker?.email && (
                      <div className="col-span-2 flex justify-between">
                        <span className="text-xs text-gray-500">Email</span>
                        <a href={`mailto:${pipelinePanel.broker.email}`} className="text-xs font-medium text-[#4A90E2] hover:underline truncate max-w-[220px]">{pipelinePanel.broker.email}</a>
                      </div>
                    )}
                    {pipelinePanel.broker?.phone && (
                      <div className="col-span-2 flex justify-between">
                        <span className="text-xs text-gray-500">Phone</span>
                        <a href={`tel:${pipelinePanel.broker.phone}`} className="text-xs font-medium text-[#07172A] hover:underline">{pipelinePanel.broker.phone}</a>
                      </div>
                    )}
                    {pipelinePanel.broker?.markets && pipelinePanel.broker.markets.length > 0 && (
                      <div className="col-span-2 flex justify-between gap-4">
                        <span className="text-xs text-gray-500 shrink-0">Markets</span>
                        <span className="text-xs text-[#07172A] text-right">{pipelinePanel.broker.markets.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assignment */}
              {(pipelinePanel.nextAssignee || pipelinePanel.dealStep || pipelinePanel.priority) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Assignment</p>
                  <div className="bg-gray-50 rounded-lg px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2">
                    {pipelinePanel.nextAssignee && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Assignee</span>
                        <span className="text-xs font-semibold text-[#07172A]">{pipelinePanel.nextAssignee}</span>
                      </div>
                    )}
                    {pipelinePanel.dealStep && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Step</span>
                        <span className="text-xs font-semibold text-[#07172A]">{pipelinePanel.dealStep}</span>
                      </div>
                    )}
                    {pipelinePanel.priority && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Priority</span>
                        <span className="text-xs font-semibold text-[#07172A] capitalize">{pipelinePanel.priority}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Product Types */}
              {pipelinePanel.productTypes && Array.isArray(pipelinePanel.productTypes) && (pipelinePanel.productTypes as string[]).length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Product Types</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(pipelinePanel.productTypes as string[]).map((pt: string) => (
                      <span key={pt} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#07172A] text-white">{pt}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis & Classification Reasoning */}
              {(pipelinePanel.aiExplanatoryNotes || pipelinePanel.rejectionReason) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">AI Analysis</p>
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-lg px-4 py-3">
                    <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
                      {pipelinePanel.aiExplanatoryNotes || pipelinePanel.rejectionReason}
                    </p>
                  </div>
                </div>
              )}

              {/* Analyst Notes */}
              {pipelinePanel.analystNotes && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Analyst Notes</p>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                    <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">{pipelinePanel.analystNotes}</p>
                  </div>
                </div>
              )}

              {/* Broker Notes */}
              {pipelinePanel.brokerNotes && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Broker Notes</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">{pipelinePanel.brokerNotes}</p>
                  </div>
                </div>
              )}

              {/* Comparables */}
              {(() => {
                const panelNotes = pipelinePanel.comparableNotes || '';
                const rawPanelCompsJson = (pipelinePanel as any).comparablesJson;
                let panelCompsJson: any[] | undefined;
                try {
                  const parsed = typeof rawPanelCompsJson === 'string' ? JSON.parse(rawPanelCompsJson) : rawPanelCompsJson;
                  panelCompsJson = Array.isArray(parsed) ? parsed : undefined;
                } catch { panelCompsJson = undefined; }
                const hasRealCompsJson = (panelCompsJson && panelCompsJson.length > 0) || false;
                const isOnlyAiPrefix = panelNotes.startsWith('SUBJECT PROPERTY:') &&
                  !panelNotes.includes('QUALIFIES') && !panelNotes.includes('Found ') &&
                  !panelNotes.includes('ALL CANDIDATES') && !hasRealCompsJson;
                const hasComparables = (panelNotes.trim().length > 0 && !isOnlyAiPrefix) || hasRealCompsJson;
                const panelProductTypes = Array.isArray((pipelinePanel as any).productTypes) ? (pipelinePanel as any).productTypes : (typeof (pipelinePanel as any).productTypes === 'string' ? [(pipelinePanel as any).productTypes] : []);
                return hasComparables ? (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Comparable Properties</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <ComparablesDisplay
                        notes={panelNotes}
                        comparablesJson={hasRealCompsJson ? panelCompsJson : undefined}
                        productType={panelProductTypes[0] as string | undefined}
                        dataAsOf={pipelinePanel.statusUpdatedAt}
                      />
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Demographics */}
              {pipelinePanel.demographicsNotes && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Demographics</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">{pipelinePanel.demographicsNotes}</p>
                  </div>
                </div>
              )}

              {/* Soil Survey (USDA NRCS) */}
              {(pipelinePanel.latitude || pipelinePanel.longitude) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
                    <span>🌱</span> Soil Survey
                  </p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <SoilDataDisplay
                      lat={pipelinePanel.latitude}
                      lng={pipelinePanel.longitude}
                      dealId={pipelinePanel.id}
                    />
                  </div>
                </div>
              )}

              {/* Ingestion / Parsing Notes */}
              {pipelinePanel.ingestionNotes && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Ingestion Notes</p>
                  <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                    <p className="text-xs leading-relaxed text-gray-500 whitespace-pre-wrap">{pipelinePanel.ingestionNotes}</p>
                  </div>
                </div>
              )}

              {/* Bottom spacer */}
              <div className="h-4" />
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-gray-100 px-6 py-3 bg-white flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-400">
                Submitted {pipelinePanel.createdAt ? new Date(pipelinePanel.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPipelinePanel(null)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { setViewMode('table'); setScrollToDealId(pipelinePanel.id); setEditingRow(pipelinePanel.id); setPipelinePanel(null); }}
                  className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-[#07172A] text-white hover:bg-[#0d2540] transition-colors"
                >
                  Edit Deal
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* HelloData Comparables Modal - Wide layout with side-by-side view */}
      <Dialog open={!!helloDataModal} onOpenChange={(open) => !open && setHelloDataModal(null)}>
        <DialogContent className="max-w-[95vw] lg:max-w-[1200px] max-h-[90vh] overflow-hidden" data-testid="dialog-hellodata">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {helloDataModal?.isError ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <FileText className="h-5 w-5 text-blue-500" />
              )}
              {helloDataModal?.isError ? 'API Error' : 'HelloData Comparables'}
            </DialogTitle>
            <DialogDescription>
              {[helloDataModal?.address, helloDataModal?.city, helloDataModal?.state, helloDataModal?.zip].filter(Boolean).join(', ')}
            </DialogDescription>
          </DialogHeader>
          
          {/* Side-by-side layout: Comps on LEFT, Map on RIGHT */}
          <div className="flex flex-col lg:flex-row gap-4 mt-4">
            {/* LEFT: Comparables List */}
            <div className="lg:w-[45%] flex flex-col">
              <div className={`rounded-lg p-4 overflow-y-auto max-h-[50vh] lg:max-h-[60vh] ${
                helloDataModal?.isError
                  ? 'bg-amber-50 border border-amber-300'
                  : 'bg-white border border-gray-200'
              }`}>
                <ComparablesDisplay 
                  notes={helloDataModal?.comparableNotes || ''} 
                  isError={helloDataModal?.isError}
                  subjectProperty={helloDataModal ? {
                    address: helloDataModal.address,
                    city: helloDataModal.city,
                    state: helloDataModal.state,
                    zip: helloDataModal.zip,
                    acres: helloDataModal.acres,
                    proposedUnits: helloDataModal.proposedUnits
                  } : undefined}
                  comparablesJson={helloDataModal?.comparablesJson}
                  productType={helloDataModal?.productType}
                  dataAsOf={helloDataModal?.statusUpdatedAt}
                />
              </div>
          
          {/* Dec 16, 2025: Simplified error handling with single button + location correction */}
          {helloDataModal?.isError && (
            <div className="mt-4 p-4 bg-[#4A90E2] border border-[#357ABD] rounded-lg">
              <p className="text-sm font-medium text-white mb-2">
                Find Nearby Comparables
              </p>
              <p className="text-xs text-white/90 mb-3">
                We'll search for comparables near this location using the best available coordinates.
              </p>
              
              {/* Single unified button - auto-fallback logic */}
              <Button
                onClick={async () => {
                  if (!helloDataModal?.dealId) return;
                  
                  // If no coordinates exist, first geocode to ZIP center, then search
                  if (!helloDataModal.latitude || !helloDataModal.longitude) {
                    try {
                      const response = await fetch(`/api/deals/${helloDataModal.dealId}/geocode-city-level`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          city: helloDataModal.city,
                          state: helloDataModal.state,
                          zip: helloDataModal.zip
                        })
                      });
                      const result = await response.json();
                      if (!result.success) {
                        toast({
                          title: "Location Error",
                          description: "Could not determine coordinates. Try setting location manually.",
                          variant: "destructive"
                        });
                        return;
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to geocode location",
                        variant: "destructive"
                      });
                      return;
                    }
                  }
                  
                  // Now run comparables search
                  await handleForceComparables(helloDataModal.dealId);
                  queryClient.invalidateQueries({ queryKey: ['/api/analyst/deals'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
                }}
                disabled={runningForceComparables}
                className="bg-white hover:bg-gray-100 text-[#4A90E2] font-semibold w-full"
                data-testid="button-force-comparables"
              >
                {runningForceComparables ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} className="mr-2" />
                    Find Comparables
                  </>
                )}
              </Button>
              
              {/* Location correction option */}
              <div className="mt-3 pt-3 border-t border-white/30">
                <p className="text-xs text-white/80 mb-2">
                  Pin in wrong location? New construction not in database?
                </p>
                <Button
                  onClick={() => setShowLocationPicker(true)}
                  variant="outline"
                  className="bg-white/10 border-white/40 text-white hover:bg-white/20 text-xs"
                  data-testid="button-correct-location"
                >
                  <MapPin size={12} className="mr-1" />
                  Set Correct Location on Map
                </Button>
              </div>
            </div>
          )}
            </div>
            
            {/* RIGHT: Map showing comparable locations */}
            <div className="lg:w-[55%] flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <h4 className="text-sm font-medium text-gray-700">Comparable Locations</h4>
              </div>
              {loadingComparableLocations ? (
                <div className="flex items-center justify-center h-[300px] lg:h-[450px] bg-gray-100 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-gray-600">Loading map...</span>
                </div>
              ) : comparableLocations && (comparableLocations.comparables.length > 0 || (comparableLocations.subjectLatitude && comparableLocations.subjectLongitude)) ? (
                <ComparablesMap
                  subjectLatitude={comparableLocations.subjectLatitude}
                  subjectLongitude={comparableLocations.subjectLongitude}
                  subjectAddress={comparableLocations.subjectAddress}
                  comparables={comparableLocations.comparables}
                  height="450px"
                />
              ) : (
                <div className="flex items-center justify-center h-[200px] bg-gray-100 rounded-lg text-gray-500 text-sm">
                  No location data available for map
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* NC OneMap Parcel Data Modal */}
      <Dialog open={!!ncOneMapModal} onOpenChange={(open) => !open && setNcOneMapModal(null)}>
        <DialogContent className="max-w-[95vw] lg:max-w-[900px] max-h-[90vh] overflow-y-auto" data-testid="dialog-nc-onemap">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-600 text-white text-[10px] font-bold">NC</span>
              NC Tax — Parcel & Tax Data
            </DialogTitle>
            <DialogDescription>
              {[ncOneMapModal?.address, ncOneMapModal?.city, ncOneMapModal?.state, ncOneMapModal?.zip].filter(Boolean).join(', ')}
              {ncOneMapModal?.county ? ` · ${ncOneMapModal.county.replace(/ County$/i, '').trim()} County` : ''}
            </DialogDescription>
          </DialogHeader>

          {ncParcelLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3" />
              <span className="text-sm text-gray-500">Querying NC OneMap…</span>
            </div>
          )}

          {!ncParcelLoading && ncParcelData && (
            <div className="space-y-5 mt-2">

              {/* County Tax Estimate */}
              {ncParcelData.millage && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-emerald-800 mb-3">County Tax Estimate</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">County Rate</p>
                      <p className="text-sm font-semibold">{ncParcelData.millage.countyRate.toFixed(4)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Muni Rate ({ncParcelData.millage.typicalMuni})</p>
                      <p className="text-sm font-semibold">{ncParcelData.millage.muniRate.toFixed(4)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Combined Rate</p>
                      <p className="text-sm font-semibold text-emerald-700">{ncParcelData.millage.totalRate.toFixed(4)}% per $100</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Est. RE Tax/Unit/Yr</p>
                      <p className="text-sm font-semibold text-emerald-700">
                        ${Math.round(ncParcelData.millage.totalRate * 1200).toLocaleString()}
                        <span className="text-xs font-normal text-gray-500 ml-1">(at $120k assessed)</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start justify-between mt-2 gap-3">
                    <p className="text-xs text-gray-500">Based on FY2025 published millage rates. Municipal rate reflects typical city within this county. Verify with county assessor for the specific municipality.</p>
                    {ncParcelData.millage.sourceUrl && (
                      <a
                        href={ncParcelData.millage.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-medium text-emerald-700 underline hover:text-emerald-900 whitespace-nowrap"
                      >
                        Verify rates ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Subject Parcel */}
              {ncParcelData.subject ? (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">Subject Parcel</h3>
                    {ncParcelData.millage?.searchUrl && (
                      <a
                        href={ncParcelData.millage.searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900 whitespace-nowrap"
                      >
                        Look up in county records ↗
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="text-sm font-medium">{ncParcelData.subject.siteadd || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">County</p>
                      <p className="text-sm font-medium">{ncParcelData.subject.cntyname || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Use Code</p>
                      <p className="text-sm font-medium">{ncParcelData.subject.parusecode} — {ncParcelData.subject.parusedesc || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">GIS Acres</p>
                      <p className="text-sm font-medium">{ncParcelData.subject.gisacres?.toFixed(2) || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Year Built</p>
                      <p className="text-sm font-medium">{ncParcelData.subject.structyear || 'Vacant/N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Last Sale</p>
                      <p className="text-sm font-medium">{ncParcelData.subject.saledatetx || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Land Value</p>
                      <p className="text-sm font-medium">${(ncParcelData.subject.landval || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Improvement Value</p>
                      <p className="text-sm font-medium">${(ncParcelData.subject.improvval || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Assessed Value</p>
                      <p className="text-sm font-semibold text-gray-900">${(ncParcelData.subject.parval || 0).toLocaleString()}</p>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <p className="text-xs text-gray-500">Owner</p>
                      <p className="text-sm font-medium">{ncParcelData.subject.ownname || '—'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">Subject parcel not found in NC OneMap — address may be too new or not yet indexed.</p>
                </div>
              )}

              {/* Nearby Multifamily Comps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Comparable Multifamily (2015+, {ncParcelData.county} County)
                  </h3>
                  {ncParcelData.millage?.searchUrl && (
                    <a
                      href={ncParcelData.millage.searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900 whitespace-nowrap"
                    >
                      Search {ncParcelData.county} County records ↗
                    </a>
                  )}
                </div>
                {ncParcelData.multifamilyComps && ncParcelData.multifamilyComps.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-gray-600">Address</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-600">Owner</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">Yr Built</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">GIS Acres</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">Land Value</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">Impr Value</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">Total Assessed</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">$/Acre</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ncParcelData.multifamilyComps.map((comp: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{comp.siteadd || '—'}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate">{comp.ownname || '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{comp.structyear || '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{comp.gisacres?.toFixed(1) || '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">${Math.round((comp.landval || 0) / 1000)}k</td>
                            <td className="px-3 py-2 text-right text-gray-700">${Math.round((comp.improvval || 0) / 1000)}k</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">${Math.round((comp.parval || 0) / 1000)}k</td>
                            <td className="px-3 py-2 text-right text-emerald-700 font-medium">
                              {comp.gisacres > 0 ? `$${Math.round((comp.parval || 0) / comp.gisacres / 1000)}k` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-500">No multifamily properties (2015+) found in {ncParcelData.county} County via NC OneMap.</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">
                Source: NC OneMap Integrated Cadastral Dataset · County assessor records · Tax amounts not available — use millage rate × assessed value above.
              </p>
            </div>
          )}

          {!ncParcelLoading && !ncParcelData && (
            <div className="py-8 text-center text-sm text-gray-500">No data returned from NC OneMap.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Broker Notes Modal (Dec 11, 2025) - View with Edit option */}
      <Dialog open={!!brokerNotesModal} onOpenChange={(open) => !open && setBrokerNotesModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden" data-testid="dialog-broker-notes">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Broker Notes
            </DialogTitle>
            <DialogDescription>
              {brokerNotesModal?.address}
            </DialogDescription>
          </DialogHeader>
          
          {brokerNotesModal && (
            <div className="mt-4 space-y-4">
              {brokerNotesModal.isEditing ? (
                <>
                  <FastTextarea
                    value={brokerNotesModal.notes}
                    onChange={(val) => setBrokerNotesModal({...brokerNotesModal, notes: val})}
                    className="min-h-[200px] resize-none"
                    placeholder="Add broker notes here..."
                    data-testid="textarea-broker-notes-modal"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-[#4A90E2] text-[#4A90E2] bg-white hover:bg-white"
                      onClick={() => setBrokerNotesModal({...brokerNotesModal, isEditing: false})}
                      data-testid="button-cancel-broker-notes"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#4A90E2] hover:bg-[#357ABD] text-white"
                      onClick={() => {
                        if (brokerNotesModal) {
                          cellUpdateMutation.mutate({
                            dealId: brokerNotesModal.dealId,
                            brokerNotes: brokerNotesModal.notes
                          });
                          setBrokerNotesModal(null);
                        }
                      }}
                      data-testid="button-save-broker-notes"
                    >
                      SAVE NOTES
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg p-4 overflow-y-auto max-h-[50vh] bg-blue-50 border border-blue-200">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-blue-800">
                      {brokerNotesModal.notes ? linkifyText(brokerNotesModal.notes) : 'No notes from broker'}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      className="bg-white text-[#4A90E2] border border-[#4A90E2] hover:bg-[#4A90E2] hover:text-white transition-all duration-200"
                      onClick={() => setBrokerNotesModal(null)}
                      data-testid="button-close-broker-notes"
                    >
                      Close
                    </Button>
                    <Button
                      className="bg-[#4A90E2] text-white border border-[#4A90E2] hover:bg-white hover:text-[#4A90E2] transition-all duration-200"
                      onClick={() => setBrokerNotesModal({...brokerNotesModal, isEditing: true})}
                      data-testid="button-edit-broker-notes"
                    >
                      <Edit size={14} className="mr-1" />
                      Edit Notes
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Analyst Notes Modal (Dec 11, 2025) - Read-only first with Edit button */}
      <Dialog open={!!analystNotesModal} onOpenChange={(open) => !open && setAnalystNotesModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden" data-testid="dialog-analyst-notes">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Analyst Notes
            </DialogTitle>
            <DialogDescription>
              {analystNotesModal?.address}
            </DialogDescription>
          </DialogHeader>
          
          {analystNotesModal && (
            <div className="mt-4 space-y-4">
              {analystNotesModal.isEditing ? (
                <>
                  <FastTextarea
                    value={analystNotesModal.notes}
                    onChange={(val) => setAnalystNotesModal({...analystNotesModal, notes: val})}
                    className="min-h-[200px] resize-none"
                    placeholder="Add your analysis notes here..."
                    data-testid="textarea-analyst-notes-modal"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-[#4A90E2] text-[#4A90E2] bg-white hover:bg-white"
                      onClick={() => setAnalystNotesModal({...analystNotesModal, isEditing: false})}
                      data-testid="button-cancel-analyst-notes"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#4A90E2] hover:bg-[#357ABD] text-white"
                      onClick={() => {
                        if (analystNotesModal) {
                          cellUpdateMutation.mutate({
                            dealId: analystNotesModal.dealId,
                            analystNotes: analystNotesModal.notes
                          });
                          setAnalystNotesModal(null);
                        }
                      }}
                      data-testid="button-save-analyst-notes"
                    >
                      SAVE NOTES
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg p-4 overflow-y-auto max-h-[50vh] bg-blue-50 border border-blue-200">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-blue-800">
                      {analystNotesModal.notes ? linkifyText(analystNotesModal.notes) : 'No analyst notes yet'}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setAnalystNotesModal(null)}
                      data-testid="button-close-analyst-notes"
                    >
                      Close
                    </Button>
                    <Button
                      className="bg-[#4A90E2] hover:bg-[#357ABD] text-white hover:text-white"
                      onClick={() => setAnalystNotesModal({...analystNotesModal, isEditing: true})}
                      data-testid="button-edit-analyst-notes"
                    >
                      <Edit size={14} className="mr-1" />
                      Edit Notes
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deal Summary Modal */}
      <Dialog open={!!dealSummaryModal} onOpenChange={(open) => !open && setDealSummaryModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              IC Memo Summary
            </DialogTitle>
            <DialogDescription>
              {dealSummaryModal?.address}
            </DialogDescription>
          </DialogHeader>
          {dealSummaryModal && (
            <div className="mt-4 space-y-4">
              {dealSummaryModal.isEditing ? (
                <>
                  <textarea
                    value={dealSummaryModal.notes}
                    onChange={(e) => { dealSummaryEditRef.current = e.target.value; setDealSummaryModal(prev => prev ? {...prev, notes: e.target.value} : null); }}
                    className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    placeholder="Write the deal summary that will appear in the IC memo..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-[#4A90E2] text-[#4A90E2] bg-white hover:bg-white"
                      onClick={() => setDealSummaryModal({...dealSummaryModal, isEditing: false})}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#4A90E2] hover:bg-[#357ABD] text-white"
                      onClick={() => {
                        if (dealSummaryModal) {
                          cellUpdateMutation.mutate({
                            dealId: dealSummaryModal.dealId,
                            dealSummary: dealSummaryEditRef.current
                          });
                          setDealSummaryModal(null);
                        }
                      }}
                    >
                      SAVE SUMMARY
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg p-4 overflow-y-auto max-h-[50vh] bg-blue-50 border border-blue-200">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-blue-800">
                      {dealSummaryModal.notes ? linkifyText(dealSummaryModal.notes) : 'No summary yet'}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDealSummaryModal(null)}
                    >
                      Close
                    </Button>
                    <Button
                      className="bg-[#4A90E2] hover:bg-[#357ABD] text-white hover:text-white"
                      onClick={() => { dealSummaryEditRef.current = dealSummaryModal?.notes || ''; setDealSummaryModal({...dealSummaryModal!, isEditing: true}); }}
                    >
                      <Edit size={14} className="mr-1" />
                      Edit Summary
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wetland/Environmental Notes Modal */}
      <Dialog open={!!wetlandNotesModal} onOpenChange={(open) => !open && setWetlandNotesModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Wetland / Environmental Notes
            </DialogTitle>
            <DialogDescription>
              {wetlandNotesModal?.address}
            </DialogDescription>
          </DialogHeader>
          {wetlandNotesModal && (
            <div className="mt-4 space-y-4">
              {wetlandNotesModal.isEditing ? (
                <>
                  <FastTextarea
                    value={wetlandNotesModal.notes}
                    onChange={(val) => { wetlandNotesEditRef.current = val; setWetlandNotesModal(prev => prev ? {...prev, notes: val} : null); }}
                    className="min-h-[200px] resize-none"
                    placeholder="Enter wetland / environmental notes..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-[#4A90E2] text-[#4A90E2] bg-white hover:bg-white"
                      onClick={() => setWetlandNotesModal({...wetlandNotesModal, isEditing: false})}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#4A90E2] hover:bg-[#357ABD] text-white"
                      onClick={() => {
                        if (wetlandNotesModal) {
                          const textToSave = wetlandNotesEditRef.current !== '' ? wetlandNotesEditRef.current : wetlandNotesModal.notes;
                          cellUpdateMutation.mutate({
                            dealId: wetlandNotesModal.dealId,
                            wetlandNotes: textToSave
                          });
                          setWetlandNotesModal(null);
                        }
                      }}
                    >
                      SAVE NOTES
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg p-4 overflow-y-auto max-h-[50vh] bg-green-50 border border-green-200">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-green-900">
                      {wetlandNotesModal.notes ? linkifyText(wetlandNotesModal.notes) : 'No notes yet'}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setWetlandNotesModal(null)}
                    >
                      Close
                    </Button>
                    <Button
                      className="bg-[#4A90E2] hover:bg-[#357ABD] text-white hover:text-white"
                      onClick={() => { wetlandNotesEditRef.current = wetlandNotesModal?.notes || ''; setWetlandNotesModal({...wetlandNotesModal!, isEditing: true}); }}
                    >
                      <Edit size={14} className="mr-1" />
                      Edit Notes
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Apex Notes Modal */}
      <Dialog open={!!apexNotesModal} onOpenChange={(open) => !open && setApexNotesModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden" data-testid="dialog-apex-notes">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Apex Notes
            </DialogTitle>
            <DialogDescription>
              {apexNotesModal?.address}
            </DialogDescription>
          </DialogHeader>

          {apexNotesModal && (
            <div className="mt-4 space-y-4">
              {apexNotesModal.isEditing ? (
                <>
                  <FastTextarea
                    value={apexNotesModal.notes}
                    onChange={(val) => setApexNotesModal({...apexNotesModal, notes: val})}
                    className="min-h-[200px] resize-none"
                    placeholder="Add Apex notes here..."
                    data-testid="textarea-apex-notes-modal"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-[#4A90E2] text-[#4A90E2] bg-white hover:bg-white"
                      onClick={() => setApexNotesModal({...apexNotesModal, isEditing: false})}
                      data-testid="button-cancel-apex-notes"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#4A90E2] hover:bg-[#357ABD] text-white"
                      onClick={() => {
                        if (apexNotesModal) {
                          setOptimisticUpdates(prev => ({ ...prev, [apexNotesModal.dealId]: { ...prev[apexNotesModal.dealId], apexNotes: apexNotesModal.notes } }));
                          cellUpdateMutation.mutate({
                            dealId: apexNotesModal.dealId,
                            apexNotes: apexNotesModal.notes
                          });
                          setApexNotesModal(null);
                        }
                      }}
                      data-testid="button-save-apex-notes"
                    >
                      SAVE NOTES
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg p-4 overflow-y-auto max-h-[50vh] bg-purple-50 border border-purple-200">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-purple-800">
                      {apexNotesModal.notes ? linkifyText(apexNotesModal.notes) : 'No Apex notes yet'}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setApexNotesModal(null)}
                      data-testid="button-close-apex-notes"
                    >
                      Close
                    </Button>
                    <Button
                      className="bg-[#4A90E2] hover:bg-[#357ABD] text-white hover:text-white"
                      onClick={() => setApexNotesModal({...apexNotesModal, isEditing: true})}
                      data-testid="button-edit-apex-notes"
                    >
                      <Edit size={14} className="mr-1" />
                      Edit Notes
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Developer Notes Modal */}
      <Dialog open={!!developerNotesModal} onOpenChange={(open) => !open && setDeveloperNotesModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-amber-600" />
              Developer Notes
            </DialogTitle>
            <DialogDescription>
              {developerNotesModal?.address}
            </DialogDescription>
          </DialogHeader>

          {developerNotesModal && (
            <div className="mt-4 space-y-4">
              {developerNotesModal.isEditing ? (
                <>
                  <FastTextarea
                    value={developerNotesModal.notes}
                    onChange={(val) => setDeveloperNotesModal({...developerNotesModal, notes: val})}
                    className="min-h-[200px] resize-none"
                    placeholder="Add developer/broker notes here — separate from analyst review notes..."
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="border-amber-500 text-amber-600 bg-white hover:bg-white"
                      onClick={() => setDeveloperNotesModal({...developerNotesModal, isEditing: false})}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={() => {
                        if (developerNotesModal) {
                          cellUpdateMutation.mutate({
                            dealId: developerNotesModal.dealId,
                            developerNotes: developerNotesModal.notes
                          });
                          setDeveloperNotesModal(null);
                        }
                      }}
                    >
                      SAVE NOTES
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg p-4 overflow-y-auto max-h-[50vh] bg-amber-50 border border-amber-200">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-amber-900">
                      {developerNotesModal.notes || 'No developer notes yet'}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDeveloperNotesModal(null)}>
                      Close
                    </Button>
                    <Button
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={() => setDeveloperNotesModal({...developerNotesModal, isEditing: true})}
                    >
                      <Edit size={14} className="mr-1" />
                      Edit Notes
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Address Dialog - Complete Address Fields */}
      <Dialog open={!!editAddressDialog} onOpenChange={(open) => !open && setEditAddressDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" data-testid="dialog-edit-address">
          <DialogHeader>
            <DialogTitle>Edit Property Address</DialogTitle>
            <DialogDescription>
              Update address and optionally pin exact map coordinates
            </DialogDescription>
          </DialogHeader>
          
          {editAddressDialog && (
            <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
              <div className="space-y-2">
                <label className="text-sm font-medium">Street Address</label>
                <Input
                  value={editAddressDialog.address}
                  onChange={(e) => setEditAddressDialog({...editAddressDialog, address: e.target.value})}
                  placeholder="123 Main Street"
                  data-testid="input-dialog-address"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-medium">City</label>
                  <Input
                    value={editAddressDialog.city}
                    onChange={(e) => setEditAddressDialog({...editAddressDialog, city: e.target.value})}
                    placeholder="Charlotte"
                    data-testid="input-dialog-city"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <Input
                    value={editAddressDialog.state}
                    onChange={(e) => setEditAddressDialog({...editAddressDialog, state: e.target.value.toUpperCase()})}
                    placeholder="NC"
                    maxLength={2}
                    className="uppercase"
                    data-testid="input-dialog-state"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">ZIP Code</label>
                <Input
                  value={editAddressDialog.zip}
                  onChange={(e) => setEditAddressDialog({...editAddressDialog, zip: e.target.value})}
                  placeholder="28203"
                  maxLength={10}
                  data-testid="input-dialog-zip"
                />
              </div>

              <div className="border-t pt-4 space-y-2">
                <label className="text-sm font-medium">Coordinates <span className="text-gray-400 font-normal">(optional — overrides auto-geocoding)</span></label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Latitude</label>
                    <Input
                      value={editAddressDialog.lat}
                      onChange={(e) => setEditAddressDialog({...editAddressDialog, lat: e.target.value})}
                      placeholder="35.7796"
                      data-testid="input-dialog-lat"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Longitude</label>
                    <Input
                      value={editAddressDialog.lng}
                      onChange={(e) => setEditAddressDialog({...editAddressDialog, lng: e.target.value})}
                      placeholder="-78.6382"
                      data-testid="input-dialog-lng"
                    />
                  </div>
                </div>
                {(editAddressDialog.lat || editAddressDialog.lng) && (
                  <p className="text-xs text-blue-600">
                    Manual coordinates set — map pin will use these instead of geocoded values.{' '}
                    <button
                      type="button"
                      className="underline hover:text-blue-800"
                      onClick={() => setEditAddressDialog({...editAddressDialog, lat: '', lng: ''})}
                    >
                      Clear to use auto-geocoding
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setEditAddressDialog(null)}
              data-testid="button-cancel-address-dialog"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editAddressDialog) return;
                
                // Save all address fields + optional manual coordinates
                const payload: Record<string, any> = {
                  dealId: editAddressDialog.dealId,
                  address: editAddressDialog.address,
                  city: editAddressDialog.city,
                  state: editAddressDialog.state,
                  zip: editAddressDialog.zip,
                };
                // Only send coordinates if both are provided and valid numbers
                const latNum = parseFloat(editAddressDialog.lat);
                const lngNum = parseFloat(editAddressDialog.lng);
                if (!isNaN(latNum) && !isNaN(lngNum) && editAddressDialog.lat && editAddressDialog.lng) {
                  payload.manualLatitude = latNum.toString();
                  payload.manualLongitude = lngNum.toString();
                } else if (!editAddressDialog.lat && !editAddressDialog.lng) {
                  // Explicitly clear manual coordinates if both fields are empty
                  payload.manualLatitude = null;
                  payload.manualLongitude = null;
                }
                const dealId = editAddressDialog.dealId;
                setEditAddressDialog(null);

                cellUpdateMutation.mutate(payload, {
                  onSuccess: () => {
                    toast({
                      title: "Address Updated",
                      description: "Re-running comps with updated location…"
                    });
                    // Re-run analysis so comparables reflect the new address / coordinates
                    handleRerunAnalysis(dealId);
                  },
                  onError: () => {
                    toast({
                      title: "Save Failed",
                      description: "Could not update address — please try again",
                      variant: "destructive"
                    });
                  }
                });
              }}
              className="bg-blue-600 hover:bg-white hover:text-[#4A90E2] hover:border hover:border-[#4A90E2] text-white transition-all"
              data-testid="button-save-address-dialog"
            >
              SAVE CHANGES
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Original Message Dialog (Email/SMS) - Styled like real email/SMS clients */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-hidden p-0" data-testid="dialog-original-message">
          {loadingEmail ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4A90E2]"></div>
              <p className="text-sm text-gray-600">Loading message...</p>
            </div>
          ) : selectedEmail?.channel === 'sms' ? (
            /* ==================== SMS STYLE ==================== */
            <div className="flex flex-col h-full" data-testid="message-content-container">
              {/* SMS Header - like iMessage */}
              <div className="bg-gradient-to-r from-gray-100 to-gray-50 border-b px-6 py-4 flex items-center space-x-3">
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-lg" data-testid="message-from">
                    {selectedEmail.phone || selectedEmail.phoneNumber || 'Unknown Number'}
                  </p>
                  <p className="text-sm text-gray-500">SMS Text Message</p>
                </div>
              </div>
              
              {/* SMS Chat Area - iMessage style */}
              <div className="flex-1 bg-gradient-to-b from-gray-100 to-gray-200 p-6 overflow-y-auto min-h-[300px]">
                <div className="flex justify-start mb-4">
                  <div className="max-w-[80%]">
                    {/* Incoming message bubble - iMessage gray style */}
                    <div className="bg-white rounded-3xl rounded-bl-lg px-5 py-3 shadow-sm">
                      <p className="text-gray-900 text-base whitespace-pre-wrap leading-relaxed" data-testid="message-body">
                        {selectedEmail.rawText || selectedEmail.message || selectedEmail.body || 'No message content'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 ml-3" data-testid="message-date">
                      {selectedEmail.createdAt ? formatDateEST.full(selectedEmail.createdAt) : 'Unknown time'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* SMS Footer */}
              <div className="bg-gray-100 border-t px-6 py-4">
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">
                    Technical Details
                  </summary>
                  <div className="mt-3 space-y-1.5 text-gray-600 pl-2">
                    <div><span className="font-medium">Message ID:</span> {selectedEmail.id}</div>
                    <div><span className="font-medium">Direction:</span> {selectedEmail.direction || 'inbound'}</div>
                    {selectedEmail.relatedDealId && (
                      <div><span className="font-medium">Deal ID:</span> {selectedEmail.relatedDealId}</div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          ) : selectedEmail ? (
            /* ==================== OUTLOOK EMAIL STYLE ==================== */
            <div className="flex flex-col h-full" data-testid="message-content-container">
              {/* Outlook-style Blue Header Bar */}
              <div className="bg-[#0078D4] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z"/>
                  </svg>
                  <span className="text-white font-semibold text-base">Message</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-white/80 text-sm" data-testid="message-date">
                    {selectedEmail.createdAt ? formatDateEST.full(selectedEmail.createdAt) : ''}
                  </span>
                  <button
                    onClick={() => setEmailModalOpen(false)}
                    className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                    data-testid="button-close-email-modal"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>
              
              {/* Outlook-style Header Fields */}
              <div className="bg-[#F3F2F1] border-b border-gray-300">
                {/* From Row */}
                <div className="flex items-start px-4 py-2 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-600 w-16 flex-shrink-0 pt-0.5">From:</span>
                  <div className="flex-1">
                    <span className="text-sm text-gray-900 font-medium" data-testid="message-from">
                      {selectedEmail.email || 'Unknown Sender'}
                    </span>
                  </div>
                </div>
                
                {/* To Row */}
                <div className="flex items-start px-4 py-2 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-600 w-16 flex-shrink-0 pt-0.5">To:</span>
                  <span className="text-sm text-gray-700">deals@catalyst.landlinq.ai</span>
                </div>
                
                {/* Subject Row */}
                <div className="flex items-start px-4 py-2.5 bg-white">
                  <span className="text-sm font-semibold text-gray-600 w-16 flex-shrink-0 pt-0.5">Subject:</span>
                  <span className="text-sm text-gray-900 font-semibold" data-testid="message-subject">
                    {selectedEmail.subject || '(No Subject)'}
                  </span>
                </div>
              </div>
              
              {/* Attachments Bar (Outlook-style, above body) */}
              {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div className="bg-[#F9F9F8] border-b border-gray-200 px-4 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {selectedEmail.attachments.map((attachment: any, idx: number) => {
                      const ext = attachment.filename?.split('.').pop()?.toLowerCase() || '';
                      return (
                        <a
                          key={idx}
                          href={attachment.downloadUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:bg-[#E8F4FD] hover:border-[#0078D4] hover:text-[#0078D4] transition-colors"
                          data-testid={`attachment-item-${idx}`}
                        >
                          <span className="font-medium uppercase text-[10px] text-gray-500">{ext || 'FILE'}</span>
                          <span className="truncate max-w-[150px]" data-testid={`attachment-filename-${idx}`}>{attachment.filename}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Email Body - Outlook white reading pane */}
              <div className="flex-1 overflow-y-auto bg-white min-h-[250px]">
                <div className="px-5 py-5">
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-[Segoe_UI,system-ui,sans-serif]" data-testid="message-body">
                    {(() => {
                      // If "View Raw" is enabled and we have originalRawText, show that directly
                      if (showRawEmail && selectedEmail.originalRawText) {
                        return (
                          <div className="bg-gray-50 border border-gray-200 rounded p-3 font-mono text-xs overflow-x-auto">
                            <div className="text-gray-500 text-[10px] mb-2 uppercase tracking-wide font-semibold">
                              Original Email (Raw MIME)
                            </div>
                            {selectedEmail.originalRawText}
                          </div>
                        );
                      }
                      
                      const content = selectedEmail.rawText || selectedEmail.message || selectedEmail.body || 'No message content available';
                      
                      // Check if content looks like raw MIME email (contains headers)
                      const hasMimeHeaders = /^(Received:|MIME-Version:|Content-Type:|boundary=|Message-Id:|X-|From:|To:|Subject:|Date:)/im.test(content);
                      
                      if (hasMimeHeaders) {
                        // Try to extract body after double newline (standard MIME separator)
                        const bodyMatch = content.match(/\r?\n\r?\n([\s\S]+)/);
                        if (bodyMatch) {
                          let body = bodyMatch[1];
                          // Remove remaining technical headers that might be in body
                          body = body
                            .replace(/^boundary=.*$/gim, '')
                            .replace(/^MIME-Version:.*$/gim, '')
                            .replace(/^Content-Type:.*$/gim, '')
                            .replace(/^Message-Id:.*$/gim, '')
                            .replace(/^X-[A-Za-z-]+:.*$/gim, '')
                            .replace(/^[\w-]+:\s*[a-zA-Z0-9=\/+;,.\-@<>() ]+$/gim, '')
                            .replace(/^\s*[\n\r]+/gm, '\n')
                            .trim();
                          if (body.length > 50) return body;
                        }
                        // Fallback: Just strip common header patterns
                        return content
                          .replace(/^Received:[\s\S]*?(?=\n[A-Z]|\n\n)/gim, '')
                          .replace(/^boundary=.*$/gim, '')
                          .replace(/^MIME-Version:.*$/gim, '')
                          .replace(/^Content-Type:.*$/gim, '')
                          .replace(/^Message-Id:.*$/gim, '')
                          .replace(/^X-[A-Za-z-]+:[\s\S]*?(?=\n[A-Z]|\n\n)/gim, '')
                          .replace(/^Subject:.*$/im, '')
                          .replace(/^From:.*$/im, '')
                          .replace(/^To:.*$/im, '')
                          .replace(/^Date:.*$/im, '')
                          .replace(/^\n+/g, '\n')
                          .trim() || 'Unable to parse email body';
                      }
                      
                      // Simple cleanup for non-MIME content
                      return content
                        .replace(/^Subject:.*\n?/im, '')
                        .replace(/^From:.*\n?/im, '')
                        .replace(/^To:.*\n?/im, '')
                        .replace(/^Date:.*\n?/im, '')
                        .replace(/^Attachments:.*$/im, '')
                        .replace(/^\n+/, '')
                        .trim() || 'No message content available';
                    })()}
                  </div>
                </div>
                
              </div>
              
              {/* Outlook-style Footer - Subtle info bar */}
              <div className="border-t bg-[#F3F2F1] px-4 py-2 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>ID: {selectedEmail.id?.slice(0, 8)}...</span>
                  <span className="text-gray-400">|</span>
                  <span>{selectedEmail.channel?.toUpperCase() || 'EMAIL'}</span>
                  {/* View Raw toggle - only show if originalRawText exists */}
                  {selectedEmail.originalRawText && (
                    <>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={() => setShowRawEmail(!showRawEmail)}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          showRawEmail 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        data-testid="toggle-raw-email"
                      >
                        {showRawEmail ? 'View Clean' : 'View Raw'}
                      </button>
                    </>
                  )}
                </div>
                <details className="relative">
                  <summary className="cursor-pointer hover:text-gray-700 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Details
                  </summary>
                  <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded shadow-lg p-3 min-w-[200px] z-10">
                    <div className="space-y-1 text-gray-600">
                      <div><span className="font-medium">Message ID:</span> {selectedEmail.id}</div>
                      <div><span className="font-medium">Channel:</span> {selectedEmail.channel?.toUpperCase()}</div>
                      <div><span className="font-medium">Direction:</span> {selectedEmail.direction || 'inbound'}</div>
                      <div><span className="font-medium">Status:</span> {selectedEmail.status || 'N/A'}</div>
                      {selectedEmail.relatedDealId && (
                        <div><span className="font-medium">Deal ID:</span> {selectedEmail.relatedDealId}</div>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <p className="text-sm text-gray-600">No message data available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Deal Submission Details Modal */}
      <Dialog open={quickDealModalOpen} onOpenChange={setQuickDealModalOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto" data-testid="dialog-quick-deal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={20} className="text-purple-600" />
              Deal Submission Details
            </DialogTitle>
            <DialogDescription>
              Deal #{selectedQuickDeal?.dealNumber ? formatDealNumber(selectedQuickDeal.dealNumber) : 'N/A'} - {selectedQuickDeal?.submissionMethod === 'analyst_quick_add' ? 'Quick add by analyst' : 'Manual submission'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedQuickDeal && (
            <div className="space-y-4 mt-4">
              {/* Submission Info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                  <FileText size={16} />
                  Submission Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Submitted:</span>
                    <span className="ml-2 text-gray-800">
                      {selectedQuickDeal.createdAt ? new Date(selectedQuickDeal.createdAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Method:</span>
                    <span className="ml-2 text-gray-800 capitalize">{selectedQuickDeal.submissionMethod || 'Manual'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Classification:</span>
                    <span className={`ml-2 capitalize font-medium ${
                      selectedQuickDeal.classification === 'green' ? 'text-green-600' :
                      selectedQuickDeal.classification === 'yellow' ? 'text-yellow-600' :
                      selectedQuickDeal.classification === 'red' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {selectedQuickDeal.classification || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Property Details - Enhanced */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Building size={16} />
                  Property Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex">
                    <span className="text-gray-500 w-28">Property Name:</span>
                    <span className="text-gray-800 flex-1">{selectedQuickDeal.propertyName || 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">Address:</span>
                    <span className="text-gray-800 flex-1">{selectedQuickDeal.address || 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">City:</span>
                    <span className="text-gray-800 flex-1">{(selectedQuickDeal as any).city || 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">State:</span>
                    <span className="text-gray-800 flex-1">{(selectedQuickDeal as any).state || 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">ZIP:</span>
                    <span className="text-gray-800 flex-1">{(selectedQuickDeal as any).zip || 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">County:</span>
                    <span className="text-gray-800 flex-1">{(selectedQuickDeal as any).county || 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">Acreage:</span>
                    <span className="text-gray-800 flex-1">{selectedQuickDeal.sizeAcres ? `${selectedQuickDeal.sizeAcres} acres` : 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">Unit Count:</span>
                    <span className="text-gray-800 flex-1">{selectedQuickDeal.unitCount || 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">Asking Price:</span>
                    <span className="text-gray-800 flex-1">{selectedQuickDeal.askingPrice ? `$${Number(selectedQuickDeal.askingPrice).toLocaleString()}` : 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">Product Type:</span>
                    <span className="text-gray-800 flex-1 capitalize">
                      {(selectedQuickDeal.productTypes as string[])?.join(', ') || 'Not specified'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">Zoning:</span>
                    <span className="text-gray-800 flex-1">{selectedQuickDeal.zoning || 'Not provided'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">Entitlements:</span>
                    <span className="text-gray-800 flex-1">
                      {selectedQuickDeal.hasEntitlements === true ? 'Yes' : 
                       selectedQuickDeal.hasEntitlements === false ? 'No' : 'Not specified'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">Sewer:</span>
                    <span className="text-gray-800 flex-1">
                      {selectedQuickDeal.sewerAvailable === true ? 'Available' : 
                       selectedQuickDeal.sewerAvailable === false ? 'Not available' : 'Not specified'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-28">QCT Status:</span>
                    <span className="text-gray-800 flex-1">{(selectedQuickDeal as any).qctStatus || 'Not checked'}</span>
                  </div>
                </div>
              </div>

              {/* Broker Info (if available) */}
              {selectedQuickDeal.broker && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <User size={16} />
                    Broker Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex">
                      <span className="text-gray-500 w-28">Name:</span>
                      <span className="text-gray-800 flex-1">{[selectedQuickDeal.broker.firstName, selectedQuickDeal.broker.lastName].filter(Boolean).join(' ') || 'Not provided'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-500 w-28">Email:</span>
                      <span className="text-gray-800 flex-1">
                        {selectedQuickDeal.broker.email && !selectedQuickDeal.broker.email.includes('@temp.landlinq.ai') 
                          ? selectedQuickDeal.broker.email 
                          : 'Not provided'}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-500 w-28">Phone:</span>
                      <span className="text-gray-800 flex-1">{selectedQuickDeal.broker.phone || 'Not provided'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-500 w-28">Brokerage:</span>
                      <span className="text-gray-800 flex-1">{selectedQuickDeal.broker.brokerage || 'Not provided'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-500 w-28">Markets:</span>
                      <span className="text-gray-800 flex-1">
                        {Array.isArray(selectedQuickDeal.broker.marketsCovered) 
                          ? selectedQuickDeal.broker.marketsCovered.join(', ') 
                          : (selectedQuickDeal.broker.marketsCovered || 'Not provided')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Assignment */}
              {(selectedQuickDeal.assignedAnalyst || (selectedQuickDeal as any).assignedJrAnalyst || (selectedQuickDeal as any).assignedDeveloper || (selectedQuickDeal as any).assignedPartner) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <Users size={16} />
                    Team Assignment
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedQuickDeal.assignedAnalyst && (
                      <div className="flex">
                        <span className="text-gray-500 w-28">Analyst:</span>
                        <span className="text-gray-800 flex-1">{selectedQuickDeal.assignedAnalyst}</span>
                      </div>
                    )}
                    {(selectedQuickDeal as any).assignedJrAnalyst && (
                      <div className="flex">
                        <span className="text-gray-500 w-28">Jr. Analyst:</span>
                        <span className="text-gray-800 flex-1">{(selectedQuickDeal as any).assignedJrAnalyst}</span>
                      </div>
                    )}
                    {(selectedQuickDeal as any).assignedDeveloper && (
                      <div className="flex">
                        <span className="text-gray-500 w-28">Developer:</span>
                        <span className="text-gray-800 flex-1">{(selectedQuickDeal as any).assignedDeveloper}</span>
                      </div>
                    )}
                    {(selectedQuickDeal as any).assignedPartner && (
                      <div className="flex">
                        <span className="text-gray-500 w-28">Partner:</span>
                        <span className="text-gray-800 flex-1">{(selectedQuickDeal as any).assignedPartner}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Attached Documents */}
              {((selectedQuickDeal as any).documentUrls?.length > 0 || (selectedQuickDeal as any).analystDocumentUrls?.length > 0) && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                    <Paperclip size={16} />
                    Attached Documents
                  </h4>
                  <div className="space-y-2">
                    {/* Broker-submitted documents */}
                    {(selectedQuickDeal as any).documentUrls?.map((url: string, index: number) => {
                      const fileName = url.split('/').pop() || `Document ${index + 1}`;
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                      const isPdf = /\.pdf$/i.test(url);
                      return (
                        <div key={`doc-${index}`} className="flex items-center gap-2 p-2 bg-white rounded border border-indigo-100 hover:bg-indigo-50 transition-colors">
                          {isImage ? (
                            <ImageIcon size={16} className="text-indigo-600" />
                          ) : isPdf ? (
                            <FileText size={16} className="text-red-600" />
                          ) : (
                            <File size={16} className="text-gray-600" />
                          )}
                          <span className="text-sm text-gray-700 flex-1 truncate" title={fileName}>{fileName}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openFileViewer(url)}
                              className="p-1 rounded hover:bg-indigo-100 text-indigo-600"
                              title="View file inline"
                              data-testid={`button-view-quick-doc-${index}`}
                            >
                              <Eye size={14} />
                            </button>
                            <a
                              href={url}
                              download={fileName}
                              className="p-1 rounded hover:bg-indigo-100 text-indigo-600"
                              title="Download file"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                    {/* Analyst-uploaded documents */}
                    {(selectedQuickDeal as any).analystDocumentUrls?.map((url: string, index: number) => {
                      const fileName = url.split('/').pop() || `Analyst Doc ${index + 1}`;
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                      const isPdf = /\.pdf$/i.test(url);
                      return (
                        <div key={`analyst-doc-${index}`} className="flex items-center gap-2 p-2 bg-white rounded border border-indigo-100 hover:bg-indigo-50 transition-colors">
                          {isImage ? (
                            <ImageIcon size={16} className="text-indigo-600" />
                          ) : isPdf ? (
                            <FileText size={16} className="text-red-600" />
                          ) : (
                            <File size={16} className="text-gray-600" />
                          )}
                          <span className="text-sm text-gray-700 flex-1 truncate" title={fileName}>{fileName}</span>
                          <Badge className="bg-purple-100 text-purple-700 text-xs">Analyst</Badge>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openFileViewer(url)}
                              className="p-1 rounded hover:bg-indigo-100 text-indigo-600"
                              title="View file inline"
                              data-testid={`button-view-quick-analyst-doc-${index}`}
                            >
                              <Eye size={14} />
                            </button>
                            <a
                              href={url}
                              download={fileName}
                              className="p-1 rounded hover:bg-indigo-100 text-indigo-600"
                              title="Download file"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes sections */}
              {(selectedQuickDeal.analystNotes || selectedQuickDeal.brokerNotes || (selectedQuickDeal as any).ingestionNotes) && (
                <div className="space-y-3">
                  {selectedQuickDeal.analystNotes && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                        <MessageSquare size={16} />
                        Analyst Notes
                      </h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedQuickDeal.analystNotes}</p>
                    </div>
                  )}
                  {selectedQuickDeal.brokerNotes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <MessageSquare size={16} />
                        Broker Notes
                      </h4>
                      <p className="text-sm text-blue-700 whitespace-pre-wrap">{selectedQuickDeal.brokerNotes}</p>
                    </div>
                  )}
                  {(selectedQuickDeal as any).ingestionNotes && (
                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Settings size={16} />
                        System Notes
                      </h4>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap font-mono text-xs">{(selectedQuickDeal as any).ingestionNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Deal Room URL if exists */}
              {(selectedQuickDeal as any).dealRoomUrl && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                  <h4 className="font-semibold text-cyan-800 mb-2 flex items-center gap-2">
                    <ExternalLink size={16} />
                    Deal Room
                  </h4>
                  <a 
                    href={(selectedQuickDeal as any).dealRoomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-cyan-600 hover:text-cyan-800 underline break-all"
                  >
                    {(selectedQuickDeal as any).dealRoomUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button 
              onClick={() => setQuickDealModalOpen(false)}
              variant="outline"
              className="border-[#4A90E2] bg-white text-[#4A90E2] hover:bg-white"
            >
              CLOSE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* File Viewer Dialog (Dec 15, 2025) - View files inline without downloading */}
      <Dialog open={!!fileViewerModal} onOpenChange={() => setFileViewerModal(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col" data-testid="dialog-file-viewer">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {fileViewerModal?.fileType === 'pdf' && <FileText className="text-red-600" size={20} />}
              {fileViewerModal?.fileType === 'image' && <ImageIcon className="text-blue-600" size={20} />}
              {fileViewerModal?.fileType === 'excel' && <BarChart3 className="text-green-600" size={20} />}
              {fileViewerModal?.fileType === 'word' && <FileText className="text-blue-600" size={20} />}
              {(fileViewerModal?.fileType === 'other' || fileViewerModal?.fileType === 'text') && <File className="text-gray-600" size={20} />}
              <span className="truncate">{fileViewerModal?.fileName}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto min-h-[60vh]">
            {fileViewerModal?.fileType === 'pdf' && (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded min-h-[40vh]">
                <FileText className="w-20 h-20 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{fileViewerModal.fileName}</h3>
                <p className="text-gray-600 text-center mb-6 max-w-md">
                  PDF files stored in secure storage cannot be previewed inline. 
                  Click below to open or download the document.
                </p>
                <div className="flex gap-3">
                  <a
                    href={fileViewerModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink size={16} />
                    Open PDF
                  </a>
                  <a
                    href={fileViewerModal.url}
                    download={fileViewerModal.fileName}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <Download size={16} />
                    Download
                  </a>
                </div>
              </div>
            )}
            
            {fileViewerModal?.fileType === 'image' && (
              <div className="flex items-center justify-center p-4 bg-gray-50 rounded">
                <img 
                  src={fileViewerModal.url} 
                  alt={fileViewerModal.fileName}
                  className="max-w-full max-h-[60vh] object-contain rounded shadow-lg"
                />
              </div>
            )}
            
            {fileViewerModal?.fileType === 'text' && (
              <iframe 
                src={fileViewerModal.url} 
                className="w-full h-full min-h-[60vh] border rounded bg-white font-mono"
                title={fileViewerModal.fileName}
              />
            )}
            
            {(fileViewerModal?.fileType === 'excel' || fileViewerModal?.fileType === 'word' || fileViewerModal?.fileType === 'other') && (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded min-h-[40vh]">
                <div className="text-center space-y-4">
                  {fileViewerModal?.fileType === 'excel' && <BarChart3 className="w-16 h-16 text-green-600 mx-auto" />}
                  {fileViewerModal?.fileType === 'word' && <FileText className="w-16 h-16 text-blue-600 mx-auto" />}
                  {fileViewerModal?.fileType === 'other' && <File className="w-16 h-16 text-gray-600 mx-auto" />}
                  <h3 className="text-lg font-semibold text-gray-800">{fileViewerModal?.fileName}</h3>
                  <p className="text-gray-600">
                    {fileViewerModal?.fileType === 'excel' && 'Excel files can be previewed using Google Docs Viewer or downloaded.'}
                    {fileViewerModal?.fileType === 'word' && 'Word documents can be previewed using Google Docs Viewer or downloaded.'}
                    {fileViewerModal?.fileType === 'other' && 'This file type cannot be previewed inline. Please download to view.'}
                  </p>
                  <div className="flex gap-3 justify-center mt-4">
                    {(fileViewerModal?.fileType === 'excel' || fileViewerModal?.fileType === 'word') && (
                      <Button
                        onClick={() => {
                          // Construct full public URL for Google Docs Viewer
                          const fileUrl = fileViewerModal?.url || '';
                          const fullUrl = fileUrl.startsWith('http') 
                            ? fileUrl 
                            : `${window.location.origin}${fileUrl}`;
                          window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`, '_blank');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="button-google-docs-viewer"
                      >
                        <ExternalLink size={16} className="mr-2" />
                        Open in Google Docs Viewer
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = fileViewerModal?.url || '';
                        a.download = fileViewerModal?.fileName || 'download';
                        a.click();
                      }}
                      variant="outline"
                      className="border-gray-300"
                      data-testid="button-download-file"
                    >
                      <Download size={16} className="mr-2" />
                      Download File
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex justify-between items-center">
            <a 
              href={fileViewerModal?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <ExternalLink size={14} />
              Open in new tab
            </a>
            <Button 
              onClick={() => setFileViewerModal(null)}
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LIHTC Site Score Modal (Dec 23, 2025) - Site suitability scoring details */}
      {lihtcScoreModal && (
        <LIHTCScoreModal
          dealId={lihtcScoreModal.dealId}
          isOpen={!!lihtcScoreModal}
          onClose={() => setLihtcScoreModal(null)}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/site-evaluations/summary'] });
            queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/deals' });
          }}
        />
      )}

      {/* Reason Details Dialog - View full acceptance/rejection reason */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className={reasonDialogContent?.type === 'acceptance' ? 'text-green-700' : 'text-red-700'}>
              {reasonDialogContent?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 text-sm leading-relaxed space-y-3">
            {(() => {
              const raw = reasonDialogContent?.content || '';
              // Split off "SUBJECT PROPERTY: ..." prefix from the actual reasoning
              const subjectMatch = raw.match(/^(SUBJECT PROPERTY:[^\n.]*\.?)\s*/i);
              const subjectLine = subjectMatch ? subjectMatch[1] : null;
              const reasoning = subjectLine ? raw.slice(subjectMatch![0].length).trim() : raw.trim();
              // Detect stale/pre-feature data: no substantive reasoning after the subject prefix
              const hasReasoning = reasoning.length > 10;
              return (
                <>
                  {subjectLine && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 font-mono">
                      {subjectLine}
                    </div>
                  )}
                  {hasReasoning ? (
                    <div className="whitespace-pre-wrap text-gray-800">{reasoning}</div>
                  ) : (
                    <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs">
                      <strong>Notes not available</strong> — this deal was analyzed before detailed reasoning was recorded.
                      Re-run the analysis to generate updated notes.
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <DialogFooter className="gap-2">
            {reasonDialogDeal && /^Parcel ID:/i.test(reasonDialogDeal.address || '') && (
              <Button
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={resolvingParcel}
                onClick={async () => {
                  if (!reasonDialogDeal?.id) return;
                  setResolvingParcel(true);
                  try {
                    const resp = await fetch(`/api/deals/${reasonDialogDeal.id}/resolve-parcel`, {
                      method: 'POST',
                      credentials: 'include',
                    });
                    const data = await resp.json();
                    if (resp.ok && data.success) {
                      toast({ title: 'Parcel resolved', description: data.message });
                      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
                      setReasonDialogOpen(false);
                      setReasonDialogDeal(null);
                    } else {
                      toast({ title: 'Lookup failed', description: data.message || 'Parcel not found in Regrid database.', variant: 'destructive' });
                    }
                  } catch (e: any) {
                    toast({ title: 'Error', description: e.message, variant: 'destructive' });
                  } finally {
                    setResolvingParcel(false);
                  }
                }}
              >
                {resolvingParcel ? 'Looking up…' : 'Lookup Parcel'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setReasonDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Deal Modal - AI-powered email/PDF parsing */}
      <Dialog open={showImportModal} onOpenChange={(open) => {
        if (!open) {
          setShowImportModal(false);
          setImportContent('');
          setImportParsedData(null);
          setImportConfidence(null);
          setImportTab('email');
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-[#4A90E2]" />
              Import Deal from Email or PDF
            </DialogTitle>
            <DialogDescription>
              Paste email content or upload a PDF, and AI will extract deal information automatically
            </DialogDescription>
          </DialogHeader>

          <Tabs value={importTab} onValueChange={(v) => setImportTab(v as 'email' | 'pdf')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email" className="flex items-center gap-2">
                <ClipboardPaste className="h-4 w-4" />
                Paste Email
              </TabsTrigger>
              <TabsTrigger value="pdf" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Upload PDF
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Paste the email content below:
                </label>
                <Textarea
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  onPaste={(e) => {
                    const html = e.clipboardData.getData('text/html');
                    const plainText = e.clipboardData.getData('text/plain');
                    
                    if (html) {
                      e.preventDefault();
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(html, 'text/html');
                      const links = doc.querySelectorAll('a[href]');
                      let extractedUrls: string[] = [];
                      links.forEach(link => {
                        const href = link.getAttribute('href');
                        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                          extractedUrls.push(href);
                        }
                      });
                      
                      let finalContent = plainText || doc.body.textContent || '';
                      if (extractedUrls.length > 0) {
                        finalContent += '\n\n--- Extracted URLs ---\n' + extractedUrls.join('\n');
                      }
                      
                      setImportContent(prev => prev + finalContent);
                    }
                  }}
                  placeholder="Paste the full email here including broker info, property address, price, acreage, etc..."
                  className="min-h-[200px] font-mono text-sm"
                  data-testid="import-email-content"
                />
              </div>
              <Button
                onClick={async () => {
                  console.log('[IMPORT-DEAL-UI] Button clicked');
                  console.log('[IMPORT-DEAL-UI] Content length:', importContent?.length || 0);
                  console.log('[IMPORT-DEAL-UI] Content preview (first 500 chars):', importContent?.substring(0, 500));
                  
                  if (!importContent.trim()) {
                    console.log('[IMPORT-DEAL-UI] ERROR: Empty content');
                    toast({ title: "Error", description: "Please paste email content first", variant: "destructive" });
                    return;
                  }
                  
                  // Check for hyperlinks in content and log them
                  const urlMatches = importContent.match(/(https?:\/\/[^\s]+)/gi);
                  console.log('[IMPORT-DEAL-UI] URLs detected:', urlMatches?.length || 0, urlMatches?.slice(0, 5));
                  
                  setImportParsing(true);
                  console.log('[IMPORT-DEAL-UI] Starting API call...');
                  const startTime = Date.now();
                  
                  try {
                    // Strip base64 data URIs (embedded images) — they inflate size but add nothing for AI parsing
                  const MAX_CHARS = 90000;
                  let sanitizedContent = importContent
                    .replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, '[IMAGE REMOVED]');
                  if (sanitizedContent.length > MAX_CHARS) {
                    sanitizedContent = sanitizedContent.substring(0, MAX_CHARS);
                    console.warn('[IMPORT-DEAL-UI] Content truncated to', MAX_CHARS, 'chars');
                  }
                  
                  const requestBody = { content: sanitizedContent, contentType: 'email' };
                    console.log('[IMPORT-DEAL-UI] Request body size:', JSON.stringify(requestBody).length, 'bytes');
                    
                    const res = await fetch('/api/deals/import/parse', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(requestBody)
                    });
                    
                    const elapsed = Date.now() - startTime;
                    console.log('[IMPORT-DEAL-UI] Response received in', elapsed, 'ms');
                    console.log('[IMPORT-DEAL-UI] Response status:', res.status, res.statusText);
                    
                    const data = await res.json();
                    console.log('[IMPORT-DEAL-UI] Response data:', JSON.stringify(data, null, 2));
                    
                    if (data.success) {
                      console.log('[IMPORT-DEAL-UI] SUCCESS - Parsed data:', data.parsed);
                      console.log('[IMPORT-DEAL-UI] Confidence:', data.confidence);
                      setImportParsedData(data.parsed);
                      setImportConfidence(data.confidence);
                      toast({ title: "Parsed Successfully", description: "Review the extracted data below" });
                    } else {
                      console.log('[IMPORT-DEAL-UI] FAILED - Message:', data.message);
                      toast({ title: "Parsing Failed", description: data.message || "Could not extract deal info", variant: "destructive" });
                    }
                  } catch (err: any) {
                    const elapsed = Date.now() - startTime;
                    console.error('[IMPORT-DEAL-UI] ERROR after', elapsed, 'ms:', err);
                    console.error('[IMPORT-DEAL-UI] Error name:', err?.name);
                    console.error('[IMPORT-DEAL-UI] Error message:', err?.message);
                    console.error('[IMPORT-DEAL-UI] Error stack:', err?.stack);
                    toast({ title: "Error", description: `Failed to parse content: ${err?.message || 'Unknown error'}`, variant: "destructive" });
                  } finally {
                    setImportParsing(false);
                    console.log('[IMPORT-DEAL-UI] Parsing complete');
                  }
                }}
                disabled={importParsing || !importContent.trim()}
                className="w-full"
              >
                {importParsing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing with AI...</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" /> Extract Deal Info</>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="pdf" className="mt-4 space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <FileUp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">PDF upload coming soon</p>
                <p className="text-sm text-gray-500">For now, copy/paste the PDF text into the Email tab</p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Parsed Data Preview & Approval Form */}
          {importParsedData && (
            <div className="mt-6 border-t pt-6">
              {/* Approval Required Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-amber-800">Review Required Before Adding Deal</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Please verify the extracted information below is correct. Edit any fields as needed, then click "Approve & Create Deal" to add this deal to the pipeline.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  AI-Extracted Deal Summary
                </h3>
                {importConfidence?.overall && (
                  <Badge variant={importConfidence.overall >= 70 ? "default" : "secondary"} className={importConfidence.overall >= 70 ? "bg-green-100 text-green-700" : ""}>
                    {importConfidence.overall}% AI confidence
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Street Address</label>
                  <Input
                    value={importParsedData.address || ''}
                    onChange={(e) => setImportParsedData({...importParsedData, address: e.target.value})}
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Property Name</label>
                  <Input
                    value={importParsedData.propertyName || ''}
                    onChange={(e) => setImportParsedData({...importParsedData, propertyName: e.target.value})}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">City</label>
                  <Input
                    value={importParsedData.city || ''}
                    onChange={(e) => setImportParsedData({...importParsedData, city: e.target.value})}
                    placeholder="City"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500">State</label>
                    <Input
                      value={importParsedData.state || ''}
                      onChange={(e) => setImportParsedData({...importParsedData, state: e.target.value})}
                      placeholder="TX"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">ZIP</label>
                    <Input
                      value={importParsedData.zip || ''}
                      onChange={(e) => setImportParsedData({...importParsedData, zip: e.target.value})}
                      placeholder="75001"
                      maxLength={5}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Asking Price ($)</label>
                  <Input
                    value={importParsedData.askingPrice || ''}
                    onChange={(e) => setImportParsedData({...importParsedData, askingPrice: e.target.value})}
                    placeholder="1500000"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Acres</label>
                  <Input
                    value={importParsedData.sizeAcres || ''}
                    onChange={(e) => setImportParsedData({...importParsedData, sizeAcres: e.target.value})}
                    placeholder="15.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Unit Count</label>
                  <Input
                    value={importParsedData.unitCount || ''}
                    onChange={(e) => setImportParsedData({...importParsedData, unitCount: e.target.value})}
                    placeholder="250"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Year Built</label>
                  <Input
                    value={importParsedData.yearBuilt || ''}
                    onChange={(e) => setImportParsedData({...importParsedData, yearBuilt: e.target.value})}
                    placeholder="2020"
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Broker Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Broker Name</label>
                    <Input
                      value={importParsedData.brokerName || ''}
                      onChange={(e) => setImportParsedData({...importParsedData, brokerName: e.target.value})}
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Broker Email</label>
                    <Input
                      value={importParsedData.brokerEmail || ''}
                      onChange={(e) => setImportParsedData({...importParsedData, brokerEmail: e.target.value})}
                      placeholder="john@brokerage.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Broker Phone</label>
                    <Input
                      value={importParsedData.brokerPhone || ''}
                      onChange={(e) => setImportParsedData({...importParsedData, brokerPhone: e.target.value})}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Brokerage</label>
                    <Input
                      value={importParsedData.brokerCompany || ''}
                      onChange={(e) => setImportParsedData({...importParsedData, brokerCompany: e.target.value})}
                      placeholder="CBRE, JLL, etc."
                    />
                  </div>
                </div>
              </div>

              {importParsedData.notes && (
                <div className="mt-4">
                  <label className="text-xs font-medium text-gray-500">Additional Notes</label>
                  <Textarea
                    value={importParsedData.notes}
                    onChange={(e) => setImportParsedData({...importParsedData, notes: e.target.value})}
                    className="mt-1"
                    rows={2}
                  />
                </div>
              )}

              {/* Final Approval Summary */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Deal Summary for Approval
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-gray-500">Location:</div>
                  <div className="font-medium text-gray-900">
                    {[importParsedData.address, importParsedData.city, importParsedData.state, importParsedData.zip].filter(Boolean).join(', ') || 'Not specified'}
                  </div>
                  {importParsedData.askingPrice && !isNaN(parseFloat(importParsedData.askingPrice.replace(/[^0-9.]/g, ''))) && (
                    <>
                      <div className="text-gray-500">Asking Price:</div>
                      <div className="font-medium text-gray-900">${parseFloat(importParsedData.askingPrice.replace(/[^0-9.]/g, '')).toLocaleString()}</div>
                    </>
                  )}
                  {importParsedData.sizeAcres && (
                    <>
                      <div className="text-gray-500">Size:</div>
                      <div className="font-medium text-gray-900">{importParsedData.sizeAcres} acres</div>
                    </>
                  )}
                  {importParsedData.unitCount && (
                    <>
                      <div className="text-gray-500">Units:</div>
                      <div className="font-medium text-gray-900">{importParsedData.unitCount}</div>
                    </>
                  )}
                  {importParsedData.brokerName && (
                    <>
                      <div className="text-gray-500">Broker:</div>
                      <div className="font-medium text-gray-900">{importParsedData.brokerName}{importParsedData.brokerCompany ? ` (${importParsedData.brokerCompany})` : ''}</div>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-3 pt-3 border-t">
                  By clicking "Approve & Create Deal", this deal will be added to the pipeline and automatically classified.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              Cancel
            </Button>
            {importParsedData && (
              <Button
                onClick={async () => {
                  if (!importParsedData.address?.trim()) {
                    toast({ title: "Error", description: "Address is required", variant: "destructive" });
                    return;
                  }
                  // Use Quick Add submission endpoint
                  setImportParsing(true);
                  try {
                    const fullAddress = [
                      importParsedData.address,
                      importParsedData.city,
                      importParsedData.state,
                      importParsedData.zip
                    ].filter(Boolean).join(', ');

                    const dealData = {
                      address: fullAddress,
                      propertyName: importParsedData.propertyName || '',
                      askingPrice: importParsedData.askingPrice ? parseFloat(importParsedData.askingPrice.replace(/[^0-9.]/g, '')) : null,
                      sizeAcres: importParsedData.sizeAcres ? parseFloat(importParsedData.sizeAcres) : null,
                      unitCount: importParsedData.unitCount ? parseInt(importParsedData.unitCount) : null,
                      yearBuilt: importParsedData.yearBuilt ? parseInt(importParsedData.yearBuilt) : null,
                      brokerName: importParsedData.brokerName || '',
                      brokerEmail: importParsedData.brokerEmail || '',
                      brokerPhone: importParsedData.brokerPhone || '',
                      brokerage: importParsedData.brokerCompany || '',
                      brokerNotes: importParsedData.notes || '',
                      productTypes: importParsedData.productTypes || [],
                      submissionSource: 'import'
                    };

                    const res = await fetch('/api/analyst/deals', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(dealData)
                    });

                    if (res.ok) {
                      const result = await res.json();
                      toast({ title: "Deal Created", description: `Deal #${result.dealNumber || 'N/A'} imported successfully` });
                      setShowImportModal(false);
                      setImportContent('');
                      setImportParsedData(null);
                      setImportConfidence(null);
                      queryClient.invalidateQueries({ queryKey: ['/api/analyst/deals'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
                    } else {
                      const err = await res.json();
                      toast({ title: "Error", description: err.message || "Failed to create deal", variant: "destructive" });
                    }
                  } catch (err) {
                    toast({ title: "Error", description: "Failed to create deal", variant: "destructive" });
                  } finally {
                    setImportParsing(false);
                  }
                }}
                disabled={importParsing}
                className="bg-green-600 hover:bg-green-700"
              >
                {importParsing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><CheckCircle className="h-4 w-4 mr-2" /> Approve & Create Deal</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Picker Map for manual coordinate correction */}
      <LocationPickerMap
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSave={async (lat, lng, reason) => {
          if (!helloDataModal?.dealId) return;
          
          setSavingLocation(true);
          try {
            const response = await fetch(`/api/deals/${helloDataModal.dealId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                manualLatitude: lat.toString(),
                manualLongitude: lng.toString(),
                manualCoordsReason: reason
              })
            });
            
            if (response.ok) {
              toast({
                title: "Location Updated",
                description: "Pin location saved. Now searching for comparables...",
              });
              
              // Update the modal state with new coordinates
              setHelloDataModal(prev => prev ? {...prev, latitude: lat, longitude: lng} : null);
              setShowLocationPicker(false);
              
              // Automatically run comparables with the new location
              await handleForceComparables(helloDataModal.dealId);
              
              queryClient.invalidateQueries({ queryKey: ['/api/analyst/deals'] });
              queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
            } else {
              toast({
                title: "Error",
                description: "Failed to save location",
                variant: "destructive"
              });
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to save location",
              variant: "destructive"
            });
          } finally {
            setSavingLocation(false);
          }
        }}
        currentLatitude={helloDataModal?.latitude}
        currentLongitude={helloDataModal?.longitude}
        address={[helloDataModal?.address, helloDataModal?.city, helloDataModal?.state, helloDataModal?.zip].filter(Boolean).join(', ')}
        isSaving={savingLocation}
      />

      {/* Frozen horizontal scrollbar at bottom of viewport - only visible in table view */}
      {viewMode === 'table' && (
        <div 
          ref={stickyScrollbarRef}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '20px',
            backgroundColor: '#f1f5f9',
            borderTop: '2px solid #cbd5e1',
            zIndex: 1000,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div style={{ height: '1px', minWidth: '100%', width: 'max-content' }}></div>
        </div>
      )}
      
      </div>

      {/* ─── Auto YOC Editable Breakdown Dialog ─────────────────────────────────── */}
      {yocBreakdownDeal && (() => {
        const d = yocBreakdownDeal;
        const resolvedKeys = resolveProductTypeKeys(d.productTypes || [], d.targetProductTypes || []);
        if (resolvedKeys.length === 0) return null;
        const stateKey = (d.state || '').toUpperCase();
        const _ctyBkd = (d.city || '').toUpperCase().trim();
        const isCoastal = COASTAL_STATES.has(stateKey) ||
          (stateKey === 'NC' && COASTAL_CITIES_NC.has(_ctyBkd)) ||
          (stateKey === 'GA' && COASTAL_CITIES_GA.has(_ctyBkd));
        let rentStateMult = RENT_MULT_BY_STATE[stateKey] ?? RENT_MULT_DEFAULT;
        let landStateMult = LAND_COST_MULT_BY_STATE[stateKey] ?? LAND_COST_MULT_DEFAULT;
        if (stateKey === 'NC' && d.city) {
          const cu = d.city.toUpperCase().trim();
          if (NC_RESEARCH_TRIANGLE_CITIES.has(cu)) { rentStateMult = 0.93; landStateMult = 1.40; }
          else if (NC_CHARLOTTE_MSA_CITIES.has(cu)) { rentStateMult = 0.90; landStateMult = 1.65; }
        }
        const comparablesJson: any[] = Array.isArray(d.comparablesJson) ? d.comparablesJson : [];
        const scalarPsf = parseFloat(d.avgRentPsf || d.topRentPsf || '0') || null;
        const hellodataRentPSF = extractHellodataRentPSF(comparablesJson) ?? (scalarPsf && scalarPsf > 0 ? scalarPsf : null);
        const hasComps = !!hellodataRentPSF || (Array.isArray(d.comparablesJson) && d.comparablesJson.length > 0);
        const fmtK = (n: number) => '$' + Math.round(n).toLocaleString();
        const fmtDlr = (n: number) => '$' + Math.round(n).toLocaleString();

        return (
          <Dialog open={!!yocBreakdownDeal} onOpenChange={(o) => { if (!o) setYocBreakdownDeal(null); }}>
            <DialogContent className="max-w-[98vw] w-[98vw] p-0 overflow-hidden rounded-xl shadow-2xl border-0" style={{ height: '96vh', display: 'flex', flexDirection: 'column', background: '#f8f9fb' }}>

              {/* ── Header ──────────────────────────────────────────────── */}
              <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[15px] text-gray-900">YOC Formula Breakdown</div>
                    <div className="text-gray-400 text-[12px] mt-0.5">{d.propertyName || d.address || 'Deal'} — {d.city}, {d.state}</div>
                  </div>
                  <span className="text-[11px] text-gray-400">Edit any field — YOC updates live.</span>
                </div>
              </div>

              {/* ── No-comps warning ────────────────────────────────────── */}
              {!hasComps && (
                <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
                  <span className="text-amber-700 text-[12px]">⚠ No rental comps — using preset rents</span>
                </div>
              )}

              {/* ── Scrollable body ──────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto">
                <div className={`grid h-full ${resolvedKeys.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} divide-x divide-gray-200`}>
                {resolvedKeys.map((typeKey, ti) => {
                  const live = computeLiveYocForDialog(d, typeKey);
                  if (!live) return null;
                  const preset = PRODUCT_TYPE_YOC_PRESETS[typeKey];
                  const id = d.id;
                  const defaultInsurance = isCoastal ? preset.insurancePU_coastal : preset.insurancePU_nc;
                  const yocBg = live.yoc >= 6.5 ? 'bg-emerald-600' : live.yoc >= 5.5 ? 'bg-amber-500' : 'bg-red-500';
                  const yocText = live.yoc >= 6.5 ? 'text-emerald-600' : live.yoc >= 5.5 ? 'text-amber-500' : 'text-red-500';

                  /* reusable bordered input matching underwriter style */
                  const uwInput = (dealId: string, field: string, defaultVal: number, opts?: { pct?: boolean; suffix?: string }) => (
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[12px] pointer-events-none">$</span>
                        <input
                          type="number" min={0} step={opts?.pct ? 0.1 : 1000}
                          value={getYocField(dealId, field, defaultVal)}
                          onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setYocField(dealId, field, n); }}
                          className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded text-[13px] text-gray-800 bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                        />
                      </div>
                      {opts?.suffix && <span className="text-[11px] text-gray-400 whitespace-nowrap">{opts.suffix}</span>}
                    </div>
                  );

                  return (
                    <div key={typeKey} className="flex flex-col">

                      {/* Phase tab header — matches underwriter phase tabs */}
                      <div className="bg-white border-b border-gray-200 px-5 pt-2.5 pb-0 flex-shrink-0">
                        <div className={`inline-flex items-center gap-2 border-b-2 ${ti === 0 ? 'border-[#2563eb]' : 'border-gray-400'} pb-2`}>
                          <span className="text-[13px] font-semibold text-gray-800">{preset.label}</span>
                          <span className="text-[11px] text-gray-400">({typeKey})</span>
                        </div>
                      </div>

                      {/* Key metrics strip — like underwriter's top stats row */}
                      <div className="bg-white border-b border-gray-200 px-5 py-2 flex-shrink-0">
                        <div className="flex items-center gap-6">
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">Units</div>
                            <div className="text-[15px] font-bold text-gray-900">{Math.round(live.totalUnits)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">Phase NOI</div>
                            <div className="text-[15px] font-bold text-gray-900">{fmtK(live.noi)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">TDC</div>
                            <div className="text-[15px] font-bold text-gray-900">{fmtK(live.tdc)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">Blended Rent</div>
                            <div className="text-[15px] font-bold text-gray-900">{fmtDlr(live.blendedRent)}/mo</div>
                          </div>
                          <div className="ml-auto">
                            <div className="text-[10px] text-gray-400 mb-0.5 text-right">Stand-alone YOC</div>
                            <div className={`text-[22px] font-black ${yocText}`}>{live.yoc.toFixed(2)}%</div>
                          </div>
                        </div>
                      </div>

                      {/* Form body */}
                      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">

                        {/* ── Inputs ── */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-4 py-1.5 border-b border-gray-100 bg-gray-50">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Inputs</span>
                          </div>
                          <div className="px-4 py-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="text-[11px] text-gray-500 mb-1">Units <span className="font-normal text-gray-400">({preset.dua} u/ac preset)</span></div>
                                <input
                                  type="number" min={1} max={2000} step={1}
                                  value={getYocField(id, 'unitCount', Math.round(live.totalUnits))}
                                  onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n > 0) setYocField(id, 'unitCount', n); }}
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded text-[13px] text-gray-800 bg-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                                />
                              </div>
                              <div>
                                <div className="text-[11px] text-gray-500 mb-1">Hard Cost / Unit</div>
                                {uwInput(id, `${typeKey}.hardCostPU`, preset.hardCostPU)}
                              </div>
                              <div>
                                <div className="text-[11px] text-gray-500 mb-1">Soft Costs</div>
                                {uwInput(id, `${typeKey}.softCostPct`, preset.softCostPct * 100, { pct: true, suffix: `% = ${fmtK(live.softCostTotal)}` })}
                              </div>
                              <div>
                                <div className="text-[11px] text-gray-500 mb-1">Fixed OpEx / Unit</div>
                                {uwInput(id, `${typeKey}.fixedOpExPU`, preset.fixedOpExPU, { suffix: '/yr' })}
                              </div>
                              <div>
                                <div className="text-[11px] text-gray-500 mb-1">Insurance / Unit</div>
                                {uwInput(id, `${typeKey}.insurancePU`, defaultInsurance, { suffix: '/yr' })}
                              </div>
                              <div>
                                <div className="text-[11px] text-gray-500 mb-1">Other Income</div>
                                {uwInput(id, `${typeKey}.otherIncomePUM`, preset.otherIncomePUM, { suffix: '/unit/mo' })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ── Rent ── */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-4 py-1.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Rent</span>
                            {live.rentMode === 'preset'
                              ? <span className="text-[11px] text-amber-600 font-medium">⚠ preset — no comps</span>
                              : <span className="text-[11px] text-emerald-600 font-medium">✓ HelloData comps</span>}
                          </div>
                          <div className="px-4 py-2 space-y-1.5">
                            {live.rentMode === 'hellodata-psf' && (
                              <div className="text-[12px] text-gray-500 font-mono bg-gray-50 rounded px-3 py-1.5">
                                ${live.hellodataRentPSF?.toFixed(2)}/SF × {Math.round(live.weightedAvgSF)} SF + $50 NC
                              </div>
                            )}
                            {live.rentMode === 'hellodata-avgrent' && (
                              <div className="text-[12px] text-gray-500 font-mono bg-gray-50 rounded px-3 py-1.5">
                                {fmtDlr(live.topCompAvgRent!)}/mo top comp + $200 BTR
                              </div>
                            )}
                            {live.rentMode === 'preset' && (
                              <div className="text-[12px] text-gray-500 font-mono bg-gray-50 rounded px-3 py-1.5">
                                {fmtDlr(live.presetBlendedRent)} preset × {live.effectiveRentMult.toFixed(2)} state
                              </div>
                            )}
                            <div>
                              <div className="text-[11px] text-gray-500 mb-1">Blended Rent (override)</div>
                              {uwInput(id, `${typeKey}.blendedRent`, live.autoBlendedRent, { suffix: '/mo' })}
                            </div>
                          </div>
                        </div>

                        {/* ── Revenue & Losses ── */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-4 py-1.5 border-b border-gray-100 bg-gray-50">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Revenue &amp; Losses</span>
                          </div>
                          <div className="px-4 py-2">
                            <div className="space-y-1.5 text-[13px]">
                              <div className="flex justify-between"><span className="text-gray-500">GPR</span><span className="font-mono text-gray-700">{fmtK(live.gpr)}/yr</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Other Income</span><span className="font-mono text-gray-700">+{fmtK(live.otherIncome)}/yr</span></div>
                              <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="text-gray-600 font-medium">Gross Income</span><span className="font-mono font-semibold text-gray-800">{fmtK(live.totalGross)}/yr</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Vacancy (5%)</span><span className="font-mono text-red-500">−{fmtK(live.vacancyLoss)}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Credit (LTL+Con)</span><span className="font-mono text-red-500">−{fmtK(live.creditLoss)} <span className="text-[11px] text-gray-400">(1%+1%)</span></span></div>
                              <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="text-gray-700 font-semibold">EGI</span><span className="font-mono font-bold text-gray-900">{fmtK(live.egi)}/yr</span></div>
                            </div>
                          </div>
                        </div>

                        {/* ── Operating Expenses ── */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Operating Expenses</span>
                          </div>
                          <div className="px-4 py-3">
                            <div className="space-y-1.5 text-[13px]">
                              <div className="flex justify-between"><span className="text-gray-500">Mgmt (2.75%)</span><span className="font-mono text-gray-700">{fmtK(live.mgmtFee)}/yr</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Fixed OpEx</span><span className="font-mono text-gray-700">{fmtK(live.fixedOpEx)}/yr</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Insurance</span><span className="font-mono text-gray-700">{fmtK(live.insurance)}/yr</span></div>
                              {live.reTaxAdj > 0 && <div className="flex justify-between"><span className="text-gray-500">RE Tax Adj</span><span className="font-mono text-gray-700">{fmtK(live.reTaxAdj)}/yr</span></div>}
                              <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="text-gray-600 font-semibold">Total OpEx</span><span className="font-mono font-semibold text-red-600">{fmtK(live.totalOpEx)}/yr</span></div>
                              <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="text-gray-700 font-semibold">NOI</span><span className="font-mono font-bold text-emerald-700">{fmtK(live.noi)}/yr</span></div>
                            </div>
                          </div>
                        </div>

                        {/* ── Total Dev Cost ── */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-4 py-1.5 border-b border-gray-100 bg-gray-50">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Dev Cost</span>
                          </div>
                          <div className="px-4 py-2 space-y-2">
                            <div>
                              <div className="text-[11px] text-gray-500 mb-1">
                                Land Cost {live.hasActualLandCost ? '(actual — override)' : '(estimated)'}
                              </div>
                              {uwInput(id, 'landCost', live.effectiveLandCost)}
                              {!live.hasActualLandCost && (
                                <div className="text-[11px] text-gray-400 font-mono mt-1">
                                  {fmtDlr(live.landCostPU)}/unit × {Math.round(live.totalUnits)} units × {live.landStateMult.toFixed(2)} state
                                </div>
                              )}
                            </div>
                            <div className="space-y-1.5 text-[13px]">
                              <div className="flex justify-between"><span className="text-gray-500">Land Cost</span><span className="font-mono text-gray-700">{fmtK(live.effectiveLandCost)}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Hard Costs</span><span className="font-mono text-gray-700">{fmtK(live.hardCostTotal)}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Soft Costs</span><span className="font-mono text-gray-700">{fmtK(live.softCostTotal)}</span></div>
                              <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="text-gray-700 font-semibold">TDC</span><span className="font-mono font-bold text-gray-900">{fmtK(live.tdc)}</span></div>
                            </div>
                          </div>
                        </div>

                        {/* ── YOC result banner ── */}
                        <div className={`rounded-lg ${yocBg} text-white px-4 py-2.5 flex items-center justify-between`}>
                          <div>
                            <div className="text-[11px] text-white/70 mb-0.5">NOI ÷ TDC</div>
                            <div className="text-[13px] font-mono">{fmtK(live.noi)} ÷ {fmtK(live.tdc)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-white/70 mb-0.5">Yield on Cost</div>
                            <div className="text-[26px] font-black leading-none">{live.yoc.toFixed(2)}%</div>
                          </div>
                        </div>

                      </div>{/* end form body */}
                    </div>
                  );
                })}
                </div>
              </div>{/* end scrollable */}

              {/* ── Footer ──────────────────────────────────────────────── */}
              <div className="px-6 py-2 bg-white border-t border-gray-200 flex-shrink-0 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">Preset {PRESET_VERSION} · 5% vacancy · 1% LTL + 1% concession · 2.75% mgmt</span>
                <button
                  onClick={async () => {
                    if (!d) return;
                    try {
                      await apiRequest('PATCH', `/api/deals/${d.id}`, { yocOverrides: JSON.stringify(yocOverrides) });
                      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
                      toast({ title: 'Saved', description: 'YOC inputs saved to this deal.' });
                    } catch (err: any) {
                      toast({ title: 'Save failed', description: err?.message || 'Unknown error', variant: 'destructive' });
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-medium rounded transition-colors"
                >
                  Save Changes
                </button>
              </div>

            </DialogContent>
          </Dialog>
        );
      })()}

    </TooltipProvider>
  );
}
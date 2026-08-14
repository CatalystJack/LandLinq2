import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  ArrowUpDown,
  Save,
  Search,
  Calculator,
  Plus,
  X,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  Zap,
  Activity,
  Trash2,
  MapPin,
  RefreshCw
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Deal, Broker, AcquisitionMarket } from "@shared/schema";
import { formatDealNumber } from "@shared/schema";
import QuickPropertyEvaluation from "@/components/quick-property-evaluation";

interface DealWithBroker extends Deal {
  broker: Broker;
}

// Team members for dropdowns
const teamMembers = [
  "Austin Blondell",
  "Davis Hammond", 
  "Steve Hillebrand",
  "John Bell",
  "Mallie Colavita",
  "AJ Klenk",
  "Brian Ford",
  "Ian Wagoner",
  "Ted Hill"
];

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterClassification, setFilterClassification] = useState<string>("all");
  const [filterMarket, setFilterMarket] = useState<string>("all");
  const [filterProductType, setFilterProductType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<{[key: string]: any}>({});
  const [editingCell, setEditingCell] = useState<{dealId: string, field: string} | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [dealScores, setDealScores] = useState<{[dealId: string]: any}>({});
  const [autoMode, setAutoMode] = useState<boolean>(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState<{dealId: string; dealAddress: string} | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState("");
  const [summaryDeal, setSummaryDeal] = useState<{id: string; address: string; summary: string} | null>(null);
  const [activeTab, setActiveTab] = useState<string>("deals");
  
  // MSA Management state
  const [editingMSA, setEditingMSA] = useState<string | null>(null);
  const [msaEditData, setMSAEditData] = useState<any>({});
  const [showMSAForm, setShowMSAForm] = useState<boolean>(false);
  const [newMSAData, setNewMSAData] = useState<any>({
    msaName: "",
    county: "",
    state: "",
    fullCountyName: "",
    cityNote: "",
    productTypes: [],
    isActive: true,
    notes: ""
  });

  // Fetch deals data  
  const { data: dealsData, isLoading } = useQuery({
    queryKey: ['/api/deals'],
    queryFn: async () => {
      const response = await fetch('/api/deals', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch deals');
      }
      const data = await response.json();
      return Array.isArray(data.deals) ? data.deals : Array.isArray(data) ? data : [];
    },
  });

  const deals = Array.isArray(dealsData) ? dealsData : [];
  
  // Fetch MSA data - only for super admins
  const { data: msaData, isLoading: msaLoading } = useQuery({
    queryKey: ['/api/msa/admin/all'],
    queryFn: async () => {
      const response = await fetch('/api/msa/admin/all', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch MSA data');
      }
      const data = await response.json();
      return data.markets || [];
    },
    enabled: user?.role === 'SUPER_ADMIN'
  });
  
  const msaMarkets = Array.isArray(msaData) ? msaData : [];

  const updateDealMutation = useMutation({
    mutationFn: async (data: { 
      dealId: string; 
      classification?: string; 
      analystNotes?: string;
      developerSummary?: string;
      status?: string;
      rejectionReason?: string;
      address?: string;
      propertyName?: string;
      unitCount?: number;
      sizeAcres?: number;
      askingPrice?: string;
      topRentPSF?: string;
      developer?: string;
      partner?: string;
      nextSteps?: string;
      assignedAnalyst?: string;
      population55Plus5Mile?: number;
      income75Plus55Plus?: number;
      demographicsNotes?: string;
      yieldOnCost?: number;
      isNewDeal?: boolean;
    }) => {
      if (data.isNewDeal) {
        return await apiRequest("POST", `/api/deals`, data);
      } else {
        return await apiRequest("PATCH", `/api/deals/${data.dealId}`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: "Deal Updated",
        description: "Deal has been successfully updated.",
      });
      setEditingRow(null);
      setEditData({});
      setEditingCell(null);
      setCellEditValue('');
    },
    onError: (error) => {
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
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
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

  const exportToExcelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/deals/export/csv', {
        method: 'GET',
      });
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deals-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Export Successful",
        description: "Excel file has been downloaded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message,
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

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      return await apiRequest("DELETE", `/api/deals/${dealId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: "Deal Deleted",
        description: "Deal has been successfully deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // MSA Mutations
  const createMSAMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/msa/admin/create`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/msa/admin/all'] });
      toast({
        title: "MSA Created",
        description: "Market has been successfully created",
      });
      setShowMSAForm(false);
      setNewMSAData({
        msaName: "",
        county: "",
        state: "",
        fullCountyName: "",
        cityNote: "",
        productTypes: [],
        isActive: true,
        notes: ""
      });
    },
    onError: (error) => {
      toast({
        title: "Create Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const updateMSAMutation = useMutation({
    mutationFn: async (data: { id: string; [key: string]: any }) => {
      const { id, ...updateData } = data;
      return await apiRequest("PATCH", `/api/msa/admin/update/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/msa/admin/all'] });
      toast({
        title: "MSA Updated",
        description: "Market has been successfully updated",
      });
      setEditingMSA(null);
      setMSAEditData({});
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const deleteMSAMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/msa/admin/delete/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/msa/admin/all'] });
      toast({
        title: "MSA Deleted",
        description: "Market has been successfully deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync MSA data from seed file
  const syncMSAMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/seed/msa-markets`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/msa/admin/all'] });
      toast({
        title: "MSA Data Synced",
        description: data?.message || "Markets have been synced from seed file",
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Census backfill mutation
  const censusBackfillMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/backfill-census`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: "Census Backfill Complete",
        description: `Processed: ${data?.processed || 0}, Geocoded: ${data?.geocoded || 0}, Census succeeded: ${data?.succeeded || 0}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Census Backfill Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // QCT backfill mutation
  const qctBackfillMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/backfill-qct-status`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: "QCT Backfill Complete",
        description: `${data?.updatedFips || 0} updated from stored FIPS, ${data?.updatedGeocode || 0} updated via geocoding, ${data?.skipped || 0} skipped`,
      });
    },
    onError: (error) => {
      toast({
        title: "QCT Backfill Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // OZ backfill (standard — only fills in missing ozStatus)
  const ozBackfillMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/backfill-oz-status`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: "OZ Backfill Complete",
        description: `${data?.updated || 0} updated, ${data?.skipped || 0} skipped`,
      });
    },
    onError: (error: any) => {
      toast({ title: "OZ Backfill Failed", description: error.message, variant: "destructive" });
    },
  });

  // OZ force backfill (re-geocodes all deals to refresh FIPS then re-checks OZ)
  const ozForceBackfillMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/backfill-oz-status`, { force: true });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: "OZ Force Backfill Complete",
        description: `${data?.updated || 0} updated (${data?.reGeocoded || 0} re-geocoded), ${data?.skipped || 0} skipped`,
      });
    },
    onError: (error: any) => {
      toast({ title: "OZ Force Backfill Failed", description: error.message, variant: "destructive" });
    },
  });

  // Handle delete with confirmation
  const handleDeleteDeal = (dealId: string, address: string) => {
    if (window.confirm(`Are you sure you want to delete the deal for "${address}"? This action cannot be undone.`)) {
      deleteDealMutation.mutate(dealId);
    }
  };

  // Optimized filtering and sorting with memoization
  const filteredAndSortedDeals = useMemo(() => {
    if (!deals || !Array.isArray(deals) || deals.length === 0) return [];
    
    return deals.filter((deal: any) => {
      // Classification filter
      if (filterClassification !== "all" && deal.classification !== filterClassification) {
        return false;
      }
      
      // Market filter  
      if (filterMarket !== "all" && deal.broker?.marketsCovered !== filterMarket) {
        return false;
      }
      
      // Filter by product type
      if (filterProductType !== "all") {
        const dealProductTypes = deal.productTypes as string[] || [];
        if (!dealProductTypes.includes(filterProductType)) {
          return false;
        }
      }
      
      // Search filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const searchableFields = [
          deal.address?.toLowerCase() || "",
          deal.broker?.firstName?.toLowerCase() || "",
          deal.broker?.lastName?.toLowerCase() || "",
          deal.broker?.email?.toLowerCase() || "",
          deal.broker?.phone?.toLowerCase() || "",
          deal.broker?.marketsCovered?.toLowerCase() || "",
          deal.hasEntitlements === true ? "with entitlements" : deal.hasEntitlements === false ? "without entitlements" : "",
          deal.parcelId?.toLowerCase() || "",
          deal.askingPrice?.toString() || "",
          deal.sizeAcres?.toString() || "",
          deal.analystNotes?.toLowerCase() || "",
          deal.brokerNotes?.toLowerCase() || "",
          getClassificationLabel(deal.classification || "").toLowerCase()
        ];
        
        return searchableFields.some(field => field.includes(query));
      }
      
      return true;
    })
    ?.sort((a: DealWithBroker, b: DealWithBroker) => {
      let aVal = a[sortColumn as keyof DealWithBroker];
      let bVal = b[sortColumn as keyof DealWithBroker];
      
      // Handle nested broker properties
      if (sortColumn.startsWith('broker.')) {
        const prop = sortColumn.split('.')[1];
        aVal = a.broker?.[prop as keyof Broker];
        bVal = b.broker?.[prop as keyof Broker];
      }
      
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return sortDirection === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    }) || [];
  }, [deals, filterClassification, filterMarket, filterProductType, searchQuery, sortColumn, sortDirection]);

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'green': return 'bg-green-500 text-white border-green-500';
      case 'yellow': return 'bg-yellow-500 text-white border-yellow-500';
      case 'red': return 'bg-red-500 text-white border-red-500';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'green': return 'Pursuing';
      case 'yellow': return 'Reviewing';
      case 'red': return 'Passed';
      default: return 'Unclassified';
    }
  };

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
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  // Select all deals
  const selectAllDeals = () => {
    const allDealIds = filteredAndSortedDeals.map((deal: DealWithBroker) => deal.id);
    setSelectedDeals(allDealIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedDeals([]);
  };

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

  // Memoized counts and filter options
  const { uniqueMarkets, uniqueProductTypes, pursuingCount, reviewingCount, passedCount } = useMemo(() => {
    if (!deals) return {
      uniqueMarkets: [],
      uniqueProductTypes: [],
      pursuingCount: 0,
      reviewingCount: 0,
      passedCount: 0
    };

    const markets = deals
      .flatMap((deal: DealWithBroker) => {
        const covered = deal.broker?.marketsCovered;
        return Array.isArray(covered) ? covered : covered ? [covered] : [];
      })
      .filter((market: string): market is string => Boolean(market && market.trim() !== '' && market.trim().length > 0))
      .sort();

    const uniqueMarkets = Array.from(new Set(markets));

    const productTypes = deals
      .flatMap((deal: DealWithBroker) => deal.productTypes as string[] || [])
      .filter((type: string) => type && type.trim() !== '' && type.trim().length > 0)
      .sort();

    const uniqueProductTypes = Array.from(new Set(productTypes));

    const pursuingCount = deals.filter((d: any) => d.classification === 'green').length;
    const reviewingCount = deals.filter((d: any) => d.classification === 'yellow').length;
    const passedCount = deals.filter((d: any) => d.classification === 'red').length;

    return {
      uniqueMarkets,
      uniqueProductTypes,
      pursuingCount,
      reviewingCount,
      passedCount
    };
  }, [deals]);

  // Helper functions for editing
  const startRowEdit = (dealId: string, dealData: any) => {
    setEditingRow(dealId);
    setEditData({
      classification: dealData.classification || '',
      analystNotes: dealData.analystNotes || '',
      nextSteps: dealData.nextSteps || '',
      assignedAnalyst: dealData.assignedAnalyst || '',
      developer: dealData.developer || '',
      partner: dealData.partner || '',
      propertyName: dealData.propertyName || '',
      productTypes: dealData.productTypes || [],
      unitCount: dealData.unitCount || '',
      sizeAcres: dealData.sizeAcres || '',
      askingPrice: dealData.askingPrice || '',
      topRentPSF: dealData.topRentPSF || '',
      yieldOnCost: dealData.yieldOnCost || '',
      hasEntitlements: dealData.hasEntitlements,
      sewerAvailable: dealData.sewerAvailable || false,
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
      sizeAcres: editData.sizeAcres ? parseFloat(editData.sizeAcres) : undefined,
      yieldOnCost: editData.yieldOnCost ? parseFloat(editData.yieldOnCost) : undefined,
      population55Plus5Mile: editData.population55Plus5Mile ? parseInt(editData.population55Plus5Mile) : undefined,
      income75Plus55Plus: editData.income75Plus55Plus ? parseInt(editData.income75Plus55Plus) : undefined,
    };
    
    updateDealMutation.mutate(updatedData);
  };

  const cancelRowEdit = () => {
    setEditingRow(null);
    setEditData({});
  };

  // Cell editing functions
  const startCellEdit = (dealId: string, field: string, value: any) => {
    setEditingCell({ dealId, field });
    setCellEditValue(value?.toString() || '');
  };

  const saveCellEdit = () => {
    if (!editingCell) return;
    
    const { dealId, field } = editingCell;
    let processedValue: any = cellEditValue;
    
    // Type conversion for numeric fields
    if (['unitCount', 'population55Plus5Mile', 'income75Plus55Plus'].includes(field)) {
      processedValue = cellEditValue ? parseInt(cellEditValue) : null;
    } else if (['sizeAcres', 'yieldOnCost'].includes(field)) {
      processedValue = cellEditValue ? parseFloat(cellEditValue) : null;
    }
    
    updateDealMutation.mutate({
      dealId,
      [field]: processedValue
    });
    
    setEditingCell(null);
    setCellEditValue('');
  };

  const handleCellKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveCellEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setCellEditValue('');
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

  // Add new deal function
  const addNewDeal = () => {
    const newDealData = {
      id: 'new-deal-temp',
      classification: '',
      analystNotes: '',
      nextSteps: '',
      assignedAnalyst: '',
      developer: '',
      partner: '',
      address: '',
      propertyName: '',
      productTypes: [],
      unitCount: '',
      sizeAcres: '',
      askingPrice: '',
      topRentPSF: '',
      yieldOnCost: '',
      hasEntitlements: false,
      sewerAvailable: false,
      population55Plus5Mile: '',
      income75Plus55Plus: '',
      demographicsNotes: '',
      broker: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        marketsCovered: ''
      }
    };
    
    startRowEdit('new-deal-temp', newDealData);
  };

  const saveNewDeal = () => {
    const newDealData = {
      dealId: 'new-deal-temp',
      isNewDeal: true,
      ...editData,
      // Convert string numbers back to numbers
      unitCount: editData.unitCount ? parseInt(editData.unitCount) : undefined,
      sizeAcres: editData.sizeAcres ? parseFloat(editData.sizeAcres) : undefined,
      yieldOnCost: editData.yieldOnCost ? parseFloat(editData.yieldOnCost) : undefined,
      population55Plus5Mile: editData.population55Plus5Mile ? parseInt(editData.population55Plus5Mile) : undefined,
      income75Plus55Plus: editData.income75Plus55Plus ? parseInt(editData.income75Plus55Plus) : undefined,
    };
    
    updateDealMutation.mutate(newDealData);
  };

  // Helper function to check if field is empty or needs attention
  const isFieldEmpty = (value: any): boolean => {
    return value === null || value === undefined || value === '' || value === 0;
  };

  // Handle quick classification changes
  const handleQuickClassification = (dealId: string, classification: string) => {
    if (classification === 'red') {
      // For rejections, show the rejection dialog
      const deal = deals?.find((d: any) => d.id === dealId);
      if (deal) {
        setShowRejectionDialog({
          dealId,
          dealAddress: deal.address || 'Unknown Address'
        });
      }
    } else {
      // For green/yellow, update directly
      updateDealMutation.mutate({
        dealId,
        classification
      });
    }
  };

  // Submit rejection with feedback
  const submitRejection = () => {
    if (!showRejectionDialog || !rejectionFeedback.trim()) return;
    
    updateDealMutation.mutate({
      dealId: showRejectionDialog.dealId,
      classification: 'red',
      rejectionReason: rejectionFeedback
    });
    
    setShowRejectionDialog(null);
    setRejectionFeedback('');
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
  
  // MSA Management handlers
  const handleMSAEdit = (market: AcquisitionMarket) => {
    setEditingMSA(market.id);
    setMSAEditData({ ...market });
  };
  
  const handleMSASave = () => {
    if (!editingMSA) return;
    updateMSAMutation.mutate({ id: editingMSA, ...msaEditData });
  };
  
  const handleMSACancel = () => {
    setEditingMSA(null);
    setMSAEditData({});
  };
  
  const handleMSADelete = (id: string, msaName: string, county: string) => {
    if (window.confirm(`Are you sure you want to delete ${msaName} - ${county}? This action cannot be undone.`)) {
      deleteMSAMutation.mutate(id);
    }
  };
  
  const handleMSACreate = () => {
    createMSAMutation.mutate(newMSAData);
  };
  
  const toggleMSAProductType = (marketId: string, productType: string) => {
    if (editingMSA === marketId) {
      const currentTypes = msaEditData.productTypes || [];
      const newTypes = currentTypes.includes(productType)
        ? currentTypes.filter((t: string) => t !== productType)
        : [...currentTypes, productType];
      setMSAEditData({ ...msaEditData, productTypes: newTypes });
    }
  };
  
  const toggleNewMSAProductType = (productType: string) => {
    const currentTypes = newMSAData.productTypes || [];
    const newTypes = currentTypes.includes(productType)
      ? currentTypes.filter((t: string) => t !== productType)
      : [...currentTypes, productType];
    setNewMSAData({ ...newMSAData, productTypes: newTypes });
  };

  const productTypeOptions = ["Active Adult", "BTR", "Conventional Apartments", "Lot Development"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#07172A] mb-2">
              {user?.role === 'SUPER_ADMIN' ? 'Admin Dashboard' : 'Deal Analysis Dashboard'}
            </h1>
            <p className="text-gray-600">
              {user?.role === 'SUPER_ADMIN' ? 'Manage deals and acquisition markets' : 'Review, analyze and manage property submissions'}
            </p>
          </div>
        </div>
        
        {/* Tabs for all authenticated users */}
        {user ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="deals" data-testid="tab-deals">
                <FileText className="h-4 w-4 mr-2" />
                Deals
              </TabsTrigger>
              <TabsTrigger value="msa" data-testid="tab-msa">
                <MapPin className="h-4 w-4 mr-2" />
                MSA
              </TabsTrigger>
              <TabsTrigger value="admin-tools" data-testid="tab-admin-tools">
                <Zap className="h-4 w-4 mr-2" />
                Admin Tools
              </TabsTrigger>
            </TabsList>
            
            {/* Deals Tab Content */}
            <TabsContent value="deals" className="mt-6 space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
              size="sm"
              onClick={() => exportToExcelMutation.mutate()}
              disabled={exportToExcelMutation.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            
            <Button
              variant="outline" 
              size="sm"
              onClick={() => autoClassifyMutation.mutate()}
              disabled={autoClassifyMutation.isPending}
            >
              <Zap className="h-4 w-4 mr-2" />
              Auto-Classify
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={generateAiSuggestions}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              AI Suggestions
            </Button>

            <Button
              size="sm"
              onClick={addNewDeal}
              data-testid="button-add-deal"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Deal
            </Button>
          </div>

        {/* Quick Property Evaluation */}
        <QuickPropertyEvaluation />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pursuing</p>
                  <p className="text-2xl font-bold text-green-600">{pursuingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Reviewing</p>
                  <p className="text-2xl font-bold text-yellow-600">{reviewingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Passed</p>
                  <p className="text-2xl font-bold text-red-600">{passedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-blue-600">{deals.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Classification Filter */}
              <Select value={filterClassification} onValueChange={setFilterClassification}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classifications</SelectItem>
                  <SelectItem value="green">Pursuing</SelectItem>
                  <SelectItem value="yellow">Reviewing</SelectItem>
                  <SelectItem value="red">Passed</SelectItem>
                  <SelectItem value="unclassified">Unclassified</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Market Filter */}
              <Select value={filterMarket} onValueChange={setFilterMarket}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by market" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Markets</SelectItem>
                  {uniqueMarkets.map((market) => (
                    <SelectItem key={market} value={market}>{market}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Product Type Filter */}
              <Select value={filterProductType} onValueChange={setFilterProductType}>
                <SelectTrigger>
                  <SelectValue placeholder="Product type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Product Types</SelectItem>
                  {uniqueProductTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Auto Mode Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-mode"
                  checked={autoMode}
                  onCheckedChange={setAutoMode}
                />
                <label htmlFor="auto-mode" className="text-sm font-medium">
                  Auto Mode
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedDeals.length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    {selectedDeals.length} selected
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearSelection}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkOperation('approve-all')}
                    disabled={bulkOperationMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkOperation('review-all')}
                    disabled={bulkOperationMutation.isPending}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Review All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkOperation('reject-all')}
                    disabled={bulkOperationMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBatchScore}
                    disabled={batchScoreMutation.isPending}
                  >
                    <Calculator className="h-4 w-4 mr-1" />
                    Score Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkOperation('delete-all')}
                    disabled={bulkOperationMutation.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Data Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedDeals.length === filteredAndSortedDeals.length && filteredAndSortedDeals.length > 0}
                        onChange={() => selectedDeals.length === filteredAndSortedDeals.length ? clearSelection() : selectAllDeals()}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <Button
                        variant="ghost"
                        className="font-semibold text-gray-700"
                        onClick={() => handleSort('dealNumber')}
                      >
                        Deal ID
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <Button
                        variant="ghost"
                        className="font-semibold text-gray-700"
                        onClick={() => handleSort('createdAt')}
                      >
                        Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <Button
                        variant="ghost"
                        className="font-semibold text-gray-700"
                        onClick={() => handleSort('address')}
                      >
                        Address
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </th>
                    <th className="px-4 py-3 text-left">Broker</th>
                    <th className="px-4 py-3 text-left">Details</th>
                    <th className="px-4 py-3 text-left">Classification</th>
                    <th className="px-4 py-3 text-left">Documents</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                    <th className="px-4 py-3 text-left">Dev Summary</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                        Loading deals...
                      </td>
                    </tr>
                  ) : filteredAndSortedDeals.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                        No deals found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedDeals.map((deal: any) => (
                      <tr key={deal.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedDeals.includes(deal.id)}
                            onChange={() => toggleDealSelection(deal.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-mono font-semibold text-sm text-catalyst-navy">
                            {deal.dealNumber ? formatDealNumber(deal.dealNumber) : 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatDate(deal.createdAt)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">
                            {editingCell?.dealId === deal.id && editingCell?.field === 'address' ? (
                              <Input
                                value={cellEditValue}
                                onChange={(e) => setCellEditValue(e.target.value)}
                                onBlur={saveCellEdit}
                                onKeyDown={handleCellKeyPress}
                                autoFocus
                                className="h-8"
                              />
                            ) : (
                              <div
                                onClick={() => startCellEdit(deal.id, 'address', deal.address)}
                                className="cursor-pointer hover:bg-gray-100 p-1 rounded"
                              >
                                {deal.address || 'Click to add address'}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {deal.unitCount && `${deal.unitCount} units`}
                            {deal.sizeAcres && ` • ${deal.sizeAcres} acres`}
                            {deal.askingPrice && ` • ${formatPrice(deal.askingPrice)}`}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {deal.broker?.firstName || deal.broker?.lastName ? (
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {deal.broker?.firstName} {deal.broker?.lastName}
                              </div>
                              <div className="text-gray-500">{deal.broker?.email}</div>
                              <div className="text-gray-500">{deal.broker?.phone}</div>
                              {deal.broker?.marketsCovered && (
                                <div className="text-xs text-blue-600 mt-1">
                                  Markets: {deal.broker.marketsCovered}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Select
                              value=""
                              onValueChange={(brokerId) => {
                                const selectedBroker = brokers.find((b: any) => b.id === brokerId);
                                if (selectedBroker) {
                                  updateDealMutation.mutate({
                                    dealId: deal.id,
                                    brokerId: selectedBroker.id,
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="w-[200px] h-8 text-xs" data-testid={`select-broker-${deal.id}`}>
                                <SelectValue placeholder="Search & assign broker..." />
                              </SelectTrigger>
                              <SelectContent>
                                <div className="px-2 py-1.5 text-xs text-gray-500">
                                  Select a broker to auto-populate info
                                </div>
                                {brokers.map((broker: any) => (
                                  <SelectItem 
                                    key={broker.id} 
                                    value={broker.id}
                                    data-testid={`broker-option-${broker.id}`}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {broker.firstName} {broker.lastName}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {broker.email} • {broker.phone}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="space-y-1">
                            {deal.productTypes && deal.productTypes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {deal.productTypes.map((type: string) => (
                                  <Badge key={type} variant="outline" className="text-xs">
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {deal.hasEntitlements && (
                              <Badge variant="secondary" className="text-xs">Entitled</Badge>
                            )}
                            {deal.sewerAvailable && (
                              <Badge variant="secondary" className="text-xs">Sewer</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={deal.classification === 'green' ? 'default' : 'outline'}
                              onClick={() => handleQuickClassification(deal.id, 'green')}
                              className={deal.classification === 'green' ? 'bg-green-500 hover:bg-green-600' : 'hover:bg-green-50'}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={deal.classification === 'yellow' ? 'default' : 'outline'}
                              onClick={() => handleQuickClassification(deal.id, 'yellow')}
                              className={deal.classification === 'yellow' ? 'bg-yellow-500 hover:bg-yellow-600' : 'hover:bg-yellow-50'}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={deal.classification === 'red' ? 'default' : 'outline'}
                              onClick={() => handleQuickClassification(deal.id, 'red')}
                              className={deal.classification === 'red' ? 'bg-red-500 hover:bg-red-600' : 'hover:bg-red-50'}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {deal.documentUrls && Array.isArray(deal.documentUrls) && deal.documentUrls.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {deal.documentUrls.map((url: string, index: number) => {
                                const filename = url.split('/').pop() || `Document ${index + 1}`;
                                return (
                                  <a
                                    key={index}
                                    href={`/api/deals/${deal.id}/document/${index}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[#4A90E2] hover:underline flex items-center gap-1"
                                    data-testid={`link-document-${deal.id}-${index}`}
                                  >
                                    <FileText className="h-3 w-3" />
                                    {filename.length > 20 ? filename.substring(0, 20) + '...' : filename}
                                  </a>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">No documents</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {editingCell?.dealId === deal.id && editingCell?.field === 'analystNotes' ? (
                            <Textarea
                              value={cellEditValue}
                              onChange={(e) => setCellEditValue(e.target.value)}
                              onBlur={saveCellEdit}
                              onKeyDown={handleCellKeyPress}
                              autoFocus
                              className="min-h-[60px]"
                            />
                          ) : (
                            <div
                              onClick={() => startCellEdit(deal.id, 'analystNotes', deal.analystNotes)}
                              className="cursor-pointer hover:bg-gray-100 p-2 rounded text-sm min-h-[60px]"
                            >
                              {deal.analystNotes || 'Click to add notes'}
                            </div>
                          )}
                        </td>
                        {/* Dev Summary */}
                        <td className="px-4 py-4">
                          <button
                            onClick={() => setSummaryDeal({ id: deal.id, address: deal.address || '', summary: (deal as any).developerSummary || '' })}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                              (deal as any).developerSummary
                                ? 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold'
                                : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            {(deal as any).developerSummary ? '📝 View/Edit' : '+ Add'}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startRowEdit(deal.id, deal)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteDeal(deal.id, deal.address)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
              </TabsContent>
            
            {/* MSA Management Tab Content */}
            <TabsContent value="msa" className="mt-6 space-y-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-semibold text-gray-900">MSA Target Markets</h2>
                    {user?.role === 'SUPER_ADMIN' && (
                      <Badge className="bg-purple-600 text-white">
                        SUPER_ADMIN
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage the {msaMarkets.length} acquisition markets across all product types
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowMSAForm(!showMSAForm)}
                    className="bg-[#4A90E2]"
                    data-testid="button-add-msa"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Market
                  </Button>
                  <Button
                    onClick={() => {
                      if (window.confirm('This will sync MSA data from the seed file. Any missing markets will be added. Continue?')) {
                        syncMSAMutation.mutate();
                      }
                    }}
                    variant="outline"
                    disabled={syncMSAMutation.isPending}
                    data-testid="button-sync-msa"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncMSAMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncMSAMutation.isPending ? 'Syncing...' : 'Sync from Seed'}
                  </Button>
                </div>
              </div>
              
              {/* Create New MSA Form */}
              {showMSAForm && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Create New Acquisition Market</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">MSA Name *</label>
                        <Input
                          value={newMSAData.msaName}
                          onChange={(e) => setNewMSAData({ ...newMSAData, msaName: e.target.value })}
                          placeholder="e.g., Charlotte MSA"
                          data-testid="input-new-msa-name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">County *</label>
                        <Input
                          value={newMSAData.county}
                          onChange={(e) => setNewMSAData({ ...newMSAData, county: e.target.value })}
                          placeholder="e.g., Mecklenburg"
                          data-testid="input-new-county"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">State *</label>
                        <Input
                          value={newMSAData.state}
                          onChange={(e) => setNewMSAData({ ...newMSAData, state: e.target.value.toUpperCase() })}
                          maxLength={2}
                          placeholder="NC"
                          data-testid="input-new-state"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Full County Name</label>
                        <Input
                          value={newMSAData.fullCountyName}
                          onChange={(e) => setNewMSAData({ ...newMSAData, fullCountyName: e.target.value })}
                          placeholder="e.g., Mecklenburg County, NC"
                          data-testid="input-new-full-county"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">City Note</label>
                        <Input
                          value={newMSAData.cityNote}
                          onChange={(e) => setNewMSAData({ ...newMSAData, cityNote: e.target.value })}
                          placeholder="e.g., (Charlotte)"
                          data-testid="input-new-city-note"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Active</label>
                        <Switch
                          checked={newMSAData.isActive}
                          onCheckedChange={(checked) => setNewMSAData({ ...newMSAData, isActive: checked })}
                          data-testid="switch-new-active"
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Product Types * (select at least one)</label>
                      <div className="flex flex-wrap gap-2">
                        {productTypeOptions.map((type) => (
                          <Button
                            key={type}
                            type="button"
                            size="sm"
                            variant={newMSAData.productTypes.includes(type) ? "default" : "outline"}
                            onClick={() => toggleNewMSAProductType(type)}
                            className={newMSAData.productTypes.includes(type) ? "bg-[#4A90E2]" : ""}
                            data-testid={`button-new-product-type-${type.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {type}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">Notes</label>
                      <Textarea
                        value={newMSAData.notes}
                        onChange={(e) => setNewMSAData({ ...newMSAData, notes: e.target.value })}
                        placeholder="Optional notes about this market"
                        data-testid="textarea-new-notes"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleMSACreate}
                        disabled={!newMSAData.msaName || !newMSAData.county || !newMSAData.state || newMSAData.productTypes.length === 0}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-create-msa"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Create Market
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowMSAForm(false);
                          setNewMSAData({
                            msaName: "",
                            county: "",
                            state: "",
                            fullCountyName: "",
                            cityNote: "",
                            productTypes: [],
                            isActive: true,
                            notes: ""
                          });
                        }}
                        data-testid="button-cancel-new-msa"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Affordable Housing QCT Exception Notice */}
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-amber-900 mb-1">Affordable Housing Exception: Qualified Census Tracts (QCT)</h3>
                      <p className="text-sm text-amber-800 leading-relaxed">
                        While the {msaMarkets.length} MSA markets below define our standard acquisition targets, 
                        <strong className="font-semibold"> Affordable Housing deals are accepted in ANY MSA nationwide</strong> if the property 
                        is located in a <strong className="font-semibold">Qualified Census Tract (QCT)</strong>. This exception overrides the geographic 
                        restrictions that apply to other product types, allowing us to pursue affordable housing opportunities across all 50 states when they meet QCT criteria.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* MSA Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">MSA Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">County</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">State</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Product Types</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Active</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Notes</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {msaLoading ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                              Loading MSA data...
                            </td>
                          </tr>
                        ) : msaMarkets.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                              No acquisition markets found
                            </td>
                          </tr>
                        ) : (
                          msaMarkets.map((market: AcquisitionMarket) => (
                            <tr key={market.id} className="hover:bg-gray-50" data-testid={`row-msa-${market.id}`}>
                              <td className="px-4 py-4">
                                {editingMSA === market.id ? (
                                  <Input
                                    value={msaEditData.msaName}
                                    onChange={(e) => setMSAEditData({ ...msaEditData, msaName: e.target.value })}
                                    data-testid={`input-edit-msa-name-${market.id}`}
                                  />
                                ) : (
                                  <span className="font-medium text-gray-900">{market.msaName}</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {editingMSA === market.id ? (
                                  <Input
                                    value={msaEditData.county}
                                    onChange={(e) => setMSAEditData({ ...msaEditData, county: e.target.value })}
                                    data-testid={`input-edit-county-${market.id}`}
                                  />
                                ) : (
                                  <span className="text-gray-700">{market.county}</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {editingMSA === market.id ? (
                                  <Input
                                    value={msaEditData.state}
                                    onChange={(e) => setMSAEditData({ ...msaEditData, state: e.target.value.toUpperCase() })}
                                    maxLength={2}
                                    data-testid={`input-edit-state-${market.id}`}
                                  />
                                ) : (
                                  <Badge variant="outline">{market.state}</Badge>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {editingMSA === market.id ? (
                                  <div className="flex flex-wrap gap-1">
                                    {productTypeOptions.map((type) => (
                                      <Button
                                        key={type}
                                        type="button"
                                        size="sm"
                                        variant={(msaEditData.productTypes || []).includes(type) ? "default" : "outline"}
                                        onClick={() => toggleMSAProductType(market.id, type)}
                                        className={(msaEditData.productTypes || []).includes(type) ? "bg-[#4A90E2] text-xs" : "text-xs"}
                                        data-testid={`button-edit-product-type-${type.toLowerCase().replace(/\s+/g, '-')}-${market.id}`}
                                      >
                                        {type}
                                      </Button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {(market.productTypes || []).map((type) => (
                                      <Badge key={type} variant="secondary" className="text-xs">
                                        {type}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {editingMSA === market.id ? (
                                  <Switch
                                    checked={msaEditData.isActive !== false}
                                    onCheckedChange={(checked) => setMSAEditData({ ...msaEditData, isActive: checked })}
                                    data-testid={`switch-edit-active-${market.id}`}
                                  />
                                ) : (
                                  <Badge variant={market.isActive ? "default" : "secondary"} className={market.isActive ? "bg-green-500" : ""}>
                                    {market.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {editingMSA === market.id ? (
                                  <Textarea
                                    value={msaEditData.notes || ""}
                                    onChange={(e) => setMSAEditData({ ...msaEditData, notes: e.target.value })}
                                    className="min-h-[60px]"
                                    data-testid={`textarea-edit-notes-${market.id}`}
                                  />
                                ) : (
                                  <span className="text-sm text-gray-600">{market.notes || "-"}</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {editingMSA === market.id ? (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={handleMSASave}
                                      className="bg-green-600 hover:bg-green-700"
                                      data-testid={`button-save-msa-${market.id}`}
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleMSACancel}
                                      data-testid={`button-cancel-edit-msa-${market.id}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleMSAEdit(market)}
                                      data-testid={`button-edit-msa-${market.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleMSADelete(market.id, market.msaName, market.county)}
                                      className="text-red-600 hover:text-red-700"
                                      data-testid={`button-delete-msa-${market.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Admin Tools Tab Content */}
            <TabsContent value="admin-tools" className="mt-6 space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    System Maintenance Tools
                  </h3>
                  
                  <div className="space-y-6">
                    {/* Census Data Backfill */}
                    <div className="p-4 border rounded-lg bg-blue-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-blue-900">Census Demographics Backfill</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Fetch Census data (population, income, age, vacancy rate) for all deals missing demographics.
                            This will also geocode any addresses that don't have coordinates yet.
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            if (window.confirm('This will geocode addresses and fetch Census data for all deals. This may take a few minutes. Continue?')) {
                              censusBackfillMutation.mutate();
                            }
                          }}
                          disabled={censusBackfillMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {censusBackfillMutation.isPending ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Run Census Backfill
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* QCT Status Backfill */}
                    <div className="p-4 border rounded-lg bg-green-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-green-900">QCT Status Backfill</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Update QCT (Qualified Census Tract) status for all deals. Deals with a stored
                            census FIPS code are checked instantly from the local dataset. Deals without a
                            FIPS code will be geocoded first (uses Geocodio API credits).
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            if (window.confirm('This will update QCT status for all deals. Deals without a FIPS code will be geocoded (uses API credits). Continue?')) {
                              qctBackfillMutation.mutate();
                            }
                          }}
                          disabled={qctBackfillMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 ml-4 shrink-0"
                        >
                          {qctBackfillMutation.isPending ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Run QCT Backfill
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* OZ Status Backfill */}
                    <div className="p-4 border rounded-lg bg-amber-50">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-medium text-amber-900">OZ Status Backfill</h4>
                          <p className="text-sm text-amber-700 mt-1">
                            Update Opportunity Zone status for all deals using the HUD ArcGIS dataset (8,765 tracts).
                            <strong className="font-semibold"> Standard</strong> fills in deals that have a stored FIPS code but no OZ status.
                            <strong className="font-semibold"> Force Re-geocode</strong> re-geocodes every deal from its
                            lat/lng to refresh the FIPS code (fixes any prior FIPS construction errors) and then re-checks OZ status for all deals.
                            The force option uses Geocodio API credits.
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            onClick={() => {
                              if (window.confirm('Fill in OZ status for deals that have a FIPS code but no OZ status. Continue?')) {
                                ozBackfillMutation.mutate();
                              }
                            }}
                            disabled={ozBackfillMutation.isPending || ozForceBackfillMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            {ozBackfillMutation.isPending ? (
                              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                            ) : (
                              <><RefreshCw className="h-4 w-4 mr-2" />Run OZ Backfill</>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (window.confirm('This will RE-GEOCODE every deal and refresh all OZ statuses. This uses Geocodio API credits. Continue?')) {
                                ozForceBackfillMutation.mutate();
                              }
                            }}
                            disabled={ozBackfillMutation.isPending || ozForceBackfillMutation.isPending}
                            className="border-amber-600 text-amber-700 hover:bg-amber-50"
                          >
                            {ozForceBackfillMutation.isPending ? (
                              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Re-geocoding...</>
                            ) : (
                              <><RefreshCw className="h-4 w-4 mr-2" />Force Re-geocode + OZ</>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}

        {/* Developer Summary Modal */}
        {summaryDeal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-base font-bold text-catalyst-navy">Developer Summary</h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate max-w-sm">{summaryDeal.address}</p>
                </div>
                <button onClick={() => setSummaryDeal(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <div className="px-6 py-5">
                <p className="text-xs text-gray-500 mb-2">This summary will be included in deal emails sent to partner developers.</p>
                <Textarea
                  value={summaryDeal.summary}
                  onChange={e => setSummaryDeal(s => s ? { ...s, summary: e.target.value } : null)}
                  placeholder="Write a brief summary of this deal for partner developers..."
                  rows={6}
                  className="w-full resize-none text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <Button variant="outline" onClick={() => setSummaryDeal(null)} className="h-8 text-sm">Cancel</Button>
                <Button
                  onClick={() => {
                    updateDealMutation.mutate({ dealId: summaryDeal.id, developerSummary: summaryDeal.summary });
                    setSummaryDeal(null);
                  }}
                  className="h-8 text-sm bg-catalyst-navy hover:bg-catalyst-navy/90 text-white"
                >
                  Save Summary
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Dialog */}
        {showRejectionDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-96 max-w-[90vw]">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">
                  Reject Deal: {showRejectionDialog.dealAddress}
                </h3>
                <Textarea
                  placeholder="Please provide feedback for the rejection..."
                  value={rejectionFeedback}
                  onChange={(e) => setRejectionFeedback(e.target.value)}
                  className="mb-4"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectionDialog(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={submitRejection}
                    disabled={!rejectionFeedback.trim()}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Submit Rejection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <Footer />
    </div>
    </div>
  );
}
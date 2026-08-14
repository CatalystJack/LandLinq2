import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import Navigation from "@/components/navigation";
import {
  Search, MapPin, DollarSign, Building, FileText, 
  RefreshCw, ExternalLink, Phone, Mail, Clock, User, Calendar,
  ArrowLeft, Filter, ChevronDown, ChevronUp, Layers, LandPlot,
  CheckCircle, XCircle, AlertCircle, HelpCircle, Download
} from "lucide-react";

interface Deal {
  id: string;
  dealNumber?: number;
  address?: string;
  city?: string;
  state?: string;
  county?: string;
  classification?: string;
  priority?: number;
  dealType?: string;
  productTypes?: string[];
  askingPrice?: number;
  unitCount?: number;
  sizeAcres?: number;
  vintage?: string;
  zoning?: string;
  hasEntitlements?: boolean;
  qctStatus?: string;
  assignedAnalyst?: string;
  assignedDeveloper?: string;
  assignedPartner?: string;
  nextAssignee?: string;
  dealStep?: string;
  analystNotes?: string;
  topRentPerUnit?: number;
  topRentPSF?: number;
  comparableNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  broker?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  documentUrls?: string[];
  analystDocumentUrls?: string[];
  brokerNotes?: string;
  rejectionReason?: string;
  propertyName?: string;
  population55Plus5Mile?: number;
  income75Plus55Plus?: number;
  aiExplanatoryNotes?: string;
  acceptanceReason?: string;
}

const classificationConfig: Record<string, { bg: string; border: string; text: string; icon: any; label: string }> = {
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: CheckCircle, label: 'Pursuing' },
  yellow: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertCircle, label: 'Reviewing' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: XCircle, label: 'Passed' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: HelpCircle, label: 'Unclassified' },
  lost: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', icon: XCircle, label: 'Lost' },
  closed: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: CheckCircle, label: 'Closed' },
};

const formatPrice = (price?: number) => {
  if (!price) return '-';
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
  return `$${price}`;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

export default function AnalystDashboardV2() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const exportCsvMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/deals/export/csv', { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deals-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: 'CSV downloaded' }),
    onError: () => toast({ title: 'Export failed', variant: 'destructive' }),
  });

  const { data: dealsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/deals', 'v2-all'],
    queryFn: async () => {
      const response = await fetch('/api/deals?limit=500&page=1', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch deals');
      return await response.json();
    },
  });

  const deals = (dealsData as any)?.deals || [];

  const filteredDeals = useMemo(() => {
    return deals.filter((deal: Deal) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          deal.address?.toLowerCase().includes(query) ||
          deal.city?.toLowerCase().includes(query) ||
          deal.state?.toLowerCase().includes(query) ||
          deal.dealNumber?.toString().includes(query) ||
          deal.broker?.firstName?.toLowerCase().includes(query) ||
          deal.broker?.lastName?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (statusFilter !== 'all' && deal.classification !== statusFilter) return false;
      if (typeFilter !== 'all' && deal.dealType !== typeFilter) return false;
      return true;
    });
  }, [deals, searchQuery, statusFilter, typeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: deals.length };
    deals.forEach((deal: Deal) => {
      const status = deal.classification || 'blue';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [deals]);

  const dealTypes = useMemo(() => {
    const types = new Set<string>();
    deals.forEach((deal: Deal) => {
      if (deal.dealType) types.add(deal.dealType);
    });
    return Array.from(types);
  }, [deals]);

  const toggleExpand = (dealId: string) => {
    setExpandedDealId(expandedDealId === dealId ? null : dealId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/launchpad')}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <h1 className="text-xl font-bold text-gray-900">Deal Pipeline</h1>
              <Badge variant="secondary" className="text-sm">{filteredDeals.length} deals</Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-56 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({statusCounts.all || 0})</SelectItem>
                  <SelectItem value="green">Pursuing ({statusCounts.green || 0})</SelectItem>
                  <SelectItem value="yellow">Reviewing ({statusCounts.yellow || 0})</SelectItem>
                  <SelectItem value="red">Passed ({statusCounts.red || 0})</SelectItem>
                  <SelectItem value="blue">Unclassified ({statusCounts.blue || 0})</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {dealTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCsvMutation.mutate()}
                disabled={exportCsvMutation.isPending}
                className="text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600"
              >
                <Download className="w-4 h-4 mr-1" />
                {exportCsvMutation.isPending ? 'Exporting...' : 'Export CSV'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/analyst-dashboard')}>
                Classic View
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Deal Cards */}
      <div className="max-w-7xl mx-auto p-4">
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="space-y-3 pb-8">
            {filteredDeals.map((deal: Deal) => {
              const config = classificationConfig[deal.classification || 'blue'] || classificationConfig.blue;
              const StatusIcon = config.icon;
              const isExpanded = expandedDealId === deal.id;
              const brokerName = deal.broker ? `${deal.broker.firstName || ''} ${deal.broker.lastName || ''}`.trim() : null;
              
              return (
                <div
                  key={deal.id}
                  className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all ${config.border}`}
                >
                  {/* Card Header - Always Visible */}
                  <div 
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'border-b' : ''}`}
                    onClick={() => toggleExpand(deal.id)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.bg} flex items-center justify-center`}>
                        <StatusIcon className={`w-5 h-5 ${config.text}`} />
                      </div>
                      
                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-400">#{deal.dealNumber}</span>
                          <Badge variant="outline" className={`text-xs ${config.text} ${config.bg} border-0`}>
                            {config.label}
                          </Badge>
                          {deal.priority && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                              P{deal.priority}
                            </Badge>
                          )}
                          {deal.dealType && (
                            <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                              {deal.dealType}
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 truncate">{deal.address || 'No address'}</h3>
                        <p className="text-sm text-gray-500">
                          {[deal.city, deal.county, deal.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      
                      {/* Key Metrics - Compact Grid */}
                      <div className="hidden md:grid grid-cols-4 gap-4 text-center flex-shrink-0">
                        <div className="px-3">
                          <div className="text-xs text-gray-400 mb-0.5">Price</div>
                          <div className="font-semibold text-gray-900">{formatPrice(deal.askingPrice)}</div>
                        </div>
                        <div className="px-3">
                          <div className="text-xs text-gray-400 mb-0.5">Units</div>
                          <div className="font-semibold text-gray-900">{deal.unitCount || '-'}</div>
                        </div>
                        <div className="px-3">
                          <div className="text-xs text-gray-400 mb-0.5">Acres</div>
                          <div className="font-semibold text-gray-900">{deal.sizeAcres ? Number(deal.sizeAcres).toFixed(1) : '-'}</div>
                        </div>
                        <div className="px-3">
                          <div className="text-xs text-gray-400 mb-0.5">Vintage</div>
                          <div className="font-semibold text-gray-900">{deal.vintage || '-'}</div>
                        </div>
                      </div>
                      
                      {/* Expand Button */}
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </Button>
                    </div>
                    
                    {/* Mobile Metrics Row */}
                    <div className="md:hidden flex items-center gap-4 mt-3 pt-3 border-t text-sm">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                        {formatPrice(deal.askingPrice)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-gray-400" />
                        {deal.unitCount || '-'} units
                      </span>
                      <span className="flex items-center gap-1">
                        <LandPlot className="w-3.5 h-3.5 text-gray-400" />
                        {deal.sizeAcres ? `${Number(deal.sizeAcres).toFixed(1)} ac` : '-'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="p-4 bg-gray-50">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Column 1: Property Details */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Property Details</h4>
                            <div className="bg-white rounded-lg p-3 space-y-2">
                              <InfoRow label="Product Types" value={deal.productTypes?.join(', ')} />
                              <InfoRow label="Zoning" value={deal.zoning} />
                              <InfoRow label="Entitlements" value={deal.hasEntitlements ? 'Yes' : 'No'} />
                              <InfoRow label="QCT Status" value={deal.qctStatus} />
                            </div>
                          </div>
                          
                          {/* Market Data */}
                          {(deal.topRentPerUnit || deal.population55Plus5Mile) && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Market Data</h4>
                              <div className="bg-white rounded-lg p-3 space-y-2">
                                {deal.topRentPerUnit && (
                                  <InfoRow label="Top Rent" value={`$${deal.topRentPerUnit}/unit`} />
                                )}
                                {deal.topRentPSF && (
                                  <InfoRow label="Top Rent PSF" value={`$${deal.topRentPSF}`} />
                                )}
                                {deal.population55Plus5Mile && (
                                  <InfoRow label="55+ Pop (5mi)" value={deal.population55Plus5Mile.toLocaleString()} />
                                )}
                                {deal.income75Plus55Plus && (
                                  <InfoRow label="$75K+ Income 55+" value={deal.income75Plus55Plus.toLocaleString()} />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Column 2: Team & Broker */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Team</h4>
                            <div className="bg-white rounded-lg p-3 space-y-2">
                              <InfoRow label="Analyst" value={deal.assignedAnalyst} />
                              <InfoRow label="Developer" value={deal.assignedDeveloper} />
                              <InfoRow label="Partner" value={deal.assignedPartner} />
                              {deal.dealStep && <InfoRow label="Deal Step" value={deal.dealStep} />}
                            </div>
                          </div>
                          
                          {deal.broker && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Broker</h4>
                              <div className="bg-white rounded-lg p-3">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                                    <User className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">{brokerName || 'Unknown'}</div>
                                    <div className="text-xs text-gray-500">{deal.broker.company || '-'}</div>
                                  </div>
                                </div>
                                {deal.broker.email && (
                                  <a href={`mailto:${deal.broker.email}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline mb-1">
                                    <Mail className="w-3 h-3" />
                                    {deal.broker.email}
                                  </a>
                                )}
                                {deal.broker.phone && (
                                  <a href={`tel:${deal.broker.phone}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                                    <Phone className="w-3 h-3" />
                                    {deal.broker.phone}
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Column 3: Notes & Reasons */}
                        <div className="space-y-4">
                          {deal.acceptanceReason && (
                            <div>
                              <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Acceptance Reason</h4>
                              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800 border border-green-200">
                                {deal.acceptanceReason}
                              </div>
                            </div>
                          )}
                          
                          {deal.rejectionReason && (
                            <div>
                              <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Rejection Reason</h4>
                              <div className="bg-red-50 rounded-lg p-3 text-sm text-red-800 border border-red-200">
                                {deal.rejectionReason}
                              </div>
                            </div>
                          )}
                          
                          {deal.aiExplanatoryNotes && (
                            <div>
                              <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">AI Analysis</h4>
                              <div className="bg-purple-50 rounded-lg p-3 text-sm text-purple-800 border border-purple-200 max-h-32 overflow-y-auto">
                                {deal.aiExplanatoryNotes}
                              </div>
                            </div>
                          )}
                          
                          {deal.analystNotes && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Analyst Notes</h4>
                              <div className="bg-white rounded-lg p-3 text-sm text-gray-700 border max-h-24 overflow-y-auto">
                                {deal.analystNotes}
                              </div>
                            </div>
                          )}
                          
                          {/* Timestamps & Actions */}
                          <div className="flex items-center justify-between pt-2">
                            <div className="text-xs text-gray-400 flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(deal.createdAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(deal.updatedAt)}
                              </span>
                            </div>
                            <Button size="sm" onClick={() => navigate(`/deal/${deal.id}`)}>
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Full Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {filteredDeals.length === 0 && (
              <div className="bg-white rounded-lg border p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No deals found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value || '-'}</span>
    </div>
  );
}

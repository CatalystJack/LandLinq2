import Footer from "@/components/footer";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  FileText,
  TrendingUp,
  Search,
  Filter,
  MoreHorizontal,
  RefreshCw,
  User,
  Calendar,
  MapPin,
  DollarSign,
  Home,
  BarChart3,
  AlertCircle,
  Zap,
  Target,
  Shield,
  Users
} from "lucide-react";

// Review queue item interface
interface ReviewQueueItem {
  id: string;
  dealId: string;
  deal?: {
    id: string;
    dealNumber: number;
    address: string;
    askingPrice?: number;
    sizeAcres?: number;
    broker?: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  overallConfidence: number;
  triggerReason: string;
  specificIssues: Array<{
    type: string;
    field: string;
    confidence: number;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  addressConfidence: number;
  sizeConfidence: number;
  valuationConfidence: number;
  demographicsConfidence: number;
  rentDataConfidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending_review' | 'assigned' | 'in_review' | 'needs_more_info' | 'approved' | 'rejected';
  assignedAnalyst?: string;
  assignedAt?: Date;
  flaggedAt: Date;
  targetCompletionDate?: Date;
  sourceDataSnapshot: any;
  discrepancies: string[];
  sourcesUsed: string[];
  reviewNotes?: string;
  resolution?: string;
  reviewCompletedAt?: Date;
}

// Statistics interface
interface ReviewQueueStats {
  totalQueued: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  averageWaitTime: number;
  overdueReviews: number;
}

// Team members for assignment
const teamMembers = [
  "Austin Blondell",
  "Davis Hammond",
  "Steve Hillebrand", 
  "John Bell",
  "Mallie Colavita"
];

// Data correction form schema
const correctionSchema = z.object({
  field: z.string().min(1, "Field is required"),
  originalValue: z.string(),
  correctedValue: z.string().min(1, "Corrected value is required"),
  justification: z.string().min(10, "Please provide justification for the correction"),
  confidence: z.number().min(0).max(100)
});

// Review action form schema
const reviewActionSchema = z.object({
  action: z.enum(["approve", "reject", "needs_more_info"]),
  notes: z.string().min(5, "Please provide review notes"),
  corrections: z.array(correctionSchema).optional()
});

export default function AnalystReviewQueue() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [showDataOverride, setShowDataOverride] = useState(false);
  const [correctionData, setCorrectionData] = useState<{[key: string]: any}>({});

  // Forms
  const correctionForm = useForm({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      field: "",
      originalValue: "",
      correctedValue: "",
      justification: "",
      confidence: 95
    }
  });

  const reviewForm = useForm({
    resolver: zodResolver(reviewActionSchema),
    defaultValues: {
      action: "approve" as const,
      notes: "",
      corrections: []
    }
  });

  // Fetch review queue with filters
  const { data: reviewData, isLoading, error } = useQuery({
    queryKey: ['/api/analyst/review-queue', currentPage, pageSize, priorityFilter, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery })
      });
      
      const response = await fetch(`/api/analyst/review-queue?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch review queue');
      }
      return await response.json();
    },
  });

  // Fetch review queue statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/analyst/review-queue/stats'],
    queryFn: async () => {
      const response = await fetch('/api/analyst/review-queue/stats', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return await response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const reviewItems = reviewData?.items || [];
  const totalPages = reviewData?.totalPages || 1;
  const totalReviews = reviewData?.total || 0;

  // Priority colors and icons
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    if (confidence >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_review': return <Clock className="w-4 h-4" />;
      case 'assigned': return <User className="w-4 h-4" />;
      case 'in_review': return <Eye className="w-4 h-4" />;
      case 'needs_more_info': return <AlertCircle className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Update review status mutation
  const updateReviewMutation = useMutation({
    mutationFn: async (data: { reviewId: string; action: string; notes: string; corrections?: any[] }) => {
      if (data.action === 'correct_data' && data.corrections) {
        // Submit data corrections
        for (const correction of data.corrections) {
          await apiRequest("POST", `/api/analyst/review-queue/${data.reviewId}/corrections`, correction);
        }
      }
      
      // Update review status
      return await apiRequest("PUT", `/api/analyst/review-queue/${data.reviewId}`, {
        status: data.action === 'approve' ? 'approved' : data.action === 'reject' ? 'rejected' : 'needs_more_info',
        notes: data.notes,
        resolution: data.action
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analyst/review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analyst/review-queue/stats'] });
      toast({
        title: "Review Updated",
        description: "Review status has been successfully updated.",
      });
      setSelectedReviewId(null);
      setShowDataOverride(false);
      reviewForm.reset();
      correctionForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assign review mutation
  const assignReviewMutation = useMutation({
    mutationFn: async (data: { reviewId: string; analystId: string }) => {
      return await apiRequest("POST", `/api/analyst/review-queue/${data.reviewId}/assign`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analyst/review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analyst/review-queue/stats'] });
      toast({
        title: "Review Assigned",
        description: "Review has been assigned successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Assignment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle review action submission
  const handleReviewAction = (data: any) => {
    if (!selectedReviewId) return;
    
    updateReviewMutation.mutate({
      reviewId: selectedReviewId,
      action: data.action,
      notes: data.notes,
      corrections: Object.keys(correctionData).length > 0 ? 
        Object.entries(correctionData).map(([field, value]) => ({
          field,
          originalValue: value.original,
          correctedValue: value.corrected,
          justification: value.justification,
          confidence: 95
        })) : undefined
    });
  };

  // Handle data correction
  const handleDataCorrection = (field: string, originalValue: any, correctedValue: any, justification: string) => {
    setCorrectionData(prev => ({
      ...prev,
      [field]: {
        original: originalValue,
        corrected: correctedValue,
        justification
      }
    }));
  };

  if (!isAuthenticated) {
    return <div className="p-8 text-center">Please log in to access the review queue.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="title-review-queue">
            Manual Review Queue
          </h1>
          <p className="text-gray-600" data-testid="subtitle-review-queue">
            Review and verify deals with low confidence scores or data discrepancies
          </p>
        </div>

        {/* Statistics Dashboard */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="stat-total-queued">{stats.totalQueued}</div>
                    <div className="text-sm text-gray-600">Total Queued</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="stat-critical">{stats.byPriority.critical || 0}</div>
                    <div className="text-sm text-gray-600">Critical</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="stat-high">{stats.byPriority.high || 0}</div>
                    <div className="text-sm text-gray-600">High Priority</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="stat-avg-wait">{Math.round(stats.averageWaitTime)}h</div>
                    <div className="text-sm text-gray-600">Avg Wait Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="stat-overdue">{stats.overdueReviews}</div>
                    <div className="text-sm text-gray-600">Overdue</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-64">
                <Input
                  placeholder="Search by deal number, address, or broker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                  className="w-full"
                />
              </div>
              
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40" data-testid="select-priority">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="needs_more_info">Needs More Info</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/analyst/review-queue'] })}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Review Queue Table */}
        <Card>
          <CardHeader>
            <CardTitle>Review Queue ({totalReviews} items)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading review queue...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">Error loading review queue</div>
            ) : reviewItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No reviews found matching your criteria</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewItems.map((item: ReviewQueueItem) => (
                      <TableRow key={item.id} data-testid={`row-review-${item.id}`}>
                        <TableCell>
                          <div className="font-medium">#{item.deal?.dealNumber || 'N/A'}</div>
                          <div className="text-sm text-gray-500">
                            {item.deal?.broker?.firstName} {item.deal?.broker?.lastName}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="max-w-48 truncate">{item.deal?.address || 'No address'}</div>
                          {item.deal?.askingPrice && (
                            <div className="text-sm text-gray-500">
                              ${item.deal.askingPrice.toLocaleString()}
                            </div>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className={`font-medium ${getConfidenceColor(item.overallConfidence)}`}>
                            {item.overallConfidence}%
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>Addr: {item.addressConfidence}%</div>
                            <div>Size: {item.sizeConfidence}%</div>
                            <div>Value: {item.valuationConfidence}%</div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge className={getPriorityColor(item.priority)} data-testid={`badge-priority-${item.priority}`}>
                            {item.priority.toUpperCase()}
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(item.status)}
                            <span className="text-sm capitalize">{item.status.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm">
                            {item.specificIssues.length} issue{item.specificIssues.length !== 1 ? 's' : ''}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-32">
                            {item.triggerReason.replace('_', ' ')}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {item.assignedAnalyst ? (
                            <div className="text-sm">{item.assignedAnalyst}</div>
                          ) : (
                            <Select onValueChange={(analystId) => assignReviewMutation.mutate({ reviewId: item.id, analystId })}>
                              <SelectTrigger className="w-32" data-testid={`select-assign-${item.id}`}>
                                <SelectValue placeholder="Assign" />
                              </SelectTrigger>
                              <SelectContent>
                                {teamMembers.map(member => (
                                  <SelectItem key={member} value={member}>{member}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedReviewId(item.id)}
                                data-testid={`button-review-${item.id}`}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Review Deal #{item.deal?.dealNumber} - {item.deal?.address}</DialogTitle>
                              </DialogHeader>
                              
                              <ReviewDetailModal 
                                reviewItem={item} 
                                onAction={handleReviewAction}
                                onCorrection={handleDataCorrection}
                                correctionData={correctionData}
                                form={reviewForm}
                                isUpdating={updateReviewMutation.isPending}
                              />
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center space-x-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <span className="flex items-center px-4 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// Review Detail Modal Component
function ReviewDetailModal({ 
  reviewItem, 
  onAction, 
  onCorrection, 
  correctionData, 
  form, 
  isUpdating 
}: {
  reviewItem: ReviewQueueItem;
  onAction: (data: any) => void;
  onCorrection: (field: string, original: any, corrected: any, justification: string) => void;
  correctionData: any;
  form: any;
  isUpdating: boolean;
}) {
  const [activeTab, setActiveTab] = useState("issues");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [correctionJustification, setCorrectionJustification] = useState("");

  const sourceData = reviewItem.sourceDataSnapshot;
  
  const dataFields = [
    { key: 'address', label: 'Address', value: sourceData?.address?.standardized, confidence: reviewItem.addressConfidence },
    { key: 'size', label: 'Size (Acres)', value: sourceData?.size?.acres, confidence: reviewItem.sizeConfidence },
    { key: 'valuation', label: 'Market Value', value: sourceData?.valuation?.marketValue, confidence: reviewItem.valuationConfidence },
    { key: 'demographics', label: 'Population 55+', value: sourceData?.demographics?.population55Plus, confidence: reviewItem.demographicsConfidence },
    { key: 'rentData', label: 'Average Rent', value: sourceData?.rentData?.averageRent, confidence: reviewItem.rentDataConfidence }
  ];

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Deal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-medium">Deal #:</span> {reviewItem.deal?.dealNumber}
            </div>
            <div>
              <span className="font-medium">Address:</span> {reviewItem.deal?.address}
            </div>
            <div>
              <span className="font-medium">Asking Price:</span> ${reviewItem.deal?.askingPrice?.toLocaleString() || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Broker:</span> {reviewItem.deal?.broker?.firstName} {reviewItem.deal?.broker?.lastName}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Review Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-medium">Overall Confidence:</span> 
              <span className={`ml-2 font-bold ${reviewItem.overallConfidence < 70 ? 'text-red-600' : reviewItem.overallConfidence < 85 ? 'text-yellow-600' : 'text-green-600'}`}>
                {reviewItem.overallConfidence}%
              </span>
            </div>
            <div>
              <span className="font-medium">Priority:</span> 
              <Badge className={`ml-2 ${reviewItem.priority === 'critical' ? 'bg-red-100 text-red-800' : reviewItem.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {reviewItem.priority.toUpperCase()}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Trigger Reason:</span> {reviewItem.triggerReason.replace('_', ' ')}
            </div>
            <div>
              <span className="font-medium">Sources Used:</span> {reviewItem.sourcesUsed.join(', ')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Review Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="issues" data-testid="tab-issues">Issues ({reviewItem.specificIssues.length})</TabsTrigger>
          <TabsTrigger value="data" data-testid="tab-data">Data Fields</TabsTrigger>
          <TabsTrigger value="discrepancies" data-testid="tab-discrepancies">Discrepancies ({reviewItem.discrepancies.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Specific Issues Identified</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reviewItem.specificIssues.map((issue, index) => (
                  <div key={index} className="border rounded-lg p-4" data-testid={`issue-${index}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {issue.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{issue.field}</span>
                      </div>
                      <span className="text-sm text-gray-500">{issue.confidence}% confidence</span>
                    </div>
                    <p className="text-gray-700">{issue.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Fields Review & Override</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dataFields.map((field) => (
                  <div key={field.key} className="border rounded-lg p-4" data-testid={`field-${field.key}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{field.label}</span>
                        <Badge variant={field.confidence < 80 ? 'destructive' : field.confidence < 90 ? 'secondary' : 'default'}>
                          {field.confidence}% confidence
                        </Badge>
                      </div>
                      {editingField !== field.key && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingField(field.key)}
                          data-testid={`button-edit-${field.key}`}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Override
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-500">Current Value:</span>
                        <div className="font-mono bg-gray-50 p-2 rounded">
                          {field.value?.toString() || 'No data'}
                        </div>
                      </div>
                      
                      {correctionData[field.key] && (
                        <div>
                          <span className="text-sm text-green-600">Corrected Value:</span>
                          <div className="font-mono bg-green-50 p-2 rounded">
                            {correctionData[field.key].corrected}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <strong>Justification:</strong> {correctionData[field.key].justification}
                          </div>
                        </div>
                      )}
                      
                      {editingField === field.key && (
                        <div className="space-y-3 border-t pt-3">
                          <div>
                            <label className="text-sm font-medium">Corrected Value</label>
                            <Input 
                              defaultValue={field.value?.toString() || ''}
                              onChange={(e) => setCorrectionData(prev => ({
                                ...prev,
                                [field.key]: { ...prev[field.key], corrected: e.target.value }
                              }))}
                              data-testid={`input-correct-${field.key}`}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Justification for Correction</label>
                            <Textarea 
                              placeholder="Explain why this correction is necessary..."
                              onChange={(e) => setCorrectionJustification(e.target.value)}
                              data-testid={`textarea-justify-${field.key}`}
                            />
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm"
                              onClick={() => {
                                onCorrection(field.key, field.value, correctionData[field.key]?.corrected, correctionJustification);
                                setEditingField(null);
                                setCorrectionJustification("");
                              }}
                              data-testid={`button-save-${field.key}`}
                            >
                              Save Correction
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingField(null)}
                              data-testid={`button-cancel-${field.key}`}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discrepancies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Source Discrepancies</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewItem.discrepancies.length === 0 ? (
                <p className="text-gray-500">No discrepancies found between data sources.</p>
              ) : (
                <div className="space-y-3">
                  {reviewItem.discrepancies.map((discrepancy, index) => (
                    <div key={index} className="border rounded-lg p-4" data-testid={`discrepancy-${index}`}>
                      <div className="text-sm text-gray-700">{discrepancy}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Review Decision</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAction)} className="space-y-4">
              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-review-action">
                          <SelectValue placeholder="Select review action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="approve">Approve - Data is accurate</SelectItem>
                        <SelectItem value="reject">Reject - Data quality issues</SelectItem>
                        <SelectItem value="needs_more_info">Needs More Info - Request additional data</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide detailed notes about your review decision..."
                        {...field}
                        data-testid="textarea-review-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3">
                <Button type="submit" disabled={isUpdating} data-testid="button-submit-review">
                  {isUpdating ? "Updating..." : "Submit Review"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import SEO from "@/components/SEO";
import type { Deal } from "@shared/schema";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Edit, Save, X, ChevronDown, ChevronUp, TrendingUp, Clock, AlertCircle, FileText, ExternalLink, Copy, CheckCircle, Mail } from "lucide-react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useLocation } from "wouter";

export default function MySubmissions() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [stageFilter, setStageFilter] = useState<string>("all-stages");
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());
  const [editingDeal, setEditingDeal] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  
  // Broker submissions are private and must never fall back to production demo data.
  const {
    data: deals = [],
    isLoading,
    isError,
    error,
    refetch: refetchDeals
  } = useQuery<Deal[]>({
    queryKey: ["/api/broker/deals"],
    enabled: isAuthenticated && !authLoading,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update deal mutation
  const updateDealMutation = useMutation({
    mutationFn: async (data: { dealId: string; [key: string]: any }) => {
      const { dealId, ...updateData } = data;
      return await apiRequest("PUT", `/api/broker/deals/${dealId}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker/deals"] });
      console.log("Deal Updated: Your deal has been successfully updated.");
      setEditingDeal(null);
      setEditFormData({});
    },
    onError: (error: any) => {
      console.error("Update Failed:", error?.message || "Failed to update deal");
    },
  });

  // Filter deals based on stage
  const filteredDeals = deals.filter(deal => {
    if (stageFilter === "all-stages") return true;
    if (stageFilter === "green") return deal.classification === "green";
    if (stageFilter === "yellow") return deal.classification === "yellow";
    if (stageFilter === "red") return deal.classification === "red";
    return true;
  });

  // Toggle deal expansion
  const toggleDealExpansion = (dealId: string) => {
    const newExpanded = new Set(expandedDeals);
    if (newExpanded.has(dealId)) {
      newExpanded.delete(dealId);
    } else {
      newExpanded.add(dealId);
    }
    setExpandedDeals(newExpanded);
  };

  // Start editing a deal
  const startEditing = (deal: Deal) => {
    setEditingDeal(deal.id);
    setEditFormData({
      address: deal.address || '',
      propertyName: deal.propertyName || '',
      askingPrice: deal.askingPrice || '',
      pricingType: deal.pricingType || 'whole_deal',
      sizeAcres: deal.sizeAcres || '',
      unitCount: deal.unitCount || '',
      unitSize: deal.unitSize || '',
      hasEntitlements: deal.hasEntitlements || false,
      sewerAvailable: deal.sewerAvailable || false,
      topRentPSF: deal.topRentPSF || '',
      productTypes: Array.isArray(deal.productTypes) ? deal.productTypes : [],
      brokerNotes: deal.brokerNotes || '',
      brokerPhone: deal.brokerPhone || '',
      parcelId: deal.parcelId || '',
      zoning: deal.zoning || ''
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingDeal(null);
    setEditFormData({});
  };

  // Save deal changes
  const saveDealChanges = (dealId: string) => {
    updateDealMutation.mutate({
      dealId,
      ...editFormData
    });
  };

  // Share deal via email functionality
  const handleShareDeal = async (deal: Deal) => {
    try {
      const response = await fetch(`/api/deals/${deal.id}/share`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Could not create share link");
      const shareUrl = `${window.location.origin}/deals/${deal.id}?token=${encodeURIComponent(payload.token)}`;
    
    // Create formatted email
    const subject = `Investment Opportunity: ${deal.address}`;
    const body = `Hi,

I wanted to share this land development opportunity with you:

📍 Property: ${deal.address}
💰 Price: ${formatPrice(deal.askingPrice)}
📏 Size: ${deal.sizeAcres || 'N/A'} Acres
${deal.classification === 'green' ? '✅ Status: Pursuing' : deal.classification === 'yellow' ? '⏱️ Status: Under Review' : ''}

View full details here:
${shareUrl}

Best regards`;

    // Open email client with pre-filled content
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoLink;
    } catch (error: any) {
      toast({ title: "Could not share deal", description: error.message, variant: "destructive" });
    }
  };

  // Handle authentication errors
  useEffect(() => {
    if (isError && error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to view your submissions.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
        return;
      }
      
      // Don't show error toasts for broker deals fetch errors - handle gracefully
      if (!error.message?.includes("Failed to fetch broker deals")) {
        toast({
          title: "Error Loading Deals",
          description: "Failed to load your deal submissions. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [isError, error, toast]);

  const getStatusBadge = (status: string, classification?: string | null) => {
    // Show colored badges with icons for classified deals
    if (classification === "green") {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <TrendingUp className="mr-1" size={12} />
          <span className="hidden sm:inline">Pursuing</span>
          <span className="sm:hidden">✅</span>
        </Badge>
      );
    }
    if (classification === "yellow") {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="mr-1" size={12} />
          <span className="hidden sm:inline">Reviewing</span>
          <span className="sm:hidden">⏱️</span>
        </Badge>
      );
    }
    if (classification === "red") {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <AlertCircle className="mr-1" size={12} />
          <span className="hidden sm:inline">Passed</span>
          <span className="sm:hidden">❌</span>
        </Badge>
      );
    }
    
    switch (status) {
      case "pending_review":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <span className="hidden sm:inline">Pending Review</span>
            <span className="sm:hidden">⏳</span>
          </Badge>
        );
      case "unclassified":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <Clock className="mr-1" size={12} />
            <span className="hidden sm:inline">Unclassified</span>
            <span className="sm:hidden">📋</span>
          </Badge>
        );
      case "approved":
      case "high_priority":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <TrendingUp className="mr-1" size={12} />
            <span className="hidden sm:inline">Pursuing</span>
            <span className="sm:hidden">✅</span>
          </Badge>
        );
      case "rejected":
      case "clear_no":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <AlertCircle className="mr-1" size={12} />
            <span className="hidden sm:inline">Passed</span>
            <span className="sm:hidden">❌</span>
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <span className="hidden sm:inline">Pending</span>
            <span className="sm:hidden">⏳</span>
          </Badge>
        );
    }
  };

  const formatPrice = (price?: string | null) => {
    if (!price) return "N/A";
    const num = parseFloat(price);
    if (isNaN(num)) return price;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Handle authentication errors
  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  // Show loading state
  if (authLoading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-catalyst-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-catalyst-gold mx-auto"></div>
            <p className="mt-2 text-catalyst-gray-600">Loading...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Show general error state (only for actual errors, not empty states)
  if (isError && error && !error.message?.includes("Failed to fetch broker deals")) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-catalyst-gray-50 py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-catalyst-gray-900 mb-4">My Submissions</h1>
              <p className="text-catalyst-navy mb-4">Error loading your submissions: {error.message}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEO 
        title="My Submissions - Broker Dashboard"
        description="Track your land deal submissions, view status updates, edit property details, and monitor progress. Real-time updates on all your submitted multifamily development opportunities."
        keywords="broker dashboard, deal tracking, submission status, property management, land deal updates, broker portal"
        url="https://landlinq.ai/my-submissions"
      />
      <Navigation />
      <div className="min-h-screen bg-catalyst-gray-50">
        <div className="py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-catalyst-gray-900 mb-4 sm:mb-6 tracking-tight" data-testid="text-submissions-title">
                Deal Pipeline
              </h1>
              <p className="text-lg sm:text-xl text-catalyst-gray-600 font-light">
                Track your deals as they move through our evaluation process
              </p>
            </div>

            {/* Stats Summary - Horizontal Layout */}
            <div className="mb-8">
              <div className="flex items-center justify-center space-x-8 md:space-x-16 bg-white rounded-lg border border-catalyst-gray-200 py-6 px-4 shadow-sm">
                {/* Total Deals */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-catalyst-gray-100 rounded-full flex items-center justify-center">
                    <FileText className="h-5 w-5 text-catalyst-gray-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-catalyst-gray-500">{deals.length}</p>
                    <p className="text-sm text-catalyst-gray-500 uppercase tracking-wider">Total Deals</p>
                  </div>
                </div>
                
                {/* Pursuing */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-catalyst-gold/10 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-catalyst-gold" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-catalyst-gray-500">
                      {deals.filter(d => d.classification === "green").length}
                    </p>
                    <p className="text-sm text-catalyst-gray-500 uppercase tracking-wider">Pursuing</p>
                  </div>
                </div>
                
                {/* Reviewing */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-catalyst-gray-500">
                      {deals.filter(d => d.classification === "yellow").length}
                    </p>
                    <p className="text-sm text-catalyst-gray-500 uppercase tracking-wider">Reviewing</p>
                  </div>
                </div>
                
                {/* Passed */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-catalyst-gray-500">
                      {deals.filter(d => d.classification === "red").length}
                    </p>
                    <p className="text-sm text-catalyst-gray-500 uppercase tracking-wider">Passed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center mb-4 sm:mb-8">
              <Button
                onClick={() => setStageFilter("all-stages")}
                variant={stageFilter === "all-stages" ? "default" : "outline"}
                className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs lg:text-sm font-bold uppercase tracking-wider transition-colors ${
                  stageFilter === "all-stages" 
                    ? "bg-catalyst-navy text-white hover:bg-white hover:text-blue-400 hover:border-blue-400 border border-catalyst-navy" 
                    : "bg-white text-catalyst-navy border-catalyst-navy hover:bg-white hover:text-blue-400 hover:border-blue-400"
                }`}
                data-testid="button-filter-all"
              >
                All Stages
              </Button>
              <Button
                onClick={() => setStageFilter("green")}
                variant={stageFilter === "green" ? "default" : "outline"}
                className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs lg:text-sm font-bold uppercase tracking-wider transition-colors ${
                  stageFilter === "green" 
                    ? "bg-catalyst-gold text-white hover:bg-catalyst-gold/90" 
                    : "bg-white text-catalyst-gold border-catalyst-gold hover:bg-green-500 hover:border-green-500 hover:text-white"
                }`}
                data-testid="button-filter-green"
              >
                <TrendingUp className="mr-2" size={16} />
                Pursuing
              </Button>
              <Button
                onClick={() => setStageFilter("yellow")}
                variant={stageFilter === "yellow" ? "default" : "outline"}
                className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs lg:text-sm font-bold uppercase tracking-wider transition-colors ${
                  stageFilter === "yellow" 
                    ? "bg-yellow-500 text-white hover:bg-yellow-500/90" 
                    : "bg-white text-yellow-500 border-yellow-500 hover:bg-yellow-500 hover:text-white"
                }`}
                data-testid="button-filter-yellow"
              >
                <Clock className="mr-2" size={16} />
                Reviewing
              </Button>
              <Button
                onClick={() => setStageFilter("red")}
                variant={stageFilter === "red" ? "default" : "outline"}
                className={`py-1.5 sm:py-2 px-3 sm:px-4 text-xs lg:text-sm font-bold uppercase tracking-wider transition-colors ${
                  stageFilter === "red" 
                    ? "bg-red-500 text-white hover:bg-red-500/90" 
                    : "bg-white text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
                }`}
                data-testid="button-filter-red"
              >
                <AlertCircle className="mr-2" size={16} />
                Passed
              </Button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center md:justify-items-stretch">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-catalyst-gray-200 rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-4 bg-catalyst-gray-200 rounded w-full"></div>
                        <div className="h-4 bg-catalyst-gray-200 rounded w-2/3"></div>
                        <div className="h-6 bg-catalyst-gray-200 rounded w-1/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : deals.length === 0 ? (
              <Card className="max-w-2xl mx-auto text-center border-catalyst-gray-200">
                <CardContent className="p-12">
                  <div className="mb-6">
                    <div className="w-24 h-24 bg-catalyst-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-12 h-12 text-catalyst-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-semibold text-catalyst-gray-900 mb-4 tracking-tight">No Submissions Yet</h3>
                    <p className="text-catalyst-gray-600 leading-relaxed">
                      No deals in your pipeline yet. Start by submitting your first property for evaluation.
                    </p>
                  </div>
                  <a href="/submit-deal" className="inline-flex items-center px-8 py-3 bg-blue-500 text-white text-lg font-semibold hover:bg-white hover:text-blue-500 hover:border-2 hover:border-blue-500 transition-all duration-300 rounded-md">
                    Submit Your First Deal
                  </a>
                </CardContent>
              </Card>
            ) : filteredDeals.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-catalyst-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-catalyst-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold text-catalyst-gray-900 mb-4 tracking-tight">
                  No {stageFilter !== "all-stages" ? `${stageFilter.charAt(0).toUpperCase() + stageFilter.slice(1)} ` : ""}Deals Found
                </h3>
                <p className="text-catalyst-gray-600 leading-relaxed">
                  {stageFilter !== "all-stages" 
                    ? `You don't have any ${stageFilter} classified deals yet.`
                    : "You haven't submitted any deals yet."
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDeals.map((deal) => (
                  <Card key={deal.id} className="border-catalyst-gray-200 shadow-sm" data-testid={`deal-card-${deal.id}`}>
                    <CardContent className="p-4">
                      <div 
                        className="flex items-center justify-between cursor-pointer" 
                        onClick={() => toggleDealExpansion(deal.id)}
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <button className="text-catalyst-gray-400 hover:text-catalyst-gray-600 transition-colors">
                            {expandedDeals.has(deal.id) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono bg-catalyst-gold text-white px-2 py-1 rounded">
                                #{(deal as any).dealNumber || 'TBD'}
                              </span>
                              <p className="font-medium text-catalyst-gray-900 truncate hover:text-catalyst-gold transition-colors">
                                {deal.address}
                              </p>
                            </div>
                            <p className="text-sm text-catalyst-gray-500 truncate">
                              Submitted {deal.createdAt ? format(new Date(deal.createdAt), "MMM dd, yyyy 'at' h:mm a") : "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="ml-4 flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm text-catalyst-gray-500">Price</p>
                            <p className="font-medium text-catalyst-gray-900">{formatPrice(deal.askingPrice)}</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-sm text-catalyst-gray-500">Size</p>
                            <p className="font-medium text-catalyst-gray-900">{deal.sizeAcres || "N/A"} Acres</p>
                          </div>
                          {getStatusBadge(deal.status || "pending_review", deal.classification)}
                        </div>
                      </div>
                      
                      {expandedDeals.has(deal.id) && (
                        <div className="mt-6 pt-4 border-t border-catalyst-gray-100">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-catalyst-gray-900">Deal Details</h4>
                            <div className="flex gap-2">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/deals/${deal.id}`);
                                }}
                                variant="outline"
                                size="sm"
                                className="py-2 px-3 text-xs lg:text-sm font-medium hover:bg-catalyst-navy hover:text-white border border-catalyst-navy text-catalyst-navy transition-colors"
                                data-testid={`button-view-details-${deal.id}`}
                              >
                                <ExternalLink size={14} className="mr-2" />
                                View Details
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShareDeal(deal);
                                }}
                                variant="outline"
                                size="sm"
                                className="py-2 px-3 text-xs lg:text-sm font-medium border-catalyst-navy text-catalyst-navy hover:bg-catalyst-navy hover:text-white transition-colors"
                                data-testid={`button-share-link-${deal.id}`}
                              >
                                <Mail size={14} className="mr-2" />
                                Share via Email
                              </Button>
                              {editingDeal !== deal.id && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(deal);
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="py-2 px-3 text-xs lg:text-sm font-medium bg-catalyst-gold text-white hover:bg-white hover:text-blue-400 border border-catalyst-gold hover:border-blue-400 transition-colors"
                                  data-testid={`button-edit-deal-${deal.id}`}
                                >
                                  <Edit size={14} className="mr-2" />
                                  Edit
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Edit form */}
                          {editingDeal === deal.id ? (
                            <div className="mt-6 p-6 bg-catalyst-gray-50 rounded-lg border">
                              <h6 className="font-semibold text-catalyst-gray-800 mb-4">Edit Deal</h6>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Property Name</label>
                                  <Input
                                    type="text"
                                    value={editFormData.propertyName || ''}
                                    onChange={(e) => setEditFormData({...editFormData, propertyName: e.target.value})}
                                    data-testid="input-edit-property-name"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Address</label>
                                  <Input
                                    type="text"
                                    value={editFormData.address || ''}
                                    onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                                    data-testid="input-edit-address"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Asking Price</label>
                                  <Input
                                    type="text"
                                    value={editFormData.askingPrice || ''}
                                    onChange={(e) => setEditFormData({...editFormData, askingPrice: e.target.value})}
                                    data-testid="input-edit-asking-price"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Size (Acres)</label>
                                  <Input
                                    type="text"
                                    value={editFormData.sizeAcres || ''}
                                    onChange={(e) => setEditFormData({...editFormData, sizeAcres: e.target.value})}
                                    data-testid="input-edit-size-acres"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Zoning</label>
                                  <Input
                                    type="text"
                                    value={editFormData.zoning || ''}
                                    onChange={(e) => setEditFormData({...editFormData, zoning: e.target.value})}
                                    placeholder="e.g., R-4, C-2"
                                    data-testid="input-edit-zoning"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Parcel ID</label>
                                  <Input
                                    type="text"
                                    value={editFormData.parcelId || ''}
                                    onChange={(e) => setEditFormData({...editFormData, parcelId: e.target.value})}
                                    data-testid="input-edit-parcel-id"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Unit Count</label>
                                  <Input
                                    type="number"
                                    value={editFormData.unitCount || ''}
                                    onChange={(e) => setEditFormData({...editFormData, unitCount: e.target.value})}
                                    data-testid="input-edit-unit-count"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Unit Size (SF)</label>
                                  <Input
                                    type="number"
                                    value={editFormData.unitSize || ''}
                                    onChange={(e) => setEditFormData({...editFormData, unitSize: e.target.value})}
                                    data-testid="input-edit-unit-size"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Has Entitlements</label>
                                  <Select
                                    value={editFormData.hasEntitlements ? 'yes' : editFormData.hasEntitlements === false ? 'no' : ''}
                                    onValueChange={(value) => setEditFormData({...editFormData, hasEntitlements: value === 'yes'})}
                                  >
                                    <SelectTrigger data-testid="select-edit-entitlements">
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="yes">Yes</SelectItem>
                                      <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Sewer Available</label>
                                  <Select
                                    value={editFormData.sewerAvailable ? 'yes' : editFormData.sewerAvailable === false ? 'no' : ''}
                                    onValueChange={(value) => setEditFormData({...editFormData, sewerAvailable: value === 'yes'})}
                                  >
                                    <SelectTrigger data-testid="select-edit-sewer">
                                      <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="yes">Yes</SelectItem>
                                      <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Pricing Type</label>
                                  <Select
                                    value={editFormData.pricingType || 'whole_deal'}
                                    onValueChange={(value) => setEditFormData({...editFormData, pricingType: value})}
                                  >
                                    <SelectTrigger data-testid="select-edit-pricing-type">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="whole_deal">Whole Deal</SelectItem>
                                      <SelectItem value="per_acre">Per Acre</SelectItem>
                                      <SelectItem value="per_unit">Per Unit</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Contact Phone</label>
                                  <Input
                                    type="tel"
                                    value={editFormData.brokerPhone || ''}
                                    onChange={(e) => setEditFormData({...editFormData, brokerPhone: e.target.value})}
                                    data-testid="input-edit-phone"
                                  />
                                </div>
                              </div>
                              
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-catalyst-gray-700 mb-2">Product Types</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {['Conventional', 'Build-to-Rent', 'Active Adult', 'Affordable', 'Lot Development'].map((type) => (
                                    <div key={type} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`edit-product-${type}`}
                                        checked={editFormData.productTypes?.includes(type) || false}
                                        onCheckedChange={(checked) => {
                                          const current = editFormData.productTypes || [];
                                          const updated = checked
                                            ? [...current, type]
                                            : current.filter((t: string) => t !== type);
                                          setEditFormData({...editFormData, productTypes: updated});
                                        }}
                                        data-testid={`checkbox-edit-product-${type.toLowerCase().replace(' ', '-')}`}
                                      />
                                      <label htmlFor={`edit-product-${type}`} className="text-sm text-catalyst-gray-700 cursor-pointer">
                                        {type}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex gap-2 mt-6">
                                <Button
                                  onClick={() => saveDealChanges(deal.id)}
                                  disabled={updateDealMutation.isPending}
                                  className="bg-catalyst-gold text-white hover:!bg-catalyst-gold/90 active:!bg-catalyst-gold/80 transition-colors"
                                  data-testid="button-save-edit"
                                >
                                  {updateDealMutation.isPending ? "Saving..." : "Save Changes"}
                                </Button>
                                <Button
                                  onClick={cancelEditing}
                                  variant="outline"
                                  className="border-catalyst-navy text-catalyst-navy hover:bg-catalyst-navy hover:text-white"
                                  data-testid="button-cancel-edit"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                                {/* Property Details */}
                                <div className="space-y-2">
                                  <h6 className="font-semibold text-catalyst-gray-800 mb-2">Property Details</h6>
                                  <div><span className="font-medium text-catalyst-gray-600">Property Name:</span> <span className="ml-2 text-catalyst-gray-900">{deal.propertyName || "N/A"}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Price:</span> <span className="ml-2 text-catalyst-gray-900">{formatPrice(deal.askingPrice)}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Size:</span> <span className="ml-2 text-catalyst-gray-900">{deal.sizeAcres || "N/A"} Acres</span></div>
                                  {deal.zoning && (
                                    <div><span className="font-medium text-catalyst-gray-600">Zoning:</span> <span className="ml-2 text-catalyst-gray-900">{deal.zoning}</span></div>
                                  )}
                                  <div><span className="font-medium text-catalyst-gray-600">Parcel ID:</span> <span className="ml-2 text-catalyst-gray-900">{deal.parcelId || "N/A"}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Proposed Unit Count:</span> <span className="ml-2 text-catalyst-gray-900">{deal.unitCount || "N/A"}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Unit Size:</span> <span className="ml-2 text-catalyst-gray-900">{deal.unitSize || "N/A"} SF</span></div>
                                </div>

                                {/* Market Analysis */}
                                <div className="space-y-2">
                                  <h6 className="font-semibold text-catalyst-gray-800 mb-2">Market Analysis</h6>
                                  <div><span className="font-medium text-catalyst-gray-600">Rent Comp:</span> <span className="ml-2 text-catalyst-gray-900">${deal.topRentPSF || "N/A"}/SF</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Sewer Available:</span> <span className="ml-2 text-catalyst-gray-900">{deal.sewerAvailable ? "Yes" : "No"}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Has Entitlements:</span> <span className="ml-2 text-catalyst-gray-900">{deal.hasEntitlements ? "Yes" : "No"}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Product Types:</span> <span className="ml-2 text-catalyst-gray-900">{Array.isArray(deal.productTypes) ? deal.productTypes.join(", ") : (deal.productTypes as string || "N/A")}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Timeline:</span> <span className="ml-2 text-catalyst-gray-900">{deal.developmentTimelineMonths || "N/A"} months</span></div>
                                </div>

                                {/* Status & Workflow */}
                                <div className="space-y-2">
                                  <h6 className="font-semibold text-catalyst-gray-800 mb-2">Status & Workflow</h6>
                                  <div><span className="font-medium text-catalyst-gray-600">Assigned Senior Analyst:</span> <span className="ml-2 text-catalyst-gray-900">{deal.assignedAnalyst || "Unassigned"}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Assigned Developer:</span> <span className="ml-2 text-catalyst-gray-900">{deal.assignedDeveloper || "TBD"}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Assigned Partner:</span> <span className="ml-2 text-catalyst-gray-900">{deal.assignedPartner || "TBD"}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Submission Method:</span> <span className="ml-2 text-catalyst-gray-900">{deal.submissionMethod}</span></div>
                                  <div><span className="font-medium text-catalyst-gray-600">Reviewed:</span> <span className="ml-2 text-catalyst-gray-900">{deal.reviewedAt ? format(new Date(deal.reviewedAt), "MMM dd, yyyy") : "Not yet"}</span></div>
                                </div>
                              </div>

                              {/* Financial Analysis */}
                              {(deal.constructionCostPerSF || deal.projectedRentPerSF || deal.totalProjectCost || deal.projectedNOI || deal.marketCapRate) && (
                                <div className="mt-6 pt-4 border-t border-catalyst-gray-100">
                                  <h6 className="font-semibold text-catalyst-gray-800 mb-3">Financial Analysis</h6>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                    {deal.constructionCostPerSF && <div><span className="font-medium text-catalyst-gray-600">Construction Cost/SF:</span> <span className="ml-2 text-catalyst-gray-900">${deal.constructionCostPerSF}</span></div>}
                                    {deal.projectedRentPerSF && <div><span className="font-medium text-catalyst-gray-600">Projected Rent/SF:</span> <span className="ml-2 text-catalyst-gray-900">${deal.projectedRentPerSF}</span></div>}
                                    {deal.totalProjectCost && <div><span className="font-medium text-catalyst-gray-600">Total Project Cost:</span> <span className="ml-2 text-catalyst-gray-900">{formatPrice(deal.totalProjectCost.toString())}</span></div>}
                                    {deal.projectedNOI && <div><span className="font-medium text-catalyst-gray-600">Projected NOI:</span> <span className="ml-2 text-catalyst-gray-900">{formatPrice(deal.projectedNOI.toString())}</span></div>}
                                    {deal.marketCapRate && <div><span className="font-medium text-catalyst-gray-600">Market Cap Rate:</span> <span className="ml-2 text-catalyst-gray-900">{deal.marketCapRate}%</span></div>}
                                  </div>
                                </div>
                              )}

                              {/* Demographics (for Active Adult communities) */}
                              {(deal.population55Plus5Mile || deal.income75Plus55Plus || deal.demographicsNotes) && (
                                <div className="mt-6 pt-4 border-t border-catalyst-gray-100">
                                  <h6 className="font-semibold text-catalyst-gray-800 mb-3">Demographics (Active Adult)</h6>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    {deal.population55Plus5Mile && <div><span className="font-medium text-catalyst-gray-600">55+ Population (5 mi):</span> <span className="ml-2 text-catalyst-gray-900">{deal.population55Plus5Mile.toLocaleString()}</span></div>}
                                    {deal.income75Plus55Plus && <div><span className="font-medium text-catalyst-gray-600">55+ w/ $75k+ Income:</span> <span className="ml-2 text-catalyst-gray-900">{deal.income75Plus55Plus.toLocaleString()}</span></div>}
                                  </div>
                                  {deal.demographicsNotes && (
                                    <div className="mt-2">
                                      <span className="font-medium text-catalyst-gray-600">Demographics Notes:</span>
                                      <p className="ml-2 text-catalyst-gray-900 mt-1">{deal.demographicsNotes}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Next Steps */}
                              {deal.nextSteps && (
                                <div className="mt-6 pt-4 border-t border-catalyst-gray-100">
                                  <h6 className="font-semibold text-catalyst-gray-800 mb-3">Next Steps</h6>
                                  <div>
                                    <span className="font-medium text-catalyst-gray-600">Next Steps:</span>
                                    <p className="ml-2 text-catalyst-gray-900 mt-1">{deal.nextSteps}</p>
                                  </div>
                                </div>
                              )}

                              {/* Rejection Feedback */}
                              {deal.rejectionReason && deal.classification === 'red' && (
                                <div className="mt-6 pt-4 border-t border-catalyst-gray-100">
                                  <h6 className="font-semibold text-red-700 mb-2 flex items-center">
                                    <AlertCircle className="mr-2" size={16} />
                                    Analyst Feedback
                                  </h6>
                                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                                    <p className="text-sm text-red-800 leading-relaxed">{deal.rejectionReason}</p>
                                    <p className="text-xs text-red-600 mt-2 font-medium">
                                      💡 Use this feedback to improve future submissions and better understand our acquisition criteria.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Analyst Notes */}
                              {deal.analystNotes && (
                                <div className="mt-6 pt-4 border-t border-catalyst-gray-100">
                                  <h6 className="font-semibold text-catalyst-gray-800 mb-2">Analyst Notes</h6>
                                  <p className="text-sm text-catalyst-gray-900 bg-catalyst-gray-50 p-3 rounded">{deal.analystNotes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
        <Footer />
    </div>
    </>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Inbox, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Eye,
  Check,
  X,
  Download
} from "lucide-react";

interface Deal {
  id: string;
  address: string;
  askingPrice: string;
  sizeAcres: string;
  zoning: string;
  parcelId: string;
  sewerAvailable: boolean;
  status: string;
  classification: "unclassified" | "red" | "yellow" | "green";
  aiAnalysisData: any;
  createdAt: string;
  broker: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Analytics {
  totalDeals: number;
  pendingDeals: number;
  approvedDeals: number;
  avgReviewTime: string;
  totalPipelineValue: string;
}

export default function AnalystDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");

  // Handle authentication errors
  const handleAuthError = (error: any) => {
    if (isUnauthorizedError(error)) {
      console.log("Unauthorized - redirecting to login");
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return true;
    }
    return false;
  };

  // Fetch deals with error handling
  const { data: deals = [], isLoading: dealsLoading, error: dealsError } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
    retry: false,
    select: (data: any) => data?.deals || data || [],
  });

  // Fetch analytics with error handling
  const { data: analytics, error: analyticsError } = useQuery<Analytics>({
    queryKey: ["/api/analytics"],
    retry: false,
  });

  // Check for authentication errors
  if (dealsError && handleAuthError(dealsError)) return null;
  if (analyticsError && handleAuthError(analyticsError)) return null;

  // Show loading state
  if (dealsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-catalyst-gold mx-auto"></div>
          <p className="mt-2 text-catalyst-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show general error state
  if (dealsError || analyticsError) {
    const errorMsg = dealsError?.message || analyticsError?.message || "Unknown error";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-red-600">Dashboard Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Error loading dashboard: {errorMsg}
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Update deal mutation
  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, status, classification }: { dealId: string; status: string; classification: string }) => {
      return await apiRequest("PATCH", `/api/deals/${dealId}`, { status, classification });
    },
    onSuccess: () => {
      toast({
        title: "Deal Updated",
        description: "Broker notification sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      console.error("Update Failed:", error.message || "Please try again later.");
    },
  });

  const handleDealAction = (dealId: string, action: "approve" | "reject" | "review") => {
    let status: string;
    let classification: string;

    switch (action) {
      case "approve":
        status = "approved";
        classification = "green";
        break;
      case "reject":
        status = "rejected";
        classification = "red";
        break;
      case "review":
        status = "pending_review";
        classification = "unclassified";
        break;
      default:
        return;
    }

    updateDealMutation.mutate({ dealId, status, classification });
  };

  const getStatusBadge = (classification: string, status: string) => {
    switch (classification) {
      case "green":
        return <Badge className="bg-catalyst-gold text-catalyst-white">High Priority</Badge>;
      case "yellow":
        return <Badge className="bg-yellow-100 text-yellow-800">Potentially</Badge>;
      case "red":
        return <Badge className="bg-red-100 text-red-800">Clear No</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getAnalysisIndicator = (status: string) => {
    switch (status) {
      case "good":
        return <span className="w-2 h-2 bg-catalyst-gold rounded-full inline-block mr-2"></span>;
      case "fair":
        return <span className="w-2 h-2 bg-yellow-500 rounded-full inline-block mr-2"></span>;
      case "poor":
        return <span className="w-2 h-2 bg-red-500 rounded-full inline-block mr-2"></span>;
      default:
        return <span className="w-2 h-2 bg-gray-500 rounded-full inline-block mr-2"></span>;
    }
  };

  const filteredDeals = deals.filter(deal => {
    const statusMatch = statusFilter === "all" || deal.status === statusFilter;
    const marketMatch = marketFilter === "all" || deal.address.includes(marketFilter);
    return statusMatch && marketMatch;
  });

  if (dealsLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-catalyst-gray-200 rounded"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-catalyst-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-catalyst-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-catalyst-navy" data-testid="text-dashboard-title">
              Analyst Dashboard
            </h2>
            <p className="text-catalyst-gray-600 mt-2">Review and manage submitted deals</p>
          </div>
          <div className="flex space-x-4 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = '/api/deals/export/csv';
              }}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="unclassified">Unclassified</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={marketFilter} onValueChange={setMarketFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Markets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="Charlotte">Charlotte, NC</SelectItem>
                <SelectItem value="Atlanta">Atlanta, GA</SelectItem>
                <SelectItem value="Nashville">Nashville, TN</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-catalyst-navy rounded-lg flex items-center justify-center">
                  <Inbox className="text-catalyst-blue" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-catalyst-navy" data-testid="stat-pending-deals">
                    {analytics?.pendingDeals || 0}
                  </p>
                  <p className="text-catalyst-gray-600 text-sm">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-catalyst-gold rounded-lg flex items-center justify-center">
                  <CheckCircle className="text-catalyst-white" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-catalyst-navy" data-testid="stat-approved-deals">
                    {analytics?.approvedDeals || 0}
                  </p>
                  <p className="text-catalyst-gray-600 text-sm">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="text-yellow-600" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-catalyst-navy" data-testid="stat-avg-review-time">
                    {analytics?.avgReviewTime || "0"}
                  </p>
                  <p className="text-catalyst-gray-600 text-sm">Avg. Review Days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-catalyst-gold/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-catalyst-gold" size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-catalyst-navy" data-testid="stat-pipeline-value">
                    ${analytics?.totalPipelineValue ? Number(analytics.totalPipelineValue).toLocaleString() : "0"}
                  </p>
                  <p className="text-catalyst-gray-600 text-sm">Pipeline Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deals Table */}
        <Card className="border-catalyst-gray-200 shadow-sm">
          <CardHeader className="border-b border-catalyst-gray-200">
            <CardTitle className="text-lg font-semibold text-catalyst-navy">
              Recent Deal Submissions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-catalyst-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-catalyst-gray-500 uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-catalyst-gray-500 uppercase tracking-wider">
                      Broker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-catalyst-gray-500 uppercase tracking-wider">
                      Size/Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-catalyst-gray-500 uppercase tracking-wider">
                      AI Analysis
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-catalyst-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-catalyst-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-catalyst-gray-200">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-catalyst-gray-500">
                        No deals found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredDeals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-catalyst-gray-50" data-testid={`deal-row-${deal.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-catalyst-navy">
                              {deal.address}
                            </div>
                            <div className="text-sm text-catalyst-gray-500">
                              Parcel: {deal.parcelId || "N/A"}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-catalyst-navy">
                              {deal.broker.firstName} {deal.broker.lastName}
                            </div>
                            <div className="text-sm text-catalyst-gray-500">
                              {deal.broker.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-catalyst-gray-900">
                          <div>{deal.sizeAcres ? `${deal.sizeAcres} acres` : "N/A"}</div>
                          <div className="text-catalyst-gold font-semibold">
                            {deal.askingPrice ? `$${Number(deal.askingPrice).toLocaleString()}` : "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs space-y-1">
                            {deal.aiAnalysisData && (
                              <>
                                {deal.aiAnalysisData.zoning?.value && (
                                  <div className="flex items-center">
                                    {getAnalysisIndicator(deal.aiAnalysisData.zoning?.status)}
                                    <span>Zoning: {deal.aiAnalysisData.zoning.value}</span>
                                  </div>
                                )}
                                {deal.aiAnalysisData.sewer?.value && (
                                  <div className="flex items-center">
                                    {getAnalysisIndicator(deal.aiAnalysisData.sewer?.status)}
                                    <span>Sewer: {deal.aiAnalysisData.sewer.value}</span>
                                  </div>
                                )}
                                <div className="flex items-center">
                                  {getAnalysisIndicator(deal.aiAnalysisData.comparables?.status)}
                                  <span>Comps: {deal.aiAnalysisData.comparables?.value || "Unknown"}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(deal.classification, deal.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDealAction(deal.id, "review")}
                            disabled={updateDealMutation.isPending}
                            className="text-catalyst-gold hover:text-catalyst-navy"
                            data-testid={`button-review-${deal.id}`}
                          >
                            <Eye size={16} className="mr-1" />
                            Review
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDealAction(deal.id, "approve")}
                            disabled={updateDealMutation.isPending}
                            className="text-catalyst-gold hover:text-catalyst-navy"
                            data-testid={`button-approve-${deal.id}`}
                          >
                            <Check size={16} className="mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDealAction(deal.id, "reject")}
                            disabled={updateDealMutation.isPending}
                            className="text-catalyst-gold hover:text-catalyst-navy"
                            data-testid={`button-reject-${deal.id}`}
                          >
                            <X size={16} className="mr-1" />
                            Reject
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Activity, 
  MessageSquare, 
  Route,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Target,
  Users,
  BarChart3,
  ArrowRight,
  RefreshCw,
  Lightbulb,
  Shield,
  Eye
} from "lucide-react";

interface AIRecommendation {
  dealId: string;
  type: 'priority' | 'risk' | 'opportunity' | 'action';
  title: string;
  description: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction?: string;
}

interface StatusData {
  totalDeals: number;
  statusBreakdown: Record<string, number>;
  classificationBreakdown: Record<string, number>;
  recentActivity: number;
  avgReviewTime: string;
  totalPipelineValue: string;
  urgentDeals: number;
  timestamp: string;
}

interface CommunicationThread {
  brokerId: string;
  dealId?: string;
  brokerName: string;
  messages: Array<{
    id: string;
    type: string;
    subject?: string;
    message: string;
    createdAt: string;
  }>;
}

export default function AnalystCommandCenter() {
  const { user, isAuthenticated } = useAuth();
  // const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDealForRouting, setSelectedDealForRouting] = useState<string | null>(null);

  // Check if user is analyst
  // FIX (Dec 15, 2025): Support both OIDC auth (user.claims.email) and traditional auth (user.email)
  const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
  const isAnalyst = isAuthenticated && userEmail.includes('@catalystcp.com');

  // Fetch AI Recommendations
  const { data: recommendations = [], isLoading: recommendationsLoading, refetch: refetchRecommendations } = useQuery<AIRecommendation[]>({
    queryKey: ["/api/command-center/recommendations"],
    enabled: isAuthenticated && isAnalyst,
    retry: false,
  });

  // Fetch Status Data
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery<StatusData>({
    queryKey: ["/api/command-center/status"], 
    enabled: isAuthenticated && isAnalyst,
    retry: false,
  });

  // Fetch Communication Threads
  const { data: communicationThreads = [], isLoading: communicationsLoading, refetch: refetchCommunications } = useQuery<CommunicationThread[]>({
    queryKey: ["/api/command-center/communications"],
    enabled: isAuthenticated && isAnalyst,
    retry: false,
  });

  // Fetch Deals for Routing
  const { data: deals = [] } = useQuery<any[]>({
    queryKey: ["/api/analyst/deals"],
    enabled: isAuthenticated && isAnalyst,
    retry: false,
  });

  // Route Deal Mutation
  const routeDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const response = await fetch(`/api/command-center/route-deal`, {
        method: "POST",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dealId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get routing recommendation');
      }
      
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log(`AI Routing Recommendation - Analyst: ${data.recommendedAnalyst}, Reason: ${data.reason}`);
    },
    onError: (error: any) => {
      console.error("Routing Error:", error.message || "Failed to generate routing recommendation");
    },
  });

  const refreshAll = () => {
    refetchRecommendations();
    refetchStatus();
    refetchCommunications();
    queryClient.invalidateQueries({ queryKey: ["/api/analyst/deals"] });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-muted-foreground">Please log in to access the Command Center.</p>
        </div>
      </div>
    );
  }

  if (!isAnalyst) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
          <p className="text-muted-foreground">Analyst privileges required.</p>
        </div>
      </div>
    );
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'priority': return <Target className="h-4 w-4" />;
      case 'risk': return <Shield className="h-4 w-4" />;
      case 'opportunity': return <Lightbulb className="h-4 w-4" />;
      case 'action': return <Zap className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3" data-testid="title-command-center">
                <Brain className="h-8 w-8 text-blue-600" />
                Analyst Command Center
              </h1>
              <p className="text-muted-foreground mt-2">AI-powered deal analysis and workflow optimization</p>
            </div>
            <Button 
              onClick={refreshAll}
              variant="outline"
              className="flex items-center gap-2"
              data-testid="button-refresh-all"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh All
            </Button>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="recommendations" data-testid="tab-recommendations">AI Recommendations</TabsTrigger>
              <TabsTrigger value="communications" data-testid="tab-communications">Communications</TabsTrigger>
              <TabsTrigger value="routing" data-testid="tab-routing">Smart Routing</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {statusLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <div className="animate-pulse">
                          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                          <div className="h-8 bg-muted rounded w-1/2"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Deals</p>
                          <p className="text-2xl font-bold" data-testid="stat-total-deals">
                            {statusData?.totalDeals || 0}
                          </p>
                        </div>
                        <BarChart3 className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Urgent Deals</p>
                          <p className="text-2xl font-bold text-red-600" data-testid="stat-urgent-deals">
                            {statusData?.urgentDeals || 0}
                          </p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Pipeline Value</p>
                          <p className="text-2xl font-bold text-green-600" data-testid="stat-pipeline-value">
                            {statusData?.totalPipelineValue || "$0"}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Avg Review Time</p>
                          <p className="text-2xl font-bold" data-testid="stat-avg-review-time">
                            {statusData?.avgReviewTime || "N/A"}
                          </p>
                        </div>
                        <Clock className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Status Breakdown */}
              {statusData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Deal Status Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(statusData.statusBreakdown).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <span className="capitalize text-sm font-medium">{status}</span>
                            <Badge variant="outline" data-testid={`status-${status}`}>{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Classification Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(statusData.classificationBreakdown).map(([classification, count]) => (
                          <div key={classification} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                classification === 'green' ? 'bg-green-500' :
                                classification === 'yellow' ? 'bg-yellow-500' : 
                                classification === 'red' ? 'bg-red-500' : 'bg-gray-500'
                              }`}></div>
                              <span className="capitalize text-sm font-medium">{classification}</span>
                            </div>
                            <Badge variant="outline" data-testid={`classification-${classification}`}>{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* AI Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recommendationsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-20 bg-muted rounded-lg"></div>
                        </div>
                      ))}
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className="text-center py-8">
                      <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No AI recommendations available yet.</p>
                      <p className="text-sm text-muted-foreground mt-2">Submit some deals to see intelligent recommendations.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recommendations.map((rec, index) => (
                        <div 
                          key={`${rec.dealId}-${index}`}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                          data-testid={`recommendation-${index}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                {getTypeIcon(rec.type)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold">{rec.title}</h4>
                                  <Badge 
                                    variant="outline" 
                                    className={getUrgencyColor(rec.urgency)}
                                  >
                                    {rec.urgency}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {(rec.confidence * 100).toFixed(0)}% confidence
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                                {rec.suggestedAction && (
                                  <p className="text-xs text-blue-600 font-medium">
                                    💡 {rec.suggestedAction}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="shrink-0"
                              data-testid={`button-view-deal-${rec.dealId}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Deal
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Communications Tab */}
            <TabsContent value="communications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Communication Threads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {communicationsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-24 bg-muted rounded-lg"></div>
                        </div>
                      ))}
                    </div>
                  ) : communicationThreads.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No communication threads found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {communicationThreads.map((thread, index) => (
                        <div 
                          key={`${thread.brokerId}-${index}`}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-green-100 text-green-600">
                                <Users className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className="font-semibold">{thread.brokerName}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {thread.dealId ? `Deal: ${thread.dealId}` : 'General Communication'}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline">
                              {thread.messages.length} messages
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {thread.messages.slice(0, 2).map((msg, msgIndex) => (
                              <div key={msgIndex} className="text-sm">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium capitalize">{msg.type}</span>
                                  {msg.subject && <span className="text-muted-foreground">• {msg.subject}</span>}
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {new Date(msg.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-muted-foreground text-xs leading-relaxed">
                                  {msg.message.length > 100 ? `${msg.message.substring(0, 100)}...` : msg.message}
                                </p>
                              </div>
                            ))}
                            {thread.messages.length > 2 && (
                              <p className="text-xs text-blue-600 cursor-pointer">
                                View {thread.messages.length - 2} more messages
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Smart Routing Tab */}
            <TabsContent value="routing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Route className="h-5 w-5" />
                    AI-Powered Deal Routing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {deals.length === 0 ? (
                      <div className="text-center py-8">
                        <Route className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No deals available for routing.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {deals.slice(0, 5).map((deal, index) => (
                          <div 
                            key={deal.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1">
                              <h4 className="font-semibold">{deal.address || 'Unknown Address'}</h4>
                              <p className="text-sm text-muted-foreground">
                                {deal.askingPrice && `$${deal.askingPrice} • `}
                                {deal.sizeAcres && `${deal.sizeAcres} acres • `}
                                Status: {deal.status || 'pending'}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge 
                                  variant={deal.classification === 'green' ? 'default' : 
                                          deal.classification === 'yellow' ? 'secondary' : 'destructive'}
                                >
                                  {deal.classification || 'unclassified'}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              onClick={() => routeDealMutation.mutate(deal.id)}
                              disabled={routeDealMutation.isPending}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              data-testid={`button-route-deal-${deal.id}`}
                            >
                              {routeDealMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowRight className="h-4 w-4" />
                              )}
                              Get AI Routing
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <Footer />
    </div>
    </div>
  );
}
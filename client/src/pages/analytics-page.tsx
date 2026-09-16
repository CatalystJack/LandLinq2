import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import AnalyticsDashboard from "@/components/analytics-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useAuth } from "@/hooks/useAuth";
import { isPlatformAdminEmail } from "@shared/admin-auth";
import { Cell, Pie, PieChart as RechartsPieChart } from "recharts";
import { 
  BarChart3, 
  TrendingUp, 
  MapPin, 
  DollarSign, 
  Calendar,
  Users,
  Building,
  Target,
  Activity,
  PieChart,
  Download,
  Filter,
  Zap,
  Shield,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight
} from "lucide-react";

interface Deal {
  id: string;
  address: string;
  askingPrice: string | number | null;
  sizeAcres: number;
  status: string;
  classification: string;
  brokerName?: string;
  submittedDate: string;
  createdAt?: string;
  city?: string;
  state?: string;
  broker?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    brokerage?: string;
  };
}

const getBrokerName = (deal: Deal): string => {
  if (deal.broker?.firstName || deal.broker?.lastName) {
    return [deal.broker.firstName, deal.broker.lastName].filter(Boolean).join(' ');
  }
  return deal.brokerName || 'Unknown Broker';
};

const getPrice = (deal: Deal): number => Number(deal.askingPrice) || 0;

interface AnalyticsData {
  totalDeals: number;
  totalValue: number;
  avgDealSize: number;
  conversionRate: number;
  monthlyTrends: Array<{ month: string; deals: number; value: number }>;
  statusBreakdown: Array<{ status: string; count: number; percentage: number }>;
  cityDistribution: Array<{ city: string; count: number; avgValue: number }>;
  brokerPerformance: Array<{ broker: string; deals: number; totalValue: number; avgDays: number }>;
  marketInsights: Array<{ metric: string; value: string; trend: number; description: string }>;
}

interface EmailIntakePerformance {
  weekStart: string;
  processedCount: number;
  autoClassifiedCount: number;
  manualReviewCount: number;
  averageOverallConfidence: number | null;
  manualReviewReasons: Array<{ reason: string; count: number }>;
}

const analyticsCardClass = "rounded-2xl border-slate-200 bg-white shadow-sm";

const statusChartConfig = {
  high_priority: { label: "High Priority", color: "#22c55e" },
  unclassified: { label: "Unclassified", color: "#f59e0b" },
  other: { label: "Other", color: "#ef4444" },
};

const getStatusChartColor = (status: string) => {
  if (status === "high_priority") return statusChartConfig.high_priority.color;
  if (status === "unclassified") return statusChartConfig.unclassified.color;
  return statusChartConfig.other.color;
};

const formatStatusLabel = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

export default function AnalyticsPage() {
  const { user, isAuthenticated } = useAuth();
  const [selectedTimeframe, setSelectedTimeframe] = useState("30");
  const [selectedMetric, setSelectedMetric] = useState("volume");
  const [filters, setFilters] = useState({
    status: "all",
    city: "all",
    broker: "all",
    dateRange: "all"
  });
  const [showFilters, setShowFilters] = useState(false);

  // Check if user is analyst - supports @catalystcp.com emails AND Jack's Ultimate Power
  // FIX (Dec 15, 2025): Support both OIDC auth (user.claims.email) and traditional auth (user.email)
  const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
  const userRole = (user as any)?.role || '';
  const isPlatformAdmin = isPlatformAdminEmail(userEmail);
  
  // Check for analyst access: email domain OR role-based (including Jack's Ultimate Power)
  const isAnalyst = userEmail.includes('@catalystcp.com') || 
                   userRole === 'analyst' || 
                   userRole === 'admin' ||
                   userRole === 'super_admin';

  // Don't render anything if not an analyst (routing will handle redirects)
  if (!isAuthenticated || !isAnalyst) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-catalyst-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Shield className="h-16 w-16 text-catalyst-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-catalyst-gray-900 mb-4">Access Restricted</h1>
            <p className="text-catalyst-gray-600">Analytics are only accessible to LandLinq team members.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/analyst/deals"],
  });

  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", selectedTimeframe],
  });

  const { data: emailIntakePerformance, isLoading: isEmailIntakeLoading } = useQuery<EmailIntakePerformance>({
    queryKey: ["/api/analytics/email-intake-performance"],
    enabled: isPlatformAdmin,
    refetchInterval: 5 * 60 * 1000,
  });

  // Filter deals based on current filter settings
  const filteredDeals = deals.filter(deal => {
    if (filters.status !== "all" && deal.status !== filters.status) return false;
    if (filters.broker !== "all" && getBrokerName(deal) !== filters.broker) return false;
    if (filters.city !== "all") {
      const dealCity = deal.city || deal.address.split(',')[1]?.trim() || 'Unknown';
      if (dealCity !== filters.city) return false;
    }
    if (filters.dateRange !== "all") {
      const dealDate = new Date(deal.submittedDate);
      const now = new Date();
      const daysAgo = parseInt(filters.dateRange);
      const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      if (dealDate < cutoffDate) return false;
    }
    return true;
  });

  // Calculate real-time analytics from filtered deals data
  const calculateAnalytics = (): AnalyticsData => {
    if (!filteredDeals.length) {
      return {
        totalDeals: 0,
        totalValue: 0,
        avgDealSize: 0,
        conversionRate: 0,
        monthlyTrends: [],
        statusBreakdown: [],
        cityDistribution: [],
        brokerPerformance: [],
        marketInsights: []
      };
    }

    const totalValue = filteredDeals.reduce((sum, deal) => sum + getPrice(deal), 0);
    const avgDealSize = filteredDeals.length > 0 ? totalValue / filteredDeals.length : 0;
    
    // Status breakdown
    const statusCounts = filteredDeals.reduce((acc, deal) => {
      acc[deal.status] = (acc[deal.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: (count / filteredDeals.length) * 100
    }));

    // City distribution
    const cityData = filteredDeals.reduce((acc, deal) => {
      const city = deal.city || deal.address.split(',')[1]?.trim() || 'Unknown';
      if (!acc[city]) {
        acc[city] = { count: 0, totalValue: 0 };
      }
      acc[city].count++;
      acc[city].totalValue += getPrice(deal);
      return acc;
    }, {} as Record<string, { count: number; totalValue: number }>);

    const cityDistribution = Object.entries(cityData)
      .map(([city, data]) => ({
        city,
        count: data.count,
        avgValue: data.totalValue / data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Broker performance
    const brokerData = filteredDeals.reduce((acc, deal) => {
      const name = getBrokerName(deal);
      if (!acc[name]) {
        acc[name] = { deals: 0, totalValue: 0, dates: [] };
      }
      acc[name].deals++;
      acc[name].totalValue += getPrice(deal);
      acc[name].dates.push(new Date(deal.submittedDate || deal.createdAt || Date.now()));
      return acc;
    }, {} as Record<string, { deals: number; totalValue: number; dates: Date[] }>);

    const brokerPerformance = Object.entries(brokerData)
      .map(([broker, data]) => ({
        broker,
        deals: data.deals,
        totalValue: data.totalValue,
        avgDays: 30 // Simplified calculation
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    // Market insights - NO MOCK DATA, only real calculations
    const pursuingDeals = filteredDeals.filter(d => d.status === 'high_priority').length;
    const conversionRate = filteredDeals.length > 0 ? (pursuingDeals / filteredDeals.length) * 100 : 0;
    
    // Only show metrics if we have real data
    const marketInsights = filteredDeals.length > 0 ? [
      {
        metric: "Deal Velocity",
        value: `${(filteredDeals.length / 30).toFixed(1)}/day`,
        trend: 0, // NO FAKE TRENDS - would need historical data to calculate real trends
        description: "Average deals submitted per day"
      },
      {
        metric: "Hot Markets", 
        value: cityDistribution[0]?.city || "No data",
        trend: 0, // NO FAKE TRENDS
        description: "Top performing market by volume"
      },
      {
        metric: "Pipeline Health",
        value: `${conversionRate.toFixed(1)}%`,
        trend: 0, // NO FAKE TRENDS
        description: "Deals in active pursuit"
      }
    ] : []; // EMPTY ARRAY when no real data available

    return {
      totalDeals: filteredDeals.length,
      totalValue,
      avgDealSize,
      conversionRate,
      monthlyTrends: [], // Would be calculated with proper date grouping
      statusBreakdown,
      cityDistribution,
      brokerPerformance,
      marketInsights
    };
  };

  const realTimeAnalytics = calculateAnalytics();

  // Get unique values for filter dropdowns
  const uniqueStatuses = Array.from(new Set(deals.map(d => d.status)));
  const uniqueCities = Array.from(new Set(deals.map(d => d.city || d.address.split(',')[1]?.trim() || 'Unknown')));
  const uniqueBrokers = Array.from(new Set(deals.map(d => getBrokerName(d))));

  // Export functionality
  const exportToCSV = () => {
    const headers = ['Address', 'Asking Price', 'Size (Acres)', 'Status', 'Classification', 'Broker', 'Submitted Date', 'City'];
    const csvContent = [
      headers.join(','),
      ...filteredDeals.map(deal => [
        `"${deal.address}"`,
        deal.askingPrice,
        deal.sizeAcres,
        deal.status,
        deal.classification,
        `"${getBrokerName(deal)}"`,
        deal.submittedDate,
        `"${deal.city || deal.address.split(',')[1]?.trim() || 'Unknown'}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `analytics-data-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-catalyst-gray-900 flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-catalyst-gold" />
                Analytics Dashboard
              </h1>
              <p className="mt-2 text-lg text-catalyst-gray-600">
                Comprehensive insights and market intelligence
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
              <Dialog open={showFilters} onOpenChange={setShowFilters}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2" data-testid="button-filters">
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Filter Analytics Data</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 items-center gap-4">
                      <Label htmlFor="status">Status:</Label>
                      <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)} data-testid="select-status-filter">
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {uniqueStatuses.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 items-center gap-4">
                      <Label htmlFor="city">City:</Label>
                      <Select value={filters.city} onValueChange={(value) => handleFilterChange('city', value)} data-testid="select-city-filter">
                        <SelectTrigger>
                          <SelectValue placeholder="All cities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Cities</SelectItem>
                          {uniqueCities.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 items-center gap-4">
                      <Label htmlFor="broker">Broker:</Label>
                      <Select value={filters.broker} onValueChange={(value) => handleFilterChange('broker', value)} data-testid="select-broker-filter">
                        <SelectTrigger>
                          <SelectValue placeholder="All brokers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Brokers</SelectItem>
                          {uniqueBrokers.map(broker => (
                            <SelectItem key={broker} value={broker}>{broker}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 items-center gap-4">
                      <Label htmlFor="dateRange">Date Range:</Label>
                      <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)} data-testid="select-daterange-filter">
                        <SelectTrigger>
                          <SelectValue placeholder="All dates" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="7">Last 7 days</SelectItem>
                          <SelectItem value="30">Last 30 days</SelectItem>
                          <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={exportToCSV} data-testid="button-export">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Deals",
              value: realTimeAnalytics.totalDeals,
              help: "Based on filtered data",
              icon: Building,
              iconClass: "bg-[#498EDE]/15 text-[#498EDE]",
            },
            {
              label: "Total Pipeline Value",
              value: `$${realTimeAnalytics.totalValue > 0 ? (realTimeAnalytics.totalValue / 1000000).toFixed(1) : "0.0"}M`,
              help: "Based on filtered data",
              icon: DollarSign,
              iconClass: "bg-[#498EDE]/15 text-[#498EDE]",
            },
            {
              label: "Avg Deal Size",
              value: `$${realTimeAnalytics.avgDealSize > 0 ? (realTimeAnalytics.avgDealSize / 1000000).toFixed(1) : "0.0"}M`,
              help: "Based on filtered data",
              icon: Target,
              iconClass: "bg-[#498EDE]/15 text-[#498EDE]",
            },
            {
              label: "Conversion Rate",
              value: `${isNaN(realTimeAnalytics.conversionRate) ? "0.0" : realTimeAnalytics.conversionRate.toFixed(1)}%`,
              help: "Based on filtered data",
              icon: TrendingUp,
              iconClass: "bg-[#498EDE]/15 text-[#498EDE]",
            },
          ].map(({ label, value, help, icon: Icon, iconClass }) => (
            <Card key={label} className={`${analyticsCardClass} overflow-hidden`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-[#081729]">{value}</p>
                    <p className="mt-1 text-xs text-slate-400">{help}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${iconClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Email Intake Performance */}
        {isPlatformAdmin && <Card className={`${analyticsCardClass} mb-8`} data-testid="card-email-intake-performance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-catalyst-gold" />
              Email Intake Performance
            </CardTitle>
            <p className="text-sm text-catalyst-gray-600">
              Current calendar week {emailIntakePerformance?.weekStart
                ? `starting ${new Date(emailIntakePerformance.weekStart).toLocaleDateString()}`
                : ""}
            </p>
          </CardHeader>
          <CardContent>
            {isEmailIntakeLoading ? (
              <p className="text-sm text-catalyst-gray-500">Loading email intake performance…</p>
            ) : !emailIntakePerformance || emailIntakePerformance.processedCount === 0 ? (
              <div className="rounded-lg border border-dashed border-catalyst-gray-200 p-6 text-sm text-catalyst-gray-500">
                No email intake has been processed this calendar week.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-catalyst-gray-50 p-4">
                    <p className="text-sm text-catalyst-gray-500">Emails / properties processed</p>
                    <p className="mt-1 text-2xl font-bold text-catalyst-navy">{emailIntakePerformance.processedCount}</p>
                  </div>
                  <div className="rounded-lg bg-catalyst-gray-50 p-4">
                    <p className="text-sm text-catalyst-gray-500">Auto-classified</p>
                    <p className="mt-1 text-2xl font-bold text-green-700">
                      {emailIntakePerformance.autoClassifiedCount}
                      <span className="ml-2 text-sm font-medium text-catalyst-gray-500">
                        ({((emailIntakePerformance.autoClassifiedCount / emailIntakePerformance.processedCount) * 100).toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg bg-catalyst-gray-50 p-4">
                    <p className="text-sm text-catalyst-gray-500">Average confidence</p>
                    <p className="mt-1 text-2xl font-bold text-catalyst-navy">
                      {emailIntakePerformance.averageOverallConfidence === null
                        ? "No confidence data"
                        : `${emailIntakePerformance.averageOverallConfidence.toFixed(1)}%`}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-catalyst-navy">Manual-review breakdown</h3>
                    <span className="text-sm text-catalyst-gray-600">
                      {emailIntakePerformance.manualReviewCount} ({((emailIntakePerformance.manualReviewCount / emailIntakePerformance.processedCount) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  {emailIntakePerformance.manualReviewReasons.length === 0 ? (
                    <p className="text-sm text-catalyst-gray-500">No items required manual review.</p>
                  ) : (
                    <div className="space-y-3">
                      {emailIntakePerformance.manualReviewReasons.map(({ reason, count }) => {
                        const width = emailIntakePerformance.manualReviewCount > 0
                          ? (count / emailIntakePerformance.manualReviewCount) * 100
                          : 0;
                        return (
                          <div key={reason}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                              <span className="font-medium text-catalyst-gray-700 capitalize">
                                {reason.replace(/_/g, " ")}
                              </span>
                              <span className="text-catalyst-gray-600">{count}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-catalyst-gray-200">
                              <div className="h-full rounded-full bg-catalyst-gold" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>}

        {/* Main Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-analytics">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="markets" data-testid="tab-markets">Markets</TabsTrigger>
            <TabsTrigger value="brokers" data-testid="tab-brokers">Brokers</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <Card className={analyticsCardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#081729]">
                    <PieChart className="h-5 w-5 text-[#498EDE]" />
                    Deal Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {realTimeAnalytics.statusBreakdown.length === 0 ? (
                    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                      No deal status data available for this view.
                    </div>
                  ) : (
                    <>
                      <ChartContainer config={statusChartConfig} className="mx-auto h-[220px] w-full max-w-[300px] aspect-auto">
                        <RechartsPieChart>
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent nameKey="status" hideLabel />}
                          />
                          <Pie
                            data={realTimeAnalytics.statusBreakdown}
                            dataKey="count"
                            nameKey="status"
                            innerRadius={62}
                            outerRadius={88}
                            paddingAngle={3}
                            strokeWidth={2}
                            stroke="#ffffff"
                          >
                            {realTimeAnalytics.statusBreakdown.map((item) => (
                              <Cell key={item.status} fill={getStatusChartColor(item.status)} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ChartContainer>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {realTimeAnalytics.statusBreakdown.map((item) => (
                          <div key={item.status} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: getStatusChartColor(item.status) }}
                              />
                              <span className="truncate text-xs font-medium text-slate-600">{formatStatusLabel(item.status)}</span>
                            </div>
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                              <span className="text-sm font-bold text-[#081729]">{item.count}</span>
                              <span className="text-xs text-slate-400">{item.percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Market Insights */}
              <Card className={analyticsCardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[#081729]">
                    <Activity className="h-5 w-5 text-[#498EDE]" />
                    Key Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {realTimeAnalytics.marketInsights.length === 0 ? (
                    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                      No market insights available for this view.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {realTimeAnalytics.marketInsights.map((insight, index) => {
                        const isPositive = insight.trend >= 0;
                        const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;
                        return (
                          <div key={`insight-${insight.metric}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold text-[#081729]">{insight.metric}</p>
                              <div className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                                <TrendIcon className="h-4 w-4" />
                                {Math.abs(insight.trend)}%
                              </div>
                            </div>
                            <p className="mt-3 text-2xl font-bold tracking-tight text-[#081729]">{insight.value}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{insight.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Integrated Charts */}
            <Card className={analyticsCardClass}>
              <CardHeader>
                <CardTitle className="text-[#081729]">Advanced Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <AnalyticsDashboard />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Markets Tab */}
          <TabsContent value="markets" className="space-y-6">
            <Card className={analyticsCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#081729]">
                  <MapPin className="h-5 w-5 text-[#498EDE]" />
                  Market Heat Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Markets */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Top Markets by Volume</h3>
                    <div className="space-y-3">
                      {realTimeAnalytics.cityDistribution.slice(0, 8).map((city, index) => (
                        <div key={city.city} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                              index === 0 ? 'bg-catalyst-gold' :
                              index === 1 ? 'bg-gray-400' :
                              index === 2 ? 'bg-orange-400' : 'bg-catalyst-blue'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium">{city.city}</div>
                              <div className="text-sm text-gray-500">{city.count} deals</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">${(city.avgValue / 1000000).toFixed(1)}M</div>
                            <div className="text-sm text-gray-500">avg value</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Market Trends */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Market Activity Trends</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">High Growth Markets</span>
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">Active</Badge>
                        </div>
                        <p className="text-sm text-gray-600">Based on current deal flow data</p>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">Emerging Opportunities</span>
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">Watch</Badge>
                        </div>
                        <p className="text-sm text-gray-600">Markets with increasing activity</p>
                      </div>
                      
                      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">Market Saturation</span>
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">Caution</Badge>
                        </div>
                        <p className="text-sm text-gray-600">Consider diversification in oversupplied areas</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brokers Tab */}
          <TabsContent value="brokers" className="space-y-6">
            <Card className={analyticsCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#081729]">
                  <Users className="h-5 w-5 text-[#498EDE]" />
                  Broker Performance Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="table-scroll-container">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Broker</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Deals</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Value</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Avg Deal Size</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realTimeAnalytics.brokerPerformance.map((broker, index) => (
                        <tr key={broker.broker} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                index < 3 ? 'bg-catalyst-gold' : 'bg-gray-400'
                              }`}>
                                {broker.broker.charAt(0)}
                              </div>
                              <span className="font-medium">{broker.broker}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline">{broker.deals}</Badge>
                          </td>
                          <td className="py-3 px-4 font-semibold">
                            ${(broker.totalValue / 1000000).toFixed(1)}M
                          </td>
                          <td className="py-3 px-4">
                            ${((broker.totalValue / broker.deals) / 1000000).toFixed(1)}M
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-catalyst-gold h-2 rounded-full" 
                                  style={{ width: `${Math.min(100, (broker.deals / Math.max(...realTimeAnalytics.brokerPerformance.map(b => b.deals))) * 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">
                                {((broker.deals / realTimeAnalytics.totalDeals) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <Card className={analyticsCardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#081729]">
                  <TrendingUp className="h-5 w-5 text-[#498EDE]" />
                  Market Trends & Forecasting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">Deal Velocity</h3>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{realTimeAnalytics.totalDeals} deals</p>
                    <p className="text-sm text-gray-600">Total deals processed</p>
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">Price Trends</h3>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">${realTimeAnalytics.avgDealSize > 0 ? (realTimeAnalytics.avgDealSize / 1000000).toFixed(1) : '0.0'}M</p>
                    <p className="text-sm text-gray-600">Based on deal data analysis</p>
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">Success Rate</h3>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{realTimeAnalytics.conversionRate.toFixed(1)}%</p>
                    <p className="text-sm text-gray-600">Deals conversion rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
}
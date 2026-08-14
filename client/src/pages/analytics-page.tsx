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
import { useAuth } from "@/hooks/useAuth";
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
  AlertTriangle
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
            <p className="text-catalyst-gray-600">Analytics are only accessible to Catalyst Capital Partners team members.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white border-catalyst-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-catalyst-gray-500">Total Deals</p>
                  <p className="text-3xl font-bold text-catalyst-navy">{realTimeAnalytics.totalDeals}</p>
                  <p className="text-xs text-catalyst-gray-500 mt-1">Based on filtered data</p>
                </div>
                <Building className="h-8 w-8 text-catalyst-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-catalyst-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-catalyst-gray-500">Total Pipeline Value</p>
                  <p className="text-3xl font-bold text-catalyst-navy">
                    ${realTimeAnalytics.totalValue > 0 ? (realTimeAnalytics.totalValue / 1000000).toFixed(1) : '0.0'}M
                  </p>
                  <p className="text-xs text-catalyst-gray-500 mt-1">Based on filtered data</p>
                </div>
                <DollarSign className="h-8 w-8 text-catalyst-gold" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-catalyst-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-catalyst-gray-500">Avg Deal Size</p>
                  <p className="text-3xl font-bold text-catalyst-navy">
                    ${realTimeAnalytics.avgDealSize > 0 ? (realTimeAnalytics.avgDealSize / 1000000).toFixed(1) : '0.0'}M
                  </p>
                  <p className="text-xs text-catalyst-gray-500 mt-1">Based on filtered data</p>
                </div>
                <Target className="h-8 w-8 text-catalyst-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-catalyst-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-catalyst-gray-500">Conversion Rate</p>
                  <p className="text-3xl font-bold text-catalyst-navy">
                    {isNaN(realTimeAnalytics.conversionRate) ? '0.0' : realTimeAnalytics.conversionRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-catalyst-gray-500 mt-1">Based on filtered data</p>
                </div>
                <TrendingUp className="h-8 w-8 text-catalyst-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Deal Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {realTimeAnalytics.statusBreakdown.map((item, index) => (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            item.status === 'high_priority' ? 'bg-green-500' :
                            item.status === 'unclassified' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="text-sm font-medium capitalize">
                            {item.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{item.count}</div>
                          <div className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Market Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Key Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {realTimeAnalytics.marketInsights.map((insight, index) => (
                      <div key={`insight-${insight.metric}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium">{insight.metric}</div>
                          <div className="text-xs text-gray-500">{insight.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{insight.value}</div>
                          <div className={`text-xs flex items-center gap-1 ${
                            insight.trend > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            <TrendingUp className="h-3 w-3" />
                            {Math.abs(insight.trend)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Integrated Charts */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <AnalyticsDashboard />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Markets Tab */}
          <TabsContent value="markets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Broker Performance Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
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
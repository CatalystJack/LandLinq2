import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DeveloperNavigation from "@/components/developer-navigation";
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
  Activity, BarChart3, Building, DollarSign, Download, Filter, MapPin,
  PieChart, Shield, Target, TrendingUp, Users, Zap,
} from "lucide-react";

interface Deal {
  id: string;
  address: string;
  askingPrice: string | number | null;
  sizeAcres?: number;
  status: string;
  classification: string;
  brokerName?: string;
  submittedDate: string;
  createdAt?: string;
  city?: string;
  state?: string;
  broker?: { firstName?: string; lastName?: string; email?: string; brokerage?: string };
}

interface AnalyticsData {
  deals: Deal[];
  outreachStats: { sent: number; opens: number; clicks: number; replies: number };
  advancedDashboard?: {
    dailySubmissions: { date: string; count: number; value: number }[];
    regionActivity: { region: string; count: number; avgValue: number; lat: number; lng: number }[];
    productTypeDistribution: { type: string; count: number; totalValue: number }[];
    pipelineValue: { stage: string; count: number; value: number }[];
    monthlyTrends: { month: string; submissions: number; closings: number; revenue: number }[];
  };
}

const price = (deal: Deal) => Number(deal.askingPrice) || 0;
const brokerName = (deal: Deal) =>
  deal.broker?.firstName || deal.broker?.lastName
    ? [deal.broker.firstName, deal.broker.lastName].filter(Boolean).join(" ")
    : deal.brokerName || "Unknown Broker";
const cityName = (deal: Deal) => deal.city || deal.address?.split(",")[1]?.trim() || "Unknown";

async function loadAnalytics(): Promise<AnalyticsData> {
  const response = await fetch("/api/developer-profile/me/analytics", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load analytics");
  return response.json();
}

export default function DeveloperAnalytics() {
  const { isAuthenticated, user } = useAuth();
  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ["/api/developer-profile/me/analytics"],
    queryFn: loadAnalytics,
    enabled: isAuthenticated,
  });
  const [filters, setFilters] = useState({ status: "all", city: "all", broker: "all", dateRange: "all" });
  const [showFilters, setShowFilters] = useState(false);
  const deals = data?.deals || [];

  const filteredDeals = useMemo(() => deals.filter((deal) => {
    if (filters.status !== "all" && deal.status !== filters.status) return false;
    if (filters.city !== "all" && cityName(deal) !== filters.city) return false;
    if (filters.broker !== "all" && brokerName(deal) !== filters.broker) return false;
    if (filters.dateRange !== "all") {
      const cutoff = Date.now() - Number(filters.dateRange) * 86400000;
      if (new Date(deal.submittedDate || deal.createdAt || 0).getTime() < cutoff) return false;
    }
    return true;
  }), [deals, filters]);

  const analytics = useMemo(() => {
    const totalValue = filteredDeals.reduce((sum, deal) => sum + price(deal), 0);
    const statusCounts: Record<string, number> = {};
    const cities: Record<string, { count: number; value: number }> = {};
    const brokers: Record<string, { deals: number; value: number }> = {};
    filteredDeals.forEach((deal) => {
      statusCounts[deal.status] = (statusCounts[deal.status] || 0) + 1;
      const city = cityName(deal);
      cities[city] = cities[city] || { count: 0, value: 0 };
      cities[city].count++;
      cities[city].value += price(deal);
      const broker = brokerName(deal);
      if (broker !== "Unknown Broker") {
        brokers[broker] = brokers[broker] || { deals: 0, value: 0 };
        brokers[broker].deals++;
        brokers[broker].value += price(deal);
      }
    });
    const statusBreakdown = ["Passed", "Review", "Pursuing"].map((status) => ({
      status,
      count: statusCounts[status] || 0,
      percentage: filteredDeals.length ? (statusCounts[status] || 0) / filteredDeals.length * 100 : 0,
    }));
    const cityDistribution = Object.entries(cities)
      .map(([city, value]) => ({ city, count: value.count, avgValue: value.value / value.count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
    const brokerPerformance = Object.entries(brokers)
      .map(([broker, value]) => ({ broker, deals: value.deals, totalValue: value.value, avgDays: 0 }))
      .sort((a, b) => b.totalValue - a.totalValue).slice(0, 10);
    const pursuing = statusCounts.Pursuing || 0;
    const conversionRate = filteredDeals.length ? pursuing / filteredDeals.length * 100 : 0;
    return {
      totalDeals: filteredDeals.length, totalValue,
      avgDealSize: filteredDeals.length ? totalValue / filteredDeals.length : 0,
      conversionRate, statusBreakdown, cityDistribution, brokerPerformance,
      marketInsights: filteredDeals.length ? [
        { metric: "Deal Velocity", value: `${(filteredDeals.length / 30).toFixed(1)}/day`, trend: 0, description: "Average deals submitted per day" },
        { metric: "Hot Markets", value: cityDistribution[0]?.city || "No data", trend: 0, description: "Top performing market by volume" },
        { metric: "Pipeline Health", value: `${conversionRate.toFixed(1)}%`, trend: 0, description: "Deals in active pursuit" },
      ] : [],
    };
  }, [filteredDeals]);

  if (!isAuthenticated || String((user as any)?.role || "").toUpperCase() !== "DEVELOPER") {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><Shield className="mx-auto mb-4 h-14 w-14 text-slate-300" /><h1 className="text-2xl font-bold">Access Restricted</h1><p className="mt-2 text-slate-500">Analytics are only available to Investment Company users.</p></div></div>;
  }
  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading analytics...</div>;
  if (isError) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Unable to load analytics right now.</div>;

  const uniqueCities = Array.from(new Set(deals.map(cityName)));
  const uniqueBrokers = Array.from(new Set(deals.map(brokerName))).filter((broker) => broker !== "Unknown Broker");
  const outreach = data?.outreachStats || { sent: 0, opens: 0, clicks: 0, replies: 0 };
  const exportToCSV = () => {
    const rows = [
      ["Address", "Asking Price", "Status", "Classification", "Broker", "Submitted Date", "City"],
      ...filteredDeals.map((deal) => [deal.address, String(deal.askingPrice || ""), deal.status, deal.classification, brokerName(deal), deal.submittedDate, cityName(deal)]),
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `investment-company-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DeveloperNavigation />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h1 className="flex items-center gap-3 text-3xl font-bold text-catalyst-gray-900"><BarChart3 className="h-8 w-8 text-catalyst-gold" />Analytics Dashboard</h1><p className="mt-2 text-lg text-catalyst-gray-600">Your company’s deal flow, markets, brokers, and outreach performance</p></div>
          <div className="flex gap-2">
            <Dialog open={showFilters} onOpenChange={setShowFilters}><DialogTrigger asChild><Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" />Filters</Button></DialogTrigger><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Filter Analytics Data</DialogTitle></DialogHeader><div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 items-center gap-4"><Label>Status:</Label><Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}><SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{["Passed", "Review", "Pursuing"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 items-center gap-4"><Label>City:</Label><Select value={filters.city} onValueChange={(value) => setFilters({ ...filters, city: value })}><SelectTrigger><SelectValue placeholder="All cities" /></SelectTrigger><SelectContent><SelectItem value="all">All Cities</SelectItem>{uniqueCities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 items-center gap-4"><Label>Broker:</Label><Select value={filters.broker} onValueChange={(value) => setFilters({ ...filters, broker: value })}><SelectTrigger><SelectValue placeholder="All brokers" /></SelectTrigger><SelectContent><SelectItem value="all">All Brokers</SelectItem>{uniqueBrokers.map((broker) => <SelectItem key={broker} value={broker}>{broker}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 items-center gap-4"><Label>Date Range:</Label><Select value={filters.dateRange} onValueChange={(value) => setFilters({ ...filters, dateRange: value })}><SelectTrigger><SelectValue placeholder="All dates" /></SelectTrigger><SelectContent><SelectItem value="all">All Time</SelectItem><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select></div>
            </div></DialogContent></Dialog>
            <Button variant="outline" size="sm" onClick={exportToCSV}><Download className="mr-2 h-4 w-4" />Export</Button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total Deals", analytics.totalDeals, "Based on filtered data", Building],
            ["Total Pipeline Value", `$${(analytics.totalValue / 1000000).toFixed(1)}M`, "Based on filtered data", DollarSign],
            ["Avg Deal Size", `$${(analytics.avgDealSize / 1000000).toFixed(1)}M`, "Based on filtered data", Target],
            ["Conversion Rate", `${analytics.conversionRate.toFixed(1)}%`, "Pursuing / total deals", TrendingUp],
          ].map(([label, value, help, Icon]) => <Card key={String(label)}><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-catalyst-gray-500">{label}</p><p className="text-3xl font-bold text-catalyst-navy">{value}</p><p className="mt-1 text-xs text-catalyst-gray-500">{help}</p></div><Icon className="h-8 w-8 text-catalyst-gray-400" /></div></CardContent></Card>)}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="markets">Markets</TabsTrigger><TabsTrigger value="brokers">Brokers</TabsTrigger><TabsTrigger value="trends">Trends</TabsTrigger></TabsList>
          <TabsContent value="overview" className="space-y-6"><div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" />Deal Status Distribution</CardTitle></CardHeader><CardContent className="space-y-4">{analytics.statusBreakdown.map((item) => <div key={item.status} className="flex items-center justify-between"><div className="flex items-center gap-3"><div className={`h-3 w-3 rounded-full ${item.status === "Pursuing" ? "bg-green-500" : item.status === "Passed" ? "bg-blue-500" : "bg-yellow-500"}`} /><span className="text-sm font-medium">{item.status}</span></div><div className="text-right"><div className="text-sm font-bold">{item.count}</div><div className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</div></div></div>)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Key Performance Metrics</CardTitle></CardHeader><CardContent className="space-y-4">{analytics.marketInsights.map((item) => <div key={item.metric} className="flex items-center justify-between rounded-lg bg-gray-50 p-3"><div><div className="text-sm font-medium">{item.metric}</div><div className="text-xs text-gray-500">{item.description}</div></div><div className="text-right"><div className="text-lg font-bold">{item.value}</div><div className="flex items-center gap-1 text-xs text-gray-500"><TrendingUp className="h-3 w-3" />{Math.abs(item.trend)}%</div></div></div>)}</CardContent></Card>
          </div><Card><CardHeader><CardTitle>Advanced Analytics Dashboard</CardTitle></CardHeader><CardContent><AnalyticsDashboard dataOverride={data?.advancedDashboard} allowFetch={false} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Outreach Engagement</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[["Sent", outreach.sent], ["Opens", outreach.opens], ["Clicks", outreach.clicks], ["Replies", outreach.replies]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-gray-50 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</CardContent></Card></TabsContent>
          <TabsContent value="markets"><Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Market Heat Map</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div><h3 className="mb-4 text-lg font-semibold">Top Markets by Volume</h3>{analytics.cityDistribution.slice(0, 8).map((city, index) => <div key={city.city} className="mb-3 flex items-center justify-between rounded-lg bg-gray-50 p-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-catalyst-blue text-sm font-bold text-white">{index + 1}</div><div><div className="font-medium">{city.city}</div><div className="text-sm text-gray-500">{city.count} deals</div></div></div><div className="text-right font-bold">${(city.avgValue / 1000000).toFixed(1)}M</div></div>)}</div><div className="space-y-4"><h3 className="text-lg font-semibold">Market Activity Trends</h3>{["High Growth Markets", "Emerging Opportunities", "Market Saturation"].map((item, index) => <div key={item} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-2 flex items-center justify-between"><span className="font-medium">{item}</span><Badge variant="secondary">{index === 0 ? "Active" : index === 1 ? "Watch" : "Caution"}</Badge></div><p className="text-sm text-gray-600">Based on your current deal flow data</p></div>)}</div></CardContent></Card></TabsContent>
          <TabsContent value="brokers"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Broker Performance Analytics</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="px-4 py-3 text-left">Broker</th><th className="px-4 py-3 text-left">Deals</th><th className="px-4 py-3 text-left">Total Value</th><th className="px-4 py-3 text-left">Avg Deal Size</th></tr></thead><tbody>{analytics.brokerPerformance.map((broker) => <tr key={broker.broker} className="border-b"><td className="px-4 py-3 font-medium">{broker.broker}</td><td className="px-4 py-3"><Badge variant="outline">{broker.deals}</Badge></td><td className="px-4 py-3 font-semibold">${(broker.totalValue / 1000000).toFixed(1)}M</td><td className="px-4 py-3">${((broker.totalValue / broker.deals) / 1000000).toFixed(1)}M</td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>
          <TabsContent value="trends"><Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Market Trends & Forecasting</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">{[["Deal Velocity", `${analytics.totalDeals} deals`, "Total deals processed", Zap], ["Price Trends", `$${(analytics.avgDealSize / 1000000).toFixed(1)}M`, "Based on deal data analysis", DollarSign], ["Success Rate", `${analytics.conversionRate.toFixed(1)}%`, "Deals conversion rate", Target]].map(([label, value, help, Icon]) => <div key={String(label)} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><Icon className="h-5 w-5 text-blue-600" /><h3 className="font-semibold">{label}</h3></div><p className="mb-1 text-2xl font-bold">{value}</p><p className="text-sm text-gray-600">{help}</p></div>)}</CardContent></Card></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
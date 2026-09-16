import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, MapPin, DollarSign, Calendar, PieChart, AlertCircle, Settings2 } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface AnalyticsData {
  dailySubmissions: { date: string; count: number; value: number }[];
  regionActivity: { region: string; count: number; avgValue: number; lat: number; lng: number }[];
  productTypeDistribution: { type: string; count: number; totalValue: number }[];
  pipelineValue: { stage: string; count: number; value: number }[];
  monthlyTrends: { month: string; submissions: number; closings: number; revenue: number }[];
}

export default function AnalyticsDashboard({
  dataOverride,
  allowFetch = true,
}: {
  dataOverride?: AnalyticsData;
  allowFetch?: boolean;
} = {}) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Fetch real analytics data from the API
  const { data: queriedAnalyticsData, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: [`/api/analytics/dashboard?timeRange=${timeRange}`],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    enabled: allowFetch && !dataOverride,
  });
  const analyticsData = dataOverride || queriedAnalyticsData;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-catalyst-gray-500">Loading analytics...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-catalyst-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
          <p>Failed to load analytics data</p>
          <p className="text-sm">Please try again later</p>
        </div>
      </div>
    );
  }

  // Empty state - when no data is available
  if (!analyticsData || (!analyticsData.dailySubmissions?.length && !analyticsData.regionActivity?.length && !analyticsData.productTypeDistribution?.length)) {
    return (
      <div className="space-y-6">
        {/* Time Range Selector */}
        <div className="flex items-center justify-between">
          <div className="flex w-full items-center justify-end gap-2">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="text-xs"
              >
                {range === '7d' ? '7 Days' : 
                 range === '30d' ? '30 Days' : 
                 range === '90d' ? '90 Days' : '1 Year'}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Empty State */}
        <div className="flex items-center justify-center h-64 border-2 border-dashed border-catalyst-gray-200 rounded-lg">
          <div className="text-center text-catalyst-gray-500">
            <PieChart className="h-12 w-12 mx-auto mb-4 text-catalyst-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No Analytics Data Available</h3>
            <p>No deal data found for the selected time range.</p>
            <p className="text-sm">Data will appear here once deals are submitted.</p>
          </div>
        </div>
      </div>
    );
  }

  const dailySubmissionsData = analyticsData.dailySubmissions.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: item.count,
  }));
  const productTypeData = analyticsData.productTypeDistribution.map((item) => ({
    type: item.type,
    count: item.count,
  }));
  const pipelineData = analyticsData.pipelineValue.map((item) => ({
    stage: item.stage,
    count: item.count,
  }));
  const monthlyTrendData = analyticsData.monthlyTrends.map((item) => ({
    month: item.month,
    submissions: item.submissions,
    closings: item.closings,
  }));
  const productTypeColors = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
  const pipelineColors = ['#22C55E', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d', '1y'] as const).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range)}
              className="text-xs"
              data-testid={`button-timerange-${range}`}
            >
              {range === '7d' ? '7 Days' : 
               range === '30d' ? '30 Days' : 
               range === '90d' ? '90 Days' : '1 Year'}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Trend */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Daily Activity Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ count: { label: "Submissions", color: "#1e3a8a" } }}
              className="h-[260px] w-full"
            >
              <LineChart data={dailySubmissionsData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#1e3a8a"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Product Type Distribution */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Product Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                count: { label: "Deals", color: "#1e3a8a" },
              }}
              className="mx-auto h-[260px] w-full max-w-[360px]"
            >
              <RechartsPieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="type" hideLabel />} />
                <Pie
                  data={productTypeData}
                  dataKey="count"
                  nameKey="type"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={3}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {productTypeData.map((item, index) => (
                    <Cell key={item.type} fill={productTypeColors[index % productTypeColors.length]} />
                  ))}
                </Pie>
                <Legend />
              </RechartsPieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Pipeline Value */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsData.pipelineValue?.length ? (
              <ChartContainer
                config={{ count: { label: "Deals", color: "#498EDE" } }}
                className="h-[260px] w-full"
              >
                <BarChart data={pipelineData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="stage" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {pipelineData.map((item, index) => (
                      <Cell key={item.stage} fill={pipelineColors[index % pipelineColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-catalyst-gray-200 px-6 text-center">
                <div className="mb-3 rounded-full bg-catalyst-blue/10 p-3 text-catalyst-blue">
                  <Settings2 className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-catalyst-navy">No pipeline stages configured yet.</p>
                {typeof window !== "undefined" && window.location.pathname.startsWith("/developer") && (
                  <a href="/developer/pipeline" className="mt-2 text-sm font-medium text-catalyst-blue hover:underline">
                    Configure pipeline stages
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Performance */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                submissions: { label: "Submissions", color: "#1e3a8a" },
                closings: { label: "Closings", color: "#2563eb" },
              }}
              className="h-[260px] w-full"
            >
              <BarChart data={monthlyTrendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="submissions" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closings" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Regional Activity Overview */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Regional Activity Overview
          </CardTitle>
          <p className="text-sm text-catalyst-gray-600">
            Total: {analyticsData.regionActivity.reduce((sum: number, r: { count: number }) => sum + r.count, 0)} deals across {analyticsData.regionActivity.length} regions
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const totalDeals = analyticsData.regionActivity.reduce((sum: number, r: { count: number }) => sum + r.count, 0);
              const maxRegionCount = Math.max(...analyticsData.regionActivity.map((r: { count: number }) => r.count));
              
              return analyticsData.regionActivity
                .sort((a: { region: string; count: number; avgValue: number; lat: number; lng: number }, b: { region: string; count: number; avgValue: number; lat: number; lng: number }) => b.count - a.count)
                .map((region: { region: string; count: number; avgValue: number; lat: number; lng: number }) => {
                  const percentage = totalDeals > 0 ? (region.count / totalDeals) * 100 : 0;
                  const barWidth = maxRegionCount > 0 ? (region.count / maxRegionCount) * 100 : 0;
                  
                  return (
                    <div
                      key={region.region}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        selectedRegion === region.region
                          ? 'border-catalyst-blue bg-catalyst-blue/10'
                          : 'border-catalyst-gray-200 hover:border-catalyst-blue/50'
                      }`}
                      onClick={() => setSelectedRegion(selectedRegion === region.region ? null : region.region)}
                      data-testid={`card-region-${region.region.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-catalyst-navy">{region.region}</h4>
                        <Badge 
                          className={`${
                            percentage > 25 ? 'bg-red-500' : 
                            percentage > 15 ? 'bg-orange-500' : 
                            percentage > 10 ? 'bg-yellow-500' : 'bg-green-500'
                          } text-white`}
                        >
                          {percentage > 25 ? 'High' : 
                           percentage > 15 ? 'Medium-High' : 
                           percentage > 10 ? 'Medium' : 'Low'}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-catalyst-gray-600">
                          <span className="font-medium">{region.count}</span> deals <span className="text-catalyst-gray-500">({percentage.toFixed(1)}%)</span>
                        </p>
                        <p className="text-sm text-catalyst-gray-600">
                          Avg: <span className="font-medium">${(region.avgValue / 1000000).toFixed(1)}M</span>
                        </p>
                      </div>
                      
                      {/* Activity Intensity Bar - relative to max region */}
                      <div className="mt-3">
                        <div className="w-full bg-catalyst-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              percentage > 25 ? 'bg-red-500' : 
                              percentage > 15 ? 'bg-orange-500' : 
                              percentage > 10 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
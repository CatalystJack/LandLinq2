import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, MapPin, DollarSign, Calendar, PieChart, AlertCircle } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { useQuery } from '@tanstack/react-query';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement
);

// Set global font configuration for all charts
ChartJS.defaults.font.family = '"Inter", sans-serif';
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = '#374151';

interface AnalyticsData {
  dailySubmissions: { date: string; count: number; value: number }[];
  regionActivity: { region: string; count: number; avgValue: number; lat: number; lng: number }[];
  productTypeDistribution: { type: string; count: number; totalValue: number }[];
  pipelineValue: { stage: string; count: number; value: number }[];
  monthlyTrends: { month: string; submissions: number; closings: number; revenue: number }[];
}

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Fetch real analytics data from the API
  const { data: analyticsData, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: [`/api/analytics/dashboard?timeRange=${timeRange}`],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

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
          <h3 className="text-lg font-semibold text-catalyst-navy">Analytics Dashboard</h3>
          <div className="flex items-center gap-2">
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

  // Chart data configurations
  const dailySubmissionsData = {
    labels: analyticsData.dailySubmissions.map((d: { date: string; count: number; value: number }) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Daily Submissions',
        data: analyticsData.dailySubmissions.map((d: { date: string; count: number; value: number }) => d.count),
        borderColor: '#1f2937',
        backgroundColor: 'rgba(31, 41, 55, 0.1)',
        tension: 0.4,
      },
    ]
  };

  const productTypeData = {
    labels: analyticsData.productTypeDistribution.map((p: { type: string; count: number; totalValue: number }) => p.type),
    datasets: [{
      data: analyticsData.productTypeDistribution.map((p: { type: string; count: number; totalValue: number }) => p.count),
      backgroundColor: [
        '#1e3a8a', // Conventional - Catalyst Navy (main brand blue)
        '#d4af37', // Build-to-Rent - Catalyst Gold (keep gold accent)
        '#2563eb', // Active Adult - Bright Blue
        '#60a5fa', // Affordable - Light Blue
        '#93c5fd', // Lot Development - Lighter Blue
      ],
      borderWidth: 2,
      borderColor: '#ffffff',
    }]
  };

  const pipelineData = {
    labels: analyticsData.pipelineValue.map((p: { stage: string; count: number; value: number }) => p.stage),
    datasets: [
      {
        label: 'Count',
        data: analyticsData.pipelineValue.map((p: { stage: string; count: number; value: number }) => p.count),
        backgroundColor: ['#22C55E', '#F59E0B', '#EF4444'], // Keep status colors: Pursuing (green), Reviewing (yellow), Passed (red)
        borderRadius: 4,
      }
    ]
  };

  const monthlyTrendData = {
    labels: analyticsData.monthlyTrends.map((m: { month: string; submissions: number; closings: number; revenue: number }) => m.month),
    datasets: [
      {
        label: 'Submissions',
        data: analyticsData.monthlyTrends.map((m: { month: string; submissions: number; closings: number; revenue: number }) => m.submissions),
        backgroundColor: '#1e3a8a', // Catalyst Navy
        borderRadius: 4,
      },
      {
        label: 'Closings',
        data: analyticsData.monthlyTrends.map((m: { month: string; submissions: number; closings: number; revenue: number }) => m.closings),
        backgroundColor: '#2563eb', // Bright Blue
        borderRadius: 4,
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-catalyst-navy">Analytics Dashboard</h3>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Daily Activity Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Line data={dailySubmissionsData} options={{
              responsive: true,
              interaction: {
                mode: 'index' as const,
                intersect: false,
              },
              plugins: {
                legend: {
                  position: 'top' as const,
                }
              },
              scales: {
                y: {
                  type: 'linear' as const,
                  display: true,
                  position: 'left' as const,
                  beginAtZero: true,
                },
              }
            }} />
          </CardContent>
        </Card>

        {/* Product Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Product Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Doughnut data={productTypeData} options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'bottom' as const,
                }
              }
            }} />
          </CardContent>
        </Card>

        {/* Pipeline Value */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bar data={pipelineData} options={{
              responsive: true,
              plugins: {
                legend: {
                  display: false,
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                }
              }
            }} />
          </CardContent>
        </Card>

        {/* Monthly Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bar data={monthlyTrendData} options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'top' as const,
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                }
              }
            }} />
          </CardContent>
        </Card>
      </div>

      {/* Regional Activity Overview */}
      <Card>
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
                          ? 'border-catalyst-gold bg-catalyst-gold/10'
                          : 'border-catalyst-gray-200 hover:border-catalyst-gold/50'
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
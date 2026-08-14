import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Shield,
  Database,
  AlertCircle,
  RefreshCw,
  Eye,
  Target,
  Zap
} from "lucide-react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DataQualityReport {
  overview: {
    overallHealthScore: number;
    totalValidations: number;
    averageConfidence: number;
    averageQualityScore: number;
    activeAlerts: number;
  };
  confidenceDistribution: {
    high: number;    // >= 85%
    medium: number;  // 65-84%
    low: number;     // 45-64%
    critical: number; // < 45%
  };
  sourceReliability: Array<{
    sourceName: string;
    successRate: number;
    averageResponseTime: number;
    averageConfidence: number;
    status: 'healthy' | 'degraded' | 'critical';
  }>;
  trendAnalysis: {
    confidenceTrend: 'improving' | 'stable' | 'declining';
    qualityTrend: 'improving' | 'stable' | 'declining';
    reliabilityTrend: 'improving' | 'stable' | 'declining';
  };
  recentAlerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    createdAt: Date;
  }>;
}

interface DataQualityMetrics {
  overallHealthScore: number;
  activeAlerts: number;
  recentValidations: number;
  averageConfidence: number;
  serviceHealthScores: Record<string, any>;
  lastUpdated: Date;
}

interface DataQualityAlert {
  id: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  dealId?: string;
  sourceName?: string;
  message: string;
  confidenceScore?: number;
  isResolved: boolean;
  createdAt: Date;
}

interface QualitySnapshot {
  timestamp: Date;
  overallHealthScore: number;
  activeAlertsCount: number;
  recentValidationsCount: number;
  averageRecentConfidence: number;
  serviceHealthScores: Record<string, any>;
}

export default function DataQualityDashboard() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch data quality report
  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery<DataQualityReport>({
    queryKey: ['/api/admin/data-quality-report', selectedTimeframe === '7d' ? 7 : selectedTimeframe === '30d' ? 30 : 1],
    refetchInterval: autoRefresh ? 30000 : false // Refresh every 30 seconds if auto-refresh is enabled
  });

  // Fetch current metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<DataQualityMetrics>({
    queryKey: ['/api/admin/data-quality-metrics'],
    refetchInterval: autoRefresh ? 10000 : false // Refresh every 10 seconds
  });

  // Fetch active alerts
  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<DataQualityAlert[]>({
    queryKey: ['/api/admin/data-quality-alerts'],
    refetchInterval: autoRefresh ? 5000 : false // Refresh every 5 seconds
  });

  // Fetch historical snapshots for charts
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery<QualitySnapshot[]>({
    queryKey: ['/api/admin/data-quality-snapshots', selectedTimeframe === '24h' ? 24 : selectedTimeframe === '7d' ? 168 : 720],
    refetchInterval: autoRefresh ? 60000 : false // Refresh every minute
  });

  // Resolve alert
  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/data-quality-alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        refetchAlerts();
        refetchMetrics();
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  // Manual refresh all data
  const handleRefresh = () => {
    refetchReport();
    refetchMetrics();
    refetchAlerts();
  };

  // Get status color for health score
  const getHealthScoreColor = (score: number): string => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    if (score >= 60) return "text-orange-600";
    return "text-red-600";
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get severity badge color
  const getSeverityBadgeColor = (severity: string): string => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Generate chart data for health score over time
  const generateHealthScoreChart = () => {
    if (!snapshots || snapshots.length === 0) return null;

    const labels = snapshots.map(snapshot => 
      new Date(snapshot.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    );
    
    const data = snapshots.map(snapshot => snapshot.overallHealthScore);

    return {
      labels,
      datasets: [
        {
          label: 'Health Score',
          data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        }
      ]
    };
  };

  // Generate chart data for confidence distribution
  const generateConfidenceChart = () => {
    if (!report?.confidenceDistribution) return null;

    return {
      labels: ['High (≥85%)', 'Medium (65-84%)', 'Low (45-64%)', 'Critical (<45%)'],
      datasets: [
        {
          label: 'Validation Count',
          data: [
            report.confidenceDistribution.high,
            report.confidenceDistribution.medium,
            report.confidenceDistribution.low,
            report.confidenceDistribution.critical
          ],
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            'rgb(34, 197, 94)',
            'rgb(251, 191, 36)',
            'rgb(249, 115, 22)',
            'rgb(239, 68, 68)'
          ],
          borderWidth: 1
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Score'
        },
        min: 0,
        max: 100
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-catalyst-navy" />
              <div>
                <h1 className="text-3xl font-bold text-catalyst-navy dark:text-white">
                  Data Quality Monitoring
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Real-time accuracy metrics and automated alerts
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Auto-refresh toggle */}
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center space-x-2"
              data-testid="toggle-auto-refresh"
            >
              <Activity className={`h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              <span>{autoRefresh ? 'Live' : 'Paused'}</span>
            </Button>
            
            {/* Manual refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center space-x-2"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
            
            {/* Timeframe selector */}
            <Tabs 
              value={selectedTimeframe} 
              onValueChange={(value) => setSelectedTimeframe(value as '24h' | '7d' | '30d')}
            >
              <TabsList>
                <TabsTrigger value="24h" data-testid="tab-24h">24H</TabsTrigger>
                <TabsTrigger value="7d" data-testid="tab-7d">7D</TabsTrigger>
                <TabsTrigger value="30d" data-testid="tab-30d">30D</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Overall Health Score */}
          <Card data-testid="card-health-score">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Health Score</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">
                  <span className={getHealthScoreColor(metrics?.overallHealthScore || 0)} data-testid="text-health-score">
                    {metrics?.overallHealthScore?.toFixed(1) || '0.0'}%
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                System-wide data quality
              </p>
            </CardContent>
          </Card>

          {/* Active Alerts */}
          <Card data-testid="card-active-alerts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold text-orange-600" data-testid="text-active-alerts">
                  {metrics?.activeAlerts || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Requiring attention
              </p>
            </CardContent>
          </Card>

          {/* Average Confidence */}
          <Card data-testid="card-avg-confidence">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-blue-600" data-testid="text-avg-confidence">
                  {metrics?.averageConfidence?.toFixed(1) || '0.0'}%
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Recent validations
              </p>
            </CardContent>
          </Card>

          {/* Recent Validations */}
          <Card data-testid="card-recent-validations">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Validations</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className="text-2xl font-bold text-green-600" data-testid="text-recent-validations">
                  {metrics?.recentValidations || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Last hour
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="sources" data-testid="tab-sources">Source Health</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              Alerts {alerts && alerts.length > 0 && <Badge className="ml-1 text-xs">{alerts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Health Score Chart */}
              <Card data-testid="card-health-chart">
                <CardHeader>
                  <CardTitle>Health Score Trend</CardTitle>
                  <CardDescription>
                    Overall system health over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshotsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : generateHealthScoreChart() ? (
                    <div className="h-64">
                      <Line data={generateHealthScoreChart()!} options={chartOptions} />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Confidence Distribution */}
              <Card data-testid="card-confidence-distribution">
                <CardHeader>
                  <CardTitle>Confidence Distribution</CardTitle>
                  <CardDescription>
                    Validation confidence levels ({selectedTimeframe})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : generateConfidenceChart() ? (
                    <div className="h-64">
                      <Bar data={generateConfidenceChart()!} options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            display: false
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            title: {
                              display: true,
                              text: 'Number of Validations'
                            }
                          }
                        }
                      }} />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Trend Analysis */}
            {report && (
              <Card data-testid="card-trend-analysis">
                <CardHeader>
                  <CardTitle>Trend Analysis</CardTitle>
                  <CardDescription>
                    System performance trends over the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Confidence Trend</p>
                        <p className="text-xs text-muted-foreground">Data accuracy direction</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {report.trendAnalysis.confidenceTrend === 'improving' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : report.trendAnalysis.confidenceTrend === 'declining' ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <Activity className="h-4 w-4 text-gray-600" />
                        )}
                        <Badge variant="outline" className="capitalize">
                          {report.trendAnalysis.confidenceTrend}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Quality Trend</p>
                        <p className="text-xs text-muted-foreground">Overall quality direction</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {report.trendAnalysis.qualityTrend === 'improving' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : report.trendAnalysis.qualityTrend === 'declining' ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <Activity className="h-4 w-4 text-gray-600" />
                        )}
                        <Badge variant="outline" className="capitalize">
                          {report.trendAnalysis.qualityTrend}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Reliability Trend</p>
                        <p className="text-xs text-muted-foreground">Service reliability direction</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {report.trendAnalysis.reliabilityTrend === 'improving' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : report.trendAnalysis.reliabilityTrend === 'declining' ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <Activity className="h-4 w-4 text-gray-600" />
                        )}
                        <Badge variant="outline" className="capitalize">
                          {report.trendAnalysis.reliabilityTrend}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Source Health Tab */}
          <TabsContent value="sources" className="space-y-6">
            <Card data-testid="card-source-health">
              <CardHeader>
                <CardTitle>Data Source Health</CardTitle>
                <CardDescription>
                  Real-time monitoring of all external data sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : report?.sourceReliability && report.sourceReliability.length > 0 ? (
                  <div className="space-y-4">
                    {report.sourceReliability.map((source) => (
                      <div key={source.sourceName} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`source-${source.sourceName}`}>
                        <div className="flex items-center space-x-4">
                          <div className={`h-3 w-3 rounded-full ${
                            source.status === 'healthy' ? 'bg-green-500' : 
                            source.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <div>
                            <h4 className="font-medium capitalize">{source.sourceName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {source.averageResponseTime.toFixed(0)}ms avg response
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">{source.successRate.toFixed(1)}% success</p>
                            <p className="text-xs text-muted-foreground">{source.averageConfidence.toFixed(1)}% confidence</p>
                          </div>
                          <Badge className={getStatusBadgeColor(source.status)}>
                            {source.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No source health data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <Card data-testid="card-alerts-list">
              <CardHeader>
                <CardTitle>Active Data Quality Alerts</CardTitle>
                <CardDescription>
                  Real-time alerts requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : alerts && alerts.length > 0 ? (
                  <div className="space-y-4">
                    {alerts.map((alert) => (
                      <Alert key={alert.id} className="relative" data-testid={`alert-${alert.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            {alert.severity === 'critical' ? (
                              <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                            ) : alert.severity === 'high' ? (
                              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                            )}
                            
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <AlertTitle className="text-sm">{alert.message}</AlertTitle>
                                <Badge className={getSeverityBadgeColor(alert.severity)}>
                                  {alert.severity}
                                </Badge>
                              </div>
                              
                              <AlertDescription className="text-xs">
                                <div className="flex items-center space-x-4 text-muted-foreground">
                                  <span>Type: {alert.alertType}</span>
                                  {alert.dealId && <span>Deal: {alert.dealId.substring(0, 8)}</span>}
                                  {alert.sourceName && <span>Source: {alert.sourceName}</span>}
                                  {alert.confidenceScore && <span>Confidence: {alert.confidenceScore}%</span>}
                                  <span>
                                    <Clock className="h-3 w-3 inline mr-1" />
                                    {new Date(alert.createdAt).toLocaleString()}
                                  </span>
                                </div>
                              </AlertDescription>
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveAlert(alert.id)}
                            className="ml-4"
                            data-testid={`button-resolve-${alert.id}`}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        </div>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-medium">No Active Alerts</p>
                    <p className="text-muted-foreground">All systems are operating normally</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-validation-trends">
                <CardHeader>
                  <CardTitle>Validation Volume</CardTitle>
                  <CardDescription>
                    Number of validations over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshotsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : snapshots && snapshots.length > 0 ? (
                    <div className="h-64">
                      <Line data={{
                        labels: snapshots.map(snapshot => 
                          new Date(snapshot.timestamp).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })
                        ),
                        datasets: [{
                          label: 'Validations',
                          data: snapshots.map(snapshot => snapshot.recentValidationsCount),
                          borderColor: 'rgb(34, 197, 94)',
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          borderWidth: 2,
                          fill: true,
                          tension: 0.4,
                        }]
                      }} options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'top' as const,
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            title: {
                              display: true,
                              text: 'Count'
                            }
                          }
                        }
                      }} />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      No trend data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-alert-trends">
                <CardHeader>
                  <CardTitle>Alert Volume</CardTitle>
                  <CardDescription>
                    Number of active alerts over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshotsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : snapshots && snapshots.length > 0 ? (
                    <div className="h-64">
                      <Line data={{
                        labels: snapshots.map(snapshot => 
                          new Date(snapshot.timestamp).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })
                        ),
                        datasets: [{
                          label: 'Active Alerts',
                          data: snapshots.map(snapshot => snapshot.activeAlertsCount),
                          borderColor: 'rgb(239, 68, 68)',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          borderWidth: 2,
                          fill: true,
                          tension: 0.4,
                        }]
                      }} options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'top' as const,
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            title: {
                              display: true,
                              text: 'Count'
                            }
                          }
                        }
                      }} />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      No trend data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Last Updated Footer */}
        {metrics && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
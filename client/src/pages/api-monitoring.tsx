import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, UserRole } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Mail, 
  RefreshCw,
  TrendingUp,
  Zap
} from "lucide-react";

interface ApiHealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorMessage?: string;
  version?: string;
}

interface ApiVersionInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
  changelogUrl: string;
  updateInstructions: string;
}

interface HealthCheckResults {
  versionChecks: ApiVersionInfo[];
  healthChecks: ApiHealthCheck[];
  needsAttention: boolean;
}

export default function ApiMonitoring() {
  const { user, isAuthenticated, userRole } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch API health status
  const { data: healthData, isLoading, error, refetch } = useQuery<HealthCheckResults>({
    queryKey: ['/api/monitoring/health'],
    refetchInterval: 300000, // Auto-refresh every 5 minutes (conservative to avoid API spam)
    retry: false, // Don't retry on 403 errors
  });

  // Fetch monthly API costs
  const { data: monthlyCosts, isLoading: costLoading } = useQuery<any>({
    queryKey: ['/api/tracking/monthly-costs'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Manual report sending mutation
  const sendReportMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/monitoring/send-report");
    },
    onSuccess: () => {
      toast({
        title: "Report Sent",
        description: "API health report has been sent to jack@catalystcp.com",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send report",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({
      title: "Refreshed",
      description: "API health status updated",
    });
  };

  const handleSendReport = () => {
    sendReportMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'degraded':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'down':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'down':
        return <Zap className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  // Handle authentication and authorization errors
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-slate-700">Please log in to access API monitoring</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has ADMIN or SUPER_ADMIN role
  const isAdmin = userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN;
  // FIX (Dec 15, 2025): Support both OIDC auth (user.claims.email) and traditional auth (user.email)
  const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
  const isLegacyAdmin = userEmail.includes('@catalystcp.com') || userEmail.includes('@landlinq.ai');

  if (!isAdmin && !isLegacyAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="bg-red-50 border-red-200 max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-bold text-[#081729]">Access Denied</h2>
            </div>
            <p className="text-slate-700">
              You need ADMIN or SUPER_ADMIN privileges to access API monitoring.
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Contact your administrator if you believe you should have access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle 403 Forbidden errors
  if (error && (error as any)?.message?.includes('403')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="bg-red-50 border-red-200 max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-bold text-[#081729]">Access Denied</h2>
            </div>
            <p className="text-slate-700">
              You need ADMIN or SUPER_ADMIN privileges to access API monitoring.
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Contact your administrator if you believe you should have access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#081729] mb-2" data-testid="title-api-monitoring">
            API Monitoring
          </h1>
          <p className="text-slate-600" data-testid="text-description">
            Monitor external API health and version status
          </p>
        </div>

        <div className="flex gap-3 mb-6">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2] transition-colors"
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
          <Button
            onClick={handleSendReport}
            disabled={sendReportMutation.isPending}
            className="bg-[#081729] text-white border-2 border-[#081729] hover:bg-white hover:text-[#081729] transition-colors"
            data-testid="button-send-report"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Report to Jack
          </Button>
        </div>

        <div className="space-y-6">

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600" data-testid="label-total-apis">Total APIs</p>
                    <p className="text-3xl font-bold text-[#081729]" data-testid="text-total-apis">
                      {(healthData?.healthChecks ?? []).length}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-[#4A90E2]" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600" data-testid="label-healthy">Healthy</p>
                    <p className="text-3xl font-bold text-green-600" data-testid="text-healthy-count">
                      {(healthData?.healthChecks ?? []).filter(c => c.status === 'healthy').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600" data-testid="label-degraded">Degraded</p>
                    <p className="text-3xl font-bold text-yellow-600" data-testid="text-degraded-count">
                      {(healthData?.healthChecks ?? []).filter(c => c.status === 'degraded').length}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600" data-testid="label-down">Down</p>
                    <p className="text-3xl font-bold text-red-600" data-testid="text-down-count">
                      {(healthData?.healthChecks ?? []).filter(c => c.status === 'down').length}
                    </p>
                  </div>
                  <Zap className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly API Cost Summary */}
          <Card className="bg-white border-[#4A90E2]">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2 text-[#081729]">
                <DollarSign className="h-6 w-6 text-[#4A90E2]" />
                API Costs - {monthlyCosts?.currentMonth || 'Loading...'}
              </CardTitle>
              <CardDescription className="text-slate-600">
                Real API spending from database (ZERO mock or placeholder data)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {costLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#4A90E2]" />
                  <span className="ml-2 text-slate-600">Loading cost data...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Total API Costs This Month - 100% REAL DATA */}
                  <div className="bg-[#081729] rounded-lg p-6 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white/70 mb-1">Total API Costs This Month</p>
                        <p className="text-5xl font-bold text-white" data-testid="text-monthly-grand-total">
                          {monthlyCosts?.apiCostsOnly || '$0.00'}
                        </p>
                        <p className="text-xs text-white/70 mt-2">
                          100% real costs from database - {monthlyCosts?.totalCalls || 0} API calls tracked
                        </p>
                      </div>
                      <TrendingUp className="h-16 w-16 text-[#4A90E2]" />
                    </div>
                  </div>

                  {/* API Usage Summary */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-5 border-2 border-green-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 bg-green-100 rounded">
                        <Zap className="h-5 w-5 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-[#081729]">API Usage Summary</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Total Calls</p>
                        <p className="text-2xl font-bold text-[#081729]">{monthlyCosts?.totalCalls || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Active Services</p>
                        <p className="text-2xl font-bold text-[#081729]">{monthlyCosts?.byService?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Success Rate</p>
                        <p className="text-2xl font-bold text-green-600">
                          {monthlyCosts?.totalCalls > 0 
                            ? `${(((monthlyCosts?.successfulCalls || 0) / monthlyCosts.totalCalls) * 100).toFixed(1)}%`
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Avg Response</p>
                        <p className="text-2xl font-bold text-[#4A90E2]">
                          {monthlyCosts?.avgResponseTime ? `${monthlyCosts.avgResponseTime}ms` : 'N/A'}
                        </p>
                      </div>
                    </div>
                    {monthlyCosts?.totalCalls === 0 && (
                      <p className="text-xs text-slate-500 mt-3 italic">
                        No API calls made yet this month - costs will appear here when you start using the platform
                      </p>
                    )}
                  </div>

                  {/* Cost Breakdown by Service */}
                  <div>
                    <h3 className="text-lg font-semibold text-[#081729] mb-3">Cost Breakdown by Service</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {monthlyCosts?.byService?.map((service: any) => (
                        <Card key={service.service} className="bg-white border-slate-200">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-semibold text-[#081729]">{service.service}</p>
                              <Badge variant="outline" className="text-xs">
                                {service.successRate.toFixed(1)}% success
                              </Badge>
                            </div>
                            <p className="text-2xl font-bold text-[#4A90E2]">{service.cost}</p>
                            <p className="text-xs text-slate-500 mt-1">{service.calls} calls</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* HelloData Specific Stats (includes cache savings) */}
                  {monthlyCosts?.hellodataDetails && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                      <h3 className="text-sm font-semibold text-[#081729] mb-2 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        HelloData Cost Controls
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-600">Monthly Cost</p>
                          <p className="font-bold text-green-700">{monthlyCosts.hellodataDetails.cost}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">API Calls</p>
                          <p className="font-bold text-[#081729]">{monthlyCosts.hellodataDetails.calls}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Cached (Saved)</p>
                          <p className="font-bold text-blue-600">{monthlyCosts.hellodataDetails.cached}</p>
                        </div>
                        <div>
                          <p className="text-slate-600">Budget Used</p>
                          <p className="font-bold text-amber-600">{monthlyCosts.hellodataDetails.limits.percentUsed}</p>
                          <p className="text-xs text-slate-500">of {monthlyCosts.hellodataDetails.limits.monthlyCostLimit}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Health Status */}
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2 text-[#081729]">
                <Activity className="h-6 w-6 text-[#4A90E2]" />
                API Health Status
              </CardTitle>
              <CardDescription className="text-slate-600">
                Real-time monitoring of all external API services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center p-12" data-testid="loading-indicator">
                  <RefreshCw className="h-8 w-8 animate-spin text-[#4A90E2]" />
                  <span className="ml-3 text-slate-600">Loading API status...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {(healthData?.healthChecks ?? []).map((check, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200"
                      data-testid={`api-status-${check.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(check.status)}
                        <div>
                          <p className="font-semibold text-[#081729]" data-testid={`text-api-name-${index}`}>
                            {check.name}
                          </p>
                          {check.version && (
                            <p className="text-sm text-slate-600" data-testid={`text-api-version-${index}`}>
                              Version: {check.version}
                            </p>
                          )}
                          {check.errorMessage && (
                            <p className="text-sm text-red-600" data-testid={`text-api-error-${index}`}>
                              {check.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-slate-600" data-testid={`label-response-time-${index}`}>
                            Response Time
                          </p>
                          <p className="font-mono text-[#081729]" data-testid={`text-response-time-${index}`}>
                            {check.responseTime}ms
                          </p>
                        </div>
                        <Badge 
                          className={`${getStatusColor(check.status)} border`}
                          data-testid={`badge-status-${index}`}
                        >
                          {check.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Version Updates Available */}
          {(healthData?.versionChecks ?? []).filter(v => v.needsUpdate).length > 0 && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2 text-[#081729]">
                  <TrendingUp className="h-6 w-6 text-yellow-600" />
                  Updates Available
                </CardTitle>
                <CardDescription className="text-yellow-700">
                  API versions that need to be updated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(healthData?.versionChecks ?? []).filter(v => v.needsUpdate).map((version, index) => (
                    <div 
                      key={index} 
                      className="p-4 rounded-lg bg-white border border-yellow-200"
                      data-testid={`update-available-${index}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-[#081729] text-lg" data-testid={`text-update-name-${index}`}>
                            {version.name}
                          </h3>
                          <p className="text-yellow-700" data-testid={`text-update-version-${index}`}>
                            {version.currentVersion} → {version.latestVersion}
                          </p>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
                          Update Available
                        </Badge>
                      </div>
                      <div className="bg-slate-50 p-3 rounded border border-slate-200">
                        <p className="text-sm font-semibold text-slate-700 mb-1">Update Instructions:</p>
                        <p className="text-sm text-slate-600" data-testid={`text-update-instructions-${index}`}>
                          {version.updateInstructions}
                        </p>
                        <a 
                          href={version.changelogUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-[#4A90E2] hover:text-[#357ABD] underline mt-2 inline-block"
                          data-testid={`link-changelog-${index}`}
                        >
                          View Changelog →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scheduled Reports Info */}
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2 text-[#081729]">
                <Clock className="h-6 w-6 text-[#4A90E2]" />
                Automated Reporting
              </CardTitle>
              <CardDescription className="text-slate-600">
                Scheduled API health checks and notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200" data-testid="schedule-daily">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-[#4A90E2]" />
                    <div>
                      <p className="font-semibold text-[#081729]">Daily Health Check</p>
                      <p className="text-sm text-slate-600">Sends alerts only when issues are detected</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-[#4A90E2] border-blue-200">
                    8:00 AM EST
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200" data-testid="schedule-weekly">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-[#081729]" />
                    <div>
                      <p className="font-semibold text-[#081729]">Weekly Comprehensive Report</p>
                      <p className="text-sm text-slate-600">Full status report sent every Monday</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-100 text-[#081729] border-slate-300">
                    Monday 9:00 AM EST
                  </Badge>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-slate-700">
                  📧 All reports are automatically sent to <span className="font-mono text-[#081729] font-semibold">jack@catalystcp.com</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
    </div>
    </div>
  );
}

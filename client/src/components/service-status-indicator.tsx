import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Settings,
  Zap,
  Database,
  Activity
} from "lucide-react";

interface ApiStatus {
  apiName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  successRate: number;
  avgResponseTime: number;
  errorRate: number;
  totalRequests: number;
  recentErrors: string[];
  lastSuccessfulCall?: string;
  healthScore: number;
  circuitBreakerOpen: boolean;
}

interface ServiceStatusData {
  timestamp: string;
  apis: {
    attom: ApiStatus;
    usps: ApiStatus;
    census: ApiStatus;
  };
  overallHealth: {
    averageSuccessRate: number;
    totalRequests: number;
    activeApis: number;
    criticalIssues: number;
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
    case 'degraded': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'unhealthy': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'offline': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

function getStatusIcon(status: string, circuitBreakerOpen: boolean) {
  if (circuitBreakerOpen) {
    return <XCircle className="h-4 w-4 text-red-500" />;
  }
  
  switch (status) {
    case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'unhealthy': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case 'offline': return <XCircle className="h-4 w-4 text-red-500" />;
    default: return <Info className="h-4 w-4 text-gray-500" />;
  }
}

function getServiceDisplayName(apiName: string): string {
  const names = {
    attom: 'ATTOM Real Estate Data',
    usps: 'USPS Address Validation',
    census: 'US Census Bureau'
  };
  return names[apiName as keyof typeof names] || apiName;
}

function getServiceIcon(apiName: string) {
  switch (apiName) {
    case 'attom': return <Zap className="h-5 w-5" />;
    case 'usps': return <Wifi className="h-5 w-5" />;
    case 'census': return <Database className="h-5 w-5" />;
    default: return <Info className="h-5 w-5" />;
  }
}

interface ServiceStatusIndicatorProps {
  showDetailed?: boolean;
  showControls?: boolean;
  className?: string;
}

export default function ServiceStatusIndicator({ 
  showDetailed = false, 
  showControls = false,
  className = ""
}: ServiceStatusIndicatorProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(showDetailed);

  // Check if user has admin privileges
  // FIX (Dec 15, 2025): Support both OIDC auth (user.claims.email) and traditional auth (user.email)
  const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
  const isAdmin = userEmail.includes('@catalystcp.com') || userEmail === 'jack@catalystcp.com';

  const { data: serviceStatus, isLoading, error } = useQuery<ServiceStatusData>({
    queryKey: ['/api/service-status'],
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });

  const resetCircuitBreakerMutation = useMutation({
    mutationFn: async (apiName: string) => {
      const res = await apiRequest('POST', `/api/service-status/reset-circuit-breaker`, { apiName });
      return res.json();
    },
    onSuccess: (data, apiName) => {
      toast({
        title: "Circuit Breaker Reset",
        description: `${getServiceDisplayName(apiName)} circuit breaker has been reset and service recovery will be attempted.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-status'] });
    },
    onError: (error: any, apiName) => {
      toast({
        title: "Reset Failed",
        description: `Failed to reset circuit breaker for ${getServiceDisplayName(apiName)}: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const testServiceMutation = useMutation({
    mutationFn: async (apiName: string) => {
      const res = await apiRequest('POST', `/api/service-status/test-service`, { apiName });
      return res.json();
    },
    onSuccess: (data, apiName) => {
      toast({
        title: "Service Test",
        description: `${getServiceDisplayName(apiName)} test ${data.success ? 'passed' : 'failed'}: ${data.message}`,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-status'] });
    },
    onError: (error: any, apiName) => {
      toast({
        title: "Test Failed",
        description: `Failed to test ${getServiceDisplayName(apiName)}: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading service status...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !serviceStatus) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to load service status. Some monitoring features may be unavailable.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const criticalServices = Object.values(serviceStatus.apis).filter(
    api => api.status === 'offline' || api.status === 'unhealthy'
  );

  if (!showDetails && !showDetailed) {
    // Compact indicator mode
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(true)}
          className="flex items-center gap-2 text-sm"
          data-testid="button-expand-service-status"
        >
          {criticalServices.length > 0 ? (
            <>
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600">{criticalServices.length} service{criticalServices.length > 1 ? 's' : ''} down</span>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-green-600">All services operational</span>
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Service Status
            <Badge variant="outline" className="ml-2">
              Updated {new Date(serviceStatus.timestamp).toLocaleTimeString()}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {!showDetailed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(false)}
                data-testid="button-collapse-service-status"
              >
                Collapse
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/service-status'] })}
              data-testid="button-refresh-service-status"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Health Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Success Rate</div>
            <div className="text-lg font-bold text-blue-900">
              {serviceStatus.overallHealth.averageSuccessRate.toFixed(1)}%
            </div>
          </div>
          
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Active Services</div>
            <div className="text-lg font-bold text-green-900">
              {serviceStatus.overallHealth.activeApis}/{Object.keys(serviceStatus.apis).length}
            </div>
          </div>
          
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600 font-medium">Total Requests</div>
            <div className="text-lg font-bold text-purple-900">
              {serviceStatus.overallHealth.totalRequests.toLocaleString()}
            </div>
          </div>
          
          <div className={`p-3 rounded-lg ${serviceStatus.overallHealth.criticalIssues > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <div className={`text-sm font-medium ${serviceStatus.overallHealth.criticalIssues > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              Critical Issues
            </div>
            <div className={`text-lg font-bold ${serviceStatus.overallHealth.criticalIssues > 0 ? 'text-red-900' : 'text-gray-900'}`}>
              {serviceStatus.overallHealth.criticalIssues}
            </div>
          </div>
        </div>

        {/* Individual Service Status */}
        <div className="space-y-3">
          {Object.entries(serviceStatus.apis).map(([apiName, status]) => (
            <div 
              key={apiName} 
              className={`border rounded-lg p-4 ${getStatusColor(status.status)}`}
              data-testid={`service-status-${apiName}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getServiceIcon(apiName)}
                  <div>
                    <div className="font-semibold">{getServiceDisplayName(apiName)}</div>
                    <div className="text-sm opacity-75">
                      {status.totalRequests > 0 ? (
                        <>
                          {status.successRate.toFixed(1)}% success rate • 
                          {status.avgResponseTime.toFixed(0)}ms avg response • 
                          {status.totalRequests} requests
                        </>
                      ) : (
                        'No recent requests'
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {getStatusIcon(status.status, status.circuitBreakerOpen)}
                    <span className="font-medium capitalize">
                      {status.circuitBreakerOpen ? 'Circuit Breaker Open' : status.status}
                    </span>
                  </div>
                  
                  {status.lastSuccessfulCall && (
                    <div className="text-xs opacity-75 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last success: {new Date(status.lastSuccessfulCall).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Health Score Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>Health Score</span>
                  <span>{status.healthScore.toFixed(0)}/100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      status.healthScore >= 80 ? 'bg-green-500' :
                      status.healthScore >= 60 ? 'bg-yellow-500' :
                      status.healthScore >= 30 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.max(status.healthScore, 5)}%` }}
                  />
                </div>
              </div>

              {/* Recent Errors */}
              {status.recentErrors.length > 0 && (
                <div className="mt-2 p-2 bg-white bg-opacity-50 rounded border">
                  <div className="text-xs font-medium mb-1">Recent Errors:</div>
                  <div className="text-xs space-y-1 max-h-20 overflow-y-auto">
                    {status.recentErrors.slice(0, 3).map((error, index) => (
                      <div key={index} className="truncate" title={error}>
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Controls */}
              {isAdmin && showControls && (
                <div className="mt-3 pt-3 border-t border-white border-opacity-30 flex gap-2">
                  {status.circuitBreakerOpen && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetCircuitBreakerMutation.mutate(apiName)}
                      disabled={resetCircuitBreakerMutation.isPending}
                      data-testid={`button-reset-circuit-breaker-${apiName}`}
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Reset Circuit Breaker
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testServiceMutation.mutate(apiName)}
                    disabled={testServiceMutation.isPending}
                    data-testid={`button-test-service-${apiName}`}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Test Service
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Critical Issues Alert */}
        {criticalServices.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{criticalServices.length} critical service issue{criticalServices.length > 1 ? 's' : ''} detected:</strong>
              <ul className="mt-1 list-disc list-inside">
                {criticalServices.map((service) => (
                  <li key={service.apiName}>
                    {getServiceDisplayName(service.apiName)} is {service.status}
                    {service.circuitBreakerOpen && ' (circuit breaker open)'}
                  </li>
                ))}
              </ul>
              {isAdmin && (
                <div className="mt-2 text-sm">
                  System administrator has been notified via email. Backup data sources are being used where available.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
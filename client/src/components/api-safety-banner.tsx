import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SafetyAlert {
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  apiName?: string;
  timestamp: string;
  actionRequired: string;
}

interface ApiSafetyStatus {
  fallbackStatus: Record<string, {
    available: boolean;
    circuitBreakerState: string;
    fallbackStrategy: string;
  }>;
  thresholds: any;
  recentAlerts: SafetyAlert[];
  currentSpending: number;
  spendingLimit: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export default function ApiSafetyBanner() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: safetyStatus } = useQuery<ApiSafetyStatus>({
    queryKey: ['/api/api-safety-status'],
    refetchInterval: 60000, // Refresh every minute
    retry: 1,
  });

  if (!safetyStatus) {
    return null;
  }

  const { systemHealth, recentAlerts, fallbackStatus, currentSpending, spendingLimit } = safetyStatus;

  // Don't show banner if everything is healthy
  if (systemHealth === 'healthy' && recentAlerts.length === 0) {
    return null;
  }

  const spendingPercentage = (currentSpending / spendingLimit) * 100;

  const degradedApis = Object.entries(fallbackStatus)
    .filter(([_, status]) => !status.available || status.circuitBreakerState === 'OPEN' || status.circuitBreakerState === 'HALF_OPEN')
    .map(([name, status]) => ({ name, ...status }));

  const alertVariant = systemHealth === 'critical' ? 'destructive' : 'default';
  const AlertIcon = systemHealth === 'critical' ? AlertCircle : systemHealth === 'warning' ? AlertTriangle : CheckCircle2;

  return (
    <Alert variant={alertVariant} className="mb-4" data-testid="api-safety-banner">
      <AlertIcon className="h-5 w-5" />
      <AlertTitle className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          API Safety System Alert
          <Badge variant={systemHealth === 'critical' ? 'destructive' : 'secondary'} data-testid="system-health-badge">
            {systemHealth.toUpperCase()}
          </Badge>
        </span>
        {(recentAlerts.length > 0 || degradedApis.length > 0) && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="toggle-details">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </AlertTitle>
      
      <AlertDescription className="mt-2 space-y-2">
        {/* Spending Warning */}
        {spendingPercentage >= 70 && (
          <div className="text-sm" data-testid="spending-warning">
            <strong>Daily Spending:</strong> ${currentSpending.toFixed(2)} / ${spendingLimit.toFixed(2)} ({spendingPercentage.toFixed(0)}%)
            {spendingPercentage >= 90 && <span className="ml-2 text-destructive font-semibold">⚠️ Approaching limit!</span>}
          </div>
        )}

        {/* Recent Alerts Summary */}
        {recentAlerts.length > 0 && (
          <div className="text-sm" data-testid="alerts-summary">
            <strong>{recentAlerts.length}</strong> alert{recentAlerts.length !== 1 ? 's' : ''} in the last 24 hours
          </div>
        )}

        {/* Degraded APIs Summary */}
        {degradedApis.length > 0 && (
          <div className="text-sm" data-testid="degraded-apis-summary">
            <strong>{degradedApis.length}</strong> API{degradedApis.length !== 1 ? 's' : ''} currently degraded or unavailable
          </div>
        )}

        <Collapsible open={isExpanded}>
          <CollapsibleContent className="space-y-3 mt-3 pt-3 border-t">
            {/* Detailed Alerts */}
            {recentAlerts.length > 0 && (
              <div data-testid="alerts-details">
                <h4 className="font-semibold text-sm mb-2">Recent Alerts:</h4>
                <div className="space-y-2">
                  {recentAlerts.slice(0, 5).map((alert, idx) => (
                    <div key={idx} className="bg-background/50 p-2 rounded text-xs" data-testid={`alert-${idx}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                          {alert.severity}
                        </Badge>
                        <span className="font-medium">{alert.apiName || alert.type}</span>
                        <span className="text-muted-foreground ml-auto">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{alert.message}</p>
                      {alert.actionRequired && (
                        <p className="mt-1 font-medium">Action: {alert.actionRequired}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Degraded APIs Details */}
            {degradedApis.length > 0 && (
              <div data-testid="degraded-apis-details">
                <h4 className="font-semibold text-sm mb-2">Degraded APIs:</h4>
                <div className="space-y-1">
                  {degradedApis.map((api, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-background/50 p-2 rounded" data-testid={`degraded-api-${idx}`}>
                      <span className="font-medium">{api.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {api.circuitBreakerState}
                        </Badge>
                        <span className="text-muted-foreground">
                          Fallback: {api.fallbackStrategy.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </AlertDescription>
    </Alert>
  );
}

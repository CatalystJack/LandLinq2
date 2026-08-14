import Footer from "@/components/footer";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Database, 
  Shield, 
  BarChart3, 
  Archive, 
  HardDrive,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface DatabaseHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    connectivity: 'healthy' | 'degraded' | 'critical';
    performance: 'healthy' | 'degraded' | 'critical';
    storage: 'healthy' | 'degraded' | 'critical';
    migrations: 'healthy' | 'degraded' | 'critical';
    backups: 'healthy' | 'degraded' | 'critical';
    archiving: 'healthy' | 'degraded' | 'critical';
  };
  metrics: {
    totalQueries: number;
    avgResponseTime: number;
    errorRate: number;
    storageUsed: string;
    lastBackup: string | null;
    pendingMigrations: number;
    pendingArchives: number;
  };
  recommendations: string[];
}

export default function DatabaseManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  // Database health query
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['/api/database/health'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Database report query
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['/api/database/report'],
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  // Archive stats query
  const { data: archiveStats, isLoading: archiveLoading } = useQuery({
    queryKey: ['/api/database/archive-stats'],
    refetchInterval: 60000
  });

  // Backups query
  const { data: backups, isLoading: backupsLoading } = useQuery({
    queryKey: ['/api/database/backups'],
    refetchInterval: 60000
  });

  // Maintenance mutation
  const maintenanceMutation = useMutation({
    mutationFn: async (options: any) => {
      return apiRequest('/api/database/maintenance', {
        method: 'POST',
        body: { options }
      });
    },
    onSuccess: () => {
      toast({
        title: "Maintenance Completed",
        description: "Database maintenance has been completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/database'] });
    },
    onError: () => {
      toast({
        title: "Maintenance Failed",
        description: "Database maintenance failed. Please check the logs.",
        variant: "destructive",
      });
    }
  });

  // Backup mutation
  const backupMutation = useMutation({
    mutationFn: async (type: string) => {
      return apiRequest('/api/database/backup', {
        method: 'POST',
        body: { type }
      });
    },
    onSuccess: () => {
      toast({
        title: "Backup Created",
        description: "Database backup has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/database/backups'] });
    },
    onError: () => {
      toast({
        title: "Backup Failed",
        description: "Failed to create database backup",
        variant: "destructive",
      });
    }
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (params: { tableName?: string; dryRun: boolean }) => {
      return apiRequest('/api/database/archive', {
        method: 'POST',
        body: params
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.dryRun ? "Archive Preview" : "Archiving Completed",
        description: variables.dryRun 
          ? "Archive preview completed. Check results below." 
          : "Data archiving has been completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/database/archive-stats'] });
    },
    onError: () => {
      toast({
        title: "Archiving Failed",
        description: "Data archiving operation failed",
        variant: "destructive",
      });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (healthLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Database className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Database Management</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading database status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" data-testid="database-management-page">
      <div className="flex items-center gap-2 mb-6">
        <Database className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Database Management</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetchHealth()}
          data-testid="refresh-health-button"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {health && (
        <div className="grid gap-6">
          {/* Overall Health Status */}
          <Card data-testid="health-overview-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Database Health Overview
                <Badge className={getStatusColor(health.overall)}>
                  {getStatusIcon(health.overall)}
                  {health.overall.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(health.components).map(([component, status]) => (
                  <div key={component} className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    <span className="capitalize">{component.replace(/([A-Z])/g, ' $1')}</span>
                    <Badge size="sm" className={getStatusColor(status)}>
                      {status}
                    </Badge>
                  </div>
                ))}
              </div>

              {health.recommendations.length > 0 && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Recommendations:</strong>
                    <ul className="mt-2 space-y-1">
                      {health.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm">• {rec}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card data-testid="queries-metric">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Queries</p>
                    <p className="text-2xl font-bold">{health.metrics.totalQueries.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="response-time-metric">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Avg Response</p>
                    <p className="text-2xl font-bold">{health.metrics.avgResponseTime}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="storage-metric">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Storage Used</p>
                    <p className="text-2xl font-bold">{health.metrics.storageUsed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="pending-metric">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm text-gray-600">Pending Archives</p>
                    <p className="text-2xl font-bold">{health.metrics.pendingArchives.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Management Actions */}
          <Tabs defaultValue="operations" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="backups">Backups</TabsTrigger>
              <TabsTrigger value="archiving">Archiving</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="operations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Database Operations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      onClick={() => maintenanceMutation.mutate({})}
                      disabled={maintenanceMutation.isPending}
                      data-testid="run-maintenance-button"
                    >
                      {maintenanceMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <TrendingUp className="h-4 w-4 mr-2" />
                      )}
                      Run Maintenance
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => refetchHealth()}
                      data-testid="refresh-health-button"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Status
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/database'] })}
                      data-testid="refresh-all-button"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Refresh All
                    </Button>
                  </div>

                  {health.metrics.pendingMigrations > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {health.metrics.pendingMigrations} pending migrations need to be applied.
                        Run maintenance to apply them.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backups" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Backup Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      onClick={() => backupMutation.mutate('full')}
                      disabled={backupMutation.isPending}
                      data-testid="create-full-backup-button"
                    >
                      {backupMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Full Backup
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => backupMutation.mutate('schema')}
                      disabled={backupMutation.isPending}
                      data-testid="create-schema-backup-button"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Schema Only
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => backupMutation.mutate('data')}
                      disabled={backupMutation.isPending}
                      data-testid="create-data-backup-button"
                    >
                      <HardDrive className="h-4 w-4 mr-2" />
                      Data Only
                    </Button>
                  </div>

                  {health.metrics.lastBackup && (
                    <div className="text-sm text-gray-600">
                      Last backup: {new Date(health.metrics.lastBackup).toLocaleString()}
                    </div>
                  )}

                  {/* Backup List */}
                  {!backupsLoading && backups && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Recent Backups</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {backups.slice(0, 10).map((backup: any) => (
                          <div key={backup.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{backup.filename}</p>
                              <p className="text-sm text-gray-600">
                                {backup.type} • {backup.size} • {new Date(backup.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant={backup.compressed ? "default" : "outline"}>
                              {backup.compressed ? "Compressed" : "Uncompressed"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="archiving" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Data Archiving</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      onClick={() => archiveMutation.mutate({ dryRun: true })}
                      disabled={archiveMutation.isPending}
                      variant="outline"
                      data-testid="preview-archive-button"
                    >
                      {archiveMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Archive className="h-4 w-4 mr-2" />
                      )}
                      Preview Archive
                    </Button>

                    <Button
                      onClick={() => archiveMutation.mutate({ dryRun: false })}
                      disabled={archiveMutation.isPending}
                      data-testid="run-archive-button"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Run Archive
                    </Button>
                  </div>

                  {/* Archive Statistics */}
                  {!archiveLoading && archiveStats && (
                    <div className="space-y-4">
                      <h4 className="font-medium">Archive Statistics</h4>
                      <div className="grid gap-4">
                        {archiveStats.map((stat: any) => (
                          <div key={stat.tableName} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium capitalize">{stat.tableName}</h5>
                              <Badge variant={stat.eligibleForArchive > 0 ? "destructive" : "default"}>
                                {stat.eligibleForArchive} eligible
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Total Records</p>
                                <p className="font-medium">{stat.totalRecords.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Archived</p>
                                <p className="font-medium">{stat.archivedRecords.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Last Archived</p>
                                <p className="font-medium">
                                  {stat.lastArchived ? new Date(stat.lastArchived).toLocaleDateString() : 'Never'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Monitoring</CardTitle>
                </CardHeader>
                <CardContent>
                  {!reportLoading && report && (
                    <div className="space-y-6">
                      {/* Storage Overview */}
                      <div>
                        <h4 className="font-medium mb-3">Storage Overview</h4>
                        <div className="text-sm text-gray-600 mb-2">
                          Total Database Size: {report.storage.totalSize}
                        </div>
                        <div className="grid gap-2">
                          {report.storage.tableStats.map((table: any) => (
                            <div key={table.tableName} className="flex items-center justify-between p-2 border rounded">
                              <span className="capitalize">{table.tableName}</span>
                              <div className="text-right">
                                <div className="font-medium">{table.rowCount.toLocaleString()} rows</div>
                                <div className="text-sm text-gray-600">{table.size}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Query Performance */}
                      {report.performance.slowQueries.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3">Slow Queries ({report.performance.slowQueries.length})</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {report.performance.slowQueries.slice(0, 5).map((query: any, i: number) => (
                              <div key={i} className="p-3 border rounded-lg bg-yellow-50">
                                <div className="flex items-center justify-between mb-1">
                                  <Badge variant="outline">{Math.round(query.avgTime)}ms avg</Badge>
                                  <span className="text-sm text-gray-600">{query.calls} calls</span>
                                </div>
                                <code className="text-xs bg-gray-100 p-1 rounded block overflow-x-auto">
                                  {query.query.length > 100 ? query.query.slice(0, 100) + '...' : query.query}
                                </code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Index Usage */}
                      <div>
                        <h4 className="font-medium mb-3">Index Efficiency</h4>
                        <div className="grid gap-2">
                          {report.performance.indexUsage.map((usage: any) => (
                            <div key={usage.tableName} className="flex items-center justify-between p-2 border rounded">
                              <span className="capitalize">{usage.tableName}</span>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={usage.efficiency * 100} 
                                  className="w-24" 
                                />
                                <span className="text-sm font-medium">
                                  {Math.round(usage.efficiency * 100)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
      <Footer />
    </div>
  );
}

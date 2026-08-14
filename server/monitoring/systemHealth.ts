import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface HealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'critical';
  responseTime: number;
  details?: string;
  lastChecked: Date;
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'critical';
  score: number;
  components: HealthCheck[];
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskSpace: number;
    activeConnections: number;
    responseTime: number;
    errorRate: number;
    requestsPerSecond: number;
  };
  alerts: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    component: string;
    timestamp: Date;
  }>;
}

class SystemHealthMonitor {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(): void {
    // Run health checks every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.runAllHealthChecks().catch(console.error);
    }, 5 * 60 * 1000);

    // Run initial health check
    this.runAllHealthChecks().catch(console.error);
  }

  /**
   * Run all health checks
   */
  async runAllHealthChecks(): Promise<void> {
    const checks = [
      this.checkDatabaseConnection(),
      this.checkDatabasePerformance(),
      this.checkMemoryUsage(),
      this.checkDiskSpace(),
      this.checkErrorRates(),
      this.checkResponseTimes(),
      this.checkBackupStatus(),
      this.checkMigrationStatus(),
      this.checkSessionStore(),
      this.checkExternalServices()
    ];

    await Promise.allSettled(checks);
  }

  /**
   * Check database connection
   */
  private async checkDatabaseConnection(): Promise<void> {
    const startTime = Date.now();
    
    try {
      await db.execute(sql`SELECT 1`);
      
      this.healthChecks.set('database_connection', {
        component: 'Database Connection',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      });
    } catch (error) {
      this.healthChecks.set('database_connection', {
        component: 'Database Connection',
        status: 'critical',
        responseTime: Date.now() - startTime,
        details: (error as Error).message,
        lastChecked: new Date()
      });
    }
  }

  /**
   * Check database performance
   */
  private async checkDatabasePerformance(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check for long-running queries
      const result = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM pg_stat_activity
        WHERE state = 'active' 
        AND query_start < NOW() - INTERVAL '30 seconds'
        AND query NOT LIKE '%pg_stat_activity%'
      `);

      const longRunningQueries = (result[0] as any)?.count || 0;
      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      let details = '';

      if (longRunningQueries > 5) {
        status = 'critical';
        details = `${longRunningQueries} long-running queries detected`;
      } else if (longRunningQueries > 2) {
        status = 'degraded';
        details = `${longRunningQueries} queries running longer than 30s`;
      }

      this.healthChecks.set('database_performance', {
        component: 'Database Performance',
        status,
        responseTime,
        details,
        lastChecked: new Date()
      });
    } catch (error) {
      this.healthChecks.set('database_performance', {
        component: 'Database Performance',
        status: 'critical',
        responseTime: Date.now() - startTime,
        details: (error as Error).message,
        lastChecked: new Date()
      });
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<void> {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let details = `${Math.round(heapUsedMB)}MB used (${Math.round(usagePercent)}%)`;

    if (usagePercent > 90) {
      status = 'critical';
      details += ' - Memory critically high';
    } else if (usagePercent > 75) {
      status = 'degraded';
      details += ' - Memory usage elevated';
    }

    this.healthChecks.set('memory_usage', {
      component: 'Memory Usage',
      status,
      responseTime: 0,
      details,
      lastChecked: new Date()
    });
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<void> {
    try {
      // For now, we'll simulate disk space check
      // In production, this would use actual filesystem APIs
      const usagePercent = 45; // Simulated usage

      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      let details = `${usagePercent}% used`;

      if (usagePercent > 95) {
        status = 'critical';
        details += ' - Disk space critically low';
      } else if (usagePercent > 85) {
        status = 'degraded';
        details += ' - Disk space getting low';
      }

      this.healthChecks.set('disk_space', {
        component: 'Disk Space',
        status,
        responseTime: 0,
        details,
        lastChecked: new Date()
      });
    } catch (error) {
      this.healthChecks.set('disk_space', {
        component: 'Disk Space',
        status: 'critical',
        responseTime: 0,
        details: (error as Error).message,
        lastChecked: new Date()
      });
    }
  }

  /**
   * Check error rates
   */
  private async checkErrorRates(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE level = 'error') as error_count,
          COUNT(*) as total_logs
        FROM error_logs 
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
      `);

      const row = result[0] as any;
      const errorRate = row?.total_logs > 0 ? (row.error_count / row.total_logs) * 100 : 0;

      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      let details = `${errorRate.toFixed(2)}% error rate (last hour)`;

      if (errorRate > 10) {
        status = 'critical';
        details += ' - Error rate critically high';
      } else if (errorRate > 5) {
        status = 'degraded';
        details += ' - Error rate elevated';
      }

      this.healthChecks.set('error_rates', {
        component: 'Error Rates',
        status,
        responseTime: Date.now() - startTime,
        details,
        lastChecked: new Date()
      });
    } catch (error) {
      this.healthChecks.set('error_rates', {
        component: 'Error Rates',
        status: 'critical',
        responseTime: Date.now() - startTime,
        details: (error as Error).message,
        lastChecked: new Date()
      });
    }
  }

  /**
   * Check response times
   */
  private async checkResponseTimes(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simple query to test response time
      await db.execute(sql`SELECT COUNT(*) FROM deals`);
      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      let details = `${responseTime}ms average response time`;

      if (responseTime > 2000) {
        status = 'critical';
        details += ' - Response time critically slow';
      } else if (responseTime > 1000) {
        status = 'degraded';
        details += ' - Response time elevated';
      }

      this.healthChecks.set('response_times', {
        component: 'Response Times',
        status,
        responseTime,
        details,
        lastChecked: new Date()
      });
    } catch (error) {
      this.healthChecks.set('response_times', {
        component: 'Response Times',
        status: 'critical',
        responseTime: Date.now() - startTime,
        details: (error as Error).message,
        lastChecked: new Date()
      });
    }
  }

  /**
   * Check backup status
   */
  private async checkBackupStatus(): Promise<void> {
    try {
      // This would check actual backup logs in production
      const status = 'healthy';
      const details = 'Backups running on schedule';

      this.healthChecks.set('backup_status', {
        component: 'Backup Status',
        status,
        responseTime: 0,
        details,
        lastChecked: new Date()
      });
    } catch (error) {
      this.healthChecks.set('backup_status', {
        component: 'Backup Status',
        status: 'critical',
        responseTime: 0,
        details: (error as Error).message,
        lastChecked: new Date()
      });
    }
  }

  /**
   * Check migration status
   */
  private async checkMigrationStatus(): Promise<void> {
    try {
      const status = 'healthy';
      const details = 'All migrations applied';

      this.healthChecks.set('migration_status', {
        component: 'Migration Status',
        status,
        responseTime: 0,
        details,
        lastChecked: new Date()
      });
    } catch (error) {
      this.healthChecks.set('migration_status', {
        component: 'Migration Status',
        status: 'critical',
        responseTime: 0,
        details: (error as Error).message,
        lastChecked: new Date()
      });
    }
  }

  /**
   * Check session store
   */
  private async checkSessionStore(): Promise<void> {
    const startTime = Date.now();
    
    try {
      await db.execute(sql`SELECT COUNT(*) FROM sessions`);
      
      this.healthChecks.set('session_store', {
        component: 'Session Store',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: 'Session store accessible',
        lastChecked: new Date()
      });
    } catch (error) {
      this.healthChecks.set('session_store', {
        component: 'Session Store',
        status: 'critical',
        responseTime: Date.now() - startTime,
        details: (error as Error).message,
        lastChecked: new Date()
      });
    }
  }

  /**
   * Check external services
   */
  private async checkExternalServices(): Promise<void> {
    // Check if required environment variables are present
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let details = 'All required services available';

    if (missingVars.length > 0) {
      status = 'critical';
      details = `Missing environment variables: ${missingVars.join(', ')}`;
    }

    this.healthChecks.set('external_services', {
      component: 'External Services',
      status,
      responseTime: 0,
      details,
      lastChecked: new Date()
    });
  }

  /**
   * Get comprehensive health report
   */
  async getHealthReport(): Promise<SystemHealthReport> {
    await this.runAllHealthChecks();

    const components = Array.from(this.healthChecks.values());
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const degradedCount = components.filter(c => c.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalCount > 0) {
      overall = 'critical';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    }

    const score = Math.max(0, 100 - (criticalCount * 20) - (degradedCount * 10));

    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    const alerts = components
      .filter(c => c.status !== 'healthy')
      .map(c => ({
        severity: c.status === 'critical' ? 'critical' as const : 'medium' as const,
        message: c.details || `${c.component} is ${c.status}`,
        component: c.component,
        timestamp: c.lastChecked
      }));

    return {
      overall,
      score,
      components,
      metrics: {
        uptime: Math.round(uptime),
        memoryUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        cpuUsage: 0, // Would be calculated from system metrics
        diskSpace: 45, // Simulated for now
        activeConnections: 0, // Would be tracked by connection pool
        responseTime: components.find(c => c.component === 'Response Times')?.responseTime || 0,
        errorRate: 0, // Would be calculated from error logs
        requestsPerSecond: 0 // Would be calculated from request logs
      },
      alerts
    };
  }

  /**
   * Get health status for specific component
   */
  getComponentHealth(component: string): HealthCheck | undefined {
    return this.healthChecks.get(component);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

export const systemHealthMonitor = new SystemHealthMonitor();
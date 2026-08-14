import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Format timestamp in EST timezone
 */
function formatTimestampEST(date: Date = new Date()): string {
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  stack?: string;
  context?: any;
  userId?: string;
  requestId?: string;
  endpoint?: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  eventLoopDelay: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
}

class ErrorLogger {
  private errorBuffer: ErrorLogEntry[] = [];
  private metricsBuffer: SystemMetrics[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeLogging();
    this.startMetricsCollection();
  }

  /**
   * Initialize error logging system
   */
  private initializeLogging(): void {
    // Create error logs table if it doesn't exist
    this.createErrorLogsTable().catch(console.error);
    
    // Set up automatic buffer flushing every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushBuffers().catch(console.error);
    }, 30000);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logError('Uncaught Exception', error, { critical: true });
      console.error('💥 CRITICAL: Uncaught Exception:', error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logError('Unhandled Promise Rejection', reason as Error, { 
        critical: true, 
        promise: promise.toString() 
      });
      console.error('💥 CRITICAL: Unhandled Promise Rejection:', reason);
    });
  }

  /**
   * Start collecting system metrics
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Collect metrics every minute
  }

  /**
   * Create error logs table
   */
  private async createErrorLogsTable(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS error_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          level VARCHAR(10) NOT NULL,
          message TEXT NOT NULL,
          stack TEXT,
          context JSONB,
          user_id VARCHAR(255),
          request_id VARCHAR(255),
          endpoint VARCHAR(500),
          user_agent TEXT,
          ip_address INET,
          session_id VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS system_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          memory_heap_used BIGINT,
          memory_heap_total BIGINT,
          memory_external BIGINT,
          memory_rss BIGINT,
          cpu_user DECIMAL,
          cpu_system DECIMAL,
          event_loop_delay DECIMAL,
          active_connections INTEGER,
          requests_per_minute INTEGER,
          error_rate DECIMAL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create indexes for performance
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level, timestamp DESC)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC)
      `);
    } catch (error) {
      console.error('Failed to create error logs table:', error);
    }
  }

  /**
   * Log an error with context
   */
  logError(message: string, error: Error | any, context: any = {}): void {
    const errorEntry: ErrorLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level: 'error',
      message,
      stack: error?.stack || '',
      context,
      userId: context.userId,
      requestId: context.requestId,
      endpoint: context.endpoint,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId
    };

    this.errorBuffer.push(errorEntry);
    
    // Also log to console for immediate visibility with EST timestamp
    const timestamp = formatTimestampEST(errorEntry.timestamp);
    console.error(`[${timestamp}] 🚨 [${errorEntry.level.toUpperCase()}] ${message}:`, error);
    if (context && Object.keys(context).length > 0) {
      console.error('📋 Context:', context);
    }
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context: any = {}): void {
    const warningEntry: ErrorLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level: 'warn',
      message,
      context,
      userId: context.userId,
      requestId: context.requestId,
      endpoint: context.endpoint,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId
    };

    this.errorBuffer.push(warningEntry);
    const timestamp = formatTimestampEST(warningEntry.timestamp);
    console.warn(`[${timestamp}] ⚠️ [WARNING] ${message}`, context);
  }

  /**
   * Log info message
   */
  logInfo(message: string, context: any = {}): void {
    const infoEntry: ErrorLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level: 'info',
      message,
      context,
      userId: context.userId,
      requestId: context.requestId,
      endpoint: context.endpoint,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId
    };

    this.errorBuffer.push(infoEntry);
    const timestamp = formatTimestampEST(infoEntry.timestamp);
    console.info(`[${timestamp}] ℹ️ [INFO] ${message}`, context);
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: SystemMetrics = {
      timestamp: new Date(),
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpuUsage: {
        user: cpuUsage.user / 1000000, // Convert to seconds
        system: cpuUsage.system / 1000000
      },
      eventLoopDelay: 0, // Will be implemented with async hooks if needed
      activeConnections: 0, // Will be tracked by connection pool
      requestsPerMinute: 0, // Will be calculated from request logs
      errorRate: 0 // Will be calculated from error logs
    };

    this.metricsBuffer.push(metrics);
  }

  /**
   * Flush buffers to database
   */
  private async flushBuffers(): Promise<void> {
    if (this.errorBuffer.length === 0 && this.metricsBuffer.length === 0) {
      return;
    }

    try {
      // Flush error logs
      if (this.errorBuffer.length > 0) {
        const errors = [...this.errorBuffer];
        this.errorBuffer = [];

        for (const error of errors) {
          await db.execute(sql`
            INSERT INTO error_logs (
              timestamp, level, message, stack, context,
              user_id, request_id, endpoint, user_agent, ip_address, session_id
            ) VALUES (
              ${error.timestamp.toISOString()}, ${error.level}, ${error.message},
              ${error.stack || ''}, ${JSON.stringify(error.context || {})},
              ${error.userId || null}, ${error.requestId || null}, ${error.endpoint || null},
              ${error.userAgent || null}, ${error.ipAddress || null}, ${error.sessionId || null}
            )
          `);
        }
      }

      // Flush metrics
      if (this.metricsBuffer.length > 0) {
        const metrics = [...this.metricsBuffer];
        this.metricsBuffer = [];

        for (const metric of metrics) {
          await db.execute(sql`
            INSERT INTO system_metrics (
              timestamp, memory_heap_used, memory_heap_total, memory_external, memory_rss,
              cpu_user, cpu_system, event_loop_delay, active_connections,
              requests_per_minute, error_rate
            ) VALUES (
              ${metric.timestamp}, ${metric.memoryUsage.heapUsed || 0}, ${metric.memoryUsage.heapTotal || 0},
              ${metric.memoryUsage.external || 0}, ${metric.memoryUsage.rss || 0}, ${metric.cpuUsage.user || 0},
              ${metric.cpuUsage.system || 0}, ${metric.eventLoopDelay || 0}, ${metric.activeConnections || 0},
              ${metric.requestsPerMinute || 0}, ${metric.errorRate || 0}
            )
          `);
        }
      }
    } catch (error) {
      console.error('Failed to flush logging buffers:', error);
    }
  }

  /**
   * Get recent errors for monitoring
   */
  async getRecentErrors(limit: number = 50): Promise<ErrorLogEntry[]> {
    const result = await db.execute(sql`
      SELECT * FROM error_logs 
      ORDER BY timestamp DESC 
      LIMIT ${limit}
    `);

    return ((result.rows as any[]) || []).map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      stack: row.stack,
      context: row.context,
      userId: row.user_id,
      requestId: row.request_id,
      endpoint: row.endpoint,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      sessionId: row.session_id
    }));
  }

  /**
   * Get error statistics
   */
  async getErrorStats(hours: number = 24): Promise<{
    totalErrors: number;
    errorsByLevel: { [key: string]: number };
    errorsByEndpoint: { [key: string]: number };
    errorTrends: Array<{ hour: string; count: number }>;
  }> {
    const result = await db.execute(sql`
      SELECT 
        level,
        endpoint,
        DATE_TRUNC('hour', timestamp) as hour,
        COUNT(*) as count
      FROM error_logs 
      WHERE timestamp >= NOW() - INTERVAL '${sql.raw(hours.toString())} hours'
      GROUP BY level, endpoint, hour
      ORDER BY hour DESC
    `);

    const stats = {
      totalErrors: 0,
      errorsByLevel: {} as { [key: string]: number },
      errorsByEndpoint: {} as { [key: string]: number },
      errorTrends: [] as Array<{ hour: string; count: number }>
    };

    for (const row of ((result.rows as any[]) || [])) {
      stats.totalErrors += Number(row.count);
      stats.errorsByLevel[row.level] = (stats.errorsByLevel[row.level] || 0) + Number(row.count);
      
      if (row.endpoint) {
        stats.errorsByEndpoint[row.endpoint] = (stats.errorsByEndpoint[row.endpoint] || 0) + Number(row.count);
      }
    }

    return stats;
  }

  /**
   * Create Express middleware for request logging
   */
  createRequestLoggingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestId = this.generateId();
      const startTime = Date.now();

      // Add request ID to request object
      (req as any).requestId = requestId;

      // Log request start
      this.logInfo('Request started', {
        requestId,
        method: req.method,
        endpoint: req.path,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        userId: (req.user as any)?.id
      });

      // Override res.json to log responses
      const originalJson = res.json;
      res.json = function(body: any) {
        const responseTime = Date.now() - startTime;
        
        if (res.statusCode >= 400) {
          errorLogger.logError('Request failed', new Error(`${res.statusCode}: ${res.statusMessage}`), {
            requestId,
            method: req.method,
            endpoint: req.path,
            statusCode: res.statusCode,
            responseTime,
            body,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip,
            userId: (req.user as any)?.id
          });
        } else {
          errorLogger.logInfo('Request completed', {
            requestId,
            method: req.method,
            endpoint: req.path,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip,
            userId: (req.user as any)?.id
          });
        }

        return originalJson.call(this, body);
      };

      next();
    };
  }

  /**
   * Create Express error handling middleware
   */
  createErrorHandlingMiddleware() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const requestId = (req as any).requestId;
      
      this.logError('Unhandled request error', error, {
        requestId,
        method: req.method,
        endpoint: req.path,
        body: req.body,
        query: req.query,
        params: req.params,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        userId: (req.user as any)?.id,
        sessionId: (req.session as any)?.id
      });

      // Don't expose internal errors to clients
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          requestId,
          timestamp: new Date().toISOString()
        });
      }

      next(error);
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Shutdown logging system
   */
  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Final flush
    this.flushBuffers().catch(console.error);
  }
}

// Global error logger instance
export const errorLogger = new ErrorLogger();

// Express middleware exports
export const requestLoggingMiddleware = errorLogger.createRequestLoggingMiddleware();
export const errorHandlingMiddleware = errorLogger.createErrorHandlingMiddleware();
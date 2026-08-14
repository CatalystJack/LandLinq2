import pg from 'pg';
const { Pool } = pg;
type PoolConfig = pg.PoolConfig;
import { sql } from 'drizzle-orm';

interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingCount: number;
  maxConnections: number;
  avgConnectionTime: number;
  avgQueryTime: number;
}

interface ConnectionMetrics {
  queriesExecuted: number;
  totalQueryTime: number;
  connectionsCreated: number;
  connectionsFailed: number;
  poolOverflows: number;
  lastOptimization: Date;
}

/**
 * Advanced Connection Pool Manager
 * Provides optimized connection pooling with monitoring and auto-tuning
 */
export class ConnectionPoolManager {
  private pool: Pool;
  private metrics: ConnectionMetrics;
  private config: PoolConfig;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.metrics = {
      queriesExecuted: 0,
      totalQueryTime: 0,
      connectionsCreated: 0,
      connectionsFailed: 0,
      poolOverflows: 0,
      lastOptimization: new Date()
    };

    this.config = this.getOptimalPoolConfig();
    this.pool = new Pool(this.config);
    this.setupEventListeners();
  }

  /**
   * Get optimal pool configuration based on environment
   */
  private getOptimalPoolConfig(): PoolConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Base configuration
    const baseConfig: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 30000, // 30 seconds
      idleTimeoutMillis: 300000, // 5 minutes
      statement_timeout: 60000, // 60 seconds
      query_timeout: 30000, // 30 seconds
    };

    if (isProduction) {
      // Production optimizations
      return {
        ...baseConfig,
        max: 20, // Maximum connections
        min: 2,  // Minimum connections
        maxUses: 7500, // Max uses per connection before cycling
        maxIdleTime: 30, // Max idle time in seconds
        allowExitOnIdle: false,
      };
    } else if (isDevelopment) {
      // Development configuration
      return {
        ...baseConfig,
        max: 10,
        min: 1,
        maxUses: 1000,
        maxIdleTime: 60,
        allowExitOnIdle: true,
      };
    } else {
      // Default configuration
      return {
        ...baseConfig,
        max: 15,
        min: 1,
        maxUses: 5000,
        maxIdleTime: 45,
      };
    }
  }

  /**
   * Setup event listeners for monitoring
   */
  private setupEventListeners(): void {
    this.pool.on('connect', () => {
      this.metrics.connectionsCreated++;
      console.log('📈 Database connection established');
    });

    this.pool.on('error', (err) => {
      this.metrics.connectionsFailed++;
      console.error('❌ Database connection error:', err);
    });

    this.pool.on('remove', () => {
      console.log('📉 Database connection removed from pool');
    });
  }

  /**
   * Initialize pool monitoring
   */
  async initialize(): Promise<void> {
    // Test initial connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ Database connection pool initialized');
    } catch (error) {
      console.error('❌ Failed to initialize connection pool:', error);
      throw error;
    }

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Get current pool statistics
   */
  async getPoolStats(): Promise<PoolStats> {
    return {
      totalConnections: this.pool.totalCount,
      activeConnections: this.pool.totalCount - this.pool.idleCount,
      idleConnections: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: this.config.max || 10,
      avgConnectionTime: this.metrics.connectionsCreated > 0 
        ? this.metrics.totalQueryTime / this.metrics.connectionsCreated 
        : 0,
      avgQueryTime: this.metrics.queriesExecuted > 0
        ? this.metrics.totalQueryTime / this.metrics.queriesExecuted
        : 0
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Execute query with performance tracking
   */
  async executeQuery<T>(queryFn: (client: any) => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const client = await this.pool.connect();
    
    try {
      const result = await queryFn(client);
      
      // Update metrics
      this.metrics.queriesExecuted++;
      this.metrics.totalQueryTime += Date.now() - startTime;
      
      return result;
    } catch (error) {
      console.error('❌ Query execution error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorPerformance();
        await this.autoOptimize();
      } catch (error) {
        console.error('❌ Pool monitoring error:', error);
      }
    }, 60000); // Every minute

    console.log('🔍 Connection pool monitoring started');
  }

  /**
   * Monitor pool performance
   */
  private async monitorPerformance(): Promise<void> {
    const stats = await this.getPoolStats();
    
    // Log warnings for potential issues
    if (stats.waitingCount > 0) {
      console.warn(`⚠️ ${stats.waitingCount} queries waiting for connections`);
      this.metrics.poolOverflows++;
    }
    
    if (stats.activeConnections / stats.maxConnections > 0.8) {
      console.warn('⚠️ Pool utilization high (>80%)');
    }
    
    if (stats.avgQueryTime > 5000) {
      console.warn(`⚠️ Average query time high: ${stats.avgQueryTime}ms`);
    }

    // Log periodic stats (every 5 minutes)
    if (this.metrics.queriesExecuted % 100 === 0 && this.metrics.queriesExecuted > 0) {
      console.log('📊 Pool Stats:', {
        active: stats.activeConnections,
        idle: stats.idleConnections,
        waiting: stats.waitingCount,
        avgQueryTime: Math.round(stats.avgQueryTime),
        totalQueries: this.metrics.queriesExecuted
      });
    }
  }

  /**
   * Auto-optimize pool configuration
   */
  private async autoOptimize(): Promise<void> {
    const stats = await this.getPoolStats();
    const now = new Date();
    const hoursSinceLastOptimization = (now.getTime() - this.metrics.lastOptimization.getTime()) / (1000 * 60 * 60);
    
    // Only optimize every 4 hours
    if (hoursSinceLastOptimization < 4) return;
    
    let optimizationMade = false;
    
    // Increase pool size if consistently hitting limits
    if (this.metrics.poolOverflows > 10 && stats.maxConnections < 30) {
      this.config.max = Math.min((this.config.max || 10) + 2, 30);
      console.log(`🔧 Auto-optimization: Increased max connections to ${this.config.max}`);
      optimizationMade = true;
    }
    
    // Decrease pool size if consistently underutilized
    if (stats.activeConnections / stats.maxConnections < 0.3 && stats.maxConnections > 5) {
      this.config.max = Math.max((this.config.max || 10) - 1, 5);
      console.log(`🔧 Auto-optimization: Decreased max connections to ${this.config.max}`);
      optimizationMade = true;
    }
    
    // Adjust idle timeout based on usage patterns
    if (stats.avgQueryTime > 2000 && (this.config.idleTimeoutMillis || 0) > 60000) {
      this.config.idleTimeoutMillis = Math.max((this.config.idleTimeoutMillis || 300000) - 30000, 60000);
      console.log(`🔧 Auto-optimization: Decreased idle timeout to ${this.config.idleTimeoutMillis}ms`);
      optimizationMade = true;
    }
    
    if (optimizationMade) {
      // Apply new configuration by recreating pool
      await this.reconfigurePool();
      this.metrics.lastOptimization = now;
      this.metrics.poolOverflows = 0; // Reset overflow counter
    }
  }

  /**
   * Reconfigure pool with new settings
   */
  private async reconfigurePool(): Promise<void> {
    console.log('🔄 Reconfiguring connection pool...');
    
    // Gracefully close existing pool
    await this.pool.end();
    
    // Create new pool with updated config
    this.pool = new Pool(this.config);
    this.setupEventListeners();
    
    console.log('✅ Connection pool reconfigured');
  }

  /**
   * Get connection health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      connectivity: boolean;
      poolUtilization: number;
      avgResponseTime: number;
      errorRate: number;
    };
  }> {
    try {
      const startTime = Date.now();
      
      // Test connectivity
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      const responseTime = Date.now() - startTime;
      const stats = await this.getPoolStats();
      
      const poolUtilization = stats.activeConnections / stats.maxConnections;
      const errorRate = this.metrics.connectionsFailed / Math.max(this.metrics.connectionsCreated, 1);
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (responseTime > 5000 || poolUtilization > 0.9 || errorRate > 0.1) {
        status = 'unhealthy';
      } else if (responseTime > 2000 || poolUtilization > 0.7 || errorRate > 0.05) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        status,
        details: {
          connectivity: true,
          poolUtilization: Math.round(poolUtilization * 100) / 100,
          avgResponseTime: Math.round(responseTime),
          errorRate: Math.round(errorRate * 100) / 100
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connectivity: false,
          poolUtilization: 0,
          avgResponseTime: 0,
          errorRate: 1
        }
      };
    }
  }

  /**
   * Gracefully shutdown pool
   */
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    console.log('🔄 Shutting down connection pool...');
    await this.pool.end();
    console.log('✅ Connection pool shutdown complete');
  }

  /**
   * Force pool refresh (useful for configuration changes)
   */
  async refresh(): Promise<void> {
    console.log('🔄 Refreshing connection pool...');
    await this.reconfigurePool();
    console.log('✅ Connection pool refreshed');
  }

  /**
   * Get the underlying pool instance
   */
  getPool(): Pool {
    return this.pool;
  }
}

// Export singleton instance
export const connectionPoolManager = new ConnectionPoolManager();
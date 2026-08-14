import { sql } from 'drizzle-orm';
import { db } from '../db';

interface IndexInfo {
  tableName: string;
  indexName: string;
  columns: string[];
  indexType: string;
  size: string;
  usage: {
    scans: number;
    tuplesFetched: number;
    tuplesRead: number;
  };
  isUnique: boolean;
  isPartial: boolean;
}

interface IndexRecommendation {
  type: 'create' | 'drop' | 'modify';
  priority: 'high' | 'medium' | 'low';
  tableName: string;
  indexName?: string;
  columns: string[];
  reasoning: string;
  estimatedImpact: string;
  sqlCommand: string;
}

interface QueryStats {
  query: string;
  calls: number;
  totalTime: number;
  avgTime: number;
  rows: number;
  hitRatio: number;
}

/**
 * Database Index Optimizer
 * Analyzes query patterns and optimizes indexes for better performance
 */
export class IndexOptimizer {
  private monitoringInterval?: NodeJS.Timeout;
  private queryStats: Map<string, QueryStats> = new Map();

  /**
   * Initialize index optimizer
   */
  async initialize(): Promise<void> {
    // Enable query statistics collection
    await this.enableQueryStats();
    
    console.log('✅ Index optimizer initialized');
  }

  /**
   * Analyze current indexes
   */
  async analyzeIndexes(): Promise<IndexInfo[]> {
    const result = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef,
        CASE 
          WHEN indexdef LIKE '%UNIQUE%' THEN true 
          ELSE false 
        END as is_unique,
        CASE 
          WHEN indexdef LIKE '%WHERE%' THEN true 
          ELSE false 
        END as is_partial,
        COALESCE(pg_size_pretty(pg_relation_size(quote_ident(indexname)::regclass)), 'N/A') as size
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    const indexes: IndexInfo[] = [];
    
    for (const row of result.rows) {
      // Get index usage statistics
      const usageResult = await db.execute(sql`
        SELECT 
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE indexrelname = ${row.indexname}
      `);
      
      const usage = usageResult.rows[0] as any || { idx_scan: 0, idx_tup_read: 0, idx_tup_fetch: 0 };
      
      // Parse columns from index definition
      const columns = this.parseIndexColumns(String(row.indexdef));
      
      indexes.push({
        tableName: String(row.tablename),
        indexName: String(row.indexname),
        columns,
        indexType: this.getIndexType(String(row.indexdef)),
        size: String(row.size),
        usage: {
          scans: parseInt(usage.idx_scan || '0'),
          tuplesFetched: parseInt(usage.idx_tup_fetch || '0'),
          tuplesRead: parseInt(usage.idx_tup_read || '0')
        },
        isUnique: Boolean(row.is_unique),
        isPartial: Boolean(row.is_partial)
      });
    }
    
    return indexes;
  }

  /**
   * Get index recommendations based on query patterns
   */
  async getIndexRecommendations(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];
    
    // Analyze slow queries
    const slowQueries = await this.analyzeSlowQueries();
    recommendations.push(...this.recommendIndexesForSlowQueries(slowQueries));
    
    // Analyze unused indexes
    const unusedIndexes = await this.findUnusedIndexes();
    recommendations.push(...this.recommendDropUnusedIndexes(unusedIndexes));
    
    // Analyze missing indexes for common patterns
    const missingIndexes = await this.findMissingIndexes();
    recommendations.push(...missingIndexes);
    
    // Sort by priority and estimated impact
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Apply index recommendations
   */
  async applyRecommendation(recommendation: IndexRecommendation): Promise<void> {
    console.log(`🔧 Applying index recommendation: ${recommendation.reasoning}`);
    
    try {
      await db.execute(sql.raw(recommendation.sqlCommand));
      console.log(`✅ Successfully applied: ${recommendation.sqlCommand}`);
    } catch (error) {
      console.error(`❌ Failed to apply recommendation:`, error);
      throw error;
    }
  }

  /**
   * Create optimal indexes for LandLinq tables
   */
  async createOptimalIndexes(): Promise<void> {
    console.log('🔧 Creating optimal indexes for LandLinq...');
    
    const indexCommands = [
      // Deals table - core business queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_status_created ON deals(status, created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_classification_price ON deals(classification, asking_price)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_broker_status ON deals(broker_id, status)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_location_size ON deals(address, size_acres)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_zoning_sewer ON deals(zoning, sewer_available)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_score_rating ON deals(ai_analysis_data)',
      
      // Brokers table - user management
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brokers_email_active ON brokers(email, is_active)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brokers_markets_active ON brokers(markets_covered, is_active)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brokers_points_level ON brokers(total_points DESC, current_level)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brokers_referral_active ON brokers(referral_code, is_active)',
      
      // Communications table - notification system
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communications_broker_sent ON communications(broker_id, sent_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communications_type_status ON communications(type, status)',
      
      // Users table - authentication
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_created ON users(email, created_at)',
      
      // Composite indexes for complex queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_multi_filter ON deals(classification, status, asking_price, size_acres) WHERE status != \'rejected\'',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brokers_performance ON brokers(total_points DESC, share_count DESC, created_at) WHERE is_active = true',
    ];

    for (const command of indexCommands) {
      try {
        await db.execute(sql.raw(command));
        console.log(`✅ ${command.split(' ')[5]} created successfully`);
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️ Index already exists: ${command.split(' ')[5]}`);
        } else {
          console.error(`❌ Failed to create index:`, error);
        }
      }
    }
    
    console.log('✅ Optimal indexes created');
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  async analyzeQueryPerformance(): Promise<{
    slowQueries: QueryStats[];
    indexUsage: Array<{
      tableName: string;
      totalScans: number;
      seqScans: number;
      indexScans: number;
      efficiency: number;
    }>;
    recommendations: string[];
  }> {
    // Get slow queries
    const slowQueries = await this.analyzeSlowQueries();
    
    // Get table scan statistics
    const tableStats = await db.execute(sql`
      SELECT 
        schemaname,
        relname as tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public'
      ORDER BY seq_scan DESC, idx_scan DESC
    `);

    const indexUsage = tableStats.rows.map((stat: any) => {
      const totalScans = (stat.seq_scan || 0) + (stat.idx_scan || 0);
      const efficiency = totalScans > 0 ? (stat.idx_scan || 0) / totalScans : 0;
      
      return {
        tableName: stat.tablename,
        totalScans,
        seqScans: stat.seq_scan || 0,
        indexScans: stat.idx_scan || 0,
        efficiency: Math.round(efficiency * 100) / 100
      };
    });

    // Generate recommendations
    const recommendations = [];
    
    for (const usage of indexUsage) {
      if (usage.efficiency < 0.5 && usage.seqScans > 100) {
        recommendations.push(`Consider adding indexes to ${usage.tableName} - low index efficiency (${Math.round(usage.efficiency * 100)}%)`);
      }
      if (usage.seqScans > 1000) {
        recommendations.push(`High sequential scan count on ${usage.tableName} (${usage.seqScans}) - check for missing indexes`);
      }
    }

    return { slowQueries, indexUsage, recommendations };
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectQueryStats();
        await this.analyzeAndRecommend();
      } catch (error) {
        console.error('❌ Index monitoring error:', error);
      }
    }, 300000); // Every 5 minutes

    console.log('🔍 Index monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log('⏹️ Index monitoring stopped');
    }
  }

  // Private helper methods
  private async enableQueryStats(): Promise<void> {
    try {
      await db.execute(sql`
        ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements'
      `);
      await db.execute(sql`
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements
      `);
    } catch (error) {
      console.warn('⚠️ Could not enable pg_stat_statements extension');
    }
  }

  private async analyzeSlowQueries(): Promise<QueryStats[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          rows
        FROM pg_stat_statements 
        WHERE query NOT LIKE '%pg_stat_statements%'
        AND mean_exec_time > 100
        ORDER BY mean_exec_time DESC 
        LIMIT 20
      `);

      return result.rows.map((row: any) => ({
        query: row.query,
        calls: parseInt(row.calls),
        totalTime: parseFloat(row.total_exec_time),
        avgTime: parseFloat(row.mean_exec_time),
        rows: parseInt(row.rows),
        hitRatio: 0 // Calculate if needed
      }));
    } catch (error) {
      console.warn('⚠️ Could not analyze slow queries - pg_stat_statements not available');
      return [];
    }
  }

  private async findUnusedIndexes(): Promise<IndexInfo[]> {
    const indexes = await this.analyzeIndexes();
    return indexes.filter(index => 
      !index.indexName.includes('_pkey') && // Keep primary keys
      !index.isUnique && // Keep unique constraints
      index.usage.scans < 10 // Very low usage
    );
  }

  private async findMissingIndexes(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];
    
    // Common patterns that benefit from indexes
    const commonPatterns = [
      {
        table: 'deals',
        columns: ['created_at', 'status'],
        reason: 'Time-based queries with status filtering'
      },
      {
        table: 'deals',
        columns: ['broker_id', 'classification'],
        reason: 'Broker-specific deal analysis'
      },
      {
        table: 'communications',
        columns: ['sent_at', 'delivery_status'],
        reason: 'Communication delivery tracking'
      }
    ];

    for (const pattern of commonPatterns) {
      const indexName = `idx_${pattern.table}_${pattern.columns.join('_')}`;
      const exists = await this.indexExists(pattern.table, pattern.columns);
      
      if (!exists) {
        recommendations.push({
          type: 'create',
          priority: 'medium',
          tableName: pattern.table,
          indexName,
          columns: pattern.columns,
          reasoning: pattern.reason,
          estimatedImpact: 'Medium - Improved query performance',
          sqlCommand: `CREATE INDEX CONCURRENTLY ${indexName} ON ${pattern.table}(${pattern.columns.join(', ')})`
        });
      }
    }

    return recommendations;
  }

  private recommendIndexesForSlowQueries(slowQueries: QueryStats[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];
    
    for (const query of slowQueries.slice(0, 5)) { // Top 5 slow queries
      const tables = this.extractTablesFromQuery(query.query);
      const whereColumns = this.extractWhereColumns(query.query);
      
      for (const table of tables) {
        const relevantColumns = whereColumns.filter(col => 
          query.query.includes(`${table}.${col}`) || 
          (tables.length === 1 && whereColumns.includes(col))
        );
        
        if (relevantColumns.length > 0) {
          const indexName = `idx_${table}_${relevantColumns.join('_')}_perf`;
          recommendations.push({
            type: 'create',
            priority: 'high',
            tableName: table,
            indexName,
            columns: relevantColumns,
            reasoning: `Optimize slow query (${Math.round(query.avgTime)}ms avg)`,
            estimatedImpact: 'High - Direct performance improvement',
            sqlCommand: `CREATE INDEX CONCURRENTLY ${indexName} ON ${table}(${relevantColumns.join(', ')})`
          });
        }
      }
    }

    return recommendations;
  }

  private recommendDropUnusedIndexes(unusedIndexes: IndexInfo[]): IndexRecommendation[] {
    return unusedIndexes.map(index => ({
      type: 'drop' as const,
      priority: 'low' as const,
      tableName: index.tableName,
      indexName: index.indexName,
      columns: index.columns,
      reasoning: `Unused index (${index.usage.scans} scans) - saves space`,
      estimatedImpact: `Low - Saves ${index.size} storage space`,
      sqlCommand: `DROP INDEX CONCURRENTLY ${index.indexName}`
    }));
  }

  private parseIndexColumns(indexDef: string): string[] {
    const match = indexDef.match(/\(([^)]+)\)/);
    if (!match) return [];
    return match[1].split(',').map(col => col.trim().replace(/"/g, ''));
  }

  private getIndexType(indexDef: string): string {
    if (indexDef.includes('UNIQUE')) return 'unique';
    if (indexDef.includes('btree')) return 'btree';
    if (indexDef.includes('gin')) return 'gin';
    if (indexDef.includes('gist')) return 'gist';
    return 'btree'; // default
  }

  private extractTablesFromQuery(query: string): string[] {
    const tables: string[] = [];
    const fromMatch = query.match(/FROM\s+(\w+)/gi);
    const joinMatch = query.match(/JOIN\s+(\w+)/gi);
    
    if (fromMatch) {
      tables.push(...fromMatch.map(m => m.replace(/FROM\s+/i, '')));
    }
    if (joinMatch) {
      tables.push(...joinMatch.map(m => m.replace(/JOIN\s+/i, '')));
    }
    
    return Array.from(new Set(tables));
  }

  private extractWhereColumns(query: string): string[] {
    const columns: string[] = [];
    const whereClause = query.match(/WHERE\s+(.+?)(?:ORDER BY|GROUP BY|LIMIT|$)/i);
    
    if (whereClause) {
      const conditions = whereClause[1];
      const columnMatches = conditions.match(/(\w+)\s*[=<>]/g);
      if (columnMatches) {
        columns.push(...columnMatches.map(m => m.replace(/\s*[=<>].*/, '')));
      }
    }
    
    return Array.from(new Set(columns));
  }

  private async indexExists(tableName: string, columns: string[]): Promise<boolean> {
    const result = await db.execute(sql`
      SELECT 1 FROM pg_indexes 
      WHERE tablename = ${tableName}
      AND indexdef LIKE ${`%${columns.join('%')}%`}
    `);
    return result.rows.length > 0;
  }

  private async collectQueryStats(): Promise<void> {
    // Implementation for collecting query statistics
    // This would integrate with pg_stat_statements if available
  }

  private async analyzeAndRecommend(): Promise<void> {
    const recommendations = await this.getIndexRecommendations();
    
    if (recommendations.length > 0) {
      console.log(`🔍 Found ${recommendations.length} index optimization opportunities`);
      
      // Auto-apply low-risk, high-impact recommendations
      const autoApplyable = recommendations.filter(r => 
        r.priority === 'high' && 
        r.type === 'create' && 
        r.columns.length <= 3
      );
      
      if (autoApplyable.length > 0) {
        console.log(`🤖 Auto-applying ${autoApplyable.length} high-impact index recommendations...`);
        for (const rec of autoApplyable.slice(0, 2)) { // Limit to 2 per cycle
          try {
            await this.applyRecommendation(rec);
          } catch (error) {
            console.error(`❌ Auto-apply failed:`, error);
          }
        }
      }
    }
  }
}

// Export singleton instance
export const indexOptimizer = new IndexOptimizer();
import { sql, and, lt, eq, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import { deals, brokers, communications } from '@shared/schema';

interface ArchiveRule {
  tableName: string;
  condition: string;
  retentionDays: number;
  archiveMethod: 'soft_delete' | 'move_to_archive' | 'hard_delete';
  description: string;
}

interface ArchiveStats {
  tableName: string;
  totalRecords: number;
  archivedRecords: number;
  eligibleForArchive: number;
  lastArchived: Date | null;
  nextArchiveRun: Date;
}

interface ArchiveJob {
  id: string;
  tableName: string;
  recordsProcessed: number;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

/**
 * Data Archiving System
 * Manages automated data lifecycle and retention policies
 */
export class ArchivingManager {
  private archiveRules: ArchiveRule[] = [];
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * Initialize archiving system
   */
  async initialize(): Promise<void> {
    // Create archive jobs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS archive_jobs (
        id VARCHAR(255) PRIMARY KEY,
        table_name VARCHAR(255) NOT NULL,
        records_processed INTEGER DEFAULT 0,
        start_time TIMESTAMP DEFAULT NOW(),
        end_time TIMESTAMP,
        status VARCHAR(50) DEFAULT 'running',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create archive statistics table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS archive_stats (
        table_name VARCHAR(255) PRIMARY KEY,
        total_records BIGINT DEFAULT 0,
        archived_records BIGINT DEFAULT 0,
        last_archived TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Archiving system initialized');
  }

  /**
   * Setup default archiving rules for LandLinq
   */
  private setupDefaultRules(): void {
    this.archiveRules = [
      {
        tableName: 'deals',
        condition: "status IN ('rejected', 'clear_no') AND created_at < NOW() - INTERVAL '90 days'",
        retentionDays: 90,
        archiveMethod: 'soft_delete',
        description: 'Archive rejected deals after 90 days'
      },
      {
        tableName: 'deals',
        condition: "status = 'approved' AND created_at < NOW() - INTERVAL '2 years'",
        retentionDays: 730,
        archiveMethod: 'move_to_archive',
        description: 'Archive completed deals after 2 years'
      },
      {
        tableName: 'communications',
        condition: "sent_at < NOW() - INTERVAL '1 year' AND status = 'sent'",
        retentionDays: 365,
        archiveMethod: 'soft_delete',
        description: 'Archive old successful communications after 1 year'
      },
      {
        tableName: 'communications',
        condition: "sent_at < NOW() - INTERVAL '30 days' AND status = 'failed'",
        retentionDays: 30,
        archiveMethod: 'hard_delete',
        description: 'Delete failed communications after 30 days'
      },
      {
        tableName: 'brokers',
        condition: "is_active = false AND updated_at < NOW() - INTERVAL '2 years'",
        retentionDays: 730,
        archiveMethod: 'soft_delete',
        description: 'Archive inactive brokers after 2 years'
      }
    ];
  }

  /**
   * Add custom archive rule
   */
  addArchiveRule(rule: ArchiveRule): void {
    this.archiveRules.push(rule);
    console.log(`✅ Archive rule added for ${rule.tableName}: ${rule.description}`);
  }

  /**
   * Get archive statistics for all tables
   */
  async getArchiveStats(): Promise<ArchiveStats[]> {
    const stats: ArchiveStats[] = [];
    
    for (const rule of this.archiveRules) {
      try {
        // Get total records
        const totalResult = await db.execute(sql`
          SELECT COUNT(*) as count FROM ${sql.identifier(rule.tableName)}
        `);
        const totalRecords = parseInt(((totalResult.rows || totalResult as any[])[0] as any)?.count || '0');

        // Get archived records (if soft delete is used)
        let archivedRecords = 0;
        if (rule.archiveMethod === 'soft_delete') {
          const archivedResult = await db.execute(sql`
            SELECT COUNT(*) as count FROM ${sql.identifier(rule.tableName)}
            WHERE is_archived = true
          `);
          archivedRecords = parseInt(((archivedResult.rows || archivedResult as any[])[0] as any)?.count || '0');
        }

        // Get records eligible for archiving
        const eligibleResult = await db.execute(sql`
          SELECT COUNT(*) as count FROM ${sql.identifier(rule.tableName)}
          WHERE ${sql.raw(rule.condition)}
        `);
        const eligibleForArchive = parseInt(((eligibleResult.rows || eligibleResult as any[])[0] as any)?.count || '0');

        // Get last archive date
        const lastArchiveResult = await db.execute(sql`
          SELECT last_archived FROM archive_stats WHERE table_name = ${rule.tableName}
        `);
        const lastArchived = ((lastArchiveResult.rows || lastArchiveResult as any[])[0] as any)?.last_archived 
          ? new Date(((lastArchiveResult.rows || lastArchiveResult as any[])[0] as any).last_archived)
          : null;

        // Calculate next archive run (daily at 3 AM)
        const nextRun = new Date();
        nextRun.setHours(3, 0, 0, 0);
        if (nextRun <= new Date()) {
          nextRun.setDate(nextRun.getDate() + 1);
        }

        stats.push({
          tableName: rule.tableName,
          totalRecords,
          archivedRecords,
          eligibleForArchive,
          lastArchived,
          nextArchiveRun: nextRun
        });
      } catch (error) {
        console.error(`❌ Failed to get stats for ${rule.tableName}:`, error);
      }
    }

    return stats;
  }

  /**
   * Run archiving process for a specific table
   */
  async archiveTable(tableName: string, dryRun: boolean = false): Promise<ArchiveJob> {
    const rule = this.archiveRules.find(r => r.tableName === tableName);
    if (!rule) {
      throw new Error(`No archive rule found for table: ${tableName}`);
    }

    const jobId = `archive_${tableName}_${Date.now()}`;
    const job: ArchiveJob = {
      id: jobId,
      tableName,
      recordsProcessed: 0,
      startTime: new Date(),
      status: 'running'
    };

    console.log(`🔄 ${dryRun ? 'DRY RUN - ' : ''}Starting archive job for ${tableName}...`);

    try {
      // Record job start
      if (!dryRun) {
        await db.execute(sql`
          INSERT INTO archive_jobs (id, table_name, start_time, status)
          VALUES (${jobId}, ${tableName}, ${job.startTime.toISOString()}, 'running')
        `);
      }

      // Get records to archive
      const recordsToArchive = await db.execute(sql`
        SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}
        WHERE ${sql.raw(rule.condition)}
      `);
      const recordCount = parseInt((recordsToArchive[0] as any)?.count || '0');

      if (recordCount === 0) {
        console.log(`ℹ️ No records to archive for ${tableName}`);
        job.status = 'completed';
        job.endTime = new Date();
        return job;
      }

      console.log(`📦 Found ${recordCount} records to archive in ${tableName}`);

      if (!dryRun) {
        // Apply archiving based on method
        switch (rule.archiveMethod) {
          case 'soft_delete':
            await this.softDeleteRecords(tableName, rule.condition);
            break;
          case 'move_to_archive':
            await this.moveToArchiveTable(tableName, rule.condition);
            break;
          case 'hard_delete':
            await this.hardDeleteRecords(tableName, rule.condition);
            break;
        }

        // Update statistics
        await this.updateArchiveStats(tableName, recordCount);
      }

      job.recordsProcessed = recordCount;
      job.status = 'completed';
      job.endTime = new Date();

      if (!dryRun) {
        await db.execute(sql`
          UPDATE archive_jobs 
          SET records_processed = ${recordCount}, end_time = ${job.endTime.toISOString()}, status = 'completed'
          WHERE id = ${jobId}
        `);
      }

      console.log(`✅ Archive job completed for ${tableName}: ${recordCount} records processed`);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.endTime = new Date();

      if (!dryRun) {
        await db.execute(sql`
          UPDATE archive_jobs 
          SET status = 'failed', error_message = ${job.error}, end_time = ${job.endTime.toISOString()}
          WHERE id = ${jobId}
        `);
      }

      console.error(`❌ Archive job failed for ${tableName}:`, error);
      throw error;
    }

    return job;
  }

  /**
   * Run all archiving jobs
   */
  async runAllArchiveJobs(dryRun: boolean = false): Promise<ArchiveJob[]> {
    const jobs: ArchiveJob[] = [];
    
    console.log(`🔄 ${dryRun ? 'DRY RUN - ' : ''}Running all archive jobs...`);

    for (const rule of this.archiveRules) {
      try {
        const job = await this.archiveTable(rule.tableName, dryRun);
        jobs.push(job);
      } catch (error) {
        console.error(`❌ Failed to archive ${rule.tableName}:`, error);
      }
    }

    const totalProcessed = jobs.reduce((sum, job) => sum + job.recordsProcessed, 0);
    console.log(`✅ Archive run completed: ${totalProcessed} total records processed`);

    return jobs;
  }

  /**
   * Schedule automatic archiving
   */
  async scheduleArchiving(): Promise<void> {
    const cron = await import('node-cron');
    
    // Run archiving daily at 3 AM
    const dailyJob = cron.schedule('0 3 * * *', async () => {
      try {
        console.log('🔄 Running scheduled archiving...');
        await this.runAllArchiveJobs();
      } catch (error) {
        console.error('❌ Scheduled archiving failed:', error);
      }
    });

    this.scheduledJobs.set('daily_archive', dailyJob);
    console.log('✅ Archive scheduler initialized - daily at 3 AM');
  }

  /**
   * Get archiving job history
   */
  async getJobHistory(limit: number = 50): Promise<ArchiveJob[]> {
    const result = await db.execute(sql`
      SELECT id, table_name, records_processed, start_time, end_time, status, error_message
      FROM archive_jobs 
      ORDER BY start_time DESC 
      LIMIT ${limit}
    `);

    return (result as any[]).map(row => ({
      id: row.id,
      tableName: row.table_name,
      recordsProcessed: parseInt(row.records_processed || '0'),
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      status: row.status,
      error: row.error_message
    }));
  }

  /**
   * Restore archived data
   */
  async restoreArchivedData(tableName: string, recordIds: string[]): Promise<number> {
    console.log(`🔄 Restoring ${recordIds.length} archived records from ${tableName}...`);
    
    try {
      const result = await db.execute(sql`
        UPDATE ${sql.identifier(tableName)}
        SET is_archived = false, archived_at = NULL
        WHERE id = ANY(${recordIds}) AND is_archived = true
      `);

      const restoredCount = result.count || 0;
      console.log(`✅ Restored ${restoredCount} records from ${tableName}`);
      
      return restoredCount;
    } catch (error) {
      console.error(`❌ Failed to restore records from ${tableName}:`, error);
      throw error;
    }
  }

  // Private helper methods
  private async softDeleteRecords(tableName: string, condition: string): Promise<void> {
    await db.execute(sql`
      UPDATE ${sql.identifier(tableName)}
      SET is_archived = true, archived_at = NOW()
      WHERE ${sql.raw(condition)} AND (is_archived IS NULL OR is_archived = false)
    `);
  }

  private async moveToArchiveTable(tableName: string, condition: string): Promise<void> {
    const archiveTableName = `${tableName}_archive`;
    
    // Create archive table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(archiveTableName)} 
      (LIKE ${sql.identifier(tableName)} INCLUDING ALL)
    `);

    // Move records to archive table
    await db.execute(sql`
      INSERT INTO ${sql.identifier(archiveTableName)}
      SELECT * FROM ${sql.identifier(tableName)}
      WHERE ${sql.raw(condition)}
    `);

    // Delete from main table
    await db.execute(sql`
      DELETE FROM ${sql.identifier(tableName)}
      WHERE ${sql.raw(condition)}
    `);
  }

  private async hardDeleteRecords(tableName: string, condition: string): Promise<void> {
    await db.execute(sql`
      DELETE FROM ${sql.identifier(tableName)}
      WHERE ${sql.raw(condition)}
    `);
  }

  private async updateArchiveStats(tableName: string, recordsArchived: number): Promise<void> {
    await db.execute(sql`
      INSERT INTO archive_stats (table_name, archived_records, last_archived, updated_at)
      VALUES (${tableName}, ${recordsArchived}, NOW(), NOW())
      ON CONFLICT (table_name) 
      DO UPDATE SET 
        archived_records = archive_stats.archived_records + ${recordsArchived},
        last_archived = NOW(),
        updated_at = NOW()
    `);
  }
}

/**
 * Archive Policy Manager
 * Manages data retention policies and compliance requirements
 */
export class ArchivePolicyManager {
  /**
   * Get data retention requirements for LandLinq
   */
  getRetentionPolicies(): {
    tableName: string;
    retentionPeriod: string;
    complianceReason: string;
    legalRequirement: boolean;
  }[] {
    return [
      {
        tableName: 'deals',
        retentionPeriod: '7 years',
        complianceReason: 'Financial record keeping requirements',
        legalRequirement: true
      },
      {
        tableName: 'brokers',
        retentionPeriod: '5 years after last activity',
        complianceReason: 'Business relationship records',
        legalRequirement: false
      },
      {
        tableName: 'communications',
        retentionPeriod: '3 years',
        complianceReason: 'Communication audit trail',
        legalRequirement: true
      },
      {
        tableName: 'users',
        retentionPeriod: 'Until account deletion request',
        complianceReason: 'GDPR compliance - right to be forgotten',
        legalRequirement: true
      }
    ];
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(): Promise<{
    tables: Array<{
      tableName: string;
      totalRecords: number;
      oldestRecord: Date | null;
      retentionCompliant: boolean;
      actionRequired: string[];
    }>;
    summary: {
      compliantTables: number;
      nonCompliantTables: number;
      totalRecords: number;
      estimatedStorageSavings: string;
    };
  }> {
    const policies = this.getRetentionPolicies();
    const tables = [];
    let totalRecords = 0;
    let compliantTables = 0;

    for (const policy of policies) {
      try {
        // Get table stats
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as count FROM ${sql.identifier(policy.tableName)}
        `);
        const tableRecords = parseInt((countResult[0] as any)?.count || '0');
        totalRecords += tableRecords;

        // Get oldest record
        const oldestResult = await db.execute(sql`
          SELECT created_at FROM ${sql.identifier(policy.tableName)}
          ORDER BY created_at ASC LIMIT 1
        `);
        const oldestRecord = (oldestResult[0] as any)?.created_at 
          ? new Date((oldestResult[0] as any).created_at)
          : null;

        // Check compliance
        const actionRequired: string[] = [];
        let isCompliant = true;

        // Check if data exceeds retention period
        if (oldestRecord) {
          const retentionDays = this.parseRetentionDays(policy.retentionPeriod);
          const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
          
          if (oldestRecord < cutoffDate) {
            isCompliant = false;
            actionRequired.push(`Archive data older than ${policy.retentionPeriod}`);
          }
        }

        if (isCompliant) compliantTables++;

        tables.push({
          tableName: policy.tableName,
          totalRecords: tableRecords,
          oldestRecord,
          retentionCompliant: isCompliant,
          actionRequired
        });

      } catch (error) {
        console.error(`❌ Failed to analyze ${policy.tableName}:`, error);
      }
    }

    return {
      tables,
      summary: {
        compliantTables,
        nonCompliantTables: policies.length - compliantTables,
        totalRecords,
        estimatedStorageSavings: '0 MB' // Calculate based on eligible records
      }
    };
  }

  private parseRetentionDays(period: string): number {
    const yearMatch = period.match(/(\d+)\s*years?/);
    if (yearMatch) return parseInt(yearMatch[1]) * 365;
    
    const dayMatch = period.match(/(\d+)\s*days?/);
    if (dayMatch) return parseInt(dayMatch[1]);
    
    return 365; // Default to 1 year
  }
}

// Export singleton instances
export const archivingManager = new ArchivingManager();
export const archivePolicyManager = new ArchivePolicyManager();
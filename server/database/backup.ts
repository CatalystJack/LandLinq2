import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '../db';

const execAsync = promisify(exec);

interface BackupOptions {
  includeData?: boolean;
  compressOutput?: boolean;
  schemaOnly?: boolean;
  dataOnly?: boolean;
  excludeTables?: string[];
  includeTables?: string[];
}

interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  type: 'full' | 'schema' | 'data' | 'incremental';
  compressed: boolean;
  checksum?: string;
}

/**
 * Database Backup and Recovery System
 * Provides comprehensive backup, restore, and point-in-time recovery
 */
export class BackupManager {
  private backupDir: string;
  private retentionDays: number = 7; // Keep 7 days of backups (matches documented retention policy)

  constructor(backupDir = './backups') {
    this.backupDir = path.resolve(backupDir);
  }

  /**
   * Initialize backup system
   */
  async initialize(): Promise<void> {
    // Create backup directory
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }

    // Create backup metadata table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS backup_log (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        size BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        backup_type VARCHAR(50) NOT NULL,
        compressed BOOLEAN DEFAULT FALSE,
        checksum VARCHAR(64),
        status VARCHAR(50) DEFAULT 'completed'
      );
    `);

    console.log('✅ Backup system initialized');

    // Enforce retention immediately on startup in case the scheduler was
    // down for a while and backups piled up beyond the retention window.
    await this.cleanupOldBackups();
  }

  /**
   * Create a full database backup
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupInfo> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const baseFilename = `landlinq_backup_${timestamp}`;
    const filename = options.compressOutput ? `${baseFilename}.sql.gz` : `${baseFilename}.sql`;
    const filepath = path.join(this.backupDir, filename);

    console.log(`🔄 Creating backup: ${filename}`);

    try {
      // Build pg_dump command
      const pgDumpArgs = this.buildPgDumpArgs(options);
      const command = `pg_dump ${pgDumpArgs} "${process.env.DATABASE_URL}" > "${filepath}"`;
      
      if (options.compressOutput) {
        await execAsync(`${command} && gzip "${filepath.replace('.gz', '')}"`);
      } else {
        await execAsync(command);
      }

      // Get file size
      const stats = await fs.stat(filepath);
      const size = stats.size;

      // Calculate checksum
      const checksum = await this.calculateFileChecksum(filepath);

      // Determine backup type
      const type = options.schemaOnly ? 'schema' : 
                   options.dataOnly ? 'data' : 'full';

      // Record backup in database
      const backupInfo: BackupInfo = {
        id: `backup_${timestamp}`,
        filename,
        size,
        createdAt: new Date(),
        type: type as any,
        compressed: options.compressOutput || false,
        checksum
      };

      await this.recordBackup(backupInfo);

      console.log(`✅ Backup created: ${filename} (${this.formatFileSize(size)})`);
      
      // Clean up old backups
      await this.cleanupOldBackups();

      return backupInfo;
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  /**
   * Create schema-only backup
   */
  async createSchemaBackup(): Promise<BackupInfo> {
    return this.createBackup({
      schemaOnly: true,
      compressOutput: true
    });
  }

  /**
   * Create data-only backup
   */
  async createDataBackup(): Promise<BackupInfo> {
    return this.createBackup({
      dataOnly: true,
      compressOutput: true
    });
  }

  /**
   * Create incremental backup (data changes only)
   */
  async createIncrementalBackup(sinceDate: Date): Promise<BackupInfo> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `landlinq_incremental_${timestamp}.sql.gz`;
    const filepath = path.join(this.backupDir, filename);

    console.log(`🔄 Creating incremental backup since: ${sinceDate.toISOString()}`);

    try {
      // Export only changed data
      const tables = ['deals', 'brokers', 'communications', 'users'];
      const whereClauses = tables.map(table => 
        `--where="updated_at >= '${sinceDate.toISOString()}'"`
      ).join(' ');

      const command = `pg_dump --data-only ${whereClauses} "${process.env.DATABASE_URL}" | gzip > "${filepath}"`;
      await execAsync(command);

      const stats = await fs.stat(filepath);
      const checksum = await this.calculateFileChecksum(filepath);

      const backupInfo: BackupInfo = {
        id: `incremental_${timestamp}`,
        filename,
        size: stats.size,
        createdAt: new Date(),
        type: 'incremental',
        compressed: true,
        checksum
      };

      await this.recordBackup(backupInfo);
      console.log(`✅ Incremental backup created: ${filename}`);

      // Clean up old backups
      await this.cleanupOldBackups();

      return backupInfo;
    } catch (error) {
      console.error('❌ Incremental backup failed:', error);
      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(backupId: string, options: {
    dropExisting?: boolean;
    dataOnly?: boolean;
    schemaOnly?: boolean;
  } = {}): Promise<void> {
    const backup = await this.getBackupInfo(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const filepath = path.join(this.backupDir, backup.filename);
    
    console.log(`🔄 Restoring backup: ${backup.filename}`);
    console.warn('⚠️  This will overwrite existing data. Proceed with caution!');

    try {
      // Verify backup file exists and checksum
      await this.verifyBackup(backup);

      // Build restore command
      const restoreArgs = [];
      
      if (options.dropExisting) {
        restoreArgs.push('--clean --if-exists');
      }
      
      if (options.dataOnly) {
        restoreArgs.push('--data-only');
      } else if (options.schemaOnly) {
        restoreArgs.push('--schema-only');
      }

      const restoreCommand = backup.compressed
        ? `gunzip -c "${filepath}" | psql "${process.env.DATABASE_URL}"`
        : `psql "${process.env.DATABASE_URL}" < "${filepath}"`;

      await execAsync(restoreCommand);
      console.log('✅ Database restored successfully');

    } catch (error) {
      console.error('❌ Restore failed:', error);
      throw error;
    }
  }

  /**
   * List all backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    const result = await db.execute(sql`
      SELECT id, filename, size, created_at, backup_type, compressed, checksum, status
      FROM backup_log 
      ORDER BY created_at DESC
    `);
    
    // Handle different result formats from Drizzle
    const rows = Array.isArray(result) ? result : result.rows || [];
    
    return rows.map((row: any) => ({
      id: row.id,
      filename: row.filename,
      size: parseInt(row.size || '0'),
      createdAt: new Date(row.created_at),
      type: row.backup_type,
      compressed: row.compressed,
      checksum: row.checksum
    }));
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backup: BackupInfo): Promise<boolean> {
    const filepath = path.join(this.backupDir, backup.filename);
    
    try {
      // Check file exists
      await fs.access(filepath);
      
      // Verify checksum if available
      if (backup.checksum) {
        const currentChecksum = await this.calculateFileChecksum(filepath);
        if (currentChecksum !== backup.checksum) {
          throw new Error(`Backup checksum mismatch: ${backup.filename}`);
        }
      }
      
      // Try to read backup header (for SQL files)
      if (backup.filename.endsWith('.sql') || backup.filename.endsWith('.sql.gz')) {
        const command = backup.compressed
          ? `gunzip -t "${filepath}"`
          : `head -1 "${filepath}"`;
        await execAsync(command);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Backup verification failed for ${backup.filename}:`, error);
      return false;
    }
  }

  /**
   * Schedule automatic backups
   */
  async scheduleBackups(): Promise<void> {
    // Create daily full backups at 11:59 PM
    const cron = await import('node-cron').then(m => m.default);
    
    cron.schedule('59 23 * * *', async () => {
      try {
        console.log('🔄 Running scheduled backup...');
        await this.createBackup({ compressOutput: true });
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error);
      }
    });

    // Create incremental backups every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      try {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        await this.createIncrementalBackup(sixHoursAgo);
      } catch (error) {
        console.error('❌ Scheduled incremental backup failed:', error);
      }
    });

    console.log('✅ Backup scheduler initialized - daily backups at 11:59 PM');
  }

  /**
   * Get database statistics for monitoring
   */
  async getDatabaseStats(): Promise<{
    totalSize: string;
    tableStats: Array<{
      tableName: string;
      rowCount: number;
      size: string;
    }>;
  }> {
    // Get total database size
    const sizeResult = await db.execute(sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as total_size
    `);
    const sizeRows = Array.isArray(sizeResult) ? sizeResult : sizeResult.rows || [];
    const totalSize = (sizeRows[0] as any)?.total_size || 'Unknown';

    // Get table statistics
    const tableStatsResult = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE schemaname = 'public'
      ORDER BY tablename, attname
    `);

    const tableStats = await Promise.all([
      'deals', 'brokers', 'communications', 'users', 'sessions'
    ].map(async (tableName) => {
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}
      `);
      const sizeResult = await db.execute(sql`
        SELECT pg_size_pretty(pg_total_relation_size(${tableName})) as size
      `);
      
      return {
        tableName,
        rowCount: parseInt((Array.isArray(countResult) ? countResult : countResult.rows || [])[0]?.count || '0'),
        size: (Array.isArray(sizeResult) ? sizeResult : sizeResult.rows || [])[0]?.size || 'Unknown'
      };
    }));

    return { totalSize, tableStats };
  }

  // Private helper methods
  private buildPgDumpArgs(options: BackupOptions): string {
    const args = ['--verbose --no-owner --no-privileges'];
    
    if (options.schemaOnly) {
      args.push('--schema-only');
    } else if (options.dataOnly) {
      args.push('--data-only');
    }
    
    if (options.excludeTables?.length) {
      args.push(...options.excludeTables.map(t => `--exclude-table=${t}`));
    }
    
    if (options.includeTables?.length) {
      args.push(...options.includeTables.map(t => `--table=${t}`));
    }
    
    return args.join(' ');
  }

  private async recordBackup(backup: BackupInfo): Promise<void> {
    await db.execute(sql`
      INSERT INTO backup_log (id, filename, size, created_at, backup_type, compressed, checksum, status)
      VALUES (${backup.id}, ${backup.filename}, ${backup.size}, ${backup.createdAt.toISOString()}, 
              ${backup.type}, ${backup.compressed}, ${backup.checksum}, 'completed')
    `);
  }

  private async getBackupInfo(backupId: string): Promise<BackupInfo | null> {
    const result = await db.execute(sql`
      SELECT id, filename, size, created_at, backup_type, compressed, checksum
      FROM backup_log 
      WHERE id = ${backupId}
    `);
    
    const rows = Array.isArray(result) ? result : result.rows || [];
    if (rows.length === 0) return null;
    
    const row = rows[0] as any;
    return {
      id: row.id,
      filename: row.filename,
      size: parseInt(row.size || '0'),
      createdAt: new Date(row.created_at),
      type: row.backup_type,
      compressed: row.compressed,
      checksum: row.checksum
    };
  }

  private async calculateFileChecksum(filepath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filepath);
    return createHash('sha256').update(fileBuffer).digest('hex').slice(0, 16);
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private async cleanupOldBackups(): Promise<void> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

    // Delete anything past retention based on the backup_log records
    const backups = await this.listBackups();
    const expired = backups.filter(b => b.createdAt < cutoff);

    for (const backup of expired) {
      try {
        const filepath = path.join(this.backupDir, backup.filename);
        try {
          await fs.unlink(filepath);
          console.log(`🗑️ Deleted old backup: ${backup.filename}`);
        } catch (unlinkError: any) {
          if (unlinkError?.code !== 'ENOENT') throw unlinkError;
          // File already gone (e.g. manually removed) - just clean up the stale record
        }
        await db.execute(sql`DELETE FROM backup_log WHERE id = ${backup.id}`);
      } catch (error) {
        console.warn(`⚠️ Failed to delete backup ${backup.filename}:`, error);
      }
    }

    // Also sweep the backup directory directly for any dump files whose age
    // (parsed from the filename timestamp, falling back to mtime) exceeds the
    // retention window but that aren't tracked in backup_log (e.g. orphaned
    // files from failed/partial runs or manual copies). This prevents disk
    // usage from growing unbounded even if DB records are missing/out of sync.
    try {
      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.startsWith('landlinq_backup_') && !entry.name.startsWith('landlinq_incremental_')) continue;

        const filepath = path.join(this.backupDir, entry.name);
        const match = entry.name.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
        let fileDate: Date | null = null;
        if (match) {
          const iso = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
          const parsed = new Date(iso);
          if (!isNaN(parsed.getTime())) fileDate = parsed;
        }
        if (!fileDate) {
          const stats = await fs.stat(filepath).catch(() => null);
          if (stats) fileDate = stats.mtime;
        }

        if (fileDate && fileDate < cutoff) {
          try {
            await fs.unlink(filepath);
            console.log(`🗑️ Deleted expired backup file not in log: ${entry.name}`);
          } catch (error) {
            console.warn(`⚠️ Failed to delete backup file ${entry.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to sweep backup directory for expired files:', error);
    }
  }
}

// Export singleton instance
export const backupManager = new BackupManager();
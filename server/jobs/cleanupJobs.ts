import { db } from '../db';
import { sql } from 'drizzle-orm';
import cron from 'node-cron';
import { errorLogger } from '../monitoring/errorLogger';

export interface CleanupJobResult {
  jobName: string;
  recordsProcessed: number;
  recordsDeleted: number;
  duration: number;
  status: 'success' | 'failed';
  error?: string;
}

class CleanupJobManager {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.initializeJobs();
  }

  /**
   * Initialize all cleanup jobs
   */
  initializeJobs(): void {
    console.log('🧹 Initializing automated cleanup jobs...');

    // Clean old error logs (keep 90 days - INCREASED for better debugging)
    this.scheduleJob('cleanup-error-logs', '0 2 * * *', async () => {
      return this.cleanupErrorLogs();
    });

    // Clean old system metrics (keep 30 days - INCREASED for better debugging)
    this.scheduleJob('cleanup-system-metrics', '0 3 * * *', async () => {
      return this.cleanupSystemMetrics();
    });

    // Clean old session data (keep 30 days)
    this.scheduleJob('cleanup-sessions', '0 4 * * *', async () => {
      return this.cleanupExpiredSessions();
    });

    // Clean old communication logs (keep 90 days)
    this.scheduleJob('cleanup-communications', '0 5 * * *', async () => {
      return this.cleanupOldCommunications();
    });

    // Clean temporary files (daily)
    this.scheduleJob('cleanup-temp-files', '0 6 * * *', async () => {
      return this.cleanupTemporaryFiles();
    });

    // Vacuum analyze (weekly)
    this.scheduleJob('database-vacuum', '0 1 * * 0', async () => {
      return this.runDatabaseVacuum();
    });

    console.log(`✅ ${this.jobs.size} cleanup jobs scheduled`);
  }

  /**
   * Schedule a cleanup job
   */
  private scheduleJob(name: string, schedule: string, jobFunction: () => Promise<CleanupJobResult>): void {
    const task = cron.schedule(schedule, async () => {
      try {
        console.log(`🧹 Running cleanup job: ${name}`);
        const result = await jobFunction();
        
        errorLogger.logInfo(`Cleanup job completed: ${name}`, {
          jobName: name,
          result
        });

        console.log(`✅ Cleanup job ${name} completed:`, result);
      } catch (error) {
        errorLogger.logError(`Cleanup job failed: ${name}`, error as Error, {
          jobName: name
        });
        console.error(`❌ Cleanup job ${name} failed:`, error);
      }
    }, {
      scheduled: false // Don't start automatically
    });

    this.jobs.set(name, task);
  }

  /**
   * Start all cleanup jobs
   */
  startJobs(): void {
    console.log('🚀 Starting all cleanup jobs...');
    for (const [name, task] of this.jobs) {
      task.start();
      console.log(`✅ Started job: ${name}`);
    }
  }

  /**
   * Stop all cleanup jobs
   */
  stopJobs(): void {
    console.log('🛑 Stopping all cleanup jobs...');
    for (const [name, task] of this.jobs) {
      task.stop();
      console.log(`🛑 Stopped job: ${name}`);
    }
  }

  /**
   * Run a specific job manually
   */
  async runJob(jobName: string): Promise<CleanupJobResult> {
    console.log(`🔄 Manually running job: ${jobName}`);
    
    switch (jobName) {
      case 'cleanup-error-logs':
        return this.cleanupErrorLogs();
      case 'cleanup-system-metrics':
        return this.cleanupSystemMetrics();
      case 'cleanup-sessions':
        return this.cleanupExpiredSessions();
      case 'cleanup-communications':
        return this.cleanupOldCommunications();
      case 'cleanup-temp-files':
        return this.cleanupTemporaryFiles();
      case 'database-vacuum':
        return this.runDatabaseVacuum();
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Clean up old error logs
   */
  private async cleanupErrorLogs(): Promise<CleanupJobResult> {
    const startTime = Date.now();
    
    try {
      const result = await db.execute(sql`
        DELETE FROM error_logs 
        WHERE timestamp < NOW() - INTERVAL '90 days'
      `);

      const recordsDeleted = (result as any).rowCount || 0;

      return {
        jobName: 'cleanup-error-logs',
        recordsProcessed: recordsDeleted,
        recordsDeleted,
        duration: Date.now() - startTime,
        status: 'success'
      };
    } catch (error) {
      return {
        jobName: 'cleanup-error-logs',
        recordsProcessed: 0,
        recordsDeleted: 0,
        duration: Date.now() - startTime,
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Clean up old system metrics
   */
  private async cleanupSystemMetrics(): Promise<CleanupJobResult> {
    const startTime = Date.now();
    
    try {
      const result = await db.execute(sql`
        DELETE FROM system_metrics 
        WHERE timestamp < NOW() - INTERVAL '30 days'
      `);

      const recordsDeleted = (result as any).rowCount || 0;

      return {
        jobName: 'cleanup-system-metrics',
        recordsProcessed: recordsDeleted,
        recordsDeleted,
        duration: Date.now() - startTime,
        status: 'success'
      };
    } catch (error) {
      return {
        jobName: 'cleanup-system-metrics',
        recordsProcessed: 0,
        recordsDeleted: 0,
        duration: Date.now() - startTime,
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<CleanupJobResult> {
    const startTime = Date.now();
    
    try {
      const result = await db.execute(sql`
        DELETE FROM sessions 
        WHERE expire < NOW()
      `);

      const recordsDeleted = (result as any).rowCount || 0;

      return {
        jobName: 'cleanup-sessions',
        recordsProcessed: recordsDeleted,
        recordsDeleted,
        duration: Date.now() - startTime,
        status: 'success'
      };
    } catch (error) {
      return {
        jobName: 'cleanup-sessions',
        recordsProcessed: 0,
        recordsDeleted: 0,
        duration: Date.now() - startTime,
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Clean up old communications
   */
  private async cleanupOldCommunications(): Promise<CleanupJobResult> {
    const startTime = Date.now();
    
    try {
      // Only clean up successfully delivered communications older than 90 days
      const result = await db.execute(sql`
        DELETE FROM communications 
        WHERE sent_at < NOW() - INTERVAL '90 days'
        AND status = 'delivered'
      `);

      const recordsDeleted = (result as any).rowCount || 0;

      return {
        jobName: 'cleanup-communications',
        recordsProcessed: recordsDeleted,
        recordsDeleted,
        duration: Date.now() - startTime,
        status: 'success'
      };
    } catch (error) {
      return {
        jobName: 'cleanup-communications',
        recordsProcessed: 0,
        recordsDeleted: 0,
        duration: Date.now() - startTime,
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTemporaryFiles(): Promise<CleanupJobResult> {
    const startTime = Date.now();
    
    try {
      // This would clean up actual temporary files in production
      // For now, we'll simulate the cleanup
      
      return {
        jobName: 'cleanup-temp-files',
        recordsProcessed: 0,
        recordsDeleted: 0,
        duration: Date.now() - startTime,
        status: 'success'
      };
    } catch (error) {
      return {
        jobName: 'cleanup-temp-files',
        recordsProcessed: 0,
        recordsDeleted: 0,
        duration: Date.now() - startTime,
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Run database vacuum and analyze
   */
  private async runDatabaseVacuum(): Promise<CleanupJobResult> {
    const startTime = Date.now();
    
    try {
      // Run VACUUM ANALYZE on all tables
      const tables = ['deals', 'brokers', 'communications', 'users', 'sessions'];
      
      for (const table of tables) {
        await db.execute(sql.raw(`VACUUM ANALYZE ${table}`));
      }

      return {
        jobName: 'database-vacuum',
        recordsProcessed: tables.length,
        recordsDeleted: 0,
        duration: Date.now() - startTime,
        status: 'success'
      };
    } catch (error) {
      return {
        jobName: 'database-vacuum',
        recordsProcessed: 0,
        recordsDeleted: 0,
        duration: Date.now() - startTime,
        status: 'failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Get job status
   */
  getJobStatus(): Array<{ name: string; running: boolean; nextRun?: Date }> {
    return Array.from(this.jobs.entries()).map(([name, task]) => ({
      name,
      running: task.running || false,
      nextRun: (task as any).nextDate?.() || undefined
    }));
  }
}

export const cleanupJobManager = new CleanupJobManager();
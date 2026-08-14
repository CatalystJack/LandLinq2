import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';
import { sendNotificationEmail } from './emailService';
import { ObjectStorageService, objectStorageClient } from './objectStorage';
import { db } from './db';
import { sql } from 'drizzle-orm';

const ADMIN_EMAIL = 'jack@catalystcp.com';
const BACKUP_DIR = './backups/object-storage';

/**
 * Storage Monitor Service
 * Monitors object storage bucket for changes and implements backup protection
 * Uses DATABASE for persistence (not filesystem which resets on deployment)
 */
export class StorageMonitor {
  private currentBucketId: string = '';
  
  constructor() {
    this.extractCurrentBucketId();
  }

  /**
   * Extract bucket ID from PRIVATE_OBJECT_DIR env variable
   */
  private extractCurrentBucketId(): void {
    const privateDir = process.env.PRIVATE_OBJECT_DIR || '';
    if (privateDir) {
      const parts = privateDir.split('/');
      if (parts.length >= 2) {
        this.currentBucketId = parts[1]; // e.g., 'replit-objstore-cc2b262e-7372-40e0-9210-dcbe78d02ac1'
      }
    }
  }

  /**
   * Get the current bucket ID
   */
  getCurrentBucketId(): string {
    return this.currentBucketId;
  }

  /**
   * Load saved bucket ID from database (business_settings table)
   */
  async loadSavedBucketIdFromDb(): Promise<string | null> {
    try {
      const result = await db.execute(sql`
        SELECT bucket_id FROM business_settings LIMIT 1
      `);
      
      if (result.rows.length > 0 && result.rows[0]) {
        return (result.rows[0] as any).bucket_id || null;
      }
      return null;
    } catch (error) {
      console.error('[STORAGE-MONITOR] Error loading bucket ID from database:', error);
      return null;
    }
  }

  /**
   * Save current bucket ID to database (business_settings table)
   * Uses UPSERT pattern to handle both fresh databases and existing rows
   */
  async saveBucketIdToDb(): Promise<void> {
    try {
      // First check if bucket_id column exists, if not add it
      try {
        await db.execute(sql`
          ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS bucket_id TEXT
        `);
      } catch (e) {
        // Column might already exist
      }

      // Check if any rows exist in business_settings
      const existingRows = await db.execute(sql`
        SELECT id FROM business_settings LIMIT 1
      `);
      
      if (existingRows.rows.length > 0) {
        // Update existing row
        await db.execute(sql`
          UPDATE business_settings SET bucket_id = ${this.currentBucketId}
        `);
        console.log(`💾 [STORAGE-MONITOR] Updated bucket ID in database: ${this.currentBucketId}`);
      } else {
        // No rows exist - insert a new one with the bucket_id
        // Use minimal required fields for business_settings
        await db.execute(sql`
          INSERT INTO business_settings (bucket_id) VALUES (${this.currentBucketId})
        `);
        console.log(`💾 [STORAGE-MONITOR] Inserted initial bucket ID in database: ${this.currentBucketId}`);
      }
    } catch (error) {
      console.error('[STORAGE-MONITOR] Error saving bucket ID to database:', error);
    }
  }

  /**
   * Check if bucket ID has changed
   */
  async checkForBucketChange(): Promise<{ changed: boolean; oldId?: string; newId?: string }> {
    const savedBucketId = await this.loadSavedBucketIdFromDb();
    
    if (!savedBucketId) {
      console.log('📝 [STORAGE-MONITOR] No previous bucket ID found in database - saving current');
      await this.saveBucketIdToDb();
      return { changed: false };
    }

    if (savedBucketId !== this.currentBucketId) {
      console.log(`🚨 [STORAGE-MONITOR] BUCKET ID CHANGED!`);
      console.log(`   Old: ${savedBucketId}`);
      console.log(`   New: ${this.currentBucketId}`);
      return {
        changed: true,
        oldId: savedBucketId,
        newId: this.currentBucketId
      };
    }
    
    return { changed: false };
  }

  /**
   * Send alert email about bucket change
   */
  async sendBucketChangeAlert(oldId: string, newId: string): Promise<void> {
    const alertHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">⚠️ CRITICAL STORAGE ALERT</h1>
        </div>
        <div style="padding: 30px; background-color: #fef2f2; border: 2px solid #dc2626;">
          <h2 style="color: #dc2626; margin-top: 0;">Object Storage Bucket Changed</h2>
          <p style="color: #7f1d1d; font-size: 16px;">
            The object storage bucket ID has changed. This means <strong>all previously uploaded files may be inaccessible</strong>.
          </p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Previous Bucket ID:</strong></p>
            <code style="background-color: #fee2e2; padding: 5px 10px; border-radius: 4px; display: block; word-break: break-all;">${oldId}</code>
            
            <p style="margin: 20px 0 10px 0;"><strong>New Bucket ID:</strong></p>
            <code style="background-color: #dcfce7; padding: 5px 10px; border-radius: 4px; display: block; word-break: break-all;">${newId}</code>
          </div>
          
          <h3 style="color: #dc2626;">Immediate Actions Required:</h3>
          <ol style="color: #7f1d1d; line-height: 1.8;">
            <li>Check if any deal documents are now showing "File not found" errors</li>
            <li>If you have local backups of uploaded files, they can be re-uploaded</li>
            <li>Review the Analyst Dashboard for any broken document links</li>
            <li>Consider updating document URLs in the database if files can be recovered</li>
          </ol>
          
          <p style="color: #7f1d1d; font-size: 14px; margin-top: 30px;">
            <strong>Detected at:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          LandLinq Storage Monitor - Automated Alert
        </div>
      </div>
    `;

    await sendNotificationEmail({
      to: ADMIN_EMAIL,
      subject: '🚨 CRITICAL: Object Storage Bucket Changed - Files May Be Lost',
      html: alertHtml,
      type: 'system_alert',
      priority: 'urgent'
    });

    console.log(`📧 [STORAGE-MONITOR] Sent bucket change alert to ${ADMIN_EMAIL}`);
  }

  /**
   * Get list of all document URLs stored in deals
   */
  async getStoredDocumentUrls(): Promise<{ dealId: string; urls: string[] }[]> {
    try {
      const result = await db.execute(sql`
        SELECT id, document_urls, analyst_document_urls
        FROM deals
        WHERE document_urls IS NOT NULL OR analyst_document_urls IS NOT NULL
      `);

      const docsInfo: { dealId: string; urls: string[] }[] = [];
      
      for (const row of result.rows as any[]) {
        const urls: string[] = [];
        
        if (row.document_urls && Array.isArray(row.document_urls)) {
          urls.push(...row.document_urls);
        }
        if (row.analyst_document_urls && Array.isArray(row.analyst_document_urls)) {
          urls.push(...row.analyst_document_urls);
        }
        
        if (urls.length > 0) {
          docsInfo.push({ dealId: row.id, urls });
        }
      }
      
      return docsInfo;
    } catch (error) {
      console.error('[STORAGE-MONITOR] Error getting stored document URLs:', error);
      return [];
    }
  }

  /**
   * Check if stored files are accessible (health check)
   * Uses random sampling to avoid expired presigned URLs issues
   */
  async checkFileAccessibility(sampleSize: number = 5): Promise<{
    total: number;
    accessible: number;
    inaccessible: number;
    errors: string[];
  }> {
    const objectService = new ObjectStorageService();
    
    // Get all document URLs and filter for object storage paths (not presigned URLs)
    const allDocs = await this.getStoredDocumentUrls();
    const allUrls: string[] = [];
    
    for (const doc of allDocs) {
      for (const url of doc.urls) {
        // Only check internal object storage paths, not presigned HTTPS URLs
        if (url.startsWith('/replit-objstore-') || url.startsWith('.private/')) {
          allUrls.push(url);
        }
      }
    }

    if (allUrls.length === 0) {
      return { total: 0, accessible: 0, inaccessible: 0, errors: [] };
    }

    // Random sampling
    const shuffled = allUrls.sort(() => 0.5 - Math.random());
    const sampled = shuffled.slice(0, Math.min(sampleSize, shuffled.length));
    
    let accessible = 0;
    let inaccessible = 0;
    const errors: string[] = [];

    for (const url of sampled) {
      try {
        // Try to get file metadata only (not full download)
        await objectService.getObjectFile(url);
        accessible++;
      } catch (error) {
        inaccessible++;
        errors.push(`${url}: File not found`);
      }
    }

    return {
      total: allUrls.length,
      accessible,
      inaccessible,
      errors
    };
  }

  /**
   * Initialize the storage monitor - run on startup
   */
  async initialize(): Promise<void> {
    console.log('\n🔍 [STORAGE-MONITOR] Initializing storage monitor...');
    
    if (!this.currentBucketId) {
      console.log('⚠️ [STORAGE-MONITOR] No bucket ID found in environment - storage monitoring disabled');
      return;
    }

    console.log(`📦 [STORAGE-MONITOR] Current bucket ID: ${this.currentBucketId}`);

    // Check for bucket change
    const changeResult = await this.checkForBucketChange();
    
    if (changeResult.changed && changeResult.oldId && changeResult.newId) {
      console.log('🚨 [STORAGE-MONITOR] CRITICAL: Bucket ID changed since last startup!');
      
      // Send alert email
      await this.sendBucketChangeAlert(changeResult.oldId, changeResult.newId);
      
      // Update saved bucket ID after alerting
      await this.saveBucketIdToDb();
    } else {
      console.log('✅ [STORAGE-MONITOR] Bucket ID unchanged');
    }

    // Start periodic health check (every 6 hours)
    this.startPeriodicHealthCheck();
    
    console.log('✅ [STORAGE-MONITOR] Storage monitor initialized successfully');
  }

  /**
   * Start periodic file accessibility health check
   */
  private startPeriodicHealthCheck(): void {
    // Run every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('🔍 [STORAGE-MONITOR] Running periodic file health check...');
      
      try {
        const healthResult = await this.checkFileAccessibility(10);
        
        if (healthResult.inaccessible > 0 && healthResult.total > 0) {
          const accessibleCount = healthResult.accessible + healthResult.inaccessible;
          console.log(`⚠️ [STORAGE-MONITOR] ${healthResult.inaccessible}/${accessibleCount} sampled files are inaccessible`);
          
          // If more than 50% of sampled files are inaccessible, send alert
          const accessRate = healthResult.accessible / accessibleCount;
          if (accessRate < 0.5) {
            await this.sendFileAccessAlert(healthResult);
          }
        } else if (healthResult.total === 0) {
          console.log(`ℹ️ [STORAGE-MONITOR] No object storage files to check (all URLs may be presigned)`);
        } else {
          console.log(`✅ [STORAGE-MONITOR] All ${healthResult.accessible} sampled files are accessible`);
        }
      } catch (error) {
        console.error('❌ [STORAGE-MONITOR] Health check failed:', error);
      }
    }, {
      timezone: "America/New_York"
    });

    console.log('📅 [STORAGE-MONITOR] Periodic health check scheduled (every 6 hours)');
  }

  /**
   * Send alert about file access issues
   */
  private async sendFileAccessAlert(healthResult: {
    total: number;
    accessible: number;
    inaccessible: number;
    errors: string[];
  }): Promise<void> {
    const alertHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">⚠️ FILE ACCESS WARNING</h1>
        </div>
        <div style="padding: 30px; background-color: #fffbeb; border: 2px solid #f59e0b;">
          <h2 style="color: #b45309; margin-top: 0;">Multiple Files Inaccessible</h2>
          <p style="color: #78350f; font-size: 16px;">
            The storage health check detected that multiple uploaded files cannot be accessed.
          </p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Total stored files:</strong> ${healthResult.total}</p>
            <p><strong>Sampled files checked:</strong> ${healthResult.accessible + healthResult.inaccessible}</p>
            <p style="color: #059669;"><strong>Accessible:</strong> ${healthResult.accessible}</p>
            <p style="color: #dc2626;"><strong>Inaccessible:</strong> ${healthResult.inaccessible}</p>
          </div>
          
          <p style="color: #78350f; font-size: 14px; margin-top: 30px;">
            <strong>Detected at:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST
          </p>
        </div>
      </div>
    `;

    await sendNotificationEmail({
      to: ADMIN_EMAIL,
      subject: '⚠️ WARNING: File Access Issues Detected',
      html: alertHtml,
      type: 'system_alert',
      priority: 'high'
    });
  }
}

/**
 * File Backup Service
 * Creates nightly backups of all deal documents to local directory
 * NOTE: Local backups are lost on container reset - for critical files,
 * recommend users download copies externally
 */
export class FileBackupService {
  private backupDir: string = BACKUP_DIR;
  private objectService: ObjectStorageService;

  constructor() {
    this.objectService = new ObjectStorageService();
  }

  /**
   * Initialize backup service - create backup directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`📁 [FILE-BACKUP] Backup directory ready: ${this.backupDir}`);
    } catch (error) {
      console.error('[FILE-BACKUP] Failed to create backup directory:', error);
    }
  }

  /**
   * List all files in object storage using the object storage client
   */
  async listObjectStorageFiles(): Promise<string[]> {
    try {
      if (!objectStorageClient) {
        console.log('[FILE-BACKUP] Object storage client not available');
        return [];
      }
      
      // List files in the .private/deals directory
      const privateDir = process.env.PRIVATE_OBJECT_DIR || '.private';
      const files: string[] = [];
      
      // Try to list files using the bucket API
      const [bucketFiles] = await objectStorageClient.getFiles({ prefix: privateDir });
      
      for (const file of bucketFiles) {
        if (file.name) {
          files.push(file.name);
        }
      }
      
      console.log(`📦 [FILE-BACKUP] Found ${files.length} files in object storage`);
      return files;
    } catch (error) {
      console.error('[FILE-BACKUP] Error listing object storage files:', error);
      return [];
    }
  }

  /**
   * Run backup job - download all accessible files and save locally
   */
  async runBackup(): Promise<{
    total: number;
    backed: number;
    failed: number;
    errors: string[];
  }> {
    console.log('\n📦 [FILE-BACKUP] Starting nightly file backup...');
    
    const dateStr = new Date().toISOString().split('T')[0];
    const backupPath = path.join(this.backupDir, dateStr);
    
    await fs.mkdir(backupPath, { recursive: true });
    
    // Use object storage listing API instead of database URLs
    const files = await this.listObjectStorageFiles();
    console.log(`📦 [FILE-BACKUP] Found ${files.length} files to backup`);
    
    if (files.length === 0) {
      console.log('ℹ️ [FILE-BACKUP] No files to backup');
      return { total: 0, backed: 0, failed: 0, errors: [] };
    }
    
    let backed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const filePath of files) {
      try {
        // Get the file from object storage using internal path
        const file = await this.objectService.getObjectFile(filePath);
        const [content] = await file.download();
        
        // Extract filename and preserve directory structure
        const filename = path.basename(filePath);
        const destPath = path.join(backupPath, filename);
        
        await fs.writeFile(destPath, content);
        backed++;
        
      } catch (error) {
        failed++;
        errors.push(`${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Create backup manifest
    const manifest = {
      date: dateStr,
      timestamp: new Date().toISOString(),
      total: files.length,
      backed,
      failed,
      errors: errors.slice(0, 10) // Only store first 10 errors
    };
    
    await fs.writeFile(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log(`✅ [FILE-BACKUP] Backup complete: ${backed}/${files.length} files backed up`);
    if (failed > 0) {
      console.log(`⚠️ [FILE-BACKUP] ${failed} files failed to backup`);
    }

    // Clean up old backups (keep last 7 days)
    await this.cleanupOldBackups(7);

    return { total: files.length, backed, failed, errors };
  }

  /**
   * Clean up old backups (keep last N days)
   */
  async cleanupOldBackups(keepDays: number): Promise<void> {
    try {
      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirDate = new Date(entry.name);
          if (!isNaN(dirDate.getTime()) && dirDate < cutoffDate) {
            const dirPath = path.join(this.backupDir, entry.name);
            await fs.rm(dirPath, { recursive: true });
            console.log(`🗑️ [FILE-BACKUP] Removed old backup: ${entry.name}`);
          }
        }
      }
    } catch (error) {
      console.error('[FILE-BACKUP] Error cleaning up old backups:', error);
    }
  }

  /**
   * Start nightly backup scheduler
   */
  startNightlyBackup(): void {
    // Run at 2 AM Eastern every night
    cron.schedule('0 2 * * *', async () => {
      console.log('\n🌙 [FILE-BACKUP] Running scheduled nightly backup...');
      
      try {
        const result = await this.runBackup();
        
        // If more than 10% of files failed, send alert
        if (result.total > 0 && result.failed / result.total > 0.1) {
          await this.sendBackupAlert(result);
        }
      } catch (error) {
        console.error('❌ [FILE-BACKUP] Nightly backup failed:', error);
      }
    }, {
      timezone: "America/New_York"
    });

    console.log('📅 [FILE-BACKUP] Nightly backup scheduled (2 AM EST)');
  }

  /**
   * Send backup failure alert
   */
  private async sendBackupAlert(result: {
    total: number;
    backed: number;
    failed: number;
    errors: string[];
  }): Promise<void> {
    const alertHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">⚠️ BACKUP WARNING</h1>
        </div>
        <div style="padding: 30px; background-color: #fffbeb; border: 2px solid #f59e0b;">
          <h2 style="color: #b45309; margin-top: 0;">Nightly File Backup Issues</h2>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Total files:</strong> ${result.total}</p>
            <p style="color: #059669;"><strong>Successfully backed up:</strong> ${result.backed}</p>
            <p style="color: #dc2626;"><strong>Failed:</strong> ${result.failed}</p>
          </div>
          
          ${result.errors.length > 0 ? `
          <h3 style="color: #b45309;">Sample Errors:</h3>
          <ul style="color: #78350f; font-size: 12px;">
            ${result.errors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}
          </ul>
          ` : ''}
          
          <p style="color: #78350f; font-size: 14px; margin-top: 30px;">
            <strong>Backup ran at:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST
          </p>
        </div>
      </div>
    `;

    await sendNotificationEmail({
      to: ADMIN_EMAIL,
      subject: '⚠️ File Backup Issues Detected',
      html: alertHtml,
      type: 'system_alert',
      priority: 'high'
    });
  }
}

// Create singleton instances
export const storageMonitor = new StorageMonitor();
export const fileBackupService = new FileBackupService();

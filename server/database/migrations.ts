import { sql } from 'drizzle-orm';
import { db } from '../db';
import fs from 'fs/promises';
import path from 'path';

interface Migration {
  id: string;
  name: string;
  up: (db: any) => Promise<void>;
  down?: (db: any) => Promise<void>;
  appliedAt?: Date;
}

interface MigrationRecord {
  id: string;
  name: string;
  appliedAt: Date;
  checksum: string;
}

/**
 * Database Migration System
 * Provides version control for database schema changes
 */
export class MigrationManager {
  private migrationsPath: string;
  private migrations: Migration[] = [];

  constructor(migrationsPath = './migrations') {
    this.migrationsPath = path.resolve(migrationsPath);
  }

  /**
   * Initialize migration system
   */
  async initialize(): Promise<void> {
    // Create migrations table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL
      );
    `);

    // Create migrations directory if it doesn't exist
    try {
      await fs.access(this.migrationsPath);
    } catch {
      await fs.mkdir(this.migrationsPath, { recursive: true });
    }

    console.log('✅ Migration system initialized');
  }

  /**
   * Register a migration
   */
  registerMigration(migration: Migration): void {
    this.migrations.push(migration);
  }

  /**
   * Create a new migration file
   */
  async createMigration(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `${timestamp}_${name.replace(/\s+/g, '_')}.ts`;
    const filePath = path.join(this.migrationsPath, fileName);

    const template = `import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export const migration = {
  id: '${timestamp}_${name.replace(/\s+/g, '_')}',
  name: '${name}',
  
  async up(db: PostgresJsDatabase<any>) {
    // Add your migration logic here
    // Example:
    // await db.execute(sql\`ALTER TABLE deals ADD COLUMN new_field VARCHAR(255)\`);
  },
  
  async down(db: PostgresJsDatabase<any>) {
    // Add rollback logic here (optional)
    // Example:
    // await db.execute(sql\`ALTER TABLE deals DROP COLUMN new_field\`);
  }
};
`;

    await fs.writeFile(filePath, template);
    console.log(`✅ Migration created: ${fileName}`);
    return filePath;
  }

  /**
   * Load migrations from files
   */
  async loadMigrations(): Promise<void> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.js'));

      for (const file of migrationFiles) {
        try {
          const filePath = path.join(this.migrationsPath, file);
          const { migration } = await import(filePath);
          if (migration) {
            this.registerMigration(migration);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to load migration ${file}:`, error);
        }
      }

      // Sort migrations by ID (timestamp)
      this.migrations.sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      console.warn('⚠️ No migrations directory found or accessible');
    }
  }

  /**
   * Get applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      const result = await db.execute(sql`
        SELECT id, name, applied_at, checksum 
        FROM migrations 
        ORDER BY applied_at
      `);
      // Handle both array and rows property from different database drivers
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      return rows as MigrationRecord[];
    } catch (error) {
      // If migrations table doesn't exist, return empty array
      if ((error as any).code === '42P01') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    const appliedIds = new Set(applied.map(m => m.id));
    
    return this.migrations.filter(m => !appliedIds.has(m.id));
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migration: Migration): Promise<void> {
    console.log(`🔄 Applying migration: ${migration.name}`);
    
    try {
      // Start transaction
      await db.transaction(async (tx) => {
        // Apply the migration
        await migration.up(tx);
        
        // Record the migration
        await tx.execute(sql`
          INSERT INTO migrations (id, name, applied_at, checksum)
          VALUES (${migration.id}, ${migration.name}, NOW(), ${this.calculateChecksum(migration)})
        `);
      });
      
      console.log(`✅ Applied migration: ${migration.name}`);
    } catch (error) {
      console.error(`❌ Failed to apply migration ${migration.name}:`, error);
      throw error;
    }
  }

  /**
   * Apply all pending migrations
   */
  async migrate(): Promise<void> {
    await this.loadMigrations();
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`🔄 Applying ${pending.length} pending migrations...`);
    
    for (const migration of pending) {
      await this.applyMigration(migration);
    }
    
    console.log('✅ All migrations applied successfully');
  }

  /**
   * Rollback migrations
   */
  async rollback(steps: number = 1): Promise<void> {
    const applied = await this.getAppliedMigrations();
    const toRollback = applied.slice(-steps).reverse();
    
    if (toRollback.length === 0) {
      console.log('✅ No migrations to rollback');
      return;
    }

    console.log(`🔄 Rolling back ${toRollback.length} migrations...`);
    
    for (const record of toRollback) {
      const migration = this.migrations.find(m => m.id === record.id);
      
      if (!migration || !migration.down) {
        console.warn(`⚠️ Cannot rollback migration ${record.name}: no down function`);
        continue;
      }

      try {
        console.log(`🔄 Rolling back: ${migration.name}`);
        
        await db.transaction(async (tx) => {
          // Rollback the migration
          await migration.down!(tx);
          
          // Remove the migration record
          await tx.execute(sql`
            DELETE FROM migrations WHERE id = ${migration.id}
          `);
        });
        
        console.log(`✅ Rolled back: ${migration.name}`);
      } catch (error) {
        console.error(`❌ Failed to rollback migration ${migration.name}:`, error);
        throw error;
      }
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    applied: MigrationRecord[];
    pending: Migration[];
    total: number;
  }> {
    await this.loadMigrations();
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    
    return {
      applied,
      pending,
      total: this.migrations.length
    };
  }

  /**
   * Calculate migration checksum for integrity verification
   */
  private calculateChecksum(migration: Migration): string {
    const content = migration.up.toString() + (migration.down?.toString() || '');
    // Simple hash calculation without crypto dependency
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).slice(0, 16);
  }

  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<boolean> {
    const applied = await this.getAppliedMigrations();
    let isValid = true;
    
    for (const record of applied) {
      const migration = this.migrations.find(m => m.id === record.id);
      if (!migration) {
        console.warn(`⚠️ Applied migration not found in code: ${record.name}`);
        isValid = false;
        continue;
      }
      
      const currentChecksum = this.calculateChecksum(migration);
      if (currentChecksum !== record.checksum) {
        console.warn(`⚠️ Migration checksum mismatch: ${record.name}`);
        isValid = false;
      }
    }
    
    return isValid;
  }
}

// Export singleton instance
export const migrationManager = new MigrationManager();

// Built-in migrations for initial schema optimization
export const initialMigrations: Migration[] = [
  {
    id: '2025-08-30_001_optimize_indexes',
    name: 'Add performance indexes',
    async up(db) {
      // Create indexes for better query performance
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_classification ON deals(classification)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_broker_id ON deals(broker_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_asking_price ON deals(asking_price)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_property_size ON deals("size_acres")`);
      
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_brokers_email ON brokers(email)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_brokers_active ON brokers(is_active)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_brokers_created_at ON brokers(created_at)`);
      
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_communications_broker_id ON communications(broker_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_communications_sent_at ON communications(sent_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_communications_type ON communications(type)`);
      
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`);
    },
    async down(db) {
      // Drop the indexes if needed
      await db.execute(sql`DROP INDEX IF EXISTS idx_deals_status`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_deals_classification`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_deals_created_at`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_deals_broker_id`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_deals_asking_price`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_deals_property_size`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_brokers_email`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_brokers_active`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_brokers_created_at`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_communications_broker_id`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_communications_sent_at`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_communications_type`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_users_email`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_users_created_at`);
    }
  },
  
  {
    id: '2025-08-30_002_add_archival_fields',
    name: 'Add fields for data archiving',
    async up(db) {
      // Add archiving fields to main tables
      await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`);
      await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
      await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS archive_reason VARCHAR(255)`);
      
      await db.execute(sql`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`);
      await db.execute(sql`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
      
      await db.execute(sql`ALTER TABLE communications ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`);
      await db.execute(sql`ALTER TABLE communications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
      
      // Create indexes for archival queries
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_deals_archived ON deals(is_archived, archived_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_brokers_archived ON brokers(is_archived, archived_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_communications_archived ON communications(is_archived, archived_at)`);
    },
    async down(db) {
      await db.execute(sql`DROP INDEX IF EXISTS idx_deals_archived`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_brokers_archived`);
      await db.execute(sql`DROP INDEX IF EXISTS idx_communications_archived`);
      
      await db.execute(sql`ALTER TABLE deals DROP COLUMN IF EXISTS is_archived`);
      await db.execute(sql`ALTER TABLE deals DROP COLUMN IF EXISTS archived_at`);
      await db.execute(sql`ALTER TABLE deals DROP COLUMN IF EXISTS archive_reason`);
      await db.execute(sql`ALTER TABLE brokers DROP COLUMN IF EXISTS is_archived`);
      await db.execute(sql`ALTER TABLE brokers DROP COLUMN IF EXISTS archived_at`);
      await db.execute(sql`ALTER TABLE communications DROP COLUMN IF EXISTS is_archived`);
      await db.execute(sql`ALTER TABLE communications DROP COLUMN IF EXISTS archived_at`);
    }
  },

  {
    id: '2026-09-11_003_add_internal_sales_pipeline',
    name: 'Add internal sales pipeline',
    async up(db) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sales_pipeline_stages (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR NOT NULL,
          sort_order INTEGER NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sales_prospects (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          company_name VARCHAR NOT NULL,
          website VARCHAR,
          industry VARCHAR,
          contact_name VARCHAR,
          contact_email VARCHAR,
          contact_phone VARCHAR,
          stage_id VARCHAR NOT NULL REFERENCES sales_pipeline_stages(id),
          owner_id VARCHAR REFERENCES users(id),
          estimated_value NUMERIC,
          next_follow_up_at TIMESTAMP,
          last_contacted_at TIMESTAMP,
          notes TEXT,
          created_by VARCHAR REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sales_prospect_activities (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          prospect_id VARCHAR NOT NULL REFERENCES sales_prospects(id) ON DELETE CASCADE,
          type VARCHAR NOT NULL,
          subject VARCHAR,
          body TEXT,
          metadata JSONB,
          created_by VARCHAR REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sales_prospect_documents (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          prospect_id VARCHAR NOT NULL REFERENCES sales_prospects(id) ON DELETE CASCADE,
          name VARCHAR NOT NULL,
          document_type VARCHAR DEFAULT 'agreement',
          status VARCHAR NOT NULL DEFAULT 'draft',
          url TEXT,
          sent_at TIMESTAMP,
          signed_at TIMESTAMP,
          created_by VARCHAR REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sales_pipeline_email_templates (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR NOT NULL,
          subject VARCHAR NOT NULL,
          body TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_by VARCHAR REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sales_prospect_emails (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          prospect_id VARCHAR NOT NULL REFERENCES sales_prospects(id) ON DELETE CASCADE,
          template_id VARCHAR REFERENCES sales_pipeline_email_templates(id),
          to_email VARCHAR NOT NULL,
          subject VARCHAR NOT NULL,
          body TEXT NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'sent',
          sent_by VARCHAR REFERENCES users(id),
          sent_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS sales_prospects_stage_idx ON sales_prospects(stage_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS sales_prospects_follow_up_idx ON sales_prospects(next_follow_up_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS sales_activities_prospect_idx ON sales_prospect_activities(prospect_id, created_at)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS sales_documents_prospect_idx ON sales_prospect_documents(prospect_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS sales_emails_prospect_idx ON sales_prospect_emails(prospect_id, sent_at)`);
      await db.execute(sql`
        INSERT INTO sales_pipeline_stages (name, sort_order)
        SELECT stage.name, stage.sort_order
        FROM (VALUES
          ('New Lead', 1),
          ('Discovery', 2),
          ('Demo / Evaluation', 3),
          ('Proposal', 4),
          ('Negotiation', 5),
          ('Closed Won', 6),
          ('Closed Lost', 7)
        ) AS stage(name, sort_order)
        WHERE NOT EXISTS (SELECT 1 FROM sales_pipeline_stages)
      `);
    },
    async down(db) {
      await db.execute(sql`DROP TABLE IF EXISTS sales_prospect_emails`);
      await db.execute(sql`DROP TABLE IF EXISTS sales_pipeline_email_templates`);
      await db.execute(sql`DROP TABLE IF EXISTS sales_prospect_documents`);
      await db.execute(sql`DROP TABLE IF EXISTS sales_prospect_activities`);
      await db.execute(sql`DROP TABLE IF EXISTS sales_prospects`);
      await db.execute(sql`DROP TABLE IF EXISTS sales_pipeline_stages`);
    }
  },
  {
    id: '2026-09-11_004_add_developer_outreach_ai_conversations',
    name: 'Add Investment Company outreach AI conversations',
    async up(db) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS developer_outreach_ai_conversations (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          developer_profile_id VARCHAR NOT NULL REFERENCES developer_profiles(id) ON DELETE CASCADE,
          campaign_id VARCHAR NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
          step_key VARCHAR NOT NULL DEFAULT '0',
          messages JSONB NOT NULL DEFAULT '[]'::jsonb,
          suggested_subject TEXT,
          suggested_content TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT developer_outreach_ai_conversations_scope_unique
            UNIQUE (developer_profile_id, campaign_id, step_key)
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS developer_outreach_ai_conversations_campaign_idx
        ON developer_outreach_ai_conversations(campaign_id)
      `);
    },
    async down(db) {
      await db.execute(sql`DROP TABLE IF EXISTS developer_outreach_ai_conversations`);
    }
  }
];

// Register initial migrations
initialMigrations.forEach(migration => {
  migrationManager.registerMigration(migration);
});
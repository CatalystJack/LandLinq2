import { sql } from "drizzle-orm";
import { db } from "./db";

export async function ensureCrmContactImportSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_contact_import_jobs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_user_id VARCHAR NOT NULL,
      file_sha256 VARCHAR(64) NOT NULL,
      total_rows INTEGER NOT NULL CHECK (total_rows > 0 AND total_rows <= 100000),
      next_batch_index INTEGER NOT NULL DEFAULT 0,
      inserted_count INTEGER NOT NULL DEFAULT 0,
      updated_count INTEGER NOT NULL DEFAULT 0,
      status VARCHAR NOT NULL DEFAULT 'processing',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS crm_contact_import_jobs_owner_file_idx
    ON crm_contact_import_jobs(owner_user_id, file_sha256, updated_at DESC)
  `);
}

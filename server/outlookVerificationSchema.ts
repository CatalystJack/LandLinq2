import { sql } from "drizzle-orm";
import { db } from "./db";

let ensureOutlookVerificationPromise: Promise<void> | undefined;

export function ensureOutlookVerificationSchema(): Promise<void> {
  if (!ensureOutlookVerificationPromise) {
    // Keep this column out of the Drizzle sender schema because existing
    // select-all sender paths can run before the database manager initializes.
    ensureOutlookVerificationPromise = db.execute(sql`
      ALTER TABLE outreach_senders
      ADD COLUMN IF NOT EXISTS microsoft_identity_verified BOOLEAN NOT NULL DEFAULT FALSE
    `).then(() => undefined).catch((error) => {
      ensureOutlookVerificationPromise = undefined;
      throw error;
    });
  }

  return ensureOutlookVerificationPromise;
}

/**
 * Shared database-backed kill switch for every automatic email-to-deal ingress.
 * The hardcoded constant is only a fail-closed fallback if the database cannot
 * be read; normal operation always reads the active business_settings row.
 */
import { eq } from "drizzle-orm";
import { businessSettings } from "@shared/schema";
import { db } from "./db";

export const EMAIL_SCRAPING_ENABLED = false;

export async function getEmailScrapingEnabledFromDatabase(): Promise<boolean> {
  const [settings] = await db
    .select({ enabled: businessSettings.emailScrapingEnabled })
    .from(businessSettings)
    .where(eq(businessSettings.isActive, true))
    .limit(1);

  return settings?.enabled === true;
}

export async function getEmailScrapingEnabled(): Promise<boolean> {
  try {
    return await getEmailScrapingEnabledFromDatabase();
  } catch {
    console.error("[EMAIL-AUTOMATION] Could not read the database toggle; using the disabled fallback.");
    return EMAIL_SCRAPING_ENABLED;
  }
}
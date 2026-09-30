import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { backgroundJobs, emailIntakePollHealth } from '../shared/schema.js';
import { db } from './db.js';

export const DEALS_IMAP_POLL_HEALTH_KEY = 'deals_mailbox';
export const DEALS_IMAP_STALE_AFTER_MS = 15 * 60 * 1000;
export const DEALS_IMAP_STALE_AFTER_MINUTES = 15;

export const DEALS_IMAP_FAILURE_CATEGORIES = [
  'authentication',
  'connection',
  'mailbox_access',
  'message_processing',
  'unknown',
  'automation_disabled',
] as const;

export type DealsImapFailureCategory = typeof DEALS_IMAP_FAILURE_CATEGORIES[number];
export type DealsImapPollHealthState = 'not_scheduled' | 'disabled' | 'starting' | 'healthy' | 'failed' | 'stale';

type PollFailureStage = 'connect' | 'mailbox';
let dealsImapPollHealthWatchdog: NodeJS.Timeout | undefined;

function safeFailureCategory(value: string | null | undefined): DealsImapFailureCategory | null {
  if (!value) return null;
  return DEALS_IMAP_FAILURE_CATEGORIES.includes(value as DealsImapFailureCategory)
    ? value as DealsImapFailureCategory
    : 'unknown';
}

export function classifyDealsImapPollFailure(
  error: unknown,
  stage: PollFailureStage = 'connect',
): DealsImapFailureCategory {
  const errorRecord = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const explicitCategory = errorRecord.pollFailureCategory;
  if (DEALS_IMAP_FAILURE_CATEGORIES.includes(explicitCategory as DealsImapFailureCategory)
      && explicitCategory !== 'automation_disabled') {
    return explicitCategory as DealsImapFailureCategory;
  }

  const errorText = [
    errorRecord.code,
    errorRecord.name,
    errorRecord.message,
    typeof error === 'string' ? error : '',
  ].map(value => String(value || '')).join(' ').toLowerCase();

  if (/auth|login|credential|password|not configured|unauthori[sz]ed/.test(errorText)) {
    return 'authentication';
  }
  if (/econn|etimedout|timeout|enotfound|eai_again|socket|tls|network|connection reset/.test(errorText)) {
    return 'connection';
  }
  return stage === 'mailbox' ? 'mailbox_access' : 'unknown';
}

function asTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeDealsImapPollHealthState(input: {
  now: Date;
  monitoringStartedAt: Date | string | null;
  lastAttemptAt: Date | string | null;
  lastSuccessfulPollAt: Date | string | null;
  failureCategory: string | null;
  automationEnabled: boolean;
  schedulerActive: boolean;
  schedulerExpected: boolean;
}): DealsImapPollHealthState {
  if (!input.automationEnabled) return 'disabled';
  if (!input.schedulerActive) return input.schedulerExpected ? 'failed' : 'not_scheduled';
  if (!input.lastAttemptAt) return 'starting';

  const monitorStart = asTime(input.monitoringStartedAt);
  const lastSuccess = asTime(input.lastSuccessfulPollAt);
  const staleBaseline = Math.max(monitorStart ?? 0, lastSuccess ?? 0);
  if (staleBaseline > 0 && input.now.getTime() - staleBaseline >= DEALS_IMAP_STALE_AFTER_MS) {
    return 'stale';
  }
  if (input.failureCategory && input.failureCategory !== 'automation_disabled') return 'failed';
  return 'healthy';
}

export function startDealsImapPollHealthWatchdog(intervalMs: number): void {
  if (dealsImapPollHealthWatchdog) return;

  const checkHealth = async () => {
    try {
      const { getEmailScrapingEnabled } = await import('./emailAutomationConfig.js');
      if (!(await getEmailScrapingEnabled())) return;
      await queueDealsImapPollHealthAlertIfStale(new Date());
    } catch {
      console.error('[IMAP-DEALS] Mailbox poll health watchdog could not run.');
    }
  };

  dealsImapPollHealthWatchdog = setInterval(checkHealth, intervalMs);
  dealsImapPollHealthWatchdog.unref?.();
  void checkHealth();
}

async function ensureStatusRow(executor: any, now: Date): Promise<void> {
  await executor.insert(emailIntakePollHealth)
    .values({ singletonKey: DEALS_IMAP_POLL_HEALTH_KEY, monitoringStartedAt: now })
    .onConflictDoNothing();
}

export async function initializeDealsImapPollHealth(now = new Date()): Promise<void> {
  await ensureStatusRow(db, now);
}

export async function recordDealsImapPollAttempt(now = new Date()): Promise<void> {
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${DEALS_IMAP_POLL_HEALTH_KEY}))`);
    await ensureStatusRow(tx, now);
    const [current] = await tx.select().from(emailIntakePollHealth)
      .where(eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY)).limit(1);
    const wasDisabled = current?.failureCategory === 'automation_disabled';
    await tx.update(emailIntakePollHealth).set({
      lastAttemptAt: now,
      monitoringStartedAt: wasDisabled ? now : (current?.monitoringStartedAt || now),
      failureCategory: wasDisabled ? null : current?.failureCategory,
      updatedAt: now,
    }).where(eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY));
  });
}

export async function recordDealsImapPollDisabled(now = new Date()): Promise<void> {
  await ensureStatusRow(db, now);
  await db.update(emailIntakePollHealth).set({
    lastAttemptAt: now,
    failureCategory: 'automation_disabled',
    updatedAt: now,
  }).where(eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY));
}

export async function recordDealsImapPollFailure(error: unknown, now = new Date()): Promise<void> {
  const category = classifyDealsImapPollFailure(error);
  await ensureStatusRow(db, now);
  await db.update(emailIntakePollHealth).set({
    failureCategory: category,
    updatedAt: now,
  }).where(eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY));
}

export async function recordDealsImapPollSuccess(
  result: { errors: number; deferred: number; markReadFailures: number },
  now = new Date(),
): Promise<void> {
  const hadMessageIssues = result.errors > 0 || result.deferred > 0 || result.markReadFailures > 0;
  await ensureStatusRow(db, now);
  await db.update(emailIntakePollHealth).set({
    lastSuccessfulPollAt: now,
    failureCategory: hadMessageIssues ? 'message_processing' : null,
    updatedAt: now,
  }).where(eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY));
}

/**
 * Queue exactly one durable alert for each continuous stale period. A successful
 * poll ends that period; if polling later goes stale, it receives a new incident.
 */
export async function queueDealsImapPollHealthAlertIfStale(now = new Date()): Promise<boolean> {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${DEALS_IMAP_POLL_HEALTH_KEY}))`);
    await ensureStatusRow(tx, now);
    const [current] = await tx.select().from(emailIntakePollHealth)
      .where(eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY)).limit(1);
    if (!current) return false;
    if (current.failureCategory === 'automation_disabled') return false;

    const monitorStart = current.monitoringStartedAt?.getTime() || 0;
    const lastSuccess = current.lastSuccessfulPollAt?.getTime() || 0;
    const staleBaseline = Math.max(monitorStart, lastSuccess);
    if (!staleBaseline || now.getTime() - staleBaseline < DEALS_IMAP_STALE_AFTER_MS) return false;

    const incidentRecovered = Boolean(
      current.alertRaisedAt &&
      current.lastSuccessfulPollAt &&
      current.lastSuccessfulPollAt.getTime() > current.alertRaisedAt.getTime(),
    );
    const activeIncident = Boolean(current.alertIncidentId && !incidentRecovered);
    if (activeIncident && (current.alertClaimed || current.alertSentAt)) return false;

    const incidentId = activeIncident ? current.alertIncidentId! : randomUUID();
    const raisedAt = activeIncident ? (current.alertRaisedAt || now) : now;
    await tx.update(emailIntakePollHealth).set({
      alertIncidentId: incidentId,
      alertRaisedAt: raisedAt,
      alertClaimed: true,
      alertSentAt: null,
      updatedAt: now,
    }).where(eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY));

    await tx.insert(backgroundJobs).values({
      jobType: 'email_intake_poll_health_alert',
      payload: {
        incidentId,
        raisedAt: raisedAt.toISOString(),
        lastAttemptAt: current.lastAttemptAt?.toISOString() || null,
        lastSuccessfulPollAt: current.lastSuccessfulPollAt?.toISOString() || null,
        failureCategory: safeFailureCategory(current.failureCategory),
      },
      status: 'pending',
      priority: 1,
      maxAttempts: 5,
      scheduledFor: now,
    });
    return true;
  });
}

export async function processClaimedDealsImapPollHealthAlert(incidentId: string): Promise<{ sent: boolean; stale?: boolean }> {
  const [current] = await db.select().from(emailIntakePollHealth)
    .where(eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY)).limit(1);
  if (!current || current.alertIncidentId !== incidentId) return { sent: false, stale: true };
  if (current.alertSentAt) return { sent: true };

  try {
    const { sendNotificationEmail } = await import('./emailService.js');
    const category = safeFailureCategory(current.failureCategory) || 'unknown';
    const sent = await sendNotificationEmail({
      to: 'jack@apexresi.com',
      subject: 'Deal email mailbox polling needs attention',
      text: [
        `No successful deal-mailbox poll has completed for at least ${DEALS_IMAP_STALE_AFTER_MINUTES} minutes.`,
        `Last attempt: ${current.lastAttemptAt?.toISOString() || 'not recorded'}.`,
        `Last successful poll: ${current.lastSuccessfulPollAt?.toISOString() || 'none recorded'}.`,
        `Failure category: ${category}.`,
        'The Email Intake admin screen has the latest poll health status.',
      ].join('\n'),
      type: 'system_alert',
      priority: 'urgent',
    });
    if (!sent) throw new Error('Email delivery was not accepted');

    await db.update(emailIntakePollHealth).set({
      alertSentAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY),
      eq(emailIntakePollHealth.alertIncidentId, incidentId),
      isNull(emailIntakePollHealth.alertSentAt),
    ));
    return { sent: true };
  } catch {
    // Keep provider diagnostics and mailbox configuration out of job logs.
    throw new Error('Deal email poll health alert delivery failed');
  }
}

export async function releaseDealsImapPollHealthAlertClaim(incidentId: string): Promise<void> {
  await db.update(emailIntakePollHealth).set({
    alertClaimed: false,
    updatedAt: new Date(),
  }).where(and(
    eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY),
    eq(emailIntakePollHealth.alertIncidentId, incidentId),
    isNull(emailIntakePollHealth.alertSentAt),
  ));
}

export async function getDealsImapPollHealthStatus(input: {
  automationEnabled: boolean;
  schedulerActive: boolean;
  schedulerExpected: boolean;
  now?: Date;
}) {
  const now = input.now || new Date();
  await ensureStatusRow(db, now);
  const [current] = await db.select().from(emailIntakePollHealth)
    .where(eq(emailIntakePollHealth.singletonKey, DEALS_IMAP_POLL_HEALTH_KEY)).limit(1);
  if (!current) throw new Error('Mailbox poll health status is unavailable');

  return {
    state: computeDealsImapPollHealthState({
      now,
      monitoringStartedAt: current.monitoringStartedAt,
      lastAttemptAt: current.lastAttemptAt,
      lastSuccessfulPollAt: current.lastSuccessfulPollAt,
      failureCategory: safeFailureCategory(current.failureCategory),
      automationEnabled: input.automationEnabled,
      schedulerActive: input.schedulerActive,
      schedulerExpected: input.schedulerExpected,
    }),
    monitoringStartedAt: current.monitoringStartedAt,
    lastAttemptAt: current.lastAttemptAt,
    lastSuccessfulPollAt: current.lastSuccessfulPollAt,
    failureCategory: safeFailureCategory(current.failureCategory),
    staleAfterMinutes: DEALS_IMAP_STALE_AFTER_MINUTES,
    alertRaisedAt: current.alertRaisedAt,
    alertSentAt: current.alertSentAt,
    schedulerActive: input.schedulerActive,
    schedulerExpected: input.schedulerExpected,
    automationEnabled: input.automationEnabled,
  };
}
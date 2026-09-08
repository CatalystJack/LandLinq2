import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from './db.js';
import { sendNotificationEmail } from './emailService.js';
import { backgroundJobs, emailIntakeQueue, emailIntakeVolumeAlertState } from '../shared/schema.js';

export const EMAIL_INTAKE_VOLUME_THRESHOLD = 20;
export const EMAIL_INTAKE_VOLUME_WINDOW_MS = 60 * 60 * 1000;
const STATE_KEY = 'automated_email_intake_60_minute';

export function isVolumeThresholdExceeded(processedCount: number): boolean {
  return processedCount > EMAIL_INTAKE_VOLUME_THRESHOLD;
}

export function volumeAlertSubject(processedCount: number): string {
  return `URGENT: Automated email intake volume is ${processedCount} in 60 minutes`;
}

export function nextVolumeAlertState(
  processedCount: number,
  state: { isAboveThreshold: boolean; alertClaimed: boolean },
): { isAboveThreshold: boolean; alertClaimed: boolean; shouldSend: boolean } {
  if (!isVolumeThresholdExceeded(processedCount)) {
    return { isAboveThreshold: false, alertClaimed: false, shouldSend: false };
  }
  const shouldSend = !state.isAboveThreshold || !state.alertClaimed;
  return { isAboveThreshold: true, alertClaimed: shouldSend || state.alertClaimed, shouldSend };
}

/**
 * Marks one durable automation outcome and claims a threshold-crossing alert.
 * The transaction advisory lock serializes the singleton state across workers.
 * A failed email clears its claim, allowing the next outcome invocation to retry
 * while the threshold remains exceeded.
 */
export async function recordEmailIntakeOutcomeAndAlert(intakeId: string, now = new Date()): Promise<void> {
  let alertCount: number | null = null;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${STATE_KEY}))`);
      await tx.update(emailIntakeQueue)
        .set({ automationProcessedAt: now })
        .where(and(eq(emailIntakeQueue.id, intakeId), isNull(emailIntakeQueue.automationProcessedAt)));

      const [row] = await tx.select({
        processedCount: sql<number>`count(distinct coalesce(${emailIntakeQueue.groupId}, ${emailIntakeQueue.id}))`,
      }).from(emailIntakeQueue)
        .where(gt(emailIntakeQueue.automationProcessedAt, new Date(now.getTime() - EMAIL_INTAKE_VOLUME_WINDOW_MS)));
      const processedCount = Number(row?.processedCount || 0);

      await tx.insert(emailIntakeVolumeAlertState).values({ singletonKey: STATE_KEY })
        .onConflictDoNothing();
      const [state] = await tx.select().from(emailIntakeVolumeAlertState)
        .where(eq(emailIntakeVolumeAlertState.singletonKey, STATE_KEY)).limit(1);
      if (!state) throw new Error('Unable to initialize email intake volume alert state');

      const nextState = nextVolumeAlertState(processedCount, state);
      if (!nextState.isAboveThreshold) {
        await tx.update(emailIntakeVolumeAlertState).set({
          isAboveThreshold: false, alertClaimed: false, alertSpikeId: null, alertSentAt: null, updatedAt: now,
        }).where(eq(emailIntakeVolumeAlertState.singletonKey, STATE_KEY));
        return;
      }

      // The first over-threshold outcome claims the alert. A prior failed send
      // has alertClaimed=false and is intentionally retryable.
      if (nextState.shouldSend) {
        const spikeId = randomUUID();
        await tx.update(emailIntakeVolumeAlertState).set({
          isAboveThreshold: true, alertClaimed: true, alertSpikeId: spikeId, alertSentAt: null, updatedAt: now,
        }).where(eq(emailIntakeVolumeAlertState.singletonKey, STATE_KEY));
        await tx.insert(backgroundJobs).values({
          jobType: 'email_intake_volume_alert',
          payload: { processedCount, spikeId },
          status: 'pending',
          maxAttempts: 5,
        });
        alertCount = processedCount;
      }
    });

    if (alertCount === null) return;
    // Delivery is durably queued in the same transaction as the claim.
  } catch (error) {
    // Monitoring must never block intake processing. A delivery failure is
    // retried by a later outcome because the durable claim is released above.
    console.error('[EMAIL-INTAKE-VOLUME] Unable to process volume alert:', error);
    if (alertCount !== null) {
      try {
        await db.update(emailIntakeVolumeAlertState).set({ alertClaimed: false, updatedAt: new Date() })
          .where(eq(emailIntakeVolumeAlertState.singletonKey, STATE_KEY));
      } catch (releaseError) {
        console.error('[EMAIL-INTAKE-VOLUME] Unable to release failed alert claim:', releaseError);
      }
    }
  }
}

export async function processClaimedEmailIntakeVolumeAlert(spikeId: string, processedCount: number): Promise<{ sent: boolean; stale?: boolean }> {
  const [state] = await db.select().from(emailIntakeVolumeAlertState)
    .where(eq(emailIntakeVolumeAlertState.singletonKey, STATE_KEY)).limit(1);
  if (!state || state.alertSpikeId !== spikeId) return { sent: false, stale: true };
  if (state?.alertSentAt) return { sent: true };
  let sent = false;
  try {
    sent = await sendNotificationEmail({
      to: 'jack@apexresi.com',
      subject: volumeAlertSubject(processedCount),
      text: `Urgent: ${processedCount} automated source emails were processed in the trailing 60 minutes.`,
      type: 'system_alert',
      priority: 'urgent',
    });
    if (!sent) {
      throw new Error('Email provider did not accept intake volume alert');
    }
    // Once the provider accepts the message, never release the claim: doing so
    // could duplicate a delivered alert if this bookkeeping write fails.
    await db.update(emailIntakeVolumeAlertState)
      .set({ alertSentAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(emailIntakeVolumeAlertState.singletonKey, STATE_KEY),
        eq(emailIntakeVolumeAlertState.alertSpikeId, spikeId),
      ));
  } catch (error) {
    console.error('[EMAIL-INTAKE-VOLUME] Alert delivery failed:', error);
    if (sent) return { sent: true };
    throw error;
  }
  return { sent: true };
}

export async function releaseEmailIntakeVolumeAlertClaim(spikeId: string): Promise<void> {
  await db.update(emailIntakeVolumeAlertState)
    .set({ alertClaimed: false, alertSpikeId: null, updatedAt: new Date() })
    .where(and(
      eq(emailIntakeVolumeAlertState.singletonKey, STATE_KEY),
      eq(emailIntakeVolumeAlertState.alertSpikeId, spikeId),
    ));
}
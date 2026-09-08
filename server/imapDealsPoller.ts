/**
 * Direct IMAP adapter for the GoDaddy-hosted deals@landlinq.ai mailbox.
 *
 * A message is marked as read only after the intake row and its automated
 * routing outcome have both been durably handled. The IMAP UID is also used as
 * the persistent intake idempotency key, so reconnects and mailbox polling
 * retries cannot create a second intake for the same message.
 */

import { createHash } from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { db } from './db.js';
import { emailIntakeQueue } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

export const DEALS_IMAP_MAILBOX = 'deals@landlinq.ai';
export const DEALS_IMAP_HOST = 'imap.secureserver.net';
export const DEALS_IMAP_PORT = 993;
export const DEFAULT_IMAP_INTERVAL_MS = 3 * 60 * 1000;

export interface ImapAttachmentFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export interface ImapDealsMessage {
  uid: number;
  messageId: string;
  from: string;
  to: string;
  cc: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  bodyPreview: string;
  receivedDateTime?: string;
  attachments: ImapAttachmentFile[];
}

export interface ImapDealsPollResult {
  messagesSeen: number;
  processed: number;
  deferred: number;
  errors: number;
  markReadFailures: number;
  skippedBecauseRunning: boolean;
}

export interface ImapFetchedMessage {
  uid: number;
  source: Buffer | Uint8Array;
}

export interface ImapMailboxClient {
  connect(): Promise<void>;
  getMailboxLock(mailbox: string): Promise<{ release(): void }>;
  search(query: { seen: boolean }, options: { uid: true }): Promise<number[] | false | undefined>;
  fetch(
    range: number[],
    query: { uid: true; source: true },
    options: { uid: true },
  ): AsyncIterable<ImapFetchedMessage>;
  messageFlagsAdd(range: number, flags: string[], options: { uid: true }): Promise<boolean>;
  logout(): Promise<void>;
}

export interface ImapDealsPollerDependencies {
  createClient?: () => ImapMailboxClient;
  processMessage: (message: ImapDealsMessage) => Promise<boolean>;
}

function emptyResult(skippedBecauseRunning = false): ImapDealsPollResult {
  return {
    messagesSeen: 0,
    processed: 0,
    deferred: 0,
    errors: 0,
    markReadFailures: 0,
    skippedBecauseRunning,
  };
}

function addressText(value: any): string {
  const fields = value ? (Array.isArray(value) ? value : [value]) : [];
  return fields
    .flatMap((field: any) => field?.value || [])
    .map((entry: any) => entry?.address || entry?.name || '')
    .filter(Boolean)
    .join(', ');
}

function addressList(value: string): string[] {
  return value
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
}

/**
 * The provider key is kept in the existing graphMessageId field because the
 * intake service already hashes that field into its unique emailHash column.
 */
export function buildImapMessageId(mailbox: string, uid: number): string {
  return `imap:${mailbox.toLowerCase()}:uid:${uid}`;
}

export function buildImapIntakeHash(mailbox: string, uid: number): string {
  return createHash('sha256')
    .update(`graph:${buildImapMessageId(mailbox, uid)}`)
    .digest('hex');
}

/** Convert raw MIME into the file shape accepted by EmailIntakeService. */
export async function parseImapMessage(
  uid: number,
  source: Buffer | Uint8Array,
  mailbox = DEALS_IMAP_MAILBOX,
): Promise<ImapDealsMessage> {
  const parsed: any = await simpleParser(Buffer.from(source));
  const from = parsed.from?.text || '';
  const to = addressText(parsed.to);
  const cc = addressText(parsed.cc);
  const replyTo = addressText(parsed.replyTo);
  const attachments: ImapAttachmentFile[] = (parsed.attachments || []).map((attachment: any, index: number) => {
    const filename = attachment.filename || `attachment-${index + 1}`;
    const contentType = attachment.contentType || 'application/octet-stream';
    const content = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(attachment.content || '');
    return {
      fieldname: `attachment${index + 1}`,
      originalname: filename,
      mimetype: contentType,
      buffer: content,
    };
  });

  return {
    uid,
    messageId: buildImapMessageId(mailbox, uid),
    from,
    to,
    cc,
    replyTo,
    subject: parsed.subject || '',
    text: parsed.text || '',
    html: typeof parsed.html === 'string' ? parsed.html : '',
    bodyPreview: String(parsed.text || '').slice(0, 255),
    receivedDateTime: parsed.date instanceof Date ? parsed.date.toISOString() : undefined,
    attachments,
  };
}

function createProductionClient(): ImapMailboxClient {
  const password = process.env.DEALS_EMAIL_PASSWORD;
  if (!password) {
    throw new Error('DEALS_EMAIL_PASSWORD is not configured');
  }
  return new ImapFlow({
    host: DEALS_IMAP_HOST,
    port: DEALS_IMAP_PORT,
    secure: true,
    auth: {
      user: DEALS_IMAP_MAILBOX,
      pass: password,
    },
    logger: false,
  }) as unknown as ImapMailboxClient;
}

/**
 * Poll unseen messages in a single IMAP session. The lock and connection are
 * always released, including when MIME parsing or intake processing fails.
 */
export function createImapDealsPoller(
  deps: ImapDealsPollerDependencies,
): () => Promise<ImapDealsPollResult> {
  const createClient = deps.createClient || createProductionClient;
  let running = false;

  return async (): Promise<ImapDealsPollResult> => {
    if (running) return emptyResult(true);
    running = true;
    const result = emptyResult();
    const client = createClient();
    let lock: { release(): void } | undefined;

    try {
      await client.connect();
      lock = await client.getMailboxLock('INBOX');
      const unseen = await client.search({ seen: false }, { uid: true });
      const uids = Array.isArray(unseen) ? unseen : [];
      if (uids.length === 0) return result;

      for await (const message of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
        result.messagesSeen++;
        try {
          const normalized = await parseImapMessage(message.uid, message.source);
          const durable = await deps.processMessage(normalized);
          if (!durable) {
            result.deferred++;
            continue;
          }
          const markedRead = await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          if (!markedRead) {
            result.markReadFailures++;
            continue;
          }
          result.processed++;
        } catch {
          // Leave this precise UID unseen so the next poll can retry it.
          result.errors++;
        }
      }
      return result;
    } finally {
      lock?.release();
      try {
        await client.logout();
      } catch {
        // A dead connection is already unusable; preserve the original poll error.
      }
      running = false;
    }
  };
}

async function existingIntakeForMessage(uid: number): Promise<{
  intakeIds: string[];
  complete: boolean;
} | null> {
  const emailHash = buildImapIntakeHash(DEALS_IMAP_MAILBOX, uid);
  const [first] = await db.select({
    id: emailIntakeQueue.id,
    groupId: emailIntakeQueue.groupId,
    automationProcessedAt: emailIntakeQueue.automationProcessedAt,
  }).from(emailIntakeQueue).where(eq(emailIntakeQueue.emailHash, emailHash)).limit(1);
  if (!first) return null;

  const rows = first.groupId
    ? await db.select({
        id: emailIntakeQueue.id,
        automationProcessedAt: emailIntakeQueue.automationProcessedAt,
      }).from(emailIntakeQueue).where(eq(emailIntakeQueue.groupId, first.groupId))
    : [first];

  return {
    intakeIds: rows.map((row) => row.id),
    complete: rows.every((row) => row.automationProcessedAt != null),
  };
}

/**
 * Reuse the existing intake parser and automated routing pipeline. Existing
 * durable rows are resumed without reparsing the MIME message.
 */
export async function processImapMessage(
  message: ImapDealsMessage,
): Promise<boolean> {
  const existing = await existingIntakeForMessage(message.uid);
  const { processAutomatedDealEmailIntake } = await import('./automatedDealEmailPipeline.js');
  const { processIntakeIdsIndependently, EmailIntakeService } = await import('./emailIntakeService.js');

  if (existing?.complete) return true;
  if (existing) {
    return processIntakeIdsIndependently(existing.intakeIds, processAutomatedDealEmailIntake);
  }

  const rawBody = {
    graphMessageId: message.messageId,
    from: message.from,
    to: message.to || DEALS_IMAP_MAILBOX,
    cc: message.cc,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: message.replyTo || undefined,
    envelope: JSON.stringify({
      to: [...addressList(message.to), ...addressList(message.cc)],
      from: message.from,
    }),
  };
  const queued = await EmailIntakeService.processInboundEmail(rawBody, message.attachments);
  if (!queued) return false;
  return processIntakeIdsIndependently(queued.intakeIds, processAutomatedDealEmailIntake);
}

let defaultPoller: (() => Promise<ImapDealsPollResult>) | undefined;
let pollSchedule: NodeJS.Timeout | undefined;

export function pollDealsMailboxImap(): Promise<ImapDealsPollResult> {
  if (!defaultPoller) defaultPoller = createImapDealsPoller({ processMessage: processImapMessage });
  return defaultPoller();
}

/** Start one delayed, non-overlapping production schedule. */
export function startDealsImapPoller(intervalMs = DEFAULT_IMAP_INTERVAL_MS): void {
  if (pollSchedule) return;

  const run = async () => {
    try {
      const { EMAIL_SCRAPING_ENABLED } = await import('./emailAutomationConfig.js');
      if (!EMAIL_SCRAPING_ENABLED) {
        console.log('[IMAP-DEALS] Poll skipped — email automation is disabled');
        return;
      }
      const result = await pollDealsMailboxImap();
      console.log(
        `[IMAP-DEALS] Poll complete: seen=${result.messagesSeen}, processed=${result.processed}, ` +
        `manual/deferred=${result.deferred}, errors=${result.errors}, readFailures=${result.markReadFailures}`,
      );
    } catch (error) {
      console.error('[IMAP-DEALS] Poll failed; messages remain unseen:', error);
    }
  };

  pollSchedule = setInterval(run, intervalMs);
  pollSchedule.unref?.();
  // Intentionally no immediate run: startup must finish before the first poll.
  console.log(`[IMAP-DEALS] Poller scheduled every ${Math.round(intervalMs / 1000)} seconds`);
}
/**
 * Microsoft Graph adapter for the deals@ mailbox.
 *
 * The processor is intentionally responsible for making the inbound email
 * durable (for example, committing it to the intake queue).  A message remains
 * unread unless that processor explicitly returns true.
 */

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
export const DEALS_MAILBOX = 'deals@landlinq.ai';
export const DEFAULT_GRAPH_TIMEOUT_MS = 20_000;

export interface GraphEmailAddress {
  name?: string | null;
  address?: string | null;
}

export interface GraphRecipient {
  emailAddress?: GraphEmailAddress | null;
}

export interface GraphInternetMessageHeader {
  name: string;
  value: string;
}

export interface GraphMessage {
  id: string;
  subject?: string | null;
  body?: { contentType?: string | null; content?: string | null } | null;
  bodyPreview?: string | null;
  from?: GraphRecipient | null;
  toRecipients?: GraphRecipient[] | null;
  ccRecipients?: GraphRecipient[] | null;
  replyTo?: GraphRecipient[] | null;
  internetMessageHeaders?: GraphInternetMessageHeader[] | null;
  receivedDateTime?: string | null;
  hasAttachments?: boolean;
}

export interface GraphAttachment {
  id: string;
  name?: string | null;
  contentType?: string | null;
  size?: number;
  isInline?: boolean;
  contentBytes?: string | null;
  '@odata.type'?: string;
}

export interface DealsMailboxAttachment {
  id: string;
  filename: string;
  contentType: string;
  content: string;
  size?: number;
  isInline?: boolean;
}

/** The normalized payload supplied to the durable intake callback. */
export interface DealsMailboxMessage {
  id: string;
  from: string;
  to: string;
  cc: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  bodyPreview: string;
  receivedDateTime?: string;
  headers: GraphInternetMessageHeader[];
  attachments: DealsMailboxAttachment[];
}

export type DealsMailboxProcessor = (message: DealsMailboxMessage) => Promise<boolean>;
export type GraphFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type GraphTokenProvider = () => Promise<string>;

export interface GraphDealsPollerDependencies {
  fetch?: GraphFetch;
  getToken?: GraphTokenProvider;
  processMessage: DealsMailboxProcessor;
  timeoutMs?: number;
  mailbox?: string;
}

export interface GraphDealsPollResult {
  pages: number;
  messagesSeen: number;
  processed: number;
  deferred: number;
  errors: number;
  markReadFailures: number;
  skippedBecauseRunning: boolean;
}

const MESSAGE_SELECT = [
  'body', 'bodyPreview', 'from', 'toRecipients', 'ccRecipients', 'replyTo',
  'subject', 'internetMessageHeaders', 'receivedDateTime', 'hasAttachments',
].join(',');

export function buildUnreadMessagesUrl(mailbox = DEALS_MAILBOX): string {
  const query = new URLSearchParams({
    '$filter': 'isRead eq false',
    '$select': MESSAGE_SELECT,
    '$top': '100',
    '$orderby': 'receivedDateTime asc',
  });
  return `${GRAPH_ROOT}/users/${encodeURIComponent(mailbox)}/messages?${query.toString()}`;
}

export function recipientAddresses(recipients?: GraphRecipient[] | null): string {
  return (recipients || [])
    .map((recipient) => recipient.emailAddress?.address?.trim() || '')
    .filter(Boolean)
    .join(', ');
}

export function senderAddress(sender?: GraphRecipient | null): string {
  return sender?.emailAddress?.address?.trim() || '';
}

/** Converts Graph's message shape without applying any sender/subject filtering. */
export function normalizeGraphMessage(
  message: GraphMessage,
  attachments: DealsMailboxAttachment[] = [],
): DealsMailboxMessage {
  const content = message.body?.content || '';
  const contentType = message.body?.contentType?.toLowerCase();
  return {
    id: message.id,
    from: senderAddress(message.from),
    to: recipientAddresses(message.toRecipients),
    cc: recipientAddresses(message.ccRecipients),
    replyTo: recipientAddresses(message.replyTo),
    subject: message.subject || '',
    text: contentType === 'text' ? content : '',
    html: contentType === 'html' ? content : '',
    bodyPreview: message.bodyPreview || '',
    receivedDateTime: message.receivedDateTime || undefined,
    headers: message.internetMessageHeaders || [],
    attachments,
  };
}

export async function fetchWithTimeout(
  fetchFn: GraphFetch,
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_GRAPH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Microsoft Graph ${context} failed (${response.status}): ${detail}`);
  }
  return response.json() as Promise<T>;
}

interface GraphPage<T> {
  value?: T[];
  '@odata.nextLink'?: string;
}

function attachmentUrl(mailbox: string, messageId: string, attachmentId?: string): string {
  const base = `${GRAPH_ROOT}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}/attachments`;
  return attachmentId ? `${base}/${encodeURIComponent(attachmentId)}` : base;
}

export async function fetchFileAttachments(
  fetchFn: GraphFetch,
  token: string,
  mailbox: string,
  messageId: string,
  timeoutMs = DEFAULT_GRAPH_TIMEOUT_MS,
): Promise<DealsMailboxAttachment[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const files: DealsMailboxAttachment[] = [];
  let nextUrl: string | undefined = attachmentUrl(mailbox, messageId);

  while (nextUrl) {
    const response = await fetchWithTimeout(fetchFn, nextUrl, { headers }, timeoutMs);
    const page = await readJson<GraphPage<GraphAttachment>>(response, 'attachment listing');
    for (const attachment of page.value || []) {
      if (attachment['@odata.type'] !== '#microsoft.graph.fileAttachment') continue;
      // Retrieve the exact attachment resource so contentBytes is not dependent
      // on Graph's collection representation.
      const detailResponse = await fetchWithTimeout(
        fetchFn, attachmentUrl(mailbox, messageId, attachment.id), { headers }, timeoutMs,
      );
      const detail = await readJson<GraphAttachment>(detailResponse, 'attachment download');
      if (typeof detail.contentBytes !== 'string') {
        throw new Error(`Microsoft Graph file attachment ${attachment.id} did not include contentBytes`);
      }
      files.push({
        id: detail.id,
        filename: detail.name || 'attachment',
        contentType: detail.contentType || 'application/octet-stream',
        content: detail.contentBytes,
        size: detail.size,
        isInline: detail.isInline,
      });
    }
    nextUrl = page['@odata.nextLink'];
  }
  return files;
}

function emptyResult(skippedBecauseRunning = false): GraphDealsPollResult {
  return { pages: 0, messagesSeen: 0, processed: 0, deferred: 0, errors: 0, markReadFailures: 0, skippedBecauseRunning };
}

export function createGraphDealsPoller(deps: GraphDealsPollerDependencies): () => Promise<GraphDealsPollResult> {
  const fetchFn = deps.fetch || fetch;
  const getToken = deps.getToken || defaultTokenProvider;
  const timeoutMs = deps.timeoutMs || DEFAULT_GRAPH_TIMEOUT_MS;
  const mailbox = deps.mailbox || DEALS_MAILBOX;
  let running = false;

  return async (): Promise<GraphDealsPollResult> => {
    if (running) return emptyResult(true);
    running = true;
    const result = emptyResult();
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      let nextUrl: string | undefined = buildUnreadMessagesUrl(mailbox);

      while (nextUrl) {
        const response = await fetchWithTimeout(fetchFn, nextUrl, { headers }, timeoutMs);
        const page = await readJson<GraphPage<GraphMessage>>(response, 'message listing');
        result.pages++;
        for (const graphMessage of page.value || []) {
          result.messagesSeen++;
          try {
            const attachments = graphMessage.hasAttachments
              ? await fetchFileAttachments(fetchFn, token, mailbox, graphMessage.id, timeoutMs)
              : [];
            const durable = await deps.processMessage(normalizeGraphMessage(graphMessage, attachments));
            if (!durable) {
              result.deferred++;
              continue;
            }
            const markRead = await fetchWithTimeout(fetchFn,
              `${GRAPH_ROOT}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(graphMessage.id)}`,
              { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead: true }) },
              timeoutMs,
            );
            if (!markRead.ok) {
              result.markReadFailures++;
              continue;
            }
            result.processed++;
          } catch {
            // Leave this precise message unread so a subsequent poll can retry it.
            result.errors++;
          }
        }
        nextUrl = page['@odata.nextLink'];
      }
      return result;
    } finally {
      running = false;
    }
  };
}

// Dynamic import keeps this adapter testable without database configuration:
// microsoftAuth imports the database module, but token acquisition is only
// needed in a real poll.
const defaultTokenProvider: GraphTokenProvider = async () =>
  (await import('./microsoftAuth')).getAppOnlyGraphToken();

let defaultPoller: (() => Promise<GraphDealsPollResult>) | undefined;
let pollSchedule: NodeJS.Timeout | undefined;

/**
 * Singleton production entry point. A processor is required so callers must
 * explicitly define their durable-success boundary.
 */
export function pollDealsMailbox(processMessage: DealsMailboxProcessor): Promise<GraphDealsPollResult> {
  if (!defaultPoller) defaultPoller = createGraphDealsPoller({ processMessage });
  return defaultPoller();
}

/** Start one delayed, non-overlapping production schedule. */
export function startDealsMailboxPoller(intervalMs = 3 * 60 * 1000): void {
  if (pollSchedule) return;
  const run = async () => {
    try {
      const { EMAIL_SCRAPING_ENABLED } = await import('./emailAutomationConfig.js');
      if (!EMAIL_SCRAPING_ENABLED) {
        console.log('[GRAPH-DEALS] Poll skipped — email automation is disabled');
        return;
      }
      const { EmailIntakeService } = await import('./emailIntakeService.js');
      const result = await pollDealsMailbox(message => EmailIntakeService.processGraphMessage(message));
      console.log(
        `[GRAPH-DEALS] Poll complete: seen=${result.messagesSeen}, processed=${result.processed}, ` +
        `manual/deferred=${result.deferred}, errors=${result.errors}, readFailures=${result.markReadFailures}`,
      );
    } catch (error) {
      console.error('[GRAPH-DEALS] Poll failed; messages remain unread:', error);
    }
  };
  pollSchedule = setInterval(run, intervalMs);
  pollSchedule.unref?.();
  void run();
  console.log(`[GRAPH-DEALS] Poller scheduled every ${Math.round(intervalMs / 1000)} seconds`);
}
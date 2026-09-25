import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import {
  emailBounceBodyToText,
  extractBouncedEmailFromText,
  isBounceNotification,
} from "./emailBounceParsing";

export const HELP_IMAP_MAILBOX = "help@landlinq.ai";
export const HELP_IMAP_HOST = "imap.secureserver.net";
export const HELP_IMAP_PORT = 993;

export interface InitialLoginBounceNotice {
  messageId: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  receivedDateTime: string;
}

interface FetchedMessage {
  uid: number;
  source: Buffer | Uint8Array;
}

export interface BounceImapClient {
  connect(): Promise<void>;
  getMailboxLock(mailbox: string): Promise<{ release(): void }>;
  search(query: { seen: boolean }, options: { uid: true }): Promise<number[] | false | undefined>;
  fetch(
    range: number[],
    query: { uid: true; source: true },
    options: { uid: true },
  ): AsyncIterable<FetchedMessage>;
  messageFlagsAdd(range: number, flags: string[], options: { uid: true }): Promise<boolean>;
  logout(): Promise<void>;
}

export interface InitialLoginBouncePollerDependencies {
  createClient?: () => BounceImapClient;
  persistNotice: (notice: InitialLoginBounceNotice) => Promise<boolean>;
}

export interface InitialLoginBouncePollResult {
  messagesSeen: number;
  matched: number;
  deferred: number;
  errors: number;
  markReadFailures: number;
}

function createProductionClient(): BounceImapClient {
  const password = process.env.HELP_EMAIL_PASSWORD;
  if (!password) throw new Error("HELP_EMAIL_PASSWORD is not configured");
  return new ImapFlow({
    host: HELP_IMAP_HOST,
    port: HELP_IMAP_PORT,
    secure: true,
    auth: {
      user: HELP_IMAP_MAILBOX,
      pass: password,
    },
    logger: false,
  }) as unknown as BounceImapClient;
}

function getAttachmentText(attachments: any[]): string {
  return (attachments || [])
    .filter((attachment) =>
      attachment.contentType === "message/delivery-status" ||
      attachment.contentType === "text/plain" ||
      attachment.contentType === "message/rfc822"
    )
    .map((attachment) => Buffer.isBuffer(attachment.content)
      ? attachment.content.toString("utf8")
      : String(attachment.content || ""))
    .join("\n");
}

/**
 * Poll only unseen messages in the shared transactional mailbox. A matching
 * notice is marked seen only after its invitation status is durably updated.
 */
export function createInitialLoginBouncePoller(
  deps: InitialLoginBouncePollerDependencies,
): () => Promise<InitialLoginBouncePollResult> {
  const createClient = deps.createClient || createProductionClient;
  let running = false;

  return async () => {
    const result: InitialLoginBouncePollResult = {
      messagesSeen: 0,
      matched: 0,
      deferred: 0,
      errors: 0,
      markReadFailures: 0,
    };
    if (running) return result;
    running = true;
    let client: BounceImapClient | undefined;
    let lock: { release(): void } | undefined;

    try {
      client = createClient();
      await client.connect();
      lock = await client.getMailboxLock("INBOX");
      const unseen = await client.search({ seen: false }, { uid: true });
      const uids = Array.isArray(unseen) ? unseen : [];
      if (uids.length === 0) return result;

      for await (const message of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
        result.messagesSeen++;
        try {
          const parsed: any = await simpleParser(Buffer.from(message.source));
          const fromAddress = (parsed.from?.value || [])
            .map((entry: any) => entry.address || "")
            .filter(Boolean)
            .join(", ");
          const subject = String(parsed.subject || "");
          if (!isBounceNotification({ fromAddress, subject })) continue;

          const attachmentText = getAttachmentText(parsed.attachments || []);
          const bodyText = [
            String(parsed.text || ""),
            typeof parsed.html === "string" ? emailBounceBodyToText(parsed.html) : "",
            attachmentText,
          ].filter(Boolean).join("\n");
          const recipientEmail = extractBouncedEmailFromText(
            `${bodyText} ${subject}`,
            [HELP_IMAP_MAILBOX],
          );
          const receivedDateTime = parsed.date instanceof Date
            ? parsed.date.toISOString()
            : "";
          if (!recipientEmail || !receivedDateTime) continue;

          const persisted = await deps.persistNotice({
            messageId: `imap:${HELP_IMAP_MAILBOX}:uid:${message.uid}`,
            recipientEmail,
            subject,
            bodyText,
            receivedDateTime,
          });
          if (!persisted) {
            result.deferred++;
            continue;
          }

          const markedRead = await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          if (!markedRead) {
            result.markReadFailures++;
            continue;
          }
          result.matched++;
        } catch {
          // Leave the message unseen so a later poll can retry parsing or persistence.
          result.errors++;
        }
      }

      return result;
    } finally {
      lock?.release();
      if (client) {
        try {
          await client.logout();
        } catch {
          // Closing an already-broken connection is best effort.
        }
      }
      running = false;
    }
  };
}
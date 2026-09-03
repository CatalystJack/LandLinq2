import { db } from './db';
import { sql } from 'drizzle-orm';

const GRAPH_SEND_URL = 'https://graph.microsoft.com/v1.0/me/sendMail';
const TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

let appOnlyTokenCache: { accessToken: string; expiresAt: number } | null = null;

/**
 * Acquire an application-only Microsoft Graph token for platform mail.
 * This uses the app registration's application permissions and never
 * impersonates the currently logged-in user.
 */
export async function getAppOnlyGraphToken(): Promise<string> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID are required for system email');
  }

  if (appOnlyTokenCache && appOnlyTokenCache.expiresAt > Date.now() + 60_000) {
    return appOnlyTokenCache.accessToken;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(TOKEN_URL(tenantId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Microsoft app-only token request failed (${response.status}): ${body}`);
  }

  const tokens = await response.json() as { access_token?: string; expires_in?: number };
  if (!tokens.access_token) throw new Error('Microsoft app-only token response did not include access_token');
  appOnlyTokenCache = {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + Math.max(60, tokens.expires_in || 3600) * 1_000,
  };
  return tokens.access_token;
}

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface MicrosoftSendOptions {
  to: string;
  subject: string;
  htmlBody: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    contentBytes: string; // base64
  }>;
}

/**
 * Refresh a Microsoft OAuth access token using a refresh token.
 */
export async function refreshMicrosoftToken(refreshToken: string): Promise<MicrosoftTokens> {
  const clientId     = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId     = process.env.MICROSOFT_TENANT_ID || 'common';

  if (!clientId || !clientSecret) {
    throw new Error('MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch(TOKEN_URL(tenantId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.Send Mail.Read offline_access',
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Microsoft token refresh failed (${response.status}): ${body}`);
  }

  const tokens = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken:  tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt:    new Date(Date.now() + tokens.expires_in * 1_000),
  };
}

/**
 * Returns true when a Microsoft Graph send error indicates the recipient's
 * mailbox is permanently undeliverable (hard bounce — 5xx SMTP codes).
 * These are distinct from transient throttle/auth errors and mean the
 * address no longer exists or cannot accept mail.
 */
export function isMailboxBounceError(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return (
    msg.includes('550 5.1.1') ||          // User unknown / mailbox does not exist
    msg.includes('550 5.1.10') ||         // RESOLVER.ADR.RecipNotFound
    msg.includes('5.4.1') ||              // Recipient address rejected
    msg.includes('invalidrecipient') ||
    msg.includes('nonexistentmailbox') ||
    msg.includes('errornonexistentmailbox') ||
    msg.includes('recipientnotfound') ||
    msg.includes('mailboxnotfound') ||
    msg.includes('smtpsend.mailbox') ||
    msg.includes('badrecipient') ||
    msg.includes('recipient address rejected') ||
    msg.includes('user unknown') ||
    msg.includes('no such user') ||
    msg.includes('no such recipient') ||
    (msg.includes('mailbox') && (
      msg.includes('not found') ||
      msg.includes("doesn't exist") ||
      msg.includes('does not exist') ||
      msg.includes('unavailable')
    ))
  );
}

/**
 * Poll a sender's Outlook inbox for unread bounce/delivery-failure notifications.
 * Returns a list of bounced email addresses found. Marks matching messages as read.
 * Silently returns [] if the token lacks Mail.Read permission (403).
 */
export async function pollOutlookInboxForBounces(accessToken: string): Promise<string[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const url =
    `https://graph.microsoft.com/v1.0/me/messages` +
    `?$filter=isRead eq false and receivedDateTime ge ${since}` +
    `&$select=id,subject,from,body` +
    `&$top=100` +
    `&$orderby=receivedDateTime desc`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return [];
  }

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) return []; // No Mail.Read — skip silently
    return [];
  }

  const data = await response.json() as { value?: any[] };
  const messages = data.value || [];

  const bouncedEmails: string[] = [];
  const toMarkRead: string[] = [];

  for (const msg of messages) {
    const fromAddr = (msg.from?.emailAddress?.address || '').toLowerCase();
    const subject  = (msg.subject || '').toLowerCase();

    const isBounce =
      fromAddr.includes('mailer-daemon') ||
      fromAddr.includes('postmaster@') ||
      subject.includes('address not found') ||
      subject.includes('undeliverable') ||
      subject.includes('delivery failed') ||
      subject.includes('delivery status notification') ||
      subject.includes('returned mail') ||
      subject.includes('mail delivery subsystem') ||
      subject.includes('failed to deliver');

    if (!isBounce) continue;

    const bodyText = (msg.body?.content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');

    const extracted = extractBouncedEmailFromText(bodyText + ' ' + subject);
    if (extracted) {
      bouncedEmails.push(extracted);
      toMarkRead.push(msg.id);
    }
  }

  // Mark processed bounce emails as read so they aren't re-processed next run
  for (const msgId of toMarkRead) {
    try {
      await fetch(`https://graph.microsoft.com/v1.0/me/messages/${msgId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead: true }),
      });
    } catch { /* non-fatal */ }
  }

  return bouncedEmails;
}

function extractBouncedEmailFromText(text: string): string | null {
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

  // Gmail / Google: "wasn't delivered to email@example.com"
  const gmailM = text.match(/wasn['']t delivered to\s+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (gmailM) return gmailM[1].toLowerCase();

  // Generic DSN: "delivery to email@... failed" / "deliver to email@..."
  const dsnM = text.match(/deliver(?:y to|ed to|y to the following)?\s+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (dsnM) return dsnM[1].toLowerCase();

  // "The following address(es) failed" style
  const failM = text.match(/address(?:es)? (?:failed|rejected|could not be found)[:\s]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (failM) return failM[1].toLowerCase();

  // "X-Failed-Recipients:" header (NDR standard)
  const hdrM = text.match(/X-Failed-Recipients?:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (hdrM) return hdrM[1].toLowerCase();

  // Last resort: first email found that isn't a well-known system domain
  const SKIP = ['googlemail.com', 'gmail.com', 'outlook.com', 'microsoft.com', 'sendgrid.com', 'mailer-daemon'];
  const all = text.match(EMAIL_RE) || [];
  for (const addr of all) {
    if (!SKIP.some(s => addr.toLowerCase().includes(s))) {
      return addr.toLowerCase();
    }
  }

  return null;
}

export async function sendEmailViaMicrosoft(
  accessToken: string,
  opts: MicrosoftSendOptions,
): Promise<void> {
  const graphAttachments = (opts.attachments || []).map(att => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: att.filename,
    contentType: att.contentType,
    contentBytes: att.contentBytes,
  }));

  const body: Record<string, any> = {
    message: {
      subject: opts.subject,
      body: {
        contentType: 'HTML',
        content: opts.htmlBody,
      },
      toRecipients: [{ emailAddress: { address: opts.to } }],
      ...(graphAttachments.length > 0 && { attachments: graphAttachments }),
    },
    saveToSentItems: true,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(GRAPH_SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Microsoft Graph send failed (${response.status}): ${errorText}`);
  }
}

/**
 * Convenience helper: refresh token if expiring soon, then send.
 * Updates the `outreach_senders` row if a refresh was performed.
 * Returns the send method used ('microsoft').
 */
export async function sendDripEmailViaMicrosoft(enrollment: {
  id: string;
  contact_email: string;
  sender_id: string;
  microsoft_access_token: string;
  microsoft_refresh_token: string | null;
  microsoft_token_expiry: Date | string | null;
}, opts: { subject: string; htmlBody: string; attachments?: Array<{ filename: string; contentType: string; contentBytes: string }> }): Promise<void> {
  let accessToken = enrollment.microsoft_access_token;
  const tokenExpiry = enrollment.microsoft_token_expiry
    ? new Date(enrollment.microsoft_token_expiry)
    : null;

  // Refresh if expired or expiring within the next 5 minutes
  const needsRefresh =
    tokenExpiry && tokenExpiry <= new Date(Date.now() + 5 * 60 * 1_000);

  if (needsRefresh && enrollment.microsoft_refresh_token) {
    try {
      const newTokens = await refreshMicrosoftToken(enrollment.microsoft_refresh_token);
      accessToken = newTokens.accessToken;

      await db.execute(sql`
        UPDATE outreach_senders
        SET microsoft_access_token = ${newTokens.accessToken},
            microsoft_refresh_token = ${newTokens.refreshToken ?? enrollment.microsoft_refresh_token},
            microsoft_token_expiry  = ${newTokens.expiresAt},
            updated_at              = NOW()
        WHERE id = ${enrollment.sender_id}
      `);
      console.log(`   🔄 [DRIP] Microsoft token refreshed for sender ${enrollment.sender_id}`);
    } catch (refreshErr: any) {
      console.error(`   ❌ [DRIP] Token refresh failed for sender ${enrollment.sender_id}:`, refreshErr.message);
      throw refreshErr;
    }
  }

  await sendEmailViaMicrosoft(accessToken, {
    to: enrollment.contact_email,
    subject: opts.subject,
    htmlBody: opts.htmlBody,
    ...(opts.attachments && opts.attachments.length > 0 && { attachments: opts.attachments }),
  });
}

import crypto from "node:crypto";
import { db } from "./db";
import { sql } from "drizzle-orm";

export const EMAIL_UNAVAILABLE_TAG = "Email unavailable";
export const EMAIL_HARD_BOUNCE_TAG = "Hard bounce";
export const EMAIL_UNSUBSCRIBED_TAG = "Email unsubscribed";

function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("SESSION_SECRET is required for one-click unsubscribe links");
  }
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

export function createUnsubscribeToken(brokerId: string): string {
  const encodedBrokerId = Buffer.from(brokerId, "utf8").toString("base64url");
  return `${encodedBrokerId}.${sign(encodedBrokerId)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [encodedBrokerId, providedSignature] = token.split(".");
  if (!encodedBrokerId || !providedSignature) return null;

  const expectedSignature = sign(encodedBrokerId);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

  try {
    const brokerId = Buffer.from(encodedBrokerId, "base64url").toString("utf8");
    return brokerId || null;
  } catch {
    return null;
  }
}

export function getPublicApplicationUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  return domain ? `https://${domain}` : "https://landlinq.ai";
}

export function buildUnsubscribeUrl(brokerId: string): string {
  return `${getPublicApplicationUrl()}/api/email/unsubscribe/${createUnsubscribeToken(brokerId)}`;
}

export function appendUnsubscribeFooter(html: string, brokerId: string): string {
  if (html.includes("data-landlinq-unsubscribe-footer")) return html;

  const unsubscribeUrl = buildUnsubscribeUrl(brokerId);
  const footer = `
    <div data-landlinq-unsubscribe-footer="true" style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #6b7280;">
      <a href="${unsubscribeUrl}" style="display: inline-block; color: #2563eb; text-decoration: underline;">Unsubscribe from future emails</a>
      <div style="margin-top: 6px;">You will be removed from this organization’s email outreach immediately.</div>
    </div>`;

  return /<\/body\s*>/i.test(html)
    ? html.replace(/<\/body\s*>/i, `${footer}\n</body>`)
    : `${html}${footer}`;
}

export async function resolveScopedBrokerId(
  brokerId: string | null | undefined,
  email: string,
  developerProfileId: string,
): Promise<string | null> {
  if (brokerId) {
    const direct = await db.execute(sql`
      SELECT id
      FROM brokers
      WHERE id = ${brokerId}
        AND (owner_developer_profile_id = ${developerProfileId} OR owner_developer_profile_id IS NULL)
      LIMIT 1
    `);
    if ((direct.rows || []).length > 0) return brokerId;
  }

  const scoped = await db.execute(sql`
    SELECT id
    FROM brokers
    WHERE LOWER(email) = LOWER(${email})
      AND (owner_developer_profile_id = ${developerProfileId} OR owner_developer_profile_id IS NULL)
    ORDER BY CASE WHEN owner_developer_profile_id = ${developerProfileId} THEN 0 ELSE 1 END
    LIMIT 1
  `);
  return (scoped.rows?.[0] as any)?.id || null;
}

export async function markBrokerEmailUnavailable(options: {
  brokerId?: string | null;
  email: string;
  developerProfileId?: string | null;
}): Promise<string | null> {
  const brokerId = options.developerProfileId
    ? await resolveScopedBrokerId(options.brokerId, options.email, options.developerProfileId)
    : options.brokerId || null;
  if (!brokerId) return null;

  const result = await db.execute(sql`
    UPDATE brokers
    SET is_active = false,
        crm_tags = ARRAY(
          SELECT DISTINCT unnest(
            COALESCE(crm_tags, ARRAY[]::text[])
            || ARRAY[${EMAIL_UNAVAILABLE_TAG}, ${EMAIL_HARD_BOUNCE_TAG}]::text[]
          )
        ),
        updated_at = NOW()
    WHERE id = ${brokerId}
    RETURNING id
  `);
  const updatedBrokerId = (result.rows?.[0] as any)?.id || null;
  if (!updatedBrokerId) return null;

  await db.execute(sql`
    UPDATE drip_campaign_enrollments
    SET status = 'cancelled',
        paused_reason = 'Hard bounce — mailbox does not exist',
        updated_at = NOW()
    WHERE broker_id = ${updatedBrokerId}
      AND status IN ('pending', 'in_progress')
  `);

  if (options.developerProfileId) {
    await db.execute(sql`
      UPDATE drip_campaign_enrollments e
      SET status = 'cancelled',
          paused_reason = 'Hard bounce — mailbox does not exist',
          updated_at = NOW()
      WHERE LOWER(e.contact_email) = LOWER(${options.email})
        AND e.status IN ('pending', 'in_progress')
        AND EXISTS (
          SELECT 1
          FROM outreach_senders s
          WHERE s.id = e.sender_id
            AND s.developer_profile_id = ${options.developerProfileId}
        )
    `);
  }

  return updatedBrokerId;
}

export function unsubscribeConfirmationHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0; padding:40px 20px; background:#f8fafc; font-family:Arial,sans-serif; color:#0f172a;">
    <main style="max-width:520px; margin:0 auto; padding:32px; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; text-align:center;">
      <h1 style="margin:0 0 12px; font-size:24px;">You’re unsubscribed</h1>
      <p style="margin:0; color:#475569; line-height:1.6;">You will no longer receive email outreach from this organization. No form or further action is required.</p>
    </main>
  </body>
</html>`;
}
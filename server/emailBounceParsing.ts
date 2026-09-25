export interface BounceMailboxMessage {
  fromAddress: string;
  subject: string;
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

export function isBounceNotification({ fromAddress, subject }: BounceMailboxMessage): boolean {
  const normalizedFrom = fromAddress.toLowerCase();
  const normalizedSubject = subject.toLowerCase();
  return (
    normalizedFrom.includes("mailer-daemon") ||
    normalizedFrom.includes("postmaster@") ||
    normalizedSubject.includes("address not found") ||
    normalizedSubject.includes("undeliverable") ||
    normalizedSubject.includes("delivery failed") ||
    normalizedSubject.includes("delivery status notification") ||
    normalizedSubject.includes("returned mail") ||
    normalizedSubject.includes("mail delivery subsystem") ||
    normalizedSubject.includes("failed to deliver")
  );
}

export function emailBounceBodyToText(body: string): string {
  return body
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function normalizeBounceMatchText(text: string): string {
  return emailBounceBodyToText(text)
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function extractBouncedEmailFromText(text: string, excludedAddresses: string[] = []): string | null {
  const gmailMatch = text.match(
    /wasn['’]t delivered to\s+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
  );
  if (gmailMatch) return gmailMatch[1].toLowerCase();

  const failedRecipientMatch = text.match(
    /X-Failed-Recipients?:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
  );
  if (failedRecipientMatch) return failedRecipientMatch[1].toLowerCase();

  const dsnRecipientMatch = text.match(
    /(?:Final|Original)-Recipient:\s*(?:rfc822;\s*)?([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
  );
  if (dsnRecipientMatch) return dsnRecipientMatch[1].toLowerCase();

  const failedAddressMatch = text.match(
    /address(?:es)? (?:failed|rejected|could not be found)[:\s]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
  );
  if (failedAddressMatch) return failedAddressMatch[1].toLowerCase();

  const deliveryMatch = text.match(
    /deliver(?:y to|ed to|y to the following)?\s+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
  );
  if (deliveryMatch) return deliveryMatch[1].toLowerCase();

  const excluded = new Set(excludedAddresses.map((address) => address.trim().toLowerCase()));
  const systemDomains = [
    "googlemail.com",
    "gmail.com",
    "outlook.com",
    "microsoft.com",
    "sendgrid.com",
    "landlinq.ai",
  ];
  const recipients = text.match(EMAIL_PATTERN) || [];
  for (const address of recipients) {
    const normalized = address.toLowerCase();
    const localPart = normalized.split("@", 1)[0];
    if (
      excluded.has(normalized) ||
      localPart.includes("mailer-daemon") ||
      localPart === "postmaster" ||
      systemDomains.some((domain) => normalized.endsWith(`@${domain}`))
    ) continue;
    return normalized;
  }
  return null;
}
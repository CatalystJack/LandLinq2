export function replaceBrokerCountyToken(
  content: string,
  county: unknown,
  escapeForHtml = false,
): string {
  const countyText = String(county ?? "").replace(/[\r\n]+/g, " ").trim();
  const replacement = escapeForHtml
    ? countyText.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] || character)
    : countyText;

  return content.replace(/\{\{(?:broker\.)?county\}\}/gi, () => replacement);
}

export type OutreachPreviewRecipient = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  brokerage?: string | null;
  county?: string | null;
};

export type OutreachPreviewContext = {
  recipient?: OutreachPreviewRecipient;
  companyName?: string | null;
  targetMarket?: string | null;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character] || character);

function replaceOutreachPreviewTokens(
  text: string,
  sender?: { name?: string | null; email?: string | null } | null,
  context?: OutreachPreviewContext,
  asHtml = false,
): string {
  const recipient = context?.recipient;
  const hasRecipient = Boolean(recipient);
  const firstName = hasRecipient ? recipient?.firstName?.trim() || "there" : "John";
  const lastName = hasRecipient ? recipient?.lastName?.trim() || "" : "Smith";
  const fullName = `${firstName} ${lastName}`.trim() || "there";
  const values: Record<string, string> = {
    "broker.firstname": firstName,
    firstname: firstName,
    brokerfirstname: firstName,
    "broker.lastname": lastName,
    lastname: lastName,
    "broker.email": hasRecipient ? recipient?.email || "" : "john@example.com",
    "broker.phone": hasRecipient ? recipient?.phone || "" : "(555) 123-4567",
    "broker.company": hasRecipient ? recipient?.brokerage || "" : "ABC Realty",
    "broker.county": hasRecipient ? recipient?.county || "" : "Charleston County",
    county: hasRecipient ? recipient?.county || "" : "Charleston County",
    brokername: hasRecipient ? fullName : "John Smith",
    "sender.name": sender?.name?.trim() || "Your Name",
    "sender.email": sender?.email?.trim() || "you@company.com",
    "company.name": context?.companyName?.trim() || "Catalyst",
    companyname: context?.companyName?.trim() || "Catalyst",
    targetmarket: context?.targetMarket?.trim() || "your target market",
  };
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (original, token: string) => {
    const value = values[token.trim().toLowerCase()];
    if (value === undefined) return original;
    const safeValue = asHtml ? escapeHtml(value) : value;
    return asHtml
      ? `<span class="bg-blue-100 text-blue-800 px-1 rounded">${safeValue}</span>`
      : safeValue;
  });
}

export function renderOutreachPreviewText(
  text: string,
  sender?: { name?: string | null; email?: string | null } | null,
  context?: OutreachPreviewContext,
): string {
  return replaceOutreachPreviewTokens(text, sender, context);
}

export function renderOutreachPreviewHtml(
  html: string,
  sender?: { name?: string | null; email?: string | null } | null,
  context?: OutreachPreviewContext,
): string {
  return replaceOutreachPreviewTokens(html, sender, context, true);
}

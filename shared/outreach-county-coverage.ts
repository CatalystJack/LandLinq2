export type CountyCoverageSummary = {
  totalRecipients: number;
  recipientsWithCounty: number;
  recipientsMissingCounty: number;
};

export function summarizeCountyCoverage(
  recipients: Array<{ county?: unknown }>,
): CountyCoverageSummary {
  const recipientsWithCounty = recipients.filter(
    (recipient) => typeof recipient.county === "string" && recipient.county.trim().length > 0,
  ).length;
  return {
    totalRecipients: recipients.length,
    recipientsWithCounty,
    recipientsMissingCounty: recipients.length - recipientsWithCounty,
  };
}

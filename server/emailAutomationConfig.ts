/**
 * Shared kill switch for every automatic email-to-deal ingress.
 * Keep Graph and webhook behavior aligned so one switch stops all automation.
 */
// Keep disabled until the direct IMAP path has passed controlled verification
// against the GoDaddy-hosted deals@landlinq.ai mailbox.
export const EMAIL_SCRAPING_ENABLED = false;
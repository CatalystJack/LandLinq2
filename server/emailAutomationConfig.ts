/**
 * Shared kill switch for every automatic email-to-deal ingress.
 * Keep Graph and webhook behavior aligned so one switch stops all automation.
 */
// Master switch for automatic email-to-deal intake, including the direct IMAP poller.
export const EMAIL_SCRAPING_ENABLED = true;
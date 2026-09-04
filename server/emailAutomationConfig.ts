/**
 * Shared kill switch for every automatic email-to-deal ingress.
 * Keep Graph and webhook behavior aligned so one switch stops all automation.
 */
// Keep disabled until deals@landlinq.ai exists as a readable mailbox in the
// configured Microsoft tenant. Graph currently returns ErrorInvalidUser.
export const EMAIL_SCRAPING_ENABLED = false;
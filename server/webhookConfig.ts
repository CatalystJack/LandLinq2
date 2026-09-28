// External Webhook Configuration
export interface WebhookEndpoint {
  name: string;
  url: string;
  enabled: boolean;
  type: 'email' | 'sms' | 'teams' | 'slack';
  description?: string;
}

// Mailbox intake is handled by the production IMAP poller; no email webhook is configured.
export const EXTERNAL_WEBHOOKS: WebhookEndpoint[] = [];

// Get webhook URLs by type
export function getWebhooksByType(type: 'email' | 'sms' | 'teams' | 'slack'): WebhookEndpoint[] {
  return EXTERNAL_WEBHOOKS.filter(webhook => webhook.type === type && webhook.enabled);
}

// Get all enabled webhooks
export function getEnabledWebhooks(): WebhookEndpoint[] {
  return EXTERNAL_WEBHOOKS.filter(webhook => webhook.enabled);
}
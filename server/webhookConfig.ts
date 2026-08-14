// External Webhook Configuration
export interface WebhookEndpoint {
  name: string;
  url: string;
  enabled: boolean;
  type: 'email' | 'sms' | 'teams' | 'slack';
  description?: string;
}

// External webhook endpoints configuration
export const EXTERNAL_WEBHOOKS: WebhookEndpoint[] = [
  {
    name: 'LandLinq Email Webhook',
    url: 'https://landlinq.ai/api/webhooks/email',
    enabled: true,
    type: 'email',
    description: 'Main LandLinq domain email webhook endpoint'
  }
];

// Get webhook URLs by type
export function getWebhooksByType(type: 'email' | 'sms' | 'teams' | 'slack'): WebhookEndpoint[] {
  return EXTERNAL_WEBHOOKS.filter(webhook => webhook.type === type && webhook.enabled);
}

// Get all enabled webhooks
export function getEnabledWebhooks(): WebhookEndpoint[] {
  return EXTERNAL_WEBHOOKS.filter(webhook => webhook.enabled);
}
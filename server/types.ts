/**
 * Server Types and Interfaces
 */

export interface EmailAttachment {
  content: string;      // base64-encoded file content
  filename: string;
  type: string;         // MIME type e.g. "application/pdf"
  disposition: 'attachment' | 'inline';
}

export interface EmailNotification {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  type: string;
  priority?: string;
  attachments?: EmailAttachment[];
  fromEmail?: string; // Optional override for the sender address
  fromName?: string;  // Optional override for the sender display name
  // SendGrid Dynamic Template support
  sendgridTemplateId?: string; // SendGrid template ID (d-xxxxx format)
  sendgridDynamicData?: Record<string, unknown>; // Variables to pass to SendGrid template
}

export interface SMSParams {
  to: string;
  message: string;
}
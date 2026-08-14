// ALL HARDCODED EMAIL TEMPLATES REMOVED - 100% OUTREACH MANAGEMENT USAGE
// 
// This file previously contained hardcoded email templates, but these have been 
// completely eliminated per user requirement for 100% usage of custom templates
// from the outreach management system.
//
// ALL emails must now use: TemplateService.getEmailTemplate()
// NO hardcoded templates, branding, or content are allowed.
//
// If you need to send emails, use:
// import { TemplateService } from './templateService';
// const template = await TemplateService.getEmailTemplate('event_name', variables);
//
// Templates are managed in the outreach management dashboard ONLY.

export interface EmailTemplateVariables {
  // Interface kept for backwards compatibility
  brokerName?: string;
  address?: string;
  [key: string]: string | undefined;
}

// REMOVED: All functions that generated hardcoded HTML content
// REMOVED: All branding constants and styling
// REMOVED: All hardcoded email templates 
//
// Use TemplateService exclusively for 100% outreach management compliance
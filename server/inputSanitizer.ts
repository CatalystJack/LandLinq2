/**
 * Input sanitization utilities for secure data processing
 */

// Remove potential XSS characters and normalize whitespace
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 1000); // Limit length
}

// Sanitize email addresses
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return emailRegex.test(sanitized) ? sanitized : '';
}

// Sanitize phone numbers (allow digits, spaces, hyphens, parentheses, plus)
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';
  
  return phone.replace(/[^0-9\s\-\(\)\+]/g, '').trim().substring(0, 20);
}

// Sanitize numeric values
export function sanitizeNumber(value: string | number): string {
  if (typeof value === 'number') return value.toString();
  if (typeof value !== 'string') return '';
  
  // Remove non-numeric characters except decimal point
  const sanitized = value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  return sanitized.substring(0, 20);
}

// Sanitize addresses (preserve broker's exact address - remove only dangerous characters and URLs)
export function sanitizeAddress(address: string): string {
  if (typeof address !== 'string') return '';
  
  return address
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags and angle brackets (includes map links like <https://...>)
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/https?:\/\/[^\s]+/gi, '') // Remove URLs (http:// or https://)
    .trim()
    .substring(0, 500);
}

// Sanitize general text content
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .trim()
    .substring(0, 2000);
}

// Sanitize array of strings
export function sanitizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  
  return arr
    .filter(item => typeof item === 'string')
    .map(item => sanitizeString(item))
    .filter(item => item.length > 0)
    .slice(0, 20); // Limit array size
}

// Sanitize boolean values
export function sanitizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return false;
}

// Comprehensive deal data sanitizer
export function sanitizeDealData(data: any) {
  return {
    brokerId: sanitizeEmail(data.brokerId || ''),
    brokerPhone: sanitizePhone(data.brokerPhone || ''),
    address: sanitizeAddress(data.address || ''),
    askingPrice: sanitizeNumber(data.askingPrice || ''),
    pricingType: ['per_unit', 'whole_deal'].includes(data.pricingType) ? data.pricingType : 'whole_deal',
    sizeAcres: sanitizeNumber(data.sizeAcres || ''),
    unitCount: sanitizeNumber(data.unitCount || ''),
    hasEntitlements: sanitizeBoolean(data.hasEntitlements),
    parcelId: sanitizeString(data.parcelId || ''),
    sewerAvailable: data.sewerAvailable !== undefined ? sanitizeBoolean(data.sewerAvailable) : null,
    productTypes: sanitizeStringArray(data.productTypes || []),
    brokerNotes: sanitizeText(data.brokerNotes || ''),
    teamMemberEmails: sanitizeStringArray(data.teamMemberEmails || []).map(sanitizeEmail).filter(Boolean),
    submissionMethod: ['form', 'email', 'sms'].includes(data.submissionMethod) ? data.submissionMethod : 'form',
    documentUrls: sanitizeStringArray(data.documentUrls || [])  // Sanitize each URL string in the array
  };
}
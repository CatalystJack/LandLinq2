/**
 * URL and Domain Sanitization Utilities
 * Provides secure URL handling and prevents malicious redirects
 */

// Safe list of allowed domains for redirects (can be extended as needed)
const ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'replit.app',
  'replit.com',
  'catalystcp.com'
];

/**
 * Sanitizes a URL to prevent XSS and malicious redirects
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  // Remove dangerous protocols
  const sanitized = url
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/file:/gi, '')
    .trim();
    
  // Ensure URL starts with safe protocols only
  if (sanitized.match(/^https?:\/\//)) {
    return sanitized;
  } else if (sanitized.startsWith('/')) {
    // Relative URLs are safe
    return sanitized;
  } else if (sanitized.match(/^[a-zA-Z0-9-]+\./)) {
    // Domain-like strings should have protocol
    return `https://${sanitized}`;
  }
  
  return sanitized;
}

/**
 * Checks if a domain is in the allowed list
 */
export function isDomainAllowed(domain: string): boolean {
  if (!domain || typeof domain !== 'string') return false;
  
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
  return ALLOWED_DOMAINS.some(allowed => 
    cleanDomain === allowed || cleanDomain.endsWith(`.${allowed}`)
  );
}

/**
 * Safely creates test IDs by sanitizing input
 */
export function sanitizeTestId(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric chars with dashes
    .replace(/-+/g, '-')          // Collapse multiple dashes
    .replace(/^-+|-+$/g, '');     // Remove leading/trailing dashes
}

/**
 * Sanitizes text content to prevent XSS
 */
export function sanitizeTextContent(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/[<>'"&]/g, char => {
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#x27;';
        case '&': return '&amp;';
        default: return char;
      }
    })
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Safe window reload that prevents malicious redirects
 */
export function safeReload(): void {
  // Only reload if we're on the same domain
  if (window.location.hostname && isDomainAllowed(window.location.hostname)) {
    window.location.reload();
  }
}
import type { Request, Response, NextFunction, Express } from "express";
import crypto from 'crypto';
import { db } from './db';
import { sql } from 'drizzle-orm';

// Rate limiting store
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

// Enhanced rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200, // Increased for better UX while maintaining security
  message: "Too many requests from this IP, please try again later.",
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

const STRICT_RATE_LIMIT_CONFIG = {
  windowMs: 5 * 60 * 1000, // 5 minutes for sensitive endpoints
  maxRequests: 15, // Slightly increased for better usability
  message: "Rate limit exceeded for this endpoint, please try again later.",
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

// API-specific rate limits for better granular control
const API_RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // Auth attempts
  deals: { windowMs: 60 * 1000, maxRequests: 30 }, // Deal submissions
  upload: { windowMs: 60 * 1000, maxRequests: 10 }, // File uploads
  ai: { windowMs: 60 * 1000, maxRequests: 20 }, // AI analysis requests
};

// Data encryption utilities for sensitive information
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

export class DataEncryption {
  /**
   * Encrypt sensitive data like financial information, property details
   */
  static encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Hash sensitive data that doesn't need to be decrypted (like emails for lookups)
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

/**
 * Enhanced rate limiting middleware with API-specific controls
 */
export function createApiRateLimit(apiType: keyof typeof API_RATE_LIMITS) {
  const config = API_RATE_LIMITS[apiType];
  return rateLimit({
    ...RATE_LIMIT_CONFIG,
    ...config
  });
}

/**
 * Enhanced audit logging for compliance
 */
export class AuditLogger {
  static async logSecurityEvent(event: {
    type: 'login' | 'logout' | 'failed_auth' | 'permission_denied' | 'data_access' | 'data_modification';
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: any;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    try {
      await db.execute(sql`
        INSERT INTO audit_logs (
          event_type, user_id, ip_address, user_agent, 
          details, severity, timestamp
        ) VALUES (
          ${event.type}, ${event.userId || null}, ${event.ipAddress || null}, 
          ${event.userAgent || null}, ${JSON.stringify(event.details || {})}, 
          ${event.severity || 'medium'}, ${new Date().toISOString()}
        )
      `);
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  static async logDataAccess(table: string, operation: 'read' | 'write' | 'delete', userId?: string, recordId?: string) {
    await this.logSecurityEvent({
      type: 'data_access',
      userId,
      details: { table, operation, recordId },
      severity: operation === 'delete' ? 'high' : 'medium'
    });
  }
}

/**
 * Enhanced session management with security optimizations
 */
export function optimizeSessionSecurity() {
  return {
    name: 'connect.sid',
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on activity
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict' as const
    },
    // Enhanced session store configuration
    store: {
      // Connection pooling optimization
      maxConnsPerPool: 25,
      createTimeoutMillis: 3000,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    }
  };
}

// Endpoints exempt from rate limiting (status polling, health checks)
const RATE_LIMIT_EXEMPT_PATHS = [
  '/api/classification-progress',
  '/api/health',
  '/_health',
];

/**
 * Rate limiting middleware
 */
export function rateLimit(config = RATE_LIMIT_CONFIG) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting for exempt paths (frequently polled status endpoints)
    if (RATE_LIMIT_EXEMPT_PATHS.some(path => req.path === path || req.path.startsWith(path))) {
      return next();
    }
    
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    
    // Clean up expired entries
    if (rateLimitStore[key] && now > rateLimitStore[key].resetTime) {
      delete rateLimitStore[key];
    }
    
    // Initialize or increment counter
    if (!rateLimitStore[key]) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + config.windowMs,
      };
    } else {
      rateLimitStore[key].count++;
    }
    
    // Check if limit exceeded
    if (rateLimitStore[key].count > config.maxRequests) {
      res.status(429).json({
        error: config.message,
        retryAfter: Math.ceil((rateLimitStore[key].resetTime - now) / 1000),
      });
      return;
    }
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': (config.maxRequests - rateLimitStore[key].count).toString(),
      'X-RateLimit-Reset': new Date(rateLimitStore[key].resetTime).toISOString(),
    });
    
    next();
  };
}

/**
 * Strict rate limiting for sensitive endpoints
 */
export const strictRateLimit = rateLimit(STRICT_RATE_LIMIT_CONFIG);

/**
 * Input sanitization middleware
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  
  next();
}

/**
 * Fields that contain intentional HTML and should not have angle brackets stripped
 * These are sanitized on render rather than on input
 */
const HTML_EXEMPT_FIELDS = [
  'signatureHtml',
  'content',  // Email/SMS template content
  'html',
  'htmlContent',
  'transcriptText'  // Pipeline review transcript content
];

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any, parentKey?: string): any {
  if (typeof obj === 'string') {
    // Skip stripping angle brackets for known HTML fields
    if (parentKey && HTML_EXEMPT_FIELDS.includes(parentKey)) {
      return sanitizeHtmlField(obj);
    }
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, parentKey));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, key);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Sanitize HTML fields - preserve angle brackets but remove dangerous content
 */
function sanitizeHtmlField(str: string): string {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Sanitize string input to prevent XSS and injection attacks
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/<\s*script\b[^>]*>/gi, '') // Remove opening script tags
    .replace(/<\s*\/\s*script\s*>/gi, '') // Remove closing script tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters but preserve \n (\x0A) and \r (\x0D)
    .trim();
}

/**
 * SQL injection prevention middleware
 */
export function preventSQLInjection(req: Request, res: Response, next: NextFunction) {
  // Whitelist for OAuth callback paths - these contain authorization codes with special characters
  const oauthPaths = [
    '/api/oauth/microsoft/callback',
    '/api/auth/callback',
    '/api/oauth/callback'
  ];
  
  // Skip SQL injection check for OAuth callbacks (authorization codes contain URL-encoded chars)
  const requestPath = req.path || req.originalUrl?.split('?')[0] || '';
  if (oauthPaths.some(oauthPath => requestPath === oauthPath || requestPath.endsWith(oauthPath))) {
    return next();
  }
  
  // Also skip for OAuth code query parameter specifically
  if (req.query && req.query.code && (requestPath.includes('oauth') || requestPath.includes('callback'))) {
    return next();
  }
  
  // Whitelist for legitimate operation names
  const legitimateOperations = [
    'approve-all', 'reject-all', 'review-all', 'delete-all', 'auto-fill-all',
    'pursuing', 'reviewing', 'passed', 'under_review', 'high_priority', 'clear_no'
  ];

  // More contextual SQL injection patterns - looking for actual SQL structure, not just keywords
  const sqlPatterns = [
    /\bselect\b\s+.+\bfrom\b/gi,                           // SELECT ... FROM
    /\binsert\b\s+into\b/gi,                               // INSERT INTO
    /\bupdate\b\s+\w+\s+\bset\b/gi,                       // UPDATE table SET
    /\bdelete\b\s+\bfrom\b/gi,                            // DELETE FROM
    /\b(drop|create|alter)\b\s+\b(table|database|schema|function|procedure|index)\b/gi, // DDL commands
    /\bunion\b\s+\bselect\b/gi,                           // UNION SELECT
    /;\s*(select|insert|update|delete|drop|create|alter|exec)\b/gi, // Statement chaining
    /(--|\/\*)/g,                                         // SQL comments
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,                    // OR 1=1 type attacks
    /(\bor\s+1\s*=\s*1\b)/gi,                            // OR 1=1 variations
    /(%27|%22|%3B|%3C|%3E)/g,                            // URL encoded dangerous chars
  ];
  
  function checkForSQLInjection(obj: any, path = ''): string | null {
    if (typeof obj === 'string') {
      // Skip SQL injection check for whitelisted operation values
      if (path === 'body.operation' && legitimateOperations.includes(obj.toLowerCase())) {
        return null; // Allow legitimate operations
      }
      
      // Skip SQL injection check for email template content and HTML signature fields
      if (path.includes('emailTemplates') || path.includes('smsTemplates') || 
          path.includes('signatureHtml') || path.includes('signature_html') ||
          path.includes('htmlContent') || path.includes('emailBody')) {
        return null; // Allow template/signature HTML content without SQL injection checks
      }
      
      // Skip check for simple alphanumeric-with-hyphen values (like operation names)
      if (/^[\w-]{1,64}$/.test(obj) && obj.length <= 64) {
        // Only scan these if they contain suspicious SQL patterns beyond just keywords
        const hasStructuralSQLPattern = [
          /\bselect\b\s+.+\bfrom\b/gi,
          /\binsert\b\s+into\b/gi,
          /\bunion\b\s+\bselect\b/gi,
          /;\s*(select|insert|update|delete)/gi
        ].some(pattern => pattern.test(obj));
        
        if (!hasStructuralSQLPattern) {
          return null; // Skip simple operation names
        }
      }
      
      // Check against SQL patterns
      for (const pattern of sqlPatterns) {
        if (pattern.test(obj)) {
          return `${path}: Potential SQL injection detected`;
        }
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const result = checkForSQLInjection(obj[i], `${path}[${i}]`);
        if (result) return result;
      }
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const result = checkForSQLInjection(value, path ? `${path}.${key}` : key);
        if (result) return result;
      }
    }
    return null;
  }
  
  // Check request body
  if (req.body) {
    const sqlInjection = checkForSQLInjection(req.body, 'body');
    if (sqlInjection) {
      res.status(400).json({
        error: 'Invalid input detected',
        details: sqlInjection,
      });
      return;
    }
  }
  
  // Check query parameters
  if (req.query) {
    const sqlInjection = checkForSQLInjection(req.query, 'query');
    if (sqlInjection) {
      res.status(400).json({
        error: 'Invalid query parameters detected',
        details: sqlInjection,
      });
      return;
    }
  }
  
  next();
}

/**
 * XSS protection middleware
 */
export function xssProtection(req: Request, res: Response, next: NextFunction) {
  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self'; object-src 'none'; frame-src https://www.google.com; child-src https://www.google.com; worker-src 'self'; manifest-src 'self';",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  });
  
  next();
}

/**
 * CORS configuration
 */
export function setupCORS(app: Express) {
  const allowedOrigins = [
    'https://landlinq.ai',
    'https://landlinq--landlinq.repl.co',
    process.env.REPLIT_DOMAINS?.split(',').map(domain => `https://${domain}`) || [],
  ].flat().filter(Boolean);
  
  // Add localhost for development
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:5000');
  }
  
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin as string)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
}

/**
 * Input validation utilities
 */
interface ValidationError {
  field: string;
  message: string;
}

function validateString(value: any, field: string, minLength = 1, maxLength = 1000): ValidationError | null {
  if (typeof value !== 'string') {
    return { field, message: `${field} must be a string` };
  }
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    return { field, message: `${field} must be at least ${minLength} characters` };
  }
  if (trimmed.length > maxLength) {
    return { field, message: `${field} must be no more than ${maxLength} characters` };
  }
  return null;
}

function validateEmail(value: any, field: string): ValidationError | null {
  if (typeof value !== 'string') {
    return { field, message: `${field} must be a string` };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { field, message: `${field} must be a valid email address` };
  }
  return null;
}

function validateNumber(value: any, field: string, min?: number, max?: number): ValidationError | null {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { field, message: `${field} must be a number` };
  }
  if (min !== undefined && num < min) {
    return { field, message: `${field} must be at least ${min}` };
  }
  if (max !== undefined && num > max) {
    return { field, message: `${field} must be no more than ${max}` };
  }
  return null;
}

function validateBoolean(value: any, field: string): ValidationError | null {
  if (typeof value !== 'boolean') {
    return { field, message: `${field} must be a boolean` };
  }
  return null;
}

/**
 * Deal submission validation
 */
export function validateDealSubmission(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  
  // Handle both JSON and multipart form-data requests
  let bodyData = req.body;
  if (req.body.dealData) {
    try {
      bodyData = JSON.parse(req.body.dealData);
    } catch (e) {
      errors.push({ field: 'dealData', message: 'Invalid deal data format' });
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }
  }
  
  const { address, askingPrice, sizeAcres, zoning, sewerAvailable, brokerNotes, submissionMethod } = bodyData;

  // Address is required - check if missing first
  if (!address || address.trim() === '') {
    errors.push({ field: 'address', message: 'Property address is required' });
  } else {
    const addressError = validateString(address, 'address', 5, 500);
    if (addressError) errors.push(addressError);
  }

  // Optional fields with validation when provided
  if (askingPrice !== undefined && askingPrice !== '') {
    const priceError = validateNumber(parseFloat(askingPrice), 'askingPrice', 0, 100000000);
    if (priceError) errors.push(priceError);
  }

  if (sizeAcres !== undefined && sizeAcres !== '') {
    const sizeValue = typeof sizeAcres === 'string' ? parseFloat(sizeAcres) : sizeAcres;
    const sizeError = validateNumber(sizeValue, 'sizeAcres', 0.1, 10000);
    if (sizeError) errors.push(sizeError);
  }

  if (zoning !== undefined && zoning !== '') {
    const zoningError = validateString(zoning, 'zoning', 1, 50);
    if (zoningError) errors.push(zoningError);
  }

  if (sewerAvailable !== undefined) {
    const sewerError = validateBoolean(sewerAvailable, 'sewerAvailable');
    if (sewerError) errors.push(sewerError);
  }

  if (brokerNotes !== undefined && brokerNotes !== '') {
    const notesError = validateString(brokerNotes, 'brokerNotes', 0, 2000);
    if (notesError) errors.push(notesError);
  }

  if (errors.length > 0) {
    res.status(400).json({ error: 'Validation failed', details: errors });
    return;
  }

  next();
}

/**
 * Broker registration validation
 */
export function validateBrokerRegistration(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  const { name, email, phone, company, licenseNumber } = req.body;

  const nameError = validateString(name, 'name', 2, 100);
  if (nameError) errors.push(nameError);

  const emailError = validateEmail(email, 'email');
  if (emailError) errors.push(emailError);

  const phoneError = validateString(phone, 'phone', 10, 20);
  if (phoneError) errors.push(phoneError);

  const companyError = validateString(company, 'company', 2, 200);
  if (companyError) errors.push(companyError);

  if (licenseNumber !== undefined) {
    const licenseError = validateString(licenseNumber, 'licenseNumber', 0, 50);
    if (licenseError) errors.push(licenseError);
  }

  if (errors.length > 0) {
    res.status(400).json({ error: 'Validation failed', details: errors });
    return;
  }

  next();
}

/**
 * User authentication validation
 */
export function validateUserAuth(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  const { email, password } = req.body;

  const emailError = validateEmail(email, 'email');
  if (emailError) errors.push(emailError);

  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    errors.push({ field: 'password', message: 'Password must be 8-128 characters' });
  } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain lowercase, uppercase, and digit' });
  }

  if (errors.length > 0) {
    res.status(400).json({ error: 'Validation failed', details: errors });
    return;
  }

  next();
}

/**
 * Analyst update validation
 */
export function validateAnalystUpdate(req: Request, res: Response, next: NextFunction) {
  const errors: ValidationError[] = [];
  const { classification, notes, priority } = req.body;

  if (!['green', 'yellow', 'red'].includes(classification)) {
    errors.push({ field: 'classification', message: 'Classification must be green, yellow, or red' });
  }

  if (notes !== undefined) {
    const notesError = validateString(notes, 'notes', 0, 2000);
    if (notesError) errors.push(notesError);
  }

  if (priority !== undefined && !['low', 'medium', 'high', 'critical'].includes(priority)) {
    errors.push({ field: 'priority', message: 'Priority must be low, medium, high, or critical' });
  }

  if (errors.length > 0) {
    res.status(400).json({ error: 'Validation failed', details: errors });
    return;
  }

  next();
}

/**
 * Environment variable security validation
 */
export function validateEnvironmentVariables() {
  const requiredVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate session secret strength
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    console.warn('SESSION_SECRET should be at least 32 characters long for security');
  }
  
  // Ensure sensitive variables aren't accidentally exposed
  const sensitiveVars = ['SESSION_SECRET', 'DATABASE_URL', 'OPENAI_API_KEY'];
  sensitiveVars.forEach(varName => {
    if (process.env[varName] && process.env.NODE_ENV === 'development') {
      console.log(`✓ ${varName} is properly configured`);
    }
  });
}

/**
 * Security audit logging
 */
export function logSecurityEvent(event: string, details: any, req?: Request) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details,
    ip: req?.ip,
    userAgent: req?.headers['user-agent'],
    url: req?.url,
    method: req?.method,
  };
  
  console.warn('[SECURITY]', JSON.stringify(logEntry));
}

/**
 * Comprehensive security middleware setup
 */
export function setupSecurity(app: Express) {
  // Validate environment variables
  validateEnvironmentVariables();
  
  // Setup CORS
  setupCORS(app);
  
  // Apply security headers to all routes
  app.use(xssProtection);
  
  // Apply input sanitization to all routes
  app.use(sanitizeInput);
  
  // Apply SQL injection prevention to all routes
  app.use(preventSQLInjection);
  
  // Apply general rate limiting to all routes
  app.use(rateLimit());
  
  console.log('✅ Security middleware initialized');
}
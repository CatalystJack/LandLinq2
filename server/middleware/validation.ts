import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { errorLogger } from '../monitoring/errorLogger';

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
  skipEmptyBody?: boolean;
}

/**
 * Comprehensive input validation middleware
 */
export function validateRequest(options: ValidationOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId;
    const validationErrors: string[] = [];

    try {
      // Validate request body
      if (options.body) {
        if (!options.skipEmptyBody || Object.keys(req.body || {}).length > 0) {
          const bodyResult = options.body.safeParse(req.body);
          if (!bodyResult.success) {
            validationErrors.push(`Body validation failed: ${bodyResult.error.issues.map(i => i.message).join(', ')}`);
          } else {
            req.body = bodyResult.data;
          }
        }
      }

      // Validate query parameters
      if (options.query) {
        const queryResult = options.query.safeParse(req.query);
        if (!queryResult.success) {
          validationErrors.push(`Query validation failed: ${queryResult.error.issues.map(i => i.message).join(', ')}`);
        } else {
          req.query = queryResult.data;
        }
      }

      // Validate URL parameters
      if (options.params) {
        const paramsResult = options.params.safeParse(req.params);
        if (!paramsResult.success) {
          validationErrors.push(`Params validation failed: ${paramsResult.error.issues.map(i => i.message).join(', ')}`);
        } else {
          req.params = paramsResult.data;
        }
      }

      // Validate headers
      if (options.headers) {
        const headersResult = options.headers.safeParse(req.headers);
        if (!headersResult.success) {
          validationErrors.push(`Headers validation failed: ${headersResult.error.issues.map(i => i.message).join(', ')}`);
        }
      }

      if (validationErrors.length > 0) {
        errorLogger.logWarning('Request validation failed', {
          requestId,
          endpoint: req.path,
          method: req.method,
          errors: validationErrors,
          body: req.body,
          query: req.query,
          params: req.params
        });

        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors,
          requestId
        });
      }

      next();
    } catch (error) {
      errorLogger.logError('Validation middleware error', error as Error, {
        requestId,
        endpoint: req.path,
        method: req.method
      });

      res.status(500).json({
        error: 'Validation error',
        requestId
      });
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),
  
  // Email validation
  email: z.string().email('Invalid email format').toLowerCase(),
  
  // Phone validation
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format'),
  
  // Pagination
  pagination: z.object({
    page: z.string().transform(val => Math.max(1, parseInt(val) || 1)),
    limit: z.string().transform(val => Math.min(100, Math.max(1, parseInt(val) || 20)))
  }),
  
  // Deal submission validation
  dealSubmission: z.object({
    address: z.string().min(1, 'Property address is required'),
    askingPrice: z.string().regex(/^\d+(\.\d{2})?$/, 'Invalid price format').optional(),
    sizeAcres: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid acreage format').optional(),
    zoning: z.string().optional(),
    sewerAvailable: z.boolean().optional(),
    brokerId: z.string().min(1, 'Broker ID is required').optional()
  }),
  
  // Broker registration validation
  brokerRegistration: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email format'),
    phone: z.string().min(1, 'Phone number is required'),
    company: z.string().min(1, 'Company name is required'),
    licenseNumber: z.string().optional(),
    marketsCovered: z.string().optional(),
    preferredContact: z.enum(['email', 'sms', 'phone']).default('email')
  }),
  
  // Settings update validation
  settingsUpdate: z.object({
    acquisitionCriteria: z.array(z.any()).optional(),
    emailTemplates: z.record(z.any()).optional(),
    teamMembers: z.array(z.string().email()).optional()
  })
};

/**
 * Sanitize input data
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'"
  ].join('; '));

  next();
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  
  next();
}
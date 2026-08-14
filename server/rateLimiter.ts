import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export function createRateLimit(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) {
  const { windowMs, maxRequests, message = 'Too many requests', skipSuccessfulRequests = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${clientId}:${req.route?.path || req.path}`;
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs
      };
    } else {
      store[key].count++;
    }

    const current = store[key];
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - current.count).toString(),
      'X-RateLimit-Reset': new Date(current.resetTime).toISOString()
    });

    if (current.count > maxRequests) {
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }

    // Reset counter on successful response if option is enabled
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function(data) {
        if (res.statusCode < 400) {
          current.count = Math.max(0, current.count - 1);
        }
        return originalSend.call(this, data);
      };
    }

    next();
  };
}

// Preset rate limiters for different endpoints

// Webhook rate limiter - more generous but still prevents abuse
export const webhookRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // Allow 30 webhook requests per minute per IP
  message: 'Too many webhook requests from this IP, please try again later.',
  skipSuccessfulRequests: true
});
export const dealSubmissionLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 deal submissions per 15 minutes
  message: 'Too many deal submissions. Please wait before submitting another deal.',
  skipSuccessfulRequests: true
});

export const authLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 login attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again later.'
});

export const generalApiLimiter = createRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Too many requests. Please slow down.'
});
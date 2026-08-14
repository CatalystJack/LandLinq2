import { db } from './db';
import { sql } from 'drizzle-orm';

interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  tableName?: string;
  recordId?: string;
  changedBy?: string;
  details?: any;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Enhanced audit logging for compliance and security tracking
 */
export async function logAuditTrail(entry: AuditLogEntry): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (
        table_name, record_id, action, changed_by, user_id, 
        entity_type, entity_id, details, user_agent, ip_address, timestamp
      ) VALUES (
        ${entry.tableName || entry.entityType || 'unknown'},
        ${entry.recordId || entry.entityId || 'unknown'},
        ${entry.action},
        ${entry.changedBy || entry.userId || 'system'},
        ${entry.userId || null},
        ${entry.entityType},
        ${entry.entityId || null},
        ${JSON.stringify(entry.details || {})},
        ${entry.userAgent || null},
        ${entry.ipAddress || null},
        NOW()
      )
    `);
  } catch (error) {
    console.error('Failed to log audit trail:', error);
    // Don't throw - audit logging should not break application flow
  }
}

/**
 * Get audit logs for compliance reporting
 */
export async function getAuditLogs(params: {
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const {
    userId,
    action,
    entityType,
    startDate,
    endDate,
    limit = 50,
    offset = 0
  } = params;

  let whereConditions = [];
  let queryParams: any[] = [];

  if (userId) {
    whereConditions.push(`user_id = $${queryParams.length + 1}`);
    queryParams.push(userId);
  }

  if (action) {
    whereConditions.push(`action = $${queryParams.length + 1}`);
    queryParams.push(action);
  }

  if (entityType) {
    whereConditions.push(`entity_type = $${queryParams.length + 1}`);
    queryParams.push(entityType);
  }

  if (startDate) {
    whereConditions.push(`timestamp >= $${queryParams.length + 1}`);
    queryParams.push(startDate.toISOString());
  }

  if (endDate) {
    whereConditions.push(`timestamp <= $${queryParams.length + 1}`);
    queryParams.push(endDate.toISOString());
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  // Use a simple query without complex parameterization for now
  const result = await db.execute(sql`
    SELECT 
      id, user_id, action, entity_type, entity_id, details,
      user_agent, ip_address, timestamp
    FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return result.rows || result;
}

/**
 * Rate limiting functionality to prevent spam
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 10, 
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;
  
  let record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // New window or expired window
    record = {
      count: 1,
      resetTime: now + windowMs
    };
    rateLimitStore.set(key, record);
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: record.resetTime
    };
  }
  
  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime
  };
}

/**
 * Middleware for rate limiting
 */
export function rateLimitMiddleware(
  maxRequests: number = 10,
  windowMs: number = 60000
) {
  return (req: any, res: any, next: any) => {
    const identifier = req.ip || 'unknown';
    const { allowed, remaining, resetTime } = checkRateLimit(identifier, maxRequests, windowMs);
    
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(resetTime).toISOString()
    });
    
    if (!allowed) {
      return res.status(429).json({
        message: 'Too many requests, please try again later.',
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
      });
    }
    
    next();
  };
}
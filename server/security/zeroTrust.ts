import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { AuditLogger } from "../security";
import crypto from 'crypto';

/**
 * Zero Trust Security Architecture
 * Never trust, always verify - Enterprise security model
 */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  ANALYST = 'analyst',
  BROKER = 'broker',
  VIEWER = 'viewer'
}

export enum Permission {
  // Deal permissions
  CREATE_DEAL = 'create_deal',
  READ_DEAL = 'read_deal',
  UPDATE_DEAL = 'update_deal',
  DELETE_DEAL = 'delete_deal',
  ANALYZE_DEAL = 'analyze_deal',
  
  // Broker permissions
  MANAGE_BROKERS = 'manage_brokers',
  VIEW_BROKER_ANALYTICS = 'view_broker_analytics',
  
  // System permissions
  SYSTEM_ADMIN = 'system_admin',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_USERS = 'manage_users',
  
  // Financial permissions
  VIEW_COMMISSIONS = 'view_commissions',
  MANAGE_COMMISSIONS = 'manage_commissions',
  
  // AI permissions
  ACCESS_AI_ANALYSIS = 'access_ai_analysis',
  CONFIGURE_AI_SETTINGS = 'configure_ai_settings'
}

interface SecurityContext {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  mfaVerified: boolean;
  lastActivity: Date;
  riskScore: number;
}

export class ZeroTrustManager {
  private static readonly RISK_THRESHOLDS = {
    LOW: 30,
    MEDIUM: 60,
    HIGH: 80,
    CRITICAL: 95
  };

  private static readonly ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    [UserRole.SUPER_ADMIN]: Object.values(Permission),
    [UserRole.ADMIN]: [
      Permission.CREATE_DEAL, Permission.READ_DEAL, Permission.UPDATE_DEAL, Permission.DELETE_DEAL,
      Permission.ANALYZE_DEAL, Permission.MANAGE_BROKERS, Permission.VIEW_BROKER_ANALYTICS,
      Permission.VIEW_AUDIT_LOGS, Permission.MANAGE_USERS, Permission.VIEW_COMMISSIONS,
      Permission.MANAGE_COMMISSIONS, Permission.ACCESS_AI_ANALYSIS, Permission.CONFIGURE_AI_SETTINGS
    ],
    [UserRole.ANALYST]: [
      Permission.CREATE_DEAL, Permission.READ_DEAL, Permission.UPDATE_DEAL,
      Permission.ANALYZE_DEAL, Permission.VIEW_BROKER_ANALYTICS, Permission.VIEW_COMMISSIONS,
      Permission.ACCESS_AI_ANALYSIS
    ],
    [UserRole.BROKER]: [
      Permission.CREATE_DEAL, Permission.READ_DEAL, Permission.UPDATE_DEAL,
      Permission.VIEW_COMMISSIONS, Permission.ACCESS_AI_ANALYSIS
    ],
    [UserRole.VIEWER]: [
      Permission.READ_DEAL, Permission.VIEW_BROKER_ANALYTICS
    ]
  };

  /**
   * Create security context for user
   */
  static async createSecurityContext(req: Request): Promise<SecurityContext | null> {
    const userId = (req.session as any)?.user?.id;
    if (!userId) return null;

    const userData = await this.getUserSecurityData(userId);
    if (!userData) return null;

    const riskScore = await this.calculateRiskScore(req, userData);
    
    return {
      userId,
      role: userData.role,
      permissions: this.ROLE_PERMISSIONS[userData.role] || [],
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: req.sessionID,
      mfaVerified: userData.mfaVerified,
      lastActivity: new Date(),
      riskScore
    };
  }

  /**
   * Verify permission for action
   */
  static async verifyPermission(
    context: SecurityContext,
    requiredPermission: Permission,
    resourceId?: string
  ): Promise<boolean> {
    // Check basic permission
    if (!context.permissions.includes(requiredPermission)) {
      await AuditLogger.logSecurityEvent({
        type: 'permission_denied',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { permission: requiredPermission, resourceId },
        severity: 'medium'
      });
      return false;
    }

    // Risk-based access control
    if (context.riskScore > this.RISK_THRESHOLDS.HIGH) {
      await AuditLogger.logSecurityEvent({
        type: 'permission_denied',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { 
          permission: requiredPermission, 
          resourceId,
          reason: 'high_risk_score',
          riskScore: context.riskScore
        },
        severity: 'high'
      });
      return false;
    }

    // MFA requirement for sensitive operations
    const sensitivePermissions = [
      Permission.DELETE_DEAL,
      Permission.SYSTEM_ADMIN,
      Permission.MANAGE_USERS,
      Permission.MANAGE_COMMISSIONS
    ];

    if (sensitivePermissions.includes(requiredPermission) && !context.mfaVerified) {
      await AuditLogger.logSecurityEvent({
        type: 'permission_denied',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { 
          permission: requiredPermission, 
          resourceId,
          reason: 'mfa_required'
        },
        severity: 'high'
      });
      return false;
    }

    // Resource-level access control
    if (resourceId && !await this.verifyResourceAccess(context, requiredPermission, resourceId)) {
      return false;
    }

    // Log successful access
    await AuditLogger.logSecurityEvent({
      type: 'data_access',
      userId: context.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { permission: requiredPermission, resourceId },
      severity: 'low'
    });

    return true;
  }

  /**
   * Calculate risk score based on multiple factors
   */
  private static async calculateRiskScore(req: Request, userData: any): Promise<number> {
    let riskScore = 0;

    // IP-based risk
    const ipRisk = await this.calculateIPRisk(req.ip || '127.0.0.1');
    riskScore += ipRisk;

    // Time-based risk (unusual hours)
    const timeRisk = this.calculateTimeRisk();
    riskScore += timeRisk;

    // Device fingerprint risk
    const deviceRisk = await this.calculateDeviceRisk(req);
    riskScore += deviceRisk;

    // Behavioral risk
    const behaviorRisk = await this.calculateBehaviorRisk(userData.userId);
    riskScore += behaviorRisk;

    // Geographic risk
    const geoRisk = await this.calculateGeographicRisk(req.ip || '127.0.0.1', userData.userId);
    riskScore += geoRisk;

    return Math.min(riskScore, 100); // Cap at 100
  }

  /**
   * IP reputation and geolocation risk
   */
  private static async calculateIPRisk(ip: string): Promise<number> {
    // Check against known threat databases
    const threatIntel = await this.checkThreatIntelligence(ip);
    if (threatIntel.isMalicious) return 50;

    // Check if IP is from VPN/Proxy
    if (threatIntel.isProxy) return 20;

    // Check rate limiting violations
    const recentViolations = await this.getRecentRateLimitViolations(ip);
    return Math.min(recentViolations * 5, 25);
  }

  /**
   * Time-based risk assessment
   */
  private static calculateTimeRisk(): number {
    const hour = new Date().getHours();
    // Higher risk for unusual business hours (9 PM - 6 AM)
    if (hour >= 21 || hour <= 6) return 15;
    return 0;
  }

  /**
   * Device fingerprinting risk
   */
  private static async calculateDeviceRisk(req: Request): Promise<number> {
    const userAgent = req.headers['user-agent'] || '';
    const fingerprint = crypto.createHash('md5')
      .update(userAgent + (req.headers['accept-language'] || ''))
      .digest('hex');

    // Check if device is new/unknown
    const isKnownDevice = await this.isKnownDevice(fingerprint);
    return isKnownDevice ? 0 : 20;
  }

  /**
   * Behavioral risk analysis
   */
  private static async calculateBehaviorRisk(userId: string): Promise<number> {
    // Analyze recent activity patterns
    const recentActivity = await this.getRecentUserActivity(userId);
    
    // Check for unusual patterns
    if (recentActivity.unusualVelocity) return 25;
    if (recentActivity.suspiciousPatterns) return 30;
    
    return 0;
  }

  /**
   * Geographic risk assessment
   */
  private static async calculateGeographicRisk(ip: string, userId: string): Promise<number> {
    // Compare current location with user's typical locations
    const currentLocation = await this.getLocationFromIP(ip);
    const userLocations = await this.getUserTypicalLocations(userId);
    
    if (userLocations.length === 0) return 10; // New user
    
    const isNewLocation = !userLocations.some(loc => 
      this.calculateDistance(currentLocation, loc) < 100 // 100km threshold
    );
    
    return isNewLocation ? 25 : 0;
  }

  // Helper methods (simplified implementations)
  private static async getUserSecurityData(userId: string) {
    try {
      const result = await db.execute(sql`
        SELECT u.id, u.role
        FROM users u
        WHERE u.id = ${userId}
      `);
      
      const rows = Array.isArray(result) ? result : result.rows || [];
      if (rows.length === 0) {
        console.log(`⚠️ [SECURITY] No user found for userId: ${userId}`);
        return null;
      }
      
      const row = rows[0] as any;
      
      // Map database role format to UserRole enum format
      const roleMapping: Record<string, UserRole> = {
        'SUPER_ADMIN': UserRole.SUPER_ADMIN,
        'ADMIN': UserRole.ADMIN,
        'ANALYST': UserRole.ANALYST,
        'BROKER': UserRole.BROKER,
        'VIEWER': UserRole.VIEWER,
        // Fallback for any unmapped roles
        'super_admin': UserRole.SUPER_ADMIN,
        'admin': UserRole.ADMIN,
        'analyst': UserRole.ANALYST,
        'broker': UserRole.BROKER,
        'viewer': UserRole.VIEWER
      };
      
      const mappedRole = roleMapping[row.role] || UserRole.BROKER; // Default to BROKER if role not found
      
      return {
        userId: row.id,
        role: mappedRole,
        mfaVerified: false // Default to false since MFA table doesn't exist yet
      };
    } catch (error) {
      console.error(`🚨 [SECURITY] Database error in getUserSecurityData:`, error);
      // Return default security data to prevent login failures
      return {
        userId: userId,
        role: UserRole.BROKER,
        mfaVerified: false
      };
    }
  }

  private static async verifyResourceAccess(context: SecurityContext, permission: Permission, resourceId: string): Promise<boolean> {
    // Implement resource-level access control based on ownership, hierarchy, etc.
    // For now, return true - would be implemented based on specific resource types
    return true;
  }

  private static async checkThreatIntelligence(ip: string) {
    // Placeholder - would integrate with threat intelligence APIs
    return { isMalicious: false, isProxy: false };
  }

  private static async getRecentRateLimitViolations(ip: string): Promise<number> {
    // Check recent rate limit violations for this IP
    return 0;
  }

  private static async isKnownDevice(fingerprint: string): Promise<boolean> {
    // Check if device fingerprint is known
    return true;
  }

  private static async getRecentUserActivity(userId: string) {
    // Analyze recent user activity for behavioral patterns
    return { unusualVelocity: false, suspiciousPatterns: false };
  }

  private static async getLocationFromIP(ip: string) {
    // Get geolocation from IP
    return { latitude: 0, longitude: 0 };
  }

  private static async getUserTypicalLocations(userId: string) {
    // Get user's typical login locations
    return [];
  }

  private static calculateDistance(loc1: any, loc2: any): number {
    // Calculate distance between two coordinates
    return 0;
  }
}

/**
 * Zero Trust middleware
 */
export function zeroTrustMiddleware(requiredPermission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ZeroTrustManager.createSecurityContext(req);
      
      if (!context) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasPermission = await ZeroTrustManager.verifyPermission(context, requiredPermission);
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Add context to request for use in route handlers
      (req as any).securityContext = context;
      next();
    } catch (error) {
      console.error('Zero Trust verification error:', error);
      res.status(500).json({ error: 'Security verification failed' });
    }
  };
}
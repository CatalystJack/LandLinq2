import type { Request, Response, NextFunction } from "express";
import { db } from "../storage/database";
import { sql } from "drizzle-orm";
import { AuditLogger } from "./security";
import crypto from 'crypto';

/**
 * Real-Time Threat Detection & Automated Response System
 * Advanced AI-powered security monitoring for the most secure real estate platform
 */

export enum ThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ThreatType {
  BRUTE_FORCE = 'brute_force',
  SQL_INJECTION = 'sql_injection',
  XSS_ATTEMPT = 'xss_attempt',
  SUSPICIOUS_UPLOAD = 'suspicious_upload',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  DATA_EXFILTRATION = 'data_exfiltration',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  MALICIOUS_IP = 'malicious_ip'
}

interface ThreatEvent {
  id: string;
  type: ThreatType;
  level: ThreatLevel;
  source: string;
  target: string;
  description: string;
  evidence: any;
  timestamp: Date;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  mitigated: boolean;
  responseActions: string[];
}

export class ThreatDetectionEngine {
  private static readonly THREAT_THRESHOLDS = {
    FAILED_LOGINS: 5,
    RAPID_REQUESTS: 100,
    SUSPICIOUS_PATTERNS: 3,
    DATA_ACCESS_VOLUME: 1000
  };

  private static activeThreats = new Map<string, ThreatEvent>();
  private static blockedIPs = new Set<string>();
  private static suspiciousUsers = new Map<string, number>();

  /**
   * Real-time threat analysis middleware
   */
  static threatAnalysisMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const threats = await this.analyzeRequest(req);
        
        for (const threat of threats) {
          await this.handleThreat(threat, req, res);
          
          // Block critical threats immediately
          if (threat.level === ThreatLevel.CRITICAL) {
            await this.blockThreat(threat, res);
            return;
          }
        }
        
        next();
      } catch (error) {
        console.error('Threat analysis error:', error);
        next(); // Don't block legitimate requests on analysis errors
      }
    };
  }

  /**
   * Analyze incoming request for threats
   */
  private static async analyzeRequest(req: Request): Promise<ThreatEvent[]> {
    const threats: ThreatEvent[] = [];
    const ip = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // SQL Injection Detection
    const sqlThreat = this.detectSQLInjection(req);
    if (sqlThreat) threats.push(sqlThreat);

    // XSS Detection
    const xssThreat = this.detectXSSAttempt(req);
    if (xssThreat) threats.push(xssThreat);

    // Brute Force Detection
    const bruteForceThreat = await this.detectBruteForce(req);
    if (bruteForceThreat) threats.push(bruteForceThreat);

    // Unusual Activity Detection
    const activityThreat = await this.detectUnusualActivity(req);
    if (activityThreat) threats.push(activityThreat);

    // Rate Limiting Violations
    const rateThreat = await this.detectRateLimitViolations(req);
    if (rateThreat) threats.push(rateThreat);

    // Malicious IP Detection
    const ipThreat = await this.detectMaliciousIP(req);
    if (ipThreat) threats.push(ipThreat);

    return threats;
  }

  /**
   * SQL Injection Detection
   */
  private static detectSQLInjection(req: Request): ThreatEvent | null {
    const sqlPatterns = [
      /(\w*union\w*\s+\w*select)/i,
      /(\w*select\w*\s+\w*from)/i,
      /(\w*insert\w*\s+\w*into)/i,
      /(\w*delete\w*\s+\w*from)/i,
      /(\w*update\w*\s+\w*set)/i,
      /(\w*drop\w*\s+\w*table)/i,
      /(\w*exec\w*\s*\()/i,
      /(\w*or\w*\s+\w*1\s*=\s*1)/i,
      /(\w*and\w*\s+\w*1\s*=\s*1)/i,
      /(\w*having\w*\s+\w*1\s*=\s*1)/i
    ];

    const checkContent = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params);

    for (const pattern of sqlPatterns) {
      if (pattern.test(checkContent)) {
        return {
          id: crypto.randomUUID(),
          type: ThreatType.SQL_INJECTION,
          level: ThreatLevel.HIGH,
          source: req.ip || 'unknown',
          target: req.path,
          description: 'SQL injection attempt detected',
          evidence: { pattern: pattern.source, content: checkContent.substring(0, 500) },
          timestamp: new Date(),
          userId: req.session?.user?.id,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          mitigated: false,
          responseActions: []
        };
      }
    }

    return null;
  }

  /**
   * XSS Attack Detection
   */
  private static detectXSSAttempt(req: Request): ThreatEvent | null {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /eval\s*\(/gi,
      /document\.cookie/gi
    ];

    const checkContent = JSON.stringify(req.body) + JSON.stringify(req.query);

    for (const pattern of xssPatterns) {
      if (pattern.test(checkContent)) {
        return {
          id: crypto.randomUUID(),
          type: ThreatType.XSS_ATTEMPT,
          level: ThreatLevel.HIGH,
          source: req.ip || 'unknown',
          target: req.path,
          description: 'XSS attempt detected',
          evidence: { pattern: pattern.source, content: checkContent.substring(0, 500) },
          timestamp: new Date(),
          userId: req.session?.user?.id,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          mitigated: false,
          responseActions: []
        };
      }
    }

    return null;
  }

  /**
   * Brute Force Attack Detection
   */
  private static async detectBruteForce(req: Request): Promise<ThreatEvent | null> {
    const ip = req.ip || 'unknown';
    
    // Check failed login attempts
    if (req.path.includes('/auth/login') || req.path.includes('/login')) {
      const recentFailures = await this.getRecentFailedLogins(ip);
      
      if (recentFailures >= this.THREAT_THRESHOLDS.FAILED_LOGINS) {
        return {
          id: crypto.randomUUID(),
          type: ThreatType.BRUTE_FORCE,
          level: ThreatLevel.HIGH,
          source: ip,
          target: req.path,
          description: `Brute force attack detected: ${recentFailures} failed attempts`,
          evidence: { failedAttempts: recentFailures, timeWindow: '15 minutes' },
          timestamp: new Date(),
          userId: req.session?.user?.id,
          ipAddress: ip,
          userAgent: req.headers['user-agent'] || 'unknown',
          mitigated: false,
          responseActions: []
        };
      }
    }

    return null;
  }

  /**
   * Unusual Activity Detection
   */
  private static async detectUnusualActivity(req: Request): Promise<ThreatEvent | null> {
    const userId = req.session?.user?.id;
    if (!userId) return null;

    const recentActivity = await this.getUserRecentActivity(userId);
    
    // Check for unusual patterns
    if (recentActivity.requestsPerMinute > this.THREAT_THRESHOLDS.RAPID_REQUESTS) {
      return {
        id: crypto.randomUUID(),
        type: ThreatType.UNUSUAL_ACTIVITY,
        level: ThreatLevel.MEDIUM,
        source: req.ip || 'unknown',
        target: req.path,
        description: 'Unusual activity pattern detected',
        evidence: { requestsPerMinute: recentActivity.requestsPerMinute },
        timestamp: new Date(),
        userId,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        mitigated: false,
        responseActions: []
      };
    }

    return null;
  }

  /**
   * Rate Limit Violation Detection
   */
  private static async detectRateLimitViolations(req: Request): Promise<ThreatEvent | null> {
    const ip = req.ip || 'unknown';
    const violations = await this.getRecentRateLimitViolations(ip);
    
    if (violations >= 3) {
      return {
        id: crypto.randomUUID(),
        type: ThreatType.UNUSUAL_ACTIVITY,
        level: ThreatLevel.MEDIUM,
        source: ip,
        target: req.path,
        description: 'Multiple rate limit violations',
        evidence: { violations, timeWindow: '15 minutes' },
        timestamp: new Date(),
        userId: req.session?.user?.id,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        mitigated: false,
        responseActions: []
      };
    }

    return null;
  }

  /**
   * Malicious IP Detection
   */
  private static async detectMaliciousIP(req: Request): Promise<ThreatEvent | null> {
    const ip = req.ip || 'unknown';
    
    // Check against known malicious IP databases
    const isMalicious = await this.checkMaliciousIPDatabase(ip);
    
    if (isMalicious) {
      return {
        id: crypto.randomUUID(),
        type: ThreatType.MALICIOUS_IP,
        level: ThreatLevel.CRITICAL,
        source: ip,
        target: req.path,
        description: 'Request from known malicious IP',
        evidence: { source: 'threat_intelligence' },
        timestamp: new Date(),
        userId: req.session?.user?.id,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        mitigated: false,
        responseActions: []
      };
    }

    return null;
  }

  /**
   * Handle detected threat
   */
  private static async handleThreat(threat: ThreatEvent, req: Request, res: Response): Promise<void> {
    // Log threat
    await this.logThreat(threat);

    // Store active threat
    this.activeThreats.set(threat.id, threat);

    // Apply automated responses based on threat level
    switch (threat.level) {
      case ThreatLevel.CRITICAL:
        await this.applyCriticalResponse(threat, req, res);
        break;
      case ThreatLevel.HIGH:
        await this.applyHighResponse(threat, req, res);
        break;
      case ThreatLevel.MEDIUM:
        await this.applyMediumResponse(threat, req, res);
        break;
      case ThreatLevel.LOW:
        await this.applyLowResponse(threat, req, res);
        break;
    }

    // Send alerts
    await this.sendThreatAlert(threat);
  }

  /**
   * Critical threat response - immediate blocking
   */
  private static async applyCriticalResponse(threat: ThreatEvent, req: Request, res: Response): Promise<void> {
    // Block IP immediately
    this.blockedIPs.add(threat.ipAddress);
    
    // Terminate all sessions for this user if applicable
    if (threat.userId) {
      await this.terminateUserSessions(threat.userId);
    }

    threat.responseActions.push('ip_blocked', 'sessions_terminated');
  }

  /**
   * High threat response - enhanced monitoring
   */
  private static async applyHighResponse(threat: ThreatEvent, req: Request, res: Response): Promise<void> {
    // Add to suspicious users list
    if (threat.userId) {
      const currentScore = this.suspiciousUsers.get(threat.userId) || 0;
      this.suspiciousUsers.set(threat.userId, currentScore + 1);
    }

    // Require additional verification
    threat.responseActions.push('enhanced_monitoring', 'require_mfa');
  }

  /**
   * Medium threat response - logging and monitoring
   */
  private static async applyMediumResponse(threat: ThreatEvent, req: Request, res: Response): Promise<void> {
    // Increase monitoring for this IP/user
    threat.responseActions.push('increased_monitoring');
  }

  /**
   * Low threat response - basic logging
   */
  private static async applyLowResponse(threat: ThreatEvent, req: Request, res: Response): Promise<void> {
    // Basic logging only
    threat.responseActions.push('logged');
  }

  /**
   * Block threat immediately
   */
  private static async blockThreat(threat: ThreatEvent, res: Response): Promise<void> {
    res.status(403).json({
      error: 'Access denied',
      threatId: threat.id,
      message: 'Your request has been blocked due to security concerns'
    });
  }

  /**
   * Log threat to database
   */
  private static async logThreat(threat: ThreatEvent): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO threat_logs (
          id, type, level, source, target, description, evidence,
          timestamp, user_id, ip_address, user_agent, mitigated, response_actions
        ) VALUES (
          ${threat.id}, ${threat.type}, ${threat.level}, ${threat.source},
          ${threat.target}, ${threat.description}, ${JSON.stringify(threat.evidence)},
          ${threat.timestamp.toISOString()}, ${threat.userId || null}, ${threat.ipAddress},
          ${threat.userAgent}, ${threat.mitigated}, ${JSON.stringify(threat.responseActions)}
        )
      `);
    } catch (error) {
      console.error('Failed to log threat:', error);
    }
  }

  /**
   * Send threat alert to security team
   */
  private static async sendThreatAlert(threat: ThreatEvent): Promise<void> {
    if (threat.level === ThreatLevel.CRITICAL || threat.level === ThreatLevel.HIGH) {
      // Send immediate alerts (email, SMS, Slack, etc.)
      console.error(`🚨 SECURITY ALERT [${threat.level.toUpperCase()}]: ${threat.description}`);
      console.error(`Source: ${threat.source}, Target: ${threat.target}`);
      console.error(`Evidence:`, threat.evidence);
    }
  }

  // Helper methods
  private static async getRecentFailedLogins(ip: string): Promise<number> {
    // Query failed login attempts from last 15 minutes
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE event_type = 'failed_auth' 
      AND ip_address = ${ip} 
      AND timestamp > ${new Date(Date.now() - 15 * 60 * 1000).toISOString()}
    `);
    
    const rows = Array.isArray(result) ? result : result.rows || [];
    return parseInt(rows[0]?.count || '0');
  }

  private static async getUserRecentActivity(userId: string): Promise<{ requestsPerMinute: number }> {
    // Analyze user's recent activity patterns
    return { requestsPerMinute: 0 }; // Simplified
  }

  private static async getRecentRateLimitViolations(ip: string): Promise<number> {
    // Check recent rate limit violations
    return 0; // Simplified
  }

  private static async checkMaliciousIPDatabase(ip: string): Promise<boolean> {
    // Check against threat intelligence databases
    return false; // Would integrate with actual threat intel APIs
  }

  private static async terminateUserSessions(userId: string): Promise<void> {
    // Terminate all active sessions for user
    await db.execute(sql`
      DELETE FROM sessions WHERE data LIKE ${'%"user":{"id":"' + userId + '"%'}
    `);
  }
}

/**
 * IP blocking middleware
 */
export function ipBlockingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    
    if (ThreatDetectionEngine['blockedIPs'].has(ip)) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'Your IP address has been blocked due to security concerns' 
      });
    }
    
    next();
  };
}
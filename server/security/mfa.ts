import type { Request, Response, NextFunction } from "express";
import crypto from 'crypto';
import { db } from "../storage/database";
import { sql } from "drizzle-orm";

/**
 * Multi-Factor Authentication System
 * Enterprise-grade MFA for the most secure real estate platform
 */

interface MFAToken {
  id: string;
  userId: string;
  secret: string;
  backupCodes: string[];
  isVerified: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

export class MFAManager {
  private static readonly SECRET_LENGTH = 32;
  private static readonly BACKUP_CODE_COUNT = 10;
  private static readonly TOKEN_WINDOW = 30; // seconds

  /**
   * Generate TOTP secret for user
   */
  static async generateMFASecret(userId: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    const secret = crypto.randomBytes(this.SECRET_LENGTH).toString('base32');
    const backupCodes = this.generateBackupCodes();
    
    // Store in database
    await db.execute(sql`
      INSERT INTO mfa_tokens (id, user_id, secret, backup_codes, is_verified, created_at)
      VALUES (${crypto.randomUUID()}, ${userId}, ${secret}, ${JSON.stringify(backupCodes)}, false, ${new Date().toISOString()})
      ON CONFLICT (user_id) DO UPDATE SET
        secret = EXCLUDED.secret,
        backup_codes = EXCLUDED.backup_codes,
        is_verified = false,
        created_at = EXCLUDED.created_at
    `);

    const qrCodeUrl = `otpauth://totp/LandLinq:${userId}?secret=${secret}&issuer=LandLinq&algorithm=SHA1&digits=6&period=30`;
    
    return { secret, qrCodeUrl, backupCodes };
  }

  /**
   * Verify TOTP token
   */
  static async verifyMFAToken(userId: string, token: string): Promise<boolean> {
    const mfaData = await this.getMFAData(userId);
    if (!mfaData || !mfaData.isVerified) return false;

    // Check TOTP token
    if (this.verifyTOTP(mfaData.secret, token)) {
      await this.updateLastUsed(userId);
      return true;
    }

    // Check backup codes
    if (mfaData.backupCodes.includes(token)) {
      await this.consumeBackupCode(userId, token);
      return true;
    }

    return false;
  }

  /**
   * Enable MFA for user after verification
   */
  static async enableMFA(userId: string, token: string): Promise<boolean> {
    const mfaData = await this.getMFAData(userId);
    if (!mfaData) return false;

    if (this.verifyTOTP(mfaData.secret, token)) {
      await db.execute(sql`
        UPDATE mfa_tokens SET is_verified = true WHERE user_id = ${userId}
      `);
      return true;
    }

    return false;
  }

  /**
   * Generate secure backup codes
   */
  private static generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.BACKUP_CODE_COUNT; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }

  /**
   * Verify TOTP token using time-based algorithm
   */
  private static verifyTOTP(secret: string, token: string): boolean {
    const window = Math.floor(Date.now() / 1000 / this.TOKEN_WINDOW);
    
    for (let i = -1; i <= 1; i++) {
      const expectedToken = this.generateTOTP(secret, window + i);
      if (expectedToken === token) return true;
    }
    
    return false;
  }

  /**
   * Generate TOTP token
   */
  private static generateTOTP(secret: string, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buffer.writeUInt32BE(counter & 0xffffffff, 4);
    
    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base32'));
    hmac.update(buffer);
    const digest = hmac.digest();
    
    const offset = digest[digest.length - 1] & 0xf;
    const code = ((digest[offset] & 0x7f) << 24) |
                 ((digest[offset + 1] & 0xff) << 16) |
                 ((digest[offset + 2] & 0xff) << 8) |
                 (digest[offset + 3] & 0xff);
    
    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * Get MFA data for user
   */
  private static async getMFAData(userId: string): Promise<MFAToken | null> {
    const result = await db.execute(sql`
      SELECT id, user_id, secret, backup_codes, is_verified, created_at, last_used
      FROM mfa_tokens WHERE user_id = ${userId}
    `);
    
    const rows = Array.isArray(result) ? result : result.rows || [];
    if (rows.length === 0) return null;
    
    const row = rows[0] as any;
    return {
      id: row.id,
      userId: row.user_id,
      secret: row.secret,
      backupCodes: JSON.parse(row.backup_codes || '[]'),
      isVerified: row.is_verified,
      createdAt: new Date(row.created_at),
      lastUsed: row.last_used ? new Date(row.last_used) : undefined
    };
  }

  /**
   * Update last used timestamp
   */
  private static async updateLastUsed(userId: string): Promise<void> {
    await db.execute(sql`
      UPDATE mfa_tokens SET last_used = ${new Date().toISOString()} WHERE user_id = ${userId}
    `);
  }

  /**
   * Consume backup code (remove from available codes)
   */
  private static async consumeBackupCode(userId: string, code: string): Promise<void> {
    const mfaData = await this.getMFAData(userId);
    if (!mfaData) return;

    const updatedCodes = mfaData.backupCodes.filter(c => c !== code);
    await db.execute(sql`
      UPDATE mfa_tokens SET backup_codes = ${JSON.stringify(updatedCodes)} WHERE user_id = ${userId}
    `);
  }
}

/**
 * MFA middleware for protected routes
 */
export function requireMFA(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.user?.id;
  const mfaToken = req.headers['x-mfa-token'] as string;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!mfaToken) {
    return res.status(403).json({ error: 'MFA token required', requiresMFA: true });
  }

  MFAManager.verifyMFAToken(userId, mfaToken)
    .then(isValid => {
      if (isValid) {
        next();
      } else {
        res.status(403).json({ error: 'Invalid MFA token' });
      }
    })
    .catch(error => {
      console.error('MFA verification error:', error);
      res.status(500).json({ error: 'MFA verification failed' });
    });
}
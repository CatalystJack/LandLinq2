import { storage, type IStorage } from "./storage";
import { randomBytes } from "crypto";
import { addMinutes } from "date-fns";

type PasswordResetStorage = Pick<
  IStorage,
  | "getUserByEmail"
  | "getValidPasswordResetToken"
  | "createPasswordResetToken"
  | "getPasswordResetToken"
  | "deletePasswordResetToken"
  | "updateUserPassword"
>;

// Password reset token management
export class PasswordResetService {
  constructor(private readonly resetStorage: PasswordResetStorage = storage) {}

  // Generate password reset token and store it
  async generateResetToken(email: string): Promise<string | null> {
    const user = await this.resetStorage.getUserByEmail(email);
    if (!user) {
      return null; // Don't reveal if user exists
    }

    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = addMinutes(new Date(), 60); // 1 hour expiration

    await this.resetStorage.createPasswordResetToken({
      email,
      token: resetToken,
      expiresAt
    });

    // Send password reset email
    try {
      const { emailService } = await import('./emailService');
      await emailService.sendPasswordResetEmail(email, resetToken);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
    }

    return resetToken;
  }

  // Generate a reset token after a successful temporary-password login.
  // Unlike a user-requested reset, this does not send an email.
  async generateForcedResetToken(email: string): Promise<string | null> {
    const user = await this.resetStorage.getUserByEmail(email);
    if (!user) {
      return null;
    }

    // Page gates and login callbacks can both request this token repeatedly
    // while the user is completing the forced reset. Reuse the still-valid
    // token so each redirect keeps the same URL and token.
    const existingToken = await this.resetStorage.getValidPasswordResetToken(user.email);
    if (existingToken) {
      return existingToken.token;
    }

    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = addMinutes(new Date(), 60);

    await this.resetStorage.createPasswordResetToken({
      email: user.email,
      token: resetToken,
      expiresAt,
    });

    return resetToken;
  }

  // Validate reset token
  async validateResetToken(token: string): Promise<string | null> {
    const resetRequest = await this.resetStorage.getPasswordResetToken(token);
    
    if (!resetRequest) {
      return null;
    }

    if (new Date() > resetRequest.expiresAt) {
      // Clean up expired token
      await this.resetStorage.deletePasswordResetToken(token);
      return null;
    }

    return resetRequest.email;
  }

  // Reset password using token
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const email = await this.validateResetToken(token);
    if (!email) {
      return false;
    }

    const user = await this.resetStorage.getUserByEmail(email);
    if (!user) {
      return false;
    }

    // Hash and update password
    const { hashPassword } = await import('./auth');
    const hashedPassword = await hashPassword(newPassword);
    
    await this.resetStorage.updateUserPassword(user.id, hashedPassword);
    await this.resetStorage.deletePasswordResetToken(token);

    return true;
  }
}

export const passwordResetService = new PasswordResetService();
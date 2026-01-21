import db from '../models';

// Use type assertions for libraries without types
let speakeasy: any;
let QRCode: any;

export class TwoFactorService {
  // Generate a new secret for a user
  async generateSecret(userId: number, username: string): Promise<{ secret: string; qrCodeUrl: string }> {
    if (!speakeasy) {
      speakeasy = await import('speakeasy');
    }

    const secret = speakeasy.generateSecret({
      name: `Pong App (${username})`,
      issuer: 'Pong Game',
    });

    // Build otpauth URL explicitly to ensure 6-digit codes and 30s period
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.base32,
      label: `Pong App (${username})`,
      issuer: 'Pong Game',
      algorithm: 'sha1',
      digits: 6,
      period: 30,
      encoding: 'base32'
    });

    // Store the secret temporarily (user hasn't verified it yet)
    db.prepare(`
      INSERT OR REPLACE INTO user_2fa_temp (user_id, secret, created_at)
      VALUES (?, ?, datetime('now'))
    `).run(userId, secret.base32);

    return {
      secret: secret.base32,
      qrCodeUrl: otpauthUrl
    };
  }

  // Verify a TOTP token and enable 2FA if valid
  async verifyAndEnable2FA(userId: number, token: string): Promise<boolean> {
    if (!speakeasy) {
      speakeasy = await import('speakeasy');
    }

    // Get the temporary secret
    const tempSecret = db.prepare(`
      SELECT secret FROM user_2fa_temp WHERE user_id = ?
    `).get(userId);

    if (!tempSecret) {
      throw new Error('No 2FA setup in progress');
    }

    // Verify strictly against the current TOTP value (no window) so expired codes are rejected.
    // This prevents accepting previous 30s-period codes. If you need small clock-drift tolerance,
    // consider allowing window:1 but be aware it accepts previous/next codes.
    const currentToken = speakeasy.totp({ secret: tempSecret.secret, encoding: 'base32' });
    if (token === currentToken) {
      // Enable 2FA for the user
      db.prepare(`
        INSERT OR REPLACE INTO user_2fa (user_id, secret, enabled, created_at)
        VALUES (?, ?, 1, datetime('now'))
      `).run(userId, tempSecret.secret);

      // Mark 2FA enabled on users table so auth checks that column
      db.prepare(`UPDATE users SET two_factor_enabled = 1 WHERE id = ?`).run(userId);

      // Clean up temporary secret
      db.prepare(`DELETE FROM user_2fa_temp WHERE user_id = ?`).run(userId);

      return true;
    }

    return false;
  }

  // Verify a TOTP token during login
  async verifyToken(userId: number, token: string): Promise<boolean> {
    if (!speakeasy) {
      speakeasy = await import('speakeasy');
    }

    const user2FA = db.prepare(`
      SELECT secret FROM user_2fa WHERE user_id = ? AND enabled = 1
    `).get(userId);

    if (!user2FA) {
      throw new Error('2FA not enabled for user');
    }

    // Strict check against current token only (no window). Prevents accepting expired tokens.
    const currentToken = speakeasy.totp({ secret: user2FA.secret, encoding: 'base32' });
    return token === currentToken;
  }

  // (Removed) promptDisable2FA: frontend now opens the disable input box directly

  // Disable 2FA for a user — requires a valid current TOTP token to proceed
  async disable2FA(userId: number, token: string): Promise<boolean> {
    if (!speakeasy) {
      speakeasy = await import('speakeasy');
    }

    const user2FA = db.prepare(`
      SELECT secret FROM user_2fa WHERE user_id = ? AND enabled = 1
    `).get(userId);

    if (!user2FA) {
      throw new Error('2FA not enabled for user');
    }

    // Strict check against current token only (no window) so expired codes are rejected.
    const currentToken = speakeasy.totp({ secret: user2FA.secret, encoding: 'base32' });
    if (token !== currentToken) {
      return false;
    }

    // Proceed with disabling
    db.prepare(`DELETE FROM user_2fa WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM user_2fa_temp WHERE user_id = ?`).run(userId);
    // Ensure user's flag is cleared as well
    db.prepare(`UPDATE users SET two_factor_enabled = 0 WHERE id = ?`).run(userId);

    return true;
  }

  // Check if 2FA is enabled for a user
  is2FAEnabled(userId: number): boolean {
    const result = db.prepare(`
      SELECT 1 FROM user_2fa WHERE user_id = ? AND enabled = 1
    `).get(userId);
    
    return !!result;
  }

  // Generate backup codes
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push(this.generateBackupCode());
    }
    return codes;
  }

  private generateBackupCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase() + 
           Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

export const twoFactorService = new TwoFactorService();
import { authenticator } from 'otplib';
import { createHash, randomInt } from 'crypto';

/**
 * TOTP configuration options.
 */
const TOTP_OPTIONS = {
  window: 1,    // Allow a window of ±30秒 (1 time step) for clock skew.
  step: 30,     // Time step duration in seconds.
  digits: 6     // Number of digits in the generated token.
};

/**
 * Verifies a provided 2FA token using TOTP.
 *
 * @param {string} secret - The TOTP secret key.
 * @param {string} token - The token provided by the user.
 * @returns {Promise<boolean>} A promise that resolves to true if verification is successful, false otherwise.
 */
export async function verify2FAToken(
  secret: string,
  token: string
): Promise<boolean> {
  try {
    // Set TOTP options. This could be set globally during application startup.
    authenticator.options = TOTP_OPTIONS;
    // Verify the token against the secret.
    return authenticator.verify({ token, secret });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('2FA verification error:', error);
    }
    return false;
  }
}

/**
 * Generates a new 2FA secret and corresponding otpauth URI for QR code generation.
 *
 * @param {string} username - The username to be included in the TOTP URI.
 * @returns {{ secret: string; otpauth: string }} An object containing the TOTP secret and the otpauth URI.
 */
export function generate2FASecret(username: string): { secret: string; otpauth: string } {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(username, 'AuthFlow', secret);
  return { secret, otpauth };
}

/**
 * Generates a list of backup codes.
 *
 * Each backup code is a 10-digit string generated using a cryptographically secure random number generator.
 *
 * @param {number} [count=8] - The number of backup codes to generate.
 * @returns {string[]} An array of backup codes.
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate a 10-digit backup code using crypto.randomInt for secure randomness.
    const code = Array.from({ length: 10 }, () => randomInt(0, 10)).join('');
    codes.push(code);
  }
  return codes;
}

/**
 * Hashes a backup code using SHA-256.
 *
 * @param {string} code - The backup code to hash.
 * @returns {string} The hexadecimal representation of the hashed backup code.
 */
export function hashBackupCode(code: string): string {
  return createHash('sha256')
    .update(code)
    .digest('hex');
}

/**
 * 验证备份码是否匹配存储的哈希值
 * 
 * @param {string} code - 用户提供的备份码
 * @param {string} hashedCode - 存储的哈希备份码
 * @returns {boolean} 如果备份码匹配则返回true，否则返回false
 */
export function verifyBackupCode(code: string, hashedCode: string): boolean {
  const hash = hashBackupCode(code);
  return hash === hashedCode;
}
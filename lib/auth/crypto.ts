import crypto from 'crypto';

/**
 * Hash a plain string (such as access token, session token, or device token) using SHA-256.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a strong cryptographically secure random token (URL-safe string).
 */
export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * Hash a customer PIN using PBKDF2 with salt.
 */
export function hashPin(pin: string, salt: string = 'idelbi_pin_salt_v1'): string {
  return crypto.pbkdf2Sync(pin.trim(), salt, 10000, 32, 'sha256').toString('hex');
}

/**
 * Verify a PIN against its stored hash.
 */
export function verifyPin(pin: string, storedHash: string | null, salt: string = 'idelbi_pin_salt_v1'): boolean {
  if (!storedHash) return false;
  const hash = hashPin(pin, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

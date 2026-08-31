import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'secureye_hrms_super_secret_signing_key_2026';
export const AUTH_COOKIE_NAME = 'secureye_hrms_session';

export interface AuthSession {
  userId: string;
  mobileNumber: string;
  name: string;
  email?: string | null;
  role: string;
  permissions: string[];
  mustChangePassword: boolean;
  employeeId?: string | null;
  department?: string | null;
  designation?: string | null;
  expiresAt: number;
}

/**
 * Enterprise PBKDF2 Password Hashing with Salt
 */
export function hashPassword(password: string, customSalt?: string): string {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(verifyHash));
}

export function generateTemporaryPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const specials = '!@#$%&*';

  let pass = 'Temp@';
  for (let i = 0; i < 4; i++) {
    pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  for (let i = 0; i < 2; i++) {
    pass += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return pass;
}

/**
 * Creates an HMAC-SHA256 Signed Session Token
 */
export function createSessionToken(sessionData: Omit<AuthSession, 'expiresAt'>, expiresInHours = 24): string {
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const fullSession: AuthSession = {
    ...sessionData,
    expiresAt,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(fullSession)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies and parses a signed session token
 */
export function verifySessionToken(token: string): AuthSession | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [payloadBase64, signature] = token.split('.');

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const session = JSON.parse(jsonStr) as AuthSession;

    if (Date.now() > session.expiresAt) {
      return null; // Expired
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Helper to get active session from server cookies
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

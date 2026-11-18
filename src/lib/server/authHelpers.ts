import crypto from 'node:crypto';

export interface SessionTokenPayload {
  userId: string;
  email: string;
  exp: number;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const expected = Buffer.from(hexHash, 'hex');
    const actual = crypto.scryptSync(password, salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function signSessionToken(
  user: { userId: string; email: string },
  secret: string,
  ttlMs: number = SESSION_TTL_MS,
): string {
  const payload: SessionTokenPayload = {
    userId: user.userId,
    email: user.email,
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');
    const expectedBuf = Buffer.from(expectedSig, 'utf-8');
    const actualBuf = Buffer.from(signature, 'utf-8');
    if (expectedBuf.length !== actualBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;

    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8'),
    ) as Partial<SessionTokenPayload>;
    if (!parsed.userId || !parsed.email || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;

    return {
      userId: parsed.userId,
      email: parsed.email,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function formatEndpointPreview(endpoint: string): string {
  try {
    const parsed = new URL(endpoint);
    const tail = parsed.pathname.slice(-10);
    return `${parsed.host} (...${tail})`;
  } catch {
    return endpoint.slice(0, 40);
  }
}

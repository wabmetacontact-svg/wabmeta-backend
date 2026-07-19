import crypto from 'crypto';

/**
 * ✅ Cryptographically secure OTP generation
 */
export const generateOTP = (length: number = 6): string => {
  if (length < 4 || length > 10) {
    throw new Error('OTP length must be between 4 and 10');
  }

  const buf = crypto.randomBytes(length);
  let otp = '';

  for (let i = 0; i < length; i++) {
    otp += buf[i] % 10;
  }

  return otp;
};

/**
 * ✅ Cryptographically secure token generation
 */
export const generateToken = (bytes: number = 32): string => {
  if (bytes < 16 || bytes > 128) {
    throw new Error('Token bytes must be between 16 and 128');
  }
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * ✅ Hash token for DB storage (never store raw tokens)
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate URL-safe slug
 */
export const generateSlug = (name: string): string => {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 40);

  const suffix = crypto.randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
};

/**
 * ✅ Timing-safe string comparison
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};
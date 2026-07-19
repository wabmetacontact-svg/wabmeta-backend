// src/utils/password.ts - FIXED
import bcrypt from 'bcryptjs';

// ✅ 12 rounds - OWASP recommended for 2024/2025
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const BCRYPT_TIMEOUT_MS = 10_000; // 10 seconds

// ✅ Dummy hash for timing-safe login (matches 12 rounds)
const DUMMY_HASH = '$2b$12$dummy.hash.for.timing.attack.prevention.only.notreal';

export const hashPassword = async (password: string): Promise<string> => {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  if (password.length > 128) {
    throw new Error('Password too long (max 128 chars)');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  if (!password || !hash) {
    return false;
  }

  // Validate hash format
  if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$') && !hash.startsWith('$2y$')) {
    console.error('❌ Invalid hash format');
    return false;
  }

  // Timeout wrapper
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.error(`❌ bcrypt timeout after ${BCRYPT_TIMEOUT_MS}ms`);
      resolve(false);
    }, BCRYPT_TIMEOUT_MS);

    bcrypt.compare(password, hash)
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timer);
        console.error('❌ bcrypt error:', err.message);
        resolve(false);
      });
  });
};

/**
 * ✅ NEW: Timing-safe dummy compare for non-existent users
 * Prevents user enumeration attacks
 */
export const dummyComparePassword = async (password: string): Promise<false> => {
  await comparePassword(password, DUMMY_HASH);
  return false;
};

export const needsRehash = (hash: string): boolean => {
  try {
    const rounds = bcrypt.getRounds(hash);
    return rounds < SALT_ROUNDS;
  } catch {
    return false;
  }
};
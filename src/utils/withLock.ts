// src/utils/withLock.ts
import prisma from '../config/database';

/**
 * Run `fn` only if this process can take a Postgres advisory lock for `name`.
 *
 * Scheduled jobs (campaign recovery, the cron tasks) run on every instance.
 * With no coordination, N instances each fire the same job — duplicate expiry
 * emails, duplicate automation runs, and (before the campaign claim fix)
 * duplicate sends. A session-level advisory lock lets exactly one instance win;
 * the others skip that tick.
 *
 * pg_try_advisory_lock is non-blocking: it returns false immediately if another
 * session holds the lock, so a busy instance never stalls. The lock is released
 * in `finally`, and Postgres also drops it if the connection dies.
 */
export async function withAdvisoryLock<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  // Hash the name to the bigint key advisory locks use.
  const key = hashToInt(name);

  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(${key}) AS locked
  `;
  if (!rows[0]?.locked) {
    return undefined; // another instance is running this job
  }

  try {
    return await fn();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${key})`;
  }
}

// Stable 32-bit signed hash (fits advisory lock's int4 overload).
function hashToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

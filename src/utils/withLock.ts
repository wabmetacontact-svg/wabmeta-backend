// src/utils/withLock.ts
import prisma from '../config/database';
import logger from './logger';

const log = logger.category('CRON');

/**
 * Run `fn` only if this instance can take the lock for `name`.
 *
 * Scheduled jobs (campaign recovery, the cron tasks, Telegram broadcasts) run
 * on every instance. With no coordination, N instances each fire the same job -
 * duplicate expiry emails, duplicate automation runs, duplicate sends. The lock
 * lets exactly one instance win; the others skip that tick and get undefined.
 *
 * WHY A LEASE ROW AND NOT pg_try_advisory_lock
 *
 * This used to take a *session* advisory lock: pg_try_advisory_lock on one
 * query, pg_advisory_unlock on another. Prisma returns the connection to the
 * pool after every query, so as soon as the job ran parallel queries the unlock
 * landed on a different connection, returned false and did nothing. Measured on
 * the local test DB (2026-10-03):
 *
 *   lock   -> pid 233, locked: true
 *   unlock -> pid 240, unlocked: FALSE
 *   relock -> pid 240, locked: false
 *
 * The lock then stayed held until that pooled connection closed, every later
 * tick saw "another instance is running", and the job - automation follow-ups,
 * payment polling - stopped with no error and no log.
 *
 * A lease in a SystemSetting row has no connection affinity. It expires, so an
 * instance killed mid-run frees it on its own. While the job runs, a heartbeat
 * keeps pushing the expiry forward, so a long job (a big broadcast, the nightly
 * Meta sync) is never taken over by a second instance halfway through.
 * Same pattern as modules/sync/sync.lease.ts.
 */

/** How long a lease lives without a heartbeat - i.e. after its holder died. */
export const LOCK_TTL_MS = 2 * 60 * 1000;
/** Heartbeat interval; several beats fit in one TTL, so one slow beat is fine. */
export const LOCK_RENEW_MS = 30 * 1000;

interface LockOptions {
  ttlMs?: number;
  renewMs?: number;
}

/**
 * Takes the lease if it is free or expired, in one statement.
 *
 * The condition is inside the UPDATE rather than read first and checked in
 * JavaScript, so two instances arriving together cannot both pass. The expiry
 * is computed with the database clock on both sides of the comparison, so clock
 * drift between app instances does not matter.
 */
async function acquire(key: string, holder: string, ttlMs: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO "SystemSetting" ("key", "value", "updatedAt", "updatedBy")
    VALUES (
      ${key},
      jsonb_build_object('holder', ${holder}::text, 'until', now() + ${ttlMs}::int * interval '1 millisecond'),
      now(),
      ${holder}
    )
    ON CONFLICT ("key") DO UPDATE
      SET "value" = EXCLUDED."value", "updatedAt" = now(), "updatedBy" = EXCLUDED."updatedBy"
      WHERE ("SystemSetting"."value"->>'until')::timestamptz <= now()
    RETURNING "key"
  `;
  return rows.length > 0;
}

/** Pushes our expiry forward. False means we no longer hold the lease. */
async function renew(key: string, holder: string, ttlMs: number): Promise<boolean> {
  const count = await prisma.$executeRaw`
    UPDATE "SystemSetting"
       SET "value" = jsonb_set("value", '{until}', to_jsonb(now() + ${ttlMs}::int * interval '1 millisecond')),
           "updatedAt" = now()
     WHERE "key" = ${key}
       AND "value"->>'holder' = ${holder}
  `;
  return count > 0;
}

/**
 * Removes the lease, but only if we still hold it - otherwise a run that lost
 * its lease would free the one another instance had since taken, and both
 * would be working at once. Deleting (rather than expiring) keeps per-item
 * keys such as tg-broadcast:<id> from piling up in SystemSetting.
 */
async function release(key: string, holder: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "SystemSetting"
     WHERE "key" = ${key}
       AND "value"->>'holder' = ${holder}
  `;
}

export async function withJobLock<T>(
  name: string,
  fn: () => Promise<T>,
  { ttlMs = LOCK_TTL_MS, renewMs = LOCK_RENEW_MS }: LockOptions = {}
): Promise<T | undefined> {
  const key = `lock:${name}`;
  const holder = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

  if (!(await acquire(key, holder, ttlMs))) {
    return undefined; // another instance is running this job
  }

  const heartbeat = setInterval(() => {
    renew(key, holder, ttlMs)
      .then((held) => {
        if (!held) log.error('Job lock lost while the job was still running', undefined, { name });
      })
      .catch((err) => log.warn('Job lock heartbeat failed', { name, error: err?.message }));
  }, renewMs);
  heartbeat.unref?.();

  try {
    return await fn();
  } finally {
    clearInterval(heartbeat);
    // A failed release is survivable: the lease expires on its own, so the
    // worst case is skipped ticks for one TTL, not a job that never runs again.
    await release(key, holder).catch((err) =>
      log.warn('Could not release job lock; it will expire', { name, error: err?.message })
    );
  }
}

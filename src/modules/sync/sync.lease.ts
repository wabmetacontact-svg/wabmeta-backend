// src/modules/sync/sync.lease.ts
//
// One instance at a time, without depending on which connection a query got.
//
// WHY NOT withAdvisoryLock
//
// utils/withLock.ts takes a *session* advisory lock: pg_try_advisory_lock on
// one query, pg_advisory_unlock on another. Prisma returns a connection to the
// pool after every query, so those two statements are only guaranteed to be on
// the same connection when nothing else needs one in between. The projector
// reads several tables with Promise.all, which spreads across the pool - and
// then the unlock lands on a different connection, where it returns false and
// does nothing. Measured on the local test DB:
//
//   lock   -> pid 233, locked: true
//   unlock -> pid 240, unlocked: FALSE
//   relock -> pid 240, locked: false
//   pg_locks still shows pid 233 holding it
//
// A session lock stranded on a pooled connection is held until that connection
// closes, and every later run of that job returns "somebody else is running"
// forever. The job stops and nothing reports it.
//
// A lease in a row has no connection affinity at all, and it expires - so an
// instance killed mid-run frees it on its own rather than wedging the job until
// a deploy. That matters more here than anywhere else, because this job is the
// only thing moving money into TeamOS.
//
// utils/withLock.ts (the schedulers' lock) has since been moved to the same
// lease pattern, with a heartbeat for long jobs.

import prisma from '../../config/database';
import logger from '../../utils/logger';

const log = logger.category('CRON');

/** Long enough for a slow run, short enough that a crash is not a long outage. */
export const LEASE_MS = 5 * 60 * 1000;

interface Lease {
  holder: string;
  until: string;
}

/**
 * Takes the lease if it is free or expired, in one statement.
 *
 * The condition is inside the UPDATE rather than read first and checked in
 * JavaScript: two instances arriving together both pass a read-then-write
 * check, which is how the wallet came to be credited seven times for one
 * payment. Here the database decides, and exactly one UPDATE affects a row.
 */
async function acquire(key: string, holder: string, ttlMs: number): Promise<boolean> {
  const until = new Date(Date.now() + ttlMs).toISOString();
  const value = JSON.stringify({ holder, until } satisfies Lease);

  const rows = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO "SystemSetting" ("key", "value", "updatedAt", "updatedBy")
    VALUES (${key}, ${value}::jsonb, now(), ${holder})
    ON CONFLICT ("key") DO UPDATE
      SET "value" = ${value}::jsonb, "updatedAt" = now(), "updatedBy" = ${holder}
      WHERE ("SystemSetting"."value"->>'until')::timestamptz <= now()
    RETURNING "key"
  `;

  return rows.length > 0;
}

/**
 * Gives the lease back, but only if we still hold it.
 *
 * Without the holder check, a run that overran its lease would release the
 * lease a *different* instance had meanwhile taken, and both would then be
 * working at once - the one thing the lease exists to prevent.
 */
async function release(key: string, holder: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "SystemSetting"
       SET "value" = jsonb_set("value", '{until}', to_jsonb(now())), "updatedAt" = now()
     WHERE "key" = ${key}
       AND "value"->>'holder' = ${holder}
  `;
}

/**
 * Runs `fn` if this instance can take the lease, and returns undefined if it
 * cannot - the same shape withAdvisoryLock has, so callers read the same.
 */
export async function withLease<T>(key: string, fn: () => Promise<T>, ttlMs = LEASE_MS): Promise<T | undefined> {
  const holder = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

  if (!(await acquire(key, holder, ttlMs))) return undefined;

  try {
    return await fn();
  } finally {
    // A failure to release is survivable: the lease expires on its own, so the
    // worst case is one skipped tick rather than a job that never runs again.
    await release(key, holder).catch((err) =>
      log.warn('TeamOS sync: could not release the lease; it will expire', { error: err?.message }),
    );
  }
}

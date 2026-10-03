// src/modules/sync/sync.service.ts
//
// One run of the TeamOS sync: look at what changed, queue it, send it.
//
// The scheduler calls runSync() on a timer. It is safe to call from anywhere
// else too - an admin's "Sync now" button, a test - because the lease means a
// second caller returns immediately instead of doing the work twice.
//
// The lease is an efficiency measure, not a correctness one. Every step of this
// pipeline is idempotent: enqueue compares a fingerprint, and TeamOS
// deduplicates on externalId. Two instances running at once would waste reads
// and send some events twice, and TeamOS would answer "unchanged" - nothing
// would be counted twice. That is deliberate. A sync whose correctness rested
// on a lock would be one stranded lock away from double-counting money, and
// stranded locks are exactly what sync.lease.ts exists to explain.

import logger from '../../utils/logger';
import { withLease } from './sync.lease';
import { enqueue, syncConfig, type SyncConfig } from './sync.outbox';
import { project, readCursor, writeCursor } from './sync.project';
import { deliverDue } from './sync.worker';

const log = logger.category('CRON');

export const LOCK = 'teamos.sync.lease';

export interface RunResult {
  ran: boolean;
  reason?: string;
  queued: number;
  unchanged: number;
  sent: number;
  delivered: number;
  failed: number;
  dead: number;
}

const idle = (reason: string): RunResult => ({
  ran: false,
  reason,
  queued: 0,
  unchanged: 0,
  sent: 0,
  delivered: 0,
  failed: 0,
  dead: 0,
});

/**
 * Projects, queues and delivers, under one lock.
 *
 * The cursor is written only after the projection succeeded, and it is set to
 * the time the run *started*, not the time it finished: anything written while
 * the run was reading is then inside the next run's window instead of falling
 * between the two.
 *
 * Delivery failures do not hold the cursor back. The events are already in the
 * outbox by then, and that is what guarantees they go out - rewinding the
 * cursor would re-project rows whose events already exist, which the
 * fingerprint would discard anyway.
 */
export async function runSync(config: SyncConfig | null = syncConfig()): Promise<RunResult> {
  if (!config) return idle('TEAMOS_SYNC_URL or TEAMOS_SYNC_SECRET is not set');

  const result = await withLease(LOCK, async (): Promise<RunResult> => {
    const startedAt = new Date();
    const { since, firstRun } = await readCursor(startedAt);

    if (firstRun) {
      // Only new money from here on. History is the backfill script's job,
      // where a range can be chosen rather than "everything, now".
      await writeCursor(startedAt);
      log.info('TeamOS sync: first run, cursor set to now', { since: startedAt.toISOString() });
    }

    const payloads = await project(config.scope, since);
    const { queued, unchanged } = await enqueue(payloads);
    if (!firstRun) await writeCursor(startedAt);

    const sent = await deliverDue(config);

    if (queued || sent.sent) {
      log.info('TeamOS sync ran', {
        projected: payloads.length,
        queued,
        unchanged,
        ...sent,
      });
    }

    return { ran: true, queued, unchanged, ...sent };
  });

  // undefined means another instance holds the lease; this tick simply skipped.
  return result ?? idle('another instance holds the sync lease');
}

export { reviveDead, stats } from './sync.outbox';

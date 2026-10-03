// src/modules/sync/sync.controller.ts
//
// What the admin panel reads and the two buttons it offers.
//
// The sync runs on a timer and fails quietly by design - a receiver that is
// down is retried, not shouted about. That is only safe if somebody can see
// the queue, which is what this is for. Without it the dead-letter fills up
// and nobody finds out until a month's revenue is missing over there.

import { Request, Response, NextFunction } from 'express';
import { reviveDead, runSync, stats } from './sync.service';
import { syncConfig } from './sync.outbox';

type AdminReq = Request & { admin?: { id: string; email: string; role: string; name?: string } };

const handle =
  (fn: (req: AdminReq, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req as AdminReq, res).catch(next);

const ok = (res: Response, data: unknown, message = 'OK') => res.json({ success: true, message, data });

export const teamosSyncController = {
  /**
   * The queue, and how far behind it is.
   *
   * `oldestPendingAt` is the number that matters. A pending count on its own
   * looks the same whether the queue turned over a second ago or has been
   * stuck since Tuesday.
   */
  status: handle(async (_req, res) => {
    const config = syncConfig();
    const s = await stats();
    return ok(res, {
      ...s,
      // Never the secret, and the host is enough to tell staging from live.
      target: config ? safeHost(config.url) : null,
      scope: config?.scope ?? null,
    });
  }),

  /** Runs a sync now instead of waiting for the next minute. */
  run: handle(async (_req, res) => {
    const result = await runSync();
    return ok(
      res,
      result,
      result.ran
        ? `Queued ${result.queued}, delivered ${result.delivered}, failed ${result.failed + result.dead}.`
        : (result.reason ?? 'The sync did not run.'),
    );
  }),

  /**
   * Puts the given-up events back in the queue.
   *
   * Deliberately separate from "run": an event is parked because something
   * needed fixing, usually a setting. Retrying before that is fixed just parks
   * it again, so the two are different acts.
   */
  retry: handle(async (_req, res) => {
    const revived = await reviveDead();
    const result = revived > 0 ? await runSync() : null;
    return ok(
      res,
      { revived, run: result },
      revived === 0
        ? 'Nothing was waiting to be retried.'
        : `${revived} event${revived === 1 ? '' : 's'} back in the queue${result?.delivered ? `, ${result.delivered} delivered` : ''}.`,
    );
  }),
};

/** The host of the target, so a misconfigured URL is visible without leaking a token. */
const safeHost = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return 'an invalid URL';
  }
};

// src/modules/sync/sync.outbox.ts
//
// The outbox: configuration, enqueueing, claiming and recording the outcome.
//
// Nothing here talks to the network - that is sync.worker.ts - and nothing here
// decides what to send - that is sync.project.ts. Keeping the queue mechanics
// on their own is what lets the tests drive each half without a server.

import { createHash } from 'crypto';
import prisma from '../../config/database';
import { KIND_ORDER, type SyncKind, type SyncPayload } from './sync.types';

// ─── configuration ─────────────────────────────────────────────────────────

export interface SyncConfig {
  url: string;
  secret: string;
  /**
   * Which organizations are mirrored. `all` (the default) is every one;
   * `owned` narrows it to those a sales person is credited with.
   */
  scope: 'owned' | 'all';
}

/**
 * The sync is off until it is configured on purpose.
 *
 * Both halves have to be present: a URL with no secret would post unsigned
 * events that the receiver rejects, and a secret with no URL has nowhere to go.
 * Returning null rather than throwing lets the scheduler tick harmlessly on an
 * instance where this was never set up - a developer's laptop, a review app.
 */
export const syncConfig = (env: NodeJS.ProcessEnv = process.env): SyncConfig | null => {
  const url = env.TEAMOS_SYNC_URL?.trim();
  const secret = env.TEAMOS_SYNC_SECRET?.trim();
  if (!url || !secret) return null;
  if (env.TEAMOS_SYNC_ENABLED === 'false') return null;

  // Every organization, unless somebody asks for only the ones a sales person
  // owns. Sameer's call: TeamOS is meant to hold the whole customer list, not
  // just the part that came through an onboarder.
  return { url, secret, scope: env.TEAMOS_SYNC_CLIENTS === 'owned' ? 'owned' : 'all' };
};

/** How many events go in one request. TeamOS accepts up to 200. */
export const BATCH_SIZE = 100;

/** Attempts before an event is parked as DEAD and stops being retried. */
export const MAX_ATTEMPTS = 10;

/**
 * Wait before the next attempt: 30s, 1m, 2m, 4m … capped at an hour.
 *
 * The cap matters more than the curve. Uncapped doubling reaches days by the
 * tenth attempt, so an event queued during a two-hour outage would sit unsent
 * long after the outage ended.
 */
export const backoffMs = (attempts: number) => Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 3_600_000);

// ─── fingerprints ──────────────────────────────────────────────────────────

/**
 * JSON with object keys in a fixed order.
 *
 * `JSON.stringify` preserves insertion order, so two payloads carrying the same
 * data built in a different order would hash differently and resend an event
 * that had not changed. Sorting the keys makes the hash a property of the data.
 */
export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
};

export const fingerprintOf = (payload: SyncPayload): string =>
  createHash('sha256').update(stableStringify(payload)).digest('hex');

// ─── enqueueing ────────────────────────────────────────────────────────────

export interface EnqueueResult {
  queued: number;
  unchanged: number;
}

/**
 * Puts the current state of each thing in the queue, if it is not already there
 * in exactly that state.
 *
 * There is one row per mirrored thing, so this is an upsert rather than an
 * insert. Three cases:
 *
 *   no row yet          -> queue it
 *   fingerprint differs -> the thing changed; replace the payload and queue it
 *                          again, resetting attempts so a past failure does not
 *                          count against the new state
 *   fingerprint matches -> nothing happened since the last delivery; leave it
 *
 * The third case is what makes the projector cheap enough to run on a timer:
 * re-reading every client every tick costs one comparison per client, not a
 * request to TeamOS.
 *
 * A DEAD row is deliberately left dead when the fingerprint matches - it failed
 * for a reason that retrying will not fix, and silently re-queueing it would
 * hide that. A *changed* DEAD row is revived, because the thing that failed is
 * not the thing being sent any more.
 */
export async function enqueue(payloads: SyncPayload[]): Promise<EnqueueResult> {
  let queued = 0;
  let unchanged = 0;

  for (const payload of payloads) {
    const fingerprint = fingerprintOf(payload);
    const key = { kind_externalId: { kind: payload.kind, externalId: payload.externalId } };

    const existing = await prisma.syncEvent.findUnique({
      where: key,
      select: { fingerprint: true, status: true },
    });

    // Either already delivered in this state, already waiting to go out in it,
    // or parked as DEAD in it. All three mean there is nothing new to send.
    if (existing?.fingerprint === fingerprint) {
      unchanged++;
      continue;
    }

    await prisma.syncEvent.upsert({
      where: key,
      create: {
        kind: payload.kind,
        externalId: payload.externalId,
        payload: payload as object,
        fingerprint,
      },
      update: {
        payload: payload as object,
        fingerprint,
        status: 'PENDING',
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        deliveredAt: null,
      },
    });
    queued++;
  }

  return { queued, unchanged };
}

// ─── claiming and finishing ────────────────────────────────────────────────

export interface ClaimedEvent {
  id: string;
  kind: SyncKind;
  externalId: string;
  payload: SyncPayload;
  attempts: number;
}

/**
 * The events that are due, in the order they should be applied.
 *
 * Members before clients before payments, because a payment names a client and
 * a client names its onboarder; within a kind, oldest first. No row locking:
 * the whole run is wrapped in one advisory lock by the caller, so only one
 * instance is ever claiming.
 */
export async function claim(limit = BATCH_SIZE): Promise<ClaimedEvent[]> {
  const rows = await prisma.syncEvent.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, kind: true, externalId: true, payload: true, attempts: true },
  });

  return rows
    .map((r) => ({
      id: r.id,
      kind: r.kind as SyncKind,
      externalId: r.externalId,
      payload: r.payload as unknown as SyncPayload,
      attempts: r.attempts,
    }))
    .sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9));
}

export async function markDelivered(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await prisma.syncEvent.updateMany({
    where: { id: { in: ids } },
    data: { status: 'DELIVERED', deliveredAt: new Date(), lastError: null },
  });
}

/**
 * Records a failure and decides whether this event gets another go.
 *
 * `retryable: false` parks it immediately - a payload the receiver will never
 * accept gains nothing from nine more identical attempts, and a queue full of
 * them hides the events that could still succeed.
 */
export async function markFailed(
  event: { id: string; attempts: number },
  error: string,
  retryable = true,
): Promise<void> {
  const attempts = event.attempts + 1;
  const dead = !retryable || attempts >= MAX_ATTEMPTS;

  await prisma.syncEvent.update({
    where: { id: event.id },
    data: {
      attempts,
      status: dead ? 'DEAD' : 'PENDING',
      nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
      lastError: error.slice(0, 500),
    },
  });
}

// ─── what the admin panel will show ────────────────────────────────────────

export interface SyncStats {
  configured: boolean;
  pending: number;
  delivered: number;
  dead: number;
  /** Oldest undelivered event, which is the honest measure of how far behind. */
  oldestPendingAt: Date | null;
  lastDeliveredAt: Date | null;
  recentErrors: { kind: string; externalId: string; attempts: number; lastError: string | null }[];
}

export async function stats(): Promise<SyncStats> {
  const [pending, delivered, dead, oldest, latest, errors] = await Promise.all([
    prisma.syncEvent.count({ where: { status: 'PENDING' } }),
    prisma.syncEvent.count({ where: { status: 'DELIVERED' } }),
    prisma.syncEvent.count({ where: { status: 'DEAD' } }),
    prisma.syncEvent.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.syncEvent.findFirst({
      where: { status: 'DELIVERED' },
      orderBy: { deliveredAt: 'desc' },
      select: { deliveredAt: true },
    }),
    prisma.syncEvent.findMany({
      where: { lastError: { not: null }, status: { in: ['PENDING', 'DEAD'] } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { kind: true, externalId: true, attempts: true, lastError: true },
    }),
  ]);

  return {
    configured: syncConfig() !== null,
    pending,
    delivered,
    dead,
    oldestPendingAt: oldest?.createdAt ?? null,
    lastDeliveredAt: latest?.deliveredAt ?? null,
    recentErrors: errors,
  };
}

/** Puts dead events back in the queue. For the admin panel's Retry button. */
export async function reviveDead(): Promise<number> {
  const { count } = await prisma.syncEvent.updateMany({
    where: { status: 'DEAD' },
    data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  return count;
}

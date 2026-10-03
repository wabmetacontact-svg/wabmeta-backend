// src/modules/sync/sync.worker.ts
//
// Delivering the outbox to TeamOS.

import { createHmac } from 'crypto';
import logger from '../../utils/logger';
import {
  BATCH_SIZE,
  claim,
  markDelivered,
  markFailed,
  type ClaimedEvent,
  type SyncConfig,
} from './sync.outbox';
import type { EventResult, SyncResponse } from './sync.types';

const log = logger.category('CRON');

/** Signed with the timestamp inside, so a captured body cannot be replayed later. */
export const signBody = (rawBody: string, timestamp: string, secret: string): string =>
  createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

export interface DeliverResult {
  sent: number;
  delivered: number;
  failed: number;
  dead: number;
}

/** How long one request may take before it is treated as a failure. */
const TIMEOUT_MS = 20_000;

/**
 * Sends one batch and records what happened to each event.
 *
 * Two details here are the whole reason this is not a three-line fetch.
 *
 * `redirect: 'manual'` — TeamOS sits behind a sign-in gate that, until it was
 * fixed, answered every API request with a 307 to its login page. fetch follows
 * redirects by default, so the gate would have returned that page with a 200
 * and this worker would have marked the payment delivered. The money would have
 * vanished with nothing failing anywhere. A redirect is now an error, loudly.
 *
 * Per-event results — a batch where one payment names a client that has not
 * been pushed yet is not a failed batch. TeamOS answers 200 and says which
 * single event to send again; re-sending the other ninety-nine would be
 * pointless, and marking them failed would be a lie.
 */
export async function deliverBatch(config: SyncConfig, events: ClaimedEvent[]): Promise<DeliverResult> {
  const body = JSON.stringify({
    // The event id travels with the payload rather than inside it, so a retry
    // of the same state keeps the same fingerprint.
    events: events.map((e) => ({ id: e.id, ...e.payload })),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        'x-wabmeta-timestamp': timestamp,
        'x-wabmeta-signature': signBody(body, timestamp, config.secret),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err: any) {
    // Unreachable, timed out, DNS - nothing to do with any one event.
    return failAll(events, `request failed: ${err?.message ?? 'unknown'}`, true);
  }

  if (response.status >= 300 && response.status < 400) {
    return failAll(
      events,
      `redirected to ${response.headers.get('location') ?? 'an unknown location'} - the sync URL is wrong, or something is gating /api`,
      true,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    // 4xx other than 429 means this request will never be accepted as it is:
    // a wrong secret, a stale clock, a contract mismatch. Retrying ten times
    // changes nothing and buries the events that could still go.
    const retryable = response.status === 429 || response.status >= 500;
    return failAll(events, `HTTP ${response.status}: ${text.slice(0, 200)}`, retryable);
  }

  let parsed: SyncResponse;
  try {
    parsed = (await response.json()) as SyncResponse;
  } catch {
    return failAll(events, 'the response was not JSON - is the URL pointing at the sync endpoint?', true);
  }

  const byId = new Map<string, EventResult>((parsed.results ?? []).map((r) => [r.id, r]));
  const done: string[] = [];
  let failed = 0;
  let dead = 0;

  for (const event of events) {
    const result = byId.get(event.id);

    // A 200 that says nothing about an event is not success. Holding it for
    // retry is the safe reading: the alternative silently drops it.
    if (!result) {
      await markFailed(event, 'the response did not mention this event', true);
      failed++;
      continue;
    }

    if (result.status === 'applied' || result.status === 'unchanged') {
      done.push(event.id);
      continue;
    }

    const retryable = result.retry !== false;
    await markFailed(event, result.error ?? 'refused with no reason given', retryable);
    if (!retryable || event.attempts + 1 >= 10) dead++;
    else failed++;
  }

  await markDelivered(done);
  return { sent: events.length, delivered: done.length, failed, dead };
}

async function failAll(events: ClaimedEvent[], error: string, retryable: boolean): Promise<DeliverResult> {
  for (const event of events) await markFailed(event, error, retryable);
  return {
    sent: events.length,
    delivered: 0,
    failed: retryable ? events.length : 0,
    dead: retryable ? 0 : events.length,
  };
}

/**
 * Sends everything that is due, a batch at a time.
 *
 * Stops as soon as a batch delivers nothing, so a sync that is failing makes
 * one attempt per tick rather than hammering a receiver that is already in
 * trouble - and the backoff on each event decides when it is tried again.
 */
export async function deliverDue(config: SyncConfig, maxBatches = 10): Promise<DeliverResult> {
  const total: DeliverResult = { sent: 0, delivered: 0, failed: 0, dead: 0 };

  for (let i = 0; i < maxBatches; i++) {
    const events = await claim(BATCH_SIZE);
    if (!events.length) break;

    const result = await deliverBatch(config, events);
    total.sent += result.sent;
    total.delivered += result.delivered;
    total.failed += result.failed;
    total.dead += result.dead;

    if (result.delivered === 0) {
      log.warn('TeamOS sync: batch delivered nothing, stopping this run', {
        sent: result.sent,
        failed: result.failed,
        dead: result.dead,
      });
      break;
    }
    if (events.length < BATCH_SIZE) break;
  }

  return total;
}

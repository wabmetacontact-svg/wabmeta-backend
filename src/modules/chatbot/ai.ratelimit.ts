// src/modules/chatbot/ai.ratelimit.ts
import { getRedis } from '../../config/redis';

/**
 * Per-organization daily cap on AI chatbot replies.
 *
 * AI replies are triggered by inbound WhatsApp messages against a single shared
 * Gemini key, with no cap before this. A spammed number (or a malicious sender)
 * could run up unbounded calls that exhaust the quota and bill for every tenant.
 *
 * This bounds each org to a fixed number of AI replies per day. It uses the
 * shared store abstraction (getRedis) rather than a new table, so once a real
 * Redis is wired to REDIS_URL the counter becomes durable and cross-instance
 * automatically. Until then it is per-instance and resets on restart — still a
 * hard bound on abuse, just a looser one.
 */
const DAILY_AI_LIMIT = Number(process.env.AI_DAILY_LIMIT_PER_ORG || 500);
const DAY_SECONDS = 24 * 60 * 60;

const keyFor = (organizationId: string): string => {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return `ai:replies:${organizationId}:${day}`;
};

/**
 * Returns true if the org may make another AI call, and records the use.
 * Returns false once the daily limit is reached.
 */
export async function consumeAiQuota(organizationId: string): Promise<boolean> {
  if (!organizationId) return true; // no org context: don't block (shouldn't happen)

  try {
    const redis = getRedis();
    const key = keyFor(organizationId);

    const used = Number((await redis.get(key)) || 0);
    if (used >= DAILY_AI_LIMIT) return false;

    const next = await redis.incr(key);
    // Set the day-long TTL on first use of the key.
    if (next === 1 && typeof (redis as any).expire === 'function') {
      await (redis as any).expire(key, DAY_SECONDS);
    } else if (next === 1) {
      // Shim path: re-set with a TTL so the counter self-expires.
      await redis.setex(key, DAY_SECONDS, '1');
    }
    return true;
  } catch {
    // Store unavailable: fail open so a store outage never blocks chatbots.
    return true;
  }
}

export const aiDailyLimit = DAILY_AI_LIMIT;

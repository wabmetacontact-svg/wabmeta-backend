// src/middleware/rateLimitStore.ts
//
// Rate limiter ka store.
//
// express-rate-limit default me apni memory me ginta hai. Iske do matlab hain:
// har deploy ya restart par saare counters zero, aur ek se zyada instance hon
// to har instance apna alag hisaab rakhta hai - yaani asli limit N guna. Jis
// waqt rate limit sabse zyada chahiye (koi hamla kar raha hai), theek usi waqt
// ye sabse kamzor hai.
//
// config/redis.ts asli Redis nahi hai - wo ek in-memory Map hai jo Redis ka API
// nakal karta hai, isliye usse ye masla hal nahi hota. Yahan REDIS_URL par
// seedha ioredis connect hota hai, sirf rate limiting ke liye. Baaki sab cheez
// (chatbot sessions, AI quota, auth cache) waise hi us shim par rehti hai -
// blast radius jaan-boojhkar chhota rakha hai.
//
// REDIS_URL na ho ya connect na ho to chup-chaap memory store par wapas - rate
// limiting kamzor rehti hai, par API chalti rehti hai.

import type { Store } from 'express-rate-limit';

let cachedStore: Store | undefined;
let attempted = false;

/**
 * Redis-backed store, ya undefined (matlab express-rate-limit apna default
 * memory store use karega).
 *
 * Ek hi connection sab limiters share karte hain.
 */
export const getRateLimitStore = (): Store | undefined => {
  if (attempted) return cachedStore;
  attempted = true;

  const url = (process.env.REDIS_URL || '').trim();
  if (!url || !/^rediss?:\/\//i.test(url)) {
    console.warn(
      '⚠️ Rate limiting is using in-memory counters - they reset on restart and are per-instance. Set REDIS_URL to make them durable.'
    );
    return undefined;
  }

  try {
    // Require lazily: in dependencies ka sirf yahi istemaal hai, aur REDIS_URL
    // set na ho to inhe load karne ki zaroorat hi nahi.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RedisStore } = require('rate-limit-redis');

    const client = new Redis(url, {
      // Rate limiting kabhi bhi request ko block na kare - Redis dheema ya
      // down ho to limiter fail-open ho, API nahi.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
      connectTimeout: 3000,
    });

    client.on('error', (err: any) => {
      console.error('⚠️ Rate limit Redis error:', err?.message || err);
    });
    client.on('connect', () => {
      console.log('✅ Rate limiting backed by Redis');
    });

    cachedStore = new RedisStore({
      sendCommand: (...args: string[]) => client.call(...args),
      prefix: 'rl:',
    });
    return cachedStore;
  } catch (err: any) {
    console.error(
      '⚠️ Could not set up the Redis rate-limit store, falling back to memory:',
      err?.message || err
    );
    cachedStore = undefined;
    return undefined;
  }
};

export default getRateLimitStore;

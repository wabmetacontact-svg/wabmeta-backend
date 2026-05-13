// src/config/redis.ts - PRODUCTION FIXED VERSION

import Redis from 'ioredis';
import { config } from './index';

let redisInstance: Redis | null = null;
let isInitializing = false;
let permanentlyFailed = false; // ✅ NEW: Track permanent failure

export const initRedis = (): Redis | null => {

    // ✅ Agar permanently fail ho chuka hai toh dobara try mat karo
    if (permanentlyFailed) {
        return null;
    }

    if (redisInstance && 
        redisInstance.status !== 'end' && 
        redisInstance.status !== 'close') {
        return redisInstance;
    }

    if (isInitializing) {
        return null;
    }

    if (!config.redis.url) {
        console.warn('⚠️  REDIS_URL not configured. OTP features disabled.');
        permanentlyFailed = true;
        return null;
    }

    isInitializing = true;

    try {
        const isSecure = config.redis.url.startsWith('rediss://') ||
            config.redis.url.includes('upstash.io');

        const redisUrl = isSecure && config.redis.url.startsWith('redis://')
            ? config.redis.url.replace('redis://', 'rediss://')
            : config.redis.url;

        let retryCount = 0;
        const MAX_RETRIES = 10; // ✅ Hard limit

        redisInstance = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,      // ✅ Har request pe max 3 retry
            enableReadyCheck: true,
            lazyConnect: false,
            family: 4,
            connectTimeout: 20000,
            keepAlive: 30000,

            // ✅ CRITICAL: false karo - queued commands crash karti hain
            enableOfflineQueue: false,

            tls: isSecure ? {
                rejectUnauthorized: false,
                servername: new URL(redisUrl).hostname,
            } : undefined,

            // ✅ FIXED: Retry strategy jo actually STOP karta hai
            retryStrategy(times) {
                retryCount = times;

                if (times > MAX_RETRIES) {
                    console.error(
                        `❌ Redis: Max retries (${MAX_RETRIES}) reached. Giving up permanently.`
                    );
                    permanentlyFailed = true;
                    redisInstance = null;
                    // ✅ null return karo = ioredis retry BAND kar deta hai
                    return null;
                }

                const delay = Math.min(times * 500, 10000);

                if (times % 3 === 0) {
                    console.warn(
                        `⏳ Redis reconnect attempt ${times}/${MAX_RETRIES}... retry in ${delay}ms`
                    );
                }

                return delay;
            },

            reconnectOnError(err) {
                const targetErrors = [
                    'READONLY',
                    'ECONNRESET',
                    'ETIMEDOUT',
                    'EPIPE'
                ];
                return targetErrors.some((e) => err.message.includes(e));
            },
        });

        // ─── Event Handlers ──────────────────────────────────────────

        redisInstance.on('connect', () => {
            retryCount = 0;
            permanentlyFailed = false; // ✅ Reset on successful connect
            console.log('✅ Redis connected successfully');
        });

        redisInstance.on('ready', () => {
            console.log('✅ Redis ready to accept commands');
        });

        redisInstance.on('error', (err) => {
            // ✅ Sabhi errors yahan catch hongi - unhandledRejection nahi banegi
            const isNetworkNoise =
                err.message.includes('ECONNRESET') ||
                err.message.includes('ENOTFOUND') ||
                err.message.includes('ETIMEDOUT') ||
                err.message.includes('EAI_AGAIN') ||
                err.message.includes('Connection is closed') ||
                err.message.includes('ECONNREFUSED');

            if (!isNetworkNoise) {
                console.error('❌ Redis error:', err.message);
            }
            // ✅ Error swallow - crash nahi hoga
        });

        redisInstance.on('end', () => {
            console.warn('⚠️  Redis connection ended permanently');
            redisInstance = null;
            // permanentlyFailed = true ← ye mat karo
            // Taaki agli request pe reinitialize ho sake
        });

        redisInstance.on('close', () => {
            console.warn('⚠️  Redis connection closed');
        });

        return redisInstance;

    } catch (error: any) {
        console.error('❌ Failed to initialize Redis:', error.message);
        redisInstance = null;
        permanentlyFailed = false; // Retry allow karo
        return null;
    } finally {
        isInitializing = false;
    }
};

export const getRedis = (): Redis | null => {
    if (permanentlyFailed) return null;

    if (!redisInstance ||
        redisInstance.status === 'end' ||
        redisInstance.status === 'close') {
        if (!isInitializing) {
            return initRedis();
        }
        return null;
    }

    // ✅ CRITICAL FIX: Sirf 'ready' status pe return karo
    // 'connect', 'reconnecting', 'wait' states mein commands fail karti hain
    if (redisInstance.status === 'ready') {
        return redisInstance;
    }

    // Koi bhi aur state = safe nahi hai
    return null;
};

export const isRedisReady = (): boolean => {
    return !!redisInstance &&
        redisInstance.status === 'ready' &&
        !permanentlyFailed;
};

// ✅ NEW: Reset karo (admin/manual recovery ke liye)
export const resetRedisFailure = (): void => {
    permanentlyFailed = false;
    redisInstance = null;
    console.log('🔄 Redis failure state reset. Will retry on next request.');
};

export const closeRedis = async (): Promise<void> => {
    if (redisInstance) {
        try {
            await redisInstance.quit();
            console.log('✅ Redis closed gracefully');
        } catch (error: any) {
            console.error('❌ Error closing Redis:', error.message);
        } finally {
            redisInstance = null;
        }
    }
};

export default { initRedis, getRedis, isRedisReady, closeRedis, resetRedisFailure };
// src/config/redis.ts - UPSTASH OPTIMIZED VERSION

import Redis from 'ioredis';
import { config } from './index';

let redisInstance: Redis | null = null;
let isInitializing = false;

export const initRedis = (): Redis | null => {
    if (redisInstance) {
        return redisInstance;
    }

    if (isInitializing) {
        return null;
    }

    if (!config.redis.url) {
        console.warn(
            '⚠️  REDIS_URL not configured. OTP & cache features will not work.'
        );
        return null;
    }

    isInitializing = true;

    try {
        console.log('🔄 Initializing Redis connection...');

        // ✅ Parse URL to detect TLS
        const isSecure = config.redis.url.startsWith('rediss://');

        redisInstance = new Redis(config.redis.url, {
            // ✅ Connection settings
            maxRetriesPerRequest: null,           // ← FIX: Disable max retries
            enableReadyCheck: true,
            lazyConnect: false,

            // ✅ Connection timeout
            connectTimeout: 30000,                // 30s timeout

            // ✅ Keep alive (Upstash requires this)
            keepAlive: 30000,                     // 30s keep alive

            // ✅ TLS configuration for Upstash
            tls: isSecure ? {
                rejectUnauthorized: false,
                servername: new URL(config.redis.url).hostname,
            } : undefined,

            // ✅ Retry strategy with longer delays
            retryStrategy(times) {
                if (times > 10) {
                    console.error('❌ Redis: Max retries (10) reached. Giving up.');
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 1000, 5000);
                console.log(`⏳ Redis retry ${times}/10 in ${delay}ms`);
                return delay;
            },

            // ✅ Reconnect on specific errors
            reconnectOnError(err) {
                const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'];
                const shouldReconnect = targetErrors.some((e) =>
                    err.message.includes(e)
                );
                if (shouldReconnect) {
                    console.log('🔄 Reconnecting due to:', err.message);
                }
                return shouldReconnect;
            },

            // ✅ Enable offline queue (commands queued during disconnect)
            enableOfflineQueue: true,
        });

        // ─── Event Handlers ────────────────────────────────────────────────

        redisInstance.on('connect', () => {
            console.log('✅ Redis connected successfully');
        });

        redisInstance.on('ready', () => {
            console.log('✅ Redis ready to accept commands');
        });

        redisInstance.on('error', (err) => {
            // Don't log every error to avoid spam
            if (err.message.includes('ECONNRESET') ||
                err.message.includes('ENOTFOUND') ||
                err.message.includes('ETIMEDOUT')) {
                // Silent network errors
                return;
            }
            console.error('❌ Redis error:', err.message);
        });

        redisInstance.on('close', () => {
            // Silent close - reconnection will handle it
        });

        redisInstance.on('reconnecting', (delay: number) => {
            // Silent reconnecting
        });

        redisInstance.on('end', () => {
            console.warn('⚠️  Redis connection ended permanently');
        });

        return redisInstance;
    } catch (error: any) {
        console.error('❌ Failed to initialize Redis:', error.message);
        redisInstance = null;
        return null;
    } finally {
        isInitializing = false;
    }
};

export const getRedis = (): Redis | null => {
    if (!redisInstance && !isInitializing) {
        return initRedis();
    }
    return redisInstance;
};

export const isRedisReady = (): boolean => {
    return !!redisInstance && redisInstance.status === 'ready';
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

export default { initRedis, getRedis, isRedisReady, closeRedis };
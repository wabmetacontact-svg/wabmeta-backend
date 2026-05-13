// src/config/redis.ts - FINAL VERSION

import Redis from 'ioredis';
import { config } from './index';

let redisInstance: Redis | null = null;
let isInitializing = false;

/**
 * Initialize Redis connection
 * Safe to call multiple times - will only initialize once
 */
export const initRedis = (): Redis | null => {
  // Already initialized
  if (redisInstance) {
    return redisInstance;
  }

  // Already initializing (race condition protection)
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

    redisInstance = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      tls: config.redis.url.startsWith('rediss://')
        ? { rejectUnauthorized: false }
        : undefined,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 3000);
        console.log(`⏳ Redis retry attempt ${times} in ${delay}ms`);
        return delay;
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    redisInstance.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisInstance.on('ready', () => {
      console.log('✅ Redis ready to accept commands');
    });

    redisInstance.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    redisInstance.on('close', () => {
      console.warn('⚠️  Redis connection closed');
    });

    redisInstance.on('reconnecting', () => {
      console.log('🔄 Reconnecting to Redis...');
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

/**
 * Get Redis instance
 * Auto-initializes if not yet initialized
 */
export const getRedis = (): Redis | null => {
  if (!redisInstance && !isInitializing) {
    return initRedis();
  }
  return redisInstance;
};

/**
 * Check if Redis is connected and ready
 */
export const isRedisReady = (): boolean => {
  return !!redisInstance && redisInstance.status === 'ready';
};

/**
 * Close Redis connection gracefully
 */
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

// src/config/redis.ts - IN-MEMORY REPLACEMENT (No Redis needed!)

/**
 * ✅ Drop-in replacement for Redis
 * Same API, but uses in-memory Map
 * Perfect for single-instance deployments (Render, Railway, etc.)
 */

interface StoredValue {
    value: string;
    expiresAt: number | null; // null = no expiry
}

class InMemoryStore {
    private store = new Map<string, StoredValue>();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Har 5 min mein expired entries clean karo
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        console.log('✅ In-Memory Store initialized (Redis replacement)');
    }

    private cleanup() {
        const now = Date.now();
        let deleted = 0;
        for (const [key, data] of this.store.entries()) {
            if (data.expiresAt && now > data.expiresAt) {
                this.store.delete(key);
                deleted++;
            }
        }
        if (deleted > 0) {
            console.log(`🧹 Memory store cleanup: ${deleted} expired keys removed`);
        }
    }

    // ============================================
    // Redis-compatible API
    // ============================================

    async get(key: string): Promise<string | null> {
        const data = this.store.get(key);
        if (!data) return null;

        // Expiry check
        if (data.expiresAt && Date.now() > data.expiresAt) {
            this.store.delete(key);
            return null;
        }

        return data.value;
    }

    /**
     * Redis SET command compatible
     * set(key, value)
     * set(key, value, 'EX', seconds)
     * set(key, value, 'KEEPTTL')
     */
    async set(
        key: string,
        value: string,
        mode?: 'EX' | 'KEEPTTL' | string,
        duration?: number | string
    ): Promise<'OK'> {
        let expiresAt: number | null = null;

        if (mode === 'EX' && typeof duration === 'number') {
            expiresAt = Date.now() + duration * 1000;
        } else if (mode === 'KEEPTTL') {
            // Existing TTL preserve karo
            const existing = this.store.get(key);
            expiresAt = existing?.expiresAt || null;
        }

        this.store.set(key, { value, expiresAt });
        return 'OK';
    }

    async setex(key: string, seconds: number, value: string): Promise<'OK'> {
        return this.set(key, value, 'EX', seconds);
    }

    async del(...keys: string[]): Promise<number> {
        let deleted = 0;
        for (const key of keys) {
            if (this.store.delete(key)) deleted++;
        }
        return deleted;
    }

    async exists(...keys: string[]): Promise<number> {
        let count = 0;
        for (const key of keys) {
            const data = this.store.get(key);
            if (data) {
                if (!data.expiresAt || Date.now() <= data.expiresAt) {
                    count++;
                }
            }
        }
        return count;
    }

    async expire(key: string, seconds: number): Promise<number> {
        const data = this.store.get(key);
        if (!data) return 0;
        data.expiresAt = Date.now() + seconds * 1000;
        return 1;
    }

    async ttl(key: string): Promise<number> {
        const data = this.store.get(key);
        if (!data) return -2; // Key doesn't exist
        if (!data.expiresAt) return -1; // No expiry
        const remaining = Math.ceil((data.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
    }

    async incr(key: string): Promise<number> {
        const data = this.store.get(key);
        const current = data ? parseInt(data.value) || 0 : 0;
        const newValue = current + 1;
        await this.set(key, String(newValue), data?.expiresAt ? 'KEEPTTL' : undefined);
        return newValue;
    }

    async keys(pattern: string): Promise<string[]> {
        // Simple pattern matching (* wildcard support)
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(this.store.keys()).filter((k) => regex.test(k));
    }

    async flushall(): Promise<'OK'> {
        this.store.clear();
        return 'OK';
    }

    // Redis-specific calls (rate-limit-redis ke liye)
    async call(command: string, ...args: any[]): Promise<any> {
        const cmd = command.toLowerCase();

        switch (cmd) {
            case 'get': return this.get(args[0]);
            case 'set': return this.set(args[0], args[1], args[2] as any, args[3]);
            case 'del': return this.del(...args);
            case 'incr': return this.incr(args[0]);
            case 'expire': return this.expire(args[0], args[1]);
            case 'ttl': return this.ttl(args[0]);
            case 'exists': return this.exists(...args);
            default:
                console.warn(`⚠️ Unsupported Redis command: ${command}`);
                return null;
        }
    }

    get status(): string {
        return 'ready'; // Always ready
    }

    async quit(): Promise<'OK'> {
        clearInterval(this.cleanupInterval);
        this.store.clear();
        return 'OK';
    }

    // Stats
    getStats() {
        return {
            totalKeys: this.store.size,
            type: 'in-memory',
        };
    }
}

// ============================================
// Singleton instance
// ============================================

const memoryStore = new InMemoryStore();

export const initRedis = () => memoryStore;
export const getRedis = () => memoryStore;
export const isRedisReady = () => true;
export const closeRedis = async () => {
    await memoryStore.quit();
    console.log('✅ In-memory store closed');
};
export const resetRedisFailure = () => {
    console.log('🔄 Memory store reset (no-op)');
};

export default {
    initRedis,
    getRedis,
    isRedisReady,
    closeRedis,
    resetRedisFailure,
};
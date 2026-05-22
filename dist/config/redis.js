"use strict";
// src/config/redis.ts - IN-MEMORY REPLACEMENT (No Redis needed!)
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetRedisFailure = exports.closeRedis = exports.isRedisReady = exports.getRedis = exports.initRedis = void 0;
class InMemoryStore {
    store = new Map();
    cleanupInterval;
    constructor() {
        // Har 5 min mein expired entries clean karo
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        console.log('✅ In-Memory Store initialized (Redis replacement)');
    }
    cleanup() {
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
    async get(key) {
        const data = this.store.get(key);
        if (!data)
            return null;
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
    async set(key, value, mode, duration) {
        let expiresAt = null;
        if (mode === 'EX' && typeof duration === 'number') {
            expiresAt = Date.now() + duration * 1000;
        }
        else if (mode === 'KEEPTTL') {
            // Existing TTL preserve karo
            const existing = this.store.get(key);
            expiresAt = existing?.expiresAt || null;
        }
        this.store.set(key, { value, expiresAt });
        return 'OK';
    }
    async setex(key, seconds, value) {
        return this.set(key, value, 'EX', seconds);
    }
    async del(...keys) {
        let deleted = 0;
        for (const key of keys) {
            if (this.store.delete(key))
                deleted++;
        }
        return deleted;
    }
    async exists(...keys) {
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
    async expire(key, seconds) {
        const data = this.store.get(key);
        if (!data)
            return 0;
        data.expiresAt = Date.now() + seconds * 1000;
        return 1;
    }
    async ttl(key) {
        const data = this.store.get(key);
        if (!data)
            return -2; // Key doesn't exist
        if (!data.expiresAt)
            return -1; // No expiry
        const remaining = Math.ceil((data.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
    }
    async incr(key) {
        const data = this.store.get(key);
        const current = data ? parseInt(data.value) || 0 : 0;
        const newValue = current + 1;
        await this.set(key, String(newValue), data?.expiresAt ? 'KEEPTTL' : undefined);
        return newValue;
    }
    async keys(pattern) {
        // Simple pattern matching (* wildcard support)
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(this.store.keys()).filter((k) => regex.test(k));
    }
    async flushall() {
        this.store.clear();
        return 'OK';
    }
    // Redis-specific calls (rate-limit-redis ke liye)
    async call(command, ...args) {
        const cmd = command.toLowerCase();
        switch (cmd) {
            case 'get': return this.get(args[0]);
            case 'set': return this.set(args[0], args[1], args[2], args[3]);
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
    get status() {
        return 'ready'; // Always ready
    }
    async quit() {
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
const initRedis = () => memoryStore;
exports.initRedis = initRedis;
const getRedis = () => memoryStore;
exports.getRedis = getRedis;
const isRedisReady = () => true;
exports.isRedisReady = isRedisReady;
const closeRedis = async () => {
    await memoryStore.quit();
    console.log('✅ In-memory store closed');
};
exports.closeRedis = closeRedis;
const resetRedisFailure = () => {
    console.log('🔄 Memory store reset (no-op)');
};
exports.resetRedisFailure = resetRedisFailure;
exports.default = {
    initRedis: exports.initRedis,
    getRedis: exports.getRedis,
    isRedisReady: exports.isRedisReady,
    closeRedis: exports.closeRedis,
    resetRedisFailure: exports.resetRedisFailure,
};
//# sourceMappingURL=redis.js.map
declare class InMemoryStore {
    private store;
    private cleanupInterval;
    constructor();
    private cleanup;
    get(key: string): Promise<string | null>;
    /**
     * Redis SET command compatible
     * set(key, value)
     * set(key, value, 'EX', seconds)
     * set(key, value, 'KEEPTTL')
     */
    set(key: string, value: string, mode?: 'EX' | 'KEEPTTL' | string, duration?: number | string): Promise<'OK'>;
    setex(key: string, seconds: number, value: string): Promise<'OK'>;
    del(...keys: string[]): Promise<number>;
    exists(...keys: string[]): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    incr(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    flushall(): Promise<'OK'>;
    call(command: string, ...args: any[]): Promise<any>;
    get status(): string;
    quit(): Promise<'OK'>;
    getStats(): {
        totalKeys: number;
        type: string;
    };
}
export declare const initRedis: () => InMemoryStore;
export declare const getRedis: () => InMemoryStore;
export declare const isRedisReady: () => boolean;
export declare const closeRedis: () => Promise<void>;
export declare const resetRedisFailure: () => void;
declare const _default: {
    initRedis: () => InMemoryStore;
    getRedis: () => InMemoryStore;
    isRedisReady: () => boolean;
    closeRedis: () => Promise<void>;
    resetRedisFailure: () => void;
};
export default _default;
//# sourceMappingURL=redis.d.ts.map
import { RateLimitRequestHandler } from 'express-rate-limit';
export declare const createRateLimiter: (options: {
    windowMs: number;
    max: number;
    message?: string;
    keyPrefix?: string;
}) => RateLimitRequestHandler;
export declare const createRedisRateLimiter: (options: {
    windowMs: number;
    max: number;
    message?: string;
    keyPrefix?: string;
}) => RateLimitRequestHandler;
export declare const authRateLimit: RateLimitRequestHandler;
export declare const authLimiter: RateLimitRequestHandler;
export declare const otpRateLimit: RateLimitRequestHandler;
export declare const apiRateLimit: RateLimitRequestHandler;
export declare const apiLimiter: RateLimitRequestHandler;
export declare const campaignRateLimit: RateLimitRequestHandler;
export declare const campaignLimiter: RateLimitRequestHandler;
export declare const webhookRateLimit: RateLimitRequestHandler;
export declare const uploadRateLimit: RateLimitRequestHandler;
export declare const rateLimit_fn: (options: {
    windowMs: number;
    max: number;
    message?: string;
}) => RateLimitRequestHandler;
export { rateLimit_fn as rateLimit };
declare const _default: {
    createRateLimiter: (options: {
        windowMs: number;
        max: number;
        message?: string;
        keyPrefix?: string;
    }) => RateLimitRequestHandler;
    createRedisRateLimiter: (options: {
        windowMs: number;
        max: number;
        message?: string;
        keyPrefix?: string;
    }) => RateLimitRequestHandler;
    authRateLimit: RateLimitRequestHandler;
    authLimiter: RateLimitRequestHandler;
    otpRateLimit: RateLimitRequestHandler;
    apiRateLimit: RateLimitRequestHandler;
    apiLimiter: RateLimitRequestHandler;
    campaignRateLimit: RateLimitRequestHandler;
    campaignLimiter: RateLimitRequestHandler;
    webhookRateLimit: RateLimitRequestHandler;
    uploadRateLimit: RateLimitRequestHandler;
    rateLimit: (options: {
        windowMs: number;
        max: number;
        message?: string;
    }) => RateLimitRequestHandler;
};
export default _default;
//# sourceMappingURL=rateLimit.d.ts.map
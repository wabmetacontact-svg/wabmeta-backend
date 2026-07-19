export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';
export type LogCategory = 'SYSTEM' | 'AUTH' | 'WALLET' | 'WHATSAPP' | 'CAMPAIGN' | 'WEBHOOK' | 'SOCKET' | 'DB' | 'CACHE' | 'META-API' | 'TEMPLATE' | 'CONTACT' | 'BILLING' | 'CRON' | 'HTTP';
interface LogContext {
    requestId?: string;
    userId?: string;
    organizationId?: string;
    duration?: number;
    [key: string]: any;
}
declare class Logger {
    private currentLevel;
    private isProduction;
    private useJSON;
    constructor();
    private shouldLog;
    private write;
    error(message: string, error?: any, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    http(message: string, context?: LogContext): void;
    category(cat: LogCategory): {
        error: (msg: string, error?: any, ctx?: LogContext) => void;
        warn: (msg: string, ctx?: LogContext) => void;
        info: (msg: string, ctx?: LogContext) => void;
        debug: (msg: string, ctx?: LogContext) => void;
        http: (msg: string, ctx?: LogContext) => void;
    };
}
export declare const logger: Logger;
export declare const authLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export declare const walletLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export declare const whatsappLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export declare const campaignLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export declare const webhookLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export declare const socketLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export declare const dbLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export declare const cacheLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export declare const metaLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export declare const cronLog: {
    error: (msg: string, error?: any, ctx?: LogContext) => void;
    warn: (msg: string, ctx?: LogContext) => void;
    info: (msg: string, ctx?: LogContext) => void;
    debug: (msg: string, ctx?: LogContext) => void;
    http: (msg: string, ctx?: LogContext) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map
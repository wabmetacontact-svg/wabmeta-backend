"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/config/database.ts - IMPROVED LOGGING
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const createPrismaClient = () => {
    let dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
    }
    const baseUrl = dbUrl.split('?')[0];
    const existingParams = new URLSearchParams(dbUrl.includes('?') ? dbUrl.split('?')[1] : '');
    const isPooler = dbUrl.includes('.pooler.supabase.com') ||
        dbUrl.includes('pooler') ||
        dbUrl.includes('pgbouncer');
    const isNeon = dbUrl.includes('neon.tech');
    if (isPooler) {
        existingParams.set('pgbouncer', 'true');
        existingParams.set('prepared_statements', 'false');
        logger_1.dbLog.info('Database mode configured', { mode: 'Supabase PgBouncer' });
    }
    if (isNeon) {
        existingParams.set('sslmode', 'require');
        logger_1.dbLog.info('Database mode configured', { mode: 'Neon' });
    }
    // Paid plan settings
    existingParams.set('connection_limit', '20');
    existingParams.set('pool_timeout', '30');
    existingParams.set('connect_timeout', '20');
    existingParams.set('statement_timeout', '30000');
    existingParams.set('idle_in_transaction_session_timeout', '60000');
    const finalUrl = `${baseUrl}?${existingParams.toString()}`;
    const client = new client_1.PrismaClient({
        log: [
            { level: 'error', emit: 'event' },
            { level: 'warn', emit: 'event' },
        ],
        datasources: { db: { url: finalUrl } },
        errorFormat: 'minimal',
    });
    // ✅ Structured error logging
    client.$on('error', (e) => {
        logger_1.dbLog.error('Prisma error', new Error(e.message), {
            target: e.target,
        });
    });
    client.$on('warn', (e) => {
        logger_1.dbLog.warn('Prisma warning', {
            message: e.message,
            target: e.target,
        });
    });
    logger_1.dbLog.info('Prisma configured', {
        connectionLimit: 20,
        poolTimeout: '30s',
        statementTimeout: '30s',
        plan: 'RENDER_PAID',
    });
    return client;
};
const prisma = globalThis.__prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = prisma;
}
// Graceful shutdown
const gracefulShutdown = async () => {
    logger_1.dbLog.info('Closing Prisma connections');
    await prisma.$disconnect();
    logger_1.dbLog.info('Prisma disconnected');
};
process.on('beforeExit', gracefulShutdown);
process.on('SIGINT', async () => { await gracefulShutdown(); process.exit(0); });
process.on('SIGTERM', async () => { await gracefulShutdown(); process.exit(0); });
exports.default = prisma;
//# sourceMappingURL=database.js.map
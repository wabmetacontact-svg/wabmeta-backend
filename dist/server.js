"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts - CLEAN STARTUP
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config");
const database_1 = __importDefault(require("./config/database"));
const socket_1 = require("./socket");
const encryption_1 = require("./utils/encryption");
const scheduler_service_1 = require("./services/scheduler.service");
const wallet_reconciliation_service_1 = require("./modules/wallet/wallet.reconciliation.service");
const logger_1 = __importStar(require("./utils/logger"));
let webhookService = null;
async function loadOptionalServices() {
    try {
        const webhookModule = await Promise.resolve().then(() => __importStar(require('./modules/webhooks/webhook.service')));
        webhookService = webhookModule.webhookService;
        logger_1.default.info('Webhook service loaded');
    }
    catch {
        logger_1.default.warn('Webhook service not available');
    }
}
// ─── Startup Banner ──────────────────────────────────────
function printBanner() {
    const line = '━'.repeat(50);
    console.log('');
    console.log(`\x1b[36m${line}\x1b[0m`);
    console.log(`\x1b[36m\x1b[1m  🚀 WABMETA API SERVER\x1b[0m`);
    console.log(`\x1b[36m${line}\x1b[0m`);
    console.log('');
}
function printReady(port, encryption) {
    const line = '━'.repeat(50);
    console.log('');
    console.log(`\x1b[32m${line}\x1b[0m`);
    console.log(`\x1b[32m\x1b[1m  ✅ SERVER READY\x1b[0m`);
    console.log(`\x1b[32m${line}\x1b[0m`);
    console.log(`     📡  Port         : \x1b[36m${port}\x1b[0m`);
    console.log(`     🌍  Environment  : \x1b[36m${config_1.config.app.env}\x1b[0m`);
    console.log(`     🔐  Encryption   : ${encryption ? '\x1b[32m✓ enabled\x1b[0m' : '\x1b[31m✗ disabled\x1b[0m'}`);
    console.log(`     🕐  Started at   : \x1b[36m${new Date().toISOString()}\x1b[0m`);
    console.log(`\x1b[32m${line}\x1b[0m`);
    console.log('');
}
// ─── Bootstrap ───────────────────────────────────────────
async function bootstrap() {
    try {
        printBanner();
        // Step 1: Encryption
        const encryptionValid = (0, encryption_1.validateEncryptionKey)();
        if (!encryptionValid) {
            if (config_1.config.app.isProduction) {
                logger_1.default.error('ENCRYPTION_KEY required in production');
                process.exit(1);
            }
            logger_1.default.warn('No encryption key - development mode only');
        }
        else {
            logger_1.default.info('Encryption validated');
        }
        // Step 2: Database
        try {
            const start = Date.now();
            await database_1.default.$queryRaw `SELECT 1`;
            logger_1.default.info('Database connected', { duration: Date.now() - start });
        }
        catch (dbError) {
            logger_1.default.error('Database connection failed', dbError);
            process.exit(1);
        }
        // Step 3: Optional services
        await loadOptionalServices();
        // Step 4: HTTP Server
        const server = http_1.default.createServer(app_1.default);
        // Step 5: Socket.io
        (0, socket_1.initializeSocket)(server);
        logger_1.socketLog.info('Socket.io initialized');
        // Step 6: Wallet reconciliation
        wallet_reconciliation_service_1.walletReconciliationService.startCron();
        logger_1.cronLog.info('Wallet reconciliation cron started');
        // Step 7: Scheduler
        (0, scheduler_service_1.initializeScheduler)();
        logger_1.cronLog.info('Scheduler started');
        // Step 8: Campaign processor
        startCampaignProcessor();
        logger_1.cronLog.info('Campaign processor started');
        // Step 9: Background jobs
        startBackgroundJobs();
        // Step 10: Campaign recovery
        try {
            const { campaignRecoveryService } = await Promise.resolve().then(() => __importStar(require('./modules/campaigns/campaigns.recovery.service')));
            await campaignRecoveryService.initialize();
            logger_1.cronLog.info('Campaign recovery initialized');
        }
        catch (error) {
            logger_1.default.warn('Campaign recovery init failed', { error: error.message });
        }
        // Step 11: Redis
        try {
            const { initRedis } = await Promise.resolve().then(() => __importStar(require('./config/redis')));
            initRedis();
        }
        catch (error) {
            logger_1.default.warn('Redis init failed', { error: error.message });
        }
        // Step 12: Listen
        const PORT = config_1.config.port || 5000;
        server.listen(PORT, () => {
            printReady(PORT, encryptionValid);
        });
        setupGracefulShutdown(server);
        setupErrorHandlers();
    }
    catch (error) {
        logger_1.default.error('Server startup failed', error);
        process.exit(1);
    }
}
// ─── Pool Pressure System ────────────────────────────────
let poolPressureCount = 0;
const POOL_PRESSURE_THRESHOLD = 3;
let inPoolPressureMode = false;
function reportPoolError() {
    poolPressureCount++;
    if (poolPressureCount >= POOL_PRESSURE_THRESHOLD && !inPoolPressureMode) {
        inPoolPressureMode = true;
        logger_1.default.warn('Pool pressure detected - throttling crons', {
            threshold: POOL_PRESSURE_THRESHOLD,
        });
        setTimeout(() => {
            inPoolPressureMode = false;
            poolPressureCount = 0;
            logger_1.default.info('Pool pressure cleared - crons resumed');
        }, 5 * 60 * 1000);
    }
}
// ─── Campaign Processor ──────────────────────────────────
let campaignProcessorRunning = false;
function startCampaignProcessor() {
    setTimeout(() => {
        runCampaignProcessor();
        setInterval(runCampaignProcessor, 90 * 1000);
    }, 60 * 1000);
}
async function runCampaignProcessor() {
    if (campaignProcessorRunning)
        return;
    campaignProcessorRunning = true;
    try {
        await processScheduledCampaigns();
    }
    catch (error) {
        if (error?.code === 'P2024')
            reportPoolError();
        logger_1.cronLog.error('Campaign processor error', error);
    }
    finally {
        campaignProcessorRunning = false;
    }
}
async function processScheduledCampaigns() {
    const now = new Date();
    let scheduledCampaigns = [];
    try {
        scheduledCampaigns = await database_1.default.campaign.findMany({
            where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
            select: { id: true, organizationId: true, name: true },
            take: 5,
        });
    }
    catch (error) {
        if (error?.code === 'P2024') {
            reportPoolError();
            return;
        }
        throw error;
    }
    if (scheduledCampaigns.length === 0)
        return;
    logger_1.cronLog.info('Processing scheduled campaigns', {
        count: scheduledCampaigns.length,
    });
    const { campaignsService } = await Promise.resolve().then(() => __importStar(require('./modules/campaigns/campaigns.service')));
    for (const campaign of scheduledCampaigns) {
        try {
            await campaignsService.start(campaign.organizationId, campaign.id);
            await new Promise(r => setTimeout(r, 2000));
        }
        catch (error) {
            logger_1.cronLog.error('Campaign start failed', error, {
                campaignId: campaign.id,
            });
        }
    }
}
// ─── Background Jobs ─────────────────────────────────────
function startBackgroundJobs() {
    // Health check
    setInterval(async () => {
        if (inPoolPressureMode)
            return;
        try {
            await database_1.default.$queryRaw `SELECT 1`;
        }
        catch (error) {
            if (error?.code === 'P2024')
                reportPoolError();
        }
    }, 15 * 60 * 1000);
    // Window expiry
    if (webhookService?.expireConversationWindows) {
        setInterval(async () => {
            if (inPoolPressureMode) {
                logger_1.cronLog.debug('Window expiry skipped - pool pressure');
                return;
            }
            try {
                await webhookService.expireConversationWindows();
            }
            catch (error) {
                if (error?.code === 'P2024')
                    reportPoolError();
            }
        }, 15 * 60 * 1000);
    }
    // Message limit reset
    if (webhookService?.resetDailyMessageLimits) {
        setInterval(async () => {
            if (inPoolPressureMode)
                return;
            try {
                await webhookService.resetDailyMessageLimits();
            }
            catch (error) {
                if (error?.code === 'P2024')
                    reportPoolError();
            }
        }, 2 * 60 * 60 * 1000);
    }
    logger_1.cronLog.info('Background jobs started');
}
// ─── Graceful Shutdown ───────────────────────────────────
function setupGracefulShutdown(server) {
    const shutdown = async (signal) => {
        logger_1.default.info(`${signal} received - shutting down`);
        server.close(async () => {
            logger_1.default.info('HTTP server closed');
            try {
                await database_1.default.$disconnect();
                logger_1.default.info('Database disconnected');
            }
            catch (err) {
                logger_1.default.error('Shutdown error', err);
            }
            process.exit(0);
        });
        setTimeout(() => {
            logger_1.default.warn('Force exiting after 10s timeout');
            process.exit(1);
        }, 10_000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
// ─── Error Handlers ──────────────────────────────────────
function setupErrorHandlers() {
    process.on('uncaughtException', (error) => {
        logger_1.default.error('Uncaught exception', error);
    });
    process.on('unhandledRejection', (reason) => {
        const msg = reason?.message || String(reason);
        const ignorable = [
            'Connection is closed',
            'Redis',
            'ECONNRESET',
            'ECONNREFUSED',
            'enableOfflineQueue',
        ];
        if (ignorable.some((i) => msg.includes(i))) {
            logger_1.default.warn('Handled rejection', { message: msg });
            return;
        }
        logger_1.default.error('Unhandled rejection', new Error(msg));
    });
}
bootstrap();
//# sourceMappingURL=server.js.map
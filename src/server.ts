// src/server.ts - CLEAN STARTUP
import http from 'http';
import app from './app';
import { config } from './config';
import prisma from './config/database';
import { initializeSocket } from './socket';
import { validateEncryptionKey } from './utils/encryption';
import { initializeScheduler } from './services/scheduler.service';
import { walletReconciliationService } from './modules/wallet/wallet.reconciliation.service';
import logger, { cronLog, socketLog } from './utils/logger';

let webhookService: any = null;

async function loadOptionalServices() {
  try {
    const webhookModule = await import('./modules/webhooks/webhook.service');
    webhookService = webhookModule.webhookService;
    logger.info('Webhook service loaded');
  } catch {
    logger.warn('Webhook service not available');
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

function printReady(port: number, encryption: boolean) {
  const line = '━'.repeat(50);
  console.log('');
  console.log(`\x1b[32m${line}\x1b[0m`);
  console.log(`\x1b[32m\x1b[1m  ✅ SERVER READY\x1b[0m`);
  console.log(`\x1b[32m${line}\x1b[0m`);
  console.log(`     📡  Port         : \x1b[36m${port}\x1b[0m`);
  console.log(`     🌍  Environment  : \x1b[36m${config.app.env}\x1b[0m`);
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
    const encryptionValid = validateEncryptionKey();
    if (!encryptionValid) {
      if (config.app.isProduction) {
        logger.error('ENCRYPTION_KEY required in production');
        process.exit(1);
      }
      logger.warn('No encryption key - development mode only');
    } else {
      logger.info('Encryption validated');
    }

    // Step 2: Database
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connected', { duration: Date.now() - start });
    } catch (dbError: any) {
      logger.error('Database connection failed', dbError);
      process.exit(1);
    }

    // Step 3: Optional services
    await loadOptionalServices();

    // Step 4: HTTP Server
    const server = http.createServer(app);

    // Step 5: Socket.io
    initializeSocket(server);
    socketLog.info('Socket.io initialized');

    // Step 6: Wallet reconciliation
    walletReconciliationService.startCron();
    cronLog.info('Wallet reconciliation cron started');

    // Step 7: Scheduler
    initializeScheduler();
    cronLog.info('Scheduler started');

    // Step 8: Campaign processor
    startCampaignProcessor();
    cronLog.info('Campaign processor started');

    // Step 9: Background jobs
    startBackgroundJobs();

    // Step 10: Campaign recovery
    try {
      const { campaignRecoveryService } = await import(
        './modules/campaigns/campaigns.recovery.service'
      );
      await campaignRecoveryService.initialize();
      cronLog.info('Campaign recovery initialized');
    } catch (error: any) {
      logger.warn('Campaign recovery init failed', { error: error.message });
    }

    // Step 11: Redis
    try {
      const { initRedis } = await import('./config/redis');
      initRedis();
    } catch (error: any) {
      logger.warn('Redis init failed', { error: error.message });
    }

    // Step 12: Listen
    const PORT = config.port || 5000;
    server.listen(PORT, () => {
      printReady(PORT, encryptionValid);
    });

    setupGracefulShutdown(server);
    setupErrorHandlers();

  } catch (error: any) {
    logger.error('Server startup failed', error);
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
    logger.warn('Pool pressure detected - throttling crons', {
      threshold: POOL_PRESSURE_THRESHOLD,
    });

    setTimeout(() => {
      inPoolPressureMode = false;
      poolPressureCount  = 0;
      logger.info('Pool pressure cleared - crons resumed');
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
  if (campaignProcessorRunning) return;
  campaignProcessorRunning = true;

  try {
    await processScheduledCampaigns();
  } catch (error: any) {
    if (error?.code === 'P2024') reportPoolError();
    cronLog.error('Campaign processor error', error);
  } finally {
    campaignProcessorRunning = false;
  }
}

async function processScheduledCampaigns() {
  const now = new Date();
  let scheduledCampaigns: any[] = [];

  try {
    scheduledCampaigns = await prisma.campaign.findMany({
      where:  { status: 'SCHEDULED', scheduledAt: { lte: now } },
      select: { id: true, organizationId: true, name: true },
      take:   5,
    });
  } catch (error: any) {
    if (error?.code === 'P2024') {
      reportPoolError();
      return;
    }
    throw error;
  }

  if (scheduledCampaigns.length === 0) return;

  cronLog.info('Processing scheduled campaigns', {
    count: scheduledCampaigns.length,
  });

  const { campaignsService } = await import('./modules/campaigns/campaigns.service');

  for (const campaign of scheduledCampaigns) {
    try {
      await campaignsService.start(campaign.organizationId, campaign.id);
      await new Promise(r => setTimeout(r, 2000));
    } catch (error: any) {
      cronLog.error('Campaign start failed', error, {
        campaignId: campaign.id,
      });
    }
  }
}

// ─── Background Jobs ─────────────────────────────────────
function startBackgroundJobs() {
  // Health check
  setInterval(async () => {
    if (inPoolPressureMode) return;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error: any) {
      if (error?.code === 'P2024') reportPoolError();
    }
  }, 15 * 60 * 1000);

  // Window expiry
  if (webhookService?.expireConversationWindows) {
    setInterval(async () => {
      if (inPoolPressureMode) {
        cronLog.debug('Window expiry skipped - pool pressure');
        return;
      }
      try {
        await webhookService.expireConversationWindows();
      } catch (error: any) {
        if (error?.code === 'P2024') reportPoolError();
      }
    }, 15 * 60 * 1000);
  }

  // Message limit reset
  if (webhookService?.resetDailyMessageLimits) {
    setInterval(async () => {
      if (inPoolPressureMode) return;
      try {
        await webhookService.resetDailyMessageLimits();
      } catch (error: any) {
        if (error?.code === 'P2024') reportPoolError();
      }
    }, 2 * 60 * 60 * 1000);
  }

  cronLog.info('Background jobs started');
}

// ─── Graceful Shutdown ───────────────────────────────────
function setupGracefulShutdown(server: http.Server) {
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received - shutting down`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await prisma.$disconnect();
        logger.info('Database disconnected');
      } catch (err: any) {
        logger.error('Shutdown error', err);
      }

      process.exit(0);
    });

    setTimeout(() => {
      logger.warn('Force exiting after 10s timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

// ─── Error Handlers ──────────────────────────────────────
function setupErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
  });

  process.on('unhandledRejection', (reason: any) => {
    const msg = reason?.message || String(reason);
    const ignorable = [
      'Connection is closed',
      'Redis',
      'ECONNRESET',
      'ECONNREFUSED',
      'enableOfflineQueue',
    ];

    if (ignorable.some((i) => msg.includes(i))) {
      logger.warn('Handled rejection', { message: msg });
      return;
    }

    logger.error('Unhandled rejection', new Error(msg));
  });
}

bootstrap();
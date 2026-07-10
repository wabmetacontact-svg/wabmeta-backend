// src/server.ts - FINAL FIXED VERSION
// ✅ FIX 1: Pre-warm REMOVED from startBackgroundJobs()
//    Ab sirf scheduler.service.ts (daily 3 AM cron) handle karta hai
//    Pehle: server.ts + scheduler = DOUBLE run on every deploy
// ✅ FIX 2: Cleaner startup logs

import http from 'http';
import app from './app';
import { config } from './config';
import prisma from './config/database';
import { initializeSocket } from './socket';
import { validateEncryptionKey } from './utils/encryption';
import { initializeScheduler, startTemplateMediaPreWarmJob } from './services/scheduler.service';

let webhookService: any = null;

async function loadOptionalServices() {
  try {
    const webhookModule = await import('./modules/webhooks/webhook.service');
    webhookService = webhookModule.webhookService;
    console.log('✅ Webhook service loaded');
  } catch (error) {
    console.log('ℹ️  Webhook service not available');
  }
}

// ============================================
// BOOTSTRAP
// ============================================
async function bootstrap() {
  try {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 WABMETA API SERVER STARTING...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Step 1: Encryption
    console.log('🔐 Validating encryption...');
    const encryptionValid = validateEncryptionKey();
    if (!encryptionValid) {
      if (config.app.isProduction) {
        console.error('❌ ENCRYPTION_KEY required in production. Exiting.');
        process.exit(1);
      } else {
        console.warn('⚠️  No encryption key - development mode only!');
      }
    } else {
      console.log('✅ Encryption key validated');
    }

    // Step 2: Database
    console.log('📦 Testing database connection...');
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connected');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      process.exit(1);
    }

    // Step 3: Optional services
    await loadOptionalServices();

    // Step 4: HTTP Server
    const server = http.createServer(app);

    // Step 5: Socket.io
    console.log('🔌 Initializing Socket.io...');
    initializeSocket(server);
    console.log('✅ Socket.io initialized');

    // Step 6: Scheduler
    // ✅ NOTE: Pre-warm is handled by scheduler (daily 3 AM cron)
    // DO NOT add pre-warm here - it will cause double execution
    console.log('⏰ Starting scheduler...');
    initializeScheduler();
    console.log('✅ Scheduler started');

    // Step 7: Campaign processor
    console.log('📅 Starting campaign processor...');
    startCampaignProcessor();
    console.log('✅ Campaign processor started');

    // Step 8: Background jobs (infra only - NO pre-warm here)
    startBackgroundJobs();

    // Step 9: Campaign recovery
    try {
      const { campaignRecoveryService } = await import(
        './modules/campaigns/campaigns.recovery.service'
      );
      await campaignRecoveryService.initialize();
      console.log('✅ Campaign recovery initialized');
    } catch (error) {
      console.warn('⚠️  Campaign recovery init failed:', error);
    }

    // Step 10: Redis
    try {
      const { initRedis } = await import('./config/redis');
      initRedis();
    } catch (error) {
      console.warn('⚠️  Redis init failed:', error);
    }

    // Step 11: Listen
    const PORT = config.port || 5000;
    server.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 SERVER IS RUNNING!');
      console.log(`   📡 Port        : ${PORT}`);
      console.log(`   🌍 Environment : ${config.app.env}`);
      console.log(
        `   🔐 Encryption  : ${encryptionValid ? 'ENABLED ✓' : 'DISABLED ✗'}`
      );
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      // ✅ Start template media pre-warm job
      startTemplateMediaPreWarmJob();
    });

    setupGracefulShutdown(server);
    setupErrorHandlers();
  } catch (error) {
    console.error('❌ FAILED TO START SERVER:', error);
    process.exit(1);
  }
}

// ============================================
// ============================================
// ✅ NEW: Cron Priority System
// High priority queries always get connection
// Low priority skipped during pool pressure
// ============================================

let poolPressureCount = 0;
const POOL_PRESSURE_THRESHOLD = 3;
let inPoolPressureMode = false;

// Track pool pressure
function reportPoolError() {
  poolPressureCount++;
  if (poolPressureCount >= POOL_PRESSURE_THRESHOLD && !inPoolPressureMode) {
    inPoolPressureMode = true;
    console.warn('🚨 Pool pressure detected - throttling low-priority crons');
    
    // Auto-recover after 5 min
    setTimeout(() => {
      inPoolPressureMode = false;
      poolPressureCount = 0;
      console.log('✅ Pool pressure cleared - crons resumed');
    }, 5 * 60 * 1000);
  }
}

// ============================================
// ✅ CAMPAIGN PROCESSOR - PRIORITY: HIGH
// ============================================
let campaignProcessorRunning = false;

function startCampaignProcessor() {
  // First run after 60 sec
  setTimeout(() => {
    runCampaignProcessor();
    // Then every 90 seconds (was 60)
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
    console.error('❌ Campaign processor error:', error?.message);
  } finally {
    campaignProcessorRunning = false;
  }
}

async function processScheduledCampaigns() {
  const now = new Date();
  let scheduledCampaigns: any[] = [];

  try {
    scheduledCampaigns = await prisma.campaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
      },
      take: 5, // ✅ Reduced from 10
    });
  } catch (error: any) {
    if (error?.code === 'P2024') {
      reportPoolError();
      return;
    }
    throw error;
  }

  if (scheduledCampaigns.length === 0) return;

  console.log(`📅 Processing ${scheduledCampaigns.length} scheduled campaigns`);

  const { campaignsService } = await import('./modules/campaigns/campaigns.service');

  for (const campaign of scheduledCampaigns) {
    try {
      await campaignsService.start(campaign.organizationId, campaign.id);
      // ✅ 2 second gap between campaigns
      await new Promise(r => setTimeout(r, 2000));
    } catch (error: any) {
      console.error(`❌ Campaign ${campaign.id}:`, error.message);
    }
  }
}

// ============================================
// ✅ BACKGROUND JOBS - PRIORITY: LOW
// Skip during pool pressure
// ============================================

function startBackgroundJobs() {
  // ✅ 1. Health check - Every 15 min (was 10)
  setInterval(async () => {
    if (inPoolPressureMode) return;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error: any) {
      if (error?.code === 'P2024') reportPoolError();
    }
  }, 15 * 60 * 1000);

  // ✅ 2. Window expiry - Every 15 min (was 10)
  if (webhookService?.expireConversationWindows) {
    setInterval(async () => {
      if (inPoolPressureMode) {
        console.log('⏭️ Window expiry skipped: pool pressure');
        return;
      }
      try {
        await webhookService.expireConversationWindows();
      } catch (error: any) {
        if (error?.code === 'P2024') reportPoolError();
      }
    }, 15 * 60 * 1000);
  }

  // ✅ 3. Message limit reset - Every 2 hours (was 1)
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

  console.log('✅ Background jobs started (with pool pressure protection)');
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
function setupGracefulShutdown(server: http.Server) {
  const shutdown = async (signal: string) => {
    console.log(`\n🔄 ${signal} received. Shutting down...`);
    server.close(async () => {
      console.log('✅ HTTP server closed');
      try {
        await prisma.$disconnect();
        console.log('✅ Database disconnected');
      } catch (err) {
        console.error('⚠️  Shutdown error:', err);
      }
      process.exit(0);
    });
    setTimeout(() => {
      console.error('⚠️  Force exiting');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ============================================
// ERROR HANDLERS
// ============================================
function setupErrorHandlers() {
  process.on('uncaughtException', (error) => {
    console.error('❌ UNCAUGHT EXCEPTION:', error);
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
      console.warn(`⚠️  Handled rejection: ${msg}`);
      return;
    }
    console.error('❌ UNHANDLED REJECTION:', msg);
  });
}

bootstrap();
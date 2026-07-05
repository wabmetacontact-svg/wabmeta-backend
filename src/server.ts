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
import { initializeScheduler } from './services/scheduler.service';

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
    });

    setupGracefulShutdown(server);
    setupErrorHandlers();
  } catch (error) {
    console.error('❌ FAILED TO START SERVER:', error);
    process.exit(1);
  }
}

// ============================================
// CAMPAIGN PROCESSOR - OVERLAP SAFE
// ============================================
let campaignProcessorRunning = false;

function startCampaignProcessor() {
  setTimeout(() => {
    runCampaignProcessor();
    setInterval(runCampaignProcessor, 60 * 1000);
  }, 30 * 1000);
}

async function runCampaignProcessor() {
  if (campaignProcessorRunning) return;
  campaignProcessorRunning = true;
  try {
    await processScheduledCampaigns();
  } catch (error) {
    console.error('❌ Campaign processor error:', error);
  } finally {
    campaignProcessorRunning = false;
  }
}

async function processScheduledCampaigns() {
  const now = new Date();

  let scheduledCampaigns: {
    id: string;
    organizationId: string;
    name: string;
  }[] = [];

  try {
    scheduledCampaigns = await prisma.campaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
      },
      select: { id: true, organizationId: true, name: true },
      take: 10,
    });
  } catch (error: any) {
    if (error?.code === 'P2024') {
      console.warn('⚠️  Campaign check skipped: DB pool busy');
      return;
    }
    throw error;
  }

  if (scheduledCampaigns.length === 0) return;

  console.log(`📅 Processing ${scheduledCampaigns.length} scheduled campaigns`);

  const { campaignsService } = await import(
    './modules/campaigns/campaigns.service'
  );

  for (const campaign of scheduledCampaigns) {
    try {
      console.log(`🚀 Starting: ${campaign.name} (${campaign.id})`);
      await campaignsService.start(campaign.organizationId, campaign.id);
      console.log(`✅ Started: ${campaign.name}`);
    } catch (error: any) {
      console.error(`❌ Failed to start ${campaign.id}:`, error.message);
      try {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED', completedAt: new Date() },
        });
      } catch (updateError: any) {
        if (updateError?.code !== 'P2024') {
          console.error(`❌ Could not mark campaign as failed:`, updateError);
        }
      }
    }
  }
}

// ============================================
// BACKGROUND JOBS - INFRASTRUCTURE ONLY
// ✅ FIX: Pre-warm REMOVED
//    scheduler.service.ts daily 3 AM cron handle karta hai
//    Yahan rakhne se DOUBLE execution hoti thi
// ============================================
function startBackgroundJobs() {
  // 1. DB Health check - 10 min
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error: any) {
      if (error?.code === 'P2024') {
        console.warn('⚠️  Health check skipped: pool busy');
      } else {
        console.error('❌ DB health check failed:', error);
      }
    }
  }, 10 * 60 * 1000);

  // 2. Conversation window expiry - 10 min
  if (webhookService?.expireConversationWindows) {
    setInterval(async () => {
      try {
        await webhookService.expireConversationWindows();
      } catch (error: any) {
        if (error?.code !== 'P2024') {
          console.error('❌ Window expiry error:', error);
        }
      }
    }, 10 * 60 * 1000);
  }

  // 3. Daily message limit reset - 1 hour
  if (webhookService?.resetDailyMessageLimits) {
    setInterval(async () => {
      try {
        await webhookService.resetDailyMessageLimits();
      } catch (error: any) {
        if (error?.code !== 'P2024') {
          console.error('❌ Limit reset error:', error);
        }
      }
    }, 60 * 60 * 1000);
  }

  console.log(
    '✅ Background jobs started (pre-warm managed by scheduler cron)'
  );
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
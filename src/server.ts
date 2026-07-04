// src/server.ts - FIXED: No connection pool leaks

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

    // Step 2: Database - single connection test
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

    // Step 6: Scheduler (automation + subscription)
    console.log('⏰ Starting scheduler...');
    initializeScheduler();
    console.log('✅ Scheduler started');

    // Step 7: Campaign processor (separate, controlled)
    console.log('📅 Starting campaign processor...');
    startCampaignProcessor();
    console.log('✅ Campaign processor started');

    // Step 8: Background cron jobs (health check, window expiry)
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

    // Step 11: Start listening
    const PORT = config.port || 5000;
    server.listen(PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 SERVER IS RUNNING!');
      console.log(`   📡 Port        : ${PORT}`);
      console.log(`   🌍 Environment : ${config.app.env}`);
      console.log(`   🔐 Encryption  : ${encryptionValid ? 'ENABLED ✓' : 'DISABLED ✗'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });

    // Graceful shutdown
    setupGracefulShutdown(server);
    setupErrorHandlers();

  } catch (error) {
    console.error('❌ FAILED TO START SERVER:', error);
    process.exit(1);
  }
}

// ============================================
// ✅ CAMPAIGN PROCESSOR - OVERLAP SAFE
// ============================================

let campaignProcessorRunning = false; // ← Overlap prevention flag

function startCampaignProcessor() {
  // ✅ Pehli baar 30s baad start karo (server settle hone do)
  // Phir har 60s mein - 30s tha isliye overlap ho raha tha
  setTimeout(() => {
    runCampaignProcessor(); // First run
    setInterval(runCampaignProcessor, 60 * 1000); // Har 60s
  }, 30 * 1000);
}

async function runCampaignProcessor() {
  // ✅ Agar pichla run abhi bhi chal raha hai toh skip karo
  if (campaignProcessorRunning) {
    console.log('⏭️  Campaign processor still running, skipping this cycle');
    return;
  }

  campaignProcessorRunning = true;

  try {
    await processScheduledCampaigns();
  } catch (error) {
    console.error('❌ Campaign processor error:', error);
  } finally {
    // ✅ Always release the lock
    campaignProcessorRunning = false;
  }
}

async function processScheduledCampaigns() {
  const now = new Date();

  // ✅ Lightweight query - sirf IDs fetch karo pehle
  let scheduledCampaigns: { id: string; organizationId: string; name: string }[] = [];

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
      // ✅ Safety: Max 10 campaigns per cycle
      take: 10,
    });
  } catch (error: any) {
    // ✅ Pool timeout pe quietly fail karo, crash mat karo
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

  // ✅ Sequential processing - parallel mat karo (connection exhaust hoga)
  for (const campaign of scheduledCampaigns) {
    try {
      console.log(`🚀 Starting: ${campaign.name} (${campaign.id})`);
      await campaignsService.start(campaign.organizationId, campaign.id);
      console.log(`✅ Started: ${campaign.name}`);
    } catch (error: any) {
      console.error(`❌ Failed to start ${campaign.id}:`, error.message);

      // ✅ Failed campaign mark karo - try/catch separately
      try {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
          },
        });
      } catch (updateError: any) {
        if (updateError?.code === 'P2024') {
          console.warn(`⚠️  Could not mark campaign ${campaign.id} as failed - pool busy`);
        }
      }
    }
  }
}

// ============================================
// ✅ BACKGROUND JOBS - POOL FRIENDLY
// ============================================

function startBackgroundJobs() {
  // ✅ 1. Health check - 10 min mein ek baar (3 min bahut zyada tha)
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error: any) {
      if (error?.code === 'P2024') {
        console.warn('⚠️  Health check skipped: pool busy');
      } else {
        console.error('❌ DB Health check failed:', error);
      }
    }
  }, 10 * 60 * 1000); // ← 3min se 10min

  // ✅ 2. Conversation window expiry - 10 min
  if (webhookService?.expireConversationWindows) {
    setInterval(async () => {
      try {
        await webhookService.expireConversationWindows();
      } catch (error: any) {
        if (error?.code !== 'P2024') {
          console.error('❌ Window expiry error:', error);
        }
      }
    }, 10 * 60 * 1000); // ← 5min se 10min
  }

  // ✅ 3. Daily message limit reset - 1 hour
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

  // ✅ 4. Template media pre-warm - 24 hours (startup se 5 min baad)
  setTimeout(async () => {
    try {
      const { templateMediaPreWarmService } = await import(
        './services/templateMediaPreWarm.service'
      );
      await templateMediaPreWarmService.preWarmExpiringMedia();
    } catch (error) {
      console.error('❌ Initial media pre-warm error:', error);
    }

    // Phir daily
    setInterval(async () => {
      try {
        const { templateMediaPreWarmService } = await import(
          './services/templateMediaPreWarm.service'
        );
        await templateMediaPreWarmService.preWarmExpiringMedia();
      } catch (error) {
        console.error('❌ Media pre-warm error:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000);

  console.log('✅ Background jobs started');
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

    // Force exit after 10s
    setTimeout(() => {
      console.error('⚠️  Force exiting after timeout');
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
    // Production mein crash mat karo - log karo
  });

  process.on('unhandledRejection', (reason: any) => {
    const msg = reason?.message || String(reason);

    // ✅ Known safe-to-ignore errors
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

// ============================================
// START
// ============================================
bootstrap();
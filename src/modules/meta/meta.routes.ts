// 📁 src/modules/meta/meta.routes.ts - COMPLETE FINAL VERSION

import { Router, Request } from 'express';
import crypto from 'crypto';
import { metaController } from './meta.controller';
import { getRedis } from '../../config/redis';

const redis = getRedis();
import { authenticate } from '../../middleware/auth';
import { metaService } from './meta.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import prisma from '../../config/database';
import { checkConnectionLock } from '../../middleware/connectionLock';
import { MessageStatus } from '@prisma/client';
import { config } from '../../config';

const router = Router();

// ============================================
// PUBLIC ROUTES (Webhook) - BEFORE authenticate
// ============================================

/**
 * GET /webhook - Webhook verification
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = config.meta.webhookVerifyToken;

  console.log('📞 Webhook verification request:', {
    mode,
    token: token ? '***' : 'missing',
    challenge: challenge ? 'present' : 'missing',
  });

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

const verifyMetaSignature = (req: Request): boolean => {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) return false;

  const appSecret = config.meta.appSecret;
  if (!appSecret) return false;

  const rawBody = (req as any).rawBody;
  if (!rawBody) return false;

  try {
    const expectedSig = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
};

/**
 * POST /webhook - Handle incoming webhook events
 */
router.post('/webhook', (req, res, next) => {
  if (!verifyMetaSignature(req)) {
    console.error('❌ Invalid webhook signature');
    return res.sendStatus(403);
  }
  next();
}, async (req, res) => {
  // ✅ STEP 1: Pehle 200 do (Meta requirement - 20 sec timeout)
  res.sendStatus(200);

  try {
    const body = req.body;
    const entry = body?.entry;
    if (!Array.isArray(entry) || entry.length === 0) return;

    for (const item of entry) {
      for (const change of (item.changes || [])) {
        const value = change.value;
        const field = change.field;

        // ✅ STEP 2: Message status updates
        if (field === 'messages' && value?.statuses) {
          for (const statusUpdate of value.statuses) {
            // ✅ Idempotency check
            const dedupKey = `webhook:status:${statusUpdate.id}:${statusUpdate.status}`;
            const alreadyProcessed = await redis.get(dedupKey);
            
            if (alreadyProcessed) {
              console.log(`⚠️ Duplicate webhook skipped: ${statusUpdate.id}`);
              continue;
            }
            await redis.set(dedupKey, '1', 'EX', 86400);

            await processStatusUpdate(statusUpdate);
          }
        }

        // ✅ STEP 3: Incoming messages
        if (field === 'messages' && value?.messages) {
          for (const message of value.messages) {
            const dedupKey = `webhook:msg:${message.id}`;
            const exists = await redis.get(dedupKey);
            
            if (exists) {
              console.log(`⚠️ Duplicate message skipped: ${message.id}`);
              continue;
            }
            await redis.set(dedupKey, '1', 'EX', 86400);

            await processIncomingMessage(message, value.metadata);
          }
        }

        // ✅ STEP 4: Template status
        if (field === 'message_template_status_update') {
          await processTemplateUpdate(value);
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    // Already sent 200, so just log
  }
});

// ✅ Extract processors as separate functions
async function processStatusUpdate(statusUpdate: any) {
  const metaStatus = statusUpdate.status;
  const timestamp = new Date(Number(statusUpdate.timestamp) * 1000);

  const statusMap: Record<string, any> = {
    sent: { status: 'SENT' },
    delivered: { status: 'DELIVERED', deliveredAt: timestamp },
    read: { status: 'READ', readAt: timestamp },
    failed: { 
      status: 'FAILED', 
      failedAt: timestamp,
      failureReason: statusUpdate.errors?.[0]?.message || null
    }
  };

  const updateData = statusMap[metaStatus];
  if (!updateData) return;

  const updated = await prisma.message.updateMany({
    where: {
      OR: [
        { wamId: statusUpdate.id },
        { waMessageId: statusUpdate.id }
      ]
    },
    data: updateData
  });

  if (updated.count > 0) {
    // Campaign contact update
    await prisma.campaignContact.updateMany({
      where: { waMessageId: statusUpdate.id },
      data: updateData
    });

    // ✅ Socket emit for real-time UI update
    try {
      const { webhookEvents } = await import('../webhooks/webhook.service');
      webhookEvents.emit('messageStatusUpdated', {
        waMessageId: statusUpdate.id,
        status: updateData.status,
        deliveredAt: updateData.deliveredAt,
        readAt: updateData.readAt,
        failedAt: updateData.failedAt,
      });
    } catch (e) {
      console.warn('⚠️ Failed to emit messageStatusUpdated socket event:', e);
    }

    console.log(`✅ Status updated: ${statusUpdate.id} → ${updateData.status}`);
  }
}

async function processIncomingMessage(message: any, metadata: any) {
  console.log('📩 INCOMING MESSAGE:', {
    id: message.id,
    from: message.from,
    type: message.type,
    timestamp: message.timestamp,
  });
  // TODO: Process incoming message
}

async function processTemplateUpdate(value: any) {
  try {
    const metaTemplateId = value.message_template_id?.toString();
    if (metaTemplateId) {
      let templateStatus = 'PENDING';
      if (value.event === 'APPROVED') templateStatus = 'APPROVED';
      if (value.event === 'REJECTED') templateStatus = 'REJECTED';

      await prisma.template.updateMany({
        where: { metaTemplateId },
        data: {
          status: templateStatus as any,
          rejectionReason: value.reason || null,
        },
      });

      console.log(`✅ Template ${metaTemplateId} updated to ${templateStatus}`);
    }
  } catch (templateError: any) {
    console.error('❌ Template update error:', templateError.message);
  }
}

// ============================================
// ============================================
// PUBLIC OAUTH CALLBACKS
// These use state token verification instead of JWT
// ============================================


// /connect - Frontend FB.login Embedded Signup flow (NO state token)
router.post('/connect', authenticate, checkConnectionLock, async (req, res, next) => {
  try {
    const { code, organizationId, wabaId, phoneNumberId } = req.body;
    const userId = (req as any).user?.id;

    console.log('\n🔄 ========== META CONNECT (FB.login flow) ==========');
    console.log('   Code:', code ? `${code.substring(0, 10)}...` : 'Missing');
    console.log('   Organization ID:', organizationId);
    console.log('   User ID:', userId);
    console.log('   Session WABA ID:', wabaId || '(not provided — will lookup from token)');
    console.log('   Session Phone ID:', phoneNumberId || '(not provided — will lookup from WABA)');

    if (!code) {
      throw new AppError('Authorization code is required', 400);
    }

    if (!organizationId) {
      throw new AppError('Organization ID is required', 400);
    }

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Verify membership
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to connect WhatsApp', 403);
    }

    // Check single account limit
    const existingConnected = await prisma.whatsAppAccount.findFirst({
      where: { organizationId, status: 'CONNECTED' },
    });

    if (existingConnected) {
      throw new AppError(
        `Organization already has a connected WhatsApp account (${existingConnected.phoneNumber}). ` +
        `Please disconnect it first.`,
        400
      );
    }

    // ✅ Use metaService.completeConnection with embeddedSignup=true
    // Pass wabaId + phoneNumberId from session info (if captured by frontend)
    const result = await metaService.completeConnection(
      code,
      organizationId,
      userId,
      'CLOUD_API',
      undefined,   // no onProgress callback
      true,        // embeddedSignup = true → skipRedirectUri during token exchange
      wabaId || undefined,        // ✅ Session WABA ID from message event
      phoneNumberId || undefined  // ✅ Session Phone Number ID from message event
    );

    if (result.success) {
      console.log('✅ FB.login connection successful');
      return sendSuccess(
        res,
        {
          account: result.account,
          warning: (result as any).warning,
          message: (result as any).message,
        },
        'WhatsApp connected successfully'
      );
    } else {
      console.error('❌ FB.login connection failed:', result.error);
      throw new AppError(result.error || 'Connection failed', 400);
    }
  } catch (error) {
    console.error('❌ /connect error:', error);
    next(error);
  }
});

// ============================================
// PROTECTED ROUTES
// ============================================

router.use(authenticate);

// ============================================
// OAUTH & CONNECTION ROUTES (Private - to generate URL)
// ============================================


// ============================================
// CONFIGURATION ROUTES
// ============================================

router.get('/config', metaController.getEmbeddedSignupConfig.bind(metaController));
router.get('/integration-status', metaController.getIntegrationStatus.bind(metaController));

// ============================================
// ORGANIZATION-BASED ROUTES
// ============================================

router.get('/organizations/:organizationId/accounts', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (userId) {
      const membership = await prisma.organizationMember.findFirst({
        where: { organizationId, userId },
      });
      if (!membership) throw new AppError('You do not have access to this organization', 403);
    }

    const accounts = await metaService.getAccounts(organizationId);

    return sendSuccess(
      res,
      {
        accounts,
        total: accounts.length,
        hasConnected: accounts.some((a: any) => a.status === 'CONNECTED'),
      },
      'Accounts fetched successfully'
    );
  } catch (error) {
    next(error);
  }
});

router.get('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    if (userId) {
      const membership = await prisma.organizationMember.findFirst({
        where: { organizationId, userId },
      });

      if (!membership) {
        throw new AppError('You do not have access to this organization', 403);
      }
    }

    const account = await metaService.getAccount(accountId, organizationId);
    return sendSuccess(res, account, 'Account fetched successfully');
  } catch (error) {
    next(error);
  }
});

router.delete('/organizations/:organizationId/accounts/:accountId', checkConnectionLock, async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId as string;
    const accountId = req.params.accountId as string;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to disconnect accounts', 403);
    }

    console.log(`🔌 Disconnecting account ${accountId} from org ${organizationId}`);

    const result = await metaService.disconnectAccount(accountId, organizationId);
    return sendSuccess(res, result, 'Account disconnected successfully');
  } catch (error) {
    next(error);
  }
});

router.post('/organizations/:organizationId/accounts/:accountId/default', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to set default account', 403);
    }

    const result = await metaService.setDefaultAccount(accountId, organizationId);
    return sendSuccess(res, result, 'Default account updated successfully');
  } catch (error) {
    next(error);
  }
});

router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to sync templates', 403);
    }

    const result = await metaService.syncTemplates(accountId, organizationId);
    return sendSuccess(res, result, 'Templates synced successfully');
  } catch (error) {
    next(error);
  }
});

router.post('/organizations/:organizationId/accounts/:accountId/health', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId },
    });

    if (!membership) {
      throw new AppError('You do not have access to this organization', 403);
    }

    const result = await metaService.refreshAccountHealth(accountId, organizationId);
    return sendSuccess(res, result, 'Health check completed');
  } catch (error) {
    next(error);
  }
});

router.get('/organizations/:organizationId/status', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (userId) {
      const membership = await prisma.organizationMember.findFirst({
        where: { organizationId, userId },
      });

      if (!membership) {
        throw new AppError('You do not have access to this organization', 403);
      }
    }

    const whatsappAccounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId, status: 'CONNECTED' },
      select: {
        id: true,
        phoneNumber: true,
        displayName: true,
        isDefault: true,
        status: true,
        qualityRating: true,
        wabaId: true,
      },
    });

    let allAccounts = [...whatsappAccounts];
    let hasMetaConnection = false;

    try {
      const metaConnection = await (prisma as any).metaConnection.findUnique({
        where: { organizationId },
        include: { phoneNumbers: { where: { isActive: true } } },
      });

      if (metaConnection && metaConnection.status === 'CONNECTED') {
        hasMetaConnection = true;

        if (metaConnection.phoneNumbers?.length > 0) {
          const metaAccounts = metaConnection.phoneNumbers.map((phone: any) => ({
            id: phone.id,
            phoneNumber: phone.phoneNumber,
            displayName: phone.displayName || phone.verifiedName,
            isDefault: phone.isPrimary,
            status: 'CONNECTED',
            qualityRating: phone.qualityRating,
            wabaId: metaConnection.wabaId,
          }));

          allAccounts = [...allAccounts, ...metaAccounts];
        }
      }
    } catch (e) {
      console.log('⚠️ MetaConnection table not available');
    }

    const status = allAccounts.length > 0 ? 'CONNECTED' : 'DISCONNECTED';

    return sendSuccess(
      res,
      {
        status,
        connectedCount: allAccounts.length,
        hasWhatsAppAccount: whatsappAccounts.length > 0,
        hasMetaConnection,
        accounts: allAccounts,
      },
      'Organization status fetched'
    );
  } catch (error) {
    next(error);
  }
});

router.post('/organizations/:organizationId/sync', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('You do not have permission to sync', 403);
    }

    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId, status: 'CONNECTED' },
    });

    const results = [];
    for (const account of accounts) {
      try {
        const result = await metaService.syncTemplates(account.id, organizationId);
        results.push({
          accountId: account.id,
          phoneNumber: account.phoneNumber,
          success: true,
          ...result,
        });
      } catch (err: any) {
        results.push({
          accountId: account.id,
          phoneNumber: account.phoneNumber,
          success: false,
          error: err.message,
        });
      }
    }

    return sendSuccess(res, { results, total: results.length }, 'Sync completed');
  } catch (error) {
    next(error);
  }
});

router.delete('/organizations/:organizationId/disconnect', checkConnectionLock, async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId as string;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId, role: 'OWNER' },
    });

    if (!membership) {
      throw new AppError('Only organization owners can disconnect all accounts', 403);
    }

    const result = await prisma.whatsAppAccount.updateMany({
      where: { organizationId },
      data: { status: 'DISCONNECTED' },
    });

    try {
      await (prisma as any).metaConnection.delete({ where: { organizationId } });
    } catch (e) {
      console.log('⚠️ No MetaConnection to delete');
    }

    return sendSuccess(
      res,
      { success: true, disconnectedCount: result.count },
      'All accounts disconnected successfully'
    );
  } catch (error) {
    next(error);
  }
});

// ============================================
// HEADER-BASED ROUTES (Legacy)
// ============================================

router.get('/accounts', metaController.getAccounts.bind(metaController));
router.get('/accounts/:id', metaController.getAccount.bind(metaController));
router.delete('/accounts/:id', checkConnectionLock, metaController.disconnectAccount.bind(metaController));
// ✅ Also support POST /accounts/:id/disconnect (frontend uses this)
router.post('/accounts/:id/disconnect', checkConnectionLock, metaController.disconnectAccount.bind(metaController));

// ✅ Set default account shortcut (gets org from JWT context)
router.post('/accounts/:id/set-default', async (req, res, next) => {
  try {
    const { id: accountId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Find account to get organizationId
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId },
      include: {
        organization: {
          include: {
            members: { where: { userId, role: { in: ['OWNER', 'ADMIN'] } } }
          }
        }
      } as any,
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    const organizationId = account.organizationId;

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId, role: { in: ['OWNER', 'ADMIN'] } },
    });

    if (!membership) {
      throw new AppError('You do not have permission to set default account', 403);
    }

    const result = await metaService.setDefaultAccount(accountId, organizationId);
    return sendSuccess(res, result, 'Default account updated successfully');
  } catch (error) {
    next(error);
  }
});


// ============================================
// HEALTH CHECK
// ============================================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Meta Integration',
    version: config.meta.graphApiVersion,
    configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
    embeddedSignup: !!process.env.META_CONFIG_ID,
    webhookConfigured: !!process.env.META_WEBHOOK_VERIFY_TOKEN,
    timestamp: new Date().toISOString(),
  });
});

export default router;
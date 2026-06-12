// 📁 src/modules/meta/meta.routes.ts - COMPLETE FINAL VERSION

import { Router } from 'express';
import { metaController } from './meta.controller';
import { authenticate } from '../../middleware/auth';
import { metaService } from './meta.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import prisma from '../../config/database';
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

/**
 * POST /webhook - Handle incoming webhook events
 */
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    console.log('\n📨 ========== WEBHOOK RECEIVED ==========');
    console.log(JSON.stringify(body, null, 2));

    // Acknowledge receipt immediately (Meta requirement)
    res.sendStatus(200);

    const entry = body?.entry;

    if (!Array.isArray(entry) || entry.length === 0) {
      console.warn('⚠️ Invalid webhook payload - no entries');
      return;
    }

    for (const item of entry) {
      const changes = item.changes || [];

      for (const change of changes) {
        const field = change.field;
        const value = change.value;

        // ✅ HANDLE MESSAGE STATUS UPDATES
        if (field === 'messages' && value.statuses && Array.isArray(value.statuses)) {
          for (const statusUpdate of value.statuses) {
            console.log('📦 WA STATUS UPDATE:', {
              id: statusUpdate.id,
              status: statusUpdate.status,
              recipient_id: statusUpdate.recipient_id,
              timestamp: statusUpdate.timestamp,
              errors: statusUpdate.errors,
            });

            try {
              let dbStatus: MessageStatus = MessageStatus.SENT;
              let deliveredAt: Date | undefined;
              let readAt: Date | undefined;
              let failedAt: Date | undefined;

              const metaStatus = statusUpdate.status;
              const timestamp = new Date(Number(statusUpdate.timestamp) * 1000);

              switch (metaStatus) {
                case 'sent':
                  dbStatus = MessageStatus.SENT;
                  break;
                case 'delivered':
                  dbStatus = MessageStatus.DELIVERED;
                  deliveredAt = timestamp;
                  break;
                case 'read':
                  dbStatus = MessageStatus.READ;
                  readAt = timestamp;
                  break;
                case 'failed':
                  dbStatus = MessageStatus.FAILED;
                  failedAt = timestamp;
                  break;
                default:
                  console.warn(`⚠️ Unknown status: ${metaStatus}`);
              }

              const failureReason = statusUpdate.errors?.[0]?.message || null;

              const updateData: any = {
                status: dbStatus,
              };

              if (deliveredAt) updateData.deliveredAt = deliveredAt;
              if (readAt) updateData.readAt = readAt;
              if (failedAt) updateData.failedAt = failedAt;
              if (failureReason) updateData.failureReason = failureReason;

              // Update Message
              const updated = await prisma.message.updateMany({
                where: {
                  OR: [
                    { wamId: statusUpdate.id },
                    { waMessageId: statusUpdate.id },
                  ],
                },
                data: updateData,
              });

              if (updated.count > 0) {
                console.log(`✅ Updated ${updated.count} message(s) to status: ${dbStatus}`);

                // Update CampaignContact
                await prisma.campaignContact.updateMany({
                  where: { waMessageId: statusUpdate.id },
                  data: {
                    status: dbStatus,
                    deliveredAt,
                    readAt,
                    failedAt,
                    failureReason,
                  },
                });
              } else {
                console.warn(`⚠️ No message found with ID: ${statusUpdate.id}`);
              }
            } catch (dbError: any) {
              console.error('❌ DB update error:', dbError.message);
            }
          }
        }

        // ✅ HANDLE INCOMING MESSAGES
        if (field === 'messages' && value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            console.log('📩 INCOMING MESSAGE:', {
              id: message.id,
              from: message.from,
              type: message.type,
              timestamp: message.timestamp,
            });

            // TODO: Process incoming message
          }
        }

        // ✅ HANDLE TEMPLATE STATUS UPDATES
        if (field === 'message_template_status_update') {
          console.log('📋 TEMPLATE STATUS UPDATE:', {
            messageTemplateId: value.message_template_id,
            messageTemplateName: value.message_template_name,
            event: value.event,
            reason: value.reason,
          });

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
      }
    }

    console.log('📨 ========== WEBHOOK PROCESSED ==========\n');
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    res.sendStatus(200);
  }
});

// ============================================
// ============================================
// PUBLIC OAUTH CALLBACKS
// These use state token verification instead of JWT
// ============================================


// /connect - Frontend FB.login Embedded Signup flow (NO state token)
router.post('/connect', authenticate, async (req, res, next) => {
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
      return sendSuccess(res, result.account, 'WhatsApp connected successfully');
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

router.delete('/organizations/:organizationId/accounts/:accountId', async (req, res, next) => {
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

router.delete('/organizations/:organizationId/disconnect', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
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
router.delete('/accounts/:id', metaController.disconnectAccount.bind(metaController));
// ✅ Also support POST /accounts/:id/disconnect (frontend uses this)
router.post('/accounts/:id/disconnect', metaController.disconnectAccount.bind(metaController));

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
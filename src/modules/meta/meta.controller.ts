// 📁 src/modules/meta/meta.controller.ts - COMPLETE FINAL VERSION

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import { MessageStatus } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import { config } from '../../config';
import { templatesService } from '../templates/templates.service';
import { metaApi } from './meta.api';
import { encrypt } from '../../utils/encryption';
import { metaService } from './meta.service';

// Helper to safely get organization ID from headers
const getOrgId = (req: Request): string => {
  const header = req.headers['x-organization-id'];
  if (!header) return '';
  return Array.isArray(header) ? header[0] : header;
};

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class MetaController {

  // ============================================
  // GET ACCOUNTS (OLD METHOD - WHATSAPPACCOUNT ONLY)
  // ============================================
  async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req) || req.query.organizationId as string;

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
      console.log('📋 Fetching accounts (old method) for org:', orgIdString);

      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId: orgIdString },
        orderBy: { createdAt: 'desc' },
      });

      console.log('   Found accounts:', accounts.length);

      return sendSuccess(res, accounts, 'Accounts fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET SINGLE ACCOUNT
  // ============================================
  async getAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id, organizationId },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      return sendSuccess(res, account, 'Account fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // DISCONNECT ACCOUNT
  // ============================================
  async disconnectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

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
        throw new AppError('You do not have permission to disconnect', 403);
      }

      await prisma.whatsAppAccount.update({
        where: { id },
        data: { status: 'DISCONNECTED' },
      });

      // Also disconnect MetaConnection if exists
      try {
        await (prisma as any).metaConnection.update({
          where: { organizationId },
          data: { status: 'DISCONNECTED' },
        });
      } catch (e) {
        console.log('⚠️ MetaConnection not updated (may not exist)');
      }

      return sendSuccess(res, { success: true }, 'Account disconnected successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET EMBEDDED SIGNUP CONFIG
  // ============================================
  async getEmbeddedSignupConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = {
        appId: process.env.META_APP_ID,
        configId: process.env.META_CONFIG_ID,
        version: 'v25.0',
        features: ['whatsapp_business_app_onboarding'],
      };

      return sendSuccess(res, config, 'Config fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET INTEGRATION STATUS
  // ============================================
  async getIntegrationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = {
        configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        appId: process.env.META_APP_ID,
        version: 'v25.0',
        embeddedSignup: true,
      };

      return sendSuccess(res, status, 'Integration status fetched');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // WEBHOOK VERIFICATION (META REQUIREMENT)
  // ============================================
  async verifyWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;

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
    } catch (error) {
      console.error('❌ Webhook verification error:', error);
      res.sendStatus(500);
    }
  }

  // ============================================
  // WEBHOOK HANDLER - ✅ COMPLETE WITH STATUS UPDATES
  // ============================================
  async handleWebhook(req: Request, res: Response) {
    try {
      const body = req.body;

      console.log('\n📨 ========== WEBHOOK RECEIVED ==========');
      console.log(JSON.stringify(body, null, 2));

      // Acknowledge receipt immediately (Meta requirement)
      res.sendStatus(200);

      // Process webhook asynchronously
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
              console.log('📦 STATUS UPDATE:', {
                id: statusUpdate.id,
                status: statusUpdate.status,
                recipient_id: statusUpdate.recipient_id,
                timestamp: statusUpdate.timestamp,
                errors: statusUpdate.errors,
              });

              try {
                // Map Meta status to our MessageStatus enum
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

                // Extract failure reason if failed
                const failureReason = statusUpdate.errors?.[0]?.message || null;

                // ✅ Update Message in DB
                const updateData: any = {
                  status: dbStatus,
                };

                if (deliveredAt) updateData.deliveredAt = deliveredAt;
                if (readAt) updateData.readAt = readAt;
                if (failedAt) updateData.failedAt = failedAt;
                if (failureReason) updateData.failureReason = failureReason;

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
                } else {
                  console.warn(`⚠️ No message found with ID: ${statusUpdate.id}`);
                }

                // ✅ Update CampaignContact status if this is a campaign message
                if (updated.count > 0) {
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
              // This would create a new Message record with direction: INBOUND
              // await this.processIncomingMessage(message, value.metadata);
            }
          }

          // ✅ HANDLE TEMPLATE STATUS UPDATES
          if (field === 'message_template_status_update') {
            console.log('📋 TEMPLATE STATUS UPDATE:', {
              messageTemplateId: value.message_template_id,
              event: value.event,
            });

            // TODO: Update template status in DB
            // await this.updateTemplateStatus(value);
          }
        }
      }

      console.log('📨 ========== WEBHOOK PROCESSED ==========\n');
    } catch (error: any) {
      console.error('❌ Webhook processing error:', error);
      // Still return 200 to Meta to prevent retries
      res.sendStatus(200);
    }
  }
}

export const metaController = new MetaController();
export default metaController;
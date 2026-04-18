// src/modules/calling/calling.controller.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { metaApi } from '../meta/meta.api';
import { metaService } from '../meta/meta.service';
import prisma from '../../config/database';
import { AuthRequest } from '../../types/express';

class CallingController {

  // ✅ Get calling settings
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization required', 400);

      // Get WhatsApp account
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: { isDefault: 'desc' },
      });

      if (!account) {
        return res.json({
          success: true,
          data: {
            callingEnabled: false,
            message: 'No WhatsApp account connected',
          },
        });
      }

      const accountWithToken = await metaService.getAccountWithToken(account.id);
      if (!accountWithToken) throw new AppError('Token decryption failed', 500);

      // Get calling settings from Meta
      const settings = await metaApi.getCallingSettings(
        account.phoneNumberId,
        accountWithToken.accessToken
      );

      return res.json({
        success: true,
        data: {
          ...settings,
          phoneNumberId: account.phoneNumberId,
          phoneNumber: account.phoneNumber,
        },
      });

    } catch (error) {
      next(error);
    }
  }

  // ✅ Enable/disable calling
  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization required', 400);

      const {
        callingEnabled,
        inboundCallsEnabled,
        callbackEnabled,
        callHoursEnabled,
        whatsappAccountId,
      } = req.body;

      // Get account
      let account = null;
      if (whatsappAccountId) {
        account = await prisma.whatsAppAccount.findFirst({
          where: { id: whatsappAccountId, organizationId },
        });
      }
      if (!account) {
        account = await prisma.whatsAppAccount.findFirst({
          where: { organizationId, status: 'CONNECTED' },
          orderBy: { isDefault: 'desc' },
        });
      }

      if (!account) throw new AppError('No WhatsApp account found', 400);

      const accountWithToken = await metaService.getAccountWithToken(account.id);
      if (!accountWithToken) throw new AppError('Token decryption failed', 500);

      // Update calling settings
      const result = await metaApi.enableCalling(
        account.phoneNumberId,
        accountWithToken.accessToken,
        {
          callingEnabled: callingEnabled ?? true,
          inboundCallsEnabled: inboundCallsEnabled ?? true,
          callbackEnabled: callbackEnabled ?? true,
          callHoursEnabled: callHoursEnabled ?? false,
        }
      );

      // Subscribe to calls webhook if enabling
      if (callingEnabled) {
        await metaApi.subscribeToCallsWebhook(
          account.wabaId,
          accountWithToken.accessToken
        ).catch((e: any) => console.warn('Webhook subscribe failed:', e.message));
      }

      return res.json({
        success: true,
        message: callingEnabled
          ? 'Calling enabled successfully'
          : 'Calling disabled successfully',
        data: result,
      });

    } catch (error) {
      next(error);
    }
  }

  // ✅ Initiate call to customer
  async initiateCall(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      const userId = (req as AuthRequest).user?.id;
      if (!organizationId) throw new AppError('Organization required', 400);

      const { to, contactId, conversationId, whatsappAccountId } = req.body;

      if (!to) throw new AppError('Phone number required', 400);

      // Get account
      let account = null;
      if (whatsappAccountId) {
        account = await prisma.whatsAppAccount.findFirst({
          where: { id: whatsappAccountId, organizationId },
        });
      }
      if (!account) {
        account = await prisma.whatsAppAccount.findFirst({
          where: { organizationId, status: 'CONNECTED' },
          orderBy: { isDefault: 'desc' },
        });
      }

      if (!account) throw new AppError('No WhatsApp account found', 400);

      const accountWithToken = await metaService.getAccountWithToken(account.id);
      if (!accountWithToken) throw new AppError('Token decryption failed', 500);

      // Initiate the call
      const callResult = await metaApi.initiateCall(
        account.phoneNumberId,
        accountWithToken.accessToken,
        to,
        `org:${organizationId}:contact:${contactId || 'unknown'}`
      );

      // Save call log to DB (non-blocking, CallLog table may not exist yet)
      (prisma as any).callLog?.create({
        data: {
          organizationId,
          whatsappAccountId: account.id,
          contactId: contactId || null,
          conversationId: conversationId || null,
          callId: callResult.callId,
          direction: 'OUTBOUND',
          status: callResult.status,
          to: to.replace(/[^0-9]/g, ''),
          from: account.phoneNumber,
          startedAt: new Date(),
          initiatedBy: userId,
        },
      })?.catch((e: any) => console.warn('Call log save failed:', e.message));

      return res.json({
        success: true,
        message: 'Call initiated successfully',
        data: callResult,
      });

    } catch (error) {
      next(error);
    }
  }

  // ✅ Get call logs
  async getCallLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization required', 400);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const contactId = req.query.contactId as string;
      const direction = req.query.direction as string;

      const where: any = { organizationId };
      if (contactId) where.contactId = contactId;
      if (direction) where.direction = direction.toUpperCase();

      // Try DB first (CallLog table may not exist yet — fail gracefully)
      let logs: any[] = [];
      let total = 0;

      try {
        if (!(prisma as any).callLog) {
          // Table not yet in Prisma schema — skip silently
          console.warn('[Calling] callLog model not available in Prisma client. Run migration to enable.');
        } else {
          [logs, total] = await Promise.all([
            (prisma as any).callLog.findMany({
              where,
              include: {
                contact: {
                  select: {
                    id: true,
                    phone: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
              orderBy: { startedAt: 'desc' },
              skip: (page - 1) * limit,
              take: limit,
            }),
            (prisma as any).callLog.count({ where }),
          ]);
        }
      } catch (dbErr: any) {
        // CallLog table not yet available or query error
        console.warn('[Calling] CallLog query failed (table may not exist yet):', dbErr.message);
        logs = [];
        total = 0;
      }

      return res.json({
        success: true,
        data: logs,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });

    } catch (error) {
      next(error);
    }
  }
}

export const callingController = new CallingController();

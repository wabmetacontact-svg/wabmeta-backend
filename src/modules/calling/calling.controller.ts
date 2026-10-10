// src/modules/calling/calling.controller.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { metaApi } from '../meta/meta.api';
import { metaService } from '../meta/meta.service';
import prisma from '../../config/database';
import { AuthRequest } from '../../types/express';
import { callingService } from './calling.service';

class CallingController {

  // ✅ Get calling settings
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization required', 400);

      // Get WhatsApp account (any status, not just CONNECTED)
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      if (!account) {
        return res.json({
          success: true,
          data: {
            callingEnabled: false,
            showCallButton: true,
            callbackEnabled: true,
            callHoursEnabled: false,
            message: 'No WhatsApp account found',
          },
        });
      }

      // Get token safely
      let settings: any = {
        callingEnabled: false,
        showCallButton: true,
        callbackEnabled: true,
        callHoursEnabled: false,
        restrictToCountries: [],
      };

      try {
        const accountWithToken = await metaService.getAccountWithToken(account.id);
        if (accountWithToken?.accessToken) {
          // Get calling settings from Meta (may fail if calling not supported yet)
          settings = await metaApi.getCallingSettings(
            account.phoneNumberId,
            accountWithToken.accessToken
          );
        }
      } catch (metaErr: any) {
        // Meta settings fetch failed — return defaults (non-blocking)
        console.warn('[Calling] Could not fetch Meta calling settings:', metaErr?.message || metaErr);
      }

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
        showCallButton,
        callbackEnabled,
        callHoursEnabled,
        whatsappAccountId,
        // New fields
        restrictToCountries,
        timezone,
        weeklyHours,
        holidaySchedule,
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

      // Meta ke errors plain Error hote hain, isliye errorHandler unhe 500
      // bana deta tha aur asli wajah (eligibility, invalid field waghera)
      // kabhi user tak pahunchti hi nahi thi.
      const asClientError = (err: any) => {
        const meta = err?.metaError;
        if (!meta) return err;

        const code = meta.code;
        const detail = meta.error_user_msg || meta.message || 'Meta rejected the request';

        // Eligibility - wahi message jo initiateCall deta hai, taaki dono
        // jagah user ko ek hi baat sunai de
        if (code === 141000 || /2000|limit/i.test(detail)) {
          return new AppError(
            'WhatsApp Calling requires a daily messaging limit of at least 2,000 unique recipients. ' +
            'Your number is below that tier right now. ' +
            'Send more campaigns to raise your tier, then try again.',
            403
          );
        }

        // 190 = token problem, baaki sab client-side galti maani jaati hai
        const status = code === 190 ? 401 : 400;

        return new AppError(`WhatsApp Calling: ${detail}`, status);
      };

      // Update calling settings with full schema
      const result = await metaApi.enableCalling(
        account.phoneNumberId,
        accountWithToken.accessToken,
        {
          callingEnabled: callingEnabled ?? true,
          showCallButton: showCallButton ?? true,
          callbackEnabled: callbackEnabled ?? true,
          callHoursEnabled: callHoursEnabled ?? false,
          // Default: koi country restriction nahi.
          // Pehle yahan ['IN'] tha - yaani agar client ye field na bheje to
          // account chup-chaap India-only ho jata tha aur baaki duniya ke
          // customers ko call button dikhna band ho jata. UK/US numbers ke
          // liye ye seedha bug tha.
          restrictToCountries: restrictToCountries ?? [],
          timezone: timezone || 'Asia/Kolkata',
          weeklyHours: weeklyHours || [],
          holidaySchedule: holidaySchedule || [],
        }
      ).catch((err: any) => {
        console.error('[Calling] Meta rejected settings update:', err?.metaError || err?.message);
        throw asClientError(err);
      });

      // The calls webhook field is subscribed once at app level (Meta app
      // dashboard), not per number - nothing to subscribe here.

      return res.json({
        success: true,
        message: callingEnabled
          ? 'Calling enabled successfully'
          : 'Calling disabled successfully',
        data: result,
        // Meta ne callback reject kiya tha aur humne use band karke save kiya
        callbackUnsupported: result.callbackUnsupported === true,
      });

    } catch (error) {
      next(error);
    }
  }

  // ─── Calls (WebRTC in the browser, signalling through here) ───────────────

  private ctx(req: Request) {
    const user = (req as AuthRequest).user;
    if (!user?.organizationId) throw new AppError('Organization required', 400);
    return { organizationId: user.organizationId, userId: user.id };
  }

  private sdpOf(req: Request): string {
    const sdp = req.body?.sdp;
    if (typeof sdp !== 'string' || !sdp.startsWith('v=0') || sdp.length > 20000) {
      throw new AppError('A valid WebRTC SDP is required', 400);
    }
    return sdp;
  }

  async eligibility(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = this.ctx(req);
      res.json({ success: true, data: await callingService.getEligibility(organizationId) });
    } catch (error) { next(error); }
  }

  async activeCalls(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = this.ctx(req);
      res.json({ success: true, data: await callingService.getActiveCalls(organizationId) });
    } catch (error) { next(error); }
  }

  async startCall(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, userId } = this.ctx(req);
      const { to, contactId, conversationId, whatsappAccountId } = req.body || {};
      if (!to) throw new AppError('Phone number required', 400);
      const data = await callingService.startCall({
        organizationId, userId, to: String(to), sdp: this.sdpOf(req),
        contactId, conversationId, whatsappAccountId,
      });
      res.json({ success: true, message: 'Calling…', data });
    } catch (error) { next(error); }
  }

  async acceptCall(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, userId } = this.ctx(req);
      const data = await callingService.acceptCall({ organizationId, userId, callId: String(req.params.callId), sdp: this.sdpOf(req) });
      res.json({ success: true, message: 'Call answered', data });
    } catch (error) { next(error); }
  }

  async rejectCall(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId, userId } = this.ctx(req);
      res.json({ success: true, message: 'Call declined', data: await callingService.rejectCall({ organizationId, userId, callId: String(req.params.callId) }) });
    } catch (error) { next(error); }
  }

  async terminateCall(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = this.ctx(req);
      res.json({ success: true, message: 'Call ended', data: await callingService.terminateCall({ organizationId, callId: String(req.params.callId) }) });
    } catch (error) { next(error); }
  }

  async getPermission(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = this.ctx(req);
      const phone = String(req.query.phone || '');
      if (!phone) throw new AppError('phone is required', 400);
      res.json({ success: true, data: await callingService.getPermission({ organizationId, phone }) });
    } catch (error) { next(error); }
  }

  async requestPermission(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = this.ctx(req);
      const { to, conversationId } = req.body || {};
      if (!to) throw new AppError('Phone number required', 400);
      const result = await callingService.requestPermission({ organizationId, to: String(to), conversationId });
      res.json({ success: true, message: 'Call permission request sent', data: result });
    } catch (error) { next(error); }
  }

  async getPermissionTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = this.ctx(req);
      res.json({ success: true, data: await callingService.getPermissionTemplate({ organizationId }) });
    } catch (error) { next(error); }
  }

  async createPermissionTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = this.ctx(req);
      const data = await callingService.createPermissionTemplate({ organizationId });
      res.json({ success: true, message: 'Call permission template sent to Meta for approval', data });
    } catch (error) { next(error); }
  }

  async getCallLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = this.ctx(req);
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const { logs, total } = await callingService.getCallLogs({
        organizationId, page, limit,
        contactId: (req.query.contactId as string) || undefined,
        direction: (req.query.direction as string) || undefined,
      });
      res.json({ success: true, data: logs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) { next(error); }
  }
}

export const callingController = new CallingController();

// src/modules/payments/payments.controller.ts

import { Request, Response, NextFunction } from 'express';
import { paymentsService } from './payments.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';

interface AuthRequest extends Request {
  user?: { id: string; email: string; organizationId?: string };
  params: any;
}

const orgOf = (req: AuthRequest) => req.user!.organizationId!;

export const paymentsController = {
  async getGateway(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await paymentsService.getGateway(orgOf(req)), 'Payment gateway');
    } catch (e) { next(e); }
  },

  async connectGateway(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await paymentsService.connectGateway(orgOf(req), req.body || {}), 'Razorpay connected');
    } catch (e) { next(e); }
  },

  async disconnectGateway(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await paymentsService.disconnectGateway(orgOf(req)), 'Razorpay disconnected');
    } catch (e) { next(e); }
  },

  /** Body: { amount (₹) | amountPaise, description?, leadId?, contactId?, sendOnWhatsApp? } */
  async createLink(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body || {};
      const amountPaise =
        body.amountPaise !== undefined ? Number(body.amountPaise) : Math.round(Number(body.amount) * 100);
      if (!Number.isFinite(amountPaise)) throw new AppError('amount is required', 400);

      const result = await paymentsService.createPaymentLink({
        organizationId: orgOf(req),
        amountPaise,
        description: body.description,
        leadId: body.leadId,
        contactId: body.contactId,
        conversationId: body.conversationId,
        sendOnWhatsApp: body.sendOnWhatsApp,
        createdVia: 'manual',
        createdById: req.user!.id,
      });
      return sendSuccess(res, result, result.sent ? 'Payment link sent' : 'Payment link created', 201);
    } catch (e) { next(e); }
  },

  async listForLead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await paymentsService.listForLead(orgOf(req), req.params.leadId), 'Lead payments');
    } catch (e) { next(e); }
  },

  async listRecent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await paymentsService.listRecent(orgOf(req), Number(req.query.limit)), 'Payments');
    } catch (e) { next(e); }
  },

  /** Agent "Check status" dabaye - Razorpay se abhi poocho */
  async refresh(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const payment = await paymentsService.syncPayment(req.params.id);
      if (!payment || payment.organizationId !== orgOf(req)) throw new AppError('Payment not found', 404);
      return sendSuccess(res, payment, 'Payment status refreshed');
    } catch (e) { next(e); }
  },

  async resend(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payments = await paymentsService.listRecent(orgOf(req), 200);
      if (!payments.some((p) => p.id === id)) throw new AppError('Payment not found', 404);
      const sent = await paymentsService.sendLinkOnWhatsApp(id);
      return sendSuccess(res, { sent }, sent ? 'Payment link sent' : 'Could not send on WhatsApp (24-hour window closed?)');
    } catch (e) { next(e); }
  },
};

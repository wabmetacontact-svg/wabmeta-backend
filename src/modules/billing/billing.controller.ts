// src/modules/billing/billing.controller.ts

import { Request, Response } from 'express';
import { billingService } from './billing.service';
import { sendSuccess, errorResponse } from '../../utils/response';

class BillingController {
  // ============================================
  // GET SUBSCRIPTION
  // ============================================
  async getSubscription(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const subscription = await billingService.getSubscription(organizationId);
      return sendSuccess(res, subscription, 'Subscription retrieved successfully');
    } catch (error: any) {
      console.error('Get subscription error:', error);
      return errorResponse(res, error.message || 'Failed to get subscription', 500);
    }
  }

  // ============================================
  // GET PLANS
  // ============================================
  async getPlans(req: Request, res: Response) {
    try {
      const plans = await billingService.getPlans();
      return sendSuccess(res, plans, 'Plans retrieved successfully');
    } catch (error: any) {
      console.error('Get plans error:', error);
      return errorResponse(res, error.message || 'Failed to get plans', 500);
    }
  }

  // ============================================
  // GET USAGE
  // ============================================
  async getUsage(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const usage = await billingService.getUsage(organizationId);
      return sendSuccess(res, usage, 'Usage retrieved successfully');
    } catch (error: any) {
      console.error('Get usage error:', error);
      return errorResponse(res, error.message || 'Failed to get usage', 500);
    }
  }

  // ============================================
  // CREATE RAZORPAY ORDER
  // ============================================
  async createRazorpayOrder(req: Request, res: Response) {
    try {
      const { planKey, billingCycle = 'monthly', couponCode } = req.body;
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        return errorResponse(res, 'User not authenticated', 401);
      }

      if (!planKey) {
        return errorResponse(res, 'Plan key is required', 400);
      }

      const order = await billingService.createRazorpayOrder({
        organizationId,
        userId,
        planKey,
        billingCycle: billingCycle as 'monthly' | 'yearly',
        couponCode: couponCode || undefined,
      });

      return sendSuccess(res, order, 'Order created successfully');
    } catch (error: any) {
      console.error('Create Razorpay order error:', error);
      // A refused coupon is the customer's to fix, not a server error.
      return errorResponse(res, error.message || 'Failed to create order', error.statusCode || 500);
    }
  }

  // ============================================
  // COUPON PREVIEW
  // ============================================
  async previewCoupon(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return errorResponse(res, 'User not authenticated', 401);
      }
      const result = await billingService.previewCoupon({
        organizationId,
        planKey: req.body.planKey,
        couponCode: req.body.couponCode,
      });
      return sendSuccess(res, result, 'Coupon applied');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Could not check coupon', error.statusCode || 500);
    }
  }

  // ============================================
  // VERIFY RAZORPAY PAYMENT
  // ============================================
  async verifyRazorpayPayment(req: Request, res: Response) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        return errorResponse(res, 'User not authenticated', 401);
      }

      const result = await billingService.verifyRazorpayPayment({
        organizationId,
        userId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });

      return sendSuccess(res, result, 'Payment verified successfully');
    } catch (error: any) {
      console.error('Verify payment error:', error);
      return errorResponse(res, error.message || 'Payment verification failed', error.statusCode || 500);
    }
  }

  // ============================================
  // UPGRADE PLAN
  // ============================================
  async upgradePlan(req: Request, res: Response) {
    try {
      const { planType, billingCycle } = req.body;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const subscription = await billingService.upgradePlan({
        organizationId,
        planType,
        billingCycle
      });

      return sendSuccess(res, subscription, 'Plan upgraded successfully');
    } catch (error: any) {
      console.error('Upgrade plan error:', error);
      return errorResponse(res, error.message || 'Failed to upgrade plan', 500);
    }
  }

  // ============================================
  // CANCEL SUBSCRIPTION
  // ============================================
  async cancelSubscription(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const { reason } = req.body;

      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const result = await billingService.cancelSubscription(organizationId, reason);
      return sendSuccess(res, result, 'Subscription cancelled successfully');
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      return errorResponse(res, error.message || 'Failed to cancel subscription', 500);
    }
  }

  // ============================================
  // RESUME SUBSCRIPTION
  // ============================================
  async resumeSubscription(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const result = await billingService.resumeSubscription(organizationId);
      return sendSuccess(res, result, 'Subscription resumed successfully');
    } catch (error: any) {
      console.error('Resume subscription error:', error);
      return errorResponse(res, error.message || 'Failed to resume subscription', 500);
    }
  }

  // ============================================
  // GET INVOICES
  // ============================================
  async getInvoices(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const { limit = 10, offset = 0 } = req.query;

      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const invoices = await billingService.getInvoices(
        organizationId,
        Number(limit),
        Number(offset)
      );

      return sendSuccess(res, invoices, 'Invoices retrieved successfully');
    } catch (error: any) {
      console.error('Get invoices error:', error);
      return errorResponse(res, error.message || 'Failed to get invoices', 500);
    }
  }

  // ============================================
  // GET SINGLE INVOICE
  // ============================================
  async getInvoice(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const invoice = await billingService.getInvoice(id, organizationId);
      return sendSuccess(res, invoice, 'Invoice retrieved successfully');
    } catch (error: any) {
      console.error('Get invoice error:', error);
      return errorResponse(res, error.message || 'Failed to get invoice', 500);
    }
  }

  // ============================================
  // DOWNLOAD INVOICE
  // ============================================
  async downloadInvoice(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const pdfBuffer = await billingService.generateInvoicePDF(id, organizationId);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
        'Content-Length': pdfBuffer.length
      });

      return res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Download invoice error:', error);
      return errorResponse(res, error.message || 'Failed to download invoice', 500);
    }
  }
}

export const billingController = new BillingController();
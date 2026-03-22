// src/modules/billing/billing.routes.ts

import { Router } from 'express';
import { billingController } from './billing.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { billingSchema } from './billing.schema';

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

// Get all available plans
router.get('/plans', billingController.getPlans);

// All other routes require authentication
router.use(authenticate);

// ============================================
// SUBSCRIPTION & PLANS
// ============================================

// Get current subscription/plan
router.get('/subscription', billingController.getSubscription);
router.get('/plan', billingController.getSubscription); // Alias

// ============================================
// USAGE
// ============================================

// Get usage statistics
router.get('/usage', billingController.getUsage);

// ============================================
// RAZORPAY INTEGRATION
// ============================================

// Create Razorpay order
router.post(
    '/razorpay/create-order',
    validate(billingSchema.createOrder),
    billingController.createRazorpayOrder
);

// Verify Razorpay payment
router.post(
    '/razorpay/verify',
    validate(billingSchema.verifyPayment),
    billingController.verifyRazorpayPayment
);

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

// Upgrade/change plan
router.post('/upgrade', billingController.upgradePlan);

// Cancel subscription
router.post('/cancel', billingController.cancelSubscription);

// Resume cancelled subscription
router.post('/resume', billingController.resumeSubscription);

// ============================================
// INVOICES
// ============================================

// Get invoices
router.get('/invoices', billingController.getInvoices);

// Get single invoice
router.get('/invoices/:id', billingController.getInvoice);

// Download invoice
router.get('/invoices/:id/download', billingController.downloadInvoice);

export default router;
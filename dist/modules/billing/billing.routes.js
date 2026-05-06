"use strict";
// src/modules/billing/billing.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billing_controller_1 = require("./billing.controller");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const billing_schema_1 = require("./billing.schema");
const router = (0, express_1.Router)();
// ============================================
// PUBLIC ROUTES
// ============================================
// Get all available plans
router.get('/plans', billing_controller_1.billingController.getPlans);
// All other routes require authentication
router.use(auth_1.authenticate);
// ============================================
// SUBSCRIPTION & PLANS
// ============================================
// Get current subscription/plan
router.get('/subscription', billing_controller_1.billingController.getSubscription);
router.get('/plan', billing_controller_1.billingController.getSubscription); // Alias
// ============================================
// USAGE
// ============================================
// Get usage statistics
router.get('/usage', billing_controller_1.billingController.getUsage);
// ============================================
// RAZORPAY INTEGRATION
// ============================================
// Create Razorpay order
router.post('/razorpay/create-order', (0, validate_1.validate)(billing_schema_1.billingSchema.createOrder), billing_controller_1.billingController.createRazorpayOrder);
// Verify Razorpay payment
router.post('/razorpay/verify', (0, validate_1.validate)(billing_schema_1.billingSchema.verifyPayment), billing_controller_1.billingController.verifyRazorpayPayment);
// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================
// Upgrade/change plan
router.post('/upgrade', billing_controller_1.billingController.upgradePlan);
// Cancel subscription
router.post('/cancel', billing_controller_1.billingController.cancelSubscription);
// Resume cancelled subscription
router.post('/resume', billing_controller_1.billingController.resumeSubscription);
// ============================================
// INVOICES
// ============================================
// Get invoices
router.get('/invoices', billing_controller_1.billingController.getInvoices);
// Get single invoice
router.get('/invoices/:id', billing_controller_1.billingController.getInvoice);
// Download invoice
router.get('/invoices/:id/download', billing_controller_1.billingController.downloadInvoice);
exports.default = router;
//# sourceMappingURL=billing.routes.js.map
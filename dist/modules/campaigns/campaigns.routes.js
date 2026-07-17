"use strict";
// src/modules/campaigns/campaigns.routes.ts - FIXED
// ✅ FIX Bug4: Removed duplicate /:campaignId/* routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaigns_controller_1 = require("./campaigns.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const response_1 = require("../../utils/response");
const planLimits_1 = require("../../middleware/planLimits");
const campaigns_schema_1 = require("./campaigns.schema");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// ─── Static routes (before /:id) ──────────────────────────────
router.get('/stats', campaigns_controller_1.campaignsController.getStats.bind(campaigns_controller_1.campaignsController));
router.post('/upload-contacts', campaigns_controller_1.csvUpload, campaigns_controller_1.campaignsController.uploadContacts.bind(campaigns_controller_1.campaignsController));
router.get('/upload-template', campaigns_controller_1.campaignsController.getUploadTemplate.bind(campaigns_controller_1.campaignsController));
router.post('/upload-validate', campaigns_controller_1.csvUpload, campaigns_controller_1.campaignsController.validateCsvFile.bind(campaigns_controller_1.campaignsController));
// Queue stubs (backward compat)
router.get('/queue/stats', (_req, res) => (0, response_1.successResponse)(res, {
    data: { enabled: false, message: 'Direct send mode active' },
    message: 'Queue disabled',
}));
router.post('/queue/retry/:campaignId?', (_req, res) => (0, response_1.successResponse)(res, {
    data: { retriedCount: 0 },
    message: 'Use POST /campaigns/:id/retry instead',
}));
router.post('/queue/clear', (_req, res) => (0, response_1.successResponse)(res, { data: { clearedCount: 0 }, message: 'Queue disabled' }));
router.get('/queue/health', (_req, res) => (0, response_1.successResponse)(res, {
    data: { enabled: false, healthy: true, timestamp: new Date() },
    message: 'Queue disabled - system healthy',
}));
// ─── CRUD ─────────────────────────────────────────────────────
router.post('/', planLimits_1.requireActiveSubscription, planLimits_1.checkCampaignLimit, (0, validate_1.validate)(campaigns_schema_1.createCampaignSchema), campaigns_controller_1.campaignsController.create.bind(campaigns_controller_1.campaignsController));
router.get('/', (0, validate_1.validate)(campaigns_schema_1.getCampaignsSchema), campaigns_controller_1.campaignsController.getList.bind(campaigns_controller_1.campaignsController));
// ─── Dynamic routes ────────────────────────────────────────────
router.get('/:id', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getById.bind(campaigns_controller_1.campaignsController));
router.put('/:id', (0, validate_1.validate)(campaigns_schema_1.updateCampaignSchema), campaigns_controller_1.campaignsController.update.bind(campaigns_controller_1.campaignsController));
router.delete('/:id', (0, validate_1.validate)(campaigns_schema_1.deleteCampaignSchema), campaigns_controller_1.campaignsController.delete.bind(campaigns_controller_1.campaignsController));
// Analytics
router.get('/:id/analytics', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getAnalytics.bind(campaigns_controller_1.campaignsController));
router.get('/:id/contacts', (0, validate_1.validate)(campaigns_schema_1.getCampaignContactsSchema), campaigns_controller_1.campaignsController.getContacts.bind(campaigns_controller_1.campaignsController));
router.get('/:id/estimate-cost', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.estimateCost.bind(campaigns_controller_1.campaignsController));
router.get('/:id/stats', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getDetailedStats.bind(campaigns_controller_1.campaignsController));
// Control
router.post('/:id/start', planLimits_1.requireActiveSubscription, (0, validate_1.validate)(campaigns_schema_1.startCampaignSchema), campaigns_controller_1.campaignsController.start.bind(campaigns_controller_1.campaignsController));
router.post('/:id/pause', (0, validate_1.validate)(campaigns_schema_1.pauseCampaignSchema), campaigns_controller_1.campaignsController.pause.bind(campaigns_controller_1.campaignsController));
router.post('/:id/resume', (0, validate_1.validate)(campaigns_schema_1.resumeCampaignSchema), campaigns_controller_1.campaignsController.resume.bind(campaigns_controller_1.campaignsController));
router.post('/:id/cancel', (0, validate_1.validate)(campaigns_schema_1.cancelCampaignSchema), campaigns_controller_1.campaignsController.cancel.bind(campaigns_controller_1.campaignsController));
router.post('/:id/retry', (0, validate_1.validate)(campaigns_schema_1.retryCampaignSchema), campaigns_controller_1.campaignsController.retry.bind(campaigns_controller_1.campaignsController));
router.post('/:id/duplicate', (0, validate_1.validate)(campaigns_schema_1.duplicateCampaignSchema), campaigns_controller_1.campaignsController.duplicate.bind(campaigns_controller_1.campaignsController));
// Recipients & export
router.get('/:id/failed', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getFailedContacts.bind(campaigns_controller_1.campaignsController));
router.get('/:id/failed/export', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.exportFailedContacts.bind(campaigns_controller_1.campaignsController));
router.post('/:id/retry-failed', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.retryFailedOnly.bind(campaigns_controller_1.campaignsController));
router.get('/:id/recipients', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getAllRecipients.bind(campaigns_controller_1.campaignsController));
router.get('/:id/recipients/export', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.exportRecipients.bind(campaigns_controller_1.campaignsController));
exports.default = router;
//# sourceMappingURL=campaigns.routes.js.map
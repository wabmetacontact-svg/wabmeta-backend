"use strict";
// 📁 src/modules/campaigns/campaigns.routes.ts - COMPLETE WITH CSV UPLOAD
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaigns_controller_1 = require("./campaigns.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const response_1 = require("../../utils/response");
const planLimits_1 = require("../../middleware/planLimits");
const campaigns_schema_1 = require("./campaigns.schema");
const router = (0, express_1.Router)();
// ============================================
// MIDDLEWARE
// ============================================
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// STATISTICS & ANALYTICS (Must be before :id routes)
// ============================================
/**
 * @route   GET /api/v1/campaigns/stats
 * @desc    Get campaign statistics for organization
 * @access  Private
 */
router.get('/stats', campaigns_controller_1.campaignsController.getStats.bind(campaigns_controller_1.campaignsController));
// ============================================
// CSV UPLOAD ROUTES (Must be before :id routes)
// ============================================
/**
 * @route   POST /api/v1/campaigns/upload-contacts
 * @desc    Upload CSV and create contacts
 * @access  Private
 * @body    FormData with 'file' field containing CSV
 */
router.post('/upload-contacts', campaigns_controller_1.csvUpload, campaigns_controller_1.campaignsController.uploadContacts.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/upload-template
 * @desc    Get CSV upload template format
 * @access  Private
 */
router.get('/upload-template', campaigns_controller_1.campaignsController.getUploadTemplate.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/upload-validate
 * @desc    Validate CSV file without importing
 * @access  Private
 * @body    FormData with 'file' field containing CSV
 */
router.post('/upload-validate', campaigns_controller_1.csvUpload, campaigns_controller_1.campaignsController.validateCsvFile.bind(campaigns_controller_1.campaignsController));
// ============================================
// CAMPAIGN CRUD ROUTES
// ============================================
/**
 * @route   POST /api/v1/campaigns
 * @desc    Create new campaign
 * @access  Private
 */
router.post('/', planLimits_1.checkCampaignLimit, (0, validate_1.validate)(campaigns_schema_1.createCampaignSchema), campaigns_controller_1.campaignsController.create.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns
 * @desc    Get campaigns list with pagination
 * @access  Private
 */
router.get('/', (0, validate_1.validate)(campaigns_schema_1.getCampaignsSchema), campaigns_controller_1.campaignsController.getList.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id
 * @desc    Get campaign by ID
 * @access  Private
 */
router.get('/:id', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getById.bind(campaigns_controller_1.campaignsController));
/**
 * @route   PUT /api/v1/campaigns/:id
 * @desc    Update campaign (only DRAFT or SCHEDULED)
 * @access  Private
 */
router.put('/:id', (0, validate_1.validate)(campaigns_schema_1.updateCampaignSchema), campaigns_controller_1.campaignsController.update.bind(campaigns_controller_1.campaignsController));
/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete campaign (cannot delete RUNNING campaigns)
 * @access  Private
 */
router.delete('/:id', (0, validate_1.validate)(campaigns_schema_1.deleteCampaignSchema), campaigns_controller_1.campaignsController.delete.bind(campaigns_controller_1.campaignsController));
// ============================================
// CAMPAIGN ANALYTICS & CONTACTS
// ============================================
/**
 * @route   GET /api/v1/campaigns/:id/analytics
 * @desc    Get detailed campaign analytics
 * @access  Private
 */
router.get('/:id/analytics', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getAnalytics.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id/contacts
 * @desc    Get campaign contacts with delivery status
 * @access  Private
 */
router.get('/:id/contacts', (0, validate_1.validate)(campaigns_schema_1.getCampaignContactsSchema), campaigns_controller_1.campaignsController.getContacts.bind(campaigns_controller_1.campaignsController));
// ============================================
// CAMPAIGN CONTROL ROUTES
// ============================================
/**
 * @route   GET /api/v1/campaigns/:id/estimate-cost
 * @desc    Get estimated wallet cost before starting campaign
 * @access  Private
 */
router.get('/:id/estimate-cost', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.estimateCost.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/start
 * @desc    Start campaign (validates token before starting)
 * @access  Private
 */
router.post('/:id/start', (0, validate_1.validate)(campaigns_schema_1.startCampaignSchema), campaigns_controller_1.campaignsController.start.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/pause
 * @desc    Pause running campaign
 * @access  Private
 */
router.post('/:id/pause', (0, validate_1.validate)(campaigns_schema_1.pauseCampaignSchema), campaigns_controller_1.campaignsController.pause.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/resume
 * @desc    Resume paused campaign (validates token)
 * @access  Private
 */
router.post('/:id/resume', (0, validate_1.validate)(campaigns_schema_1.resumeCampaignSchema), campaigns_controller_1.campaignsController.resume.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/cancel
 * @desc    Cancel campaign (marks as FAILED)
 * @access  Private
 */
router.post('/:id/cancel', (0, validate_1.validate)(campaigns_schema_1.cancelCampaignSchema), campaigns_controller_1.campaignsController.cancel.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/retry
 * @desc    Retry failed/pending messages
 * @access  Private
 */
router.post('/:id/retry', (0, validate_1.validate)(campaigns_schema_1.retryCampaignSchema), campaigns_controller_1.campaignsController.retry.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/duplicate
 * @desc    Duplicate campaign with new name
 * @access  Private
 */
router.post('/:id/duplicate', (0, validate_1.validate)(campaigns_schema_1.duplicateCampaignSchema), campaigns_controller_1.campaignsController.duplicate.bind(campaigns_controller_1.campaignsController));
// ============================================
// QUEUE MANAGEMENT (Optional - if using message queue)
// ============================================
/**
 * @route   GET /api/v1/campaigns/:id/failed
 * @desc    Get failed contacts for a campaign
 */
router.get('/:id/failed', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getFailedContacts.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id/failed/export
 * @desc    Export failed contacts as CSV
 */
router.get('/:id/failed/export', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.exportFailedContacts.bind(campaigns_controller_1.campaignsController));
/**
 * @route   POST /api/v1/campaigns/:id/retry-failed
 * @desc    Retry only failed contacts
 */
router.post('/:id/retry-failed', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.retryFailedOnly.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id/recipients
 * @desc    Get all recipients with their status
 */
router.get('/:id/recipients', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.getAllRecipients.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/:id/recipients/export
 * @desc    Export recipients as CSV
 */
router.get('/:id/recipients/export', (0, validate_1.validate)(campaigns_schema_1.getCampaignByIdSchema), campaigns_controller_1.campaignsController.exportRecipients.bind(campaigns_controller_1.campaignsController));
/**
 * @route   GET /api/v1/campaigns/queue/stats
 * @desc    Get message queue statistics (queue disabled - using direct send)
 * @access  Private
 */
router.get('/queue/stats', async (req, res) => {
    return (0, response_1.successResponse)(res, {
        data: {
            enabled: false,
            message: 'Bull queue removed. Campaigns send directly via Meta API.',
            waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0,
        },
        message: 'Queue disabled - using direct send',
    });
});
/**
 * @route   POST /api/v1/campaigns/queue/retry/:campaignId?
 * @desc    Retry failed messages (use campaign retry-failed endpoint instead)
 * @access  Private
 */
router.post('/queue/retry/:campaignId?', async (req, res) => {
    return (0, response_1.successResponse)(res, {
        data: { retriedCount: 0 },
        message: 'Bull queue removed. Use POST /campaigns/:id/retry-failed instead.',
    });
});
/**
 * @route   POST /api/v1/campaigns/queue/clear
 * @desc    Clear failed messages (queue disabled)
 * @access  Private
 */
router.post('/queue/clear', async (req, res) => {
    return (0, response_1.successResponse)(res, {
        data: { clearedCount: 0 },
        message: 'Bull queue removed. No queue to clear.',
    });
});
/**
 * @route   GET /api/v1/campaigns/queue/health
 * @desc    Check queue health status (queue disabled)
 * @access  Private
 */
router.get('/queue/health', async (req, res) => {
    return (0, response_1.successResponse)(res, {
        data: {
            enabled: false,
            healthy: true,
            message: 'Bull queue removed. Campaigns send directly via Meta API.',
            timestamp: new Date(),
        },
        message: 'Queue disabled - system healthy',
    });
});
// ============================================
// ✅ NEW: CAMPAIGN DETAILS & ACTIONS
// ============================================
router.get('/:campaignId/contacts', auth_1.authenticate, campaigns_controller_1.campaignsController.getContacts.bind(campaigns_controller_1.campaignsController));
router.get('/:campaignId/stats', auth_1.authenticate, campaigns_controller_1.campaignsController.getDetailedStats.bind(campaigns_controller_1.campaignsController));
router.post('/:campaignId/retry', auth_1.authenticate, campaigns_controller_1.campaignsController.retryFailed.bind(campaigns_controller_1.campaignsController));
router.post('/:campaignId/resume', auth_1.authenticate, campaigns_controller_1.campaignsController.resumePending.bind(campaigns_controller_1.campaignsController));
exports.default = router;
//# sourceMappingURL=campaigns.routes.js.map
// 📁 src/modules/campaigns/campaigns.routes.ts - COMPLETE WITH CSV UPLOAD

import { Router } from 'express';
import { campaignsController, csvUpload } from './campaigns.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { successResponse } from '../../utils/response';
import { requireActiveSubscription, checkCampaignLimit } from '../../middleware/planLimits';
import {
  createCampaignSchema,
  updateCampaignSchema,
  getCampaignsSchema,
  getCampaignByIdSchema,
  deleteCampaignSchema,
  getCampaignContactsSchema,
  startCampaignSchema,
  pauseCampaignSchema,
  resumeCampaignSchema,
  cancelCampaignSchema,
  retryCampaignSchema,
  duplicateCampaignSchema,
} from './campaigns.schema';

const router = Router();

// ============================================
// MIDDLEWARE
// ============================================

// All routes require authentication
router.use(authenticate);

// ============================================
// STATISTICS & ANALYTICS (Must be before :id routes)
// ============================================

/**
 * @route   GET /api/v1/campaigns/stats
 * @desc    Get campaign statistics for organization
 * @access  Private
 */
router.get('/stats', campaignsController.getStats.bind(campaignsController));

// ============================================
// CSV UPLOAD ROUTES (Must be before :id routes)
// ============================================

/**
 * @route   POST /api/v1/campaigns/upload-contacts
 * @desc    Upload CSV and create contacts
 * @access  Private
 * @body    FormData with 'file' field containing CSV
 */
router.post(
  '/upload-contacts',
  csvUpload,
  campaignsController.uploadContacts.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/upload-template
 * @desc    Get CSV upload template format
 * @access  Private
 */
router.get(
  '/upload-template',
  campaignsController.getUploadTemplate.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/upload-validate
 * @desc    Validate CSV file without importing
 * @access  Private
 * @body    FormData with 'file' field containing CSV
 */
router.post(
  '/upload-validate',
  csvUpload,
  campaignsController.validateCsvFile.bind(campaignsController)
);

// ============================================
// CAMPAIGN CRUD ROUTES
// ============================================

/**
 * @route   POST /api/v1/campaigns
 * @desc    Create new campaign
 * @access  Private
 */
router.post(
  '/',
  requireActiveSubscription,
  checkCampaignLimit,
  validate(createCampaignSchema),
  campaignsController.create.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns
 * @desc    Get campaigns list with pagination
 * @access  Private
 */
router.get(
  '/',
  validate(getCampaignsSchema),
  campaignsController.getList.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/:id
 * @desc    Get campaign by ID
 * @access  Private
 */
router.get(
  '/:id',
  validate(getCampaignByIdSchema),
  campaignsController.getById.bind(campaignsController)
);

/**
 * @route   PUT /api/v1/campaigns/:id
 * @desc    Update campaign (only DRAFT or SCHEDULED)
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateCampaignSchema),
  campaignsController.update.bind(campaignsController)
);

/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    Delete campaign (cannot delete RUNNING campaigns)
 * @access  Private
 */
router.delete(
  '/:id',
  validate(deleteCampaignSchema),
  campaignsController.delete.bind(campaignsController)
);

// ============================================
// CAMPAIGN ANALYTICS & CONTACTS
// ============================================

/**
 * @route   GET /api/v1/campaigns/:id/analytics
 * @desc    Get detailed campaign analytics
 * @access  Private
 */
router.get(
  '/:id/analytics',
  validate(getCampaignByIdSchema),
  campaignsController.getAnalytics.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/:id/contacts
 * @desc    Get campaign contacts with delivery status
 * @access  Private
 */
router.get(
  '/:id/contacts',
  validate(getCampaignContactsSchema),
  campaignsController.getContacts.bind(campaignsController)
);

// ============================================
// CAMPAIGN CONTROL ROUTES
// ============================================

/**
 * @route   GET /api/v1/campaigns/:id/estimate-cost
 * @desc    Get estimated wallet cost before starting campaign
 * @access  Private
 */
router.get(
  '/:id/estimate-cost',
  validate(getCampaignByIdSchema),
  campaignsController.estimateCost.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/start
 * @desc    Start campaign (validates token before starting)
 * @access  Private
 */
router.post(
  '/:id/start',
  requireActiveSubscription,
  validate(startCampaignSchema),
  campaignsController.start.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/pause
 * @desc    Pause running campaign
 * @access  Private
 */
router.post(
  '/:id/pause',
  validate(pauseCampaignSchema),
  campaignsController.pause.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/resume
 * @desc    Resume paused campaign (validates token)
 * @access  Private
 */
router.post(
  '/:id/resume',
  validate(resumeCampaignSchema),
  campaignsController.resume.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/cancel
 * @desc    Cancel campaign (marks as FAILED)
 * @access  Private
 */
router.post(
  '/:id/cancel',
  validate(cancelCampaignSchema),
  campaignsController.cancel.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/retry
 * @desc    Retry failed/pending messages
 * @access  Private
 */
router.post(
  '/:id/retry',
  validate(retryCampaignSchema),
  campaignsController.retry.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/duplicate
 * @desc    Duplicate campaign with new name
 * @access  Private
 */
router.post(
  '/:id/duplicate',
  validate(duplicateCampaignSchema),
  campaignsController.duplicate.bind(campaignsController)
);

// ============================================
// QUEUE MANAGEMENT (Optional - if using message queue)
// ============================================

/**
 * @route   GET /api/v1/campaigns/:id/failed
 * @desc    Get failed contacts for a campaign
 */
router.get(
  '/:id/failed',
  validate(getCampaignByIdSchema),
  campaignsController.getFailedContacts.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/:id/failed/export
 * @desc    Export failed contacts as CSV
 */
router.get(
  '/:id/failed/export',
  validate(getCampaignByIdSchema),
  campaignsController.exportFailedContacts.bind(campaignsController)
);

/**
 * @route   POST /api/v1/campaigns/:id/retry-failed
 * @desc    Retry only failed contacts
 */
router.post(
  '/:id/retry-failed',
  validate(getCampaignByIdSchema),
  campaignsController.retryFailedOnly.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/:id/recipients
 * @desc    Get all recipients with their status
 */
router.get(
  '/:id/recipients',
  validate(getCampaignByIdSchema),
  campaignsController.getAllRecipients.bind(campaignsController)
);

/**
 * @route   GET /api/v1/campaigns/:id/recipients/export
 * @desc    Export recipients as CSV
 */
router.get(
  '/:id/recipients/export',
  validate(getCampaignByIdSchema),
  campaignsController.exportRecipients.bind(campaignsController)
);


/**
 * @route   GET /api/v1/campaigns/queue/stats
 * @desc    Get message queue statistics (queue disabled - using direct send)
 * @access  Private
 */
router.get('/queue/stats', async (req, res) => {
  return successResponse(res, {
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
  return successResponse(res, {
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
  return successResponse(res, {
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
  return successResponse(res, {
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
router.get('/:campaignId/contacts', authenticate, campaignsController.getContacts.bind(campaignsController));
router.get('/:campaignId/stats', authenticate, campaignsController.getDetailedStats.bind(campaignsController));
router.post('/:campaignId/retry', authenticate, campaignsController.retryFailed.bind(campaignsController));
router.post('/:campaignId/resume', authenticate, campaignsController.resumePending.bind(campaignsController));

export default router;
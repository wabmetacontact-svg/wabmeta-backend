// src/modules/campaigns/campaigns.routes.ts - FIXED
// ✅ FIX Bug4: Removed duplicate /:campaignId/* routes

import { Router } from 'express';
import { campaignsController, csvUpload } from './campaigns.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { successResponse } from '../../utils/response';
import {
  requireActiveSubscription,
  checkCampaignLimit,
} from '../../middleware/planLimits';
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

router.use(authenticate);

// ─── Static routes (before /:id) ──────────────────────────────

router.get('/stats',
  campaignsController.getStats.bind(campaignsController)
);

router.post('/upload-contacts',
  csvUpload,
  campaignsController.uploadContacts.bind(campaignsController)
);

router.get('/upload-template',
  campaignsController.getUploadTemplate.bind(campaignsController)
);

router.post('/upload-validate',
  csvUpload,
  campaignsController.validateCsvFile.bind(campaignsController)
);

// Queue stubs (backward compat)
router.get('/queue/stats', (_req, res) =>
  successResponse(res, {
    data: { enabled: false, message: 'Direct send mode active' },
    message: 'Queue disabled',
  })
);
router.post('/queue/retry/:campaignId?', (_req, res) =>
  successResponse(res, {
    data: { retriedCount: 0 },
    message: 'Use POST /campaigns/:id/retry instead',
  })
);
router.post('/queue/clear', (_req, res) =>
  successResponse(res, { data: { clearedCount: 0 }, message: 'Queue disabled' })
);
router.get('/queue/health', (_req, res) =>
  successResponse(res, {
    data: { enabled: false, healthy: true, timestamp: new Date() },
    message: 'Queue disabled - system healthy',
  })
);

// ─── CRUD ─────────────────────────────────────────────────────

router.post('/',
  requireActiveSubscription,
  checkCampaignLimit,
  validate(createCampaignSchema),
  campaignsController.create.bind(campaignsController)
);

router.get('/',
  validate(getCampaignsSchema),
  campaignsController.getList.bind(campaignsController)
);

// ─── Dynamic routes ────────────────────────────────────────────

router.get('/:id',
  validate(getCampaignByIdSchema),
  campaignsController.getById.bind(campaignsController)
);

router.put('/:id',
  validate(updateCampaignSchema),
  campaignsController.update.bind(campaignsController)
);

router.delete('/:id',
  validate(deleteCampaignSchema),
  campaignsController.delete.bind(campaignsController)
);

// Analytics
router.get('/:id/analytics',
  validate(getCampaignByIdSchema),
  campaignsController.getAnalytics.bind(campaignsController)
);

router.get('/:id/contacts',
  validate(getCampaignContactsSchema),
  campaignsController.getContacts.bind(campaignsController)
);

router.get('/:id/estimate-cost',
  validate(getCampaignByIdSchema),
  campaignsController.estimateCost.bind(campaignsController)
);

router.get('/:id/stats',
  validate(getCampaignByIdSchema),
  campaignsController.getDetailedStats.bind(campaignsController)
);

// Control
router.post('/:id/start',
  requireActiveSubscription,
  validate(startCampaignSchema),
  campaignsController.start.bind(campaignsController)
);

router.post('/:id/pause',
  validate(pauseCampaignSchema),
  campaignsController.pause.bind(campaignsController)
);

router.post('/:id/resume',
  validate(resumeCampaignSchema),
  campaignsController.resume.bind(campaignsController)
);

router.post('/:id/cancel',
  validate(cancelCampaignSchema),
  campaignsController.cancel.bind(campaignsController)
);

router.post('/:id/retry',
  validate(retryCampaignSchema),
  campaignsController.retry.bind(campaignsController)
);

router.post('/:id/duplicate',
  validate(duplicateCampaignSchema),
  campaignsController.duplicate.bind(campaignsController)
);

// Recipients & export
router.get('/:id/failed',
  validate(getCampaignByIdSchema),
  campaignsController.getFailedContacts.bind(campaignsController)
);

router.get('/:id/failed/export',
  validate(getCampaignByIdSchema),
  campaignsController.exportFailedContacts.bind(campaignsController)
);

router.post('/:id/retry-failed',
  validate(getCampaignByIdSchema),
  campaignsController.retryFailedOnly.bind(campaignsController)
);

router.get('/:id/recipients',
  validate(getCampaignByIdSchema),
  campaignsController.getAllRecipients.bind(campaignsController)
);

router.get('/:id/recipients/export',
  validate(getCampaignByIdSchema),
  campaignsController.exportRecipients.bind(campaignsController)
);

export default router;
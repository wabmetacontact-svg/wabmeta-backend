// src/modules/analytics/analytics.routes.ts

import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth';
import { featureLock } from '../../middleware/featureLock';

const router = Router();

router.use(authenticate);

// Reports page isi module se chalta hai - admin ise lock kar sakta hai
router.use(featureLock('reports'));

// Overview stats
router.get('/overview', analyticsController.getOverview);
router.get('/unified', analyticsController.getUnifiedDashboard);

// Specific analytics
router.get('/messages', analyticsController.getMessageAnalytics);
router.get('/campaigns', analyticsController.getCampaignAnalytics);
router.get('/contacts', analyticsController.getContactAnalytics);
router.get('/conversations', analyticsController.getConversationAnalytics);
router.get('/templates', analyticsController.getTemplateAnalytics);

// Export
router.get('/export', analyticsController.exportAnalytics);

export default router;
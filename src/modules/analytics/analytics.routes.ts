// src/modules/analytics/analytics.routes.ts

import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

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
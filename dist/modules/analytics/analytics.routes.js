"use strict";
// src/modules/analytics/analytics.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("./analytics.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Overview stats
router.get('/overview', analytics_controller_1.analyticsController.getOverview);
router.get('/unified', analytics_controller_1.analyticsController.getUnifiedDashboard);
// Specific analytics
router.get('/messages', analytics_controller_1.analyticsController.getMessageAnalytics);
router.get('/campaigns', analytics_controller_1.analyticsController.getCampaignAnalytics);
router.get('/contacts', analytics_controller_1.analyticsController.getContactAnalytics);
router.get('/conversations', analytics_controller_1.analyticsController.getConversationAnalytics);
router.get('/templates', analytics_controller_1.analyticsController.getTemplateAnalytics);
// Export
router.get('/export', analytics_controller_1.analyticsController.exportAnalytics);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map
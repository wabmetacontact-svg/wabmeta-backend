"use strict";
// src/modules/analytics/analytics.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = void 0;
const analytics_service_1 = require("./analytics.service");
const response_1 = require("../../utils/response");
class AnalyticsController {
    async getOverview(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const { startDate, endDate } = req.query;
            const dateRange = startDate && endDate
                ? { start: new Date(startDate), end: new Date(endDate) }
                : undefined;
            const data = await analytics_service_1.analyticsService.getOverviewStats(organizationId, dateRange);
            return (0, response_1.sendSuccess)(res, data, 'Overview stats retrieved');
        }
        catch (error) {
            console.error('Get overview error:', error);
            return (0, response_1.errorResponse)(res, error.message, 500);
        }
    }
    async getUnifiedDashboard(req, res) {
        try {
            const organizationId = req.user?.organizationId || req.headers['x-organization-id'];
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const days = parseInt(req.query.days) || 30;
            const data = await analytics_service_1.analyticsService.getUnifiedDashboardStats(organizationId, days);
            return (0, response_1.sendSuccess)(res, data, 'Unified dashboard stats retrieved');
        }
        catch (error) {
            console.error('Get unified dashboard error:', error);
            return (0, response_1.errorResponse)(res, error.message, 500);
        }
    }
    async getMessageAnalytics(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const days = parseInt(req.query.days) || 30;
            const data = await analytics_service_1.analyticsService.getMessageAnalytics(organizationId, days);
            return (0, response_1.sendSuccess)(res, data, 'Message analytics retrieved');
        }
        catch (error) {
            console.error('Get message analytics error:', error);
            return (0, response_1.errorResponse)(res, error.message, 500);
        }
    }
    async getCampaignAnalytics(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const limit = parseInt(req.query.limit) || 10;
            const data = await analytics_service_1.analyticsService.getCampaignAnalytics(organizationId, limit);
            return (0, response_1.sendSuccess)(res, data, 'Campaign analytics retrieved');
        }
        catch (error) {
            console.error('Get campaign analytics error:', error);
            return (0, response_1.errorResponse)(res, error.message, 500);
        }
    }
    async getContactAnalytics(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const days = parseInt(req.query.days) || 30;
            const data = await analytics_service_1.analyticsService.getContactAnalytics(organizationId, days);
            return (0, response_1.sendSuccess)(res, data, 'Contact analytics retrieved');
        }
        catch (error) {
            console.error('Get contact analytics error:', error);
            return (0, response_1.errorResponse)(res, error.message, 500);
        }
    }
    async getConversationAnalytics(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const days = parseInt(req.query.days) || 30;
            const data = await analytics_service_1.analyticsService.getConversationAnalytics(organizationId, days);
            return (0, response_1.sendSuccess)(res, data, 'Conversation analytics retrieved');
        }
        catch (error) {
            console.error('Get conversation analytics error:', error);
            return (0, response_1.errorResponse)(res, error.message, 500);
        }
    }
    async getTemplateAnalytics(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const data = await analytics_service_1.analyticsService.getTemplateAnalytics(organizationId);
            return (0, response_1.sendSuccess)(res, data, 'Template analytics retrieved');
        }
        catch (error) {
            console.error('Get template analytics error:', error);
            return (0, response_1.errorResponse)(res, error.message, 500);
        }
    }
    async exportAnalytics(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const { type = 'overview', format = 'json' } = req.query;
            const data = await analytics_service_1.analyticsService.exportAnalytics(organizationId, type, format);
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=${type}-analytics.csv`);
                return res.send(data);
            }
            return (0, response_1.sendSuccess)(res, data, 'Analytics exported');
        }
        catch (error) {
            console.error('Export analytics error:', error);
            return (0, response_1.errorResponse)(res, error.message, 500);
        }
    }
}
exports.analyticsController = new AnalyticsController();
//# sourceMappingURL=analytics.controller.js.map
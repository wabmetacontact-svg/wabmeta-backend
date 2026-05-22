"use strict";
// src/modules/dashboard/dashboard.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = void 0;
const dashboard_service_1 = require("./dashboard.service");
const response_1 = require("../../utils/response");
class DashboardController {
    async getStats(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const stats = await dashboard_service_1.dashboardService.getStats(organizationId);
            return (0, response_1.sendSuccess)(res, stats, 'Dashboard stats retrieved');
        }
        catch (error) {
            console.error('❌ Dashboard stats error:', {
                message: error.message,
                stack: error.stack?.split('\n')[1], // First stack line only
                organizationId: req.user?.organizationId,
            });
            return (0, response_1.errorResponse)(res, 'Failed to get stats', 500);
        }
    }
    async getWidgets(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const days = Math.min(parseInt(req.query.days) || 7, 90); // Max 90 days
            const widgets = await dashboard_service_1.dashboardService.getWidgets(organizationId, days);
            return (0, response_1.sendSuccess)(res, widgets, 'Dashboard widgets retrieved');
        }
        catch (error) {
            console.error('❌ Dashboard widgets error:', {
                message: error.message,
                stack: error.stack?.split('\n')[1],
                organizationId: req.user?.organizationId,
            });
            return (0, response_1.errorResponse)(res, 'Failed to get widgets', 500);
        }
    }
    async getActivity(req, res) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            const limit = parseInt(req.query.limit) || 10;
            const activity = await dashboard_service_1.dashboardService.getActivity(organizationId, limit);
            return (0, response_1.sendSuccess)(res, activity, 'Activity retrieved');
        }
        catch (error) {
            console.error('Get dashboard activity error:', error);
            return (0, response_1.errorResponse)(res, error.message || 'Failed to get activity', 500);
        }
    }
}
exports.dashboardController = new DashboardController();
exports.default = exports.dashboardController;
//# sourceMappingURL=dashboard.controller.js.map
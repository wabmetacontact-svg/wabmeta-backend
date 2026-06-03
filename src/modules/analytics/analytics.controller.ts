// src/modules/analytics/analytics.controller.ts

import { Request, Response } from 'express';
import { analyticsService } from './analytics.service';
import { sendSuccess, errorResponse } from '../../utils/response';

class AnalyticsController {
    async getOverview(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return errorResponse(res, 'Organization not found', 400);
            }

            const { startDate, endDate } = req.query;
            const dateRange = startDate && endDate
                ? { start: new Date(startDate as string), end: new Date(endDate as string) }
                : undefined;

            const data = await analyticsService.getOverviewStats(organizationId, dateRange);
            return sendSuccess(res, data, 'Overview stats retrieved');
        } catch (error: any) {
            console.error('Get overview error:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    async getUnifiedDashboard(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId || req.headers['x-organization-id'];
            if (!organizationId) {
                return errorResponse(res, 'Organization not found', 400);
            }

            const days = parseInt(req.query.days as string) || 30;
            const data = await analyticsService.getUnifiedDashboardStats(organizationId as string, days);
            return sendSuccess(res, data, 'Unified dashboard stats retrieved');
        } catch (error: any) {
            console.error('Get unified dashboard error:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    async getMessageAnalytics(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return errorResponse(res, 'Organization not found', 400);
            }

            const days = parseInt(req.query.days as string) || 30;
            const data = await analyticsService.getMessageAnalytics(organizationId, days);
            return sendSuccess(res, data, 'Message analytics retrieved');
        } catch (error: any) {
            console.error('Get message analytics error:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    async getCampaignAnalytics(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return errorResponse(res, 'Organization not found', 400);
            }

            const limit = parseInt(req.query.limit as string) || 10;
            const data = await analyticsService.getCampaignAnalytics(organizationId, limit);
            return sendSuccess(res, data, 'Campaign analytics retrieved');
        } catch (error: any) {
            console.error('Get campaign analytics error:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    async getContactAnalytics(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return errorResponse(res, 'Organization not found', 400);
            }

            const days = parseInt(req.query.days as string) || 30;
            const data = await analyticsService.getContactAnalytics(organizationId, days);
            return sendSuccess(res, data, 'Contact analytics retrieved');
        } catch (error: any) {
            console.error('Get contact analytics error:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    async getConversationAnalytics(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return errorResponse(res, 'Organization not found', 400);
            }

            const days = parseInt(req.query.days as string) || 30;
            const data = await analyticsService.getConversationAnalytics(organizationId, days);
            return sendSuccess(res, data, 'Conversation analytics retrieved');
        } catch (error: any) {
            console.error('Get conversation analytics error:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    async getTemplateAnalytics(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return errorResponse(res, 'Organization not found', 400);
            }

            const data = await analyticsService.getTemplateAnalytics(organizationId);
            return sendSuccess(res, data, 'Template analytics retrieved');
        } catch (error: any) {
            console.error('Get template analytics error:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    async exportAnalytics(req: Request, res: Response) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return errorResponse(res, 'Organization not found', 400);
            }

            const { type = 'overview', format = 'json' } = req.query;
            const data = await analyticsService.exportAnalytics(
                organizationId,
                type as string,
                format as string
            );

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=${type}-analytics.csv`);
                return res.send(data);
            }

            return sendSuccess(res, data, 'Analytics exported');
        } catch (error: any) {
            console.error('Export analytics error:', error);
            return errorResponse(res, error.message, 500);
        }
    }
}

export const analyticsController = new AnalyticsController();
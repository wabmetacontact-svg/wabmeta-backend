// src/modules/dashboard/dashboard.controller.ts

import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import { sendSuccess, errorResponse } from '../../utils/response';

class DashboardController {
  async getStats(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const stats = await dashboardService.getStats(organizationId);
      return sendSuccess(res, stats, 'Dashboard stats retrieved');
    } catch (error: any) {
      console.error('❌ Dashboard stats error:', {
        message: error.message,
        stack: error.stack?.split('\n')[1], // First stack line only
        organizationId: req.user?.organizationId,
      });
      return errorResponse(res, 'Failed to get stats', 500);
    }
  }

  async getWidgets(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const days = Math.min(parseInt(req.query.days as string) || 7, 90); // Max 90 days
      const widgets = await dashboardService.getWidgets(organizationId, days);
      return sendSuccess(res, widgets, 'Dashboard widgets retrieved');
    } catch (error: any) {
      console.error('❌ Dashboard widgets error:', {
        message: error.message,
        stack: error.stack?.split('\n')[1],
        organizationId: req.user?.organizationId,
      });
      return errorResponse(res, 'Failed to get widgets', 500);
    }
  }

  async getActivity(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return errorResponse(res, 'Organization not found', 400);
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const activity = await dashboardService.getActivity(organizationId, limit);
      return sendSuccess(res, activity, 'Activity retrieved');
    } catch (error: any) {
      console.error('Get dashboard activity error:', error);
      return errorResponse(res, error.message || 'Failed to get activity', 500);
    }
  }
}

export const dashboardController = new DashboardController();
export default dashboardController;
import { Request, Response, NextFunction } from 'express';
import { notificationsService } from './notifications.service';
import { successResponse } from '../../utils/response';

export const notificationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { filter, type, page, limit } = req.query;
      const result = await notificationsService.list(userId, {
        filter: filter as any,
        type: type as string,
        page: Number(page) || 1,
        limit: Number(limit) || 50,
      });
      return successResponse(res, result);
    } catch (err) { next(err); }
  },

  async unreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await notificationsService.getUnreadCount(req.user!.id);
      return successResponse(res, { count });
    } catch (err) { next(err); }
  },

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markAsRead(req.user!.id, req.params.id as string);
      return successResponse(res, { message: 'Marked as read' });
    } catch (err) { next(err); }
  },

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markAllAsRead(req.user!.id);
      return successResponse(res, { message: 'All marked as read' });
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.delete(req.user!.id, req.params.id as string);
      return successResponse(res, { message: 'Deleted' });
    } catch (err) { next(err); }
  },

  async clearAll(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.clearAll(req.user!.id);
      return successResponse(res, { message: 'Cleared all' });
    } catch (err) { next(err); }
  },

  async registerPushToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, deviceId, platform } = req.body;
      await notificationsService.registerPushToken(req.user!.id, token, deviceId, platform);
      return successResponse(res, { message: 'Token registered' });
    } catch (err) { next(err); }
  },

  async removePushToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      await notificationsService.removePushToken(token);
      return successResponse(res, { message: 'Token removed' });
    } catch (err) { next(err); }
  },
};

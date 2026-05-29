// src/modules/users/users.controller.ts

import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { sendSuccess } from '../../utils/response';
import { UpdateProfileInput, DeleteAccountInput } from './users.types';
import { webpushService } from '../notifications/webpush.service';

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
  cookies: {
    refreshToken?: string;
  };
}

export class UsersController {
  // ==========================================
  // GET PROFILE
  // ==========================================
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const profile = await usersService.getProfile(userId);
      return sendSuccess(res, profile, 'Profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET PROFILE WITH ORGANIZATIONS
  // ==========================================
  async getProfileWithOrganizations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const profile = await usersService.getUserWithOrganizations(userId);
      return sendSuccess(res, profile, 'Profile fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE PROFILE
  // ==========================================
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const input: UpdateProfileInput = req.body;
      const profile = await usersService.updateProfile(userId, input);
      return sendSuccess(res, profile, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE AVATAR
  // ==========================================
  async updateAvatar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { avatar } = req.body;
      const profile = await usersService.updateAvatar(userId, avatar);
      return sendSuccess(res, profile, 'Avatar updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET USER STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const stats = await usersService.getUserStats(userId);
      return sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET ACTIVE SESSIONS
  // ==========================================
  async getSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const currentToken = req.cookies?.refreshToken;
      const sessions = await usersService.getActiveSessions(userId, currentToken);
      return sendSuccess(res, sessions, 'Sessions fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // REVOKE SESSION
  // ==========================================
  async revokeSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const result = await usersService.revokeSession(userId, sessionId);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // REVOKE ALL SESSIONS
  // ==========================================
  async revokeAllSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const currentToken = req.cookies?.refreshToken;
      const result = await usersService.revokeAllSessions(userId, currentToken);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE ACCOUNT
  // ==========================================
  async deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { password, reason }: DeleteAccountInput = req.body;
      const result = await usersService.deleteAccount(userId, password, reason);

      // Clear cookies
      res.clearCookie('refreshToken');

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ADD PHONE NUMBER
  // ==========================================
  async addPhoneNumber(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required',
        });
      }

      const result = await usersService.addPhoneNumber(userId, phone);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PUSH NOTIFICATIONS SUBSCRIPTION
  // ==========================================
  async subscribePush(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const subscription = req.body;
      const result = await webpushService.saveSubscription(userId, subscription);
      return sendSuccess(res, result, 'Push subscription saved successfully');
    } catch (error) {
      next(error);
    }
  }

  async unsubscribePush(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        await webpushService.removeSubscription(endpoint);
      }
      return sendSuccess(res, null, 'Push subscription removed successfully');
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const usersController = new UsersController();
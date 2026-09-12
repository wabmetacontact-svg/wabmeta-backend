// src/modules/aiagent/aiagent.controller.ts

import { Request, Response, NextFunction } from 'express';
import { aiAgentService } from './aiagent.service';
import { sendSuccess } from '../../utils/response';

interface AuthRequest extends Request {
  user?: { id: string; email: string; organizationId?: string };
  params: any;
}

const orgOf = (req: AuthRequest) => req.user!.organizationId!;

export const aiAgentController = {
  async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await aiAgentService.getSettings(orgOf(req)), 'AI agent settings');
    } catch (e) { next(e); }
  },

  async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await aiAgentService.updateSettings(orgOf(req), req.body || {}), 'AI agent updated');
    } catch (e) { next(e); }
  },

  async listKnowledge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await aiAgentService.listKnowledge(orgOf(req)), 'Knowledge items');
    } catch (e) { next(e); }
  },

  async createKnowledge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await aiAgentService.createKnowledge(orgOf(req), req.body), 'Knowledge item added', 201);
    } catch (e) { next(e); }
  },

  async updateKnowledge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await aiAgentService.updateKnowledge(orgOf(req), req.params.id, req.body), 'Knowledge item updated');
    } catch (e) { next(e); }
  },

  async deleteKnowledge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await aiAgentService.deleteKnowledge(orgOf(req), req.params.id), 'Knowledge item deleted');
    } catch (e) { next(e); }
  },

  async test(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await aiAgentService.test(orgOf(req), req.body), 'AI agent test reply');
    } catch (e) { next(e); }
  },
};

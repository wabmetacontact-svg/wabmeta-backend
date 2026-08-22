import { Response } from 'express';
import * as instagramService from './instagram.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../types/express';

/**
 * The organization comes from the verified JWT, never from a request header.
 * Reading `x-organization-id` let any caller name whichever tenant they liked.
 */
const orgIdOf = (req: AuthRequest): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError('Organization context required', 400);
  }
  return organizationId;
};

export const getAccounts = async (req: AuthRequest, res: Response) => {
  const accounts = await instagramService.getOrganizationAccounts(orgIdOf(req));
  return sendSuccess(res, accounts);
};

export const connectAccount = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { accessToken } = req.body;

  try {
    const longToken = await instagramService.exchangeForLongLivedToken(accessToken);
    await instagramService.syncInstagramAccounts(orgId, longToken);

    return sendSuccess(res, null, 'Instagram account linked successfully');
  } catch (error: any) {
    return sendSuccess(
      res,
      null,
      'Error linking Instagram account: ' +
        (error.response?.data?.error?.message || error.message)
    );
  }
};

export const getDmAutomations = async (req: AuthRequest, res: Response) => {
  const automations = await instagramService.getDmAutomations(orgIdOf(req));
  return sendSuccess(res, automations);
};

export const createDmAutomation = async (req: AuthRequest, res: Response) => {
  const automation = await instagramService.createDmAutomation(orgIdOf(req), req.body);
  return sendSuccess(res, automation, 'Automation rule created');
};

export const toggleDmAutomation = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { id } = req.params;
  const { isActive } = req.body;

  // Scoped by organization: without this, knowing a rule id was enough to
  // toggle another tenant's automation.
  const updated = await instagramService.updateDmStatus(id as string, orgId, isActive);
  if (!updated) {
    throw new AppError('Automation rule not found', 404);
  }

  return sendSuccess(res, updated, `Rule ${isActive ? 'activated' : 'paused'}`);
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  const stats = await instagramService.getGlobalIgStats(orgIdOf(req));
  return sendSuccess(res, stats);
};

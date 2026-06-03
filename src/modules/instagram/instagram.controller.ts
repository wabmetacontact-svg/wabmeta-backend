import { Request, Response } from 'express';
import * as instagramService from './instagram.service';
import { sendSuccess } from '../../utils/response';

export const getAccounts = async (req: Request, res: Response) => {
  const orgId = req.headers['x-organization-id'] as string;
  const accounts = await instagramService.getOrganizationAccounts(orgId);
  return sendSuccess(res, accounts);
};

export const connectAccount = async (req: Request, res: Response) => {
  const orgId = req.headers['x-organization-id'] as string;
  const { accessToken, fbUserId } = req.body;
  
  try {
    const longToken = await instagramService.exchangeForLongLivedToken(accessToken);
    await instagramService.syncInstagramAccounts(orgId, longToken);
    
    return sendSuccess(res, null, 'Instagram account linked successfully');
  } catch (error: any) {
    return sendSuccess(res, null, 'Error linking Instagram account: ' + (error.response?.data?.error?.message || error.message));
  }
};

export const getDmAutomations = async (req: Request, res: Response) => {
  const orgId = req.headers['x-organization-id'] as string;
  const automations = await instagramService.getDmAutomations(orgId);
  return sendSuccess(res, automations);
};

export const createDmAutomation = async (req: Request, res: Response) => {
  const orgId = req.headers['x-organization-id'] as string;
  const automation = await instagramService.createDmAutomation(orgId, req.body);
  return sendSuccess(res, automation, 'Automation rule created');
};

export const toggleDmAutomation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const updated = await instagramService.updateDmStatus(id as string, isActive);
  return sendSuccess(res, updated, `Rule ${isActive ? 'activated' : 'paused'}`);
};

export const getAnalytics = async (req: Request, res: Response) => {
  const orgId = req.headers['x-organization-id'] as string;
  const stats = await instagramService.getGlobalIgStats(orgId);
  return sendSuccess(res, stats);
};

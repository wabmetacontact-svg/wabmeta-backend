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

export const disconnectAccount = async (req: AuthRequest, res: Response) => {
  const result = await instagramService.disconnectAccount(orgIdOf(req), req.params.id as string);
  if (!result) throw new AppError('Instagram account not found', 404);
  return sendSuccess(res, result, 'Instagram account disconnected');
};

export const connectAccount = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { accessToken } = req.body;

  try {
    const longToken = await instagramService.exchangeForLongLivedToken(accessToken);
    const linked = await instagramService.syncInstagramAccounts(orgId, longToken);

    if (!linked || linked.length === 0) {
      throw new AppError(
        'No Instagram Business account was found. Link your Instagram account to a Facebook Page you administer, then try again.',
        400
      );
    }

    // Webhook subscription is what makes DMs/comments actually arrive, so say
    // plainly when it did not take rather than reporting a bare success.
    const unsubscribed = linked.filter((a) => !a.subscribed);
    const message = unsubscribed.length
      ? `Connected ${linked.length} account(s), but webhook subscription failed for ${unsubscribed
          .map((a) => '@' + (a.username || a.igUserId))
          .join(', ')}. Incoming messages will not arrive until this is fixed.`
      : `Instagram connected. ${linked.length} account(s) linked and subscribed for messages.`;

    return sendSuccess(res, { accounts: linked }, message);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    // A failed link is a real failure - it used to return HTTP 200 with the
    // error text, so the UI showed a success toast on a broken connection.
    throw new AppError(
      'Could not link Instagram: ' + (error.response?.data?.error?.message || error.message),
      400
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

export const deleteDmAutomation = async (req: AuthRequest, res: Response) => {
  const result = await instagramService.deleteDmAutomation(req.params.id as string, orgIdOf(req));
  if (!result) throw new AppError('Automation rule not found', 404);
  return sendSuccess(res, result, 'Automation rule deleted');
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  const stats = await instagramService.getGlobalIgStats(orgIdOf(req));
  return sendSuccess(res, stats);
};

// ── Comment automation rules ────────────────────────────────────────────────

export const getCommentRules = async (req: AuthRequest, res: Response) => {
  const rows = await instagramService.getCommentRules(orgIdOf(req));
  return sendSuccess(res, rows);
};

export const createCommentRule = async (req: AuthRequest, res: Response) => {
  const { commentReply, dmMessage } = req.body;
  if ((!commentReply || !String(commentReply).trim()) && (!dmMessage || !String(dmMessage).trim())) {
    throw new AppError('A comment reply or a DM message is required', 400);
  }
  const rule = await instagramService.createCommentRule(orgIdOf(req), req.body);
  return sendSuccess(res, rule, 'Comment rule created', 201);
};

export const toggleCommentRule = async (req: AuthRequest, res: Response) => {
  const updated = await instagramService.toggleCommentRule(req.params.id as string, orgIdOf(req), !!req.body.isActive);
  if (!updated) throw new AppError('Comment rule not found', 404);
  return sendSuccess(res, updated, `Rule ${updated.isActive ? 'activated' : 'paused'}`);
};

export const deleteCommentRule = async (req: AuthRequest, res: Response) => {
  const result = await instagramService.deleteCommentRule(req.params.id as string, orgIdOf(req));
  if (!result) throw new AppError('Comment rule not found', 404);
  return sendSuccess(res, result, 'Comment rule deleted');
};

/** The connected account's posts + active stories (from the Instagram Graph API). */
export const getContent = async (req: AuthRequest, res: Response) => {
  const content = await instagramService.getContent(orgIdOf(req));
  return sendSuccess(res, content);
};

// ── Story automation rules ──────────────────────────────────────────────────

export const getStoryRules = async (req: AuthRequest, res: Response) => {
  const rows = await instagramService.getStoryRules(orgIdOf(req));
  return sendSuccess(res, rows);
};

export const createStoryRule = async (req: AuthRequest, res: Response) => {
  const { dmMessage } = req.body;
  if (!dmMessage || !String(dmMessage).trim()) {
    throw new AppError('A reply message is required', 400);
  }
  const rule = await instagramService.createStoryRule(orgIdOf(req), req.body);
  return sendSuccess(res, rule, 'Story rule created', 201);
};

export const toggleStoryRule = async (req: AuthRequest, res: Response) => {
  const updated = await instagramService.toggleStoryRule(req.params.id as string, orgIdOf(req), !!req.body.isActive);
  if (!updated) throw new AppError('Story rule not found', 404);
  return sendSuccess(res, updated, `Rule ${updated.isActive ? 'activated' : 'paused'}`);
};

export const deleteStoryRule = async (req: AuthRequest, res: Response) => {
  const result = await instagramService.deleteStoryRule(req.params.id as string, orgIdOf(req));
  if (!result) throw new AppError('Story rule not found', 404);
  return sendSuccess(res, result, 'Story rule deleted');
};

/** Unified-inbox Instagram analytics for the dashboard. */
export const getInboxStats = async (req: AuthRequest, res: Response) => {
  const { getInboxStats: fn } = await import('./instagram.inbox');
  const days = parseInt(req.query.days as string) || 7;
  const stats = await fn(orgIdOf(req), days);
  return sendSuccess(res, stats);
};

/** Agent reply to an Instagram conversation from the unified inbox. */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { conversationId, text } = req.body;
  if (!conversationId || !text) {
    throw new AppError('conversationId and text are required', 400);
  }
  const { sendInstagramMessage } = await import('./instagram.inbox');
  const message = await sendInstagramMessage(orgId, conversationId, text);
  // Human handoff: an agent reply pauses DM/story automation for this conversation.
  const { inboxService } = await import('../inbox/inbox.service');
  inboxService.setAutomationPaused(orgId, conversationId, true).catch(() => {});
  return sendSuccess(res, message, 'Message sent');
};

/** Agent sends a media attachment (mediaUrl must be publicly reachable). */
export const sendMediaMessage = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { conversationId, mediaUrl, mediaType } = req.body;
  if (!conversationId || !mediaUrl) {
    throw new AppError('conversationId and mediaUrl are required', 400);
  }
  const { sendInstagramMedia } = await import('./instagram.inbox');
  const message = await sendInstagramMedia(orgId, conversationId, mediaUrl, mediaType);
  const { inboxService } = await import('../inbox/inbox.service');
  inboxService.setAutomationPaused(orgId, conversationId, true).catch(() => {});
  return sendSuccess(res, message, 'Media sent');
};

/** Stream an inbound Instagram media file (authenticated via ?token= for <img>). */
export const getMedia = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { messageId } = req.params;
  const { streamMedia } = await import('./instagram.inbox');
  try {
    const { stream, contentType } = await streamMedia(orgId, messageId as string);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.on('error', () => { if (!res.headersSent) res.status(502).end(); });
    stream.pipe(res);
  } catch (err: any) {
    throw new AppError(err?.message || 'Media not found', 404);
  }
};

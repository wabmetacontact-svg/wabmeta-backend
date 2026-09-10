// src/modules/telegram/telegram.controller.ts

import { Request, Response } from 'express';
import * as telegramService from './telegram.service';
import { inboxService } from '../inbox/inbox.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../types/express';

/** Organization from the verified JWT, never from a header. */
const orgIdOf = (req: AuthRequest): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) throw new AppError('Organization context required', 400);
  return organizationId;
};

export const getBots = async (req: AuthRequest, res: Response) => {
  const bots = await telegramService.getBots(orgIdOf(req));
  return sendSuccess(res, bots);
};

export const connectBot = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    throw new AppError('Bot token is required', 400);
  }

  try {
    const bot = await telegramService.connectBot(orgId, token);
    const message = bot.webhookConfigured
      ? 'Telegram bot connected'
      : 'Bot connected, but the webhook is not configured (set TELEGRAM_WEBHOOK_BASE_URL and reconnect to receive messages)';
    return sendSuccess(res, bot, message, 201);
  } catch (err: any) {
    throw new AppError(err?.message || 'Failed to connect Telegram bot', 400);
  }
};

export const disconnectBot = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { id } = req.params;
  const result = await telegramService.disconnectBot(orgId, id as string);
  if (!result) throw new AppError('Telegram bot not found', 404);
  return sendSuccess(res, result, 'Telegram bot disconnected');
};

export const getWebhookHealth = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { id } = req.params;
  try {
    const health = await telegramService.getWebhookHealth(orgId, id as string);
    return sendSuccess(res, health);
  } catch (err: any) {
    throw new AppError(err?.message || 'Failed to read webhook health', 400);
  }
};

export const getCommands = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { id } = req.params;
  try {
    const commands = await telegramService.getBotCommands(orgId, id as string);
    return sendSuccess(res, commands);
  } catch (err: any) {
    throw new AppError(err?.message || 'Failed to read commands', 400);
  }
};

export const setCommands = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { id } = req.params;
  const { commands } = req.body;
  if (!Array.isArray(commands)) {
    throw new AppError('commands must be an array', 400);
  }
  try {
    const saved = await telegramService.setBotCommands(orgId, id as string, commands);
    return sendSuccess(res, saved, 'Command menu updated');
  } catch (err: any) {
    throw new AppError(err?.message || 'Failed to update commands', 400);
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { conversationId, text } = req.body;
  if (!conversationId || !text) {
    throw new AppError('conversationId and text are required', 400);
  }
  const message = await telegramService.sendTelegramMessage(orgId, conversationId, text);
  // Human handoff: an agent reply pauses bot automation for this conversation.
  inboxService.setAutomationPaused(orgId, conversationId, true).catch(() => {});
  return sendSuccess(res, message, 'Message sent');
};

export const sendMediaMessage = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { conversationId, caption } = req.body;
  const file = (req as any).file;
  if (!conversationId) throw new AppError('conversationId is required', 400);
  if (!file) throw new AppError('A file is required', 400);

  const message = await telegramService.sendTelegramMedia(
    orgId,
    conversationId,
    { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname },
    caption
  );
  inboxService.setAutomationPaused(orgId, conversationId, true).catch(() => {});
  return sendSuccess(res, message, 'Media sent');
};

/**
 * Stream an inbound Telegram media file through the backend (authenticated via
 * the ?token= query so it can be used directly as an <img>/<video> src).
 */
export const getMedia = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { messageId } = req.params;
  try {
    const { stream, contentType, fileName } = await telegramService.streamMedia(orgId, messageId as string);
    res.setHeader('Content-Type', contentType);
    if (fileName) res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.on('error', () => { if (!res.headersSent) res.status(502).end(); });
    stream.pipe(res);
  } catch (err: any) {
    throw new AppError(err?.message || 'Media not found', 404);
  }
};

// ── Auto-reply automations ─────────────────────────────────────────────────

export const getAutomations = async (req: AuthRequest, res: Response) => {
  const rows = await telegramService.getAutomations(orgIdOf(req));
  return sendSuccess(res, rows);
};

export const createAutomation = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { triggerType, responseText, pattern } = req.body;
  if (!triggerType || !responseText) {
    throw new AppError('triggerType and responseText are required', 400);
  }
  if ((triggerType === 'COMMAND' || triggerType === 'KEYWORD') && !pattern) {
    throw new AppError('A command/keyword pattern is required', 400);
  }
  const row = await telegramService.createAutomation(orgId, req.body);
  return sendSuccess(res, row, 'Automation created', 201);
};

export const updateAutomation = async (req: AuthRequest, res: Response) => {
  const row = await telegramService.updateAutomation(orgIdOf(req), req.params.id as string, req.body);
  if (!row) throw new AppError('Automation not found', 404);
  return sendSuccess(res, row, 'Automation updated');
};

export const toggleAutomation = async (req: AuthRequest, res: Response) => {
  const row = await telegramService.toggleAutomation(orgIdOf(req), req.params.id as string, !!req.body.isActive);
  if (!row) throw new AppError('Automation not found', 404);
  return sendSuccess(res, row, `Automation ${row.isActive ? 'activated' : 'paused'}`);
};

export const deleteAutomation = async (req: AuthRequest, res: Response) => {
  const result = await telegramService.deleteAutomation(orgIdOf(req), req.params.id as string);
  if (!result) throw new AppError('Automation not found', 404);
  return sendSuccess(res, result, 'Automation deleted');
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  const days = parseInt(req.query.days as string) || 7;
  const stats = await telegramService.getStats(orgIdOf(req), days);
  return sendSuccess(res, stats);
};

// ── Broadcasts ──────────────────────────────────────────────────────────────

export const getBroadcasts = async (req: AuthRequest, res: Response) => {
  const rows = await telegramService.getBroadcasts(orgIdOf(req));
  return sendSuccess(res, rows);
};

export const getBroadcastAudience = async (req: AuthRequest, res: Response) => {
  const tag = (req.query.tag as string) || undefined;
  const count = await telegramService.getBroadcastAudienceCount(orgIdOf(req), tag);
  return sendSuccess(res, { count });
};

export const createBroadcast = async (req: AuthRequest, res: Response) => {
  const orgId = orgIdOf(req);
  const { message, buttons, tag, mediaUrl, mediaType } = req.body;
  if ((!message || !String(message).trim()) && !mediaUrl) {
    throw new AppError('A message or media is required', 400);
  }
  const broadcast = await telegramService.createBroadcast(orgId, { message: message || '', buttons, tag, mediaUrl, mediaType });
  return sendSuccess(res, broadcast, 'Broadcast started', 201);
};

/**
 * Public webhook Telegram calls with each update. Verified by the
 * X-Telegram-Bot-Api-Secret-Token header. Always answers 200 quickly so
 * Telegram does not retry; processing failures are swallowed and logged.
 */
export const webhook = async (req: Request, res: Response) => {
  const { botUserId } = req.params;
  const providedSecret = req.header('X-Telegram-Bot-Api-Secret-Token') || undefined;

  // Acknowledge immediately; process without blocking the response.
  res.status(200).json({ ok: true });

  try {
    await telegramService.processUpdate(botUserId as string, req.body, providedSecret);
  } catch (err: any) {
    console.error('[telegram webhook] processing error:', err?.message || err);
  }
};

// src/modules/telegram/telegram.service.ts
//
// Telegram bot connection + the inbound/outbound message bridge that plugs
// Telegram into WabMeta's unified inbox. Conversations and messages live in the
// same Conversation/Message tables as WhatsApp, distinguished by channel=TELEGRAM.

import crypto from 'crypto';
import prisma from '../../config/database';
import { encrypt, decrypt } from '../../utils/encryption';
import { webhookEvents } from '../webhooks/webhook.service';
import { withAdvisoryLock } from '../../utils/withLock';
import { maybeCreateSocialLead } from '../crm/crm.social';
import * as tg from './telegram.api';

// Public base URL Telegram will call our webhook on. Must be https and reachable.
const webhookBaseUrl = (): string =>
  process.env.TELEGRAM_WEBHOOK_BASE_URL ||
  process.env.API_PUBLIC_URL ||
  process.env.BACKEND_URL ||
  '';

const webhookUrlFor = (botUserId: string): string => {
  const base = webhookBaseUrl().replace(/\/$/, '');
  return base ? `${base}/api/telegram/webhook/${botUserId}` : '';
};

/** Bots for an organization, with the encrypted token stripped out. */
export const getBots = async (organizationId: string) => {
  const bots = await prisma.telegramBot.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
  return bots.map(({ botToken, webhookSecret, ...safe }) => safe);
};

/**
 * Connect (or re-connect) a bot from its token. Validates via getMe, encrypts the
 * token at rest, and registers the webhook when a public base URL is configured.
 */
export const connectBot = async (organizationId: string, rawToken: string) => {
  const token = (rawToken || '').trim();
  if (!token) throw new Error('Bot token is required');

  // 1. Validate the token and learn the bot's identity.
  const info = await tg.getMe(token);
  const botUserId = String(info.id);

  // 2. Persist (encrypted token + a fresh webhook secret).
  const webhookSecret = crypto.randomBytes(24).toString('hex');
  const bot = await prisma.telegramBot.upsert({
    where: { organizationId_botUserId: { organizationId, botUserId } },
    update: {
      botToken: encrypt(token),
      username: info.username,
      firstName: info.first_name,
      webhookSecret,
      status: 'CONNECTED',
      lastError: null,
      lastErrorAt: null,
      connectedAt: new Date(),
    },
    create: {
      organizationId,
      botUserId,
      botToken: encrypt(token),
      username: info.username,
      firstName: info.first_name,
      webhookSecret,
      status: 'CONNECTED',
    },
  });

  // 3. Register the webhook if we have a public URL; otherwise report it.
  const webhookUrl = webhookUrlFor(botUserId);
  let webhookConfigured = false;
  if (webhookUrl) {
    await tg.setWebhook(token, webhookUrl, webhookSecret);
    webhookConfigured = true;
  }

  const { botToken, webhookSecret: _s, ...safe } = bot;
  return { ...safe, webhookConfigured };
};

/** Disconnect a bot: remove the Telegram webhook and delete our record. */
export const disconnectBot = async (organizationId: string, botId: string) => {
  const bot = await prisma.telegramBot.findFirst({ where: { id: botId, organizationId } });
  if (!bot) return null;

  const token = decrypt(bot.botToken);
  if (token) await tg.deleteWebhook(token);

  await prisma.telegramBot.delete({ where: { id: bot.id } });
  return { id: bot.id };
};

/**
 * Live webhook health for one bot, straight from Telegram's getWebhookInfo.
 * Reports the URL Telegram actually has, the queued-update backlog and the last
 * delivery error, so a broken webhook is visible instead of guessed at.
 */
export const getWebhookHealth = async (organizationId: string, botId: string) => {
  const bot = await prisma.telegramBot.findFirst({ where: { id: botId, organizationId } });
  if (!bot) throw new Error('Bot not found');
  const token = decrypt(bot.botToken);
  if (!token) throw new Error('Bot token unavailable');

  const info = await tg.getWebhookInfo(token);
  const lastErrorAt = info.last_error_date ? new Date(info.last_error_date * 1000) : null;

  return {
    botId: bot.id,
    username: bot.username,
    url: info.url || null,
    isRegistered: !!info.url,
    pendingUpdateCount: info.pending_update_count ?? 0,
    ipAddress: info.ip_address || null,
    maxConnections: info.max_connections ?? null,
    allowedUpdates: info.allowed_updates || [],
    lastErrorAt,
    lastErrorMessage: info.last_error_message || null,
    // Healthy = Telegram has a URL and hasn't failed to deliver in the last hour.
    healthy: !!info.url && (!lastErrorAt || Date.now() - lastErrorAt.getTime() > 60 * 60 * 1000),
  };
};

// ── Bot command menu (the "/" list users see in Telegram) ──────────────────

const CMD_RE = /^[a-z0-9_]{1,32}$/;

/** Read a bot's currently-published command menu (org-scoped). */
export const getBotCommands = async (organizationId: string, botId: string) => {
  const bot = await prisma.telegramBot.findFirst({ where: { id: botId, organizationId } });
  if (!bot) throw new Error('Bot not found');
  const token = decrypt(bot.botToken);
  if (!token) throw new Error('Bot token unavailable');
  return tg.getMyCommands(token);
};

/**
 * Publish a bot's command menu. Validates Telegram's rules up-front so we return
 * a clean 400 instead of leaking Telegram's raw error. An empty list clears it.
 */
export const setBotCommands = async (
  organizationId: string,
  botId: string,
  commands: { command: string; description: string }[]
) => {
  const bot = await prisma.telegramBot.findFirst({ where: { id: botId, organizationId } });
  if (!bot) throw new Error('Bot not found');

  const cleaned = (Array.isArray(commands) ? commands : [])
    .map((c) => ({
      command: String(c?.command || '').trim().toLowerCase().replace(/^\//, ''),
      description: String(c?.description || '').trim(),
    }))
    .filter((c) => c.command || c.description);

  if (cleaned.length > 100) throw new Error('Telegram allows at most 100 commands');
  for (const c of cleaned) {
    if (!CMD_RE.test(c.command)) {
      throw new Error(`Invalid command "/${c.command}": use 1–32 lowercase letters, digits or underscores`);
    }
    if (c.description.length < 1 || c.description.length > 256) {
      throw new Error(`Command "/${c.command}" needs a description of 1–256 characters`);
    }
  }

  const token = decrypt(bot.botToken);
  if (!token) throw new Error('Bot token unavailable');
  await tg.setMyCommands(token, cleaned);
  return cleaned;
};

// ── Inbound: Telegram update → unified inbox ───────────────────────────────

const contactNameParts = (from: any) => ({
  firstName: from?.first_name || from?.username || 'Telegram User',
  lastName: from?.last_name || null,
});

/** Find or create the Contact for a Telegram user (no phone → synthetic key). */
const findOrCreateContact = async (organizationId: string, from: any) => {
  const telegramUserId = String(from.id);
  const syntheticPhone = `tg:${telegramUserId}`;
  const { firstName, lastName } = contactNameParts(from);

  return prisma.contact.upsert({
    where: { organizationId_phone: { organizationId, phone: syntheticPhone } },
    update: {
      telegramUserId,
      telegramUsername: from?.username || null,
      // Keep names fresh but never wipe an edited name with a blank.
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      lastMessageAt: new Date(),
    },
    create: {
      organizationId,
      phone: syntheticPhone,
      telegramUserId,
      telegramUsername: from?.username || null,
      firstName,
      lastName,
      source: 'telegram',
      lastMessageAt: new Date(),
    },
  });
};

/** Find or create the TELEGRAM conversation for a contact+chat. */
const findOrCreateConversation = async (
  organizationId: string,
  contactId: string,
  chatId: string,
  telegramBotId: string
) => {
  return prisma.conversation.upsert({
    where: {
      organizationId_contactId_channel: { organizationId, contactId, channel: 'TELEGRAM' },
    },
    update: { telegramChatId: chatId, telegramBotId },
    create: {
      organizationId,
      contactId,
      channel: 'TELEGRAM',
      telegramChatId: chatId,
      telegramBotId,
      isWindowOpen: true, // Telegram has no 24h window
    },
  });
};

/**
 * Handle an inline-button tap: acknowledge it, log the tap as an inbound message
 * so the inbox shows the interaction, then fire the rule its callback_data points
 * at (so a "Pricing" button reaches the pricing rule).
 */
const handleCallbackQuery = async (bot: any, cq: any): Promise<void> => {
  const token = decrypt(bot.botToken);
  if (token) await tg.answerCallbackQuery(token, cq.id);

  const from = cq.from;
  const chat = cq.message?.chat;
  const data = String(cq.data || '').trim();
  if (!from || !chat || !data) return;

  const organizationId = bot.organizationId;
  const contact = await findOrCreateContact(organizationId, from);
  const conversation = await findOrCreateConversation(organizationId, contact.id, String(chat.id), bot.id);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'TELEGRAM',
      telegramMessageId: `cb-${cq.id}`,
      direction: 'INBOUND',
      type: 'TEXT',
      content: data,
      status: 'DELIVERED',
      timestamp: new Date(),
    },
  });

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastCustomerMessageAt: new Date(),
      lastMessagePreview: data.slice(0, 120),
      isRead: false,
      unreadCount: { increment: 1 },
    },
    include: { contact: true },
  });

  webhookEvents.emit('newMessage', { organizationId, conversationId: conversation.id, message, conversation: updatedConversation });
  webhookEvents.emit('conversationUpdated', { organizationId, conversation: updatedConversation });

  try {
    // Human handoff: skip automation once an agent has taken over this conversation.
    if (!updatedConversation.automationPaused) {
      // Button taps first feed the visual flow (their callback_data resumes it).
      const { runTelegramFlow } = await import('./telegram.flow');
      const handledByFlow = await runTelegramFlow(organizationId, updatedConversation, bot, data);
      if (!handledByFlow) {
        const rule = await matchAutoReply(organizationId, bot.id, data);
        if (rule) {
          await sendTelegramMessage(organizationId, conversation.id, rule.responseText, (rule as any).buttons);
          await prisma.telegramAutomation.update({ where: { id: rule.id }, data: { triggerCount: { increment: 1 } } });
        }
      }
    }
  } catch (err: any) {
    console.error('[telegram callback] error:', err?.message || err);
  }
};

/**
 * Process one webhook update. Idempotent-ish: a repeated telegramMessageId in the
 * same conversation is skipped. Handles text, media, and inline-button taps.
 */
export const processUpdate = async (
  botUserId: string,
  update: any,
  providedSecret?: string
): Promise<void> => {
  const bot = await prisma.telegramBot.findFirst({ where: { botUserId } });
  if (!bot) return;

  // Verify the request really came from Telegram (secret_token echo).
  if (providedSecret !== undefined && bot.webhookSecret !== providedSecret) return;

  // Inline button tap → acknowledge + treat callback_data like an incoming message.
  if (update?.callback_query) {
    await handleCallbackQuery(bot, update.callback_query);
    return;
  }

  const msg = update?.message || update?.edited_message;
  if (!msg || !msg.from || !msg.chat) return;

  // Text or a supported media attachment.
  const caption: string = msg.text || msg.caption || '';
  let mType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' = 'TEXT';
  let mediaFileId: string | undefined;
  let mediaMimeType: string | undefined;
  let fileName: string | undefined;

  if (Array.isArray(msg.photo) && msg.photo.length) {
    mType = 'IMAGE';
    mediaFileId = msg.photo[msg.photo.length - 1].file_id; // largest size
    mediaMimeType = 'image/jpeg';
  } else if (msg.sticker?.file_id) {
    mType = 'IMAGE';
    mediaFileId = msg.sticker.file_id;
    mediaMimeType = 'image/webp';
  } else if (msg.video?.file_id) {
    mType = 'VIDEO';
    mediaFileId = msg.video.file_id;
    mediaMimeType = msg.video.mime_type || 'video/mp4';
    fileName = msg.video.file_name;
  } else if (msg.voice?.file_id) {
    mType = 'AUDIO';
    mediaFileId = msg.voice.file_id;
    mediaMimeType = msg.voice.mime_type || 'audio/ogg';
  } else if (msg.audio?.file_id) {
    mType = 'AUDIO';
    mediaFileId = msg.audio.file_id;
    mediaMimeType = msg.audio.mime_type || 'audio/mpeg';
    fileName = msg.audio.file_name;
  } else if (msg.document?.file_id) {
    mType = 'DOCUMENT';
    mediaFileId = msg.document.file_id;
    mediaMimeType = msg.document.mime_type || 'application/octet-stream';
    fileName = msg.document.file_name;
  }

  if (!msg.text && !mediaFileId) return; // unsupported update type

  const mediaLabel =
    mType === 'IMAGE' ? '📷 Photo' :
    mType === 'VIDEO' ? '🎥 Video' :
    mType === 'AUDIO' ? '🎙 Voice message' :
    mType === 'DOCUMENT' ? `📎 ${fileName || 'Document'}` : '';
  const preview = caption || mediaLabel || 'Message';

  const organizationId = bot.organizationId;
  const contact = await findOrCreateContact(organizationId, msg.from);
  const conversation = await findOrCreateConversation(
    organizationId,
    contact.id,
    String(msg.chat.id),
    bot.id
  );

  const telegramMessageId = String(msg.message_id);

  // Skip duplicates (Telegram can redeliver).
  const existing = await prisma.message.findFirst({
    where: { conversationId: conversation.id, telegramMessageId, direction: 'INBOUND' },
    select: { id: true },
  });
  if (existing) return;

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'TELEGRAM',
      telegramMessageId,
      direction: 'INBOUND',
      type: mType,
      content: caption || null,
      mediaType: mediaFileId ? mediaMimeType : null,
      mediaMimeType: mediaFileId ? mediaMimeType : null,
      fileName: fileName || null,
      metadata: mediaFileId ? { telegramFileId: mediaFileId } : undefined,
      status: 'DELIVERED',
      timestamp: new Date(msg.date ? msg.date * 1000 : Date.now()),
    },
  });

  // Media is served through a token-authenticated backend proxy so the bot token
  // never reaches the client.
  if (mediaFileId) {
    await prisma.message.update({
      where: { id: message.id },
      data: { mediaUrl: `/telegram/media/${message.id}` },
    });
    (message as any).mediaUrl = `/telegram/media/${message.id}`;
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastCustomerMessageAt: new Date(),
      lastMessagePreview: preview.slice(0, 120),
      isRead: false,
      unreadCount: { increment: 1 },
    },
    include: { contact: true },
  });

  await prisma.contact.update({
    where: { id: contact.id },
    data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
  });

  // Live inbox update over the same socket bridge WhatsApp uses.
  webhookEvents.emit('newMessage', {
    organizationId,
    conversationId: conversation.id,
    message,
    conversation: updatedConversation,
  });
  webhookEvents.emit('conversationUpdated', {
    organizationId,
    conversation: updatedConversation,
  });

  // Pehle asli message par CRM lead. Media-only message ka caption khali hota
  // hai, to wo apne aap skip ho jata hai. Ye kabhi throw nahi karta.
  await maybeCreateSocialLead({
    organizationId,
    contactId: contact.id,
    conversationId: conversation.id,
    channel: 'TELEGRAM',
    text: caption,
  });

  // Automation (best-effort). Human handoff: skip once an agent has taken over.
  try {
    if (!updatedConversation.automationPaused) {
      // A visual flow (if one targets Telegram / is in progress) takes priority;
      // only if it doesn't handle the message do keyword auto-replies run.
      const { runTelegramFlow } = await import('./telegram.flow');
      const handledByFlow = await runTelegramFlow(organizationId, updatedConversation, bot, caption);
      if (!handledByFlow) {
        const rule = await matchAutoReply(organizationId, bot.id, caption);
        if (rule) {
          await sendTelegramMessage(organizationId, conversation.id, rule.responseText, (rule as any).buttons);
          await prisma.telegramAutomation.update({
            where: { id: rule.id },
            data: { triggerCount: { increment: 1 } },
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[telegram auto-reply] error:', err?.message || err);
  }
};

// ── Auto-reply matching (commands + keywords + fallback) ───────────────────

/** Normalize a "/command@BotName arg" head to just "/command". */
const extractCommand = (text: string): string | null => {
  const t = text.trim();
  if (!t.startsWith('/')) return null;
  return t.split(/\s+/)[0].split('@')[0].toLowerCase();
};

/**
 * Pick the auto-reply for an incoming message: commands first, then keywords,
 * then a FALLBACK if nothing else matched. Rules with botId null apply to every
 * bot; a rule scoped to this bot wins ties by coming first in the ordering.
 */
const matchAutoReply = async (organizationId: string, botId: string, text: string) => {
  const rules = await prisma.telegramAutomation.findMany({
    where: { organizationId, isActive: true, OR: [{ botId: null }, { botId }] },
    orderBy: [{ botId: 'desc' }, { createdAt: 'asc' }], // bot-specific before org-wide
  });

  const command = extractCommand(text);
  const lower = text.toLowerCase().trim();

  if (command) {
    const cmd = rules.find(
      (r) => r.triggerType === 'COMMAND' && (r.pattern || '').toLowerCase().replace(/^\/?/, '/') === command
    );
    if (cmd) return cmd;
  }

  const kw = rules.find((r) => {
    if (r.triggerType !== 'KEYWORD' || !r.pattern) return false;
    const p = r.pattern.toLowerCase().trim();
    if (r.matchType === 'exact') return lower === p;
    if (r.matchType === 'starts_with') return lower.startsWith(p);
    return lower.includes(p); // contains (default)
  });
  if (kw) return kw;

  return rules.find((r) => r.triggerType === 'FALLBACK') || null;
};

// ── Automation CRUD ────────────────────────────────────────────────────────

export const getAutomations = (organizationId: string) =>
  prisma.telegramAutomation.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });

export const createAutomation = (organizationId: string, data: any) =>
  prisma.telegramAutomation.create({
    data: {
      organizationId,
      botId: data.botId || null,
      name: String(data.name || 'Untitled rule'),
      triggerType: data.triggerType, // COMMAND | KEYWORD | FALLBACK
      pattern: data.pattern ? String(data.pattern) : null,
      matchType: data.matchType || 'contains',
      responseText: String(data.responseText || ''),
      buttons: Array.isArray(data.buttons) && data.buttons.length ? data.buttons : undefined,
      isActive: data.isActive !== undefined ? !!data.isActive : true,
    },
  });

export const updateAutomation = async (organizationId: string, id: string, data: any) => {
  const result = await prisma.telegramAutomation.updateMany({
    where: { id, organizationId },
    data: {
      name: data.name,
      triggerType: data.triggerType,
      pattern: data.pattern !== undefined ? (data.pattern || null) : undefined,
      matchType: data.matchType,
      responseText: data.responseText,
      buttons: Array.isArray(data.buttons) ? data.buttons : undefined,
      isActive: data.isActive,
    },
  });
  if (result.count === 0) return null;
  return prisma.telegramAutomation.findFirst({ where: { id, organizationId } });
};

export const toggleAutomation = async (organizationId: string, id: string, isActive: boolean) => {
  const result = await prisma.telegramAutomation.updateMany({ where: { id, organizationId }, data: { isActive } });
  if (result.count === 0) return null;
  return prisma.telegramAutomation.findFirst({ where: { id, organizationId } });
};

export const deleteAutomation = async (organizationId: string, id: string) => {
  const result = await prisma.telegramAutomation.deleteMany({ where: { id, organizationId } });
  return result.count > 0 ? { id } : null;
};

// ── Analytics ──────────────────────────────────────────────────────────────

/** Headline Telegram metrics for an organization, plus a 7-day message series. */
export const getStats = async (organizationId: string, rangeDays = 7) => {
  // Only the ranges the dashboard offers.
  const span = [7, 14, 30].includes(Number(rangeDays)) ? Number(rangeDays) : 7;
  const tgConversation = { organizationId };

  const [bots, conversations, contacts, inbound, outbound, rules, triggered, topRules, dailyRows] =
    await Promise.all([
      prisma.telegramBot.count({ where: { organizationId } }),
      prisma.conversation.count({ where: { organizationId, channel: 'TELEGRAM' } }),
      prisma.contact.count({ where: { organizationId, telegramUserId: { not: null } } }),
      prisma.message.count({ where: { channel: 'TELEGRAM', direction: 'INBOUND', conversation: tgConversation } }),
      prisma.message.count({ where: { channel: 'TELEGRAM', direction: 'OUTBOUND', conversation: tgConversation } }),
      prisma.telegramAutomation.count({ where: { organizationId } }),
      prisma.telegramAutomation.aggregate({ where: { organizationId }, _sum: { triggerCount: true } }),
      prisma.telegramAutomation.findMany({
        where: { organizationId, triggerCount: { gt: 0 } },
        orderBy: { triggerCount: 'desc' },
        take: 5,
        select: { id: true, name: true, triggerType: true, pattern: true, triggerCount: true },
      }),
      prisma.$queryRaw<Array<{ day: Date; direction: string; count: bigint }>>`
        SELECT date_trunc('day', m."timestamp") AS day, m.direction AS direction, COUNT(*)::int AS count
        FROM "Message" m
        JOIN "Conversation" c ON c.id = m."conversationId"
        WHERE c."organizationId" = ${organizationId}
          AND m.channel = 'TELEGRAM'
          AND m."timestamp" >= NOW() - MAKE_INTERVAL(days => ${span}::int)
        GROUP BY 1, 2
      `,
    ]);

  // Bucket the raw rows into the last 7 calendar days (oldest → newest).
  const days: { date: string; label: string; inbound: number; outbound: number }[] = [];
  const index: Record<string, number> = {};
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    index[key] = days.length;
    const label = span <= 7
      ? d.toLocaleDateString('en-IN', { weekday: 'short' })
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    days.push({ date: key, label, inbound: 0, outbound: 0 });
  }
  for (const row of dailyRows) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    const slot = index[key];
    if (slot === undefined) continue;
    const n = Number(row.count);
    if (row.direction === 'INBOUND') days[slot].inbound += n;
    else days[slot].outbound += n;
  }

  return {
    bots,
    rangeDays: span,
    conversations,
    contacts,
    messages: { inbound, outbound, total: inbound + outbound },
    autoReplies: { rules, triggered: triggered._sum.triggerCount || 0 },
    topRules,
    daily: days,
  };
};

// ── Outbound: agent reply from the inbox → Telegram ────────────────────────

/**
 * Send an agent's reply to a Telegram conversation and record it. Scoped by org
 * so an id from another tenant matches nothing.
 */
/**
 * Turn our stored button list into Telegram's inline_keyboard reply_markup.
 * Each button becomes its own row. callback buttons carry callback_data; url
 * buttons open a link. Returns undefined when there are no valid buttons.
 */
const buildReplyMarkup = (buttons: any): any => {
  if (!Array.isArray(buttons) || buttons.length === 0) return undefined;
  const rows = buttons
    .map((b: any) => {
      const text = String(b?.text || '').trim();
      const value = String(b?.value || '').trim();
      if (!text || !value) return null;
      return b?.type === 'url'
        ? { text, url: value }
        : { text, callback_data: value.slice(0, 64) };
    })
    .filter(Boolean)
    .map((btn: any) => [btn]);
  return rows.length ? { inline_keyboard: rows } : undefined;
};

export const sendTelegramMessage = async (
  organizationId: string,
  conversationId: string,
  text: string,
  buttons?: any
) => {
  const body = (text || '').trim();
  if (!body) throw new Error('Message text is required');

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId, channel: 'TELEGRAM' },
  });
  if (!conversation || !conversation.telegramChatId || !conversation.telegramBotId) {
    throw new Error('Telegram conversation not found');
  }

  const bot = await prisma.telegramBot.findFirst({
    where: { id: conversation.telegramBotId, organizationId },
  });
  if (!bot) throw new Error('Telegram bot not found for this conversation');

  const token = decrypt(bot.botToken);
  if (!token) throw new Error('Telegram bot token could not be read');

  const replyMarkup = buildReplyMarkup(buttons);
  const sent = await tg.sendMessage(
    token,
    conversation.telegramChatId,
    body,
    replyMarkup ? { reply_markup: replyMarkup } : undefined
  );

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'TELEGRAM',
      telegramMessageId: String(sent.message_id),
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: body,
      // Record the inline keyboard so the inbox bubble can show it too.
      metadata: replyMarkup && Array.isArray(buttons) && buttons.length ? { buttons } : undefined,
      status: 'SENT',
      sentAt: new Date(),
      timestamp: new Date(),
    },
  });

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 120) },
    include: { contact: true },
  });

  webhookEvents.emit('newMessage', {
    organizationId,
    conversationId: conversation.id,
    message,
    conversation: updatedConversation,
  });
  webhookEvents.emit('conversationUpdated', {
    organizationId,
    conversation: updatedConversation,
  });

  return message;
};

// ── Media proxy: resolve a stored Telegram media message to a live stream ──

/**
 * Look up an inbound Telegram media message (org-scoped) and open a download
 * stream for it. The bot token is used server-side only and never returned.
 */
export const streamMedia = async (organizationId: string, messageId: string) => {
  const message = await prisma.message.findFirst({
    where: { id: messageId, channel: 'TELEGRAM', conversation: { organizationId } },
    include: { conversation: true },
  });
  if (!message) throw new Error('Media not found');

  const fileId = (message.metadata as any)?.telegramFileId;
  const botId = message.conversation?.telegramBotId;
  if (!fileId || !botId) throw new Error('Media not available');

  const bot = await prisma.telegramBot.findFirst({ where: { id: botId, organizationId } });
  if (!bot) throw new Error('Telegram bot not found');

  const token = decrypt(bot.botToken);
  if (!token) throw new Error('Telegram bot token could not be read');

  const filePath = await tg.getFilePath(token, fileId);
  const download = await tg.downloadFileStream(token, filePath);

  return {
    stream: download.data as NodeJS.ReadableStream,
    contentType: message.mediaMimeType || download.headers['content-type'] || 'application/octet-stream',
    fileName: message.fileName || undefined,
  };
};

// ── Outbound media: agent sends a file from the inbox → Telegram ───────────

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/** Pick the Bot API method/field and our MessageType from a mime type. */
const mediaPlan = (mime: string) => {
  if (mime.startsWith('image/')) return { method: 'sendPhoto', field: 'photo', type: 'IMAGE' as const, idKey: 'photo' };
  if (mime.startsWith('video/')) return { method: 'sendVideo', field: 'video', type: 'VIDEO' as const, idKey: 'video' };
  if (mime.startsWith('audio/')) return { method: 'sendAudio', field: 'audio', type: 'AUDIO' as const, idKey: 'audio' };
  return { method: 'sendDocument', field: 'document', type: 'DOCUMENT' as const, idKey: 'document' };
};

const fileIdFromResult = (result: any, idKey: string): string | undefined => {
  const node = result?.[idKey];
  if (Array.isArray(node)) return node[node.length - 1]?.file_id; // photo sizes
  return node?.file_id;
};

export const sendTelegramMedia = async (
  organizationId: string,
  conversationId: string,
  file: UploadedFile,
  caption?: string
) => {
  if (!file?.buffer?.length) throw new Error('No file provided');

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId, channel: 'TELEGRAM' },
  });
  if (!conversation || !conversation.telegramChatId || !conversation.telegramBotId) {
    throw new Error('Telegram conversation not found');
  }

  const bot = await prisma.telegramBot.findFirst({ where: { id: conversation.telegramBotId, organizationId } });
  if (!bot) throw new Error('Telegram bot not found for this conversation');

  const token = decrypt(bot.botToken);
  if (!token) throw new Error('Telegram bot token could not be read');

  const plan = mediaPlan(file.mimetype || 'application/octet-stream');
  const result = await tg.sendMedia(
    token,
    conversation.telegramChatId,
    plan.method,
    plan.field,
    file.buffer,
    file.originalname,
    caption
  );

  const telegramFileId = fileIdFromResult(result, plan.idKey);
  const cap = (caption || '').trim();

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'TELEGRAM',
      telegramMessageId: String(result.message_id),
      direction: 'OUTBOUND',
      type: plan.type,
      content: cap || file.originalname || null,
      mediaType: file.mimetype || null,
      mediaMimeType: file.mimetype || null,
      fileName: file.originalname || null,
      metadata: telegramFileId ? { telegramFileId } : undefined,
      status: 'SENT',
      sentAt: new Date(),
      timestamp: new Date(),
    },
  });

  if (telegramFileId) {
    await prisma.message.update({
      where: { id: message.id },
      data: { mediaUrl: `/telegram/media/${message.id}` },
    });
    (message as any).mediaUrl = `/telegram/media/${message.id}`;
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: (cap || file.originalname || 'Attachment').slice(0, 120) },
    include: { contact: true },
  });

  webhookEvents.emit('newMessage', {
    organizationId,
    conversationId: conversation.id,
    message,
    conversation: updatedConversation,
  });
  webhookEvents.emit('conversationUpdated', { organizationId, conversation: updatedConversation });

  return message;
};

// ── Broadcast: send to bot subscribers (rate-limited) ──────────────────────
//
// Telegram bots can only message users who have already messaged the bot, so the
// audience is our stored TELEGRAM conversations (optionally filtered by a tag).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const resolveBroadcastAudience = (organizationId: string, tag?: string) =>
  prisma.conversation.findMany({
    where: {
      organizationId,
      channel: 'TELEGRAM',
      telegramChatId: { not: null },
      telegramBotId: { not: null },
      isArchived: false,
      ...(tag ? { contact: { tags: { has: tag } } } : {}),
    },
    select: { id: true, telegramChatId: true, telegramBotId: true },
  });

/** How many subscribers a broadcast would reach (for the compose preview). */
export const getBroadcastAudienceCount = async (organizationId: string, tag?: string) => {
  const rows = await resolveBroadcastAudience(organizationId, tag);
  return rows.length;
};

export const getBroadcasts = (organizationId: string) =>
  prisma.telegramBroadcast.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

/**
 * Callers pass either a full MIME type ("image/png") or the short kind
 * ("image"). Matching only the MIME prefix silently sent every photo as a
 * document, so both forms are accepted here.
 */
const mediaKind = (value: string): 'image' | 'video' | 'audio' | 'document' => {
  const v = (value || '').toLowerCase();
  if (v.startsWith('image/') || v === 'image') return 'image';
  if (v.startsWith('video/') || v === 'video') return 'video';
  if (v.startsWith('audio/') || v === 'audio') return 'audio';
  return 'document';
};

const mediaPlanFromMime = (mime: string) => {
  switch (mediaKind(mime)) {
    case 'image': return { method: 'sendPhoto', field: 'photo' };
    case 'video': return { method: 'sendVideo', field: 'video' };
    case 'audio': return { method: 'sendAudio', field: 'audio' };
    default: return { method: 'sendDocument', field: 'document' };
  }
};
const mediaMsgType = (mime: string) => {
  const kind = mediaKind(mime);
  return kind === 'video' ? 'VIDEO' : kind === 'audio' ? 'AUDIO' : kind === 'image' ? 'IMAGE' : 'DOCUMENT';
};

/**
 * Create a broadcast (persisting one PENDING row per recipient so it is
 * resumable) and start sending in the background. Returns immediately; progress
 * is polled from getBroadcasts and finished rows can never be re-sent.
 */
export const createBroadcast = async (
  organizationId: string,
  data: { message: string; buttons?: any; tag?: string; mediaUrl?: string; mediaType?: string }
) => {
  const text = (data.message || '').trim();
  if (!text && !data.mediaUrl) throw new Error('A message or media is required');

  const audience = await resolveBroadcastAudience(organizationId, data.tag);
  if (audience.length === 0) throw new Error('No Telegram subscribers to send to');

  const broadcast = await prisma.telegramBroadcast.create({
    data: {
      organizationId,
      message: text,
      buttons: Array.isArray(data.buttons) && data.buttons.length ? data.buttons : undefined,
      mediaUrl: data.mediaUrl || null,
      mediaType: data.mediaType || null,
      audienceTag: data.tag || null,
      status: 'SENDING',
      total: audience.length,
    },
  });

  await prisma.telegramBroadcastRecipient.createMany({
    data: audience
      .filter((c) => c.telegramChatId && c.telegramBotId)
      .map((c) => ({
        broadcastId: broadcast.id,
        conversationId: c.id,
        chatId: c.telegramChatId as string,
        botId: c.telegramBotId as string,
        status: 'PENDING',
      })),
  });

  processBroadcast(organizationId, broadcast.id).catch((err) =>
    console.error('[telegram broadcast] fatal:', err?.message || err)
  );

  return broadcast;
};

/**
 * Drive a broadcast to completion by sending to its PENDING recipients. Safe to
 * call again after a crash — SENT/FAILED rows are skipped, so no one is messaged
 * twice. Uses file_id reuse for media so the file uploads at most once.
 */
export const processBroadcast = async (organizationId: string, broadcastId: string): Promise<void> => {
  const broadcast = await prisma.telegramBroadcast.findFirst({ where: { id: broadcastId, organizationId } });
  if (!broadcast) return;

  // Only one instance drives a given broadcast at a time (multi-instance safety);
  // another instance simply skips this tick if it can't take the lock.
  await withAdvisoryLock(`tg-broadcast:${broadcastId}`, async () => {
  const bots = await prisma.telegramBot.findMany({ where: { organizationId } });
  const tokenByBot: Record<string, string | null> = {};
  for (const b of bots) tokenByBot[b.id] = decrypt(b.botToken);

  const text = broadcast.message || '';
  const buttons = (broadcast.buttons as any) || undefined;
  const replyMarkup = buildReplyMarkup(buttons);
  const extra = replyMarkup ? { reply_markup: replyMarkup } : undefined;
  const btnMeta = replyMarkup && Array.isArray(buttons) && buttons.length ? buttons : undefined;

  const hasMedia = !!broadcast.mediaUrl;
  const plan = hasMedia ? mediaPlanFromMime((broadcast.mediaType || '').toLowerCase()) : null;
  const msgType = hasMedia ? mediaMsgType((broadcast.mediaType || '').toLowerCase()) : 'TEXT';
  let mediaRef = broadcast.mediaUrl || ''; // URL first; switches to file_id after the first send

  let done = 0;
  for (;;) {
    const batch = await prisma.telegramBroadcastRecipient.findMany({
      where: { broadcastId, status: 'PENDING' },
      take: 50,
    });
    if (batch.length === 0) break;

    for (const r of batch) {
      const token = tokenByBot[r.botId];
      if (!token) {
        await prisma.telegramBroadcastRecipient.update({ where: { id: r.id }, data: { status: 'FAILED', error: 'bot token unavailable' } });
      } else {
        try {
          let res: any;
          if (hasMedia && plan) {
            res = await tg.sendMediaByRef(token, r.chatId, plan.method, plan.field, mediaRef, text || undefined, extra);
            // Reuse the returned file_id for subsequent sends.
            const fid = plan.field === 'photo' ? res?.photo?.[res.photo.length - 1]?.file_id : res?.[plan.field]?.file_id;
            if (fid) mediaRef = fid;
          } else {
            res = await tg.sendMessage(token, r.chatId, text, extra);
          }
          await prisma.message.create({
            data: {
              conversationId: r.conversationId,
              channel: 'TELEGRAM',
              telegramMessageId: String(res.message_id),
              direction: 'OUTBOUND',
              type: msgType,
              content: text || null,
              mediaUrl: hasMedia ? broadcast.mediaUrl : null,
              mediaType: hasMedia ? broadcast.mediaType : null,
              mediaMimeType: hasMedia ? broadcast.mediaType : null,
              metadata: { broadcastId, ...(btnMeta ? { buttons: btnMeta } : {}) },
              status: 'SENT',
              sentAt: new Date(),
              timestamp: new Date(),
            },
          });
          await prisma.conversation.update({
            where: { id: r.conversationId },
            data: { lastMessageAt: new Date(), lastMessagePreview: (text || '📎 Attachment').slice(0, 120) },
          });
          await prisma.telegramBroadcastRecipient.update({ where: { id: r.id }, data: { status: 'SENT' } });
        } catch (err: any) {
          await prisma.telegramBroadcastRecipient.update({ where: { id: r.id }, data: { status: 'FAILED', error: String(err?.message || err).slice(0, 300) } });
        }
      }

      done++;
      if (done % 20 === 0) await refreshBroadcastCounts(broadcastId);
      await sleep(50); // ~20 msgs/sec, under Telegram's limits
    }
  }

  await refreshBroadcastCounts(broadcastId, true);
  });
};

/** Recompute sent/failed from recipient rows; optionally mark the broadcast done. */
const refreshBroadcastCounts = async (broadcastId: string, finalize = false) => {
  const [sent, failed, pending] = await Promise.all([
    prisma.telegramBroadcastRecipient.count({ where: { broadcastId, status: 'SENT' } }),
    prisma.telegramBroadcastRecipient.count({ where: { broadcastId, status: 'FAILED' } }),
    prisma.telegramBroadcastRecipient.count({ where: { broadcastId, status: 'PENDING' } }),
  ]);
  const data: any = { sent, failed };
  if (finalize && pending === 0) {
    data.status = 'COMPLETED';
    data.completedAt = new Date();
  }
  await prisma.telegramBroadcast.update({ where: { id: broadcastId }, data }).catch(() => {});
};

/**
 * Boot recovery: resume any broadcast left SENDING by a crash/restart. Called
 * once on server start; each resumes from its remaining PENDING recipients.
 */
export const resumeStuckBroadcasts = async (): Promise<void> => {
  const stuck = await prisma.telegramBroadcast.findMany({ where: { status: 'SENDING' }, select: { id: true, organizationId: true } });
  for (const b of stuck) {
    processBroadcast(b.organizationId, b.id).catch((err) =>
      console.error('[telegram broadcast recovery] error:', err?.message || err)
    );
  }
  if (stuck.length) console.log(`↻ Resumed ${stuck.length} Telegram broadcast(s)`);
};
